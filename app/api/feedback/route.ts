import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    // Tabela pode não existir ainda
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

  // Salvar no banco
  try {
    await prisma.$executeRaw`
      INSERT INTO "SuporteFeedback" (
        "id","workspaceId","usuarioNome","email","tipo","titulo","descricao","imagem","status","createdAt"
      ) VALUES (
        ${id},${workspaceId},${usuarioNome},${email},${tipo},
        ${titulo.trim()},${descricao.trim()},${imagemBase64 ?? null},'NOVO',NOW()
      )
    `
  } catch (err: any) {
    console.warn('[feedback] Banco:', err?.message)
  }

  // Notificar via Telegram
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

  return NextResponse.json({ ok: true })
}
