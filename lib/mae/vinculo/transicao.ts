// TRANSIÇÃO DE PAPÉIS (Lote 1, item 5) — a marca registrada das artes da Naty, sem pintar máscara à mão:
// o 2º papel entra POR CIMA do primeiro com uma máscara em DEGRADÊ montada a partir de 3 escolhas simples
// (direção, posição e suavidade). Quem quiser refina com o pincel na máscara depois.
// Coordenadas no quadrado da camada (0..1), como o resto da máscara.
import type { DegradeMascara } from '../schema/edicao'
import type { z } from 'zod'

export type DirecaoTransicao = 'baixo' | 'cima' | 'direita' | 'esquerda' | 'centro'
export interface Transicao { dir: DirecaoTransicao; pos: number; soft: number }
export const TRANSICAO_PADRAO: Transicao = { dir: 'baixo', pos: 0.5, soft: 0.3 }

export const NOMES_DIRECAO: Record<DirecaoTransicao, string> = {
  baixo: 'De cima para baixo', cima: 'De baixo para cima', direita: 'Da esquerda para a direita', esquerda: 'Da direita para a esquerda', centro: 'Do centro para fora',
}

const lim = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a))
const r4 = (v: number) => Math.round(v * 1e4) / 1e4

/**
 * Degradê da máscara do papel NOVO: ele aparece inteiro no lado de onde a transição "vem" e some na
 * direção escolhida, revelando o papel de baixo. `pos` = onde fica o meio da transição (0 = início, 1 =
 * fim); `soft` = largura da faixa de mistura (0,02 = quase um corte; 1 = a face toda).
 */
export function degradeDaTransicao(t: Transicao): z.infer<typeof DegradeMascara> {
  const s = lim(t.soft, 0.02, 1), p = lim(t.pos, 0, 1)
  const a = r4(p - s / 2), b = r4(p + s / 2)
  const lin = (x0: number, y0: number, x1: number, y1: number) => ({ type: 'linear' as const, x0, y0, x1, y1, stops: [{ pos: 0, alpha: 1 }, { pos: 1, alpha: 0 }] })
  switch (t.dir) {
    case 'baixo': return lin(0.5, a, 0.5, b)        // o papel novo fica em CIMA e some para baixo
    case 'cima': return lin(0.5, 1 - a, 0.5, 1 - b)  // fica EMBAIXO e some para cima
    case 'direita': return lin(a, 0.5, b, 0.5)      // fica à ESQUERDA e some para a direita
    case 'esquerda': return lin(1 - a, 0.5, 1 - b, 0.5)
    case 'centro': {                                 // fica no MEIO e some para as bordas (radial)
      const R = Math.SQRT1_2
      const i = r4(lim(a / R, 0, 1)), f = r4(lim(b / R, 0, 1))
      return { type: 'radial', x0: 0.5, y0: 0.5, x1: r4(0.5 + R), y1: 0.5, stops: [{ pos: i, alpha: 1 }, { pos: Math.max(f, Math.min(1, i + 0.0001)), alpha: 0 }] }
    }
  }
}
