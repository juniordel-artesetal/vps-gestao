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

interface ItemOrcamento {
  _key: string
  variacaoId: string
  nomeProduto: string
  quantidade: number
  valorItem: number
  isKit: boolean
  qtdKitPecas: number
}
function novoItemOrc(nome = ''): ItemOrcamento {
  return { _key: Math.random().toString(36).slice(2), variacaoId: '', nomeProduto: nome, quantidade: 1, valorItem: 0, isKit: false, qtdKitPecas: 0 }
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
  itens?: Array<{
    id: string
    produto: string
    quantidade: number
    valorUnitario: number | null
    isKit: boolean
    qtdKitPecas: number
    ordem: number
    variacaoId?: string | null
  }>
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

  // Produtos do orçamento — igual ao modal de pedido
  const [itensOrc, setItensOrc] = useState<ItemOrcamento[]>([novoItemOrc()])
  const [variacoes, setVariacoes] = useState<any[]>([])
  const [variacoesLoading, setVariacoesLoading] = useState(false)

  const [modalDetalhe, setModalDetalhe] = useState<Orcamento | null>(null)
  const [aprovando, setAprovando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [linkGerado, setLinkGerado] = useState<{id:string; link:string} | null>(null)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [promoPopup, setPromoPopup] = useState<{ key: string; nomeProduto: string; precoVenda: number; precoPromo: number; variacaoId: string; isKit: boolean; qtdKitPecas: number } | null>(null)
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

  async function carregarVariacoes() {
    if (variacoes.length > 0) return
    setVariacoesLoading(true)
    try {
      const [resVar, resComb] = await Promise.all([
        fetch('/api/precificacao/variacoes').catch(() => null),
        fetch('/api/precificacao/combos').catch(() => null),
      ])
      const vars: any[] = []

      if (resVar?.ok) {
        const data = await resVar.json()
        const list: any[] = Array.isArray(data) ? data : (data.variacoes || [])
        list.forEach(v => vars.push(v))
      }

      if (resComb?.ok) {
        const data = await resComb.json()
        const combos: any[] = Array.isArray(data) ? data : (data.combos || [])
        combos.filter(c => c.ativo !== false).forEach(c => {
          vars.push({
            id: c.id,
            produtoNome: c.nome,
            nome: '🎁 Combo',
            canal: c.canal || 'Venda Direta',
            precoVenda: c.precoCombo,
            isKit: false,
            qtdKit: 0,
            _tipo: 'combo',
          })
        })
      }

      setVariacoes(vars)
    } finally { setVariacoesLoading(false) }
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setCamposSelecionados([])
    setCamposValores({})
    setItensOrc([novoItemOrc()])
    setModalForm(true)
    carregarCamposPedido()
    carregarVariacoes()
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
    carregarVariacoes()
    // Carregar itens reais do orçamento (se houver); senão fallback para 1 item com o produto antigo
    if (Array.isArray(o.itens) && o.itens.length > 0) {
      setItensOrc(o.itens.map(it => ({
        _key: Math.random().toString(36).slice(2),
        variacaoId: it.variacaoId || '',
        nomeProduto: it.produto,
        quantidade: it.quantidade,
        valorItem: it.valorUnitario ? Number(it.valorUnitario) : 0,
        isKit: !!it.isKit,
        qtdKitPecas: it.qtdKitPecas || 0,
      })))
    } else {
      setItensOrc([novoItemOrc(o.produto || '')])
    }
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
    const itensFilled = itensOrc.filter(i => i.nomeProduto.trim())
    if (!form.clienteNome || itensFilled.length === 0) return
    setSalvando(true)
    try {
      // Monta produto e totais a partir dos itens (igual lógica de pedidos)
      const produtoTexto = itensFilled.map(i => `${i.nomeProduto}${i.quantidade > 1 ? ` (${i.quantidade}x)` : ''}`).join(' + ')
      const qtdTotal = itensFilled.reduce((s, i) => s + (i.isKit && i.qtdKitPecas ? i.quantidade * i.qtdKitPecas : i.quantidade), 0)
      const valorTotal = itensFilled.some(i => i.valorItem > 0)
        ? itensFilled.reduce((s, i) => s + i.valorItem * i.quantidade, 0)
        : (form.valor ? parseFloat(form.valor) : null)
      const body = {
        ...form,
        produto: produtoTexto || form.produto,
        quantidade: qtdTotal || parseInt(form.quantidade) || 1,
        valor: valorTotal,
        dataValidade: form.dataValidade || null,
        dataEnvioEstimada: form.dataEnvioEstimada || null,
        politicasEmpresa: (form as any).politicasEmpresa || null,
        camposExtras: camposSelecionados.length > 0
          ? JSON.stringify({ camposSelecionados, camposValores })
          : undefined,
        itens: itensFilled.map(i => ({
          variacaoId: i.variacaoId,
          nomeProduto: i.nomeProduto,
          quantidade: i.quantidade,
          valorUnitario: i.valorItem,
          isKit: i.isKit,
          qtdKitPecas: i.qtdKitPecas,
        })),
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

              {/* Produtos — múltiplos, idêntico ao modal de pedidos */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Produto(s) *</label>
                  <button type="button"
                    onClick={() => setItensOrc(p => [...p, novoItemOrc()])}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
                    <Plus size={12} />Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {itensOrc.map((item, idx) => (
                    <div key={item._key} className="border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Produto {idx + 1}</span>
                        {itensOrc.length > 1 && (
                          <button type="button"
                            onClick={() => setItensOrc(p => p.filter(i => i._key !== item._key))}
                            className="text-xs text-red-400 hover:text-red-600">✕</button>
                        )}
                      </div>
                      {/* Select da precificação */}
                      <select
                        value={item.variacaoId}
                        className={inputClass + ' mb-2'}
                        onChange={e => {
                          const v = variacoes.find((x: any) => x.id === e.target.value)
                          const nomeProd = v ? (v.produtoNome || v.produto || '') : ''
                          const nomeVar  = v ? (v.nome || v.canal || '') : ''
                          const nomeProduto = v ? (nomeVar ? `${nomeProd} — ${nomeVar}` : nomeProd) : ''
                          const valorItem   = v ? parseFloat(String(v.precoVenda || 0)) : 0
                          const isKit       = v ? (v.isKit ?? false) : false
                          const qtdKitPecas = isKit ? Math.max(Number(v?.qtdKit) || 1, 1) : 0
                          setItensOrc(prev => prev.map(i => i._key === item._key
                            ? { ...i, variacaoId: e.target.value, nomeProduto, valorItem, isKit, qtdKitPecas }
                            : i))
                          // Popup de promoção
                          if (v?.emPromo && v?.precoPromocional) {
                            setPromoPopup({
                              key: item._key,
                              nomeProduto,
                              precoVenda: valorItem,
                              precoPromo: parseFloat(String(v.precoPromocional)),
                              variacaoId: e.target.value,
                              isKit,
                              qtdKitPecas,
                            })
                          }
                          setItensOrc(prev => prev.map(i => i._key === item._key
                            ? { ...i, variacaoId: e.target.value, nomeProduto, valorItem, isKit, qtdKitPecas }
                            : i))
                        }}>
                        <option value="">
                          {variacoesLoading ? 'Carregando...' : 'Selecionar da Precificação...'}
                        </option>
                        {variacoes.map((v: any) => {
                          const nomeProd = v.produtoNome || v.produto || ''
                          const nomeVar  = v.nome || v.canal || ''
                          const label    = nomeVar ? `${nomeProd} — ${nomeVar}` : nomeProd
                          return <option key={v.id} value={v.id}>{label}{v.emPromo ? ' 🏷️' : ''}</option>
                        })}
                      </select>
                      {/* Descrição manual */}
                      <input type="text"
                        value={item.nomeProduto}
                        className={inputClass + ' mb-2'}
                        placeholder="Ou descreva manualmente..."
                        required={idx === 0}
                        onChange={e => setItensOrc(prev => prev.map(i => i._key === item._key
                          ? { ...i, nomeProduto: e.target.value, variacaoId: '' }
                          : i))}
                      />
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex-1 min-w-24">
                          <label className="text-xs text-gray-500 block mb-1">{item.isKit ? 'Qtd. de SKUs' : 'Qtd.'}</label>
                          <input type="number" min="1"
                            value={item.quantidade}
                            className={inputClass}
                            onChange={e => setItensOrc(prev => prev.map(i => i._key === item._key
                              ? { ...i, quantidade: parseInt(e.target.value) || 1 }
                              : i))}
                          />
                        </div>
                        {item.isKit && item.qtdKitPecas > 0 && (
                          <div className="flex-1 min-w-24">
                            <label className="text-xs text-gray-500 block mb-1">Peças por kit</label>
                            <div className={inputClass + ' bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed'}>
                              {item.qtdKitPecas} <span className="text-xs text-gray-400">fixo</span>
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-24">
                          <label className="text-xs text-gray-500 block mb-1">{item.isKit ? 'Valor do kit (R$)' : 'Valor unit. (R$)'}</label>
                          <input type="number" step="0.01" min="0"
                            value={item.valorItem || ''}
                            className={inputClass}
                            placeholder="0,00"
                            onChange={e => setItensOrc(prev => prev.map(i => i._key === item._key
                              ? { ...i, valorItem: parseFloat(e.target.value) || 0 }
                              : i))}
                          />
                        </div>
                        {item.valorItem > 0 && item.quantidade > 1 && (
                          <div className="flex-shrink-0 flex items-end pb-2">
                            <span className="text-xs text-orange-500 font-semibold whitespace-nowrap">
                              = R$ {(item.valorItem * item.quantidade).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Total dos itens */}
                  {itensOrc.some(i => i.valorItem > 0) && (
                    <div className="flex justify-end mt-1">
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5 text-sm">
                        <span className="text-gray-500 text-xs">Total: </span>
                        <span className="font-bold text-orange-500">
                          R$ {itensOrc.reduce((acc, i) => acc + (i.valorItem * i.quantidade), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Canal + Valor manual (só mostra valor se não calculado pelos itens) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Canal</label>
                  <select className={inputClass} value={form.canal} onChange={e => setForm(p => ({ ...p, canal: e.target.value }))}>
                    <option value="">Selecionar...</option>
                    {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {itensOrc.some(i => i.valorItem > 0) ? 'Valor total (calculado)' : 'Valor (R$)'}
                  </label>
                  {itensOrc.some(i => i.valorItem > 0) ? (
                    <div className={inputClass + ' bg-gray-50 dark:bg-gray-800 text-orange-500 font-semibold cursor-not-allowed'}>
                      R$ {itensOrc.reduce((acc, i) => acc + (i.valorItem * i.quantidade), 0).toFixed(2)}
                    </div>
                  ) : (
                    <input type="number" step="0.01" min="0" className={inputClass} placeholder="0,00"
                      value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
                  )}
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
                              ) : campo.tipo === 'imagem' ? (
                                <div>
                                  {camposValores[campo.id] ? (
                                    <div className="flex items-center gap-3">
                                      <img src={camposValores[campo.id]} alt="preview"
                                        className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-gray-700" />
                                      <div className="flex flex-col gap-1">
                                        <span className="text-xs text-gray-500">Imagem anexada</span>
                                        <button type="button"
                                          className="text-xs text-red-500 hover:text-red-700 text-left"
                                          onClick={() => setCamposValores(p => { const n = {...p}; delete n[campo.id]; return n })}>
                                          Remover
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <label className="flex flex-col items-center justify-center gap-1.5 w-full py-4 px-3 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-colors">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                      </svg>
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Clique para anexar imagem</span>
                                      <span className="text-[10px] text-gray-400">PNG, JPG · máx. 1MB</span>
                                      <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden"
                                        onChange={e => {
                                          const file = e.target.files?.[0]
                                          if (!file || file.size > 1024 * 1024) return
                                          const reader = new FileReader()
                                          reader.onload = ev => {
                                            setCamposValores(p => ({...p, [campo.id]: ev.target?.result as string}))
                                          }
                                          reader.readAsDataURL(file)
                                        }} />
                                    </label>
                                  )}
                                </div>
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

      {/* ── POPUP PROMOÇÃO ── */}
      {promoPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-orange-500 px-5 py-4">
              <p className="text-white font-bold text-sm">🏷️ Produto em promoção!</p>
              <p className="text-orange-100 text-xs mt-0.5 truncate">{promoPopup.nomeProduto}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Qual preço deseja usar neste orçamento?</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setItensOrc(prev => prev.map(i => i._key === promoPopup.key
                      ? { ...i, valorItem: promoPopup.precoVenda }
                      : i))
                    setPromoPopup(null)
                  }}
                  className="w-full flex items-center justify-between border border-gray-200 hover:border-orange-300 hover:bg-orange-50 rounded-xl px-4 py-3 transition">
                  <span className="text-sm font-medium text-gray-700">Preço padrão</span>
                  <span className="text-sm font-bold text-gray-900">R$ {promoPopup.precoVenda.toFixed(2).replace('.', ',')}</span>
                </button>
                <button
                  onClick={() => {
                    setItensOrc(prev => prev.map(i => i._key === promoPopup.key
                      ? { ...i, valorItem: promoPopup.precoPromo }
                      : i))
                    setPromoPopup(null)
                  }}
                  className="w-full flex items-center justify-between bg-orange-500 hover:bg-orange-600 rounded-xl px-4 py-3 transition">
                  <span className="text-sm font-semibold text-white">🏷️ Preço promocional</span>
                  <span className="text-sm font-bold text-white">R$ {promoPopup.precoPromo.toFixed(2).replace('.', ',')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}