// app/api/master/feedback/[id]/route.ts
// Endpoint master para responder feedback por email + atualizar status
// Espelha exatamente o padrão de app/api/master/chamados/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// POST — responder feedback por e-mail + atualizar status
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster())
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { mensagem } = await req.json()

  if (!mensagem?.trim())
    return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  // Buscar feedback
  const [feedback] = await prisma.$queryRaw`
    SELECT sf.*, w."nome" AS "workspaceNome"
    FROM "SuporteFeedback" sf
    LEFT JOIN "Workspace" w ON w."id" = sf."workspaceId"
    WHERE sf."id" = ${id}
  ` as any[]

  if (!feedback)
    return NextResponse.json({ error: 'Feedback não encontrado' }, { status: 404 })

  if (!feedback.email)
    return NextResponse.json({ error: 'Feedback sem e-mail cadastrado' }, { status: 400 })

  const tipoLabel = ({
    BUG: 'Bug',
    MELHORIA: 'Melhoria',
    SUGESTAO: 'Sugestão',
  } as Record<string, string>)[feedback.tipo] || 'Feedback'

  // Enviar e-mail de resposta via Resend
  let emailEnviado = false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SOA Suporte <suporte@vps-gestao.com.br>',
        to: [feedback.email],
        subject: `Re: [${feedback.protocolo || 'Feedback'}] Resposta da Equipe SOA`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#f97316;padding:20px 24px;border-radius:12px 12px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">Resposta da Equipe SOA</h2>
            </div>
            <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
              <p style="color:#555;font-size:14px;margin:0 0 8px">Olá, <strong>${feedback.usuarioNome}</strong>!</p>
              <p style="color:#555;font-size:13px;margin:0 0 20px">
                Sobre seu feedback <strong>${tipoLabel}</strong>${feedback.protocolo ? ` (protocolo <strong>${feedback.protocolo}</strong>)` : ''}:
              </p>
              <div style="background:#f9f9f9;border-left:4px solid #f97316;padding:16px;border-radius:0 8px 8px 0;margin-bottom:20px">
                <p style="color:#333;font-size:14px;margin:0;white-space:pre-wrap">${mensagem}</p>
              </div>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
              <p style="color:#999;font-size:12px;margin:0">
                Seu feedback original:<br/>
                <em style="color:#bbb">${feedback.titulo}<br/>${feedback.descricao}</em>
              </p>
              <p style="color:#999;font-size:12px;margin-top:16px">
                Obrigado por nos ajudar a melhorar o SOA!<br/>
                Acesse a <a href="https://www.usesoa.com.br/suporte" style="color:#f97316">Central de Suporte</a> a qualquer momento.
              </p>
            </div>
          </div>
        `,
      }),
    })
    emailEnviado = res.ok
    if (!res.ok) console.error('[feedback reply] Resend error:', await res.text())
  } catch (err) {
    console.error('[feedback reply] Email error:', err)
  }

  // Atualizar status e registrar resposta
  await prisma.$executeRaw`
    UPDATE "SuporteFeedback"
    SET
      "status"       = CASE WHEN "status" = 'ABERTO' THEN 'EM_ANALISE' ELSE "status" END,
      "notaInterna"  = COALESCE("notaInterna", '') || ${'\n\n[Resposta enviada]: ' + mensagem},
      "respondidoEm" = NOW()
    WHERE "id" = ${id}
  `

  return NextResponse.json({ ok: true, emailEnviado })
}

// PUT — atualizar status ou nota interna
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster())
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { status, notaInterna, prioridade, responsavelNome, etiquetas } = await req.json()

  if (status) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "status" = ${status} WHERE "id" = ${id}
    `
  }
  if (notaInterna !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "notaInterna" = ${notaInterna} WHERE "id" = ${id}
    `
  }
  if (prioridade !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "prioridade" = ${prioridade || 'normal'} WHERE "id" = ${id}
    `
  }
  if (responsavelNome !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "responsavelNome" = ${responsavelNome || null} WHERE "id" = ${id}
    `
  }
  if (etiquetas !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "etiquetas" = ${etiquetas || null} WHERE "id" = ${id}
    `
  }

  return NextResponse.json({ ok: true })
}
