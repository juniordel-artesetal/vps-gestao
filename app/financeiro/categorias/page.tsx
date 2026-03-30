'use client'
// app/financeiro/categorias/page.tsx
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

interface Categoria { id: string; nome: string; tipo: string; cor: string; icone: string }

const ICONES = ['🛍️','🛒','🟡','🎨','💰','📦','📫','💸','🚚','🔧','📣','📋','💼','🏷️','🎁','⚡','🌟','🎯']
const CORES  = ['#16a34a','#f97316','#eab308','#3b82f6','#06b6d4','#f97316','#ec4899','#dc2626','#ef4444','#64748b','#78716c','#6b7280']

export default function CategoriasPage() {
  const [cats, setCats]         = useState<Categoria[]>([])
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState('')

  // Modal de edição/criação
  const [modal, setModal]       = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [nome,   setNome]       = useState('')
  const [tipo,   setTipo]       = useState<'RECEITA'|'DESPESA'>('RECEITA')
  const [corIdx, setCorIdx]     = useState(5)   // índice em CORES
  const [iconeIdx, setIconeIdx] = useState(0)   // índice em ICONES

  // Confirmação de exclusão inline
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  // ── helpers
  const corAtual   = CORES[corIdx]   ?? '#f97316'
  const iconeAtual = ICONES[iconeIdx] ?? '📁'

  const fetchCats = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/financeiro/categorias')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setCats(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setErro('Erro ao carregar categorias: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCats() }, [])

  // ── Abrir modal
  const openModal = (cat?: Categoria) => {
    if (cat) {
      setEditId(cat.id)
      setNome(cat.nome || '')
      setTipo((cat.tipo as 'RECEITA'|'DESPESA') || 'RECEITA')
      // Encontra o índice da cor
      const ci = CORES.indexOf(cat.cor)
      setCorIdx(ci >= 0 ? ci : 5)
      // Encontra o índice do ícone (normaliza para evitar bug de Unicode)
      const ii = ICONES.findIndex(ic => ic.normalize() === (cat.icone || '').normalize())
      setIconeIdx(ii >= 0 ? ii : 0)
    } else {
      setEditId(null)
      setNome('')
      setTipo('RECEITA')
      setCorIdx(5)
      setIconeIdx(0)
    }
    setModal(true)
  }

  const closeModal = () => { setModal(false); setEditId(null) }

  // ── Salvar
  const handleSave = async () => {
    if (!nome.trim()) return alert('Nome é obrigatório')
    setSaving(true)
    try {
      const body = { nome: nome.trim(), tipo, cor: corAtual, icone: iconeAtual }
      const url    = editId ? `/api/financeiro/categorias/${editId}` : '/api/financeiro/categorias'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || `HTTP ${res.status}`)
      }
      closeModal()
      await fetchCats()
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Excluir (confirmação inline)
  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/financeiro/categorias/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || `HTTP ${res.status}`)
      }
      setConfirmId(null)
      await fetchCats()
    } catch (e: any) {
      alert('Erro ao excluir: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  const receitas = cats.filter(c => c.tipo === 'RECEITA')
  const despesas = cats.filter(c => c.tipo === 'DESPESA')

  return (
    <div className="p-6 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Categorias</h1>
          <p className="text-sm text-gray-500">Plano de contas do ateliê</p>
        </div>
        <button type="button" onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{erro}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
      )}

      {/* Grid */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[
            { label: '📈 Receitas', list: receitas, bg: 'bg-green-500' },
            { label: '📉 Despesas', list: despesas, bg: 'bg-red-500'   },
          ].map(({ label, list, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={`${bg} text-white px-5 py-3`}>
                <h2 className="font-semibold text-sm">{label}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {list.length === 0 && (
                  <p className="text-center py-8 text-gray-400 text-sm">Nenhuma categoria</p>
                )}
                {list.map(c => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: (c.cor || '#f97316') + '20' }}>
                          {c.icone}
                        </span>
                        <p className="text-sm font-medium text-gray-800">{c.nome}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button"
                          onClick={() => { setConfirmId(null); openModal(c) }}
                          className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button"
                          onClick={() => setConfirmId(confirmId === c.id ? null : c.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Confirmação inline de exclusão */}
                    {confirmId === c.id && (
                      <div className="mx-5 mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-red-700">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          Excluir <strong>{c.nome}</strong>?
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setConfirmId(null)}
                            className="px-3 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">
                            Cancelar
                          </button>
                          <button type="button" onClick={() => handleDelete(c.id)} disabled={deleting}
                            className="px-3 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                            {deleting ? '...' : 'Excluir'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{editId ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button type="button" onClick={closeModal}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Tipo */}
              <div className="flex gap-3">
                {(['RECEITA', 'DESPESA'] as const).map(t => (
                  <button type="button" key={t} onClick={() => setTipo(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      tipo === t
                        ? t === 'RECEITA' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {t === 'RECEITA' ? '↑ Receita' : '↓ Despesa'}
                  </button>
                ))}
              </div>

              {/* Nome */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nome *</label>
                <input value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Shopee, Materiais..." className={inputClass} />
              </div>

              {/* Ícone — seleção por índice */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">
                  Ícone — <span className="text-lg">{iconeAtual}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICONES.map((ic, idx) => (
                    <button type="button" key={idx} onClick={() => setIconeIdx(idx)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${
                        iconeIdx === idx ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-300'
                      }`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor — seleção por índice */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">
                  Cor — <span className="font-mono text-xs">{corAtual}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CORES.map((c, idx) => (
                    <button type="button" key={idx} onClick={() => setCorIdx(idx)}
                      className={`w-7 h-7 rounded-full border-4 transition-all ${
                        corIdx === idx ? 'border-gray-500 scale-125' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ background: c }} />
                  ))}
                </div>

                {/* Preview ao vivo */}
                <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                    style={{ background: corAtual + '20' }}>
                    {iconeAtual}
                  </span>
                  <span className="text-sm font-medium" style={{ color: corAtual }}>
                    {nome || 'Preview da categoria'}
                  </span>
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
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
