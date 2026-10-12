// Gestão de Receitas do SOA (Master) — SOMENTE LEITURA do espelho local. Nunca chama Asaas/Hotmart aqui.
//
// Fontes:
//   Asaas  → "AsaasCobranca" (pagamentos), "AsaasAssinatura", "Workspace" (status da conta), "AssinaturaAviso" (CORTE).
//   Hotmart→ "HotmartEvent" (webhook: cada renovação é uma transação com preço BRUTO e comissão do PRODUTOR = LÍQUIDO)
//            + "HotmartAssinatura" (espelho do sync da API, quando houver credencial).
//
// Regras de dado (conferidas no banco em 12/10/2026):
//   - O flag "sandbox" do AsaasCobranca NÃO é confiável (o webhook nunca grava → default true em produção).
//     Ambiente é decidido pela URL da fatura: só fica de fora o que for de sandbox.asaas.com.
//   - Pago no Asaas = RECEIVED | CONFIRMED | RECEIVED_IN_CASH. "pagoEm" é a hora do webhook (≈ data do pagamento).
//   - Hotmart: pagamento = PURCHASE_APPROVED do produto SOA (7467295), 1 por transação; estornado se houver
//     PURCHASE_REFUNDED/CHARGEBACK da mesma transação. Planos de teste ficam de fora.
//   - Valor das assinaturas = o VALOR REAL de cada uma (grandfather R$29,90 × R$49,90) — nada chumbado.
//   - Anual = ciclo YEARLY/ANUAL ou valor ≥ R$100 (a cobrança anual do checkout chega como MONTHLY).
import { prisma } from '@/lib/prisma'
import { withRetry } from '@/lib/dbRetry'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { credenciaisConfiguradas as hotmartComCredencial, assinaturasPorEmail } from '@/lib/hotmart'

export const HOTMART_PRODUTO_SOA = '7467295'
const PAGO_ASAAS = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const ANUAL_MIN = 100
/** Atraso na Hotmart mais antigo que isto = cliente perdida (a Hotmart já desistiu de cobrar), não inadimplente. */
const JANELA_ATRASO_DIAS = 45

export type Gateway = 'asaas' | 'hotmart'
export interface Periodo { de: Date; ate: Date; rotulo: string }

