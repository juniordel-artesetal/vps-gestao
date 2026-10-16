// GRUPO DE SUPORTE DAS ASSINANTES DO SOA no WhatsApp (16/10/2026, pedido do Júnior): e-mail para todas as assinantes
// ATIVAS do SOA + pop-up no sistema, com o botão "Entrar no grupo".
// Quem é "assinante ativa": conta ativa com a assinatura ATIVA (Asaas ou Hotmart) ou liberação manual do Master — teste
// grátis, inadimplente, cortada, cancelada e a conta "só Método Mãe" ficam de fora (o grupo é das assinantes do SOA).
// Destinatária: a ADMIN da conta. E-mail IDEMPOTENTE: cada conta reserva a sua linha em "AssinaturaAviso"
// (workspaceId, 'GRUPO_WHATSAPP', 16/10/2026) antes de enviar — disparar de novo nunca repete. Respeita o opt-out.
import { prisma } from '@/lib/prisma'
import { tokenOptOut } from '@/lib/reengajamento'
import { URL_SOA } from '@/lib/baseUrl'

export const LINK_GRUPO_WHATSAPP = 'https://chat.whatsapp.com/LcOOS2ZCpqKIIU2jdgs65u'
export const linkGrupoWhatsapp = (env: Record<string, string | undefined> = process.env) =>
  (env.GRUPO_WHATSAPP_LINK ?? '').trim().startsWith('https://chat.whatsapp.com/') ? env.GRUPO_WHATSAPP_LINK!.trim() : LINK_GRUPO_WHATSAPP
const TIPO = 'GRUPO_WHATSAPP'
const DIA = '2026-10-16'
const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** A conta é assinante ATIVA do SOA (público do grupo e do pop-up). Puro. */
export const ehAssinanteAtivaSoa = (w: { ativo: boolean; assinaturaStatus: string | null; liberacaoManual: boolean; soMae?: boolean }) =>
  !!w.ativo && !w.soMae && (w.assinaturaStatus === 'ATIVA' || !!w.liberacaoManual)

/** Assunto + HTML do convite (puro). */
export function montarEmailGrupo(nome: string | null, optout: string, link = LINK_GRUPO_WHATSAPP): { assunto: string; html: string } {
  const primeiro = nome ? esc(String(nome).trim().split(/\s+/)[0]) : ''
  return {
    assunto: 'Novo: grupo de suporte das assinantes do SOA no WhatsApp 💬',
    html: `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} 💛</p>
    <p>Temos uma novidade para você que é <b>assinante do SOA</b>: abrimos um <b>grupo de suporte no WhatsApp</b> só para as assinantes.</p>
    <ul style="padding-left:18px">
      <li>Suas dúvidas respondidas <b>ainda mais rápido</b>, direto pelo WhatsApp;</li>
      <li>Avisos de novidades e dicas para aproveitar melhor o SOA;</li>
      <li>Troca de experiências com outras artesãs que usam o sistema.</li>
    </ul>
    <p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#25D366;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Entrar no grupo</a></p>
    <p style="color:#6b7280;font-size:14px">O grupo é exclusivo para assinantes — não compartilhe o link. Qualquer dúvida, é só responder este e-mail.</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Não quer mais receber nossos e-mails? <a href="${optout}" style="color:#9ca3af">Clique aqui</a>.</p>
  </div>`.trim(),
  }
}

interface Destinataria { workspaceId: string; userId: string; nome: string | null; email: string }

async function destinatarias(): Promise<Destinataria[]> {
  return prisma.$queryRaw<Destinataria[]>`
    SELECT w."id" AS "workspaceId", u."id" AS "userId", u."nome", lower(u."email") AS email
    FROM "Workspace" w
    JOIN LATERAL (
      SELECT "id","nome","email" FROM "User"
      WHERE "workspaceId" = w."id" AND "ativo" = true AND "role" = 'ADMIN' AND "email" IS NOT NULL
      ORDER BY "createdAt" NULLS LAST LIMIT 1
    ) u ON true
    WHERE w."ativo" = true
      AND (w."assinaturaStatus" = 'ATIVA' OR w."liberacaoManual" = true)
      AND COALESCE(to_jsonb(w) ->> 'moduloMaePlano', '') <> 'standalone'
      AND NOT EXISTS (SELECT 1 FROM "ReengajamentoOptOut" o WHERE o."userId" = u."id")
    ORDER BY w."createdAt"`
}

export interface ResultadoGrupo { candidatas: number; jaEnviadas: number; enviados: number; falhas: number; seco: boolean; erro?: string }

/** Dispara o convite (uma vez por conta). `seco`: só conta. */
export async function dispararEmailGrupo(o: { seco?: boolean; limite?: number } = {}): Promise<ResultadoGrupo> {
  const lista = await destinatarias()
  const ja = new Set((await prisma.$queryRaw<{ workspaceId: string }[]>`
    SELECT "workspaceId" FROM "AssinaturaAviso" WHERE "tipo" = ${TIPO} AND "dia" = ${DIA}::date AND "enviadoEm" IS NOT NULL`).map(x => x.workspaceId))
  const r: ResultadoGrupo = { candidatas: lista.length, jaEnviadas: lista.filter(d => ja.has(d.workspaceId)).length, enviados: 0, falhas: 0, seco: !!o.seco }
  if (o.seco) return r
  if (!process.env.RESEND_API_KEY) return { ...r, erro: 'RESEND_API_KEY ausente' }
  const link = linkGrupoWhatsapp()
  for (const d of lista) {
    if (ja.has(d.workspaceId)) continue
    if (r.enviados >= (o.limite ?? 400)) break
    // reserva atômica ANTES de enviar
    const [res] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
      VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${d.workspaceId}, ${TIPO}, ${DIA}::date, NOW())
      ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"`
    if (!res) continue
    const optout = `${URL_SOA}/api/reengajamento/optout?u=${encodeURIComponent(d.userId)}&t=${tokenOptOut(d.userId)}`
    const { assunto, html } = montarEmailGrupo(d.nome, optout, link)
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: REMETENTE, to: [d.email], subject: assunto, html }),
      })
      if (!resp.ok) throw new Error(`Resend ${resp.status}`)
      await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ${res.id}`
      r.enviados++
    } catch (e) {
      await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ${res.id} AND "enviadoEm" IS NULL`.catch(() => {})
      r.falhas++
      console.error(`[GRUPO WHATSAPP] ws=${d.workspaceId}:`, (e as Error).message)
    }
    await new Promise(x => setTimeout(x, 600))
  }
  console.log(`[GRUPO WHATSAPP] ${r.enviados} enviados de ${r.candidatas} (${r.jaEnviadas} já tinham recebido)${r.falhas ? ` · ${r.falhas} falhas` : ''}`)
  return r
}
