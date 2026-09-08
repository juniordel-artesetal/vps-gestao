'use client'
// Dashboard de finanças pessoais: KPIs do mês + saldo em contas + donut por categoria +
// evolução 12 meses (barras + linha de resultado) + próximas contas/recebimentos + últimos.
// Réplica pessoal do financeiro do ateliê. Escopo por usuário (server). Gráficos: Recharts.
import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Plus, ChevronLeft, ChevronRight, CalendarClock, HandCoins, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = (n: number) => (Math.abs(n) >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : String(Math.round(n)))
const brDia = (s: string) => { const [y, m, d] = (s || '').slice(0, 10).split('-'); return d ? `${d}/${m}` : '—' }
const hojeISO = () => new Date().toISOString().slice(0, 10)

interface Cat { nome: string; cor: string; icone: string; total: number }
interface Prox { id: string; descricao: string; valor: number; data: string; categoriaNome: string | null; categoriaIcone: string | null }
interface Resumo {
  totalReceita: number; totalDespesa: number; resultado: number; aReceber: number; aPagar: number; saldoTotal: number
  saldoPorConta: { id: string; nome: string; cor: string; saldo: number }[]
  catReceita: Cat[]; catDespesa: Cat[]
  chart: { label: string; receita: number; despesa: number; resultado: number }[]; mesesComDado: number
  proximasContas: Prox[]; proximosRecebimentos: Prox[]
  ultimos: { id: string; tipo: string; descricao: string; valor: number; data: string; status: string; categoriaNome: string | null; categoriaIcone: string | null }[]
}

