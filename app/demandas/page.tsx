'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Search, RefreshCw, X, ToggleRight,
  CheckSquare, Square, ChevronDown, Filter, DollarSign,
  Clock, Package, CheckCircle, AlertCircle, Pencil,
} from 'lucide-react'
import Link from 'next/link'

// ── Tipos ───────────────────────────────────────────────────────────────────

interface Freelancer {
  id: string
  nome: string
  especialidade: string | null
}

interface Pedido {
  id: string
  clienteNome: string | null
  numeroPedido: string | null
}

interface Variacao {
  id: string
  produtoNome: string
  canal: string
  tipo: string
}

interface Demanda {
  id: string
  pedidoId: string | null
  pedidoRef: string | null
  freelancerId: string
  freelancerNome: string
  variacaoId: string | null
  nomeProduto: string
  qtdSolicitada: number
  qtdProduzida: number
  valorPorItem: number
  valorTotal: number
  status: string
  observacoes: string | null
  dataPagamento: string | null
  createdAt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white'

const STATUS_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  PENDENTE:    { label: 'Pendente',           icon: Clock,        bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-600 dark:text-gray-300' },
  EM_PRODUCAO: { label: 'Em produção',        icon: Package,      bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300' },
  PRODUZIDO:   { label: 'Aguard. pagamento',  icon: AlertCircle,  bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  PAGO:        { label: 'Pago',               icon: CheckCircle,  bg: 'bg-green-50 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-300' },
}

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDENTE
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function DemandasPage() {
  const [moduloAtivo, setModuloAtivo]       = useState<boolean | null>(null)
  const [togglingModulo, setTogglingModulo] = useState(false)
  const [demandas, setDemandas]             = useState<Demanda[]>([])
  const [freelancers, setFreelancers]       = useState<Freelancer[]>([])
  const [variacoes, setVariacoes]           = useState<Variacao[]>([])
  const [pedidos, setPedidos]               = useState<Pedido[]>([])
  const [loading, setLoading]               = useState(true)

  // Filtros
  const [busca, setBusca]               = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFreelancer, setFiltroFreelancer] = useState('')
  const [filtroPedido, setFiltroPedido] = useState('')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  const [showFiltros, setShowFiltros]   = useState(false)

  // Seleção para ações em massa
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [acaoEmMassa, setAcaoEmMassa]   = useState('')
  const [processando, setProcessando]   = useState(false)

  // Modal criar/editar demanda
  const [showModal, setShowModal]   = useState(false)
  const [editDemanda, setEditDemanda] = useState<Demanda | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [form, setForm] = useState({
    pedidoId: '', freelancerId: '', variacaoId: '',
    nomeProduto: '', qtdSolicitada: '1',
    valorPorItem: '', observacoes: '', status: 'PENDENTE',
  })

  // Modal registrar produção
  const [prodDemanda, setProdDemanda] = useState<Demanda | null>(null)
  const [prodQtd, setProdQtd]         = useState('')
  const [prodLoading, setProdLoading] = useState(false)

  const carregarConfig = useCallback(async () => {
    const res  = await fetch('/api/demandas/config')
    const data = await res.json()
    setModuloAtivo(data.moduloDemandas ?? false)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const safe = async (url: string, fb: any) => {
      try { const r = await fetch(url); return r.ok ? await r.json() : fb } catch { return fb }
    }
    const params = new URLSearchParams()
    if (filtroStatus)     params.set('status', filtroStatus)
    if (filtroFreelancer) params.set('freelancerId', filtroFreelancer)
    if (filtroPedido)     params.set('pedidoId', filtroPedido)
    if (filtroDataDe)     params.set('de', filtroDataDe)
    if (filtroDataAte)    params.set('ate', filtroDataAte)

    const [resDem, resFree, resPed, resVar] = await Promise.all([
      safe(`/api/demandas?${params}`,        []),
      safe('/api/demandas/freelancers',       []),
      safe('/api/producao/pedidos?limit=100', { pedidos: [] }),
      safe('/api/precificacao/variacoes',     []),
    ])
    setDemandas(Array.isArray(resDem) ? resDem : [])
    setFreelancers(Array.isArray(resFree) ? resFree : [])
    setPedidos(Array.isArray(resPed?.pedidos || resPed) ? (resPed?.pedidos || resPed) : [])
    setVariacoes(Array.isArray(resVar) ? resVar : [])
    setLoading(false)
    setSelecionados(new Set())
  }, [filtroStatus, filtroFreelancer, filtroPedido, filtroDataDe, filtroDataAte])

  useEffect(() => { carregarConfig() }, [carregarConfig])
  useEffect(() => { if (moduloAtivo) carregar(); else setLoading(false) }, [moduloAtivo, carregar])

  async function handleToggleModulo() {
    setTogglingModulo(true)
    const res  = await fetch('/api/demandas/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduloDemandas: !moduloAtivo }),
    })
    const data = await res.json()
    setModuloAtivo(data.moduloDemandas)
    if (data.moduloDemandas) carregar()
    setTogglingModulo(false)
  }

  function abrirNova() {
    setEditDemanda(null)
    setForm({ pedidoId: '', freelancerId: '', variacaoId: '', nomeProduto: '', qtdSolicitada: '1', valorPorItem: '', observacoes: '', status: 'PENDENTE' })
    setShowModal(true)
  }

  function abrirEditar(d: Demanda) {
    setEditDemanda(d)
    setForm({
      pedidoId: d.pedidoId || '', freelancerId: d.freelancerId,
      variacaoId: d.variacaoId || '', nomeProduto: d.nomeProduto,
      qtdSolicitada: String(d.qtdSolicitada), valorPorItem: String(d.valorPorItem),
      observacoes: d.observacoes || '', status: d.status,
    })
    setShowModal(true)
  }

  // Ao selecionar variação, busca o valor configurado (com fallback para custoMaoObra)
  async function handleSelectVariacao(variacaoId: string) {
    const v = variacoes.find(x => x.id === variacaoId) as any
    const nome = v ? `${v.produtoNome} · ${v.canal} · ${v.tipo}` : ''
    // Pré-preenche com custoMaoObra como estimativa imediata
    const valorInicial = v && Number(v.custoMaoObra) > 0 ? String(v.custoMaoObra) : ''
    setForm(p => ({ ...p, variacaoId, nomeProduto: nome, valorPorItem: valorInicial }))
    if (variacaoId) {
      try {
        const res  = await fetch(`/api/demandas/config-pagamento?variacaoId=${variacaoId}`)
        if (res.ok) {
          const data = await res.json()
          // Config de pagamento tem prioridade sobre custoMaoObra
          if (data.valorPorItem) setForm(p => ({ ...p, valorPorItem: String(data.valorPorItem) }))
        }
      } catch {}
    }
  }

  async function handleSalvar() {
    if (!form.freelancerId || !form.nomeProduto || !form.qtdSolicitada)
      return alert('Freelancer, produto e quantidade são obrigatórios')
    setSalvando(true)
    try {
      const url    = editDemanda ? `/api/demandas/${editDemanda.id}` : '/api/demandas'
      const method = editDemanda ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          qtdSolicitada: parseInt(form.qtdSolicitada) || 1,
          valorPorItem:  parseFloat(form.valorPorItem)  || 0,
        }),
      })
      if (res.ok) { setShowModal(false); carregar() }
    } finally { setSalvando(false) }
  }

  async function handleRegistrarProducao() {
    if (!prodDemanda || !prodQtd) return
    const qtd = parseInt(prodQtd)
    if (isNaN(qtd) || qtd <= 0) return
    setProdLoading(true)
    await fetch(`/api/demandas/${prodDemanda.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qtdProduzida: qtd,
        valorTotal: qtd * prodDemanda.valorPorItem,
        status: 'PRODUZIDO',
      }),
    })
    setProdDemanda(null)
    setProdQtd('')
    setProdLoading(false)
    carregar()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta demanda?')) return
    await fetch(`/api/demandas/${id}`, { method: 'DELETE' })
    carregar()
  }

  async function handleAcaoEmMassa() {
    if (!acaoEmMassa || selecionados.size === 0) return
    const ids = Array.from(selecionados)

    // Confirmação especial para "Pagar" — mostra total
    if (acaoEmMassa === 'PAGO') {
      const selecionadasDemandas = filtradas.filter(d => ids.includes(d.id))
      const totalPagamento = selecionadasDemandas.reduce((s, d) => s + estimado(d), 0)
      const confirmar = window.confirm(
        `Confirmar pagamento de ${ids.length} demanda${ids.length > 1 ? 's' : ''}?
` +
        `Total a pagar: R$ ${totalPagamento.toFixed(2).replace('.', ',')}

` +
        `Esta ação marcará como PAGO e registrará a data de pagamento.`
      )
      if (!confirmar) return
    }

    setProcessando(true)
    await fetch('/api/demandas/massa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, acao: acaoEmMassa }),
    })
    setAcaoEmMassa('')
    setProcessando(false)
    carregar()
  }

  function toggleSel(id: string) {
    setSelecionados(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleTodos() {
    if (selecionados.size === filtradas.length && filtradas.length > 0) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(filtradas.map(d => d.id)))
    }
  }

  const filtradas = demandas.filter(d => {
    if (!busca) return true
    return (
      d.nomeProduto.toLowerCase().includes(busca.toLowerCase()) ||
      d.freelancerNome.toLowerCase().includes(busca.toLowerCase()) ||
      (d.pedidoRef || '').toLowerCase().includes(busca.toLowerCase()) ||
      (d.observacoes || '').toLowerCase().includes(busca.toLowerCase())
    )
  })

  // Totais
  // valorTotal no banco é 0 até registrar produção; usar valorPorItem×qtdSolicitada como estimativa
  function estimado(d: Demanda) {
    return d.valorTotal > 0 ? d.valorTotal : d.valorPorItem * d.qtdSolicitada
  }
  const totalItens    = filtradas.reduce((s, d) => s + d.qtdProduzida, 0)
  const totalAPagar   = filtradas.filter(d => d.status !== 'PAGO').reduce((s, d) => s + estimado(d), 0)
  const totalPago     = filtradas.filter(d => d.status === 'PAGO').reduce((s, d) => s + estimado(d), 0)
  const totalGeral    = filtradas.reduce((s, d) => s + estimado(d), 0)

  const todosSelecionados = filtradas.length > 0 && selecionados.size === filtradas.length

  // ── Módulo desativado ─────────────────────────────────────────────────────
  if (moduloAtivo === false) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />Demandas de Freelancers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Controle de produção terceirizada</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <Users className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Módulo de Demandas desativado</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 max-w-md mx-auto">
            Ative este módulo se você trabalha com <strong className="text-gray-700 dark:text-gray-200">freelancers</strong> que produzem por peça.
            Controle o que cada freelancer está produzindo, quantas peças entregou e quanto você deve pagar.
          </p>
          <button onClick={handleToggleModulo} disabled={togglingModulo}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
            <ToggleRight className="w-5 h-5" />
            {togglingModulo ? 'Ativando...' : 'Ativar Módulo de Demandas'}
          </button>
        </div>
      </div>
    )
  }

  // ── Tela principal ────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />Demandas de Freelancers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Produção terceirizada — controle por peça produzida
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/demandas/freelancers"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Users className="w-3.5 h-3.5" />Freelancers
          </Link>
          <Link href="/demandas/config-pagamento"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <DollarSign className="w-3.5 h-3.5" />Config. Pagamento
          </Link>
          <button onClick={abrirNova}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
            <Plus className="w-4 h-4" />Nova Demanda
          </button>
        </div>
      </div>

      {/* Cards totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Demandas (filtro atual)</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filtradas.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Itens produzidos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalItens.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4 cursor-pointer"
          onClick={() => setFiltroStatus('PRODUZIDO')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">A pagar</p>
          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{fmtR(totalAPagar)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-800 p-4 cursor-pointer"
          onClick={() => setFiltroStatus('PAGO')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total pago</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{fmtR(totalPago)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white"
              placeholder="Buscar por produto, freelancer, pedido..."
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_PRODUCAO">Em produção</option>
            <option value="PRODUZIDO">Aguard. pagamento</option>
            <option value="PAGO">Pago</option>
          </select>
          <select value={filtroFreelancer} onChange={e => setFiltroFreelancer(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Todos os freelancers</option>
            {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button onClick={() => setShowFiltros(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
              showFiltros ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 text-orange-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
            <Filter className="w-4 h-4" />
            Mais filtros
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={carregar}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {showFiltros && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">De:</label>
              <input type="date" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Até:</label>
              <input type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <button onClick={() => { setFiltroStatus(''); setFiltroFreelancer(''); setFiltroPedido(''); setFiltroDataDe(''); setFiltroDataAte(''); setBusca('') }}
              className="flex items-center gap-1 text-xs text-red-500 hover:underline px-2 py-1.5">
              <X className="w-3 h-3" />Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Ações em massa */}
      {selecionados.size > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 mb-4">
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            {selecionados.size} selecionada{selecionados.size > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-2 py-1 rounded-full font-medium">
            Total: {fmtR(filtradas.filter(d => Array.from(selecionados).includes(d.id)).reduce((s, d) => s + estimado(d), 0))}
          </span>
          <select value={acaoEmMassa} onChange={e => setAcaoEmMassa(e.target.value)}
            className="border border-orange-300 dark:border-orange-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Escolher ação...</option>
            <option value="EM_PRODUCAO">Marcar como Em produção</option>
            <option value="PRODUZIDO">Marcar como Produzido</option>
            <option value="PAGO">Marcar como Pago</option>
          </select>
          <button onClick={handleAcaoEmMassa} disabled={!acaoEmMassa || processando}
            className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {processando ? 'Aplicando...' : 'Aplicar'}
          </button>
          <button onClick={() => setSelecionados(new Set())}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-auto">
            Desmarcar todos
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-3">Nenhuma demanda encontrada.</p>
            <button onClick={abrirNova}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              <Plus className="w-4 h-4" />Criar primeira demanda
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left w-10">
                    <button onClick={toggleTodos}>
                      {todosSelecionados
                        ? <CheckSquare className="w-4 h-4 text-orange-500" />
                        : <Square className="w-4 h-4 text-gray-400" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">Freelancer</th>
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">Pedido</th>
                  <th className="px-4 py-3 text-center">Solicitado</th>
                  <th className="px-4 py-3 text-center">Produzido</th>
                  <th className="px-4 py-3 text-right">R$/item</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Criado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {filtradas.map(d => (
                  <tr key={d.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selecionados.has(d.id) ? 'bg-orange-50/40 dark:bg-orange-900/10' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSel(d.id)}>
                        {selecionados.has(d.id)
                          ? <CheckSquare className="w-4 h-4 text-orange-500" />
                          : <Square className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{d.freelancerNome}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 dark:text-gray-300 max-w-[160px] truncate" title={d.nomeProduto}>
                        {d.nomeProduto}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {d.pedidoRef || '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{d.qtdSolicitada}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setProdDemanda(d); setProdQtd(String(d.qtdProduzida || '')) }}
                        className={`font-bold hover:text-orange-500 transition-colors ${d.qtdProduzida > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}
                        title="Clique para registrar produção">
                        {d.qtdProduzida}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">{fmtR(d.valorPorItem)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{fmtR(d.valorTotal)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(d.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditar(d)} title="Editar"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(d.id)} title="Excluir"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Rodapé com totais */}
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <td colSpan={5} className="px-4 py-3 text-right">Totais:</td>
                  <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">{totalItens.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{fmtR(totalGeral)}</td>
                  <td colSpan={3} className="px-4 py-3">
                    <span className="text-yellow-600 dark:text-yellow-400 mr-3">A pagar: {fmtR(totalAPagar)}</span>
                    <span className="text-green-600 dark:text-green-400">Pago: {fmtR(totalPago)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Criar/Editar ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {editDemanda ? 'Editar Demanda' : 'Nova Demanda'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Freelancer <span className="text-red-400">*</span></label>
                <select className={inputClass} value={form.freelancerId}
                  onChange={e => setForm(p => ({ ...p, freelancerId: e.target.value }))}>
                  <option value="">Selecionar freelancer...</option>
                  {freelancers.filter(f => f.id).map(f => (
                    <option key={f.id} value={f.id}>{f.nome}{f.especialidade ? ` — ${f.especialidade}` : ''}</option>
                  ))}
                </select>
                {freelancers.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    Nenhum freelancer cadastrado.{' '}
                    <Link href="/demandas/freelancers" className="underline">Cadastrar agora →</Link>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Produto (da Precificação)</label>
                <select className={inputClass} value={form.variacaoId}
                  onChange={e => handleSelectVariacao(e.target.value)}>
                  <option value="">Selecionar produto ou digitar abaixo...</option>
                  {variacoes.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.produtoNome} · {v.canal} · {v.tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nome do produto <span className="text-red-400">*</span></label>
                <input className={inputClass} placeholder="Ex: Laço Básico P"
                  value={form.nomeProduto} onChange={e => setForm(p => ({ ...p, nomeProduto: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Qtd solicitada <span className="text-red-400">*</span></label>
                  <input type="number" min="1" className={inputClass} placeholder="Ex: 100"
                    value={form.qtdSolicitada} onChange={e => setForm(p => ({ ...p, qtdSolicitada: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">R$ por item</label>
                  <input type="number" step="0.01" min="0" className={inputClass} placeholder="Ex: 1.50"
                    value={form.valorPorItem} onChange={e => setForm(p => ({ ...p, valorPorItem: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pedido vinculado <span className="text-gray-400">(opcional)</span></label>
                <select className={inputClass} value={form.pedidoId}
                  onChange={e => setForm(p => ({ ...p, pedidoId: e.target.value }))}>
                  <option value="">Sem vínculo de pedido</option>
                  {pedidos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.numeroPedido ? `#${p.numeroPedido}` : p.id.slice(0, 8)} {p.clienteNome ? `· ${p.clienteNome}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {editDemanda && (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                  <select className={inputClass} value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="PENDENTE">Pendente</option>
                    <option value="EM_PRODUCAO">Em produção</option>
                    <option value="PRODUZIDO">Produzido (aguard. pagamento)</option>
                    <option value="PAGO">Pago</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Observações <span className="text-gray-400">(opcional)</span></label>
                <textarea className={inputClass} rows={2} placeholder="Instruções, especificações..."
                  value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
              </div>

              {form.valorPorItem && form.qtdSolicitada && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-2.5 flex justify-between items-center">
                  <span className="text-xs text-orange-700 dark:text-orange-300">Valor estimado (se 100% produzido)</span>
                  <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                    {fmtR((parseFloat(form.valorPorItem) || 0) * (parseInt(form.qtdSolicitada) || 0))}
                  </span>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end flex-shrink-0">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={salvando}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {salvando ? 'Salvando...' : editDemanda ? 'Salvar alterações' : 'Criar demanda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Registrar Produção ── */}
      {prodDemanda && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Registrar Produção</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {prodDemanda.freelancerNome} · {prodDemanda.nomeProduto}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Solicitado</p>
                  <p className="font-bold text-gray-900 dark:text-white">{prodDemanda.qtdSolicitada} itens</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">R$/item</p>
                  <p className="font-bold text-orange-600">{fmtR(prodDemanda.valorPorItem)}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Quantidade produzida</label>
                <input type="number" min="0" className={inputClass} placeholder="Ex: 85"
                  value={prodQtd} onChange={e => setProdQtd(e.target.value)} autoFocus />
              </div>
              {prodQtd && !isNaN(parseInt(prodQtd)) && parseInt(prodQtd) > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5 flex justify-between">
                  <span className="text-xs text-green-700 dark:text-green-300">Valor a pagar</span>
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {fmtR(parseInt(prodQtd) * prodDemanda.valorPorItem)}
                  </span>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => { setProdDemanda(null); setProdQtd('') }}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleRegistrarProducao} disabled={prodLoading || !prodQtd || parseInt(prodQtd) <= 0}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {prodLoading ? 'Salvando...' : 'Confirmar produção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
