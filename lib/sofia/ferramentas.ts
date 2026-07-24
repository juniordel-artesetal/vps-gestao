// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS DA SOFIA — busca em linguagem natural, SOMENTE LEITURA.
//
// PRINCÍPIO INEGOCIÁVEL (anti-alucinação): todo id/link aqui vem do BANCO. A IA só
// interpreta a intenção e escolhe a ferramenta+parâmetros; QUEM monta os resultados
// (com id real + link de deep-link verdadeiro) é este backend. A IA jamais escreve
// um id/pedido.
//
// Segurança: toda query é raw, escopada por workspaceId, sem SELECT *. LGPD: NUNCA
// devolvemos CPF/documento/endereço — nem para a IA, nem para a UI (a artesã abre o
// cadastro pelo link para ver o resto).
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { STATUS_PEDIDO_LABEL } from '@/lib/statusPedido'

const TOP = 6 // teto de itens por resposta; acima disso oferecemos "ver todos"

export interface ItemResultado {
  id: string
  titulo: string
  subtitulo?: string
  badge?: string
  link: string
}
export interface RespostaBusca {
  tipo: 'pedidos' | 'clientes' | 'produtos' | 'financeiro'
  total: number
  itens: ItemResultado[]
  verTodos?: string // link para a lista completa quando total > TOP
}

const like = (s: string) => `%${String(s).trim()}%`
const brl = (n: number | null | undefined) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const dataBR = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR') : '')

/** Mapeia termos em PT para o status canônico do pedido (statusPedido.ts). */
export function statusDoTermo(t?: string | null): string | null {
  if (!t) return null
  const m = t.toLowerCase()
  if (/aberto|aguardando|novo/.test(m)) return 'ABERTO'
  if (/produ[çc]|fazendo|andamento/.test(m)) return 'EM_PRODUCAO'
  if (/pronto|finaliz|conclu/.test(m)) return 'PRONTO'
  if (/enviad|entregue|expedi|despach/.test(m)) return 'ENVIADO'
  if (/cancel/.test(m)) return 'CANCELADO'
  return null
}

export interface FiltrosPedido { cliente?: string; produto?: string; numero?: string; status?: string; periodoDe?: string; periodoAte?: string }

export async function buscarPedidos(workspaceId: string, f: FiltrosPedido): Promise<RespostaBusca> {
  // Cliente do pedido: 'destinatario' é o nome exibido; 'cliente' é legado. Busca nos dois.
  const conds: Prisma.Sql[] = [Prisma.sql`"workspaceId" = ${workspaceId}`]
  if (f.numero) conds.push(Prisma.sql`"numero" ILIKE ${like(f.numero)}`)
  if (f.cliente) conds.push(Prisma.sql`("destinatario" ILIKE ${like(f.cliente)} OR "cliente" ILIKE ${like(f.cliente)})`)
  if (f.produto) conds.push(Prisma.sql`("produto" ILIKE ${like(f.produto)} OR "observacoes" ILIKE ${like(f.produto)})`)
  const status = statusDoTermo(f.status)
  if (status) conds.push(Prisma.sql`"status" = ${status}`)
  if (f.periodoDe) conds.push(Prisma.sql`"dataEntrada"::date >= ${f.periodoDe}::date`)
  if (f.periodoAte) conds.push(Prisma.sql`"dataEntrada"::date <= ${f.periodoAte}::date`)
  const where = Prisma.join(conds, ' AND ')

  const [{ n }] = await prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS n FROM "Order" WHERE ${where}`) as { n: number }[]
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT "id","numero", COALESCE("destinatario","cliente") AS "cliente","produto","status","dataEnvio",
           COALESCE("valor","valorTotal")::float AS "valor"
    FROM "Order" WHERE ${where} ORDER BY "createdAt" DESC LIMIT ${TOP}
  `) as { id: string; numero: string; cliente: string | null; produto: string | null; status: string; dataEnvio: any; valor: number | null }[]

  const itens: ItemResultado[] = rows.map(r => ({
    id: r.id,
    titulo: `#${r.numero}${r.cliente ? ' · ' + r.cliente : ''}`,
    subtitulo: [r.produto, r.valor ? brl(r.valor) : null, r.dataEnvio ? 'envio ' + dataBR(r.dataEnvio) : null].filter(Boolean).join(' · ') || undefined,
    badge: STATUS_PEDIDO_LABEL[r.status] ?? r.status,
    link: `/dashboard/pedidos/${r.id}`,
  }))

  // "Ver todos" respeita o filtro quando dá para traduzir em query da lista.
  const q = new URLSearchParams()
  if (status) q.set('status', status)
  const verTodos = n > itens.length ? `/dashboard/pedidos${q.toString() ? '?' + q.toString() : ''}` : undefined
  return { tipo: 'pedidos', total: n, itens, verTodos }
}

export async function buscarClientes(workspaceId: string, termo: string): Promise<RespostaBusca> {
  const [{ n }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "Cliente"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true AND "nome" ILIKE ${like(termo)}
  ` as { n: number }[]
  // LGPD: só nome + contadores. NUNCA documento/email/telefone/endereço aqui.
  const rows = await prisma.$queryRaw`
    SELECT "id","nome","totalPedidos","pedidosEmAberto"
    FROM "Cliente"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true AND "nome" ILIKE ${like(termo)}
    ORDER BY "ultimoPedidoData" DESC NULLS LAST LIMIT ${TOP}
  ` as { id: string; nome: string; totalPedidos: number | null; pedidosEmAberto: number | null }[]

  const itens: ItemResultado[] = rows.map(r => ({
    id: r.id,
    titulo: r.nome,
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

export interface FiltrosFinanceiro { tipo?: 'DESPESA' | 'RECEITA'; status?: 'PAGO' | 'PENDENTE'; termo?: string; ateHoje?: boolean }

export async function buscarFinanceiro(workspaceId: string, f: FiltrosFinanceiro): Promise<RespostaBusca> {
  const conds: Prisma.Sql[] = [Prisma.sql`"workspaceId" = ${workspaceId}`]
  if (f.tipo) conds.push(Prisma.sql`"tipo" = ${f.tipo}`)
  if (f.status) conds.push(Prisma.sql`"status" = ${f.status}`)
  if (f.termo) conds.push(Prisma.sql`"descricao" ILIKE ${like(f.termo)}`)
  if (f.ateHoje) conds.push(Prisma.sql`"data"::date <= CURRENT_DATE`)
  const where = Prisma.join(conds, ' AND ')

  const [{ n }] = await prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS n FROM "FinLancamento" WHERE ${where}`) as { n: number }[]
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT "id","descricao","tipo","status","valor"::float AS "valor","data"
    FROM "FinLancamento" WHERE ${where} ORDER BY "data" ASC LIMIT ${TOP}
  `) as { id: string; descricao: string; tipo: string; status: string; valor: number; data: any }[]

  const itens: ItemResultado[] = rows.map(r => ({
    id: r.id,
    titulo: r.descricao,
    subtitulo: `${brl(r.valor)} · vence ${dataBR(r.data)}`,
    badge: r.tipo === 'DESPESA' ? (r.status === 'PENDENTE' ? 'A pagar' : 'Pago') : (r.status === 'PENDENTE' ? 'A receber' : 'Recebido'),
    link: `/financeiro/lancamentos`,
  }))
  return { tipo: 'financeiro', total: n, itens, verTodos: n > itens.length ? '/financeiro/lancamentos' : undefined }
}
