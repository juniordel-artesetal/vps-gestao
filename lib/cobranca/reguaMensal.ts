// RÉGUA DAS MENSALIDADES (16/10/2026, pedido do Júnior) — vale para TODAS as soluções mensais pagas no Asaas:
// SOA, Método Mãe, Pessoal e Marketplaces.
//   • ANTES de vencer: lembrete 5, 3 e 1 dia antes e no dia (no cartão, que cobra sozinho: só 5 dias antes e no dia);
//     no Pix avulso do SOA, o da véspera convida a cadastrar o PIX AUTOMÁTICO (mesmo valor; o avulso é cancelado sozinho);
//   • em ATRASO: e-mail no D+1 e no D+3 (último dia com acesso);
//   • D+4: o acesso é BLOQUEADO (tolerância de 3 dias — as carências dos 4 produtos são 3) e sai o e-mail avisando;
//   • depois: cobrança o mês todo (D+7, D+10 … D+28) e, passado o mês, uma vez por semana enquanto a assinatura
//     estiver viva (regra de 15/10: cobra até pagar ou cancelar — cancelada, o Asaas apaga a cobrança e ela some daqui).
// A VERDADE é o Asaas: lista as cobranças PENDENTES (vencem em até 5 dias) e VENCIDAS das assinaturas, e liga cada uma
// ao produto/conta pelo nosso banco. Um e-mail por pessoa por dia (junta os produtos dela). IDEMPOTENTE: cada item
// reserva a sua linha em "AssinaturaAviso" (workspaceId, 'MENSAL:<cobrança>:<etapa>', hoje) antes de enviar.
// Fora daqui: Hotmart (paga na Hotmart — régua própria), planos anuais, teste grátis (avisos do trial), liberação
// manual do Master e cortesias. Desligar: REGUA_MENSAL=off.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { URL_SOA } from '@/lib/baseUrl'
import { pixAutoLigado } from '@/lib/pagamento/asaas/linkPixAuto'
import { PIX_AUTOMATICO_LIBERADO } from '@/lib/pagamento/pixAutomaticoLiberado'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')
const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Dias de atraso tolerados: o acesso fica até o D+3 e é bloqueado no D+4. As carências dos produtos usam este número. */
export const TOLERANCIA_ATRASO_DIAS = 3
/** Lembretes antes do vencimento (dias que faltam). No cartão (cobra sozinho) só o 1º e o do dia. */
export const DIAS_LEMBRETE = [5, 3, 1, 0] as const
/** Valor máximo de uma mensalidade (SOA+MAE = R$ 89,80): acima disto não é mensal — guarda contra anual/avulsa. */
export const TETO_MENSAL = 100

export type Produto = 'SOA' | 'MAE' | 'PESSOAL' | 'MKT'
export type Etapa = 'LEMBRETE' | 'ATRASO' | 'ULTIMO_DIA' | 'BLOQUEIO' | 'COBRANCA'

export const NOME_PRODUTO: Record<Produto, string> = { SOA: 'SOA', MAE: 'Método Mãe', PESSOAL: 'Pessoal', MKT: 'Marketplaces' }
/** Onde ela vê/gerencia a assinatura de cada produto (sempre no domínio do SOA). */
export const PAGINA_PRODUTO: Record<Produto, string> = { SOA: '/assinatura', MAE: '/mae/assinatura', PESSOAL: '/pessoal', MKT: '/marketplace/ativar' }

/**
 * Qual etapa da régua uma cobrança está HOJE (null = nenhum e-mail hoje). Puro.
 * `diasParaVencer`: >0 faltam, 0 vence hoje, <0 dias de atraso. `noCartao`: a cobrança é automática no cartão.
 */
export function etapaDaCobranca(diasParaVencer: number, noCartao: boolean): Etapa | null {
  const d = diasParaVencer
  if (d >= 0) {
    const dias: readonly number[] = noCartao ? [5, 0] : DIAS_LEMBRETE
    return dias.includes(d) ? 'LEMBRETE' : null
  }
  const a = -d
  if (a === 1) return 'ATRASO'
  if (a === TOLERANCIA_ATRASO_DIAS) return 'ULTIMO_DIA'
  if (a === TOLERANCIA_ATRASO_DIAS + 1) return 'BLOQUEIO'
  // o mês todo: a cada 3 dias depois do bloqueio (D+7, D+10 … D+28)
  if (a > TOLERANCIA_ATRASO_DIAS + 1 && a <= 30) return (a - (TOLERANCIA_ATRASO_DIAS + 1)) % 3 === 0 ? 'COBRANCA' : null
  // depois do mês: semanal (D+35, D+42…), até pagar ou cancelar
  if (a > 30 && a <= 365) return (a - 28) % 7 === 0 ? 'COBRANCA' : null
  return null
}

