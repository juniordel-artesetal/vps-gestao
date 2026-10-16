// TROCA DO SOA MENSAL → ANUAL (16/10/2026, junto do lançamento do Método Mãe). Self-service, SEM cobrança dupla:
//   1. Quem pode: assinante Asaas ATIVA com a assinatura MENSAL viva (cartão) e a mensalidade em dia.
//      Hotmart, Pix, teste e inadimplente → "fale com a gente" (troca manual).
//   2. Checkout do ANUAL (cartão, até 12× com juros do cliente — mesma tabela do anual), com a 1ª cobrança NO DIA
//      em que a mensalidade atual venceria: o mês já pago é respeitado e nada se sobrepõe.
//   3. CHECKOUT_PAID (cartão cadastrado) → a mensal é APAGADA no Asaas (com as cobranças pendentes dela) e o
//      Workspace passa a apontar para o checkout do anual (as cobranças do anual chegam sem externalReference e
//      casam pelo checkoutSession = Workspace.checkoutId). O SUBSCRIPTION_DELETED da mensal NÃO cancela a conta.
//   4. Se o Asaas não apagar a mensal na hora, o cron de assinaturas (de hora em hora) tenta de novo até conseguir.
// Nada aqui estorna nem cobra por fora: a 1ª cobrança do anual é a do vencimento.
// Tabela "SoaMigracaoAnual" (scripts/migrar-soa-migracao-anual.mjs).
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { getPlano, resolverParcelamento, calcularParcelamentoAnual, MAX_PARCELAS_ANUAL, type Parcelamento } from './planos'
import { resolverSplitParceira } from '@/lib/parceiras/split'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const hojeSP = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10)

export type MotivoNaoElegivel = 'hotmart' | 'nao-ativa' | 'ja-anual' | 'sem-mensal' | 'mensal-atrasada' | 'ja-trocou'
export const TEXTO_MOTIVO: Record<MotivoNaoElegivel, string> = {
  hotmart: 'Sua assinatura é pela Hotmart — a troca para o anual é feita pela nossa equipe. Fale com a gente que fazemos para você.',
  'nao-ativa': 'A troca para o anual é para quem já paga o SOA mensal em dia. Se você está no teste ou com pagamento pendente, assine o anual direto em Minha assinatura.',
  'ja-anual': 'Sua assinatura do SOA já é anual. 💛',
  'sem-mensal': 'Não encontramos a sua assinatura mensal no cartão. Fale com a gente que fazemos a troca para você.',
  'mensal-atrasada': 'Sua mensalidade está com pagamento pendente. Regularize em Minha assinatura e depois volte aqui para trocar.',
  'ja-trocou': 'Você já pediu a troca para o anual — ela vale a partir do vencimento da sua mensalidade. 💛',
}

/** Regras puras (testáveis): pode trocar? */
export function avaliarElegibilidade(e: {
  origem: string | null; status: string | null; migracaoConcluida: boolean
  assinatura: { ciclo: string; status: string } | null
  asaas: { status?: string; cycle?: string; nextDueDate?: string } | null
  hoje: string
}): { ok: true } | { ok: false; motivo: MotivoNaoElegivel } {
  if (e.migracaoConcluida) return { ok: false, motivo: 'ja-trocou' }
  if (e.origem !== 'asaas') return { ok: false, motivo: 'hotmart' }
  if (e.assinatura?.ciclo === 'YEARLY' || e.asaas?.cycle === 'YEARLY') return { ok: false, motivo: 'ja-anual' }
  if (e.status !== 'ATIVA') return { ok: false, motivo: 'nao-ativa' }
  if (!e.assinatura || !e.asaas || e.asaas.status !== 'ACTIVE' || e.asaas.cycle !== 'MONTHLY' || !e.asaas.nextDueDate) return { ok: false, motivo: 'sem-mensal' }
  if (e.asaas.nextDueDate < e.hoje) return { ok: false, motivo: 'mensal-atrasada' }
  return { ok: true }
}

export interface EstadoMigracao {
  ok: boolean; motivo?: MotivoNaoElegivel; texto?: string
  subMensal?: string; vencimentoMensal?: string; valorMensal?: number
  anual: { avista: number; tabela: Parcelamento[] }
  pendente?: { link: string | null; parcelas: number } | null
}

