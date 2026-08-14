// Cron — AVISOS PROATIVOS do Pessoal, pelo bot PRÓPRIO de cada usuária (BYO).
// Por usuária com bot ATIVO + avisos ligados + assinatura ATIVA:
//   ⏰ VENCIMENTOS: despesas PENDENTES que vencem hoje/nos próximos dias.
//   💰 ENTRADAS PREVISTAS: receitas PENDENTES próximas.
// Escopo por userId (NUNCA cross-user). Idempotente: 1 aviso por pessoa por dia (PessoalAvisoDia).
// Autorizada por CRON_SECRET (Bearer, como a Vercel envia, ou ?secret=).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from '@/lib/pessoal/schema'
import { assinaturaAtiva } from '@/lib/pessoal/assinatura'
import { decryptToken } from '@/lib/pagamento/asaas/cripto'
import { enviarMensagem } from '@/lib/pessoal/telegram'

export const dynamic = 'force-dynamic'

const JANELA_VENCIMENTO = 3 // dias à frente p/ despesas pendentes
const JANELA_ENTRADA = 7    // dias à frente p/ receitas previstas
const fmt = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
function rotuloDias(d: number) { return d <= 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias` }

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await ensurePessoalTables()

  // Bots conectados com avisos ligados. (A assinatura ATIVA é rechecada por usuário.)
  const links = await prisma.$queryRaw`
    SELECT "userId", "botTokenCriptografado", "telegramChatId"
    FROM "PessoalTelegramLink"
    WHERE "status" = 'ATIVO' AND "ativo" = true AND "avisosAtivos" = true
      AND "botTokenCriptografado" IS NOT NULL AND "telegramChatId" IS NOT NULL
    LIMIT 500
  ` as { userId: string; botTokenCriptografado: string; telegramChatId: string }[]

  let enviados = 0, semNada = 0, jaAvisados = 0, inativos = 0
  for (const link of links) {
    try {
      if (!(await assinaturaAtiva(link.userId))) { inativos++; continue }

      // Despesas PENDENTES vencendo na janela (hoje..+N). "data" = vencimento.
      const venc = await prisma.$queryRaw`
        SELECT "descricao", "valor"::float AS valor, ("data" - CURRENT_DATE) AS dias
        FROM "PessoalLancamento"
        WHERE "userId" = ${link.userId} AND "tipo" = 'DESPESA' AND "status" = 'PENDENTE'
          AND "data" >= CURRENT_DATE AND "data" <= CURRENT_DATE + ${JANELA_VENCIMENTO}
        ORDER BY "data" ASC LIMIT 15
      ` as { descricao: string; valor: number; dias: number }[]

      // Receitas PENDENTES previstas na janela.
      const entradas = await prisma.$queryRaw`
        SELECT "descricao", "valor"::float AS valor, ("data" - CURRENT_DATE) AS dias
        FROM "PessoalLancamento"
        WHERE "userId" = ${link.userId} AND "tipo" = 'RECEITA' AND "status" = 'PENDENTE'
          AND "data" >= CURRENT_DATE AND "data" <= CURRENT_DATE + ${JANELA_ENTRADA}
        ORDER BY "data" ASC LIMIT 15
      ` as { descricao: string; valor: number; dias: number }[]

      if (!venc.length && !entradas.length) { semNada++; continue }

      // Idempotência: reivindica o dia ANTES de enviar (nunca avisa 2x no mesmo dia).
      const claim = await prisma.$queryRaw`
        INSERT INTO "PessoalAvisoDia" ("userId","dia") VALUES (${link.userId}, CURRENT_DATE)
        ON CONFLICT ("userId","dia") DO NOTHING RETURNING "userId"
      ` as any[]
      if (!claim.length) { jaAvisados++; continue }

      const token = decryptToken(link.botTokenCriptografado)
      if (!token) continue

      const partes: string[] = []
      if (venc.length) {
        partes.push('⏰ <b>Contas a vencer</b>\n' + venc.map(v => `• ${v.descricao} — <b>${fmt(v.valor)}</b> (${rotuloDias(Number(v.dias))})`).join('\n'))
      }
      if (entradas.length) {
        partes.push('💰 <b>Entradas previstas</b>\n' + entradas.map(e => `• ${e.descricao} — <b>${fmt(e.valor)}</b> (${rotuloDias(Number(e.dias))})`).join('\n'))
      }
      const msg = '☀️ <b>Bom dia! Seu resumo do dia</b>\n\n' + partes.join('\n\n') + '\n\n<i>Desative em /pessoal se não quiser estes avisos.</i>'
      const r = await enviarMensagem(token, link.telegramChatId, msg)
      if (r.ok) enviados++
    } catch (e) {
      console.error('[PESSOAL-AVISOS]', link.userId, (e as Error)?.message)
    }
  }

  return NextResponse.json({ ok: true, bots: links.length, enviados, semNada, jaAvisados, inativos })
}
