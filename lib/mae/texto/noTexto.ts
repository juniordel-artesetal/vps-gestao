// mae-texto — do ESTILO + VALOR ao nó de caminho do motor, numa posição de texto da base.
// A posição (caixa em % do quadro da face) já gira com a face; o texto moldado pelo HarfBuzz é
// diagramado na caixa (mm) e cada ponto passa pela matriz da face → caminho em mm da folha.
import type { DocTema, NoCaminho, NoCamada, NoImagem } from '../schema'
import { limparEfeitos } from '../schema/efeitos'
import { aplicar as aplicarM, compor, girar, transladar, escalar, type M } from '../vinculo/matriz'
import { diagramar, paraSvg, hashtag, type ConfigPosicao, type ResultadoTexto } from './diagramar'
import type { FonteHB } from './fonte'
import { amostrarContorno, passouDaFace, avisoPassou } from './limites'
import { sufixoDaIdade, textoDoBloco, type CaixaSufixo, type FormatoIdade } from './variaveis'
import type { Pt } from '../faces/geometria'
import { escalarEfeitos } from '../efeitos/presets'

export type EstiloTexto = DocTema['textStyles'][string]
export interface RegistroFontes {
  /** Fonte já carregada pelo nome técnico (ou undefined, se não está instalada/carregada). */
  obter(postscriptName: string): FonteHB | undefined
  /** A substituta temporária (Sniglet, embutida). */
  substituta?: FonteHB
}
export interface InfoTexto {
  slotId: string; variavel: string; aviso: string | null; revisar: boolean; substituta: boolean; escala: number; linhas: string[]
  /** Lote 13 (item 185): o lado da área que segurou o nome. */
  limite?: 'largura' | 'altura' | null
  /** Lote 1: o texto passou da face (ou encostou numa linha de corte/dobra) — contorno vermelho + revisar. */
  foraDaFace?: boolean
  /** Cantos da caixa do texto em mm da prancheta (para o contorno vermelho na tela). */
  cantosMm?: Pt[]
  artboardId?: string
}

const congelar = <T,>(o: T): T => { if (o && typeof o === 'object') { Object.values(o).forEach(congelar); Object.freeze(o) } return o }
/**
 * Estilo dos textos sem estilo próprio. Lote 5 (item 64): CONGELADO — é compartilhado por todos os temas; quem for
 * editar faz uma cópia (JSON). Antes, uma alteração direta nele passaria para todo tema novo ("o NOME veio com a
 * textura e os efeitos do tema anterior").
 */
export const ESTILO_PADRAO: EstiloTexto = congelar({
  font: { postscriptName: 'Sniglet', family: 'Sniglet', source: 'local' }, color: '#1f2937', caixa: 'normal', align: 'center',
  tracking: 0, kerning: true, lineHeight: 1, scaleX: 1, scaleY: 1, baselineMm: 0, curveRadiusMm: 0, features: [], glyphChoices: [], effects: [],
} as EstiloTexto)

/**
 * Lote 6 (item 82): de quem cada variável HERDA o estilo enquanto não tem o seu (a FRASE presa ao nome sai com a
 * fonte e os efeitos do NOME; o SUFIXO, com os da IDADE…). Criar o estilo próprio COPIA o herdado — antes copiava
 * o padrão (Sniglet, sem efeitos) e o primeiro ajuste "apagava" a fonte e os efeitos.
 */
export const HERANCA_ESTILO: Record<string, string[]> = { SUFIXO: ['IDADE'], NOME_IDADE: ['NOME'], 'NOME_IDADE:IDADE': ['NOME_IDADE', 'NOME'], FRASE: ['NOME', 'NOME_IDADE'], SOBRENOME: ['NOME'] }
export function estiloDaVariavel(textStyles: Record<string, EstiloTexto> | undefined, variavel: string): EstiloTexto {
  return textStyles?.[variavel] ?? (HERANCA_ESTILO[variavel] ?? []).map(h => textStyles?.[h]).find(Boolean) ?? ESTILO_PADRAO
}

