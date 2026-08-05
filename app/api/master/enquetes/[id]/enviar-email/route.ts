// Master — (opcional) convida por E-MAIL o público-alvo da enquete a responder.
// GET  = dry-run (quantas destinatárias + amostra). POST = envia via Resend.
// Respeita opt-out (quem saiu da campanha) e não manda pra quem já respondeu.
// Não é resposta por e-mail: leva pro sistema, onde o pop-up coleta a resposta.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ensureEnquetesSchema } from '@/lib/enquetes'
import { ensureUsoLogSchema } from '@/lib/usoLog'

export const dynamic = 'force-dynamic'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const LINK = 'https://www.usesoa.com.br/dashboard'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

async function destinatarias(id: string): Promise<{ email: string; nome: string | null }[]> {
  await ensureEnquetesSchema(); await ensureUsoLogSchema()
  return await prisma.$queryRaw`
    WITH cand AS (
      SELECT w."id",
        (SELECT u."nome"  FROM "User" u WHERE u."workspaceId"=w."id" AND u."ativo"=true ORDER BY (u."role"='ADMIN') DESC, u."createdAt" ASC LIMIT 1) AS "nome",
        (SELECT lower(u."email") FROM "User" u WHERE u."workspaceId"=w."id" AND u."ativo"=true ORDER BY (u."role"='ADMIN') DESC, u."createdAt" ASC LIMIT 1) AS "email",
        COALESCE(w."plano",'FREE') AS "plano",
        EXISTS(SELECT 1 FROM "LoginHistory" lh WHERE lh."workspaceId"=w."id" AND lh."sucesso"=true AND lh."createdAt" >= NOW()-INTERVAL '30 days') AS "ativa",
        (SELECT ul."modulo" FROM "UsoLog" ul WHERE ul."workspaceId"=w."id" GROUP BY ul."modulo" ORDER BY SUM(ul."acessos") DESC LIMIT 1) AS "moduloTop"
      FROM "Workspace" w WHERE w."ativo"=true
    )
    SELECT c."email", c."nome"
    FROM cand c, "Enquete" e
    WHERE e."id" = ${id} AND c."email" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "EnqueteResposta" r WHERE r."enqueteId"=e."id" AND r."workspaceId"=c."id")
      AND (e."publico"='todas' OR (e."publico"='ativas' AND c."ativa") OR (e."publico"='inativas' AND NOT c."ativa"))
      AND (e."planos" IS NULL OR c."plano" = ANY(string_to_array(e."planos", ',')))
      AND (e."modulo" IS NULL OR e."modulo" = c."moduloTop")
      AND NOT EXISTS (SELECT 1 FROM "CampanhaMigracao" cm WHERE lower(cm."email")=c."email" AND cm."optoutEm" IS NOT NULL)
  ` as { email: string; nome: string | null }[]
}

function corpo(nome: string | null, titulo: string) {
  const ola = nome ? `Oi, ${String(nome).split(' ')[0]}!` : 'Oi!'
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${ola} 💛</p>
    <p>A gente tá querendo deixar o <b>SOA</b> cada vez mais a sua cara — e sua opinião conta muito nisso.</p>
    <p>Preparamos uma pesquisa rapidinha: <b>${titulo}</b>. É só entrar no sistema que ela aparece pra você responder em segundos.</p>
    <p style="text-align:center;margin:24px 0"><a href="${LINK}" style="background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Responder no SOA</a></p>
    <p style="color:#6b7280;font-size:13px">Se não quiser responder agora, sem problema — é rapidinho e opcional. Se preferir não receber estes convites, é só responder este e-mail. 💛</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:18px">Equipe SOA · suporte@vps-gestao.com.br</p>
  </div>`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const alvo = await destinatarias(id)
  const mascara = (e: string) => e.replace(/^(.).*(.@.*)$/, '$1***$2')
  return NextResponse.json({ previa: true, total: alvo.length, amostra: alvo.slice(0, 10).map(a => mascara(a.email)) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY ausente.' }, { status: 503 })
  const { id } = await params

  const [enq] = await prisma.$queryRaw`SELECT "titulo","ativo","canalEmail" FROM "Enquete" WHERE "id"=${id}` as any[]
  if (!enq) return NextResponse.json({ error: 'Enquete não encontrada' }, { status: 404 })
  if (!enq.ativo) return NextResponse.json({ error: 'Ative a enquete antes de enviar.' }, { status: 409 })

  const alvo = (await destinatarias(id)).slice(0, 500) // teto de segurança por disparo
  let enviados = 0, falhas = 0
  for (const a of alvo) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: REMETENTE, to: [a.email], subject: 'Sua opinião vale muito 💛', html: corpo(a.nome, enq.titulo) }),
      })
      if (r.ok) enviados++; else falhas++
    } catch { falhas++ }
  }
  console.log(`[ENQUETE-EMAIL] enquete=${id} enviados=${enviados} falhas=${falhas} total=${alvo.length}`)
  return NextResponse.json({ ok: true, enviados, falhas, total: alvo.length })
}
