// mae-render — CLIENTE do motor (lado da página). Fala com o Web Worker; se o navegador não deixar
// criar o Worker, roda a MESMA função `renderizarPrancheta` aqui mesmo (mais lento, mesmo resultado).
// Só navegador (usa Worker/OffscreenCanvas) — por isso não sai pelo index do mae-render.
import type { Prancheta } from '../schema'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from './renderizar'
import { CacheCamadas } from './cache'
import { criarCanvasOffscreen, type PedidoWorker, type RespostaWorker } from './protocolo'

export interface SaidaRender { bitmap?: ImageBitmap; png?: Blob; faltando: string[]; w: number; h: number; ms: number; viaWorker: boolean }

export class MotorRender {
  private worker: Worker | null = null
  private seq = 0
  private esperando = new Map<number, { ok: (r: SaidaRender) => void; erro: (e: Error) => void }>()
  private enviados = new Map<string, Promise<void>>()
  private esperandoBitmap = new Map<string, { ok: () => void; erro: (e: Error) => void }>()
  // modo sem Worker
  private locais = new Map<string, ImageBitmap>()
  private cacheLocal = new CacheCamadas<CanvasLike>(200 * 1024 * 1024)

  constructor(usarWorker = true) {
    if (!usarWorker || typeof Worker === 'undefined') return
    try {
      this.worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module', name: 'mae-render' })
      this.worker.onmessage = (ev: MessageEvent<RespostaWorker>) => this.receber(ev.data)
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null }
    } catch { this.worker = null }
  }

  get usandoWorker() { return !!this.worker }

  private receber(r: RespostaWorker) {
    if (r.tipo === 'bitmap-ok') { this.esperandoBitmap.get(r.sha256)?.ok(); this.esperandoBitmap.delete(r.sha256); return }
    if (r.tipo === 'render-ok') {
      const p = this.esperando.get(r.id); this.esperando.delete(r.id)
      p?.ok({ bitmap: r.bitmap, png: r.png, faltando: r.faltando, w: r.w, h: r.h, ms: r.ms, viaWorker: true })
      return
    }
    if (r.id != null) { this.esperando.get(r.id)?.erro(new Error(r.mensagem)); this.esperando.delete(r.id) }
    if (r.sha256) { this.esperandoBitmap.get(r.sha256)?.erro(new Error(r.mensagem)); this.esperandoBitmap.delete(r.sha256); this.enviados.delete(r.sha256) }
  }

  /** Já recebeu este arquivo (pelo sha256)? */
  tem(sha256: string) { return this.enviados.has(sha256) }

  /** Entrega o arquivo de uma camada ao motor (uma vez por sha256). */
  enviarBitmap(sha256: string, blob: Blob): Promise<void> {
    const ja = this.enviados.get(sha256)
    if (ja) return ja
    const p = this.worker
      ? new Promise<void>((ok, erro) => {
          this.esperandoBitmap.set(sha256, { ok, erro })
          this.worker!.postMessage({ tipo: 'bitmap', sha256, blob } satisfies PedidoWorker)
        })
      : createImageBitmap(blob).then(b => { this.locais.set(sha256, b) })
    this.enviados.set(sha256, p)
    p.catch(() => this.enviados.delete(sha256))
    return p
  }

  /** Desenha a prancheta. `saida: 'png'` = arquivo final; `'bitmap'` = prévia da tela. */
  render(prancheta: Prancheta, pxPorMm: number, fundo: string | null, saida: 'bitmap' | 'png'): Promise<SaidaRender> {
    if (this.worker) {
      const id = ++this.seq
      return new Promise((ok, erro) => {
        this.esperando.set(id, { ok, erro })
        this.worker!.postMessage({ tipo: 'render', id, prancheta, pxPorMm, fundo, saida } satisfies PedidoWorker)
      })
    }
    return this.renderAqui(prancheta, pxPorMm, fundo, saida)
  }

  /** O mesmo render, na thread da página (sem Worker, ou para comparar nos testes). */
  async renderAqui(prancheta: Prancheta, pxPorMm: number, fundo: string | null, saida: 'bitmap' | 'png'): Promise<SaidaRender> {
    const t0 = performance.now()
    const { w, h } = tamanhoDoCanvas(prancheta, pxPorMm)
    const c = criarCanvasOffscreen(w, h) as unknown as OffscreenCanvas
    const r = renderizarPrancheta(c as unknown as CanvasLike, prancheta, {
      pxPorMm, fundo, criarCanvas: criarCanvasOffscreen, bitmap: s => this.locais.get(s), cache: this.cacheLocal,
    })
    const base = { faltando: r.faltando, w, h, ms: performance.now() - t0, viaWorker: false }
    return saida === 'png' ? { ...base, png: await c.convertToBlob({ type: 'image/png' }) } : { ...base, bitmap: c.transferToImageBitmap() }
  }

  /** Para os testes: carrega também na thread da página (para comparar Worker × página). */
  async enviarBitmapLocal(sha256: string, blob: Blob) { if (!this.locais.has(sha256)) this.locais.set(sha256, await createImageBitmap(blob)) }

  encerrar() { this.worker?.terminate(); this.worker = null }
}
