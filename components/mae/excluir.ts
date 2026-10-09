// Lote 5 (item 53): EXCLUIR o que está selecionado — uma função só para a tecla Delete/Backspace, a lixeira do
// painel e o "Excluir" do clique direito. Ctrl+Z desfaz (tudo passa pela linha do tempo da base/tema).
//   • texto (NOME, IDADE…): sai SÓ aquela caixa (as outras posições da variável ficam);
//   • camada do tema: exclusiva da caixa → sai; vinculada com "Só nesta caixa" → some só ali; vinculada com
//     "Todas" → pergunta "Excluir de todas as N caixas?";
//   • logo/QR no Tema = travados ("destrave para excluir" na Base).
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { acharCamadaTema, ajustarSoNaFace, removerCamadaTema } from '@/lib/mae/vinculo/tema'
import { parteDaFace } from '@/lib/mae/vinculo/partes'
import type { DocTema } from '@/lib/mae/schema'
import { useEditor } from './estado'

export type ResultadoExcluir = 'excluido' | 'travado' | 'cancelado' | 'nada'

/** O que a seleção atual é (para a lixeira dizer o que vai sair). */
export function oQueEstaSelecionado(): { tipo: 'texto' | 'camada' | 'identidade'; nome: string } | null {
  const ed = useEditor.getState()
  const d = useMaeDoc.getState().hist.atual
  if (ed.slot) { const s = d.textSlots.find(t => t.id === ed.slot); if (s) return { tipo: 'texto', nome: s.variable } }
  if (ed.modo === 'tema' && ed.camada) {
    const t = useMaeTema.getState().hist?.atual
    const a = t ? acharCamadaTema(t as DocTema, ed.camada) : null
    if (a) return { tipo: 'camada', nome: (a.c as { name?: string }).name ?? 'Camada' }
  }
  if (ed.identSel) return { tipo: 'identidade', nome: ed.identSel.k === 'logo' ? 'Logo' : 'QR' }
  return null
}

export function excluirSelecionado(confirmar: (msg: string) => boolean = m => window.confirm(m)): ResultadoExcluir {
  const ed = useEditor.getState()
  const d = useMaeDoc.getState().hist.atual
  // a seleção de cada passo da Base só conta no passo dela
  const comTexto = ed.modo === 'tema' || (ed.modo === 'base' && ed.passo === 6)
  const comIdent = ed.modo === 'tema' || (ed.modo === 'base' && ed.passo === 7)
  // texto: a posição daquela caixa (as cópias nas outras caixas continuam)
  if (ed.slot && comTexto) {
    const s = d.textSlots.find(t => t.id === ed.slot)
    if (s) {
      useMaeDoc.getState().aplicar(`Excluir ${s.variable} desta caixa`, dd => { dd.textSlots = dd.textSlots.filter(t => t.id !== s.id) })
      if (useMaeTema.getState().hist?.atual.textSlotAdjust?.[s.id]) useMaeTema.getState().aplicar('Excluir ajuste do texto', t => { delete (t as DocTema).textSlotAdjust?.[s.id] })
      useEditor.getState().set({ slot: null })
      return 'excluido'
    }
  }
  if (ed.modo === 'tema' && ed.camada) {
    const t = useMaeTema.getState().hist?.atual
    const a = t ? acharCamadaTema(t as DocTema, ed.camada) : null
    if (a) {
      const nome = (a.c as { name?: string }).name ?? 'camada'
      const id = ed.camada
      if (a.faceId) {
        useMaeTema.getState().aplicar(`Excluir ${nome} (só nesta caixa)`, tt => removerCamadaTema(tt as DocTema, id))
      } else if (ed.escopo === 'face' && ed.face && parteDaFace(d, ed.face)?.id === a.partId) {
        const face = ed.face
        useMaeTema.getState().aplicar(`Excluir ${nome} só nesta caixa`, tt => ajustarSoNaFace(tt as DocTema, face, id, { visible: false }))
      } else {
        const parte = d.parts.find(p => p.id === a.partId)
        const n = parte?.instances.length ?? 0
        if (n > 1 && !confirmar(`Excluir "${nome}" de todas as ${n} caixas (${parte?.name ?? 'parte'})?`)) return 'cancelado'
        useMaeTema.getState().aplicar(`Excluir ${nome}${n > 1 ? ` de ${n} caixas` : ''}`, tt => removerCamadaTema(tt as DocTema, id))
      }
      useEditor.getState().set({ camada: null })
      return 'excluido'
    }
  }
  if (ed.identSel && comIdent) {
    if (ed.modo === 'tema') return 'travado'
    const { moldeId, k } = ed.identSel
    useMaeDoc.getState().aplicar(k === 'logo' ? 'Excluir logo' : 'Excluir QR', dd => { const m = dd.molds.find(x => x.id === moldeId); if (m?.identity) delete m.identity[k] })
    useEditor.getState().set({ identSel: null })
    return 'excluido'
  }
  return 'nada'
}
