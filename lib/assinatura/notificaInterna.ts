// Avisos internos do funil — para a equipe, não para a artesã.
//
// Dois momentos que o Júnior quer ver na caixa de entrada:
//   TRIAL   — alguém entrou (cartão cadastrado ou Pix gerado)
//   PAGANTE — alguém converteu (primeira cobrança recebida)
//
// IDEMPOTÊNCIA por workspace, para sempre — não por dia. Reaproveitamos o índice
// único (workspaceId, tipo, dia) da AssinaturaAviso gravando uma data SENTINELA
// fixa: com `dia` constante, o índice passa a significar "uma vez por workspace",
// que é exatamente a garantia que estes avisos precisam. Sem isso, um
// reprocessamento de webhook em outro dia mandaria o e-mail de novo.
import { prisma } from '@/lib/prisma'
import { nomeDoSegmento } from '@/lib/segmentos'
import { getPlano } from './planos'

/** Data sentinela: transforma o índice diário em "uma vez por workspace". */
const UMA_VEZ = '1970-01-01'

export type AvisoInterno = 'INTERNO_NOVO_TRIAL' | 'INTERNO_NOVO_PAGANTE'

const DESTINO = process.env.EMAIL_INTERNO || 'contato@usesoa.com.br'

export interface DadosLead {
  workspaceId: string
  workspace: string | null
  pessoa: string | null
  email: string | null
  segmento: string | null
  planoEscolhido: string | null
  metodoEscolhido: string | null
  formaEscolhida: string | null
}

/**
 * Monta assunto e corpo. Separado do envio para a prova poder conferir a copy
 * sem disparar e-mail de verdade — e para o Júnior revisar o texto lendo uma
 * função só.
 */
export function montarAviso(d: DadosLead, tipo: AvisoInterno, quando: string): { assunto: string; html: string } {
  const plano = d.planoEscolhido ? getPlano(d.planoEscolhido).nome : '—'
  const forma = d.formaEscolhida === 'parcelado' ? '12x' : 'à vista'
  const metodo = d.metodoEscolhido === 'pix' ? 'Pix' : 'Cartão'
  const novo = tipo === 'INTERNO_NOVO_TRIAL'

  const assunto = novo
    ? `🎉 Novo trial no SOA: ${d.pessoa ?? d.workspace} (${plano}/${forma})`
    : `💰 Novo assinante pagante: ${d.pessoa ?? d.workspace}`

  const linhas: [string, string][] = [
    ['Pessoa', d.pessoa ?? '—'],
    ['E-mail', d.email ?? '—'],
    ['Ateliê', d.workspace ?? '—'],
    ['Segmento', nomeDoSegmento(d.segmento) ?? 'não informado'],
    ['Plano', `${plano} · ${metodo} · ${forma}`],
    [novo ? 'Trial iniciado em' : 'Pagamento confirmado em', quando],
  ]

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#1f2937">
    <h2 style="margin:0 0 16px">${novo ? '🎉 Novo trial' : '💰 Novo assinante pagante'}</h2>
    <table style="border-collapse:collapse">
      ${linhas.map(([k, v]) => `<tr>
        <td style="padding:4px 16px 4px 0;color:#6b7280">${k}</td>
        <td style="padding:4px 0;font-weight:600">${String(v).replace(/</g, '&lt;')}</td>
      </tr>`).join('')}
    </table>
    <p style="margin:16px 0 0;color:#6b7280">Workspace <code>${d.workspaceId}</code></p>
  </div>`

  return { assunto, html }
}

/**
 * Manda o aviso interno UMA vez por workspace. Nunca lança: avisar a equipe é
 * consequência do evento, não pode derrubar o processamento do pagamento nem do
 * checkout.
 */
export async function avisarEquipe(workspaceId: string, tipo: AvisoInterno): Promise<{ enviado: boolean; motivo?: string }> {
  // A trava é o INSERT: se não voltou linha, este aviso já saiu algum dia.
  const marcado = await prisma.$queryRaw`
    INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
    VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)},
            ${workspaceId}, ${tipo}, ${UMA_VEZ}::date, NOW())
    ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING
    RETURNING "id"
  ` as { id: string }[]
  if (!marcado.length) return { enviado: false, motivo: 'já avisado' }

  try {
    const [d] = await prisma.$queryRaw`
      SELECT w."id" AS "workspaceId", w."nome" AS "workspace", w."segmento",
             w."planoEscolhido", w."metodoEscolhido", w."formaEscolhida",
             u."nome" AS "pessoa", u."email"
      FROM "Workspace" w
      LEFT JOIN LATERAL (
        SELECT "nome","email" FROM "User"
        WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true
        ORDER BY "createdAt" ASC LIMIT 1
      ) u ON true
      WHERE w."id" = ${workspaceId} LIMIT 1
    ` as DadosLead[]
    if (!d) { await liberar(marcado[0].id); return { enviado: false, motivo: 'workspace não encontrada' } }
    if (!process.env.RESEND_API_KEY) { await liberar(marcado[0].id); return { enviado: false, motivo: 'RESEND_API_KEY ausente' } }

    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const { assunto, html } = montarAviso(d, tipo, quando)

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [DESTINO], subject: assunto, html }),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}`)

    await prisma.$executeRaw`
      UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ${marcado[0].id}
    `
    console.log(`[INTERNO] ${tipo} enviado ws=${workspaceId}`)
    return { enviado: true }
  } catch (e) {
    // Falhou o envio: LIBERA a reserva para um próximo evento poder tentar de
    // novo. Sem isso, uma pane transitória do Resend calaria o aviso para sempre
    // (a idempotência é uma faca de dois gumes — ela também bloqueia o retry).
    await liberar(marcado[0].id)
    console.error(`[INTERNO] ${tipo} não enviado ws=${workspaceId}:`, (e as Error)?.message)
    return { enviado: false, motivo: (e as Error)?.message }
  }
}

/** Solta a reserva de idempotência quando o envio não chegou a acontecer. */
async function liberar(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ${id} AND "enviadoEm" IS NULL`.catch(() => {})
}
