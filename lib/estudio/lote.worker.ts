// SOA Edition — Web Worker das ações em lote: processa cada imagem fora da thread da página
// (OffscreenCanvas), então a tela não trava nem com 50 fotos grandes.
import { processarImagem, codificar, type Operacao, type Saida } from './acoes'

const criar = (w: number, h: number) => new OffscreenCanvas(w, h)
let marca: ImageBitmap | null = null

self.onmessage = async (e: MessageEvent) => {
  const m = e.data as
    | { tipo: 'marca'; imagem: ImageBitmap | null }
    | { tipo: 'item'; id: number; arquivo: Blob; ops: Operacao[]; saida: Saida }
  if (m.tipo === 'marca') { marca = m.imagem; return }
  try {
    const bmp = await createImageBitmap(m.arquivo)
    const c = processarImagem(bmp, m.ops, marca, criar)
    bmp.close()
    const blob = await codificar(c, m.saida, criar)
    ;(self as unknown as Worker).postMessage({ id: m.id, blob })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id: m.id, erro: (err as Error)?.message || 'falha' })
  }
}