// ── período (fuso de São Paulo) ─────────────────────────────────────────────────────────────────────────────────
const TZ = -3 * 3600_000
const inicioDoDiaSP = (d: Date) => { const l = new Date(d.getTime() + TZ); l.setUTCHours(0, 0, 0, 0); return new Date(l.getTime() - TZ) }
export function resolverPeriodo(tipo: string | null, de?: string | null, ate?: string | null): Periodo {
  const agora = new Date()
  const hoje = inicioDoDiaSP(agora)
  const amanha = new Date(hoje.getTime() + 86400_000)
  const l = new Date(hoje.getTime() + TZ)
  if (tipo === 'custom' && de && ate) {
    const a = new Date(`${de}T00:00:00-03:00`), b = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86400_000)
    if (!isNaN(+a) && !isNaN(+b) && b > a) return { de: a, ate: b, rotulo: `${de.split('-').reverse().join('/')} a ${ate.split('-').reverse().join('/')}` }
  }
  if (tipo === 'semana') { const dow = (l.getUTCDay() + 6) % 7; return { de: new Date(hoje.getTime() - dow * 86400_000), ate: amanha, rotulo: 'Esta semana' } }
  if (tipo === 'ano') return { de: new Date(Date.UTC(l.getUTCFullYear(), 0, 1) - TZ), ate: amanha, rotulo: `Ano ${l.getUTCFullYear()}` }
  return { de: new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - TZ), ate: amanha, rotulo: 'Este mês' }
}
const noPeriodo = (d: Date | null | undefined, p: Periodo) => !!d && d >= p.de && d < p.ate
const mesDe = (d: Date) => { const l = new Date(d.getTime() + TZ); return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}` }
const num = (v: unknown) => (v == null ? 0 : Number(v))
const r2 = (v: number) => Math.round(v * 100) / 100

// ── leitura crua (poucas consultas, centenas de linhas) ──────────────────────────────────────────────────────────
interface WsRow { id: string; nome: string; status: string | null; origem: string | null; ciclo: string | null; email: string | null; whatsapp: string | null; createdAt: Date; liberacaoManual: boolean | null; cortesia: Date | null; corteEm: Date | null }
interface CobRow { paymentId: string; workspaceId: string | null; subscriptionId: string | null; status: string; billingType: string | null; valor: number; liquido: number | null; vencimento: Date | null; pago: Date | null; invoiceUrl: string | null; createdAt: Date; updatedAt: Date }
interface SubRow { subscriptionId: string; workspaceId: string | null; status: string; ciclo: string | null; valor: number; proximo: Date | null; createdAt: Date; canceladaEm: Date | null; updatedAt: Date }
export interface HotPag { transacao: string; email: string | null; workspaceId: string | null; pago: Date; bruto: number; liquido: number; plano: string | null; cod: string | null; forma: string | null; estornada: boolean }
interface HotEvt { cod: string; email: string | null; workspaceId: string | null; st: string | null; evento: string; plano: string | null; quando: Date; proxima: Date | null }

async function lerWorkspaces(): Promise<WsRow[]> {
  return prisma.$queryRaw<WsRow[]>`
    SELECT w."id", w."nome", w."assinaturaStatus" AS status, w."assinaturaOrigem" AS origem, w."cicloAssinatura" AS ciclo,
           w."whatsapp", w."createdAt", w."liberacaoManual", w."cortesiaAtivadaEm" AS cortesia,
           (SELECT lower(u."email") FROM "User" u WHERE u."workspaceId" = w."id" AND u."role" = 'ADMIN' ORDER BY u."createdAt" LIMIT 1) AS email,
           (SELECT MAX(a."dia") FROM "AssinaturaAviso" a WHERE a."workspaceId" = w."id" AND a."tipo" = 'CORTE') AS "corteEm"
    FROM "Workspace" w`
}
async function lerCobrancas(workspaceId?: string): Promise<CobRow[]> {
  return prisma.$queryRaw<CobRow[]>`
    SELECT c."paymentId", c."workspaceId", c."subscriptionId", c."status", c."billingType",
           c."valor"::float AS valor, c."valorLiquido"::float AS liquido, c."vencimento", c."pagoEm" AS pago,
           c."invoiceUrl", c."createdAt", c."updatedAt"
    FROM "AsaasCobranca" c
    WHERE COALESCE(c."invoiceUrl", '') NOT ILIKE '%sandbox%'
      AND (${workspaceId ?? null}::text IS NULL OR c."workspaceId" = ${workspaceId ?? null})`
}
async function lerAssinaturas(workspaceId?: string): Promise<SubRow[]> {
  return prisma.$queryRaw<SubRow[]>`
    SELECT s."subscriptionId", s."workspaceId", s."status", s."ciclo", s."valor"::float AS valor, s."proximoVencimento" AS proximo,
           s."createdAt", s."canceladaEm", s."updatedAt"
    FROM "AsaasAssinatura" s
    WHERE (${workspaceId ?? null}::text IS NULL OR s."workspaceId" = ${workspaceId ?? null})`
}
/** Pagamentos Hotmart do produto SOA (1 por transação). Só campos não sensíveis saem do payload (nada de CPF/endereço). */
export async function lerPagamentosHotmart(emails?: string[]): Promise<HotPag[]> {
  const filtro = emails?.length ? emails.map(e => e.toLowerCase()) : null
  const rows = await prisma.$queryRaw<HotPag[]>`
    WITH a AS (
      SELECT DISTINCT ON (e."transacao") e."transacao", lower(e."email") AS email, e."workspaceId", e.payload::jsonb AS p
      FROM "HotmartEvent" e
      WHERE e."evento" = 'PURCHASE_APPROVED' AND e."transacao" IS NOT NULL
        AND (${filtro}::text[] IS NULL OR lower(e."email") = ANY(${filtro}::text[]))
      ORDER BY e."transacao", e."createdAt")
    SELECT a."transacao", a.email, a."workspaceId",
           to_timestamp((a.p->'data'->'purchase'->>'approved_date')::bigint / 1000.0) AS pago,
           COALESCE((a.p->'data'->'purchase'->'price'->>'value')::float, 0) AS bruto,
           COALESCE((SELECT (c->>'value')::float FROM jsonb_array_elements(a.p->'data'->'commissions') c WHERE c->>'source' = 'PRODUCER' LIMIT 1), 0) AS liquido,
           a.p->'data'->'subscription'->'plan'->>'name' AS plano,
           a.p->'data'->'subscription'->'subscriber'->>'code' AS cod,
           a.p->'data'->'purchase'->'payment'->>'type' AS forma,
           EXISTS (SELECT 1 FROM "HotmartEvent" r WHERE r."transacao" = a."transacao" AND r."evento" IN ('PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK')) AS estornada
    FROM a
    WHERE a.p->'data'->'product'->>'id' = ${HOTMART_PRODUTO_SOA}
      AND a.p->'data'->'purchase'->>'approved_date' IS NOT NULL
      AND COALESCE(a.p->'data'->'subscription'->'plan'->>'name', '') NOT ILIKE '%teste%'`
  return rows.map(r => ({ ...r, pago: new Date(r.pago) }))
}
/** Linha do tempo de status por assinante Hotmart (eventos do produto SOA + espelho do sync, o mais recente vence). */
async function lerEstadosHotmart(emails?: string[]): Promise<HotEvt[]> {
  const filtro = emails?.length ? emails.map(e => e.toLowerCase()) : null
  return prisma.$queryRaw<HotEvt[]>`
    WITH ev AS (
      SELECT e."evento", lower(e."email") AS email, e."workspaceId", e."createdAt", e.payload::jsonb AS p
      FROM "HotmartEvent" e
      WHERE (${filtro}::text[] IS NULL OR lower(e."email") = ANY(${filtro}::text[]))),
    u AS (
      SELECT p->'data'->'subscription'->'subscriber'->>'code' AS cod, email, "workspaceId", p->'data'->'subscription'->>'status' AS st, "evento",
             p->'data'->'subscription'->'plan'->>'name' AS plano, "createdAt" AS quando,
             to_timestamp(NULLIF(p->'data'->'purchase'->>'date_next_charge', '')::bigint / 1000.0) AS proxima
      FROM ev WHERE "evento" <> 'SUBSCRIPTION_CANCELLATION' AND p->'data'->'product'->>'id' = ${HOTMART_PRODUTO_SOA}
        AND p->'data'->'subscription'->'subscriber'->>'code' IS NOT NULL
      UNION ALL
      SELECT p->'data'->'subscriber'->>'code', email, "workspaceId", 'CANCELED', "evento", p->'data'->'subscription'->'plan'->>'name', "createdAt", NULL
      FROM ev WHERE "evento" = 'SUBSCRIPTION_CANCELLATION' AND p->'data'->'product'->>'id' = ${HOTMART_PRODUTO_SOA}
        AND p->'data'->'subscriber'->>'code' IS NOT NULL)
    SELECT * FROM u
    UNION ALL
    SELECT h."codigo", lower(h."email"), NULL, h."status", 'SYNC', h."planoNome", h."atualizadoEm", h."proximaCobranca"
    FROM "HotmartAssinatura" h
    WHERE h."codigo" IN (SELECT cod FROM u)
      AND (${filtro}::text[] IS NULL OR lower(h."email") = ANY(${filtro}::text[]))`
}

// ── normalizações ────────────────────────────────────────────────────────────────────────────────────────────────
export type SituacaoHot = 'ATIVA' | 'ATRASO' | 'CANCELADA'
export function situacaoHotmart(st: string | null | undefined): SituacaoHot {
  const s = String(st ?? '').toUpperCase()
  if (s === 'ACTIVE' || s === 'STARTED') return 'ATIVA'
  if (s === 'PAST_DUE' || s === 'DELAYED' || s === 'OVERDUE') return 'ATRASO'
  return 'CANCELADA'
}
const ehAnualHot = (plano: string | null, valor: number) => /ANU|ANO|YEAR/i.test(plano ?? '') || valor >= ANUAL_MIN
const ehAnualAsaas = (ciclo: string | null, valor: number) => ciclo === 'YEARLY' || ciclo === 'ANUAL' || valor >= ANUAL_MIN
export const statusExibicaoAsaas = (s: string, venc: Date | null) =>
  PAGO_ASAAS.has(s) ? 'RECEBIDO' : s === 'OVERDUE' ? 'VENCIDO' : s === 'PENDING' ? (venc && venc < inicioDoDiaSP(new Date()) ? 'VENCIDO' : 'PENDENTE')
    : s === 'REFUNDED' ? 'ESTORNADO' : s === 'DELETED' ? 'REMOVIDA' : s.startsWith('CHARGEBACK') ? 'CHARGEBACK' : s

interface AssinanteHot { cod: string; email: string | null; workspaceId: string | null; situacao: SituacaoHot; anual: boolean; valor: number; proxima: Date | null; ultimoEvento: string; quando: Date; migrou: boolean; pagou: boolean; inadimplente: boolean; balde: 'ATIVA' | 'INADIMPLENTE' | 'NUNCA_PAGOU' | 'PERDIDA' | 'MIGROU' | 'CANCELADA' }
/** Migrou para o Asaas = a conta (pelo workspace do evento, ou pelo e-mail) hoje é ATIVA no Asaas. */
type Migrou = (x: { email: string | null; workspaceId: string | null }) => boolean
function consolidarHotmart(estados: HotEvt[], pags: HotPag[], migrouAsaas: Migrou): AssinanteHot[] {
  const ultimoPag = new Map<string, HotPag>()
  for (const p of pags) if (p.cod && !p.estornada && (!ultimoPag.get(p.cod) || ultimoPag.get(p.cod)!.pago < p.pago)) ultimoPag.set(p.cod, p)
  const porCod = new Map<string, HotEvt>()
  const wsDoCod = new Map<string, string>()
  for (const e of estados) { if (e.workspaceId) wsDoCod.set(e.cod, e.workspaceId); const a = porCod.get(e.cod); if (!a || new Date(a.quando) < new Date(e.quando)) porCod.set(e.cod, e) }
  return [...porCod.values()].map(e => {
    const up = ultimoPag.get(e.cod)
    const valor = up?.bruto ?? 0
    const situacao = situacaoHotmart(e.st)
    const workspaceId = e.workspaceId ?? wsDoCod.get(e.cod) ?? null
    const pagou = !!up, migrou = situacao !== 'ATIVA' && migrouAsaas({ email: e.email, workspaceId })
    const recente = Date.now() - new Date(e.quando).getTime() <= JANELA_ATRASO_DIAS * 86400_000
    // em atraso na Hotmart só é INADIMPLENTE quem já pagou, atrasou há pouco e não migrou; o resto é outra coisa
    const balde = situacao === 'ATIVA' ? 'ATIVA' : situacao === 'CANCELADA' ? (migrou ? 'MIGROU' : 'CANCELADA')
      : migrou ? 'MIGROU' : !pagou ? 'NUNCA_PAGOU' : recente ? 'INADIMPLENTE' : 'PERDIDA'
    return { pagou, inadimplente: balde === 'INADIMPLENTE', balde, cod: e.cod, email: e.email, workspaceId, situacao, anual: ehAnualHot(e.plano ?? up?.plano ?? null, valor), valor, proxima: e.proxima ? new Date(e.proxima) : null,
      ultimoEvento: e.evento, quando: new Date(e.quando), migrou }
  })
}

// ── o painel ─────────────────────────────────────────────────────────────────────────────────────────────────────
export async function painelReceitas(p: Periodo) {
  const [wss, cobs, subs, hpags, hest, sync] = await withRetry(() => Promise.all([
    lerWorkspaces(), lerCobrancas(), lerAssinaturas(), lerPagamentosHotmart(), lerEstadosHotmart(),
    prisma.$queryRaw<{ asaasUltimoEvento: Date | null; hotmartUltimoEvento: Date | null; hotmartUltimoSync: Date | null; hotmartEspelho: number }[]>`SELECT
      (SELECT MAX("createdAt") FROM "AsaasWebhookEvento") AS "asaasUltimoEvento",
      (SELECT MAX("createdAt") FROM "HotmartEvent") AS "hotmartUltimoEvento",
      (SELECT MAX("atualizadoEm") FROM "HotmartAssinatura") AS "hotmartUltimoSync",
      (SELECT COUNT(*)::int FROM "HotmartAssinatura") AS "hotmartEspelho"`,
  ]), 'receitas')
  const ws = new Map(wss.map(w => [w.id, w]))
  const hoje = inicioDoDiaSP(new Date())

  // ASAAS — ativas = conta ATIVA de origem asaas; valor/ciclo pela assinatura ACTIVE (ou pelo último pagamento)
  const subAtivaPorWs = new Map<string, SubRow>()
  for (const s of subs) if (s.workspaceId && s.status === 'ACTIVE') { const a = subAtivaPorWs.get(s.workspaceId); if (!a || a.createdAt < s.createdAt) subAtivaPorWs.set(s.workspaceId, s) }
  const pagos = cobs.filter(c => PAGO_ASAAS.has(c.status))
  const ultimoPagoPorWs = new Map<string, CobRow>()
  for (const c of pagos) if (c.workspaceId) { const a = ultimoPagoPorWs.get(c.workspaceId); const d = c.pago ?? c.updatedAt; if (!a || (a.pago ?? a.updatedAt) < d) ultimoPagoPorWs.set(c.workspaceId, c) }
  const ativasAsaas: { id: string; anual: boolean; valor: number; semCobranca: boolean }[] = []
  for (const w of wss) {
    if (w.status !== 'ATIVA' || w.origem !== 'asaas') continue
    const s = subAtivaPorWs.get(w.id), up = ultimoPagoPorWs.get(w.id)
    const valor = s?.valor ?? up?.valor ?? 0
    const anual = s ? ehAnualAsaas(s.ciclo, s.valor) : w.ciclo === 'ANUAL' || valor >= ANUAL_MIN
    ativasAsaas.push({ id: w.id, anual, valor, semCobranca: !s && !up })
  }
  const pagantesAsaas = ativasAsaas.filter(a => !a.semCobranca)
  const emailsAsaasAtiva = new Set(ativasAsaas.map(a => ws.get(a.id)?.email).filter((e): e is string => !!e))
  const wsAsaasAtiva = new Set(ativasAsaas.map(a => a.id))
  const migrouAsaas: Migrou = x => (!!x.workspaceId && wsAsaasAtiva.has(x.workspaceId)) || (!!x.email && emailsAsaasAtiva.has(x.email))

  // HOTMART
  const hpagsValidos = hpags.filter(x => !x.estornada)
  const assinHot = consolidarHotmart(hest, hpags, migrouAsaas)
  const ativasHot = assinHot.filter(a => a.situacao === 'ATIVA')

  // MRR (valor real de cada assinatura; anual ÷ 12)
  const mrrDe = (xs: { anual: boolean; valor: number }[]) => r2(xs.reduce((s, x) => s + (x.anual ? x.valor / 12 : x.valor), 0))
  const asaasMensais = pagantesAsaas.filter(a => !a.anual), asaasAnuais = pagantesAsaas.filter(a => a.anual)
  const hotMensais = ativasHot.filter(a => !a.anual), hotAnuais = ativasHot.filter(a => a.anual)
  const mrrAsaas = mrrDe(pagantesAsaas), mrrHot = mrrDe(ativasHot)
  const mrr = r2(mrrAsaas + mrrHot)
  const mrrAnual = r2(mrrDe(asaasAnuais) + mrrDe(hotAnuais))

  // ativas únicas (a mesma pessoa nos dois gateways conta 1x — por e-mail)
  const emailsAtivos = new Set<string>(), semEmail = { n: 0 }
  for (const a of pagantesAsaas) { const e = ws.get(a.id)?.email; if (e) emailsAtivos.add(e); else semEmail.n++ }
  let sobreposicao = 0
  for (const a of ativasHot) {
    const emailWs = a.workspaceId ? ws.get(a.workspaceId)?.email : null
    if ((a.workspaceId && wsAsaasAtiva.has(a.workspaceId)) || (a.email && emailsAtivos.has(a.email)) || (emailWs && emailsAtivos.has(emailWs))) { sobreposicao++; continue }
    if (a.email) emailsAtivos.add(a.email); else semEmail.n++
  }

  // FATURAMENTO (caixa) no período
  const pagosPeriodo = pagos.filter(c => noPeriodo(c.pago ?? c.updatedAt, p))
  const hotPeriodo = hpagsValidos.filter(x => noPeriodo(x.pago, p))
  const somaA = (xs: CobRow[]) => ({ bruto: r2(xs.reduce((s, c) => s + num(c.valor), 0)), liquido: r2(xs.reduce((s, c) => s + num(c.liquido ?? c.valor), 0)), n: xs.length })
  const somaH = (xs: HotPag[]) => ({ bruto: r2(xs.reduce((s, c) => s + c.bruto, 0)), liquido: r2(xs.reduce((s, c) => s + c.liquido, 0)), n: xs.length })
  const fatAsaas = somaA(pagosPeriodo), fatHot = somaH(hotPeriodo)
  const fatAnualAsaas = somaA(pagosPeriodo.filter(c => num(c.valor) >= ANUAL_MIN)), fatAnualHot = somaH(hotPeriodo.filter(x => ehAnualHot(x.plano, x.bruto)))
  const estornosPeriodo = { asaas: cobs.filter(c => c.status === 'REFUNDED' && noPeriodo(c.updatedAt, p)).length, hotmart: hpags.filter(x => x.estornada && noPeriodo(x.pago, p)).length }

  // INADIMPLÊNCIA — Asaas: cobrança vencida (OVERDUE, ou PENDING com vencimento passado)
  const vencidas = cobs.filter(c => c.status === 'OVERDUE' || (c.status === 'PENDING' && c.vencimento && new Date(c.vencimento) < hoje))
  const porWsVenc = new Map<string, { valor: number; maisAntigo: Date | null; n: number }>()
  for (const c of vencidas) {
    if (!c.workspaceId) continue
    const a = porWsVenc.get(c.workspaceId) ?? { valor: 0, maisAntigo: null, n: 0 }
    a.valor += num(c.valor); a.n++
    const v = c.vencimento ? new Date(c.vencimento) : null
    if (v && (!a.maisAntigo || v < a.maisAntigo)) a.maisAntigo = v
    porWsVenc.set(c.workspaceId, a)
  }
  const listaInad: { gateway: Gateway; workspaceId: string | null; nome: string | null; email: string | null; valor: number; vencimento: Date | null; cobrancas: number; situacaoConta: string | null; cobravel: boolean }[] = []
  for (const [id, a] of porWsVenc) {
    const w = ws.get(id)
    const cobravel = w?.status === 'ATIVA' || w?.status === 'INADIMPLENTE' || w?.status === 'TRIAL'
    listaInad.push({ gateway: 'asaas', workspaceId: id, nome: w?.nome?.trim() ?? null, email: w?.email ?? null, valor: r2(a.valor), vencimento: a.maisAntigo, cobrancas: a.n, situacaoConta: w?.status ?? null, cobravel })
  }
  const wsPorEmail = new Map<string, WsRow>(); for (const w of wss) if (w.email && !wsPorEmail.has(w.email)) wsPorEmail.set(w.email, w)
  for (const a of assinHot.filter(x => x.inadimplente)) {
    const w = (a.workspaceId ? ws.get(a.workspaceId) : undefined) ?? (a.email ? wsPorEmail.get(a.email) : undefined)
    listaInad.push({ gateway: 'hotmart', workspaceId: w?.id ?? null, nome: w?.nome?.trim() ?? null, email: a.email, valor: r2(a.valor), vencimento: a.quando, cobrancas: 1, situacaoConta: w?.status ?? null, cobravel: w?.status !== 'CANCELADA' })
  }
  listaInad.sort((x, y) => Number(y.cobravel) - Number(x.cobravel) || y.valor - x.valor)
  const inadAgora = listaInad.filter(x => x.cobravel)
  const novosInad = (de: Date, ate: Date) => {
    const per = { de, ate, rotulo: '' }
    const a = vencidas.filter(c => c.vencimento && noPeriodo(new Date(c.vencimento), per))
    const pagaram = new Set(assinHot.filter(a => a.pagou).map(a => a.cod))
    const h = hest.filter(e => e.evento === 'PURCHASE_DELAYED' && noPeriodo(new Date(e.quando), per) && !migrouAsaas(e) && pagaram.has(e.cod))
    const codsH = new Set(h.map(e => e.cod))
    return { contas: new Set(a.map(c => c.workspaceId)).size + codsH.size, valor: r2(a.reduce((s, c) => s + num(c.valor), 0) + [...codsH].reduce((s, cod) => s + (assinHot.find(x => x.cod === cod)?.valor ?? 0), 0)) }
  }
  const umDia = 86400_000
  const inadNovos = { periodo: novosInad(p.de, p.ate), semana: novosInad(new Date(hoje.getTime() - 6 * umDia), new Date(hoje.getTime() + umDia)), mes: novosInad(resolverPeriodo('mes').de, new Date(hoje.getTime() + umDia)), ano: novosInad(resolverPeriodo('ano').de, new Date(hoje.getTime() + umDia)) }

  // NOVAS × CHURN no período
  const primeiroPagoAsaas = new Map<string, Date>()
  for (const c of pagos) if (c.workspaceId) { const d = c.pago ?? c.updatedAt; const a = primeiroPagoAsaas.get(c.workspaceId); if (!a || d < a) primeiroPagoAsaas.set(c.workspaceId, d) }
  const primeiroPagoHot = new Map<string, Date>()
  for (const x of hpagsValidos) if (x.cod) { const a = primeiroPagoHot.get(x.cod); if (!a || x.pago < a) primeiroPagoHot.set(x.cod, x.pago) }
  const cancAsaas = subs.filter(s => (s.status === 'CANCELADA' || s.status === 'CANCELLED') && noPeriodo(s.canceladaEm ?? s.updatedAt, p))
  const cortesAsaas = wss.filter(w => w.origem === 'asaas' && w.status === 'CORTADA' && noPeriodo(w.corteEm ? new Date(w.corteEm) : null, p))
  const cancHotEv = hest.filter(e => ['SUBSCRIPTION_CANCELLATION', 'PURCHASE_CANCELED', 'PURCHASE_EXPIRED', 'PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'].includes(e.evento) && noPeriodo(new Date(e.quando), p))
  const codsCancHot = new Set(cancHotEv.filter(e => !migrouAsaas(e)).map(e => e.cod))
  const migraramHot = new Set(cancHotEv.filter(e => migrouAsaas(e)).map(e => e.cod))
  const novas = { asaas: [...primeiroPagoAsaas.values()].filter(d => noPeriodo(d, p)).length, hotmart: [...primeiroPagoHot.values()].filter(d => noPeriodo(d, p)).length }
  const churn = { asaasCanceladas: new Set(cancAsaas.map(s => s.workspaceId)).size, asaasCortadas: cortesAsaas.length, hotmart: codsCancHot.size, hotmartMigraram: migraramHot.size }

  // TENDÊNCIA — 12 meses
  const meses: string[] = []
  { const l = new Date(hoje.getTime() + TZ); for (let i = 11; i >= 0; i--) { const d = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() - i, 15)); meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`) } }
  const tend = new Map(meses.map(m => [m, { mes: m, asaasBruto: 0, asaasLiquido: 0, hotmartBruto: 0, hotmartLiquido: 0, novas: 0, churn: 0, inadimplencia: 0, inadimplentes: 0 }]))
  for (const c of pagos) { const t = tend.get(mesDe(c.pago ?? c.updatedAt)); if (t) { t.asaasBruto += num(c.valor); t.asaasLiquido += num(c.liquido ?? c.valor) } }
  for (const x of hpagsValidos) { const t = tend.get(mesDe(x.pago)); if (t) { t.hotmartBruto += x.bruto; t.hotmartLiquido += x.liquido } }
  for (const d of [...primeiroPagoAsaas.values(), ...primeiroPagoHot.values()]) { const t = tend.get(mesDe(d)); if (t) t.novas++ }
  for (const s of subs) if ((s.status === 'CANCELADA' || s.status === 'CANCELLED')) { const t = tend.get(mesDe(s.canceladaEm ?? s.updatedAt)); if (t) t.churn++ }
  for (const w of wss) if (w.origem === 'asaas' && w.status === 'CORTADA' && w.corteEm) { const t = tend.get(mesDe(new Date(w.corteEm))); if (t) t.churn++ }
  { const vistos = new Set<string>(); for (const e of hest) if (['SUBSCRIPTION_CANCELLATION', 'PURCHASE_CANCELED', 'PURCHASE_EXPIRED'].includes(e.evento) && !migrouAsaas(e)) { const k = `${e.cod}:${mesDe(new Date(e.quando))}`; if (vistos.has(k)) continue; vistos.add(k); const t = tend.get(mesDe(new Date(e.quando))); if (t) t.churn++ } }
  for (const c of vencidas) if (c.vencimento) { const t = tend.get(mesDe(new Date(c.vencimento))); if (t) { t.inadimplencia += num(c.valor); t.inadimplentes++ } }
  const tendencia = [...tend.values()].map(t => ({ ...t, asaasBruto: r2(t.asaasBruto), asaasLiquido: r2(t.asaasLiquido), hotmartBruto: r2(t.hotmartBruto), hotmartLiquido: r2(t.hotmartLiquido), inadimplencia: r2(t.inadimplencia) }))

  // ADD-ONS (Pessoal) — fora do MRR do plano, mostrado à parte
  const [addons] = await withRetry(() => prisma.$queryRaw<{ pessoalAtivas: number; pessoalMrr: number; marketplacesAtivas: number; marketplacesMrr: number }[]>`SELECT
    (SELECT COUNT(*)::int FROM "PessoalAssinatura" WHERE "status" = 'ATIVA') AS "pessoalAtivas",
    (SELECT COALESCE(SUM("valor"), 0)::float FROM "PessoalAssinatura" WHERE "status" = 'ATIVA') AS "pessoalMrr",
    (SELECT COUNT(*)::int FROM "MarketplaceAssinatura" WHERE "status" IN ('ATIVA', 'ACTIVE')) AS "marketplacesAtivas",
    (SELECT COALESCE(SUM("valor"), 0)::float FROM "MarketplaceAssinatura" WHERE "status" IN ('ATIVA', 'ACTIVE')) AS "marketplacesMrr"`, 'receitas-addons')

  const totLiq = fatAsaas.liquido + fatHot.liquido
  return {
    periodo: { de: p.de, ate: p.ate, rotulo: p.rotulo },
    comercial: {
      faturamento: { bruto: r2(fatAsaas.bruto + fatHot.bruto), liquido: r2(totLiq), pagamentos: fatAsaas.n + fatHot.n },
      mrr, arr: r2(mrr * 12),
      anual: {
        ativas: asaasAnuais.length + hotAnuais.length,
        faturamentoPeriodo: { bruto: r2(fatAnualAsaas.bruto + fatAnualHot.bruto), liquido: r2(fatAnualAsaas.liquido + fatAnualHot.liquido) },
        mrrAnual, pctMrr: mrr ? Math.round((mrrAnual / mrr) * 1000) / 10 : 0,
      },
    },
    resumo: {
      ativas: { total: emailsAtivos.size + semEmail.n, asaas: pagantesAsaas.length, hotmart: ativasHot.length, sobreposicao },
      inadimplentesAgora: { contas: inadAgora.length, valor: r2(inadAgora.reduce((s, x) => s + x.valor, 0)) },
      novosInadimplentes: inadNovos,
      novas, churn, estornos: estornosPeriodo,
    },
    asaas: {
      ativas: { total: pagantesAsaas.length, mensais: asaasMensais.length, anuais: asaasAnuais.length, mrrMensais: mrrDe(asaasMensais), mrrAnuais: mrrDe(asaasAnuais), mrr: mrrAsaas },
      ativasSemCobranca: ativasAsaas.filter(a => a.semCobranca).length,
      receitaPeriodo: fatAsaas,
      receitaMes: somaA(pagos.filter(c => noPeriodo(c.pago ?? c.updatedAt, resolverPeriodo('mes')))),
      receitaAno: somaA(pagos.filter(c => noPeriodo(c.pago ?? c.updatedAt, resolverPeriodo('ano')))),
      emAberto: { cobravel: r2(listaInad.filter(x => x.gateway === 'asaas' && x.cobravel).reduce((s, x) => s + x.valor, 0)), contasCobraveis: listaInad.filter(x => x.gateway === 'asaas' && x.cobravel).length, deCortadas: r2(listaInad.filter(x => x.gateway === 'asaas' && !x.cobravel).reduce((s, x) => s + x.valor, 0)) },
      canceladasPeriodo: churn.asaasCanceladas, cortadasPeriodo: churn.asaasCortadas,
      contasNoBanco: { ativa: wss.filter(w => w.origem === 'asaas' && w.status === 'ATIVA').length, inadimplente: wss.filter(w => w.origem === 'asaas' && w.status === 'INADIMPLENTE').length },
    },
    hotmart: {
      ativas: { total: ativasHot.length, mensais: hotMensais.length, anuais: hotAnuais.length, mrrMensais: mrrDe(hotMensais), mrrAnuais: mrrDe(hotAnuais), mrr: mrrHot },
      receitaPeriodo: fatHot,
      receitaMes: somaH(hpagsValidos.filter(x => noPeriodo(x.pago, resolverPeriodo('mes')))),
      receitaAno: somaH(hpagsValidos.filter(x => noPeriodo(x.pago, resolverPeriodo('ano')))),
      comissaoHotmartPeriodo: r2(fatHot.bruto - fatHot.liquido),
      inadimplentes: assinHot.filter(a => a.inadimplente).length,
      emAberto: r2(assinHot.filter(a => a.inadimplente).reduce((s, a) => s + a.valor, 0)),
      inadimplentesComAcesso: assinHot.filter(a => a.inadimplente && a.workspaceId && ws.get(a.workspaceId)?.status === 'ATIVA').length,
      nuncaPagaram: assinHot.filter(a => a.balde === 'NUNCA_PAGOU').length,
      perdidas: assinHot.filter(a => a.balde === 'PERDIDA').length,
      migraram: assinHot.filter(a => a.balde === 'MIGROU').length,
      canceladasPeriodo: churn.hotmart, migraramPeriodo: churn.hotmartMigraram,
      contasNoBanco: { ativa: wss.filter(w => w.origem === 'hotmart' && w.status === 'ATIVA').length },
    },
    porPlano: {
      mensais: { asaas: asaasMensais.length, hotmart: hotMensais.length, mrr: r2(mrrDe(asaasMensais) + mrrDe(hotMensais)) },
      anuais: { asaas: asaasAnuais.length, hotmart: hotAnuais.length, mrr: mrrAnual },
    },
    addons,
    inadimplencia: listaInad.slice(0, 300),
    tendencia,
    sync: { ...sync[0], hotmartCredencial: !!(process.env.HOTMART_CLIENT_ID && process.env.HOTMART_CLIENT_SECRET) },
  }
}

