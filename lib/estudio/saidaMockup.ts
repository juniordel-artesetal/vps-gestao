// SOA Design — SAÍDA de um mockup composto: sem cena (fundo branco no tamanho do canal), com cena pronta/dela
// (o produto recortado entra na cena) ou PNG transparente. Usado pelo "Usar mockup" e pelas saídas da caixa viva.
import { renderCena, novoCanvas, aparar } from './mockup'
import { recortarProduto, type MockupAreas } from './mockupFoto'
import { TAMANHOS_CANAIS } from './tamanhos'
import { cenaPronta } from './cenasProntas'
import type { ConfigCena } from './mockupTipos'

export type CenaSaida = ConfigCena | null | 'nenhuma'   // null = PNG transparente
const CENA_BRANCA = (): ConfigCena => ({ ...(cenaPronta('liso-branco')!.cena), produto: { cx: 0.5, cy: 0.52, altura: 0.8 } })

/** Produto sem o fundo: base transparente (acervo/faca) ou recorte da IA; foto sem recorte → null (a foto é a cena). */
export function produtoRecortado(cfg: MockupAreas | null | undefined, composto: HTMLCanvasElement): HTMLCanvasElement | null {
  if (!cfg || cfg.transparente) return aparar(composto)
  if (cfg.mascara?.length) return aparar(recortarProduto(composto, cfg.mascara, cfg.furos || []))
  return null
}
export function renderSaida(cfg: MockupAreas | null | undefined, composto: HTMLCanvasElement, cena: CenaSaida, canal: string, imgs: Map<string, HTMLImageElement> = new Map()): HTMLCanvasElement {
  const rec = produtoRecortado(cfg, composto)
  if (cena === null) return rec || composto
  const t = TAMANHOS_CANAIS.find(x => x.id === canal)
  const W = t ? t.largura : composto.width, H = t ? t.altura : composto.height
  if (cena === 'nenhuma') {
    if (rec) return renderCena(rec, CENA_BRANCA(), W, H, undefined, true)
    const out = novoCanvas(W, H), g = out.getContext('2d')!, k = Math.min(W / composto.width, H / composto.height)
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = 'high'; g.drawImage(composto, (W - composto.width * k) / 2, (H - composto.height * k) / 2, composto.width * k, composto.height * k)
    return out
  }
  return renderCena(rec || composto, cena, t ? W : 1600, t ? H : 1600, u => imgs.get(u))
}
