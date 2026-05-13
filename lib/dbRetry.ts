// lib/dbRetry.ts
// Wrapper para queries Prisma com retry automático em caso de
// erros de conexão (P1001, P1008, P1017) — comuns no Neon serverless

const RETRY_ERROR_CODES = ['P1001', 'P1008', 'P1017', 'P2024', 'P2034']
const MAX_RETRIES = 3
const BASE_DELAY_MS = 200

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryable(err: any): boolean {
  if (!err) return false
  if (err.code && RETRY_ERROR_CODES.includes(err.code)) return true
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes("can't reach database server") ||
    msg.includes('connection terminated') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  )
}

/**
 * Executa uma função Prisma com retry automático em erros transitórios.
 * Uso: `const dados = await withRetry(() => prisma.$queryRaw\`SELECT ...\`)`
 */
export async function withRetry<T>(fn: () => Promise<T>, label = 'query'): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      if (!isRetryable(err) || attempt === MAX_RETRIES) throw err
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) // 200, 400, 800
      console.warn(`[withRetry ${label}] tentativa ${attempt + 1} falhou (${err.code || err.message}). Retry em ${delay}ms`)
      await sleep(delay)
    }
  }
  throw lastError
}
