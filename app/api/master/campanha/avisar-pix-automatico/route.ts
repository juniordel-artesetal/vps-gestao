// Master — e-mail de aviso para quem migrou pro Asaas mas ainda tem cobrança
// antiga rodando (Hotmart/Pix Automático). NÃO é link de reativação: a cliente já
// está no 29,90. O recado é: seu plano certo já está ativo; agora cancele a
// autorização de Pix Automático no app do banco pra parar a cobrança dupla.
//
// GET  ?email= → devolve a PRÉVIA do e-mail (assunto + html), sem enviar.
// POST { email } → envia de verdade (remetente Equipe SOA) e loga.
//
// Segurança: guarda master; Resend só em env; Prisma raw, sem SELECT *; escopo à cliente.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

async function primeiroNomeDe(email: string): Promise<string> {
  const [c] = await prisma.$queryRaw`
    SELECT "primeiroNome" FROM "CampanhaMigracao" WHERE lower("email") = ${email} LIMIT 1
  ` as { primeiroNome: string | null }[]
  if (c?.primeiroNome) return c.primeiroNome
  const [u] = await prisma.$queryRaw`
    SELECT "nome" FROM "User" WHERE lower("email") = ${email} ORDER BY ("role" = 'ADMIN') DESC LIMIT 1
  ` as { nome: string | null }[]
  return (u?.nome || '').trim().split(/\s+/)[0] || ''
}

function montarEmail(nome: string): { assunto: string; html: string; texto: string } {
  const ola = nome ? `Oi, ${nome}!` : 'Oi!'
  const assunto = 'Seu plano no SOA já está certinho (R$ 29,90) 💛'
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${ola} 💛</p>
    <p>Boas notícias: sua assinatura do <b>SOA</b> já está ativa no valor certo — <b>R$ 29,90/mês</b> (com o 1º mês por R$ 9,90, o creditinho da migração). Não precisa fazer mais nada por aqui: está tudo funcionando na sua conta. 🎉</p>
    <p style="margin-top:18px"><b>Só falta um passo, do seu lado, pra você não pagar duas vezes:</b></p>
    <p>A cobrança <b>antiga</b> (a de R$ 49,90, pela Hotmart) foi feita por <b>Pix Automático</b>. Cancelar a assinatura antiga nem sempre desliga esse Pix Automático no banco — então, pra garantir, entre no <b>app do seu banco</b> e cancele a <b>autorização de Pix Automático</b> ligada a essa cobrança.</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:12px 16px;margin:16px 0;font-size:14px">
      📱 No app do banco, procure por <b>“Pix Automático”</b> ou <b>“Autorizações de Pix”</b> e cancele a autorização da cobrança antiga. Assim, só fica a mensalidade certa de R$ 29,90.
    </div>
    <p>Se aparecer qualquer cobrança que você não reconheça, ou se ficar em dúvida em algum passo, é só responder este e-mail que a gente resolve rapidinho com você. 💛</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:18px">SOA · suporte@vps-gestao.com.br</p>
  </div>`.trim()
  const texto = `${ola}\n\nSua assinatura do SOA já está ativa no valor certo: R$ 29,90/mês (1º mês R$ 9,90). Não precisa fazer mais nada por aqui.\n\nSó falta um passo do seu lado, pra não pagar duas vezes: a cobrança antiga (R$ 49,90, Hotmart) foi por Pix Automático. Entre no app do seu banco e cancele a AUTORIZAÇÃO de Pix Automático dessa cobrança (procure por "Pix Automático" ou "Autorizações de Pix").\n\nQualquer dúvida, responda este e-mail. 💛\nEquipe SOA · suporte@vps-gestao.com.br`
  return { assunto, html, texto }
}

// GET — prévia (não envia).
export async function GET(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Informe ?email=' }, { status: 400 })
  const nome = await primeiroNomeDe(email)
  const { assunto, texto, html } = montarEmail(nome)
  return NextResponse.json({ previa: true, para: email, de: REMETENTE, assunto, texto, html })
}

// POST — envia de verdade.
export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY ausente.' }, { status: 503 })

  const b = await req.json().catch(() => ({}))
  const email = (b.email || '').trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })

  const nome = await primeiroNomeDe(email)
  const { assunto, html } = montarEmail(nome)

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: REMETENTE, to: [email], subject: assunto, html }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      console.error(`[AVISO-PIX] falhou para ${email}: Resend ${r.status}`)
      return NextResponse.json({ error: `Resend ${r.status}`, detalhe: j }, { status: 502 })
    }
    console.log(`[AVISO-PIX] enviado para ${email} id=${j?.id ?? '-'}`)
    return NextResponse.json({ ok: true, enviadoPara: email, de: REMETENTE, assunto, resendId: j?.id ?? null })
  } catch (e) {
    console.error(`[AVISO-PIX] erro para ${email}:`, (e as Error)?.message)
    return NextResponse.json({ error: 'Falha ao enviar o e-mail.' }, { status: 502 })
  }
}
