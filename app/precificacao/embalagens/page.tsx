'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, X, Package } from 'lucide-react'

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}
function fmtR2(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Material { id: string; nome: string; precoUnidade: number; unidade: string }
interface EmbItem { materialId: string | null; nomeMaterial: string; qtdUsada: number; custoUnit: number; rendimento: number }
interface Embalagem { id: string; nome: string; descricao?: string; custoTotal: number; itens: EmbItem[] }

const ITEM_VAZIO: EmbItem = { materialId: null, nomeMaterial: '', qtdUsada: 1, custoUnit: 0, rendimento: 1 }

export default function EmbalagemPage() {
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([])
  const [materiais, setMateriais]   = useState<Material[]>([])
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]           = useState('')
  const [modal, setModal]           = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)

  const [nome, setNome]           = useState('')
  const [descricao, setDescricao] = useState('')
  const [itens, setItens]         = useState<EmbItem[]>([{ ...ITEM_VAZIO }])

  const load = useCallback(async () => {
    setLoading(true)
    const [e, m] = await Promise.all([
      fetch('/api/precificacao/embalagens').then(r => r.json()).catch(() => []),
      fetch('/api/precificacao/materiais').then(r => r.json()).catch(() => []),
    ])
    setEmbalagens(Array.isArray(e) ? e : [])
    setMateriais(Array.isArray(m) ? m : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const custoCalc = itens.reduce((s, item) => {
    const rend = Math.max(Number(item.rendimento) || 1, 0.0001)
    return s + (Number(item.qtdUsada) * Number(item.custoUnit)) / rend
  }, 0)

  const openModal = (emb?: Embalagem) => {
    if (emb) {
      setEditId(emb.id)
      setNome(emb.nome)
      setDescricao(emb.descricao || '')
      setItens(emb.itens.length > 0 ? emb.itens.map(i => ({ ...i })) : [{ ...ITEM_VAZIO }])
    } else {
      setEditId(null)
      setNome('')
      setDescricao('')
      setItens([{ ...ITEM_VAZIO }])
    }
    setModal(true)
  }

  const closeModal = () => {
    setModal(false)
    setEditId(null)
    setNome('')
    setDescricao('')
    setItens([{ ...ITEM_VAZIO }])
  }

  const selMaterial = (idx: number, matId: string) => {
    const mat = materiais.find(m => m.id === matId)
    setItens(prev => {
      const u = [...prev]
      u[idx] = { ...u[idx], materialId: matId, nomeMaterial: mat?.nome || '', custoUnit: Number(mat?.precoUnidade || 0) }
      return u
    })
  }

  const updateItem = (idx: number, field: keyof EmbItem, value: any) => {
    setItens(prev => {
      const u = [...prev]
      u[idx] = { ...u[idx], [field]: value }
      return u
    })
  }

  const handleSave = async () => {
    if (!nome.trim()) return alert('Nome é obrigatório')
    if (itens.some(i => !i.nomeMaterial)) return alert('Preencha o nome de todos os materiais')
    setSaving(true)
    try {
      const url    = editId ? `/api/precificacao/embalagens/${editId}` : '/api/precificacao/embalagens'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), descricao: descricao.trim(), itens }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }
      closeModal()
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/precificacao/embalagens/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir')
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setConfirmDelId(null)
      load()
    }
  }

  const filtered = embalagens.filter(e =>
    e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (e.descricao || '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Embalagens</h1>
          <p className="text-gray-500 text-sm mt-1">Crie embalagens compostas por múltiplos materiais</p>
        </div>
        <button type="button" onClick={() => openModal()}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova Embalagem
        </button>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="Buscar embalagem..." className={inputClass + ' max-w-sm mb-4'} />

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          {busca ? 'Nenhuma embalagem encontrada.' : 'Nenhuma embalagem cadastrada.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Embalagem</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Materiais</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Custo Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emb => (
                <tr key={emb.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <span className="font-medium text-gray-800">{emb.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{emb.descricao || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                      {emb.itens.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-orange-600">{fmtR2(emb.custoTotal)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button type="button" onClick={() => openModal(emb)} className="text-xs text-blue-500 hover:underline">Editar</button>
                      {confirmDelId === emb.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-600 font-medium">Confirmar?</span>
                          <button type="button" onClick={() => handleDelete(emb.id)} className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600">Sim</button>
                          <button type="button" onClick={() => setConfirmDelId(null)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded">Não</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelId(emb.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-800">{editId ? 'Editar' : 'Nova'} Embalagem</h2>
              <button type="button" onClick={closeModal}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                  <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Embalagem Kit 10" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
                  <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Saco + Fita" className={inputClass} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">Materiais da embalagem</label>
                  <button type="button" onClick={() => setItens(prev => [...prev, { ...ITEM_VAZIO }])}
                    className="text-xs text-orange-500 hover:underline">+ Adicionar material</button>
                </div>

                {/* Cabeçalho das colunas */}
                <div className="grid grid-cols-12 gap-2 px-3 mb-1">
                  <div className="col-span-5 text-xs text-gray-400">Material</div>
                  <div className="col-span-2 text-xs text-gray-400 text-center">Qtd usada</div>
                  <div className="col-span-2 text-xs text-gray-400 text-center">Rendimento</div>
                  <div className="col-span-2 text-xs text-gray-400 text-right">Custo</div>
                  <div className="col-span-1" />
                </div>

                <div className="space-y-2">
                  {itens.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <select
                            value={item.materialId || ''}
                            onChange={e => e.target.value ? selMaterial(idx, e.target.value) : null}
                            className={inputClass + ' bg-white text-xs'}
                          >
                            <option value="">Selecionar material...</option>
                            {materiais.map(m => (
                              <option key={m.id} value={m.id}>{m.nome} ({m.unidade})</option>
                            ))}
                          </select>
                        </div>

                        {/* CORRIGIDO: step="1" — sobe/desce em inteiros */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={item.qtdUsada}
                            onChange={e => updateItem(idx, 'qtdUsada', Number(e.target.value))}
                            className={inputClass + ' text-xs text-center'}
                            placeholder="Qtd"
                          />
                        </div>

                        {/* CORRIGIDO: step="1" — rendimento em inteiros (unidades do pacote) */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={item.rendimento}
                            onChange={e => updateItem(idx, 'rendimento', Number(e.target.value))}
                            className={inputClass + ' text-xs text-center'}
                            placeholder="Rend."
                          />
                        </div>

                        <div className="col-span-2 text-right">
                          <p className="text-xs font-semibold text-orange-600">
                            {fmtR((Number(item.qtdUsada) * Number(item.custoUnit)) / Math.max(Number(item.rendimento) || 1, 0.0001))}
                          </p>
                          <p className="text-xs text-gray-400">{fmtR(item.custoUnit)}/un</p>
                        </div>

                        <div className="col-span-1 flex justify-center">
                          {itens.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setItens(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {item.nomeMaterial && (
                        <p className="text-xs text-gray-400 mt-1 pl-1">{item.nomeMaterial}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600 font-medium">Custo total da embalagem</p>
                  <p className="text-xs text-gray-400">Custo fixo por venda</p>
                </div>
                <p className="text-xl font-bold text-orange-600">{fmtR2(custoCalc)}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Embalagem'}
              </button>
              <button type="button" onClick={closeModal}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
