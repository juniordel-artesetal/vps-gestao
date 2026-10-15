// Lote 6 (itens 90, 91, 94): PEÇAS POR MEDIDA — a base sem molde: cada peça é um retângulo, retângulo de cantos
// arredondados ou círculo/oval (com furo opcional), já com o contorno de corte e a face. A ESTRUTURA divide a peça em
// pedaços (FUNDO, BASE, FAIXA…) — cada pedaço é uma PARTE, que recebe papel no tema, e vale para todas as medidas
// da base, proporcional. Divisória com corte reto ou transição suave (a face de cima/direita some em degradê sobre
// a outra). Puro (testável no Node).
import { intersectD, FillRule, type PathsD } from 'clipper2-ts'
import type { DocTrabalho } from '../schema'
import { distBorda, type Pt } from '../faces/geometria'
import type { FormaMedida } from './catalogo'

type Doc = DocTrabalho
type Molde = Doc['molds'][number]
type Face = Molde['faces'][number]

/** Lote 14 (item 189.5): a forma de DENTRO da peça (onde vai a arte e o nome). */
export interface Miolo { forma: 'mesma' | FormaMedida; margemMm?: number; x?: number; y?: number; w?: number; h?: number; raioMm?: number }
export interface Medida { forma: FormaMedida; larguraMm: number; alturaMm: number; raioMm?: number; furo?: { x: number; y: number; diametroMm: number } | null; catalogoId?: string; miolo?: Miolo | null
  /** Lote 16 (item 207): estrutura só desta peça (sem ela, a da base). */
  estrutura?: Estrutura | null }

