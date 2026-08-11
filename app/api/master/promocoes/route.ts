// Master — publicação de Ofertas & Cupons (DistribuidorPromocao). Guarda master via cookie.
// Prisma raw; nunca SELECT *; imagem (logo) só sob demanda, fora da listagem.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensurePromocoesSchema } from '@/lib/promocoesSchema'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}
function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Encontra (ou cria) um Parceiro distribuidor leve pelo nome — a vitrine faz JOIN por parceiroId.
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

export async function GET() {
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensurePromocoesSchema()
  const rows = await prisma.$queryRaw`
    SELECT dp."id", dp."parceiroId", p."nome" AS "parceiroNome", dp."titulo", dp."descricao",
           dp."desconto", dp."cupom", dp."linkCompra", dp."prioridade", dp."ativo",
           ("dp"."imagem" IS NOT NULL) AS "temImagem",
           TO_CHAR(dp."dataInicio",'YYYY-MM-DD') AS "dataInicio",
           TO_CHAR(dp."dataFim",'YYYY-MM-DD')    AS "dataFim",
           dp."impressoes", dp."cliques", dp."createdAt"
    FROM "DistribuidorPromocao" dp
    JOIN "Parceiro" p ON p."id" = dp."parceiroId"
    ORDER BY dp."ativo" DESC, dp."prioridade" DESC, dp."createdAt" DESC
    LIMIT 300
  ` as any[]
  return NextResponse.json(serialize({ promocoes: rows }))
}

export async function POST(req: Request) {
  if (!(await verificarMaster())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensurePromocoesSchema()
  const b = await req.json().catch(() => ({}))

  const parceiroNome = String(b.parceiroNome || '').trim()
  const titulo = String(b.titulo || '').trim()
  if (!parceiroNome) return NextResponse.json({ error: 'Informe o parceiro' }, { status: 400 })
  if (!titulo)       return NextResponse.json({ error: 'Informe o título' }, { status: 400 })

  const parceiroId = await parceiroPorNome(parceiroNome)
  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "DistribuidorPromocao"
      ("id","parceiroId","titulo","descricao","desconto","cupom","linkCompra","imagem","prioridade","dataInicio","dataFim","ativo")
    VALUES
      (${id}, ${parceiroId}, ${titulo}, ${b.descricao || null}, ${b.desconto || null}, ${b.cupom || null},
       ${b.linkCompra || null}, ${b.imagem || null}, ${Number.isFinite(+b.prioridade) ? +b.prioridade : 0},
       ${b.dataInicio || null}::date, ${b.dataFim || null}::date, ${b.ativo !== false})
  `
  return NextResponse.json({ ok: true, id })
}