export async function estadoMigracao(ws: string): Promise<EstadoMigracao> {
  const avista = getPlano('anual').valor
  const anual = { avista, tabela: Array.from({ length: MAX_PARCELAS_ANUAL }, (_, k) => calcularParcelamentoAnual(k + 1, avista)) }
  const [w] = await prisma.$queryRaw<{ origem: string | null; status: string | null }[]>`
    SELECT "assinaturaOrigem" AS "origem", "assinaturaStatus" AS "status" FROM "Workspace" WHERE "id" = ${ws} LIMIT 1`
  const [a] = await prisma.$queryRaw<{ subscriptionId: string; ciclo: string; status: string; valor: unknown }[]>`
    SELECT "subscriptionId", "ciclo", "status", "valor" FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${ws} AND "status" IN ('ACTIVE','OVERDUE') ORDER BY "createdAt" DESC LIMIT 1`
  const migs = await prisma.$queryRaw<{ status: string; checkoutLink: string | null; parcelas: number; criadoEm: Date }[]>`
    SELECT "status", "checkoutLink", "parcelas", "criadoEm" FROM "SoaMigracaoAnual" WHERE "workspaceId" = ${ws} ORDER BY "criadoEm" DESC LIMIT 5`
  const asaas = a ? (await chamarAsaas<{ status?: string; cycle?: string; nextDueDate?: string }>(`/subscriptions/${a.subscriptionId}`, { exigirAtivo: false })).dados ?? null : null
  const r = avaliarElegibilidade({ origem: w?.origem ?? null, status: w?.status ?? null, migracaoConcluida: migs.some(m => m.status === 'CONCLUIDA'), assinatura: a ? { ciclo: a.ciclo, status: a.status } : null, asaas, hoje: hojeSP() })
  if (!r.ok) return { ok: false, motivo: r.motivo, texto: TEXTO_MOTIVO[r.motivo], anual }
  const aberta = migs.find(m => m.status === 'AGUARDANDO' && Date.now() - new Date(m.criadoEm).getTime() < 23 * 3600_000)
  // pente-fino 16/10 (sandbox): quando a próxima mensalidade JÁ foi gerada (cobrança PENDENTE), o nextDueDate da assinatura
  // já aponta para o mês seguinte. O anual começa na cobrança que de fato viria (a pendente, que é apagada na troca) —
  // senão ela ganharia um mês de graça.
  const pend = await chamarAsaas<{ data?: { dueDate?: string; status?: string }[] }>(`/subscriptions/${a!.subscriptionId}/payments?status=PENDING&limit=10`, { exigirAtivo: false })
  const pendente = (pend.dados?.data ?? []).map(p => p.dueDate).filter((d): d is string => !!d && d >= hojeSP()).sort()[0]
  const venc = pendente && pendente < asaas!.nextDueDate! ? pendente : asaas!.nextDueDate!
  return { ok: true, subMensal: a!.subscriptionId, vencimentoMensal: venc, valorMensal: Number(a!.valor), anual, pendente: aberta ? { link: aberta.checkoutLink, parcelas: aberta.parcelas } : null }
}

