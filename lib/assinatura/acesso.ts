// Ponte entre COBRANÇA e ACESSO — o que o webhook do Asaas dispara no Workspace.
//
// Separado de lib/pagamento/asaas/webhook.ts de propósito: aquele arquivo cuida do
// contrato com o Asaas (idempotência, mascaramento, retenção); este cuida da regra
// de negócio da assinatura. Misturar os dois faria a próxima mudança de regra
// comercial mexer no código que conversa com o provedor.
//
// ⚠️ NUNCA toca workspace com assinaturaOrigem <> 'asaas'. O caminho Hotmart é
//    governado pelo webhook dela e pelo Master; interferir aqui seria cortar ou
//    liberar alguém por um evento que não é dela.
import { prisma } from '@/lib/prisma'
import { conferirDivergencia } from './anomalia'
import { avisarEquipe } from './notificaInterna'

/** Eventos que confirmam dinheiro recebido. */
const PAGOS = new Set(['RECEIVED', 'CONFIRMED'])

interface AssinaturaVinculada {
  workspaceId: string | null
  parceiroId: string | null
  splitWalletId: string | null
  splitValor: number | null
  splitPercentual: number | null
  splitErro: string | null
  ciclo: string
  valor: number
  assinaturaOrigem: string | null
  liberacaoManual: boolean
}

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** "2026-07" — competência da comissão. */
function competenciaDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Efeito de uma cobrança no acesso da workspace.
 *
 * Devolve o que mudou, para o log e para as provas. Não lança: falha aqui não pode
 * derrubar o webhook, que já respondeu 200 ao Asaas.
 */
export async function aplicarNoAcesso(p: {
  subscriptionId: string
  paymentId: string
  status: string
  vencimento: string | null
  valorLiquido: number | null
  /** Valor bruto pago — usado na detecção da borda do 12x. */
  valorPago?: number | null
  /** O pagamento veio parcelado? Ausência de `installment` significa 1x. */
  temParcelamento?: boolean
}): Promise<{ tocou: boolean; motivo: string; workspaceId?: string; novoStatus?: string }> {
  const [ass] = await prisma.$queryRaw`
    SELECT a."workspaceId", a."parceiroId", a."splitWalletId",
           a."splitValor"::float AS "splitValor", a."splitPercentual"::float AS "splitPercentual",
           a."splitErro", a."ciclo", a."valor"::float AS "valor",
           w."assinaturaOrigem", w."liberacaoManual"
    FROM "AsaasAssinatura" a
    JOIN "Workspace" w ON w."id" = a."workspaceId"
    WHERE a."subscriptionId" = ${p.subscriptionId}
    LIMIT 1
  ` as AssinaturaVinculada[]

  if (!ass?.workspaceId) return { tocou: false, motivo: 'assinatura sem workspace vinculada' }

  // Guarda dura: só mexemos em quem é nosso.
  if (ass.assinaturaOrigem !== 'asaas') {
    return { tocou: false, motivo: `origem '${ass.assinaturaOrigem}' — fora da máquina Asaas`, workspaceId: ass.workspaceId }
  }

  const pago = PAGOS.has(p.status)

  if (pago) {
    // Vencimento da cobrança PAGA é o início do período coberto; o próximo
    // vencimento vem do Asaas na assinatura. Aqui gravamos até quando ela está
    // em dia, que é o que a máquina de estados lê.
    await prisma.$executeRaw`
      UPDATE "Workspace"
      SET "assinaturaStatus" = 'ATIVA',
          "assinaturaExpira" = COALESCE(
            (SELECT "proximoVencimento" FROM "AsaasAssinatura" WHERE "subscriptionId" = ${p.subscriptionId}),
            ${p.vencimento}::date
          ),
          "ativo" = true,
          "updatedAt" = NOW()
      WHERE "id" = ${ass.workspaceId}
    `
    await registrarComissao(ass, p)

    // Borda do 12x: escolheu parcelar e pagou de uma vez. Não impede nada — só
    // marca, para o Master ver e o Júnior decidir o gesto.
    await conferirDivergencia({
      workspaceId: ass.workspaceId,
      paymentId: p.paymentId,
      valor: p.valorPago ?? null,
      temParcelamento: p.temParcelamento ?? false,
    })

    // Converteu: trial virou pagante. Aviso interno, uma vez por workspace.
    await avisarEquipe(ass.workspaceId, 'INTERNO_NOVO_PAGANTE')

    // 🔔 HOOK (Ticket 04 — notificação à PARCEIRA): quando a indicada de uma
    // parceira converte, é aqui que o e-mail "sua indicada assinou 🎉" dispara.
    // O ponto (transição → ATIVA COM parceiroId) está pronto; o envio é o próximo
    // ticket. Não implementar o e-mail agora.
    // if (ass.parceiroId) await avisarParceira(ass.parceiroId, ass.workspaceId, 'assinou')

    return { tocou: true, motivo: 'pagamento confirmado', workspaceId: ass.workspaceId, novoStatus: 'ATIVA' }
  }

  if (p.status === 'OVERDUE') {
    // NÃO corta aqui. O Asaas avisa no dia do vencimento; quem corta é o job
    // diário, depois da carência. Cortar no OVERDUE seria corte no dia 1.
    await prisma.$executeRaw`
      UPDATE "Workspace"
      SET "assinaturaStatus" = 'INADIMPLENTE',
          "assinaturaExpira" = COALESCE(${p.vencimento}::date, "assinaturaExpira"),
          "updatedAt" = NOW()
      WHERE "id" = ${ass.workspaceId}
    `
    return { tocou: true, motivo: 'cobrança vencida', workspaceId: ass.workspaceId, novoStatus: 'INADIMPLENTE' }
  }

  if (p.status === 'REFUNDED' || p.status === 'CHARGEBACK_REQUESTED') {
    // Dinheiro devolvido/contestado: o período deixa de estar coberto. Volta a
    // INADIMPLENTE (não CORTADA) para a régua de avisos rodar normalmente — e,
    // se for engano, ela regulariza sem nunca ter perdido o acesso.
    await prisma.$executeRaw`
      UPDATE "Workspace"
      SET "assinaturaStatus" = 'INADIMPLENTE', "updatedAt" = NOW()
      WHERE "id" = ${ass.workspaceId} AND "assinaturaStatus" = 'ATIVA'
    `
    // A comissão correspondente deixa de valer. O Asaas já reverte o split
    // sozinho; aqui o razão acompanha, para não ficar dizendo que foi pago.
    await prisma.$executeRaw`
      UPDATE "ParceiroComissao" SET "status" = 'cancelado'
      WHERE "referencia" = ${p.paymentId} AND "status" <> 'cancelado'
    `.catch(() => {})
    return { tocou: true, motivo: `estorno (${p.status})`, workspaceId: ass.workspaceId, novoStatus: 'INADIMPLENTE' }
  }

  return { tocou: false, motivo: `status '${p.status}' sem efeito no acesso`, workspaceId: ass.workspaceId }
}

