// app/api/leads/route.ts
// POST público: captura de lead (nome + telefone + consentimento). Valida TUDO no
// servidor, rate limit e dedup. ★LGPD: telefone NUNCA em log; consentimento obrigatório.★
// GET: só MASTER (master_token) — lista mascarada; ?export=csv devolve CSV completo (auditado).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

let tabelaOk = false
async function ensureLeadTable() {
  if (tabelaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Lead" (
      "id" text PRIMARY KEY,
      "nome" text NOT NULL,
      "telefone" text NOT NULL,
      "origem" text NOT NULL DEFAULT 'megaartesanal2026',
      "consentimento" boolean NOT NULL DEFAULT false,
      "userAgent" text,
      "createdAt" timestamptz NOT NULL DEFAULT now())
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_origem_idx" ON "Lead" ("origem","createdAt")`)
  tabelaOk = true
}

async function isMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// Rate limit best-effort (por instância serverless). Suficiente contra flood simples.
const hits = new Map<string, number[]>()
function rateLimited(ip: string, max = 6, windowMs = 60_000): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs)
  arr.push(now)
  hits.set(ip, arr)
  return arr.length > max
}

function mascararTelefone(tel: string): string {
  const d = String(tel).replace(/\D/g, '')
  if (d.length < 6) return '••••'
  const ddd = d.slice(0, 2)
  const fim = d.slice(-4)
  return `(${ddd}) •••••-${fim}`
}

// ── POST público — grava o lead ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await ensureLeadTable()
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido'
    if (rateLimited(ip)) return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const nome = String(body?.nome || '').trim()
    const telDigits = String(body?.telefone || '').replace(/\D/g, '')
    const consentimento = body?.consentimento === true
    const origem = (String(body?.origem || 'megaartesanal2026').trim().slice(0, 60)) || 'megaartesanal2026'

    if (nome.length < 2 || nome.length > 120) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
    if (telDigits.length < 10 || telDigits.length > 11) return NextResponse.json({ error: 'Informe um WhatsApp válido com DDD.' }, { status: 400 })
    if (!consentimento) return NextResponse.json({ error: 'É necessário aceitar receber contato da equipe SOA.' }, { status: 400 })

    // Dedup: mesmo telefone + origem nas últimas 24h → não duplica (retorna ok)
    const [dup] = await prisma.$queryRaw`
      SELECT "id" FROM "Lead"
      WHERE "telefone" = ${telDigits} AND "origem" = ${origem}
        AND "createdAt" > NOW() - INTERVAL '24 hours'
      LIMIT 1
    ` as any[]
    if (dup) return NextResponse.json({ ok: true, jaCadastrado: true })

    const ua = String(req.headers.get('user-agent') || '').slice(0, 300)
    const id = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "Lead" ("id","nome","telefone","origem","consentimento","userAgent","createdAt")
      VALUES (${id}, ${nome.slice(0, 120)}, ${telDigits}, ${origem}, ${true}, ${ua || null}, NOW())
    `
    // ★ Nunca logar o telefone. ★
    console.log('[leads] novo lead:', origem)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/leads]', error)
    return NextResponse.json({ error: 'Erro ao registrar. Tente novamente.' }, { status: 500 })
  }
}

// ── GET — só MASTER. Lista mascarada; ?export=csv = CSV completo (auditado) ──
export async function GET(req: NextRequest) {
  if (!await isMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureLeadTable()
  const sp = new URL(req.url).searchParams
  const origem = sp.get('origem')
  const de = sp.get('de')
  const ate = sp.get('ate')
  const exportar = sp.get('export') === 'csv'

  const rows = await prisma.$queryRaw`
    SELECT "id","nome","telefone","origem","consentimento","createdAt"
    FROM "Lead"
    WHERE (${origem}::text IS NULL OR "origem" = ${origem})
      AND (${de}::date  IS NULL OR "createdAt" >= ${de}::date)
      AND (${ate}::date IS NULL OR "createdAt" < (${ate}::date + 1))
    ORDER BY "createdAt" DESC
    LIMIT 5000
  ` as any[]

  if (exportar) {
    // Ação auditada: registra QUEM/quando/quantos (sem telefones no log)
    console.log('[leads] export CSV pelo master:', rows.length, 'leads · origem:', origem || 'todas')
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = 'nome,telefone,origem,consentimento,data\n'
    const body = rows.map(r =>
      [esc(r.nome), esc(String(r.telefone)), esc(r.origem), esc(r.consentimento ? 'sim' : 'não'), esc(new Date(r.createdAt).toISOString())].join(',')
    ).join('\n')
    return new NextResponse(head + body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${origem || 'todas'}.csv"`,
      },
    })
  }

  // Lista para a tela: telefone MASCARADO
  const itens = rows.map(r => ({
    id: r.id, nome: r.nome, origem: r.origem,
    telefoneMascarado: mascararTelefone(String(r.telefone)),
    consentimento: !!r.consentimento, createdAt: r.createdAt,
  }))
  const origens = Array.from(new Set(rows.map(r => r.origem)))
  return NextResponse.json(serialize({ itens, total: itens.length, origens }))
}
