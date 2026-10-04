// mae-faces — cliente do Worker de detecção (só navegador). Sem Worker, roda a mesma função aqui.
import { detectarFaces, type OpcoesDeteccao, type ResultadoDeteccao } from './detectar'
import type { Mascara } from './raster'
import type { PedidoFaces, RespostaFaces } from './faces.worker'

let worker: Worker | null | undefined
let seq = 0
const esperando = new Map<number, { ok: (r: ResultadoDeteccao) => void; erro: (e: Error) => void }>()

function obterWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL('./faces.worker.ts', import.meta.url), { type: 'module', name: 'mae-faces' })
    worker.onmessage = (ev: MessageEvent<RespostaFaces>) => {
      const p = esperando.get(ev.data.id); esperando.delete(ev.data.id)
      if (!p) return
      if (ev.data.ok) p.ok(ev.data.resultado); else p.erro(new Error(ev.data.erro))
    }
    worker.onerror = () => { worker?.terminate(); worker = null; for (const p of esperando.values()) p.erro(new Error('O processo de detecção parou.')); esperando.clear() }
  } catch { worker = null }
  return worker
}

/** Detecta as faces fora da tela (Worker). A máscara é COPIADA (o chamador continua com a dele). */
export function detectarNoWorker(linhas: Mascara, opcoes: OpcoesDeteccao): Promise<ResultadoDeteccao> {
  const w = typeof Worker !== 'undefined' ? obterWorker() : null
  if (!w) return Promise.resolve(detectarFaces(linhas, opcoes))
  const id = ++seq
  return new Promise((ok, erro) => {
    esperando.set(id, { ok, erro })
    w.postMessage({ id, linhas: { w: linhas.w, h: linhas.h, d: linhas.d.slice() }, opcoes } satisfies PedidoFaces)
  })
}
