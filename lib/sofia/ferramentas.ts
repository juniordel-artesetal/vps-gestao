// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS DA SOFIA — dados reais, SOMENTE LEITURA.
//
// PRINCÍPIO INEGOCIÁVEL (anti-alucinação): todo id/link vem do BANCO. A IA só
// interpreta a intenção e escolhe a ferramenta+FILTROS estruturados; QUEM executa
// e monta os resultados (com id real + deep-link verdadeiro) é este backend. A IA
// jamais escreve id/pedido, e NUNCA jogamos a frase crua da artesã num LIKE — só
// filtros semânticos (setor, status, data, nome de cliente/produto/número).
//
// Segurança: raw, escopado por workspaceId, sem SELECT *. LGPD: nunca devolvemos
// CPF/documento/endereço.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { STATUS_PEDIDO_LABEL, sqlFinalizado, workspaceTemExpedicao } from '@/lib/statusPedido'

const TOP = 6

export interface ItemResultado {
  id: string
  titulo: string
  subtitulo?: string
  badge?: string
  setor?: string
  link: string
}
export interface RespostaBusca {
  tipo: 'pedidos' | 'clientes' | 'produtos' | 'financeiro' | 'estoque'
  total: number
  itens: ItemResultado[]
  verTodos?: string
}

const like = (s: string) => `%${String(s).trim()}%`
const brl = (n: number | null | undefined) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const dataBR = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR') : '')

export type Periodo = 'hoje' | 'amanha' | 'semana' | 'mes'
/** Fragmento de data para um período, sobre a coluna informada. */
function periodoSql(col: Prisma.Sql, p?: Periodo | null): Prisma.Sql | null {
  if (p === 'hoje') return Prisma.sql`${col}::date = CURRENT_DATE`
  if (p === 'amanha') return Prisma.sql`${col}::date = CURRENT_DATE + 1`
  if (p === 'semana') return Prisma.sql`${col}::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`
  if (p === 'mes') return Prisma.sql`date_trunc('month', ${col}) = date_trunc('month', CURRENT_DATE)`
  return null
}

export function statusDoTermo(t?: string | null): string | null {
  if (!t) return null
  const m = t.toLowerCase()
  if (/aberto|aguardando|novo/.test(m)) return 'ABERTO'
  if (/produ[çc]|fazendo|andamento/.test(m)) return 'EM_PRODUCAO'
  if (/pronto|finaliz|conclu/.test(m)) return 'PRONTO'
  if (/enviad|entregue|expedi|despach|saiu|sa[ií]ram/.test(m)) return 'ENVIADO'
  if (/cancel/.test(m)) return 'CANCELADO'
  return null
}

export interface FiltrosPedido {
  cliente?: string; produto?: string; numero?: string; statusPedido?: string
  setor?: string; canal?: string; periodo?: Periodo; semData?: boolean
  naoEnviados?: boolean; atrasados?: boolean; ordenar?: 'antigos' | 'recentes'
}

function condsPedido(workspaceId: string, f: FiltrosPedido): Prisma.Sql[] {
  const c: Prisma.Sql[] = [Prisma.sql`o."workspaceId" = ${workspaceId}`]
  if (f.numero) c.push(Prisma.sql`o."numero" ILIKE ${like(f.numero)}`)
  if (f.cliente) c.push(Prisma.sql`(o."destinatario" ILIKE ${like(f.cliente)} OR o."cliente" ILIKE ${like(f.cliente)})`)
  if (f.produto) c.push(Prisma.sql`(o."produto" ILIKE ${like(f.produto)} OR o."observacoes" ILIKE ${like(f.produto)})`)
  const st = statusDoTermo(f.statusPedido)
  if (st) c.push(Prisma.sql`o."status" = ${st}`)
  if (f.canal) c.push(Prisma.sql`o."canal" ILIKE ${like(f.canal)}`)
  if (f.setor) c.push(Prisma.sql`sca."nome" ILIKE ${like(f.setor)}`)
  if (f.semData) c.push(Prisma.sql`o."dataEnvio" IS NULL`)
  if (f.naoEnviados) c.push(Prisma.sql`o."status" <> 'ENVIADO' AND o."status" <> 'CANCELADO'`)
  const per = periodoSql(Prisma.sql`o."dataEnvio"`, f.periodo)
  if (per) c.push(per)
  return c
}

