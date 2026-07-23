// CPF — validação e mascaramento. Módulo PURO (zero imports), como o mascarar do
// webhook: é peça de conformidade e precisa ser testável isoladamente.
//
// 🔒 O CPF é exigido pelo Asaas para criar o cliente, mas NÃO é persistido por nós
//    e NUNCA vai para log. Ele existe em memória durante a chamada e morre ali.
//    Se algum log precisar mencioná-lo, usa mascararCpf().

/** Só os dígitos. */
export function limparCpf(v: string): string {
  return String(v ?? '').replace(/\D/g, '')
}

/**
 * Valida CPF pelos dígitos verificadores. Vale a pena validar ANTES de chamar o
 * Asaas: erro nosso vira mensagem clara em português, erro do Asaas vira 400
 * genérico que a artesã não entende.
 */
export function cpfValido(v: string): boolean {
  const c = limparCpf(v)
  if (c.length !== 11) return false
  if (/^(\d)\1{10}$/.test(c)) return false   // 000.000.000-00 e afins

  for (const [ate, pos] of [[9, 10], [10, 11]] as const) {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(c[i]) * (pos - i)
    let d = (soma * 10) % 11
    if (d === 10) d = 0
    if (d !== Number(c[ate])) return false
  }
  return true
}

/** "***.***.**9-09" — o suficiente para a pessoa reconhecer, inútil para vazar. */
export function mascararCpf(v: string): string {
  const c = limparCpf(v)
  if (c.length !== 11) return '***'
  return `***.***.**${c[8]}-${c.slice(9)}`
}
