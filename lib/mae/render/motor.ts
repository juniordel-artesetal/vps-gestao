// mae-render — CLIENTE do motor (lado da página). Fala com o Web Worker; se o navegador não deixar
// criar o Worker, roda a MESMA função `renderizarPrancheta` aqui mesmo (mais lento, mesmo resultado).
// Só navegador (usa Worker/OffscreenCanvas) — por isso não sai pelo index do mae-render.
import type { Prancheta } from '../schema'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from './renderizar'
import { CacheCamadas } from './cache'
import { criarCanvasOffscreen, type PedidoWorker, type RespostaWorker } from './protocolo'

export interface SaidaRender { bitmap?: ImageBitmap; png?: Blob; faltando: string[]; w: number; h: number; ms: number; viaWorker: boolean }

/**
 * Lote 9 (item 135): quantos Workers de desenho — as pranchetas de um kit são desenhadas EM PARALELO (antes, uma
 * atrás da outra num Worker só: 9 pranchetas = 9× o tempo de uma). Deixa um núcleo para a página; no máximo 3.
 */
function quantosWorkers(): number {
  const n = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  return Math.max(1, Math.min(3, n - 1))
}

export class MotorRender {
  private workers: Worker[] = []
  /** Pedidos em andamento por Worker (o próximo render vai para o mais livre). */
  private ocupacao: number[] = []
  private seq = 0
  private esperando = new Map<number, { ok: (r: SaidaRender) => void; erro: (e: Error) => void; w: number }>()
  private enviados = new Map<string, Promise<void>>()
  private esperandoBitmap = new Map<string, { ok: () => void; erro: (e: Error) => void }>()
  // modo sem Worker
  private locais = new Map<string, ImageBitmap>()
  private cacheLocal = new CacheCamadas<CanvasLike>(200 * 1024 * 1024)

  constructor(usarWorker = true, nWorkers = quantosWorkers()) {
    if (!usarWorker || typeof Worker === 'undefined') return
    for (let i = 0; i < nWorkers; i++) {
      try {
        const w = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module', name: `mae-render-${i + 1}` })
        const idx = this.workers.length
        w.onmessage = (ev: MessageEvent<RespostaWorker>) => this.receber(ev.data, idx)
        // Worker que falha sai do conjunto; sem nenhum, o desenho volta para a página (mesmo resultado)
        w.onerror = () => { w.terminate(); this.workers = this.workers.filter(x => x !== w) }
        this.workers.push(w); this.ocupacao.push(0)
      } catch { break }
    }
  }

  get usandoWorker() { return this.workers.length > 0 }
  /** Quantos Workers desenham em paralelo (para os testes e o "?" de desempenho). */
  get paralelos() { return Math.max(1, this.workers.length) }

  private receber(r: RespostaWorker, idx: number) {
    if (r.tipo === 'bitmap-ok') { const k = `${r.sha256}#${idx}`; this.esperandoBitmap.get(k)?.ok(); this.esperandoBitmap.delete(k); return }
    if (r.tipo === 'render-ok') {
      const p = this.esperando.get(r.id); this.esperando.delete(r.id)
      if (p) this.ocupacao[p.w] = Math.max(0, (this.ocupacao[p.w] ?? 1) - 1)
      p?.ok({ bitmap: r.bitmap, png: r.png, faltando: r.faltando, w: r.w, h: r.h, ms: r.ms, viaWorker: true })
      return
    }
    if (r.id != null) {
      const p = this.esperando.get(r.id)
      if (p) this.ocupacao[p.w] = Math.max(0, (this.ocupacao[p.w] ?? 1) - 1)
      p?.erro(new Error(r.mensagem)); this.esperando.delete(r.id)
    }
    if (r.sha256) { const k = `${r.sha256}#${idx}`; this.esperandoBitmap.get(k)?.erro(new Error(r.mensagem)); this.esperandoBitmap.delete(k); this.enviados.delete(r.sha256) }
  }

  /** Já recebeu este arquivo (pelo sha256)? */
  tem(sha256: string) { return this.enviados.has(sha256) }

  /** Entrega o arquivo de uma camada ao motor (uma vez por sha256). */
  enviarBitmap(sha256: string, blob: Blob): Promise<void> {
    const ja = this.enviados.get(sha256)
    if (ja) return ja
    // cada Worker guarda a sua cópia (qualquer um pode desenhar qualquer prancheta)
    const p = this.workers.length
      ? Promise.all(this.workers.map((w, i) => new Promise<void>((ok, erro) => {
          this.esperandoBitmap.set(`${sha256}#${i}`, { ok, erro })
          w.postMessage({ tipo: 'bitmap', sha256, blob } satisfies PedidoWorker)
        }))).then(() => undefined)
      : createImageBitmap(blob).then(b => { this.locais.set(sha256, b) })
    this.enviados.set(sha256, p)
    p.catch(() => this.enviados.delete(sha256))
    return p
  }

  /**
   * Desenha a prancheta. `saida: 'png'` = arquivo final; `'bitmap'` = prévia da tela.
   * `tela` (só a prévia do editor): efeitos guardados entre um render e outro + desfoque em meia resolução, e a
   * prancheta vai sempre para o MESMO Worker (é lá que está o cache dela). Exportação/aprovação: sem `tela`.
   */
  render(prancheta: Prancheta, pxPorMm: number, fundo: string | null, saida: 'bitmap' | 'png', tela = false): Promise<SaidaRender> {
    if (this.workers.length) {
      const id = ++this.seq
      // tela: Worker fixo pela prancheta; senão, o com menos pedidos na fila
      let wi = 0
      if (tela) { let h = 0; for (const ch of prancheta.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; wi = h % this.workers.length }
      else for (let i = 1; i < this.workers.length; i++) if ((this.ocupacao[i] ?? 0) < (this.ocupacao[wi] ?? 0)) wi = i
      this.ocupacao[wi] = (this.ocupacao[wi] ?? 0) + 1
      return new Promise((ok, erro) => {
        this.esperando.set(id, { ok, erro, w: wi })
        this.workers[wi].postMessage({ tipo: 'render', id, prancheta, pxPorMm, fundo, saida, tela } satisfies PedidoWorker)
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

  encerrar() { this.workers.forEach(w => w.terminate()); this.workers = []; this.ocupacao = [] }
}
