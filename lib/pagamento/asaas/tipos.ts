// Tipos da camada Asaas. Nada aqui carrega credencial — a API key só existe
// dentro de config.ts/client.ts (servidor), nunca em retorno para tela/IA.

// Ambiente: sandbox e produção têm base URL E chave DIFERENTES (não são intercambiáveis).
export const BASE_SANDBOX = 'https://api-sandbox.asaas.com/v3'
export const BASE_PRODUCAO = 'https://api.asaas.com/v3'

export interface ResultadoAsaas<T = unknown> {
  ok: boolean
  /** true = não deu erro, mas também não concluiu (ex.: sem credencial / módulo desligado). */
  pendente: boolean
  erro?: string
  dados?: T
}

/** Config visível em tela — NUNCA inclui apiKey nem token de webhook em claro. */
export interface AsaasConfigPublica {
  escopo: string
  ativo: boolean
  conectado: boolean
  sandbox: boolean
  temApiKey: boolean
  temWebhookToken: boolean
  walletIdPlataforma: string | null
  contaNome: string | null
  contaEmail: string | null
  ultimoTesteEm: string | null
  ultimoTesteOk: boolean | null
  ultimoTesteErro: string | null
}

/** Uso interno do servidor. O chamador NUNCA pode devolver isto num JSON de resposta. */
export interface AsaasCredenciais {
  apiKey: string | null
  webhookToken: string | null
  sandbox: boolean
  ativo: boolean
}

/** Item de split. `percentualValue` incide sobre o LÍQUIDO (netValue) no Asaas;
 *  para comissão calculada sobre o BRUTO (regra do SOA), use `fixedValue`. */
export interface SplitItem {
  walletId: string
  fixedValue?: number
  percentualValue?: number
  description?: string
}

export interface ClienteAsaas {
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  /** Nosso id (workspaceId) do lado do Asaas — usado para reconciliação. */
  externalReference?: string
}

export type CicloAssinatura = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY'
export type FormaCobranca = 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED'

export interface NovaCobranca {
  customer: string
  billingType: FormaCobranca
  value: number
  dueDate: string          // YYYY-MM-DD
  description?: string
  externalReference?: string
  split?: SplitItem[]
}

export interface NovaAssinatura {
  customer: string
  billingType: FormaCobranca
  value: number
  nextDueDate: string      // YYYY-MM-DD
  cycle: CicloAssinatura
  description?: string
  externalReference?: string
  /** Template: o Asaas replica este split em CADA cobrança gerada pela assinatura. */
  split?: SplitItem[]
}

/** Eventos que a fundação reconhece. O webhook grava todos, mas só age nestes. */
export const EVENTOS_PAGAMENTO_CONFIRMADO = [
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
] as const

export const EVENTOS_PAGAMENTO_PERDIDO = [
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
] as const
