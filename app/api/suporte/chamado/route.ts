import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarProtocolo(): string {
  const agora  = new Date()
  const data   = agora.toISOString().slice(0, 10).replace(/-/g, '')
  const sufixo = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `VPS-${data}-${sufixo}`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { descricao, respostaIA } = await req.json()

  if (!descricao?.trim()) {
    return NextResponse.json({ error: 'Descreva o problema' }, { status: 400 })
  }

  const protocolo     = gerarProtocolo()
  const workspaceId   = session.user.workspaceId
  const usuarioNome   = session.user.name ?? 'Usuária'
  const email         = session.user.email ?? ''
  const workspaceNome = session.user.workspaceNome ?? workspaceId
  const id            = Math.random().toString(36).slice(2) + Date.now().toString(36)

  let emailEnviado    = false
  let telegramEnviado = false

  // ── 1. Enviar e-mail via Resend
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VPS Gestão Suporte <suporte@vpsgestao.com.br>',
        to: [process.env.SUPORTE_EMAIL!],
        reply_to: email,
        subject: `[${protocolo}] Chamado aberto — ${workspaceNome}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#f97316">Novo Chamado de Suporte</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>Protocolo:</strong></td><td style="font-size:14px">${protocolo}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>Usuária:</strong></td><td style="font-size:14px">${usuarioNome}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>E-mail:</strong></td><td style="font-size:14px">${email}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>Workspace:</strong></td><td style="font-size:14px">${workspaceNome}</td></tr>
            </table>
            <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
            <h3 style="color:#333;font-size:15px">Descrição do problema:</h3>
            <p style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:14px;color:#333">${descricao}</p>
            ${respostaIA ? `
              <h3 style="color:#333;font-size:15px">Última resposta da IA antes de escalar:</h3>
              <p style="background:#fff8f0;padding:12px;border-radius:8px;font-size:13px;color:#555;border-left:3px solid #f97316">${respostaIA}</p>
            ` : ''}
            <p style="margin-top:20px;font-size:12px;color:#999">Responda diretamente a este e-mail — vai para ${email}</p>
          </div>
        `,
      }),
    })
    emailEnviado = emailRes.ok
  } catch (err) {
    console.error('[SUPORTE] Erro ao enviar e-mail:', err)
  }

  // ── 2. Enviar mensagem no Telegram
  try {
    const texto = [
      `🆘 <b>Novo Chamado — VPS Gestão</b>`,
      ``,
      `📋 <b>Protocolo:</b> ${protocolo}`,
      `👤 <b>Usuária:</b> ${usuarioNome}`,
      `📧 <b>E-mail:</b> ${email}`,
      `🏪 <b>Workspace:</b> ${workspaceNome}`,
      ``,
      `📝 <b>Problema:</b>`,
      descricao,
      respostaIA ? `\n🤖 <b>IA respondeu:</b>\n${respostaIA.slice(0, 300)}...` : '',
    ].filter(Boolean).join('\n')

    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: texto,
          parse_mode: 'HTML',
        }),
      }
    )
    telegramEnviado = tgRes.ok
  } catch (err) {
    console.error('[SUPORTE] Erro ao enviar Telegram:', err)
  }

  // ── 3. Salvar chamado no banco
  await prisma.$executeRaw`
    INSERT INTO "SuporteChamado" (
      "id","workspaceId","usuarioNome","email","descricao",
      "respostaIA","protocolo","status","emailEnviado","telegramEnviado","createdAt"
    ) VALUES (
      ${id}, ${workspaceId}, ${usuarioNome}, ${email}, ${descricao},
      ${respostaIA ?? null}, ${protocolo}, 'ABERTO', ${emailEnviado}, ${telegramEnviado}, NOW()
    )
  `

  return NextResponse.json({ ok: true, protocolo, emailEnviado, telegramEnviado })
}