/**
 * Valor da variável para a prévia (ou o pedido): HASHTAG é calculada; Lote 5: SUFIXO vem da idade (item 62) e
 * NOME_IDADE junta os dois (item 73). Variável sem valor: na tela mostra o nome dela (para posicionar); no
 * arquivo do pedido (`_PEDIDO`) sai vazia — o texto some (item 77).
 */
export function valorDaVariavel(variavel: string, valores: Record<string, string>, meio = 'faz', idade?: { formato?: FormatoIdade; caixa?: CaixaSufixo }): string {
  if (variavel === 'HASHTAG') return valores.HASHTAG || hashtag(valores.NOME ?? '', valores.IDADE ?? '', meio)
  const formato = (valores._FORMATO_IDADE as FormatoIdade | undefined) || idade?.formato || 'anos'
  if (variavel === 'SUFIXO') return valores.SUFIXO ?? sufixoDaIdade(valores.IDADE ?? '', formato, idade?.caixa ?? 'maiusculas')
  if (variavel === 'NOME_IDADE') return valores.NOME_IDADE ?? textoDoBloco('linha', valores.NOME ?? '', valores.IDADE ?? '', sufixoDaIdade(valores.IDADE ?? '', formato, idade?.caixa ?? 'maiusculas'))
  return valores[variavel] ?? (valores._PEDIDO === '1' ? '' : variavel)
}

/**
 * Nó de caminho do texto numa posição. `quadro` = matriz [0,1]² do quadro da face → mm da folha;
 * `caixa` = caixa da posição em % do quadro; `w`, `h` = tamanho do quadro em mm.
 */
