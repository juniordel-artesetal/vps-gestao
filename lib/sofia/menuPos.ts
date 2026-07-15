// Leitura/provisão (server-side) da preferência de posição do menu, por USUÁRIA.
// Guardada na tabela per-user "SofiaConfig" (mesma que a Sofia já usa). Projeto sem
// prisma migrate — a coluna é criada de forma idempotente (ADD COLUMN IF NOT EXISTS).
import { prisma } from '@/lib/prisma'
import { normalizarPos, type MenuPos } from '@/lib/sofia/menuPosTipos'

let colunaGarantida = false

// Garante a coluna "menuPosicao" na SofiaConfig (idempotente, roda 1x por processo).
export async function ensureMenuPosColuna(): Promise<void> {
  if (colunaGarantida) return
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "SofiaConfig" ADD COLUMN IF NOT EXISTS "menuPosicao" text`)
    colunaGarantida = true
  } catch {
    // A tabela pode ainda não existir neste momento; `garantir()` em /api/sofia/config a cria.
  }
}

// Posição do menu da usuária (default 'left'). Nunca lança — em qualquer erro, cai no default.
export async function getMenuPos(userId: string): Promise<MenuPos> {
  try {
    await ensureMenuPosColuna()
    const rows = await prisma.$queryRaw`
      SELECT "menuPosicao" FROM "SofiaConfig" WHERE "userId" = ${userId} LIMIT 1
    ` as { menuPosicao: string | null }[]
    return normalizarPos(rows[0]?.menuPosicao)
  } catch {
    return 'left'
  }
}
