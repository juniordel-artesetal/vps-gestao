// Lote 5 (item 76): FOLHA DE IMPRESSÃO MONTADA — várias peças pequenas (rótulos, adesivos, etiquetas) numa folha.
// A PEÇA é um molde da base como outro qualquer (partes, papéis, NOME/IDADE…); a FOLHA é um modelo criado uma vez
// na Base: tamanho, marca de registro (a área dela fica livre) e onde vai cada peça (com giro de 90°).
// Na hora de gerar, a folha vira uma prancheta VIRTUAL com uma cópia de cada peça no lugar dela — a mesma
// exportação de sempre (sobra/arte inteligente de cada peça, linhas, marca, PDF e o SVG/DXF de corte).
// Puro: muda o documento recebido (draft do histórico).
import { organizar, type Ret } from '../apliques/empacotar'
import { tamanhoLocal, caixaDaPeca, cantoDaPeca } from './giroMolde'
import type { DocTema, DocTrabalho, FolhaMontada } from '../schema'

type Doc = DocTrabalho
export type Folha = FolhaMontada
export type PecaNaFolha = Folha['pecas'][number]

const gid = () => 'fm_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
export const folhasDa = (d: Pick<Doc, 'folhas'>): Folha[] => d.folhas ?? []

export function criarFolha(d: Doc, p: { nome: string; widthMm: number; heightMm: number; registrationPresetId?: string; registrationPresetSha?: string }): string {
  const id = gid()
  ;(d.folhas ??= []).push({ id, nome: p.nome.trim().slice(0, 80) || 'Folha', widthMm: p.widthMm, heightMm: p.heightMm, espacoMm: 2, margemMm: 5, pecas: [],
    ...(p.registrationPresetId ? { registrationPresetId: p.registrationPresetId } : {}), ...(p.registrationPresetSha ? { registrationPresetSha: p.registrationPresetSha } : {}) })
  return id
}
export function excluirFolha(d: Doc, id: string): void {
  d.folhas = folhasDa(d).filter(f => f.id !== id)
  for (const g of d.grupos ?? []) if (g.folhaId === id) delete g.folhaId
  if (!d.folhas.length) delete d.folhas
}

/** Tamanho da peça na folha (90° troca largura e altura). Lote 6 (item 89): pela medida da PEÇA (sem a margem). */
export function tamanhoPeca(m: Pick<Doc['molds'][number], 'source'> & Partial<Pick<Doc['molds'][number], 'faces' | 'medida'>>, rot: 0 | 90): { w: number; h: number } {
  // Lote 14 (item 188): peça por medida = a MEDIDA dela (nunca o tamanho do arquivo, que leva a margem)
  const { w, h } = m.medida ? { w: m.medida.larguraMm, h: m.medida.alturaMm } : m.faces?.length ? caixaDaPeca(m as never) : tamanhoLocal(m)
  return rot === 90 ? { w: h, h: w } : { w, h }
}

/**
 * Organiza a lista de peças pedidas (molde × quantidade) na folha, com o espaço e a margem dela, fora das zonas
 * da marca. Cada tipo de peça testa em pé e deitada (a que couber mais). `quantidade` ausente = o máximo que cabe.
 * Devolve as peças colocadas e quantas ficaram de fora.
 */
