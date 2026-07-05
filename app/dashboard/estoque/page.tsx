'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Package, Plus, History, Search, RefreshCw, X,
  AlertTriangle, ToggleRight, ChevronDown, ChevronUp,
  Pencil, SlidersHorizontal, Link as LinkIcon,
  Image as ImageIcon, Trash2,
} from 'lucide-react'
import Link from 'next/link'

interface CampoConfig {
  id: string; nome: string; tipo: string; opcoes: string | null
  obrigatorio: boolean; ativo: boolean
}
interface ItemEstoque {
  variacaoId: string; produtoId: string; produtoNome: string
  sku: string | null; canal: string; tipo: string; subOpcao: string | null
  isKit: boolean; custoTotal: number; precoVenda: number
  saldoAtual: number; estoqueMinimo: number; ultimaMovimentacao: string | null
  camposValores: Record<string, string>
  temImagem?: boolean
}
interface Movimento {
  id: string; tipo: string; quantidade: number; saldoApos: number
  motivo: string | null; referencia: string | null; usuarioNome: string | null; createdAt: string
}

const inputClass =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm ' +
  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400 dark:placeholder-gray-400'

const CANAL_LABEL: Record<string, string> = {
  shopee: 'Shopee', ml: 'Mercado Livre', elo7: 'Elo7',
  tiktok: 'TikTok Shop', amazon: 'Amazon', magalu: 'Magalu',
  direta: 'Venda Direta', outro: 'Outro',
}

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Comprime imagem client-side: máx 400px, JPEG ~70% (~40KB) — para não inchar o banco
async function comprimirImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 400
        let w = img.width, h = img.height
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = () => reject(new Error('img'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('reader'))
    reader.readAsDataURL(file)
  })
}

