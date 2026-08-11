// Master — editar/remover uma oferta (DistribuidorPromocao).
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ensurePromocoesSchema } from '@/lib/promocoesSchema'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}
function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

async function parceiroPorNome(nome: string): Promise<string> {
  const n = nome.trim()
  const [ex] = await prisma.$queryRaw`
    SELECT "id" FROM "Parceiro" WHERE "tipo" = 'distribuidor' AND lower("nome") = lower(${n}) LIMIT 1
  ` as { id: string }[]
  if (ex) return ex.id
  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "Parceiro" ("id","tipo","nome","ativo","status") VALUES (${id}, 'distribuidor', ${n}, true, 'aprovada')
  `
  return id
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensurePromocoesSchema()
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  const [ex] = await prisma.$queryRaw`SELECT "id" FROM "DistribuidorPromocao" WHERE "id" = ${id} LIMIT 1` as { id: string }[]
  if (!ex) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  if (b.parceiroNome !== undefined && String(b.parceiroNome).trim()) {
    const parceiroId = await parceiroPorNome(String(b.parceiroNome))
    await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "parceiroId" = ${parceiroId} WHERE "id" = ${id}`
  }
  if (b.titulo     !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "titulo"     = ${String(b.titulo).trim()} WHERE "id" = ${id}`
  if (b.descricao  !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "descricao"  = ${b.descricao || null}    WHERE "id" = ${id}`
  if (b.desconto   !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "desconto"   = ${b.desconto || null}     WHERE "id" = ${id}`
  if (b.cupom      !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "cupom"      = ${b.cupom || null}        WHERE "id" = ${id}`
  if (b.linkCompra !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "linkCompra" = ${b.linkCompra || null}   WHERE "id" = ${id}`
  if (b.prioridade !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "prioridade" = ${Number.isFinite(+b.prioridade) ? +b.prioridade : 0} WHERE "id" = ${id}`
  if (b.ativo      !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "ativo"      = ${!!b.ativo}              WHERE "id" = ${id}`
  if (b.dataInicio !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "dataInicio" = ${b.dataInicio || null}::date WHERE "id" = ${id}`
  if (b.dataFim    !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "dataFim"    = ${b.dataFim || null}::date    WHERE "id" = ${id}`
  // imagem: só toca se enviada (nova data URL) ou removida explicitamente
  if (b.imagem     !== undefined) await prisma.$executeRaw`UPDATE "DistribuidorPromocao" SET "imagem"     = ${b.imagem || null}        WHERE "id" = ${id}`

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "DistribuidorPromocao" WHERE "id" = ${id}`
  return NextResponse.json({ ok: true })
}
