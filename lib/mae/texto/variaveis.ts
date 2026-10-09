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
export const ROTULO_VARIAVEL: Record<string, string> = { NOME_IDADE: 'Nome + idade', 'NOME_IDADE:IDADE': 'Idade do bloco', SUFIXO: 'Sufixo (anos)', FRASE: 'Frase', ARROBA: '@' }
export const rotuloVariavel = (v: string) => ROTULO_VARIAVEL[v] ?? v

const caixaDe = (s: string, c: CaixaSufixo) => c === 'minusculas' ? s.toLocaleLowerCase('pt-BR') : c === 'primeira' ? s.charAt(0) + s.slice(1).toLocaleLowerCase('pt-BR') : s

/** Número da idade ("5", "5 anos", "1 aninho" → 5/1); "8 meses" é mesversário. */
export function lerIdade(idade: string): { n: number | null; meses: boolean } {
  const m = String(idade ?? '').match(/\d+/)
  return { n: m ? Number(m[0]) : null, meses: /m[eê]s/i.test(String(idade ?? '')) }
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
