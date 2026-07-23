// Checkout hospedado do Asaas — o PORTÃO DE ENTRADA.
//
// A artesã escolhe plano e método, e paga (ou cadastra o cartão) numa página do
// ASAAS. Nenhum dado de cartão passa por nós: é essa propriedade que faz o portão
// existir sem nos colocar no escopo PCI.
//
// Dois regimes saem do mesmo portão, e a diferença importa para a régua inteira:
//   CARTÃO → chargeTypes RECURRENT: nasce ASSINATURA, cobra sozinha em nextDueDate
//   PIX    → chargeTypes DETACHED: nasce COBRANÇA ÚNICA; cada ciclo é uma nova
//            fatura que ela paga na mão. O Asaas recusa PIX em RECURRENT — não é
//            escolha nossa, é limite da plataforma.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { getPlano, valorCobrado, parcelasDe, permiteParcelar, type PlanoId, type FormaPagamento } from './planos'
import { DIAS_TRIAL } from './index'
import { avisarEquipe } from './notificaInterna'
import { parceirasAtivo, temParceiraAtribuida, DIAS_TRIAL_PARCEIRA } from '@/lib/parceiras/atribuicao'

export type MetodoPagamento = 'cartao' | 'pix'

export interface ResultadoCheckout {
  ok: boolean
  erro?: string
  checkoutId?: string
  link?: string
}

/** Data do primeiro vencimento: fim do trial. */
function primeiroVencimento(): string {
  const d = new Date()
  d.setDate(d.getDate() + DIAS_TRIAL)
  return d.toISOString().slice(0, 10)
}

/**
 * Cria a sessão de checkout e guarda o vínculo na workspace.
 *
 * ⚠️ O link EXPIRA em 24h (`minutesToExpire`, máximo da plataforma). Quem abandona
 * e volta depois precisa de um novo — por isso esta função é chamada tanto no
 * cadastro quanto pelo botão "gerar novo link" da tela.
 */
