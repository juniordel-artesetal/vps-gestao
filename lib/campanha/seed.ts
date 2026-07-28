// Semeia a campanha a partir do CSV (colunas: primeiro_nome, email, status_hotmart).
// Deduplica por e-mail (ON CONFLICT). Todos entram como 'pendente' com dataInicio = hoje
// (a cadência é relativa a esse início). Reprocessar NÃO reseta quem já está na campanha.
import { prisma } from '@/lib/prisma'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export interface LinhaCampanha { email: string; primeiroNome: string | null; statusHotmart: string | null }

/** Parser CSV tolerante (vírgula; aspas simples). Cabeçalho por nome de coluna. */
export function parseCsvCampanha(texto: string): LinhaCampanha[] {
  const linhas = String(texto || '').split(/\r?\n/).filter(l => l.trim())
  if (!linhas.length) return []
  const split = (l: string) => l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
  const head = split(linhas[0]).map(h => h.toLowerCase())
  const iEmail = head.findIndex(h => h.includes('email') || h.includes('e-mail'))
  const iNome = head.findIndex(h => h.includes('nome'))
  const iStatus = head.findIndex(h => h.includes('status'))
  if (iEmail < 0) return []
  const vistos = new Set<string>()
  const out: LinhaCampanha[] = []
  for (const l of linhas.slice(1)) {
    const c = split(l)
    const email = (c[iEmail] || '').trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || vistos.has(email)) continue
    vistos.add(email)
    out.push({ email, primeiroNome: iNome >= 0 ? (c[iNome] || null) : null, statusHotmart: iStatus >= 0 ? (c[iStatus] || null) : null })
  }
  return out
}

export interface ResultadoSeed { total: number; inseridos: number; ignorados: number }

export async function semearCampanha(linhas: LinhaCampanha[]): Promise<ResultadoSeed> {
  let inseridos = 0
  for (const l of linhas) {
    const r = await prisma.$queryRaw`
      INSERT INTO "CampanhaMigracao" ("id","email","primeiroNome","statusHotmartInicial","estado","dataInicio","createdAt","updatedAt")
      VALUES (${gerarId()}, ${l.email}, ${l.primeiroNome}, ${l.statusHotmart}, 'pendente', CURRENT_DATE, NOW(), NOW())
      ON CONFLICT ("email") DO NOTHING RETURNING "id"
    ` as { id: string }[]
    if (r.length) inseridos++
  }
  return { total: linhas.length, inseridos, ignorados: linhas.length - inseridos }
}