function StatusBadge({ saldo, minimo }: { saldo: number; minimo: number }) {
  if (saldo === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Zerado</span>
  if (minimo > 0 && saldo <= minimo) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">⚠ Alerta</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">OK</span>
}

type TipoMov = 'ENTRADA' | 'SAIDA' | 'AJUSTE'
type Filtro = 'todos' | 'alerta' | 'zerado'

export default function EstoqueProdutosPage() {
  const [moduloAtivo, setModuloAtivo] = useState<boolean | null>(null)
  const [togglingModulo, setTogglingModulo] = useState(false)
  const [itens, setItens] = useState<ItemEstoque[]>([])
  const [campos, setCampos] = useState<CampoConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [showAddModal, setShowAddModal] = useState(false)
  const [disponiveis, setDisponiveis] = useState<ItemEstoque[]>([])
  const [loadingDisp, setLoadingDisp] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [addLoading, setAddLoading] = useState(false)
  const [movItem, setMovItem] = useState<ItemEstoque | null>(null)
  const [movTipo, setMovTipo] = useState<TipoMov>('ENTRADA')
  const [movQtd, setMovQtd] = useState('')
  const [movMotivo, setMovMotivo] = useState('')
  const [movRef, setMovRef] = useState('')
  const [movLoading, setMovLoading] = useState(false)
  const [movErro, setMovErro] = useState('')
  const [editItem, setEditItem] = useState<ItemEstoque | null>(null)
  const [editCampos, setEditCampos] = useState<Record<string, string>>({})
  const [editMinimo, setEditMinimo] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  // Imagem: 'manter' (não mexe), 'nova' (envia base64), 'remover' (limpa)
  const [editImagem, setEditImagem] = useState('')
  const [editImagemAcao, setEditImagemAcao] = useState<'manter' | 'nova' | 'remover'>('manter')
  const [imgProcessando, setImgProcessando] = useState(false)
  const [histItem, setHistItem] = useState<ItemEstoque | null>(null)
  const [histMovs, setHistMovs] = useState<Movimento[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const carregarConfig = useCallback(async () => {
    const res = await fetch('/api/estoque/config')
    const data = await res.json()
    setModuloAtivo(data.moduloEstoque ?? false)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [resItens, resCampos] = await Promise.all([
      fetch('/api/estoque/produtos'),
      fetch('/api/config/campos-estoque'),
    ])
    const dataItens = await resItens.json()
    const dataCampos = await resCampos.json()
    setItens(Array.isArray(dataItens) ? dataItens : [])
    setCampos(Array.isArray(dataCampos) ? dataCampos.filter((c: CampoConfig) => c.ativo) : [])
    setLoading(false)
  }, [])

  useEffect(() => { carregarConfig() }, [carregarConfig])
  useEffect(() => { if (moduloAtivo) carregar(); else setLoading(false) }, [moduloAtivo, carregar])

  async function handleToggleModulo() {
    setTogglingModulo(true)
    const res = await fetch('/api/estoque/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduloEstoque: !moduloAtivo }),
    })
    const data = await res.json()
    setModuloAtivo(data.moduloEstoque)
    if (data.moduloEstoque) carregar()
    setTogglingModulo(false)
  }

  async function abrirAddModal() {
    setShowAddModal(true); setLoadingDisp(true); setSelecionados(new Set())
    const res = await fetch('/api/estoque/produtos?disponiveis=1')
    const data = await res.json()
    setDisponiveis(Array.isArray(data) ? data : [])
    setLoadingDisp(false)
  }

  async function handleAdicionarAoEstoque() {
    if (selecionados.size === 0) return
    setAddLoading(true)
    await fetch('/api/estoque/produtos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variacaoIds: Array.from(selecionados) }),
    })
    setShowAddModal(false); setAddLoading(false); carregar()
  }

  async function handleMovimentar() {
    if (!movItem || !movQtd) return
    const qtd = parseInt(movQtd)
    if (isNaN(qtd) || qtd <= 0) { setMovErro('Quantidade inválida'); return }
    // Validar saldo negativo em SAÍDA
    if (movTipo === 'SAIDA' && movItem.saldoAtual - qtd < 0) {
      setMovErro(`Saldo insuficiente. Saldo atual: ${movItem.saldoAtual} unid. — não é possível retirar ${qtd} unid.`)
      return
    }
    setMovLoading(true); setMovErro('')
    const res = await fetch('/api/estoque/produtos/movimento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variacaoId: movItem.variacaoId, tipo: movTipo, quantidade: qtd,
        motivo: movMotivo || undefined, referencia: movRef || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setMovErro(data.error || 'Erro'); setMovLoading(false); return }
    setMovItem(null); setMovLoading(false); carregar()
  }

  function abrirEditar(item: ItemEstoque) {
    setEditItem(item); setEditCampos({ ...item.camposValores }); setEditMinimo(String(item.estoqueMinimo || ''))
    setEditImagem(''); setEditImagemAcao('manter')
  }

  async function handleSelecionarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgProcessando(true)
    try {
      const base64 = await comprimirImagem(file)
      setEditImagem(base64); setEditImagemAcao('nova')
    } catch { alert('Não consegui processar a imagem. Tente outra foto.') }
    finally { setImgProcessando(false) }
  }

  function removerImagem() {
    setEditImagem(''); setEditImagemAcao('remover')
  }

  async function handleSalvarEditar() {
    if (!editItem) return
    setEditLoading(true)
    // imagem: só envia quando houve alteração (nova/remover); 'manter' não mexe na coluna
    const imagemPayload =
      editImagemAcao === 'nova'    ? editImagem :
      editImagemAcao === 'remover' ? null : undefined
    await fetch(`/api/estoque/produtos/${editItem.variacaoId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estoqueMinimo: parseInt(editMinimo) || 0, camposValores: editCampos, imagem: imagemPayload }),
    })
    setEditItem(null); setEditLoading(false); carregar()
  }

  async function handleRemover(item: ItemEstoque) {
    if (!confirm(`Remover "${item.produtoNome}" do estoque? O histórico será mantido.`)) return
    await fetch(`/api/estoque/produtos/${item.variacaoId}`, { method: 'DELETE' })
    carregar()
  }

  async function abrirHistorico(item: ItemEstoque) {
    setHistItem(item); setHistMovs([]); setHistLoading(true)
    const res = await fetch(`/api/estoque/produtos/${item.variacaoId}`)
    const data = await res.json()
    setHistMovs(Array.isArray(data) ? data : [])
    setHistLoading(false)
  }

  function toggleExpandido(id: string) {
    setExpandidos(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const filtrados = itens.filter(v => {
    const ok = !busca || v.produtoNome.toLowerCase().includes(busca.toLowerCase()) || (v.sku && v.sku.toLowerCase().includes(busca.toLowerCase()))
    if (!ok) return false
    if (filtro === 'zerado') return v.saldoAtual === 0
    if (filtro === 'alerta') return v.estoqueMinimo > 0 && v.saldoAtual > 0 && v.saldoAtual <= v.estoqueMinimo
    return true
  })

  const alertas = itens.filter(v => v.estoqueMinimo > 0 && v.saldoAtual > 0 && v.saldoAtual <= v.estoqueMinimo).length
  const zerados = itens.filter(v => v.saldoAtual === 0).length
  const valorTotal = itens.reduce((acc, v) => acc + v.saldoAtual * (v.custoTotal || 0), 0)

  const previewSaldo = movItem && movQtd && !isNaN(parseInt(movQtd)) && parseInt(movQtd) > 0
    ? movTipo === 'ENTRADA' ? movItem.saldoAtual + parseInt(movQtd)
    : movTipo === 'SAIDA'   ? movItem.saldoAtual - parseInt(movQtd)
    : parseInt(movQtd)
    : null

  // ── Módulo desativado ─────────────────────────────────────────────────────
  if (moduloAtivo === false) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-500" />Estoque de Produtos
          </h1>
          <p className="text-sm text-gray-500 mt-1">Controle de produtos prontos para pronta entrega</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-10 text-center shadow-sm">
          <Package className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Módulo de Estoque desativado</h2>
          <p className="text-sm text-gray-500 mb-2 max-w-md mx-auto">
            Este módulo é opcional. Ative-o se o seu ateliê trabalha com produtos de{' '}
            <strong className="text-gray-800 dark:text-white">pronta entrega</strong> — produtos prontos que ficam em estoque até serem vendidos.
          </p>
          <p className="text-xs text-gray-400 mb-6 max-w-md mx-auto">
            Produtos feitos por <strong className="text-gray-600 dark:text-gray-300">encomenda</strong> não precisam de estoque — cada pedido já tem destino certo.
          </p>
          <button onClick={handleToggleModulo} disabled={togglingModulo}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
            <ToggleRight className="w-5 h-5" />
            {togglingModulo ? 'Ativando...' : 'Ativar Módulo de Estoque'}
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
            <Package className="w-6 h-6 text-orange-500" />Estoque de Produtos
          </h1>
          <p className="text-sm text-gray-500 mt-1">Produtos de pronta entrega — entradas da produção, saídas ao expedir</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/config/campos-estoque"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />Configurar campos
          </Link>
          <button onClick={abrirAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4" />Adicionar produto
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <p className="text-xs text-gray-500">SKUs no estoque</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{itens.length}</p>
        </div>
        <div onClick={() => setFiltro('alerta')} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm cursor-pointer hover:border-yellow-400 dark:hover:border-yellow-600 transition-colors">
          <p className="text-xs text-gray-500">Em alerta</p>
          <p className={`text-2xl font-bold mt-1 ${alertas > 0 ? 'text-yellow-500' : 'text-gray-900 dark:text-white'}`}>{alertas}</p>
        </div>
        <div onClick={() => setFiltro('zerado')} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm cursor-pointer hover:border-red-400 dark:hover:border-red-600 transition-colors">
          <p className="text-xs text-gray-500">Zerados</p>
          <p className={`text-2xl font-bold mt-1 ${zerados > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{zerados}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Valor em estoque</p>
          <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{fmtR(valorTotal)}</p>
          <p className="text-xs text-gray-400">pelo custo</p>
        </div>
      </div>

      {alertas > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-600/40 rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {alertas} produto{alertas > 1 ? 's' : ''} com saldo abaixo do mínimo.{' '}
            <button onClick={() => setFiltro('alerta')} className="underline font-medium">Ver agora</button>
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400"
            placeholder="Buscar produto ou SKU..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {(['todos', 'alerta', 'zerado'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtro === f ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              {f === 'todos' ? 'Todos' : f === 'alerta' ? '⚠ Alerta' : '🔴 Zerados'}
            </button>
          ))}
          <button onClick={carregar} className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 mb-3">Nenhum produto adicionado ao estoque.</p>
            <p className="text-xs text-gray-400 mb-4">
              Adicione produtos cadastrados na{' '}
              <Link href="/precificacao/produtos" className="text-orange-500 underline">Precificação</Link>{' '}
              para começar a controlar o estoque.
            </p>
            <button onClick={abrirAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              <Plus className="w-4 h-4" />Adicionar primeiro produto
            </button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Nenhum produto com este filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/60 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">Canal</th>
                  <th className="px-4 py-3 text-left">Variação</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-center">Saldo</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {campos.slice(0, 2).map(c => (
                    <th key={c.id} className="px-4 py-3 text-left">{c.nome}</th>
                  ))}
                  <th className="px-4 py-3 text-left">Últ. mov.</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(item => (
                  <>
                    <tr key={item.variacaoId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-b border-gray-100 dark:border-gray-700/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {item.temImagem ? (
                            <img loading="lazy" src={`/api/estoque/produtos/${item.variacaoId}/imagem`} alt=""
                              className="w-9 h-9 rounded-md object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-4 h-4 text-gray-300 dark:text-gray-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white">{item.produtoNome}</div>
                            {item.sku && <div className="text-xs text-gray-400">{item.sku}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{CANAL_LABEL[item.canal] || item.canal}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {item.tipo}{item.subOpcao ? ` · ${item.subOpcao}` : ''}
                        {item.isKit && <span className="ml-1 text-xs text-orange-500 font-medium">Kit</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">{fmtR(item.custoTotal)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 text-xs font-medium">{fmtR(item.precoVenda)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xl font-bold ${
                          item.saldoAtual === 0 ? 'text-red-500'
                          : item.estoqueMinimo > 0 && item.saldoAtual <= item.estoqueMinimo ? 'text-yellow-500'
                          : 'text-gray-900 dark:text-white'
                        }`}>{item.saldoAtual}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge saldo={item.saldoAtual} minimo={item.estoqueMinimo} />
                      </td>
                      {campos.slice(0, 2).map(c => (
                        <td key={c.id} className="px-4 py-3 text-gray-500 text-xs">
                          {item.camposValores?.[c.id] || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(item.ultimaMovimentacao)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setMovItem(item); setMovTipo('ENTRADA'); setMovQtd(''); setMovMotivo(''); setMovRef(''); setMovErro('') }}
                            className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors whitespace-nowrap">
                            + Mov.
                          </button>
                          <button onClick={() => abrirEditar(item)}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-orange-500 hover:border-orange-400 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => abrirHistorico(item)}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {campos.length > 2 && (
                            <button onClick={() => toggleExpandido(item.variacaoId)}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                              {expandidos.has(item.variacaoId) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandidos.has(item.variacaoId) && campos.length > 2 && (
                      <tr key={`${item.variacaoId}-extra`} className="bg-gray-50 dark:bg-gray-900/30">
                        <td colSpan={9 + Math.min(campos.length, 2)} className="px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {campos.slice(2).map(c => (
                              <div key={c.id}>
                                <p className="text-xs text-gray-400 mb-0.5">{c.nome}</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{item.camposValores?.[c.id] || '—'}</p>
                              </div>
                            ))}
                            <div>
                              <p className="text-xs text-gray-400 mb-0.5">Mínimo em estoque</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{item.estoqueMinimo || '—'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {moduloAtivo && itens.length > 0 && campos.length === 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <Link href="/config/campos-estoque" className="text-orange-500 underline hover:text-orange-400">
            Adicionar campos personalizados →
          </Link>
        </div>
      )}

      {/* Modal Adicionar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Adicionar produto ao Estoque</h2>
                <p className="text-xs text-gray-500 mt-0.5">Selecione os produtos de <strong>pronta entrega</strong></p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {loadingDisp ? (
                <div className="p-8 text-center text-gray-400">Carregando...</div>
              ) : disponiveis.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 mb-2">Todos os produtos já estão no estoque.</p>
                  <Link href="/precificacao/produtos" className="text-xs text-orange-500 underline flex items-center justify-center gap-1">
                    <LinkIcon className="w-3 h-3" />Cadastrar novos produtos na Precificação
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {disponiveis.map(v => (
                    <label key={v.variacaoId}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selecionados.has(v.variacaoId)
                          ? 'bg-orange-500/10 border border-orange-500/40'
                          : 'border border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}>
                      <input type="checkbox" className="accent-orange-500 w-4 h-4"
                        checked={selecionados.has(v.variacaoId)}
                        onChange={e => {
                          const s = new Set(selecionados)
                          e.target.checked ? s.add(v.variacaoId) : s.delete(v.variacaoId)
                          setSelecionados(s)
                        }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{v.produtoNome}</div>
                        <div className="text-xs text-gray-500">{CANAL_LABEL[v.canal] || v.canal} · {v.tipo}{v.subOpcao ? ` · ${v.subOpcao}` : ''}{v.sku ? ` · ${v.sku}` : ''}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-gray-400">Custo: {fmtR(v.custoTotal || 0)}</div>
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium">Preço: {fmtR(v.precoVenda || 0)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {disponiveis.length > 0 && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-gray-500">{selecionados.size > 0 ? `${selecionados.size} selecionado${selecionados.size > 1 ? 's' : ''}` : 'Nenhum selecionado'}</span>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                  <button onClick={handleAdicionarAoEstoque} disabled={selecionados.size === 0 || addLoading}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    {addLoading ? 'Adicionando...' : `Adicionar${selecionados.size > 0 ? ` (${selecionados.size})` : ''}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Movimentação */}
      {movItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Movimentar Estoque</h2>
                <p className="text-xs text-gray-500 mt-0.5">{movItem.produtoNome} · {CANAL_LABEL[movItem.canal] || movItem.canal}</p>
              </div>
              <button onClick={() => setMovItem(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Saldo atual</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{movItem.saldoAtual} <span className="text-sm font-normal text-gray-400">unid.</span></span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Tipo de movimentação</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'ENTRADA', label: '↑ Entrada', sel: 'bg-green-500/20 border-green-500 text-green-600 dark:text-green-400' },
                    { v: 'SAIDA',   label: '↓ Saída',   sel: 'bg-red-500/20 border-red-500 text-red-600 dark:text-red-400' },
                    { v: 'AJUSTE',  label: '✎ Ajuste',  sel: 'bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400' },
                  ] as const).map(opt => (
                    <button key={opt.v} onClick={() => { setMovTipo(opt.v); setMovErro('') }}
                      className={`py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        movTipo === opt.v ? opt.sel : 'border-gray-200 dark:border-gray-600 text-gray-500 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}>{opt.label}</button>
                  ))}
                </div>
                {movTipo === 'ENTRADA' && <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">Use ao concluir produção de pronta entrega.</p>}
                {movTipo === 'SAIDA'   && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">Use ao expedir pedido de pronta entrega.</p>}
                {movTipo === 'AJUSTE'  && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">Define o saldo absoluto — use para inventário físico.</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{movTipo === 'AJUSTE' ? 'Novo saldo total (unidades)' : 'Quantidade'}</label>
                <input type="number" min="1" className={inputClass} placeholder="Ex: 10"
                  value={movQtd} onChange={e => { setMovQtd(e.target.value); setMovErro('') }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Motivo <span className="text-gray-400">(opcional)</span></label>
                <input className={inputClass} placeholder={movTipo === 'ENTRADA' ? 'Ex: Produção lote 10un' : movTipo === 'SAIDA' ? 'Ex: Expedido pedido #123' : 'Ex: Inventário físico'}
                  value={movMotivo} onChange={e => setMovMotivo(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Referência <span className="text-gray-400">(opcional)</span></label>
                <input className={inputClass} placeholder="Ex: Pedido #1234, NF 456" value={movRef} onChange={e => setMovRef(e.target.value)} />
              </div>
              {previewSaldo !== null && (
                <div className={`rounded-lg px-4 py-2.5 flex items-center justify-between border ${
                  previewSaldo < 0 ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' : 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30'
                }`}>
                  <span className="text-xs text-gray-600 dark:text-orange-300">Saldo após movimentação</span>
                  <span className={`text-lg font-bold ${previewSaldo < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                    {previewSaldo} unid.{previewSaldo < 0 && ' ⚠'}
                  </span>
                </div>
              )}
              {movErro && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 rounded-lg">{movErro}</p>}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setMovItem(null)} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
              <button onClick={handleMovimentar} disabled={movLoading || !movQtd || parseInt(movQtd) <= 0}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {movLoading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-700 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Editar informações</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editItem.produtoNome} · {CANAL_LABEL[editItem.canal] || editItem.canal}</p>
              </div>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dados da Precificação (somente leitura)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-400">Produto</p><p className="text-sm text-gray-700 dark:text-gray-300">{editItem.produtoNome}</p></div>
                  <div><p className="text-xs text-gray-400">SKU</p><p className="text-sm text-gray-700 dark:text-gray-300">{editItem.sku || '—'}</p></div>
                  <div><p className="text-xs text-gray-400">Canal</p><p className="text-sm text-gray-700 dark:text-gray-300">{CANAL_LABEL[editItem.canal] || editItem.canal}</p></div>
                  <div><p className="text-xs text-gray-400">Variação</p><p className="text-sm text-gray-700 dark:text-gray-300">{editItem.tipo}{editItem.subOpcao ? ` · ${editItem.subOpcao}` : ''}</p></div>
                  <div><p className="text-xs text-gray-400">Custo total</p><p className="text-sm text-green-600 dark:text-green-400 font-medium">{fmtR(editItem.custoTotal)}</p></div>
                  <div><p className="text-xs text-gray-400">Preço de venda</p><p className="text-sm text-orange-500 font-medium">{fmtR(editItem.precoVenda)}</p></div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estoque mínimo (0 = sem alerta)</label>
                <input type="number" min="0" className={inputClass} placeholder="Ex: 5" value={editMinimo} onChange={e => setEditMinimo(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Imagem do produto <span className="text-gray-400">(ajuda a identificar a arte)</span></label>
                {(() => {
                  const src = editImagemAcao === 'nova' && editImagem
                    ? editImagem
                    : (editImagemAcao !== 'remover' && editItem.temImagem)
                      ? `/api/estoque/produtos/${editItem.variacaoId}/imagem`
                      : ''
                  if (src) return (
                    <div className="relative inline-block">
                      <img src={src} alt="Imagem do produto" className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                      <button type="button" onClick={removerImagem}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                  return (
                    <label className="flex flex-col items-center justify-center gap-1 w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-orange-400 text-gray-400 hover:text-orange-500 transition-colors">
                      {imgProcessando ? <span className="text-xs">Processando...</span> : (<>
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-[10px] text-center px-1">Anexar imagem</span>
                      </>)}
                      <input type="file" accept="image/*" className="hidden" onChange={handleSelecionarImagem} />
                    </label>
                  )
                })()}
                <p className="text-[10px] text-gray-400 mt-1">A imagem é otimizada automaticamente (máx. 400px).</p>
              </div>
              {campos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campos personalizados</p>
                  <div className="space-y-3">
                    {campos.map(c => (
                      <div key={c.id}>
                        <label className="block text-xs text-gray-500 mb-1">{c.nome}{c.obrigatorio && <span className="text-red-400 ml-1">*</span>}</label>
                        {c.tipo === 'BOOLEAN' ? (
                          <div className="flex items-center gap-3">
                            <button onClick={() => setEditCampos(prev => ({ ...prev, [c.id]: prev[c.id] === 'true' ? 'false' : 'true' }))}
                              className={`w-10 h-6 rounded-full transition-colors relative ${editCampos[c.id] === 'true' ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editCampos[c.id] === 'true' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{editCampos[c.id] === 'true' ? 'Sim' : 'Não'}</span>
                          </div>
                        ) : c.tipo === 'SELECT' ? (
                          <select className={inputClass} value={editCampos[c.id] || ''} onChange={e => setEditCampos(prev => ({ ...prev, [c.id]: e.target.value }))}>
                            <option value="">Selecione...</option>
                            {(() => { try { return JSON.parse(c.opcoes || '[]') } catch { return [] } })().map((op: string) => <option key={op} value={op}>{op}</option>)}
                          </select>
                        ) : (
                          <input type={c.tipo === 'NUMBER' ? 'number' : c.tipo === 'DATE' ? 'date' : 'text'}
                            className={inputClass} value={editCampos[c.id] || ''} onChange={e => setEditCampos(prev => ({ ...prev, [c.id]: e.target.value }))} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end flex-shrink-0">
              <button onClick={() => setEditItem(null)} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
              <button onClick={handleSalvarEditar} disabled={editLoading}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {editLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico */}
      {histItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Histórico de Movimentações</h2>
                <p className="text-xs text-gray-500 mt-0.5">{histItem.produtoNome} · {CANAL_LABEL[histItem.canal] || histItem.canal}</p>
              </div>
              <button onClick={() => { setHistItem(null); setHistMovs([]) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {histLoading ? (
                <div className="p-8 text-center text-gray-400">Carregando...</div>
              ) : histMovs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Nenhuma movimentação ainda.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                    <tr className="text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-center">Qtd</th>
                      <th className="px-4 py-3 text-center">Saldo</th>
                      <th className="px-4 py-3 text-left">Motivo</th>
                      <th className="px-4 py-3 text-left">Referência</th>
                      <th className="px-4 py-3 text-left">Usuária</th>
                      <th className="px-4 py-3 text-left">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histMovs.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700/40">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.tipo === 'ENTRADA' ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                            : m.tipo === 'SAIDA' ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          }`}>
                            {m.tipo === 'ENTRADA' ? '↑ Entrada' : m.tipo === 'SAIDA' ? '↓ Saída' : '✎ Ajuste'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">{m.quantidade}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{m.saldoApos}</td>
                        <td className="px-4 py-3 text-gray-500">{m.motivo || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{m.referencia || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{m.usuarioNome || '—'}</td>
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
