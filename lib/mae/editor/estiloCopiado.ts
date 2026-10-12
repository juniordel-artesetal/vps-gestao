// MAE — COPIAR E COLAR ESTILO (Lote 9, item 145; ideia da Naty). Puro.
// Copia de um objeto (texto, elemento, forma, moldurinha, papel, aplique) TUDO o que foi aplicado e cola em outro —
// só o que faz sentido entre os tipos (texto → elemento: os efeitos sim, a fonte não). Os efeitos colados se ajustam
// ao TAMANHO do destino (a mesma regra do preset proporcional, item 130): traçado de 1 mm num nome de 15 mm vira
// 0,33 mm num nome de 5 mm.
import { escalarEfeitos } from '../efeitos/presets'
import type { EstiloTexto } from '../schema'

export type CategoriaEstilo = 'efeitos' | 'texto' | 'preenchimento' | 'opacidade' | 'tamanho'
export const ROTULO_CATEGORIA: Record<CategoriaEstilo, string> = {
  efeitos: 'Efeitos (traçado, sombra, brilho…)',
  texto: 'Fonte e formatação do texto',
  preenchimento: 'Cor / papel de preenchimento',
  opacidade: 'Opacidade e mesclagem',
  tamanho: 'Tamanho e giro',
}

export interface EstiloCopiado {
  origem: 'texto' | 'camada'
  /** Altura (mm) do objeto de origem — base para ajustar os efeitos ao destino. */
  alturaMm: number | null
  efeitos?: unknown[]
  /** Fonte e formatação (sem os efeitos e sem o fundo, que é do texto). */
  texto?: Partial<EstiloTexto>
  preenchimento?: { cor?: string | null; papel?: { path: string; sha256: string; aspect?: number } | null; textura?: unknown }
  opacidade?: { opacity?: number; blendMode?: string; fillOpacity?: number }
  tamanho?: { scale?: number; rotationDeg?: number }
}

type CamadaLike = { type: string; effects?: unknown[]; opacity?: number; blendMode?: string; fillOpacity?: number; transform?: { scale?: number; rotationDeg?: number }; fill?: string | null; color?: string; path?: string; sha256?: string; aspect?: number; anchor?: string }
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x))

/** Copia de uma camada do tema. */
export function copiarDeCamada(c: CamadaLike, alturaMm: number | null): EstiloCopiado {
  const e: EstiloCopiado = { origem: 'camada', alturaMm }
  if (c.effects?.length) e.efeitos = copia(c.effects)
  if (c.type === 'shape') e.preenchimento = { cor: c.fill ?? null }
  else if (c.type === 'solid') e.preenchimento = { cor: c.color ?? null }
  else if (c.type === 'image' && c.anchor === 'paper' && c.path && c.sha256) e.preenchimento = { papel: { path: c.path, sha256: c.sha256, aspect: c.aspect } }
  e.opacidade = { opacity: c.opacity, blendMode: c.blendMode, fillOpacity: c.fillOpacity }
  if (c.transform) e.tamanho = { scale: c.transform.scale, rotationDeg: c.transform.rotationDeg }
  return e
}

/** Copia de um texto (o estilo da variável). */
export function copiarDeTexto(st: EstiloTexto, alturaMm: number | null): EstiloCopiado {
  const { effects, fundo, ...resto } = copia(st) as EstiloTexto & { effects?: unknown[]; fundo?: unknown }
  void fundo
  const e: EstiloCopiado = { origem: 'texto', alturaMm, texto: resto }
  if (effects?.length) e.efeitos = effects
  const tx = (st as { textura?: unknown }).textura
  e.preenchimento = { cor: st.color, ...(tx ? { textura: copia(tx) } : {}) }
  const sc = (st as { sizeScale?: number }).sizeScale, rot = (st as { rotationDeg?: number }).rotationDeg
  if (sc !== undefined || rot !== undefined) e.tamanho = { scale: sc, rotationDeg: rot }
  return e
}

