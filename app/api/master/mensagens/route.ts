// app/api/master/mensagens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

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

async function verificarMaster(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — mensagens de um chamado/feedback
export async function GET(req: NextRequest) {
  if (!await verificarMaster())
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const referenciaId = searchParams.get('referenciaId')
  if (!referenciaId) return NextResponse.json([])

  const msgs = await prisma.$queryRaw`
    SELECT id, tipo, "referenciaId", remetente, texto, imagem, "createdAt"
    FROM "SuporteMensagem"
    WHERE "referenciaId" = ${referenciaId}
    ORDER BY "createdAt" ASC
  ` as any[]

  return NextResponse.json(serialize(msgs))
}

// POST — suporte responde
export async function POST(req: NextRequest) {
  if (!await verificarMaster())
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { referenciaId, tipo, texto, emailUsuaria, imagem } = await req.json()
  if (!referenciaId || !tipo || !texto?.trim())
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const textoFinal = texto.trim()

  if (imagem) {
    await prisma.$executeRaw`
      INSERT INTO "SuporteMensagem" ("id","tipo","referenciaId","remetente","texto","imagem","createdAt")
      VALUES (${id}, ${tipo}, ${referenciaId}, 'SUPORTE', ${textoFinal}, ${imagem}, NOW())
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "SuporteMensagem" ("id","tipo","referenciaId","remetente","texto","createdAt")
      VALUES (${id}, ${tipo}, ${referenciaId}, 'SUPORTE', ${textoFinal}, NOW())
    `
  }

  // Atualizar status para EM_ATENDIMENTO
  if (tipo === 'CHAMADO') {
    await prisma.$executeRaw`
      UPDATE "SuporteChamado" SET "status" = 'EM_ATENDIMENTO'
      WHERE id = ${referenciaId} AND "status" = 'ABERTO'
    `
  } else {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "status" = 'EM_ANALISE'
      WHERE id = ${referenciaId} AND "status" = 'ABERTO'
    `
  }

  // Enviar email para a usuária
  if (emailUsuaria) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'VPS Gestão Suporte <suporte@vps-gestao.com.br>',
          to: [emailUsuaria],
          subject: `💬 Nova resposta do suporte VPS`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#f97316;padding:20px 24px;border-radius:12px 12px 0 0">
                <h2 style="color:white;margin:0;font-size:18px">💬 Resposta do Suporte VPS</h2>
              </div>
              <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
                <p style="color:#555;font-size:14px">Nossa equipe respondeu ao seu chamado/feedback:</p>
                <div style="background:#fff8f0;border-left:4px solid #f97316;padding:16px;border-radius:8px;margin:16px 0">
                  <p style="color:#333;font-size:14px;margin:0;white-space:pre-wrap">${texto}</p>
                </div>
                <p style="color:#555;font-size:14px">Acesse o sistema para responder ou ver o histórico completo.</p>
                <a href="https://vps-gestao.com.br/suporte" style="display:inline-block;background:#f97316;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:8px">Ver no sistema →</a>
                <p style="color:#999;font-size:12px;margin-top:24px">Equipe VPS Gestão • suporte@vps-gestao.com.br</p>
              </div>
            </div>
          `,
        }),
      })
    } catch (err) {
      console.error('[master/mensagens] Email:', err)
    }
  }

  return NextResponse.json({ ok: true, id })
}
