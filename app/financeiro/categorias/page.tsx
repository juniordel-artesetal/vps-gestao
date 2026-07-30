'use client'
// app/financeiro/categorias/page.tsx — plano de contas em árvore (conta > subconta)
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, AlertTriangle, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react'

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

interface Sub { id: string; nome: string; cor: string | null; icone: string | null; grupoDRE: string | null }
interface Conta { id: string; nome: string; tipo: string; cor: string | null; icone: string | null; grupoDRE: string | null; subcontas: Sub[] }

const ICONES = ['🛍️','🛒','🟡','🎨','💰','📦','📫','💸','🚚','🔧','📣','📋','💼','🏷️','🎁','⚡','🌟','🎯']
const CORES  = ['#16a34a','#f97316','#eab308','#3b82f6','#06b6d4','#f97316','#ec4899','#dc2626','#ef4444','#64748b','#78716c','#6b7280']

export default function CategoriasPage() {
  const [arvore, setArvore]     = useState<Conta[]>([])
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState('')
  const [semeando, setSemeando] = useState(false)
  const [fechadas, setFechadas] = useState<Set<string>>(new Set())

  // Modal
  const [modal, setModal]       = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)   // criando/editando subconta
  const [parentNome, setParentNome] = useState('')
  const [saving, setSaving]     = useState(false)
  const [nome,   setNome]       = useState('')
  const [tipo,   setTipo]       = useState<'RECEITA'|'DESPESA'>('RECEITA')
  const [tipoTravado, setTipoTravado] = useState(false)  // subconta herda o tipo da conta
  const [corIdx, setCorIdx]     = useState(1)
  const [iconeIdx, setIconeIdx] = useState(0)

  const [confirm, setConfirm]   = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const corAtual   = CORES[corIdx]   ?? '#f97316'
  const iconeAtual = ICONES[iconeIdx] ?? '📁'

  const fetchArvore = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/financeiro/categorias?arvore=1')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setArvore(Array.isArray(d.contas) ? d.contas : [])
    } catch (e: any) { setErro('Erro ao carregar: ' + e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchArvore() }, [])

  // ── Abrir modal
  function novaConta(t: 'RECEITA'|'DESPESA') {
    setEditId(null); setParentId(null); setParentNome(''); setTipoTravado(false)
    setNome(''); setTipo(t); setCorIdx(1); setIconeIdx(0); setModal(true)
  }
  function novaSubconta(conta: Conta) {
    setEditId(null); setParentId(conta.id); setParentNome(conta.nome); setTipoTravado(true)
    setNome(''); setTipo(conta.tipo as 'RECEITA'|'DESPESA'); setCorIdx(1); setIconeIdx(0); setModal(true)
  }
  function editar(cat: { id: string; nome: string; tipo?: string; cor: string | null; icone: string | null }, ehSub: boolean, contaTipo?: string, contaNome?: string) {
    setEditId(cat.id); setParentId(ehSub ? (parentId) : null); setParentNome(ehSub ? (contaNome || '') : '')
    setTipoTravado(ehSub); setNome(cat.nome || ''); setTipo(((cat.tipo || contaTipo) as 'RECEITA'|'DESPESA') || 'RECEITA')
    setCorIdx(Math.max(0, CORES.indexOf(cat.cor || '')))
    const ii = ICONES.findIndex(ic => ic.normalize() === (cat.icone || '').normalize())
    setIconeIdx(ii >= 0 ? ii : 0); setModal(true)
  }
  const closeModal = () => { setModal(false); setEditId(null); setParentId(null) }

  async function handleSave() {
    if (!nome.trim()) return alert('Nome é obrigatório')
    setSaving(true)
    try {
      const url    = editId ? `/api/financeiro/categorias/${editId}` : '/api/financeiro/categorias'
      const method = editId ? 'PUT' : 'POST'
      const body: any = { nome: nome.trim(), tipo, cor: corAtual, icone: iconeAtual }
      if (!editId && parentId) body.parentId = parentId
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
      closeModal(); await fetchArvore()
    } catch (e: any) { alert('Erro ao salvar: ' + e.message) }
    finally { setSaving(false) }
  }

  async function excluir(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/financeiro/categorias/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
      setConfirm(null); await fetchArvore()
    } catch (e: any) { alert(e.message) }
    finally { setDeleting(false) }
  }

  const temPlano = arvore.some(c => c.subcontas.length > 0)
  const grupos = [
    { label: '📈 Receitas', tipo: 'RECEITA', bg: 'bg-green-500' },
    { label: '📉 Despesas', tipo: 'DESPESA', bg: 'bg-red-500' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Plano de contas</h1>
          <p className="text-sm text-gray-500">Organize por conta &gt; subconta e use no lançamento e no DRE.</p>
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{erro}</div>}

      {!loading && !temPlano && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <span className="text-xl">🗂️</span>
          <div className="flex-1 text-sm text-orange-800">
            <b>Comece pelo plano padrão</b> — cria contas e subcontas prontas (ex.: Despesas → Custo da mercadoria → Embalagem).
            Depois é só editar, adicionar ou remover o que quiser.
          </div>
          <button type="button" disabled={semeando}
            onClick={async () => { setSemeando(true); try { const r = await fetch('/api/financeiro/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'semear' }) }); if (r.ok) await fetchArvore() } finally { setSemeando(false) } }}
            className="flex-shrink-0 px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-50">
            {semeando ? 'Criando…' : 'Criar plano padrão'}
          </button>
        </div>
      )}

      {loading && <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {grupos.map(g => {
            const contas = arvore.filter(c => c.tipo === g.tipo)
            return (
              <div key={g.tipo} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className={`${g.bg} text-white px-5 py-3 flex items-center justify-between`}>
                  <h2 className="font-semibold text-sm">{g.label}</h2>
                  <button type="button" onClick={() => novaConta(g.tipo as 'RECEITA'|'DESPESA')}
                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 text-xs font-medium">
                    <Plus className="w-3.5 h-3.5" /> Nova conta
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {contas.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Nenhuma conta ainda</p>}
                  {contas.map(c => {
                    const aberta = !fechadas.has(c.id)
                    return (
                      <div key={c.id}>
                        {/* Linha da CONTA */}
                        <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50">
                          <button type="button" className="flex items-center gap-2 min-w-0 flex-1 text-left"
                            onClick={() => setFechadas(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })}>
                            {c.subcontas.length > 0
                              ? (aberta ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />)
                              : <span className="w-4 flex-shrink-0" />}
                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: (c.cor || '#f97316') + '20' }}>{c.icone}</span>
                            <span className="text-sm font-semibold text-gray-800 truncate">{c.nome}</span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">({c.subcontas.length})</span>
                          </button>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button type="button" title="Adicionar subconta" onClick={() => novaSubconta(c)}
                              className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"><Plus className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Editar conta" onClick={() => { setConfirm(null); editar(c, false) }}
                              className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500"><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Excluir conta" onClick={() => setConfirm(confirm === c.id ? null : c.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>

                        {confirm === c.id && (
                          <Confirmar nome={c.nome} deleting={deleting} onCancel={() => setConfirm(null)} onOk={() => excluir(c.id)} />
                        )}

                        {/* SUBCONTAS */}
                        {aberta && c.subcontas.map(s => (
                          <div key={s.id}>
                            <div className="flex items-center justify-between pl-11 pr-4 py-2 hover:bg-gray-50/50">
                              <div className="flex items-center gap-2 min-w-0">
                                <CornerDownRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                <span className="text-sm">{s.icone}</span>
                                <span className="text-sm text-gray-700 truncate">{s.nome}</span>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button type="button" title="Editar subconta" onClick={() => { setConfirm(null); editar(s, true, c.tipo, c.nome) }}
                                  className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500"><Pencil className="w-3 h-3" /></button>
                                <button type="button" title="Excluir subconta" onClick={() => setConfirm(confirm === s.id ? null : s.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                            {confirm === s.id && (
                              <Confirmar nome={s.nome} deleting={deleting} onCancel={() => setConfirm(null)} onOk={() => excluir(s.id)} />
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editId ? 'Editar' : parentId ? 'Nova subconta' : 'Nova conta'}</h2>
              <button type="button" onClick={closeModal}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {parentId && (
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-500">
                  Subconta de <b className="text-gray-700">{parentNome}</b>
                </div>
              )}
              {!tipoTravado && (
                <div className="flex gap-3">
                  {(['RECEITA', 'DESPESA'] as const).map(t => (
                    <button type="button" key={t} onClick={() => setTipo(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${tipo === t ? (t === 'RECEITA' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700') : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {t === 'RECEITA' ? '↑ Receita' : '↓ Despesa'}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nome *</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder={parentId ? 'Ex: Embalagem, Aluguel…' : 'Ex: Custo da mercadoria…'} className={inputClass} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">Ícone — <span className="text-lg">{iconeAtual}</span></label>
                <div className="flex flex-wrap gap-2">
                  {ICONES.map((ic, idx) => (
                    <button type="button" key={idx} onClick={() => setIconeIdx(idx)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 ${iconeIdx === idx ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}>{ic}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {CORES.map((c, idx) => (
                    <button type="button" key={idx} onClick={() => setCorIdx(idx)}
                      className={`w-7 h-7 rounded-full border-4 ${corIdx === idx ? 'border-gray-500 scale-125' : 'border-transparent hover:scale-110'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Confirmar({ nome, deleting, onCancel, onOk }: { nome: string; deleting: boolean; onCancel: () => void; onOk: () => void }) {
  return (
    <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-red-700 min-w-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Excluir <strong className="truncate">{nome}</strong>?
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button type="button" onClick={onCancel} className="px-3 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">Cancelar</button>
        <button type="button" onClick={onOk} disabled={deleting} className="px-3 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{deleting ? '...' : 'Excluir'}</button>
      </div>
    </div>
  )
}
