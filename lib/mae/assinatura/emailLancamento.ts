// Método Mãe — E-MAIL DO LANÇAMENTO (16/10/2026, 20h de Brasília). Um único disparo para TODAS as contas do SOA,
// assinantes ativas e inativas (decisão do Júnior, 15/10):
//   • ATIVA (o SOA dá acesso hoje): convite para o SOA + Método Mãe (o MAE soma à assinatura do SOA);
//   • INATIVA (cortada, cancelada, teste vencido…): pode voltar ao SOA completo OU assinar SÓ o Método Mãe.
// Fora: quem já tem o MAE (assinatura, cortesia, beta, assinante do SOA Design) e quem pediu para não receber e-mails
// (ReengajamentoOptOut — o mesmo "cancelar os avisos" do rodapé).
// IDEMPOTENTE: cada conta reivindica a sua linha em "AssinaturaAviso" (workspaceId, 'MAE_LANCAMENTO', 16/10) ANTES de
// enviar; o cron rodando de novo (ou um reenvio manual) nunca manda duas vezes. Falha do Resend → a reserva volta
// (dá para tentar de novo). Envio em lotes pela API de lote do Resend (até 100 por chamada).
import { prisma } from '@/lib/prisma'
import { avaliar } from '@/lib/assinatura'
import { tokenOptOut } from '@/lib/reengajamento'
import { precosMae, cobrancaMae, type PrecosMae } from './precos'
import { janelaEmailLancamentoMae } from './lancamento'
import { precoMensalVigente, anualAvistaVigente } from '@/lib/assinatura/planos'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const SITE = 'https://www.usesoa.com.br'
const TIPO = 'MAE_LANCAMENTO'
const DIA = '2026-10-16'
const LOTE = 50
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export type VarianteLancamento = 'ativa' | 'inativa'
export interface DestinoLancamento { workspaceId: string; userId: string; nome: string | null; email: string; variante: VarianteLancamento }

const BENEFICIOS = [
  ['A arte de cada pedido, pronta', 'o Método Mãe puxa os pedidos e monta a arte com o nome, a idade e o tema de cada cliente — sem refazer arquivo por arquivo.'],
  ['Edição em massa', 'dezenas de pedidos de uma vez: confere, ajusta o que precisa e gera tudo junto.'],
  ['Lote de impressão organizado', 'as folhas saem montadas, aproveitando o papel, com as marcas de corte para a sua máquina.'],
  ['Seus temas e bases sempre à mão', 'tudo guardado no seu computador, pronto para o próximo pedido.'],
]

/** Assunto + HTML (puro, testável). */
/** Link de um plano (o preço vai DIRETO para o pagamento; 12× passa pela lista de parcelas com os juros). Quem recebe o
 *  e-mail já tem conta → `conta=1` (entra, nunca cria conta nova). */
export const linkDoPlano = (o: 'soa-mae' | 'so-mae', ciclo: 'mensal' | 'anual', parcelas = 1) => `${SITE}/mae/pagar?o=${o}&ciclo=${ciclo}&parcelas=${parcelas}&conta=1`

/**
 * Assunto + HTML (puro, testável) — cenário do Júnior (16/10/2026):
 *  • ATIVA (assina o SOA): o Método Mãe SOMA à assinatura do SOA (cobrança separada) — R$ 39,90/mês ou R$ 383/ano
 *    (até 12× com juros);
 *  • INATIVA: só o Método Mãe — R$ 59,90/mês ou R$ 503/ano (até 12× com juros) — ou voltar ao SOA + Método Mãe —
 *    R$ 89,80/mês ou R$ 753/ano.
 */
