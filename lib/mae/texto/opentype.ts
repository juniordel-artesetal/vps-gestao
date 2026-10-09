// Lote 5 (item 55): RECURSOS OPENTYPE com nome em português, só os que a fonte tem, os úteis para festa primeiro e
// os técnicos num "Avançado" recolhido. Puro.
const NOMES: Record<string, string> = {
  swsh: 'Floreios', cswh: 'Floreios contextuais', salt: 'Letras alternativas', aalt: 'Todas as alternativas',
  calt: 'Alternativas contextuais', liga: 'Ligaduras', dlig: 'Ligaduras extras', hlig: 'Ligaduras históricas', rlig: 'Ligaduras obrigatórias',
  titl: 'Títulos', hist: 'Formas históricas', ornm: 'Ornamentos', smcp: 'Versalete', c2sc: 'Maiúsculas em versalete', pcap: 'Versalete pequeno',
  lnum: 'Números alinhados', onum: 'Números elegantes (old style)', pnum: 'Números proporcionais', tnum: 'Números tabulares',
  frac: 'Frações', ordn: 'Ordinais', sups: 'Sobrescrito', subs: 'Subscrito', zero: 'Zero cortado', unic: 'Unicase', case: 'Formas para maiúsculas',
  init: 'Forma inicial', fina: 'Forma final', medi: 'Forma do meio', isol: 'Forma isolada', locl: 'Formas locais', ccmp: 'Composição', kern: 'Kerning',
}
/** Úteis para festa (mostrados primeiro). */
export const OT_UTEIS = new Set(['swsh', 'cswh', 'salt', 'aalt', 'dlig', 'hlig', 'titl', 'ornm', 'hist', 'init', 'fina', 'calt'])
/** Ligados por padrão / internos — não aparecem. */
export const OT_OCULTOS = new Set(['ccmp', 'locl', 'liga', 'kern', 'mark', 'mkmk', 'rlig', 'rclt', 'curs', 'abvm', 'blwm', 'dist', 'isol', 'medi'])

/** Nome claro: "Estilo 3" (ss03), "Variante 2" (cv02), "Floreios" (swsh)… */
export function nomeOT(tag: string): string {
  if (/^ss\d\d$/.test(tag)) return `Estilo ${Number(tag.slice(2))}`
  if (/^cv\d\d$/.test(tag)) return `Variante ${Number(tag.slice(2))}`
  return NOMES[tag] ?? tag
}

/** Os recursos da fonte separados em úteis (estilos, floreios, alternativas…) e avançados (os técnicos). */
export function separarOT(gsub: string[]): { uteis: string[]; avancados: string[] } {
  const tags = [...new Set(gsub)].filter(t => !OT_OCULTOS.has(t))
  const util = (t: string) => OT_UTEIS.has(t) || /^ss\d\d$/.test(t) || /^cv\d\d$/.test(t)
  const ordem = (t: string) => (/^ss\d\d$/.test(t) ? 1 : t === 'swsh' || t === 'cswh' ? 0 : t === 'salt' ? 2 : 3)
  return { uteis: tags.filter(util).sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b)), avancados: tags.filter(t => !util(t)).sort() }
}
