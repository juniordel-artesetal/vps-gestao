// Método Mãe — RECUPERAÇÃO DE VENDAS por e-mail (16/10/2026, pedido do Júnior: "não perder as oportunidades").
// Quem COMEÇOU a comprar e não terminou:
//   • abriu o pagamento e não pagou (MaeAssinatura AGUARDANDO_PAGAMENTO — o checkout foi criado);
//   • criou a conta do "só o Método Mãe" (/mae/cadastro) e nunca assinou.
// Três e-mails, contados de quando a tentativa começou: 1 h ("faltou só um passo"), 24 h (benefícios + o link do Asaas
// expira — gere outro) e 72 h (último lembrete + ajuda). Para sozinho quando ela paga (o status muda), em quem tem o
// MAE liberado (cortesia, beta, SOA Design) e em quem pediu para não receber e-mails (ReengajamentoOptOut).
// Se o cron atrasar, manda só a etapa MAIS NOVA que já venceu (nunca duas de uma vez). IDEMPOTENTE: cada etapa reserva
// a sua linha em "AssinaturaAviso" (workspaceId, 'MAE_RECUP_<n>', dia = início da tentativa) antes de enviar.
// Desligar: MAE_RECUPERACAO=off. Só roda com a venda aberta.
import { prisma } from '@/lib/prisma'
import { tokenOptOut } from '@/lib/reengajamento'
import { precosMae, vendaMaeAtiva, cobrancaMae, type PrecosMae, type PlanoMaeVenda, type CicloMae } from './precos'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const SITE = 'https://www.usesoa.com.br'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export type EtapaRecuperacao = 1 | 2 | 3
/** Horas depois do início da tentativa em que cada etapa sai. */
export const HORAS_ETAPA: Record<EtapaRecuperacao, number> = { 1: 1, 2: 24, 3: 72 }
/** Depois disto, a tentativa não recebe mais nada. */
export const HORAS_MAX = 24 * 7

/** Qual etapa mandar agora (a mais nova que já venceu e ainda não saiu; null = nada). Puro. */
export function etapaDaVez(horas: number, enviadas: ReadonlySet<number>): EtapaRecuperacao | null {
  if (horas < HORAS_ETAPA[1] || horas > HORAS_MAX) return null
  const vencidas = ([3, 2, 1] as EtapaRecuperacao[]).filter(e => horas >= HORAS_ETAPA[e])
  const maisNova = vencidas[0]
  // se uma etapa POSTERIOR já saiu, as anteriores nunca mais saem
  if ([...enviadas].some(e => e >= maisNova)) return null
  return maisNova
}

export interface DadosRecuperacao { nome: string | null; plano: PlanoMaeVenda; ciclo: CicloMae | null; parcelas: number }

/** Link para retomar: a tela da assinatura já no plano escolhido (gera um checkout novo — o do Asaas expira em 24 h). */
export const linkRetomar = (d: Pick<DadosRecuperacao, 'ciclo' | 'parcelas'>) =>
  `${SITE}/mae/assinatura${d.ciclo ? `?ciclo=${d.ciclo}${d.ciclo === 'anual' && d.parcelas > 1 ? `&parcelas=${d.parcelas}` : ''}` : ''}`

