// SOA Edition — executor das ações em lote (só navegador). Usa o Web Worker quando o navegador
// tem OffscreenCanvas; senão processa na página, cedendo a vez entre uma imagem e outra.
import { processarImagem, codificar, type Operacao, type Saida } from './acoes'

export interface ItemLote { nome: string; arquivo: Blob }
export interface SaidaLote { nome: string; blob: Blob }

async function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('marca d’água não carregou')); i.src = url })
}

const trocarExt = (nome: string, f: Saida['formato']) => `${nome.replace(/\.[^.]+$/, '')}.${f}`

export async function processarLote(
  itens: ItemLote[], ops: Operacao[], saida: Saida,
  p: { aoProgredir: (feitos: number, total: number) => void; cancelado: () => boolean; autorizar: (i: number) => Promise<void> },
): Promise<{ ok: SaidaLote[]; falhas: string[] }> {
  const marcaOp = ops.find(o => o.op === 'marcaDagua' && o.tipo === 'imagem') as Extract<Operacao, { op: 'marcaDagua' }> | undefined
  const marcaImg = marcaOp?.assetUrl ? await carregarImagem(marcaOp.assetUrl) : null
  const ok: SaidaLote[] = [], falhas: string[] = []

  let inicio = 0
  const podeWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined'
  if (podeWorker) {
    let w: Worker | null = null
    try { w = new Worker(new URL('./lote.worker.ts', import.meta.url), { type: 'module' }) } catch { w = null }
    if (w) {
      try {
        w.postMessage({ tipo: 'marca', imagem: marcaImg ? await createImageBitmap(marcaImg) : null })
        for (; inicio < itens.length; inicio++) {
          const i = inicio
          if (p.cancelado()) throw new Error('cancelado')
          await p.autorizar(i)
          const r = await new Promise<{ blob?: Blob; erro?: string }>(res => {
            w!.onmessage = e => res(e.data); w!.onerror = () => res({ erro: 'worker' })
            w!.postMessage({ tipo: 'item', id: i, arquivo: itens[i].arquivo, ops, saida })
          })
          if (r.erro === 'worker') break // o worker não subiu/caiu → o resto segue na página
          if (r.blob) ok.push({ nome: trocarExt(itens[i].nome, saida.formato), blob: r.blob })
          else falhas.push(`${itens[i].nome}: ${r.erro}`)
          p.aoProgredir(i + 1, itens.length)
        }
        if (inicio >= itens.length) return { ok, falhas }
      } finally { w.terminate() }
    }
  }
  // Sem Worker (ou ele caiu): mesma função, na página.
  for (let i = inicio; i < itens.length; i++) {
    if (p.cancelado()) throw new Error('cancelado')
    await p.autorizar(i)
    try {
      const url = URL.createObjectURL(itens[i].arquivo)
      const img = await carregarImagem(url).finally(() => URL.revokeObjectURL(url))
      const c = processarImagem(img as HTMLImageElement & { width: number; height: number }, ops, marcaImg)
      ok.push({ nome: trocarExt(itens[i].nome, saida.formato), blob: await codificar(c, saida) })
    } catch (e) { falhas.push(`${itens[i].nome}: ${(e as Error).message}`) }
    p.aoProgredir(i + 1, itens.length)
    await new Promise(r => setTimeout(r, 0))
  }
  return { ok, falhas }
}
