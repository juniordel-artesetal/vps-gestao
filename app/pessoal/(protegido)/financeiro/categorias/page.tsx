'use client'
// Categorias pessoais (CRUD RECEITA/DESPESA, cor + ícone).
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react'

const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
const ICONES = ['💰', '🍔', '🏠', '🚗', '🛒', '💊', '🎬', '✈️', '📚', '💡', '📱', '🎁', '💳', '🐶', '💅', '🏋️']
interface Cat { id: string; nome: string; tipo: string; cor: string; icone: string }

export default function CategoriasPage() {
  const [rows, setRows] = useState<Cat[]>([]); const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [edit, setEdit] = useState<Cat | null>(null)
  const [form, setForm] = useState<any>({ tipo: 'DESPESA', cor: '#f97316', icone: '💰' })
  const carregar = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/pessoal/financeiro/categorias'); setRows(r.ok ? await r.json() : []) } finally { setLoading(false) } }, [])
  useEffect(() => { carregar() }, [carregar])

  function novo() { setEdit(null); setForm({ tipo: 'DESPESA', cor: '#f97316', icone: '💰' }); setModal(true) }
  function editar(c: Cat) { setEdit(c); setForm({ ...c }); setModal(true) }
  async function salvar() { if (!form.nome?.trim()) return alert('Informe o nome.'); await fetch(edit ? `/api/pessoal/financeiro/categorias/${edit.id}` : '/api/pessoal/financeiro/categorias', { method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setModal(false); carregar() }
  async function excluir(c: Cat) { if (!confirm(`Excluir "${c.nome}"?`)) return; await fetch(`/api/pessoal/financeiro/categorias/${c.id}`, { method: 'DELETE' }); carregar() }
  const receitas = rows.filter(r => r.tipo === 'RECEITA'); const despesas = rows.filter(r => r.tipo === 'DESPESA')

  const Grupo = ({ titulo, lista }: { titulo: string; lista: Cat[] }) => (
    <div><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{titulo}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {lista.map(c => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ background: (c.cor || '#999') + '22' }}>{c.icone}</span>
            <span className="flex-1 text-sm text-gray-700 dark:text-neutral-200 truncate">{c.nome}</span>
            <button onClick={() => editar(c)} className="p-0.5 text-gray-300 hover:text-orange-500"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => excluir(c)} className="p-0.5 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {lista.length === 0 && <p className="text-xs text-gray-400 col-span-3">Nenhuma.</p>}
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Link href="/pessoal/financeiro" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Categorias</h1></div>
        <button onClick={novo} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"><Plus className="w-4 h-4" /> Nova</button>
      </div>
      {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : <><Grupo titulo="Receitas" lista={receitas} /><Grupo titulo="Despesas" lista={despesas} /></>}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800 dark:text-neutral-100">{edit ? 'Editar' : 'Nova'} categoria</h2><button onClick={() => setModal(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="flex gap-2">{(['RECEITA', 'DESPESA'] as const).map(t => <button key={t} onClick={() => setForm((f: any) => ({ ...f, tipo: t }))} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${form.tipo === t ? (t === 'RECEITA' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700') : 'border-gray-200 dark:border-neutral-700 text-gray-500'}`}>{t === 'RECEITA' ? 'Receita' : 'Despesa'}</button>)}</div>
            <input value={form.nome || ''} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} placeholder="Nome *" className={inp} />
            <div className="flex items-center gap-3"><input type="color" value={form.cor || '#f97316'} onChange={e => setForm((f: any) => ({ ...f, cor: e.target.value }))} className="w-12 h-9 rounded-lg border border-gray-200 dark:border-neutral-700" /><div className="flex flex-wrap gap-1">{ICONES.map(ic => <button key={ic} onClick={() => setForm((f: any) => ({ ...f, icone: ic }))} className={`w-7 h-7 rounded-lg text-sm ${form.icone === ic ? 'bg-orange-100 ring-2 ring-orange-400' : 'hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>{ic}</button>)}</div></div>
            <div className="flex justify-end gap-2"><button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button><button onClick={salvar} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Salvar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
