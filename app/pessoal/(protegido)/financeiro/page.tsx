'use client'
// Dashboard de finanças pessoais: KPIs do mês + saldo em contas + pizza por categoria +
// evolução mensal + últimos lançamentos. Réplica pessoal do financeiro do ateliê.
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brDate = (s: string) => { const [y, m, d] = (s || '').slice(0, 10).split('-'); return d ? `${d}/${m}` : '—' }

interface Cat { nome: string; cor: string; icone: string; total: number }
interface Resumo {
  totalReceita: number; totalDespesa: number; resultado: number; aReceber: number; aPagar: number; saldoTotal: number
  catReceita: Cat[]; catDespesa: Cat[]
  chart: { label: string; receita: number; despesa: number; resultado: number }[]
  ultimos: { id: string; tipo: string; descricao: string; valor: number; data: string; status: string; categoriaNome: string | null; categoriaIcone: string | null }[]
}

function Pizza({ dados }: { dados: Cat[] }) {
  const total = dados.reduce((s, d) => s + d.total, 0)
  if (total <= 0) return <p className="text-xs text-gray-400 py-8 text-center">Sem dados no mês.</p>
  let acc = 0
  const stops = dados.map(d => { const ini = (acc / total) * 100; acc += d.total; return `${d.cor} ${ini}% ${(acc / total) * 100}%` }).join(', ')
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 h-28 rounded-full flex-shrink-0" style={{ background: `conic-gradient(${stops})` }} />
      <div className="flex-1 space-y-1 min-w-0">
        {dados.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.cor }} />
            <span className="text-gray-600 dark:text-neutral-300 truncate flex-1">{d.icone} {d.nome}</span>
            <span className="text-gray-500 tabular-nums">{Math.round((d.total / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FinanceiroPessoalPage() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [d, setD] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch(`/api/pessoal/resumo?ano=${ano}&mes=${mes}`); if (r.ok) setD(await r.json()) } finally { setLoading(false) }
  }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])

  const trocaMes = (delta: number) => { let m = mes + delta, a = ano; if (m < 1) { m = 12; a-- } if (m > 12) { m = 1; a++ } setMes(m); setAno(a) }
  const maxBar = Math.max(1, ...(d?.chart || []).flatMap(c => [c.receita, c.despesa]))
  const card = 'rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4'

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/pessoal" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Minhas Finanças</h1>
            <p className="text-sm text-gray-500">Seu dinheiro pessoal, separado do ateliê</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => trocaMes(-1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium text-gray-700 dark:text-neutral-200 w-32 text-center">{MESES[mes - 1]} {ano}</span>
          <button onClick={() => trocaMes(1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Atalhos */}
      <div className="flex flex-wrap gap-2">
        {[['Lançamentos', '/pessoal/financeiro/lancamentos'], ['Contas', '/pessoal/financeiro/contas'], ['Categorias', '/pessoal/financeiro/categorias'], ['Fluxo', '/pessoal/financeiro/fluxo'], ['Metas', '/pessoal/financeiro/metas']].map(([l, h]) => (
          <Link key={h} href={h} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800">{l}</Link>
        ))}
        <Link href="/pessoal/financeiro/lancamentos?novo=1" className="px-3 py-1.5 rounded-lg text-sm bg-orange-500 text-white font-medium hover:bg-orange-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Novo</Link>
      </div>

      {loading ? <p className="text-gray-400 text-sm py-10 text-center">Carregando…</p> : d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={card}><div className="flex items-center gap-1.5 text-indigo-500 text-xs font-medium"><Wallet className="w-4 h-4" /> Saldo em contas</div><p className={`text-xl font-bold mt-1 ${d.saldoTotal >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-red-600'}`}>{fmt(d.saldoTotal)}</p></div>
            <div className={card}><div className="flex items-center gap-1.5 text-green-500 text-xs font-medium"><TrendingUp className="w-4 h-4" /> Receitas</div><p className="text-xl font-bold mt-1 text-green-700 dark:text-green-400">{fmt(d.totalReceita)}</p>{d.aReceber > 0 && <p className="text-[11px] text-teal-600">a receber {fmt(d.aReceber)}</p>}</div>
            <div className={card}><div className="flex items-center gap-1.5 text-red-500 text-xs font-medium"><TrendingDown className="w-4 h-4" /> Despesas</div><p className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">{fmt(d.totalDespesa)}</p>{d.aPagar > 0 && <p className="text-[11px] text-orange-600">a pagar {fmt(d.aPagar)}</p>}</div>
            <div className={card}><div className="text-xs font-medium text-gray-500">Resultado do mês</div><p className={`text-xl font-bold mt-1 ${d.resultado >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600'}`}>{fmt(d.resultado)}</p></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={card}><h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">Receitas por categoria</h3><Pizza dados={d.catReceita} /></div>
            <div className={card}><h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">Despesas por categoria</h3><Pizza dados={d.catDespesa} /></div>
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">Evolução (12 meses)</h3>
            <div className="flex items-end gap-2 h-40 overflow-x-auto">
              {d.chart.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[28px]">
                  <div className="flex items-end gap-0.5 h-32">
                    <div className="w-2.5 bg-green-400 rounded-t" style={{ height: `${(c.receita / maxBar) * 100}%` }} title={`Receita ${fmt(c.receita)}`} />
                    <div className="w-2.5 bg-red-400 rounded-t" style={{ height: `${(c.despesa / maxBar) * 100}%` }} title={`Despesa ${fmt(c.despesa)}`} />
                  </div>
                  <span className="text-[10px] text-gray-400">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">Últimos lançamentos</h3>
            {d.ultimos.length === 0 ? <p className="text-xs text-gray-400 py-4">Nada ainda. <Link href="/pessoal/financeiro/lancamentos?novo=1" className="text-orange-500">Adicionar</Link>.</p> : (
              <div className="divide-y divide-gray-50 dark:divide-neutral-800">
                {d.ultimos.map(l => (
                  <div key={l.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="text-gray-400 text-xs w-10">{brDate(l.data)}</span>
                    <span className="flex-1 text-gray-700 dark:text-neutral-200 truncate">{l.categoriaIcone || ''} {l.descricao}{l.status === 'PENDENTE' && <span className="ml-1 text-[10px] text-amber-600">• pendente</span>}</span>
                    <span className={`font-semibold tabular-nums ${l.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{l.tipo === 'RECEITA' ? '+' : '−'}{fmt(l.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
