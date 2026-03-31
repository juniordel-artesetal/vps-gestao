'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Layers, Plus, History, Search, RefreshCw, X,
  AlertTriangle, ToggleRight, Pencil, SlidersHorizontal,
} from 'lucide-react'
import Link from 'next/link'

// ── Tipos ───────────────────────────────────────────────────────────────────

interface ItemMaterial {
  materialId: string
  nome: string
  unidade: string
  precoUnidade: number
  precoPacote: number
  qtdPacote: number
  fornecedor: string | null
  saldoAtual: number
  estoqueMinimo: number
  ultimaMovimentacao: string | null
  podeZerar: boolean        // ← novo: ignora alertas de estoque baixo/zerado
  noEstoque: boolean        // ← novo: true = já monitorado, false = só da precificação
}

// Material vindo da precificação (para listar os não monitorados)
interface PrecMaterial {
  id: string
  nome: string
  unidade: string
  precoUnidade: number
  fornecedor: string | null
}

interface Movimento {
  id: string
  tipo: string
  quantidade: number
  saldoApos: number
  motivo: string | null
  referencia: string | null
  fornecedor: string | null
  usuarioNome: string | null
  createdAt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white'

function fmtQtd(n: number, unidade: string) {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${unidade}`
}
function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('pt-BR') + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ saldo, minimo }: { saldo: number; minimo: number }) {
  if (saldo <= 0)
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">Zerado</span>
  if (minimo > 0 && saldo <= minimo)
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">⚠ Alerta</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">OK</span>
}

type TipoMov = 'ENTRADA' | 'SAIDA' | 'AJUSTE'
type Filtro  = 'todos' | 'alerta' | 'zerado'

// ── Componente ───────────────────────────────────────────────────────────────

export default function EstoqueMateriaisPage() {
  const [moduloAtivo, setModuloAtivo]       = useState<boolean | null>(null)
  const [togglingModulo, setTogglingModulo] = useState(false)
  const [itens, setItens]                   = useState<ItemMaterial[]>([])
  const [loading, setLoading]               = useState(true)
  const [busca, setBusca]                   = useState('')
  const [filtro, setFiltro]                 = useState<Filtro>('todos')
  const [togglingZerar, setTogglingZerar]   = useState<string | null>(null) // materialId em toggle

  // Modal adicionar
  const [showAddModal, setShowAddModal]   = useState(false)
  const [disponiveis, setDisponiveis]     = useState<ItemMaterial[]>([])
  const [loadingDisp, setLoadingDisp]     = useState(false)
  const [selecionados, setSelecionados]   = useState<Set<string>>(new Set())
  const [addLoading, setAddLoading]       = useState(false)

  // Modal movimentação
  const [movItem, setMovItem]       = useState<ItemMaterial | null>(null)
  const [movTipo, setMovTipo]       = useState<TipoMov>('ENTRADA')
  const [movQtd, setMovQtd]         = useState('')
  const [movMotivo, setMovMotivo]   = useState('')
  const [movRef, setMovRef]         = useState('')
  const [movFornec, setMovFornec]   = useState('')
  const [movLoading, setMovLoading] = useState(false)
  const [movErro, setMovErro]       = useState('')

  // Modal editar mínimo
  const [editItem, setEditItem]   = useState<ItemMaterial | null>(null)
  const [editMin, setEditMin]     = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Modal histórico
  const [histItem, setHistItem]   = useState<ItemMaterial | null>(null)
  const [histMovs, setHistMovs]   = useState<Movimento[]>([])
  const [histLoading, setHistLoading] = useState(false)

  const carregarConfig = useCallback(async () => {
    const res  = await fetch('/api/estoque/materiais/config')
    const data = await res.json()
    setModuloAtivo(data.moduloEstoqueMateriais ?? false)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    // Busca materiais no estoque E todos da precificação em paralelo
    const [estoqueData, precData] = await Promise.all([
      fetch('/api/estoque/materiais').then(r => r.json()).catch(() => []),
      fetch('/api/precificacao/materiais').then(r => r.json()).catch(() => []),
    ])

    const estoqueItens: ItemMaterial[] = (Array.isArray(estoqueData) ? estoqueData : [])
      .map((item: any) => ({ ...item, noEstoque: true, podeZerar: item.podeZerar ?? false }))

    const estoqueIds = new Set(estoqueItens.map(i => i.materialId))

    // Materiais da precificação que ainda não estão no estoque
    const naoMonitorados: ItemMaterial[] = (Array.isArray(precData) ? precData : [])
      .filter((m: any) => !estoqueIds.has(m.id))
      .map((m: any) => ({
        materialId: m.id,
        nome: m.nome,
        unidade: m.unidade,
        precoUnidade: m.precoUnidade ?? 0,
        precoPacote: m.precoPacote ?? 0,
        qtdPacote: m.qtdPacote ?? 0,
        fornecedor: m.fornecedor ?? null,
        saldoAtual: 0,
        estoqueMinimo: 0,
        ultimaMovimentacao: null,
        podeZerar: false,
        noEstoque: false,
      }))

    setItens([...estoqueItens, ...naoMonitorados])
    setLoading(false)
  }, [])

  useEffect(() => { carregarConfig() }, [carregarConfig])
  useEffect(() => {
    if (moduloAtivo) carregar()
    else setLoading(false)
  }, [moduloAtivo, carregar])

  async function handleToggleModulo() {
    setTogglingModulo(true)
    const res  = await fetch('/api/estoque/materiais/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduloEstoqueMateriais: !moduloAtivo }),
    })
    const data = await res.json()
    setModuloAtivo(data.moduloEstoqueMateriais)
    if (data.moduloEstoqueMateriais) carregar()
    setTogglingModulo(false)
  }

  async function abrirAddModal() {
    setShowAddModal(true)
    setLoadingDisp(true)
    setSelecionados(new Set())
    const res  = await fetch('/api/estoque/materiais?disponiveis=1')
    const data = await res.json()
    setDisponiveis(Array.isArray(data) ? data : [])
    setLoadingDisp(false)
  }

  async function handleAdicionar() {
    if (selecionados.size === 0) return
    setAddLoading(true)
    await fetch('/api/estoque/materiais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialIds: Array.from(selecionados) }),
    })
    setShowAddModal(false)
    setAddLoading(false)
    carregar()
  }

  async function handleMovimentar() {
    if (!movItem || !movQtd) return
    const qtd = parseFloat(movQtd)
    if (isNaN(qtd) || qtd <= 0) { setMovErro('Quantidade inválida'); return }
    setMovLoading(true)
    setMovErro('')
    const res = await fetch('/api/estoque/materiais/movimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialId: movItem.materialId,
        tipo: movTipo, quantidade: qtd,
        motivo:    movMotivo  || undefined,
        referencia: movRef    || undefined,
        fornecedor: movFornec || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setMovErro(data.error || 'Erro'); setMovLoading(false); return }
    setMovItem(null)
    setMovLoading(false)
    carregar()
  }

  async function handleSalvarMin() {
    if (!editItem) return
    setEditLoading(true)
    await fetch(`/api/estoque/materiais/${editItem.materialId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estoqueMinimo: parseFloat(editMin) || 0 }),
    })
    setEditItem(null)
    setEditMin('')
    setEditLoading(false)
    carregar()
  }

  async function abrirHistorico(item: ItemMaterial) {
    setHistItem(item)
    setHistMovs([])
    setHistLoading(true)
    const res  = await fetch(`/api/estoque/materiais/${item.materialId}`)
    const data = await res.json()
    setHistMovs(Array.isArray(data) ? data : [])
    setHistLoading(false)
  }

  async function handleRemover(item: ItemMaterial) {
    if (!confirm(`Remover "${item.nome}" do estoque de materiais? O histórico será mantido.`)) return
    await fetch(`/api/estoque/materiais/${item.materialId}`, { method: 'DELETE' })
    carregar()
  }

  // ── Toggle "pode ficar zerado" ─────────────────────────────────────────────
  async function handleTogglePodeZerar(item: ItemMaterial) {
    if (!item.noEstoque) return // só materiais já no estoque
    setTogglingZerar(item.materialId)
    await fetch(`/api/estoque/materiais/${item.materialId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ podeZerar: !item.podeZerar }),
    })
    // Atualiza localmente sem recarregar tudo
    setItens(prev => prev.map(i =>
      i.materialId === item.materialId ? { ...i, podeZerar: !i.podeZerar } : i
    ))
    setTogglingZerar(null)
  }

  // ── Adicionar material ao estoque (via row button) ─────────────────────────
  async function handleMonitorar(item: ItemMaterial) {
    await fetch('/api/estoque/materiais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialIds: [item.materialId] }),
    })
    carregar()
  }

  const filtrados = itens.filter(v => {
    const ok = !busca ||
      v.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (v.fornecedor || '').toLowerCase().includes(busca.toLowerCase())
    if (!ok) return false
    if (!v.noEstoque) return filtro === 'todos' // não-monitorados só aparecem em "todos"
    if (filtro === 'zerado') return v.saldoAtual <= 0
    if (filtro === 'alerta') return v.estoqueMinimo > 0 && v.saldoAtual > 0 && v.saldoAtual <= v.estoqueMinimo
    return true
  })

  const monitorados = itens.filter(v => v.noEstoque)
  const alertas     = monitorados.filter(v => !v.podeZerar && v.estoqueMinimo > 0 && v.saldoAtual > 0 && v.saldoAtual <= v.estoqueMinimo).length
  const zerados     = monitorados.filter(v => !v.podeZerar && v.saldoAtual <= 0).length
  const valorTotal  = monitorados.reduce((acc, v) => acc + v.saldoAtual * (v.precoUnidade || 0), 0)

  function abrirMov(item: ItemMaterial) {
    setMovItem(item)
    setMovTipo('ENTRADA')
    setMovQtd('')
    setMovMotivo('')
    setMovRef('')
    setMovFornec(item.fornecedor || '')
    setMovErro('')
  }

  const previewSaldo =
    movItem && movQtd && !isNaN(parseFloat(movQtd)) && parseFloat(movQtd) > 0
      ? movTipo === 'ENTRADA' ? movItem.saldoAtual + parseFloat(movQtd)
      : movTipo === 'SAIDA'   ? movItem.saldoAtual - parseFloat(movQtd)
      : parseFloat(movQtd)
      : null

  // ── Tela de módulo desativado ─────────────────────────────────────────────
  if (moduloAtivo === false) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-orange-500" />Estoque de Materiais
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Controle de matérias-primas e insumos
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <Layers className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Módulo de Estoque de Materiais desativado
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 max-w-md mx-auto">
            Ative para controlar o saldo das suas matérias-primas — tecidos, fios, tintas, laços, papéis e qualquer insumo usado na produção.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 max-w-md mx-auto">
            Os materiais são os mesmos cadastrados na <strong className="text-gray-500">Precificação → Materiais</strong>.
          </p>
          <button onClick={handleToggleModulo} disabled={togglingModulo}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
            <ToggleRight className="w-5 h-5" />
            {togglingModulo ? 'Ativando...' : 'Ativar Módulo de Estoque de Materiais'}
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
            <Layers className="w-6 h-6 text-orange-500" />Estoque de Materiais
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Matérias-primas e insumos — entradas de compras, saídas ao usar na produção
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/precificacao/materiais"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />Gerenciar materiais
          </Link>
          <button onClick={abrirAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4" />Adicionar material
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Materiais monitorados</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{monitorados.length}</p>
        </div>
        <div onClick={() => setFiltro('alerta')}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:border-yellow-300 transition-colors">
          <p className="text-xs text-gray-500 dark:text-gray-400">Em alerta</p>
          <p className={`text-2xl font-bold mt-1 ${alertas > 0 ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>{alertas}</p>
        </div>
        <div onClick={() => setFiltro('zerado')}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:border-red-300 transition-colors">
          <p className="text-xs text-gray-500 dark:text-gray-400">Zerados</p>
          <p className={`text-2xl font-bold mt-1 ${zerados > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{zerados}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor em estoque</p>
          <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
            {'R$ ' + valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400">pelo custo unitário</p>
        </div>
      </div>

      {/* Alerta banner */}
      {alertas > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {alertas} material{alertas > 1 ? 'is' : ''} com saldo abaixo do mínimo.{' '}
            <button onClick={() => setFiltro('alerta')} className="underline font-medium">Ver agora</button>
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white"
            placeholder="Buscar material ou fornecedor..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {(['todos', 'alerta', 'zerado'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtro === f ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}>
              {f === 'todos' ? 'Todos' : f === 'alerta' ? '⚠ Alerta' : '🔴 Zerados'}
            </button>
          ))}
          <button onClick={carregar}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-3">Nenhum material adicionado ao estoque.</p>
            <p className="text-xs text-gray-400 mb-4">
              Adicione materiais cadastrados em{' '}
              <Link href="/precificacao/materiais" className="text-orange-500 underline">Precificação → Materiais</Link>
            </p>
            <button onClick={abrirAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              <Plus className="w-4 h-4" />Adicionar primeiro material
            </button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nenhum material com este filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Material</th>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-center">Unidade</th>
                  <th className="px-4 py-3 text-right">Custo/un</th>
                  <th className="px-4 py-3 text-center">Saldo</th>
                  <th className="px-4 py-3 text-center">Mínimo</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center" title="Quando ativo (laranja), dispara alertas. Desative para materiais que podem ficar zerados.">Alertas</th>
                  <th className="px-4 py-3 text-left">Últ. mov.</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {filtrados.map(item => (
                  <tr key={item.materialId} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                    !item.noEstoque ? 'opacity-50 italic' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {item.nome}
                        {!item.noEstoque && (
                          <span className="ml-2 text-xs text-gray-400 not-italic font-normal">não monitorado</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {item.fornecedor || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {item.unidade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                      {fmtR(item.precoUnidade)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xl font-bold ${
                        item.saldoAtual <= 0 ? 'text-red-500'
                        : item.estoqueMinimo > 0 && item.saldoAtual <= item.estoqueMinimo ? 'text-yellow-600'
                        : 'text-gray-900 dark:text-white'
                      }`}>
                        {item.saldoAtual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setEditItem(item); setEditMin(String(item.estoqueMinimo || '')) }}
                        className="text-gray-500 dark:text-gray-400 hover:text-orange-500 underline underline-offset-2 text-sm"
                        title="Clique para editar o mínimo">
                        {item.estoqueMinimo > 0
                          ? item.estoqueMinimo.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
                          : '—'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge saldo={item.saldoAtual} minimo={item.estoqueMinimo} />
                    </td>
                    <td className="px-4 py-3 text-center" title="Quando ativo, não dispara alertas de estoque zerado ou baixo">
                      {item.noEstoque ? (
                        <button
                          onClick={() => handleTogglePodeZerar(item)}
                          disabled={togglingZerar === item.materialId}
                          title={item.podeZerar ? 'Alertas desativados — clique para ativar' : 'Alertas ativos — clique para desativar'}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            item.podeZerar
                              ? 'bg-gray-300 dark:bg-gray-600'
                              : 'bg-orange-500'
                          } ${togglingZerar === item.materialId ? 'opacity-50' : ''}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                            item.podeZerar ? 'left-0.5' : 'left-5'
                          }`} />
                        </button>
                      ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(item.ultimaMovimentacao)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {item.noEstoque ? (
                          <>
                            <button onClick={() => abrirMov(item)}
                              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors">
                              + Mov.
                            </button>
                            <button onClick={() => abrirHistorico(item)} title="Histórico"
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleRemover(item)} title="Remover do estoque"
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:border-red-300 hover:text-red-500 dark:hover:border-red-700 dark:hover:text-red-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleMonitorar(item)}
                            className="px-3 py-1.5 border border-orange-300 text-orange-500 rounded-lg text-xs font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                            + Monitorar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Adicionar ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Adicionar material ao Estoque</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Materiais cadastrados em <strong>Precificação → Materiais</strong>
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {loadingDisp ? (
                <div className="p-8 text-center text-gray-400">Carregando materiais...</div>
              ) : disponiveis.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-400 mb-2">Todos os materiais já estão no estoque.</p>
                  <Link href="/precificacao/materiais" className="text-xs text-orange-500 underline">
                    Cadastrar novos materiais →
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {disponiveis.map(m => (
                    <label key={m.materialId}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selecionados.has(m.materialId)
                          ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                          : 'border border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}>
                      <input type="checkbox" className="accent-orange-500 w-4 h-4"
                        checked={selecionados.has(m.materialId)}
                        onChange={e => {
                          const s = new Set(selecionados)
                          e.target.checked ? s.add(m.materialId) : s.delete(m.materialId)
                          setSelecionados(s)
                        }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{m.nome}</div>
                        <div className="text-xs text-gray-400">
                          {m.unidade}
                          {m.fornecedor ? ` · ${m.fornecedor}` : ''}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400">{fmtR(m.precoUnidade)}<span className="text-gray-400">/{m.unidade}</span></div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {disponiveis.length > 0 && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-gray-400">
                  {selecionados.size > 0 ? `${selecionados.size} selecionado${selecionados.size > 1 ? 's' : ''}` : 'Nenhum selecionado'}
                </span>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                    Cancelar
                  </button>
                  <button onClick={handleAdicionar} disabled={selecionados.size === 0 || addLoading}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    {addLoading ? 'Adicionando...' : `Adicionar${selecionados.size > 0 ? ` (${selecionados.size})` : ''}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Movimentação ── */}
      {movItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Movimentar Estoque</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{movItem.nome} · {movItem.unidade}</p>
              </div>
              <button onClick={() => setMovItem(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Saldo atual</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {movItem.saldoAtual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                  <span className="text-sm font-normal text-gray-400">{movItem.unidade}</span>
                </span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'ENTRADA', label: '↑ Entrada', sel: 'bg-green-50 border-green-400 text-green-700 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300' },
                    { v: 'SAIDA',   label: '↓ Saída',   sel: 'bg-red-50 border-red-400 text-red-700 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300' },
                    { v: 'AJUSTE',  label: '✎ Ajuste',  sel: 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300' },
                  ] as const).map(opt => (
                    <button key={opt.v} onClick={() => setMovTipo(opt.v)}
                      className={`py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        movTipo === opt.v ? opt.sel : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {movTipo === 'ENTRADA' && <p className="text-xs text-green-600 mt-1.5">Use ao comprar ou receber material.</p>}
                {movTipo === 'SAIDA'   && <p className="text-xs text-red-500 mt-1.5">Use ao consumir na produção.</p>}
                {movTipo === 'AJUSTE'  && <p className="text-xs text-blue-500 mt-1.5">Define o saldo absoluto — use para inventário físico.</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {movTipo === 'AJUSTE' ? `Novo saldo total (${movItem.unidade})` : `Quantidade (${movItem.unidade})`}
                </label>
                <input type="number" min="0.001" step="0.001" className={inputClass}
                  placeholder="Ex: 100" value={movQtd} onChange={e => setMovQtd(e.target.value)} />
              </div>
              {movTipo === 'ENTRADA' && (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Fornecedor <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input className={inputClass} placeholder="Ex: Distribuidora XYZ"
                    value={movFornec} onChange={e => setMovFornec(e.target.value)} />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Motivo <span className="text-gray-400">(opcional)</span>
                </label>
                <input className={inputClass}
                  placeholder={movTipo === 'ENTRADA' ? 'Ex: Compra de reposição' : movTipo === 'SAIDA' ? 'Ex: Produção pedido #123' : 'Ex: Inventário mensal'}
                  value={movMotivo} onChange={e => setMovMotivo(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Referência <span className="text-gray-400">(opcional)</span>
                </label>
                <input className={inputClass} placeholder="Ex: NF 456, Pedido #789"
                  value={movRef} onChange={e => setMovRef(e.target.value)} />
              </div>
              {previewSaldo !== null && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-orange-700 dark:text-orange-300">Saldo após</span>
                  <span className={`text-lg font-bold ${previewSaldo < 0 ? 'text-red-500' : 'text-orange-600 dark:text-orange-400'}`}>
                    {previewSaldo.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {movItem.unidade}
                  </span>
                </div>
              )}
              {movErro && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-3 py-2 rounded-lg">{movErro}</p>}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setMovItem(null)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleMovimentar} disabled={movLoading || !movQtd || parseFloat(movQtd) <= 0}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {movLoading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Mínimo ── */}
      {editItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Estoque Mínimo</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{editItem.nome} · {editItem.unidade}</p>
            </div>
            <div className="p-5">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Alerta quando saldo ≤ este valor. Use 0 para desativar.
              </label>
              <input type="number" min="0" step="0.001" className={inputClass}
                placeholder={`Ex: 50 ${editItem.unidade}`}
                value={editMin} onChange={e => setEditMin(e.target.value)} />
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setEditItem(null)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleSalvarMin} disabled={editLoading}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {editLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Histórico ── */}
      {histItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Histórico de Movimentações</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{histItem.nome} · {histItem.unidade}</p>
              </div>
              <button onClick={() => { setHistItem(null); setHistMovs([]) }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {histLoading ? (
                <div className="p-8 text-center text-gray-400">Carregando...</div>
              ) : histMovs.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Nenhuma movimentação ainda.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                    <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-center">Qtd</th>
                      <th className="px-4 py-3 text-center">Saldo</th>
                      <th className="px-4 py-3 text-left">Fornecedor</th>
                      <th className="px-4 py-3 text-left">Motivo</th>
                      <th className="px-4 py-3 text-left">Ref.</th>
                      <th className="px-4 py-3 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                    {histMovs.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.tipo === 'ENTRADA' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : m.tipo === 'SAIDA'  ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {m.tipo === 'ENTRADA' ? '↑ Entrada' : m.tipo === 'SAIDA' ? '↓ Saída' : '✎ Ajuste'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
                          {Number(m.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                          {Number(m.saldoApos).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{m.fornecedor || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{m.motivo || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{m.referencia || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
