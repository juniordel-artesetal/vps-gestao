// mae-texto — HARFBUZZ (WASM) e FONTES. Roda no navegador e no Node (testes). Nada vai ao servidor:
// a fonte chega como bytes (Local Font Access, Google Fonts baixada para a Biblioteca, ou a substituta
// embutida) e vira contornos de glifo em unidades da fonte.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type HB = typeof import('harfbuzzjs')
let hbP: Promise<HB> | null = null
export const carregarHarfBuzz = (): Promise<HB> => (hbP ??= import('harfbuzzjs'))

export type Cmd = ['M', number, number] | ['L', number, number] | ['Q', number, number, number, number] | ['C', number, number, number, number, number, number] | ['Z']

export interface FonteHB {
  hb: HB
  ps: string
  family: string
  upem: number
  ascender: number
  descender: number
  /** Recursos OpenType de substituição (GSUB) que a fonte tem. */
  gsub: string[]
  unicodes: Set<number>
  font: any
  /** Contorno do glifo em unidades da fonte (y para CIMA), com cache. */
  contorno: (gid: number) => Cmd[]
}

export async function abrirFonte(bytes: Uint8Array | ArrayBuffer, nomeReserva = 'Fonte'): Promise<FonteHB> {
  const hb = await carregarHarfBuzz()
  const face = new hb.Face(new hb.Blob(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)))
  const font = new hb.Font(face)
  const nome = (id: number) => { try { return face.getName(id, 'en') || '' } catch { return '' } }
  const ext = font.hExtents()
  const cache = new Map<number, Cmd[]>()
  return {
    hb, font,
    ps: nome(6) || nome(4) || nomeReserva,
    family: nome(16) || nome(1) || nomeReserva,
    upem: face.upem,
    ascender: ext.ascender,
    descender: ext.descender,
    gsub: [...new Set(face.getTableFeatureTags('GSUB'))],
    unicodes: new Set(Array.from(face.collectUnicodes())),
    contorno: (gid: number) => {
      let c = cache.get(gid)
      if (!c) {
        c = (font.glyphToJson(gid) as { type: string; values: number[] }[]).map(({ type, values: v }) =>
          (type === 'Z' ? ['Z'] : [type, ...v]) as Cmd)
        cache.set(gid, c)
      }
      return c
    },
  }
}

export interface GlifoMoldado { gid: number; cluster: number; xAdv: number; xOff: number; yOff: number }

/** Recursos OpenType: globais (lista de tags) + escolhas por letra (feature só naquela posição). */
export interface OpcoesMoldar {
  features?: string[]
  kerning?: boolean
  escolhas?: EscolhaMoldar[]
}
export type EscolhaMoldar = { index: number; char: string; kind: 'feature'; tag: string; value: number } | { index: number; char: string; kind: 'glyph'; gid: number }

/** Molda o texto com o HarfBuzz (shaping OpenType completo). Determinístico. */
export function moldar(f: FonteHB, texto: string, o: OpcoesMoldar = {}): GlifoMoldado[] {
  const { hb } = f
  const buf = new hb.Buffer()
  buf.addText(texto)
  buf.guessSegmentProperties()
  const feats: any[] = []
  for (const t of o.features ?? []) feats.push(new hb.Feature(t, 1))
  if (o.kerning === false) feats.push(new hb.Feature('kern', 0))
  for (const e of o.escolhas ?? []) if (e.kind === 'feature' && texto[e.index] === e.char) feats.push(new hb.Feature(e.tag, e.value, e.index, e.index + 1))
  hb.shape(f.font, buf, feats)
  const inf = buf.getGlyphInfos(), pos = buf.getGlyphPositions()
  const out: GlifoMoldado[] = inf.map((g: { codepoint: number; cluster: number }, i: number) => ({ gid: g.codepoint, cluster: g.cluster, xAdv: pos[i].xAdvance, xOff: pos[i].xOffset, yOff: pos[i].yOffset }))
  // glifo "sem código" escolhido no painel: troca o glifo daquela letra depois do shaping
  for (const e of o.escolhas ?? []) {
    if (e.kind !== 'glyph' || texto[e.index] !== e.char) continue
    const g = out.find(x => x.cluster === e.index)
    if (g) { g.gid = e.gid; g.xAdv = f.font.glyphHAdvance(e.gid); g.xOff = 0; g.yOff = 0 }
  }
  return out
}

/** Faixas de Unicode privado (PUA): onde fontes de festa costumam guardar swashes e alternativos. */
export function glifosPUA(f: FonteHB, limite = 400): number[] {
  return [...f.unicodes].filter(cp => (cp >= 0xe000 && cp <= 0xf8ff) || cp >= 0xf0000).sort((a, b) => a - b).slice(0, limite)
}

const TAGS_ALT = /^(aalt|salt|swsh|cswh|titl|hist|ornm|dlig|ss\d\d|cv\d\d)$/

/**
 * Alternativas da letra na posição `index` do texto (painel de glifos): liga cada recurso OpenType só
 * naquela letra (e, nos de vários valores, 1..20) e guarda cada glifo diferente que aparecer.
 */
export function alternativas(f: FonteHB, texto: string, index: number, base: OpcoesMoldar = {}): { tag: string; value: number; gid: number }[] {
  const glifoEm = (g: GlifoMoldado[]) => g.find(x => x.cluster === index)?.gid
  const padrao = glifoEm(moldar(f, texto, base))
  const vistos = new Set<number>(padrao !== undefined ? [padrao] : [])
  const out: { tag: string; value: number; gid: number }[] = []
  const char = texto[index]
  for (const tag of f.gsub.filter(t => TAGS_ALT.test(t))) {
    const max = tag === 'aalt' || tag === 'salt' || tag.startsWith('cv') ? 20 : 1
    let semMudar = 0
    for (let v = 1; v <= max; v++) {
      const gid = glifoEm(moldar(f, texto, { ...base, escolhas: [...(base.escolhas ?? []).filter(e => e.index !== index), { index, char, kind: 'feature', tag, value: v }] }))
      if (gid === undefined) break
      if (vistos.has(gid)) { if (++semMudar >= 2) break; continue }
      vistos.add(gid); out.push({ tag, value: v, gid })
    }
  }
  return out
}

/** Número de glifos da fonte (tabela maxp). */
export function numGlifos(f: FonteHB): number {
  const t = f.font.face.referenceTable('maxp') as Uint8Array | undefined
  return t && t.length >= 6 ? (t[4] << 8) | t[5] : 0
}

/** Glifos sem código Unicode (alternativos "escondidos" de fontes sem GSUB, como a Vila Valent). */
export function glifosSemCodigo(f: FonteHB, limite = 400): number[] {
  const comCodigo = new Set<number>()
  for (const cp of f.unicodes) { const g = f.font.glyph(cp); if (g) comCodigo.add(g) }
  const out: number[] = []
  for (let g = 1; g < numGlifos(f) && out.length < limite; g++) if (!comCodigo.has(g) && f.contorno(g).length) out.push(g)
  return out
}

/** Glifo de um caractere (para o painel de glifos mostrar os do PUA). */
export function glifoDoChar(f: FonteHB, cp: number): number | undefined {
  return f.font.glyph(cp) || undefined
}

/** Caminho SVG do glifo (para miniaturas): y para baixo, origem na linha de base. */
export function svgDoGlifo(f: FonteHB, gid: number): string {
  return f.contorno(gid).map(c => (c[0] === 'Z' ? 'Z' : c[0] + (c.slice(1) as number[]).map((v, i) => (i % 2 ? -v : v)).join(' '))).join('')
}
