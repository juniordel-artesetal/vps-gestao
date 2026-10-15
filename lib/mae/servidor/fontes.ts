// Método MAE — FONTES DE PEDIDOS (Lote 7, item 120). A edição em massa não sabe de onde vem o pedido:
//  • fonteSoa — "Order" do SOA (como sempre foi), ajustes em camposExtras._mae;
//  • fonteMae — mae_orders do MAE AVULSO (planilha da Shopee / cadastro manual), ajustes em mae_orders.ajustes.
// As duas devolvem o MESMO formato (PedidoMae) e aceitam o mesmo PATCH. Toda query filtra pelo workspace.
import { prisma } from '@/lib/prisma'
import { campoParaGravar } from '@/lib/mae/pedidos/pedidos'
import { lerExtras, camposSimples, ajustesParaTela, aplicarAjustes, temAjuste, semAcento } from './ajustesPedido'
import { PREFIXO_PEDIDO_MAE } from './plano'

export interface ItemMae { nome: string; variacaoId: string | null; quantidade: number | null; qtdVendida: number | null; produtoId: string | null; produto: string | null; variacao: string | null; pecasKit: number | null }
export interface ArteMae { themeId: string; themeVersion: number; variaveis: unknown; status: string; arquivo: string | null; criadoEm: Date }
export interface PedidoMae {
  id: string; numero: string; cliente: string | null; status: string; criado: Date
  observacoes: string | null; campos: Record<string, string>; ajustes: ReturnType<typeof ajustesParaTela>
  itens: ItemMae[]; artes: ArteMae[]
  /** Lote 7: de onde veio, canal/loja e prazo de envio (filtros), etapa do SOA ou status do MAE avulso. */
  origem: 'soa' | 'shopee' | 'manual'; canal: string | null; loja: string | null; dataEnvio: string | null
  etapa: { nome: string; tipo: string | null } | null; statusMae: 'pendente' | 'gerado' | 'impresso' | null
}

const data = (d: Date | string | null | undefined): string | null => {
  if (!d) return null
  const x = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10)
}
/** "Loja" = campo do pedido chamado Loja (o canal não diz qual das lojas Shopee — decisão do Júnior, item 116). */
const lojaDe = (campos: Record<string, string>) => Object.entries(campos).find(([k]) => semAcento(k) === 'loja')?.[1] ?? null

async function artesDe(ws: string, ids: string[]): Promise<Map<string, ArteMae[]>> {
  const m = new Map<string, ArteMae[]>()
  if (!ids.length) return m
  const rs = await prisma.$queryRaw<{ order_id: string; theme_id: string; theme_version: number; variaveis: unknown; status: string; arquivo: string | null; criado_em: Date }[]>`
    SELECT order_id, theme_id, theme_version, variaveis, status, arquivo, criado_em FROM mae_order_arts
    WHERE workspace_id = ${ws} AND order_id = ANY(${ids}) ORDER BY criado_em`
  for (const a of rs) {
    const l = m.get(a.order_id) ?? []
    l.push({ themeId: a.theme_id, themeVersion: a.theme_version, variaveis: a.variaveis, status: a.status, arquivo: a.arquivo, criadoEm: a.criado_em })
    m.set(a.order_id, l)
  }
  return m
}

/** Produto e variação do SOA de cada item (vínculo produto ↔ tema). */
async function produtosDasVariacoes(ws: string, ids: string[]) {
  const m = new Map<string, { produtoId: string; produto: string; variacao: string | null; pecasKit: number | null }>()
  if (!ids.length) return m
  const vs = await prisma.$queryRaw<{ id: string; produtoId: string; produto: string; variacao: string | null; isKit: boolean | null; qtdKit: number | null }[]>`
    SELECT v."id", v."produtoId", p."nome" AS produto, NULLIF(TRIM(COALESCE(v."nome", '')), '') AS variacao, v."isKit", v."qtdKit"
    FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE p."workspaceId" = ${ws} AND v."id" = ANY(${ids})`
  for (const v of vs) m.set(v.id, { produtoId: v.produtoId, produto: v.produto, variacao: v.variacao, pecasKit: v.isKit && Number(v.qtdKit) > 1 ? Number(v.qtdKit) : null })
  return m
}

