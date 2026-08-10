// Adapter WhatsApp — STUB (scaffold). Amanhã plugará a WhatsApp Cloud API.
// Hoje: só assinatura + log. Nenhuma chamada externa. Config local em WhatsappConfig.

export type EventoWhatsapp =
  | 'novo_pedido' | 'orcamento_aprovado' | 'conta_pagar' | 'conta_receber' | 'lancamento_voz'

export const EVENTOS_WHATSAPP: { key: EventoWhatsapp; label: string }[] = [
  { key: 'novo_pedido', label: 'Novo pedido' },
  { key: 'orcamento_aprovado', label: 'Aprovação de orçamento' },
  { key: 'conta_pagar', label: 'Conta a pagar' },
  { key: 'conta_receber', label: 'Conta a receber' },
  { key: 'lancamento_voz', label: 'Lançamento financeiro por voz' },
]

export interface ResultadoEnvio { ok: boolean; pendente: boolean; erro?: string }

// Envia uma mensagem/template. STUB: não envia nada.
export async function enviar(_template: string, _destino: string, _dados?: Record<string, any>): Promise<ResultadoEnvio> {
  console.log('[whatsapp] enviar — aguardando WhatsApp Cloud API (stub)')
  return { ok: false, pendente: true, erro: 'Aguardando integração do WhatsApp' }
}

// Recebe/transcreve um áudio (lançamento por voz). STUB: retorna vazio.
export async function receberAudio(_audioRef: string): Promise<{ ok: boolean; pendente: boolean; texto?: string }> {
  console.log('[whatsapp] receberAudio — aguardando integração (stub)')
  return { ok: false, pendente: true }
}

// Interpreta um texto de lançamento por voz (mock de como ficaria o parse).
export function previewLancamentoVoz(texto: string): { tipo: 'RECEITA' | 'DESPESA'; descricao: string; valor: number | null } {
  const t = (texto || '').toLowerCase()
  const tipo = /receb|entrou|venda|paga(ram|mento recebido)/.test(t) ? 'RECEITA' : 'DESPESA'
  const m = t.match(/(\d+[.,]?\d*)/)
  const valor = m ? parseFloat(m[1].replace(',', '.')) : null
  return { tipo, descricao: texto || '', valor }
}
