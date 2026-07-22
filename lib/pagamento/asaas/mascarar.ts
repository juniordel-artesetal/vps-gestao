// LGPD — mascaramento do payload do webhook ANTES de persistir.
//
// Módulo PURO de propósito (zero imports): é a peça mais crítica em conformidade,
// e sem dependências ela pode ser testada isoladamente, sem banco nem rede.
//
// O que os eventos PAYMENT_* realmente trazem (conferido na doc oficial do Asaas):
//   • `customer`   → SÓ O ID (string). Nome, cpfCnpj e e-mail NÃO vêm expandidos.
//   • `creditCard` → bandeira e token do cartão.
//   • `account`    → id/ownerId da conta Asaas (não é dado pessoal).
//   • `split`      → walletId de terceiros.
//
// Ainda assim mascaramos POR NOME DE CAMPO, em profundidade, e não pelo formato
// esperado: o webhook é uma URL pública que o Asaas pode passar a chamar com outros
// tipos de evento (transferências, Pix Automático, notas fiscais) sem nos avisar — e
// esses carregam dado pessoal. Confiar no shape previsto é como o vazamento acontece.

/** CPF/CNPJ → só os 2 últimos dígitos sobrevivem. Não reversível. */
export function mascararDoc(v: string): string {
  const d = String(v).replace(/\D/g, '')
  if (d.length < 3) return '***'
  return `***${d.slice(-2)}`
}

/** E-mail → inicial + domínio. Mantém utilidade de suporte sem expor a pessoa. */
export function mascararEmail(v: string): string {
  const s = String(v)
  const [user, dominio] = s.split('@')
  if (!dominio) return '***'
  return `${user.slice(0, 1)}***@${dominio}`
}

/** Telefone → só os 4 últimos dígitos. */
export function mascararTelefone(v: string): string {
  const d = String(v).replace(/\D/g, '')
  return d.length < 4 ? '***' : `***${d.slice(-4)}`
}

// Regra por nome de campo. O que não casar aqui passa intacto.
const REGRAS: { teste: RegExp; aplicar: (v: string) => string }[] = [
  { teste: /^(cpfcnpj|cpf|cnpj|documento)$/i, aplicar: mascararDoc },
  { teste: /^(email|e_mail)$/i, aplicar: mascararEmail },
  { teste: /(phone|telefone|celular)$/i, aplicar: mascararTelefone },
  // Dado de cartão: nem mascarado queremos guardar.
  { teste: /^(number|creditcardnumber|ccv|cvv|holdername|creditcardtoken)$/i, aplicar: () => '[REMOVIDO]' },
]

/**
 * Mascara recursivamente. Preserva a estrutura (a auditoria segue legível) e nunca
 * lança — mascarar não pode derrubar o webhook. Profundidade limitada contra ciclos.
 */
export function mascararPayload<T>(valor: T, profundidade = 0): T {
  if (profundidade > 12 || valor === null || valor === undefined) return valor
  if (Array.isArray(valor)) {
    return valor.map(v => mascararPayload(v, profundidade + 1)) as unknown as T
  }
  if (typeof valor !== 'object') return valor

  const saida: Record<string, unknown> = {}
  for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
    const regra = REGRAS.find(r => r.teste.test(chave))
    if (regra && v !== null && v !== undefined && typeof v !== 'object') {
      saida[chave] = regra.aplicar(String(v))
    } else {
      saida[chave] = mascararPayload(v, profundidade + 1)
    }
  }
  return saida as unknown as T
}
