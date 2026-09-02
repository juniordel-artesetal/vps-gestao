'use client'
import React from 'react'
// app/financeiro/fluxo/page.tsx
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { agruparDiaFluxo } from '@/lib/fluxoDia'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface DiaFluxo {
  dia: number; receita: number; despesa: number
  aReceber: number; aPagar: number
  saldoDia: number; saldoAcumulado: number
  lancamentos: { id: string; tipo: string; descricao: string; valor: number; valorRealizado?: number; status: string; parcela?: number | null; totalParcelas?: number | null; categoriaIcone?: string; categoriaNome?: string | null; contaNome?: string | null }[]
}

interface FluxoData {
  ano: number; mes: number; diasNoMes: number
  saldoAnterior: number
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

  // Buscar por DATA: vai direto ao dia (troca o mês se preciso, abre e rola até ele).
  const irParaData = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return
    const [a, m, d] = iso.split('-').map(Number)
    setAno(a); setMes(m); setDiaAberto(d)
    setTimeout(() => {
      document.getElementById(`dia-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Caixa Diário</h1>
          <p className="text-sm text-gray-500">Movimentação dia a dia</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" onChange={e => irParaData(e.target.value)} title="Ir para uma data"
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400" />
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

              {/* ── LINHA SALDO ANTERIOR ── */}
              {!loading && data && (
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td className="text-center px-4 py-2 text-xs font-bold text-gray-500">—</td>
                  <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-gray-500">
                    Saldo anterior ({MESES[mes - 1 === 0 ? 11 : mes - 2]} {mes === 1 ? ano - 1 : ano})
                  </td>
                  <td className={`text-right px-4 py-2 text-sm font-bold ${data.saldoAnterior >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                    {fmtR(data.saldoAnterior)}
                  </td>
                  <td />
                </tr>
              )}

              {!loading && data?.dias.map(d => {
                const isHoje = d.dia === hoje.getDate() && mes === hoje.getMonth() + 1 && ano === hoje.getFullYear()
                const temMov = d.receita || d.despesa || d.aReceber || d.aPagar
                const aberto = diaAberto === d.dia

                return (
                  <React.Fragment key={d.dia}>
                    <tr
                      id={`dia-${d.dia}`}
                      onClick={() => temMov && setDiaAberto(aberto ? null : d.dia)}
                      role={temMov ? 'button' : undefined}
                      tabIndex={temMov ? 0 : undefined}
                      aria-expanded={temMov ? aberto : undefined}
                      aria-label={temMov ? `Ver lançamentos do dia ${d.dia}` : undefined}
                      onKeyDown={temMov ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDiaAberto(aberto ? null : d.dia) } } : undefined}
                      className={`border-t border-gray-50 transition-colors ${aberto ? 'bg-orange-100/60' : isHoje ? 'bg-orange-50' : temMov ? 'hover:bg-gray-50 cursor-pointer' : ''}`}>
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
                    {aberto && (
                      <tr key={`det-${d.dia}`} className="bg-gray-50 border-t border-gray-100">
                        <td colSpan={8} className="px-6 py-3">
                          {(() => {
                            const grp = agruparDiaFluxo(d.lancamentos)
                            if (grp.vazio) return <p className="text-xs text-gray-400">Nada neste dia.</p>
                            const secoes = [
                              { key: 'aPagar',   titulo: 'A pagar',   cor: 'text-orange-600', sinal: '-', s: grp.aPagar },
                              { key: 'aReceber', titulo: 'A receber', cor: 'text-teal-600',   sinal: '+', s: grp.aReceber },
                              { key: 'entrou',   titulo: 'Entrou',    cor: 'text-green-600',  sinal: '+', s: grp.entrou },
                              { key: 'saiu',     titulo: 'Saiu',      cor: 'text-red-600',    sinal: '-', s: grp.saiu },
                            ].filter(x => x.s.itens.length > 0)
                            return (
                              <div className="space-y-3">
                                {secoes.map(sec => (
                                  <div key={sec.key}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className={`text-[11px] font-bold uppercase tracking-wide ${sec.cor}`}>{sec.titulo}</span>
                                      <span className={`text-xs font-bold tabular-nums ${sec.cor}`}>{sec.sinal}{fmtR(sec.s.subtotal)}</span>
                                    </div>
                                    <div className="space-y-0.5">
                                      {sec.s.itens.map((l, i) => (
                                        <Link key={l.id + '-' + i} href="/financeiro/lancamentos" className="flex items-center justify-between gap-2 text-xs rounded px-1.5 py-1 -mx-1.5 hover:bg-white transition-colors">
                                          <span className="flex items-center gap-1.5 flex-wrap min-w-0">
                                            <span>{l.categoriaIcone || '📋'}</span>
                                            <span className="text-gray-700 truncate">{l.descricao}</span>
                                            {l.parcela && l.totalParcelas ? <span className="text-[10px] text-gray-400">{l.parcela}/{l.totalParcelas}</span> : null}
                                            <span className="text-[10px] text-gray-400">{l.categoriaNome || 'sem categoria'}</span>
                                            {l.contaNome && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100">🏦 {l.contaNome}</span>}
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${l.status === 'PAGO' ? 'bg-green-50 text-green-700' : l.status === 'PARCIAL' ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>{l.status}</span>
                                          </span>
                                          <span className={`font-semibold tabular-nums whitespace-nowrap ${sec.cor}`}>{sec.sinal}{fmtR(l.valorSecao)}</span>
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
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
