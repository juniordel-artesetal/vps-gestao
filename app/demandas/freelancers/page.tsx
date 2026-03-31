'use client'
import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, X, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Freelancer {
  id: string; nome: string; telefone: string | null; pix: string | null
  especialidade: string | null; observacoes: string | null; ativo: boolean; createdAt: string
}

const inputClass = "w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white"

export default function FreelancersPage() {
  const [lista, setLista]       = useState<Freelancer[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', pix: '', especialidade: '', observacoes: '' })

  const carregar = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/demandas/freelancers?todos=1')
    const data = await res.json()
    setLista(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditId(null)
    setForm({ nome: '', telefone: '', pix: '', especialidade: '', observacoes: '' })
    setModal(true)
  }

  function abrirEditar(f: Freelancer) {
    setEditId(f.id)
    setForm({ nome: f.nome, telefone: f.telefone || '', pix: f.pix || '', especialidade: f.especialidade || '', observacoes: f.observacoes || '' })
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return alert('Nome é obrigatório')
    setSalvando(true)
    const url    = editId ? `/api/demandas/freelancers/${editId}` : '/api/demandas/freelancers'
    const method = editId ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setModal(false)
    setSalvando(false)
    carregar()
  }

  async function handleToggle(f: Freelancer) {
    await fetch(`/api/demandas/freelancers/${f.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !f.ativo }),
    })
    carregar()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este freelancer? Demandas vinculadas não serão afetadas.')) return
    await fetch(`/api/demandas/freelancers/${id}`, { method: 'DELETE' })
    carregar()
  }

  const ativos   = lista.filter(f => f.ativo).length
  const inativos = lista.filter(f => !f.ativo).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />Freelancers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {ativos} ativo{ativos !== 1 ? 's' : ''}{inativos > 0 ? ` · ${inativos} inativo${inativos !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
          <Plus className="w-4 h-4" />Novo Freelancer
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-3">Nenhum freelancer cadastrado.</p>
            <button onClick={abrirNovo}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              <Plus className="w-4 h-4" />Cadastrar primeiro freelancer
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {lista.map(f => (
              <div key={f.id} className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${!f.ativo ? 'opacity-50' : ''}`}>
                {/* Avatar inicial */}
                <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {f.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{f.nome}</span>
                    {!f.ativo && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">Inativo</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-0.5">
                    {f.especialidade && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">{f.especialidade}</span>
                    )}
                    {f.telefone && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">📱 {f.telefone}</span>
                    )}
                    {f.pix && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">🔑 PIX: {f.pix}</span>
                    )}
                  </div>
                  {f.observacoes && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{f.observacoes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleToggle(f)} title={f.ativo ? 'Desativar' : 'Ativar'}
                    className="text-gray-400 hover:text-orange-500 transition-colors">
                    {f.ativo
                      ? <ToggleRight className="w-5 h-5 text-green-500" />
                      : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => abrirEditar(f)} title="Editar"
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(f.id)} title="Excluir"
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {editId ? 'Editar Freelancer' : 'Novo Freelancer'}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nome <span className="text-red-400">*</span></label>
                <input className={inputClass} placeholder="Ex: Maria da Silva"
                  value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} autoFocus />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Especialidade <span className="text-gray-400">(opcional)</span></label>
                <input className={inputClass} placeholder="Ex: Laços, Costura, Pintura..."
                  value={form.especialidade} onChange={e => setForm(p => ({ ...p, especialidade: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Telefone / WhatsApp</label>
                  <input className={inputClass} placeholder="(11) 99999-9999"
                    value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Chave PIX</label>
                  <input className={inputClass} placeholder="CPF, e-mail, celular..."
                    value={form.pix} onChange={e => setForm(p => ({ ...p, pix: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Observações <span className="text-gray-400">(opcional)</span></label>
                <textarea className={inputClass} rows={2} placeholder="Notas sobre este freelancer..."
                  value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setModal(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={salvando || !form.nome.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {salvando ? 'Salvando...' : editId ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
