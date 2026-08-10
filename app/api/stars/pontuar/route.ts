// app/api/stars/pontuar/route.ts
// API INTERNA — chamada pelos outros módulos, não pelo front
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

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

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, motivo, pontos, descricao } = await req.json()
    if (!workspaceId || !motivo || !pontos) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Verificar se programa está ativo (a partir de 01/06/2026)
    const inicio = new Date('2026-06-01T00:00:00Z')
    if (new Date() < inicio) {
      return NextResponse.json({ ok: false, motivo: 'Programa ainda não iniciado' })
    }

    // Busca ou cria registro VpsStars
    const existente = await prisma.$queryRaw`
      SELECT id, pontos, "pontosAno", "pontosTrimestre", nivel
      FROM "VpsStars"
      WHERE "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    let novosPontos: number
    let novosPontosAno: number
    let novosPontosTrimestre: number

    if (existente.length === 0) {
      // Criar registro
      const id = gerarId()
      novosPontos = pontos
      novosPontosAno = pontos
      novosPontosTrimestre = pontos
      const nivel = calcularNivel(novosPontos)
      await prisma.$executeRaw`
        INSERT INTO "VpsStars" ("id","workspaceId","pontos","pontosAno","pontosTrimestre","nivel","updatedAt")
        VALUES (${id}, ${workspaceId}, ${novosPontos}, ${novosPontosAno}, ${novosPontosTrimestre}, ${nivel}, NOW())
      `
    } else {
      const atual = existente[0]
      novosPontos = Number(atual.pontos) + pontos
      novosPontosAno = Number(atual.pontosAno) + pontos
      novosPontosTrimestre = Number(atual.pontosTrimestre) + pontos
      const nivel = calcularNivel(novosPontosAno)
      await prisma.$executeRaw`
        UPDATE "VpsStars" SET
          "pontos"            = ${novosPontos},
          "pontosAno"         = ${novosPontosAno},
          "pontosTrimestre"   = ${novosPontosTrimestre},
          "nivel"             = ${nivel},
          "updatedAt"         = NOW()
        WHERE "workspaceId" = ${workspaceId}
      `
    }

    // Registrar no log
    const logId = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "VpsStarsLog" ("id","workspaceId","motivo","pontos","descricao","createdAt")
      VALUES (${logId}, ${workspaceId}, ${motivo}, ${pontos}, ${descricao ?? null}, NOW())
    `

    return NextResponse.json({ ok: true, pontosAdicionados: pontos, totalPontos: novosPontos })
  } catch (error) {
    console.error('[VpsStars/pontuar]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