export function noDoTexto(o: {
  slotId: string; variavel: string; valor: string; estilo: EstiloTexto; fontes: RegistroFontes
  quadro: M; w: number; h: number; caixa: { x: number; y: number; w: number; h: number }; cfg: ConfigPosicao
  /** Giro em volta do centro da caixa (graus, horário). */
  rotacaoDeg?: number
  /** Face (mm da folha) e o nome da caixa — para o aviso de "passou da face". */
  face?: { poly: Pt[]; nome: string }
  /** Lote 14 (item 197): quanto os estilos escalam por o texto ter sido redimensionado nesta caixa. */
  escalaEstilos?: number
  /** Lote 17 (item 213): a cor por letra continua de onde a linha de cima parou (bloco Nome + idade). */
  inicioLetra?: number
}): { no: NoCaminho; info: InfoTexto; fundo?: NoCamada; letras?: NoCamada[]; letrasUsadas?: number; enfeite?: { no: NoImagem; atras: boolean } } | null {
  const pedida = o.fontes.obter(o.estilo.font.postscriptName)
  const fonte = pedida ?? o.fontes.substituta
  if (!fonte || !o.valor.trim()) return null
  let caixa = o.caixa
  let cw = caixa.w * o.w, ch = caixa.h * o.h
  // Lote 5 (item 74): fundo = LOGO com a área do nome marcada — a logo nunca deforma: a caixa do texto vira a
  // área do nome dentro da logo (altura da área, centrada na posição); o nome cabe nela (auto-ajuste)
  const logo = o.estilo.fundo?.tipo === 'imagem' ? o.estilo.fundo.imagem : undefined
  let logoW = 0, logoH = 0
  if (logo) {
    // Lote 6 (item 103): a logo entra do tamanho do NOME que já estava ali — o nome é medido na caixa dele e a logo
    // cresce em volta para a área do nome caber esse nome (antes: largura da caixa ÷ área → logo gigante, nome mínimo)
    const r0 = diagramar(fonte, o.valor, o.estilo as never, { w: cw, h: ch }, o.cfg, ps => o.fontes.obter(ps))
    const tw = Math.max(1, (r0.bbox[2] - r0.bbox[0]) * 1.08), th = Math.max(1, (r0.bbox[3] - r0.bbox[1]) * 1.15)
    logoW = Math.max(tw / logo.area.w, (th / logo.area.h) * logo.aspect); logoH = logoW / logo.aspect
    const w2 = logo.area.w * logoW, h2 = logo.area.h * logoH
    caixa = { ...caixa, x: caixa.x + (caixa.w - w2 / o.w) / 2, w: w2 / o.w, y: caixa.y + (caixa.h - h2 / o.h) / 2, h: h2 / o.h }
    cw = w2; ch = h2
  }
  // Lote 5 (item 75): fontes das trocas de letra (as que estão carregadas)
  let r = diagramar(fonte, o.valor, o.estilo as never, { w: cw, h: ch }, o.cfg, ps => o.fontes.obter(ps))
  // faixa lisa: estica SÓ na largura (até o limite) quando o nome não coube no tamanho pedido
  let esticar = 1
  if (logo?.esticarAte && r.escala < 1) {
    esticar = Math.min(logo.esticarAte, 1 / Math.max(0.3, r.escala))
    caixa = { ...caixa, x: caixa.x + (caixa.w - (caixa.w * esticar)) / 2, w: caixa.w * esticar }
    cw = caixa.w * o.w
    r = diagramar(fonte, o.valor, o.estilo as never, { w: cw, h: ch }, o.cfg, ps => o.fontes.obter(ps))
  }
  // mm da caixa (girada em volta do centro) → [0,1]² do quadro → mm da folha
  const th = ((o.rotacaoDeg ?? 0) * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th), mx = cw / 2, my = ch / 2
  const tx = (x0: number, y0: number) => {
    const x = th ? mx + (x0 - mx) * co - (y0 - my) * si : x0, y = th ? my + (x0 - mx) * si + (y0 - my) * co : y0
    return aplicarM(o.quadro, caixa.x + x / o.w, caixa.y + y / o.h)
  }
  const d = paraSvg(r.cmds, tx)
  const cantos = [[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[1]], [r.bbox[2], r.bbox[3]], [r.bbox[0], r.bbox[3]]].map(([x, y]) => tx(x, y))
  const xs = cantos.map(c => c[0]), ys = cantos.map(c => c[1])
  const no: NoCaminho = {
    id: `${o.slotId}:texto`, name: o.variavel, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
    type: 'path', d, color: o.estilo.color, bboxMm: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => Math.round(v * 1000) / 1000) as [number, number, number, number],
    // Lote 14 (item 197): o nome que ENCOLHE para caber (e o redimensionado na caixa) afina o contorno, a sombra… junto —
    // "Ana" e "Maria Eduarda" com o mesmo visual. "Escalar estilos junto" desligado = espessura fixa
    effects: o.estilo.escalarEstilos === false ? limparEfeitos(o.estilo.effects) : escalarEfeitos(o.estilo.effects, r.escala * (o.escalaEstilos ?? 1)),
  }
  const fundo = fundoDoTexto(o.slotId, o.estilo, r.bbox, tx, logo ? { w: logoW * esticar, h: logoH, area: logo.area, cw, ch } : null)
  // Lote 17 (itens 213/214): cor por letra (camadas recortadas no nome) e o enfeite preso a uma letra
  const pl = porLetra(o.slotId, o.estilo, r, tx, o.inicioLetra ?? 0)
  const enfeite = enfeiteDoNome(o.slotId, o.estilo, r, tx)
  const fora = !!o.face && passouDaFace(amostrarContorno(cantos as Pt[]), o.face.poly)
  const aviso = r.avisoTroca ? `${o.variavel}: ${r.avisoTroca}` : fora ? avisoPassou(o.variavel, o.face!.nome)
    : !pedida ? `fonte "${o.estilo.font.family ?? o.estilo.font.postscriptName}" não instalada — usando substituta` : r.aviso
  return { no, ...(fundo ? { fundo } : {}), ...(pl ? { letras: pl.letras, letrasUsadas: pl.usadas } : {}), ...(enfeite ? { enfeite } : {}), info: { slotId: o.slotId, variavel: o.variavel, aviso, revisar: r.revisar || fora, substituta: !pedida, escala: r.escala, linhas: r.linhas, limite: r.limite ?? null, foraDaFace: fora, cantosMm: cantos as Pt[] } }
}

const r3 = (v: number) => Math.round(v * 1000) / 1000
/**
 * Lote 5 (item 74): o FUNDO do texto, no mesmo espaço da caixa (gira e anda junto):
 *  • retângulo: largura do texto + sobra nas laterais; altura em % da altura do texto; o texto um pouco acima
 *    do centro; cantos vivos ou arredondados; cor + estilos de camada (a textura entra no resolver);
 *  • imagem (logo): do tamanho da logo, com a área do nome na caixa do texto.
 */