export function montarEmailLancamento(v: VarianteLancamento, nome: string | null, p: PrecosMae, optoutUrl: string, soa: { mensal: number; anual: number } = { mensal: 49.9, anual: 370 }): { assunto: string; html: string } {
  const primeiro = nome ? esc(String(nome).trim().split(/\s+/)[0]) : ''
  const lista = BENEFICIOS.map(([t, d]) => `<li style="margin:0 0 8px"><b>${t}</b> — ${d}</li>`).join('')
  const pl = v === 'ativa' ? 'addon' : 'standalone'
  const o = v === 'ativa' ? 'soa-mae' : 'so-mae'
  const doze = cobrancaMae(p, pl, 'anual', 12)
  const btn = (txt: string, href: string, cheio = true) => `<a href="${href}" style="display:block;margin:8px 0;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:600;text-align:center;${cheio ? 'background:#f97316;color:#fff' : 'border:2px solid #f97316;color:#c2410c'}">${txt}</a>`
  const caixa = (titulo: string, sub: string, botoes: string) => `<div style="border:1px solid #fde2cc;border-radius:12px;padding:14px 16px;margin:14px 0;background:#fffaf5"><p style="margin:0 0 4px;font-weight:700;font-size:16px">${titulo}</p><p style="margin:0 0 8px;color:#6b7280;font-size:14px">${sub}</p>${botoes}</div>`
  const planosMae = caixa(
    v === 'ativa' ? 'Método Mãe no seu SOA' : 'Só o Método Mãe',
    v === 'ativa' ? 'Soma à sua assinatura do SOA (é uma cobrança separada; o SOA continua como está).' : 'Para usar só o Método Mãe, sem o resto do SOA. Seus dados continuam guardados.',
    btn(`Mensal — ${brl(p[pl].mensal)}/mês`, linkDoPlano(o, 'mensal'))
      + btn(`Anual — ${brl(p[pl].anual)} à vista (Pix ou cartão)`, linkDoPlano(o, 'anual', 1), false)
      + btn(`Anual em até 12× — 12× de ${brl(doze.valorParcela)} (com juros)`, linkDoPlano(o, 'anual', 12), false))
  const combo = v === 'inativa' ? caixa('SOA + Método Mãe', `Volte ao SOA completo e some o Método Mãe: ${brl(soa.mensal + p.addon.mensal)}/mês (SOA ${brl(soa.mensal)} + Método Mãe ${brl(p.addon.mensal)}) ou ${brl(soa.anual + p.addon.anual)}/ano. Primeiro você regulariza o SOA; depois, é só ativar o Método Mãe no Hub de módulos.`,
    btn('Voltar ao SOA + Método Mãe', `${SITE}/assinatura`, false)) : ''
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} 💛</p>
    <p style="font-size:18px"><b>Chegou o Método Mãe</b> — o jeito de produzir as artes personalizadas dos seus pedidos sem perder noites no computador.</p>
    <ul style="padding-left:20px">${lista}</ul>
    <p style="margin-top:18px;font-weight:700">Escolha o seu plano (pagamento na página segura do Asaas — mensal no cartão; anual à vista no Pix ou no cartão, ou em até 12× no cartão):</p>
    ${planosMae}
    ${combo}
    <p style="font-size:14px;color:#6b7280">No anual parcelado, na página de pagamento escolha <b>12×</b> em “Selecione o parcelamento” — o valor já inclui os juros. Cancele quando quiser, pela própria tela da assinatura.</p>
    <p style="font-size:14px">Quer ver tudo antes? <a href="${SITE}/mae" style="color:#c2410c">Conheça o Método Mãe</a>.</p>
    <p style="color:#6b7280;font-size:14px">Qualquer dúvida, é só responder este e-mail. 💛</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Não quer receber novidades do SOA? <a href="${optoutUrl}" style="color:#9ca3af">Cancelar os avisos</a>.</p>
  </div>`.trim()
  const assunto = v === 'ativa' ? 'Chegou o Método Mãe: some ao seu SOA por R$ 39,90/mês 💛' : 'Chegou o Método Mãe — e você pode assinar só ele 💛'
  return { assunto: assunto.replace('R$ 39,90', brl(p.addon.mensal).replace(/\u00a0/g, ' ')), html }
}

const betas = () => new Set(String(process.env.MAE_BETA_WORKSPACES ?? '').split(',').map(s => s.trim()).filter(Boolean))

/** Quem recebe (aplica todos os filtros, menos o "já enviado"). */
export async function destinosLancamento(): Promise<DestinoLancamento[]> {
  const linhas = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT w."id", w."ativo", w."assinaturaStatus", w."assinaturaOrigem", w."assinaturaExpira", w."trialAte", w."liberacaoManual",
           (to_jsonb(w) ->> 'moduloMae') AS "mae", (to_jsonb(w) ->> 'moduloMaePlano') AS "maePlano", (to_jsonb(w) ->> 'moduloEstudio') AS "estudio",
           u."id" AS "userId", u."nome", u."email"
    FROM "Workspace" w
    JOIN LATERAL (
      SELECT "id","nome","email" FROM "User"
      WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true AND "email" IS NOT NULL AND "email" <> ''
      ORDER BY "createdAt" ASC LIMIT 1
    ) u ON true
    WHERE NOT EXISTS (SELECT 1 FROM "ReengajamentoOptOut" o WHERE o."userId" = u."id")`)
  const beta = betas(), vistos = new Set<string>(), out: DestinoLancamento[] = []
  for (const w of linhas) {
    const email = String(w.email).trim().toLowerCase()
    if (!email.includes('@') || vistos.has(email)) continue
    if (w.mae === 'true' || w.estudio === 'true' || beta.has(String(w.id))) continue   // já tem o Método Mãe
    vistos.add(email)
    // conta só-MAE ainda sem assinatura = "inativa" (o convite é para assinar só o MAE)
    const soaAtivo = w.maePlano !== 'standalone' && avaliar(w as never).temAcesso
    out.push({ workspaceId: String(w.id), userId: String(w.userId), nome: (w.nome as string) ?? null, email, variante: soaAtivo ? 'ativa' : 'inativa' })
  }
  return out
}