/** Gravidade (para o assunto do e-mail que junta vários itens). */
const PESO: Record<Etapa, number> = { LEMBRETE: 0, ATRASO: 1, COBRANCA: 2, ULTIMO_DIA: 3, BLOQUEIO: 4 }

// ── Link de pagamento no domínio do SOA: /api/cobranca/fatura?p=<cobrança>&t=<assinatura> → fatura do Asaas ────────
export function tokenFatura(paymentId: string): string {
  return crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || 'sofia').update('fatura:' + paymentId).digest('hex').slice(0, 24)
}
export function tokenFaturaValido(paymentId: string, t: string): boolean {
  const esperado = tokenFatura(paymentId)
  try { return t.length === esperado.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(esperado)) } catch { return false }
}
export const linkFatura = (paymentId: string) => `${URL_SOA}/api/cobranca/fatura?p=${encodeURIComponent(paymentId)}&t=${tokenFatura(paymentId)}`

// ── E-mail ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface ItemEmail {
  produto: Produto
  etapa: Etapa
  valor: number
  vencimento: string           // AAAA-MM-DD
  diasParaVencer: number
  noCartao: boolean
  /** O acesso a este produto já está bloqueado (no BLOQUEIO/COBRANCA). */
  bloqueado: boolean
  paymentId: string
  /** Véspera do vencimento de um Pix "manual" do SOA: o e-mail convida a cadastrar o Pix Automático (pedido do Júnior, 16/10). */
  convitePixAuto?: boolean
}

/** Página que abre o Pix Automático do SOA (pede login se preciso). */
export const LINK_PIX_AUTO = `${URL_SOA}/assinatura/pix-automatico`

/** Véspera (D-1) de uma mensalidade do SOA paga no Pix avulso (não no cartão, não já no Pix Automático). Puro. */
export const deveConvidarPixAuto = (produto: Produto, diasParaVencer: number, billingType: string | undefined, paymentLink: string | null | undefined) =>
  produto === 'SOA' && diasParaVencer === 1 && billingType !== 'CREDIT_CARD' && !paymentLink

function linhaDoItem(i: ItemEmail): string {
  const nome = `<b>${NOME_PRODUTO[i.produto]}</b> — ${brl(i.valor)}`
  if (i.etapa === 'LEMBRETE') {
    const quando = i.diasParaVencer === 0 ? '<b>vence hoje</b>' : i.diasParaVencer === 1 ? `vence <b>amanhã</b> (${dia(i.vencimento)})` : `vence em <b>${dia(i.vencimento)}</b> (daqui a ${i.diasParaVencer} dias)`
    return `${nome} · ${quando}${i.noCartao ? ' · cobrança automática no cartão' : ''}`
  }
  const atraso = -i.diasParaVencer
  const situacao = i.bloqueado ? '<b>acesso pausado</b>' : i.etapa === 'ULTIMO_DIA' ? '<b>último dia com acesso</b>' : `acesso liberado até ${dia(somar(i.vencimento, TOLERANCIA_ATRASO_DIAS))}`
  return `${nome} · venceu em ${dia(i.vencimento)} (${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso) · ${situacao}`
}
function somar(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}