function fundoDoTexto(slotId: string, e: EstiloTexto, bbox: [number, number, number, number], tx: (x: number, y: number) => [number, number],
  logo: { w: number; h: number; area: { x: number; y: number; w: number; h: number }; cw: number; ch: number } | null): NoCamada | null {
  const f = e.fundo
  if (!f) return null
  if (f.tipo === 'imagem' && f.imagem && logo) {
    // a área do nome = a caixa do texto (0..cw × 0..ch); a logo em volta dela
    const x0 = -logo.area.x * logo.w, y0 = -logo.area.y * logo.h
    const p00 = tx(x0, y0), p10 = tx(x0 + logo.w, y0), p01 = tx(x0, y0 + logo.h)
    const img: NoImagem = { id: `${slotId}:fundo`, name: 'Logo', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, type: 'image',
      src: { path: f.imagem.path, sha256: f.imagem.sha256 ?? f.imagem.path }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0,
      matrix: [p10[0] - p00[0], p10[1] - p00[1], p01[0] - p00[0], p01[1] - p00[1], p00[0], p00[1]].map(r3) as [number, number, number, number, number, number] }
    return img
  }
  if (f.tipo !== 'retangulo') return null
  const [bx0, by0, bx1, by1] = bbox
  if (!(bx1 > bx0)) return null
  const altTexto = by1 - by0, alt = altTexto * (f.alturaPct ?? 1.5)
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2 + (f.textoAcima ?? 0.05) * alt
  const x0 = bx0 - (f.sobraMm ?? 3), x1 = bx1 + (f.sobraMm ?? 3), y0 = cy - alt / 2, y1 = cy + alt / 2
  const rr = Math.min(f.raioMm ?? 0, (x1 - x0) / 2, alt / 2)
  const p = (x: number, y: number) => { const [a, b] = tx(x, y); return `${r3(a)} ${r3(b)}` }
  const d = rr > 0
    ? `M${p(x0 + rr, y0)}L${p(x1 - rr, y0)}Q${p(x1, y0)} ${p(x1, y0 + rr)}L${p(x1, y1 - rr)}Q${p(x1, y1)} ${p(x1 - rr, y1)}L${p(x0 + rr, y1)}Q${p(x0, y1)} ${p(x0, y1 - rr)}L${p(x0, y0 + rr)}Q${p(x0, y0)} ${p(x0 + rr, y0)}Z`
    : `M${p(x0, y0)}L${p(x1, y0)}L${p(x1, y1)}L${p(x0, y1)}Z`
  const cs = [tx(x0, y0), tx(x1, y0), tx(x1, y1), tx(x0, y1)]
  const xs = cs.map(c => c[0]), ys = cs.map(c => c[1])
  return { id: `${slotId}:fundo`, name: 'Fundo do texto', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
    type: 'path', d, color: f.cor ?? '#dc2626', bboxMm: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r3) as [number, number, number, number],
    effects: limparEfeitos(f.effects) } as NoCaminho
}

/**
 * Lote 8 (item 124): UM fundo (logo ou faixa) para o BLOCO inteiro de linhas empilhadas (Nome + idade, frase em
 * cima/embaixo) — antes cada linha desenhava o seu (2 ou 3 logos). Feito no espaço do bloco: gira junto com ele, a
 * partir dos cantos (na folha) de cada linha já diagramada. Logo: a ÁREA DO NOME cobre o texto de todas as linhas
 * (com 8% de folga), sem deformar. Faixa: em volta da união das linhas, com a sobra nas laterais.
 */
