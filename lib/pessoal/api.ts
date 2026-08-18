// Helpers das rotas /api/pessoal/*. TUDO escopado por session.user.id (privado) e sob o
// gate do add-on (ADMIN + assinatura ATIVA). Prisma raw; serialize inline; sem SELECT *.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assinaturaAtiva } from './assinatura'
import { ensurePessoalTables } from './schema'

export function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// HTML do editor → texto puro p/ busca/preview (~200 chars). Sem libs: strip tags + entidades comuns.
export function resumoDeHtml(html: unknown, max = 200): string {
  const txt = String(html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|br)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim()
  return txt.length > max ? txt.slice(0, max).trimEnd() + '…' : txt
}

// Dinheiro: aceita vírgula/ponto; nunca NaN. (A UI usa type=text + inputMode=decimal.)
export function parseNum(s: unknown): number {
  let str = String(s ?? '').trim()
  if (!str) return 0
  if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(str)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

// Lembrete: aceita 'YYYY-MM-DDTHH:MM' (datetime-local). Devolve string (16 chars) ou null.
export function parseLembrete(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : null
}

// Data flexível → 'YYYY-MM-DD' ou null.
export function parseData(v: unknown): string | null {
  const s = String(v ?? '').trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

export type Guard = { userId: string } | { erro: NextResponse }

/** Gate único das rotas do Pessoal: ADMIN + assinatura ATIVA. Retorna userId ou erro. */
export async function guardPessoal(): Promise<Guard> {
  const session = await getServerSession(authOptions)
  if (!session) return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  if (session.user.role !== 'ADMIN') return { erro: NextResponse.json({ error: 'Restrito a administradores' }, { status: 403 }) }
  if (!(await assinaturaAtiva(session.user.id))) return { erro: NextResponse.json({ error: 'Assinatura do Pessoal inativa' }, { status: 402 }) }
  await ensurePessoalTables()
  return { userId: session.user.id }
}