export async function buscarPedidos(workspaceId: string, f: FiltrosPedido): Promise<RespostaBusca> {
  const conds = condsPedido(workspaceId, f)
  if (f.atrasados) {
    const temExp = await workspaceTemExpedicao(workspaceId)
    conds.push(Prisma.sql`NOT ${sqlFinalizado(Prisma.sql`o."status"`, temExp)} AND o."dataEnvio" IS NOT NULL AND o."dataEnvio"::date < CURRENT_DATE`)
  }
  const where = Prisma.join(conds, ' AND ')
  const ordem = f.ordenar === 'antigos' ? Prisma.sql`o."dataEnvio" ASC NULLS LAST` : Prisma.sql`o."createdAt" DESC`

  const [{ n }] = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS n FROM "Order" o
    LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
    LEFT JOIN "SetorConfig" sca ON sca."id" = psa."setorId"
    WHERE ${where}
  `) as { n: number }[]
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT o."id", o."numero", COALESCE(o."destinatario", o."cliente") AS "cliente", o."produto",
           o."status", o."canal", o."dataEnvio", COALESCE(o."valor", o."valorTotal")::float AS "valor",
           sca."nome" AS "setorAtual"
    FROM "Order" o
    LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
    LEFT JOIN "SetorConfig" sca ON sca."id" = psa."setorId"
    WHERE ${where} ORDER BY ${ordem} LIMIT ${TOP}
  `) as { id: string; numero: string; cliente: string | null; produto: string | null; status: string; canal: string | null; dataEnvio: any; valor: number | null; setorAtual: string | null }[]

  const itens: ItemResultado[] = rows.map(r => ({
    id: r.id,
    titulo: `#${r.numero}${r.cliente ? ' · ' + r.cliente : ''}`,
    subtitulo: [r.produto, r.valor ? brl(r.valor) : null, r.dataEnvio ? 'envio ' + dataBR(r.dataEnvio) : null].filter(Boolean).join(' · ') || undefined,
    badge: r.setorAtual || (STATUS_PEDIDO_LABEL[r.status] ?? r.status),
    setor: r.setorAtual || undefined,
    link: `/dashboard/pedidos/${r.id}`,
  }))
  const q = new URLSearchParams()
  const st = statusDoTermo(f.statusPedido); if (st) q.set('status', st)
  if (f.atrasados) q.set('atrasados', '1')
  return { tipo: 'pedidos', total: n, itens, verTodos: n > itens.length ? `/dashboard/pedidos${q.toString() ? '?' + q : ''}` : undefined }
}

export interface Contagem { total: number; porSetor?: { setor: string; n: number }[] }
export async function contarPedidos(workspaceId: string, f: FiltrosPedido, agruparSetor = false): Promise<Contagem> {
  const r = await buscarPedidos(workspaceId, f)
  if (!agruparSetor) return { total: r.total }
  const conds = condsPedido(workspaceId, f)
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(sca."nome", '— sem setor') AS setor, COUNT(*)::int AS n
    FROM "Order" o
    LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
    LEFT JOIN "SetorConfig" sca ON sca."id" = psa."setorId"
    WHERE ${Prisma.join(conds, ' AND ')}
    GROUP BY 1 ORDER BY 2 DESC
  `) as { setor: string; n: number }[]
  return { total: r.total, porSetor: rows }
}

export async function buscarClientes(workspaceId: string, termo: string): Promise<RespostaBusca> {
  const [{ n }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "Cliente"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true AND "nome" ILIKE ${like(termo)}
  ` as { n: number }[]
  const rows = await prisma.$queryRaw`
    SELECT "id","nome","totalPedidos","pedidosEmAberto"
    FROM "Cliente"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true AND "nome" ILIKE ${like(termo)}
    ORDER BY "ultimoPedidoData" DESC NULLS LAST LIMIT ${TOP}
  ` as { id: string; nome: string; totalPedidos: number | null; pedidosEmAberto: number | null }[]
  const itens: ItemResultado[] = rows.map(r => ({
    id: r.id, titulo: r.nome,
    subtitulo: [Number(r.totalPedidos) ? `${r.totalPedidos} pedido(s)` : null, Number(r.pedidosEmAberto) ? `${r.pedidosEmAberto} em aberto` : null].filter(Boolean).join(' · ') || undefined,
    link: `/clientes/${r.id}`,
  }))
  return { tipo: 'clientes', total: n, itens, verTodos: n > itens.length ? '/clientes' : undefined }
}

export async function buscarProdutosMateriais(workspaceId: string, termo: string): Promise<RespostaBusca> {
  const prod = await prisma.$queryRaw`
    SELECT "id","nome","categoria" FROM "PrecProduto"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true AND "nome" ILIKE ${like(termo)}
    ORDER BY "nome" ASC LIMIT ${TOP}
  ` as { id: string; nome: string; categoria: string | null }[]
  const mat = await prisma.$queryRaw`
    SELECT "id","nome","unidade","precoUnidade"::float AS "precoUnidade","fornecedor" FROM "PrecMaterial"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true AND "nome" ILIKE ${like(termo)}
    ORDER BY "nome" ASC LIMIT ${TOP}
  ` as { id: string; nome: string; unidade: string; precoUnidade: number; fornecedor: string | null }[]
  const itens: ItemResultado[] = [
    ...prod.map(p => ({ id: p.id, titulo: p.nome, subtitulo: p.categoria || 'produto', badge: 'Produto', link: `/precificacao/produtos` })),
    ...mat.map(m => ({ id: m.id, titulo: m.nome, subtitulo: `${brl(m.precoUnidade)}/${m.unidade}${m.fornecedor ? ' · ' + m.fornecedor : ''}`, badge: 'Material', link: `/precificacao/materiais` })),
  ].slice(0, TOP)
  return { tipo: 'produtos', total: prod.length + mat.length, itens }
}

