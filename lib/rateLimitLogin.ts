// Proteção anti-força-bruta no login. Reusa a tabela LoginHistory (que já grava
// TODA tentativa, sucesso ou falha, com email/ip/createdAt) — nada de tabela nova.
//
// Regra: N falhas em uma janela recente para o MESMO e-mail ⇒ bloqueio temporário
// (backoff). O bloqueio expira sozinho conforme as falhas envelhecem para fora da
// janela. FAIL-OPEN: qualquer erro de consulta NUNCA bloqueia um login legítimo.
import { prisma } from '@/lib/prisma'

const MAX_TENTATIVAS = Number(process.env.LOGIN_MAX_TENTATIVAS || 5)
const JANELA_MIN = Number(process.env.LOGIN_JANELA_MIN || 15)
const LOCKOUT_MIN = Number(process.env.LOGIN_LOCKOUT_MIN || 15)

export interface EstadoBloqueio {
  bloqueado: boolean
  tentativas: number
  esperaMin: number
}

/**
 * Verifica se o e-mail está temporariamente bloqueado por excesso de falhas.
 * Conta as falhas dos últimos JANELA_MIN minutos; a partir de MAX_TENTATIVAS,
 * bloqueia por LOCKOUT_MIN minutos contados a partir da falha mais recente.
 */
export async function verificarBloqueioLogin(email: string): Promise<EstadoBloqueio> {
  const liberado: EstadoBloqueio = { bloqueado: false, tentativas: 0, esperaMin: 0 }
  if (!email) return liberado
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS "n",
             EXTRACT(EPOCH FROM (NOW() - MAX("createdAt")))::int AS "desdeUltimaSeg"
      FROM "LoginHistory"
      WHERE LOWER("email") = LOWER(${email})
        AND "sucesso" = false
        AND "createdAt" >= NOW() - (${JANELA_MIN} * INTERVAL '1 minute')
    ` as { n: number; desdeUltimaSeg: number | null }[]

    const n = rows[0]?.n ?? 0
    if (n < MAX_TENTATIVAS) return { bloqueado: false, tentativas: n, esperaMin: 0 }

    const desdeUltimaMin = Math.floor((rows[0]?.desdeUltimaSeg ?? 0) / 60)
    const esperaMin = Math.max(1, LOCKOUT_MIN - desdeUltimaMin)
    return { bloqueado: true, tentativas: n, esperaMin }
  } catch {
    // Fail-open: nunca trancar quem tem direito por causa de erro de banco.
    return liberado
  }
}

/** Mensagem única mostrada na tela de login quando bloqueado. */
export function mensagemBloqueio(e: EstadoBloqueio): string {
  return `Muitas tentativas de login. Por segurança, aguarde cerca de ${e.esperaMin} ` +
    `minuto${e.esperaMin > 1 ? 's' : ''} e tente novamente — ou use "Esqueci minha senha".`
}