export function organizarFolha(f: Pick<Folha, 'widthMm' | 'heightMm' | 'espacoMm' | 'margemMm'>, pedidas: { moldeId: string; quantidade?: number }[], moldes: Doc['molds'], obstaculos: Ret[] = []): { pecas: PecaNaFolha[]; ficaram: number } {
  const tipos = pedidas.map(p => ({ ...p, m: moldes.find(m => m.id === p.moldeId) })).filter(p => p.m)
  const tentar = (rots: (0 | 90)[]) => {
    const lista: { id: string; w: number; h: number }[] = []
    tipos.forEach((t, k) => {
      const { w, h } = tamanhoPeca(t.m!, rots[k])
      const n = t.quantidade ?? Math.ceil(((f.widthMm * f.heightMm) / Math.max(1, w * h)) + 1)
      for (let i = 0; i < n; i++) lista.push({ id: `${k}:${i}`, w, h })
    })
    const r = organizar(lista, f.widthMm, f.heightMm, { espacoMm: f.espacoMm, margemMm: f.margemMm, obstaculos })
    return { r, rots }
  }
  // escolhe, tipo a tipo, a orientação que coloca mais peças (poucos tipos: testa as combinações)
  const combos: (0 | 90)[][] = []
  const n = Math.min(tipos.length, 4)
  for (let mask = 0; mask < 1 << n; mask++) combos.push(tipos.map((_, k) => (k < n && (mask >> k) & 1 ? 90 : 0)))
  let melhor = tentar(combos[0])
  for (const c of combos.slice(1)) { const x = tentar(c); if (x.r.colocadas.length > melhor.r.colocadas.length) melhor = x }
  let pecas: PecaNaFolha[] = melhor.r.colocadas.map(c => { const k = Number(c.id.split(':')[0]); return { moldeId: tipos[k].moldeId, xMm: round(c.x), yMm: round(c.y), rot: melhor.rots[k] } })
  // Lote 14 (item 188): um tipo de peça → a GRADE (que se desloca para fugir da marca) quando põe mais
  if (tipos.length === 1) {
    const g = gradeFolha(f, tipos[0].moldeId, moldes, obstaculos)
    const alvo = tipos[0].quantidade ?? Infinity
    if (Math.min(g.length, alvo) > Math.min(pecas.length, alvo) || (g.length >= alvo && pecas.length >= alvo)) pecas = g.slice(0, Number.isFinite(alvo) ? alvo : g.length)
  }
  const pedidasTotal = tipos.reduce((s, t) => s + (t.quantidade ?? 0), 0)
  return { pecas, ficaram: tipos.every(t => t.quantidade !== undefined) ? Math.max(0, pedidasTotal - pecas.length) : 0 }
}
const round = (v: number) => Math.round(v * 100) / 100

// ── Lote 6 (item 95): GABARITO FIXO ──────────────────────────────────────────────────────────────

const toca = (a: Ret, b: Ret) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
/**
 * Encaixe EM GRADE (linhas e colunas iguais, como o gabarito da plotter): testa a peça em pé e deitada e devolve a
 * que couber mais. As vagas que caem na área da marca ficam de fora.
 */
export function gradeFolha(f: Pick<Folha, 'widthMm' | 'heightMm' | 'espacoMm' | 'margemMm'>, moldeId: string, moldes: Doc['molds'], obstaculos: Ret[] = []): PecaNaFolha[] {
  const m = moldes.find(x => x.id === moldeId); if (!m) return []
  let melhor: PecaNaFolha[] = []
  for (const rot of [0, 90] as const) {
    const { w, h } = tamanhoPeca(m, rot), e = f.espacoMm, mg = f.margemMm
    const cols = Math.floor((f.widthMm - 2 * mg + e) / (w + e)), lins = Math.floor((f.heightMm - 2 * mg + e) / (h + e))
    if (cols < 1 || lins < 1) continue
    // centraliza a grade na folha (sobra igual dos dois lados); Lote 14 (item 188): com marca, testa a grade
    // deslocada dentro da folga (e com menos uma linha/coluna espalhada) — a que deixa mais vagas livres da marca
    const gw = cols * w + (cols - 1) * e, gh = lins * h + (lins - 1) * e
    const cx = (f.widthMm - gw) / 2, cy = (f.heightMm - gh) / 2
    const folgaX = Math.max(0, (f.widthMm - 2 * mg - gw) / 2), folgaY = Math.max(0, (f.heightMm - 2 * mg - gh) / 2)
    const passos = (fo: number) => (fo > 0.01 ? [0, -fo, fo, -fo / 2, fo / 2] : [0])
    for (const dx of obstaculos.length ? passos(folgaX) : [0]) for (const dy of obstaculos.length ? passos(folgaY) : [0]) {
      const out: PecaNaFolha[] = []
      for (let r = 0; r < lins; r++) for (let c = 0; c < cols; c++) {
        const v = { x: cx + dx + c * (w + e), y: cy + dy + r * (h + e), w, h }
        if (obstaculos.some(o => toca(v, o))) continue
        out.push({ moldeId, xMm: round(v.x), yMm: round(v.y), rot })
      }
      if (out.length > melhor.length) melhor = out
    }
  }
  return melhor
}

/**
 * Sugestão para criar o gabarito: retrato × paisagem e grade × intercalado (empacotado) — o que couber mais.
 * `zonasPara(w, h)` = áreas da marca de registro na folha daquele tamanho. Devolve as contagens ("paisagem: 24 ·
 * retrato: 22") e a melhor.
 */
