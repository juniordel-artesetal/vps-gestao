'use client'

import { useState, useEffect } from 'react'

interface Material {
  id: string
  nome: string
  unidade: string
  precoPacote: number
  qtdPacote: number
  precoUnidade: number
  fornecedor: string | null
}

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
const UNIDADES = ['unidade', 'metros', 'gramas', 'folha', 'pacote', 'rolo', 'kg', 'litro']

function fmtBRL(n: number, decimais = 2) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })
}

export default function MateriaisPage() {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [busca, setBusca]         = useState('')
  const [form, setForm] = useState({
    nome: '', unidade: 'unidade', precoPacote: '', qtdPacote: '', fornecedor: '',
  })

  async function load() {
    setLoading(true)
    const data = await fetch('/api/precificacao/materiais').then(r => r.json()).catch(() => [])
    setMateriais(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm({ nome: '', unidade: 'unidade', precoPacote: '', qtdPacote: '', fornecedor: '' })
    setEditId(null); setShowForm(true)
  }

  function openEdit(m: Material) {
    setForm({
      nome: m.nome, unidade: m.unidade,
      precoPacote: String(m.precoPacote), qtdPacote: String(m.qtdPacote),
      fornecedor: m.fornecedor || '',
    })
    setEditId(m.id); setShowForm(true)
  }

  async function handleSave() {
    if (!form.nome || !form.precoPacote || !form.qtdPacote) return alert('Nome, preço e quantidade são obrigatórios')
    setSaving(true)
    try {
      const url    = editId ? `/api/precificacao/materiais/${editId}` : '/api/precificacao/materiais'
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowForm(false); load()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este material?')) return
    await fetch(`/api/precificacao/materiais/${id}`, { method: 'DELETE' })
    load()
  }

  const filtered = materiais.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (m.fornecedor || '').toLowerCase().includes(busca.toLowerCase())
  )

  const precoUnidade = form.precoPacote && form.qtdPacote && Number(form.qtdPacote) > 0
    ? Number(form.precoPacote) / Number(form.qtdPacote)
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Materiais</h1>
          <p className="text-gray-500 text-sm mt-1">
            Cadastre as matérias-primas. O rendimento por produto é definido em cada configuração de produto.
          </p>
        </div>
        <button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Novo Material
        </button>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="Buscar por nome ou fornecedor..."
        className={inputClass + ' max-w-sm mb-4'} />

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editId ? 'Editar' : 'Novo'} Material</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  className={inputClass} placeholder="Ex: Papel Offset A4 180g" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unidade de compra</label>
                  <select value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} className={inputClass}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor</label>
                  <input value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))}
                    className={inputClass} placeholder="Opcional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Preço do pacote (R$) *</label>
                  <input type="number" step="0.01" min="0" value={form.precoPacote}
                    onChange={e => setForm(p => ({ ...p, precoPacote: e.target.value }))}
                    className={inputClass} placeholder="Ex: 90,00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Qtd no pacote *</label>
                  <input type="number" step="1" min="1" value={form.qtdPacote}
                    onChange={e => setForm(p => ({ ...p, qtdPacote: e.target.value }))}
                    className={inputClass} placeholder="Ex: 500" />
                </div>
              </div>
              {precoUnidade !== null && (
                <div className="bg-orange-50 rounded-lg px-3 py-2 text-sm text-orange-700 font-medium">
                  Preço por unidade ({form.unidade}): <strong>R$ {precoUnidade.toFixed(4)}</strong>
                </div>
              )}
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                💡 O rendimento (quantos produtos saem de cada unidade) é definido ao adicionar este material em um produto.
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          {busca ? 'Nenhum material encontrado.' : 'Nenhum material cadastrado. Clique em "+ Novo Material" para começar.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase">Material</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase">Fornecedor</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Preço pacote</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Qtd pacote</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Preço / unidade</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} className={'border-b border-gray-50 ' + (i % 2 === 0 ? '' : 'bg-gray-50/40')}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {m.nome}
                    <span className="ml-2 text-xs text-gray-400">({m.unidade})</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.fornecedor || '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">R$ {fmtBRL(Number(m.precoPacote))}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{Number(m.qtdPacote).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-center font-bold text-orange-600">
                    R$ {fmtBRL(Number(m.precoUnidade), 4)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => openEdit(m)} className="text-xs text-blue-500 hover:underline">Editar</button>
                      <button onClick={() => handleDelete(m.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
