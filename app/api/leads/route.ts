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

const ORIGEM_SORTEIO = 'sorteio_megaartesanal2026'

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
  await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "email" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "codigo" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "codigoStand" text`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_origem_idx" ON "Lead" ("origem","createdAt")`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Lead_codigo_idx" ON "Lead" ("codigo")`)
  // Dedupe PARCIAL — só a origem do sorteio (um cadastro por e-mail e por telefone)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Lead_sorteio_email" ON "Lead" ("email") WHERE "origem"='${ORIGEM_SORTEIO}' AND "email" IS NOT NULL`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Lead_sorteio_tel" ON "Lead" ("telefone") WHERE "origem"='${ORIGEM_SORTEIO}'`)
  tabelaOk = true
}

// Códigos válidos do stand (env, trocáveis sem deploy). Default: FOFURICES2026.
function codigosStandValidos(): string[] {
  return (process.env.SORTEIO_CODIGOS || 'FOFURICES2026')
    .split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
}

// Código de participação curto e único: MA26-XXXXXX (sem caracteres ambíguos)
function gerarCodigoParticipacao(): string {
  const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += AB[Math.floor(Math.random() * AB.length)]
  return `MA26-${s}`
}

function emailValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}

// Envio do e-mail de confirmação via Resend. TOLERANTE: nunca derruba o cadastro,
// nunca loga e-mail/telefone. Retorna true/false só para telemetria interna.
async function enviarEmailSorteio(email: string, nome: string, codigo: string): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY || !process.env.SUPORTE_EMAIL) return false
    const primeiroNome = String(nome).trim().split(/\s+/)[0] || 'artesã'
    const reg = 'https://usesoa.com.br/megaartesanal/sorteio#regulamento'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Equipe SOA <${process.env.SUPORTE_EMAIL}>`,
        to: [email],
        subject: '🍀 Participação confirmada! Você está concorrendo a 1 ano grátis de SOA',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111827;padding:8px;">
            <p style="font-size:16px;margin:0 0 8px;">Oi, <strong>${primeiroNome}</strong>! 🧡</p>
            <p style="font-size:14px;color:#374151;margin:0 0 16px;">Sua participação no sorteio da <strong>Mega Artesanal 2026</strong> está confirmada! 🎉</p>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px;text-align:center;margin:0 0 16px;">
              <p style="font-size:12px;color:#9a3412;margin:0 0 4px;">Seu código de participação</p>
              <p style="font-size:24px;font-weight:800;letter-spacing:2px;color:#ea580c;margin:0;">${codigo}</p>
              <p style="font-size:11px;color:#9ca3af;margin:6px 0 0;">guarde este e-mail — é o seu comprovante</p>
            </div>
            <p style="font-size:14px;color:#374151;margin:0 0 12px;"><strong>O prêmio:</strong> 1 ano de assinatura do SOA — Sistema de Organização de Ateliês, grátis.</p>
            <p style="font-size:14px;color:#374151;margin:0 0 12px;">O sorteio acontece no <strong>Stand da Fofurices de Aplique</strong>, nos dias 11 e 12/07/2026, às 16:30. Se você for a sorteada, a gente te chama pelo WhatsApp e por este e-mail. 😍</p>
            <p style="font-size:14px;color:#374151;margin:0 0 16px;">Enquanto isso, dá uma espiada no que o SOA faz pelo seu ateliê: produção por setores, precificação que mostra sua margem de verdade, financeiro, estoque, clientes e até sua loja virtual. 👉 <a href="https://usesoa.com.br" style="color:#ea580c;">usesoa.com.br</a></p>
            <p style="font-size:14px;color:#374151;margin:0 0 4px;">Foi um prazer te encontrar na feira. Boa sorte! 🍀</p>
            <p style="font-size:14px;color:#374151;margin:0 0 16px;">Com carinho,<br/>Equipe SOA</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
            <p style="font-size:11px;color:#9ca3af;margin:0;">${process.env.SUPORTE_EMAIL} · usesoa.com.br · Consulte o <a href="${reg}" style="color:#9ca3af;">regulamento completo</a>. Um cadastro por pessoa.</p>
          </div>`,
      }),
    })
    return res.ok
  } catch (e) {
    // Sem PII: só a natureza do erro
    console.error('[leads] falha no e-mail de confirmação (lead preservado):', (e as any)?.name || 'erro')
    return false
  }
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

