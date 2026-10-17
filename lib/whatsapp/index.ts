// WHATSAPP do SOA → artesãs (17/10/2026). O `enviar(template, destino, dados)` é a ÚNICA porta de saída: hoje fala com o
// SERVIÇO companheiro (whatsapp-web.js num VPS — ver servicos/whatsapp/README.md); se vier ban, troca-se o provedor
// (Cloud API oficial, Z-API…) reimplementando só esta função, sem mexer nos gatilhos.
//
// Regras:
//  • FAIL-OPEN: nunca lança. Erro/timeout/serviço fora → { ok:false, pendente:true }. O e-mail (Resend) continua sendo
//    o canal garantido; o WhatsApp é o ADICIONAL.
//  • Flag WHATSAPP_ATIVO (env), começa OFF: desligado, nem chama o serviço.
//  • Opt-out: quem respondeu PARAR (tabela WhatsappOptOut) não recebe.
//  • Segredo e URL só no servidor (WHATSAPP_SERVICE_URL / WHATSAPP_SERVICE_SECRET). O telefone nunca vai inteiro para log.
// (O scaffold do Lote "suporte-ia" tinha aqui os stubs de voz/eventos do ateliê — mantidos com a mesma assinatura.)
import { prisma } from '@/lib/prisma'
import { normalizarTelefone, chaveTelefone, montarMensagem } from './mensagens'

export type EventoWhatsapp =
  | 'novo_pedido' | 'orcamento_aprovado' | 'conta_pagar' | 'conta_receber' | 'lancamento_voz' | 'lembrete_cobranca'

export const EVENTOS_WHATSAPP: { key: EventoWhatsapp; label: string }[] = [
  { key: 'novo_pedido', label: 'Novo pedido' },
  { key: 'orcamento_aprovado', label: 'Aprovação de orçamento' },
  { key: 'conta_pagar', label: 'Conta a pagar' },
  { key: 'conta_receber', label: 'Conta a receber' },
  { key: 'lancamento_voz', label: 'Lançamento financeiro por voz' },
  { key: 'lembrete_cobranca', label: 'Lembrete de cobrança (mensalidade em aberto)' },
]

export interface ResultadoEnvio {
  ok: boolean
  pendente: boolean
  erro?: string
  /** Erro que não adianta tentar de novo (número inválido, sem WhatsApp, opt-out). */
  permanente?: boolean
  /** Id do envio no serviço (fila). */
  id?: string
}

type Env = Record<string, string | undefined>
export const whatsappLigado = (env: Env = process.env) => (env.WHATSAPP_ATIVO ?? '').trim().toLowerCase() === 'on'
/** Telefone mascarado para log: 55 15 9****-2242. */
export const mascarar = (tel: string) => tel.replace(/^(\d{2})(\d{2})(\d)\d+(\d{4})$/, '$1 $2 $3****-$4')

/** Respondeu PARAR? (sem tabela = ninguém saiu ainda). */
export async function saiuDoWhatsapp(telefone: string): Promise<boolean> {
  const k = chaveTelefone(telefone)
  if (!k) return false
  const [r] = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok FROM "WhatsappOptOut" WHERE "chave" = ${k} LIMIT 1`.catch(() => [])
  return !!r
}

/** Envia uma mensagem/template. Nunca lança (fail-open). */
export async function enviar(template: string, destino: string, dados: Record<string, unknown> = {}, env: Env = process.env, f: typeof fetch = fetch): Promise<ResultadoEnvio> {
  try {
    if (!whatsappLigado(env)) return { ok: false, pendente: true, erro: 'WhatsApp desligado (WHATSAPP_ATIVO)' }
    const url = (env.WHATSAPP_SERVICE_URL ?? '').trim().replace(/\/+$/, ''), segredo = (env.WHATSAPP_SERVICE_SECRET ?? '').trim()
    if (!url || !segredo) return { ok: false, pendente: true, erro: 'Serviço do WhatsApp não configurado' }
    const para = normalizarTelefone(destino)
    if (!para) return { ok: false, pendente: false, permanente: true, erro: 'Telefone inválido' }
    if (await saiuDoWhatsapp(para)) return { ok: false, pendente: false, permanente: true, erro: 'Pediu para não receber (PARAR)' }
    const mensagem = montarMensagem(template, dados)
    if (!mensagem) return { ok: false, pendente: false, permanente: true, erro: `Sem texto para "${template}"` }
    const r = await f(`${url}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ws-secret': segredo },
      body: JSON.stringify({ para, mensagem }),
      signal: AbortSignal.timeout(8000),
    })
    const j = await r.json().catch(() => ({})) as { ok?: boolean; id?: string; erro?: string }
    if (r.ok && j.ok) return { ok: true, pendente: false, id: j.id }
    const erro = j.erro || `serviço respondeu ${r.status}`
    console.error(`[WHATSAPP] ${template} → ${mascarar(para)}: ${erro}`)
    return { ok: false, pendente: true, erro }
  } catch (e) {
    const erro = (e as Error)?.name === 'TimeoutError' ? 'tempo esgotado (8 s)' : (e as Error)?.message || 'erro'
    console.error(`[WHATSAPP] ${template}: ${erro}`)
    return { ok: false, pendente: true, erro }
  }
}

// Recebe/transcreve um áudio (lançamento por voz). STUB: retorna vazio.
export async function receberAudio(audioRef: string): Promise<{ ok: boolean; pendente: boolean; texto?: string }> {
  void audioRef
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