/**
 * Registra a comissão do parceiro. IDEMPOTENTE pelo índice único em `referencia`
 * (o paymentId) — reprocessar o mesmo evento não duplica.
 *
 * REGRA (decisão do Diretor):
 *   parceiro COM walletId  → o split JÁ pagou     → 'pago_via_split' (razão)
 *   parceiro SEM walletId  → payout manual        → 'pendente'
 *   split recusado pelo Asaas → 'pendente' com a CAUSA, para não virar acerto
 *                               invisível
 *
 * Nunca lança: comissão é consequência do pagamento, não pode desfazê-lo.
 */
async function registrarComissao(ass: AssinaturaVinculada, p: { paymentId: string; valorLiquido: number | null }) {
  if (!ass.parceiroId || !ass.workspaceId) return

  try {
    const pagouViaSplit = !!ass.splitWalletId && !!ass.splitValor
    const valor = pagouViaSplit ? ass.splitValor! : 0
    const status = pagouViaSplit ? 'pago_via_split' : 'pendente'

    // A causa importa: sem ela, um 'pendente' por falta de wallet e outro por
    // recusa do Asaas ficam indistinguíveis na hora de acertar na mão.
    const observacao = pagouViaSplit
      ? null
      : ass.splitErro
        ? `Split recusado pelo Asaas: ${ass.splitErro}`
        : 'Parceiro sem walletId — repasse manual'

    const [lead] = await prisma.$queryRaw`
      SELECT "id" FROM "Lead" WHERE "workspaceId" = ${ass.workspaceId} AND "parceiroId" = ${ass.parceiroId}
      ORDER BY "createdAt" ASC LIMIT 1
    ` as { id: string }[]

    await prisma.$executeRaw`
      INSERT INTO "ParceiroComissao" ("id","parceiroId","leadId","workspaceId","competencia",
                                      "base","percentual","valor","status","referencia","createdAt")
      VALUES (${gerarId()}, ${ass.parceiroId}, ${lead?.id ?? null}, ${ass.workspaceId},
              ${competenciaDe(new Date())}, ${ass.valor}, ${ass.splitPercentual ?? 0},
              ${valor}, ${status}, ${p.paymentId}, NOW())
      ON CONFLICT ("referencia") WHERE "referencia" IS NOT NULL DO NOTHING
    `

    console.log(`[ACESSO] comissao parceiro=${ass.parceiroId} status=${status} valor=${valor}${observacao ? ` (${observacao})` : ''}`)
  } catch (e) {
    // Engolir o erro seria pior que a doença: comissão silenciosamente não
    // registrada vira dinheiro que ninguém sabe que deve. Logamos com destaque
    // para o problema aparecer nos logs da Vercel, mas sem derrubar o pagamento.
    console.error(`[ACESSO] ⚠️ COMISSÃO NÃO REGISTRADA parceiro=${ass.parceiroId} pagamento=${p.paymentId}:`, (e as Error)?.message)
  }
}

