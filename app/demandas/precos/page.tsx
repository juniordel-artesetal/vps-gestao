'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Tag, X, Pencil, Trash2, ArrowLeft, Check } from 'lucide-react'

interface Preco {
  id: string
  freelancerId: string | null
  freelancerNome: string | null
  produto: string
  valorUnitario: number
  ativo: boolean
}
interface Freelancer { id: string; nome: string }

const ic = 'w-full border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-800 text-white'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PrecosPage() {
  const [precos, setPrecos]           = useState<Preco[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [loading, setLoading]         = useState(true)
  const [msg, setMsg]                 = useState('')
  const [modal, setModal]             = useState(false)
  const [editando, setEditando]       = useState<Preco | null>(null)
  const [form, setForm]               = useState({ produto: '', valorUnitario: '', freelancerId: '' })

  const feedback = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, fRes] = await Promise.all([
        fetch('/api/demandas/precos').then(r => r.json()).catch(() => []),
        fetch('/api/config/freelancers').then(r => r.json()).catch(() => []),
      ])
      setPrecos(Array.isArray(pRes) ? pRes : [])
      setFreelancers(Array.isArray(fRes) ? fRes : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm({ produto: '', valorUnitario: '', freelancerId: '' })
    setModal(true)
  }
  function abrirEditar(p: Preco) {
    setEditando(p)
    setForm({ produto: p.produto, valorUnitario: String(p.valorUnitario), freelancerId: p.freelancerId || '' })
    setModal(true)
  }

  async function salvar() {
    if (!form.produto.trim()) { feedback('Informe o produto'); return }
    const url    = editando ? `/api/demandas/precos/${editando.id}` : '/api/demandas/precos'
    const method = editando ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        produto: form.produto.trim(),
        valorUnitario: parseFloat(form.valorUnitario) || 0,
        freelancerId: form.freelancerId || null,
      }),
    })
    if (res.ok) {
      feedback(editando ? 'Preço atualizado!' : 'Preço cadastrado!')
      setModal(false); setEditando(null)
      carregar()
    } else {
      const e = await res.json().catch(() => ({})); feedback(e.error || 'Erro ao salvar')
    }
  }

  async function toggleAtivo(p: Preco) {
    await fetch(`/api/demandas/precos/${p.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !p.ativo }),
    })
    carregar()
  }

  async function excluir(p: Preco) {
    if (!confirm(`Excluir o preço de "${p.produto}"?`)) return
    await fetch(`/api/demandas/precos/${p.id}`, { method: 'DELETE' })
    feedback('Preço excluído'); carregar()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <Link href="/demandas" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-1">
            <ArrowLeft size={14} /> Trabalhos
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tag size={20} className="text-orange-400" /> Preços por peça
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Cadastre uma vez o valor pago por peça e reutilize ao lançar um trabalho</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          <Plus size={15} /> Novo preço
        </button>
      </div>

      {msg && (
        <div className="bg-green-900/30 border border-green-700 text-green-300 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <Check size={14} /> {msg}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['PRODUTO', 'VALOR / PEÇA', 'FREELANCER', 'STATUS', 'AÇÕES'].map(h => (
                <th key={h} className="p-3 text-left text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Carregando...</td></tr>
            ) : precos.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum preço cadastrado ainda. Clique em "Novo preço".</td></tr>
            ) : precos.map(p => (
              <tr key={p.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition ${!p.ativo ? 'opacity-50' : ''}`}>
                <td className="p-3 font-medium text-white">{p.produto}</td>
                <td className="p-3 font-mono text-gray-300">{fmtR(p.valorUnitario)}</td>
                <td className="p-3 text-gray-400">{p.freelancerNome || <span className="text-gray-500">Geral (todos)</span>}</td>
                <td className="p-3">
                  <button onClick={() => toggleAtivo(p)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.ativo ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => abrirEditar(p)} title="Editar"
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition"><Pencil size={13} /></button>
                    <button onClick={() => excluir(p)} title="Excluir"
                      className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal novo/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">{editando ? 'Editar preço' : 'Novo preço por peça'}</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Produto *</label>
                <input value={form.produto} onChange={e => setForm(p => ({ ...p, produto: e.target.value }))}
                  className={ic} placeholder="Ex: Laço modelo A, Cofrinho personalizado..." />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Valor por peça (R$)</label>
                <input type="number" step="0.01" min={0} value={form.valorUnitario}
                  onChange={e => setForm(p => ({ ...p, valorUnitario: e.target.value }))} className={ic} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Freelancer (opcional)</label>
                <select value={form.freelancerId} onChange={e => setForm(p => ({ ...p, freelancerId: e.target.value }))} className={ic}>
                  <option value="">Geral — vale para todos</option>
                  {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Deixe "Geral" para um preço padrão, ou escolha um freelancer para um valor específico.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)}
                  className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                <button onClick={salvar}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold">
                  {editando ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
