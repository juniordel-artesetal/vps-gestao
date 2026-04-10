// lib/errorLog.ts
// Utilitário para registrar erros por workspace no banco
// Uso: await logError({ workspaceId, userId, rota, metodo, erro, payload })

import { prisma } from '@/lib/prisma'

interface ErrorLogInput {
  workspaceId?: string | null
  userId?: string | null
  rota: string
  metodo?: string
  erro: string | unknown
  payload?: unknown
}

export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const erroStr = input.erro instanceof Error
      ? `${input.erro.message}\n${input.erro.stack || ''}`
      : String(input.erro)
    const payloadStr = input.payload
      ? JSON.stringify(input.payload).slice(0, 2000)
      : null

    await prisma.$executeRaw`
      INSERT INTO "ErrorLog" ("id","workspaceId","userId","rota","metodo","erro","payload")
      VALUES (
        ${id},
        ${input.workspaceId ?? null},
        ${input.userId ?? null},
        ${input.rota},
        ${input.metodo ?? 'GET'},
        ${erroStr.slice(0, 2000)},
        ${payloadStr}
      )
    `
  } catch {
    // nunca lançar erro a partir do logger
  }
}
