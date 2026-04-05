'use client'
// ══════════════════════════════════════════════════════════════
// Destino: app/precificacao/fornecedores/page.tsx
// Função : CRUD de fornecedores + histórico de compras por fornecedor
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus, Search, Star, Mail, MessageCircle, Building2,
  Edit2, Trash2, History, X, ChevronDown, ChevronUp,
  ShoppingCart, TrendingUp, Users, AlertCircle,
} from 'lucide-react'

interface Fornecedor {
  id: string
  nome: string
  contato: string | null
  email: string | null
  whatsapp: string | null
  cnpjCpf: string | null
  categorias: string
  observacoes: string | null
  avaliacao: number
  ativo: boolean
  totalCompras: number
  qtdCompras: number
  ultimaCompra: string | null
}

interface Compra {
  id: string
  fornecedorId: string
  descricao: string
  valor: number
  data: string
  nf: string | null
  observacoes: string | null
  createdAt: string
}

const CATS = [
  'Tecidos','Linhas','Fitas','Laços','Botões','Embalagens',
  'Tintas','Cola','Papel','Enfeites','Bijuterias','Miçangas',
  'Resina','Madeira','Outros',
]

const ic = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 dark:text-white'

function R(n: number) {
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function dt(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}
function parseCats(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star
          key={n}
          className={`w-4 h-4 transition-colors ${n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'} ${onChange ? 'cursor-pointer hover:text-yellow-300' : ''}`}
          onClick={() => onChange?.(n)}
        />
      ))}
    </div>
  )
}