// ── busca e perfil de uma assinante ─────────────────────────────────────────────────────────────────────────────
export async function buscarAssinantes(q: string) {
  const termo = `%${q.trim().toLowerCase()}%`
  return withRetry(() => prisma.$queryRaw<{ id: string; nome: string; status: string | null; origem: string | null; email: string | null; pessoa: string | null }[]>`
    SELECT w."id", w."nome", w."assinaturaStatus" AS status, w."assinaturaOrigem" AS origem,
           (SELECT lower(u."email") FROM "User" u WHERE u."workspaceId" = w."id" AND u."role" = 'ADMIN' ORDER BY u."createdAt" LIMIT 1) AS email,
           (SELECT u."nome" FROM "User" u WHERE u."workspaceId" = w."id" AND u."role" = 'ADMIN' ORDER BY u."createdAt" LIMIT 1) AS pessoa
    FROM "Workspace" w
    WHERE w."id" = ${q.trim()}
       OR lower(w."nome") LIKE ${termo}
       OR EXISTS (SELECT 1 FROM "User" u WHERE u."workspaceId" = w."id" AND (lower(u."email") LIKE ${termo} OR lower(u."nome") LIKE ${termo}))
       OR EXISTS (SELECT 1 FROM "AsaasCliente" c WHERE c."workspaceId" = w."id" AND (lower(c."email") LIKE ${termo} OR lower(c."nome") LIKE ${termo}))
    ORDER BY (w."assinaturaStatus" = 'ATIVA') DESC, w."nome"
    LIMIT 30`, 'receitas-busca')
}

