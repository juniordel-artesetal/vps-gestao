// SOA Edition — leitura de PSD/PSB FORA da tela principal (Web Worker), camada por camada (lib/estudio/psdLeve):
// PSD grande não trava a UI nem estoura a memória. Recebe o File (sem cópia na página), avisa o progresso por
// camada e devolve a árvore LEVE (cada camada = WebP já reduzido para a resolução de trabalho).
import { lerPsdLeve, LADO_TRABALHO } from './psdLeve'

self.onmessage = async (e: MessageEvent<{ arquivo: File; maxLado?: number }>) => {
  const w = self as unknown as Worker
  try {
    const buf = await e.data.arquivo.arrayBuffer()
    const psd = await lerPsdLeve(buf, e.data.maxLado || LADO_TRABALHO, (feitas, total) => w.postMessage({ tipo: 'progresso', feitas, total }))
    w.postMessage({ tipo: 'fim', psd })
  } catch (err) {
    w.postMessage({ tipo: 'erro', erro: (err as Error)?.message || 'PSD ilegível' })
  }
}
