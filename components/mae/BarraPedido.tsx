'use client'
'use no memo'
// "GERAR ARTE" vindo do card do pedido (/estudio/mae?pedido=<id>), Sprint 12: acha o tema (vínculo
// produto ↔ tema ou campo TEMA), abre base + tema, preenche NOME e IDADE, calcula a HASHTAG e mostra a
// barra do pedido no editor (variáveis editáveis + avisos). A exportação do painel usa estes valores e
// registra a arte no card.
import { useEffect, useState } from 'react'
import { X, ClipboardList, Loader2 } from 'lucide-react'
import { useBiblioteca, useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { statusDoCard } from '@/lib/mae/pedidos/pedidos'
import { apiMae, temasDisponiveis, linhaDoPedido, valoresDaLinha, abrirTemaEBase, usePedidoAberto, type LinhaPedido, type TemaDisponivel } from './pedidosMae'
import { useEditor } from './estado'

const inp = 'rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-0.5 text-xs'

/** Lê ?pedido= e abre o pedido assim que a Biblioteca estiver conectada. */
let pedidoDaUrlAberto = false
export function useAbrirPedidoDaUrl() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  useEffect(() => {
    if (pedidoDaUrlAberto || !liberada) return
    pedidoDaUrlAberto = true
    const id = new URLSearchParams(window.location.search).get('pedido')
    if (id) void abrirPedido(raiz, id)
  }, [raiz, liberada])
}

export async function abrirPedido(raiz: FileSystemDirectoryHandle | null, id: string, temaEscolhido?: string) {
  const set = usePedidoAberto.setState
  set({ aviso: 'Abrindo o pedido…' })
  try {
    const [p, ts, vs] = await Promise.all([apiMae.pedido(id), temasDisponiveis(raiz), apiMae.vinculos().catch(() => [])])
    const l = linhaDoPedido(p, ts, vs)
    const tid = temaEscolhido ?? l.tema?.themeId
    const t = ts.find(x => x.id === tid)
    if (!t) { set({ pedido: p, valores: valoresDaLinha(l), origemTema: null, aviso: l.campos.TEMA ? `O tema "${l.campos.TEMA}" do pedido não existe — escolha o tema.` : 'O pedido não tem TEMA — escolha o tema.' }); return }
    const { tema, base } = await abrirTemaEBase(raiz, t)
    // a base aberta (com marcas/ajustes ainda não salvos) vale mais que a cópia salva da MESMA base
    const atual = useMaeDoc.getState().hist.atual
    if (!(atual.id === base.id && (atual.version ?? 0) >= (base.version ?? 0))) useMaeDoc.getState().carregar(base)
    useMaeTema.getState().carregar(tema)
    useEditor.getState().set({ modo: 'tema', face: null, camada: null })
    set({ pedido: p, valores: valoresDaLinha(l, tema), origemTema: temaEscolhido ? 'manual' : l.tema!.origem, aviso: l.alertas.filter(a => a !== 'tema não encontrado').join(' · ') || null })
  } catch (e) { set({ aviso: `Não consegui abrir o pedido: ${(e as Error).message}` }) }
}

export default function BarraPedido() {
  const raiz = useBiblioteca(s => s.raiz)
  const { pedido, valores, origemTema, aviso } = usePedidoAberto()
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const textos = useEditor(s => s.textos)
  const [temas, setTemas] = useState<TemaDisponivel[]>([])
  useEffect(() => { if (pedido && !origemTema) void temasDisponiveis(raiz).then(setTemas) }, [pedido, origemTema, raiz])
  if (!pedido && !aviso) return null
  const st = pedido ? statusDoCard(pedido.artes) : null
  const mudar = (k: string, v: string) => usePedidoAberto.setState(s => {
    const n = { ...s.valores, [k]: v }
    // nome/idade mudaram e a hashtag não foi editada à mão → recalcula
    if (k !== 'HASHTAG' && pedido) { const l: LinhaPedido = { ...linhaDoPedido(pedido, [], []), editadas: { NOME: n.NOME, IDADE: n.IDADE } }; n.HASHTAG = valoresDaLinha(l, tema).HASHTAG }
    return { valores: n }
  })
  const avisosTexto = textos.filter(t => t.aviso).map(t => t.aviso!)
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-orange-200 bg-orange-50/70 dark:bg-orange-950/30 px-3 py-1.5 text-xs" data-barra-pedido>
      <ClipboardList className="w-4 h-4 text-orange-600" />
      {pedido ? (<>
        <b>Pedido #{pedido.numero}</b><span className="text-gray-500">{pedido.cliente}</span>
        {origemTema && tema && <span className="text-gray-600">· tema <b>{tema.name}</b> <span className="text-gray-400">({({ variacao: 'pelo produto', produto: 'pelo produto', campo: 'pelo campo TEMA', manual: 'escolhido' } as Record<string, string>)[origemTema]}, v{tema.version})</span></span>}
        {!origemTema && (
          <select defaultValue="" onChange={e => e.target.value && abrirPedido(raiz, pedido.id, e.target.value)} className={inp} data-escolher-tema-pedido>
            <option value="">Escolher o tema…</option>
            {temas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {(['NOME', 'IDADE', 'HASHTAG'] as const).map(k => (
          <label key={k} className="flex items-center gap-1">{k}<input value={valores[k] ?? ''} onChange={e => mudar(k, e.target.value)} className={`${inp} ${k === 'IDADE' ? 'w-10' : 'w-32'}`} data-var-pedido={k} /></label>
        ))}
        <label className="flex items-center gap-1" title="Tamanho do nome só neste pedido (o tema não muda)">Tamanho do nome
          <input type="range" min={0.5} max={1.8} step={0.01} value={Number(valores._ESCALA_NOME ?? 1)} className="w-24 accent-orange-500"
            onChange={e => usePedidoAberto.setState(s => ({ valores: { ...s.valores, _ESCALA_NOME: e.target.value } }))}
            onPointerUp={e => { const v = Number((e.target as HTMLInputElement).value); void apiMae.ajustarPedido(pedido.id, { NOME: Math.abs(v - 1) < 0.005 ? null : v }).catch(() => null) }} data-escala-nome-pedido />
          <span className="tabular-nums w-9">{Math.round(Number(valores._ESCALA_NOME ?? 1) * 100)}%</span>
        </label>
        {st && <span className={st.status === 'gerada' ? 'text-emerald-700 font-semibold' : st.status === 'revisar' ? 'text-amber-700' : 'text-gray-500'} data-status-pedido={st.status}>{st.status === 'gerada' ? 'Arte gerada ✓' : st.status === 'revisar' ? 'Revisar' : 'Arte não gerada'}</span>}
        <span className="text-gray-500">Gere em Exportar → Arte pra aprovação / impressão.</span>
      </>) : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {(aviso || avisosTexto.length > 0) && <span className="text-amber-700 w-full" data-aviso-pedido>{[aviso, ...avisosTexto].filter(Boolean).join(' · ')}</span>}
      {pedido && <button className="ml-auto" onClick={() => usePedidoAberto.setState({ pedido: null, valores: {}, origemTema: null, aviso: null })} aria-label="Fechar o pedido"><X className="w-3.5 h-3.5" /></button>}
    </div>
  )
}
