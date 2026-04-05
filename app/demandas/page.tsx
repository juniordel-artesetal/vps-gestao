'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus, Users, Settings2, RefreshCw, Search, ChevronDown,
  Pencil, X, CheckCircle, Clock, AlertCircle, DollarSign,
  Filter, CreditCard
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Demanda {
  id: string; pedidoId: string | null; pedidoRef: string | null
  freelancerId: string; freelancerNome: string
  nomeProduto: string | null
  qtdSolicitada: number; qtdProduzida: number
  valorPorItem: number; valorTotal: number
  status: string; observacoes: string | null
  dataPagamento: string | null; lancamentoId: string | null
  createdAt: string
}
interface Freelancer { id: string; nome: string; especialidade: string | null }
interface Categoria  { id: string; nome: string; tipo: string; icone: string | null }

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  PENDENTE:      { label: 'Pendente',      cls: 'bg-gray-700 text-gray-300',         icon: Clock },
  EM_PRODUCAO:   { label: 'Em produção',   cls: 'bg-blue-900/50 text-blue-300',      icon: AlertCircle },
  PRODUZIDO:     { label: 'Produzido',     cls: 'bg-yellow-900/50 text-yellow-300',  icon: CheckCircle },
  PAGO:          { label: 'Pago',          cls: 'bg-green-900/50 text-green-400',    icon: CheckCircle },
}