export function fundoDoBloco(slotId: string, e: EstiloTexto, cantosLinhas: Pt[][]): NoCamada | null {
  const f = e.fundo
  const linhas = cantosLinhas.filter(c => c.length === 4)
  if (!f || !linhas.length) return null
  const [a0, a1] = linhas[0]
  const th = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), co = Math.cos(th), si = Math.sin(th)
  const todos = linhas.flat()
  const cx = todos.reduce((s, p) => s + p[0], 0) / todos.length, cy = todos.reduce((s, p) => s + p[1], 0) / todos.length
  // no referencial do bloco (sem giro), em volta do centro
  const loc = todos.map(([x, y]) => [(x - cx) * co + (y - cy) * si, -(x - cx) * si + (y - cy) * co] as Pt)
  const x0 = Math.min(...loc.map(p => p[0])), x1 = Math.max(...loc.map(p => p[0])), y0 = Math.min(...loc.map(p => p[1])), y1 = Math.max(...loc.map(p => p[1]))
  const naFolha = (x: number, y: number): [number, number] => [cx + x * co - y * si, cy + x * si + y * co]
  if (f.tipo === 'imagem' && f.imagem) {
    const lg = f.imagem, uw = Math.max(1, (x1 - x0) * 1.08), uh = Math.max(1, (y1 - y0) * 1.15)
    const W = Math.max(uw / lg.area.w, (uh / lg.area.h) * lg.aspect), H = W / lg.aspect
    // centro da área do nome = centro da união das linhas
    const ucx = (x0 + x1) / 2, ucy = (y0 + y1) / 2
    const ox = ucx - (lg.area.x + lg.area.w / 2) * W, oy = ucy - (lg.area.y + lg.area.h / 2) * H
    const p00 = naFolha(ox, oy), p10 = naFolha(ox + W, oy), p01 = naFolha(ox, oy + H)
    return { id: `${slotId}:fundo`, name: 'Logo', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false, type: 'image',
      src: { path: lg.path, sha256: lg.sha256 ?? lg.path }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0,
      matrix: [p10[0] - p00[0], p10[1] - p00[1], p01[0] - p00[0], p01[1] - p00[1], p00[0], p00[1]].map(r3) as [number, number, number, number, number, number] } as NoImagem
  }
  if (f.tipo !== 'retangulo') return null
  const altLinha = (y1 - y0) / linhas.length, extra = altLinha * Math.max(0, (f.alturaPct ?? 1.5) - 1) / 2
  const X0 = x0 - (f.sobraMm ?? 3), X1 = x1 + (f.sobraMm ?? 3), Y0 = y0 - extra, Y1 = y1 + extra
  const rr = Math.min(f.raioMm ?? 0, (X1 - X0) / 2, (Y1 - Y0) / 2)
  const p = (x: number, y: number) => { const [a, b] = naFolha(x, y); return `${r3(a)} ${r3(b)}` }
  const d = rr > 0
    ? `M${p(X0 + rr, Y0)}L${p(X1 - rr, Y0)}Q${p(X1, Y0)} ${p(X1, Y0 + rr)}L${p(X1, Y1 - rr)}Q${p(X1, Y1)} ${p(X1 - rr, Y1)}L${p(X0 + rr, Y1)}Q${p(X0, Y1)} ${p(X0, Y1 - rr)}L${p(X0, Y0 + rr)}Q${p(X0, Y0)} ${p(X0 + rr, Y0)}Z`
    : `M${p(X0, Y0)}L${p(X1, Y0)}L${p(X1, Y1)}L${p(X0, Y1)}Z`
  const cs = [naFolha(X0, Y0), naFolha(X1, Y0), naFolha(X1, Y1), naFolha(X0, Y1)]
  return { id: `${slotId}:fundo`, name: 'Fundo do texto', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
    type: 'path', d, color: f.cor ?? '#dc2626', bboxMm: [Math.min(...cs.map(c => c[0])), Math.min(...cs.map(c => c[1])), Math.max(...cs.map(c => c[0])), Math.max(...cs.map(c => c[1]))].map(r3) as [number, number, number, number],
    effects: limparEfeitos(f.effects) } as NoCaminho
}

// ── Lote 17 (item 213): COR POR LETRA ───────────────────────────────────────────────────────────────────────────────

/** Qual cor (índice na sequência) cada glifo leva: a letra gasta uma; o acento vai com a letra dele; espaço pula. */
export function coresDasLetras(glifos: { ch: string; acento: boolean }[], n: number, o: { pularEspacos?: boolean; inicio?: number } = {}): { indices: (number | null)[]; usadas: number } {
  const pular = o.pularEspacos !== false
  let k = (o.inicio ?? 0) - 1, ultimo: number | null = null
  const indices = glifos.map(g => {
    if (g.acento) return ultimo
    if (!g.ch.trim()) { if (!pular) k++; return null }
    k++; ultimo = ((k % n) + n) % n
    return ultimo
  })
  return { indices, usadas: k + 1 - (o.inicio ?? 0) }
}

