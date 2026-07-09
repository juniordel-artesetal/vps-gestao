'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  ShoppingBag, RefreshCw, X, TrendingUp, AlertTriangle, CheckCircle,
  Clock, Package, Link2, DollarSign, Settings2,
} from 'lucide-react'

const fmtR = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtD = (s: string | null) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—'

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  aguardando_envio: { label: 'Aguardando envio', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  previsto:         { label: 'Previsto',          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  a_confirmar:      { label: 'A confirmar',       cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  recebido:         { label: 'Recebido',          cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelado:        { label: 'Cancelado',         cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

export default function MarketplacePage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canal = 'shopee'

  const [cfg, setCfg]         = useState<{ ativo: boolean; diasRepasse: number } | null>(null)
  const [resumo, setResumo]   = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [de, setDe]   = useState('')
  const [ate, setAte] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [busca, setBusca]     = useState('')
  const [msg, setMsg]         = useState('')
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [diasEdit, setDiasEdit]   = useState(7)

  const feedback = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const carregarConfig = useCallback(async () => {
    const d = await fetch('/api/config/marketplace').then(r => r.json()).catch(() => ({ canais: [] }))
    const c = (d.canais || []).find((x: any) => x.canal === canal) || { ativo: false, diasRepasse: 7 }
    setCfg({ ativo: !!c.ativo, diasRepasse: c.diasRepasse ?? 7 })
    setDiasEdit(c.diasRepasse ?? 7)
    return !!c.ativo
  }, [])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ canal })
      if (de) qs.set('de', de); if (ate) qs.set('ate', ate)
      const [r, p] = await Promise.all([
        fetch(`/api/financeiro/marketplace/resumo?${qs}`).then(x => x.json()),
        fetch(`/api/financeiro/marketplace/pedidos?${new URLSearchParams({ canal, ...(de ? { de } : {}), ...(ate ? { ate } : {}), ...(busca ? { busca } : {}) })}`).then(x => x.json()),
      ])
      setResumo(r); setPedidos(p.pedidos || [])
    } finally { setLoading(false) }
  }, [de, ate, busca])

  useEffect(() => { (async () => { const on = await carregarConfig(); if (on) carregarDados(); else setLoading(false) })() }, [carregarConfig, carregarDados])

  async function salvarConfig(ativo: boolean, dias: number) {
    await fetch('/api/config/marketplace', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal, ativo, diasRepasse: dias }),
    })
    const on = await carregarConfig()
    if (on) carregarDados()
    feedback(ativo ? 'Módulo ativado!' : 'Configuração salva')
  }

  async function baixaLote() {
    if (!de || !ate) { feedback('Escolha o período (de/até) para dar baixa'); return }
    if (!confirm(`Marcar como RECEBIDO todos os previstos com data entre ${fmtD(de)} e ${fmtD(ate)}? (não cria lançamento no caixa)`)) return
    const r = await fetch('/api/financeiro/marketplace/baixa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal, de, ate }),
    }).then(x => x.json())
    feedback(`${r.baixados || 0} recebível(is) marcados como recebido`)
    carregarDados()
  }

  const pedidosFiltrados = fStatus ? pedidos.filter(p => p.statusEfetivo === fStatus) : pedidos

  // ── Ranking (client-side, a partir dos pedidos carregados) ──
  const ranking = (() => {
    const comMargem = pedidos.filter(p => p.margem !== null)
    const melhores = [...comMargem].sort((a, b) => b.margem - a.margem).slice(0, 5)
    const piores   = [...comMargem].sort((a, b) => a.margem - b.margem).slice(0, 5)
    return { melhores, piores }
  })()

  if (loading && !cfg) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  // ── ATIVAÇÃO (OPT-IN) ──
  if (cfg && !cfg.ativo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-lg mx-auto mt-10 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 text-center">
          <ShoppingBag className="w-12 h-12 text-orange-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Números do Marketplace</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Visão de gestor dos seus pedidos de marketplace: previsão de recebimento (fora do caixa),
            taxas da Shopee, líquido estimado e margem real por pedido. <strong>Não cria nada no financeiro</strong> —
            é só previsão e análise.
          </p>
          {isAdmin ? (
            <button onClick={() => salvarConfig(true, diasEdit)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl transition">
              Ativar módulo
            </button>
          ) : <p className="text-xs text-gray-400">Peça a uma administradora para ativar.</p>}
        </div>
      </div>
    )
  }

  const k = resumo?.kpis || {}
  const prev = resumo?.previsao || {}
  const marg = resumo?.margem || {}
  const comp = resumo?.comparativo || {}

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-orange-500" /> Números do Marketplace
            </h1>
            <p className="text-sm text-gray-500">Shopee · valores <strong>estimados</strong> (a Shopee não informa o repasse real)</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={carregarDados} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><RefreshCw size={15} /></button>
          </div>
        </div>

        {msg && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-xl px-4 py-2.5 mb-4">✓ {msg}</div>}

        {/* Filtros de período + config */}
        <div className="flex flex-wrap items-end gap-3 mb-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">De</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <button onClick={carregarDados} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg">Aplicar</button>
          {(de || ate) && <button onClick={() => { setDe(''); setAte(''); setTimeout(carregarDados, 0) }} className="text-xs text-gray-400 hover:text-gray-600">Limpar</button>}
          {isAdmin && (
            <div className="ml-auto flex items-end gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1"><Settings2 size={11} /> Dias p/ repasse</label>
                <input type="number" min={0} value={diasEdit} onChange={e => setDiasEdit(parseInt(e.target.value) || 0)}
                  className="w-20 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
              </div>
              <button onClick={() => salvarConfig(true, diasEdit)} className="text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">Salvar</button>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { l: 'Pedidos', v: k.nPedidos ?? 0, cls: 'text-gray-900 dark:text-white' },
            { l: 'Venda (bruto)', v: fmtR(k.bruto), cls: 'text-gray-900 dark:text-white' },
            { l: 'Total de taxas', v: fmtR(k.totalTaxas), sub: `${k.pctTaxas ?? 0}% do bruto`, cls: 'text-red-500' },
            { l: 'Líquido estimado', v: fmtR(k.liquidoEstimado), cls: 'text-green-600 dark:text-green-400' },
            { l: 'Frete', v: fmtR(k.frete), cls: 'text-gray-700 dark:text-gray-300' },
            { l: 'Descontos', v: fmtR(k.descontos), cls: 'text-gray-700 dark:text-gray-300' },
            { l: 'Ticket médio', v: fmtR(k.ticketMedio), cls: 'text-gray-700 dark:text-gray-300' },
            { l: 'Margem (cobertos)', v: fmtR(marg.lucro), sub: `cobertura ${marg.cobertura ?? 0}%`, cls: (marg.lucro ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500' },
          ].map((c, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">{c.l}</p>
              <p className={`text-lg font-bold ${c.cls}`}>{c.v}</p>
              {c.sub && <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Previsão de recebimento */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp size={16} className="text-orange-500" /> Previsão de recebimento <span className="text-xs font-normal text-gray-400">(estimado)</span></h2>
            {isAdmin && <button onClick={baixaLote} className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"><CheckCircle size={12} /> Dar baixa no período (→ recebido)</button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {['aguardando_envio', 'previsto', 'a_confirmar', 'recebido', 'cancelado'].map(s => (
              <div key={s} className={`rounded-xl p-3 ${STATUS_INFO[s].cls}`}>
                <p className="text-xs font-medium">{STATUS_INFO[s].label}</p>
                <p className="text-lg font-bold">{fmtR(prev[s]?.valor || 0)}</p>
                <p className="text-[11px] opacity-70">{prev[s]?.n || 0} pedido(s)</p>
              </div>
            ))}
          </div>
        </div>

        {/* Card comparativo (read-only) */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 mb-5">
          <p className="text-xs text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Comparativo informativo — não altera o caixa</p>
          <div className="flex flex-wrap gap-6 text-sm">
            <div><span className="text-gray-500">Previsto no período:</span> <strong className="text-blue-700 dark:text-blue-300">{fmtR(comp.previstoPeriodo)}</strong> <span className="text-gray-400 text-xs">(estimado)</span></div>
            <div><span className="text-gray-500">Receitas lançadas no caixa:</span> <strong className="text-green-700 dark:text-green-400">{fmtR(comp.receitasLancadas)}</strong></div>
          </div>
        </div>

        {/* Ranking */}
        {(ranking.melhores.length > 0 || ranking.piores.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            {[{ t: '🏆 Melhor margem', arr: ranking.melhores }, { t: '⚠️ Pior margem', arr: ranking.piores }].map((b, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{b.t}</p>
                <div className="space-y-1">
                  {b.arr.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{p.idExterno}</span>
                      <span className={`font-mono font-semibold ${p.margem >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtR(p.margem)}</span>
                    </div>
                  ))}
                  {b.arr.length === 0 && <p className="text-xs text-gray-400">Vincule produtos para ver a margem.</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabela de pedidos */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800">
            <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === 'Enter' && carregarDados()}
              placeholder="Buscar pedido/destinatário..." className="flex-1 min-w-40 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white">
              <option value="">Todos os estados</option>
              {Object.entries(STATUS_INFO).map(([k2, v]) => <option key={k2} value={k2}>{v.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                  {['Data', 'Pedido', 'Destinatário', 'Venda', 'Taxas', 'Líquido est.', 'Margem', 'Estado'].map(h => <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">Carregando...</td></tr>
                ) : pedidosFiltrados.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum pedido. Importe a planilha da Shopee.</td></tr>
                ) : pedidosFiltrados.map(p => (
                  <tr key={p.id} onClick={() => setDetalheId(p.id)} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-orange-50/40 dark:hover:bg-gray-800/40 cursor-pointer">
                    <td className="p-3 text-gray-500 whitespace-nowrap">{fmtD(p.data)}</td>
                    <td className="p-3 font-mono text-xs text-gray-700 dark:text-gray-300">{p.idExterno}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">{p.destinatario || '—'}</td>
                    <td className="p-3 text-right font-mono">{fmtR(p.valorTotal)}</td>
                    <td className="p-3 text-right font-mono text-red-500">{fmtR(p.taxas)}</td>
                    <td className="p-3 text-right font-mono text-green-600 dark:text-green-400">{fmtR(p.liquido)}</td>
                    <td className="p-3 text-right font-mono">
                      {p.margem !== null ? <span className={p.margem >= 0 ? 'text-green-600' : 'text-red-500'}>{fmtR(p.margem)}</span>
                        : <span className="text-[11px] text-amber-500 flex items-center gap-0.5 justify-end"><Link2 size={11} /> vincular</span>}
                    </td>
                    <td className="p-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[p.statusEfetivo]?.cls || ''}`}>{STATUS_INFO[p.statusEfetivo]?.label || p.statusEfetivo}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detalheId && <DetalheModal id={detalheId} isAdmin={isAdmin} onClose={() => setDetalheId(null)} onChanged={carregarDados} />}
    </div>
  )
}

// ── Modal de detalhe do pedido ──
function DetalheModal({ id, isAdmin, onClose, onChanged }: { id: string; isAdmin: boolean; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<any>(null)
  const [variacoes, setVariacoes] = useState<any[]>([])
  const [vincItem, setVincItem] = useState<any | null>(null)
  const [vinculando, setVinculando] = useState('')

  const carregar = useCallback(() => { fetch(`/api/financeiro/marketplace/pedidos/${id}`).then(r => r.json()).then(setD) }, [id])
  useEffect(() => { carregar() }, [carregar])

  async function abrirVinculo(item: any) {
    if (variacoes.length === 0) {
      const v = await fetch('/api/financeiro/marketplace/vinculos').then(r => r.json()).catch(() => [])
      setVariacoes(Array.isArray(v) ? v : [])
    }
    setVincItem(item)
  }
  async function salvarVinculo() {
    if (!vincItem || !vinculando) return
    await fetch('/api/financeiro/marketplace/vinculos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: 'shopee', sku: vincItem.sku, produto: vincItem.produto, variacaoId: vinculando }),
    })
    setVincItem(null); setVinculando(''); carregar(); onChanged()
  }
  async function mudarStatus(status: string) {
    await fetch(`/api/financeiro/marketplace/pedidos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    carregar(); onChanged()
  }
  async function editarData(dataPrevista: string) {
    await fetch(`/api/financeiro/marketplace/pedidos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataPrevista }),
    })
    carregar(); onChanged()
  }

  if (!d) return null
  const linhas: [string, any][] = [
    ['Subtotal produtos', d.subtotalProdutos], ['Frete (comprador)', d.frete],
    ['Desconto vendedor', d.descontoVendedor], ['Desconto Shopee', d.descontoShopee],
    ['Cupom vendedor', d.cupomVendedor], ['Cupom Shopee', d.cupomShopee],
    ['Valor Total', d.valorTotal], ['Total global', d.totalGlobal],
    ['Taxa de transação', d.taxaTransacao], ['Comissão (líquida)', d.comissaoLiquida],
    ['Serviço (líquida)', d.servicoLiquida], ['Frete reverso', d.freteReverso],
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white font-mono text-sm">{d.idExterno}</h2>
            <p className="text-xs text-gray-500">{d.destinatario} · {d.cidade}/{d.uf} · {fmtD(d.data)}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Recebível */}
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[d.statusEfetivo]?.cls || ''}`}>{STATUS_INFO[d.statusEfetivo]?.label || d.statusEfetivo}</span>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} /> Previsto:
              <input type="date" defaultValue={d.dataPrevista || ''} onBlur={e => e.target.value !== (d.dataPrevista || '') && editarData(e.target.value)}
                disabled={!isAdmin} className="border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 dark:text-white" />
            </div>
            {isAdmin && (
              <div className="flex gap-1 ml-auto">
                {d.statusEfetivo !== 'recebido' && <button onClick={() => mudarStatus('recebido')} className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg">Recebido</button>}
                {d.statusEfetivo !== 'cancelado' && <button onClick={() => mudarStatus('cancelado')} className="text-xs border border-red-300 text-red-500 px-2 py-1 rounded-lg">Cancelar</button>}
              </div>
            )}
          </div>

          {/* Valores fiscais */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Valores (estimado)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {linhas.map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-gray-50 dark:border-gray-800/50 py-0.5">
                  <span className="text-gray-500">{l}</span><span className="font-mono">{fmtR(v)}</span>
                </div>
              ))}
              <div className="flex justify-between col-span-2 pt-1.5 mt-1 border-t border-gray-200 dark:border-gray-700 font-semibold">
                <span className="text-green-700 dark:text-green-400">Líquido estimado</span><span className="font-mono text-green-700 dark:text-green-400">{fmtR(d.liquido)}</span>
              </div>
            </div>
          </div>

          {/* Itens + custo + margem */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
              <Package size={12} /> Itens e margem
              {!d.cobertura && <span className="text-amber-500 normal-case font-normal">— há produto não vinculado</span>}
            </p>
            <div className="space-y-1.5">
              {(d.itens || []).map((it: any) => (
                <div key={it.id} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 dark:text-gray-200 truncate">{it.produto} {it.variacao ? <span className="text-gray-400">· {it.variacao}</span> : null}</p>
                    <p className="text-[11px] text-gray-400">{it.qtd}× · {fmtR(it.precoAcordado)} {it.sku ? `· SKU ${it.sku}` : ''}</p>
                  </div>
                  {it.vinculado ? (
                    <span className="text-xs text-gray-500 font-mono">custo {fmtR(it.custo)}</span>
                  ) : (
                    isAdmin && <button onClick={() => abrirVinculo(it)} className="text-xs text-orange-500 border border-orange-200 dark:border-orange-800 px-2 py-1 rounded-lg flex items-center gap-1"><Link2 size={11} /> Vincular</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 text-sm">
              <span className="text-gray-500">Margem real {d.cobertura ? '' : '(parcial — vincule os produtos)'}</span>
              {d.margem !== null
                ? <span className={`font-bold ${d.margem >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtR(d.margem)} <span className="text-xs font-normal text-gray-400">(líq. − custo {fmtR(d.custoTotal)})</span></span>
                : <span className="text-xs text-amber-500">indisponível — produto não vinculado</span>}
            </div>
          </div>
        </div>

        {/* Popup vincular */}
        {vincItem && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setVincItem(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Vincular produto</p>
              <p className="text-xs text-gray-400 mb-3 truncate">{vincItem.produto}{vincItem.sku ? ` · SKU ${vincItem.sku}` : ''}</p>
              <select value={vinculando} onChange={e => setVinculando(e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white mb-3">
                <option value="">Escolher variação da Precificação...</option>
                {variacoes.map(v => <option key={v.id} value={v.id}>{v.produtoNome} · {v.canal} · {v.tipo}{v.subOpcao ? ' · ' + v.subOpcao : ''} — custo {fmtR(v.custoTotal)}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setVincItem(null)} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-500 py-2 rounded-lg text-sm">Cancelar</button>
                <button onClick={salvarVinculo} disabled={!vinculando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">Vincular</button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">O vínculo vale também para os próximos pedidos com este produto.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
