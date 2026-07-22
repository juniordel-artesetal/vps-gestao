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
import { criarCobranca, garantirCliente } from '@/lib/pagamento/asaas'
import { getPlano, valorCobrado, type PlanoId } from './planos'
import { DIAS_TRIAL } from './index'

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

/** Vencimento da primeira cobrança: fim do trial. */
function primeiroVencimento(): string {
  const d = new Date()
  d.setDate(d.getDate() + DIAS_TRIAL)
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

  const vencimento = primeiroVencimento()
  const cob = await criarCobranca({
    workspaceId: p.workspaceId,
    customerId: cli.dados.customerId,
    valor, vencimento, forma: 'PIX',
    descricao: `SOA — plano ${plano.nome.toLowerCase()}`,
    referencia: p.workspaceId,
    finalidade: 'assinatura',
  })
  if (!cob.ok || !cob.dados?.paymentId) {
    return { ok: false, erro: cob.erro || 'Não consegui gerar sua cobrança.' }
  }

  const qr = await chamarAsaas<{ encodedImage?: string; payload?: string }>(
    `/payments/${cob.dados.paymentId}/pixQrCode`,
  )
  if (!qr.ok || !qr.dados?.payload) {
    // A cobrança existe; só o QR falhou. Devolvemos o link da fatura como saída,
    // em vez de deixá-la sem caminho nenhum depois de já termos cobrado.
    console.error(`[PIX] QR falhou ws=${p.workspaceId} pay=${cob.dados.paymentId}: ${qr.erro}`)
    return { ok: false, erro: 'Gerei sua cobrança, mas o QR Code falhou. Recarregue a página.' }
  }

  // O Pix é um caminho de ENTRADA: a workspace passa a ser governada pelo Asaas
  // e o trial começa aqui. Ver a nota sobre o portão do Pix em /api/assinatura/pix.
  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "assinaturaOrigem" = 'asaas',
        "planoEscolhido" = ${plano.id},
        "metodoEscolhido" = 'pix',
        "formaEscolhida" = 'avista',
        "updatedAt" = NOW()
    WHERE "id" = ${p.workspaceId}
  `

  console.log(`[PIX] gerado ws=${p.workspaceId} pay=${cob.dados.paymentId} valor=${valor}`)
  return {
    ok: true,
    paymentId: cob.dados.paymentId,
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