function mascararEmail(email: string | null): string {
  const e = String(email || '').trim()
  if (!e || !e.includes('@')) return '—'
  const [user, dom] = e.split('@')
  const u = user.length <= 2 ? user[0] + '•' : user.slice(0, 2) + '•••'
  return `${u}@${dom}`
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
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 160)
    const codigoStand = String(body?.codigoStand || '').trim().toUpperCase().slice(0, 40)
    const consentimento = body?.consentimento === true
    const origem = (String(body?.origem || 'megaartesanal2026').trim().slice(0, 60)) || 'megaartesanal2026'
    const ehSorteio = origem === ORIGEM_SORTEIO

    if (nome.length < 2 || nome.length > 120) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
    if (telDigits.length < 10 || telDigits.length > 11) return NextResponse.json({ error: 'Informe um WhatsApp válido com DDD.' }, { status: 400 })
    if (!consentimento) return NextResponse.json({ error: 'É necessário aceitar o regulamento.' }, { status: 400 })

    // ── Fluxo SORTEIO: exige e-mail + código do stand válido ──────────────────
    if (ehSorteio) {
      if (!emailValido(email)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
      if (!codigoStand) return NextResponse.json({ error: 'Informe o código recebido no stand.' }, { status: 400 })
      if (!codigosStandValidos().includes(codigoStand))
        return NextResponse.json({ error: 'Código do stand inválido. Confira o código recebido na compra.' }, { status: 400 })

      // Dedupe (um cadastro por pessoa): e-mail OU telefone já cadastrados nesta origem.
      const [dup] = await prisma.$queryRaw`
        SELECT "id","codigo","email" FROM "Lead"
        WHERE "origem" = ${origem} AND ("email" = ${email} OR "telefone" = ${telDigits})
        LIMIT 1
      ` as any[]
      if (dup) {
        // Já participa → reenvia o código por e-mail (idempotente) e avisa.
        if (dup.codigo && dup.email) { void enviarEmailSorteio(dup.email, nome, dup.codigo) }
        return NextResponse.json({ ok: true, jaCadastrado: true, codigo: dup.codigo || null })
      }

      // Gera código de participação único (retry em colisão rara)
      let codigo = gerarCodigoParticipacao()
      for (let i = 0; i < 5; i++) {
        const [ex] = await prisma.$queryRaw`SELECT 1 FROM "Lead" WHERE "codigo" = ${codigo} LIMIT 1` as any[]
        if (!ex) break
        codigo = gerarCodigoParticipacao()
      }

      const ua = String(req.headers.get('user-agent') || '').slice(0, 300)
      const id = gerarId()
      try {
        await prisma.$executeRaw`
          INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento","codigo","codigoStand","userAgent","createdAt")
          VALUES (${id}, ${nome.slice(0, 120)}, ${telDigits}, ${email}, ${origem}, ${true}, ${codigo}, ${codigoStand}, ${ua || null}, NOW())
        `
      } catch (err: any) {
        // Corrida no dedupe parcial (23505) → trata como já cadastrado
        if (String(err?.message || '').includes('23505') || err?.meta?.code === '23505') {
          return NextResponse.json({ ok: true, jaCadastrado: true })
        }
        throw err
      }
      // ★ Nunca logar e-mail/telefone. ★ E-mail tolerante: lead já está salvo.
      console.log('[leads] novo lead sorteio registrado')
      const enviado = await enviarEmailSorteio(email, nome, codigo)
      return NextResponse.json({ ok: true, codigo, emailEnviado: enviado })
    }

    // ── Fluxo padrão (feira / landing 1): telefone dedupe 24h ──────────────────
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
      INSERT INTO "Lead" ("id","nome","telefone","email","origem","consentimento","userAgent","createdAt")
      VALUES (${id}, ${nome.slice(0, 120)}, ${telDigits}, ${email || null}, ${origem}, ${true}, ${ua || null}, NOW())
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
    SELECT "id","nome","telefone","email","origem","consentimento","codigo","codigoStand","createdAt"
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
    const head = 'nome,telefone,email,origem,codigo,codigoStand,consentimento,data\n'
    const body = rows.map(r =>
      [esc(r.nome), esc(String(r.telefone)), esc(r.email), esc(r.origem), esc(r.codigo), esc(r.codigoStand), esc(r.consentimento ? 'sim' : 'não'), esc(new Date(r.createdAt).toISOString())].join(',')
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
    emailMascarado: mascararEmail(r.email),
    codigo: r.codigo || null,
    consentimento: !!r.consentimento, createdAt: r.createdAt,
  }))
  const origens = Array.from(new Set(rows.map(r => r.origem)))
  return NextResponse.json(serialize({ itens, total: itens.length, origens }))
}
