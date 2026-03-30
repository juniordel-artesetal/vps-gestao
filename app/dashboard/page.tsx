'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  Package, TrendingUp, TrendingDown, DollarSign,
  Clock, AlertTriangle, CheckCircle, RefreshCw,
  ArrowRight, Tag
} from 'lucide-react'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function KpiCard({ title, value, sub, icon: Icon, cor, borderColor, link }: {
  title: string; value: string; sub?: string; icon: React.ElementType
  cor: string; borderColor: string; link?: string
}) {
  const inner = (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={`text-xl font-bold mt-1 ${cor}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-gray-50">
          <Icon className={`w-5 h-5 ${cor}`} />
        </div>
      </div>
      {link && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${cor} opacity-70`}>
          Ver detalhes <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  )
  return link ? <Link href={link}>{inner}</Link> : <div>{inner}</div>
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium">
            {typeof p.value === 'number' && p.name !== 'Pedidos' && p.name !== 'Entregues'
              ? fmtR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardGeral() {
  const hoje = new Date()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/resumo')
      setData(await res.json())
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const p = data?.producao   || {}
  const f = data?.financeiro || {}
  const pc = data?.precificacao || {}

  return (
    <div className="p-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visão geral do negócio — {MESES[hoje.getMonth()]} {hoje.getFullYear()}
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 border border-orange-200 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-orange-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── PRODUÇÃO */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" /> Produção — Este Mês
              </h2>
              <Link href="/dashboard/painel" className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                Ver painel completo <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard title="Total Pedidos"  value={String(p.total || 0)}
                icon={Package}       cor="text-gray-700"   borderColor="border-gray-400"
                link="/dashboard/pedidos" />
              <KpiCard title="Em Andamento"  value={String(p.emAndamento || 0)}
                icon={Clock}         cor="text-blue-600"   borderColor="border-blue-500"
                link="/dashboard/painel" />
              <KpiCard title="Abertos"       value={String(p.abertos || 0)}
                icon={Package}       cor="text-yellow-600" borderColor="border-yellow-500"
                link="/dashboard/pedidos" />
              <KpiCard title="Entregues"     value={String(p.entregues || 0)}
                icon={CheckCircle}   cor="text-green-600"  borderColor="border-green-500" />
              <KpiCard title="Atrasados"     value={String(p.atrasados || 0)}
                sub={p.atrasados > 0 ? '⚠️ Requer atenção' : 'Tudo em dia'}
                icon={AlertTriangle} cor={p.atrasados > 0 ? 'text-red-600' : 'text-green-600'}
                borderColor={p.atrasados > 0 ? 'border-red-500' : 'border-green-500'}
                link="/dashboard/pedidos" />
              <KpiCard title="Cancelados"    value={String(p.cancelados || 0)}
                icon={TrendingDown}  cor="text-gray-500"   borderColor="border-gray-300" />
            </div>
          </section>

          {/* ── FINANCEIRO */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" /> Financeiro — Este Mês
              </h2>
              <Link href="/financeiro" className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                Ver financeiro <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard title="Receita"    value={fmtR(f.totalReceita)}
                icon={TrendingUp}   cor="text-green-600"  borderColor="border-green-500"
                link="/financeiro" />
              <KpiCard title="Despesa"   value={fmtR(f.totalDespesa)}
                icon={TrendingDown} cor="text-red-600"    borderColor="border-red-500"
                link="/financeiro/lancamentos" />
              <KpiCard title="Resultado" value={fmtR(f.resultado)}
                icon={DollarSign}
                cor={f.resultado >= 0 ? 'text-blue-600' : 'text-red-600'}
                borderColor={f.resultado >= 0 ? 'border-blue-500' : 'border-red-500'}
                link="/financeiro" />
              <KpiCard title="Margem"    value={`${f.margem || 0}%`}
                sub={f.margem >= 20 ? '🟢 Saudável' : f.margem >= 10 ? '🟡 Atenção' : '🔴 Crítica'}
                icon={TrendingUp}
                cor={f.margem >= 20 ? 'text-green-600' : f.margem >= 10 ? 'text-yellow-600' : 'text-red-600'}
                borderColor={f.margem >= 20 ? 'border-green-500' : f.margem >= 10 ? 'border-yellow-500' : 'border-red-500'} />
              <KpiCard title="A Receber" value={fmtR(f.aReceber)}
                sub="Pendente"      icon={Clock}         cor="text-teal-600"   borderColor="border-teal-500"
                link="/financeiro/lancamentos" />
              <KpiCard title="A Pagar"   value={fmtR(f.aPagar)}
                sub="Pendente"      icon={AlertTriangle} cor="text-orange-600" borderColor="border-orange-500"
                link="/financeiro/lancamentos" />
            </div>
          </section>

          {/* ── GRÁFICOS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Gráfico financeiro */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Receitas vs Despesas — Últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.tendencia} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" name="Receita" fill="#16a34a" radius={[3,3,0,0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#dc2626" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico produção */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Pedidos — Últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.tendencia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="pedidos"   name="Pedidos"   stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line dataKey="entregues" name="Entregues" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── PRECIFICAÇÃO */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-500" /> Precificação — {pc.totalProdutos || 0} produtos ativos
              </h2>
              <Link href="/precificacao/produtos" className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Melhores margens */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-green-500 text-white px-4 py-2.5">
                  <p className="text-xs font-semibold">🏆 Melhores Margens</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {(pc.melhores || []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhum produto precificado</p>
                  )}
                  {(pc.melhores || []).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{p.nome}</p>
                        <p className="text-xs text-gray-400">{p.canal} · {fmtR(p.preco)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">{p.margem}%</p>
                        <p className="text-xs text-green-500">margem bruta</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Piores margens */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-red-500 text-white px-4 py-2.5">
                  <p className="text-xs font-semibold">⚠️ Menores Margens — Atenção</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {(pc.piores || []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhum produto precificado</p>
                  )}
                  {(pc.piores || []).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{p.nome}</p>
                        <p className="text-xs text-gray-400">{p.canal} · {fmtR(p.preco)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                          p.margem >= 15 ? 'bg-yellow-50 text-yellow-700'
                          : p.margem >= 0 ? 'bg-red-50 text-red-600'
                          : 'bg-red-100 text-red-800'
                        }`}>
                          {p.margem}%
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">margem bruta</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Atalhos */}
          <section>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Acesso Rápido</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: '/dashboard/pedidos',      label: '📦 Novo Pedido',       desc: 'Cadastrar pedido'     },
                { href: '/financeiro/lancamentos', label: '💰 Lançamento',         desc: 'Receita ou despesa'   },
                { href: '/precificacao/produtos',  label: '🏷️ Precificar',          desc: 'Novo produto'         },
                { href: '/gestao',                 label: '🤖 Análise IA',          desc: 'Consultar assistente' },
              ].map(l => (
                <Link key={l.href} href={l.href}
                  className="bg-white rounded-xl border border-gray-100 p-4 hover:border-orange-300 hover:shadow-sm transition-all group">
                  <p className="font-semibold text-gray-700 group-hover:text-orange-600 text-sm">{l.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.desc}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
