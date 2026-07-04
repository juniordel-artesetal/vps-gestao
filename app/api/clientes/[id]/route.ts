// app/api/clientes/[id]/route.ts — Ficha do cliente + histórico derivado — VPS-20260630-NQA8
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

function novoId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function inserirFilhos(clienteId: string, workspaceId: string, contatos: any, enderecos: any) {
  if (Array.isArray(contatos)) {
    const validos = contatos.filter((c: any) => c && String(c.valor ?? '').trim())
    const temPrincipal = validos.some((c: any) => c.principal)
    validos.forEach((c: any, i: number) => {
      c.__principal = temPrincipal
        ? (!!c.principal && validos.findIndex((x: any) => x.principal) === i)
        : i === 0
    })
    for (const c of validos) {
      await prisma.$executeRaw`
        INSERT INTO "ClienteContato" ("id","clienteId","workspaceId","tipo","valor","label","principal")
        VALUES (${novoId()}, ${clienteId}, ${workspaceId}, ${c.tipo || 'telefone'},
                ${String(c.valor).trim()}, ${c.label ?? null}, ${!!c.__principal})
      `
    }
  }
  if (Array.isArray(enderecos)) {
    const validos = enderecos.filter((e: any) => e && (
      String(e.logradouro ?? '').trim() || String(e.cep ?? '').trim() ||
      String(e.cidade ?? '').trim() || String(e.apelido ?? '').trim()))
    const temPrincipal = validos.some((e: any) => e.principal)
    validos.forEach((e: any, i: number) => {
      e.__principal = temPrincipal
        ? (!!e.principal && validos.findIndex((x: any) => x.principal) === i)
        : i === 0
    })
    for (const e of validos) {
      await prisma.$executeRaw`
        INSERT INTO "ClienteEndereco"
          ("id","clienteId","workspaceId","apelido","cep","logradouro","numero","complemento","bairro","cidade","estado","principal")
        VALUES (${novoId()}, ${clienteId}, ${workspaceId}, ${e.apelido ?? null}, ${e.cep ?? null},
                ${e.logradouro ?? null}, ${e.numero ?? null}, ${e.complemento ?? null},
                ${e.bairro ?? null}, ${e.cidade ?? null}, ${e.estado ?? null}, ${!!e.__principal})
      `
    }
  }
}

// ── GET — ficha completa: dados + contatos + endereços + histórico + resumo ──
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId

  const [cliente] = await prisma.$queryRaw`
    SELECT "id","workspaceId","nome","documento","email","telefone","observacoes","tags","origem","ativo",
           TO_CHAR("ultimoPedidoData", 'YYYY-MM-DD') AS "ultimoPedidoData",
           "ultimoPedidoStatus","totalPedidos","pedidosFinalizados","pedidosEmAberto",
           "createdAt","updatedAt"
    FROM "Cliente" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const contatos = await prisma.$queryRaw`
    SELECT "id","tipo","valor","label","principal"
    FROM "ClienteContato" WHERE "clienteId" = ${id} AND "workspaceId" = ${workspaceId}
    ORDER BY "principal" DESC
  ` as any[]

  const enderecos = await prisma.$queryRaw`
    SELECT "id","apelido","cep","logradouro","numero","complemento","bairro","cidade","estado","principal"
    FROM "ClienteEndereco" WHERE "clienteId" = ${id} AND "workspaceId" = ${workspaceId}
    ORDER BY "principal" DESC
  ` as any[]

  // ── Histórico de compras (derivado de Order — LEITURA; nunca SELECT *) ──
  const historico = await prisma.$queryRaw`
    SELECT o."id", o."numero", o."produto", o."canal", o."status",
           o."valor"::float AS "valor",
           TO_CHAR(o."dataEntrada", 'YYYY-MM-DD') AS "dataEntrada",
           TO_CHAR(o."dataEnvio", 'YYYY-MM-DD')   AS "dataEnvio",
           o."createdAt"
    FROM "Order" o
    WHERE o."clienteId" = ${id} AND o."workspaceId" = ${workspaceId}
    ORDER BY o."createdAt" DESC
  ` as any[]

  const [resumoRaw] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "totalPedidos",
           COALESCE(SUM(o."valor"), 0)::float AS "valorTotal",
           MIN(o."createdAt") AS "primeiroPedido",
           MAX(o."createdAt") AS "ultimoPedido"
    FROM "Order" o
    WHERE o."clienteId" = ${id} AND o."workspaceId" = ${workspaceId}
  ` as any[]

  const totalPedidos = Number(resumoRaw?.totalPedidos || 0)
  const valorTotal   = Number(resumoRaw?.valorTotal || 0)
  const resumo = {
    totalPedidos,
    valorTotal,
    ticketMedio: totalPedidos > 0 ? valorTotal / totalPedidos : 0,
    primeiroPedido: resumoRaw?.primeiroPedido ?? null,
    ultimoPedido: resumoRaw?.ultimoPedido ?? null,
  }

  return NextResponse.json(serialize({ cliente, contatos, enderecos, historico, resumo }))
}

// ── PUT — atualiza cliente + regrava contatos/endereços ──────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const {
    nome, documento, email, telefone, observacoes, tags, origem, ativo,
    contatos, enderecos,
  } = await req.json()

  const [existe] = await prisma.$queryRaw`
    SELECT "id" FROM "Cliente" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (!existe) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  if (nome !== undefined && !String(nome).trim())
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE "Cliente" SET
      "nome"        = COALESCE(${nome ?? null}, "nome"),
      "documento"   = ${documento ?? null},
      "email"       = ${email ?? null},
      "telefone"    = ${telefone ?? null},
      "observacoes" = ${observacoes ?? null},
      "tags"        = ${tags ?? null},
      "origem"      = ${origem ?? null},
      "ativo"       = ${ativo === false ? false : true},
      "updatedAt"   = NOW()
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
  `

  // Regrava filhos (substitui) — só quando enviados no payload
  if (contatos !== undefined) {
    await prisma.$executeRaw`DELETE FROM "ClienteContato" WHERE "clienteId" = ${id} AND "workspaceId" = ${workspaceId}`
  }
  if (enderecos !== undefined) {
    await prisma.$executeRaw`DELETE FROM "ClienteEndereco" WHERE "clienteId" = ${id} AND "workspaceId" = ${workspaceId}`
  }
  await inserirFilhos(id, workspaceId, contatos, enderecos)

  return NextResponse.json({ ok: true })
}

// ── DELETE — soft (ativo=false) por padrão; ?hard=1 exclui permanentemente ─
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const workspaceId = session.user.workspaceId
  const hard = new URL(req.url).searchParams.get('hard') === '1'

  if (hard) {
    // Desvincula pedidos (não apaga pedidos) e remove filhos antes do cliente
    await prisma.$executeRaw`UPDATE "Order" SET "clienteId" = NULL WHERE "clienteId" = ${id} AND "workspaceId" = ${workspaceId}`
    await prisma.$executeRaw`DELETE FROM "ClienteContato"  WHERE "clienteId" = ${id} AND "workspaceId" = ${workspaceId}`
    await prisma.$executeRaw`DELETE FROM "ClienteEndereco" WHERE "clienteId" = ${id} AND "workspaceId" = ${workspaceId}`
    const res = await prisma.$executeRaw`DELETE FROM "Cliente" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (!res) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, excluido: true })
  }

  const res = await prisma.$executeRaw`
    UPDATE "Cliente" SET "ativo" = false, "updatedAt" = NOW()
    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
  `
  if (!res) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
