'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Search, X, CheckCircle, Clock, AlertCircle, DollarSign, Package, Filter } from 'lucide-react'

interface Demanda {
  id: string
  pedidoRef: string | null
  freelancerNome: string
  freelancerId: string
  nomeProduto: string | null
  qtdSolicitada: number
  qtdProduzida: number
  valorPorItem: number
  valorTotal: number
  status: string
  dataPagamento: string | null
  createdAt: string
}
interface Freelancer { id: string; nome: string }

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDENTE:    { label: 'Pendente',    cls: 'bg-gray-100 text-gray-600' },
  EM_PRODUCAO: { label: 'Em produção', cls: 'bg-blue-50 text-blue-700' },
  PRODUZIDO:   { label: 'Produzido',  cls: 'bg-yellow-50 text-yellow-700' },
  PAGO:        { label: 'Pago',       cls: 'bg-green-50 text-green-700' },
}

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function HistoricoDemandas() {
  const { data: session } = useSession()

  const [demandas,     setDemandas]     = useState<Demanda[]>([])
  const [freelancers,  setFreelancers]  = useState<Freelancer[]>([])
  const [loading,      setLoading]      = useState(true)

  // Filtros
  const [busca,        setBusca]        = useState('')
  const [filtroFre,    setFiltroFre]    = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDe,     setFiltroDe]     = useState('')
  const [filtroAte,    setFiltroAte]    = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, fRes] = await Promise.all([
        fetch('/api/demandas').then(r => r.json()),
        fetch('/api/config/freelancers?todos=1').then(r => r.json()).catch(() => []),
      ])
      setDemandas(Array.isArray(dRes) ? dRes : [])
      setFreelancers(Array.isArray(fRes) ? fRes : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Filtrar client-side
  const filtradas = demandas.filter(d => {
    if (filtroFre    && d.freelancerId !== filtroFre)    return false
    if (filtroStatus && d.status       !== filtroStatus) return false
    const dt = d.createdAt?.slice(0, 10)
    if (filtroDe  && dt < filtroDe)  return false
    if (filtroAte && dt > filtroAte) return false
    if (busca) {
      const b = busca.toLowerCase()
      if (!(d.freelancerNome?.toLowerCase().includes(b) ||
            d.nomeProduto?.toLowerCase().includes(b) ||
            d.pedidoRef?.toLowerCase().includes(b))) return false
    }
    return true
  })

  // Totais do período filtrado
  const totalPago     = filtradas.filter(d => d.status === 'PAGO').reduce((s, d) => s + (d.valorTotal || 0), 0)
  const totalPendente = filtradas.filter(d => d.status !== 'PAGO').reduce((s, d) => s + (d.valorPorItem * d.qtdSolicitada), 0)
  const totalItens    = filtradas.reduce((s, d) => s + d.qtdSolicitada, 0)

  const temFiltro = busca || filtroFre || filtroStatus || filtroDe || filtroAte

  function limpar() {
    setBusca(''); setFiltroFre(''); setFiltroStatus(''); setFiltroDe(''); setFiltroAte('')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock size={20} className="text-orange-500"/> Histórico de Demandas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Todas as demandas enviadas para freelancers — filtre por período, freelancer ou status
          </p>
        </div>

        {/* Stats do período */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: temFiltro ? 'Demandas (filtro)' : 'Total de demandas', value: filtradas.length,      cls: 'text-gray-900 dark:text-white',   icon: Package     },
            { label: temFiltro ? 'Itens (filtro)'    : 'Total de itens',    value: totalItens,             cls: 'text-gray-900 dark:text-white',   icon: Clock       },
            { label: temFiltro ? 'A pagar (filtro)'  : 'Total a pagar',     value: fmtR(totalPendente),    cls: 'text-orange-500',                 icon: AlertCircle },
            { label: temFiltro ? 'Pago (filtro)'     : 'Total pago',        value: fmtR(totalPago),        cls: 'text-green-500',                  icon: CheckCircle },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={14} className={s.cls}/>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Busca */}
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar freelancer, descrição, pedido..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
            </div>

            {/* Freelancer */}
            <select value={filtroFre} onChange={e => setFiltroFre(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todas as freelancers</option>
              {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>

            {/* Status */}
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>

            {/* Período */}
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">De</label>
                <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Até</label>
                <input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
            </div>

            {temFiltro && (
              <button onClick={limpar}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 pb-1">
                <X size={13}/> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Freelancer','Descrição','Pedido','Solicitado','Produzido','R$/Item','Total','Status','Criado em'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">Carregando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package size={32} className="text-gray-200 dark:text-gray-700 mx-auto mb-2"/>
                    <p className="text-gray-400 text-sm">{temFiltro ? 'Nenhuma demanda no período/filtro selecionado' : 'Nenhuma demanda cadastrada'}</p>
                  </td>
                </tr>
              ) : filtradas.map(d => {
                const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDENTE
                return (
                  <tr key={d.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{d.freelancerNome}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-40 truncate" title={d.nomeProduto || ''}>{d.nomeProduto || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{d.pedidoRef || '—'}</td>
                    <td className="px-4 py-3 text-center font-mono text-gray-700 dark:text-gray-300">{d.qtdSolicitada}</td>
                    <td className="px-4 py-3 text-center font-mono text-gray-700 dark:text-gray-300">{d.qtdProduzida}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{fmtR(d.valorPorItem)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {d.status === 'PAGO'
                        ? <span className="text-green-600">{fmtR(d.valorTotal)}</span>
                        : <span className="text-gray-700 dark:text-gray-300">{fmtR(d.valorPorItem * d.qtdSolicitada)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.cls}`}>
                        {sc.label}
                      </span>
                      {d.status === 'PAGO' && d.dataPagamento && (
                        <p className="text-xs text-gray-400 mt-0.5">{fmtData(d.dataPagamento)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtData(d.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
            {filtradas.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <td colSpan={3} className="px-4 py-3 text-xs text-gray-400 font-semibold text-right">Totais do filtro:</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">{totalItens}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">{filtradas.reduce((s, d) => s + d.qtdProduzida, 0)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-xs">
                    <span className="text-orange-500 font-semibold block">A pagar: {fmtR(totalPendente)}</span>
                    <span className="text-green-500 font-semibold block">Pago: {fmtR(totalPago)}</span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
