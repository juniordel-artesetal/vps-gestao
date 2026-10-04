// mae-render — VIEWPORT: como o espaço em mm aparece na tela.
//   escala = pixels CSS por mm · (x, y) = onde a origem (0, 0 mm) cai na tela, em px CSS.
// "Tamanho real" usa a CALIBRAÇÃO da tela (px CSS por mm FÍSICO): o navegador não informa o tamanho
// real do pixel, então a usuária mede uma vez com um cartão de crédito (85,6 mm) e o fator fica salvo.
import { PX_CSS_POR_MM_NOMINAL } from './unidades'

export interface Viewport { escala: number; x: number; y: number }
export interface Retangulo { xMm: number; yMm: number; wMm: number; hMm: number }

export const ESCALA_MIN = 0.05
export const ESCALA_MAX = 80
/** Largura do cartão de crédito (ISO/IEC 7810 ID-1), usada na calibração. */
export const CARTAO_MM = 85.6

const limitar = (e: number) => Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, e))

/** Calibração padrão quando a usuária ainda não mediu (pixel CSS nominal). */
export const CALIBRACAO_PADRAO = PX_CSS_POR_MM_NOMINAL

/** Fator de calibração a partir da largura em px CSS que bateu com o cartão. */
export const calibracaoDoCartao = (pxDoCartao: number) => pxDoCartao / CARTAO_MM

/** Encaixa o retângulo (em mm) inteiro na área da tela, centralizado, com margem em px. */
export function ajustar(alvo: Retangulo, telaW: number, telaH: number, margemPx = 32): Viewport {
  const w = Math.max(1, telaW - 2 * margemPx), h = Math.max(1, telaH - 2 * margemPx)
  const escala = limitar(Math.min(w / alvo.wMm, h / alvo.hMm))
  return centralizar(alvo, telaW, telaH, escala)
}

/** 100% = 1 mm na tela é 1 mm físico (com a calibração da tela), centralizado. */
export function tamanhoReal(alvo: Retangulo, telaW: number, telaH: number, calibracao = CALIBRACAO_PADRAO): Viewport {
  return centralizar(alvo, telaW, telaH, limitar(calibracao))
}

export function centralizar(alvo: Retangulo, telaW: number, telaH: number, escala: number): Viewport {
  return { escala, x: telaW / 2 - (alvo.xMm + alvo.wMm / 2) * escala, y: telaH / 2 - (alvo.yMm + alvo.hMm / 2) * escala }
}

/** Zoom mantendo FIXO o ponto da tela (px) sob o cursor. */
export function zoomNoPonto(v: Viewport, fator: number, px: number, py: number): Viewport {
  const escala = limitar(v.escala * fator)
  const k = escala / v.escala
  return { escala, x: px - (px - v.x) * k, y: py - (py - v.y) * k }
}

export const telaParaMm = (v: Viewport, px: number, py: number) => ({ xMm: (px - v.x) / v.escala, yMm: (py - v.y) / v.escala })
export const mmParaTela = (v: Viewport, xMm: number, yMm: number) => ({ x: v.x + xMm * v.escala, y: v.y + yMm * v.escala })

/** Zoom em % em relação ao "tamanho real" (100% = tamanho físico). */
export const zoomPercentual = (v: Viewport, calibracao = CALIBRACAO_PADRAO) => Math.round((v.escala / calibracao) * 100)
