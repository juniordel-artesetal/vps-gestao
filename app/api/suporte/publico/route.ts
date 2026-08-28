// Chamado de suporte PÚBLICO (sem login) — rede de segurança pra quem está trancada
// (bloqueio/reativação) conseguir pedir socorro de dentro do sistema. Cria SuporteChamado
// marcado como pré-login e notifica a equipe (Telegram + e-mail). Anti-abuso: honeypot,
// validação de e-mail, rate-limit por e-mail (banco) + por IP (memória, best-effort).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
function protocolo(): string {
  const data = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `VPS-${data}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())

// Rate-limit por IP em memória (best-effort; o limite forte é por e-mail no banco).
const ipHits = new Map<string, number[]>()
function ipBloqueado(ip: string, max = 5, janelaMs = 3600_000): boolean {
  const agora = Date.now()
  const hits = (ipHits.get(ip) || []).filter(t => agora - t < janelaMs)
  hits.push(agora)
  ipHits.set(ip, hits)
  if (ipHits.size > 5000) ipHits.clear() // evita crescer sem limite
  return hits.length > max
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido'
  const body = await req.json().catch(() => ({}))
  const nome = String(body?.nome || '').trim().slice(0, 120)
  const email = String(body?.email || '').trim().slice(0, 160)
  const whatsapp = String(body?.telefone || body?.whatsapp || '').trim().slice(0, 40)
  const mensagem = String(body?.mensagem || '').trim().slice(0, 4000)
  const honeypot = String(body?.website || '').trim() // campo escondido — bot preenche

  // Honeypot: se veio preenchido, é bot. Responde ok (não dá pista) e ignora.
  if (honeypot) return NextResponse.json({ ok: true, protocolo: protocolo() })

  if (!nome || nome.length < 2) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
  if (!emailValido(email)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  if (!whatsapp || whatsapp.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'Informe um WhatsApp válido.' }, { status: 400 })
  if (!mensagem || mensagem.length < 5) return NextResponse.json({ error: 'Descreva o problema.' }, { status: 400 })

  if (ipBloqueado(ip)) return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' }, { status: 429 })

  // Rate-limit forte por e-mail: no máx. 3 chamados pré-login por e-mail por hora.
  try {
    const [{ n }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM "SuporteChamado"
      WHERE lower("email") = ${email.toLowerCase()} AND "etiquetas" LIKE '%pre-login%'
        AND "createdAt" > NOW() - INTERVAL '1 hour'
    ` as { n: number }[]
    if (n >= 3) return NextResponse.json({ error: 'Já recebemos seu contato. Aguarde nosso retorno. 🧡' }, { status: 429 })
  } catch { /* se a checagem falhar, segue (não bloqueia atendimento) */ }

  const prot = protocolo()
  const id = gid()
  let emailEnviado = false, telegramEnviado = false

  // ── Notifica por e-mail (Resend) — best-effort
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SOA Suporte <suporte@vps-gestao.com.br>',
        to: [process.env.SUPORTE_EMAIL],
        reply_to: email,
        subject: `[${prot}] 🔒 Contato PRÉ-LOGIN (sem acesso) — ${nome}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#f97316">Contato de quem está SEM acesso</h2>
          <p style="font-size:13px;color:#b45309;background:#fff8f0;padding:8px 12px;border-radius:8px;border-left:3px solid #f97316">Aberto da tela de login/bloqueio (pré-login) — provável cliente trancada.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#666"><strong>Protocolo:</strong></td><td>${prot}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>Nome:</strong></td><td>${nome}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>E-mail:</strong></td><td>${email}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>WhatsApp:</strong></td><td><a href="https://wa.me/55${whatsapp.replace(/\D/g, '')}">${whatsapp}</a></td></tr>
          </table>
          <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
          <p style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:14px;color:#333;white-space:pre-line">${mensagem}</p>
          <p style="margin-top:20px;font-size:12px;color:#999">Responda este e-mail — vai para ${email}</p>
        </div>`,
      }),
    })
    emailEnviado = r.ok
  } catch (e) { console.error('[SUPORTE-PUBLICO email]', (e as Error)?.message) }

  // ── Notifica no Telegram — best-effort
  try {
    const texto = [
      `🔒 <b>Contato PRÉ-LOGIN (sem acesso) — SOA</b>`, ``,
      `📋 <b>Protocolo:</b> ${prot}`,
      `👤 <b>Nome:</b> ${nome}`,
      `📧 <b>E-mail:</b> ${email}`,
      `📱 <b>WhatsApp:</b> ${whatsapp}`, ``,
      `📝 <b>Mensagem:</b>`, mensagem,
    ].join('\n')
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: texto, parse_mode: 'HTML' }),
    })
    telegramEnviado = r.ok
  } catch (e) { console.error('[SUPORTE-PUBLICO telegram]', (e as Error)?.message) }

  // ── Registra o chamado (workspaceId sentinela 'PRE_LOGIN'; etiquetas marcam a origem)
  try {
    await prisma.$executeRaw`
      INSERT INTO "SuporteChamado" (
        "id","workspaceId","usuarioNome","email","whatsapp","descricao",
        "protocolo","status","prioridade","etiquetas","emailEnviado","telegramEnviado","createdAt"
      ) VALUES (
        ${id}, 'PRE_LOGIN', ${nome}, ${email}, ${whatsapp}, ${mensagem},
        ${prot}, 'ABERTO', 'alta', 'pre-login,acesso', ${emailEnviado}, ${telegramEnviado}, NOW()
      )
    `
  } catch (e) {
    console.error('[SUPORTE-PUBLICO insert]', (e as Error)?.message)
    // Mesmo se o insert falhar, a equipe já foi notificada — não deixa a cliente na mão.
  }

  return NextResponse.json({ ok: true, protocolo: prot })
}