const r2 = (v: number) => Math.round(v * 100) / 100
const gid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`

/** Contorno da peça (mm, origem no canto de cima/esquerda). */
export function contornoDaMedida(m: Medida): Pt[] {
  const w = m.larguraMm, h = m.alturaMm
  if (m.forma === 'circulo') {
    const n = 72, rx = w / 2, ry = h / 2
    return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [r2(rx + rx * Math.cos(a)), r2(ry + ry * Math.sin(a))] as Pt })
  }
  const r = m.forma === 'arredondado' ? Math.max(0, Math.min(m.raioMm ?? 3, w / 2, h / 2)) : 0
  if (!r) return [[0, 0], [w, 0], [w, h], [0, h]]
  const pts: Pt[] = [], seg = 10
  const canto = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * (Math.PI / 2); pts.push([r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))]) } }
  canto(w - r, r, -Math.PI / 2); canto(w - r, h - r, 0); canto(r, h - r, Math.PI / 2); canto(r, r, Math.PI)
  return pts
}

export function furoDaMedida(m: Medida): Pt[] | null {
  if (!m.furo || !(m.furo.diametroMm > 0)) return null
  const cx = m.furo.x * m.larguraMm, cy = m.furo.y * m.alturaMm, r = m.furo.diametroMm / 2, n = 32
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))] as Pt })
}

const arestasCorte = (n: number) => Array.from({ length: n }, (_, i) => ({ from: i, to: (i + 1) % n, kind: 'cut' as const }))
const arestasArte = (n: number) => Array.from({ length: n }, (_, i) => ({ from: i, to: (i + 1) % n, kind: 'fold' as const }))

/**
 * Lote 14 (item 189.5): o MIOLO da peça (mm da peça) — no formato da peça com uma margem, ou outra forma (círculo,
 * retângulo…) em fração da peça (centro x,y e tamanho w,h). É ARTE, nunca linha de corte (o corte é o da peça).
 */
export function mioloDaMedida(m: Medida): Pt[] | null {
  const mi = m.miolo
  if (!mi) return null
  if (mi.forma === 'mesma') {
    const mg = Math.max(0, mi.margemMm ?? 3), w = m.larguraMm - 2 * mg, h = m.alturaMm - 2 * mg
    if (w < 1 || h < 1) return null
    return contornoDaMedida({ ...m, larguraMm: w, alturaMm: h, raioMm: m.raioMm !== undefined ? Math.max(0, m.raioMm - mg) : undefined, furo: null, miolo: null }).map(([x, y]) => [r2(x + mg), r2(y + mg)] as Pt)
  }
  const w = (mi.w ?? 0.7) * m.larguraMm, h = (mi.h ?? 0.7) * m.alturaMm
  const cx = (mi.x ?? 0.5) * m.larguraMm, cy = (mi.y ?? 0.5) * m.alturaMm
  if (w < 1 || h < 1) return null
  return contornoDaMedida({ forma: mi.forma, larguraMm: w, alturaMm: h, raioMm: mi.raioMm }).map(([x, y]) => [r2(x + cx - w / 2), r2(y + cy - h / 2)] as Pt)
}

/** Faces "inteiras" (sem estrutura): a peça + o furo. */
export function facesDaMedida(moldeId: string, m: Medida): Face[] {
  const c = contornoDaMedida(m), f = furoDaMedida(m), mi = mioloDaMedida(m)
  return [{ id: `f_${moldeId}_peca`, polygonMm: c, edges: arestasCorte(c.length) },
    ...(mi ? [{ id: `f_${moldeId}_miolo`, polygonMm: mi, edges: arestasArte(mi.length) }] : []),
    ...(f ? [{ id: `f_${moldeId}_furo`, polygonMm: f, hole: true, edges: arestasCorte(f.length) }] : [])]
}

/** Uma peça por medida (molde sem arquivo). */
export function novaPeca(nome: string, m: Medida, artboardId: string, pos: { xMm: number; yMm: number } = { xMm: 10, yMm: 10 }): Molde {
  const id = gid('pm')
  return {
    id, name: nome.slice(0, 120) || 'Peça', artboardId,
    source: { path: `Bases/medidas/${id}.medida`, sha256: '0'.repeat(64), widthMm: r2(m.larguraMm), heightMm: r2(m.alturaMm), kind: 'medida' },
    medida: { ...m, larguraMm: r2(m.larguraMm), alturaMm: r2(m.alturaMm) },
    transform: { xMm: pos.xMm, yMm: pos.yMm, rotationDeg: 0 },
    faces: facesDaMedida(id, m),
  } as Molde
}

/** Muda a medida/forma de uma peça (mantém o resto). As faces voltam a ser a peça inteira (a estrutura reaplica). */
export function mudarMedida(peca: Molde, m: Partial<Medida>): void {
  const nova = { ...(peca as Molde & { medida: Medida }).medida, ...m } as Medida
  ;(peca as Molde & { medida: Medida }).medida = nova
  peca.source = { ...peca.source, widthMm: r2(nova.larguraMm), heightMm: r2(nova.alturaMm) }
  peca.faces = facesDaMedida(peca.id, nova)
}

export const ehPecaPorMedida = (m: Pick<Molde, 'source'>) => m.source.kind === 'medida'
export const medidaDe = (m: Molde): Medida | null => ((m as Molde & { medida?: Medida }).medida ?? null)

// ── ESTRUTURA (item 91) ──────────────────────────────────────────────────────────────────────────

export interface Divisoria {
  id: string
  /** h = linha atravessando na horizontal (separa cima × baixo); v = vertical (esquerda × direita). */
  eixo: 'h' | 'v'
  /** Posição (fração da altura ou largura da peça). */
  pos: number
  /** Inclinação da linha (graus). */
  inclinacaoDeg?: number
  /** Corte reto entre os pedaços, ou transição suave (a de baixo/direita some em degradê sobre a outra). */
  tipo: 'reto' | 'suave'
  /** Tamanho da transição suave (mm). */
  suaveMm?: number
  /** > 0 = a divisória é uma FAIXA (pedaço próprio) com esta espessura (mm). */
  faixaMm?: number
}
export interface Estrutura { id: string; nome: string; divisorias: Divisoria[]; nomes?: string[] }

export const ESTRUTURAS_PRONTAS: Estrutura[] = [
  { id: 'inteiro', nome: 'Fundo inteiro', divisorias: [], nomes: ['FUNDO'] },
  { id: 'fundo-base-faixa', nome: 'Fundo + base + faixa', divisorias: [{ id: 'd1', eixo: 'h', pos: 0.7, tipo: 'reto', faixaMm: 2.5 }], nomes: ['FUNDO', 'FAIXA', 'BASE'] },
  { id: 'laterais-suave', nome: 'Lateral esquerda + direita (transição suave)', divisorias: [{ id: 'd1', eixo: 'v', pos: 0.4, tipo: 'suave', suaveMm: 8 }], nomes: ['LATERAL ESQ', 'LATERAL DIR'] },
]

interface Pedaco { chave: string; nome: string; poligono: Pt[]; fade?: { x0: number; y0: number; x1: number; y1: number } }

/** Corta o retângulo [0,W]×[0,H] em faixas pelas divisórias de UM eixo (com inclinação) — polígonos em mm. */
function cortarFaixas(W: number, H: number, divs: Divisoria[], eixo: 'h' | 'v'): { poligono: Pt[]; faixa: boolean; fade?: Pedaco['fade'] }[] {
  const L = eixo === 'h' ? W : H, T = eixo === 'h' ? H : W
  // cada divisória: deslocamento ao longo de T no começo e no fim do eixo L (inclinação)
  type Linha = { a: number; b: number }
  const linha = (d: Divisoria, extra: number): Linha => {
    const meio = d.pos * T + extra, k = Math.tan(((d.inclinacaoDeg ?? 0) * Math.PI) / 180) * (L / 2)
    return { a: meio - k, b: meio + k }
  }
  const ordenadas = [...divs].sort((x, y) => x.pos - y.pos)
  type Seg = { ini: Linha; fim: Linha; faixa: boolean; fade?: Pedaco['fade'] }
  const segs: Seg[] = []
  let ini: Linha = { a: -1, b: -1 }
  let fadeProx: Pedaco['fade'] | undefined
  for (const d of ordenadas) {
    const meia = (d.faixaMm ?? 0) / 2, s = d.tipo === 'suave' ? Math.max(0.5, (d.suaveMm ?? 6) / 2) : 0
    if (meia > 0) {
      segs.push({ ini, fim: linha(d, -meia), faixa: false, fade: fadeProx }); fadeProx = undefined
      segs.push({ ini: linha(d, -meia), fim: linha(d, meia), faixa: true })
      ini = linha(d, meia)
      continue
    }
    // reto: os dois encostam na linha; suave: o de antes passa da linha e o de depois começa antes dela (sobrepõem
    // 2·s) e o de depois some em degradê sobre o de antes (alfa 0 → 1 ao longo da sobreposição)
    segs.push({ ini, fim: linha(d, s), faixa: false, fade: fadeProx })
    const meio = d.pos * T
    fadeProx = s ? (eixo === 'h' ? { x0: W / 2, y0: meio - s, x1: W / 2, y1: meio + s } : { x0: meio - s, y0: H / 2, x1: meio + s, y1: H / 2 }) : undefined
    ini = linha(d, -s)
  }
  segs.push({ ini, fim: { a: T + 1, b: T + 1 }, faixa: false, fade: fadeProx })
  return segs.map(c => ({
    poligono: (eixo === 'h'
      ? [[0, c.ini.a], [W, c.ini.b], [W, c.fim.b], [0, c.fim.a]]
      : [[c.ini.a, 0], [c.fim.a, 0], [c.fim.b, H], [c.ini.b, H]]) as Pt[],
    faixa: c.faixa, ...(c.fade ? { fade: c.fade } : {}),
  }))
}

/** Os pedaços da estrutura numa peça (mm), já recortados no contorno dela. */
export function pedacosDaPeca(m: Medida, e: Estrutura): Pedaco[] {
  const W = m.larguraMm, H = m.alturaMm, contorno = contornoDaMedida(m)
  const hs = e.divisorias.filter(d => d.eixo === 'h'), vs = e.divisorias.filter(d => d.eixo === 'v')
  const linhas = cortarFaixas(W, H, hs, 'h'), colunas = vs.length ? cortarFaixas(W, H, vs, 'v') : null
  const D = (p: Pt[]) => p.map(([x, y]) => ({ x, y }))
  const cortar = (p: Pt[]): Pt[] | null => {
    const r = intersectD([D(contorno)], [D(p)], FillRule.NonZero) as PathsD
    const maior = r.sort((a, b) => Math.abs(areaD(b)) - Math.abs(areaD(a)))[0]
    return maior && Math.abs(areaD(maior)) > 0.5 ? maior.map(q => [r2(q.x), r2(q.y)] as Pt) : null
  }
  const nomes = e.nomes ?? []
  const out: Pedaco[] = []
  let n = 0
  linhas.forEach((li, i) => {
    const celulas = colunas ? colunas.map((co, j) => ({ chave: `${i}_${j}`, poli: intersecao(li.poligono, co.poligono), fade: li.fade ?? co.fade, faixa: li.faixa || co.faixa })) : [{ chave: `${i}`, poli: li.poligono, fade: li.fade, faixa: li.faixa }]
    for (const c of celulas) {
      const p = c.poli ? cortar(c.poli) : null
      const nome = nomes[n] ?? (c.faixa ? 'FAIXA' : `PEDAÇO ${n + 1}`)
      n++
      if (p) out.push({ chave: c.chave, nome, poligono: p, ...(c.fade ? { fade: c.fade } : {}) })
    }
  })
  return out
}
function areaD(p: { x: number; y: number }[]) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j].x * p[i].y - p[i].x * p[j].y; return s / 2 }
function intersecao(a: Pt[], b: Pt[]): Pt[] | null {
  const r = intersectD([a.map(([x, y]) => ({ x, y }))], [b.map(([x, y]) => ({ x, y }))], FillRule.NonZero) as PathsD
  return r[0] ? r[0].map(q => [q.x, q.y] as Pt) : null
}

/** Lote 16 (item 207): a estrutura que vale numa peça — a dela, ou a da base. */
export function estruturaDaPeca(d: Pick<Doc, 'molds'> & { estrutura?: Estrutura }, pecaId: string | null): Estrutura {
  const p = pecaId ? d.molds.find(m => m.id === pecaId) : null
  return (p && medidaDe(p)?.estrutura) || d.estrutura || ESTRUTURAS_PRONTAS[0]
}

/**
 * Aplica a ESTRUTURA às peças por medida da base: as faces de cada peça viram os pedaços (furo mantido) e cada
 * pedaço vira uma PARTE (mesmo nome em todas as medidas: arrastar um papel para FUNDO vai para todas).
 * Lote 16 (item 207) — o DESTINO:
 *   • `peca` = só nessa peça (fica na medida dela: o corpo com faixa, a tampa com fundo + miolo);
 *   • sem `peca` = TODAS as peças (a base guarda; as estruturas próprias das peças saem), ou, com `manter`, só
 *     reaplica (mudou a medida) respeitando a estrutura própria de cada peça.
 */
export function aplicarEstrutura(d: Doc, e: Estrutura, o: { peca?: string | null; manter?: boolean } = {}): void {
  const pecas = d.molds.filter(ehPecaPorMedida)
  const copia = () => JSON.parse(JSON.stringify(e)) as Estrutura
  if (o.peca) { const alvo = pecas.find(p => p.id === o.peca); const med = alvo && medidaDe(alvo); if (med) med.estrutura = copia() }
  else if (!o.manter) for (const p of pecas) { const med = medidaDe(p); if (med?.estrutura) delete med.estrutura }
  const daBase = o.peca || o.manter ? ((d as Doc & { estrutura?: Estrutura }).estrutura ?? (o.peca ? ESTRUTURAS_PRONTAS[0] : e)) : e
  type Inst = { faceId: string; fit: { mode: 'cover'; scale: number; offsetX: number; offsetY: number; rotationDeg: number } }
  // Lote 17 (item 209): uma parte por PEÇA ("Corpo · FUNDO") — ou, com `partesCompartilhadas`, por nome (todas)
  // uma peça só (as tags do Lote 14): os nomes de sempre (FUNDO, MIOLO)
  const compartilhar = !!(d as Doc & { partesCompartilhadas?: boolean }).partesCompartilhadas || pecas.length < 2
  const grupos: { chave: string; nome: string; nomeBase: string; molde: string | null; inst: Inst[] }[] = []
  const juntar = (p: Molde, nomeBase: string, inst: Inst) => {
    const chave = compartilhar ? nomeBase : `${p.id}|${nomeBase}`
    let g = grupos.find(x => x.chave === chave)
    if (!g) { g = { chave, nome: compartilhar ? nomeBase : `${nomeCurtoPeca(p.name)} · ${nomeBase}`.slice(0, 60), nomeBase, molde: compartilhar ? null : p.id, inst: [] }; grupos.push(g) }
    g.inst.push(inst)
  }
  const fadeDe = new Map<string, Pedaco['fade']>()
  for (const p of pecas) {
    const med = medidaDe(p); if (!med) continue
    const pedacos = pedacosDaPeca(med, med.estrutura ?? daBase)
    const furo = furoDaMedida(med)
    // corte = o que encosta no contorno da peça; o resto (as divisórias) é divisão da arte, não linha de corte
    const cont = contornoDaMedida(med)
    const arestas = (pol: Pt[]) => pol.map((a, i) => { const b = pol[(i + 1) % pol.length]; return { from: i, to: (i + 1) % pol.length, kind: (distBorda([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cont) < 0.3 ? 'cut' : 'fold') as 'cut' | 'fold' } })
    const miolo = mioloDaMedida(med)
    p.faces = [
      ...pedacos.map(pd => ({ id: `f_${p.id}_${pd.chave}`, polygonMm: pd.poligono, edges: arestas(pd.poligono) })),
      // Lote 14 (item 189.5): o MIOLO por cima do fundo (desenhado depois) — a parte MIOLO recebe a arte e o nome
      ...(miolo ? [{ id: `f_${p.id}_miolo`, polygonMm: miolo, edges: arestasArte(miolo.length) }] : []),
      ...(furo ? [{ id: `f_${p.id}_furo`, polygonMm: furo, hole: true, edges: arestasCorte(furo.length) }] : []),
    ] as Face[]
    const fit = () => ({ mode: 'cover' as const, scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 })
    for (const pd of pedacos) {
      juntar(p, pd.nome, { faceId: `f_${p.id}_${pd.chave}`, fit: fit() })
      if (pd.fade) fadeDe.set(`f_${p.id}_${pd.chave}`, pd.fade)
    }
    if (miolo) juntar(p, 'MIOLO', { faceId: `f_${p.id}_miolo`, fit: fit() })
  }
  for (const f of pecas.flatMap(p => p.faces)) { const fd = fadeDe.get(f.id); if (fd) (f as Face & { fade?: unknown }).fade = fd }
  // partes: as da estrutura — mantém o id de uma parte com o mesmo nome (o tema continua valendo). Lote 17 (item 209):
  // a parte ANTIGA de todas as peças ("FUNDO") fica com a 1ª peça; as outras ganham `<id>__<peça>` (determinístico:
  // a mesma base dividida de novo dá os mesmos ids) e o mapa fica em `partesDivididas` (o tema copia o conteúdo)
  const faceIdsPecas = new Set(pecas.flatMap(p => p.faces.map(f => f.id)))
  const antigas = d.parts
  const usados = new Set<string>()
  const divididas = ((d as Doc & { partesDivididas?: Record<string, Record<string, string>> }).partesDivididas ??= {})
  const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)
  const novas = grupos.map(g => {
    let ja = antigas.find(pt => pt.name === g.nome && !usados.has(pt.id))
    let id = ja?.id
    if (!ja && g.molde) {
      // a parte antiga de TODAS as peças com este nome
      const velha = antigas.find(pt => pt.name === g.nomeBase)
      if (velha) {
        ja = velha
        id = usados.has(velha.id) ? `${velha.id}__${slug(g.molde)}` : velha.id
        ;(divididas[velha.id] ??= {})[g.molde] = id
      }
    }
    if (!ja && !g.molde) ja = antigas.find(pt => pt.name.endsWith(` · ${g.nomeBase}`) && !usados.has(pt.id))   // voltou a compartilhar
    if (!id) {
      id = ja?.id ?? `p_${g.molde ? `${slug(nomeCurtoPeca(pecas.find(p => p.id === g.molde)!.name))}_` : ''}${slug(g.nomeBase)}`
      let n = 2
      while (usados.has(id!) || antigas.some(pt => pt.id === id && pt !== ja)) id = `${id!.replace(/_\d+$/, '')}_${n++}`
    }
    usados.add(id!)
    return { ...(ja ? { referenceAspect: ja.referenceAspect } : {}), id: id!, name: g.nome, instances: g.inst }
  })
  d.parts = [
    ...antigas.filter(pt => !pt.instances.some(i => i.faceId.startsWith('f_pm_') || faceIdsPecas.has(i.faceId)) && !usados.has(pt.id) && !grupos.some(g => g.nome === pt.name)),
    ...novas,
  ] as Doc['parts']
  for (const [k, v] of Object.entries(divididas)) if (Object.values(v).every(x => x === k)) delete divididas[k]   // não dividiu de verdade
  if (!Object.keys(divididas).length) delete (d as Doc & { partesDivididas?: unknown }).partesDivididas
  // posições de texto que estavam em faces que sumiram: vão para o pedaço de cima (o 1º) da mesma peça
  for (const s of d.textSlots) {
    if (pecas.some(p => p.faces.some(f => f.id === s.faceId))) continue
    const p = pecas.find(pp => s.faceId.startsWith(`f_${pp.id}_`))
    if (p) s.faceId = p.faces.find(f => !f.hole)?.id ?? s.faceId
  }
  if (!o.peca && !o.manter) (d as Doc & { estrutura?: Estrutura }).estrutura = copia()
  else if (!(d as Doc & { estrutura?: Estrutura }).estrutura) (d as Doc & { estrutura?: Estrutura }).estrutura = JSON.parse(JSON.stringify(daBase))
}

/** Lote 17 (item 209): o nome curto da peça ("Nutella · Corpo" → "Corpo"). */
export const nomeCurtoPeca = (n: string) => n.split('·').pop()!.trim() || n

/**
 * Lote 17 (item 209): base de peças ANTIGA (uma parte valendo para várias peças, sem "usar o mesmo papel em todas")
 * → divide (cada peça com as suas partes). Determinístico: abrir de novo dá o mesmo resultado. Devolve se mudou.
 */
export function garantirPartesPorPeca(d: Doc): boolean {
  if ((d as Doc & { tipo?: string }).tipo !== 'medida' || (d as Doc & { partesCompartilhadas?: boolean }).partesCompartilhadas) return false
  const pecas = d.molds.filter(ehPecaPorMedida)
  if (pecas.length < 2) return false
  const pecaDaFace = (fid: string) => pecas.find(p => fid.startsWith(`f_${p.id}_`))?.id
  const misturada = d.parts.some(pt => new Set(pt.instances.map(i => pecaDaFace(i.faceId)).filter(Boolean)).size > 1)
  if (!misturada) return false
  aplicarEstrutura(d, (d as Doc & { estrutura?: Estrutura }).estrutura ?? ESTRUTURAS_PRONTAS[0], { manter: true })
  return true
}

/** Base nova de PEÇAS POR MEDIDA a partir das medidas marcadas: uma parte FUNDO para todas, sobra pequena (2 mm). */
export function montarBaseDeMedidas(d: Doc, itens: { nome: string; medida: Medida }[]): void {
  const ab = d.artboards[0]
  let x = 10, y = 10, linhaH = 0
  for (const it of itens) {
    const w = it.medida.larguraMm, h = it.medida.alturaMm
    if (x + w > ab.widthMm - 10) { x = 10; y += linhaH + 8; linhaH = 0 }
    d.molds.push(novaPeca(it.nome, it.medida, ab.id, { xMm: x, yMm: y }))
    x += w + 8; linhaH = Math.max(linhaH, h)
  }
  ;(d as Doc & { tipo?: string }).tipo = 'medida'
  d.smartArt = { ...(d.smartArt ?? {}), overflowMm: 2 }
  aplicarEstrutura(d, ESTRUTURAS_PRONTAS[0])
}

// ── COMPOSIÇÃO POR UNIDADE (item 94) ─────────────────────────────────────────────────────────────

export interface ItemComposicao { moldeId: string; qtd: number }

/**
 * Quantas UNIDADES do produto cabem numa folha (gabarito): para cada peça da composição, as vagas daquele molde
 * ÷ a quantidade por unidade — o menor. Nunca sai uma frente sem a sua tampa.
 */
export function unidadesPorFolha(vagas: { moldeId: string }[], comp: ItemComposicao[]): number {
  if (!comp.length) return vagas.length
  return Math.min(...comp.map(c => Math.floor(vagas.filter(v => v.moldeId === c.moldeId).length / Math.max(1, c.qtd))))
}

/**
 * Leva unidades (já distribuídas por folha: o pedido de cada unidade) às VAGAS do gabarito: a j-ésima unidade da
 * folha ocupa, de cada peça da composição, as vagas j·qtd … j·qtd+qtd−1 daquele molde (na ordem de leitura).
 * Devolve, por vaga (índice no gabarito), o pedido dela — ou -1 (vaga vazia).
 */
export function vagasDasUnidades(vagasOrdem: { indice: number; moldeId: string }[], comp: ItemComposicao[], unidades: number[]): number[] {
  const out = new Array<number>(Math.max(0, ...vagasOrdem.map(v => v.indice + 1))).fill(-1)
  if (!comp.length) { vagasOrdem.forEach((v, j) => { if (j < unidades.length) out[v.indice] = unidades[j] }); return out }
  for (const c of comp) {
    const doMolde = vagasOrdem.filter(v => v.moldeId === c.moldeId)
    unidades.forEach((pedido, j) => { for (let k = 0; k < c.qtd; k++) { const v = doMolde[j * c.qtd + k]; if (v) out[v.indice] = pedido } })
  }
  return out
}

// ── ADAPTAR PARA AS OUTRAS MEDIDAS (item 92) ─────────────────────────────────────────────────────

type Tema = import('../schema').DocTema
type Q = { w: number; h: number }
/**
 * "Adaptar para as outras medidas": cada camada de elemento/forma das partes das peças por medida passa a ser PRESA
 * (lado detectado pela posição: esquerda/centro/direita × topo/meio/base) com a referência na MAIOR medida da parte
 * (onde a arte foi montada). Nas outras medidas, a arte é recomposta (tamanho pela altura, encostada no mesmo lado).
 * Camada que já tem `presa` (escolhida pela usuária) fica como está. Devolve quantas camadas foram adaptadas.
 */
export function adaptarParaMedidas(d: Doc, t: Tema, quadro: (faceId: string) => Q | null): number {
  const facesMedida = new Set(d.molds.filter(ehPecaPorMedida).flatMap(m => m.faces.map(f => f.id)))
  let n = 0
  for (const parte of d.parts) {
    const insts = parte.instances.filter(i => facesMedida.has(i.faceId))
    if (insts.length < 1) continue
    const qs = insts.map(i => quadro(i.faceId)).filter(Boolean) as Q[]
    if (!qs.length) continue
    const ref = qs.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
    for (const c of t.partContent[parte.id] ?? []) {
      if ((c.anchor ?? 'face') === 'paper' || (c.type !== 'image' && c.type !== 'shape') || (c as { presa?: unknown }).presa) continue
      const x = c.transform?.x ?? 0.5, y = c.transform?.y ?? 0.5
      ;(c as { presa?: unknown }).presa = { h: x < 0.38 ? 'esq' : x > 0.62 ? 'dir' : 'centro', v: y < 0.38 ? 'topo' : y > 0.62 ? 'base' : 'meio', refW: Math.round(ref.w * 100) / 100, refH: Math.round(ref.h * 100) / 100 }
      n++
    }
  }
  return n
}
