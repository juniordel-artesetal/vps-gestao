'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, DollarSign, Target, Lightbulb,
  RefreshCw, Info, ShoppingCart, BarChart2, Percent,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────
const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function fmtR(n: number) {
  return 'R$\u00a0' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

// ── Input de moeda ─────────────────────────────────────────────────────────
function CurrencyInput({
  value, onChange, autoFilled,
}: {
  value: number
  onChange: (v: number) => void
  autoFilled?: boolean
}) {
  const fmt = (n: number) => n > 0 ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''
  const [txt, setTxt] = useState(fmt(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setTxt(fmt(value))
  }, [value, focused])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d,]/g, '')
    setTxt(raw)
    onChange(parseFloat(raw.replace(',', '.')) || 0)
  }
  function handleBlur() {
    setFocused(false)
    setTxt(fmt(value))
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none pointer-events-none">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={txt}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder="0,00"
        className={`w-full rounded-xl border pl-10 pr-3 py-3 text-sm font-semibold
          focus:outline-none focus:ring-2 focus:ring-orange-400 transition
          bg-white dark:bg-gray-800 text-gray-800 dark:text-white
          ${autoFilled
            ? 'border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-900/10'
            : 'border-gray-200 dark:border-gray-700'
          }`}
      />
      {autoFilled && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500 font-normal">
          auto
        </span>
      )}
    </div>
  )
}

// ── Card de métrica ────────────────────────────────────────────────────────
const CORES: Record<string, { borda: string; num: string; badge: string; icon: string }> = {
  orange: {
    borda: 'border-l-orange-400',
    num:   'text-orange-500',
    badge: 'bg-orange-500 text-white',
    icon:  'text-orange-400',
  },
  blue: {
    borda: 'border-l-blue-400',
    num:   'text-blue-500',
    badge: 'bg-blue-500 text-white',
    icon:  'text-blue-400',
  },
  green: {
    borda: 'border-l-green-500',
    num:   'text-green-500',
    badge: 'bg-green-500 text-white',
    icon:  'text-green-500',
  },
  purple: {
    borda: 'border-l-purple-500',
    num:   'text-purple-500',
    badge: 'bg-purple-500 text-white',
    icon:  'text-purple-400',
  },
  teal: {
    borda: 'border-l-teal-500',
    num:   'text-teal-500',
    badge: 'bg-teal-500 text-white',
    icon:  'text-teal-500',
  },
}

