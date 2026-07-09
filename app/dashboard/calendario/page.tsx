'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, CalendarDays,
  Calendar, Clock, List, Package, X, Search,
} from 'lucide-react'
import { formatarDataBR } from '@/lib/data'

interface Pedido {
  id: string
  numero: string
  destinatario: string
  produto: string
  canal: string
  prioridade: string
  status: string
  dataEnvio: string | null
  dataEntrada: string | null
  valor: number | null
  setor_atual_nome: string | null
}

const PRIORIDADE_COR: Record<string, string> = {
  URGENTE: 'bg-red-500',
  ALTA:    'bg-orange-500',
  NORMAL:  'bg-green-500',
  BAIXA:   'bg-gray-400',
}

const CANAL_LABEL: Record<string, string> = {
  Shopee: 'Shopee', shopee: 'Shopee',
  'Mercado Livre': 'ML', ml: 'ML',
  Elo7: 'Elo7', elo7: 'Elo7',
  'TikTok Shop': 'TikTok', tiktok: 'TikTok',
  Amazon: 'Amazon', amazon: 'Amazon',
  Magalu: 'Magalu', magalu: 'Magalu',
  Direta: 'Direta', direta: 'Direta',
}

const STATUS_COR: Record<string, string> = {
  ABERTO:      'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  EM_PRODUCAO: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  CONCLUIDO:   'bg-green-500/20 text-green-600 dark:text-green-400',
  ENVIADO:     'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  CANCELADO:   'bg-red-500/20 text-red-600 dark:text-red-400',
}

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto', EM_PRODUCAO: 'Em produção',
  CONCLUIDO: 'Concluído', ENVIADO: 'Enviado', CANCELADO: 'Cancelado',
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type View = 'mensal' | 'semanal' | 'diario'

function fmtData(s: string | null) {
  // Data sem hora → sem conversão de fuso (formatarDataBR trata YYYY-MM-DD e ISO)
  return formatarDataBR(s)
}

function toYMD(date: Date): string {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0')
}

