// ─────────────────────────────────────────────────────────────────────────────
// REENGAJAMENTO por e-mail — puxa a artesã de volta SEM virar spam.
//
// Fonte ÚNICA da verdade dos alertas: lib/sofia/alertas.ts (a MESMA que a Sofia
// mostra no login). O e-mail e a Sofia nunca divergem.
//
// Envia SÓ SE houver motivo real: alerta relevante OU inatividade OU estagnação.
// Quem loga sempre e está em dia NÃO recebe. Respeita COOLDOWN e OPT-OUT, é
// idempotente (o log de envio + a janela de cooldown impedem duplicar) e tem
// DRY-RUN. LGPD: só agregados da própria artesã; nada de CPF/endereço.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { calcularAlertas, type Alerta } from '@/lib/sofia/alertas'

export const INATIVIDADE_DIAS = 4  // sem login há 4 dias → candidata
export const LACUNA_DIAS = 7       // sem cadastrar pedido/produto/material/financeiro
export const COOLDOWN_DIAS = 4     // no máx. 1 e-mail a cada 4 dias por artesã

const BASE = 'https://www.usesoa.com.br'
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const primeiroNome = (n: string | null) => (String(n || '').trim().split(/\s+/)[0] || 'amiga')
const escHtml = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── OPT-OUT: token por usuária (HMAC do secret) — link no rodapé de todo e-mail ──
export function tokenOptOut(userId: string): string {
  return crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || 'sofia').update('optout:' + userId).digest('hex').slice(0, 24)
}
export function tokenOptOutValido(userId: string, t: string): boolean {
  const esperado = tokenOptOut(userId)
  try { return t.length === esperado.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(esperado)) } catch { return false }
}

export interface Candidata {
  workspaceId: string
  userId: string
  nome: string | null
  email: string
  motivo: string
  alertas: Alerta[]
  soInatividade: boolean
}

/** Lista quem RECEBERIA hoje (aplica todos os gates, menos o envio em si). */
export async function listarCandidatas(agora = new Date()): Promise<Candidata[]> {
  // Base elegível (gates baratos em SQL): workspace ativo e "maduro" (evita novata
  // recém-cadastrada), 1 admin ativa com e-mail, sem opt-out, fora do cooldown.
  const linhas = await prisma.$queryRaw`
    SELECT w."id" AS "workspaceId", u."id" AS "userId", u."nome", u."email", u."ultimoAcesso",
           GREATEST(
             COALESCE((SELECT MAX("createdAt") FROM "Order"         WHERE "workspaceId" = w."id"), 'epoch'::timestamptz),
             COALESCE((SELECT MAX("createdAt") FROM "PrecProduto"   WHERE "workspaceId" = w."id"), 'epoch'::timestamptz),
             COALESCE((SELECT MAX("createdAt") FROM "PrecMaterial"  WHERE "workspaceId" = w."id"), 'epoch'::timestamptz),
             COALESCE((SELECT MAX("createdAt") FROM "FinLancamento" WHERE "workspaceId" = w."id"), 'epoch'::timestamptz)
           ) AS "ultimaAtividade"
    FROM "Workspace" w
    JOIN LATERAL (
      SELECT "id","nome","email","ultimoAcesso" FROM "User"
      WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true AND "email" IS NOT NULL
      ORDER BY "createdAt" ASC LIMIT 1
    ) u ON true
    WHERE w."ativo" = true
      AND w."createdAt" < ${agora}::timestamptz - (${INATIVIDADE_DIAS} || ' days')::interval
      -- B6: NUNCA reengajar/cobrar quem paga. Pagante confirmado (cicloAssinatura setado
      -- pela reconciliação) ou marcado ATIVA fica de fora — evita "você sumiu" a assinante.
      AND w."cicloAssinatura" IS NULL
      AND w."assinaturaStatus" <> 'ATIVA'
      AND NOT EXISTS (SELECT 1 FROM "ReengajamentoOptOut" o WHERE o."userId" = u."id")
      AND NOT EXISTS (SELECT 1 FROM "ReengajamentoEnvio" e WHERE e."userId" = u."id"
                        AND e."enviadoEm" > ${agora}::timestamptz - (${COOLDOWN_DIAS} || ' days')::interval)
  ` as { workspaceId: string; userId: string; nome: string | null; email: string; ultimoAcesso: Date | null; ultimaAtividade: Date }[]

  const lim = (dias: number) => new Date(agora.getTime() - dias * 86400000)
  const candidatas: Candidata[] = []
  for (const l of linhas) {
    const inativa = !l.ultimoAcesso || new Date(l.ultimoAcesso) < lim(INATIVIDADE_DIAS)
    const estagnada = new Date(l.ultimaAtividade) < lim(LACUNA_DIAS)
    const alertas = await calcularAlertas(l.workspaceId)
    // Regra: envia só se houver MOTIVO real. Quem está em dia e ativa não entra.
    if (alertas.length === 0 && !inativa && !estagnada) continue
    const motivo = alertas.length ? 'alertas' : inativa && estagnada ? 'inativa+estagnada' : inativa ? 'inativa' : 'estagnada'
    candidatas.push({ workspaceId: l.workspaceId, userId: l.userId, nome: l.nome, email: l.email, motivo, alertas, soInatividade: alertas.length === 0 })
  }
  return candidatas
}