/** Abre o checkout do anual (1ª cobrança no vencimento da mensal). Reaproveita o link aberto com as mesmas parcelas. */
export async function criarCheckoutMigracao(p: { workspaceId: string; parcelas: number; baseUrl: string }): Promise<{ ok: true; link: string } | { ok: false; erro: string; status: number }> {
  const e = await estadoMigracao(p.workspaceId)
  if (!e.ok) return { ok: false, erro: e.texto ?? 'Não dá para trocar agora.', status: 400 }
  const plano = getPlano('anual')
  // pente-fino 16/10/2026: assinatura RECORRENTE não parcela no Asaas (cobra o total) → a troca sai À VISTA por enquanto
  const pcl = resolverParcelamento(plano, 'cartao', 1)
  if (e.pendente?.link && e.pendente.parcelas === pcl.parcelas) return { ok: true, link: e.pendente.link }
  const corpo: Record<string, unknown> = {
    billingTypes: ['CREDIT_CARD'], chargeTypes: ['RECURRENT'], minutesToExpire: 1440,
    callback: { successUrl: `${p.baseUrl}/assinatura/migrar-anual?pago=1`, cancelUrl: `${p.baseUrl}/assinatura/migrar-anual`, expiredUrl: `${p.baseUrl}/assinatura/migrar-anual` },
    items: [{ name: 'SOA — plano anual', quantity: 1, value: pcl.total }],
    externalReference: p.workspaceId,
    // a 1ª cobrança do anual cai no dia em que a mensalidade atual venceria (o mês pago é respeitado)
    subscription: { cycle: 'YEARLY', nextDueDate: e.vencimentoMensal },
    ...(pcl.parcelas > 1 ? { maxInstallmentCount: pcl.parcelas } : {}),
  }
  const sp = await resolverSplitParceira(p.workspaceId, plano, pcl.total, pcl.parcelas > 1 ? 'parcelado' : 'avista').catch(() => ({ split: [] as unknown[] }))
  if (sp.split.length) corpo.split = sp.split
  let r = await chamarAsaas<{ id?: string; link?: string }>('/checkouts', { metodo: 'POST', corpo })
  if (!r.ok && sp.split.length) { delete corpo.split; r = await chamarAsaas<{ id?: string; link?: string }>('/checkouts', { metodo: 'POST', corpo }) }
  if (!r.ok || !r.dados?.id || !r.dados?.link) {
    console.error(`[MIGRACAO ANUAL] checkout falhou ws=${p.workspaceId}: ${r.erro}`)
    return { ok: false, erro: r.erro || 'Não consegui abrir a página de pagamento.', status: 502 }
  }
  await prisma.$executeRaw`
    INSERT INTO "SoaMigracaoAnual" ("id","workspaceId","subMensal","vencimentoMensal","checkoutId","checkoutLink","parcelas","valor","status","criadoEm")
    VALUES (${gid()}, ${p.workspaceId}, ${e.subMensal!}, ${e.vencimentoMensal!}::date, ${r.dados.id}, ${r.dados.link}, ${pcl.parcelas}, ${pcl.total}, 'AGUARDANDO', NOW())`
  console.log(`[MIGRACAO ANUAL] checkout ws=${p.workspaceId} ${pcl.parcelas}x total=${pcl.total} 1ª=${e.vencimentoMensal} mensal=${e.subMensal}`)
  return { ok: true, link: r.dados.link }
}

/** Apaga a mensal no Asaas (e as cobranças pendentes dela). true = não existe mais lá. */
async function apagarMensal(sub: string): Promise<{ ok: boolean; erro?: string }> {
  const pend = await chamarAsaas<{ data?: { id: string; status?: string }[] }>(`/subscriptions/${sub}/payments?status=PENDING&limit=20`, { exigirAtivo: false })
  const d = await chamarAsaas(`/subscriptions/${sub}`, { metodo: 'DELETE', exigirAtivo: false })
  if (!d.ok && d.status !== 404) return { ok: false, erro: d.erro ?? `HTTP ${d.status}` }
  // cobrança pendente que sobreviveu à exclusão da assinatura nunca pode cair no cartão
  for (const p of pend.dados?.data ?? []) {
    if (p.status && p.status !== 'PENDING') continue
    const x = await chamarAsaas(`/payments/${p.id}`, { metodo: 'DELETE', exigirAtivo: false })
    if (!x.ok && x.status !== 404) console.error(`[MIGRACAO ANUAL] cobrança pendente ${p.id} da mensal ${sub} não apagada: ${x.erro}`)
  }
  return { ok: true }
}

