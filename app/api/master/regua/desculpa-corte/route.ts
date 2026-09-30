// Master — e-mail de TRANQUILIZAÇÃO para quem foi cortada por engano em 30/09/2026 (o freio da régua
// falhou por ~20 min). Só para os workspaceIds informados; UMA vez por conta (trava em AssinaturaAviso,
// tipo DESCULPA_CORTE_3009). `dryRun: true` lista para quem iria, sem enviar.
// Auth: header x-master-token ou cookie master_token (= MASTER_SECRET_TOKEN).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TIPO = 'DESCULPA_CORTE_3009'
const UMA_VEZ = '1970-01-01'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(b.workspaceIds) ? b.workspaceIds.map(String).slice(0, 60) : []
  const dryRun = b.dryRun !== false
  if (!ids.length) return NextResponse.json({ error: 'Informe workspaceIds' }, { status: 400 })
  if (!dryRun && !process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY ausente' }, { status: 503 })

  const resultado: { workspaceId: string; enviado: boolean; motivo?: string }[] = []
  for (const id of ids) {
    const [d] = await prisma.$queryRaw`
      SELECT u."email", u."nome", w."assinaturaStatus"
      FROM "Workspace" w JOIN "User" u ON u."workspaceId" = w."id" AND u."role" = 'ADMIN'
      WHERE w."id" = ${id} ORDER BY u."createdAt" LIMIT 1
    ` as { email: string | null; nome: string | null; assinaturaStatus: string }[]
    if (!d?.email) { resultado.push({ workspaceId: id, enviado: false, motivo: 'sem e-mail' }); continue }
    if (d.assinaturaStatus === 'CORTADA') { resultado.push({ workspaceId: id, enviado: false, motivo: 'está CORTADA — o e-mail diria o contrário' }); continue }
    if (dryRun) { resultado.push({ workspaceId: id, enviado: false, motivo: 'dryRun' }); continue }
    const marcado = await prisma.$queryRaw`
      INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
      VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${id}, ${TIPO}, ${UMA_VEZ}::date, NOW())
      ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"
    ` as { id: string }[]
    if (!marcado.length) { resultado.push({ workspaceId: id, enviado: false, motivo: 'já enviado' }); continue }
    const nome = esc((d.nome || '').trim().split(/\s+/)[0] || '')
    const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#334155;line-height:1.55">
      <p>Oi${nome ? `, ${nome}` : ''}! 💛</p>
      <p>Hoje fizemos um ajuste no sistema e, por alguns minutos, seu acesso ao SOA pode ter ficado indisponível — <strong>já está tudo normalizado</strong>.</p>
      <p>Se você recebeu um aviso de bloqueio, pode desconsiderar: <strong>sua conta está ativa</strong>.</p>
      <p>Desculpa o susto e qualquer coisa é só responder aqui. 🧡</p>
      <p style="color:#64748b">Equipe SOA · Naty Costa</p></div>`
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [d.email], subject: 'Tudo certo com seu acesso 💛', html }),
    })
    if (!r.ok) {
      // libera a trava para poder reenviar depois
      await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "workspaceId" = ${id} AND "tipo" = ${TIPO}`
      resultado.push({ workspaceId: id, enviado: false, motivo: `Resend ${r.status}` }); continue
    }
    resultado.push({ workspaceId: id, enviado: true })
  }
  console.log(`[MASTER/desculpa-corte] ${dryRun ? '(dryRun) ' : ''}enviados=${resultado.filter(x => x.enviado).length}/${ids.length}`)
  return NextResponse.json({ dryRun, enviados: resultado.filter(x => x.enviado).length, resultado })
}