/** Monta o e-mail na voz da Sofia. Com pendência: alertas + CTAs. Só sumida: leve. */
export function montarEmail(c: Candidata): { assunto: string; html: string } {
  const nome = escHtml(primeiroNome(c.nome))
  const optout = `${BASE}/api/reengajamento/optout?u=${encodeURIComponent(c.userId)}&t=${tokenOptOut(c.userId)}`
  const rodape = `<p style="margin:28px 0 0;font-size:12px;color:#9ca3af">Com carinho, Sofia — sua facilitadora no SOA 🧡<br>
    Não quer mais esses lembretes? <a href="${optout}" style="color:#9ca3af">Cancelar os avisos</a>.</p>`
  const wrap = (corpo: string) => `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;max-width:520px;margin:0 auto;padding:8px;line-height:1.5">${corpo}${rodape}</div>`
  const botao = (texto: string, href: string) => `<a href="${href}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:9px 16px;border-radius:10px;margin:4px 6px 4px 0">${escHtml(texto)}</a>`

  if (c.alertas.length > 0) {
    const linhas = c.alertas.map(a => `<li style="margin:6px 0">${escHtml(a.texto)}</li>`).join('')
    const botoes = c.alertas.map(a => botao(rotuloCta(a), `${BASE}${a.link}`)).join('')
    return {
      assunto: `Oi, ${primeiroNome(c.nome)}! Tem coisinha esperando por você 🧡`,
      html: wrap(`<p>Oi, ${nome}! 🧡 Passando rapidinho pra te avisar o que merece uma olhadinha no seu ateliê:</p>
        <ul style="padding-left:18px;margin:12px 0">${linhas}</ul>
        <p>Bora resolver? É só clicar 👇</p>
        <p style="margin:8px 0 0">${botoes}</p>`),
    }
  }
  // Só sumida (sem pendência) — mensagem leve.
  return {
    assunto: `Senti sua falta no SOA 🧡`,
    html: wrap(`<p>Oi, ${nome}! 🧡 Faz uns dias que não te vejo por aqui e passei só pra dar um oi.</p>
      <p>Seu ateliê tá te esperando — que tal cadastrar aquele pedido novo ou dar uma organizada na produção? Tô aqui do seu lado se precisar.</p>
      <p style="margin:12px 0 0">${botao('Voltar pro meu ateliê', `${BASE}/dashboard`)}</p>`),
  }
}

function rotuloCta(a: Alerta): string {
  if (a.tipo === 'pedidos_atrasados') return 'Ver pedidos atrasados'
  if (a.tipo === 'contas_vencidas' || a.tipo === 'contas_hoje') return 'Ver financeiro'
  if (a.tipo === 'estoque_baixo') return 'Ver estoque'
  return 'Abrir'
}

async function enviarEmail(para: string, assunto: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [para], subject: assunto, html }),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}`)
    return true
  } catch (e) { console.error('[REENGAJAMENTO] envio:', (e as Error)?.message); return false }
}

export interface ResultadoReengajamento {
  dryRun: boolean
  candidatas: number
  enviados: number
  itens: { email: string; motivo: string; assunto: string; nAlertas: number }[]
  erros: number
}

/**
 * Roda a rotina. dryRun=true (ou flag REENGAJAMENTO_ATIVO != 'on') apenas LISTA
 * quem receberia e o conteúdo, sem enviar nem gravar log. Só com a flag on e
 * dryRun=false envia de verdade e grava o log (cooldown/idempotência).
 */
export async function executarReengajamento(opts: { dryRun?: boolean; agora?: Date } = {}): Promise<ResultadoReengajamento> {
  const agora = opts.agora ?? new Date()
  const ativo = String(process.env.REENGAJAMENTO_ATIVO || '').toLowerCase() === 'on'
  const dryRun = opts.dryRun ?? !ativo
  const cands = await listarCandidatas(agora)
  const out: ResultadoReengajamento = { dryRun, candidatas: cands.length, enviados: 0, itens: [], erros: 0 }

  for (const c of cands) {
    const { assunto, html } = montarEmail(c)
    out.itens.push({ email: c.email, motivo: c.motivo, assunto, nAlertas: c.alertas.length })
    if (dryRun) continue
    const ok = await enviarEmail(c.email, assunto, html)
    if (!ok) { out.erros++; continue }
    await prisma.$executeRaw`
      INSERT INTO "ReengajamentoEnvio" ("id","workspaceId","userId","enviadoEm","motivo")
      VALUES (${gerarId()}, ${c.workspaceId}, ${c.userId}, NOW(), ${c.motivo})
    `.catch(() => {})
    out.enviados++
  }
  console.log(`[REENGAJAMENTO] ${dryRun ? '(dryRun) ' : ''}candidatas=${out.candidatas} enviados=${out.enviados} erros=${out.erros}`)
  return out
}

/** A usuária recebeu um e-mail de reengajamento nas últimas 48h? (coerência Sofia↔e-mail) */
export async function emailReengajamentoRecente(userId: string): Promise<boolean> {
  try {
    const [r] = await prisma.$queryRaw`
      SELECT 1 AS x FROM "ReengajamentoEnvio"
      WHERE "userId" = ${userId} AND "enviadoEm" > NOW() - INTERVAL '48 hours' LIMIT 1
    ` as { x: number }[]
    return !!r
  } catch { return false }
}