/**
 * Accrual do PIX — que não tem AsaasAssinatura. Lê o snapshot do split da própria
 * AsaasCobranca (gravado na criação, fotografado do que o Asaas ecoa). Mesma regra
 * do cartão (pago_via_split / pendente), idempotente por referencia = paymentId
 * (cada cobrança Pix, 1ª e renovações, tem paymentId único → 1 accrual cada).
 *
 * Exportado: chamado direto pelo webhook no ramo Pix (sem subscription). Nunca lança.
 */
export async function registrarComissaoDaCobranca(paymentId: string): Promise<void> {
  try {
    const [cob] = await prisma.$queryRaw`
      SELECT "workspaceId", "parceiroId", "splitWalletId",
             "splitValor"::float AS "splitValor", "splitPercentual"::float AS "splitPercentual",
             "splitErro", "valor"::float AS valor
      FROM "AsaasCobranca" WHERE "paymentId" = ${paymentId} LIMIT 1
    ` as { workspaceId: string | null; parceiroId: string | null; splitWalletId: string | null
         ; splitValor: number | null; splitPercentual: number | null; splitErro: string | null; valor: number }[]

    if (!cob?.parceiroId || !cob.workspaceId) return // sem parceira atribuída → sem comissão

    const pagouViaSplit = !!cob.splitWalletId && !!cob.splitValor && !cob.splitErro
    const valor = pagouViaSplit ? cob.splitValor! : 0
    const status = pagouViaSplit ? 'pago_via_split' : 'pendente'
    const observacao = pagouViaSplit
      ? null
      : cob.splitErro
        ? `Split recusado pelo Asaas: ${cob.splitErro}`
        : 'Parceiro sem walletId — repasse manual'

    const [lead] = await prisma.$queryRaw`
      SELECT "id" FROM "Lead" WHERE "workspaceId" = ${cob.workspaceId} AND "parceiroId" = ${cob.parceiroId}
      ORDER BY "createdAt" ASC LIMIT 1
    ` as { id: string }[]

    await prisma.$executeRaw`
      INSERT INTO "ParceiroComissao" ("id","parceiroId","leadId","workspaceId","competencia",
                                      "base","percentual","valor","status","referencia","createdAt")
      VALUES (${gerarId()}, ${cob.parceiroId}, ${lead?.id ?? null}, ${cob.workspaceId},
              ${competenciaDe(new Date())}, ${cob.valor}, ${cob.splitPercentual ?? 0},
              ${valor}, ${status}, ${paymentId}, NOW())
      ON CONFLICT ("referencia") WHERE "referencia" IS NOT NULL DO NOTHING
    `
    console.log(`[ACESSO] comissao PIX parceiro=${cob.parceiroId} status=${status} valor=${valor}${observacao ? ` (${observacao})` : ''}`)
  } catch (e) {
    console.error(`[ACESSO] ⚠️ COMISSÃO PIX NÃO REGISTRADA pagamento=${paymentId}:`, (e as Error)?.message)
  }
}
