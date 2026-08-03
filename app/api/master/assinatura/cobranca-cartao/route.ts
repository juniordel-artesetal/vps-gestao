// Master — gerar uma NOVA cobrança no CARTÃO (assinatura recorrente) para UMA cliente,
// devolvendo o link seguro do Asaas pra ela cadastrar o cartão (tokenização; nenhum dado
// de cartão passa pelo SOA). NÃO altera o workspace/acesso — só cria o checkout no Asaas.
//
// Segurança: guarda master; credencial só via chamarAsaas (env/AsaasConfig); Prisma raw,
// sem SELECT *; escopo à cliente; idempotente (se já houver assinatura ACTIVE, avisa e não duplica).
//
// Dois modos:
//   acao='verificar' → SÓ LEITURA: estado real da cliente no Asaas (assinaturas). Não cria nada.
//   acao='criar'     → cria o checkout CARTÃO recorrente (mensal 29,90) e devolve o link.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { getPlano, valorCobrado } from '@/lib/assinatura/planos'
import { resolverSplitParceira } from '@/lib/parceiras/split'

export const dynamic = 'force-dynamic'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

// Lista as assinaturas reais da cliente no Asaas (por customerId conhecido e/ou por e-mail).
async function assinaturasDaCliente(customerIds: string[], email?: string | null) {
  const ids = new Set(customerIds.filter(Boolean))
  if (email) {
    const cust = await chamarAsaas<{ data?: { id: string }[] }>(`/customers?email=${encodeURIComponent(email)}`, { metodo: 'GET', exigirAtivo: false })
    for (const c of (cust.dados?.data || [])) ids.add(c.id)
  }
  const out: any[] = []
  for (const cid of ids) {
    const subs = await chamarAsaas<{ data?: any[] }>(`/subscriptions?customer=${cid}`, { metodo: 'GET', exigirAtivo: false })
    for (const s of (subs.dados?.data || [])) out.push({ subscriptionId: s.id, customerId: cid, billingType: s.billingType, cycle: s.cycle, status: s.status, value: s.value, nextDueDate: s.nextDueDate })
  }
  return out
}

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const acao: string = ['criar', 'cancelar'].includes(b.acao) ? b.acao : 'verificar'
  const planoId = b.plano === 'anual' ? 'anual' : 'mensal'

  // Resolve a workspace (read-only). Aceita slug OU workspaceId.
  const [ws] = await prisma.$queryRaw`
    SELECT "id","slug","nome","assinaturaStatus","trialAte"
    FROM "Workspace" WHERE "slug" = ${b.slug || ''} OR "id" = ${b.workspaceId || ''} LIMIT 1
  ` as { id: string; slug: string; nome: string; assinaturaStatus: string; trialAte: any }[]
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })

  // customerIds já conhecidos (do vínculo local) + e-mail informado (fallback de busca).
  const vinculos = await prisma.$queryRaw`
    SELECT DISTINCT "customerId" FROM "AsaasAssinatura" WHERE "workspaceId" = ${ws.id} AND "customerId" IS NOT NULL
  ` as { customerId: string }[]
  const customerIds = vinculos.map(v => v.customerId)
  const email: string | null = b.email || null

  const assinaturas = await assinaturasDaCliente(customerIds, email)
  const ativas = assinaturas.filter(a => a.status === 'ACTIVE')

  // ── VERIFICAR: só leitura, mostra o estado real ──
  if (acao === 'verificar') {
    return NextResponse.json({
      ok: true, modo: 'verificar',
      workspace: { id: ws.id, slug: ws.slug, nome: ws.nome, assinaturaStatus: ws.assinaturaStatus, trialAte: ws.trialAte },
      assinaturasAsaas: assinaturas, ativas: ativas.length,
    })
  }

  // ── CANCELAR: cancela a(s) assinatura(s) ACTIVE no Asaas (ex.: Pix antiga). Marca o
  // vínculo local como CANCELLED (higiene de billing; NÃO mexe no workspace/acesso). ──
  if (acao === 'cancelar') {
    const alvo: string[] = b.subscriptionId ? [b.subscriptionId] : ativas.map(a => a.subscriptionId)
    if (alvo.length === 0) return NextResponse.json({ ok: true, cancelados: [], mensagem: 'Nenhuma assinatura ACTIVE para cancelar.' })
    const cancelados: any[] = []
    for (const sid of alvo) {
      const del = await chamarAsaas<{ deleted?: boolean; id?: string }>(`/subscriptions/${sid}`, { metodo: 'DELETE' })
      if (del.ok && del.dados?.deleted) {
        // Higiene do espelho local — tolerante a esquema (não pode derrubar o cancelamento já feito no Asaas).
        try { await prisma.$executeRaw`UPDATE "AsaasAssinatura" SET "status" = 'CANCELLED' WHERE "subscriptionId" = ${sid} AND "workspaceId" = ${ws.id}` } catch {}
        cancelados.push({ subscriptionId: sid, deleted: true })
        console.log(`[MASTER COBRANCA-CARTAO] cancelada sub=${sid} ws=${ws.id}`)
      } else {
        cancelados.push({ subscriptionId: sid, deleted: false, erro: del.erro || 'falhou' })
      }
    }
    return NextResponse.json({ ok: cancelados.every(c => c.deleted), modo: 'cancelar', cancelados })
  }

  // ── CRIAR: idempotência — se já há assinatura ACTIVE, avisa e NÃO duplica ──
  if (ativas.length > 0) {
    return NextResponse.json({
      ok: false, jaAtiva: true,
      mensagem: 'A cliente já tem assinatura(s) ACTIVE no Asaas — não vou duplicar. Cancele a(s) existente(s) antes, se for o caso.',
      ativas,
    })
  }

  // Cria o checkout hospedado do Asaas (cartão, recorrente). MESMA lógica do motor de
  // assinatura, porém SEM tocar no Workspace (não muda status/acesso/trial da cliente).
  const plano = getPlano(planoId)
  const valor = valorCobrado(plano, 'avista')
  // Primeiro vencimento = fim do trial atual da cliente (não cobra durante o teste que ela já tem).
  const hoje = new Date()
  const trial = ws.trialAte ? new Date(ws.trialAte) : null
  const venc = (trial && trial > hoje) ? trial : new Date(hoje.getTime() + 14 * 864e5)
  const nextDueDate = venc.toISOString().slice(0, 10)
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.usesoa.com.br'

  const corpo: Record<string, unknown> = {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 1440,
    callback: { successUrl: `${baseUrl}/assinatura/concluido`, cancelUrl: `${baseUrl}/assinatura`, expiredUrl: `${baseUrl}/assinatura` },
    items: [{ name: `SOA — plano ${plano.nome.toLowerCase()}`, quantity: 1, value: valor }],
    externalReference: ws.id,
    subscription: { cycle: plano.ciclo, nextDueDate },
  }
  // Split da parceira (se houver), com fallback provado: split recusado nunca impede a receita.
  const sp = await resolverSplitParceira(ws.id, plano, valor, 'avista')
  if (sp.split.length) corpo.split = sp.split

  let r = await chamarAsaas<{ id?: string; link?: string }>('/checkouts', { metodo: 'POST', corpo })
  if (!r.ok && sp.split.length) { delete corpo.split; r = await chamarAsaas<{ id?: string; link?: string }>('/checkouts', { metodo: 'POST', corpo }) }
  if (!r.ok || !r.dados?.id || !r.dados?.link) {
    return NextResponse.json({ ok: false, error: r.erro || 'Não consegui criar o checkout no Asaas.' }, { status: 502 })
  }

  console.log(`[MASTER COBRANCA-CARTAO] ws=${ws.id} plano=${plano.id} checkout=${r.dados.id} (workspace NÃO alterado)`)
  return NextResponse.json({
    ok: true, modo: 'criar',
    checkoutId: r.dados.id, link: r.dados.link, plano: plano.id, valor, ciclo: plano.ciclo, nextDueDate,
    aviso: 'Link do Asaas para a cliente cadastrar o cartão (expira em 24h). Workspace/acesso NÃO foram alterados.',
  })
}
