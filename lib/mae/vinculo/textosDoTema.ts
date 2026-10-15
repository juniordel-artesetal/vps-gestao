// Lote 18 (itens 215/222): TEXTOS DO TEMA — o texto duplicado/colado no modo Tema é só daquele tema (o dono fica em
// `PosicaoTexto.tema`). Regra ÚNICA de quais textos valem: os da base (sem dono) + os do tema aberto. Puro.
import type { DocTrabalho } from '../schema'

type Slot = DocTrabalho['textSlots'][number]
/** O texto vale neste tema? (sem dono = da base, vale em todos). `temaId` null = modo Base: só os da base. */
export const textoVale = (s: { tema?: string | null }, temaId: string | null | undefined) => !s.tema || s.tema === temaId
/** O doc com só os textos que valem neste tema (o mesmo objeto quando nenhum texto tem dono). */
export function comTextosDoTema<T extends { textSlots: Slot[] }>(d: T, temaId: string | null | undefined): T {
  return d.textSlots.some(s => s.tema) ? { ...d, textSlots: d.textSlots.filter(s => textoVale(s, temaId)) } : d
}

/** Os textos criados agora (fora de `antes`) ficam com o dono `temaId` (no modo Tema); no modo Base, sem dono. */
export function marcarDono(d: { textSlots: { id: string; tema?: string }[] }, antes: Set<string>, temaId: string | null | undefined): void {
  if (!temaId) return
  for (const s of d.textSlots) if (!antes.has(s.id)) s.tema = temaId
}

/** Lote 19 (item 243): o tamanho (mm) da face — para medir "no mesmo lugar" em milímetros. */
function tamanhoDaFace(d: { molds?: DocTrabalho['molds'] }, faceId: string): { w: number; h: number } {
  for (const m of d.molds ?? []) {
    const f = m.faces.find(x => x.id === faceId)
    if (!f) continue
    const xs = (f.polygonMm as [number, number][]).map(p => p[0]), ys = (f.polygonMm as [number, number][]).map(p => p[1])
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  return { w: 100, h: 100 }
}
/** Lote 19 (item 243): dois textos estão "no mesmo lugar" (um em cima do outro) — centros a até `tolMm` mm. */
export function noMesmoLugar(d: { molds?: DocTrabalho['molds'] }, a: Slot, b: Slot, tolMm = 2): boolean {
  if (a.faceId !== b.faceId || a.variable !== b.variable) return false
  const t = tamanhoDaFace(d, a.faceId)
  const ca = [a.box.x + a.box.w / 2, a.box.y + a.box.h / 2], cb = [b.box.x + b.box.w / 2, b.box.y + b.box.h / 2]
  return Math.abs(ca[0] - cb[0]) * t.w <= tolMm && Math.abs(ca[1] - cb[1]) * t.h <= tolMm
}
export const chaveDoPar = (a: Slot, b: Slot) => [a.id, b.id].sort().join('|')

/**
 * Lote 18 (item 215) / Lote 19 (item 243): TEXTOS REPETIDOS na base — dois textos da base (sem dono) com a mesma
 * variável NO MESMO LUGAR (um em cima do outro, ±2 mm — o caso da Nutella). O mesmo nome em lugares diferentes (duas
 * faces, frente e verso) é intencional e NUNCA avisa; pares marcados "está certo assim" (`textosRepetidosOk`) também não.
 */
export function textosRepetidos(d: Pick<DocTrabalho, 'textSlots'> & { molds?: DocTrabalho['molds']; textosRepetidosOk?: string[] }): { manter: Slot; repetidos: Slot[] }[] {
  const ok = new Set(d.textosRepetidosOk ?? [])
  const usados = new Set<string>()
  const out: { manter: Slot; repetidos: Slot[] }[] = []
  const daBase = d.textSlots.filter(s => !s.tema)
  for (const a of daBase) {
    if (usados.has(a.id)) continue
    const iguais = daBase.filter(b => b.id !== a.id && !usados.has(b.id) && noMesmoLugar(d, a, b) && !ok.has(chaveDoPar(a, b)))
    if (!iguais.length) continue
    const o = [a, ...iguais].sort((x, y) => x.box.y - y.box.y || x.box.x - y.box.x)
    for (const s of o) usados.add(s.id)
    out.push({ manter: o[0], repetidos: o.slice(1) })
  }
  return out
}

/**
 * Lote 19 (item 233): texto repetido IDÊNTICO (mesma variável, mesma face, mesma caixa e mesma configuração) é limpo
 * sozinho, sem botão — não muda nada no desenho. Devolve quantos saíram (muda `d`).
 */
export function limparTextosIdenticos(d: { textSlots: Slot[] }): number {
  const chave = (s: Slot) => JSON.stringify({ ...s, id: undefined, box: { x: +s.box.x.toFixed(4), y: +s.box.y.toFixed(4), w: +s.box.w.toFixed(4), h: +s.box.h.toFixed(4) } })
  const vistos = new Set<string>()
  const antes = d.textSlots.length
  d.textSlots = d.textSlots.filter(s => { const k = chave(s); if (vistos.has(k)) return false; vistos.add(k); return true })
  return antes - d.textSlots.length
}

type TemaLike = { id: string; textSlotAdjust?: Record<string, { hidden?: boolean } & Record<string, unknown>> }
/** Onde o repetido aparece (tema que não o ocultou). */
export const repetidoVisivelEm = (t: TemaLike, slotId: string) => !t.textSlotAdjust?.[slotId]?.hidden

/**
 * Lote 18 (item 215): LIMPEZA — o repetido sai da base; nos temas MARCADOS ele vira texto daquele tema (uma cópia com
 * id novo, dono = o tema, com o ajuste que o tema tinha). Também tira dos temas os ajustes de textos que não existem
 * mais na base. Muda `d` e os temas (cópias); devolve os temas que mudaram.
 */
export function limparTextosRepetidos<T extends TemaLike>(d: { textSlots: Slot[] }, temas: T[], repetidos: string[], manterEm: Record<string, string[]>): T[] {
  const mudados = new Map<string, T>()
  const gid = (base: string, tema: string) => `${base}_${tema.slice(-6)}`.slice(0, 120)
  for (const rid of repetidos) {
    const s = d.textSlots.find(x => x.id === rid)
    if (!s) continue
    for (const tid of manterEm[rid] ?? []) {
      const t = mudados.get(tid) ?? temas.find(x => x.id === tid)
      if (!t) continue
      const novo = gid(rid, tid)
      if (!d.textSlots.some(x => x.id === novo)) d.textSlots.push({ ...JSON.parse(JSON.stringify(s)), id: novo, tema: tid })
      const c: T = mudados.get(tid) ?? JSON.parse(JSON.stringify(t))
      if (c.textSlotAdjust?.[rid]) { c.textSlotAdjust[novo] = { ...c.textSlotAdjust[rid] }; delete c.textSlotAdjust[novo].hidden }
      mudados.set(tid, c)
    }
    d.textSlots = d.textSlots.filter(x => x.id !== rid)
  }
  const ids = new Set(d.textSlots.map(x => x.id))
  for (const t of temas) {
    const c: T = mudados.get(t.id) ?? JSON.parse(JSON.stringify(t))
    const sobras = Object.keys(c.textSlotAdjust ?? {}).filter(k => !ids.has(k))
    if (!sobras.length) continue
    for (const k of sobras) delete c.textSlotAdjust![k]
    mudados.set(t.id, c)
  }
  return [...mudados.values()]
}
