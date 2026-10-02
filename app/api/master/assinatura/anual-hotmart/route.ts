// Master — leva uma assinante para o ANUAL PELA HOTMART (que parcela) quando o anual no Asaas não serviu.
// Faz, nesta ordem e só se for seguro:
//   1) GUARDAS anti-cobrança-dupla: recusa se houver assinatura VIVA no Asaas (cancele antes) ou
//      pagamento Asaas não estornado nos últimos 60 dias.
//   2) CARÊNCIA: TRIAL com fim HOJE → acesso por mais DIAS_CARENCIA dias (avaliar); sem pagamento a
//      régua corta depois (com a trava Hotmart ao vivo antes). planoEscolhido = NULL (o anual do Asaas
//      foi abandonado; a régua nunca corta "anual"). Os lembretes genéricos (que levam ao Asaas)
//      TRIAL_POS_D3/D6 são suprimidos — o caminho dela agora é a Hotmart.
//   3) E-MAIL com o link do anual da Hotmart (e-mail pré-preenchido p/ o webhook casar a compra).
// Quando a compra Hotmart (produto SOA) chega, o webhook Hotmart marca ATIVA. Idempotente; dryRun padrão.
// Auth: header x-master-token ou cookie master_token (= MASTER_SECRET_TOKEN).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { DIAS_CARENCIA } from '@/lib/assinatura'

export const dynamic = 'force-dynamic'

/** Oferta ANUAL do SOA na Hotmart (a mesma da landing) — parcela no cartão. */
const HOTMART_ANUAL = 'https://pay.hotmart.com/C105122525T?off=wjn1po68'
const TIPO_EMAIL = 'ANUAL_HOTMART_LINK'
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
    SELECT w."id", w."assinaturaStatus", w."assinaturaOrigem", u."email", u."nome"
    FROM "Workspace" w JOIN "User" u ON u."workspaceId" = w."id" AND u."role" = 'ADMIN'
    WHERE w."id" = ${workspaceId} ORDER BY u."createdAt" LIMIT 1
  ` as { id: string; assinaturaStatus: string; assinaturaOrigem: string | null; email: string; nome: string }[]
  if (!w?.email) return NextResponse.json({ error: 'Workspace/admin não encontrado' }, { status: 404 })

  // 1) Guardas anti-cobrança-dupla
  const vivas = await prisma.$queryRaw`
    SELECT "subscriptionId" FROM "AsaasAssinatura" WHERE "workspaceId" = ${w.id} AND "status" NOT IN ('CANCELADA','CANCELLED')
  ` as { subscriptionId: string }[]
  if (vivas.length) return NextResponse.json({ error: 'Ainda há assinatura VIVA no Asaas — cancele antes (cobrança dupla).', vivas }, { status: 409 })
  const pagas = await prisma.$queryRaw`
    SELECT "paymentId" FROM "AsaasCobranca"
    WHERE ("workspaceId" = ${w.id} OR "subscriptionId" IN (SELECT "subscriptionId" FROM "AsaasAssinatura" WHERE "workspaceId" = ${w.id}))
      AND "status" IN ('RECEIVED','CONFIRMED') AND "createdAt" > NOW() - INTERVAL '60 days'
  ` as { paymentId: string }[]
  if (pagas.length) return NextResponse.json({ error: 'Há pagamento Asaas não estornado — avaliar com o Júnior antes.', pagas }, { status: 409 })

  const primeiro = (w.nome || '').trim().split(/\s+/)[0] || ''
  const nome = primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : ''
  const link = `${HOTMART_ANUAL}&email=${encodeURIComponent(w.email)}${w.nome ? `&name=${encodeURIComponent(w.nome)}` : ''}`
  const plano = { workspaceId: w.id, email: w.email, link, acessoAte: `hoje + ${DIAS_CARENCIA} dias`, de: w.assinaturaStatus }
  if (dryRun) return NextResponse.json({ dryRun: true, ...plano })

  // 2) Carência (TRIAL termina hoje → acesso por mais DIAS_CARENCIA dias) + supressão dos lembretes do Asaas
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "assinaturaStatus" = 'TRIAL', "trialAte" = CURRENT_DATE, "ativo" = true,
      "planoEscolhido" = NULL, "assinaturaOrigem" = 'asaas', "updatedAt" = NOW()
    WHERE "id" = ${w.id} AND "liberacaoManual" = false
  `
  for (const [tipo, dias] of [['TRIAL_POS_D3', 3], ['TRIAL_POS_D6', 6]] as const) {
    await prisma.$executeRaw`
      INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
      VALUES (${gid()}, ${w.id}, ${tipo}, CURRENT_DATE + ${dias}::int, NOW())
      ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING
    `
  }

  // 3) E-mail (uma vez)
  const marcado = await prisma.$queryRaw`
    INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
    VALUES (${gid()}, ${w.id}, ${TIPO_EMAIL}, ${UMA_VEZ}::date, NOW())
    ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"
  ` as { id: string }[]
  let email = 'já enviado antes'
  if (marcado.length) {
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY ausente', ...plano }, { status: 503 })
    const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#334155;line-height:1.55">
      <p>Oi${nome ? `, ${esc(nome)}` : ''}! 💛</p>
      <p>Vi que o parcelamento do anual não rolou por aí — desculpa o transtorno! Pra facilitar, te mando o link do <strong>plano anual pela Hotmart</strong>, onde você consegue <strong>parcelar</strong> certinho:</p>
      <p><a href="${link}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px">👉 Assinar o anual pela Hotmart</a></p>
      <p>Já deixei seu acesso liberado pra você não parar enquanto conclui o pagamento. Qualquer dúvida, é só responder aqui. A gente adora ter você com a gente! 🧡</p>
      <p style="color:#64748b">Equipe SOA · Naty Costa</p></div>`
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [w.email], subject: 'Seu plano anual do SOA — agora dá pra parcelar 💛', html }),
    })
    if (!r.ok) {
      await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "workspaceId" = ${w.id} AND "tipo" = ${TIPO_EMAIL}`
      return NextResponse.json({ error: `Resend ${r.status} — carência aplicada, e-mail NÃO enviado`, ...plano }, { status: 502 })
    }
    email = 'enviado'
  }
  console.log(`[MASTER/anual-hotmart] ws=${w.id} carência aplicada (TRIAL até hoje+${DIAS_CARENCIA}d de acesso), e-mail ${email}`)
  return NextResponse.json({ ok: true, ...plano, email })
}
