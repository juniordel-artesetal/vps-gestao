// E-mail "ESTAMOS AO VIVO" — live de lançamento do Método Mãe (16/10/2026, 20h). Pedido do Júnior: sai às 19h58 para
// TODAS as assinantes do SOA, ativas e inativas (cron único "58 22 16 10 *" em UTC). Mesmo público do e-mail do
// lançamento, sem tirar quem já tem o MAE: conta com a ADMIN ativa, e-mail único, respeitando o opt-out.
// IDEMPOTENTE: cada conta reserva a sua linha em "AssinaturaAviso" (workspaceId, 'MAE_LIVE', 16/10/2026) antes de enviar.
// Só envia entre 19h50 e 21h de 16/10/2026 (o agendamento é anual e não pode repetir em 2027). Envio em lote (Resend batch).
import { prisma } from '@/lib/prisma'
import { tokenOptOut } from '@/lib/reengajamento'

export const LINK_LIVE_MAE = 'https://www.youtube.com/live/2wxv5XOCLNA?si=U7rjytMg0kvg3Tq0'
const TIPO = 'MAE_LIVE'
const DIA = '2026-10-16'
const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const SITE = 'https://www.usesoa.com.br'
const LOTE = 50
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Janela de envio: 16/10/2026 das 19h50 às 21h (Brasília). */
export const janelaEmailLive = (agora = new Date()) =>
  agora.getTime() >= Date.parse('2026-10-16T22:50:00Z') && agora.getTime() < Date.parse('2026-10-17T00:00:00Z')

/** Assunto + HTML (puro). */
export function montarEmailLive(nome: string | null, optout: string): { assunto: string; html: string } {
  const primeiro = nome ? esc(String(nome).trim().split(/\s+/)[0]) : ''
  return {
    assunto: '🔴 Começa agora: live de lançamento do Método Mãe',
    html: `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} 💛</p>
    <p>Daqui a pouquinho, <b>às 20h</b>, começa a <b>live de lançamento do Método Mãe</b> — e queremos muito você com a gente!</p>
    <ul style="padding-left:18px">
      <li>Como o Método Mãe monta a arte de cada pedido sozinho, com nome, idade e tema;</li>
      <li>Edição em massa e lote de impressão na prática;</li>
      <li>Condições especiais de lançamento e respostas às suas dúvidas, ao vivo.</li>
    </ul>
    <p style="text-align:center;margin:24px 0"><a href="${LINK_LIVE_MAE}" style="background:#dc2626;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Assistir à live agora</a></p>
    <p style="color:#6b7280;font-size:14px">Ative o lembrete no YouTube e chegue um pouquinho antes. Te esperamos lá!</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Não quer receber novidades do SOA? <a href="${optout}" style="color:#9ca3af">Cancelar os avisos</a>.</p>
  </div>`.trim(),
  }
}

interface Destino { workspaceId: string; userId: string; nome: string | null; email: string }

/** Todas as contas (ativas e inativas) com a ADMIN ativa, e-mail único, sem opt-out e sem as contas de teste. */
export async function destinosLive(): Promise<Destino[]> {
  const linhas = await prisma.$queryRaw<{ workspaceId: string; userId: string; nome: string | null; email: string }[]>`
    SELECT w."id" AS "workspaceId", u."id" AS "userId", u."nome", lower(trim(u."email")) AS email
    FROM "Workspace" w
    JOIN LATERAL (
      SELECT "id","nome","email" FROM "User"
      WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true AND "email" IS NOT NULL AND "email" <> ''
      ORDER BY "createdAt" ASC LIMIT 1
    ) u ON true
    WHERE NOT EXISTS (SELECT 1 FROM "ReengajamentoOptOut" o WHERE o."userId" = u."id")
    ORDER BY w."createdAt"`
  const vistos = new Set<string>(), out: Destino[] = []
  for (const l of linhas) {
    // endereço de teste (example.com, .test…) faz o Resend recusar o LOTE inteiro — fica de fora
    if (!l.email.includes('@') || vistos.has(l.email) || l.email.endsWith('@usesoa.com.br') || /@(example\.(com|org|net)|[^@]*\.(test|invalid|local|example))$/.test(l.email)) continue
    vistos.add(l.email); out.push(l)
  }
  return out
}

export interface ResultadoLive { candidatos: number; enviados: number; jaEnviados: number; falhas: number; erro?: string }

export async function dispararEmailLive(o: { seco?: boolean; agora?: Date } = {}): Promise<ResultadoLive> {
  const destinos = await destinosLive()
  const r: ResultadoLive = { candidatos: destinos.length, enviados: 0, jaEnviados: 0, falhas: 0 }
  if (o.seco) return r
  if (!janelaEmailLive(o.agora ?? new Date())) return { ...r, erro: 'Fora da janela da live (16/10/2026 19h50 → 21h)' }
  if (!process.env.RESEND_API_KEY) return { ...r, erro: 'RESEND_API_KEY ausente' }
  for (let i = 0; i < destinos.length; i += LOTE) {
    const lote = destinos.slice(i, i + LOTE)
    const reservados: { id: string; d: Destino }[] = []
    for (const d of lote) {
      const [x] = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
        VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${d.workspaceId}, ${TIPO}, ${DIA}::date, NOW())
        ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING RETURNING "id"`
      if (x) reservados.push({ id: x.id, d }); else r.jaEnviados++
    }
    if (!reservados.length) continue
    const corpo = reservados.map(({ d }) => {
      const { assunto, html } = montarEmailLive(d.nome, `${SITE}/api/reengajamento/optout?u=${encodeURIComponent(d.userId)}&t=${tokenOptOut(d.userId)}`)
      return { from: REMETENTE, to: [d.email], subject: assunto, html }
    })
    const ids = reservados.map(x => x.id)
    const enviarUm = (c: (typeof corpo)[number]) => fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(c),
    })
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
      await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ANY(${ids})`
      r.enviados += reservados.length
    } catch (e) {
      // um endereço ruim derruba o lote inteiro no Resend: manda um a um (só o ruim fica de fora)
      console.error(`[MAE LIVE] lote ${i / LOTE + 1} falhou — mandando um a um:`, (e as Error).message)
      for (let k = 0; k < reservados.length; k++) {
        const ok = await enviarUm(corpo[k]).then(x => x.ok).catch(() => false)
        if (ok) { await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ${reservados[k].id}`; r.enviados++ }
        else { await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ${reservados[k].id} AND "enviadoEm" IS NULL`.catch(() => {}); r.falhas++ }
        await new Promise(x => setTimeout(x, 250))
      }
    }
    await new Promise(x => setTimeout(x, 700))
  }
  console.log(`[MAE LIVE] ${r.enviados} enviados · ${r.jaEnviados} já tinham recebido · ${r.falhas} falhas (de ${r.candidatos})`)
  return r
}
