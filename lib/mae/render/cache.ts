// mae-render — CACHE de bitmap por camada (desempenho). Guarda a imagem de cada camada JÁ na escala
// em que está sendo desenhada (reamostrar um papel de 4000 px a cada quadro é o que pesa). A chave
// tem só o que muda o raster (arquivo, tamanho, rotação, escala): mover, mudar opacidade ou modo de
// mesclagem NÃO invalida. Mudou algo do raster → chave nova → o antigo sai pelo LRU.
// Limite por bytes (largura × altura × 4), para a edição em massa não estourar a memória.

export interface ItemCache<T> { valor: T; bytes: number }

export class CacheCamadas<T = unknown> {
  private mapa = new Map<string, ItemCache<T>>()
  private total = 0
  acertos = 0
  faltas = 0
  constructor(readonly limiteBytes = 300 * 1024 * 1024, private aoDescartar?: (v: T) => void) {}

  get(chave: string): T | undefined {
    const it = this.mapa.get(chave)
    if (!it) { this.faltas++; return undefined }
    this.acertos++
    this.mapa.delete(chave); this.mapa.set(chave, it)   // vira o mais recente (LRU)
    return it.valor
  }

  set(chave: string, valor: T, bytes: number): void {
    const velho = this.mapa.get(chave)
    if (velho) { this.total -= velho.bytes; this.mapa.delete(chave); if (velho.valor !== valor) this.aoDescartar?.(velho.valor) }
    this.mapa.set(chave, { valor, bytes })
    this.total += bytes
    for (const [k, it] of this.mapa) {
      if (this.total <= this.limiteBytes || this.mapa.size <= 1) break
      this.mapa.delete(k); this.total -= it.bytes; this.aoDescartar?.(it.valor)
    }
  }

  get tamanho() { return this.mapa.size }
  get bytes() { return this.total }
  limpar() { for (const it of this.mapa.values()) this.aoDescartar?.(it.valor); this.mapa.clear(); this.total = 0 }
}

/** Chave estável do raster de uma camada de imagem na escala dada (px por mm). */
export function chaveRaster(sha256: string, wMm: number, hMm: number, rotationDeg: number, pxPorMm: number): string {
  const r = (n: number) => Math.round(n * 1000) / 1000
  return `${sha256}|${r(wMm)}x${r(hMm)}|${r(rotationDeg)}|${r(pxPorMm)}`
}