/** Assunto + HTML de cada etapa (puro, testável). */
export function montarEmailRecuperacao(etapa: EtapaRecuperacao, d: DadosRecuperacao, p: PrecosMae, optoutUrl: string): { assunto: string; html: string } {
  const primeiro = d.nome ? esc(String(d.nome).trim().split(/\s+/)[0]) : ''
  const pr = p[d.plano]
  const ciclo = d.ciclo ?? 'mensal'
  const c = cobrancaMae(p, d.plano, ciclo, d.parcelas)
  const qual = d.plano === 'addon' ? 'Método Mãe no seu SOA' : 'Método Mãe'
  const preco = ciclo === 'mensal' ? `${brl(c.total)}/mês` : c.parcelas > 1 ? `${c.parcelas}× de ${brl(c.valorParcela)} (1 ano)` : `${brl(c.total)} por 1 ano (Pix ou cartão)`
  const escolhido = d.ciclo ? `<p style="background:#fff7ed;border-radius:10px;padding:10px 14px">Seu plano: <b>${qual} — ${preco}</b>${d.plano === 'addon' ? ' (soma à sua assinatura do SOA)' : ''}.</p>`
    : `<p style="background:#fff7ed;border-radius:10px;padding:10px 14px">Planos: <b>${brl(pr.mensal)}/mês</b> ou <b>${brl(pr.anual)} por 1 ano</b> (ou em até 12× com juros).</p>`
  const botao = (t: string) => `<p style="text-align:center;margin:24px 0"><a href="${linkRetomar(d)}" style="background:#f97316;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600">${t}</a></p>`
  const corpo: Record<EtapaRecuperacao, { assunto: string; texto: string; botao: string }> = {
    1: { assunto: 'Faltou só um passo para o seu Método Mãe 💛',
      texto: `<p>Vimos que você começou a assinar o <b>Método Mãe</b>, mas o pagamento não foi concluído. Às vezes é o cartão, às vezes a página fechou — acontece!</p>${escolhido}<p>É só voltar e concluir — leva 1 minuto.</p>`,
      botao: 'Concluir minha assinatura' },
    2: { assunto: 'Seus pedidos com a arte pronta — ainda dá tempo 💛',
      texto: `<p>Com o Método Mãe, o pedido chega e a arte sai pronta: o nome, a idade e a quantidade certa de cada cliente, num PDF só para imprimir — e o corte em cima da linha.</p>${escolhido}<p>O link de pagamento anterior expira em 24 horas; pelo botão abaixo você abre um novo, na hora.</p>`,
      botao: 'Abrir um novo link de pagamento' },
    3: { assunto: 'Último lembrete: o Método Mãe está te esperando',
      texto: `<p>Este é o último lembrete sobre a sua assinatura do <b>Método Mãe</b>. Se alguma coisa travou (cartão, dúvida sobre o plano, sobre o parcelamento), <b>responda este e-mail</b> que a gente resolve com você.</p>${escolhido}`,
      botao: 'Assinar o Método Mãe' },
  }
  const e = corpo[etapa]
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} 💛</p>
    ${e.texto}
    ${botao(e.botao)}
    ${d.ciclo === 'anual' && d.parcelas > 1 ? `<p style="font-size:14px;color:#6b7280">No parcelado, na página de pagamento escolha <b>${d.parcelas}×</b> em “Selecione o parcelamento” — o valor já inclui os juros.</p>` : ''}
    <p style="color:#6b7280;font-size:14px">Qualquer dúvida, é só responder este e-mail. 💛</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Não quer receber estes avisos? <a href="${optoutUrl}" style="color:#9ca3af">Cancelar os avisos</a>.</p>
  </div>`.trim()
  return { assunto: e.assunto, html }
}

interface Candidata { workspaceId: string; userId: string; nome: string | null; email: string; plano: PlanoMaeVenda; ciclo: CicloMae | null; parcelas: number; inicio: Date }

/** Quem começou a comprar e não terminou (sem o MAE liberado, sem opt-out), nos últimos 7 dias. */
async function candidatas(): Promise<Candidata[]> {
  const beta = new Set(String(process.env.MAE_BETA_WORKSPACES ?? '').split(',').map(s => s.trim()).filter(Boolean))
  const linhas = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT w."id" AS "workspaceId", u."id" AS "userId", u."nome", u."email",
           COALESCE(m."plano", CASE WHEN (to_jsonb(w) ->> 'moduloMaePlano') = 'standalone' THEN 'standalone' ELSE 'addon' END) AS "plano",
           m."ciclo", COALESCE(m."parcelas", 1) AS "parcelas",
           COALESCE(m."updatedAt", w."createdAt") AS "inicio"
    FROM "Workspace" w
    LEFT JOIN "MaeAssinatura" m ON m."workspaceId" = w."id"
    JOIN LATERAL (SELECT "id","nome","email" FROM "User" WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true AND "email" IS NOT NULL
                  ORDER BY "createdAt" ASC LIMIT 1) u ON true
    WHERE (
            (m."status" = 'AGUARDANDO_PAGAMENTO')
         OR (m."id" IS NULL AND (to_jsonb(w) ->> 'moduloMaePlano') = 'standalone')
          )
      AND COALESCE(m."updatedAt", w."createdAt") > now() - interval '${HORAS_MAX} hours'
      AND COALESCE((to_jsonb(w) ->> 'moduloMae')::boolean, false) = false
      AND COALESCE((to_jsonb(w) ->> 'moduloEstudio')::boolean, false) = false
      AND NOT EXISTS (SELECT 1 FROM "ReengajamentoOptOut" o WHERE o."userId" = u."id")`)
  return linhas.filter(l => !beta.has(String(l.workspaceId))).map(l => ({
    workspaceId: String(l.workspaceId), userId: String(l.userId), nome: (l.nome as string) ?? null, email: String(l.email).trim().toLowerCase(),
    plano: l.plano === 'standalone' ? 'standalone' : 'addon', ciclo: l.ciclo === 'anual' ? 'anual' : l.ciclo === 'mensal' ? 'mensal' : null,
    parcelas: Number(l.parcelas) || 1, inicio: new Date(l.inicio as string),
  }))
}

