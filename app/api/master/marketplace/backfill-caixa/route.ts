// Master — backfill das ENTRADAS de marketplace no caixa: cria o PREVISTO dos pedidos
// ENVIADO de marketplace que ainda não têm lançamento. GET = dry-run (lista); POST = aplica.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { backfillEnviadosSemLancamento } from '@/lib/marketplace/recebivelFluxo'

export const dynamic = 'force-dynamic'

async function autorizado(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

// Resolve o workspace por id OU slug OU trecho do nome.
async function resolverWs(ref: string): Promise<{ id: string; nome: string } | null> {
  const [w] = await prisma.$queryRaw`
    SELECT "id","nome" FROM "Workspace"
    WHERE "id" = ${ref} OR "slug" = ${ref} OR "nome" ILIKE ${'%' + ref + '%'} LIMIT 1
  ` as { id: string; nome: string }[]
  return w || null
}

// Workspaces com o módulo Marketplace (shopee) ATIVO — alvo do backfill "todos".
async function workspacesModuloOn(): Promise<{ id: string; nome: string }[]> {
  return await prisma.$queryRaw`
    SELECT w."id", w."nome" FROM "Workspace" w
    WHERE EXISTS (SELECT 1 FROM "MarketplaceConfig" mc WHERE mc."workspaceId" = w."id" AND mc."canal" = 'shopee' AND mc."ativo" = true)
    ORDER BY w."nome"
  ` as { id: string; nome: string }[]
}

// Executa o backfill (dry-run ou aplica) para 1 ws ou para TODOS os módulo-on, com filtro de dias.
async function executar(ref: string, todos: boolean, dryRun: boolean, dias: number | null) {
  let lista: { id: string; nome: string }[]
  if (todos) {
    lista = await workspacesModuloOn()
  } else {
    const w = await resolverWs(ref)
    lista = w ? [w] : []
  }
  if (lista.length === 0) return { erro: 'Nenhum workspace alvo' }
  let totalPedidos = 0, totalCriados = 0
  const porWs: any[] = []
  for (const ws of lista) {
    const r = await backfillEnviadosSemLancamento(ws.id, dryRun, dias)
    totalPedidos += r.pedidos.length
    totalCriados += r.criados
    porWs.push({ workspace: ws.nome, aCriar: r.pedidos.length, criados: r.criados })
  }
  return { workspaces: lista.length, totalPedidos, totalCriados, porWs, dias: dias ?? 'todos' }
}

export async function GET(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const ref = sp.get('ws') || ''
  const todos = sp.get('todos') === '1'
  const dias = sp.get('dias') ? Number(sp.get('dias')) : null
  if (!ref && !todos) return NextResponse.json({ error: 'Informe ?ws=<id|slug|nome> ou ?todos=1 (opcional &dias=30)' }, { status: 400 })
  const r = await executar(ref, todos, true, dias)   // dry-run
  return NextResponse.json(serialize({ dryRun: true, ...r }))
}

export async function POST(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const ref = body.ws || ''
  const todos = body.todos === true || body.todos === '1'
  const dias = body.dias != null ? Number(body.dias) : null
  if (!ref && !todos) return NextResponse.json({ error: 'Informe ws ou todos:true (opcional dias:30)' }, { status: 400 })
  const r = await executar(String(ref), todos, false, dias)  // aplica
  return NextResponse.json(serialize({ ok: true, ...r }))
}