export type StatusFin = 'vencido' | 'vence_hoje' | 'a_vencer' | 'pago' | 'a_receber' | 'a_pagar'
export interface FiltrosFinanceiro { statusFin?: StatusFin; periodo?: Periodo; termo?: string }

export async function buscarFinanceiro(workspaceId: string, f: FiltrosFinanceiro): Promise<RespostaBusca> {
  const c: Prisma.Sql[] = [Prisma.sql`"workspaceId" = ${workspaceId}`]
  // Semântica financeira — NUNCA LIKE da frase. Só filtros de status/data.
  switch (f.statusFin) {
    case 'vencido': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO' AND "data"::date < CURRENT_DATE`); break
    case 'vence_hoje': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO' AND "data"::date = CURRENT_DATE`); break
    case 'a_vencer': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO' AND "data"::date > CURRENT_DATE`); break
    case 'a_pagar': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO'`); break
    case 'a_receber': c.push(Prisma.sql`"tipo" = 'RECEITA' AND "status" <> 'PAGO'`); break
    case 'pago': c.push(Prisma.sql`"status" = 'PAGO'`); break
  }
  if (f.termo) c.push(Prisma.sql`"descricao" ILIKE ${like(f.termo)}`)
  const per = periodoSql(Prisma.sql`"data"`, f.periodo)
  if (per) c.push(per)
  const where = Prisma.join(c, ' AND ')

  const [{ n, soma }] = await prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS n, COALESCE(SUM("valor"),0)::float AS soma FROM "FinLancamento" WHERE ${where}`) as { n: number; soma: number }[]
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT "id","descricao","tipo","status","valor"::float AS "valor","data"
    FROM "FinLancamento" WHERE ${where} ORDER BY "data" ASC LIMIT ${TOP}
  `) as { id: string; descricao: string; tipo: string; status: string; valor: number; data: any }[]
  const itens: ItemResultado[] = rows.map(r => ({
    id: r.id, titulo: r.descricao,
    subtitulo: `${brl(r.valor)} · vence ${dataBR(r.data)}`,
    badge: r.tipo === 'DESPESA' ? (r.status === 'PAGO' ? 'Pago' : 'A pagar') : (r.status === 'PAGO' ? 'Recebido' : 'A receber'),
    link: `/financeiro/lancamentos`,
  }))
  return { tipo: 'financeiro', total: n, itens, verTodos: n > itens.length ? '/financeiro/lancamentos' : undefined }
}

/** Soma agregada do financeiro (para "quanto tenho a pagar essa semana"). */
export async function somaFinanceiro(workspaceId: string, f: FiltrosFinanceiro): Promise<{ total: number; soma: number }> {
  const r = await buscarFinanceiro(workspaceId, f)
  const [{ soma }] = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(SUM("valor"),0)::float AS soma FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId} AND ${condFin(f)}
  `) as { soma: number }[]
  return { total: r.total, soma }
}
function condFin(f: FiltrosFinanceiro): Prisma.Sql {
  const c: Prisma.Sql[] = [Prisma.sql`TRUE`]
  switch (f.statusFin) {
    case 'vencido': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO' AND "data"::date < CURRENT_DATE`); break
    case 'vence_hoje': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO' AND "data"::date = CURRENT_DATE`); break
    case 'a_vencer': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO' AND "data"::date > CURRENT_DATE`); break
    case 'a_pagar': c.push(Prisma.sql`"tipo" = 'DESPESA' AND "status" <> 'PAGO'`); break
    case 'a_receber': c.push(Prisma.sql`"tipo" = 'RECEITA' AND "status" <> 'PAGO'`); break
    case 'pago': c.push(Prisma.sql`"status" = 'PAGO'`); break
  }
  const per = periodoSql(Prisma.sql`"data"`, f.periodo)
  if (per) c.push(per)
  return Prisma.join(c, ' AND ')
}

export async function buscarEstoqueBaixo(workspaceId: string): Promise<RespostaBusca> {
  const rows = await prisma.$queryRaw`
    SELECT m."id", m."nome", m."unidade", es."saldoAtual"::float AS "saldo", es."estoqueMinimo"::float AS "minimo"
    FROM "EstMaterialSaldo" es JOIN "PrecMaterial" m ON m."id" = es."materialId"
    WHERE es."workspaceId" = ${workspaceId} AND es."estoqueMinimo" IS NOT NULL AND es."saldoAtual" <= es."estoqueMinimo"
    ORDER BY es."saldoAtual" ASC LIMIT ${TOP}
  ` as { id: string; nome: string; unidade: string | null; saldo: number; minimo: number }[]
  const itens: ItemResultado[] = rows.map(r => ({
    id: r.id, titulo: r.nome,
    subtitulo: `saldo ${r.saldo} ${r.unidade || ''} · mín ${r.minimo}`,
    badge: r.saldo <= 0 ? 'Zerado' : 'Baixo',
    link: `/precificacao/estoque-materiais`,
  }))
  return { tipo: 'estoque', total: itens.length, itens }
}