function PedidoCard({ p, compact = false, destaque = 'produto' }: { p: Pedido; compact?: boolean; destaque?: 'produto' | 'numero' | 'cliente' }) {
  const corPrio = PRIORIDADE_COR[p.prioridade] || 'bg-gray-400'
  const statusCls = STATUS_COR[p.status] || 'bg-gray-500/20 text-gray-500'

  // Campo em destaque (compartilha a preferência com a lista de pedidos)
  const principal  = destaque === 'cliente' ? p.destinatario : destaque === 'numero' ? `#${p.numero}` : (p.produto || p.destinatario)
  const secundario = destaque === 'cliente' ? p.produto : destaque === 'numero' ? p.produto : p.destinatario

  if (compact) {
    return (
      <div title={`${p.produto || '—'}${p.destinatario ? ' · ' + p.destinatario : ''} · #${p.numero}`}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${corPrio}`} />
        <span className="text-xs truncate text-gray-800 dark:text-gray-100 font-medium">{principal}</span>
        {p.setor_atual_nome && (
          <span className="text-[10px] text-gray-400 truncate hidden sm:block">· {p.setor_atual_nome}</span>
        )}
      </div>
    )
  }

  return (
    <Link href={`/dashboard/pedidos/${p.id}`}
      className="block rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm hover:border-orange-300 hover:shadow-md transition cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${corPrio}`} />
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={principal}>{principal}</span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusCls}`}>
          {STATUS_LABEL[p.status] || p.status}
        </span>
      </div>
      <p className="text-xs text-gray-500 truncate mb-2" title={secundario}>{secundario}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">
            {CANAL_LABEL[p.canal] || p.canal}
          </span>
          {p.setor_atual_nome && (
            <span className="text-[10px] text-orange-500 font-medium">{p.setor_atual_nome}</span>
          )}
          <span className="text-[10px] text-gray-400 font-mono">#{p.numero.slice(-6)}</span>
        </div>
        <span className="text-[10px] text-orange-500 font-medium">Ver pedido →</span>
      </div>
    </Link>
  )
}

export default function CalendarioPage() {
  const { status } = useSession()
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('mensal')
  const [hoje] = useState(new Date())
  const [ref, setRef] = useState(new Date()) // data de referência da view
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [modalDia, setModalDia] = useState<string | null>(null)
  const [busca,    setBusca]    = useState('')
  // Campo de destaque (Produto | Nº | Cliente) — compartilha a preferência com a lista de pedidos
  const [destaque, setDestaque] = useState<'produto' | 'numero' | 'cliente'>('produto')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    try {
      const s = localStorage.getItem('pedidosDestaque')
      if (s === 'produto' || s === 'numero' || s === 'cliente') setDestaque(s)
    } catch { /* localStorage indisponível */ }
  }, [])

  function mudarDestaque(v: 'produto' | 'numero' | 'cliente') {
    setDestaque(v)
    try { localStorage.setItem('pedidosDestaque', v) } catch { /* localStorage indisponível */ }
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/producao/pedidos?limite=500')
      const data = await res.json()
      setPedidos(data.pedidos || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (status === 'authenticated') carregar() }, [status, carregar])

  // Filtrar por busca
  const pedidosFiltrados = busca.trim()
    ? pedidos.filter(p => {
        const b = busca.toLowerCase()
        return p.destinatario?.toLowerCase().includes(b) ||
               p.produto?.toLowerCase().includes(b) ||
               p.numero?.toLowerCase().includes(b) ||
               p.canal?.toLowerCase().includes(b)
      })
    : pedidos

  // Indexar pedidos por dataEnvio — excluir já enviados/concluídos/cancelados
  const pedidosPorDia = pedidosFiltrados.reduce((acc, p) => {
    const d = p.dataEnvio
    if (!d) return acc
    if (['ENVIADO', 'CONCLUIDO', 'CANCELADO'].includes(p.status)) return acc
    const key = d.slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {} as Record<string, Pedido[]>)

  const pedidosDia = (dia: string) => pedidosPorDia[dia] || []

  // ── MENSAL ───────────────────────────────────────────────────────────────
  function renderMensal() {
    const ano = ref.getFullYear()
    const mes = ref.getMonth()
    const primeiro = new Date(ano, mes, 1)
    const ultimo = new Date(ano, mes + 1, 0)
    const diasAntes = primeiro.getDay()
    const totalCelulas = diasAntes + ultimo.getDate()
    const semanas = Math.ceil(totalCelulas / 7)

    return (
      <div>
        {/* Header do grid */}
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
          ))}
        </div>
        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: `repeat(${semanas}, minmax(80px, auto))` }}>
          {Array.from({ length: semanas * 7 }).map((_, i) => {
            const diaNum = i - diasAntes + 1
            if (diaNum < 1 || diaNum > ultimo.getDate()) {
              return <div key={i} className="rounded-xl" />
            }
            const date = new Date(ano, mes, diaNum)
            const key = toYMD(date)
            const ps = pedidosDia(key)
            const isHoje = toYMD(hoje) === key
            const isSel = diaSelecionado === key
            const isPast = date < new Date(toYMD(hoje))
            const isAtrasado = isPast && !isHoje && ps.length > 0

            return (
              <div
                key={i}
                onClick={() => { setDiaSelecionado(isSel ? null : key); setModalDia(key) }}
                className={`rounded-xl border cursor-pointer transition-all p-1.5 min-h-[80px] flex flex-col gap-1 ${
                  isAtrasado ? 'border-red-400 bg-red-500/5 dark:bg-red-900/10' :
                  isHoje ? 'border-orange-400 bg-orange-500/5' :
                  isSel  ? 'border-orange-300 bg-orange-500/5' :
                           'border-gray-100 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-600 bg-white dark:bg-gray-900/40'
                } ${isPast && !isHoje && !isAtrasado ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    isHoje ? 'bg-orange-500 text-white' :
                    isAtrasado ? 'text-red-600 dark:text-red-400' :
                    'text-gray-600 dark:text-gray-300'
                  }`}>{diaNum}</span>
                  <div className="flex items-center gap-1">
                    {isAtrasado && (
                      <span className="text-[10px] font-bold text-red-500 bg-red-500/10 rounded-full px-1.5">⚠ {ps.length}</span>
                    )}
                    {!isAtrasado && ps.length > 0 && (
                      <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 rounded-full px-1.5">{ps.length}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  {ps.slice(0, 3).map(p => (
                    <PedidoCard key={p.id} p={p} compact destaque={destaque} />
                  ))}
                  {ps.length > 3 && (
                    <div className="text-[10px] text-orange-500 font-medium pl-1">+{ps.length - 3} mais</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── SEMANAL ───────────────────────────────────────────────────────────────
  function renderSemanal() {
    // Início da semana (domingo)
    const inicio = new Date(ref)
    inicio.setDate(ref.getDate() - ref.getDay())
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      return d
    })

    return (
      <div className="grid grid-cols-7 gap-2">
        {dias.map(date => {
          const key = toYMD(date)
          const ps = pedidosDia(key)
          const isHoje = toYMD(hoje) === key
          return (
            <div key={key} className={`rounded-2xl border ${
              isHoje ? 'border-orange-400 bg-orange-500/5' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40'
            } p-3 min-h-[200px]`}>
              <div className="mb-3">
                <div className="text-xs text-gray-400">{DIAS_SEMANA[date.getDay()]}</div>
                <div className={`text-xl font-bold ${isHoje ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
                  {date.getDate()}
                </div>
                {ps.length > 0 && (
                  <div className="text-xs text-orange-500 font-medium">{ps.length} pedido{ps.length > 1 ? 's' : ''}</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {ps.map(p => <PedidoCard key={p.id} p={p} compact destaque={destaque} />)}
                {ps.length === 0 && (
                  <div className="text-xs text-gray-300 dark:text-gray-600 text-center mt-4">—</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── DIÁRIO ────────────────────────────────────────────────────────────────
  function renderDiario() {
    const key = toYMD(ref)
    const ps = pedidosDia(key)
    const isHoje = toYMD(hoje) === key

    return (
      <div>
        <div className={`rounded-2xl border ${isHoje ? 'border-orange-400 bg-orange-500/5' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40'} p-6 mb-4`}>
          <div className="flex items-center gap-3">
            <div className={`text-4xl font-bold ${isHoje ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
              {ref.getDate()}
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {DIAS_SEMANA[ref.getDay()]}, {MESES[ref.getMonth()]} de {ref.getFullYear()}
              </div>
              <div className="text-sm text-gray-500">
                {ps.length === 0 ? 'Nenhum pedido para envio neste dia' : `${ps.length} pedido${ps.length > 1 ? 's' : ''} para envio`}
              </div>
            </div>
          </div>
        </div>
        {ps.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum pedido com envio neste dia</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ps.map(p => <PedidoCard key={p.id} p={p} destaque={destaque} />)}
          </div>
        )}
      </div>
    )
  }

  // Navegação
  function navAnterior() {
    const d = new Date(ref)
    if (view === 'mensal')  { d.setMonth(d.getMonth() - 1) }
    if (view === 'semanal') { d.setDate(d.getDate() - 7) }
    if (view === 'diario')  { d.setDate(d.getDate() - 1) }
    setRef(d)
  }
  function navProximo() {
    const d = new Date(ref)
    if (view === 'mensal')  { d.setMonth(d.getMonth() + 1) }
    if (view === 'semanal') { d.setDate(d.getDate() + 7) }
    if (view === 'diario')  { d.setDate(d.getDate() + 1) }
    setRef(d)
  }
  function irHoje() { setRef(new Date()) }

  function tituloNav() {
    if (view === 'mensal')  return `${MESES[ref.getMonth()]} ${ref.getFullYear()}`
    if (view === 'diario')  return `${ref.getDate()} de ${MESES[ref.getMonth()]} ${ref.getFullYear()}`
    // semanal
    const inicio = new Date(ref)
    inicio.setDate(ref.getDate() - ref.getDay())
    const fim = new Date(inicio)
    fim.setDate(inicio.getDate() + 6)
    return `${inicio.getDate()}/${inicio.getMonth()+1} – ${fim.getDate()}/${fim.getMonth()+1}/${fim.getFullYear()}`
  }

  // Modal de dia (clique no dia na view mensal)
  const pedidosModal = modalDia ? pedidosDia(modalDia) : []

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Carregando calendário...</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-orange-500" />
            Calendário de Envios
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Pedidos organizados por data de envio</p>
        </div>

        {/* Busca */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente, produto, pedido..."
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Controles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Campo de destaque */}
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">Destaque:</span>
            <select value={destaque} onChange={e => mudarDestaque(e.target.value as 'produto' | 'numero' | 'cliente')}
              title="Escolha o que aparece em destaque em cada pedido"
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-xs bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="produto">Produto</option>
              <option value="numero">Nº do pedido</option>
              <option value="cliente">Cliente</option>
            </select>
          </div>
          {/* Toggle de view */}
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
            {([
              { v: 'mensal' as View,  icon: Calendar,     label: 'Mês'     },
              { v: 'semanal' as View, icon: CalendarDays, label: 'Semana'  },
              { v: 'diario' as View,  icon: Clock,        label: 'Dia'     },
            ] as const).map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                  view === v
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          {/* Navegação */}
          <div className="flex items-center gap-1">
            <button onClick={navAnterior}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
            </button>
            <button onClick={irHoje}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium">
              Hoje
            </button>
            <button onClick={navProximo}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronRight size={16} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Título atual */}
          <div className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white min-w-[140px] text-center">
            {tituloNav()}
          </div>
        </div>
      </div>

      {/* Sumário rápido */}
      {(() => {
        const hoje_key = toYMD(hoje)
        const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1)
        const amanha_key = toYMD(amanha)
        const semana: Pedido[] = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(hoje); d.setDate(hoje.getDate() + i)
          semana.push(...pedidosDia(toYMD(d)))
        }
        const atrasados = pedidosFiltrados.filter(p => p.dataEnvio && p.dataEnvio < hoje_key && p.status !== 'ENVIADO' && p.status !== 'CONCLUIDO' && p.status !== 'CANCELADO')
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Hoje',    count: pedidosDia(hoje_key).length, cor: 'text-orange-500', bg: 'bg-orange-500/10', action: () => { setView('diario'); setRef(new Date()) } },
              { label: 'Amanhã', count: pedidosDia(amanha_key).length, cor: 'text-blue-500', bg: 'bg-blue-500/10', action: () => { setView('diario'); setRef(amanha) } },
              { label: 'Próx. 7 dias', count: semana.length, cor: 'text-green-500', bg: 'bg-green-500/10', action: () => { setView('semanal'); setRef(new Date()) } },
              { label: 'Atrasados', count: atrasados.length, cor: atrasados.length > 0 ? 'text-red-500' : 'text-gray-400', bg: atrasados.length > 0 ? 'bg-red-500/10' : 'bg-gray-500/10', action: () => {} },
            ].map(({ label, count, cor, bg, action }) => (
              <button key={label} onClick={action}
                className={`rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4 text-left hover:border-orange-300 dark:hover:border-orange-600 transition-all`}>
                <div className={`text-2xl font-bold ${cor}`}>{count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </button>
            ))}
          </div>
        )
      })()}

      {/* View principal */}
      <div className="bg-white dark:bg-gray-900/20 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
        {view === 'mensal'  && renderMensal()}
        {view === 'semanal' && renderSemanal()}
        {view === 'diario'  && renderDiario()}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {Object.entries(PRIORIDADE_COR).map(([p, cor]) => (
          <div key={p} className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className={`w-2 h-2 rounded-full ${cor}`} />
            {p.charAt(0) + p.slice(1).toLowerCase()}
          </div>
        ))}
      </div>

      {/* Modal — clique no dia (view mensal) */}
      {modalDia && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setModalDia(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Envios do dia {fmtData(modalDia)}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {pedidosModal.length === 0 ? 'Nenhum pedido' : `${pedidosModal.length} pedido${pedidosModal.length > 1 ? 's' : ''} para envio`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setView('diario'); setRef(new Date(modalDia + 'T12:00:00')); setModalDia(null) }}
                  className="text-xs text-orange-500 hover:text-orange-600 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800">
                  Ver em modo diário
                </button>
                <button onClick={() => setModalDia(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {pedidosModal.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum pedido com envio neste dia</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {pedidosModal.map(p => <PedidoCard key={p.id} p={p} destaque={destaque} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
