// SOA Design — MOTOR DE APLIQUES (objeto independente da arte impressa: sai à parte, é recortado e colado).
// A artesã sobe SÓ o PNG do personagem; o SOA gera as camadas de baixo: cada uma = a silhueta de cima EXPANDIDA N mm
// (papel colorido, laminado metálico, textura), alinhadas na mesma âncora, com PROFUNDIDADE (fita dupla-face/espuma)
// simulada por sombra por camada. A geometria das silhuetas (mm) fica guardada — é o arquivo de corte do futuro.
// Cálculo pesado no Web Worker (lib/estudio/aplique.worker.ts); sem Worker, roda o mesmo núcleo aqui.
import { processar, type EntradaNucleo, type SaidaNucleo } from './apliqueNucleo'

export type TipoCamada = 'IMAGE' | 'SOLID_COLOR' | 'METALLIC' | 'CUSTOM_TEXTURE'
export type Metal = 'ouro' | 'prata' | 'rose' | 'holografico'
export interface SombraCamada { distanciaMm: number; desfoqueMm: number; opacidade: number; angulo: number }
export interface CamadaAplique {
  id: string; nome: string; tipo: TipoCamada
  /** mm além da camada de CIMA (a 1ª camada abaixo do personagem cresce a partir da silhueta dele) */
  expansaoMm: number
  cor: string; metal?: Metal; texturaUrl?: string | null
  /** espessura simulada (fita/espuma) — aumenta o afastamento da sombra */
  profundidadeMm: number
  sombra: SombraCamada
  ativa: boolean
}
export interface ConfigAplique { larguraMm: number; camadas: CamadaAplique[]; preencherVaos: boolean; sombraNoProduto: boolean }
export interface CamadaGerada { id: string; nome: string; tipo: TipoCamada; canvas: HTMLCanvasElement; raioMm: number; silhueta: [number, number][][] }
export interface ResultadoAplique {
  composto: HTMLCanvasElement
  camadas: CamadaGerada[]
  pxPorMm: number
  /** tamanho físico do aplique inteiro (mm) e onde fica o topo-esquerdo do personagem no composto (px) */
  larguraMm: number; alturaMm: number; origem: { x: number; y: number }
}

export const DPI_APLIQUE = 300, PX_MM_300 = DPI_APLIQUE / 25.4
const idc = () => Math.random().toString(36).slice(2, 9)
const SOMBRA_PADRAO: SombraCamada = { distanciaMm: 0.6, desfoqueMm: 1.2, opacidade: 38, angulo: 125 }
export const novaCamada = (tipo: TipoCamada, p: Partial<CamadaAplique> = {}): CamadaAplique => ({
  id: idc(), nome: tipo === 'IMAGE' ? 'Personagem' : tipo === 'METALLIC' ? 'Laminado' : tipo === 'CUSTOM_TEXTURE' ? 'Textura' : 'Papel',
  tipo, expansaoMm: tipo === 'IMAGE' ? 0 : 2, cor: '#f9a8d4', metal: 'ouro', texturaUrl: null, profundidadeMm: tipo === 'IMAGE' ? 1 : 0.5, sombra: { ...SOMBRA_PADRAO }, ativa: true, ...p,
})
/** Presets de fábrica (a artesã salva os dela). */
export const PRESETS_PADRAO: { nome: string; cfg: Omit<ConfigAplique, 'larguraMm'> & { larguraMm: number } }[] = [
  { nome: 'Dourado 2 camadas', cfg: { larguraMm: 60, preencherVaos: true, sombraNoProduto: true, camadas: [novaCamada('IMAGE'), novaCamada('METALLIC', { nome: 'Laminado dourado', expansaoMm: 3, metal: 'ouro', profundidadeMm: 1 }), novaCamada('SOLID_COLOR', { nome: 'Papel rosa', expansaoMm: 2, cor: '#f9a8d4' })] } },
  { nome: 'Borda branca simples', cfg: { larguraMm: 60, preencherVaos: true, sombraNoProduto: true, camadas: [novaCamada('IMAGE'), novaCamada('SOLID_COLOR', { nome: 'Papel branco', expansaoMm: 2.5, cor: '#ffffff', profundidadeMm: 1.5 })] } },
  { nome: 'Prata + azul', cfg: { larguraMm: 60, preencherVaos: true, sombraNoProduto: true, camadas: [novaCamada('IMAGE'), novaCamada('METALLIC', { nome: 'Laminado prata', expansaoMm: 2, metal: 'prata', profundidadeMm: 1 }), novaCamada('SOLID_COLOR', { nome: 'Papel azul', expansaoMm: 2.5, cor: '#93c5fd' })] } },
  { nome: 'Holográfico 3D', cfg: { larguraMm: 60, preencherVaos: true, sombraNoProduto: true, camadas: [novaCamada('IMAGE', { profundidadeMm: 2 }), novaCamada('METALLIC', { nome: 'Holográfico', expansaoMm: 2.5, metal: 'holografico', profundidadeMm: 2 }), novaCamada('SOLID_COLOR', { nome: 'Papel branco', expansaoMm: 2, cor: '#ffffff', profundidadeMm: 1 })] } },
]
/** Preset vira camadas novas (ids novos) — aplicar a outro personagem = 1 clique. */
export const configDoPreset = (c: ConfigAplique): ConfigAplique => ({ ...c, camadas: c.camadas.map(x => ({ ...x, id: idc(), sombra: { ...x.sombra } })) })