// ── Donut por categoria (Recharts): tooltip valor+%, legenda clicável (liga/desliga fatia), total no centro ──
function DonutCategoria({ dados, corVazio }: { dados: Cat[]; corVazio: string }) {
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())
  const visiveis = dados.filter(d => !ocultas.has(d.nome) && d.total > 0)
  const total = visiveis.reduce((s, d) => s + d.total, 0)
  const totalGeral = dados.reduce((s, d) => s + d.total, 0)
  if (totalGeral <= 0) return <p className="text-xs text-gray-400 py-10 text-center">Sem dados no mês.</p>
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-32 h-32 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={visiveis.length ? visiveis : [{ nome: '—', total: 1, cor: corVazio } as any]} dataKey="total" nameKey="nome"
              cx="50%" cy="50%" innerRadius={44} outerRadius={62} paddingAngle={visiveis.length > 1 ? 2 : 0}
              stroke="none" animationDuration={800} animationBegin={80}>
              {(visiveis.length ? visiveis : [{ cor: corVazio }]).map((d: any, i) => <Cell key={i} fill={d.cor} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p: any = payload[0].payload
              const pct = total > 0 ? Math.round((p.total / total) * 100) : 0
              return <div className="rounded-lg bg-white dark:bg-neutral-800 shadow-md border border-gray-100 dark:border-neutral-700 px-2.5 py-1.5 text-xs"><span className="font-medium text-gray-700 dark:text-neutral-100">{p.icone} {p.nome}</span><br /><span className="tabular-nums text-gray-500 dark:text-neutral-300">{fmt(p.total)} · {pct}%</span></div>
            }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-gray-400">total</span>
          <span className="text-sm font-bold text-gray-800 dark:text-neutral-100 leading-none tabular-nums">{fmt(total)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-1 min-w-0">
        {dados.slice(0, 6).map((d, i) => {
          const off = ocultas.has(d.nome)
          const pct = totalGeral > 0 ? Math.round((d.total / totalGeral) * 100) : 0
          return (
            <button key={i} onClick={() => setOcultas(s => { const n = new Set(s); n.has(d.nome) ? n.delete(d.nome) : n.add(d.nome); return n })}
              className={`w-full flex items-center gap-2 text-xs transition ${off ? 'opacity-35' : 'hover:opacity-80'}`} title={off ? 'Mostrar' : 'Ocultar'}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.cor }} />
              <span className={`text-gray-600 dark:text-neutral-300 truncate flex-1 text-left ${off ? 'line-through' : ''}`}>{d.icone} {d.nome}</span>
              <span className="text-gray-500 tabular-nums">{pct}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Item de "próximas contas / recebimentos" — clicável (deep-link p/ editar), destaque p/ vencidas/hoje ──
function LinhaProx({ p, cor }: { p: Prox; cor: string }) {
  const hj = hojeISO()
  const venceHoje = p.data.slice(0, 10) === hj
  const vencida = p.data.slice(0, 10) < hj
  return (
    <Link href={`/pessoal/financeiro/lancamentos?editar=${p.id}`} className="flex items-center gap-2 py-1.5 text-sm rounded px-1 -mx-1 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
      <span className="flex-1 min-w-0">
        <span className="text-gray-700 dark:text-neutral-200 truncate block">{p.categoriaIcone || ''} {p.descricao}</span>
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          {p.categoriaNome || 'sem categoria'} ·
          {vencida ? <span className="text-red-500 font-medium flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> venceu {brDia(p.data)}</span>
            : venceHoje ? <span className="text-orange-500 font-medium">vence hoje</span>
            : <span>vence {brDia(p.data)}</span>}
        </span>
      </span>
      <span className={`font-semibold tabular-nums whitespace-nowrap ${cor}`}>{fmt(p.valor)}</span>
    </Link>
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
    try { const r = await fetch(`/api/pessoal/financeiro/resumo?ano=${ano}&mes=${mes}`); if (r.ok) setD(await r.json()) } finally { setLoading(false) }
  }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])

  const trocaMes = (delta: number) => { let m = mes + delta, a = ano; if (m < 1) { m = 12; a-- } if (m > 12) { m = 1; a++ } setMes(m); setAno(a) }
  const card = 'rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4'
  const semHistorico = useMemo(() => (d?.mesesComDado ?? 0) < 2, [d])

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
        {[['Lançamentos', '/pessoal/financeiro/lancamentos'], ['Contas', '/pessoal/financeiro/contas'], ['Caixinhas', '/pessoal/financeiro/caixinhas'], ['Categorias', '/pessoal/financeiro/categorias'], ['Fluxo', '/pessoal/financeiro/fluxo'], ['Metas', '/pessoal/financeiro/metas'], ['Relatório PDF', '/pessoal/financeiro/relatorio']].map(([l, h]) => (
          <Link key={h} href={h} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800">{l}</Link>
        ))}
        <Link href="/pessoal/financeiro/lancamentos?novo=1" className="px-3 py-1.5 rounded-lg text-sm bg-orange-500 text-white font-medium hover:bg-orange-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Novo</Link>
      </div>

      {loading ? <p className="text-gray-400 text-sm py-10 text-center">Carregando…</p> : d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={card}><div className="flex items-center gap-1.5 text-indigo-500 text-xs font-medium"><Wallet className="w-4 h-4" /> Saldo total</div><p className={`text-xl font-bold mt-1 ${d.saldoTotal >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-red-600'}`}>{fmt(d.saldoTotal)}</p></div>
            <div className={card}><div className="flex items-center gap-1.5 text-green-500 text-xs font-medium"><TrendingUp className="w-4 h-4" /> Receitas</div><p className="text-xl font-bold mt-1 text-green-700 dark:text-green-400">{fmt(d.totalReceita)}</p>{d.aReceber > 0 && <p className="text-[11px] text-teal-600">a receber {fmt(d.aReceber)}</p>}</div>
            <div className={card}><div className="flex items-center gap-1.5 text-red-500 text-xs font-medium"><TrendingDown className="w-4 h-4" /> Despesas</div><p className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">{fmt(d.totalDespesa)}</p>{d.aPagar > 0 && <p className="text-[11px] text-orange-600">a pagar {fmt(d.aPagar)}</p>}</div>
            <div className={card}><div className="text-xs font-medium text-gray-500">Resultado do mês</div><p className={`text-xl font-bold mt-1 ${d.resultado >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-600'}`}>{fmt(d.resultado)}</p></div>
          </div>

          {/* Próximas contas a vencer + próximos recebimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={card}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2 flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-orange-500" /> Próximas contas a vencer</h3>
              {d.proximasContas.length === 0 ? <p className="text-xs text-gray-400 py-3">Nada a vencer nos próximos dias. 🎉</p> : (
                <div className="divide-y divide-gray-50 dark:divide-neutral-800">{d.proximasContas.map(p => <LinhaProx key={p.id} p={p} cor="text-red-600" />)}</div>
              )}
            </div>
            <div className={card}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2 flex items-center gap-1.5"><HandCoins className="w-4 h-4 text-green-500" /> Próximos recebimentos</h3>
              {d.proximosRecebimentos.length === 0 ? <p className="text-xs text-gray-400 py-3">Nada a receber nos próximos dias.</p> : (
                <div className="divide-y divide-gray-50 dark:divide-neutral-800">{d.proximosRecebimentos.map(p => <LinhaProx key={p.id} p={p} cor="text-green-600" />)}</div>
              )}
            </div>
          </div>

          {d.saldoPorConta && d.saldoPorConta.length > 0 && (
            <div className={card}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200">Saldo por conta</h3>
                <Link href="/pessoal/financeiro/contas" className="text-xs text-orange-500 hover:underline">Gerenciar</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {d.saldoPorConta.map(c => (
                  <div key={c.id} className="rounded-xl border border-gray-100 dark:border-neutral-800 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.cor || '#6366f1' }} /><span className="truncate">{c.nome}</span></div>
                    <p className={`text-lg font-bold mt-1 tabular-nums ${c.saldo >= 0 ? 'text-gray-800 dark:text-neutral-100' : 'text-red-600'}`}>{fmt(c.saldo)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={card}><h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">Receitas por categoria</h3><DonutCategoria dados={d.catReceita} corVazio="#bbf7d0" /></div>
            <div className={card}><h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">Despesas por categoria</h3><DonutCategoria dados={d.catDespesa} corVazio="#fecaca" /></div>
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">Evolução (12 meses)</h3>
            {semHistorico ? (
              <div className="h-40 flex flex-col items-center justify-center text-center gap-1">
                <p className="text-sm text-gray-500 dark:text-neutral-400">Ainda sem histórico para o gráfico.</p>
                <p className="text-xs text-gray-400">Conforme você registra receitas e despesas pagas, a evolução aparece aqui mês a mês.</p>
              </div>
            ) : (
              <div className="h-56 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={d.chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-neutral-700" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v: number) => fmtK(v)} tick={{ fontSize: 11 }} stroke="currentColor" className="text-gray-400" tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const g = (k: string) => Number(payload.find((p: any) => p.dataKey === k)?.value || 0)
                      return <div className="rounded-lg bg-white dark:bg-neutral-800 shadow-md border border-gray-100 dark:border-neutral-700 px-3 py-2 text-xs space-y-0.5">
                        <p className="font-semibold text-gray-700 dark:text-neutral-100 mb-1">{label}</p>
                        <p className="text-green-600 tabular-nums">Receita {fmt(g('receita'))}</p>
                        <p className="text-red-500 tabular-nums">Despesa {fmt(g('despesa'))}</p>
                        <p className="text-blue-600 tabular-nums border-t border-gray-100 dark:border-neutral-700 pt-0.5">Resultado {fmt(g('resultado'))}</p>
                      </div>
                    }} />
                    <Bar dataKey="receita" name="Receita" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={16} animationDuration={800} />
                    <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={16} animationDuration={800} />
                    <Line dataKey="resultado" name="Resultado" type="monotone" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} animationDuration={900} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Receita</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Despesa</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-600" /> Resultado</span>
            </div>
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">Últimos lançamentos</h3>
            {d.ultimos.length === 0 ? <p className="text-xs text-gray-400 py-4">Nada ainda. <Link href="/pessoal/financeiro/lancamentos?novo=1" className="text-orange-500">Adicionar</Link>.</p> : (
              <div className="divide-y divide-gray-50 dark:divide-neutral-800">
                {d.ultimos.map(l => (
                  <Link key={l.id} href={`/pessoal/financeiro/lancamentos?editar=${l.id}`} className="flex items-center gap-3 py-2 text-sm rounded px-1 -mx-1 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
                    <span className="text-gray-400 text-xs w-10">{brDia(l.data)}</span>
                    <span className="flex-1 text-gray-700 dark:text-neutral-200 truncate">{l.categoriaIcone || ''} {l.descricao}{l.status === 'PENDENTE' && <span className="ml-1 text-[10px] text-amber-600">• pendente</span>}</span>
                    <span className={`font-semibold tabular-nums ${l.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{l.tipo === 'RECEITA' ? '+' : '−'}{fmt(l.valor)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
