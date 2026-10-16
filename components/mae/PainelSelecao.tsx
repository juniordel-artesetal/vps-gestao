'use client'
// Lote 14 (item 196): o painel da direita com VÁRIOS objetos selecionados (Shift + clique, ou Shift + arrastar numa área
// vazia): só o que é comum a todos — mexer vale para todos, com um Ctrl+Z. Valores diferentes entre eles aparecem
// como "—". Mover, redimensionar e girar: o contorno azul da seleção na arte (ou as setas).
import { Lock, Unlock, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Eye, EyeOff, Trash2, Columns3, Rows3, X } from 'lucide-react'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { estiloDaVariavel } from '@/lib/mae/texto/noTexto'
import { limparEfeitos } from '@/lib/mae/schema/efeitos'
import type { DocTema } from '@/lib/mae/schema'
import { useEditor } from './estado'
import { alinharSelecao, editarSelecao, estilosNaSelecao } from './acoesVinculo'
import { usePedidoAberto } from './pedidosMae'
import EditorEfeitos from './EditorEfeitos'
import Deslizador from './Deslizador'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

export default function PainelSelecao() {
  const multi = useEditor(s => s.multiSel), face = useEditor(s => s.face)
  const tema = useMaeTema(s => s.hist?.atual ?? null) as DocTema | null
  const doc = useMaeDoc(s => s.hist.atual)
  if (!tema || multi.length < 2) return null
  const camadas = multi.filter(i => i.tipo === 'camada').map(i => acharCamadaTema(tema, i.id)?.c).filter(Boolean) as { opacity?: number; visible?: boolean; effects?: unknown[]; locked?: boolean }[]
  const textos = multi.filter(i => i.tipo === 'texto').map(i => doc.textSlots.find(s => s.id === i.id)).filter(Boolean) as { variable: string }[]
  const ops = camadas.map(c => c.opacity ?? 1)
  const opIgual = ops.length > 0 && ops.every(v => Math.abs(v - ops[0]) < 0.001)
  const efsTodos = [...camadas.map(c => JSON.stringify(limparEfeitos(c.effects))), ...textos.map(s => JSON.stringify(limparEfeitos(estiloDaVariavel(tema.textStyles, s.variable).effects)))]
  const efIguais = efsTodos.every(x => x === efsTodos[0])
  const ocultos = camadas.filter(c => c.visible === false).length
  const travadas = camadas.filter(c => c.locked).length
  const al = (como: Parameters<typeof alinharSelecao>[0]) => alinharSelecao(como, usePedidoAberto.getState().valores)
  return (
    <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-2 space-y-1.5 text-xs" data-painel-selecao>
      <div className="flex items-center gap-1">
        <b className="flex-1" data-n-selecionados>{multi.length} elementos selecionados</b>
        <button className="text-gray-500" onClick={() => useEditor.getState().set({ multiSel: [] })} aria-label="Limpar a seleção" title="Limpar a seleção (Esc)"><X className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[10px] text-gray-500">Shift ou Ctrl + clique soma ou tira; Shift + arrastar numa área vazia seleciona por caixa. Mover, aumentar e girar: o contorno azul na arte (ou as setas){face ? '' : ' — clique numa caixa da arte primeiro'}.</p>
      <div className="space-y-0.5">
        <p className="text-[11px] font-semibold">Alinhar e distribuir</p>
        <div className="flex flex-wrap gap-1" data-alinhar-selecao>
          <button className={btn} disabled={!face} onClick={() => al('esq')} title="Alinhar à esquerda" data-alinhar="esq"><AlignStartVertical className="w-3.5 h-3.5" /></button>
          <button className={btn} disabled={!face} onClick={() => al('centro')} title="Centralizar na horizontal" data-alinhar="centro"><AlignCenterVertical className="w-3.5 h-3.5" /></button>
          <button className={btn} disabled={!face} onClick={() => al('dir')} title="Alinhar à direita" data-alinhar="dir"><AlignEndVertical className="w-3.5 h-3.5" /></button>
          <button className={btn} disabled={!face} onClick={() => al('topo')} title="Alinhar no topo" data-alinhar="topo"><AlignStartHorizontal className="w-3.5 h-3.5" /></button>
          <button className={btn} disabled={!face} onClick={() => al('meio')} title="Alinhar no meio" data-alinhar="meio"><AlignCenterHorizontal className="w-3.5 h-3.5" /></button>
          <button className={btn} disabled={!face} onClick={() => al('base')} title="Alinhar na base" data-alinhar="base"><AlignEndHorizontal className="w-3.5 h-3.5" /></button>
          <button className={btn} disabled={!face || multi.length < 3} onClick={() => al('dist-h')} title="Distribuir na horizontal (3 ou mais)" data-alinhar="dist-h"><Columns3 className="w-3.5 h-3.5" /></button>
          <button className={btn} disabled={!face || multi.length < 3} onClick={() => al('dist-v')} title="Distribuir na vertical (3 ou mais)" data-alinhar="dist-v"><Rows3 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {camadas.length > 0 && (
        <label className="block text-[11px] text-gray-500"><span>Opacidade {opIgual ? '' : <b data-valor-diferente>—</b>}</span>
          <Deslizador min={0} max={1} step={0.01} value={opIgual ? ops[0] : 1} unidade="%" fator={100} onChange={e => editarSelecao({ opacidade: Number(e.target.value) }, 'sel:opacidade')} data-opacidade-selecao /></label>
      )}
      <div className="flex flex-wrap gap-1">
        <button className={btn} onClick={() => editarSelecao({ visivel: ocultos > 0 })} data-ocultar-selecao>{ocultos > 0 ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} {ocultos > 0 ? 'Mostrar' : 'Ocultar'}</button>
        {camadas.length > 0 && <button className={btn} onClick={() => editarSelecao({ travar: travadas < camadas.length })} data-travar-selecao>{travadas < camadas.length ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />} {travadas < camadas.length ? 'Travar' : 'Destravar'}</button>}
        {camadas.length > 0 && <button className={btn} onClick={() => editarSelecao({ excluir: true })} title="Exclui as camadas (os textos são da base e ficam)" data-excluir-selecao><Trash2 className="w-3.5 h-3.5" /> Excluir</button>}
      </div>
      <EditorEfeitos key={`sel:${multi.map(i => i.id).join(',')}:${efIguais}`} efeitos={efIguais ? limparEfeitos(JSON.parse(efsTodos[0] || '[]')) : []}
        titulo={efIguais ? `Estilos — nos ${multi.length} itens` : `Estilos — nos ${multi.length} itens (estão diferentes: —)`}
        onMudar={(novos, label, j) => estilosNaSelecao(novos, `${label} (${multi.length} itens)`, j ? `sel:ef:${j}` : undefined)} />
    </div>
  )
}
