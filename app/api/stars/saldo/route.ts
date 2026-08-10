// app/api/stars/saldo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, serialize(v)]))
  return obj
}

const NIVEIS_CONFIG = [
  { nome: 'SEMENTINHA', label: '🌱 Sementinha', min: 0,     max: 1399  },
  { nome: 'BLOOM',      label: '🌸 Bloom',      min: 1400,  max: 5499  },
  { nome: 'PRODUTORA',  label: '🔶 Produtora',  min: 5500,  max: 13999 },
  { nome: 'EXPERT',     label: '🌟 Expert',     min: 14000, max: 41999 },
  { nome: 'ELITE',      label: '👑 Elite',      min: 42000, max: Infinity },
]

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)
    const incluirRanking = searchParams.get('ranking') === '1'

    // Saldo do workspace
    const rows = await prisma.$queryRaw`
      SELECT s.*, w.nome AS "workspaceNome"
      FROM "VpsStars" s
      JOIN "Workspace" w ON w.id = s."workspaceId"
      WHERE s."workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    const saldo = rows[0] ?? {
      pontos: 0, pontosAno: 0, pontosTrimestre: 0, nivel: 'SEMENTINHA'
    }

    // Calcular próximo nível
    const nivelAtual = NIVEIS_CONFIG.find(n => n.nome === saldo.nivel) ?? NIVEIS_CONFIG[0]
    const proximoNivel = NIVEIS_CONFIG[NIVEIS_CONFIG.indexOf(nivelAtual) + 1] ?? null
    const progressoPct = proximoNivel
      ? Math.min(100, Math.round(((Number(saldo.pontosAno) - nivelAtual.min) / (proximoNivel.min - nivelAtual.min)) * 100))
      : 100
    const pontosParaProximo = proximoNivel ? Math.max(0, proximoNivel.min - Number(saldo.pontosAno)) : 0

    // Verificar TOP 20 trimestral (mínimo 10.000 pts no trimestre)
    let posicaoTrimestral: number | null = null
    let isTop20 = false
    if (Number(saldo.pontosTrimestre) >= 10000) {
      const rankTrimRow = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS posicao
        FROM "VpsStars"
        WHERE "pontosTrimestre" > ${Number(saldo.pontosTrimestre)}
      ` as any[]
      posicaoTrimestral = Number(rankTrimRow[0]?.posicao ?? 0) + 1
      isTop20 = posicaoTrimestral <= 20
    }

    // Posição no ranking anual
    const rankAnoRow = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS posicao
      FROM "VpsStars"
      WHERE "pontosAno" > ${Number(saldo.pontosAno)}
    ` as any[]
    const posicaoAnual = Number(rankAnoRow[0]?.posicao ?? 0) + 1

    // Histórico recente (últimos 10 eventos)
    const historico = await prisma.$queryRaw`
      SELECT motivo, pontos, descricao, "createdAt"
      FROM "VpsStarsLog"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "createdAt" DESC
      LIMIT 10
    ` as any[]

    // Ranking (opcional)
    let ranking: any[] = []
    if (incluirRanking) {
      ranking = await prisma.$queryRaw`
        SELECT s."workspaceId", w.nome AS "workspaceNome", s."pontosAno", s.nivel,
               ROW_NUMBER() OVER (ORDER BY s."pontosAno" DESC)::int AS posicao
        FROM "VpsStars" s
        JOIN "Workspace" w ON w.id = s."workspaceId"
        WHERE w.ativo = true
        ORDER BY s."pontosAno" DESC
        LIMIT 50
      ` as any[]
    }

    return NextResponse.json(serialize({
      pontos:            saldo.pontos,
      pontosAno:         saldo.pontosAno,
      pontosTrimestre:   saldo.pontosTrimestre,
      nivel:             saldo.nivel,
      nivelLabel:        nivelAtual.label,
      proximoNivel:      proximoNivel?.label ?? null,
      progressoPct,
      pontosParaProximo,
      posicaoAnual,
      posicaoTrimestral,
      isTop20,
      historico,
      ranking,
    }))
  } catch (error) {
    console.error('[VpsStars/saldo]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
