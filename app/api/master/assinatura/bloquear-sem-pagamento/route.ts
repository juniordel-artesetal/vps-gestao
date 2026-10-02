// Master — BLOQUEIA quem usa o SOA sem pagamento ativo em lugar nenhum e manda o aviso com o link para
// escolher o plano (mensal ou anual). Caso típico: conta de origem Hotmart cuja assinatura foi cancelada
// lá, mas o cancelamento nunca chegou ao SOA (a régua não olha origem Hotmart → acesso grátis).
//
// Ordem, e só se for seguro:
//   1) GUARDAS: sem liberação manual; nenhuma assinatura viva no Asaas; Hotmart consultada AO VIVO
//      (statusSoaPorEmail, produto SOA) para cada e-mail da conta — ATIVA ou ATRASO (pode pagar) →
//      NÃO bloqueia; erro/sem credencial → NÃO bloqueia (na dúvida, preserva).
//   2) BLOQUEIO: entra na máquina do Asaas como CORTADA (sem acesso; dados preservados) — a tela
//      /assinatura passa a mostrar a reativação. Auditoria em "ReconciliacaoTrial".
//   3) E-MAIL (uma vez) com o link pré-identificado /assinatura?e=&t= (sem login): mensal ou anual,
//      cartão (anual parcela) ou Pix — preço vigente do dia.
// dryRun padrão (mostra o que faria). Auth: x-master-token ou cookie master_token.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { statusSoaPorEmail } from '@/lib/hotmart'
import { tokenMigrar } from '@/lib/campanha/emails'
import { baseUrlDeHeaders } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TIPO_EMAIL = 'BLOQUEIO_SEM_PAGAMENTO'
const UMA_VEZ = '1970-01-01'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const workspaceId = String(b?.workspaceId || '').trim()
  const dryRun = b?.dryRun !== false
  if (!workspaceId) return NextResponse.json({ error: 'Informe workspaceId' }, { status: 400 })

  const [w] = await prisma.$queryRaw`
    SELECT w."id", w."nome", w."assinaturaStatus", w."assinaturaOrigem", w."ativo", w."liberacaoManual", w."hotmartEmail"
    FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
  ` as { id: string; nome: string; assinaturaStatus: string | null; assinaturaOrigem: string | null; ativo: boolean; liberacaoManual: boolean; hotmartEmail: string | null }[]
  if (!w) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })
  const [admin] = await prisma.$queryRaw`
    SELECT lower("email") AS email, "nome" FROM "User" WHERE "workspaceId" = ${w.id}
    ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC LIMIT 1
  ` as { email: string; nome: string }[]
  if (!admin?.email) return NextResponse.json({ error: 'Conta sem e-mail de acesso' }, { status: 404 })

  // 1) Guardas
  if (w.liberacaoManual) return NextResponse.json({ error: 'Liberação manual do Master ativa — não bloqueio.' }, { status: 409 })
  const vivas = await prisma.$queryRaw`
    SELECT "subscriptionId" FROM "AsaasAssinatura" WHERE "workspaceId" = ${w.id} AND "status" NOT IN ('CANCELADA','CANCELLED')
  ` as { subscriptionId: string }[]
  if (vivas.length) return NextResponse.json({ error: 'Há assinatura viva no Asaas — verifique antes de bloquear.', vivas }, { status: 409 })
  const emails = await prisma.$queryRaw`SELECT DISTINCT lower("email") AS email FROM "User" WHERE "workspaceId" = ${w.id} AND "email" IS NOT NULL` as { email: string }[]
  const todos = [...new Set([w.hotmartEmail?.toLowerCase(), ...emails.map(e => e.email)].filter(Boolean) as string[])]
  const hotmart: Record<string, string> = {}
  for (const e of todos) hotmart[e] = await statusSoaPorEmail(e)
  const sts = Object.values(hotmart)
  if (sts.includes('ATIVA') || sts.includes('ATRASO')) return NextResponse.json({ error: 'Hotmart ATIVA/em atraso — não é caso de bloqueio.', hotmart }, { status: 409 })
  if (sts.includes('ERRO') || sts.includes('SEM_CRED')) return NextResponse.json({ error: 'Hotmart não confirmou — na dúvida não bloqueio.', hotmart }, { status: 503 })

  const link = `${baseUrlDeHeaders(req.headers)}/assinatura?e=${encodeURIComponent(admin.email)}&t=${tokenMigrar(admin.email)}`
  const plano = { workspaceId: w.id, nome: w.nome, de: { status: w.assinaturaStatus, origem: w.assinaturaOrigem, ativo: w.ativo }, para: { status: 'CORTADA', origem: 'asaas', ativo: false }, hotmart, email: admin.email, link }
  if (dryRun) return NextResponse.json({ dryRun: true, ...plano })

  // 2) Bloqueio + auditoria
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "assinaturaStatus" = 'CORTADA', "assinaturaOrigem" = 'asaas', "ativo" = false, "updatedAt" = NOW()
    WHERE "id" = ${w.id} AND "liberacaoManual" = false
  `
  await prisma.$executeRaw`
    INSERT INTO "ReconciliacaoTrial" ("id","workspaceId","email","deStatus","paraStatus","origem","sinal","motivo")
    VALUES (${gid()}, ${w.id}, ${admin.email}, ${w.assinaturaStatus}, 'CORTADA', ${w.assinaturaOrigem}, 'bloqueio-sem-pagamento',
            ${`sem pagamento ativo: Asaas nenhum; Hotmart ${JSON.stringify(hotmart)}`.slice(0, 300)})
    ON CONFLICT ("workspaceId","paraStatus") DO NOTHING
  `.catch(e => console.error('[MASTER/bloquear-sem-pagamento] auditoria:', (e as Error)?.message))

  // 3) Aviso com o link (uma vez)
  const marcado = await prisma.$queryRaw`
    INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
    VALUES (${gid()}, ${w.id}, ${TIPO_EMAIL}, ${UMA_VEZ}::date, NOW())
    ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"
  ` as { id: string }[]
  let email = 'já enviado antes'
  if (marcado.length) {
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY ausente — bloqueado, e-mail NÃO enviado', ...plano }, { status: 503 })
    const p1 = (admin.nome || '').trim().split(/\s+/)[0] || ''
    const nome = p1 ? esc(p1.charAt(0).toUpperCase() + p1.slice(1).toLowerCase()) : ''
    const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#334155;line-height:1.55">
      <p>Oi${nome ? `, ${nome}` : ''}! 💛</p>
      <p>Sua assinatura do SOA não está mais ativa e, por isso, <strong>pausamos o seu acesso</strong>.</p>
      <p><strong>Está tudo salvo</strong> — seus pedidos, clientes e cálculos continuam aqui, do jeitinho que você deixou.</p>
      <p>Para voltar, é só escolher o seu plano — <strong>mensal ou anual</strong> (o anual dá pra parcelar no cartão) — por este link, sem precisar fazer login:</p>
      <p><a href="${link}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px">Escolher meu plano</a></p>
      <p>Qualquer dúvida, é só responder este e-mail. 🧡</p>
      <p style="color:#64748b">Equipe SOA · Naty Costa</p></div>`
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [admin.email], subject: 'Seu acesso ao SOA foi pausado — escolha seu plano para voltar 💛', html }),
    })
    if (!r.ok) {
      await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "workspaceId" = ${w.id} AND "tipo" = ${TIPO_EMAIL}`
      return NextResponse.json({ error: `Resend ${r.status} — bloqueado, e-mail NÃO enviado`, ...plano }, { status: 502 })
    }
    email = 'enviado'
  }
  console.log(`[MASTER/bloquear-sem-pagamento] ws=${w.id} → CORTADA, e-mail ${email}`)
  return NextResponse.json({ ok: true, ...plano, emailStatus: email })
}
