// WhatsApp — telefone e textos (puro, sem banco e sem rede; testado em lib/__tests__/whatsappLembrete.test.ts).

/**
 * Telefone brasileiro do perfil → '55' + DDD + número (10 ou 11 dígitos), ou null se não der para usar.
 * Aceita "(15) 99644-2242", "+55 15 99644 2242", "015996442242"…
 */
export function normalizarTelefone(v: string | null | undefined): string | null {
  let d = String(v ?? '').replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  d = d.replace(/^0+/, '')
  if (d.length !== 10 && d.length !== 11) return null
  if (!/^[1-9][1-9]/.test(d)) return null                // DDD válido (11 a 99)
  if (d.length === 11 && d[2] !== '9') return null        // celular com 11 dígitos começa com 9
  return '55' + d
}

/**
 * Chave do opt-out: DDD + os 8 últimos dígitos. O WhatsApp às vezes devolve o número SEM o 9 da frente (contas
 * antigas) — com a chave assim, o "PARAR" vindo de 55159644-2242 bate com o perfil 15 99644-2242.
 */
export function chaveTelefone(v: string | null | undefined): string | null {
  let d = String(v ?? '').replace(/\D/g, '').replace(/@.*$/, '')
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  d = d.replace(/^0+/, '')
  if (d.length < 10) return null
  return d.slice(0, 2) + d.slice(-8)
}

/** Palavras que pedem para sair da lista (opt-out). */
export const ehPedidoDeSaida = (texto: string | null | undefined) =>
  /^\s*(parar|pare|sair|stop|cancelar|descadastrar|nao quero|não quero)\s*[.!]*\s*$/i.test(String(texto ?? ''))

const primeiroNome = (n: string | null | undefined) => {
  const p = String(n ?? '').trim().split(/\s+/)[0] ?? ''
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ''
}

/** Hash curto e estável (escolhe a variação do texto: a mesma cobrança sempre igual, cobranças diferentes variam). */
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

export interface DadosLembrete { nome?: string | null; link: string; produto?: string; degrau?: number; chave?: string }

/**
 * LEMBRETE DE COBRANÇA. Sem valor, sem dado financeiro no corpo — o link resolve. Personalizado (nome) e com pequenas
 * variações (anti-ban: nada de broadcast idêntico). Sempre com a saída ("responda PARAR").
 */
export function textoLembreteCobranca(d: DadosLembrete): string {
  const nome = primeiroNome(d.nome)
  const oi = nome ? `Oi, ${nome}!` : 'Oi!'
  const produto = d.produto && d.produto !== 'SOA' ? `do ${d.produto}` : 'do SOA'
  const v = hash(d.chave ?? d.link) % 3
  const abre = d.degrau === 0
    ? [`Passando pra lembrar que a sua mensalidade ${produto} vence hoje.`, `Só um lembrete: a mensalidade ${produto} vence hoje.`, `Lembrete rapidinho: hoje é o vencimento da sua mensalidade ${produto}.`][v]
    : [`Passando pra lembrar que a sua mensalidade ${produto} está em aberto.`, `Vi aqui que a sua mensalidade ${produto} ficou em aberto.`, `Só um lembrete: a sua mensalidade ${produto} ainda está em aberto.`][v]
  const meio = ['Pra manter seu acesso liberado, é rapidinho:', 'É rapidinho pra manter tudo liberado:', 'Pra não perder o acesso, é só pagar por aqui:'][v]
  return `${oi} 💛 ${abre} ${meio}\n${d.link}\n\nQualquer dúvida é só chamar a gente por aqui. 🙌 — Equipe SOA\n\n(Não quer mais receber lembretes por aqui? Responda PARAR.)`
}

/** Texto de cada evento (o `template` do enviar). Evento sem texto aqui → null (não envia). */
export function montarMensagem(template: string, dados: Record<string, unknown> = {}): string | null {
  if (template === 'lembrete_cobranca') {
    if (typeof dados.link !== 'string' || !dados.link) return null
    return textoLembreteCobranca(dados as unknown as DadosLembrete)
  }
  if (typeof dados.mensagem === 'string' && dados.mensagem.trim()) return dados.mensagem.trim()
  return null
}
