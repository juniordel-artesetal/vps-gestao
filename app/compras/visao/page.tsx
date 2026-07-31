'use client'
// Visão geral de Compras — mini-dashboard: volume no período, material mais comprado,
// fornecedor top, nº de compras e evolução de preço. Reusa /api/compras/historico (fonte única).
import { useEffect, useState, useCallback } from 'react'
import { Loader2, ShoppingBag, Building2, Package, TrendingUp, TrendingDown, ArrowRight, Receipt } from 'lucide-react'

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Presets de período → calcula "de" (ate = hoje). '' = tudo.
const PERIODOS: { label: string; dias: number }[] = [
  { label: 'Últimos 30 dias', dias: 30 },
  { label: 'Últimos 90 dias', dias: 90 },
  { label: 'Últimos 12 meses', dias: 365 },
  { label: 'Tudo', dias: 0 },
]

function isoMenos(dias: number) {
  const d = new Date(); d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

export default function VisaoComprasPage() {
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(90)

  const carregar = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (periodo > 0) p.set('de', isoMenos(periodo))
    try {
      const r = await fetch('/api/compras/historico?' + p.toString())
      setDados(r.ok ? await r.json() : null)
    } finally { setLoading(false) }
  }, [periodo])
  useEffect(() => { carregar() }, [carregar])

  const resumo = dados?.resumo
  const topFornecedor = resumo?.porFornecedor?.[0] || null
  const topMaterial   = resumo?.porMaterial?.[0] || null

  const evol = dados?.evolucao || {}
  const materiaisComEvolucao = Object.entries(evol).filter(([, arr]: any) => arr.length >= 2)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Compras — Visão geral</h1>
          <p className="text-sm text-gray-500">Quanto você comprou, de quem e o que mais pesa no período.</p>
        </div>
        <select value={periodo} onChange={e => setPeriodo(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
      ) : !resumo || resumo.compras === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Nenhuma compra no período. Faça um <a href="/compras" className="text-orange-500 underline">Pedido de compra</a>.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1"><ShoppingBag className="w-3.5 h-3.5" /><span className="text-[10px] uppercase tracking-wide">Volume comprado</span></div>
              <p className="text-xl font-bold text-gray-800">{brl(resumo.total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Receipt className="w-3.5 h-3.5" /><span className="text-[10px] uppercase tracking-wide">Nº de compras</span></div>
              <p className="text-xl font-bold text-gray-800">{resumo.compras}</p>
              <p className="text-[11px] text-gray-400">{resumo.itens} itens</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Building2 className="w-3.5 h-3.5" /><span className="text-[10px] uppercase tracking-wide">Fornecedor top</span></div>
              <p className="text-sm font-bold text-gray-800 truncate" title={topFornecedor?.nome}>{topFornecedor?.nome || '—'}</p>
              {topFornecedor && <p className="text-[11px] text-gray-400">{brl(topFornecedor.total)}</p>}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Package className="w-3.5 h-3.5" /><span className="text-[10px] uppercase tracking-wide">Material mais comprado</span></div>
              <p className="text-sm font-bold text-gray-800 truncate" title={topMaterial?.nome}>{topMaterial?.nome || '—'}</p>
              {topMaterial && <p className="text-[11px] text-gray-400">{brl(topMaterial.total)}</p>}
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" /> De quem você mais compra</h2>
              <div className="space-y-2">
                {(resumo.porFornecedor || []).slice(0, 6).map((f: any) => {
                  const pct = resumo.total > 0 ? (f.total / resumo.total) * 100 : 0
                  return (
                    <div key={f.nome}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5"><span className="truncate">{f.nome}</span><span className="font-medium ml-2">{brl(f.total)}</span></div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Package className="w-4 h-4 text-gray-400" /> O que mais pesa nas compras</h2>
              <div className="space-y-2">
                {(resumo.porMaterial || []).slice(0, 6).map((m: any) => {
                  const pct = resumo.total > 0 ? (m.total / resumo.total) * 100 : 0
                  return (
                    <div key={m.nome}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5"><span className="truncate">{m.nome}</span><span className="font-medium ml-2">{brl(m.total)}</span></div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Evolução de preço (bônus) */}
          {materiaisComEvolucao.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">📈 Evolução de preço por material</h2>
              <div className="space-y-2">
                {materiaisComEvolucao.slice(0, 12).map(([mid, arr]: any) => {
                  const primeiro = arr[0], ultimo = arr[arr.length - 1]
                  const subiu = Number(ultimo.precoUnidade) > Number(primeiro.precoUnidade)
                  const igual = Number(ultimo.precoUnidade) === Number(primeiro.precoUnidade)
                  const pct = Number(primeiro.precoUnidade) > 0 ? ((Number(ultimo.precoUnidade) - Number(primeiro.precoUnidade)) / Number(primeiro.precoUnidade)) * 100 : 0
                  return (
                    <div key={mid} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-700 truncate flex-1">{ultimo.nome}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                        {brl(primeiro.precoUnidade)} <ArrowRight className="w-3 h-3" /> <b className="text-gray-700">{brl(ultimo.precoUnidade)}</b>
                        {!igual && (subiu
                          ? <span className="text-red-500 flex items-center"><TrendingUp className="w-3.5 h-3.5" />+{pct.toFixed(0)}%</span>
                          : <span className="text-emerald-600 flex items-center"><TrendingDown className="w-3.5 h-3.5" />{pct.toFixed(0)}%</span>)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">Veja detalhes em <a href="/compras/historico" className="text-orange-500 underline">Histórico de compras</a>.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
