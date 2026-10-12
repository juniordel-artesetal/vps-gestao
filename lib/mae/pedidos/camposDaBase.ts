// mae-pedidos — CAMPOS DO PEDIDO VÊM DA BASE (Lote 8, item 128). Puro.
//  • Quem define os campos de um pedido é a BASE do produto dele (o GRUPO ligado ao produto): os textos posicionados
//    nas faces do grupo (NOME, SÉRIE, PROFESSORA…). Produto ≠ tema: todo tema dessa base herda esses campos.
//  • BIBLIOTECA COMPARTILHADA: campos com o mesmo nome valem entre bases — o nome é comparado sem acento e sem
//    maiúscula/minúscula ("Série" = "SERIE" = "SÉRIE"); o campo "Série" do pedido do SOA cai no SÉRIE da arte.
//  • Campo que a arte usa e o pedido não tem → "faltam dados (SÉRIE)" (a FRASE tem o padrão do tema; não conta).

/** Variáveis com coluna própria ou calculadas — não viram coluna de "campo". */
export const FORA_DA_COLUNA = new Set(['NOME', 'IDADE', 'HASHTAG', 'ARROBA', 'SUFIXO', 'NOME_IDADE', 'SOBRENOME', 'TEMA'])
/** Campos com valor padrão do tema (vazio no pedido não é "falta"). */
const COM_PADRAO = new Set(['FRASE'])

/** Chave de comparação de nome de campo: sem acento, maiúsculas, só letras e números. */
export const chaveCampo = (s: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

interface Slot { variable: string; frase?: unknown }
/** Variáveis que os textos de um documento (base ou grupo) usam; NOME_IDADE vira NOME + IDADE; frase presa → FRASE. */
export function variaveisDoDoc(d: { textSlots: Slot[] }): string[] {
  const out = new Set<string>()
  for (const s of d.textSlots) {
    if (s.variable === 'NOME_IDADE') { out.add('NOME'); out.add('IDADE') } else out.add(s.variable)
    if (s.frase) out.add('FRASE')
  }
  return [...out]
}

/** Os CAMPOS (colunas da célula "Campos") da base/grupo: as variáveis da arte, sem as que têm coluna própria. */
export function camposDoDoc(d: { textSlots: Slot[] }): string[] {
  const vistos = new Map<string, string>()
  for (const v of variaveisDoDoc(d)) if (!FORA_DA_COLUNA.has(v) && !vistos.has(chaveCampo(v))) vistos.set(chaveCampo(v), v)
  return [...vistos.values()]
}

/** Valor de um campo nos campos do pedido, casando o nome sem acento/caixa. */
export function valorDoCampo(campos: Record<string, string | undefined>, campo: string): string | undefined {
  if (campos[campo] !== undefined) return campos[campo]
  const k = chaveCampo(campo)
  const achado = Object.keys(campos).find(x => chaveCampo(x) === k)
  return achado ? campos[achado] : undefined
}

/** Campos que a arte usa e o pedido não preencheu ("faltam dados (SÉRIE)"). */
export function camposFaltando(camposDaArte: string[], campos: Record<string, string | undefined>): string[] {
  return camposDaArte.filter(c => !COM_PADRAO.has(chaveCampo(c)) && !String(valorDoCampo(campos, c) ?? '').trim())
}

/**
 * Valores do pedido alinhados aos NOMES das variáveis da arte: "SERIE" do pedido também vale como "SÉRIE" (a
 * biblioteca compartilhada). Não troca o que já existe com o nome exato.
 */
export function alinharCampos<T extends Record<string, string>>(valores: T, nomesDaArte: string[]): T {
  const out = { ...valores } as Record<string, string>
  const porChave = new Map(Object.keys(valores).filter(k => !k.startsWith('_')).map(k => [chaveCampo(k), k]))
  for (const n of nomesDaArte) {
    if (out[n] !== undefined) continue
    const k = porChave.get(chaveCampo(n))
    if (k !== undefined) out[n] = valores[k]
  }
  return out as T
}
