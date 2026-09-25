// SOA Edition — leitura de PSD/PSB FORA da tela principal (Web Worker): PSD grande não trava a UI.
// Devolve a árvore de camadas (nome, posição, visibilidade, opacidade, mistura, dados de TEXTO) com o
// pixel de cada camada como ImageBitmap (transferível, sem cópia).
import { readPsd, initializeCanvas } from 'ag-psd'

initializeCanvas(
  (w: number, h: number) => new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) as unknown as HTMLCanvasElement,
  (w: number, h: number) => new ImageData(Math.max(1, w), Math.max(1, h)),
)

type No = {
  name?: string; hidden?: boolean; opacity?: number; blendMode?: string; left?: number; top?: number; right?: number; bottom?: number
  canvas?: OffscreenCanvas | ImageBitmap; children?: No[]; text?: unknown; clipping?: boolean
}

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  try {
    const psd = readPsd(e.data, { skipThumbnail: true }) as unknown as { width: number; height: number; canvas?: OffscreenCanvas; children?: No[] }
    const bitmaps: ImageBitmap[] = []
    const levar = (c: unknown): ImageBitmap | undefined => {
      if (!c || typeof (c as OffscreenCanvas).transferToImageBitmap !== 'function') return undefined
      const b = (c as OffscreenCanvas).transferToImageBitmap(); bitmaps.push(b); return b
    }
    const limpar = (l: No): No => {
      // texto: só dados serializáveis (conteúdo, transformação, estilo, parágrafo)
      const t = l.text as { text?: string; transform?: number[]; style?: unknown; paragraphStyle?: unknown } | undefined
      return {
        name: l.name, hidden: l.hidden, opacity: l.opacity, blendMode: l.blendMode, clipping: l.clipping,
        left: l.left, top: l.top, right: l.right, bottom: l.bottom,
        canvas: levar(l.canvas),
        text: t ? { text: t.text, transform: t.transform, style: JSON.parse(JSON.stringify(t.style || {})), paragraphStyle: JSON.parse(JSON.stringify(t.paragraphStyle || {})) } : undefined,
        children: l.children?.map(limpar),
      }
    }
    const arvore = { width: psd.width, height: psd.height, canvas: levar(psd.canvas), children: psd.children?.map(limpar) }
    ;(self as unknown as Worker).postMessage({ ok: true, psd: arvore }, bitmaps)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ ok: false, erro: (err as Error).message || 'PSD ilegível' })
  }
}
