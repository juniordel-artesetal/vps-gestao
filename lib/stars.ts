// lib/stars.ts
// Helper interno de pontuação VPS Stars — chamado direto pelo backend
// Evita problemas com fetch interno em dev (NEXTAUTH_URL)

import { prisma } from '@/lib/prisma'

const NIVEIS = [
  { nome: 'SEMENTINHA', min: 0,      max: 1399  },
  { nome: 'BLOOM',      min: 1400,   max: 5499  },
  { nome: 'PRODUTORA',  min: 5500,   max: 13999 },
  { nome: 'EXPERT',     min: 14000,  max: 41999 },
  { nome: 'ELITE',      min: 42000,  max: Infinity },
]

function calcularNivel(pontos: number): string {
  return NIVEIS.find(n => pontos >= n.min && pontos <= n.max)?.nome ?? 'SEMENTINHA'
}

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function pontuarStars(p: {
  workspaceId: string
  motivo: string
  pontos: number
  descricao?: string
  metadata?: Record<string, any>
}): Promise<{ ok: boolean; totalPontos?: number; motivo?: string }> {
  try {
    if (!p.workspaceId || !p.motivo || !p.pontos) {
      return { ok: false, motivo: 'Dados inválidos' }
    }

    // Verificar se programa está ativo (a partir de 01/06/2026)
    // ⚠️ DESATIVADO PARA TESTES — REATIVAR ANTES DO LANÇAMENTO OFICIAL ⚠️
    // const inicio = new Date('2026-06-01T00:00:00Z')
    // if (new Date() < inicio) {
    //   return { ok: false, motivo: 'Programa ainda não iniciado' }
    // }

    const existente = await prisma.$queryRaw`
      SELECT id, pontos, "pontosAno", "pontosTrimestre", nivel
      FROM "VpsStars"
      WHERE "workspaceId" = ${p.workspaceId}
      LIMIT 1
    ` as any[]

    let novosPontos: number
    let novosPontosAno: number
    let novosPontosTrimestre: number

    if (existente.length === 0) {
      const id = gerarId()
      novosPontos = p.pontos
      novosPontosAno = p.pontos
      novosPontosTrimestre = p.pontos
      const nivel = calcularNivel(novosPontos)
      await prisma.$executeRaw`
        INSERT INTO "VpsStars" ("id","workspaceId","pontos","pontosAno","pontosTrimestre","nivel","updatedAt")
        VALUES (${id}, ${p.workspaceId}, ${novosPontos}, ${novosPontosAno}, ${novosPontosTrimestre}, ${nivel}, NOW())
      `
    } else {
      const atual = existente[0]
      novosPontos = Number(atual.pontos) + p.pontos
      novosPontosAno = Number(atual.pontosAno) + p.pontos
      novosPontosTrimestre = Number(atual.pontosTrimestre) + p.pontos
      const nivel = calcularNivel(novosPontosAno)
      await prisma.$executeRaw`
        UPDATE "VpsStars" SET
          "pontos"            = ${novosPontos},
          "pontosAno"         = ${novosPontosAno},
          "pontosTrimestre"   = ${novosPontosTrimestre},
          "nivel"             = ${nivel},
          "updatedAt"         = NOW()
        WHERE "workspaceId" = ${p.workspaceId}
      `
    }

    const logId = gerarId()
    const metadataJson = p.metadata ? JSON.stringify(p.metadata) : null
    await prisma.$executeRaw`
      INSERT INTO "VpsStarsLog" ("id","workspaceId","motivo","pontos","descricao","metadata","createdAt")
      VALUES (${logId}, ${p.workspaceId}, ${p.motivo}, ${p.pontos}, ${p.descricao ?? null}, ${metadataJson}::jsonb, NOW())
    `

    return { ok: true, totalPontos: novosPontos }
  } catch (error) {
    console.error('[pontuarStars]', error)
    return { ok: false, motivo: 'Erro interno' }
  }
}
