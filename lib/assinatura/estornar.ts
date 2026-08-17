// Estorno (reembolso ao cartão) do ÚLTIMO pagamento PAGO da assinatura Asaas.
// Só Asaas (Hotmart se estorna no painel da Hotmart). Auditável: grava quem/quando/qual pagamento.
// O refund NÃO cancela a assinatura — para encerrar cobranças futuras use cancelarAssinatura().
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'

export interface ResultadoEstorno {
  ok: boolean
  erro?: string
  paymentId?: string
  valor?: number
  status?: string
}

interface PagamentoAsaas {
  id: string; status: string; value: number
  paymentDate?: string | null; confirmedDate?: string | null; dueDate?: string | null
  billingType?: string
}

// Status que contam como "pago" e são estornáveis (cartão confirmado/recebido).
const PAGOS = new Set(['RECEIVED', 'CONFIRMED'])

let auditOk = false
async function garantirAuditoria() {
  if (auditOk) return
  await prisma.$executeRawUnsafe(`ALTER TABLE "AsaasAssinatura" ADD COLUMN IF NOT EXISTS "estornoPagamentoId" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "AsaasAssinatura" ADD COLUMN IF NOT EXISTS "estornoEm" timestamptz`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "AsaasAssinatura" ADD COLUMN IF NOT EXISTS "estornoPor" text`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "AsaasAssinatura" ADD COLUMN IF NOT EXISTS "estornoValor" numeric(12,2)`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "AsaasAssinatura" ADD COLUMN IF NOT EXISTS "estornoMotivo" text`)
  auditOk = true
}

/**
 * Estorna o último pagamento PAGO da assinatura vigente de uma workspace (devolução ao cartão).
 * Disparado pelo Master. Idempotente-ish: se já não houver pagamento estornável, retorna erro claro.
 */
export async function estornarUltimoPagamento(p: {
  workspaceId: string
  por: string            // quem disparou (ex.: 'master')
  motivo?: string | null
}): Promise<ResultadoEstorno> {
  await garantirAuditoria()

  const [ass] = await prisma.$queryRaw`
    SELECT a."subscriptionId", a."status", w."assinaturaOrigem"
    FROM "AsaasAssinatura" a
    JOIN "Workspace" w ON w."id" = a."workspaceId"
    WHERE a."workspaceId" = ${p.workspaceId}
    ORDER BY a."createdAt" DESC LIMIT 1
  ` as { subscriptionId: string; status: string; assinaturaOrigem: string | null }[]

  if (!ass) return { ok: false, erro: 'Sem assinatura Asaas para esta conta (origem Hotmart estorna no painel da Hotmart).' }
  if (ass.assinaturaOrigem === 'hotmart')
    return { ok: false, erro: 'Assinatura gerida pela Hotmart — o estorno é feito no painel da Hotmart.' }

  // 1) Pagamentos da subscription → escolhe o mais recente que está PAGO.
  const lista = await chamarAsaas<{ data?: PagamentoAsaas[] }>(
    `/payments?subscription=${encodeURIComponent(ass.subscriptionId)}&limit=100`,
  )
  if (!lista.ok) return { ok: false, erro: lista.erro || 'Não consegui consultar os pagamentos no Asaas.' }
  const pagos = (lista.dados?.data || []).filter(x => PAGOS.has(x.status))
  if (pagos.length === 0) return { ok: false, erro: 'Nenhum pagamento pago encontrado para estornar.' }
  const dt = (x: PagamentoAsaas) => x.paymentDate || x.confirmedDate || x.dueDate || ''
  pagos.sort((a, b) => (dt(a) < dt(b) ? 1 : -1))
  const alvo = pagos[0]

  // 2) Estorna (devolução ao cartão). Sem `value` = reembolso total.
  const ref = await chamarAsaas<{ status?: string; id?: string }>(
    `/payments/${alvo.id}/refund`,
    { metodo: 'POST', corpo: { description: (p.motivo || 'Estorno (arrependimento) — SOA').slice(0, 200) } },
  )
  if (!ref.ok) return { ok: false, erro: ref.erro || 'O Asaas recusou o estorno. Verifique no painel.' }

  // 3) Confirma o status do pagamento após o refund.
  const conf = await chamarAsaas<PagamentoAsaas>(`/payments/${alvo.id}`)
  const statusFinal = conf.ok ? (conf.dados?.status || 'REFUND_REQUESTED') : 'REFUND_REQUESTED'

  // 4) Auditoria (quem/quando/qual pagamento/valor/motivo).
  await prisma.$executeRaw`
    UPDATE "AsaasAssinatura"
    SET "estornoPagamentoId" = ${alvo.id}, "estornoEm" = NOW(), "estornoPor" = ${p.por},
        "estornoValor" = ${alvo.value}, "estornoMotivo" = ${p.motivo?.slice(0, 300) ?? null}, "updatedAt" = NOW()
    WHERE "subscriptionId" = ${ass.subscriptionId}
  `

  // 5) E-mail de confirmação (best-effort).
  await notificarEstorno(p.workspaceId, alvo.value)

  console.log(`[ESTORNO] ok ws=${p.workspaceId} pay=${alvo.id} valor=${alvo.value} por=${p.por} status=${statusFinal}`)
  return { ok: true, paymentId: alvo.id, valor: alvo.value, status: statusFinal }
}

/** E-mail de confirmação de estorno (Resend). Best-effort — não derruba o estorno. */
async function notificarEstorno(workspaceId: string, valor: number): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  try {
    const [w] = await prisma.$queryRaw`
      SELECT w."nome" AS "wsNome",
             (SELECT u."email" FROM "User" u WHERE u."workspaceId" = w."id" AND u."role" = 'ADMIN' LIMIT 1) AS "email"
      FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
    ` as { wsNome: string | null; email: string | null }[]
    const email = w?.email
    if (!email) return
    const valorBR = (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#334155">
        <h2 style="color:#0f172a">Estorno confirmado</h2>
        <p>Olá! Confirmamos o <strong>estorno de R$ ${valorBR}</strong> referente à assinatura de <strong>${(w?.wsNome || 'sua conta').toString()}</strong> no SOA.</p>
        <p>A devolução vai para o <strong>mesmo cartão</strong> usado na compra. O prazo de aparecer na fatura depende da operadora do cartão (normalmente até 1–2 faturas).</p>
        <p style="color:#64748b;font-size:13px">Qualquer dúvida, é só responder este e-mail.</p>
        <p style="color:#94a3b8;font-size:12px">Com carinho, equipe SOA 🧡</p>
      </div>`
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [email], subject: 'Estorno confirmado — SOA', html }),
    })
    if (!r.ok) console.error(`[ESTORNO] Resend ${r.status}`)
  } catch (e) { console.error('[ESTORNO] email:', (e as Error)?.message) }
}
