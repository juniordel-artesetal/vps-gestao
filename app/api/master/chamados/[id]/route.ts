import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function verificarMaster(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// POST — responder chamado por e-mail + atualizar status
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster())
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { mensagem } = await req.json()

  if (!mensagem?.trim())
    return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  // Buscar chamado
  const [chamado] = await prisma.$queryRaw`
    SELECT sc.*, w."nome" AS "workspaceNome"
    FROM "SuporteChamado" sc
    LEFT JOIN "Workspace" w ON w."id" = sc."workspaceId"
    WHERE sc."id" = ${id}
  ` as any[]

  if (!chamado)
    return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

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
        from: 'VPS Gestão Suporte <suporte@vps-gestao.com.br>',
        to: [chamado.email],
        subject: `Re: [${chamado.protocolo}] Resposta do suporte VPS Gestão`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#f97316;padding:20px 24px;border-radius:12px 12px 0 0">
              <h2 style="color:#fff;margin:0;font-size:18px">Resposta do Suporte VPS Gestão</h2>
            </div>
            <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
              <p style="color:#555;font-size:14px;margin:0 0 8px">Olá, <strong>${chamado.usuarioNome}</strong>!</p>
              <p style="color:#555;font-size:13px;margin:0 0 20px">Referente ao protocolo <strong>${chamado.protocolo}</strong>:</p>
              <div style="background:#f9f9f9;border-left:4px solid #f97316;padding:16px;border-radius:0 8px 8px 0;margin-bottom:20px">
                <p style="color:#333;font-size:14px;margin:0;white-space:pre-wrap">${mensagem}</p>
              </div>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
              <p style="color:#999;font-size:12px;margin:0">
                Sua solicitação original:<br/>
                <em style="color:#bbb">${chamado.descricao}</em>
              </p>
              <p style="color:#999;font-size:12px;margin-top:16px">
                Se precisar de mais ajuda, acesse nossa 
                <a href="https://app.vps-gestao.com.br/suporte" style="color:#f97316">Central de Suporte</a>.
              </p>
            </div>
          </div>
        `,
      }),
    })
    emailEnviado = res.ok
    if (!res.ok) console.error('[chamado reply] Resend error:', await res.text())
  } catch (err) {
    console.error('[chamado reply] Email error:', err)
  }

  // Atualizar status e registrar resposta
  await prisma.$executeRaw`
    UPDATE "SuporteChamado"
    SET
      "status"       = 'EM_ATENDIMENTO',
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
  const { status, notaInterna } = await req.json()

  if (status) {
    await prisma.$executeRaw`
      UPDATE "SuporteChamado" SET "status" = ${status} WHERE "id" = ${id}
    `
  }
  if (notaInterna !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteChamado" SET "notaInterna" = ${notaInterna} WHERE "id" = ${id}
    `
  }

  return NextResponse.json({ ok: true })
}
