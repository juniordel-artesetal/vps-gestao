// app/api/master/stars/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { pontuarStars } from '@/lib/stars'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, serialize(v)]))
  return obj
}

async function verificarMaster(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const secao = searchParams.get('secao') ?? 'dashboard'

  // ── Dashboard ──────────────────────────────────────────────────────────
  if (secao === 'dashboard') {
    const [totais, porNivel, distribuidos, top5] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS total_participantes,
          COALESCE(SUM(s."pontosAno"),0)::int AS total_pontos_ano,
          COALESCE(SUM(s."pontosTrimestre"),0)::int AS total_pontos_trimestre
        FROM "VpsStars" s
        JOIN "Workspace" w ON w.id = s."workspaceId"
        WHERE w.ativo = true
      ` as Promise<any[]>,
      prisma.$queryRaw`
        SELECT nivel, COUNT(*)::int AS total
        FROM "VpsStars"
        GROUP BY nivel ORDER BY MIN("pontosAno") DESC
      ` as Promise<any[]>,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(pontos),0)::int AS total
        FROM "VpsStarsLog"
        WHERE "createdAt" >= DATE_TRUNC('month', NOW())
          AND pontos > 0
      ` as Promise<any[]>,
      prisma.$queryRaw`
        SELECT s."workspaceId", w.nome, s."pontosAno", s.nivel
        FROM "VpsStars" s
        JOIN "Workspace" w ON w.id = s."workspaceId"
        ORDER BY s."pontosAno" DESC LIMIT 5
      ` as Promise<any[]>,
    ])
    return NextResponse.json(serialize({ totais: totais[0], porNivel, distribuidos: distribuidos[0], top5 }))
  }

  // ── Ranking ────────────────────────────────────────────────────────────
  if (secao === 'ranking') {
    const tipo = searchParams.get('tipo') ?? 'anual' // anual | trimestral

    if (tipo === 'trimestral') {
      const ranking = await prisma.$queryRaw`
        SELECT
          s."workspaceId", w.nome,
          s."pontosAno", s."pontosTrimestre", s.nivel,
          (ROW_NUMBER() OVER (ORDER BY s."pontosTrimestre" DESC))::int AS posicao
        FROM "VpsStars" s
        JOIN "Workspace" w ON w.id = s."workspaceId"
        WHERE w.ativo = true
          AND s."pontosTrimestre" >= 10000
        ORDER BY s."pontosTrimestre" DESC
        LIMIT 50
      ` as any[]
      return NextResponse.json(serialize(ranking))
    }

    const ranking = await prisma.$queryRaw`
      SELECT
        s."workspaceId", w.nome,
        s."pontosAno", s."pontosTrimestre", s.nivel,
        (ROW_NUMBER() OVER (ORDER BY s."pontosAno" DESC))::int AS posicao
      FROM "VpsStars" s
      JOIN "Workspace" w ON w.id = s."workspaceId"
      WHERE w.ativo = true
      ORDER BY s."pontosAno" DESC
      LIMIT 50
    ` as any[]
    return NextResponse.json(serialize(ranking))
  }

  // ── Validações pendentes ───────────────────────────────────────────────
  if (secao === 'validacoes') {
    const [depoimentos, indicacoes] = await Promise.all([
      prisma.$queryRaw`
        SELECT d.*, w.nome AS "workspaceNome"
        FROM "VpsDepoimento" d
        JOIN "Workspace" w ON w.id = d."workspaceId"
        WHERE d.status = 'PENDENTE'
        ORDER BY d."createdAt" ASC
      ` as Promise<any[]>,
      prisma.$queryRaw`
        SELECT i.*, w.nome AS "workspaceNome"
        FROM "VpsIndicacao" i
        JOIN "Workspace" w ON w.id = i."workspaceId"
        WHERE i.status = 'PENDENTE'
        ORDER BY i."createdAt" ASC
      ` as Promise<any[]>,
    ])
    return NextResponse.json(serialize({ depoimentos, indicacoes }))
  }

  // ── Resgates ───────────────────────────────────────────────────────────
  if (secao === 'resgates') {
    const status = searchParams.get('status') ?? 'PENDENTE'
    const resgates = await prisma.$queryRaw`
      SELECT r.*, w.nome AS "workspaceNome", p.nome AS "premioNome", p.tipo AS "premioTipo"
      FROM "VpsStarsResgate" r
      JOIN "Workspace" w ON w.id = r."workspaceId"
      JOIN "VpsStarsPremio" p ON p.id = r."premioId"
      WHERE r.status = ${status}
      ORDER BY r."createdAt" DESC
    ` as any[]
    return NextResponse.json(serialize(resgates))
  }

  // ── Catálogo de prêmios ────────────────────────────────────────────────
  if (secao === 'premios') {
    const premios = await prisma.$queryRaw`
      SELECT * FROM "VpsStarsPremio" ORDER BY "pontosNecessarios" ASC
    ` as any[]
    return NextResponse.json(serialize(premios))
  }

  // ── Histórico enriquecido com filtros ──────────────────────────────────
  if (secao === 'historico') {
    const workspaceId = searchParams.get('workspaceId')
    const motivo      = searchParams.get('motivo') || ''
    const segmento    = searchParams.get('segmento') || ''
    const dataIni     = searchParams.get('dataIni') || ''
    const dataFim     = searchParams.get('dataFim') || ''
    const nomeBusca   = searchParams.get('nome') || ''
    const fatMin      = searchParams.get('fatMin') ? Number(searchParams.get('fatMin')) : null
    const fatMax      = searchParams.get('fatMax') ? Number(searchParams.get('fatMax')) : null
    const limite      = Math.min(parseInt(searchParams.get('limite') || '200'), 500)

    const logs = await prisma.$queryRaw`
      WITH base AS (
        SELECT
          l.id, l.motivo, l.pontos, l.descricao, l."createdAt",
          l."workspaceId", l.metadata,
          w.nome AS "workspaceNome",
          w.segmento,
          w."nomeProprietaria",
          (
            SELECT COALESCE(SUM(valor),0)::float
            FROM "FinLancamento"
            WHERE "workspaceId" = l."workspaceId"
              AND tipo = 'RECEITA'
              AND status = 'PAGO'
              AND data >= DATE_TRUNC('month', CURRENT_DATE)
          ) AS "faturamentoMes"
        FROM "VpsStarsLog" l
        JOIN "Workspace" w ON w.id = l."workspaceId"
        WHERE w.ativo = true
          AND (${workspaceId}::text IS NULL OR l."workspaceId" = ${workspaceId})
          AND (${motivo}::text   = '' OR l.motivo = ${motivo})
          AND (${segmento}::text = '' OR w.segmento = ${segmento})
          AND (${nomeBusca}::text = '' OR w.nome ILIKE ${'%' + nomeBusca + '%'})
          AND (${dataIni}::text = '' OR l."createdAt"::date >= ${dataIni}::date)
          AND (${dataFim}::text = '' OR l."createdAt"::date <= ${dataFim}::date)
      )
      SELECT * FROM base
      WHERE
        (${fatMin}::float IS NULL OR "faturamentoMes" >= ${fatMin}::float)
        AND (${fatMax}::float IS NULL OR "faturamentoMes" <= ${fatMax}::float)
      ORDER BY "createdAt" DESC
      LIMIT ${limite}
    ` as any[]

    // Listar segmentos disponíveis para o filtro
    const segmentos = await prisma.$queryRaw`
      SELECT DISTINCT segmento FROM "Workspace"
      WHERE segmento IS NOT NULL AND segmento != '' AND ativo = true
      ORDER BY segmento
    ` as any[]

    // Motivos disponíveis
    const motivos = await prisma.$queryRaw`
      SELECT DISTINCT motivo FROM "VpsStarsLog" ORDER BY motivo
    ` as any[]

    return NextResponse.json(serialize({ logs, segmentos, motivos }))
  }

  return NextResponse.json({ error: 'Seção inválida' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const acao = searchParams.get('acao')

  // ── Aprovar/rejeitar depoimento ────────────────────────────────────────
  if (acao === 'validar-depoimento') {
    const { id, aprovado } = await req.json()
    const status = aprovado ? 'APROVADO' : 'REJEITADO'
    await prisma.$executeRaw`UPDATE "VpsDepoimento" SET status = ${status} WHERE id = ${id}`

    if (aprovado) {
      const dep = await prisma.$queryRaw`
        SELECT * FROM "VpsDepoimento" WHERE id = ${id} LIMIT 1
      ` as any[]
      if (dep.length && !dep[0].pontosCreditados) {
        const pontos = dep[0].tipo === 'VIDEO' ? 500 : 100
        await pontuarStars({
          workspaceId: dep[0].workspaceId,
          motivo: dep[0].tipo === 'VIDEO' ? 'DEPOIMENTO_VIDEO' : 'DEPOIMENTO_TEXTO',
          pontos,
          descricao: `Depoimento ${dep[0].tipo.toLowerCase()} aprovado`,
        })
        await prisma.$executeRaw`
          UPDATE "VpsDepoimento" SET "pontosCreditados" = true WHERE id = ${id}
        `
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Converter indicação ────────────────────────────────────────────────
  if (acao === 'converter-indicacao') {
    const { id } = await req.json()
    const ind = await prisma.$queryRaw`
      SELECT * FROM "VpsIndicacao" WHERE id = ${id} LIMIT 1
    ` as any[]
    if (!ind.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.$executeRaw`
      UPDATE "VpsIndicacao" SET status = 'CONVERTIDA' WHERE id = ${id}
    `
    if (!ind[0].pontosCreditados) {
      await pontuarStars({
        workspaceId: ind[0].workspaceId,
        motivo: 'INDICACAO_CONVERTIDA',
        pontos: 500,
        descricao: `Indicação convertida: ${ind[0].nomeIndicada}`,
      })
      await prisma.$executeRaw`
        UPDATE "VpsIndicacao" SET "pontosCreditados" = true WHERE id = ${id}
      `
    }
    return NextResponse.json({ ok: true })
  }

  // ── Atualizar status de resgate ────────────────────────────────────────
  if (acao === 'status-resgate') {
    const { id, status, observacoes } = await req.json()
    await prisma.$executeRaw`
      UPDATE "VpsStarsResgate"
      SET status = ${status}, observacoes = COALESCE(${observacoes ?? null}, observacoes)
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  }

  // ── Criar/editar prêmio ────────────────────────────────────────────────
  if (acao === 'salvar-premio') {
    const { id, nome, descricao, tipo, pontosNecessarios, parceiro, quantidade, ativo, nivelMinimo } = await req.json()
    if (id) {
      await prisma.$executeRaw`
        UPDATE "VpsStarsPremio" SET
          nome = ${nome}, descricao = ${descricao ?? null}, tipo = ${tipo},
          "pontosNecessarios" = ${Number(pontosNecessarios)},
          parceiro = ${parceiro ?? null},
          quantidade = ${quantidade ? Number(quantidade) : null},
          "nivelMinimo" = ${nivelMinimo ?? null},
          ativo = ${ativo ?? true}
        WHERE id = ${id}
      `
    } else {
      const novoId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "VpsStarsPremio" ("id","nome","descricao","tipo","pontosNecessarios","parceiro","quantidade","nivelMinimo","ativo","createdAt")
        VALUES (${novoId}, ${nome}, ${descricao ?? null}, ${tipo}, ${Number(pontosNecessarios)},
                ${parceiro ?? null}, ${quantidade ? Number(quantidade) : null},
                ${nivelMinimo ?? null}, ${ativo ?? true}, NOW())
      `
    }
    return NextResponse.json({ ok: true })
  }

  // ── Pontuar manualmente ────────────────────────────────────────────────
  if (acao === 'pontuar-manual') {
    const { workspaceId, pontos, descricao } = await req.json()
    await pontuarStars({ workspaceId, motivo: 'MANUAL_MASTER', pontos: Number(pontos), descricao })
    return NextResponse.json({ ok: true })
  }

  // ── Zerar trimestre ────────────────────────────────────────────────────
  if (acao === 'zerar-trimestre') {
    await prisma.$executeRaw`
      UPDATE "VpsStars" SET "pontosTrimestre" = 0, "updatedAt" = NOW()
    `
    return NextResponse.json({ ok: true })
  }

  // ── Zerar ciclo anual (abril) ──────────────────────────────────────────
  if (acao === 'zerar-ciclo') {
    await prisma.$executeRaw`
      UPDATE "VpsStars" SET
        "pontosAno" = 0, "pontosTrimestre" = 0,
        nivel = 'SEMENTINHA', "updatedAt" = NOW()
    `
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
