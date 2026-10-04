// Método MAE — registra uma ARTE GERADA para o pedido (mae_order_arts): tema + versão usada, variáveis,
// status (gerada / revisar) e o NOME do arquivo (o arquivo fica no computador). Gerar de novo cria outro
// registro: o histórico fica no card.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'

const Arte = z.object({
  orderId: z.string().min(1).max(64),
  themeId: z.string().min(1).max(64),
  themeVersion: z.number().int().positive(),
  variaveis: z.record(z.string().max(40), z.string().max(200)).default({}),
  status: z.enum(['gerada', 'revisar', 'erro']),
  arquivo: z.string().max(500).nullable().default(null),
})
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function POST(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let a
  try {
    const r = Arte.safeParse(await lerJson(req, 50_000))
    if (!r.success) return NextResponse.json({ error: 'Dados da arte inválidos' }, { status: 400 })
    a = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    const [p] = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${a.orderId} AND "workspaceId" = ${c.workspaceId} LIMIT 1`
    if (!p) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    const id = gid()
    await prisma.$executeRaw`
      INSERT INTO mae_order_arts (id, workspace_id, order_id, theme_id, theme_version, variaveis, status, arquivo)
      VALUES (${id}, ${c.workspaceId}, ${a.orderId}, ${a.themeId}, ${a.themeVersion}, ${JSON.stringify(a.variaveis)}::jsonb, ${a.status}, ${a.arquivo})`
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[MAE PEDIDO ARTE POST]', e)
    return NextResponse.json({ error: 'Erro ao registrar a arte' }, { status: 500 })
  }
}