export async function perfilAssinante(workspaceId: string) {
  const [w] = await withRetry(() => prisma.$queryRaw<{ id: string; nome: string; whatsapp: string | null; status: string | null; origem: string | null; ciclo: string | null; createdAt: Date; assinaturaExpira: Date | null; liberacaoManual: boolean | null; cortesia: Date | null }[]>`
    SELECT w."id", w."nome", w."whatsapp", w."assinaturaStatus" AS status, w."assinaturaOrigem" AS origem, w."cicloAssinatura" AS ciclo,
           w."createdAt", w."assinaturaExpira", w."liberacaoManual", w."cortesiaAtivadaEm" AS cortesia
    FROM "Workspace" w WHERE w."id" = ${workspaceId}`, 'receitas-perfil')
  if (!w) return null
  const usuarios = await prisma.$queryRaw<{ email: string; nome: string; role: string }[]>`SELECT lower("email") AS email, "nome", "role" FROM "User" WHERE "workspaceId" = ${workspaceId} ORDER BY ("role" = 'ADMIN') DESC, "createdAt"`
  const emails = [...new Set(usuarios.map(u => u.email).filter(Boolean))]
  const [cobs, subs, hpags, hest] = await withRetry(() => Promise.all([lerCobrancas(workspaceId), lerAssinaturas(workspaceId), emails.length ? lerPagamentosHotmart(emails) : Promise.resolve([]), emails.length ? lerEstadosHotmart(emails) : Promise.resolve([])]), 'receitas-perfil-hist')
  const hoje = inicioDoDiaSP(new Date())
  const historico = [
    ...cobs.map(c => ({ gateway: 'asaas' as const, id: c.paymentId, vencimento: c.vencimento, pagamento: PAGO_ASAAS.has(c.status) ? (c.pago ?? c.updatedAt) : null,
      bruto: num(c.valor), liquido: c.liquido == null ? null : num(c.liquido), forma: c.billingType, status: statusExibicaoAsaas(c.status, c.vencimento ? new Date(c.vencimento) : null), invoiceUrl: c.invoiceUrl })),
    ...hpags.map(x => ({ gateway: 'hotmart' as const, id: x.transacao, vencimento: x.pago, pagamento: x.pago, bruto: x.bruto, liquido: x.liquido, forma: x.forma, status: x.estornada ? 'ESTORNADO' : 'RECEBIDO', invoiceUrl: null as string | null })),
    // a Hotmart tenta a mesma cobrança várias vezes: 1 linha "vencido" por assinatura por mês (a mais recente)
    ...[...new Map(hest.filter(e => e.evento === 'PURCHASE_DELAYED').sort((a, b) => +new Date(a.quando) - +new Date(b.quando)).map(e => [`${e.cod}:${mesDe(new Date(e.quando))}`, e])).values()].map(e => ({ gateway: 'hotmart' as const, id: `atraso:${e.cod}:${new Date(e.quando).toISOString().slice(0, 10)}`, vencimento: new Date(e.quando), pagamento: null, bruto: 0, liquido: null, forma: null, status: 'VENCIDO', invoiceUrl: null as string | null })),
  ].sort((a, b) => +new Date(b.vencimento ?? b.pagamento ?? 0) - +new Date(a.vencimento ?? a.pagamento ?? 0))
  // atraso da Hotmart sem valor: usa o valor do último pagamento do assinante
  const ultimoBrutoHot = hpags.filter(x => !x.estornada).sort((a, b) => +b.pago - +a.pago)[0]?.bruto ?? 0
  for (const h of historico) if (h.gateway === 'hotmart' && h.status === 'VENCIDO' && !h.bruto) h.bruto = ultimoBrutoHot
  const proximas = cobs.filter(c => c.status === 'PENDING' && c.vencimento && new Date(c.vencimento) >= hoje)
    .map(c => ({ gateway: 'asaas', vencimento: c.vencimento, valor: num(c.valor), invoiceUrl: c.invoiceUrl }))
  const assinHot = consolidarHotmart(hest, hpags, () => false)
  for (const a of assinHot) if (a.situacao === 'ATIVA' && a.proxima && a.proxima >= hoje) proximas.push({ gateway: 'hotmart', vencimento: a.proxima, valor: a.valor, invoiceUrl: null })
  const subAtiva = subs.filter(s => s.status === 'ACTIVE').sort((a, b) => +b.createdAt - +a.createdAt)[0]
  const pagosH = historico.filter(h => h.status === 'RECEBIDO')
  const hotVigente = assinHot.find(a => a.situacao === 'ATIVA') ?? assinHot.find(a => a.situacao === 'ATRASO')
  const valorAtual = subAtiva?.valor ?? hotVigente?.valor ?? null
  const anual = subAtiva ? ehAnualAsaas(subAtiva.ciclo, subAtiva.valor) : w.ciclo === 'ANUAL' || !!hotVigente?.anual
  const datas = pagosH.map(h => +new Date(h.pagamento!)).sort((a, b) => a - b)
  return {
    dados: {
      id: w.id, nome: w.nome?.trim(), email: emails[0] ?? null, pessoa: usuarios[0]?.nome ?? null, telefone: w.whatsapp ?? null,
      plano: valorAtual == null ? null : `${anual ? 'ANUAL' : 'MENSAL'}${!subAtiva && hotVigente?.situacao === 'ATRASO' ? ' · em atraso na Hotmart' : ''}`, valorAtual, status: w.status, origem: w.origem,
      adesao: datas.length ? new Date(datas[0]) : w.createdAt, contaCriadaEm: w.createdAt,
      proximoVencimento: proximas.map(x => x.vencimento).filter(Boolean).sort((a, b) => +new Date(a!) - +new Date(b!))[0] ?? subAtiva?.proximo ?? null,
      cortesia: !!w.cortesia || !!w.liberacaoManual, acessoAte: w.assinaturaExpira ?? null,
      assinaturasAsaas: subs.map(s => ({ id: s.subscriptionId, status: s.status, ciclo: s.ciclo, valor: s.valor, proximo: s.proximo, canceladaEm: s.canceladaEm })),
      assinaturasHotmart: assinHot.map(a => ({ codigo: a.cod, situacao: a.situacao, anual: a.anual, valor: a.valor, proxima: a.proxima, ultimoEvento: a.ultimoEvento })),
    },
    historico,
    proximas: proximas.sort((a, b) => +new Date(a.vencimento!) - +new Date(b.vencimento!)),
    totais: {
      pagoLiquido: r2(pagosH.reduce((s, h) => s + num(h.liquido ?? h.bruto), 0)),
      pagoBruto: r2(pagosH.reduce((s, h) => s + num(h.bruto), 0)),
      mesesPagos: new Set(pagosH.map(h => mesDe(new Date(h.pagamento!)))).size,
      primeira: datas.length ? new Date(datas[0]) : null, ultima: datas.length ? new Date(datas[datas.length - 1]) : null,
    },
  }
}

