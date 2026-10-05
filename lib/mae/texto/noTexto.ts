// mae-texto — do ESTILO + VALOR ao nó de caminho do motor, numa posição de texto da base.
// A posição (caixa em % do quadro da face) já gira com a face; o texto moldado pelo HarfBuzz é
// diagramado na caixa (mm) e cada ponto passa pela matriz da face → caminho em mm da folha.
import type { DocTema, NoCaminho } from '../schema'
import { limparEfeitos } from '../schema/efeitos'
import { aplicar as aplicarM, type M } from '../vinculo/matriz'
import { diagramar, paraSvg, hashtag, type ConfigPosicao } from './diagramar'
import type { FonteHB } from './fonte'
import { amostrarContorno, passouDaFace, avisoPassou } from './limites'
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

export const ESTILO_PADRAO: EstiloTexto = {
  font: { postscriptName: 'Sniglet', family: 'Sniglet', source: 'local' }, color: '#1f2937', caixa: 'normal', align: 'center',
  tracking: 0, kerning: true, lineHeight: 1, scaleX: 1, scaleY: 1, baselineMm: 0, curveRadiusMm: 0, features: [], glyphChoices: [], effects: [],
}

/** Valor da variável para a prévia (ou o pedido): HASHTAG é calculada. */
export function valorDaVariavel(variavel: string, valores: Record<string, string>, meio = 'faz'): string {
  if (variavel === 'HASHTAG') return valores.HASHTAG || hashtag(valores.NOME ?? '', valores.IDADE ?? '', meio)
  return valores[variavel] ?? variavel
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
}): { no: NoCaminho; info: InfoTexto } | null {
  const pedida = o.fontes.obter(o.estilo.font.postscriptName)
  const fonte = pedida ?? o.fontes.substituta
  if (!fonte || !o.valor.trim()) return null
  const cw = o.caixa.w * o.w, ch = o.caixa.h * o.h
  const r = diagramar(fonte, o.valor, o.estilo, { w: cw, h: ch }, o.cfg)
  // mm da caixa (girada em volta do centro) → [0,1]² do quadro → mm da folha
  const th = ((o.rotacaoDeg ?? 0) * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th), mx = cw / 2, my = ch / 2
  const tx = (x0: number, y0: number) => {
    const x = th ? mx + (x0 - mx) * co - (y0 - my) * si : x0, y = th ? my + (x0 - mx) * si + (y0 - my) * co : y0
    return aplicarM(o.quadro, o.caixa.x + x / o.w, o.caixa.y + y / o.h)
  }
  const d = paraSvg(r.cmds, tx)
  const cantos = [[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[1]], [r.bbox[2], r.bbox[3]], [r.bbox[0], r.bbox[3]]].map(([x, y]) => tx(x, y))
  const xs = cantos.map(c => c[0]), ys = cantos.map(c => c[1])
  const no: NoCaminho = {
    id: `${o.slotId}:texto`, name: o.variavel, visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal', clip: false,
    type: 'path', d, color: o.estilo.color, bboxMm: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => Math.round(v * 1000) / 1000) as [number, number, number, number],
    effects: limparEfeitos(o.estilo.effects),
  }
  const fora = !!o.face && passouDaFace(amostrarContorno(cantos as Pt[]), o.face.poly)
  const aviso = fora ? avisoPassou(o.variavel, o.face!.nome)
    : !pedida ? `fonte "${o.estilo.font.family ?? o.estilo.font.postscriptName}" não instalada — usando substituta` : r.aviso
  return { no, info: { slotId: o.slotId, variavel: o.variavel, aviso, revisar: r.revisar || fora, substituta: !pedida, escala: r.escala, linhas: r.linhas, foraDaFace: fora, cantosMm: cantos as Pt[] } }
}
