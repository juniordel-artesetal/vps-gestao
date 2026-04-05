'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus, Pencil, Trash2, X, CheckCircle, AlertCircle,
  Phone, QrCode, Star, History, Eye, EyeOff,
  Users, Clock, DollarSign, Package
} from 'lucide-react'

interface Freelancer {
  id: string; nome: string; telefone: string | null; pix: string | null
  especialidade: string | null; observacoes: string | null
  ativo: boolean; createdAt: string
}
interface Demanda {
  id: string; nomeProduto: string | null; qtdSolicitada: number
  valorPorItem: number; valorTotal: number; status: string
  dataPagamento: string | null; pedidoRef: string | null; createdAt: string
}
interface PedidoVinculado {
  id: string; numero: string; destinatario: string; produto: string
  quantidade: number; status: string; dataEnvio: string | null
}

const STATUS_COR: Record<string, string> = {
  PENDENTE:    'bg-gray-100 text-gray-600',
  EM_PRODUCAO: 'bg-blue-50 text-blue-700',
  PRODUZIDO:   'bg-yellow-50 text-yellow-700',
  PAGO:        'bg-green-50 text-green-700',
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const FORM_VAZIO = { nome: '', telefone: '', pix: '', especialidade: '', observacoes: '' }

export default function FreelancersPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [freelancers,  setFreelancers]  = useState<Freelancer[]>([])
  const [loading,      setLoading]      = useState(true)
  const [mostrarInat,  setMostrarInat]  = useState(false)
  const [msg,          setMsg]          = useState<{ txt: string; ok: boolean } | null>(null)

  // Modal form
  const [modalForm,  setModalForm]  = useState(false)
  const [editando,   setEditando]   = useState<Freelancer | null>(null)
  const [form,       setForm]       = useState(FORM_VAZIO)
  const [salvando,   setSalvando]   = useState(false)

  // Modal histórico
  const [modalHist,  setModalHist]   = useState(false)
  const [histFre,    setHistFre]     = useState<Freelancer | null>(null)
  const [demandas,   setDemandas]    = useState<Demanda[]>([])
  const [pedidos,    setPedidos]     = useState<PedidoVinculado[]>([])
  const [stats,      setStats]       = useState({ totalPago: 0, totalPendente: 0, totalItens: 0, totalDemandas: 0 })
  const [loadingHist, setLoadingHist] = useState(false)
  const [abaHist,    setAbaHist]     = useState<'demandas' | 'pedidos'>('demandas')
  const [histDe,     setHistDe]       = useState('')
  const [histAte,    setHistAte]      = useState('')

  const feedback = (txt: string, ok = true) => { setMsg({ txt, ok }); setTimeout(() => setMsg(null), 3000) }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/freelancers?todos=1')
      const data = await res.json()
      setFreelancers(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function abrirHistorico(f: Freelancer) {
    setHistFre(f); setModalHist(true); setLoadingHist(true); setAbaHist('demandas'); setHistDe(''); setHistAte('')
    try {
      const res = await fetch(`/api/config/freelancers/${f.id}/historico`)
      const data = await res.json()
      setDemandas(data.demandas || [])
      setPedidos(data.pedidos || [])
      setStats(data.stats || { totalPago: 0, totalPendente: 0, totalItens: 0, totalDemandas: 0 })
    } finally { setLoadingHist(false) }
  }

  function abrirEditar(f: Freelancer) {
    setEditando(f)
    setForm({ nome: f.nome, telefone: f.telefone || '', pix: f.pix || '', especialidade: f.especialidade || '', observacoes: f.observacoes || '' })
    setModalForm(true)
  }

  function abrirNovo() {
    setEditando(null); setForm(FORM_VAZIO); setModalForm(true)
  }

  async function salvar() {
    if (!form.nome.trim()) { feedback('Nome obrigatório', false); return }
    setSalvando(true)
    try {
      const url    = editando ? `/api/config/freelancers/${editando.id}` : '/api/config/freelancers'
      const method = editando ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { feedback(editando ? 'Freelancer atualizada!' : 'Freelancer cadastrada!'); setModalForm(false); carregar() }
      else { const e = await res.json(); feedback(e.error || 'Erro', false) }
    } finally { setSalvando(false) }
  }

  async function toggleAtivo(f: Freelancer) {
    await fetch(`/api/config/freelancers/${f.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !f.ativo }),
    })
    setFreelancers(p => p.map(x => x.id === f.id ? { ...x, ativo: !x.ativo } : x))
    feedback(f.ativo ? 'Desativada' : 'Ativada')
  }

  async function excluir(f: Freelancer) {
    if (!confirm(`Excluir ${f.nome}? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/config/freelancers/${f.id}`, { method: 'DELETE' })
    if (res.ok) { feedback('Freelancer excluída'); carregar() }
    else feedback('Não é possível excluir — há demandas vinculadas', false)
  }

  const lista = freelancers.filter(f => mostrarInat || f.ativo)
  const ativas = freelancers.filter(f => f.ativo).length

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={20} className="text-orange-500"/> Freelancers
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{ativas} ativa{ativas !== 1 ? 's' : ''} · {freelancers.length} no total</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMostrarInat(v => !v)}
              className={`flex items-center gap-1.5 text-sm border rounded-xl px-3 py-2 transition ${mostrarInat ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {mostrarInat ? <Eye size={14}/> : <EyeOff size={14}/>}
              {mostrarInat ? 'Ocultar inativas' : 'Ver inativas'}
            </button>
            {isAdmin && (
              <button onClick={abrirNovo}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                <Plus size={14}/> Nova freelancer
              </button>
            )}
          </div>
        </div>

        {/* Feedback */}
        {msg && (
          <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 mb-4 ${msg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
            {msg.ok ? <CheckCircle size={14}/> : <AlertCircle size={14}/>} {msg.txt}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="text-center text-gray-400 text-sm py-12">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-500 font-medium">Nenhuma freelancer cadastrada</p>
            {isAdmin && (
              <button onClick={abrirNovo} className="mt-3 text-sm text-orange-500 hover:text-orange-700 font-medium">
                + Cadastrar primeira freelancer
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lista.map(f => (
              <div key={f.id}
                className={`bg-white rounded-2xl border p-5 transition ${f.ativo ? 'border-gray-100 hover:border-orange-200 hover:shadow-sm' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  {/* Avatar + info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-600 font-bold text-base">{f.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{f.nome}</p>
                        {!f.ativo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativa</span>}
                      </div>
                      {f.especialidade && (
                        <p className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
                          <Star size={10}/> {f.especialidade}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2">
                        {f.telefone && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone size={10}/> {f.telefone}
                          </span>
                        )}
                        {f.pix && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <QrCode size={10}/> {f.pix}
                          </span>
                        )}
                      </div>
                      {f.observacoes && (
                        <p className="text-xs text-gray-400 mt-1.5 italic leading-relaxed">{f.observacoes}</p>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {/* Histórico */}
                    <button onClick={() => abrirHistorico(f)} title="Ver histórico"
                      className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-2.5 py-1.5 rounded-lg transition font-medium whitespace-nowrap">
                      <History size={12}/> Histórico
                    </button>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => abrirEditar(f)} title="Editar"
                          className="flex-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition">
                          <Pencil size={13}/>
                        </button>
                        <button onClick={() => toggleAtivo(f)} title={f.ativo ? 'Desativar' : 'Ativar'}
                          className={`flex-1 p-1.5 rounded-lg transition ${f.ativo ? 'hover:bg-yellow-50 text-gray-400 hover:text-yellow-600' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}>
                          {f.ativo ? <EyeOff size={13}/> : <Eye size={13}/>}
                        </button>
                        <button onClick={() => excluir(f)} title="Excluir"
                          className="flex-1 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL FORM ─────────────────────────────────────────────────────── */}
      {modalForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editando ? 'Editar freelancer' : 'Nova freelancer'}</h2>
              <button onClick={() => setModalForm(false)}><X size={18} className="text-gray-400 hover:text-gray-600"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} className={ic} placeholder="Nome completo"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Telefone / WhatsApp</label>
                  <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} className={ic} placeholder="(11) 99999-9999"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">PIX</label>
                  <input value={form.pix} onChange={e => setForm(p => ({ ...p, pix: e.target.value }))} className={ic} placeholder="CPF, e-mail ou telefone"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Especialidade</label>
                <input value={form.especialidade} onChange={e => setForm(p => ({ ...p, especialidade: e.target.value }))} className={ic} placeholder="Ex: Laços, Arte, Impressão..."/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} className={ic + ' resize-none'} rows={2} placeholder="Notas internas sobre a freelancer..."/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={salvar} disabled={salvando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTÓRICO ────────────────────────────────────────────────── */}
      {modalHist && histFre && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl my-6">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <span className="text-orange-600 font-bold">{histFre.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{histFre.nome}</h2>
                  {histFre.especialidade && <p className="text-xs text-orange-500">{histFre.especialidade}</p>}
                </div>
              </div>
              <button onClick={() => setModalHist(false)}><X size={18} className="text-gray-400 hover:text-gray-600"/></button>
            </div>

            {loadingHist ? (
              <div className="p-12 text-center text-gray-400 text-sm">Carregando histórico...</div>
            ) : (
              <>
                {/* Filtro de datas */}
                <div className="flex gap-3 items-end px-6 pt-5 pb-0">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">De</label>
                    <input type="date" value={histDe} onChange={e => setHistDe(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Até</label>
                    <input type="date" value={histAte} onChange={e => setHistAte(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                  </div>
                  {(histDe || histAte) && (
                    <button onClick={() => { setHistDe(''); setHistAte('') }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 pb-1.5">
                      <X size={12}/> Limpar
                    </button>
                  )}
                </div>

                {/* Stats — do período filtrado */}
                {(() => {
                  const demFilt = demandas.filter(d => {
                    const dt = d.createdAt?.slice(0, 10)
                    if (histDe && dt < histDe) return false
                    if (histAte && dt > histAte) return false
                    return true
                  })
                  const pPago     = demFilt.filter(d => d.status === 'PAGO').reduce((s, d) => s + (d.valorTotal || 0), 0)
                  const pPendente = demFilt.filter(d => d.status !== 'PAGO').reduce((s, d) => s + ((d.valorPorItem || 0) * (d.qtdSolicitada || 0)), 0)
                  const pItens    = demFilt.reduce((s, d) => s + (d.qtdSolicitada || 0), 0)
                  const temFiltro = histDe || histAte
                  return (
                    <div className="grid grid-cols-4 gap-3 px-6 pt-3">
                      {[
                        { label: temFiltro ? 'Demandas (período)' : 'Demandas',    value: temFiltro ? demFilt.length : stats.totalDemandas, icon: Package,     cls: 'text-gray-700' },
                        { label: temFiltro ? 'Itens (período)'    : 'Total itens', value: temFiltro ? pItens          : stats.totalItens,    icon: Clock,       cls: 'text-gray-700' },
                        { label: temFiltro ? 'A receber (período)': 'A receber',   value: fmtR(temFiltro ? pPendente  : stats.totalPendente), icon: DollarSign, cls: 'text-orange-500' },
                        { label: temFiltro ? 'Pago (período)'     : 'Total pago',  value: fmtR(temFiltro ? pPago      : stats.totalPago),     icon: CheckCircle, cls: 'text-green-600' },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                          <s.icon size={16} className={`${s.cls} mx-auto mb-1`}/>
                          <p className={`font-bold text-sm ${s.cls}`}>{s.value}</p>
                          <p className="text-xs text-gray-400 leading-tight">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Abas */}
                <div className="flex gap-1 px-6 pt-3">
                  <button onClick={() => setAbaHist('demandas')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${abaHist === 'demandas' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    Demandas ({demandas.length})
                  </button>
                  <button onClick={() => setAbaHist('pedidos')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${abaHist === 'pedidos' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    Pedidos vinculados ({pedidos.length})
                  </button>
                </div>

                <div className="p-6 pt-3">
                  {/* Aba Demandas */}
                  {abaHist === 'demandas' && (() => {
                    const demFilt = demandas.filter(d => {
                      const dt = d.createdAt?.slice(0, 10)
                      if (histDe  && dt < histDe)  return false
                      if (histAte && dt > histAte) return false
                      return true
                    })
                    if (demFilt.length === 0) return (
                      <p className="text-center text-gray-400 text-sm py-8">
                        {(histDe || histAte) ? 'Nenhuma demanda no período selecionado' : 'Nenhuma demanda registrada'}
                      </p>
                    )
                    return (
                      <div className="overflow-hidden rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              {['Descrição','Pedido','Itens','R$/item','Total','Status','Data'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs text-gray-400 font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {demFilt.map(d => (
                              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-3 py-2.5 text-gray-700 max-w-32 truncate" title={d.nomeProduto || ''}>{d.nomeProduto || '—'}</td>
                                <td className="px-3 py-2.5 text-gray-400 text-xs">{d.pedidoRef || '—'}</td>
                                <td className="px-3 py-2.5 text-center font-mono">{d.qtdSolicitada}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-gray-600">{fmtR(d.valorPorItem)}</td>
                                <td className="px-3 py-2.5 text-right font-mono font-semibold">
                                  {d.status === 'PAGO'
                                    ? <span className="text-green-600">{fmtR(d.valorTotal)}</span>
                                    : fmtR(d.valorPorItem * d.qtdSolicitada)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COR[d.status] || STATUS_COR.PENDENTE}`}>
                                    {d.status === 'PAGO' ? '✓ Pago' : d.status === 'EM_PRODUCAO' ? 'Em produção' : d.status === 'PRODUZIDO' ? 'Produzido' : 'Pendente'}
                                  </span>
                                  {d.dataPagamento && <p className="text-xs text-gray-400">{fmtData(d.dataPagamento)}</p>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtData(d.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}

                    {/* Aba Pedidos */}
                  {abaHist === 'pedidos' && (
                    pedidos.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-8">Nenhum pedido vinculado</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              {['Nº Pedido','Cliente','Produto','Qtd','Status','Envio'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-xs text-gray-400 font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pedidos.map(p => (
                              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-3 py-2.5 font-mono text-xs text-orange-600">#{p.numero}</td>
                                <td className="px-3 py-2.5 text-gray-700 max-w-28 truncate">{p.destinatario}</td>
                                <td className="px-3 py-2.5 text-gray-500 text-xs max-w-36 truncate" title={p.produto}>{p.produto}</td>
                                <td className="px-3 py-2.5 text-center">{p.quantidade}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    p.status === 'CONCLUIDO' ? 'bg-green-50 text-green-700' :
                                    p.status === 'EM_PRODUCAO' ? 'bg-orange-50 text-orange-700' :
                                    'bg-blue-50 text-blue-700'
                                  }`}>{p.status === 'CONCLUIDO' ? 'Concluído' : p.status === 'EM_PRODUCAO' ? 'Em produção' : 'Aberto'}</span>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-gray-400">{fmtData(p.dataEnvio)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* Info PIX */}
                  {histFre.pix && (
                    <div className="mt-4 bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3">
                      <QrCode size={16} className="text-green-600 flex-shrink-0"/>
                      <div>
                        <p className="text-xs font-semibold text-green-700">PIX para pagamento</p>
                        <p className="text-sm text-green-900 font-mono">{histFre.pix}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
