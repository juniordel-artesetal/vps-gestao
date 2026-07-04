'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserCheck, UserPlus, ShoppingBag, DollarSign, TrendingUp, Download, BarChart2, Trophy } from 'lucide-react'

type Metricas = { totalClientes: number; ativos: number; inativos: number; novosMes: number; pedidosVinculados: number; totalVendas: number; ticketMedioGeral: number }
type ClienteRel = { id: string; nome: string; origem?: string; ativo: boolean; qtdPedidos: number; valorTotal: number }
type Origem = { origem: string; qtd: number }

const fmtR = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`

function Card({ icon: Icon, label, valor, cor = 'text-gray-800' }: { icon: any; label: string; valor: string | number; cor?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1"><Icon size={13} />{label}</div>
      <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
    </div>
  )
}

export default function VisaoGeralPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState<Metricas>({ totalClientes: 0, ativos: 0, inativos: 0, novosMes: 0, pedidosVinculados: 0, totalVendas: 0, ticketMedioGeral: 0 })
  const [clientes, setClientes] = useState<ClienteRel[]>([])
  const [porOrigem, setPorOrigem] = useState<Origem[]>([])

  useEffect(() => {
    fetch('/api/clientes/visao-geral')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setMetricas(d.metricas); setClientes(d.clientes || []); setPorOrigem(d.porOrigem || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function exportarCSV() {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const linhas = [
      ['Nome', 'Origem', 'Ativo', 'Qtd Pedidos', 'Valor Total'].join(';'),
      ...clientes.map(c => [esc(c.nome), esc(c.origem || ''), c.ativo ? 'Sim' : 'Não', c.qtdPedidos, String(c.valorTotal).replace('.', ',')].join(';')),
    ]
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'relatorio-clientes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-5 text-gray-400 text-sm">Carregando…</div>

  const maxOrigem = Math.max(1, ...porOrigem.map(o => o.qtd))
  const top = clientes.slice(0, 10)

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-orange-500" size={22} />
          <h1 className="text-xl font-bold text-gray-800">Visão Geral — Clientes</h1>
        </div>
        <button onClick={exportarCSV} disabled={clientes.length === 0}
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          <Download size={15} /> Exportar relatório (CSV)
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card icon={Users}     label="Total de clientes" valor={metricas.totalClientes} />
        <Card icon={UserCheck} label="Ativos"            valor={metricas.ativos} cor="text-green-600" />
        <Card icon={UserPlus}  label="Novos no mês"      valor={metricas.novosMes} cor="text-orange-600" />
        <Card icon={ShoppingBag} label="Pedidos vinculados" valor={metricas.pedidosVinculados} />
        <Card icon={DollarSign} label="Total em vendas"  valor={fmtR(metricas.totalVendas)} cor="text-green-600" />
        <Card icon={TrendingUp} label="Ticket médio geral" valor={fmtR(metricas.ticketMedioGeral)} />
        <Card icon={Users}     label="Inativos"          valor={metricas.inativos} cor="text-gray-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Ranking top clientes */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-1.5">
            <Trophy size={15} className="text-orange-500" /><h2 className="text-sm font-semibold text-gray-700">Top clientes por valor</h2>
          </div>
          {top.length === 0 ? <p className="text-gray-400 text-sm p-4">Sem dados ainda.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {top.map((c, i) => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => router.push(`/clientes/${c.id}`)}>
                    <td className="px-4 py-2 text-gray-400 w-8">{i + 1}º</td>
                    <td className="px-4 py-2 font-medium text-gray-700 truncate">{c.nome}</td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs">{c.qtdPedidos} ped.</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-700">{fmtR(c.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Distribuição por origem */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50"><h2 className="text-sm font-semibold text-gray-700">Clientes por origem</h2></div>
          {porOrigem.length === 0 ? <p className="text-gray-400 text-sm p-4">Sem dados ainda.</p> : (
            <div className="p-4 space-y-2">
              {porOrigem.map(o => (
                <div key={o.origem}>
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5"><span>{o.origem}</span><span className="font-medium">{o.qtd}</span></div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{ width: `${(o.qtd / maxOrigem) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