/** Webhook CHECKOUT_PAID: o checkout é de uma troca para o anual? Conclui e devolve true (o evento é só dela). */
export async function concluirMigracaoAnual(checkoutId: string): Promise<boolean> {
  const [m] = await prisma.$queryRaw<{ id: string; workspaceId: string; subMensal: string; parcelas: number }[]>`
    UPDATE "SoaMigracaoAnual" SET "status" = 'CONCLUIDA', "concluidaEm" = NOW()
    WHERE "checkoutId" = ${checkoutId} AND "status" IN ('AGUARDANDO','EXPIRADA')
    RETURNING "id","workspaceId","subMensal","parcelas"`
  if (!m) {
    const [ja] = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "SoaMigracaoAnual" WHERE "checkoutId" = ${checkoutId} LIMIT 1`
    return !!ja   // evento repetido de uma troca já concluída: nada a fazer, mas é dela
  }
  // as cobranças do anual chegam sem externalReference → casam pelo checkoutSession (= Workspace.checkoutId)
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "checkoutId" = ${checkoutId}, "checkoutLink" = NULL, "planoEscolhido" = 'anual', "metodoEscolhido" = 'cartao',
      "formaEscolhida" = ${m.parcelas > 1 ? 'parcelado' : 'avista'}, "parcelasEscolhidas" = ${m.parcelas}, "updatedAt" = NOW()
    WHERE "id" = ${m.workspaceId}`
  // a mensal sai da nossa conta ANTES de apagar no Asaas (o SUBSCRIPTION_DELETED dela não cancela a conta)
  await prisma.$executeRaw`
    UPDATE "AsaasAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = COALESCE("canceladaEm", NOW()), "canceladaPor" = 'migracao-anual',
      "canceladaMotivo" = 'Troca do mensal para o anual', "updatedAt" = NOW()
    WHERE "subscriptionId" = ${m.subMensal}`
  const a = await apagarMensal(m.subMensal)
  if (a.ok) await prisma.$executeRaw`UPDATE "SoaMigracaoAnual" SET "mensalCanceladaEm" = NOW(), "erro" = NULL WHERE "id" = ${m.id}`
  else {
    await prisma.$executeRaw`UPDATE "SoaMigracaoAnual" SET "erro" = ${a.erro ?? 'falha'} WHERE "id" = ${m.id}`
    console.error(`[MIGRACAO ANUAL] ws=${m.workspaceId}: a mensal ${m.subMensal} NÃO foi apagada no Asaas (${a.erro}) — o cron tenta de novo`)
  }
  console.log(`[MIGRACAO ANUAL] concluída ws=${m.workspaceId} checkout=${checkoutId} mensal ${m.subMensal} ${a.ok ? 'apagada' : 'pendente'}`)
  return true
}

/** Webhook CHECKOUT_EXPIRED/CANCELED de uma troca: só marca (nada muda na assinatura mensal). */
export async function encerrarCheckoutMigracao(checkoutId: string): Promise<boolean> {
  const r = await prisma.$executeRaw`UPDATE "SoaMigracaoAnual" SET "status" = 'EXPIRADA', "checkoutLink" = NULL WHERE "checkoutId" = ${checkoutId} AND "status" = 'AGUARDANDO'`
  if (r) return true
  const [ja] = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "SoaMigracaoAnual" WHERE "checkoutId" = ${checkoutId} LIMIT 1`
  return !!ja
}

/** Webhook SUBSCRIPTION_DELETED: é a mensal de uma troca concluída? Então só ela sai (a conta continua ATIVA). */
export async function ehMensalMigrada(sub: string): Promise<boolean> {
  const [m] = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "SoaMigracaoAnual" WHERE "subMensal" = ${sub} AND "status" = 'CONCLUIDA' LIMIT 1`
  if (!m) return false
  await prisma.$executeRaw`UPDATE "SoaMigracaoAnual" SET "mensalCanceladaEm" = COALESCE("mensalCanceladaEm", NOW()) WHERE "id" = ${m.id}`
  await prisma.$executeRaw`
    UPDATE "AsaasAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = COALESCE("canceladaEm", NOW()), "canceladaPor" = COALESCE("canceladaPor", 'migracao-anual'), "updatedAt" = NOW()
    WHERE "subscriptionId" = ${sub} AND "status" <> 'CANCELADA'`
  return true
}

/** Cron (de hora em hora): mensais de trocas concluídas que o Asaas ainda não apagou. */
export async function apagarMensaisPendentes(): Promise<{ tentadas: number; apagadas: number }> {
  const pend = await prisma.$queryRaw<{ id: string; subMensal: string }[]>`
    SELECT "id","subMensal" FROM "SoaMigracaoAnual" WHERE "status" = 'CONCLUIDA' AND "mensalCanceladaEm" IS NULL LIMIT 20`.catch(() => [])
  let apagadas = 0
  for (const m of pend) {
    const a = await apagarMensal(m.subMensal)
    if (a.ok) { apagadas++; await prisma.$executeRaw`UPDATE "SoaMigracaoAnual" SET "mensalCanceladaEm" = NOW(), "erro" = NULL WHERE "id" = ${m.id}` }
    else await prisma.$executeRaw`UPDATE "SoaMigracaoAnual" SET "erro" = ${a.erro ?? 'falha'} WHERE "id" = ${m.id}`
  }
  if (pend.length) console.log(`[MIGRACAO ANUAL] cron: ${apagadas}/${pend.length} mensais apagadas`)
  return { tentadas: pend.length, apagadas }
}
