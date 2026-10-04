// mae-render — WEB WORKER do motor: desenha a prancheta num OffscreenCanvas fora da thread da tela,
// com a MESMA função `renderizarPrancheta` da prévia e da exportação. Guarda os bitmaps decodificados
// (por sha256) e o cache de camadas entre um render e outro. Nada sai do computador.
/// <reference lib="webworker" />
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from './renderizar'
import { CacheCamadas } from './cache'
import { criarCanvasOffscreen, type PedidoWorker, type RespostaWorker } from './protocolo'

const escopo = self as unknown as DedicatedWorkerGlobalScope
const bitmaps = new Map<string, ImageBitmap>()
const cache = new CacheCamadas<CanvasLike>(300 * 1024 * 1024)
const responder = (r: RespostaWorker, transferir: Transferable[] = []) => escopo.postMessage(r, transferir)

// Fila: um pedido por vez, na ordem de chegada (um render não pode passar na frente do bitmap que usa).
let fila: Promise<void> = Promise.resolve()
escopo.onmessage = (ev: MessageEvent<PedidoWorker>) => { fila = fila.then(() => tratar(ev.data)) }

async function tratar(m: PedidoWorker) {
  try {
    if (m.tipo === 'bitmap') {
      if (!bitmaps.has(m.sha256)) bitmaps.set(m.sha256, await createImageBitmap(m.blob))
      responder({ tipo: 'bitmap-ok', sha256: m.sha256 })
    } else if (m.tipo === 'esquecer') {
      bitmaps.get(m.sha256)?.close(); bitmaps.delete(m.sha256)
    } else if (m.tipo === 'render') {
      const t0 = performance.now()
      const { w, h } = tamanhoDoCanvas(m.prancheta, m.pxPorMm)
      const saida = criarCanvasOffscreen(w, h) as unknown as OffscreenCanvas
      const r = renderizarPrancheta(saida as unknown as CanvasLike, m.prancheta, {
        pxPorMm: m.pxPorMm, fundo: m.fundo, criarCanvas: criarCanvasOffscreen, bitmap: s => bitmaps.get(s), cache,
      })
      if (m.saida === 'png') {
        const png = await saida.convertToBlob({ type: 'image/png' })
        responder({ tipo: 'render-ok', id: m.id, png, faltando: r.faltando, w, h, ms: performance.now() - t0 })
      } else {
        const bitmap = saida.transferToImageBitmap()
        responder({ tipo: 'render-ok', id: m.id, bitmap, faltando: r.faltando, w, h, ms: performance.now() - t0 }, [bitmap])
      }
    }
  } catch (e) {
    responder({ tipo: 'erro', id: m.tipo === 'render' ? m.id : undefined, sha256: m.tipo === 'bitmap' ? m.sha256 : undefined, mensagem: (e as Error)?.message || String(e) })
  }
}
