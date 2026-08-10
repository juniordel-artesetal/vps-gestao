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

// GET — detalhe completo com imagem, whatsapp e protocolo
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
    // whatsapp e protocolo já vêm do sf.* acima
  }))
}

// Templates de email por status
function gerarEmailPorStatus(status: string, fb: any, nota: string): { subject: string; html: string } | null {
  const emoji = fb.tipo === 'BUG' ? '🐛' : fb.tipo === 'MELHORIA' ? '✨' : '💡'
  const protocolo = fb.protocolo || ''

  const headerBase = (titulo: string, cor: string) => `
    <div style="background:${cor};padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:white;margin:0;font-size:20px">${titulo}</h1>
    </div>
  `

  const wrapper = (cor: string, titulo: string, corpo: string) => `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      ${headerBase(titulo, cor)}
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
        <p style="color:#333;font-size:15px">Olá, <strong>${fb.usuarioNome}</strong>! 👋</p>
        ${protocolo ? `<p style="color:#999;font-size:12px;margin:0 0 12px">Protocolo: <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">${protocolo}</code></p>` : ''}
        ${corpo}
        <p style="color:#999;font-size:12px;margin-top:24px">Equipe VPS Gestão • suporte@vps-gestao.com.br</p>
      </div>
    </div>
  `

  const blocoNota = nota.trim() ? `
    <div style="background:#fff8f0;border-left:4px solid #f97316;padding:16px;border-radius:8px;margin:20px 0">
      <p style="color:#666;font-size:12px;margin:0 0 8px;font-weight:600;text-transform:uppercase">Retorno da equipe VPS:</p>
      <p style="color:#333;font-size:14px;margin:0;white-space:pre-wrap">${nota}</p>
    </div>
  ` : ''

  if (status === 'IMPLEMENTADO') {
    return {
      subject: `${emoji} Seu feedback foi implementado — ${fb.titulo}`,
      html: wrapper('#10b981', '🎉 Sua sugestão virou realidade!',
        `<p style="color:#555;font-size:14px">Adivinha? Sua sugestão sobre <strong>"${fb.titulo}"</strong> foi <strong>implementada</strong> no VPS Gestão!</p>
         ${blocoNota}
         <p style="color:#555;font-size:14px">Muito obrigada por nos ajudar a melhorar! 🧡</p>`)
    }
  }

  if (status === 'REJEITADO') {
    return {
      subject: `${emoji} Sobre seu feedback — ${fb.titulo}`,
      html: wrapper('#64748b', 'Sobre seu feedback',
        `<p style="color:#555;font-size:14px">Avaliamos com cuidado seu feedback sobre <strong>"${fb.titulo}"</strong>.</p>
         <p style="color:#555;font-size:14px">No momento não vamos seguir com essa mudança, mas explicamos os motivos abaixo:</p>
         ${blocoNota}
         <p style="color:#555;font-size:14px">Continue mandando suas sugestões! Cada feedback nos ajuda a entender melhor o que vocês precisam. 💛</p>`)
    }
  }

  if (status === 'RESOLVIDO' || status === 'CONCLUIDO') {
    return {
      subject: `${emoji} Seu feedback foi resolvido — ${fb.titulo}`,
      html: wrapper('#f97316', '✅ Feedback Resolvido!',
        `<p style="color:#555;font-size:14px">Seu feedback sobre <strong>"${fb.titulo}"</strong> foi analisado e resolvido pela nossa equipe.</p>
         ${blocoNota}
         <p style="color:#555;font-size:14px">Caso ainda tenha dúvidas, é só nos chamar pelo suporte!</p>`)
    }
  }

  if (status === 'EM_ANALISE') {
    return {
      subject: `${emoji} Seu feedback está em análise — ${fb.titulo}`,
      html: wrapper('#3b82f6', '🔍 Estamos analisando!',
        `<p style="color:#555;font-size:14px">Recebemos seu feedback sobre <strong>"${fb.titulo}"</strong> e ele está em análise pela nossa equipe.</p>
         ${blocoNota}
         <p style="color:#555;font-size:14px">Em breve te damos um retorno. Obrigada pela paciência! 🧡</p>`)
    }
  }

  return null
}

// PUT — atualiza status e/ou nota interna + envia email para vários status
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verificarMasterToken(req))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id }  = await params
  const body    = await req.json()
  const status  = body.status      as string | undefined
  const nota    = body.notaInterna as string | undefined

  // Captura status anterior antes de atualizar (para evitar disparos duplicados)
  let statusAnterior: string | null = null
  if (status !== undefined) {
    const prev = await prisma.$queryRaw`
      SELECT status FROM "SuporteFeedback" WHERE id = ${id}
    ` as any[]
    statusAnterior = prev[0]?.status ?? null

    await prisma.$executeRaw`
      UPDATE "SuporteFeedback"
      SET "status" = ${status}, "respondidoEm" = NOW()
      WHERE id = ${id}
    `
  }
  if (nota !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SuporteFeedback" SET "notaInterna" = ${nota} WHERE id = ${id}
    `
  }

  // ── Envia email para qualquer status final (e só se houve mudança real)
  const STATUS_FINAIS = ['IMPLEMENTADO', 'REJEITADO', 'RESOLVIDO', 'CONCLUIDO', 'EM_ANALISE']
  if (status && statusAnterior !== status && STATUS_FINAIS.includes(status)) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT sf.email, sf."usuarioNome", sf.titulo, sf.tipo, sf.protocolo,
               w.nome AS "workspaceNome"
        FROM "SuporteFeedback" sf
        LEFT JOIN "Workspace" w ON w.id = sf."workspaceId"
        WHERE sf.id = ${id}
      ` as any[]

      if (rows.length && rows[0].email) {
        const fb       = rows[0]
        const conteudo = gerarEmailPorStatus(status, fb, nota || '')

        if (conteudo) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'VPS Gestão <suporte@vps-gestao.com.br>',
              to: [fb.email],
              subject: conteudo.subject,
              html: conteudo.html,
            }),
          })
        }
      }
    } catch (err) {
      console.error('[feedback PUT] Email:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
