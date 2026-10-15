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

/**
 * Lote 18 (item 215): TEXTOS REPETIDOS na base — mais de um texto da base (sem dono) com a mesma variável na mesma
 * face (o 2º "Nome + idade" do rótulo Nutella, que veio de um "Duplicar" num tema e foi para os 47). O 1º (o de cima)
 * fica; os outros são os repetidos.
 */
export function textosRepetidos(d: Pick<DocTrabalho, 'textSlots'>): { manter: Slot; repetidos: Slot[] }[] {
  const grupos = new Map<string, Slot[]>()
  for (const s of d.textSlots) {
    if (s.tema) continue
    const k = `${s.faceId}|${s.variable}`
    grupos.set(k, [...(grupos.get(k) ?? []), s])
  }
  return [...grupos.values()].filter(g => g.length > 1).map(g => {
    const o = [...g].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    return { manter: o[0], repetidos: o.slice(1) }
  })
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
