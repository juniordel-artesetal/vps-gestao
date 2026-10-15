// Método MAE — registra uma ARTE GERADA para o pedido (mae_order_arts): tema + versão usada, variáveis,
// status (gerada / revisar) e o NOME do arquivo (o arquivo fica no computador). Gerar de novo cria outro
// registro: o histórico fica no card.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { contaMae, lerJson, recusa } from '@/lib/mae/servidor/acesso'
import { ehPedidoMae } from '@/lib/mae/servidor/plano'
import { statusMaeEmMassa } from '@/lib/mae/servidor/fontes'

const Arte = z.object({
  orderId: z.string().min(1).max(64),
  themeId: z.string().min(1).max(64),
  themeVersion: z.number().int().positive(),
  variaveis: z.record(z.string().max(40), z.string().max(200)).default({}),
  // Lote 18 (item 223): 'impresso' (Marcar como impresso — vai para Já gerados) e 'desmarcado' (volta para Pendentes)
  status: z.enum(['gerada', 'revisar', 'erro', 'impresso', 'desmarcado']),
  arquivo: z.string().max(500).nullable().default(null),
})
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function POST(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let a
  try {
    const r = Arte.safeParse(await lerJson(req, 50_000))
    if (!r.success) return recusa('pedidos/arte', { error: 'Dados da arte inválidos' }, 400)
    a = r.data
  } catch { return recusa('pedidos/arte', { error: 'JSON inválido' }, 400) }
  try {
    // Lote 7 (item 120): pedido do SOA ("Order") ou do MAE avulso (mae_orders, id "mo_…")
    const avulso = ehPedidoMae(a.orderId)
    const [p] = avulso
      ? await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM mae_orders WHERE id = ${a.orderId} AND workspace_id = ${c.workspaceId} LIMIT 1`
      : await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${a.orderId} AND "workspaceId" = ${c.workspaceId} LIMIT 1`
    if (!p) return recusa('pedidos/arte', { error: 'Pedido não encontrado' }, 404)
    const id = gid()
    await prisma.$executeRaw`
      INSERT INTO mae_order_arts (id, workspace_id, order_id, theme_id, theme_version, variaveis, status, arquivo)
      VALUES (${id}, ${c.workspaceId}, ${a.orderId}, ${a.themeId}, ${a.themeVersion}, ${JSON.stringify(a.variaveis)}::jsonb, ${a.status}, ${a.arquivo})`
    // avulso: arte gerada → status "gerado" (impresso não volta); impresso/desmarcado mudam o status do MAE
    if (avulso && a.status !== 'erro') await statusMaeEmMassa(c.workspaceId, [a.orderId], a.status === 'impresso' ? 'impresso' : a.status === 'desmarcado' ? 'pendente' : 'gerado')
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[MAE PEDIDO ARTE POST]', e)
    return NextResponse.json({ error: 'Erro ao registrar a arte' }, { status: 500 })
  }
}
