import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureComboLoja } from '@/lib/precComboLoja'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return parseFloat(String(obj))
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const workspaceId = session.user.workspaceId

  const rows = await prisma.$queryRaw`
    SELECT c.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ci.id,
            'variacaoId', ci."variacaoId",
            'nomeProduto', ci."nomeProduto",
            'qtd', ci.qtd,
            'custoUnit', ci."custoUnit"
          ) ORDER BY ci."nomeProduto"
        ) FILTER (WHERE ci.id IS NOT NULL),
        '[]'
      ) AS itens
    FROM "PrecCombo" c
    LEFT JOIN "PrecComboItem" ci ON ci."comboId" = c.id
    WHERE c.id = ${id} AND c."workspaceId" = ${workspaceId}
    GROUP BY c.id
  ` as any[]

  if (!rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(serialize(rows[0]))
}

// PATCH — publica/despublica o combo na Loja (+ coleção/ordem/destaque). Leve, não mexe nos itens.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id } = await params
  const workspaceId = session.user.workspaceId
  const b = await req.json().catch(() => ({}))
  await ensureComboLoja()
  await prisma.$executeRaw`
    UPDATE "PrecCombo" SET
      "visivelLoja"   = COALESCE(${b.visivelLoja == null ? null : !!b.visivelLoja}::boolean, "visivelLoja"),
      "lojaColecaoId" = COALESCE(${b.lojaColecaoId === undefined ? null : (b.lojaColecaoId || null)}, "lojaColecaoId"),
      "lojaOrdem"     = COALESCE(${b.lojaOrdem == null ? null : Math.round(Number(b.lojaOrdem) || 0)}::int, "lojaOrdem"),
      "lojaDestaque"  = COALESCE(${b.lojaDestaque == null ? null : !!b.lojaDestaque}::boolean, "lojaDestaque")
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
  `
  // Imagem própria do combo (aditiva): só toca se enviada (data URL) ou removida.
  if (b.imagem !== undefined || b.removerImagem) {
    const nova = b.removerImagem ? null : (typeof b.imagem === 'string' && b.imagem.startsWith('data:') ? b.imagem : null)
    await prisma.$executeRaw`UPDATE "PrecCombo" SET "imagem" = ${nova} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
  }
  const [row] = await prisma.$queryRaw`
    SELECT "id","visivelLoja","lojaColecaoId","lojaOrdem","lojaDestaque"
    FROM "PrecCombo" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { id: string; visivelLoja: boolean }[]
  return NextResponse.json(serialize({ ok: true, combo: row }))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const {
    nome, descricao, canal, subOpcao,
    precoNormal, descontoPct, precoCombo,
    ativo, itens,
  } = body

  // Verificar se o combo pertence ao workspace
  const exists = await prisma.$queryRaw`
    SELECT id FROM "PrecCombo" WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  ` as any[]
  if (!exists.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Atualiza o combo
  await prisma.$executeRaw`
    UPDATE "PrecCombo" SET
      nome        = ${nome ?? null},
      descricao   = ${descricao ?? null},
      canal       = ${canal ?? null},
      "subOpcao"  = ${subOpcao ?? null},
      "precoNormal"  = ${precoNormal != null ? parseFloat(String(precoNormal)) : null},
      "descontoPct"  = ${descontoPct != null ? parseFloat(String(descontoPct)) : null},
      "precoCombo"   = ${precoCombo != null ? parseFloat(String(precoCombo)) : null},
      ativo       = ${ativo !== false}
    WHERE id = ${id} AND "workspaceId" = ${workspaceId}
  `

  // Recria os itens (delete + insert)
  if (Array.isArray(itens)) {
    await prisma.$executeRaw`DELETE FROM "PrecComboItem" WHERE "comboId" = ${id}`

    for (const item of itens) {
      const itemId = Math.random().toString(36).slice(2) + Date.now().toString(36)
      await prisma.$executeRaw`
        INSERT INTO "PrecComboItem" (id, "comboId", "variacaoId", "nomeProduto", qtd, "custoUnit")
        VALUES (
          ${itemId},
          ${id},
          ${item.variacaoId ?? null},
          ${item.nomeProduto ?? ''},
          ${parseInt(String(item.qtd)) || 1},
          ${item.custoUnit != null ? parseFloat(String(item.custoUnit)) : 0}
        )
      `
    }
  }

  // Retorna o combo atualizado com itens
  const updated = await prisma.$queryRaw`
    SELECT c.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ci.id,
            'variacaoId', ci."variacaoId",
            'nomeProduto', ci."nomeProduto",
            'qtd', ci.qtd,
            'custoUnit', ci."custoUnit"
          ) ORDER BY ci."nomeProduto"
        ) FILTER (WHERE ci.id IS NOT NULL),
        '[]'
      ) AS itens
    FROM "PrecCombo" c
    LEFT JOIN "PrecComboItem" ci ON ci."comboId" = c.id
    WHERE c.id = ${id}
    GROUP BY c.id
  ` as any[]

  return NextResponse.json(serialize(updated[0]))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  await prisma.$executeRaw`DELETE FROM "PrecComboItem" WHERE "comboId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "PrecCombo" WHERE id = ${id} AND "workspaceId" = ${workspaceId}`

  return NextResponse.json({ ok: true })
}