// ── "Atualizar do gateway": AO VIVO, só UMA assinante (poucas chamadas, devagar) ────────────────────────────────
// Escreve SÓ no espelho, e com cuidado:
//   - cobrança que já existe → status / líquido / data de pagamento / fatura (o mesmo que o webhook faria);
//   - cobrança que falta no espelho → só entra se estiver PAGA ou ESTORNADA (pendente/vencida nova NÃO entra no
//     espelho, para não disparar a régua de cobrança daqui — ela aparece só na resposta, marcada "ao vivo");
//   - assinatura Asaas: nada é gravado (o status dela comanda acesso); vai só na resposta;
//   - Hotmart: upsert em HotmartAssinatura (igual ao sync), se houver credencial.
// Nenhuma cobrança, estorno ou cancelamento sai daqui.

const devagar = () => new Promise(r => setTimeout(r, 400))
const dataAsaas = (d?: string | null) => (d ? new Date(`${d}T12:00:00-03:00`) : null)
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

interface PagAsaas { id: string; subscription?: string | null; status: string; billingType?: string; value: number; netValue?: number; dueDate?: string; paymentDate?: string | null; confirmedDate?: string | null; clientPaymentDate?: string | null; invoiceUrl?: string | null; deleted?: boolean; description?: string | null }
interface SubAsaas { id: string; status: string; cycle?: string; value: number; nextDueDate?: string; deleted?: boolean }

