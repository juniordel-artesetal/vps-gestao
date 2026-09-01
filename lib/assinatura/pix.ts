// PIX NATIVO — o QR nasce e é pago DENTRO da nossa tela.
//
// Diferente do cartão, aqui não há página do Asaas: criamos a cobrança, pedimos
// o QR Code e renderizamos. A artesã nunca sai do sistema, e o mesmo mecanismo
// serve à Loja Virtual no futuro.
//
// O cartão não pode fazer isso porque campos de cartão exigem PCI; o Pix não tem
// esse problema — o QR é público por natureza, e quem autentica é o banco dela.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { criarAssinatura, garantirCliente, sincronizarCobrancasDaAssinatura } from '@/lib/pagamento/asaas'
import { getPlano, valorCobrado, type PlanoId } from './planos'
import { avisarEquipe } from './notificaInterna'
import { DIAS_TRIAL } from './index'
import { parceirasAtivo, temInfluenciadoraAtribuida, DIAS_TRIAL_INFLUENCIADORA } from '@/lib/parceiras/atribuicao'
import { resolverSplitParceira } from '@/lib/parceiras/split'
import { avisarParceiraSeguidoraTrial } from '@/lib/parceiras/notificacoes'

export interface ResultadoPix {
  ok: boolean
  erro?: string
  paymentId?: string
  /** PNG em base64 — renderiza direto com <img src="data:image/png;base64,…">. */
  qrImagem?: string
  /** O copia-e-cola. */
  qrTexto?: string
  valor?: number
  vencimento?: string
}

