'use client'
// Fluxo de caixa pessoal: por dia (entradas/saídas + a receber/pagar) e saldo acumulado.
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

export default function FluxoPage() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear()); const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [d, setD] = useState<any>(null); const [loading, setLoading] = useState(true)
  const carregar = useCallback(async () => { setLoading(true); try { const r = await fetch(`/api/pessoal/financeiro/fluxo?ano=${ano}&mes=${mes}`); if (r.ok) setD(await r.json()) } finally { setLoading(false) } }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])
  const troca = (x: number) => { let m = mes + x, a = ano; if (m < 1) { m = 12; a-- } if (m > 12) { m = 1; a++ } setMes(m); setAno(a) }
  const hojeDia = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1 ? hoje.getDate() : -1

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3"><Link href="/pessoal/financeiro" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Fluxo de Caixa</h1></div>
        <div className="flex items-center gap-2"><button onClick={() => troca(-1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700"><ChevronLeft className="w-4 h-4" /></button><span className="text-sm font-medium w-32 text-center">{MESES[mes - 1]} {ano}</span><button onClick={() => troca(1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700"><ChevronRight className="w-4 h-4" /></button></div>
      </div>
      {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[['Receitas', d.totalReceita, 'text-green-600'], ['Despesas', d.totalDespesa, 'text-red-600'], ['A receber/pagar', d.totalAReceber - d.totalAPagar, 'text-amber-600'], ['Saldo final', d.saldoFinal, 'text-indigo-600']].map(([l, v, c]: any) => (
              <div key={l} className="rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3"><p className="text-xs text-gray-400">{l}</p><p className={`font-bold ${c}`}>{fmt(v)}</p></div>
            ))}
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-neutral-800/50 text-xs text-gray-500"><th className="text-left px-3 py-2">Dia</th><th className="text-right px-3 py-2">Entrou</th><th className="text-right px-3 py-2">Saiu</th><th className="text-right px-3 py-2">A receber</th><th className="text-right px-3 py-2">A pagar</th><th className="text-right px-3 py-2">Acumulado</th></tr></thead>
              <tbody>
                <tr className="border-t border-gray-50 dark:border-neutral-800 text-gray-400"><td className="px-3 py-1.5" colSpan={5}>Saldo anterior</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.saldoAnterior)}</td></tr>
                {d.dias.map((x: any) => (
                  <tr key={x.dia} className={`border-t border-gray-50 dark:border-neutral-800 ${x.dia === hojeDia ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                    <td className="px-3 py-1.5 text-gray-500">{String(x.dia).padStart(2, '0')}{x.dia === hojeDia ? ' • hoje' : ''}</td>
                    <td className="px-3 py-1.5 text-right text-green-600 tabular-nums">{x.receita ? fmt(x.receita) : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-red-600 tabular-nums">{x.despesa ? fmt(x.despesa) : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-teal-500 tabular-nums text-xs">{x.aReceber ? fmt(x.aReceber) : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-orange-500 tabular-nums text-xs">{x.aPagar ? fmt(x.aPagar) : '—'}</td>
                    <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${x.saldoAcumulado >= 0 ? 'text-gray-700 dark:text-neutral-200' : 'text-red-600'}`}>{fmt(x.saldoAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
