'use client'
import React from 'react'
// app/financeiro/fluxo/page.tsx
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface DiaFluxo {
  dia: number; receita: number; despesa: number
  aReceber: number; aPagar: number
  saldoDia: number; saldoAcumulado: number
  lancamentos: { id: string; tipo: string; descricao: string; valor: number; valorRealizado?: number; status: string; categoriaIcone?: string }[]
}

interface FluxoData {
  ano: number; mes: number; diasNoMes: number
  totalReceita: number; totalDespesa: number
  totalAReceber: number; totalAPagar: number
  saldoFinal: number; dias: DiaFluxo[]
}

export default function FluxoPage() {
  const hoje = new Date()
  const [ano, setAno]       = useState(hoje.getFullYear())
  const [mes, setMes]       = useState(hoje.getMonth() + 1)
  const [data, setData]     = useState<FluxoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [diaAberto, setDiaAberto] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/financeiro/fluxo?ano=${ano}&mes=${mes}`)
      setData(await res.json())
    } finally { setLoading(false) }
  }, [ano, mes])

  useEffect(() => { fetchData() }, [fetchData])

  const navMes = (dir: number) => {
    let nm = mes + dir, na = ano
    if (nm < 1)  { nm = 12; na-- }
    if (nm > 12) { nm = 1;  na++ }
    setMes(nm); setAno(na)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fluxo de Caixa</h1>
          <p className="text-sm text-gray-500">Movimentação dia a dia</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <span className="text-sm font-semibold text-gray-700 min-w-[150px] text-center">{MESES[mes - 1]} {ano}</span>
          <button onClick={() => navMes(1)}  className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Receitas',    value: data.totalReceita,  cls: 'text-green-700  bg-green-50  border-green-100' },
            { label: 'Despesas',    value: data.totalDespesa,  cls: 'text-red-700    bg-red-50    border-red-100' },
            { label: 'A Receber',   value: data.totalAReceber, cls: 'text-teal-700   bg-teal-50   border-teal-100' },
            { label: 'A Pagar',     value: data.totalAPagar,   cls: 'text-orange-700 bg-orange-50 border-orange-100' },
            { label: 'Saldo Final', value: data.saldoFinal,    cls: data.saldoFinal >= 0 ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-red-700 bg-red-50 border-red-100' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-3 ${c.cls}`}>
              <p className="text-xs font-medium opacity-70">{c.label}</p>
              <p className="text-base font-bold mt-0.5">{fmtR(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-center px-4 py-3 text-xs font-semibold w-16">DIA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold">RECEITAS</th>
                <th className="text-right px-4 py-3 text-xs font-semibold">DESPESAS</th>
                <th className="text-right px-4 py-3 text-xs font-semibold">A RECEBER</th>
                <th className="text-right px-4 py-3 text-xs font-semibold">A PAGAR</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-yellow-300">SALDO DO DIA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold">ACUMULADO</th>
                <th className="text-center px-4 py-3 text-xs font-semibold">LANÇ.</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">Carregando...</td></tr>}
              {!loading && data?.dias.map(d => {
                const isHoje = d.dia === hoje.getDate() && mes === hoje.getMonth() + 1 && ano === hoje.getFullYear()
                const temMov = d.receita || d.despesa || d.aReceber || d.aPagar
                const aberto = diaAberto === d.dia

                return (
                  <React.Fragment key={d.dia}>
                    <tr
                      onClick={() => temMov && setDiaAberto(aberto ? null : d.dia)}
                      className={`border-t border-gray-50 transition-colors ${isHoje ? 'bg-orange-50' : temMov ? 'hover:bg-gray-50 cursor-pointer' : ''}`}>
                      <td className={`text-center px-4 py-2.5 font-bold text-sm ${isHoje ? 'text-orange-600' : 'text-gray-400'}`}>
                        {String(d.dia).padStart(2, '0')}
                        {isHoje && <span className="block text-[10px] text-orange-400 font-normal">hoje</span>}
                      </td>
                      <td className="text-right px-4 py-2.5 font-medium text-green-600">
                        {d.receita ? fmtR(d.receita) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="text-right px-4 py-2.5 font-medium text-red-600">
                        {d.despesa ? fmtR(d.despesa) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="text-right px-4 py-2.5 text-teal-600">
                        {d.aReceber ? fmtR(d.aReceber) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="text-right px-4 py-2.5 text-orange-600">
                        {d.aPagar ? fmtR(d.aPagar) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className={`text-right px-4 py-2.5 font-bold ${d.saldoDia > 0 ? 'text-green-600' : d.saldoDia < 0 ? 'text-red-600' : 'text-gray-300'}`}>
                        {d.saldoDia !== 0 ? fmtR(d.saldoDia) : '—'}
                      </td>
                      <td className={`text-right px-4 py-2.5 font-semibold ${d.saldoAcumulado >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                        {fmtR(d.saldoAcumulado)}
                      </td>
                      <td className="text-center px-4 py-2.5">
                        {d.lancamentos.length > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">
                            {d.lancamentos.length}
                          </span>
                        )}
                      </td>
                    </tr>
                    {aberto && d.lancamentos.length > 0 && (
                      <tr key={`det-${d.dia}`} className="bg-gray-50 border-t border-gray-100">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="space-y-1.5">
                            {d.lancamentos.map(l => (
                              <div key={l.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span>{l.categoriaIcone || '📋'}</span>
                                  <span className="text-gray-600">{l.descricao}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${l.status === 'PAGO' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{l.status}</span>
                                </div>
                                <span className={`font-semibold ${l.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>
                                  {l.tipo === 'RECEITA' ? '+' : '-'}{fmtR(l.valorRealizado || l.valor)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
            {data && (
              <tfoot>
                <tr className="bg-gray-800 text-white border-t-2 border-gray-700">
                  <td className="px-4 py-2.5 text-xs font-bold">TOTAL</td>
                  <td className="text-right px-4 py-2.5 text-xs font-bold text-green-300">{fmtR(data.totalReceita)}</td>
                  <td className="text-right px-4 py-2.5 text-xs font-bold text-red-300">{fmtR(data.totalDespesa)}</td>
                  <td className="text-right px-4 py-2.5 text-xs font-bold text-teal-300">{fmtR(data.totalAReceber)}</td>
                  <td className="text-right px-4 py-2.5 text-xs font-bold text-orange-300">{fmtR(data.totalAPagar)}</td>
                  <td className={`text-right px-4 py-2.5 text-xs font-bold ${data.saldoFinal >= 0 ? 'text-yellow-300' : 'text-red-300'}`}>{fmtR(data.saldoFinal)}</td>
                  <td className="text-right px-4 py-2.5 text-xs font-bold">{fmtR(data.saldoFinal)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