export async function criarCheckout(p: {
  workspaceId: string
  plano: PlanoId
  metodo: MetodoPagamento
  /** 'parcelado' só é aceito no anual + cartão. */
  forma?: FormaPagamento
  nome: string
  cpf: string
  email: string
  baseUrl: string
}): Promise<ResultadoCheckout> {
  const plano = getPlano(p.plano)
  const voltarPara = `${p.baseUrl}/assinatura`
  // successUrl vai para a página que FECHA a popup e avisa a tela mãe.
  const aoConcluir = `${p.baseUrl}/assinatura/concluido`

  // Guarda da matriz: parcelamento pedido onde não existe vira à vista, em vez
  // de gerar uma cobrança fora da tabela de preços.
  const forma: FormaPagamento =
    p.forma === 'parcelado' && permiteParcelar(plano, p.metodo) ? 'parcelado' : 'avista'
  const valor = valorCobrado(plano, forma)
  const parcelas = parcelasDe(plano, forma)

  // Cartão → assinatura recorrente, primeira cobrança no fim do trial.
  // Pix    → cobrança única com vencimento no fim do trial.
  const corpo: Record<string, unknown> = {
    billingTypes: p.metodo === 'cartao' ? ['CREDIT_CARD'] : ['PIX'],
    chargeTypes: p.metodo === 'cartao' ? ['RECURRENT'] : ['DETACHED'],
    minutesToExpire: 1440,
    callback: { successUrl: aoConcluir, cancelUrl: voltarPara, expiredUrl: voltarPara },
    items: [{ name: `SOA — plano ${plano.nome.toLowerCase()}`, quantity: 1, value: valor }],
    // `externalReference` é o que amarra o checkout à workspace nos webhooks.
    externalReference: p.workspaceId,
  }

  // NÃO enviamos `customerData` de propósito. O Asaas trata esse objeto como
  // tudo-ou-nada: com ele, passa a exigir telefone, endereço, número, CEP e
  // bairro. Pedir tudo isso na NOSSA tela seria muito atrito no pior momento —
  // e nos faria trafegar dados que não precisamos guardar. A página do Asaas
  // coleta o que ela precisa, e o CPF nem chega a passar por nós.

  if (p.metodo === 'cartao') {
    corpo.subscription = { cycle: plano.ciclo, nextDueDate: primeiroVencimento() }
    // 12x: o item JÁ É 287,88 (ver valorCobrado). maxInstallmentCount só autoriza
    // a divisão — não é ele que define o preço.
    if (parcelas > 1) corpo.maxInstallmentCount = parcelas
  } else {
    corpo.dueDate = primeiroVencimento()
  }

  const r = await chamarAsaas<{ id?: string; link?: string }>('/checkouts', { metodo: 'POST', corpo })
  if (!r.ok || !r.dados?.id || !r.dados?.link) {
    console.error(`[CHECKOUT] falhou ws=${p.workspaceId} metodo=${p.metodo}: ${r.erro}`)
    return { ok: false, erro: r.erro || 'Não consegui abrir a página de pagamento.' }
  }

  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "checkoutId" = ${r.dados.id}, "checkoutLink" = ${r.dados.link},
        "checkoutCriadoEm" = NOW(),
        "planoEscolhido" = ${plano.id}, "metodoEscolhido" = ${p.metodo},
        "formaEscolhida" = ${forma},
        "assinaturaStatus" = 'AGUARDANDO_PAGAMENTO',
        "assinaturaOrigem" = 'asaas',
        "updatedAt" = NOW()
    WHERE "id" = ${p.workspaceId}
  `

  console.log(`[CHECKOUT] criado ws=${p.workspaceId} plano=${plano.id} metodo=${p.metodo} id=${r.dados.id}`)
  return { ok: true, checkoutId: r.dados.id, link: r.dados.link }
}

/**
 * Checkout concluído (evento CHECKOUT_PAID): o trial começa AGORA.
 *
 * O trial só nasce aqui, e não no cadastro: o portão é o método de pagamento, e
 * contar os 14 dias de quem nunca chegou a pagar seria dar acesso de graça a quem
 * abandonou. Idempotente — reprocessar o mesmo evento não estende o trial.
 */
export async function concluirCheckout(checkoutId: string): Promise<{ ok: boolean; workspaceId?: string }> {
  const [ws] = await prisma.$queryRaw`
    SELECT "id", "assinaturaStatus" FROM "Workspace" WHERE "checkoutId" = ${checkoutId} LIMIT 1
  ` as { id: string; assinaturaStatus: string }[]
  if (!ws) return { ok: false }

  // Indicada por parceira ganha 30 dias; demais, 14. GREATEST garante que o MAIOR
  // trial vence e nunca encurta um trial já concedido (e trata trialAte NULL).
  const dias = (parceirasAtivo() && (await temParceiraAtribuida(ws.id))) ? DIAS_TRIAL_PARCEIRA : DIAS_TRIAL

  // Só promove quem estava aguardando. Se já virou TRIAL/ATIVA, não mexe.
  const n = await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "assinaturaStatus" = 'TRIAL',
        "trialAte" = GREATEST("trialAte", CURRENT_DATE + ${dias}::int),
        "ativo" = true,
        "checkoutLink" = NULL,
        "updatedAt" = NOW()
    WHERE "id" = ${ws.id} AND "assinaturaStatus" = 'AGUARDANDO_PAGAMENTO'
  `
  if (n > 0) await avisarEquipe(ws.id, 'INTERNO_NOVO_TRIAL')
  console.log(`[CHECKOUT] concluído ws=${ws.id} ${n > 0 ? '→ TRIAL' : '(já estava adiante)'}`)
  return { ok: true, workspaceId: ws.id }
}

/** Checkout expirou/cancelou: o link morre, o estado continua aguardando. */
export async function encerrarCheckout(checkoutId: string, motivo: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "checkoutLink" = NULL, "updatedAt" = NOW()
    WHERE "checkoutId" = ${checkoutId} AND "assinaturaStatus" = 'AGUARDANDO_PAGAMENTO'
  `
  console.log(`[CHECKOUT] encerrado ${checkoutId}: ${motivo}`)
}
