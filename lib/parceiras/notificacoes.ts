// Notificação à PARCEIRA quando uma indicada dela entra em TRIAL (início do teste).
//
// Decisão do Diretor: avisar no INÍCIO do teste (não esperar os 30 dias até o
// pagamento) — motiva a parceira e é preciso; a copy não promete comissão antes
// do pagamento. Disparado dos DOIS pontos onde a indicada entra em TRIAL
// (checkout de cartão concluído e Pix gerado), só na transição real.
//
// Idempotência: reaproveita AssinaturaAviso com a sentinela UMA_VEZ (índice
// (workspaceId, tipo, dia)) → exatamente UMA vez por workspace, imune a
// reentrega de webhook. Nunca lança.
import { prisma } from '@/lib/prisma'
import { getPlano } from '@/lib/assinatura/planos'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { enviarEmailParceira, emailSeguidoraTrial } from '@/lib/parceiras/emails'

const UMA_VEZ = '1970-01-01'
const TIPO = 'PARCEIRA_SEGUIDORA_TRIAL'
const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function avisarParceiraSeguidoraTrial(workspaceId: string): Promise<void> {
  if (!parceirasAtivo()) return
  try {
    // Trava de idempotência ANTES de qualquer envio (mesmo padrão do avisarEquipe).
    const marcado = await prisma.$queryRaw`
      INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
      VALUES (${novoId()}, ${workspaceId}, ${TIPO}, ${UMA_VEZ}::date, NOW())
      ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING
      RETURNING "id"
    ` as { id: string }[]
    if (!marcado.length) return // já avisado

    const liberar = () => prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ${marcado[0].id} AND "enviadoEm" IS NULL`.catch(() => {})

    // Parceira atribuída + 1º nome da indicada + plano. Só 1º nome sai daqui (LGPD).
    const [d] = await prisma.$queryRaw`
      SELECT p."email" AS "emailParceira", p."nome" AS "nomeParceira",
             u."nome" AS "nomeIndicada", w."planoEscolhido"
      FROM "Lead" l
      JOIN "Parceiro" p ON p."id" = l."parceiroId"
      JOIN "Workspace" w ON w."id" = l."workspaceId"
      LEFT JOIN LATERAL (
        SELECT "nome" FROM "User"
        WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true
        ORDER BY "createdAt" ASC LIMIT 1
      ) u ON true
      WHERE l."workspaceId" = ${workspaceId} AND l."parceiroId" IS NOT NULL
      LIMIT 1
    ` as { emailParceira: string | null; nomeParceira: string | null; nomeIndicada: string | null; planoEscolhido: string | null }[]

    if (!d?.emailParceira) { await liberar(); return } // sem parceira atribuída → nada a fazer

    const plano = `plano ${getPlano(d.planoEscolhido).nome}`
    const { assunto, corpo } = emailSeguidoraTrial(d.nomeParceira, d.nomeIndicada, plano)
    const ok = await enviarEmailParceira(d.emailParceira, assunto, corpo)
    if (!ok) { await liberar(); return }

    await prisma.$executeRaw`UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ${marcado[0].id}`
    console.log(`[PARCEIRA] aviso seguidora-trial enviado ws=${workspaceId}`)
  } catch (e) {
    console.error(`[PARCEIRA] falha no aviso seguidora-trial ws=${workspaceId}:`, (e as Error)?.message)
  }
}

const escHtml = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Avisa a EQUIPE no Telegram quando uma nova candidata entra na fila. Reaproveita
 * a MESMA integração de Telegram dos chamados/feedbacks (bot/token/chat via env) —
 * canal interno, então pode conter contato. Nunca lança: falha no Telegram não
 * pode derrubar a candidatura (mesmo padrão dos chamados).
 */
export async function notificarNovaParceiraTelegram(parceiroId: string): Promise<void> {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return
    const [p] = await prisma.$queryRaw`
      SELECT "nome","email","whatsapp","instagram",
             ("senhaCripto" IS NOT NULL) AS "temSenha", ("cupom" IS NOT NULL) AS "temCodigo"
      FROM "Parceiro" WHERE "id" = ${parceiroId} LIMIT 1
    ` as { nome: string | null; email: string | null; whatsapp: string | null; instagram: string | null; temSenha: boolean; temCodigo: boolean }[]
    if (!p) return

    const completude = (p.temSenha && p.temCodigo)
      ? '✅ pronta para aprovar'
      : '⏳ aguardando ela completar senha+código'
    const texto = [
      '🤝 <b>Nova candidata a parceira na fila!</b>',
      '',
      `<b>Nome:</b> ${escHtml(p.nome || '—')}`,
      `<b>Instagram:</b> @${escHtml(p.instagram || '—')}`,
      `<b>WhatsApp:</b> ${escHtml(p.whatsapp || '—')}`,
      `<b>E-mail:</b> ${escHtml(p.email || '—')}`,
      '',
      completude,
      '',
      '👉 usesoa.com.br/master/parceiros',
    ].join('\n')

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
  } catch (e) {
    console.error('[PARCEIRA] falha no Telegram de nova candidata:', (e as Error)?.message)
  }
}
