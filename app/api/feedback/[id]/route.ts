// app/api/feedback/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  return req.headers.get('x-master-token') === process.env.MASTER_SECRET_TOKEN
}

// GET — detalhe completo com imagem
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const rows = await prisma.$queryRaw`
    SELECT
      sf.*,
      w.nome AS "workspaceNome"
    FROM "SuporteFeedback" sf
    LEFT JOIN "Workspace" w ON w.id = sf."workspaceId"
    WHERE sf.id = ${id}
  ` as any[]

  if (!rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Renomeia campos para o frontend
  const fb = rows[0]
  return NextResponse.json(serialize({
    ...fb,
    userNome:      fb.usuarioNome,
    imagemBase64:  fb.imagem || null,
    temImagem:     !!(fb.imagem),
  }))
}

// PUT — atualiza status e/ou nota interna + envia email ao concluir
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id }  = await params
  const body    = await req.json()
  const status  = body.status      as string | undefined
  const nota    = body.notaInterna as string | undefined

  if (status !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "status" = ${status} WHERE id = ${id}
    `
  }
  if (nota !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "notaInterna" = ${nota} WHERE id = ${id}
    `
  }

  // ── Envia email para a usuária ao concluir com nota interna preenchida
  if (status === 'CONCLUIDO' && nota?.trim()) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT sf.email, sf."usuarioNome", sf.titulo, sf.tipo,
               w.nome AS "workspaceNome"
        FROM "SuporteFeedback" sf
        LEFT JOIN "Workspace" w ON w.id = sf."workspaceId"
        WHERE sf.id = ${id}
      ` as any[]

      if (rows.length && rows[0].email) {
        const fb    = rows[0]
        const emoji = fb.tipo === 'BUG' ? '🐛' : fb.tipo === 'MELHORIA' ? '✨' : '💡'

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'VPS Gestão <suporte@vps-gestao.com.br>',
            to: [fb.email],
            subject: `${emoji} Seu feedback foi resolvido — ${fb.titulo}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#f97316;padding:24px;border-radius:12px 12px 0 0;text-align:center">
                  <h1 style="color:white;margin:0;font-size:20px">✅ Feedback Resolvido!</h1>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
                  <p style="color:#333;font-size:15px">Olá, <strong>${fb.usuarioNome}</strong>! 👋</p>
                  <p style="color:#555;font-size:14px">Seu feedback sobre <strong>"${fb.titulo}"</strong> foi analisado e resolvido pela nossa equipe.</p>
                  <div style="background:#fff8f0;border-left:4px solid #f97316;padding:16px;border-radius:8px;margin:20px 0">
                    <p style="color:#666;font-size:12px;margin:0 0 8px;font-weight:600;text-transform:uppercase">Retorno da equipe VPS:</p>
                    <p style="color:#333;font-size:14px;margin:0;white-space:pre-wrap">${nota}</p>
                  </div>
                  <p style="color:#555;font-size:14px">Caso ainda tenha dúvidas, é só nos chamar pelo suporte!</p>
                  <p style="color:#999;font-size:12px;margin-top:24px">Equipe VPS Gestão • suporte@vps-gestao.com.br</p>
                </div>
              </div>
            `,
          }),
        })
      }
    } catch (err) {
      console.error('[feedback PUT] Email:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