const qtd = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null)

// ── SOA ─────────────────────────────────────────────────────────────────────────────────────────
type LinhaSoa = { id: string; numero: string; cliente: string | null; produto: string | null; status: string; camposExtras: unknown; criado: Date; observacoes: string | null; quantidade: number | null; canal: string | null; dataEnvio: Date | null; etapaNome: string | null; etapaTipo: string | null }

export async function listarSoa(ws: string, id?: string): Promise<PedidoMae[]> {
  const linhas = id
    ? await prisma.$queryRaw<LinhaSoa[]>`
        SELECT o."id", o."numero", o."destinatario" AS cliente, o."produto", o."status", o."camposExtras", o."createdAt" AS criado, o."observacoes", o."quantidade",
               o."canal", o."dataEnvio", sc."nome" AS "etapaNome", sc."tipo" AS "etapaTipo"
        FROM "Order" o
        LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
        LEFT JOIN "SetorConfig" sc ON sc."id" = psa."setorId"
        WHERE o."workspaceId" = ${ws} AND o."id" = ${id} LIMIT 1`
    : await prisma.$queryRaw<LinhaSoa[]>`
        SELECT o."id", o."numero", o."destinatario" AS cliente, o."produto", o."status", o."camposExtras", o."createdAt" AS criado, o."observacoes", o."quantidade",
               o."canal", o."dataEnvio", sc."nome" AS "etapaNome", sc."tipo" AS "etapaTipo"
        FROM "Order" o
        LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
        LEFT JOIN "SetorConfig" sc ON sc."id" = psa."setorId"
        WHERE o."workspaceId" = ${ws} AND o."status" NOT IN ('CANCELADO','ENVIADO','PRONTO','CONCLUIDO','ENTREGUE')
        ORDER BY o."createdAt" DESC LIMIT 300`
  const itensPorPedido = new Map<string, { nome: string; variacaoId: string | null; quantidade: number | null; qtdVendida: number | null }[]>()
  const variacoes = new Set<string>()
  for (const l of linhas) {
    const ex = lerExtras(l.camposExtras)
    const its = Array.isArray(ex.produtos) && ex.produtos.length
      ? (ex.produtos as { nome?: string; variacaoId?: string; quantidade?: unknown; qtdVendida?: unknown; componenteDe?: string }[]).filter(p => p?.nome && !p.componenteDe).map(p => ({
          nome: String(p.nome), variacaoId: p.variacaoId || null, quantidade: qtd(p.quantidade), qtdVendida: qtd(p.qtdVendida),
        }))
      : l.produto ? [{ nome: l.produto, variacaoId: null, quantidade: l.quantidade ?? null, qtdVendida: null }] : []
    for (const i of its) if (i.variacaoId) variacoes.add(i.variacaoId)
    itensPorPedido.set(l.id, its)
  }
  const [prodDaVar, artes] = await Promise.all([produtosDasVariacoes(ws, [...variacoes]), artesDe(ws, linhas.map(l => l.id))])
  return linhas.map(l => {
    const ex = lerExtras(l.camposExtras)
    const campos = camposSimples(ex)
    return {
      id: l.id, numero: l.numero, cliente: l.cliente, status: l.status, criado: l.criado,
      observacoes: l.observacoes?.trim() || null, campos,
      ajustes: ajustesParaTela((ex._mae as Record<string, unknown>) ?? {}),
      itens: (itensPorPedido.get(l.id) ?? []).map(i => {
        const pv = i.variacaoId ? prodDaVar.get(i.variacaoId) : undefined
        return { ...i, produtoId: pv?.produtoId ?? null, produto: pv?.produto ?? null, variacao: pv?.variacao ?? null, pecasKit: pv?.pecasKit ?? null }
      }),
      artes: artes.get(l.id) ?? [],
      origem: 'soa', canal: l.canal?.trim() || null, loja: lojaDe(campos), dataEnvio: data(l.dataEnvio),
      etapa: l.etapaNome ? { nome: l.etapaNome, tipo: l.etapaTipo } : null, statusMae: null,
    }
  })
}

