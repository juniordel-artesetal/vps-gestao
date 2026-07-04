// app/api/clientes/route.ts — Módulo Clientes (CRM) Fase 1 — VPS-20260630-NQA8
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

// ── GET — lista paginada + busca + métricas topo ──────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const busca   = searchParams.get('busca')
  const ativoQ  = searchParams.get('ativo') // '1' | '0' | null (todos)
  const pagina  = Math.max(parseInt(searchParams.get('pagina') || '1'), 1)
  const limite  = Math.min(Math.max(parseInt(searchParams.get('limite') || '30'), 1), 100)
  const offset  = (pagina - 1) * limite
  const buscaLike   = busca ? `%${busca}%` : null
  const ativoFilter = ativoQ === '1' ? true : ativoQ === '0' ? false : null

  const clientes = await prisma.$queryRaw`
    SELECT
      c."id", c."nome", c."documento", c."email", c."telefone",
      c."origem", c."tags", c."ativo", c."createdAt", c."updatedAt",
      (SELECT COUNT(*)::int FROM "Order" o
        WHERE o."clienteId" = c."id" AND o."workspaceId" = c."workspaceId") AS "qtdPedidos",
      (SELECT COALESCE(SUM(o."valor"), 0)::float FROM "Order" o
        WHERE o."clienteId" = c."id" AND o."workspaceId" = c."workspaceId") AS "valorTotal"
    FROM "Cliente" c
    WHERE c."workspaceId" = ${workspaceId}
      AND (${ativoFilter}::boolean IS NULL OR c."ativo" = ${ativoFilter})
      AND (${buscaLike}::text IS NULL
        OR c."nome"     ILIKE ${buscaLike}
        OR c."email"    ILIKE ${buscaLike}
        OR c."telefone" ILIKE ${buscaLike}
        OR EXISTS (SELECT 1 FROM "ClienteContato" cc
                   WHERE cc."clienteId" = c."id" AND cc."valor" ILIKE ${buscaLike}))
    ORDER BY c."nome" ASC
    LIMIT ${limite} OFFSET ${offset}
  ` as any[]

  const [contagem] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM "Cliente" c
    WHERE c."workspaceId" = ${workspaceId}
      AND (${ativoFilter}::boolean IS NULL OR c."ativo" = ${ativoFilter})
      AND (${buscaLike}::text IS NULL
        OR c."nome"     ILIKE ${buscaLike}
        OR c."email"    ILIKE ${buscaLike}
        OR c."telefone" ILIKE ${buscaLike}
        OR EXISTS (SELECT 1 FROM "ClienteContato" cc
                   WHERE cc."clienteId" = c."id" AND cc."valor" ILIKE ${buscaLike}))
  ` as any[]

  const [metricas] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "totalClientes",
           COUNT(*) FILTER (WHERE "ativo")::int AS "totalAtivos"
    FROM "Cliente" WHERE "workspaceId" = ${workspaceId}
  ` as any[]

  return NextResponse.json(serialize({
    clientes,
    total: contagem.total,
    pagina,
    limite,
    metricas,
  }))
}

// ── POST — cria cliente com contatos e endereços ──────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const {
    nome, documento, email, telefone, observacoes, tags, origem, ativo,
    contatos, enderecos,
  } = await req.json()

  if (!nome || !String(nome).trim())
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "Cliente"
      ("id","workspaceId","nome","documento","email","telefone","observacoes","tags","origem","ativo","createdAt","updatedAt")
    VALUES
      (${id}, ${workspaceId}, ${String(nome).trim()}, ${documento ?? null}, ${email ?? null},
       ${telefone ?? null}, ${observacoes ?? null}, ${tags ?? null}, ${origem ?? null},
       ${ativo === false ? false : true}, NOW(), NOW())
  `

  await inserirFilhos(id, workspaceId, contatos, enderecos)

  return NextResponse.json(serialize({ id }), { status: 201 })
}

// ── Helper: (re)insere contatos e endereços normalizando "principal" ──
async function inserirFilhos(clienteId: string, workspaceId: string, contatos: any, enderecos: any) {
  if (Array.isArray(contatos)) {
    const validos = contatos.filter((c: any) => c && String(c.valor ?? '').trim())
    const temPrincipal = validos.some((c: any) => c.principal)
    validos.forEach((c: any, i: number) => {
      const principal = temPrincipal ? !!c.principal : i === 0
      // Só o primeiro principal encontrado permanece principal
      c.__principal = principal && (temPrincipal
        ? validos.findIndex((x: any) => x.principal) === i
        : i === 0)
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
