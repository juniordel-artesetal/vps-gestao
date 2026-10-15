'use client'
// Lote 18 (itens 215/222): na tela, o doc da base com só os textos que valem no tema aberto (no modo Base, só os da
// base); e os textos criados no modo Tema nascem com o dono = o tema aberto (nunca vão para os outros temas).
import { useMemo } from 'react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { comTextosDoTema } from '@/lib/mae/vinculo/textosDoTema'
import { useEditor } from './estado'

/** O id do tema aberto quando a tela está no modo Tema (senão null). */
export const temaAbertoId = (): string | null => useEditor.getState().modo === 'tema' ? (useMaeTema.getState().hist?.atual?.id ?? null) : null
/** O doc da base com os textos que valem agora (leitura). */
export const docVisivel = () => comTextosDoTema(useMaeDoc.getState().hist.atual, temaAbertoId())
export const idsDosTextos = () => new Set(useMaeDoc.getState().hist.atual.textSlots.map(t => t.id))
export function useDocVisivel() {
  const d = useMaeDoc(s => s.hist.atual)
  const modo = useEditor(s => s.modo)
  const id = useMaeTema(s => s.hist?.atual?.id ?? null)
  return useMemo(() => comTextosDoTema(d, modo === 'tema' ? id : null), [d, modo, id])
}
