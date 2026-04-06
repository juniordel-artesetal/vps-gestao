'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  FileText, Plus, Check, X, Send, RotateCcw,
  Search, Trash2, Pencil, ExternalLink, ChevronRight,
  Package, Phone, Mail, Calendar, DollarSign, ShoppingBag,
  Link2, Share2, Printer, Copy,
} from 'lucide-react'
import Link from 'next/link'

interface CampoPedido {
  id: string; nome: string; tipo: string
  opcoes: string | null; placeholder: string | null
}

interface Orcamento {
  id: string
  numero: string
  clienteNome: string
  clienteEmail: string | null
  clienteWhatsapp: string | null
  canal: string | null
  produto: string
  quantidade: number
  valor: number | null
  dataValidade: string | null
  dataEnvioEstimada: string | null
  observacoes: string | null
  status: string
  pedidoId: string | null
  camposExtras: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  RASCUNHO: { label: 'Rascunho',  cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', icon: <FileText size={11} /> },
  ENVIADO:  { label: 'Enviado',   cls: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300', icon: <Send size={11} /> },
  APROVADO: { label: 'Aprovado',  cls: 'bg-green-50 dark:bg-green-500/20 text-green-600 dark:text-green-400', icon: <Check size={11} /> },
  RECUSADO: { label: 'Recusado',  cls: 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400', icon: <X size={11} /> },
}

const CANAIS = ['Shopee','Mercado Livre','Elo7','TikTok Shop','Amazon','Magalu','WhatsApp','Instagram','Direta']

const inputClass = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400'

function fmtData(s: string | null) {
  if (!s) return '—'
  if (s.length === 10 && s[4] === '-') return s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4)
  return s
}
function fmtR(n: number | null) {
  if (!n) return '—'
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.RASCUNHO
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

const FORM_VAZIO = {
  clienteNome: '', clienteEmail: '', clienteWhatsapp: '',
  canal: '', produto: '', quantidade: '1', valor: '',
  dataValidade: '', dataEnvioEstimada: '', observacoes: '',
}

export default function OrcamentosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const [modalForm, setModalForm] = useState(false)
  const [editando, setEditando] = useState<Orcamento | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  // Campos do pedido
  const [camposPedido, setCamposPedido] = useState<CampoPedido[]>([])
  const [camposSelecionados, setCamposSelecionados] = useState<CampoPedido[]>([])
  const [camposValores, setCamposValores] = useState<Record<string,string>>({})

  // Busca de produto
  const [produtoBusca, setProdutoBusca] = useState('')
  const [produtoResultados, setProdutoResultados] = useState<{label:string;valor:number|null;origem:string}[]>([])
  const [produtoBuscando, setProdutoBuscando] = useState(false)
  const [produtoAberto, setProdutoAberto] = useState(false)

  const [modalDetalhe, setModalDetalhe] = useState<Orcamento | null>(null)
  const [aprovando, setAprovando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [linkGerado, setLinkGerado] = useState<{id:string; link:string} | null>(null)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroStatus) params.set('status', filtroStatus)
      if (busca) params.set('busca', busca)
      const res = await fetch('/api/orcamentos?' + params)
      const data = await res.json()
      setOrcamentos(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [filtroStatus, busca])

  useEffect(() => { if (status === 'authenticated') carregar() }, [status, carregar])

  async function carregarCamposPedido() {
    if (camposPedido.length > 0) return
    const res = await fetch('/api/config/campos-pedido')
    const data = await res.json()
    setCamposPedido(data.campos || [])
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setCamposSelecionados([])
    setCamposValores({})
    setModalForm(true)
    carregarCamposPedido()
  }

  function abrirEditar(o: Orcamento) {
    setEditando(o)
    try {
      let raw: any = o.camposExtras
      if (typeof raw === 'string') raw = JSON.parse(raw)
      if (typeof raw === 'string') raw = JSON.parse(raw)
      const extras = raw || {}
      setCamposSelecionados(extras.camposSelecionados || [])
      setCamposValores(extras.camposValores || {})
    } catch { setCamposSelecionados([]); setCamposValores({}) }
    carregarCamposPedido()
    setForm({
      clienteNome: o.clienteNome,
      clienteEmail: o.clienteEmail || '',
      clienteWhatsapp: o.clienteWhatsapp || '',
      canal: o.canal || '',
      produto: o.produto,
      quantidade: String(o.quantidade),
      valor: o.valor ? String(o.valor) : '',
      dataValidade: o.dataValidade || '',
      dataEnvioEstimada: o.dataEnvioEstimada || '',
      observacoes: o.observacoes || '',
    })
    setModalForm(true)
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clienteNome || !form.produto) return
    setSalvando(true)
    try {
      const body = {
        ...form,
        quantidade: parseInt(form.quantidade) || 1,
        valor: form.valor ? parseFloat(form.valor) : null,
        dataValidade: form.dataValidade || null,
        dataEnvioEstimada: form.dataEnvioEstimada || null,
        politicasEmpresa: (form as any).politicasEmpresa || null,
        camposExtras: camposSelecionados.length > 0
          ? JSON.stringify({ camposSelecionados, camposValores })
          : undefined,
      }
      const url = editando ? `/api/orcamentos/${editando.id}` : '/api/orcamentos'
      const method = editando ? 'PUT' : 'POST'
      await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      setModalForm(false)
      carregar()
    } finally { setSalvando(false) }
  }

  async function buscarProdutos(q: string) {
    if (!q || q.length < 2) { setProdutoResultados([]); return }
    setProdutoBuscando(true)
    try {
      const [resPrec, resEst] = await Promise.all([
        fetch(`/api/precificacao/produtos?busca=${encodeURIComponent(q)}&limite=20`).catch(() => null),
        fetch('/api/estoque/produtos').catch(() => null),
      ])
      const resultados: {label:string;valor:number|null;origem:string}[] = []

      // Produtos da precificação
      if (resPrec?.ok) {
        const data = await resPrec.json()
        const prods = Array.isArray(data) ? data : (data.produtos || [])
        prods.forEach((p: any) => {
          if (p.nome?.toLowerCase().includes(q.toLowerCase())) {
            resultados.push({ label: p.nome, valor: p.precoVenda || null, origem: 'Precificação' })
          }
        })
      }

      // Produtos do estoque (pronta entrega)
      if (resEst?.ok) {
        const est = await resEst.json()
        const itens = Array.isArray(est) ? est : []
        itens.forEach((i: any) => {
          if (i.produtoNome?.toLowerCase().includes(q.toLowerCase())) {
            const label = i.produtoNome + (i.canal ? ` (${i.canal})` : '') + ` — Estoque: ${i.saldoAtual}`
            resultados.push({ label, valor: i.precoVenda || null, origem: 'Estoque' })
          }
        })
      }

      setProdutoResultados(resultados.slice(0, 10))
    } finally { setProdutoBuscando(false) }
  }

  function selecionarProduto(p: {label:string;valor:number|null;origem:string}) {
    setForm(prev => ({ ...prev, produto: p.label, valor: p.valor ? String(p.valor) : prev.valor }))
    setProdutoAberto(false)
    setProdutoBusca('')
    setProdutoResultados([])
  }

  async function mudarStatus(o: Orcamento, novoStatus: string) {
    await fetch(`/api/orcamentos/${o.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    })
    carregar()
    if (modalDetalhe?.id === o.id) setModalDetalhe({ ...modalDetalhe, status: novoStatus })
  }

  async function handleAprovar(o: Orcamento) {
    if (!confirm(`Aprovar orçamento e criar pedido para "${o.clienteNome}"?`)) return
    setAprovando(true)
    try {
      const res = await fetch(`/api/orcamentos/${o.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APROVADO' }),
      })
      const data = await res.json()
      if (data.pedidoId) {
        setSucesso(`✅ Pedido criado com sucesso!`)
        setTimeout(() => setSucesso(''), 4000)
      }
      setModalDetalhe(null)
      carregar()
    } finally { setAprovando(false) }
  }