const ic = 'w-full border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-800 text-white'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function DemandasPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [demandas,     setDemandas]     = useState<Demanda[]>([])
  const [freelancers,  setFreelancers]  = useState<Freelancer[]>([])
  const [categorias,   setCategorias]   = useState<Categoria[]>([])
  const [loading,      setLoading]      = useState(true)
  const [busca,        setBusca]        = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFre,    setFiltroFre]    = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [acaoMassa,    setAcaoMassa]    = useState('')
  const [msg,          setMsg]          = useState('')

  // Modais
  const [modalForm,    setModalForm]    = useState(false)
  const [modalPagar,   setModalPagar]   = useState(false)
  const [editando,     setEditando]     = useState<Demanda | null>(null)
  const [pagandoIds,   setPagandoIds]   = useState<string[]>([])

  // Form nova/editar demanda
  const [form, setForm] = useState({
    freelancerId: '', nomeProduto: '', qtdSolicitada: '', valorPorItem: '', pedidoId: '', observacoes: ''
  })

  // Form pagamento
  const [formPag, setFormPag] = useState({ categoriaId: '', valorPago: '' })

  const feedback = (txt: string) => { setMsg(txt); setTimeout(() => setMsg(''), 3500) }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, fRes, cRes] = await Promise.all([
        fetch('/api/demandas').then(r => r.json()),
        fetch('/api/config/freelancers').then(r => r.json()).catch(() => []),
        fetch('/api/financeiro/categorias').then(r => r.json()).catch(() => []),
      ])
      setDemandas(Array.isArray(dRes) ? dRes : [])
      setFreelancers(Array.isArray(fRes) ? fRes : [])
      setCategorias((Array.isArray(cRes) ? cRes : []).filter((c: Categoria) => c.tipo === 'DESPESA'))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Filtros e stats ────────────────────────────────────────────────────────
  const filtradas = demandas.filter(d => {
    if (filtroStatus && d.status !== filtroStatus) return false
    if (filtroFre    && d.freelancerId !== filtroFre) return false
    if (busca) {
      const b = busca.toLowerCase()
      if (!(d.freelancerNome?.toLowerCase().includes(b) ||
            d.nomeProduto?.toLowerCase().includes(b) ||
            d.pedidoRef?.toLowerCase().includes(b))) return false
    }
    return true
  })

  const totalAPagar = filtradas.filter(d => d.status !== 'PAGO')
    .reduce((s, d) => s + (d.valorPorItem * d.qtdSolicitada), 0)
  const totalPago   = filtradas.filter(d => d.status === 'PAGO')
    .reduce((s, d) => s + d.valorTotal, 0)
  const totalItens  = filtradas.reduce((s, d) => s + d.qtdProduzida, 0)
  const totalSelecionadoVal = filtradas
    .filter(d => selecionados.includes(d.id))
    .reduce((s, d) => s + (d.valorPorItem * d.qtdSolicitada), 0)

  // ── Seleção ────────────────────────────────────────────────────────────────
  function toggleSel(id: string) {
    setSelecionados(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }
  function toggleTodos() {
    setSelecionados(p => p.length === filtradas.length ? [] : filtradas.map(d => d.id))
  }

  // ── Ação em massa ──────────────────────────────────────────────────────────
  async function aplicarMassa() {
    if (!acaoMassa || !selecionados.length) return
    if (acaoMassa === 'PAGO') {
      setPagandoIds(selecionados)
      setFormPag({ categoriaId: '', valorPago: '' })
      setModalPagar(true)
      return
    }
    for (const id of selecionados) {
      await fetch(`/api/demandas/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: acaoMassa }),
      })
    }
    feedback(`${selecionados.length} demanda(s) atualizadas`)
    setSelecionados([]); setAcaoMassa(''); carregar()
  }

  // ── Pagar ──────────────────────────────────────────────────────────────────
  async function confirmarPagamento() {
    if (!formPag.categoriaId) { feedback('Escolha uma categoria financeira'); return }
    for (const id of pagandoIds) {
      const d = demandas.find(x => x.id === id)
      await fetch(`/api/demandas/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAGO', criarLancamento: true,
          categoriaId: formPag.categoriaId,
          valorPago: formPag.valorPago || (d ? d.valorPorItem * d.qtdSolicitada : 0),
        }),
      })
    }
    feedback(`${pagandoIds.length} pagamento(s) registrado(s) no Financeiro ✅`)
    setModalPagar(false); setPagandoIds([]); setSelecionados([]); setAcaoMassa('')
    carregar()
  }

  // ── Excluir ────────────────────────────────────────────────────────────────
  async function excluir(id: string) {
    if (!confirm('Excluir esta demanda?')) return
    await fetch(`/api/demandas/${id}`, { method: 'DELETE' })
    feedback('Demanda excluída'); carregar()
  }

  // ── Salvar form ────────────────────────────────────────────────────────────
  async function salvarForm() {
    if (!form.freelancerId || !form.qtdSolicitada) {
      feedback('Freelancer e quantidade são obrigatórios'); return
    }
    const url    = editando ? `/api/demandas/${editando.id}` : '/api/demandas'
    const method = editando ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) {
      feedback(editando ? 'Demanda atualizada!' : 'Demanda criada!')
      setModalForm(false); setEditando(null)
      setForm({ freelancerId: '', nomeProduto: '', qtdSolicitada: '', valorPorItem: '', pedidoId: '', observacoes: '' })
      carregar()
    } else {
      const e = await res.json(); feedback(e.error || 'Erro ao salvar')
    }
  }

  function abrirEditar(d: Demanda) {
    setEditando(d)
    setForm({
      freelancerId: d.freelancerId, nomeProduto: d.nomeProduto || '',
      qtdSolicitada: String(d.qtdSolicitada), valorPorItem: String(d.valorPorItem),
      pedidoId: d.pedidoId || '', observacoes: d.observacoes || '',
    })
    setModalForm(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users size={20} className="text-orange-400"/> Demandas de Freelancers
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Produção terceirizada — controle por peça produzida</p>
        </div>
        <div className="flex gap-2">
          <a href="/config/freelancers"
            className="flex items-center gap-2 text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 px-3 py-2 rounded-xl transition">
            <Users size={14}/> Freelancers
          </a>
          <button onClick={carregar}
            className="flex items-center gap-2 text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 px-3 py-2 rounded-xl transition">
            <RefreshCw size={14}/>
          </button>
          {isAdmin && (
            <button onClick={() => { setEditando(null); setForm({ freelancerId:'', nomeProduto:'', qtdSolicitada:'', valorPorItem:'', pedidoId:'', observacoes:'' }); setModalForm(true) }}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
              <Plus size={15}/> Nova Demanda
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div className="bg-green-900/30 border border-green-700 text-green-300 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <CheckCircle size={14}/> {msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Demandas (filtro atual)', value: filtradas.length,          cls: 'text-white' },
          { label: 'Itens produzidos',        value: totalItens,                cls: 'text-white' },
          { label: 'A pagar',                 value: fmtR(totalAPagar),         cls: 'text-orange-400' },
          { label: 'Total pago',              value: fmtR(totalPago),           cls: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por freelancer, descrição, pedido..."
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"/>
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filtroFre} onChange={e => setFiltroFre(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-sm text-white rounded-xl px-3 py-2 focus:outline-none">
          <option value="">Todos os freelancers</option>
          {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {/* Barra de ações em massa */}
      {selecionados.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-700 rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-orange-400">
            {selecionados.length} selecionada(s) · {fmtR(totalSelecionadoVal)}
          </span>
          <select value={acaoMassa} onChange={e => setAcaoMassa(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none">
            <option value="">Escolher ação...</option>
            <option value="EM_PRODUCAO">Marcar como Em produção</option>
            <option value="PRODUZIDO">Marcar como Produzido</option>
            <option value="PAGO">Marcar como Pago</option>
          </select>
          <button onClick={aplicarMassa} disabled={!acaoMassa}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40 transition">
            Aplicar
          </button>
          <button onClick={() => { setSelecionados([]); setAcaoMassa('') }}
            className="text-sm text-gray-400 hover:text-white ml-auto">Desmarcar todos</button>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-3 w-10">
                <input type="checkbox"
                  checked={selecionados.length === filtradas.length && filtradas.length > 0}
                  onChange={toggleTodos} className="accent-orange-500"/>
              </th>
              {['FREELANCER','DESCRIÇÃO','PEDIDO','SOLICITADO','PRODUZIDO','R$/ITEM','TOTAL','STATUS','CRIADO EM','AÇÕES'].map(h => (
                <th key={h} className="p-3 text-left text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="p-8 text-center text-gray-500">Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={11} className="p-8 text-center text-gray-500">Nenhuma demanda encontrada</td></tr>
            ) : filtradas.map(d => {
              const sc  = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDENTE
              const Ico = sc.icon
              const sel = selecionados.includes(d.id)
              return (
                <tr key={d.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition ${sel ? 'bg-orange-900/10' : ''}`}>
                  <td className="p-3">
                    <input type="checkbox" checked={sel} onChange={() => toggleSel(d.id)} className="accent-orange-500"/>
                  </td>
                  <td className="p-3 font-medium text-white whitespace-nowrap">{d.freelancerNome}</td>
                  <td className="p-3 text-gray-300 max-w-40 truncate" title={d.nomeProduto || ''}>{d.nomeProduto || '—'}</td>
                  <td className="p-3 text-gray-400 whitespace-nowrap">{d.pedidoRef || '—'}</td>
                  <td className="p-3 text-center font-mono">{d.qtdSolicitada}</td>
                  <td className="p-3 text-center font-mono">{d.qtdProduzida}</td>
                  <td className="p-3 text-right font-mono text-gray-300">{fmtR(d.valorPorItem)}</td>
                  <td className="p-3 text-right font-mono font-semibold">
                    {d.status === 'PAGO' ? (
                      <span className="text-green-400">{fmtR(d.valorTotal)}</span>
                    ) : fmtR(d.valorPorItem * d.qtdSolicitada)}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.cls}`}>
                      <Ico size={11}/> {sc.label}
                    </span>
                    {d.status === 'PAGO' && d.dataPagamento && (
                      <p className="text-xs text-gray-500 mt-0.5">{fmtData(d.dataPagamento)}</p>
                    )}
                  </td>
                  <td className="p-3 text-gray-500 whitespace-nowrap text-xs">{fmtData(d.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {d.status !== 'PAGO' && isAdmin && (
                        <>
                          <button onClick={() => abrirEditar(d)} title="Editar"
                            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition">
                            <Pencil size={13}/>
                          </button>
                          <button onClick={() => { setPagandoIds([d.id]); setFormPag({ categoriaId:'', valorPago: String(d.valorPorItem * d.qtdSolicitada) }); setModalPagar(true) }}
                            title="Pagar" className="p-1.5 rounded-lg hover:bg-green-900/40 text-gray-400 hover:text-green-400 transition">
                            <CreditCard size={13}/>
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <button onClick={() => excluir(d.id)} title="Excluir"
                          className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition">
                          <X size={13}/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtradas.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-700">
                <td colSpan={4} className="p-3 text-right text-xs text-gray-500 font-semibold">Totais:</td>
                <td className="p-3 text-center font-mono font-semibold text-white">
                  {filtradas.reduce((s, d) => s + d.qtdSolicitada, 0)}
                </td>
                <td className="p-3 text-center font-mono font-semibold text-white">{totalItens}</td>
                <td className="p-3"></td>
                <td className="p-3 text-right text-xs">
                  <span className="text-orange-400 font-semibold">A pagar: {fmtR(totalAPagar)}</span>
                  <span className="mx-2 text-gray-600">·</span>
                  <span className="text-green-400 font-semibold">Pago: {fmtR(totalPago)}</span>
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── MODAL NOVA/EDITAR DEMANDA ── */}
      {modalForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">{editando ? 'Editar Demanda' : 'Nova Demanda'}</h2>
              <button onClick={() => setModalForm(false)}><X size={18} className="text-gray-400 hover:text-white"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Freelancer *</label>
                <select value={form.freelancerId} onChange={e => setForm(p => ({ ...p, freelancerId: e.target.value }))} className={ic}>
                  <option value="">Selecionar...</option>
                  {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Descrição (opcional)</label>
                <input value={form.nomeProduto} onChange={e => setForm(p => ({ ...p, nomeProduto: e.target.value }))}
                  className={ic} placeholder="Ex: Laços modelo A, Cofrinhos personalizados..."/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Qtd de itens *</label>
                  <input type="number" min={1} value={form.qtdSolicitada}
                    onChange={e => setForm(p => ({ ...p, qtdSolicitada: e.target.value }))} className={ic} placeholder="0"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">R$ por item</label>
                  <input type="number" step="0.01" min={0} value={form.valorPorItem}
                    onChange={e => setForm(p => ({ ...p, valorPorItem: e.target.value }))} className={ic} placeholder="0,00"/>
                </div>
              </div>
              {form.qtdSolicitada && form.valorPorItem && (
                <div className="bg-orange-900/20 border border-orange-800 rounded-xl px-4 py-2 text-sm text-orange-300">
                  Total estimado: <strong>{fmtR(parseFloat(form.qtdSolicitada||'0') * parseFloat(form.valorPorItem||'0'))}</strong>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Pedido vinculado (opcional)</label>
                <input value={form.pedidoId} onChange={e => setForm(p => ({ ...p, pedidoId: e.target.value }))}
                  className={ic} placeholder="ID do pedido..."/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  className={ic + ' resize-none'} rows={2} placeholder="Instruções para a freelancer..."/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalForm(false)}
                  className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                <button onClick={salvarForm}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold">
                  {editando ? 'Salvar' : 'Criar demanda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PAGAMENTO ── */}
      {modalPagar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <CreditCard size={16} className="text-green-400"/> Registrar Pagamento
              </h2>
              <button onClick={() => setModalPagar(false)}><X size={18} className="text-gray-400 hover:text-white"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300">
                <p>{pagandoIds.length} demanda(s) serão marcadas como <strong className="text-green-400">Pago</strong></p>
                <p className="text-xs text-gray-500 mt-1">Um lançamento de despesa será criado automaticamente no Financeiro.</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Categoria Financeira *</label>
                <select value={formPag.categoriaId} onChange={e => setFormPag(p => ({ ...p, categoriaId: e.target.value }))} className={ic}>
                  <option value="">Selecionar categoria...</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                  ))}
                </select>
                {categorias.length === 0 && (
                  <p className="text-xs text-orange-400 mt-1">⚠️ Cadastre categorias de despesa no Financeiro primeiro.</p>
                )}
              </div>
              {pagandoIds.length === 1 && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Valor pago (R$)</label>
                  <input type="number" step="0.01" min={0} value={formPag.valorPago}
                    onChange={e => setFormPag(p => ({ ...p, valorPago: e.target.value }))}
                    className={ic} placeholder="Valor acordado..."/>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalPagar(false)}
                  className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                <button onClick={confirmarPagamento}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  <DollarSign size={14}/> Confirmar pagamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