const rgbDe = (h: string): [number, number, number] => { const m = h.replace('#', ''), n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const cv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }

let worker: Worker | null = null, seq = 0
const esperando = new Map<number, { e: EntradaNucleo; res: (r: SaidaNucleo) => void; rej: (e: Error) => void }>()
let semWorker = false
/** Worker quando dá; se o Worker não subir/cair, o MESMO núcleo roda aqui (mais lento, mas nunca falha por isso). */
function noWorker(e: EntradaNucleo): Promise<SaidaNucleo> {
  const local = () => new Promise<SaidaNucleo>((res, rej) => setTimeout(() => { try { res(processar(e)) } catch (x) { rej(x as Error) } }, 0))
  if (semWorker) return local()
  try {
    if (!worker) {
      worker = new Worker(new URL('./aplique.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = ev => { const m = ev.data as { id: number; ok: boolean; r?: SaidaNucleo; erro?: string }; const p = esperando.get(m.id); if (!p) return; esperando.delete(m.id); if (m.ok) p.res(m.r!); else p.rej(new Error(m.erro)) }
      worker.onerror = () => {
        semWorker = true; worker?.terminate(); worker = null
        for (const p of esperando.values()) { try { p.res(processar(p.e)) } catch (x) { p.rej(x as Error) } }
        esperando.clear()
      }
    }
    const id = ++seq
    return new Promise((res, rej) => { esperando.set(id, { e, res, rej }); worker!.postMessage({ ...e, id }) })   // cópia (sem transferir): dá para refazer aqui se o Worker cair
  } catch { semWorker = true; return local() }
}

/**
 * Gera o aplique: camadas (para imprimir/cortar) + composto (com profundidade, fundo transparente).
 * `pxPorMm` = resolução (padrão 300 dpi); `maxLado` limita a prévia.
 */
export async function gerarAplique(png: CanvasImageSource & { width: number; height: number }, cfg: ConfigAplique, op: { pxPorMm?: number; maxLado?: number; texturas?: Map<string, CanvasImageSource> } = {}): Promise<ResultadoAplique> {
  const ativas = cfg.camadas.filter(c => c.ativa)
  if (!ativas.length) throw new Error('Ative pelo menos uma camada.')
  const pw = (png as HTMLImageElement).naturalWidth || png.width, ph = (png as HTMLImageElement).naturalHeight || png.height
  // raio acumulado de cada camada (de cima para baixo)
  let acc = 0
  const raios = ativas.map((c, i) => { if (i > 0 || c.tipo !== 'IMAGE') acc += c.tipo === 'IMAGE' && i === 0 ? 0 : Math.max(0, c.expansaoMm); return acc })
  const margemMm = acc + Math.max(...ativas.map(c => c.sombra.distanciaMm + c.profundidadeMm * 0.5 + c.sombra.desfoqueMm * 1.5)) + 1.5
  const alturaPersMm = cfg.larguraMm * (ph / pw)
  let k = op.pxPorMm || PX_MM_300
  const ladoMm = Math.max(cfg.larguraMm, alturaPersMm) + 2 * margemMm
  if (op.maxLado && ladoMm * k > op.maxLado) k = op.maxLado / ladoMm
  const W = Math.round((cfg.larguraMm + 2 * margemMm) * k), H = Math.round((alturaPersMm + 2 * margemMm) * k)
  const ox = Math.round(margemMm * k), oy = Math.round(margemMm * k), iw = Math.round(cfg.larguraMm * k), ih = Math.round(alturaPersMm * k)
  const base = cv(W, H), gb = base.getContext('2d', { willReadFrequently: true })!
  gb.imageSmoothingQuality = 'high'; gb.drawImage(png, ox, oy, iw, ih)
  const d = gb.getImageData(0, 0, W, H).data, alfa = new Uint8ClampedArray(W * H)
  for (let i = 0; i < W * H; i++) alfa[i] = d[i * 4 + 3]
  const saida = await noWorker({
    alfa, W, H, pxPorMm: k, preencherVaos: cfg.preencherVaos,
    camadas: ativas.map((c, i) => ({ raio: raios[i] * k, pinta: c.tipo === 'SOLID_COLOR' ? 'solido' : c.tipo === 'METALLIC' ? 'metal' : 'mascara', cor: rgbDe(c.cor || '#ffffff'), metal: c.metal })),
  })
  const camadas: CamadaGerada[] = ativas.map((c, i) => {
    const s = saida.camadas[i], out = cv(W, H), g = out.getContext('2d')!
    if (c.tipo === 'IMAGE') g.drawImage(base, 0, 0)
    else if (s.rgba) g.putImageData(new ImageData(new Uint8ClampedArray(s.rgba), W, H), 0, 0)
    else {
      // textura: repete a imagem dela dentro da silhueta (+ um toque de quina)
      const tex = c.texturaUrl ? op.texturas?.get(c.texturaUrl) : null
      if (tex) { g.fillStyle = g.createPattern(tex, 'repeat')!; g.fillRect(0, 0, W, H) } else { g.fillStyle = c.cor; g.fillRect(0, 0, W, H) }
      const m = cv(W, H), mg = m.getContext('2d')!, md = mg.createImageData(W, H)
      for (let p = 0; p < W * H; p++) md.data[p * 4 + 3] = s.alfa[p]
      mg.putImageData(md, 0, 0)
      g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0); g.globalCompositeOperation = 'source-over'
    }
    return { id: c.id, nome: c.nome, tipo: c.tipo, canvas: out, raioMm: raios[i], silhueta: s.contornos.map(r => r.map(([x, y]) => [+((x - ox) / k).toFixed(2), +((y - oy) / k).toFixed(2)] as [number, number])) }
  })
  // composto: de baixo para cima — a sombra de cada camada cai na de baixo (a de baixo, no produto)
  const composto = cv(W, H), gc = composto.getContext('2d')!
  for (let i = camadas.length - 1; i >= 0; i--) {
    const c = ativas[i], L = camadas[i].canvas
    const ehBase = i === camadas.length - 1
    if (!ehBase || cfg.sombraNoProduto) {
      const dist = (c.sombra.distanciaMm + c.profundidadeMm * 0.5) * k, a = (c.sombra.angulo * Math.PI) / 180
      gc.save()
      gc.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(100, c.sombra.opacidade)) / 100})`
      gc.shadowBlur = c.sombra.desfoqueMm * k; gc.shadowOffsetX = 20000 + Math.cos(a) * dist; gc.shadowOffsetY = Math.sin(a) * dist
      gc.drawImage(L, -20000, 0)
      gc.restore()
    }
    gc.drawImage(L, 0, 0)
  }
  return { composto, camadas, pxPorMm: k, larguraMm: W / k, alturaMm: H / k, origem: { x: ox, y: oy } }
}

/** Silhuetas em SVG (mm reais) — uma camada por grupo: base do arquivo de corte. */
export function svgDasSilhuetas(r: ResultadoAplique, nome = 'aplique'): string {
  const w = r.larguraMm, h = r.alturaMm, ox = r.origem.x / r.pxPorMm, oy = r.origem.y / r.pxPorMm
  const cores = ['#e11d48', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2']
  const grupos = r.camadas.map((c, i) => `  <g id="${c.nome.replace(/[^\w-]+/g, '_')}" fill="none" stroke="${cores[i % cores.length]}" stroke-width="0.2">\n${c.silhueta.map(anel => `    <path d="M${anel.map(([x, y]) => `${(x + ox).toFixed(2)} ${(y + oy).toFixed(2)}`).join(' L')} Z"/>`).join('\n')}\n  </g>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- SOA Design · ${nome} · silhuetas das camadas em mm (linha de corte) -->\n<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">\n${grupos.join('\n')}\n</svg>\n`
}
