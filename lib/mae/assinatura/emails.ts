// Método MAE — E-MAILS da assinatura (Resend), todos IDEMPOTENTES: cada um "reivindica" a sua marca em
// "MaeAssinatura" de forma atômica (UPDATE … RETURNING) antes de enviar — webhook repetido, cron rodando de novo ou
// dois cliques nunca mandam o mesmo e-mail duas vezes. Falha de envio nunca derruba o fluxo (só loga).
//   • boas-vindas da conta standalone (no cadastro — acontece 1 vez por natureza);
//   • início do teste (CHECKOUT_PAID → trial) · fim do teste chegando (cron, 2 dias antes);
//   • pagamento não aprovado (1 por vencimento) · assinatura cancelada.
// Destinatário: a ADMIN da conta. Textos em funções puras (testáveis).
import { prisma } from '@/lib/prisma'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const SITE = 'https://www.usesoa.com.br'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export type TipoEmailMae = 'boasVindas' | 'inicioTeste' | 'fimTeste' | 'atraso' | 'cancelada'
export interface DadosEmailMae { nome?: string | null; valor?: number; parcelas?: number; ciclo?: string; data?: string | null; acessoAte?: string | null }

function moldura(nome: string | null | undefined, corpo: string, botao: { texto: string; link: string }): string {
  const primeiro = nome ? esc(String(nome).trim().split(/\s+/)[0]) : ''
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} 💛</p>
    ${corpo}
    <p style="text-align:center;margin:24px 0"><a href="${botao.link}" style="background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">${botao.texto}</a></p>
    <p style="color:#6b7280;font-size:14px">Qualquer dúvida, é só responder este e-mail. 💛</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
  </div>`.trim()
}
const cobranca = (d: DadosEmailMae) =>
  d.valor ? (d.ciclo === 'anual' && (d.parcelas ?? 1) > 1 ? `${d.parcelas}× de ${brl(Math.round((d.valor / d.parcelas!) * 100) / 100)} (total ${brl(d.valor)})` : `${brl(d.valor)}${d.ciclo === 'anual' ? '/ano' : '/mês'}`) : ''

/** Assunto + HTML de cada e-mail (puro). */
export function montarEmailMae(tipo: TipoEmailMae, d: DadosEmailMae): { assunto: string; html: string } {
  const abrir = { texto: 'Abrir o Método Mãe', link: `${SITE}/estudio/mae` }
  const assinatura = { texto: 'Ver minha assinatura', link: `${SITE}/mae/assinatura` }
  switch (tipo) {
    case 'boasVindas': return { assunto: 'Sua conta do Método Mãe está pronta 💛', html: moldura(d.nome,
      `<p>Sua conta do <b>Método Mãe</b> foi criada! Falta só um passo: <b>assinar</b> (mensal, ou anual em até 12×) — o pagamento é no cartão, na página segura do Asaas, e você cancela quando quiser.</p>`,
      { texto: 'Assinar o Método Mãe', link: `${SITE}/mae/assinatura` }) }
    case 'inicioTeste': return { assunto: 'Seu teste do Método Mãe começou ✨', html: moldura(d.nome,
      `<p>Seu <b>teste grátis do Método Mãe</b> começou! Você tem até <b>${dia(d.data)}</b> para usar tudo: editor, edição em massa e lote de impressão.</p>
       <p>A 1ª cobrança${cobranca(d) ? ` (${cobranca(d)})` : ''} só acontece em <b>${dia(d.data)}</b>. Se não quiser continuar, cancele antes em <i>Minha assinatura</i> — sem custo.</p>`, abrir) }
    case 'fimTeste': return { assunto: `Seu teste do Método Mãe termina em ${dia(d.data)}`, html: moldura(d.nome,
      `<p>Passando para avisar: seu teste grátis do <b>Método Mãe</b> termina em <b>${dia(d.data)}</b>. Nesse dia acontece a 1ª cobrança${cobranca(d) ? ` (${cobranca(d)})` : ''} e você segue usando sem interrupção.</p>
       <p>Se preferir não continuar, é só cancelar antes em <i>Minha assinatura</i> — nada é cobrado.</p>`, assinatura) }
    case 'atraso': return { assunto: 'Não conseguimos cobrar o Método Mãe', html: moldura(d.nome,
      `<p>O pagamento do <b>Método Mãe</b> com vencimento em <b>${dia(d.data)}</b> não foi aprovado.</p>
       <p>Seu acesso continua até <b>${dia(d.acessoAte)}</b>. Para não perder, confira o cartão ou pague a fatura em aberto pela sua assinatura.</p>`,
      { texto: 'Regularizar o pagamento', link: `${SITE}/mae/assinatura` }) }
    case 'cancelada': return { assunto: 'Sua assinatura do Método Mãe foi cancelada', html: moldura(d.nome,
      `<p>Sua assinatura do <b>Método Mãe</b> foi cancelada${d.acessoAte ? ` — o acesso continua até <b>${dia(d.acessoAte)}</b>` : ''}. Nenhuma nova cobrança será feita.</p>
       <p>Suas bases, temas e artes ficam guardados no seu computador. Se quiser voltar, é só assinar de novo.</p>`, assinatura) }
  }
}

async function enviar(para: string, tipo: TipoEmailMae, d: DadosEmailMae): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) { console.warn(`[MAE EMAIL] sem RESEND_API_KEY — ${tipo} não enviado`); return false }
  const { assunto, html } = montarEmailMae(tipo, d)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMETENTE, to: [para], subject: assunto, html }),
  })
  if (!r.ok) console.error(`[MAE EMAIL] ${tipo} falhou: HTTP ${r.status}`)
  return r.ok
}

/** A administradora da conta (destinatária). */
async function adminDa(ws: string): Promise<{ nome: string | null; email: string } | null> {
  const [u] = await prisma.$queryRaw<{ nome: string | null; email: string | null }[]>`
    SELECT "nome", lower("email") AS email FROM "User" WHERE "workspaceId" = ${ws} AND "ativo" = true AND "role" = 'ADMIN' ORDER BY "createdAt" NULLS LAST LIMIT 1`.catch(() => [])
  return u?.email ? { nome: u.nome, email: u.email } : null
}

/** Boas-vindas da conta standalone (chamado no cadastro). */
export async function emailBoasVindasMae(nome: string, email: string): Promise<void> {
  try { await enviar(email, 'boasVindas', { nome }) } catch (e) { console.error('[MAE EMAIL] boas-vindas', (e as Error).message) }
}

type Linha = { workspaceId: string; valor: unknown; parcelas: number; ciclo: string; trialAte: Date | null }
const dataIso = (d: Date | string | null) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)) : null)

/** Envia `tipo` para a conta só se conseguir reivindicar a marca (`reivindicar` devolve a linha quando é a 1ª vez). */
async function comMarca(reivindicar: Promise<Linha[]>, tipo: TipoEmailMae, extra: Partial<DadosEmailMae> = {}): Promise<boolean> {
  try {
    const [l] = await reivindicar
    if (!l) return false
    const a = await adminDa(l.workspaceId)
    if (!a) return false
    return await enviar(a.email, tipo, { nome: a.nome, valor: Number(l.valor) || undefined, parcelas: l.parcelas, ciclo: l.ciclo, data: dataIso(l.trialAte), ...extra })
  } catch (e) { console.error(`[MAE EMAIL] ${tipo}`, (e as Error).message); return false }
}

export const emailInicioTesteMae = (ws: string) => comMarca(prisma.$queryRaw<Linha[]>`
  UPDATE "MaeAssinatura" SET "emailInicioEm" = NOW() WHERE "workspaceId" = ${ws} AND "status" = 'TRIAL' AND "emailInicioEm" IS NULL
  RETURNING "workspaceId","valor","parcelas","ciclo","trialAte"`, 'inicioTeste')

export const emailAtrasoMae = (ws: string, venc: string, acessoAte: string) => comMarca(prisma.$queryRaw<Linha[]>`
  UPDATE "MaeAssinatura" SET "emailAtrasoVenc" = ${venc}::date WHERE "workspaceId" = ${ws} AND "emailAtrasoVenc" IS DISTINCT FROM ${venc}::date
  RETURNING "workspaceId","valor","parcelas","ciclo","trialAte"`, 'atraso', { data: venc, acessoAte })

export const emailCanceladaMae = (ws: string, acessoAte: string | null) => comMarca(prisma.$queryRaw<Linha[]>`
  UPDATE "MaeAssinatura" SET "emailCanceladaEm" = NOW() WHERE "workspaceId" = ${ws} AND "status" = 'CANCELADA' AND "emailCanceladaEm" IS NULL
  RETURNING "workspaceId","valor","parcelas","ciclo","trialAte"`, 'cancelada', { acessoAte })

/** Cron diário: testes que terminam em até 2 dias (ainda não avisados). Devolve quantos e-mails saíram. */
export async function avisarFimDosTestesMae(hoje: string): Promise<{ avisados: number; candidatos: number }> {
  const lista = await prisma.$queryRaw<{ workspaceId: string }[]>`
    SELECT "workspaceId" FROM "MaeAssinatura"
    WHERE "status" = 'TRIAL' AND "emailFimTrialEm" IS NULL AND "trialAte" BETWEEN ${hoje}::date AND (${hoje}::date + 2)
    LIMIT 200`.catch(() => [])
  let avisados = 0
  for (const { workspaceId } of lista) {
    const ok = await comMarca(prisma.$queryRaw<Linha[]>`
      UPDATE "MaeAssinatura" SET "emailFimTrialEm" = NOW() WHERE "workspaceId" = ${workspaceId} AND "status" = 'TRIAL' AND "emailFimTrialEm" IS NULL
      RETURNING "workspaceId","valor","parcelas","ciclo","trialAte"`, 'fimTeste')
    if (ok) avisados++
  }
  return { avisados, candidatos: lista.length }
}