/** Assunto + HTML do e-mail do dia de uma pessoa (1 ou mais itens). Puro. */
export function montarEmailMensal(nome: string | null, itens: ItemEmail[]): { assunto: string; html: string } {
  const pior = itens.reduce((a, b) => (PESO[b.etapa] > PESO[a.etapa] ? b : a))
  const um = itens.length === 1
  const qual = um ? NOME_PRODUTO[pior.produto] : 'sua assinatura'
  const primeiro = nome ? esc(String(nome).trim().split(/\s+/)[0]) : ''
  const todosNoCartao = itens.every(i => i.noCartao)
  let assunto: string, abre: string
  const convite = itens.find(i => i.convitePixAuto && i.etapa === 'LEMBRETE')
  switch (pior.etapa) {
    case 'LEMBRETE':
      if (convite) {
        assunto = 'Amanhã vence seu Pix do SOA — que tal nunca mais precisar lembrar?'
        abre = `Amanhã vence a sua mensalidade do SOA (${brl(convite.valor)}). Em vez de pagar o Pix todo mês, cadastre o <b>Pix Automático</b>: você autoriza <b>uma vez</b> no app do seu banco e a mensalidade é debitada sozinha, sem cartão — e sem risco de esquecer e ficar sem acesso.`
        break
      }
      assunto = pior.diasParaVencer === 0 ? `Sua mensalidade ${um ? `do ${qual} ` : ''}vence hoje` : `Lembrete: sua mensalidade ${um ? `do ${qual} ` : ''}vence em ${dia(pior.vencimento)}`
      abre = todosNoCartao
        ? 'Passando para lembrar da sua mensalidade. A cobrança é <b>automática no cartão</b> — não precisa fazer nada. Se trocou de cartão ou ele estiver perto do limite, atualize antes para não ficar sem acesso.'
        : 'Passando para lembrar da sua mensalidade. Pagar antes do vencimento evita qualquer interrupção:'
      break
    case 'ATRASO':
      assunto = `O pagamento ${um ? `do ${qual} ` : ''}não entrou — deve ser coisa boba`
      abre = `O pagamento não foi aprovado. Isso acontece — geralmente é limite ou validade do cartão. <b>Seu acesso continua normal por mais ${TOLERANCIA_ATRASO_DIAS - 1} dias</b>; regularizar leva 1 minuto:`
      break
    case 'ULTIMO_DIA':
      assunto = `Último dia: amanhã o acesso ${um ? `ao ${qual} ` : ''}será pausado`
      abre = 'Hoje é o <b>último dia</b> com acesso. Amanhã ele será <b>pausado</b> — pausado, não apagado: tudo fica guardado esperando você.'
      break
    case 'BLOQUEIO':
      if (!pior.bloqueado) { assunto = `Sua mensalidade ${um ? `do ${qual} ` : ''}continua em aberto`; abre = 'O pagamento ainda não entrou. Para não perder o acesso, regularize agora (leva 1 minuto):'; break }
      assunto = `Seu acesso ${um ? `ao ${qual} ` : ''}foi pausado — voltar é simples 💛`
      abre = 'Como o pagamento não entrou em 3 dias, o acesso foi <b>pausado</b>. <b>Nada foi apagado</b>: assim que o pagamento entrar, ele reabre sozinho, com tudo no lugar.'
      break
    default:
      assunto = `Sua mensalidade ${um ? `do ${qual} ` : ''}continua em aberto`
      abre = 'Passando para lembrar: a assinatura continua ativa e o pagamento ainda está em aberto. Para regularizar (o acesso volta na hora):'
  }
  const lista = itens.map(i => `<li style="margin:6px 0">${linhaDoItem(i)}<br><a href="${linkFatura(i.paymentId)}" style="color:#ea580c;font-weight:600">${i.etapa === 'LEMBRETE' && i.noCartao ? 'Ver a fatura / trocar o cartão' : 'Pagar agora'}</a></li>`).join('')
  const emAtraso = pior.etapa !== 'LEMBRETE'
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${primeiro ? `Oi, ${primeiro}!` : 'Oi!'}</p>
    <p>${abre}</p>
    ${convite ? `<p style="text-align:center;margin:24px 0"><a href="${LINK_PIX_AUTO}" style="background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Cadastrar o Pix Automático</a></p>
    <ul style="padding-left:18px;color:#374151;font-size:14px"><li>O valor continua o mesmo: <b>${brl(convite.valor)}/mês</b>.</li><li>A mensalidade de amanhã já sai pelo Pix Automático, e o Pix avulso é cancelado sozinho — <b>não pague os dois</b>.</li><li>Cancela quando quiser, pelo próprio banco ou pelo SOA.</li></ul>
    <p style="color:#6b7280;font-size:14px">Prefere continuar como está? Tudo bem — é só pagar o Pix de amanhã normalmente:</p>` : ''}
    <ul style="padding-left:18px">${lista}</ul>
    ${um && !convite ? `<p style="text-align:center;margin:24px 0"><a href="${linkFatura(pior.paymentId)}" style="background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">${pior.etapa === 'LEMBRETE' && pior.noCartao ? 'Ver a fatura' : 'Pagar agora'}</a></p>` : ''}
    ${emAtraso ? `<p style="color:#6b7280;font-size:14px">Se não quer mais continuar, é só cancelar em <a href="${URL_SOA}${PAGINA_PRODUTO[pior.produto]}" style="color:#6b7280">Minha assinatura</a> — aí paramos de mandar estes lembretes. Se você já pagou, responda este e-mail que conferimos na hora.</p>` : '<p style="color:#6b7280;font-size:14px">Se você já pagou, pode ignorar este e-mail. Qualquer dúvida, é só responder.</p>'}
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
  </div>`.trim()
  return { assunto, html }
}

// ── Cobranças do Asaas ─────────────────────────────────────────────────────────────────────────────────────────────
export interface CobrancaAsaas {
  id: string; status: string; value: number; dueDate: string; billingType?: string; subscription?: string | null
  externalReference?: string | null; checkoutSession?: string | null; paymentLink?: string | null; deleted?: boolean
}
const dorme = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Lista as cobranças de um status com vencimento entre `de` e `ate` (paginado, 1 req/s — modo devagar). */
async function listarCobrancas(status: 'PENDING' | 'OVERDUE', de: string, ate: string): Promise<CobrancaAsaas[]> {
  const todas: CobrancaAsaas[] = []
  for (let offset = 0; offset < 5000; offset += 100) {
    const q = `status=${status}&${encodeURIComponent('dueDate[ge]')}=${de}&${encodeURIComponent('dueDate[le]')}=${ate}&limit=100&offset=${offset}`
    const r = await chamarAsaas<{ data: CobrancaAsaas[]; hasMore: boolean }>(`/payments?${q}`)
    if (!r.ok) throw new Error(`Asaas: ${r.erro}`)
    todas.push(...(r.dados?.data ?? []))
    if (!r.dados?.hasMore) break
    await dorme(1100)
  }
  return todas
}

/** A quem a cobrança pertence (produto + conta + destinatária), ou null (não é mensalidade nossa). `bloqueado`: no MAE e
 *  no Marketplaces é o acesso real; no SOA e no Pessoal é "está inadimplente" (o acesso cai sozinho depois dos 3 dias). */
export interface Dona { produto: Produto; workspaceId: string; userId: string | null; bloqueado: boolean; emDia?: boolean }

/** Liga as cobranças às contas, em lote (uma consulta por tabela). */
async function identificar(cs: CobrancaAsaas[], hoje: string): Promise<Map<string, Dona | null>> {
  const subs = [...new Set(cs.map(c => c.subscription).filter((s): s is string => !!s))]
  const checkouts = [...new Set(cs.flatMap(c => [c.checkoutSession, c.paymentLink]).filter((s): s is string => !!s))]
  const [mae, pes, mkt, soa, soaCk] = await Promise.all([
    prisma.$queryRaw<{ subscriptionId: string | null; checkoutId: string | null; workspaceId: string; ciclo: string; status: string; ate: string | null; origemMod: string | null }[]>`
      SELECT m."subscriptionId", m."checkoutId", m."workspaceId", m."ciclo", m."status", TO_CHAR(w."moduloMaeAte",'YYYY-MM-DD') AS ate, w."moduloMaeOrigem" AS "origemMod"
      FROM "MaeAssinatura" m JOIN "Workspace" w ON w."id" = m."workspaceId"
      WHERE m."subscriptionId" = ANY(${subs}) OR m."checkoutId" = ANY(${checkouts})`.catch(() => []),
    prisma.$queryRaw<{ sub: string; userId: string; workspaceId: string; status: string }[]>`
      SELECT p."asaasSubscriptionId" AS sub, p."userId", u."workspaceId", p."status"
      FROM "PessoalAssinatura" p JOIN "User" u ON u."id" = p."userId" WHERE p."asaasSubscriptionId" = ANY(${subs})`.catch(() => []),
    prisma.$queryRaw<{ sub: string; workspaceId: string; origem: string | null; ligado: boolean | null; status: string }[]>`
      SELECT m."asaasSubscriptionId" AS sub, m."workspaceId", m."origem", w."moduloMarketplaces" AS ligado, m."status"
      FROM "MarketplaceAssinatura" m JOIN "Workspace" w ON w."id" = m."workspaceId" WHERE m."asaasSubscriptionId" = ANY(${subs})`.catch(() => []),
    prisma.$queryRaw<{ sub: string; workspaceId: string; ciclo: string | null; status: string | null; origem: string | null; manual: boolean | null }[]>`
      SELECT a."subscriptionId" AS sub, a."workspaceId", a."ciclo", w."assinaturaStatus" AS status, w."assinaturaOrigem" AS origem, w."liberacaoManual" AS manual
      FROM "AsaasAssinatura" a JOIN "Workspace" w ON w."id" = a."workspaceId" WHERE a."subscriptionId" = ANY(${subs})`.catch(() => []),
    prisma.$queryRaw<{ checkoutId: string; workspaceId: string; status: string | null; origem: string | null; manual: boolean | null }[]>`
      SELECT "checkoutId", "id" AS "workspaceId", "assinaturaStatus" AS status, "assinaturaOrigem" AS origem, "liberacaoManual" AS manual
      FROM "Workspace" WHERE "checkoutId" = ANY(${checkouts})`.catch(() => []),
  ])
  const out = new Map<string, Dona | null>()
  for (const c of cs) {
    const ref = c.externalReference ?? ''
    // MÉTODO MÃE (mensal; o anual é avulso/parcelado e nem tem subscription)
    const m = mae.find(x => (c.subscription && x.subscriptionId === c.subscription) || (x.checkoutId && (x.checkoutId === c.checkoutSession || x.checkoutId === c.paymentLink)))
      ?? (ref.startsWith('MAEA:') ? mae.find(x => x.workspaceId === ref.slice(5)) : undefined)
    if (m) {
      out.set(c.id, m.ciclo !== 'mensal' || m.status === 'CANCELADA' || m.origemMod === 'cortesia' ? null
        : { produto: 'MAE', workspaceId: m.workspaceId, userId: null, bloqueado: !m.ate || m.ate < hoje, emDia: m.status === 'ATIVA' })
      continue
    }
    const p = pes.find(x => x.sub === c.subscription)
    if (p || ref.startsWith('PESSOAL:')) {
      out.set(c.id, p && p.status !== 'CANCELADA' ? { produto: 'PESSOAL', workspaceId: p.workspaceId, userId: p.userId, bloqueado: p.status === 'INADIMPLENTE', emDia: p.status === 'ATIVA' } : null)
      continue
    }
    const k = mkt.find(x => x.sub === c.subscription)
    if (k || ref.startsWith('MKT:')) {
      out.set(c.id, k && k.origem !== 'cortesia' ? { produto: 'MKT', workspaceId: k.workspaceId, userId: null, bloqueado: !k.ligado, emDia: k.status === 'ATIVA' } : null)
      continue
    }
    // SOA: pela assinatura gravada, pelo checkout hospedado ou pelo externalReference (= workspaceId)
    const s = soa.find(x => x.sub === c.subscription)
    const sc = s ?? soaCk.find(x => x.checkoutId === c.checkoutSession || x.checkoutId === c.paymentLink)
    const wsRef = !sc && ref && !/^[A-Z]+:/.test(ref) ? ref : null
    if (sc) {
      const ciclo = s?.ciclo ?? null
      out.set(c.id, (ciclo && ciclo !== 'MONTHLY') || sc.origem !== 'asaas' || sc.manual || sc.status === 'TRIAL' || sc.status === 'CANCELADA' ? null
        : { produto: 'SOA', workspaceId: sc.workspaceId, userId: null, bloqueado: sc.status === 'INADIMPLENTE' || sc.status === 'CORTADA', emDia: sc.status === 'ATIVA' })
      continue
    }
    if (wsRef) {
      // externalReference de conta sem a assinatura gravada: confirma no banco antes de cobrar
      const [w] = await prisma.$queryRaw<{ status: string | null; origem: string | null; manual: boolean | null }[]>`
        SELECT "assinaturaStatus" AS status, "assinaturaOrigem" AS origem, "liberacaoManual" AS manual FROM "Workspace" WHERE "id" = ${wsRef} LIMIT 1`.catch(() => [])
      out.set(c.id, w && w.origem === 'asaas' && !w.manual && w.status !== 'TRIAL' && w.status !== 'CANCELADA'
        ? { produto: 'SOA', workspaceId: wsRef, userId: null, bloqueado: w.status === 'INADIMPLENTE' || w.status === 'CORTADA', emDia: w.status === 'ATIVA' } : null)
      continue
    }
    out.set(c.id, null)
  }
  return out
}

/** Destinatária: a usuária do Pessoal (é dela) ou a ADMIN da conta. */
async function destinataria(d: Dona): Promise<{ nome: string | null; email: string } | null> {
  const [u] = d.userId
    ? await prisma.$queryRaw<{ nome: string | null; email: string | null }[]>`SELECT "nome", lower("email") AS email FROM "User" WHERE "id" = ${d.userId} AND "ativo" = true LIMIT 1`.catch(() => [])
    : await prisma.$queryRaw<{ nome: string | null; email: string | null }[]>`
        SELECT "nome", lower("email") AS email FROM "User" WHERE "workspaceId" = ${d.workspaceId} AND "ativo" = true AND "role" = 'ADMIN' ORDER BY "createdAt" NULLS LAST LIMIT 1`.catch(() => [])
  return u?.email ? { nome: u.nome, email: u.email } : null
}

export const reguaMensalLigada = (env: Record<string, string | undefined> = process.env) => (env.REGUA_MENSAL ?? '').trim().toLowerCase() !== 'off'

const hojeSP = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 86_400_000)

export interface ResultadoRegua {
  hoje: string; cobrancas: number; nossas: number; porEtapa: Record<string, number>; porProduto: Record<string, number>
  emails: number; enviados: number; falhas: number; bloqueadosMkt: number; ignoradasEmDia: number; convitesPixAuto: number; seco: boolean; erro?: string
  previa?: { workspaceId: string; produto: Produto; etapa: Etapa; dias: number; bloqueado: boolean }[]
}

/** Roda a régua do dia. `seco`: só calcula (nada é enviado nem bloqueado). */
export async function rodarReguaMensal(o: { seco?: boolean; agora?: Date } = {}): Promise<ResultadoRegua> {
  const hoje = hojeSP(o.agora)
  const r: ResultadoRegua = { hoje, cobrancas: 0, nossas: 0, porEtapa: {}, porProduto: {}, emails: 0, enviados: 0, falhas: 0, bloqueadosMkt: 0, ignoradasEmDia: 0, convitesPixAuto: 0, seco: !!o.seco }
  if (!reguaMensalLigada()) return { ...r, erro: 'REGUA_MENSAL=off' }

  const pendentes = await listarCobrancas('PENDING', hoje, somar(hoje, 5))
  await dorme(1100)
  const vencidas = await listarCobrancas('OVERDUE', somar(hoje, -365), somar(hoje, -1))
  // só mensalidade: cobrança de assinatura, não apagada, dentro do teto
  const cs = [...pendentes, ...vencidas].filter(c => c.subscription && !c.deleted && Number(c.value) > 0 && Number(c.value) <= TETO_MENSAL)
  r.cobrancas = cs.length
  const donas = await identificar(cs, hoje)

  // agrupa por destinatária (workspace + usuária do Pessoal)
  const grupos = new Map<string, { dona: Dona; itens: ItemEmail[] }>()
  for (const c of cs) {
    const dona = donas.get(c.id)
    if (!dona) continue
    r.nossas++
    const dias = diasEntre(hoje, c.dueDate)
    // cobrança antiga vencida de quem está EM DIA (pagou as seguintes): não é atraso dela — nunca cobrar quem paga
    if (dias < 0 && dona.emDia) { r.ignoradasEmDia++; continue }
    const etapa = etapaDaCobranca(dias, c.billingType === 'CREDIT_CARD')
    // SOA e Pessoal: o acesso é calculado (inadimplente + passou da tolerância)
    if ((dona.produto === 'SOA' || dona.produto === 'PESSOAL')) dona.bloqueado = dona.bloqueado && -dias > TOLERANCIA_ATRASO_DIAS
    // Marketplaces não tem carência no acesso (o webhook só marca): o bloqueio do D+4 em diante é aplicado aqui
    if (dona.produto === 'MKT' && -dias > TOLERANCIA_ATRASO_DIAS && !dona.bloqueado) {
      if (!o.seco) await pausarMarketplacesPorAtraso(dona.workspaceId).catch(e => console.error('[REGUA MENSAL] pausar MKT', (e as Error).message))
      dona.bloqueado = true; r.bloqueadosMkt++
    }
    if (!etapa) continue
    r.porEtapa[etapa] = (r.porEtapa[etapa] ?? 0) + 1
    r.porProduto[dona.produto] = (r.porProduto[dona.produto] ?? 0) + 1
    const chave = `${dona.workspaceId}|${dona.userId ?? ''}`
    const g = grupos.get(chave) ?? { dona, itens: [] }
    g.itens.push({ produto: dona.produto, etapa, valor: Number(c.value), vencimento: c.dueDate, diasParaVencer: dias, noCartao: c.billingType === 'CREDIT_CARD', bloqueado: dona.bloqueado, paymentId: c.id,
      convitePixAuto: etapa === 'LEMBRETE' && PIX_AUTOMATICO_LIBERADO && pixAutoLigado() && deveConvidarPixAuto(dona.produto, dias, c.billingType, c.paymentLink) })
    if (g.itens[g.itens.length - 1].convitePixAuto) r.convitesPixAuto++
    grupos.set(chave, g)
  }
  r.emails = grupos.size
  if (o.seco) {
    r.previa = [...grupos.values()].flatMap(g => g.itens.map(i => ({ workspaceId: g.dona.workspaceId, produto: i.produto, etapa: i.etapa, dias: i.diasParaVencer, bloqueado: i.bloqueado })))
    return r
  }
  if (!process.env.RESEND_API_KEY) return { ...r, erro: 'RESEND_API_KEY ausente' }

  let enviadosNaRodada = 0
  for (const { dona, itens } of grupos.values()) {
    if (enviadosNaRodada >= 200) break
    // reserva atômica de cada item ANTES de enviar (rodar de novo no mesmo dia não repete)
    const reservas: string[] = []
    const novos: ItemEmail[] = []
    for (const i of itens) {
      const [res] = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
        VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${dona.workspaceId}, ${`MENSAL:${i.paymentId}:${i.etapa}`}, ${hoje}::date, NOW())
        ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"`
      if (res) { reservas.push(res.id); novos.push(i) }
    }
    if (!novos.length) continue
    const para = await destinataria(dona)
    if (!para) { await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "erro" = 'sem destinatária' WHERE "id" = ANY(${reservas})`.catch(() => {}); continue }
    const { assunto, html } = montarEmailMensal(para.nome, novos)
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: REMETENTE, to: [para.email], subject: assunto, html }),
      })
      if (!resp.ok) throw new Error(`Resend ${resp.status}`)
      await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ANY(${reservas})`
      r.enviados++; enviadosNaRodada++
    } catch (e) {
      // falhou: libera as reservas (a próxima rodada do dia tenta de novo)
      await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ANY(${reservas}) AND "enviadoEm" IS NULL`.catch(() => {})
      r.falhas++
      console.error(`[REGUA MENSAL] ws=${dona.workspaceId}:`, (e as Error).message)
    }
    await dorme(600)
  }
  console.log(`[REGUA MENSAL] ${hoje}: ${r.enviados}/${r.emails} e-mails · ${r.nossas} de ${r.cobrancas} cobranças · ${JSON.stringify(r.porEtapa)} ${JSON.stringify(r.porProduto)}${r.bloqueadosMkt ? ` · ${r.bloqueadosMkt} Marketplaces pausados` : ''}${r.falhas ? ` · ${r.falhas} falhas` : ''}`)
  return r
}

/** Marketplaces em atraso há mais de 3 dias: pausa o módulo (o pagamento religa — webhook PAYMENT_RECEIVED). */
async function pausarMarketplacesPorAtraso(workspaceId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "moduloMarketplaces" = false, "updatedAt" = NOW()
    WHERE "id" = ${workspaceId} AND "moduloMarketplaces" = true AND COALESCE("moduloMarketplacesOrigem", '') <> 'cortesia'`
  console.log(`[REGUA MENSAL] Marketplaces pausado por atraso ws=${workspaceId}`)
}
