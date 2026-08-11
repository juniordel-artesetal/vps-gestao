'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus, Users, Settings2, RefreshCw, Search, ChevronDown,
  Pencil, X, CheckCircle, Clock, AlertCircle, DollarSign,
  Filter, CreditCard, Tag, Eye
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface DemandaItem { id?: string; produto: string; qtd: number; valorUnit: number; subtotal: number }
interface Demanda {
  id: string; pedidoId: string | null; pedidoRef: string | null
  freelancerId: string; freelancerNome: string
  nomeProduto: string | null
  qtdSolicitada: number; qtdProduzida: number
  valorPorItem: number; valorTotal: number
  status: string; observacoes: string | null
  dataPagamento: string | null; lancamentoId: string | null
  createdAt: string
  nItens?: number; itens?: DemandaItem[]
}
interface Freelancer { id: string; nome: string; especialidade: string | null }
interface Categoria  { id: string; nome: string; tipo: string; icone: string | null }
interface Preco { id: string; freelancerId: string | null; produto: string; valorUnitario: number; ativo: boolean }

// Valor acordado do trabalho: trabalhos com vários itens usam valorTotal (soma dos itens);
// os legados (item único) mantêm o cálculo antigo valorPorItem × qtd solicitada.
function valorAcordado(d: Demanda) {
  return (d.nItens || 0) > 0 ? d.valorTotal : d.valorPorItem * d.qtdSolicitada
}
function itemFormVazio() { return { produto: '', valorUnit: '', qtd: '1' } }

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
  const [precos,       setPrecos]       = useState<Preco[]>([])
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
  const [soLeitura,    setSoLeitura]    = useState(false)   // abre o trabalho em modo consulta (ex.: PAGO)
  const [pagandoIds,   setPagandoIds]   = useState<string[]>([])

  // Form nova/editar demanda — agora com vários itens (produto + qtd + valor unit.)
  const [form, setForm] = useState({ freelancerId: '', pedidoId: '', observacoes: '' })
  const [itensForm, setItensForm] = useState<{ produto: string; valorUnit: string; qtd: string }[]>([itemFormVazio()])

  function addItemForm() { setItensForm(p => [...p, itemFormVazio()]) }
  function removItemForm(i: number) { setItensForm(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p) }
  function setItemForm(i: number, patch: Partial<{ produto: string; valorUnit: string; qtd: string }>) {
    setItensForm(p => p.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }
  const totalForm = itensForm.reduce((s, it) => s + (parseFloat(it.valorUnit) || 0) * (parseInt(it.qtd) || 0), 0)

  // Form pagamento
  const [formPag, setFormPag] = useState({ categoriaId: '', valorPago: '' })

  const feedback = (txt: string) => { setMsg(txt); setTimeout(() => setMsg(''), 3500) }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, fRes, cRes, pRes] = await Promise.all([
        fetch('/api/demandas').then(r => r.json()),
        fetch('/api/config/freelancers').then(r => r.json()).catch(() => []),
        fetch('/api/financeiro/categorias').then(r => r.json()).catch(() => []),
        fetch('/api/demandas/precos?ativos=1').then(r => r.json()).catch(() => []),
      ])
      setDemandas(Array.isArray(dRes) ? dRes : [])
      setFreelancers(Array.isArray(fRes) ? fRes : [])
      setCategorias((Array.isArray(cRes) ? cRes : []).filter((c: Categoria) => c.tipo === 'DESPESA'))
      setPrecos(Array.isArray(pRes) ? pRes : [])
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
    .reduce((s, d) => s + valorAcordado(d), 0)
  const totalPago   = filtradas.filter(d => d.status === 'PAGO')
    .reduce((s, d) => s + d.valorTotal, 0)
  const totalItens  = filtradas.reduce((s, d) => s + d.qtdProduzida, 0)
  const totalSelecionadoVal = filtradas
    .filter(d => selecionados.includes(d.id))
    .reduce((s, d) => s + valorAcordado(d), 0)

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
    feedback(`${selecionados.length} trabalho(s) atualizados`)
    setSelecionados([]); setAcaoMassa(''); carregar()
  }

  // ── Pagar ──────────────────────────────────────────────────────────────────
  async function confirmarPagamento() {
    // Categoria é recomendada, mas só é obrigatória se o workspace já tem categorias de despesa.
    if (categorias.length > 0 && !formPag.categoriaId) { feedback('Escolha uma categoria financeira'); return }
    let ok = 0
    const erros: string[] = []
    for (const id of pagandoIds) {
      const d = demandas.find(x => x.id === id)
      try {
        const res = await fetch(`/api/demandas/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'PAGO', criarLancamento: true,
            categoriaId: formPag.categoriaId || null,
            valorPago: formPag.valorPago || (d ? valorAcordado(d) : 0),
          }),
        })
        if (res.ok) ok++
        else { const e = await res.json().catch(() => ({})); erros.push(e.error || `Erro ${res.status}`) }
      } catch { erros.push('Falha de conexão') }
    }
    // Só reflete sucesso do que realmente foi pago; não fica "pendente em silêncio".
    if (erros.length) feedback(`${ok} pago(s); ${erros.length} falhou(aram): ${erros[0]}`)
    else feedback(`${ok} pagamento(s) registrado(s) no Financeiro ✅`)
    setModalPagar(false); setPagandoIds([]); setSelecionados([]); setAcaoMassa('')
    carregar()
  }

  // ── Excluir ────────────────────────────────────────────────────────────────
  async function excluir(id: string) {
    if (!confirm('Excluir este trabalho?')) return
    await fetch(`/api/demandas/${id}`, { method: 'DELETE' })
    feedback('Trabalho excluído'); carregar()
  }

  function resetForm() {
    setForm({ freelancerId: '', pedidoId: '', observacoes: '' })
    setItensForm([itemFormVazio()])
  }

  // ── Salvar form ────────────────────────────────────────────────────────────
  async function salvarForm() {
    const itens = itensForm
      .map(it => ({ produto: it.produto.trim(), qtd: parseInt(it.qtd) || 0, valorUnit: parseFloat(it.valorUnit) || 0 }))
      .filter(it => it.produto && it.qtd > 0)
    if (!form.freelancerId) { feedback('Escolha o freelancer'); return }
    if (itens.length === 0) { feedback('Adicione ao menos um produto com quantidade'); return }
    const url    = editando ? `/api/demandas/${editando.id}` : '/api/demandas'
    const method = editando ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freelancerId: form.freelancerId, pedidoId: form.pedidoId, observacoes: form.observacoes, itens }),
    })
    if (res.ok) {
      feedback(editando ? 'Trabalho atualizado!' : 'Trabalho criado!')
      setModalForm(false); setEditando(null); resetForm()
      carregar()
    } else {
      const e = await res.json(); feedback(e.error || 'Erro ao salvar')
    }
  }

  async function abrirEditar(d: Demanda, ver = false) {
    setEditando(d)
    setSoLeitura(ver)
    setForm({ freelancerId: d.freelancerId, pedidoId: d.pedidoId || '', observacoes: d.observacoes || '' })
    // Carrega os itens do trabalho (grupo); no legado de item único, monta uma linha
    try {
      const full = await fetch(`/api/demandas/${d.id}`).then(r => r.json())
      if (Array.isArray(full.itens) && full.itens.length > 0) {
        setItensForm(full.itens.map((it: DemandaItem) => ({ produto: it.produto, valorUnit: String(it.valorUnit), qtd: String(it.qtd) })))
      } else {
        setItensForm([{ produto: d.nomeProduto || '', valorUnit: d.valorPorItem ? String(d.valorPorItem) : '', qtd: String(d.qtdSolicitada || 1) }])
      }
    } catch {
      setItensForm([{ produto: d.nomeProduto || '', valorUnit: d.valorPorItem ? String(d.valorPorItem) : '', qtd: String(d.qtdSolicitada || 1) }])
    }
    setModalForm(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users size={20} className="text-orange-400"/> Trabalhos de Freelancer
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Produção terceirizada — controle por peça produzida</p>
        </div>
        <div className="flex gap-2">
          <a href="/demandas/precos"
            className="flex items-center gap-2 text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 px-3 py-2 rounded-xl transition">
            <Tag size={14}/> Preços por peça
          </a>
          <a href="/config/freelancers"
            className="flex items-center gap-2 text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 px-3 py-2 rounded-xl transition">
            <Users size={14}/> Freelancers
          </a>
          <button onClick={carregar}
            className="flex items-center gap-2 text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 px-3 py-2 rounded-xl transition">
            <RefreshCw size={14}/>
          </button>
          {isAdmin && (
            <button onClick={() => { setEditando(null); setSoLeitura(false); resetForm(); setModalForm(true) }}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
              <Plus size={15}/> Novo Trabalho
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
          { label: 'Trabalhos (filtro atual)', value: filtradas.length,          cls: 'text-white' },
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
              <tr><td colSpan={11} className="p-8 text-center text-gray-500">Nenhum trabalho encontrado</td></tr>
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
                  <td className="p-3 text-gray-300 max-w-48"
                    title={d.itens && d.itens.length ? d.itens.map(i => `${i.produto} (${i.qtd}x · ${fmtR(i.valorUnit)})`).join(', ') : (d.nomeProduto || '')}>
                    <div className="truncate">{d.nomeProduto || '—'}</div>
                    {(d.nItens || 0) > 1 && <span className="text-[10px] text-orange-400">{d.nItens} produtos</span>}
                  </td>
                  <td className="p-3 text-gray-400 whitespace-nowrap">{d.pedidoRef || '—'}</td>
                  <td className="p-3 text-center font-mono">{d.qtdSolicitada}</td>
                  <td className="p-3 text-center font-mono">{d.qtdProduzida}</td>
                  <td className="p-3 text-right font-mono text-gray-300">
                    {(d.nItens || 0) > 1 ? <span className="text-gray-500">vários</span> : fmtR(d.valorPorItem)}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">
                    {d.status === 'PAGO' ? (
                      <span className="text-green-400">{fmtR(d.valorTotal)}</span>
                    ) : fmtR(valorAcordado(d))}
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
                      {/* Consulta sempre disponível — inclusive quando PAGO (read-only). */}
                      <button onClick={() => abrirEditar(d, true)} title="Ver detalhes"
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition">
                        <Eye size={13}/>
                      </button>
                      {d.status !== 'PAGO' && isAdmin && (
                        <>
                          <button onClick={() => abrirEditar(d)} title="Editar"
                            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition">
                            <Pencil size={13}/>
                          </button>
                          <button onClick={() => { setPagandoIds([d.id]); setFormPag({ categoriaId:'', valorPago: String(valorAcordado(d)) }); setModalPagar(true) }}
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
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="font-semibold text-white">{soLeitura ? 'Detalhes do Trabalho' : editando ? 'Editar Trabalho' : 'Novo Trabalho'}</h2>
              <button onClick={() => setModalForm(false)}><X size={18} className="text-gray-400 hover:text-white"/></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {soLeitura && editando && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${(STATUS_CONFIG[editando.status] || STATUS_CONFIG.PENDENTE).cls}`}>
                    {(STATUS_CONFIG[editando.status] || STATUS_CONFIG.PENDENTE).label}
                  </span>
                  <span className="text-gray-300">
                    {fmtR(valorAcordado(editando))}
                    {editando.status === 'PAGO' && editando.dataPagamento && <span className="text-gray-500"> · pago em {fmtData(editando.dataPagamento)}</span>}
                  </span>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Freelancer *</label>
                <select value={form.freelancerId} disabled={soLeitura} onChange={e => setForm(p => ({ ...p, freelancerId: e.target.value }))} className={ic + (soLeitura ? ' opacity-60 cursor-not-allowed' : '')}>
                  <option value="">Selecionar...</option>
                  {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Produtos *</label>
                  <a href="/demandas/precos" target="_blank" className="text-xs text-orange-400 hover:underline flex items-center gap-1"><Tag size={11}/> Preços por peça</a>
                </div>
                <div className="space-y-2">
                  {itensForm.map((it, i) => {
                    const disp = precos.filter(pr => pr.ativo && (!pr.freelancerId || pr.freelancerId === form.freelancerId))
                    const sub  = (parseFloat(it.valorUnit) || 0) * (parseInt(it.qtd) || 0)
                    return (
                      <div key={i} className="border border-gray-700 rounded-xl p-3 bg-gray-800/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Produto {i + 1}</span>
                          {itensForm.length > 1 && !soLeitura && (
                            <button onClick={() => removItemForm(i)} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                          )}
                        </div>
                        {disp.length > 0 && !soLeitura && (
                          <select value="" onChange={e => { const pr = disp.find(x => x.id === e.target.value); if (pr) setItemForm(i, { produto: pr.produto, valorUnit: String(pr.valorUnitario) }) }} className={ic}>
                            <option value="">Escolher preço cadastrado...</option>
                            {disp.map(pr => <option key={pr.id} value={pr.id}>{pr.produto} — {fmtR(pr.valorUnitario)}</option>)}
                          </select>
                        )}
                        <input value={it.produto} disabled={soLeitura} onChange={e => setItemForm(i, { produto: e.target.value })}
                          className={ic + (soLeitura ? ' opacity-60' : '')} placeholder="Produto (ou digite manualmente)"/>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 block mb-1">Qtd</label>
                            <input type="number" min={1} value={it.qtd} disabled={soLeitura} onChange={e => setItemForm(i, { qtd: e.target.value })} className={ic + (soLeitura ? ' opacity-60' : '')}/>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 block mb-1">R$/peça</label>
                            <input type="number" step="0.01" min={0} value={it.valorUnit} disabled={soLeitura} onChange={e => setItemForm(i, { valorUnit: e.target.value })} className={ic + (soLeitura ? ' opacity-60' : '')} placeholder="0,00"/>
                          </div>
                          <div className="flex-shrink-0 pb-2">
                            <span className="text-xs text-orange-400 font-semibold whitespace-nowrap">= {fmtR(sub)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {!soLeitura && (
                  <button onClick={addItemForm}
                    className="w-full mt-2 border border-dashed border-gray-700 text-orange-400 hover:bg-gray-800 rounded-xl py-2 text-sm flex items-center justify-center gap-1 transition">
                    <Plus size={14}/> Adicionar produto
                  </button>
                )}
              </div>
              {totalForm > 0 && (
                <div className="bg-orange-900/20 border border-orange-800 rounded-xl px-4 py-2 text-sm text-orange-300 flex justify-between">
                  <span>Total do trabalho</span><strong>{fmtR(totalForm)}</strong>
                </div>
              )}
              {!(soLeitura && !form.pedidoId) && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Pedido vinculado (opcional)</label>
                  <input value={form.pedidoId} disabled={soLeitura} onChange={e => setForm(p => ({ ...p, pedidoId: e.target.value }))}
                    className={ic + (soLeitura ? ' opacity-60' : '')} placeholder="ID do pedido..."/>
                </div>
              )}
              {!(soLeitura && !form.observacoes) && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Observações</label>
                  <textarea value={form.observacoes} disabled={soLeitura} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                    className={ic + ' resize-none' + (soLeitura ? ' opacity-60' : '')} rows={2} placeholder="Instruções para a freelancer..."/>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                {soLeitura ? (
                  <button onClick={() => setModalForm(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl text-sm font-semibold">Fechar</button>
                ) : (
                  <>
                    <button onClick={() => setModalForm(false)}
                      className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                    <button onClick={salvarForm}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold">
                      {editando ? 'Salvar' : 'Criar trabalho'}
                    </button>
                  </>
                )}
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
                <p>{pagandoIds.length} trabalho(s) serão marcados como <strong className="text-green-400">Pago</strong></p>
                <p className="text-xs text-gray-500 mt-1">Um registro de despesa será criado automaticamente no Financeiro.</p>
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
