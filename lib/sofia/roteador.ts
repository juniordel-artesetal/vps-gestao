// ─────────────────────────────────────────────────────────────────────────────
// ROTEADOR DE INTENÇÃO DA SOFIA — interpreta a pergunta em linguagem natural e
// decide QUAL ferramenta de busca acionar e com quais parâmetros. Determinístico
// (sem custo de IA) para os casos de maior volume: pedidos e clientes. Extensível.
//
// A IA nunca gera id/link: o roteador só extrai a INTENÇÃO + o TERMO da pergunta;
// quem busca e monta os resultados (com links reais) são as ferramentas.
// ─────────────────────────────────────────────────────────────────────────────
import { statusDoTermo, type RespostaBusca } from '@/lib/sofia/ferramentas'

export interface Intencao {
  tipo: 'pedidos' | 'clientes' | 'produtos' | 'financeiro'
  filtros: { cliente?: string; produto?: string; numero?: string; status?: string; termo?: string; ateHoje?: boolean }
}

const VERBOS = /(encontr|ach[aeoá]|busc|procur|localiz|cad[êe]|onde (est[áa]|t[áa]|fica)|mostr|list|quero ver|me (mostra|acha|traz|leva)|ver (o|a|os|as|meu|minha))/i
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Limpa o termo: tira verbos, artigos e conectivos do começo/fim. */
function limparTermo(raw: string): string {
  return String(raw || '')
    .replace(/[?!.,;]+$/g, '')
    .replace(/^\s*(o|a|os|as|do|da|de|dos|das|um|uma|meu|minha|meus|minhas|pra|para|com|no|na)\s+/i, '')
    .replace(/^\s*(cliente|clienta|comprador[a]?|contato)\s+/i, '')
    .trim()
}

