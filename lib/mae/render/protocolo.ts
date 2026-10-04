// mae-render — mensagens entre a página e o Web Worker do motor, e a fábrica de canvas comum aos dois.
import type { Prancheta } from '../schema'
import type { CanvasLike } from './renderizar'

export type PedidoWorker =
  | { tipo: 'bitmap'; sha256: string; blob: Blob }
  | { tipo: 'esquecer'; sha256: string }
  | { tipo: 'render'; id: number; prancheta: Prancheta; pxPorMm: number; fundo: string | null; saida: 'bitmap' | 'png' }

export type RespostaWorker =
  | { tipo: 'bitmap-ok'; sha256: string }
  | { tipo: 'render-ok'; id: number; bitmap?: ImageBitmap; png?: Blob; faltando: string[]; w: number; h: number; ms: number }
  | { tipo: 'erro'; id?: number; sha256?: string; mensagem: string }

/**
 * Canvas fora da tela com o contexto em modo CPU (`willReadFrequently`): o resultado não depende da
 * placa de vídeo, então prévia (Worker), exportação (Worker) e o modo sem Worker dão os mesmos pixels.
 */
export function criarCanvasOffscreen(w: number, h: number): CanvasLike {
  const c = new OffscreenCanvas(w, h)
  c.getContext('2d', { willReadFrequently: true })
  return c as unknown as CanvasLike
}