export async function atualizarDoGateway(workspaceId: string) {
  const avisos: string[] = []
  const usuarios = await prisma.$queryRaw<{ email: string }[]>`SELECT DISTINCT lower("email") AS email FROM "User" WHERE "workspaceId" = ${workspaceId}`
  const emails = usuarios.map(u => u.email).filter(Boolean)
  const locais = await prisma.$queryRaw<{ customerId: string }[]>`
    SELECT "customerId" FROM "AsaasCliente" WHERE "workspaceId" = ${workspaceId}
    UNION SELECT "customerId" FROM "AsaasAssinatura" WHERE "workspaceId" = ${workspaceId} AND "customerId" IS NOT NULL`
  const clientes = new Set(locais.map(c => c.customerId))
  // clientes criados direto no checkout/painel (sem vínculo local) — pelo e-mail
  for (const e of emails.slice(0, 3)) {
    await devagar()
    const r = await chamarAsaas<{ data: { id: string }[] }>(`/customers?email=${encodeURIComponent(e)}&limit=10`)
    if (r.ok) for (const c of r.dados?.data ?? []) clientes.add(c.id)
    else if (!r.pendente) avisos.push(`Asaas (clientes): ${r.erro}`)
    else { avisos.push(`Asaas: ${r.erro}`); break }
  }
  let atualizadas = 0, inseridas = 0
  const aoVivo: { gateway: 'asaas'; id: string; status: string; valor: number; vencimento: string | null; invoiceUrl: string | null }[] = []
  const assinaturasAoVivo: { id: string; status: string; ciclo: string | null; valor: number; proximo: string | null }[] = []
  let telefone: string | null = null
  for (const cus of [...clientes].slice(0, 5)) {
    await devagar()
    const pr = await chamarAsaas<{ data: PagAsaas[] }>(`/payments?customer=${encodeURIComponent(cus)}&limit=100`)
    if (!pr.ok) { avisos.push(`Asaas (pagamentos): ${pr.erro}`); continue }
    for (const p of pr.dados?.data ?? []) {
      if (p.deleted) continue
      const pago = dataAsaas(p.paymentDate ?? p.clientPaymentDate ?? p.confirmedDate)
      const n = await prisma.$executeRaw`
        UPDATE "AsaasCobranca" SET "status" = ${p.status}, "valorLiquido" = COALESCE(${p.netValue ?? null}::numeric, "valorLiquido"),
               "pagoEm" = COALESCE("pagoEm", ${pago}), "invoiceUrl" = COALESCE(${p.invoiceUrl ?? null}, "invoiceUrl"),
               "billingType" = COALESCE(${p.billingType ?? null}, "billingType"), "updatedAt" = NOW()
        WHERE "paymentId" = ${p.id}`
      if (n) { atualizadas++; continue }
      if (PAGO_ASAAS.has(p.status) || p.status === 'REFUNDED') {
        await prisma.$executeRaw`
          INSERT INTO "AsaasCobranca" ("id","workspaceId","paymentId","subscriptionId","sandbox","finalidade","billingType","valor","valorLiquido","status","vencimento","pagoEm","invoiceUrl","createdAt","updatedAt")
          VALUES (${gid()}, ${workspaceId}, ${p.id}, ${p.subscription ?? null}, false, ${p.subscription ? 'assinatura' : 'avulsa'}, ${p.billingType ?? null},
                  ${p.value}, ${p.netValue ?? null}, ${p.status}, ${dataAsaas(p.dueDate)}, ${pago}, ${p.invoiceUrl ?? null}, NOW(), NOW())
          ON CONFLICT ("paymentId") DO NOTHING`
        inseridas++
      } else aoVivo.push({ gateway: 'asaas', id: p.id, status: p.status, valor: p.value, vencimento: p.dueDate ?? null, invoiceUrl: p.invoiceUrl ?? null })
    }
    await devagar()
    const sr = await chamarAsaas<{ data: SubAsaas[] }>(`/subscriptions?customer=${encodeURIComponent(cus)}&limit=20`)
    if (sr.ok) for (const s of sr.dados?.data ?? []) assinaturasAoVivo.push({ id: s.id, status: s.deleted ? 'DELETED' : s.status, ciclo: s.cycle ?? null, valor: s.value, proximo: s.nextDueDate ?? null })
    if (!telefone) {
      await devagar()
      const cr = await chamarAsaas<{ mobilePhone?: string | null; phone?: string | null }>(`/customers/${encodeURIComponent(cus)}`)
      if (cr.ok) telefone = cr.dados?.mobilePhone || cr.dados?.phone || null
    }
  }
  // Hotmart (se tiver credencial) — mesmo upsert do sync
  let hotmart: 'ok' | 'sem_credencial' | 'erro' = 'sem_credencial'
  if (hotmartComCredencial()) {
    hotmart = 'ok'
    for (const e of emails.slice(0, 3)) {
      try {
        for (const a of await assinaturasPorEmail(e)) {
          await prisma.$executeRaw`
            INSERT INTO "HotmartAssinatura" ("id","codigo","email","nomeAssinante","planoId","planoNome","status","valor","moeda","adesao","proximaCobranca","atualizadoEm")
            VALUES (${gid()}, ${a.codigo}, ${a.email}, ${a.nomeAssinante}, ${a.planoId}, ${a.planoNome}, ${a.status}, ${a.valor}, ${a.moeda}, ${a.adesao}, ${a.proximaCobranca}, NOW())
            ON CONFLICT ("codigo") DO UPDATE SET "email" = EXCLUDED."email", "nomeAssinante" = EXCLUDED."nomeAssinante", "planoId" = EXCLUDED."planoId",
              "planoNome" = EXCLUDED."planoNome", "status" = EXCLUDED."status", "valor" = EXCLUDED."valor", "moeda" = EXCLUDED."moeda",
              "adesao" = EXCLUDED."adesao", "proximaCobranca" = EXCLUDED."proximaCobranca", "atualizadoEm" = NOW()`
        }
      } catch (err) { hotmart = 'erro'; avisos.push(`Hotmart: ${(err as Error).message}`) }
    }
  }
  return { atualizadoEm: new Date(), clientesAsaas: clientes.size, atualizadas, inseridas, aoVivo, assinaturasAoVivo, telefone, hotmart, avisos }
}