function porLetra(slotId: string, estilo: EstiloTexto, r: ResultadoTexto, tx: (x: number, y: number) => [number, number], inicio: number): { letras: NoCamada[]; usadas: number } | null {
  const pl = estilo.porLetra
  const n = Math.max(pl?.papeis?.length ?? 0, pl?.cores.length ?? 0)
  if (!pl || !n || !r.glifos.length) return null
  const { indices, usadas } = coresDasLetras(r.glifos, n, { pularEspacos: pl.pularEspacos, inicio: (pl.inicio ?? 0) + inicio })
  // uma camada por letra (a letra + os acentos dela), recortada no nome — os estilos do nome ficam por cima/baixo
  const grupos = new Map<number, { cor: number; i: number[] }>()
  let atual = -1
  r.glifos.forEach((g, gi) => { const ci = indices[gi]; if (ci === null) return; if (!g.acento) atual = gi; const k = g.acento && atual >= 0 ? atual : gi; const x = grupos.get(k) ?? { cor: ci, i: [] }; x.i.push(gi); grupos.set(k, x) })
  const letras: NoCamada[] = []
  for (const [k, gr] of grupos) {
    const cmds = gr.i.flatMap(gi => r.cmds.slice(r.glifos[gi].i0, r.glifos[gi].i1))
    if (!cmds.length) continue
    const d = paraSvg(cmds, tx)
    const pts = cmds.flatMap(c => { const out: [number, number][] = []; for (let j = 1; j < c.length; j += 2) out.push(tx(c[j] as number, c[j + 1] as number)); return out })
    const bb = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))].map(r3) as [number, number, number, number]
    const cor = pl.cores[gr.cor % pl.cores.length] ?? estilo.color
    const letra: NoCaminho = { id: `${slotId}:letra${k}`, name: `Letra ${k + 1}`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: true, type: 'path', d, color: cor, bboxMm: bb }
    const papel = pl.papeis?.length ? pl.papeis[gr.cor % pl.papeis.length] : null
    if (!papel) { letras.push(letra); continue }
    // papel por letra: a letra com o papel recortado dentro dela (cobre a caixa da letra)
    const w = Math.max(0.1, bb[2] - bb[0]), h = Math.max(0.1, bb[3] - bb[1]), A = papel.aspect || 1
    let tw = w, th = tw / A
    if (th < h) { th = h; tw = th * A }
    const img: NoImagem = { id: `${slotId}:letra${k}:papel`, name: 'Papel da letra', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: true,
      type: 'image', src: { path: papel.path, sha256: papel.sha256 ?? papel.path }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: [r3(tw), 0, 0, r3(th), r3((bb[0] + bb[2]) / 2 - tw / 2), r3((bb[1] + bb[3]) / 2 - th / 2)] }
    letras.push({ id: `${slotId}:letra${k}:com-papel`, name: `Letra ${k + 1}`, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: true, type: 'group', passThrough: true, children: [{ ...letra, clip: false }, img] } as NoCamada)
  }
  return letras.length ? { letras, usadas } : null
}

// ── Lote 17 (item 214): ENFEITE PRESO AO NOME ───────────────────────────────────────────────────────────────────────

type Caixa4 = [number, number, number, number]
const caixaDe = (cmds: ResultadoTexto['cmds']): Caixa4 | null => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const c of cmds) for (let i = 1; i < c.length; i += 2) { const x = c[i] as number, y = c[i + 1] as number; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return isFinite(x0) ? [x0, y0, x1, y1] : null
}
/** Os contornos fechados de um glifo (separados a cada M) — o pingo do i é o mais alto. */
const contornos = (cmds: ResultadoTexto['cmds']) => { const out: ResultadoTexto['cmds'][] = []; for (const c of cmds) { if (c[0] === 'M' || !out.length) out.push([]); out[out.length - 1].push(c) } return out }

