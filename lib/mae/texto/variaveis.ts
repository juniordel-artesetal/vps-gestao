// Lote 5 — VARIÁVEIS NOVAS dos textos:
//  · item 62: SUFIXO da idade (ANO/ANOS, ANINHO/ANINHOS, MÊS/MESES), automático pela idade do pedido;
//  · item 73: NOME_IDADE ("Nome + idade" num bloco: empilhado, na mesma linha ou "Nome faz 5");
//  · item 77: campos extras (SÉRIE/TURMA, PROFESSORA…) e FRASE ("A Pequena", "Fazendinha do") — texto livre
//    do pedido, com o padrão no tema; vazio some.
// Puro.
export type FormatoIdade = 'anos' | 'aninhos' | 'numero'
export type CaixaSufixo = 'maiusculas' | 'minusculas' | 'primeira'

/** Variáveis prontas para "+ Texto" (os campos extras entram pelo "+ Campo"). */
export const VARIAVEIS_TEXTO = ['NOME', 'IDADE', 'HASHTAG', 'SUFIXO', 'NOME_IDADE', 'FRASE', 'ARROBA'] as const
export const ROTULO_VARIAVEL: Record<string, string> = { SOBRENOME: 'Sobrenome', 'SÉRIE': 'Série', TURNO: 'Turno', NOME_IDADE: 'Nome + idade', 'NOME_IDADE:IDADE': 'Idade do bloco', SUFIXO: 'Sufixo (anos)', FRASE: 'Frase', ARROBA: '@' }
export const rotuloVariavel = (v: string) => ROTULO_VARIAVEL[v] ?? v

const caixaDe = (s: string, c: CaixaSufixo) => c === 'minusculas' ? s.toLocaleLowerCase('pt-BR') : c === 'primeira' ? s.charAt(0) + s.slice(1).toLocaleLowerCase('pt-BR') : s

/** Número da idade ("5", "5 anos", "1 aninho" → 5/1); "8 meses" é mesversário. */
export function lerIdade(idade: string): { n: number | null; meses: boolean } {
  const m = String(idade ?? '').match(/\d+/)
  return { n: m ? Number(m[0]) : null, meses: /m[eê]s/i.test(String(idade ?? '')) }
}

/**
 * Lote 13 (item 176): a IDADE que vem do pedido como texto ("1 ANO", "2 años", "2 aninhos", "3anos") vira SÓ O
 * NÚMERO — vale para a IDADE, a hashtag, o sufixo e o nome do arquivo. Mesversário fica "8 meses" / "1 mês".
 * Sem número ("um ano") → o texto como veio + `revisar`.
 */
export function idadeLimpa(idade: string): { valor: string; revisar: boolean } {
  const s = String(idade ?? '').trim()
  if (!s) return { valor: '', revisar: false }
  const { n, meses } = lerIdade(s)
  if (n === null) return { valor: s, revisar: true }
  return { valor: meses ? `${n} ${n === 1 ? 'mês' : 'meses'}` : String(n), revisar: false }
}

/** SUFIXO: 1 → ANO / ANINHO; 2 ou mais → ANOS / ANINHOS; meses → MÊS / MESES; "só o número" → vazio. */
export function sufixoDaIdade(idade: string, formato: FormatoIdade = 'anos', caixa: CaixaSufixo = 'maiusculas'): string {
  const { n, meses } = lerIdade(idade)
  if (formato === 'numero' || n === null) return ''
  const um = n === 1
  const s = meses ? (um ? 'MÊS' : 'MESES') : formato === 'aninhos' ? (um ? 'ANINHO' : 'ANINHOS') : (um ? 'ANO' : 'ANOS')
  return caixaDe(s, caixa)
}

/** A idade só com o número (o sufixo vira um texto próprio). */
export const idadeNumero = (idade: string) => { const { n } = lerIdade(idade); return n === null ? String(idade ?? '').trim() : String(n) }

/** Texto do bloco NOME_IDADE nos arranjos de UMA linha ("Maria Júlia · 5 anos", "Maria Júlia faz 5"). */
export function textoDoBloco(arranjo: 'linha' | 'faz', nome: string, idade: string, sufixo: string): string {
  const n = nome.trim(), i = idadeNumero(idade)
  if (!i) return n
  if (arranjo === 'faz') return `${n} faz ${i}`
  return `${n} · ${i}${sufixo ? ` ${sufixo.toLocaleLowerCase('pt-BR')}` : ''}`.trim()
}

/**
 * Lote 6 (item 93): NOME COMPLETO DIVIDIDO — a mãe manda "Benício Dettoni de Azevedo" e, quando a arte tem
 * SOBRENOME, o NOME fica com a(s) primeira(s) palavra(s) e o SOBRENOME com o resto. `_DIVISAO_NOME` (do pedido) =
 * quantas palavras ficam no NOME ("João Arthur" = 2); 0 = sem sobrenome (tudo no NOME). Se o pedido já mandou o
 * SOBRENOME separado, nada muda.
 */
export function comNomeDividido(v: Record<string, string>, temSobrenome: boolean, doPedido?: Record<string, string>): Record<string, string> {
  // só divide o NOME que veio do PEDIDO (o exemplo do tema já tem o seu SOBRENOME) e quando o pedido não mandou o sobrenome
  const p0 = doPedido ?? v
  if (!temSobrenome || p0.SOBRENOME !== undefined || !p0.NOME || !v.NOME) return v
  const p = v.NOME.trim().split(/\s+/).filter(Boolean)
  const n = v._DIVISAO_NOME !== undefined ? Math.max(0, Math.round(Number(v._DIVISAO_NOME) || 0)) : 1
  if (!n || n >= p.length) return { ...v, NOME: p.join(' '), SOBRENOME: '' }
  return { ...v, NOME: p.slice(0, n).join(' '), SOBRENOME: p.slice(n).join(' ') }
}

/** Lote 6 (item 93): valores de exemplo dos campos das etiquetas (o tema guarda; a lista de pedidos vira coluna). */
export const EXEMPLO_CAMPO: Record<string, string> = { SOBRENOME: 'Marques', 'SÉRIE': '2º ANO', SERIE: '2º ANO', TURNO: 'VESP', TURMA: '2º A', PROFESSORA: 'Tia Ana' }
