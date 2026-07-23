// Webhook do Asaas — chamada EXTERNA, sem sessão. A autenticação é o header
// `asaas-access-token` (segredo definido ao criar o webhook no painel do Asaas).
//
// Contrato do Asaas que dita o desenho desta rota:
//   - entrega AT LEAST ONCE  → idempotência obrigatória (eventoId ÚNICO no banco)
//   - resposta fora de 2xx   → reenvio; 15 falhas seguidas PARAM a fila inteira
//   → por isso: grava primeiro, responde 200, e nenhuma exceção de processamento
//     vira 500 depois do evento já persistido (ela é gravada na coluna "erro").
//
// 🔒 LGPD: o payload vai para JSONB já MASCARADO (mascararPayload) e o LOG só recebe
//    eventoId, tipo e ids do Asaas — nunca nome, e-mail, CPF ou dado de cartão.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validarTokenWebhook, asaasOperacional, limparSegredo } from '@/lib/pagamento/asaas'
import { mascararPayload, aplicarEvento, expurgarPayloadsAntigos } from '@/lib/pagamento/asaas/webhook'
import type { PayloadAsaas } from '@/lib/pagamento/asaas/webhook'

export const dynamic = 'force-dynamic'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
  // 1) AUTENTICIDADE — antes de ler o corpo. Fail closed.
  if (!await validarTokenWebhook(req.headers.get('asaas-access-token'))) {
    console.warn('[ASAAS-WH] token inválido ou ausente')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as PayloadAsaas | null
  const eventoId = body?.id
  const evento = body?.event

  // Sem id não há como garantir idempotência — descarta com 200 (reenviar não ajuda).
  if (!eventoId || !evento) {
    console.warn('[ASAAS-WH] payload sem id/event — descartado')
    return NextResponse.json({ ok: true, ignorado: 'sem id/event' })
  }

  const pag = body?.payment
  const registroId = gerarId()
  const payloadSeguro = mascararPayload(body ?? {})

  // 2) IDEMPOTÊNCIA — a trava é o índice único em "eventoId". Se não voltou linha,
  //    este evento já entrou antes: responde 200 e NÃO reprocessa.
  const inserido = await prisma.$queryRaw`
    INSERT INTO "AsaasWebhookEvento" ("id","eventoId","evento","pagamentoRef","assinaturaRef","payload","createdAt")
    VALUES (${registroId}, ${eventoId}, ${evento}, ${pag?.id ?? null}, ${pag?.subscription ?? null},
            ${JSON.stringify(payloadSeguro)}::jsonb, NOW())
    ON CONFLICT ("eventoId") DO NOTHING
    RETURNING "id"
  ` as { id: string }[]

  if (!inserido.length) {
    console.log(`[ASAAS-WH] duplicado evento=${evento} eventoId=${eventoId}`)
    return NextResponse.json({ ok: true, jaProcessado: true })
  }

  // 3) PROCESSAMENTO — daqui pra frente o evento JÁ está salvo. Qualquer erro é
  //    registrado na linha e a resposta continua 200 (não derrubar a fila do Asaas).
  try {
    // Feature flag OFF: o evento fica guardado para auditoria, mas nada é alterado.
    // Ele NÃO vira órfão: /api/config/asaas/reprocessar aplica os pendentes quando ligar.
    if (!await asaasOperacional()) {
      await prisma.$executeRaw`
        UPDATE "AsaasWebhookEvento"
        SET "erro" = 'Módulo Asaas desligado — pendente de reprocessamento'
        WHERE "id" = ${registroId}
      `
      console.log(`[ASAAS-WH] modulo OFF evento=${evento} eventoId=${eventoId}`)
      return NextResponse.json({ ok: true, guardado: true, processado: false })
    }

    const { aplicado } = await aplicarEvento(body ?? {})

    await prisma.$executeRaw`
      UPDATE "AsaasWebhookEvento" SET "processadoEm" = NOW() WHERE "id" = ${registroId}
    `

    // Retenção LGPD, oportunista: apaga o payload de eventos com +90 dias e mantém
    // a linha. Apoiado em índice parcial, custa ~nada quando não há o que expurgar.
    await expurgarPayloadsAntigos()
    console.log(`[ASAAS-WH] ok evento=${evento} eventoId=${eventoId} payment=${pag?.id ?? '-'}`)
    return NextResponse.json({ ok: true, processado: aplicado })

  } catch (e) {
    // Evento já persistido: registra a falha e devolve 200 para não travar a fila.
    // Fica com processadoEm NULL → entra no reprocessamento.
    const msg = limparSegredo((e as Error)?.message ?? 'erro desconhecido').slice(0, 300)
    console.error(`[ASAAS-WH] falha ao processar evento=${evento} eventoId=${eventoId}:`, msg)
    await prisma.$executeRaw`
      UPDATE "AsaasWebhookEvento" SET "erro" = ${msg} WHERE "id" = ${registroId}
    `.catch(() => {})
    return NextResponse.json({ ok: true, processado: false, erro: 'registrado para reprocessamento' })
  }
}