export function sugerirGabarito(f: Pick<Folha, 'widthMm' | 'heightMm' | 'espacoMm' | 'margemMm'>, moldeId: string, moldes: Doc['molds'], zonasPara: (w: number, h: number) => Ret[]): {
  opcoes: { orientacao: 'retrato' | 'paisagem'; modo: 'grade' | 'intercalado'; pecas: PecaNaFolha[]; widthMm: number; heightMm: number }[]
  melhor: { orientacao: 'retrato' | 'paisagem'; modo: 'grade' | 'intercalado'; pecas: PecaNaFolha[]; widthMm: number; heightMm: number }
} {
  const menor = Math.min(f.widthMm, f.heightMm), maior = Math.max(f.widthMm, f.heightMm)
  const opcoes = (['retrato', 'paisagem'] as const).flatMap(orientacao => {
    const fo = { ...f, widthMm: orientacao === 'retrato' ? menor : maior, heightMm: orientacao === 'retrato' ? maior : menor }
    const z = zonasPara(fo.widthMm, fo.heightMm)
    return [
      { orientacao, modo: 'grade' as const, pecas: gradeFolha(fo, moldeId, moldes, z), widthMm: fo.widthMm, heightMm: fo.heightMm },
      { orientacao, modo: 'intercalado' as const, pecas: organizarFolha(fo, [{ moldeId }], moldes, z).pecas, widthMm: fo.widthMm, heightMm: fo.heightMm },
    ]
  })
  // empate: a GRADE (igual ao gabarito da plotter, mais fácil de conferir)
  const melhor = opcoes.reduce((a, b) => (b.pecas.length > a.pecas.length || (b.pecas.length === a.pecas.length && b.modo === 'grade' && a.modo !== 'grade') ? b : a))
  return { opcoes, melhor }
}

/**
 * Lote 6 (item 95): GABARITO IMPORTADO DA PLOTTER (Silhouette, SVG/DXF/PDF): cada contorno fechado do arquivo de corte
 * vira uma VAGA na posição EXATA do arquivo, ligada à peça da base com a medida mais parecida (em pé ou deitada, até
 * 8% de diferença). Contornos que não batem com nenhuma peça (as marcas, textos) ficam de fora.
 */
export function vagasDoGabarito(contornos: { x: number; y: number; w: number; h: number }[], moldes: Doc['molds'], preferir?: Set<string>): { pecas: PecaNaFolha[]; ignorados: number } {
  const pecas: PecaNaFolha[] = []
  let ignorados = 0
  // Lote 14 (item 187): procura PRIMEIRO entre as peças preferidas (as do produto, as que têm parte no tema) — antes
  // pegava a de medida mais parecida da base inteira (às vezes um molde sem parte → a vaga saía sem arte)
  const grupos = preferir?.size ? [moldes.filter(m => preferir.has(m.id)), moldes] : [moldes]
  for (const c of contornos) {
    let achou: { m: Doc['molds'][number]; rot: 0 | 90; erro: number } | null = null
    for (const lista of grupos) { if (achou) break; for (const m of lista) for (const rot of [0, 90] as const) {
      const t = tamanhoPeca(m, rot)
      const erro = Math.max(Math.abs(t.w - c.w) / t.w, Math.abs(t.h - c.h) / t.h)
      if (erro <= 0.08 && (!achou || erro < achou.erro)) achou = { m, rot, erro }
    } }
    if (!achou) { ignorados++; continue }
    pecas.push({ moldeId: achou.m.id, xMm: round(c.x), yMm: round(c.y), rot: achou.rot })
  }
  // ordem de leitura (linha a linha) — é a ordem em que os pedidos ocupam as vagas
  pecas.sort((a, b) => (Math.abs(a.yMm - b.yMm) > 1 ? a.yMm - b.yMm : a.xMm - b.xMm))
  return { pecas, ignorados }
}

/**
 * Lote 6 (item 95): a SANGRIA de cada peça na folha nunca passa da METADE do espaço até a vizinha (corta no meio do
 * caminho) — antes a sobra das caixas (10 mm) com 3 mm de espaço invadia a vizinha e a marca de registro.
 */
export const sobraNaFolha = (base: Pick<Doc, 'smartArt'>, f: Pick<Folha, 'espacoMm'>) => Math.max(0, Math.min(base.smartArt?.overflowMm ?? 10, f.espacoMm / 2))

