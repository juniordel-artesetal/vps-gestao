import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

    // Busca usuário ativo
    const users = await prisma.$queryRaw`
      SELECT u.id, u.nome, u."workspaceId"
      FROM "User" u
      JOIN "Workspace" w ON w.id = u."workspaceId"
      WHERE u.email = ${email}
        AND u.ativo = true
        AND w.ativo = true
      LIMIT 1
    ` as any[]

    // Retorna sucesso mesmo se não encontrar — evita enumeração de e-mails
    if (!users.length) return NextResponse.json({ ok: true })

    const user    = users[0]
    const token   = crypto.randomBytes(32).toString('hex')
    const expira  = new Date(Date.now() + 60 * 60 * 1000) // 1h

    // Salva token no banco
    await prisma.$executeRaw`
      UPDATE "User"
      SET "resetToken"   = ${token},
          "resetExpires" = ${expira}
      WHERE id = ${user.id}
    `

    const baseUrl = process.env.NEXTAUTH_URL || 'https://app.vps-gestao.com.br'
    const link    = `${baseUrl}/redefinir-senha?token=${token}`

    // Envia e-mail via fetch nativo (funciona com qualquer versão do resend)
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `VPS Gestão <${process.env.SUPORTE_EMAIL}>`,
        to:      [email],
        subject: 'Redefinição de senha — VPS Gestão',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111827;color:#f9fafb;padding:32px;border-radius:16px;">
            <h2 style="font-size:18px;font-weight:600;margin:0 0 8px;">Redefinição de senha</h2>
            <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
              Olá, <strong style="color:#f9fafb;">${user.nome}</strong>! Recebemos uma solicitação para redefinir sua senha.
            </p>
            <a href="${link}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:24px;">
              Criar nova senha →
            </a>
            <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">
              Este link expira em <strong>1 hora</strong>. Se não foi você, ignore este e-mail.
            </p>
            <p style="color:#6b7280;font-size:12px;margin:0;">
              Ou copie: <span style="color:#9ca3af;">${link}</span>
            </p>
          </div>
        `,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/auth/recuperar-senha:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}