function MetricaCard({
  numero, titulo, formula, calculo, resultado,
  isPercentual, icon: Icon, cor,
}: {
  numero: number
  titulo: string
  formula: string
  calculo: string
  resultado: number
  isPercentual?: boolean
  icon: React.ElementType
  cor: string
}) {
  const c      = CORES[cor] || CORES.orange
  const negativo = resultado < 0
  const display  = isPercentual ? fmtPct(resultado) : fmtR(resultado)

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100
                     dark:border-gray-700 border-l-4 ${c.borda}
                     flex items-stretch overflow-hidden transition-shadow hover:shadow-md`}>

      {/* Número */}
      <div className="flex items-center justify-center w-12 flex-shrink-0">
        <span className={`text-xl font-black ${c.num}`}>{numero}</span>
      </div>

      {/* Corpo */}
      <div className="flex-1 px-4 py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-4 h-4 flex-shrink-0 ${c.icon}`} />
              <span className="text-sm font-bold text-gray-800 dark:text-white">{titulo}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              <span className="font-medium text-gray-500 dark:text-gray-400">Fórmula:</span>{' '}
              {formula}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-sm">
              <span className="font-medium text-gray-500 dark:text-gray-400">Cálculo:</span>{' '}
              {calculo}
            </p>
          </div>

          {/* Resultado */}
          <span className={`flex-shrink-0 self-center px-4 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap ${
            negativo
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : `${c.badge}`
          }`}>
            = {display}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function DrePage() {
  const agora   = new Date()
  const [mes,   setMes]   = useState(agora.getMonth() + 1)
  const [ano,   setAno]   = useState(agora.getFullYear())
  const [loading, setLoading] = useState(false)

  // Dados — receita e pedidos vêm da API (editáveis)
  const [receita,       setReceita]       = useState(0)
  const [qtdVendas,     setQtdVendas]     = useState(0)
  const [cmv,           setCmv]           = useState(0)
  const [despesasFixas, setDespesasFixas] = useState(0)
  const [despesasTotais, setDespesasTotais] = useState(0)

  // Flags para saber se usuário editou manualmente
  const [cmvEditado, setCmvEditado] = useState(false)
  const [dfEditada,  setDfEditada]  = useState(false)

  // ── Cálculos em tempo real ───────────────────────────────────────────────
  const ticketMedio        = qtdVendas > 0    ? receita / qtdVendas                         : 0
  const lucroBruto         =                    receita - cmv
  const lucroLiquido       =                    lucroBruto - despesasFixas
  const margemContribuicao = receita > 0       ? ((receita - cmv) / receita) * 100           : 0
  const pontoEquilibrio    = margemContribuicao > 0 ? despesasFixas / (margemContribuicao / 100) : 0
  const acimaPE            = receita > 0 && pontoEquilibrio > 0 && receita >= pontoEquilibrio

  // ── Busca dados ──────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gestao/dre?mes=${mes}&ano=${ano}`)
      if (!res.ok) return
      const d = await res.json()
      setReceita(parseFloat(String(d.receita))        || 0)
      setQtdVendas(d.qtdPedidos                       || 0)
      setDespesasTotais(parseFloat(String(d.despesasTotais)) || 0)
      if (!cmvEditado) setCmv(parseFloat(String(d.cmv))                || 0)
      if (!dfEditada)  setDespesasFixas(parseFloat(String(d.despesasFixas)) || 0)
    } catch {}
    setLoading(false)
  }, [mes, ano]) // eslint-disable-line

  useEffect(() => { carregar() }, [mes, ano]) // eslint-disable-line

  const anos    = [agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2]
  const selCls  = 'border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 text-gray-700 dark:text-white'

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            DRE Simplificado
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Demonstrativo de Resultado — análise financeira do seu ateliê
          </p>
        </div>
        <button
          onClick={() => { setCmvEditado(false); setDfEditada(false); carregar() }}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-500 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ── Seletor de período ─────────────────────────────────────────── */}
      <div className="flex gap-3 mb-6">
        <select value={mes} onChange={e => setMes(Number(e.target.value))} className={selCls}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))} className={selCls}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {loading && (
          <span className="self-center text-xs text-orange-500 animate-pulse">
            Buscando dados...
          </span>
        )}
      </div>

      {/* ── Dados do negócio ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 mb-5">
        <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          📊 Dados do negócio — {MESES[mes - 1]} {ano}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Receita */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Receita Total
              <span className="ml-1 text-green-500 font-normal">↑ auto</span>
            </label>
            <CurrencyInput value={receita} onChange={setReceita} autoFilled />
          </div>

          {/* Nº de vendas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Nº de Vendas (pedidos)
              <span className="ml-1 text-green-500 font-normal">↑ auto</span>
            </label>
            <input
              type="number"
              min={0}
              value={qtdVendas || ''}
              onChange={e => setQtdVendas(parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-full rounded-xl border border-green-300 dark:border-green-700
                         bg-green-50/40 dark:bg-green-900/10 px-3 py-3 text-sm font-semibold
                         focus:outline-none focus:ring-2 focus:ring-orange-400
                         text-gray-800 dark:text-white"
            />
          </div>

          {/* CMV */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              CMV — Custo da Mercadoria Vendida
              <span className="ml-1 text-gray-400 font-normal">(materiais, embalagem)</span>
            </label>
            <CurrencyInput
              value={cmv}
              onChange={v => { setCmv(v); setCmvEditado(true) }}
            />
          </div>

          {/* Despesas fixas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Despesas Fixas
              <span className="ml-1 text-gray-400 font-normal">(aluguel, software...)</span>
            </label>
            <CurrencyInput
              value={despesasFixas}
              onChange={v => { setDespesasFixas(v); setDfEditada(true) }}
            />
          </div>
        </div>

        {/* Referência de despesas totais lançadas */}
        {despesasTotais > 0 && (
          <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Total de despesas lançadas no período:{' '}
              <strong className="text-gray-600 dark:text-gray-300">{fmtR(despesasTotais)}</strong>
              {' '}— distribua entre CMV e Despesas Fixas acima conforme sua realidade.
            </span>
          </div>
        )}
      </div>

      {/* ── 5 Métricas ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-5">
        <MetricaCard
          numero={1}
          titulo="Ticket Médio"
          icon={ShoppingCart}
          cor="orange"
          formula="Receita Total ÷ Nº de Vendas"
          calculo={`${fmtR(receita)} ÷ ${qtdVendas} vendas`}
          resultado={ticketMedio}
        />

        <MetricaCard
          numero={2}
          titulo="Lucro Bruto"
          icon={DollarSign}
          cor="blue"
          formula="Receita Total − CMV"
          calculo={`${fmtR(receita)} − ${fmtR(cmv)}`}
          resultado={lucroBruto}
        />

        <MetricaCard
          numero={3}
          titulo="Lucro Líquido"
          icon={TrendingUp}
          cor="green"
          formula="Lucro Bruto − Despesas Fixas"
          calculo={`${fmtR(lucroBruto)} − ${fmtR(despesasFixas)}`}
          resultado={lucroLiquido}
        />

        <MetricaCard
          numero={4}
          titulo="Margem de Contribuição"
          icon={Percent}
          cor="purple"
          formula="(Receita − CMV) ÷ Receita × 100"
          calculo={`(${fmtR(receita)} − ${fmtR(cmv)}) ÷ ${fmtR(receita)} × 100`}
          resultado={margemContribuicao}
          isPercentual
        />

        <MetricaCard
          numero={5}
          titulo="Ponto de Equilíbrio"
          icon={Target}
          cor="teal"
          formula="Despesas Fixas ÷ Margem de Contribuição"
          calculo={`${fmtR(despesasFixas)} ÷ ${fmtPct(margemContribuicao)}`}
          resultado={pontoEquilibrio}
        />
      </div>

      {/* ── Lâmpada / Insight ─────────────────────────────────────────── */}
      {pontoEquilibrio > 0 && (
        <div className={`rounded-2xl p-5 flex items-start gap-4 transition-colors ${
          acimaPE
            ? 'bg-green-50  dark:bg-green-900/20  border border-green-200  dark:border-green-800'
            : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
        }`}>
          {/* Ícone lâmpada */}
          <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
            acimaPE ? 'bg-green-100 dark:bg-green-800/50' : 'bg-orange-100 dark:bg-orange-800/50'
          }`}>
            <Lightbulb className={`w-5 h-5 ${acimaPE ? 'text-green-600' : 'text-orange-500'}`} />
          </div>

          {/* Texto */}
          <div>
            <p className={`text-sm font-bold mb-1 ${
              acimaPE ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'
            }`}>
              {acimaPE ? '✅ Acima do Ponto de Equilíbrio!' : '⚠️ Atenção ao Ponto de Equilíbrio'}
            </p>
            <p className={`text-sm leading-relaxed ${
              acimaPE ? 'text-green-600 dark:text-green-300' : 'text-orange-600 dark:text-orange-300'
            }`}>
              Com{' '}
              <strong>{fmtR(pontoEquilibrio)}</strong>
              {' '}de faturamento você cobre todos os custos.{' '}
              {acimaPE
                ? <>Sua receita de <strong>{fmtR(receita)}</strong> está <strong>{fmtR(receita - pontoEquilibrio)}</strong> acima — o negócio está gerando lucro real! 🎉</>
                : <>Sua receita ainda está <strong>{fmtR(pontoEquilibrio - receita)}</strong> abaixo desse valor. Foque em aumentar vendas ou reduzir custos.</>
              }
            </p>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {receita === 0 && !loading && (
        <p className="mt-6 text-center text-sm text-gray-400 dark:text-gray-500">
          Nenhuma receita encontrada em {MESES[mes - 1]} {ano}. Selecione outro período ou registre lançamentos no módulo Financeiro.
        </p>
      )}
    </div>
  )
}