  async function handleExcluir(o: Orcamento) {
    if (!confirm(`Excluir orçamento "${o.numero}"?`)) return
    await fetch(`/api/orcamentos/${o.id}`, { method: 'DELETE' })
    setModalDetalhe(null)
    carregar()
  }

  async function handleGerarLink(o: Orcamento) {
    setGerandoLink(true)
    try {
      const res = await fetch(`/api/orcamentos/${o.id}/gerar-link`, { method: 'POST' })
      const data = await res.json()
      if (data.link) setLinkGerado({ id: o.id, link: data.link })
    } finally { setGerandoLink(false) }
  }

  async function copiarLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const podeEditar = session?.user?.role !== 'OPERADOR'

  const stats = {
    total:    orcamentos.length,
    enviados: orcamentos.filter(o => o.status === 'ENVIADO').length,
    aprovados:orcamentos.filter(o => o.status === 'APROVADO').length,
    valor:    orcamentos.filter(o => o.status === 'APROVADO').reduce((a, o) => a + (o.valor || 0), 0),
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />Orçamentos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Crie orçamentos, aprove e converta em pedidos automaticamente</p>
        </div>
        {podeEditar && (
          <button onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus size={16} />Novo orçamento
          </button>
        )}
      </div>

      {sucesso && (
        <div className="mb-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {sucesso}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, cor: 'text-gray-900 dark:text-white' },
          { label: 'Aguardando', value: stats.enviados, cor: 'text-blue-500' },
          { label: 'Aprovados', value: stats.aprovados, cor: 'text-green-500' },
          { label: 'Valor aprovado', value: fmtR(stats.valor), cor: 'text-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
            <div className={`text-xl font-bold ${s.cor}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400"
            placeholder="Buscar cliente, produto, número..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['', 'RASCUNHO', 'ENVIADO', 'APROVADO', 'RECUSADO'].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                filtroStatus === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              {s === '' ? 'Todos' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : orcamentos.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Nenhum orçamento encontrado</p>
            {podeEditar && (
              <button onClick={abrirNovo}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">
                <Plus size={14} />Criar primeiro orçamento
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left">Nº / Cliente</th>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Canal</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Validade</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map(o => (
                <tr key={o.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{o.clienteNome}</div>
                    <div className="text-xs text-gray-400 font-mono">{o.numero}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{o.produto}</div>
                    <div className="text-xs text-gray-400">Qtd: {o.quantidade}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{o.canal || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{fmtR(o.valor)}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {o.dataValidade ? (
                      <span className={new Date(o.dataValidade) < new Date() && o.status === 'ENVIADO' ? 'text-red-500 font-medium' : ''}>
                        {fmtData(o.dataValidade)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Ações rápidas por status */}
                      {podeEditar && o.status === 'RASCUNHO' && (
                        <button onClick={() => mudarStatus(o, 'ENVIADO')} title="Marcar como enviado"
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                          <Send size={14} />
                        </button>
                      )}
                      {podeEditar && o.status === 'ENVIADO' && (
                        <>
                          <button onClick={() => handleAprovar(o)} title="Aprovar e criar pedido"
                            className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors">
                            <Check size={14} />
                          </button>
                          <button onClick={() => mudarStatus(o, 'RECUSADO')} title="Marcar como recusado"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {podeEditar && o.status === 'RECUSADO' && (
                        <button onClick={() => mudarStatus(o, 'RASCUNHO')} title="Reabrir"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {podeEditar && o.status !== 'APROVADO' && o.status !== 'RECUSADO' && (
                        <button onClick={() => handleGerarLink(o)} title="Gerar link de aprovação"
                          className="p-1.5 rounded-lg text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors">
                          <Share2 size={14} />
                        </button>
                      )}
                      {o.pedidoId && (
                        <Link href={`/dashboard/pedidos/${o.pedidoId}`} title="Ver pedido"
                          className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                          <ExternalLink size={14} />
                        </Link>
                      )}
                      <button onClick={() => setModalDetalhe(o)} title="Ver detalhes"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <ChevronRight size={14} />
                      </button>
                      {podeEditar && o.status !== 'APROVADO' && (
                        <button onClick={() => abrirEditar(o)} title="Editar"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal Criar/Editar ── */}
      {modalForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {editando ? 'Editar orçamento' : 'Novo orçamento'}
              </h2>
              <button onClick={() => setModalForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSalvar} className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
              {/* Cliente */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome do cliente *</label>
                  <input className={inputClass} placeholder="Ex: Maria Silva" required
                    value={form.clienteNome} onChange={e => setForm(p => ({ ...p, clienteNome: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">WhatsApp</label>
                  <input className={inputClass} placeholder="(11) 99999-0000"
                    value={form.clienteWhatsapp} onChange={e => setForm(p => ({ ...p, clienteWhatsapp: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">E-mail</label>
                  <input type="email" className={inputClass} placeholder="cliente@email.com"
                    value={form.clienteEmail} onChange={e => setForm(p => ({ ...p, clienteEmail: e.target.value }))} />
                </div>
              </div>

              {/* Produto — busca em precificação + estoque */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Produto / Serviço *</label>
                <input className={inputClass} placeholder="Digite para buscar ou descreva livremente" required
                  value={form.produto}
                  onChange={e => {
                    setForm(p => ({ ...p, produto: e.target.value }))
                    setProdutoBusca(e.target.value)
                    setProdutoAberto(true)
                    buscarProdutos(e.target.value)
                  }}
                  onFocus={() => { if (form.produto.length >= 2) { setProdutoAberto(true); buscarProdutos(form.produto) } }}
                  onBlur={() => setTimeout(() => setProdutoAberto(false), 150)}
                />
                {/* Dropdown de resultados */}
                {produtoAberto && (produtoBuscando || produtoResultados.length > 0) && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                    {produtoBuscando ? (
                      <div className="px-3 py-2 text-xs text-gray-400">Buscando...</div>
                    ) : (
                      produtoResultados.map((p, i) => (
                        <button key={i} type="button"
                          onMouseDown={() => selecionarProduto(p)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div>
                            <div className="text-sm text-gray-900 dark:text-white truncate">{p.label}</div>
                            <div className={`text-[10px] font-medium ${p.origem === 'Estoque' ? 'text-blue-500' : 'text-orange-500'}`}>{p.origem}</div>
                          </div>
                          {p.valor && (
                            <div className="text-xs text-orange-500 font-semibold flex-shrink-0 ml-2">
                              R$ {p.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Busca em Precificação e Estoque. Ou descreva livremente.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantidade</label>
                  <input type="number" min="1" className={inputClass}
                    value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" min="0" className={inputClass} placeholder="0,00"
                    value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Canal</label>
                  <select className={inputClass} value={form.canal} onChange={e => setForm(p => ({ ...p, canal: e.target.value }))}>
                    <option value="">Selecionar...</option>
                    {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Validade do orçamento</label>
                  <input type="date" className={inputClass}
                    value={form.dataValidade} onChange={e => setForm(p => ({ ...p, dataValidade: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Previsão de envio</label>
                  <input type="date" className={inputClass}
                    value={form.dataEnvioEstimada} onChange={e => setForm(p => ({ ...p, dataEnvioEstimada: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Observações</label>
                <textarea className={inputClass} rows={2} placeholder="Detalhes adicionais, condições, etc."
                  value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Políticas da empresa <span className="text-gray-400 font-normal">(aparece no PDF)</span></label>
                <textarea className={inputClass} rows={3}
                  placeholder="Ex: Prazo de produção: 7 dias úteis. Pagamento: 50% na aprovação, 50% na entrega. Sem trocas após aprovação do arte."
                  value={(form as any).politicasEmpresa || ''}
                  onChange={e => setForm(p => ({ ...p, politicasEmpresa: e.target.value } as any))} />
              </div>

              {/* Campos do pedido — artesã seleciona e já preenche os valores */}
              {camposPedido.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Campos do pedido
                    <span className="text-gray-400 font-normal ml-1">(valores já entram preenchidos no pedido ao aprovar)</span>
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    {camposPedido.map((campo, i) => {
                      const sel = camposSelecionados.some(c => c.id === campo.id)
                      return (
                        <div key={campo.id}
                          className={`px-3 py-2.5 ${
                            i < camposPedido.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                          } ${sel ? 'bg-orange-50 dark:bg-orange-500/10' : ''}`}>
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input type="checkbox" className="accent-orange-500 flex-shrink-0"
                              checked={sel}
                              onChange={e => {
                                if (e.target.checked) setCamposSelecionados(prev => [...prev, campo])
                                else {
                                  setCamposSelecionados(prev => prev.filter(c => c.id !== campo.id))
                                  setCamposValores(prev => { const n = {...prev}; delete n[campo.id]; return n })
                                }
                              }}
                            />
                            <span className="text-sm text-gray-800 dark:text-white">{campo.nome}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              campo.tipo === 'lista' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                              campo.tipo === 'data'  ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' :
                              campo.tipo === 'checkbox' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-500'
                            }`}>{campo.tipo}</span>
                          </label>
                          {sel && (
                            <div className="mt-2 pl-7">
                              {campo.tipo === 'lista' ? (
                                <select className={inputClass}
                                  value={camposValores[campo.id] || ''}
                                  onChange={e => setCamposValores(p => ({...p, [campo.id]: e.target.value}))}>
                                  <option value="">Selecione...</option>
                                  {(() => { try { return JSON.parse(campo.opcoes || '[]') } catch { return [] } })().map((op: string) => (
                                    <option key={op} value={op}>{op}</option>
                                  ))}
                                </select>
                              ) : campo.tipo === 'checkbox' ? (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="accent-orange-500"
                                    checked={camposValores[campo.id] === 'true'}
                                    onChange={e => setCamposValores(p => ({...p, [campo.id]: e.target.checked ? 'true' : 'false'}))}
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Sim</span>
                                </label>
                              ) : campo.tipo === 'data' ? (
                                <input type="date" className={inputClass}
                                  value={camposValores[campo.id] || ''}
                                  onChange={e => setCamposValores(p => ({...p, [campo.id]: e.target.value}))}
                                />
                              ) : (
                                <input type="text" className={inputClass}
                                  placeholder={campo.placeholder || ('Valor de ' + campo.nome)}
                                  value={camposValores[campo.id] || ''}
                                  onChange={e => setCamposValores(p => ({...p, [campo.id]: e.target.value}))}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {camposSelecionados.length > 0 && (
                    <p className="text-[10px] text-orange-500 mt-1">
                      ✓ {camposSelecionados.length} campo{camposSelecionados.length > 1 ? 's' : ''} — valores já entram preenchidos no pedido
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalForm(false)}
                  className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                  {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Detalhe ── */}
      {modalDetalhe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setModalDetalhe(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900 dark:text-white">{modalDetalhe.clienteNome}</h2>
                  <StatusBadge status={modalDetalhe.status} />
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{modalDetalhe.numero}</p>
              </div>
              <button onClick={() => setModalDetalhe(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Package size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-gray-400">Produto</div>
                    <div className="text-sm text-gray-900 dark:text-white font-medium">{modalDetalhe.produto}</div>
                    <div className="text-xs text-gray-400">Qtd: {modalDetalhe.quantidade}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-gray-400">Valor</div>
                    <div className="text-sm text-orange-500 font-bold">{fmtR(modalDetalhe.valor)}</div>
                  </div>
                </div>
                {modalDetalhe.clienteWhatsapp && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400">WhatsApp</div>
                      <a href={`https://wa.me/55${modalDetalhe.clienteWhatsapp.replace(/\D/g,'')}`}
                        target="_blank" rel="noreferrer"
                        className="text-sm text-green-500 hover:underline">{modalDetalhe.clienteWhatsapp}</a>
                    </div>
                  </div>
                )}
                {modalDetalhe.clienteEmail && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400">E-mail</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">{modalDetalhe.clienteEmail}</div>
                    </div>
                  </div>
                )}
                {modalDetalhe.canal && (
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400">Canal</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">{modalDetalhe.canal}</div>
                    </div>
                  </div>
                )}
                {modalDetalhe.dataValidade && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400">Validade</div>
                      <div className={`text-sm font-medium ${
                        new Date(modalDetalhe.dataValidade) < new Date() && modalDetalhe.status === 'ENVIADO'
                          ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'
                      }`}>{fmtData(modalDetalhe.dataValidade)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Campos preenchidos */}
              {(() => {
                try {
                  let raw: any = modalDetalhe.camposExtras
                  if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch {} }
                  if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch {} }
                  const extras = raw || {}
                  const campos: CampoPedido[] = extras.camposSelecionados || []
                  const valores: Record<string,string> = extras.camposValores || {}
                  if (campos.length === 0) return null
                  return (
                    <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl p-3">
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">📋 Campos do pedido:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {campos.map(campo => (
                          <div key={campo.id}>
                            <p className="text-[10px] text-gray-400">{campo.nome}</p>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{valores[campo.id] || '—'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                } catch { return null }
              })()}

              {modalDetalhe.observacoes && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">Observações</div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{modalDetalhe.observacoes}</p>
                </div>
              )}

              {/* Pedido especial enviado pela cliente */}
              {modalDetalhe.observacoes && modalDetalhe.observacoes.includes('🎀') && (
                <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">🎀 Pedido especial da cliente:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {modalDetalhe.observacoes.replace('🎀 Pedido especial: ', '')}
                  </p>
                </div>
              )}

              {modalDetalhe.pedidoId && (
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-xl px-4 py-3">
                  <Check size={16} className="text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-700 dark:text-green-400">Pedido criado com sucesso</div>
                    <div className="text-xs text-green-600 dark:text-green-500">Este orçamento foi convertido em pedido</div>
                  </div>
                  <Link href={`/dashboard/pedidos/${modalDetalhe.pedidoId}`}
                    className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 font-medium">
                    Ver pedido <ExternalLink size={12} />
                  </Link>
                </div>
              )}

              {podeEditar && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {modalDetalhe.status === 'RASCUNHO' && (
                    <button onClick={() => { mudarStatus(modalDetalhe, 'ENVIADO'); setModalDetalhe({...modalDetalhe, status:'ENVIADO'}) }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors">
                      <Send size={14} />Marcar como enviado
                    </button>
                  )}
                  {modalDetalhe.status === 'ENVIADO' && (
                    <>
                      <button onClick={() => handleAprovar(modalDetalhe)} disabled={aprovando}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors">
                        <Check size={14} />{aprovando ? 'Criando pedido...' : 'Aprovar → Criar pedido'}
                      </button>
                      <button onClick={() => { mudarStatus(modalDetalhe, 'RECUSADO'); setModalDetalhe({...modalDetalhe, status:'RECUSADO'}) }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <X size={14} />Recusar
                      </button>
                    </>
                  )}
                  {/* Gerar link e PDF */}
                  {modalDetalhe.status !== 'RECUSADO' && (
                    <>
                      <button onClick={() => handleGerarLink(modalDetalhe)} disabled={gerandoLink}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500 text-white text-sm hover:bg-purple-600 disabled:opacity-50 transition-colors">
                        <Share2 size={14} />{gerandoLink ? 'Gerando...' : 'Gerar link'}
                      </button>
                      <a href={`/orcamento/${modalDetalhe.id}`} target="_blank"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Printer size={14} />Visualizar / PDF
                      </a>
                    </>
                  )}
                  {modalDetalhe.status !== 'APROVADO' && (
                    <>
                      <button onClick={() => { abrirEditar(modalDetalhe); setModalDetalhe(null) }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Pencil size={14} />Editar
                      </button>
                      <button onClick={() => handleExcluir(modalDetalhe)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/50 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ml-auto">
                        <Trash2 size={14} />Excluir
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de link gerado */}
      {linkGerado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setLinkGerado(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-lg shadow-2xl p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <Link2 size={18} className="text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Link de aprovação gerado!</h3>
                <p className="text-xs text-gray-500">Envie este link para a cliente aprovar o orçamento</p>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <input readOnly value={linkGerado.link}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono"
              />
              <button onClick={() => copiarLink(linkGerado.link)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  copiado ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}>
                {copiado ? <><Check size={14} />Copiado!</> : <><Copy size={14} />Copiar</>}
              </button>
            </div>
            <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-purple-700 dark:text-purple-300">
                💡 A cliente abre este link, vê o orçamento completo e pode aprovar com um clique. Você recebe um e-mail de confirmação.
              </p>
            </div>
            <div className="flex gap-3">
              <a href={linkGerado.link} target="_blank"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                <ExternalLink size={14} />Visualizar
              </a>
              <button onClick={() => setLinkGerado(null)}
                className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}