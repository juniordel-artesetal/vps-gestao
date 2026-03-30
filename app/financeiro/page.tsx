'use client'
// app/financeiro/page.tsx
import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign,
  Clock, AlertCircle, Percent,
  ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) { return (n || 0).toFixed(1) + '%' }

const MESES     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

interface Resumo {
  totalReceita: number; totalDespesa: number; resultado: number; margem: number
  aReceber: number; aPagar: number
  meta: { metaReceita: number; metaDespesa: number; metaLucro: number } | null
  chart: { label: string; receita: number; despesa: number; resultado: number }[]
  fluxo: { label: string; mes: number; receita: number; despesa: number; resultado: number; acumulado: number; aReceber: number; aPagar: number }[]
  catReceita: { nome: string; cor: string; icone: string; total: number }[]
  catDespesa: { nome: string; cor: string; icone: string; total: number }[]
}

function Card({ title, value, sub, icon: Icon, color, borderColor, progress }: {
  title: string; value: string; sub?: string; icon: React.ElementType
  color: string; borderColor: string; progress?: number
}) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor} p-4 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-opacity-10`} style={{ background: 'rgba(0,0,0,0.04)' }}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Meta</span><span>{fmtPct(progress)}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium">{fmtR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardFinanceiro() {
  const hoje = new Date()
  const [ano, setAno]   = useState(hoje.getFullYear())
  const [mes, setMes]   = useState(hoje.getMonth() + 1)
  const [data, setData] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/financeiro/resumo?ano=${ano}&mes=${mes}`)
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

  const pctReceita = data?.meta?.metaReceita ? (data.totalReceita / data.meta.metaReceita) * 100 : undefined
  const pctLucro   = data?.meta?.metaLucro   ? (data.resultado   / data.meta.metaLucro)   * 100 : undefined

  return (
    <div className="p-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão Financeira</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visão geral do ateliê</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[150px] text-center">
            {MESES[mes - 1]} {ano}
          </span>
          <button onClick={() => navMes(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 ml-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card title="Receita Realizada"  value={fmtR(data?.totalReceita || 0)}
          sub={data?.meta?.metaReceita ? `Meta: ${fmtR(data.meta.metaReceita)}` : undefined}
          icon={TrendingUp}   color="text-green-600"  borderColor="border-green-500"  progress={pctReceita} />
        <Card title="Despesa Realizada"  value={fmtR(data?.totalDespesa || 0)}
          icon={TrendingDown} color="text-red-600"    borderColor="border-red-500" />
        <Card title="Resultado"          value={fmtR(data?.resultado || 0)}
          sub={data?.meta?.metaLucro ? `Meta: ${fmtR(data.meta.metaLucro)}` : undefined}
          icon={DollarSign}
          color={(data?.resultado || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}
          borderColor={(data?.resultado || 0) >= 0 ? 'border-blue-500' : 'border-red-500'}
          progress={pctLucro} />
        <Card title="A Receber" value={fmtR(data?.aReceber || 0)} sub="Em aberto"
          icon={Clock}        color="text-teal-600"   borderColor="border-teal-500" />
        <Card title="A Pagar"   value={fmtR(data?.aPagar || 0)}   sub="Em aberto"
          icon={AlertCircle}  color="text-orange-600" borderColor="border-orange-500" />
        <Card
          title={`Margem — ${MESES_ABR[mes - 1]}/${String(ano).slice(2)}`}
          value={fmtPct(data?.margem || 0)}
          icon={Percent}
          color={(data?.margem || 0) >= 20 ? 'text-green-600' : (data?.margem || 0) >= 10 ? 'text-yellow-600' : 'text-red-600'}
          borderColor={(data?.margem || 0) >= 20 ? 'border-green-500' : (data?.margem || 0) >= 10 ? 'border-yellow-500' : 'border-red-500'} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-orange-500 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Gráficos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Receitas e Despesas</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.chart} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" name="Receita" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Resultado Mensal</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="resultado" name="Resultado" stroke="#f97316" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráficos de Pizza — Receita e Despesa por Categoria */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[
              { title: '🏆 Receita por Categoria', data: data.catReceita, total: data.totalReceita, emptyMsg: 'Nenhuma receita lançada neste mês' },
              { title: '📊 Despesa por Categoria', data: data.catDespesa, total: data.totalDespesa, emptyMsg: 'Nenhuma despesa lançada neste mês' },
            ].map(({ title, data: catData, total, emptyMsg }) => (
              <div key={title} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>
                {catData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-300 text-sm">{emptyMsg}</div>
                ) : (
                  <div className="flex gap-4 items-center">
                    <ResponsiveContainer width="45%" height={180}>
                      <PieChart>
                        <Pie data={catData} dataKey="total" cx="50%" cy="50%"
                          innerRadius={45} outerRadius={75} paddingAngle={2}>
                          {catData.map((entry, i) => (
                            <Cell key={i} fill={entry.cor || '#94a3b8'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtR(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5 overflow-hidden">
                      {catData.slice(0, 6).map((c, i) => {
                        const pct = total > 0 ? (c.total / total) * 100 : 0
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="flex items-center gap-1 truncate text-gray-600">
                                <span>{c.icone}</span>
                                <span className="truncate">{c.nome}</span>
                              </span>
                              <span className="font-semibold ml-2 flex-shrink-0" style={{ color: c.cor }}>{pct.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1">
                              <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: c.cor }} />
                            </div>
                          </div>
                        )
                      })}
                      {catData.length > 6 && (
                        <p className="text-xs text-gray-400 mt-1">+{catData.length - 6} outras categorias</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Fluxo de Caixa Consolidado anual */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Fluxo de Caixa Consolidado — {ano}</h2>
              <a href="/financeiro/fluxo" className="text-xs text-orange-500 hover:underline">Ver por dia →</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold w-48">FLUXO</th>
                    {MESES_ABR.map(m => (
                      <th key={m} className={`text-right px-3 py-2.5 text-xs font-semibold ${m === MESES_ABR[mes - 1] ? 'bg-orange-600' : ''}`}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'receita',   label: 'RECEITAS',             cls: 'text-green-700 font-semibold' },
                    { key: 'despesa',   label: 'DESPESAS',             cls: 'text-red-600 font-semibold' },
                    { key: 'resultado', label: 'RESULTADO MENSAL',     cls: 'font-bold' },
                    { key: 'acumulado', label: 'RESULTADO ACUMULADO',  cls: 'font-bold' },
                  ].map(({ key, label, cls }) => (
                    <tr key={key} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50">{label}</td>
                      {data.fluxo.map(f => {
                        const v = (f as any)[key] as number
                        return (
                          <td key={f.mes} className={`text-right px-3 py-2 text-xs ${cls} ${f.mes === mes ? 'bg-orange-50/50' : ''} ${v < 0 ? '!text-red-600' : ''}`}>
                            {v !== 0 ? fmtR(v) : <span className="text-gray-200">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Links rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/financeiro/lancamentos', label: '📋 Lançamentos',   desc: 'Receitas e despesas' },
              { href: '/financeiro/fluxo',       label: '📅 Fluxo de Caixa', desc: 'Dia a dia' },
              { href: '/financeiro/metas',       label: '🎯 Metas',          desc: 'Metas mensais' },
              { href: '/financeiro/categorias',  label: '🏷️ Categorias',     desc: 'Plano de contas' },
            ].map(l => (
              <a key={l.href} href={l.href}
                className="bg-white rounded-xl border border-gray-100 p-4 hover:border-orange-300 hover:shadow-sm transition-all group">
                <p className="font-semibold text-gray-700 group-hover:text-orange-600 text-sm">{l.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{l.desc}</p>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
