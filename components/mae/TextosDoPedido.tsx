'use client'
'use no memo'
// Lote 6 (item 99): MODO AJUSTAR LIMPO — no "Ajustar" da edição em massa o tema está travado, então o painel da
// esquerda vira "Textos deste pedido": cada texto (NOME, IDADE, HASHTAG, SUFIXO, frase, campos extras) com o valor
// do pedido e a lista das caixas onde ele aparece (clicar seleciona na arte para mover/ajustar só neste pedido).
import { Type } from 'lucide-react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { useEditor } from './estado'
import { usePedidoAberto, linhaDoPedido, valoresDaLinha, type LinhaPedido } from './pedidosMae'
import PainelTexto from './PainelTexto'

const CALCULADAS = new Set(['SUFIXO', 'ARROBA'])

export default function TextosDoPedido() {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const { pedido, valores } = usePedidoAberto()
  const slot = useEditor(s => s.slot)
  if (!pedido) return null
  const vars = [...new Set(doc.textSlots.map(s => s.variable))]
  const mudar = (k: string, v: string) => usePedidoAberto.setState(s => {
    const n = { ...s.valores, [k]: v }
    // nome/idade mudaram → a hashtag acompanha (a não ser que ela mesma seja o campo editado)
    if (k !== 'HASHTAG') { const l: LinhaPedido = { ...linhaDoPedido(pedido, [], []), editadas: { NOME: n.NOME, IDADE: n.IDADE } }; n.HASHTAG = valoresDaLinha(l, tema).HASHTAG }
    return { valores: n }
  })
  const nomeCaixa = (faceId: string) => doc.molds.find(m => m.faces.some(f => f.id === faceId))?.name ?? 'caixa'
  const campoDe = (v: string) => (v === 'NOME_IDADE' ? null : v)
  return (
    <section className="space-y-3" data-textos-pedido>
      <div>
        <p className="text-sm font-semibold flex items-center gap-1.5"><Type className="w-4 h-4 text-orange-500" /> Textos deste pedido</p>
        <p className="text-[11px] text-gray-500">Pedido #{pedido.numero} · o tema está travado. Clique numa caixa para ajustar o texto nela (arrastar, tamanho, girar) — só neste pedido.</p>
      </div>
      {vars.map(v => {
        const campo = campoDe(v)
        const slots = doc.textSlots.filter(s => s.variable === v)
        return (
          <div key={v} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1" data-texto-pedido={v}>
            <p className="text-[11px] font-semibold">{rotuloVariavel(v)}</p>
            {campo && !CALCULADAS.has(campo)
              ? <input value={valores[campo] ?? ''} onChange={e => mudar(campo, e.target.value)} className="w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs" aria-label={rotuloVariavel(v)} data-valor-pedido={v} />
              : <p className="text-[10px] text-gray-400">{v === 'NOME_IDADE' ? `${valores.NOME ?? ''} · ${valores.IDADE ?? ''}` : 'calculado do pedido'}</p>}
            <div className="flex flex-wrap gap-1">
              {slots.map(s => {
                const ajustado = !!valores[`_POS_${s.id}`]
                return (
                  <button key={s.id} className={`rounded border px-1.5 py-0.5 text-[10px] ${slot === s.id ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 dark:border-gray-700 hover:border-orange-400'}`}
                    onClick={() => useEditor.getState().set({ slot: s.id, face: s.faceId, camada: null, escopo: 'face' })} data-caixa-texto-pedido={s.id}>
                    {nomeCaixa(s.faceId)}{ajustado ? ' ✎' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {/* Lote 13 (item 178): o MESMO painel Texto do tema (fonte, cor, papel, contorno, sombra, brilho, espaçamento,
          entrelinha) — tudo SÓ NESTE PEDIDO */}
      {slot && <div className="border-t border-gray-200 pt-2 dark:border-gray-700" data-estilo-pedido><PainelTexto modoPedido /></div>}
      {!slot && <p className="text-[10px] text-gray-400">Clique numa caixa acima (ou no texto na arte) para mudar a fonte, a cor e os efeitos só deste pedido.</p>}
    </section>
  )
}