/** Vencimento da primeira cobrança: fim do trial (7 padrão, 14 se influenciadora). */
function primeiroVencimento(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Cria a cobrança Pix e devolve o QR pronto para a tela.
 *
 * Reaproveita garantirCliente/criarCobranca da fundação — as funções que saíram
 * do funil de entrada quando o checkout hospedado assumiu voltam a ser úteis
 * aqui, agora no caminho do Pix.
 */
export async function gerarPixDaAssinatura(p: {
  workspaceId: string
  plano: PlanoId
  cpf: string
  nome: string
  email?: string | null
}): Promise<ResultadoPix> {
  const plano = getPlano(p.plano)
  // Pix nunca parcela — a matriz de preços é explícita quanto a isso.
  const valor = valorCobrado(plano, 'avista')

  const cli = await garantirCliente(p.workspaceId, {
    name: p.nome, cpfCnpj: p.cpf, email: p.email ?? undefined,
    externalReference: p.workspaceId,
  })
  if (!cli.ok || !cli.dados?.customerId) {
    return { ok: false, erro: cli.erro || 'Não consegui criar seu cadastro de pagamento.' }
  }

  // Trial: 7 dias padrão; 14 se veio de INFLUENCIADORA (o MAIOR vence via GREATEST).
  // A 1ª cobrança (vencimento) casa com o fim do trial — não cobra antes do prazo.
  const diasTrial = (parceirasAtivo() && (await temInfluenciadoraAtribuida(p.workspaceId))) ? DIAS_TRIAL_INFLUENCIADORA : DIAS_TRIAL
  const vencimento = primeiroVencimento(diasTrial)

  // ASSINATURA PIX (não cobrança avulsa): o Asaas passa a gerar a cobrança Pix de
  // cada ciclo sozinho (a artesã paga o QR de cada mês). Aparece em "Assinaturas".
  // Reuso: se já há assinatura viva, NÃO cria outra — pega o QR da cobrança dela.
  const [jaAss] = await prisma.$queryRaw`
    SELECT "subscriptionId" FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${p.workspaceId} AND "status" <> 'CANCELADA'
    ORDER BY "createdAt" DESC LIMIT 1
  ` as { subscriptionId: string }[]

  let subscriptionId = jaAss?.subscriptionId
  if (!subscriptionId) {
    // Split da parceira vira TEMPLATE da assinatura (o Asaas replica em cada cobrança).
    const sp = await resolverSplitParceira(p.workspaceId, plano, valor, 'avista')
    const dados = {
      workspaceId: p.workspaceId, customerId: cli.dados.customerId,
      valor, primeiroVencimento: vencimento, ciclo: 'MONTHLY' as const, forma: 'PIX' as const,
      descricao: `SOA — plano ${plano.nome}`, referencia: p.workspaceId, parceiroId: sp.parceiroId,
    }
    let ass = await criarAssinatura({ ...dados, split: sp.split })
    // A comissão NUNCA impede o pagamento: se o Asaas recusar o split, refaz sem ele.
    let splitErro = sp.splitErro
    let snap = { walletId: sp.splitWalletId, valor: sp.splitValor, perc: sp.splitPercentual }
    if (!ass.ok && sp.split.length) {
      splitErro = ass.erro ?? 'split recusado pelo Asaas'
      snap = { walletId: null, valor: null, perc: null }
      ass = await criarAssinatura(dados)
    }
    if (!ass.ok || !ass.dados?.subscriptionId) {
      return { ok: false, erro: ass.erro || 'Não consegui criar sua assinatura.' }
    }
    subscriptionId = ass.dados.subscriptionId
    // Snapshot do split na AsaasAssinatura (o webhook usa isso no accrual).
    await prisma.$executeRaw`
      UPDATE "AsaasAssinatura" SET "splitWalletId" = ${snap.walletId}, "splitValor" = ${snap.valor},
        "splitPercentual" = ${snap.perc}, "splitErro" = ${splitErro ? splitErro.slice(0, 300) : null}, "updatedAt" = NOW()
      WHERE "subscriptionId" = ${subscriptionId}
    `
  }

  // 1ª cobrança da assinatura nasce NO ASAAS — busca na hora para ter o QR.
  const sync = await sincronizarCobrancasDaAssinatura(subscriptionId, p.workspaceId)
  const cob = sync.dados?.[0]
  if (!cob?.paymentId) {
    console.error(`[PIX] sem cobrança da assinatura ws=${p.workspaceId} sub=${subscriptionId}: ${sync.erro ?? 'lista vazia'}`)
    return { ok: false, erro: 'Criei sua assinatura, mas a cobrança ainda não veio. Recarregue em instantes.' }
  }
  const qr = await chamarAsaas<{ encodedImage?: string; payload?: string }>(
    `/payments/${cob.paymentId}/pixQrCode`,
  )
  if (!qr.ok || !qr.dados?.payload) {
    console.error(`[PIX] QR falhou ws=${p.workspaceId} pay=${cob.paymentId}: ${qr.erro}`)
    return { ok: false, erro: 'Gerei sua cobrança, mas o QR Code falhou. Recarregue a página.' }
  }

  // O QR GERADO É O PORTÃO DO PIX (decisão do Júnior): os 14 dias começam aqui.
  // No cartão o portão é cadastrar o meio; no Pix não existe "cadastrar", só
  // pagar — e como a 1ª cobrança vence no dia 14, gerar o QR é o único gesto
  // disponível. Paridade de trial entre os métodos venceu o rigor do portão; o
  // abuso possível está registrado como risco aceito no CHECKLIST_GOLIVE.
  //
  // diasTrial já resolvido no topo (7 padrão / 14 influenciadora) — mesmo valor do vencimento.
  // Só promove quem está esperando: se já é TRIAL/ATIVA, não estende nada.
  const promovida = await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "assinaturaOrigem" = 'asaas',
        "planoEscolhido" = ${plano.id},
        "metodoEscolhido" = 'pix',
        "formaEscolhida" = 'avista',
        "assinaturaStatus" = 'TRIAL',
        "trialAte" = GREATEST("trialAte", CURRENT_DATE + ${diasTrial}::int),
        "ativo" = true,
        "updatedAt" = NOW()
    WHERE "id" = ${p.workspaceId} AND "assinaturaStatus" = 'AGUARDANDO_PAGAMENTO'
  `
  if (promovida > 0) {
    await avisarEquipe(p.workspaceId, 'INTERNO_NOVO_TRIAL')
    await avisarParceiraSeguidoraTrial(p.workspaceId) // Ticket 04: avisa a parceira no início do teste
  }

  console.log(`[PIX] gerado ws=${p.workspaceId} pay=${cob.paymentId} valor=${valor}`)
  return {
    ok: true,
    paymentId: cob.paymentId,
    qrImagem: qr.dados.encodedImage,
    qrTexto: qr.dados.payload,
    valor, vencimento,
  }
}

/** QR de uma cobrança já criada — para a tela remontar sem cobrar de novo. */
export async function qrDaCobranca(paymentId: string): Promise<ResultadoPix> {
  const qr = await chamarAsaas<{ encodedImage?: string; payload?: string }>(
    `/payments/${paymentId}/pixQrCode`,
  )
  return qr.ok && qr.dados?.payload
    ? { ok: true, paymentId, qrImagem: qr.dados.encodedImage, qrTexto: qr.dados.payload }
    : { ok: false, erro: qr.erro || 'QR Code indisponível.' }
}
