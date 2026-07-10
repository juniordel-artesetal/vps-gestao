import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureLojaAtributos } from '@/lib/lojaAtributos'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

async function produtoValido(produtoId: string, workspaceId: string) {
  const r = await prisma.$queryRaw`SELECT 1 FROM "PrecProduto" WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId} LIMIT 1` as any[]
  return r.length > 0
}

// Carrega a config de atributos de UM produto: atributos+opções, variações com seu
// mapeamento atual e indicadores (variações sem mapeamento completo, combinações duplicadas).
export async function carregarConfigAtributos(workspaceId: string, produtoId: string) {
  const atributos = await prisma.$queryRaw`
    SELECT "id","nome",COALESCE("ordem",0)::int AS "ordem"
    FROM "LojaAtributo" WHERE "produtoId" = ${produtoId} AND "workspaceId" = ${workspaceId}
    ORDER BY "ordem" ASC, "createdAt" ASC
  ` as any[]
  const atrIds = atributos.map(a => a.id)
  const opcoes = atrIds.length ? await prisma.$queryRaw`
    SELECT "id","atributoId","valor",COALESCE("ordem",0)::int AS "ordem"
    FROM "LojaAtributoOpcao" WHERE "atributoId" = ANY(${atrIds}::text[])
    ORDER BY "ordem" ASC, "valor" ASC
  ` as any[] : []
  const opcoesPorAtr: Record<string, any[]> = {}
  for (const o of opcoes) (opcoesPorAtr[o.atributoId] ||= []).push({ id: o.id, valor: o.valor, ordem: Number(o.ordem) })

  const variacoes = await prisma.$queryRaw`
    SELECT v."id",
           COALESCE(NULLIF(v."nome",''),
                    NULLIF(TRIM(CONCAT_WS(' · ', NULLIF(v."tipo",'Padrão'), NULLIF(v."subOpcao",'Padrão'))), ''),
                    'Padrão') AS "label",
           COALESCE(v."visivelLoja", false) AS "visivelLoja",
           (COALESCE(v."precoVenda",0) > 0) AS "temPreco"
    FROM "PrecVariacao" v WHERE v."produtoId" = ${produtoId}
    ORDER BY v."tipo" ASC
  ` as any[]
  const varIds = variacoes.map(v => v.id)
  const mapeamentos = (varIds.length && atrIds.length) ? await prisma.$queryRaw`
    SELECT "variacaoId","atributoId","opcaoId"
    FROM "LojaVariacaoOpcao" WHERE "variacaoId" = ANY(${varIds}::text[]) AND "workspaceId" = ${workspaceId}
  ` as any[] : []
  const mapaPorVar: Record<string, Record<string, string>> = {}
  for (const m of mapeamentos) (mapaPorVar[m.variacaoId] ||= {})[m.atributoId] = m.opcaoId

  const variacoesOut = variacoes.map(v => ({ ...v, mapa: mapaPorVar[v.id] || {} }))

  // Indicadores
  const nAtrib = atributos.length
  const semMapeamento = nAtrib === 0 ? 0 : variacoesOut.filter(v => Object.keys(v.mapa).length < nAtrib).length
  const combos = new Map<string, number>()
  for (const v of variacoesOut) {
    if (nAtrib > 0 && Object.keys(v.mapa).length === nAtrib) {
      const chave = atrIds.map(a => v.mapa[a]).join('|')
      combos.set(chave, (combos.get(chave) || 0) + 1)
    }
  }
  const combosDuplicados = Array.from(combos.values()).filter(n => n > 1).length

  return {
    atributos: atributos.map(a => ({ id: a.id, nome: a.nome, ordem: Number(a.ordem), opcoes: opcoesPorAtr[a.id] || [] })),
    variacoes: variacoesOut,
    indicadores: { semMapeamento, combosDuplicados },
  }
}

// GET ?produtoId=... — config completa de atributos do produto
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureLojaAtributos()
    const workspaceId = session.user.workspaceId
    const produtoId = new URL(req.url).searchParams.get('produtoId') || ''
    if (!produtoId || !(await produtoValido(produtoId, workspaceId)))
      return NextResponse.json({ atributos: [], variacoes: [], indicadores: { semMapeamento: 0, combosDuplicados: 0 } })
    return NextResponse.json(serialize(await carregarConfigAtributos(workspaceId, produtoId)))
  } catch (e) {
    console.error('[config/loja/atributos GET]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — cria atributo { produtoId, nome }  OU  opção { atributoId, valor }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    await ensureLojaAtributos()
    const workspaceId = session.user.workspaceId
    const body = await req.json()

    // ── Nova OPÇÃO ──
    if (body?.atributoId) {
      const valor = String(body.valor || '').trim().slice(0, 80)
      if (!valor) return NextResponse.json({ error: 'Informe o valor da opção.' }, { status: 400 })
      const [atr] = await prisma.$queryRaw`
        SELECT a."id" FROM "LojaAtributo" a JOIN "PrecProduto" p ON p."id" = a."produtoId"
        WHERE a."id" = ${body.atributoId} AND p."workspaceId" = ${workspaceId} LIMIT 1` as any[]
      if (!atr) return NextResponse.json({ error: 'Atributo não encontrado' }, { status: 404 })
      const [dup] = await prisma.$queryRaw`SELECT 1 FROM "LojaAtributoOpcao" WHERE "atributoId" = ${body.atributoId} AND LOWER("valor") = LOWER(${valor}) LIMIT 1` as any[]
      if (dup) return NextResponse.json({ error: 'Essa opção já existe.' }, { status: 409 })
      const [mx] = await prisma.$queryRaw`SELECT COALESCE(MAX("ordem"),-1)::int AS m FROM "LojaAtributoOpcao" WHERE "atributoId" = ${body.atributoId}` as any[]
      const id = gerarId()
      await prisma.$executeRaw`INSERT INTO "LojaAtributoOpcao" ("id","workspaceId","atributoId","valor","ordem") VALUES (${id}, ${workspaceId}, ${body.atributoId}, ${valor}, ${Number(mx.m) + 1})`
      return NextResponse.json({ id, tipo: 'opcao' })
    }

    // ── Novo ATRIBUTO ──
    const produtoId = String(body?.produtoId || '')
    const nome = String(body?.nome || '').trim().slice(0, 60)
    if (!nome) return NextResponse.json({ error: 'Informe o nome do atributo.' }, { status: 400 })
    if (!(await produtoValido(produtoId, workspaceId))) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    // Máximo 2 níveis nesta fase
    const [cnt] = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "LojaAtributo" WHERE "produtoId" = ${produtoId}` as any[]
    if (Number(cnt.n) >= 2) return NextResponse.json({ error: 'Máximo de 2 atributos por produto nesta fase.' }, { status: 400 })
    const [dup] = await prisma.$queryRaw`SELECT 1 FROM "LojaAtributo" WHERE "produtoId" = ${produtoId} AND LOWER("nome") = LOWER(${nome}) LIMIT 1` as any[]
    if (dup) return NextResponse.json({ error: 'Já existe um atributo com esse nome.' }, { status: 409 })
    const id = gerarId()
    await prisma.$executeRaw`INSERT INTO "LojaAtributo" ("id","workspaceId","produtoId","nome","ordem") VALUES (${id}, ${workspaceId}, ${produtoId}, ${nome}, ${Number(cnt.n)})`
    return NextResponse.json({ id, tipo: 'atributo' })
  } catch (e) {
    console.error('[config/loja/atributos POST]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