export async function patchSoa(ws: string, id: string, b: Record<string, unknown>): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const [l] = await prisma.$queryRaw<{ camposExtras: unknown }[]>`SELECT o."camposExtras" FROM "Order" o WHERE o."workspaceId" = ${ws} AND o."id" = ${id} LIMIT 1`
  if (!l) return { status: 404, corpo: { error: 'Pedido não encontrado' } }
  let ex = lerExtras(l.camposExtras)
  if (b.campos && typeof b.campos === 'object') {
    const cfg = await prisma.$queryRaw<{ nome: string }[]>`SELECT "nome" FROM "PedidoCampoConfig" WHERE "workspaceId" = ${ws} AND "ativo" = true`
    const novos: Record<string, string> = {}
    const bc = b.campos as Record<string, unknown>
    for (const v of ['NOME', 'IDADE', 'TEMA'] as const) {
      const val = bc[v]
      if (typeof val !== 'string') continue
      novos[campoParaGravar(v, cfg.map(x => x.nome), Object.keys(ex))] = val.trim().slice(0, 120)
    }
    // Lote 5 (item 77): campos extras (SÉRIE/TURMA, PROFESSORA, FRASE…) — no campo do ateliê com o mesmo nome
    for (const [v, val] of Object.entries(bc)) {
      if (['NOME', 'IDADE', 'TEMA'].includes(v) || typeof val !== 'string' || !/^[\p{L}0-9 _/-]{1,40}$/u.test(v)) continue
      const alvo = [...Object.keys(ex), ...cfg.map(x => x.nome)].find(k => semAcento(k) === semAcento(v)) ?? (v.charAt(0) + v.slice(1).toLowerCase())
      novos[alvo] = val.trim().slice(0, 200)
    }
    if (!Object.keys(novos).length) return { status: 400, corpo: { error: 'Nada para gravar' } }
    // merge no banco (jsonb ||): não pisa num campo que a equipe acabou de editar na tela do pedido
    await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = (COALESCE(NULLIF("camposExtras", '')::jsonb, '{}'::jsonb) || ${JSON.stringify(novos)}::jsonb)::text, "updatedAt" = NOW()
      WHERE "workspaceId" = ${ws} AND "id" = ${id}`
    if (!temAjuste(b)) return { status: 200, corpo: { ok: true, campos: novos } }
    const [l2] = await prisma.$queryRaw<{ camposExtras: unknown }[]>`SELECT o."camposExtras" FROM "Order" o WHERE o."workspaceId" = ${ws} AND o."id" = ${id} LIMIT 1`
    ex = lerExtras(l2?.camposExtras)
  }
  const mae = aplicarAjustes((ex._mae as Record<string, unknown>) ?? {}, b)
  await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = ${JSON.stringify({ ...ex, _mae: mae })}, "updatedAt" = NOW() WHERE "workspaceId" = ${ws} AND "id" = ${id}`
  return { status: 200, corpo: { ok: true, ...ajustesParaTela(mae) } }
}

/** Lote 7 (item 116): o MESMO tema em vários pedidos do SOA, numa query só (null volta ao automático). */
export async function temaEmMassaSoa(ws: string, ids: string[], temaId: string | null): Promise<number> {
  if (!ids.length) return 0
  return temaId
    ? prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = (
          COALESCE(NULLIF("camposExtras", '')::jsonb, '{}'::jsonb)
          || jsonb_build_object('_mae', COALESCE(NULLIF("camposExtras", '')::jsonb -> '_mae', '{}'::jsonb) || jsonb_build_object('temaId', ${temaId}::text))
        )::text, "updatedAt" = NOW()
        WHERE "workspaceId" = ${ws} AND "id" = ANY(${ids})`
    : prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = (
          COALESCE(NULLIF("camposExtras", '')::jsonb, '{}'::jsonb)
          || jsonb_build_object('_mae', COALESCE(NULLIF("camposExtras", '')::jsonb -> '_mae', '{}'::jsonb) - 'temaId')
        )::text, "updatedAt" = NOW()
        WHERE "workspaceId" = ${ws} AND "id" = ANY(${ids})`
}

