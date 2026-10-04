// mae-faces — WEB WORKER da detecção de faces (a tela não trava enquanto o molde é analisado).
/// <reference lib="webworker" />
import { detectarFaces, type OpcoesDeteccao, type ResultadoDeteccao } from './detectar'
import type { Mascara } from './raster'

export type PedidoFaces = { id: number; linhas: Mascara; opcoes: OpcoesDeteccao }
export type RespostaFaces = { id: number; ok: true; resultado: ResultadoDeteccao } | { id: number; ok: false; erro: string }

const escopo = self as unknown as DedicatedWorkerGlobalScope
escopo.onmessage = (ev: MessageEvent<PedidoFaces>) => {
  const { id, linhas, opcoes } = ev.data
  try {
    escopo.postMessage({ id, ok: true, resultado: detectarFaces(linhas, opcoes) } satisfies RespostaFaces)
  } catch (e) {
    escopo.postMessage({ id, ok: false, erro: (e as Error)?.message || String(e) } satisfies RespostaFaces)
  }
}