/** "38 peças · 87% da folha usada". */
export function aproveitamento(f: Pick<Folha, 'widthMm' | 'heightMm' | 'pecas'>, moldes: Doc['molds']): { pecas: number; pct: number } {
  const area = f.pecas.reduce((s, p) => { const m = moldes.find(x => x.id === p.moldeId); if (!m) return s; const t = tamanhoPeca(m, p.rot as 0 | 90); return s + t.w * t.h }, 0)
  return { pecas: f.pecas.length, pct: Math.round((area / Math.max(1, f.widthMm * f.heightMm)) * 100) }
}

/** Peças que se sobrepõem (aviso no ajuste manual). */
export function sobrepostas(f: Pick<Folha, 'pecas'>, moldes: Doc['molds']): number[] {
  const rs = f.pecas.map(p => { const m = moldes.find(x => x.id === p.moldeId); const t = m ? tamanhoPeca(m, p.rot as 0 | 90) : { w: 0, h: 0 }; return { x: p.xMm, y: p.yMm, w: t.w, h: t.h } })
  const out: number[] = []
  rs.forEach((a, i) => { if (rs.some((b, j) => j !== i && a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01)) out.push(i) })
  return out
}

/**
 * Lote 6 (itens 94/95): a distribuição por UNIDADE do produto (composição) → o pedido de cada vaga na ORDEM DE LEITURA
 * (o que o docDoLote recebe): -1 = vaga vazia. `porVaga` vem de vagasDasUnidades (índice no gabarito).
 */
export function lugaresDasVagas(f: Pick<Folha, 'pecas'>, porVaga: number[]): number[] {
  return ordemDeLeitura(f).map(i => porVaga[i] ?? -1)
}

/**
 * Copia uma peça (molde com faces, partes, textos e o que o tema tem por face) com o sufixo dado.
 * Lote 16 (item 206): `outro` = a cópia é de um pedido com OUTRO tema — as faces dela entram numa cópia da parte
 * (`<parte>~<chave>`) com a arte desse tema, e o que é por face/texto vem dele (cada rótulo com a sua arte).
 */
function copiarPeca(base: Doc, t: DocTema, m: Doc['molds'][number], p: PecaNaFolha, abId: string, suf: string, out: { molds: Doc['molds']; parts: Doc['parts']; textSlots: Doc['textSlots'] }, outro?: { tema: DocTema; chave: string }): string[] {
  const fid = (id: string) => `${id}~${suf}`
  const src = outro?.tema ?? t
  // a PEÇA (contorno) fica na posição da vaga — o molde inteiro (com a margem do arquivo) recua o canto dela
  const [ox, oy] = m.faces.length ? cantoDaPeca(m, p.rot as 0 | 90) : [0, 0]
  out.molds.push({ ...m, id: fid(m.id), artboardId: abId, transform: { xMm: Math.round((p.xMm - ox) * 100) / 100, yMm: Math.round((p.yMm - oy) * 100) / 100, rotationDeg: p.rot },
    faces: m.faces.map(fc => ({ ...fc, id: fid(fc.id) })) })
  for (const parte of base.parts) {
    const insts = parte.instances.filter(i => m.faces.some(fc => fc.id === i.faceId))
    if (!insts.length) continue
    let alvo = out.parts.find(x => x.id === parte.id)!
    if (outro) {
      const cid = `${parte.id}~${outro.chave}`
      alvo = out.parts.find(x => x.id === cid) ?? (out.parts.push({ ...parte, id: cid, instances: [] }), out.parts[out.parts.length - 1])
      if (!t.partContent[cid]) t.partContent[cid] = JSON.parse(JSON.stringify(outro.tema.partContent[parte.id] ?? []))
    }
    for (const inst of insts) alvo.instances.push({ ...inst, faceId: fid(inst.faceId) })
  }
  const slots: string[] = []
  for (const s of base.textSlots.filter(s => m.faces.some(fc => fc.id === s.faceId))) {
    out.textSlots.push({ ...s, id: fid(s.id), faceId: fid(s.faceId) })
    slots.push(s.id)
    if (src.textSlotAdjust?.[s.id]) (t.textSlotAdjust ??= {})[fid(s.id)] = src.textSlotAdjust[s.id]
  }
  for (const fc of m.faces) {
    if (src.faceContent?.[fc.id]) (t.faceContent ??= {})[fid(fc.id)] = src.faceContent[fc.id]
    if (src.localOverrides?.[fc.id]) (t.localOverrides ??= {})[fid(fc.id)] = src.localOverrides[fc.id]
  }
  return slots
}
const pranchetaDa = (f: Folha, id: string, nome: string) => ({ id, widthMm: f.widthMm, heightMm: f.heightMm, name: nome,
  ...(f.registrationPresetId ? { registrationPresetId: f.registrationPresetId } : {}), ...(f.registrationPresetSha ? { registrationPresetSha: f.registrationPresetSha } : {}) })

