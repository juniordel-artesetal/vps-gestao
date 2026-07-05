// Camada genérica provider-agnostic de pagamento.
// Métodos: 'pix' (chave, manual) | 'link' (genérico, manual) | 'mercadopago' (webhook automático).
// Novos adaptadores (Asaas/InfinitePay/PagBank) = só implementar consultarProvedor + criação.

import { consultarPagamento as mpConsultar } from './mercadopago'

export const METODOS = ['pix', 'link', 'mercadopago'] as const
export type Metodo = typeof METODOS[number]

// Métodos ativos conforme a config (json em "metodos" + campos presentes)
export function metodosDisponiveis(cfg: {
  pixChave?: string | null
  linkPagamento?: string | null
  provedor?: string | null
  provedorAtivo?: boolean
  credencial?: string | null
  metodos?: string | null
}): Metodo[] {
  let ativos: string[] = []
  try { if (cfg.metodos) ativos = JSON.parse(cfg.metodos) } catch {}
  const out: Metodo[] = []
  if ((ativos.length === 0 || ativos.includes('pix')) && cfg.pixChave) out.push('pix')
  if ((ativos.length === 0 || ativos.includes('link')) && cfg.linkPagamento) out.push('link')
  if ((ativos.length === 0 || ativos.includes('mercadopago')) && cfg.provedorAtivo && cfg.provedor === 'mercadopago' && cfg.credencial) out.push('mercadopago')
  return out
}

// Re-consulta o provedor (fonte da verdade no webhook). Extensível por provedor.
export async function consultarProvedor(provedor: string, token: string, ref: string): Promise<{ status: 'pago' | 'pendente' | 'cancelado'; valor: number | null }> {
  switch (provedor) {
    case 'mercadopago':
      return mpConsultar(token, ref)
    default:
      throw new Error(`Provedor não suportado: ${provedor}`)
  }
}