/**
 * O ponto (mm da caixa do texto) onde o enfeite se prende: o TOPO REAL da letra (a caixa do glifo, não a altura da
 * fonte — "Isabel": em cima do "l"), o pingo do i, ou a caixa do nome. null = âncora sem letra (sem "i" no nome).
 */
export function pontoDoEnfeite(r: Pick<ResultadoTexto, 'cmds' | 'glifos' | 'bbox'>, ancora: NonNullable<EstiloTexto['enfeite']>['ancora']): { x: number; y: number; lado: 'cima' | 'baixo' | 'esq' | 'dir' } | null {
  const [bx0, by0, bx1, by1] = r.bbox
  const letras = r.glifos.map((g, i) => ({ g, i })).filter(x => !x.g.acento && x.g.ch.trim())
  const caixaDaLetra = (gi: number): Caixa4 | null => {
    // a letra + os acentos dela (vêm logo depois)
    let fim = gi + 1
    while (fim < r.glifos.length && r.glifos[fim].acento) fim++
    return caixaDe(r.glifos.slice(gi, fim).flatMap(g => r.cmds.slice(g.i0, g.i1)))
  }
  if (ancora === 'ultima' || ancora === 'primeira') {
    const l = ancora === 'ultima' ? letras.at(-1) : letras[0]
    const c = l && caixaDaLetra(l.i)
    return c ? { x: (c[0] + c[2]) / 2, y: c[1], lado: 'cima' } : null
  }
  if (ancora === 'pingo-i') {
    const l = letras.find(x => /[iíjìî]/i.test(x.g.ch))
    if (!l) return null
    const cs = contornos(r.cmds.slice(l.g.i0, l.g.i1)).map(caixaDe).filter((c): c is Caixa4 => !!c).sort((a, b) => a[1] - b[1])
    const c = cs[0]
    return c ? { x: (c[0] + c[2]) / 2, y: (c[1] + c[3]) / 2, lado: 'cima' } : null
  }
  if (ancora === 'antes') return { x: bx0, y: (by0 + by1) / 2, lado: 'esq' }
  if (ancora === 'depois') return { x: bx1, y: (by0 + by1) / 2, lado: 'dir' }
  if (ancora === 'baixo') return { x: (bx0 + bx1) / 2, y: by1, lado: 'baixo' }
  return { x: (bx0 + bx1) / 2, y: by0, lado: 'cima' }
}

function enfeiteDoNome(slotId: string, estilo: EstiloTexto, r: ResultadoTexto, tx: (x: number, y: number) => [number, number]): { no: NoImagem; atras: boolean } | null {
  const en = estilo.enfeite
  if (!en) return null
  const p = pontoDoEnfeite(r, en.ancora)
  if (!p) return null
  // tamanho em relação à ALTURA do nome (que já encolheu com o auto-ajuste) — o enfeite diminui junto
  const hNome = Math.max(0.5, r.bbox[3] - r.bbox[1])
  const w = (en.tamanho ?? 0.6) * hNome, h = w / (en.imagem.aspect || 1)
  // o enfeite fica ENCOSTADO no ponto pelo lado de fora (em cima: a base dele no topo da letra) + a distância escolhida
  const cx = p.x + (p.lado === 'esq' ? -w / 2 : p.lado === 'dir' ? w / 2 : 0) + (en.dx ?? 0) * hNome
  const cy = p.y + (p.lado === 'cima' ? -h / 2 : p.lado === 'baixo' ? h / 2 : 0) + (en.dy ?? 0) * hNome
  // caixa do texto → folha (afim): três pontos dão a matriz
  const o0 = tx(0, 0), ox = tx(1, 0), oy = tx(0, 1)
  const T: M = [ox[0] - o0[0], ox[1] - o0[1], oy[0] - o0[0], oy[1] - o0[1], o0[0], o0[1]]
  const local = compor(transladar(cx, cy), girar(en.giroDeg ?? 0), escalar(w, h), transladar(-0.5, -0.5))
  const m = compor(T, local).map(r3) as M
  const no: NoImagem = { id: `${slotId}:enfeite`, name: 'Enfeite do nome', visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
    type: 'image', src: { path: en.imagem.path, sha256: en.imagem.sha256 ?? en.imagem.path }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0, matrix: m }
  return { no, atras: !!en.atras }
}