function ModalFornecedor({ item, onClose, onSave }: { item: Partial<Fornecedor> | null; onClose: () => void; onSave: () => void }) {
  const isEdit = !!item?.id
  const [f, setF] = useState({
    nome:        item?.nome        || '',
    contato:     item?.contato     || '',
    email:       item?.email       || '',
    whatsapp:    item?.whatsapp    || '',
    cnpjCpf:     item?.cnpjCpf    || '',
    observacoes: item?.observacoes || '',
    avaliacao:   item?.avaliacao   ?? 5,
    ativo:       item?.ativo       !== false,
    cats:        parseCats(item?.categorias || '[]'),
  })
  const [saving, setSaving] = useState(false)
  const [erro,   setErro]   = useState('')

  const toggleCat = (c: string) =>
    setF(p => ({ ...p, cats: p.cats.includes(c) ? p.cats.filter(x => x !== c) : [...p.cats, c] }))

  async function save() {
    if (!f.nome.trim()) { setErro('Nome é obrigatório'); return }
    setSaving(true); setErro('')
    try {
      const url    = isEdit ? `/api/fornecedores/${item!.id}` : '/api/fornecedores'
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, categorias: f.cats }),
      })
      if (!res.ok) { setErro((await res.json()).error || 'Erro ao salvar'); return }
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
          <h2 className="font-semibold text-gray-800 dark:text-white">{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          {erro && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{erro}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Nome *</label>
            <input className={ic} value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do fornecedor" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Contato (pessoa)</label>
              <input className={ic} value={f.contato} onChange={e => setF(p => ({ ...p, contato: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">WhatsApp</label>
              <input className={ic} value={f.whatsapp} onChange={e => setF(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">E-mail</label>
              <input className={ic} type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">CNPJ / CPF</label>
              <input className={ic} value={f.cnpjCpf} onChange={e => setF(p => ({ ...p, cnpjCpf: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">O que fornece</label>
            <div className="flex flex-wrap gap-2">
              {CATS.map(c => (
                <button key={c} type="button" onClick={() => toggleCat(c)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    f.cats.includes(c) ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Avaliação</label>
            <Stars value={f.avaliacao} onChange={v => setF(p => ({ ...p, avaliacao: v }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Observações</label>
            <textarea className={ic} rows={2} value={f.observacoes} onChange={e => setF(p => ({ ...p, observacoes: e.target.value }))} placeholder="Notas internas sobre este fornecedor" />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={f.ativo} onChange={e => setF(p => ({ ...p, ativo: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Fornecedor ativo</span>
            </label>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar fornecedor'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalCompras({ fornecedor, onClose, onUpdate }: { fornecedor: Fornecedor; onClose: () => void; onUpdate: () => void }) {
  const [compras,  setCompras]  = useState<Compra[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Compra | null>(null)
  const [form, setForm] = useState({ descricao: '', valor: '', data: new Date().toISOString().slice(0,10), nf: '', observacoes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/fornecedores/${fornecedor.id}/compras`)
      if (r.ok) setCompras(await r.json())
    } finally { setLoading(false) }
  }, [fornecedor.id])

  useEffect(() => { load() }, [load])

  function abrirNova() {
    setEditando(null)
    setForm({ descricao: '', valor: '', data: new Date().toISOString().slice(0,10), nf: '', observacoes: '' })
    setShowForm(true)
  }
  function abrirEditar(c: Compra) {
    setEditando(c)
    setForm({ descricao: c.descricao, valor: String(c.valor), data: c.data.slice(0,10), nf: c.nf || '', observacoes: c.observacoes || '' })
    setShowForm(true)
  }

  async function salvar() {
    if (!form.descricao || !form.valor || !form.data) return
    setSaving(true)
    try {
      const url    = editando ? `/api/fornecedores/${fornecedor.id}/compras/${editando.id}` : `/api/fornecedores/${fornecedor.id}/compras`
      const method = editando ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { setShowForm(false); await load(); onUpdate() }
    } finally { setSaving(false) }
  }

  async function excluir(id: string) {
    if (!confirm('Remover esta compra?')) return
    await fetch(`/api/fornecedores/${fornecedor.id}/compras/${id}`, { method: 'DELETE' })
    await load(); onUpdate()
  }

  const total = compras.reduce((s, c) => s + Number(c.valor), 0)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">{fornecedor.nome}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {compras.length} compra{compras.length !== 1 ? 's' : ''} · Total: <span className="font-semibold text-orange-600">{R(total)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={abrirNova} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600">
              <Plus className="w-3.5 h-3.5" />Registrar compra
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
        </div>
        {showForm && (
          <div className="p-5 bg-orange-50 dark:bg-orange-900/10 border-b dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{editando ? 'Editar compra' : 'Nova compra'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input className={ic} placeholder="Descrição — ex: 200m fita cetim branca" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
              </div>
              <input className={ic} type="number" step="0.01" placeholder="Valor (R$)" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
              <input className={ic} type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              <input className={ic} placeholder="Nº NF (opcional)" value={form.nf} onChange={e => setForm(p => ({ ...p, nf: e.target.value }))} />
              <input className={ic} placeholder="Observações (opcional)" value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg">Cancelar</button>
              <button onClick={salvar} disabled={saving} className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
        <div className="p-5">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-8">Carregando...</p>
          ) : compras.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nenhuma compra registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {compras.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{c.descricao}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {dt(c.data)}
                      {c.nf && <span className="ml-2">· NF {c.nf}</span>}
                      {c.observacoes && <span className="ml-2 italic">· {c.observacoes}</span>}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-orange-600 flex-shrink-0">{R(Number(c.valor))}</span>
                  <button onClick={() => abrirEditar(c)} className="text-gray-300 hover:text-blue-500"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => excluir(c.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FornecedoresPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEdit = session?.user?.role !== 'OPERADOR'

  const [lista,        setLista]        = useState<Fornecedor[]>([])
  const [loading,      setLoading]      = useState(true)
  const [busca,        setBusca]        = useState('')
  const [filtro,       setFiltro]       = useState<'ativos'|'inativos'|'todos'>('ativos')
  const [ordem,        setOrdem]        = useState<'nome'|'gasto'|'stars'>('nome')
  const [modalForm,    setModalForm]    = useState<Partial<Fornecedor>|null|false>(false)
  const [modalCompras, setModalCompras] = useState<Fornecedor|null>(null)
  const [deletando,    setDeletando]    = useState<Fornecedor|null>(null)
  const [expandido,    setExpandido]    = useState<string|null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (busca)              p.set('busca', busca)
      if (filtro !== 'todos') p.set('ativo', filtro === 'ativos' ? 'true' : 'false')
      const r = await fetch('/api/fornecedores?' + p)
      if (r.ok) setLista(await r.json())
    } finally { setLoading(false) }
  }, [busca, filtro])

  useEffect(() => { carregar() }, [carregar])

  async function deletar() {
    if (!deletando) return
    await fetch(`/api/fornecedores/${deletando.id}`, { method: 'DELETE' })
    setDeletando(null); carregar()
  }

  const sorted = [...lista].sort((a, b) => {
    if (ordem === 'nome')  return a.nome.localeCompare(b.nome)
    if (ordem === 'gasto') return Number(b.totalCompras) - Number(a.totalCompras)
    if (ordem === 'stars') return b.avaliacao - a.avaliacao
    return 0
  })

  const ativos     = lista.filter(f => f.ativo).length
  const totalGasto = lista.reduce((s, f) => s + Number(f.totalCompras), 0)
  const maiorForn  = [...lista].sort((a,b) => Number(b.totalCompras) - Number(a.totalCompras))[0]
  const totalCompras = lista.reduce((s, f) => s + Number(f.qtdCompras), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fornecedores</h1>
            <p className="text-sm text-gray-500 mt-0.5">Cadastro e histórico de compras por fornecedor</p>
          </div>
          {canEdit && (
            <button onClick={() => setModalForm({})} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 shadow-sm">
              <Plus className="w-4 h-4" />Novo Fornecedor
            </button>
          )}
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Ativos',           value: ativos,               icon: Users        },
            { label: 'Total em compras', value: R(totalGasto),        icon: TrendingUp   },
            { label: 'Maior fornecedor', value: maiorForn?.nome||'—', icon: Building2    },
            { label: 'Total de pedidos', value: totalCompras,         icon: ShoppingCart },
          ].map((card, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <card.icon className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className={ic + ' pl-9'} placeholder="Buscar por nome, contato, e-mail..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select className={ic + ' w-auto'} value={filtro} onChange={e => setFiltro(e.target.value as any)}>
            <option value="ativos">Somente ativos</option>
            <option value="todos">Todos</option>
            <option value="inativos">Somente inativos</option>
          </select>
          <select className={ic + ' w-auto'} value={ordem} onChange={e => setOrdem(e.target.value as any)}>
            <option value="nome">Ordenar: A–Z</option>
            <option value="gasto">Ordenar: Maior gasto</option>
            <option value="stars">Ordenar: Avaliação</option>
          </select>
        </div>

        {/* Lista */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-12">Carregando...</p>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">
                {busca ? 'Nenhum resultado para essa busca' : 'Nenhum fornecedor cadastrado'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map(forn => {
                const cats = parseCats(forn.categorias)
                const open = expandido === forn.id
                return (
                  <div key={forn.id}>
                    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-600 dark:text-orange-400 font-bold text-sm">{forn.nome.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-white">{forn.nome}</span>
                          {!forn.ativo && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">inativo</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                          {forn.contato && <span>{forn.contato}</span>}
                          {forn.whatsapp && (
                            <a href={`https://wa.me/${forn.whatsapp.replace(/\D/g,'')}`} target="_blank" className="flex items-center gap-1 text-green-600 hover:underline">
                              <MessageCircle className="w-3 h-3" />{forn.whatsapp}
                            </a>
                          )}
                          {forn.email && (
                            <a href={`mailto:${forn.email}`} className="flex items-center gap-1 text-blue-500 hover:underline">
                              <Mail className="w-3 h-3" />{forn.email}
                            </a>
                          )}
                        </div>
                        {cats.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {cats.map(c => (
                              <span key={c} className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{R(Number(forn.totalCompras))}</span>
                        <span className="text-xs text-gray-400">{forn.qtdCompras} compra{forn.qtdCompras !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="hidden md:block flex-shrink-0">
                        <Stars value={forn.avaliacao} />
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setModalCompras(forn)} title="Compras" className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg">
                          <History className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button onClick={() => setModalForm(forn)} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => setDeletando(forn)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setExpandido(open ? null : forn.id)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg">
                          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 text-sm space-y-1">
                        {forn.cnpjCpf     && <p><span className="text-gray-400">CNPJ/CPF: </span><span className="text-gray-700 dark:text-gray-300">{forn.cnpjCpf}</span></p>}
                        {forn.ultimaCompra && <p><span className="text-gray-400">Última compra: </span><span className="text-gray-700 dark:text-gray-300">{dt(forn.ultimaCompra)}</span></p>}
                        {forn.observacoes  && <p><span className="text-gray-400">Obs: </span><span className="text-gray-700 dark:text-gray-300">{forn.observacoes}</span></p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modalForm !== false && (
        <ModalFornecedor item={modalForm} onClose={() => setModalForm(false)} onSave={() => { setModalForm(false); carregar() }} />
      )}
      {modalCompras && (
        <ModalCompras fornecedor={modalCompras} onClose={() => setModalCompras(null)} onUpdate={carregar} />
      )}
      {deletando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Excluir fornecedor?</h3>
            <p className="text-sm text-gray-500 mb-4"><strong>{deletando.nome}</strong> e todo o histórico de compras serão removidos permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletando(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300">Cancelar</button>
              <button onClick={deletar} className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