export interface ResultadoRecuperacao { candidatas: number; enviados: number; porEtapa: Record<string, number>; falhas: number; erro?: string }

/** Cron (de hora em hora). `seco` = só conta (nada é reservado nem enviado). */
export async function rodarRecuperacaoMae(o: { seco?: boolean; agora?: Date } = {}): Promise<ResultadoRecuperacao> {
  const r: ResultadoRecuperacao = { candidatas: 0, enviados: 0, porEtapa: {}, falhas: 0 }
  if (String(process.env.MAE_RECUPERACAO ?? '').toLowerCase() === 'off') return { ...r, erro: 'desligada (MAE_RECUPERACAO=off)' }
  const p = precosMae()
  if (!vendaMaeAtiva() || !p) return { ...r, erro: 'venda do Método Mãe fechada' }
  const agora = o.agora ?? new Date()
  const lista = await candidatas()
  r.candidatas = lista.length
  for (const c of lista) {
    const dia = c.inicio.toISOString().slice(0, 10)
    const ja = await prisma.$queryRaw<{ tipo: string }[]>`
      SELECT "tipo" FROM "AssinaturaAviso" WHERE "workspaceId" = ${c.workspaceId} AND "tipo" LIKE 'MAE_RECUP_%' AND "dia" = ${dia}::date`
    const enviadas = new Set(ja.map(x => Number(x.tipo.replace('MAE_RECUP_', ''))))
    const etapa = etapaDaVez((agora.getTime() - c.inicio.getTime()) / 3600_000, enviadas)
    if (!etapa) continue
    r.porEtapa[`etapa${etapa}`] = (r.porEtapa[`etapa${etapa}`] ?? 0) + 1
    if (o.seco) continue
    if (!process.env.RESEND_API_KEY) return { ...r, erro: 'RESEND_API_KEY ausente' }
    // reserva atômica ANTES de enviar
    const [res] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
      VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${c.workspaceId}, ${`MAE_RECUP_${etapa}`}, ${dia}::date, NOW())
      ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"`
    if (!res) continue
    const optout = `${SITE}/api/reengajamento/optout?u=${encodeURIComponent(c.userId)}&t=${tokenOptOut(c.userId)}`
    const { assunto, html } = montarEmailRecuperacao(etapa, c, p, optout)
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: REMETENTE, to: [c.email], subject: assunto, html }),
      })
      if (!resp.ok) throw new Error(`Resend ${resp.status}`)
      await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ${res.id}`
      r.enviados++
    } catch (e) {
      // falhou: libera a reserva (o próximo cron tenta de novo)
      await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ${res.id} AND "enviadoEm" IS NULL`.catch(() => {})
      r.falhas++
      console.error(`[MAE RECUPERACAO] ws=${c.workspaceId} etapa ${etapa}:`, (e as Error).message)
    }
    await new Promise(x => setTimeout(x, 600))
  }
  console.log(`[MAE RECUPERACAO] ${r.enviados} enviados de ${r.candidatas} candidatas ${JSON.stringify(r.porEtapa)}${r.falhas ? ` · ${r.falhas} falhas` : ''}`)
  return r
}