/**
 * A folha como PRANCHETA VIRTUAL para a exportação: uma cópia de cada peça (molde com faces, identidade e as
 * posições de texto, ids `…~k`) no lugar e giro dela, com a marca da folha. O tema ganha as mesmas cópias do que
 * é por face (conteúdo só da caixa, ajustes locais, ajuste do texto). As partes valem para todas as cópias.
 */
export function docDaFolha(base: Doc, tema: DocTema, f: Folha): { doc: Doc; tema: DocTema; artboardId: string } {
  const abId = `folha_${f.id}`
  const t: DocTema = JSON.parse(JSON.stringify(tema))
  const out = { molds: [] as Doc['molds'], textSlots: [] as Doc['textSlots'], parts: base.parts.map(p => ({ ...p, instances: [...p.instances] })) }
  f.pecas.forEach((p, k) => { const m = base.molds.find(x => x.id === p.moldeId); if (m) copiarPeca(base, t, m, p, abId, String(k), out) })
  return { doc: { ...base, smartArt: { ...(base.smartArt ?? {}), overflowMm: sobraNaFolha(base, f) }, artboards: [pranchetaDa(f, abId, f.nome)], ...out, grupos: undefined, folhas: undefined }, tema: t, artboardId: abId }
}

// ── Lote 5 (item 76): APROVEITAR FOLHAS — juntar pedidos na mesma folha ─────────────────────────────────

/** Os lugares da folha na ordem de leitura (linha a linha, de cima para baixo, da esquerda para a direita). */
export function ordemDeLeitura(f: Pick<Folha, 'pecas'>): number[] {
  return f.pecas.map((p, i) => ({ p, i })).sort((a, b) => (Math.abs(a.p.yMm - b.p.yMm) > 1 ? a.p.yMm - b.p.yMm : a.p.xMm - b.p.xMm)).map(x => x.i)
}

/**
 * Distribui os pedidos (cada um com `n` peças) nos lugares das folhas, em ordem: as peças de um pedido ficam
 * JUNTAS (nunca intercaladas). KIT nunca se divide entre folhas — se não cabe no que sobrou, vai para a próxima
 * (kit maior que a folha ocupa folhas só dele); AVULSO preenche os buracos e continua na folha seguinte.
 * `completar`: a última folha ganha cópias extras do último pedido. Devolve, por folha, o pedido de cada lugar.
 */
export function distribuirLote(capacidade: number, ns: number[], o: { tipo?: 'kit' | 'avulso'; completar?: boolean } = {}): number[][] {
  if (capacidade < 1) throw new Error('A folha não tem lugares de peça — monte a folha na Base (Preencher folha).')
  const folhas: number[][] = []
  let atual: number[] = []
  const fechar = () => { if (atual.length) folhas.push(atual); atual = [] }
  ns.forEach((n0, i) => {
    let n = Math.max(0, Math.round(n0))
    if (!n) return
    if ((o.tipo ?? 'kit') === 'kit' && atual.length + n > capacidade) fechar()
    while (n > 0) {
      if (atual.length === capacidade) fechar()
      const c = Math.min(n, capacidade - atual.length)
      for (let k = 0; k < c; k++) atual.push(i)
      n -= c
    }
  })
  if (o.completar && atual.length) { const ult = atual[atual.length - 1]; while (atual.length < capacidade) atual.push(ult) }
  fechar()
  return folhas
}

export interface PedidoNoLote { rotulo: string; valores: Record<string, string> }
export interface RotuloLote { xMm: number; yMm: number; texto: string; /** Lote 6 (item 95): na margem, de pé (lido de baixo para cima). */ vertical?: boolean }

/**
 * O LOTE como pranchetas virtuais (uma por folha): cada lugar recebe a peça do modelo com os valores do PEDIDO
 * dele (texto por posição — `valoresPorSlot`), e o identificador "#123 · Naty" fica FORA da linha de corte, em
 * cima da primeira peça do pedido na folha. `resumo` = a separação (Folha 1 → #123 Naty (6), #124 Davi (6)).
 */
