// Camada Asaas — ponto único de entrada (mesmo padrão de lib/logistica).
// As telas e rotas falam SÓ com este arquivo; client.ts/config.ts são internos.
//
// Endpoints usados (conferidos na doc oficial):
//   GET  /v3/wallets                    → walletId da conta (também serve de teste de auth)
//   GET  /v3/myAccount/commercialInfo   → nome/e-mail/status da conta
//   POST /v3/customers                  → cliente
//   POST /v3/payments                   → cobrança avulsa   (campo de split: `split`, singular)
//   POST /v3/subscriptions              → assinatura        (`split` vira TEMPLATE de cada cobrança)
//
// ⚠️ LGPD: cpfCnpj é repassado ao Asaas mas NUNCA persistido aqui nem logado.
import { createHash, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from './client'
import { getCredenciais, getConfigPublica, registrarTeste } from './config'
import type {
  ResultadoAsaas, SplitItem, ClienteAsaas, NovaCobranca, NovaAssinatura,
  CicloAssinatura, FormaCobranca,
} from './tipos'

export * from './tipos'
export { getConfigPublica, salvarCredenciais, desconectar, garantirConfig } from './config'
export { limparSegredo } from './client'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Módulo ligado E credencial testada? Use antes de qualquer fluxo de cobrança. */
export async function asaasOperacional(): Promise<boolean> {
  const cfg = await getConfigPublica()
  return cfg.ativo && cfg.conectado && cfg.temApiKey
}

// ────────────────────────── WEBHOOK: AUTENTICIDADE ──────────────────────

/**
 * Confere o header `asaas-access-token` contra o token salvo.
 *
 * O segredo NÃO sai desta função — o chamador só recebe true/false. Comparação
 * em tempo constante (hash antes, para igualar o comprimento; timingSafeEqual
 * lança se os buffers tiverem tamanhos diferentes, o que já vazaria o tamanho).
 *
 * FAIL CLOSED: sem token configurado, nenhuma requisição é aceita — senão a rota
 * ficaria aberta a qualquer um forjando pagamento confirmado.
 */
export async function validarTokenWebhook(recebido: string | null): Promise<boolean> {
  const { webhookToken } = await getCredenciais()
  if (!webhookToken || !recebido) return false

  const a = createHash('sha256').update(webhookToken).digest()
  const b = createHash('sha256').update(recebido).digest()
  return timingSafeEqual(a, b)
}

// ─────────────────────────── TESTE DE CONEXÃO ───────────────────────────

/**
 * Valida a credencial contra o ambiente configurado e grava o diagnóstico.
 * Roda mesmo com o módulo desligado — é o passo que permite ligá-lo com segurança.
 * NÃO cria nada no Asaas: só leitura.
 */
export async function testarConexao(): Promise<ResultadoAsaas<{
  walletId: string | null; nome: string | null; email: string | null; sandbox: boolean
}>> {
  const { sandbox } = await getCredenciais()

  const wallets = await chamarAsaas<{ data?: { id?: string }[] }>('/wallets', { exigirAtivo: false })
  if (!wallets.ok) {
    await registrarTeste({ ok: false, erro: wallets.erro })
    return { ok: false, pendente: wallets.pendente, erro: wallets.erro }
  }
  const walletId = wallets.dados?.data?.[0]?.id ?? null

  // Dados da conta são um "nice to have": se falhar, a conexão continua válida.
  const conta = await chamarAsaas<{ name?: string; email?: string }>(
    '/myAccount/commercialInfo', { exigirAtivo: false },
  )
  const nome = conta.ok ? (conta.dados?.name ?? null) : null
  const email = conta.ok ? (conta.dados?.email ?? null) : null

  await registrarTeste({ ok: true, erro: null, contaNome: nome, contaEmail: email, walletId })
  return { ok: true, pendente: false, dados: { walletId, nome, email, sandbox } }
}

// ─────────────────────────────── CLIENTES ───────────────────────────────

/**
 * Cliente do Asaas para o workspace, criando na primeira vez (cache em AsaasCliente).
 * O mapeamento é por (workspaceId, ambiente) — sandbox e produção não se misturam.
 */
export async function garantirCliente(
  workspaceId: string,
  dados: ClienteAsaas,
): Promise<ResultadoAsaas<{ customerId: string }>> {
  const { sandbox } = await getCredenciais()

  const [existente] = await prisma.$queryRaw`
    SELECT "customerId" FROM "AsaasCliente"
    WHERE "workspaceId" = ${workspaceId} AND "sandbox" = ${sandbox} LIMIT 1
  ` as { customerId: string }[]
  if (existente?.customerId) {
    return { ok: true, pendente: false, dados: { customerId: existente.customerId } }
  }

  const r = await chamarAsaas<{ id?: string }>('/customers', {
    metodo: 'POST',
    corpo: { ...dados, externalReference: dados.externalReference ?? workspaceId },
  })
  if (!r.ok || !r.dados?.id) {
    return { ok: false, pendente: r.pendente, erro: r.erro ?? 'Asaas não retornou o id do cliente.' }
  }

  // cpfCnpj NÃO é gravado: já vive no Asaas, e aqui só precisamos do vínculo.
  await prisma.$executeRaw`
    INSERT INTO "AsaasCliente" ("id","workspaceId","customerId","sandbox","nome","email","createdAt","updatedAt")
    VALUES (${gerarId()}, ${workspaceId}, ${r.dados.id}, ${sandbox}, ${dados.name ?? null}, ${dados.email ?? null}, NOW(), NOW())
    ON CONFLICT ("workspaceId","sandbox") DO NOTHING
  `
  return { ok: true, pendente: false, dados: { customerId: r.dados.id } }
}

// ──────────────────────────────── SPLIT ─────────────────────────────────

/**
 * Taxa do Asaas por forma de pagamento — ESTIMATIVA CONSERVADORA, só para a
 * checagem de estouro abaixo. A taxa real depende do plano negociado; confirmar
 * no painel do Asaas antes de produção. (?)
 */
export const TAXA_ESTIMADA: Record<FormaCobranca, { perc: number; fixo: number }> = {
  PIX: { perc: 0, fixo: 1.99 },
  BOLETO: { perc: 0, fixo: 1.99 },
  CREDIT_CARD: { perc: 2.99, fixo: 0.49 },
  UNDEFINED: { perc: 2.99, fixo: 1.99 },   // pior caso: quem escolhe é o cliente
}

/** Líquido que sobra de uma cobrança, pela estimativa acima. */
export function liquidoEstimado(valorCobranca: number, forma: FormaCobranca = 'UNDEFINED'): number {
  const t = TAXA_ESTIMADA[forma] ?? TAXA_ESTIMADA.UNDEFINED
  return Math.round((valorCobranca - (valorCobranca * t.perc / 100) - t.fixo) * 100) / 100
}

/**
 * Split de comissão de parceiro.
 *
 * ⚠️ Usa `fixedValue`, NÃO `percentualValue`: no Asaas o percentual incide sobre o
 * LÍQUIDO (netValue, já descontada a taxa), enquanto a regra do SOA calcula a
 * comissão sobre o BRUTO (lib/parceiros/index.ts). Mandar percentual pagaria a
 * menos que o combinado com o influenciador — o valor fixo já vem calculado certo.
 *
 * ⚠️ Como a comissão sai do BRUTO e o split é pago do LÍQUIDO, uma cobrança
 * pequena com percentual alto ESTOURA o líquido. O Asaas, nesse caso, trava a
 * cobrança E o split por 2 dias úteis e depois cancela — então é melhor recusar
 * aqui, com mensagem clara, do que emitir uma cobrança que vai morrer sozinha.
 */
export function montarSplitComissao(p: {
  walletId: string | null | undefined
  valorComissao: number
  /** Valor BRUTO da cobrança que vai carregar o split. */
  valorCobranca: number
  forma?: FormaCobranca
  descricao?: string
}): { ok: true; split: SplitItem[] } | { ok: false; erro: string } {
  const valor = Math.round(p.valorComissao * 100) / 100

  // Sem wallet ou sem comissão não é erro: só não há split a aplicar.
  if (!p.walletId || !(valor > 0)) return { ok: true, split: [] }

  const liquido = liquidoEstimado(p.valorCobranca, p.forma ?? 'UNDEFINED')
  if (liquido <= 0) {
    return { ok: false, erro: `Cobrança de R$ ${p.valorCobranca.toFixed(2)} não cobre nem a taxa do Asaas — split impossível.` }
  }
  if (valor > liquido) {
    return {
      ok: false,
      erro: `Comissão de R$ ${valor.toFixed(2)} excede o líquido estimado da cobrança (R$ ${liquido.toFixed(2)}). `
        + 'Reduza o percentual do parceiro ou aumente o valor do plano.',
    }
  }

  return { ok: true, split: [{ walletId: p.walletId, fixedValue: valor, description: p.descricao?.slice(0, 100) }] }
}

// ─────────────────────────────── COBRANÇAS ──────────────────────────────

/** Cobrança avulsa (recarga de créditos, e-commerce, etc.), com split opcional. */
export async function criarCobranca(p: {
  workspaceId?: string | null
  customerId: string
  valor: number
  vencimento: string                 // YYYY-MM-DD
  forma?: FormaCobranca
  descricao?: string
  /** Idempotência/reconciliação: nosso id do lado do Asaas. */
  referencia?: string
  finalidade?: string
  split?: SplitItem[]
}): Promise<ResultadoAsaas<{ paymentId: string; invoiceUrl: string | null }>> {
  const corpo: NovaCobranca = {
    customer: p.customerId,
    billingType: p.forma ?? 'UNDEFINED',
    value: Math.round(p.valor * 100) / 100,
    dueDate: p.vencimento,
    description: p.descricao,
    externalReference: p.referencia,
    ...(p.split?.length ? { split: p.split } : {}),
  }

  const r = await chamarAsaas<{
    id?: string; invoiceUrl?: string; netValue?: number; status?: string; billingType?: string
  }>('/payments', { metodo: 'POST', corpo })
  if (!r.ok || !r.dados?.id) {
    return { ok: false, pendente: r.pendente, erro: r.erro ?? 'Asaas não retornou o id da cobrança.' }
  }

  const { sandbox } = await getCredenciais()
  await prisma.$executeRaw`
    INSERT INTO "AsaasCobranca" ("id","workspaceId","paymentId","sandbox","finalidade","billingType",
                                 "valor","valorLiquido","status","vencimento","referencia","createdAt","updatedAt")
    VALUES (${gerarId()}, ${p.workspaceId ?? null}, ${r.dados.id}, ${sandbox},
            ${p.finalidade ?? 'avulsa'}, ${r.dados.billingType ?? null},
            ${corpo.value}, ${r.dados.netValue ?? null}, ${r.dados.status ?? 'PENDING'},
            ${p.vencimento}::date, ${p.referencia ?? null}, NOW(), NOW())
    ON CONFLICT ("paymentId") DO NOTHING
  `
  return { ok: true, pendente: false, dados: { paymentId: r.dados.id, invoiceUrl: r.dados.invoiceUrl ?? null } }
}

// ────────────────────────────── ASSINATURAS ─────────────────────────────

/**
 * Assinatura do SOA. Vale SÓ PARA NOVOS cadastros — a base atual segue na
 * Hotmart (HotmartAssinatura); as duas fontes convivem por decisão de produto.
 *
 * O `split` aqui é TEMPLATE: o Asaas o replica em cada cobrança gerada. Alterar
 * depois NÃO afeta cobranças já emitidas (precisa ajustar uma a uma).
 *
 * 📌 PENDÊNCIA (não resolver agora): como a comissão vai em `fixedValue`, uma
 * mudança no VALOR DO PLANO não recalcula o split — as cobranças futuras
 * continuariam repassando o valor antigo, quebrando o percentual combinado com o
 * parceiro. Ao permitir troca/reajuste de plano será preciso, no mesmo fluxo,
 * atualizar o split da assinatura (PUT /v3/subscriptions/{id}) e revalidar com
 * montarSplitComissao(). Enquanto o plano for fixo, isto não morde.
 */
export async function criarAssinatura(p: {
  workspaceId: string
  customerId: string
  valor: number
  primeiroVencimento: string         // YYYY-MM-DD
  ciclo?: CicloAssinatura
  forma?: FormaCobranca
  descricao?: string
  referencia?: string
  parceiroId?: string | null
  split?: SplitItem[]
}): Promise<ResultadoAsaas<{ subscriptionId: string }>> {
  const ciclo = p.ciclo ?? 'MONTHLY'
  const corpo: NovaAssinatura = {
    customer: p.customerId,
    billingType: p.forma ?? 'UNDEFINED',
    value: Math.round(p.valor * 100) / 100,
    nextDueDate: p.primeiroVencimento,
    cycle: ciclo,
    description: p.descricao,
    externalReference: p.referencia ?? p.workspaceId,
    ...(p.split?.length ? { split: p.split } : {}),
  }

  const r = await chamarAsaas<{ id?: string; status?: string; nextDueDate?: string }>(
    '/subscriptions', { metodo: 'POST', corpo },
  )
  if (!r.ok || !r.dados?.id) {
    return { ok: false, pendente: r.pendente, erro: r.erro ?? 'Asaas não retornou o id da assinatura.' }
  }

  const { sandbox } = await getCredenciais()
  await prisma.$executeRaw`
    INSERT INTO "AsaasAssinatura" ("id","workspaceId","subscriptionId","customerId","sandbox","ciclo",
                                   "valor","status","proximoVencimento","parceiroId","createdAt","updatedAt")
    VALUES (${gerarId()}, ${p.workspaceId}, ${r.dados.id}, ${p.customerId}, ${sandbox}, ${ciclo},
            ${corpo.value}, ${r.dados.status ?? 'ACTIVE'},
            ${r.dados.nextDueDate ?? p.primeiroVencimento}::date, ${p.parceiroId ?? null}, NOW(), NOW())
    ON CONFLICT ("subscriptionId") DO NOTHING
  `
  return { ok: true, pendente: false, dados: { subscriptionId: r.dados.id } }
}

// ──────────────────────────────── PAYOUT ────────────────────────────────

/**
 * Repasse avulso de comissão (fora de um split). MANTIDO COMO STUB DE PROPÓSITO:
 * transferência move dinheiro de verdade e é ação do Júnior, não do sistema.
 * O caminho suportado é o split embutido na cobrança/assinatura (acima).
 */
export async function pagarComissao(
  walletId: string | null,
  valor: number,
  ref?: string,
): Promise<ResultadoAsaas> {
  console.log(`[ASAAS] payout NÃO executado (por desenho): ref=${ref ?? '?'} wallet=${walletId ? 'definida' : 'ausente'} valor=${valor}`)
  return { ok: false, pendente: true, erro: 'Repasse avulso é manual — use split na cobrança.' }
}