export interface ResultadoLancamento { candidatos: number; ativas: number; inativas: number; enviados: number; jaEnviados: number; falhas: number; erro?: string }

/**
 * Dispara o e-mail do lançamento. `seco` = só conta (nada é reservado nem enviado). Fora da janela (antes das 20h de
 * 16/10 ou depois de 17/10) não envia — o cron é anual e não pode repetir em 2027.
 */
export async function dispararEmailLancamento(o: { seco?: boolean; agora?: Date; apenasEmail?: string } = {}): Promise<ResultadoLancamento> {
  const p = precosMae()
  let destinos = await destinosLancamento()
  if (o.apenasEmail) destinos = destinos.filter(d => d.email === o.apenasEmail!.toLowerCase())
  const base: ResultadoLancamento = { candidatos: destinos.length, ativas: destinos.filter(d => d.variante === 'ativa').length, inativas: destinos.filter(d => d.variante === 'inativa').length, enviados: 0, jaEnviados: 0, falhas: 0 }
  if (o.seco) return base
  if (!p) return { ...base, erro: 'Preços do Método Mãe não configurados' }
  if (!janelaEmailLancamentoMae(o.agora ?? new Date())) return { ...base, erro: 'Fora da janela do lançamento (16/10/2026 20h → 17/10)' }
  if (!process.env.RESEND_API_KEY) return { ...base, erro: 'RESEND_API_KEY ausente' }

  for (let i = 0; i < destinos.length; i += LOTE) {
    const lote = destinos.slice(i, i + LOTE)
    // reserva atômica: só quem ainda não recebeu
    const reservados: { id: string; workspaceId: string }[] = []
    for (const d of lote) {
      const r = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
        VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${d.workspaceId}, ${TIPO}, ${DIA}::date, NOW())
        ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"`
      if (r.length) reservados.push({ id: r[0].id, workspaceId: d.workspaceId }); else base.jaEnviados++
    }
    const enviar = lote.filter(d => reservados.some(r => r.workspaceId === d.workspaceId))
    if (!enviar.length) continue
    const corpo = enviar.map(d => {
      const optout = `${SITE}/api/reengajamento/optout?u=${encodeURIComponent(d.userId)}&t=${tokenOptOut(d.userId)}`
      const { assunto, html } = montarEmailLancamento(d.variante, d.nome, p, optout, { mensal: precoMensalVigente(), anual: anualAvistaVigente() })
      return { from: REMETENTE, to: [d.email], subject: assunto, html }
    })
    const ids = reservados.map(r => r.id)
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
      await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ANY(${ids})`
      base.enviados += enviar.length
    } catch (e) {
      // falhou o lote: libera a reserva (um novo disparo tenta de novo)
      await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ANY(${ids}) AND "enviadoEm" IS NULL`.catch(() => {})
      base.falhas += enviar.length
      console.error(`[MAE LANCAMENTO] lote ${i / LOTE + 1} falhou:`, (e as Error).message)
    }
    await new Promise(r => setTimeout(r, 700))   // limite de requisições do Resend
  }
  console.log(`[MAE LANCAMENTO] ${base.enviados} enviados · ${base.jaEnviados} já tinham recebido · ${base.falhas} falhas (de ${base.candidatos})`)
  return base
}