export function docDoLote(base: Doc, tema: DocTema, f: Folha, distribuicao: number[][], pedidos: PedidoNoLote[]): {
  doc: Doc; tema: DocTema; artboardIds: string[]; valoresPorSlot: Record<string, Record<string, string>>; rotulos: Record<string, RotuloLote[]>; resumo: string[]
} {
  return docDoKit(base, tema, [{ folha: f, dist: distribuicao }], pedidos)
}

/**
 * Lote 14 (item 189): o KIT inteiro — várias folhas (Folha 1 × 2 impressões + Folha 2 × 3…) num documento só, na
 * ordem: todas as Folhas 1, depois todas as Folhas 2. Cada folha com a sua distribuição (pedido de cada lugar).
 */
export function docDoKit(base: Doc, tema: DocTema, partes: { folha: Folha; dist: number[][] }[], pedidos: PedidoNoLote[], temasDosPedidos?: (DocTema | null | undefined)[]): {
  doc: Doc; tema: DocTema; artboardIds: string[]; valoresPorSlot: Record<string, Record<string, string>>; rotulos: Record<string, RotuloLote[]>; resumo: string[]
} {
  const t: DocTema = JSON.parse(JSON.stringify(tema))
  const out = { molds: [] as Doc['molds'], textSlots: [] as Doc['textSlots'], parts: base.parts.map(p => ({ ...p, instances: [...p.instances] })) }
  const artboards: Doc['artboards'] = [], valoresPorSlot: Record<string, Record<string, string>> = {}, rotulos: Record<string, RotuloLote[]> = {}, resumo: string[] = []
  const variasFolhas = partes.length > 1
  // Lote 16 (item 206): pedidos com outro tema (Aproveitar folhas entre temas) — uma chave curta por tema
  const chaves = new Map<string, string>()
  const outroDe = (pi: number) => {
    const tk = temasDosPedidos?.[pi]
    if (!tk || tk.id === tema.id) return undefined
    if (!chaves.has(tk.id)) chaves.set(tk.id, `t${chaves.size + 1}`)
    return { tema: tk, chave: chaves.get(tk.id)! }
  }
  // o estilo de texto do tema do pedido vai por vaga (o resolvedor lê _ESTILO_<VAR>)
  const estilosDe = (tk: DocTema | undefined, v: Record<string, string>) => {
    if (!tk) return v
    const e: Record<string, string> = {}
    for (const [k, est] of Object.entries(tk.textStyles ?? {})) if (!v[`_ESTILO_${k}`]) e[`_ESTILO_${k}`] = JSON.stringify(est)
    return { ...e, ...v }
  }
  partes.forEach(({ folha: f, dist: distribuicao }, fi) => {
  const ordem = ordemDeLeitura(f)
  distribuicao.forEach((lugares, s) => {
    const abId = `lote_${f.id}_${s + 1}`
    artboards.push(pranchetaDa(f, abId, distribuicao.length > 1 ? `${f.nome} — folha ${s + 1}` : f.nome))
    rotulos[abId] = []
    // Lote 6 (item 95): o "#nº · Nome" vai na MARGEM da folha (fora das áreas de corte e de sangria), de pé, na altura da
    // 1ª vaga do pedido; dois pedidos que começam na mesma linha ficam um abaixo do outro
    const xMargem = Math.max(1.2, Math.min(...f.pecas.map(p => p.xMm)) / 2), usados: [number, number][] = []
    lugares.forEach((pi, j) => {
      if (pi < 0) return   // vaga vazia (gabarito: nada se mexe)
      const p = f.pecas[ordem[j]], m = p && base.molds.find(x => x.id === p.moldeId)
      if (!m) return
      const suf = variasFolhas ? `${fi}.${s}_${j}` : `${s}_${j}`
      const outro = outroDe(pi)
      const v = estilosDe(outro?.tema, pedidos[pi]?.valores ?? {})
      for (const sid of copiarPeca(base, t, m, p, abId, suf, out, outro)) {
        const cid = `${sid}~${suf}`
        valoresPorSlot[cid] = { ...v, ...(v[`_POS_${sid}`] ? { [`_POS_${cid}`]: v[`_POS_${sid}`] } : {}) }
      }
      if (lugares.findIndex(x => x === pi) === j) {
        const texto = pedidos[pi]?.rotulo ?? ''
        const comp = texto.length * 1.25 + 2   // mm ocupados pelo texto de pé (2,2 mm de altura de letra)
        let y = p.yMm + comp
        while (usados.some(([a, b]) => y - comp < b && y > a)) y += 2
        usados.push([y - comp, y])
        rotulos[abId].push({ xMm: xMargem, yMm: Math.min(f.heightMm - 1, y), texto, vertical: true })
      }
    })
    const cont = new Map<number, number>()
    for (const pi of lugares) if (pi >= 0) cont.set(pi, (cont.get(pi) ?? 0) + 1)
    resumo.push(`${variasFolhas ? `${f.nome} · ` : ''}Folha ${s + 1} → ${[...cont].map(([pi, n]) => `${pedidos[pi]?.rotulo ?? '?'} (${n})`).join(', ')}`)
  })
  })
  // a sangria da folha (a de cada folha do kit é a mesma regra: metade do espaço)
  const f = partes[0]?.folha
  return { doc: { ...base, smartArt: { ...(base.smartArt ?? {}), overflowMm: f ? Math.min(...partes.map(p => sobraNaFolha(base, p.folha))) : base.smartArt?.overflowMm ?? 10 }, artboards, ...out, grupos: undefined, folhas: undefined }, tema: t, artboardIds: artboards.map(a => a.id), valoresPorSlot, rotulos, resumo }
}

