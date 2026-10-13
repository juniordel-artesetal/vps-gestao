'use client'
// "GERAR EM LOTE" (Lote 7, itens 117/118/119): opções do lote de impressão — ordem das páginas (por pedido / por
// modelo), intercalar temas iguais, identificação "#123 · Naty", separar por produto, pedidos por arquivo e
// "Iniciar a etapa Impressão nestes pedidos" (só com SOA). As escolhas ficam lembradas neste navegador.
import { useState } from 'react'
import { Layers3, X, Loader2 } from 'lucide-react'
import type { OrdemLote } from '@/lib/mae/pedidos/ordemLote'

export interface EscolhasLote { ordem: OrdemLote; intercalar: boolean; identificacao: boolean; separarPorProduto: boolean; maxPedidos: number; iniciarImpressao: boolean }
const PADRAO: EscolhasLote = { ordem: 'pedido', intercalar: true, identificacao: true, separarPorProduto: true, maxPedidos: 10, iniciarImpressao: true }
const CHAVE = 'mae:lote-impressao'
export function escolhasGuardadas(): EscolhasLote {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) ?? '{}') } } catch { return PADRAO }
}

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

export default function ModalLote({ pedidos, comSoa, temEtapa, folhaMontada, seletorSeparado, onFechar, onGerar }: {
  pedidos: number; comSoa: boolean; temEtapa: boolean
  /** Lote 11 (item 165): o seletor de cima está em "1 PDF por pedido/folha" — no lote não vale (sai 1 PDF único). */
  seletorSeparado?: boolean
  /** Quantos pedidos são de folha montada (tags, etiquetas): esses seguem o gabarito e o "Aproveitar folhas". */
  folhaMontada: number
  onFechar: () => void; onGerar: (e: EscolhasLote) => void
}) {
  const [e, setE] = useState<EscolhasLote>(escolhasGuardadas)
  const [indo, setIndo] = useState(false)
  const mudar = (p: Partial<EscolhasLote>) => setE(x => ({ ...x, ...p }))
  const partes = Math.ceil(pedidos / Math.max(1, e.maxPedidos))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar} role="dialog" aria-modal="true" data-modal-lote>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl text-sm" onClick={x => x.stopPropagation()}>
        <div className="flex items-center gap-2"><Layers3 className="w-4 h-4 text-orange-500" /><b>Gerar em lote — {pedidos} pedido{pedidos === 1 ? '' : 's'}</b><button className="ml-auto" onClick={onFechar} aria-label="Fechar"><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-gray-500">Um PDF só para imprimir de uma vez, cada pedido já nas quantidades de cada caixa — na pasta <b>Exportações / hoje / LOTES</b>.</p>
        {seletorSeparado && <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800" data-aviso-seletor-lote>No lote, sai 1 PDF único com todos os pedidos (o &ldquo;1 PDF por pedido/folha&rdquo; lá de cima vale só para o &ldquo;Gerar selecionados&rdquo;).</p>}
        <fieldset className="space-y-1">
          <legend className="text-xs font-semibold">Ordem das páginas</legend>
          <label className="flex items-start gap-2 text-xs"><input type="radio" className="accent-orange-500 mt-0.5" checked={e.ordem === 'pedido'} onChange={() => mudar({ ordem: 'pedido' })} data-ordem-lote="pedido" /><span><b>Por pedido</b> — o kit de cada cliente junto.</span></label>
          <label className="flex items-start gap-2 text-xs"><input type="radio" className="accent-orange-500 mt-0.5" checked={e.ordem === 'modelo'} onChange={() => mudar({ ordem: 'modelo' })} data-ordem-lote="modelo" /><span><b>Por modelo</b> — todas as milks, depois todos os cubos… (para separar os moldes iguais depois de impresso).</span></label>
          {e.ordem === 'modelo' && <label className="ml-6 flex items-center gap-2 text-xs"><input type="checkbox" className="accent-orange-500" checked={e.intercalar} onChange={x => mudar({ intercalar: x.target.checked })} data-intercalar-lote /> Intercalar temas iguais (dois do mesmo tema não ficam colados)</label>}
        </fieldset>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-orange-500" checked={e.identificacao} onChange={x => mudar({ identificacao: x.target.checked })} data-identificacao-lote /> Imprimir identificação do pedido (&ldquo;#123 · Naty&rdquo; na margem, fora do corte)</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-orange-500" checked={e.separarPorProduto} onChange={x => mudar({ separarPorProduto: x.target.checked })} data-separar-produto-lote /> Separar por papel (kit × tag) <span className="text-gray-400">— temas e pedidos diferentes ficam no mesmo PDF</span></label>
        <label className="flex items-center gap-2 text-xs">Até
          <input type="text" inputMode="numeric" value={e.maxPedidos} onChange={x => mudar({ maxPedidos: Math.max(1, Math.min(50, parseInt(x.target.value.replace(/\D/g, '') || '1'))) })} className="w-12 rounded border border-gray-200 bg-transparent px-1 text-right" aria-label="Pedidos por arquivo" data-max-pedidos-lote />
          pedidos por arquivo {partes > 1 && <span className="text-gray-500">→ {partes} arquivos (sem travar o navegador nem a impressora)</span>}</label>
        {comSoa && (
          <label className={`flex items-center gap-2 text-xs ${temEtapa ? '' : 'opacity-50'}`} title={temEtapa ? 'Os pedidos passam para a etapa Impressão na produção do SOA' : 'O fluxo de produção não tem etapa de Impressão'}>
            <input type="checkbox" className="accent-orange-500" disabled={!temEtapa} checked={temEtapa && e.iniciarImpressao} onChange={x => mudar({ iniciarImpressao: x.target.checked })} data-iniciar-impressao-lote /> Iniciar a etapa Impressão nestes pedidos
          </label>
        )}
        {folhaMontada > 0 && <p className="text-[11px] text-gray-500">{folhaMontada} pedido(s) de folha montada (tags, etiquetas) seguem o gabarito da folha e o &ldquo;Aproveitar folhas&rdquo;.</p>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onFechar}>Cancelar</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={indo} onClick={() => { setIndo(true); try { localStorage.setItem(CHAVE, JSON.stringify(e)) } catch { /* sem armazenamento */ } onGerar(e) }} data-confirmar-lote>
            {indo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers3 className="w-3.5 h-3.5" />} Gerar lote
          </button>
        </div>
      </div>
    </div>
  )
}