/** O que dá para colar no destino (o resto não se aplica a esse tipo). */
export function categoriasCompativeis(e: EstiloCopiado, destino: 'texto' | 'camada', tipoCamada?: string): CategoriaEstilo[] {
  const out: CategoriaEstilo[] = []
  if (e.efeitos?.length) out.push('efeitos')
  if (destino === 'texto' && e.texto) out.push('texto')
  if (e.preenchimento) {
    const temCor = e.preenchimento.cor != null, temPapel = !!e.preenchimento.papel || !!e.preenchimento.textura
    if (destino === 'texto' ? temCor || !!e.preenchimento.textura : (tipoCamada === 'shape' || tipoCamada === 'solid') ? temCor : tipoCamada === 'image' ? temPapel && !!e.preenchimento.papel : false) out.push('preenchimento')
  }
  if (destino === 'camada' && e.opacidade && (e.opacidade.opacity !== undefined || e.opacidade.blendMode || e.opacidade.fillOpacity !== undefined)) out.push('opacidade')
  if (e.tamanho && (e.tamanho.scale !== undefined || e.tamanho.rotationDeg !== undefined) && e.origem === destino) out.push('tamanho')
  return out
}

const fatorAltura = (de: number | null, para: number | null) => (de && para && de > 0 && para > 0 ? Math.max(0.15, Math.min(4, para / de)) : 1)

/** Cola numa camada (muta). */
export function colarEmCamada(c: CamadaLike & Record<string, unknown>, e: EstiloCopiado, cats: CategoriaEstilo[], alturaMm: number | null): void {
  const ok = new Set(categoriasCompativeis(e, 'camada', c.type).filter(x => cats.includes(x)))
  if (ok.has('efeitos')) c.effects = escalarEfeitos(e.efeitos, fatorAltura(e.alturaMm, alturaMm)) as unknown[]
  if (ok.has('preenchimento')) {
    if (c.type === 'shape') c.fill = e.preenchimento!.cor ?? null
    else if (c.type === 'solid' && e.preenchimento!.cor) c.color = e.preenchimento!.cor
    else if (c.type === 'image' && e.preenchimento!.papel) { c.path = e.preenchimento!.papel.path; c.sha256 = e.preenchimento!.papel.sha256; if (e.preenchimento!.papel.aspect) c.aspect = e.preenchimento!.papel.aspect }
  }
  if (ok.has('opacidade')) {
    const o = e.opacidade!
    if (o.opacity === undefined || o.opacity >= 1) delete c.opacity; else c.opacity = o.opacity
    if (!o.blendMode || o.blendMode === 'normal') delete c.blendMode; else c.blendMode = o.blendMode
    if (o.fillOpacity === undefined || o.fillOpacity >= 1) delete c.fillOpacity; else c.fillOpacity = o.fillOpacity
  }
  if (ok.has('tamanho')) c.transform = { ...(c.transform ?? {}), ...(e.tamanho!.scale !== undefined ? { scale: e.tamanho!.scale } : {}), ...(e.tamanho!.rotationDeg !== undefined ? { rotationDeg: e.tamanho!.rotationDeg } : {}) }
}

/** Cola num estilo de texto (muta). O fundo (faixa) do destino fica como está. */
export function colarEmTexto(st: EstiloTexto & Record<string, unknown>, e: EstiloCopiado, cats: CategoriaEstilo[], alturaMm: number | null): void {
  const ok = new Set(categoriasCompativeis(e, 'texto').filter(x => cats.includes(x)))
  if (ok.has('texto')) for (const [k, v] of Object.entries(e.texto!)) if (k !== 'sizeScale' && k !== 'rotationDeg') (st as Record<string, unknown>)[k] = copia(v)
  if (ok.has('efeitos')) (st as { effects?: unknown[] }).effects = escalarEfeitos(e.efeitos, fatorAltura(e.alturaMm, alturaMm)) as unknown[]
  if (ok.has('preenchimento')) {
    if (e.preenchimento!.cor) st.color = e.preenchimento!.cor
    if (e.preenchimento!.textura) (st as { textura?: unknown }).textura = copia(e.preenchimento!.textura)
  }
  if (ok.has('tamanho')) {
    if (e.tamanho!.scale !== undefined) (st as { sizeScale?: number }).sizeScale = e.tamanho!.scale
    if (e.tamanho!.rotationDeg !== undefined) (st as { rotationDeg?: number }).rotationDeg = e.tamanho!.rotationDeg
  }
}
