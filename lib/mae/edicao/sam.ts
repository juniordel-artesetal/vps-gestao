// mae-edição — SELEÇÃO DE OBJETO AUTOMÁTICA (Sprint 10): SlimSAM (Segment Anything, ~14 MB) rodando NO
// NAVEGADOR com o Transformers.js. Só carrega quando a usuária usa a ferramenta "Objeto". Versões FIXADAS
// (Transformers.js 3.7.6 → onnxruntime-web 1.22, evitando o 1.21) e backend WASM (determinístico, sem
// GPU). Vem do CDN (não é dependência do npm: o pacote puxaria onnxruntime-node e sharp para o build).
// A imagem não sai do computador — só o modelo é baixado (e fica no cache do navegador).
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Selecao } from './selecao'

export const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6'
export const MODELO_SAM = 'Xenova/slimsam-77-uniform'

interface Sam { tf: any; model: any; processor: any }
let samP: Promise<Sam> | null = null

/** import() do CDN sem passar pelo bundler. */
const importarUrl = (u: string): Promise<any> => (new Function('u', 'return import(u)') as (u: string) => Promise<any>)(u)

export function carregarSam(aoProgredir?: (p: { arquivo?: string; progresso?: number }) => void): Promise<Sam> {
  samP ??= (async () => {
    const tf = await importarUrl(TRANSFORMERS_URL)
    tf.env.allowLocalModels = false
    const cb = (p: any) => aoProgredir?.({ arquivo: p?.file, progresso: p?.progress })
    const model = await tf.SamModel.from_pretrained(MODELO_SAM, { device: 'wasm', dtype: 'fp32', progress_callback: cb })
    const processor = await tf.AutoProcessor.from_pretrained(MODELO_SAM, { progress_callback: cb })
    return { tf, model, processor }
  })()
  samP.catch(() => { samP = null })
  return samP
}

/** Embeddings de uma imagem (o passo pesado) — guardados para os próximos cliques na mesma imagem. */
export interface ImagemSam { w: number; h: number; entrada: any; embeddings: any }

export async function prepararImagem(rgba: Uint8ClampedArray, w: number, h: number, aoProgredir?: (p: { arquivo?: string; progresso?: number }) => void): Promise<ImagemSam> {
  const { tf, model, processor } = await carregarSam(aoProgredir)
  const img = new tf.RawImage(new Uint8ClampedArray(rgba), w, h, 4).rgb()
  const entrada = await processor(img)
  const embeddings = await model.get_image_embeddings(entrada)
  return { w, h, entrada, embeddings }
}

/**
 * Pontos clicados (px da imagem; positivo = "é o objeto", negativo = "não é") → seleção do objeto
 * (a melhor das 3 máscaras do SAM pela nota de IoU).
 */
export async function segmentar(im: ImagemSam, pontos: { x: number; y: number; positivo: boolean }[]): Promise<Selecao> {
  const { tf, model, processor } = await carregarSam()
  const [rh, rw] = im.entrada.reshaped_input_sizes[0]
  const pts = pontos.flatMap(p => [(p.x / im.w) * rw, (p.y / im.h) * rh])
  const input_points = new tf.Tensor('float32', pts, [1, 1, pontos.length, 2])
  const input_labels = new tf.Tensor('int64', pontos.map(p => BigInt(p.positivo ? 1 : 0)), [1, 1, pontos.length])
  const out = await model({ ...im.embeddings, input_points, input_labels })
  const masks = await processor.post_process_masks(out.pred_masks, im.entrada.original_sizes, im.entrada.reshaped_input_sizes)
  const m = masks[0]                              // [1, 3, H, W]
  const notas: number[] = Array.from(out.iou_scores.data as Float32Array)
  const melhor = notas.indexOf(Math.max(...notas))
  const H = m.dims[2], W = m.dims[3], dados = m.data as Uint8Array
  const a = new Uint8ClampedArray(im.w * im.h)
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const sx = Math.min(W - 1, Math.floor((x / im.w) * W)), sy = Math.min(H - 1, Math.floor((y / im.h) * H))
    a[y * im.w + x] = dados[melhor * W * H + sy * W + sx] ? 255 : 0
  }
  return { w: im.w, h: im.h, a }
}