// ── Lote 14 (itens 187, 189, 190): O KIT DE FOLHAS DO PRODUTO E A CONTA DO PEDIDO ────────────────────────────────

type GrupoK = NonNullable<Doc['grupos']>[number]
export interface EntradaKit { folha: Folha; impressoes: number }
/**
 * As folhas que formam 1 kit do produto (com quantas impressões de cada): as do grupo (`folhas`, ou a antiga
 * `folhaId`); grupo sem folha cujas peças estão numa folha → essa folha (nunca sai peça por peça); base de peças
 * sob medida sem grupo → todas as folhas dela.
 */
export function folhasDoKit(base: Pick<Doc, 'folhas' | 'tipo'>, grupo: Pick<GrupoK, 'folhas' | 'folhaId' | 'moldes'> | null): EntradaKit[] {
  const todas = base.folhas ?? []
  let ids: string[] = grupo?.folhas?.length ? grupo.folhas : grupo?.folhaId ? [grupo.folhaId] : []
  if (!ids.length && grupo?.moldes?.length) ids = todas.filter(f => f.pecas.length && f.pecas.every(p => grupo.moldes.includes(p.moldeId))).map(f => f.id)
  if (!ids.length && !grupo && base.tipo === 'medida') ids = todas.filter(f => f.pecas.length).map(f => f.id)
  return ids.map(id => todas.find(f => f.id === id)).filter((f): f is Folha => !!f).map(f => ({ folha: f, impressoes: Math.max(1, f.impressoes ?? 1) }))
}
export type Contagem = 'kit' | 'pecas' | 'composicao'
type Composicao = { moldeId: string; qtd: number }[]
/** Lote 16 (item 206): como o pedido conta (o grupo escolheu; senão kit de 1 folha = peças, de várias = kit). */
export function contagemDoKit(grupo: { contagem?: Contagem; composicao?: Composicao } | null | undefined, kit: EntradaKit[]): Contagem {
  if (grupo?.contagem === 'composicao' && grupo.composicao?.length) return 'composicao'
  return grupo?.contagem && grupo.contagem !== 'composicao' ? grupo.contagem : kit.length === 1 ? 'pecas' : 'kit'
}
/** Lote 6 (item 94): composição por UNIDADE numa folha só (o caminho antigo, gerarLote) — não é o "kit de N peças". */
export const ehComposicaoPorUnidade = (grupo: { contagem?: Contagem; composicao?: Composicao } | null | undefined) => !!grupo?.composicao?.length && grupo.contagem !== 'composicao'
/**
 * Lote 16 (item 206): quantas VAGAS desta folha `kits` kits ocupam. Folha de uma peça só (os 7 corpos): kits × qtd
 * da peça (10 corpos = 10 vagas → 7 + 3). Folha com peças misturadas: folhas cheias que cubram a peça mais pedida.
 * Peça da folha que não está na composição: a folha cheia por kit (como antes).
 */
