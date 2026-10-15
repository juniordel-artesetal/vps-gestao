// Lote 19 (item 237): DOIS NOMES NO MESMO PEDIDO (gêmeas, irmãos) — o mesmo tema e o mesmo kit com os dois nomes.
// Diferente do Dividir (224), que faz duas artes. Puro.
export type ModoDoisNomes = 'faces' | 'juntos' | 'metade'
export interface DoisNomes { nome1: string; idade1?: string; nome2: string; idade2?: string; modo: ModoDoisNomes; conector?: string; hashtag?: 'ambos' | 'face' }

const PROPRIO = /^[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ][\p{L}'’-]*(\s+(?:d[aeo]s?|[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ][\p{L}'’-]*))*$/u
/**
 * "Ayla Maria e Aylin Maria" → ['Ayla Maria', 'Aylin Maria']. Só SUGERE quando os dois lados parecem nomes próprios
 * (começam com maiúscula, sem números nem "idade/anos") — "Maitê e a idade e 2 anos" é UM nome só.
 */
export function sugereDoisNomes(texto: string | null | undefined): [string, string] | null {
  const t = (texto ?? '').replace(/[.,;]+\s*\d.*$/, '').trim()
  if (!t || /\d|\bidade\b|\banos?\b|\baninhos?\b/i.test(t)) return null
  const partes = t.split(/\s+(?:e|&|\+)\s+/)
  if (partes.length !== 2) return null
  const [a, b] = partes.map(x => x.trim())
  if (a.length < 2 || b.length < 2 || !PROPRIO.test(a) || !PROPRIO.test(b)) return null
  return [a, b]
}

/** O texto da arte no modo "os dois juntos": "Ayla Maria & Aylin Maria". */
export const nomesJuntos = (d: DoisNomes) => `${d.nome1.trim()} ${(d.conector ?? '&').trim()} ${d.nome2.trim()}`

/**
 * Modo "um nome em cada face": as faces que têm nome alternam Nome 1 / Nome 2 (cada uma com a sua idade), na ordem das
 * folhas, dos moldes e das faces. Devolve os valores por posição de texto (os da face do Nome 2).
 */
export function alternarNomesNoDoc(doc: { artboards: { id: string }[]; molds: { id: string; artboardId: string; faces: { id: string }[] }[]; textSlots: { id: string; faceId: string; variable: string }[] },
  valores: Record<string, string>, d: DoisNomes): Record<string, Record<string, string>> {
  const comNome = new Set(doc.textSlots.filter(s => s.variable === 'NOME' || s.variable === 'NOME_IDADE').map(s => s.faceId))
  const faces: string[] = []
  for (const ab of doc.artboards) for (const m of doc.molds.filter(x => x.artboardId === ab.id)) for (const f of m.faces) if (comNome.has(f.id)) faces.push(f.id)
  const segunda = new Set(faces.filter((_, i) => i % 2 === 1))
  const v2 = valoresDoNome2(valores, d)
  const out: Record<string, Record<string, string>> = {}
  for (const s of doc.textSlots) if (segunda.has(s.faceId)) out[s.id] = v2
  return out
}
/** Os valores do pedido com o Nome 2 (e a idade dele) no lugar do Nome 1. */
export function valoresDoNome2(valores: Record<string, string>, d: DoisNomes): Record<string, string> {
  const v: Record<string, string> = { ...valores, NOME: d.nome2.trim(), IDADE: (d.idade2 ?? d.idade1 ?? valores.IDADE ?? '').trim() }
  delete v.HASHTAG
  return v
}