/** Detecta uma BUSCA e extrai os parâmetros. Retorna null quando não é busca. */
export function detectarBusca(mensagem: string): Intencao | null {
  const msg = String(mensagem || '')
  const m = norm(msg)
  const temVerbo = VERBOS.test(m)

  // ── Alvo: financeiro ──
  if (/(conta|lancament|despesa|boleto|financeir|a pagar|pagamento)/.test(m)) {
    const termo = limparTermo(msg.replace(new RegExp(VERBOS.source + '|conta[s]?|lancament\\w*|despesa[s]?|boleto[s]?|financeir\\w*|de |da |do ', 'gi'), ' '))
    const ateHoje = /(vencid|vencendo|atrasad)/.test(m)
    const status = /(vencid|vencendo|atrasad|a pagar|pendente|em aberto)/.test(m) ? 'PENDENTE' : /(pago|paga|quitad)/.test(m) ? 'PAGO' : undefined
    return { tipo: 'financeiro', filtros: { termo: termo && termo.length >= 2 ? termo : undefined, status, ateHoje } }
  }

  // ── Alvo: pedidos / encomendas / vendas ──
  if (/(pedido|encomenda|venda)/.test(m)) {
    // número: "pedido 123", "pedido nº 123", "#123"
    const num = m.match(/(?:pedido|encomenda|venda|n[ºo°]|numero|#)\s*#?\s*(\d{1,10})\b/)
    if (num) return { tipo: 'pedidos', filtros: { numero: num[1] } }
    // status: "pedidos em produção/atrasados/prontos/enviados/abertos"
    const status = statusDoTermo(m)
    // cliente: o nome vem depois de "da/de/do/cliente/para" (com fronteira de
    // palavra — senão o "dos" de "pedidos" casaria e capturaria lixo).
    const cli = msg.match(/\b(?:d[eao]s?|cliente|clienta|comprador[a]?|para|pra)\s+([A-Za-zÀ-ÿ][\wÀ-ÿ .'-]{1,40})$/i)
    const cliente = cli ? limparTermo(cli[1]) : undefined
    // Se o termo capturado é na verdade uma palavra de status (ex.: "em produção"),
    // não é cliente — é filtro de status.
    if (cliente && cliente.length >= 2 && !statusDoTermo(cliente)) return { tipo: 'pedidos', filtros: { cliente, status: status || undefined } }
    if (status) return { tipo: 'pedidos', filtros: { status } }
    // "meus pedidos" sem qualificador → deixa para a contagem/dados
    return temVerbo ? { tipo: 'pedidos', filtros: {} } : null
  }

  // ── Alvo: produto / material ──
  if (/(produto|material|materiais|pe[çc]a|insumo)/.test(m)) {
    const termo = limparTermo(msg.replace(new RegExp(VERBOS.source + '|produto[s]?|material|materiais|pe[çc]a[s]?|insumo[s]?|de |da |do ', 'gi'), ' '))
    if (termo && termo.length >= 2) return { tipo: 'produtos', filtros: { termo } }
    return null
  }

  // ── Alvo: cliente ──
  if (/(cliente|clienta|comprador|contato)/.test(m)) {
    const termo = limparTermo(msg.replace(new RegExp(VERBOS.source + '|cliente[s]?|clienta[s]?|comprador\\w*|contato[s]?|de |da |do ', 'gi'), ' '))
    if (termo && termo.length >= 2) return { tipo: 'clientes', filtros: { termo } }
    return null
  }

  return null
}

/** É pedido de ALERTAS ("o que preciso resolver hoje?"). */
export function ehPerguntaAlertas(mensagem: string): boolean {
  const m = norm(mensagem)
  return /(o que (eu )?(preciso|tenho que|devo) (resolver|fazer|ver)|minhas? pend[êe]ncia|meus alertas|o que (t[áa]|est[áa]) (atrasad|vencend|pendente)|tenho (algum|algo|pedido|conta).*(atrasad|vencid)|preciso me preocupar|resumo do dia|como (est[áa]|ta) meu dia)/.test(m)
}

// ── Frases (persona SOFIA — sem markdown, sem ** ) ────────────────────────────

export function introBusca(tipo: string, filtros: Intencao['filtros'], r: RespostaBusca): string {
  const termo = filtros.cliente || filtros.termo || filtros.produto || ''
  const de = termo ? ` de "${termo}"` : ''
  if (tipo === 'pedidos') {
    if (filtros.numero) return r.total === 1 ? 'Achei o pedido, amiga! 🧡 Clica pra abrir 👇' : `Achei ${r.total} pedidos com esse número 👇`
    return `Achei ${r.total} ${r.total === 1 ? 'pedido' : 'pedidos'}${de}, amiga! 🧡 Clica pra abrir 👇`
  }
  if (tipo === 'clientes') return `Encontrei ${r.total} ${r.total === 1 ? 'cliente' : 'clientes'}${de} 🧡 É só clicar 👇`
  if (tipo === 'produtos') return `Encontrei ${r.total} ${r.total === 1 ? 'item' : 'itens'}${de} na sua precificação 👇`
  if (tipo === 'financeiro') return `Achei ${r.total} ${r.total === 1 ? 'lançamento' : 'lançamentos'}${de} 💰 Olha aqui 👇`
  return 'Olha o que encontrei 👇'
}

export function introVazia(tipo: string, filtros: Intencao['filtros']): string {
  const termo = filtros.cliente || filtros.termo || filtros.produto || filtros.numero || ''
  const de = termo ? ` "${termo}"` : ''
  if (tipo === 'pedidos') return `Não encontrei nenhum pedido${de}, amiga 😔 Quer que eu procure por outro nome ou número?`
  if (tipo === 'clientes') return `Não achei nenhuma cliente${de} 😔 Quer tentar escrever de outro jeito?`
  if (tipo === 'produtos') return `Não encontrei${de} na sua precificação. Quer procurar por outro nome?`
  if (tipo === 'financeiro') return `Não achei nenhum lançamento${de} 😔 Quer que eu veja de outro jeito?`
  return 'Não encontrei nada com isso 😔 Quer tentar de outro jeito?'
}
