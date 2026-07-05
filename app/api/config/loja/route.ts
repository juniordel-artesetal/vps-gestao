import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

function novoId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Normaliza slug: minúsculo, sem acento, só a-z 0-9 e hífen
function slugify(s: string): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

const FRETE_TIPOS = ['gratis', 'fixo', 'retirada']
const FONTES = ['precificacao', 'estoque', 'ambos']

// GET — config da loja do workspace (com fallback de branding do Workspace)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  const [ws] = await prisma.$queryRaw`
    SELECT "nome", "logo", "corPrimaria", "whatsapp"
    FROM "Workspace" WHERE "id" = ${workspaceId}
  ` as any[]

  const [cfg] = await prisma.$queryRaw`
    SELECT "id","workspaceId","slug","ativo","logo","corPrimaria","descricao",
           "whatsapp","freteTipo","freteValor"::float AS "freteValor","fonteCatalogo",
           "createdAt","updatedAt"
    FROM "LojaConfig" WHERE "workspaceId" = ${workspaceId}
  ` as any[]

  return NextResponse.json(serialize({
    config: cfg || null,
    // sugestões/fallback de branding vindos do Workspace
    branding: {
      nome: ws?.nome || '',
      logo: ws?.logo || null,
      corPrimaria: ws?.corPrimaria || null,
      whatsapp: ws?.whatsapp || null,
      slugSugerido: slugify(ws?.nome || ''),
    },
  }))
}

// PUT — cria/atualiza a config da loja (upsert por workspaceId)
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const body = await req.json()

  const slug = slugify(body.slug || '')
  if (!slug || slug.length < 3)
    return NextResponse.json({ error: 'Link (slug) inválido — use ao menos 3 letras/números.' }, { status: 400 })

  const freteTipo = FRETE_TIPOS.includes(body.freteTipo) ? body.freteTipo : 'retirada'
  const fonteCatalogo = FONTES.includes(body.fonteCatalogo) ? body.fonteCatalogo : 'precificacao'
  const freteValor = Number(body.freteValor) > 0 ? Number(body.freteValor) : 0
  const ativo = Boolean(body.ativo)
  const logo = body.logo ? String(body.logo) : null
  const corPrimaria = body.corPrimaria ? String(body.corPrimaria) : null
  const descricao = body.descricao ? String(body.descricao) : null
  const whatsapp = body.whatsapp ? String(body.whatsapp) : null

  // Unicidade do slug entre workspaces (exceto o próprio)
  const dono = await prisma.$queryRaw`
    SELECT "workspaceId" FROM "LojaConfig" WHERE "slug" = ${slug} LIMIT 1
  ` as { workspaceId: string }[]
  if (dono.length > 0 && dono[0].workspaceId !== workspaceId)
    return NextResponse.json({ error: 'Esse link já está em uso. Escolha outro.' }, { status: 409 })

  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "LojaConfig"
      ("id","workspaceId","slug","ativo","logo","corPrimaria","descricao","whatsapp",
       "freteTipo","freteValor","fonteCatalogo","createdAt","updatedAt")
    VALUES
      (${id}, ${workspaceId}, ${slug}, ${ativo}, ${logo}, ${corPrimaria}, ${descricao}, ${whatsapp},
       ${freteTipo}, ${freteValor}, ${fonteCatalogo}, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "slug" = ${slug}, "ativo" = ${ativo}, "logo" = ${logo}, "corPrimaria" = ${corPrimaria},
      "descricao" = ${descricao}, "whatsapp" = ${whatsapp}, "freteTipo" = ${freteTipo},
      "freteValor" = ${freteValor}, "fonteCatalogo" = ${fonteCatalogo}, "updatedAt" = NOW()
  `

  // Marca o módulo como disponível para este workspace (aparece no menu)
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "moduloLoja" = true WHERE "id" = ${workspaceId}
  `

  return NextResponse.json({ ok: true, slug })
}
