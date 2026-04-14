import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return parseFloat(String(obj))
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// GET — lista todos os FluxoModelo do workspace com seus setores
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId

  const fluxos = await prisma.$queryRaw`
    SELECT
      fm.id, fm."segmentoId", fm.nome, fm.emoji, fm.ativo, fm."createdAt",
      COALESCE(
        json_agg(
          json_build_object(
            'fmsId',  fms.id,
            'ordem',  fms.ordem,
            'setorId', sc.id,
            'nome',   sc.nome,
            'icone',  sc.icone,
            'cor',    sc.cor
          ) ORDER BY fms.ordem ASC
        ) FILTER (WHERE fms.id IS NOT NULL),
        '[]'
      ) AS setores
    FROM "FluxoModelo" fm
    LEFT JOIN "FluxoModeloSetor" fms ON fms."fluxoModeloId" = fm.id
    LEFT JOIN "SetorConfig"      sc  ON sc.id = fms."setorConfigId"
    WHERE fm."workspaceId" = ${workspaceId}
    GROUP BY fm.id
    ORDER BY fm."createdAt" ASC
  ` as any[]

  return NextResponse.json(serialize(fluxos))
}

// POST — cria novo FluxoModelo com setores
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { nome, emoji, segmentoId, setorIds } = body
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const fluxoId = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "FluxoModelo" ("id", "workspaceId", "segmentoId", "nome", "emoji", "ativo", "createdAt")
    VALUES (${fluxoId}, ${workspaceId}, ${segmentoId ?? nome}, ${nome}, ${emoji ?? '⚙️'}, true, NOW())
  `

  if (Array.isArray(setorIds)) {
    for (let i = 0; i < setorIds.length; i++) {
      const fmsId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "FluxoModeloSetor" ("id", "fluxoModeloId", "setorConfigId", "ordem")
        VALUES (${fmsId}, ${fluxoId}, ${setorIds[i]}, ${i})
      `
    }
  }

  return NextResponse.json({ ok: true, id: fluxoId })
}