// ── MAE avulso (mae_orders) ───────────────────────────────────────────────────────────────────
type LinhaMae = { id: string; origem: string; numero: string; cliente: string | null; canal: string | null; loja: string | null; itens: unknown; data_envio: Date | null; observacao: string | null; campos: unknown; ajustes: unknown; status: string; criado_em: Date }

export async function listarMae(ws: string, id?: string): Promise<PedidoMae[]> {
  const linhas = id
    ? await prisma.$queryRaw<LinhaMae[]>`SELECT * FROM mae_orders WHERE workspace_id = ${ws} AND id = ${id} LIMIT 1`
    : await prisma.$queryRaw<LinhaMae[]>`SELECT * FROM mae_orders WHERE workspace_id = ${ws} AND status <> 'arquivado' ORDER BY criado_em DESC LIMIT 500`
  const artes = await artesDe(ws, linhas.map(l => l.id))
  return linhas.map(l => {
    const campos = camposSimples(lerExtras(l.campos))
    const itens = (Array.isArray(l.itens) ? l.itens : []) as { nome?: string; variacao?: string; quantidade?: unknown }[]
    return {
      // sem SOA não há aprovação: o status é o do MAE (a tela mostra "gerado"/"impresso")
      id: l.id, numero: l.numero, cliente: l.cliente, status: 'AVULSO', criado: l.criado_em,
      observacoes: l.observacao?.trim() || null, campos,
      ajustes: ajustesParaTela(lerExtras(l.ajustes)),
      // sem SOA: o "produto" é o nome digitado/da planilha (o grupo da base liga pelo nome — item 96)
      itens: itens.filter(i => i?.nome).map(i => ({ nome: String(i.nome), variacaoId: null, quantidade: qtd(i.quantidade), qtdVendida: qtd(i.quantidade), produtoId: null, produto: String(i.nome), variacao: i.variacao ? String(i.variacao) : null, pecasKit: null })),
      artes: artes.get(l.id) ?? [],
      origem: l.origem === 'shopee' ? 'shopee' : 'manual', canal: l.canal ?? (l.origem === 'shopee' ? 'Shopee' : null), loja: l.loja ?? lojaDe(campos), dataEnvio: data(l.data_envio),
      etapa: null, statusMae: (['pendente', 'gerado', 'impresso'].includes(l.status) ? l.status : 'pendente') as PedidoMae['statusMae'],
    }
  })
}

export async function patchMae(ws: string, id: string, b: Record<string, unknown>): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const [l] = await prisma.$queryRaw<{ campos: unknown; ajustes: unknown }[]>`SELECT campos, ajustes FROM mae_orders WHERE workspace_id = ${ws} AND id = ${id} LIMIT 1`
  if (!l) return { status: 404, corpo: { error: 'Pedido não encontrado' } }
  if (b.campos && typeof b.campos === 'object') {
    const novos: Record<string, string> = {}
    for (const [v, val] of Object.entries(b.campos as Record<string, unknown>)) {
      if (typeof val !== 'string' || !/^[\p{L}0-9 _/-]{1,40}$/u.test(v)) continue
      novos[v.toLocaleUpperCase('pt-BR')] = val.trim().slice(0, 200)
    }
    if (!Object.keys(novos).length) return { status: 400, corpo: { error: 'Nada para gravar' } }
    await prisma.$executeRaw`UPDATE mae_orders SET campos = campos || ${JSON.stringify(novos)}::jsonb, atualizado_em = now() WHERE workspace_id = ${ws} AND id = ${id}`
    if (!temAjuste(b)) return { status: 200, corpo: { ok: true, campos: novos } }
  }
  const mae = aplicarAjustes(lerExtras(l.ajustes), b)
  await prisma.$executeRaw`UPDATE mae_orders SET ajustes = ${JSON.stringify(mae)}::jsonb, atualizado_em = now() WHERE workspace_id = ${ws} AND id = ${id}`
  return { status: 200, corpo: { ok: true, ...ajustesParaTela(mae) } }
}

