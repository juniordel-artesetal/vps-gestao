// LEMBRETE PÓS-LIVE da oferta do Método Mãe (16/10/2026, pedido do Júnior: ~21h35, depois da live de lançamento).
// Só para as assinantes ATIVAS do SOA que ainda NÃO têm o MAE (o mesmo público "ativa" do e-mail do lançamento:
// conta com acesso ao SOA, fora a conta só-MAE, quem já tem o MAE, beta e quem pediu para não receber e-mails).
// Os preços vêm da config (MAE add-on: mensal, anual à vista, 12×) e cada botão vai DIRETO ao pagamento (conta=1).
// IDEMPOTENTE: cada conta reserva a sua linha em "AssinaturaAviso" (workspaceId, 'MAE_POS_LIVE', 16/10) antes de
// enviar. Endereço de teste fica de fora e, se o Resend recusar um lote, manda um a um (lição do e-mail da live).
import { prisma } from '@/lib/prisma'
import { tokenOptOut } from '@/lib/reengajamento'
import { precosMae, cobrancaMae, type PrecosMae } from './precos'
import { destinosLancamento, linkDoPlano } from './emailLancamento'
import { LINK_LIVE_MAE } from './emailLive'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const SITE = 'https://www.usesoa.com.br'
const TIPO = 'MAE_POS_LIVE'
const DIA = '2026-10-16'
const LOTE = 50
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export const ehEnderecoDeTeste = (e: string) => /@(example\.(com|org|net)|[^@]*\.(test|invalid|local|example))$/i.test(e)

/** Assunto + HTML (puro). */
export function montarEmailPosLive(nome: string | null, p: PrecosMae, optout: string): { assunto: string; html: string } {
  const primeiro = nome ? esc(String(nome).trim().split(/\s+/)[0]) : ''
  const doze = cobrancaMae(p, 'addon', 'anual', 12)
  const btn = (txt: string, href: string, cheio = true) => `<a href="${href}" style="display:block;margin:8px 0;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:600;text-align:center;${cheio ? 'background:#f97316;color:#fff' : 'border:2px solid #f97316;color:#c2410c;background:#fff'}">${txt}</a>`
  const assunto = `A live acabou — o Método Mãe já pode estar no seu SOA por ${brl(p.addon.mensal)}/mês`.replace(/ /g, ' ')
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} 💛</p>
    <p>Obrigada por estar com a gente na <b>live de lançamento do Método Mãe</b>! Se você não conseguiu assistir, a gravação continua no ar: <a href="${LINK_LIVE_MAE}" style="color:#c2410c">assistir à live</a>.</p>
    <p>Como você já é assinante do SOA, o Método Mãe <b>soma à sua assinatura</b> — a arte de cada pedido pronta, com o nome, a idade e o tema da cliente, edição em massa e o lote de impressão organizado.</p>
    <div style="border:1px solid #fde2cc;border-radius:12px;padding:14px 16px;margin:14px 0;background:#fffaf5">
      <p style="margin:0 0 4px;font-weight:700;font-size:16px">Método Mãe no seu SOA</p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px">É uma cobrança separada; o seu SOA continua como está. Cancele quando quiser.</p>
      ${btn(`Mensal — ${brl(p.addon.mensal)}/mês`, linkDoPlano('soa-mae', 'mensal'))}
      ${btn(`Anual — ${brl(p.addon.anual)} à vista (Pix ou cartão)`, linkDoPlano('soa-mae', 'anual', 1), false)}
      ${btn(`Anual em até 12× — 12× de ${brl(doze.valorParcela)} (com juros)`, linkDoPlano('soa-mae', 'anual', 12), false)}
    </div>
    <p style="color:#6b7280;font-size:14px">Ficou alguma dúvida? É só responder este e-mail que a gente te ajuda.</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Não quer receber novidades do SOA? <a href="${optout}" style="color:#9ca3af">Cancelar os avisos</a>.</p>
  </div>`.trim()
  return { assunto, html }
}

export interface ResultadoPosLive { candidatos: number; enviados: number; jaEnviados: number; falhas: number; erro?: string }

export async function dispararEmailPosLive(o: { seco?: boolean } = {}): Promise<ResultadoPosLive> {
  const p = precosMae()
  const destinos = (await destinosLancamento()).filter(d => d.variante === 'ativa' && !ehEnderecoDeTeste(d.email) && !d.email.endsWith('@usesoa.com.br'))
  const r: ResultadoPosLive = { candidatos: destinos.length, enviados: 0, jaEnviados: 0, falhas: 0 }
  if (o.seco) return r
  if (!p) return { ...r, erro: 'Preços do Método Mãe não configurados' }
  if (!process.env.RESEND_API_KEY) return { ...r, erro: 'RESEND_API_KEY ausente' }
  const enviar = (corpo: unknown, lote: boolean) => fetch(`https://api.resend.com/emails${lote ? '/batch' : ''}`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  })
  for (let i = 0; i < destinos.length; i += LOTE) {
    const reservados: { id: string; d: (typeof destinos)[number] }[] = []
    for (const d of destinos.slice(i, i + LOTE)) {
      const [x] = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
        VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${d.workspaceId}, ${TIPO}, ${DIA}::date, NOW())
        ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"`
      if (x) reservados.push({ id: x.id, d }); else r.jaEnviados++
    }
    if (!reservados.length) continue
    const corpo = reservados.map(({ d }) => {
      const { assunto, html } = montarEmailPosLive(d.nome, p, `${SITE}/api/reengajamento/optout?u=${encodeURIComponent(d.userId)}&t=${tokenOptOut(d.userId)}`)
      return { from: REMETENTE, to: [d.email], subject: assunto, html }
    })
    const res = await enviar(corpo, true).catch(() => null)
    if (res?.ok) {
      await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ANY(${reservados.map(x => x.id)})`
      r.enviados += reservados.length
    } else {
      console.error(`[MAE POS-LIVE] lote ${i / LOTE + 1} recusado (${res?.status ?? 'rede'}) — mandando um a um`)
      for (let k = 0; k < reservados.length; k++) {
        const ok = await enviar(corpo[k], false).then(x => x.ok).catch(() => false)
        if (ok) { await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ${reservados[k].id}`; r.enviados++ }
        else { await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ${reservados[k].id} AND "enviadoEm" IS NULL`.catch(() => {}); r.falhas++ }
        await new Promise(x => setTimeout(x, 250))
      }
    }
    await new Promise(x => setTimeout(x, 700))
  }
  console.log(`[MAE POS-LIVE] ${r.enviados} enviados · ${r.jaEnviados} já tinham recebido · ${r.falhas} falhas (de ${r.candidatos})`)
  return r
}
