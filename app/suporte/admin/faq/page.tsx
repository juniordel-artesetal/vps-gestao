'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, Eye, EyeOff, ArrowLeft } from 'lucide-react'

interface Faq {
  id: string
  categoria: string
  pergunta: string
  resposta: string
  ordem: number
  ativo: boolean
}

const CATEGORIAS_OPCOES = [
  'Primeiros Passos',
  'Produção',
  'Precificação',
  'Financeiro',
  'Análise de Gestão',
  'Configurações',
  'Conta e Assinatura',
]

const FORM_VAZIO = { categoria: 'Primeiros Passos', pergunta: '', resposta: '', ordem: 0, ativo: true }

export default function AdminFaqPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [faqs, setFaqs]             = useState<Faq[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState('Todas')
  const [modal, setModal]           = useState(false)
  const [editando, setEditando]     = useState<Faq | null>(null)
  const [form, setForm]             = useState(FORM_VAZIO)
  const [salvando, setSalvando]     = useState(false)
  const [sucesso, setSucesso]       = useState('')
  const [erro, setErro]             = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/suporte')
      else carregarFaqs()
    }
  }, [status])

  async function carregarFaqs() {
    setLoading(true)
    try {
      // Admin carrega todas (incluindo inativas) — ajuste na API se necessário
      const res  = await fetch('/api/suporte/faq')
      const data = await res.json()
      // Também carrega inativas localmente para o admin
      setFaqs(data.faqs || [])
    } catch {
      setErro('Erro ao carregar FAQs')
    } finally {
      setLoading(false)
    }
  }

  function abrirCriar() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setErro('')
    setModal(true)
  }

  function abrirEditar(faq: Faq) {
    setEditando(faq)
    setForm({ categoria: faq.categoria, pergunta: faq.pergunta, resposta: faq.resposta, ordem: faq.ordem, ativo: faq.ativo })
    setErro('')
    setModal(true)
  }

  async function salvar() {
    if (!form.pergunta.trim() || !form.resposta.trim()) {
      setErro('Pergunta e resposta são obrigatórias')
      return
    }
    setSalvando(true)
    setErro('')

    try {
      if (editando) {
        await fetch(`/api/suporte/faq/${editando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        setFaqs(prev => prev.map(f => f.id === editando.id ? { ...f, ...form } : f))
      } else {
        const res  = await fetch('/api/suporte/faq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
        setFaqs(prev => [...prev, { id: data.id, ...form }])
      }
      setModal(false)
      mostrarSucesso(editando ? 'FAQ atualizada!' : 'FAQ criada!')
    } catch {
      setErro('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(faq: Faq) {
    await fetch(`/api/suporte/faq/${faq.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !faq.ativo }),
    })
    setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, ativo: !f.ativo } : f))
    mostrarSucesso(faq.ativo ? 'FAQ desativada' : 'FAQ ativada')
  }

  async function deletar(id: string) {
    await fetch(`/api/suporte/faq/${id}`, { method: 'DELETE' })
    setFaqs(prev => prev.filter(f => f.id !== id))
    setConfirmDelete(null)
    mostrarSucesso('FAQ removida')
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 3000)
  }

  const faqsFiltradas = filtro === 'Todas' ? faqs : faqs.filter(f => f.categoria === filtro)
  const inputClass    = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando FAQs...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/suporte')} className="text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Gerenciar FAQ</h1>
              <p className="text-sm text-gray-500">{faqs.length} perguntas cadastradas</p>
            </div>
          </div>
          <button
            onClick={abrirCriar}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={15} />
            Nova FAQ
          </button>
        </div>

        {/* Alertas */}
        {sucesso && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-green-700">✓ {sucesso}</div>}

        {/* Filtro categoria */}
        <div className="flex gap-2 flex-wrap mb-5">
          {['Todas', ...CATEGORIAS_OPCOES].map(cat => (
            <button
              key={cat}
              onClick={() => setFiltro(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                filtro === cat ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
            >
              {cat}
              {cat !== 'Todas' && (
                <span className="ml-1 opacity-60">({faqs.filter(f => f.categoria === cat).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Pergunta</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-36">Categoria</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-16">Ordem</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-20">Status</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {faqsFiltradas.map(faq => (
                <tr key={faq.id} className={`border-b border-gray-50 hover:bg-gray-50 transition ${!faq.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-800 font-medium">{faq.pergunta}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{faq.resposta}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                      {faq.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{faq.ordem}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleAtivo(faq)} className="transition">
                      {faq.ativo
                        ? <Eye size={15} className="text-green-500 hover:text-gray-400" />
                        : <EyeOff size={15} className="text-gray-300 hover:text-green-500" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => abrirEditar(faq)} className="text-gray-400 hover:text-orange-500 transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(faq.id)} className="text-gray-400 hover:text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {faqsFiltradas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma FAQ nesta categoria</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal criar/editar FAQ */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">{editando ? 'Editar FAQ' : 'Nova FAQ'}</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Categoria</label>
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className={inputClass}>
                  {CATEGORIAS_OPCOES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Pergunta</label>
                <input
                  type="text"
                  value={form.pergunta}
                  onChange={e => setForm(p => ({ ...p, pergunta: e.target.value }))}
                  className={inputClass}
                  placeholder="Como faço para...?"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Resposta</label>
                <textarea
                  value={form.resposta}
                  onChange={e => setForm(p => ({ ...p, resposta: e.target.value }))}
                  rows={6}
                  className={inputClass + ' resize-none'}
                  placeholder="Descreva o passo a passo de forma clara..."
                />
                <p className="text-xs text-gray-400 mt-1">Você pode usar **negrito** e numeração passo a passo.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Ordem de exibição</label>
                <input
                  type="number"
                  value={form.ordem}
                  onChange={e => setForm(p => ({ ...p, ordem: Number(e.target.value) }))}
                  className={inputClass}
                  min={0}
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-1">Menor número aparece primeiro dentro da categoria.</p>
              </div>

              {erro && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

              <div className="flex gap-2 mt-2">
                <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50">
                  {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar FAQ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-sm p-6 text-center">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-gray-900 mb-1">Remover FAQ?</h2>
            <p className="text-sm text-gray-400 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={() => deletar(confirmDelete)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-semibold transition">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
