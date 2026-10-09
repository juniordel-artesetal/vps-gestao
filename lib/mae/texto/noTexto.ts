// mae-texto — do ESTILO + VALOR ao nó de caminho do motor, numa posição de texto da base.
// A posição (caixa em % do quadro da face) já gira com a face; o texto moldado pelo HarfBuzz é
// diagramado na caixa (mm) e cada ponto passa pela matriz da face → caminho em mm da folha.
import type { DocTema, NoCaminho, NoCamada, NoImagem } from '../schema'
import { limparEfeitos } from '../schema/efeitos'
import { aplicar as aplicarM, type M } from '../vinculo/matriz'
import { diagramar, paraSvg, hashtag, type ConfigPosicao } from './diagramar'
import type { FonteHB } from './fonte'
import { amostrarContorno, passouDaFace, avisoPassou } from './limites'
import { sufixoDaIdade, textoDoBloco, type CaixaSufixo, type FormatoIdade } from './variaveis'
import type { Pt } from '../faces/geometria'

export type EstiloTexto = DocTema['textStyles'][string]
export interface RegistroFontes {
  /** Fonte já carregada pelo nome técnico (ou undefined, se não está instalada/carregada). */
  obter(postscriptName: string): FonteHB | undefined
  /** A substituta temporária (Sniglet, embutida). */
  substituta?: FonteHB
}
export interface InfoTexto {
  slotId: string; variavel: string; aviso: string | null; revisar: boolean; substituta: boolean; escala: number; linhas: string[]
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
}): { no: NoCaminho; info: InfoTexto; fundo?: NoCamada } | null {
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
    logoW = cw / logo.area.w; logoH = logoW / logo.aspect
    const h2 = logo.area.h * logoH
    caixa = { ...caixa, y: caixa.y + (caixa.h - h2 / o.h) / 2, h: h2 / o.h }
    ch = h2
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
    effects: limparEfeitos(o.estilo.effects),
  }
  const fundo = fundoDoTexto(o.slotId, o.estilo, r.bbox, tx, logo ? { w: logoW * esticar, h: logoH, area: logo.area, cw, ch } : null)
  const fora = !!o.face && passouDaFace(amostrarContorno(cantos as Pt[]), o.face.poly)
  const aviso = fora ? avisoPassou(o.variavel, o.face!.nome)
    : !pedida ? `fonte "${o.estilo.font.family ?? o.estilo.font.postscriptName}" não instalada — usando substituta` : r.aviso
  return { no, ...(fundo ? { fundo } : {}), info: { slotId: o.slotId, variavel: o.variavel, aviso, revisar: r.revisar || fora, substituta: !pedida, escala: r.escala, linhas: r.linhas, foraDaFace: fora, cantosMm: cantos as Pt[] } }
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