export async function temaEmMassaMae(ws: string, ids: string[], temaId: string | null): Promise<number> {
  if (!ids.length) return 0
  return temaId
    ? prisma.$executeRaw`UPDATE mae_orders SET ajustes = ajustes || jsonb_build_object('temaId', ${temaId}::text), atualizado_em = now() WHERE workspace_id = ${ws} AND id = ANY(${ids})`
    : prisma.$executeRaw`UPDATE mae_orders SET ajustes = ajustes - 'temaId', atualizado_em = now() WHERE workspace_id = ${ws} AND id = ANY(${ids})`
}

// ── criação (cadastro manual e planilha) ──────────────────────────────────────────────────────
export interface NovoPedidoMae { origem: 'shopee' | 'manual'; numero: string; cliente?: string | null; canal?: string | null; loja?: string | null; itens: { nome: string; variacao?: string | null; quantidade?: number | null }[]; dataEnvio?: string | null; observacao?: string | null; campos?: Record<string, string> }

const novoId = () => `${PREFIXO_PEDIDO_MAE}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
const txt = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
const dataValida = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

/** Saneia um pedido novo (cadastro manual / linha da planilha). Puro. null = inválido (sem nº ou sem produto). */
export function sanearNovoPedido(p: Partial<NovoPedidoMae> & { origem?: string }): NovoPedidoMae | null {
  const numero = txt(p.numero, 60)
  const itens = (Array.isArray(p.itens) ? p.itens : []).slice(0, 30).map(i => ({ nome: txt(i?.nome, 200) ?? '', variacao: txt(i?.variacao, 200), quantidade: qtd(i?.quantidade) ?? 1 })).filter(i => i.nome)
  if (!numero || !itens.length) return null
  const campos: Record<string, string> = {}
  for (const [k, v] of Object.entries(p.campos ?? {})) { const t = txt(v, 200); if (t && /^[\p{L}0-9 _/-]{1,40}$/u.test(k)) campos[k.toLocaleUpperCase('pt-BR')] = t }
  return { origem: p.origem === 'shopee' ? 'shopee' : 'manual', numero, cliente: txt(p.cliente, 200), canal: txt(p.canal, 60), loja: txt(p.loja, 120), itens, dataEnvio: dataValida(p.dataEnvio), observacao: txt(p.observacao, 2000), campos }
}

/** Grava pedidos do MAE avulso. Pedido com o mesmo nº (mesma origem) NÃO se repete (item 121). */
export async function criarPedidosMae(ws: string, lista: NovoPedidoMae[]): Promise<{ novos: number; existentes: number }> {
  let novos = 0
  for (const p of lista) {
    const n = await prisma.$executeRaw`
      INSERT INTO mae_orders (id, workspace_id, origem, numero, cliente, canal, loja, itens, data_envio, observacao, campos)
      VALUES (${novoId()}, ${ws}, ${p.origem}, ${p.numero}, ${p.cliente ?? null}, ${p.canal ?? null}, ${p.loja ?? null}, ${JSON.stringify(p.itens)}::jsonb,
              ${p.dataEnvio ?? null}::date, ${p.observacao ?? null}, ${JSON.stringify(p.campos ?? {})}::jsonb)
      ON CONFLICT (workspace_id, origem, numero) DO NOTHING`
    novos += n
  }
  return { novos, existentes: lista.length - novos }
}

/** Status do MAE avulso: gerado / impresso (não volta de impresso para gerado ao gerar de novo). */
export async function statusMaeEmMassa(ws: string, ids: string[], status: 'gerado' | 'impresso' | 'pendente'): Promise<number> {
  if (!ids.length) return 0
  // Lote 18 (item 223): "Desmarcar impresso" — o avulso volta para pendente
  if (status === 'pendente') return prisma.$executeRaw`UPDATE mae_orders SET status = 'pendente', atualizado_em = now() WHERE workspace_id = ${ws} AND id = ANY(${ids})`
  return status === 'impresso'
    ? prisma.$executeRaw`UPDATE mae_orders SET status = 'impresso', atualizado_em = now() WHERE workspace_id = ${ws} AND id = ANY(${ids})`
    : prisma.$executeRaw`UPDATE mae_orders SET status = 'gerado', atualizado_em = now() WHERE workspace_id = ${ws} AND id = ANY(${ids}) AND status = 'pendente'`
}
