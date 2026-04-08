import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

function verificarMasterToken(req: NextRequest): boolean {
  const token = req.headers.get('x-master-token') || ''
  return token === process.env.MASTER_SECRET_TOKEN
}

// GET — listar feedbacks (master)
export async function GET(req: NextRequest) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tipo   = searchParams.get('tipo')   || ''
  const status = searchParams.get('status') || ''

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        sf.id, sf."workspaceId", sf."usuarioNome" AS "userNome", sf.email,
        sf.tipo, sf.titulo, sf.descricao,
        sf."notaInterna", sf.status, sf."createdAt",
        (sf.imagem IS NOT NULL AND sf.imagem != '') AS "temImagem",
        w.nome AS "workspaceNome"
      FROM "SuporteFeedback" sf
      LEFT JOIN "Workspace" w ON w.id = sf."workspaceId"
      WHERE
        (${tipo}   = '' OR sf.tipo   = ${tipo})
        AND (${status} = '' OR sf.status = ${status})
      ORDER BY sf."createdAt" DESC
      LIMIT 200
    ` as any[]

    return NextResponse.json(serialize(rows))
  } catch (err: any) {
    console.error('[GET /api/feedback]', err)
    return NextResponse.json([])
  }
}

// POST — enviar feedback (usuária logada)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { tipo, titulo, descricao, imagemBase64 } = await req.json()

  if (!tipo || !titulo?.trim() || !descricao?.trim())
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })

  const workspaceId   = session.user.workspaceId
  const usuarioNome   = session.user.name ?? 'Usuária'
  const email         = session.user.email ?? ''
  const workspaceNome = session.user.workspaceNome ?? workspaceId
  const id            = gerarId()

  // ── Salvar no banco com status ABERTO (não NOVO)
  try {
    await prisma.$executeRaw`
      INSERT INTO "SuporteFeedback" (
        "id","workspaceId","usuarioNome","email","tipo","titulo","descricao","imagem","status","createdAt"
      ) VALUES (
        ${id}, ${workspaceId}, ${usuarioNome}, ${email}, ${tipo},
        ${titulo.trim()}, ${descricao.trim()}, ${imagemBase64 ?? null}, 'ABERTO', NOW()
      )
    `
  } catch (err: any) {
    console.error('[feedback POST] Banco:', err?.message)
    return NextResponse.json({ error: 'Erro ao salvar feedback' }, { status: 500 })
  }

  // ── Notificar via Telegram
  try {
    const emoji = tipo === 'BUG' ? '🐛' : tipo === 'MELHORIA' ? '✨' : '💡'
    const texto = [
      `${emoji} <b>Novo Feedback — VPS Gestão</b>`,
      ``,
      `<b>Tipo:</b> ${tipo}`,
      `<b>Título:</b> ${titulo}`,
      `<b>Usuária:</b> ${usuarioNome} (${workspaceNome})`,
      `<b>E-mail:</b> ${email}`,
      ``,
      `<b>Descrição:</b>`,
      descricao.slice(0, 500),
    ].join('\n')

    await fetch(
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
  } catch (err) {
    console.error('[feedback] Telegram:', err)
  }

  // ── Notificar via E-mail (Resend)
  try {
    const emoji = tipo === 'BUG' ? '🐛' : tipo === 'MELHORIA' ? '✨' : '💡'
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VPS Gestão <suporte@vps-gestao.com.br>',
        to: [process.env.SUPORTE_EMAIL!],
        reply_to: email,
        subject: `${emoji} Novo Feedback — ${titulo} (${workspaceNome})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#f97316">${emoji} Novo Feedback — VPS Gestão</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>Tipo:</strong></td><td style="font-size:14px">${tipo}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>Título:</strong></td><td style="font-size:14px">${titulo}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>Usuária:</strong></td><td style="font-size:14px">${usuarioNome}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>Workspace:</strong></td><td style="font-size:14px">${workspaceNome}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:14px"><strong>E-mail:</strong></td><td style="font-size:14px">${email}</td></tr>
            </table>
            <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
            <h3 style="color:#333;font-size:15px">Descrição:</h3>
            <p style="background:#f9f9f9;padding:12px;border-radius:8px;font-size:14px;color:#333;white-space:pre-wrap">${descricao}</p>
            ${imagemBase64 ? `
              <h3 style="color:#333;font-size:15px">Print anexado:</h3>
              <img src="${imagemBase64}" style="max-width:100%;border-radius:8px;border:1px solid #eee" />
            ` : ''}
            <p style="margin-top:20px;font-size:12px;color:#999">Responda diretamente a este e-mail para entrar em contato com a usuária.</p>
          </div>
        `,
      }),
    })
  } catch (err) {
    console.error('[feedback] Email:', err)
  }

  return NextResponse.json({ ok: true })
}
