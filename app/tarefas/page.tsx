'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Plus, Trash2, Pencil, X } from 'lucide-react'

type Quadro = { id: string; nome: string; cor: string | null; nTarefas: number }
const CORES = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#ef4444', '#64748b']

export default function TarefasHub() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [quadros, setQuadros] = useState<Quadro[]>([])
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', cor: CORES[0] })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role === 'OPERADOR') router.push('/modulos')
    if (status === 'authenticated') carregar()
  }, [status])

  async function carregar() {
    try { setQuadros(await (await fetch('/api/tarefas/quadros')).json()) } finally { setLoading(false) }
  }

  function abrirNovo() { setEditId(null); setForm({ nome: '', cor: CORES[0] }); setModal(true) }
  function abrirEditar(q: Quadro) { setEditId(q.id); setForm({ nome: q.nome, cor: q.cor || CORES[0] }); setModal(true) }

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    try {
      if (editId) await fetch(`/api/tarefas/quadros/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      else await fetch('/api/tarefas/quadros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setModal(false); carregar()
    } finally { setSalvando(false) }
  }

  async function excluir(q: Quadro) {
    if (!confirm(`Excluir o quadro "${q.nome}" e todas as suas tarefas?`)) return
    await fetch(`/api/tarefas/quadros/${q.id}`, { method: 'DELETE' })
    carregar()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tarefas</h1>
          </div>
          <button onClick={abrirNovo} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <Plus size={15} /> Novo quadro
          </button>
        </div>

        {quadros.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Nenhum quadro ainda. Crie o primeiro para organizar suas tarefas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quadros.map(q => (
              <div key={q.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden group">
                <button onClick={() => router.push(`/tarefas/${q.id}`)} className="w-full text-left">
                  <div className="h-2" style={{ backgroundColor: q.cor || '#f97316' }} />
                  <div className="p-4">
                    <p className="font-semibold text-gray-800 dark:text-white truncate">{q.nome}</p>
                    <p className="text-xs text-gray-400 mt-1">{q.nTarefas} tarefa{q.nTarefas !== 1 ? 's' : ''}</p>
                  </div>
                </button>
                <div className="px-4 pb-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => abrirEditar(q)} className="text-xs text-blue-500 hover:underline flex items-center gap-1"><Pencil size={11} /> Editar</button>
                  <button onClick={() => excluir(q)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 size={11} /> Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 dark:text-white">{editId ? 'Editar quadro' : 'Novo quadro'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400"><X size={18} /></button>
            </div>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do quadro"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400" autoFocus />
            <div className="flex gap-2 mb-4">
              {CORES.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, cor: c }))}
                  className={`w-7 h-7 rounded-full ${form.cor === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <button onClick={salvar} disabled={salvando || !form.nome.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
              {salvando ? 'Salvando...' : editId ? 'Salvar' : 'Criar quadro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