export function vagasDoKitNaFolha(folha: Pick<Folha, 'pecas'>, composicao: Composicao | undefined, kits: number): number {
  const cap = folha.pecas.length
  if (!cap) return 0
  const porMolde = new Map<string, number>()
  for (const p of folha.pecas) porMolde.set(p.moldeId, (porMolde.get(p.moldeId) ?? 0) + 1)
  const qtd = (m: string) => composicao?.find(c => c.moldeId === m)?.qtd ?? porMolde.get(m)!
  if (porMolde.size === 1) return kits * qtd([...porMolde.keys()][0])
  const folhas = Math.max(...[...porMolde].map(([m, c]) => Math.ceil((kits * qtd(m)) / c)))
  return folhas * cap
}

/**
 * Lote 17 (item 208): UNIDADES DO PEDIDO no "Kit de N peças" — a QTD do pedido (a Naty digita 15 = 15 rótulos);
 * sem ela, as unidades vendidas na plataforma; sem nada, 1. Antes usava só as vendidas (vinham 1) e a QTD sumia.
 */
export function unidadesDoPedido(a: { itens: object[] }): number {
  const soma = (k: 'quantidade' | 'qtdVendida') => a.itens.reduce((s: number, i) => s + (Number((i as Record<string, unknown>)[k]) || 0), 0)
  return soma('quantidade') || soma('qtdVendida') || 1
}

/** Peças de 1 kit (todas as folhas × impressões). */
export const pecasPorKit = (k: EntradaKit[]) => k.reduce((s, e) => s + e.folha.pecas.length * e.impressoes, 0)
/** Folhas impressas de 1 kit. */
export const folhasPorKit = (k: EntradaKit[]) => k.reduce((s, e) => s + e.impressoes, 0)

/**
 * A distribuição de cada folha do kit para os pedidos (`dist[s][lugar]` = índice do pedido, -1 = vazio):
 *  • "1 unidade = 1 kit": cada kit = as folhas do kit × impressões, cheias do pedido;
 *  • "por peças" (a Shopee manda 96 tags): kit de UMA folha → ⌈peças ÷ capacidade⌉ folhas (a última com o resto);
 *    kit de várias folhas → ⌈peças ÷ peças do kit⌉ kits;
 *  • `juntar` (Aproveitar folhas, item 190): as folhas cheias são de cada pedido; a sobra da última recebe o próximo
 *    pedido (nunca dividindo um pedido que cabe inteiro). Sem juntar, cada pedido nas suas folhas.
 */
export function distribuirKit(kit: EntradaKit[], pedidos: { kits: number; pecas: number }[], contagem: Contagem, juntar = false, composicao?: Composicao): { folha: Folha; dist: number[][] }[] {
  // Lote 16 (item 206): KIT DE N PEÇAS — cada folha recebe as peças dela (10 corpos = 7 + 3); "Aproveitar folhas"
  // junta os pedidos peça a peça (3 × 10 corpos = 30 = 5 folhas de 7, e não 6 com buracos)
  if (contagem === 'composicao') return kit.map(({ folha }) => {
    const cap = folha.pecas.length
    if (cap < 1) throw new Error(`A folha "${folha.nome}" não tem lugares de peça — monte a folha na Base.`)
    const ns = pedidos.map(p => vagasDoKitNaFolha(folha, composicao, Math.max(1, Math.round(p.kits || 1))))
    if (juntar) return { folha, dist: distribuirLote(cap, ns, { tipo: 'avulso' }) }
    const dist: number[][] = []
    ns.forEach((n, i) => { for (const s of distribuirLote(cap, [n], { tipo: 'avulso' })) dist.push(s.map(() => i)) })
    return { folha, dist }
  })
  const porPecas = contagem === 'pecas' && kit.length === 1
  const total = pecasPorKit(kit)
  return kit.map(({ folha, impressoes }) => {
    const cap = folha.pecas.length
    if (cap < 1) throw new Error(`A folha "${folha.nome}" não tem lugares de peça — monte a folha na Base.`)
    const ns = pedidos.map(p => {
      if (porPecas) return Math.max(0, Math.round(p.pecas || p.kits * cap))
      const kits = contagem === 'pecas' ? Math.ceil(Math.max(1, p.pecas) / Math.max(1, total)) : Math.max(1, Math.round(p.kits || 1))
      return kits * impressoes * cap
    })
    if (juntar) return { folha, dist: distribuirLote(cap, ns, { tipo: 'kit' }) }
    const dist: number[][] = []
    ns.forEach((n, i) => { for (const s of distribuirLote(cap, [n], { tipo: 'avulso' })) dist.push(s.map(() => i)) })
    return { folha, dist }
  })
}
