'use client'
// Contas pessoais (CRUD + saldo). Escopo por usuário (server).
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, X, Wallet } from 'lucide-react'

const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
function parseNum(s: unknown) { let x = String(s ?? '').trim(); if (!x) return 0; if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); const n = parseFloat(x); return isNaN(n) ? 0 : n }
const numStr = (n: number | undefined | null) => (n == null || n === 0 ? '' : String(n).replace('.', ','))
const TIPOS = ['Conta corrente', 'Poupança', 'Carteira', 'Dinheiro', 'Investimento']
const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
interface C { id: string; nome: string; tipo?: string; instituicao?: string; saldoInicial: number; saldo: number; cor?: string; ativo: boolean }

export default function ContasPage() {
  const [rows, setRows] = useState<C[]>([]); const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [edit, setEdit] = useState<C | null>(null)
  const [form, setForm] = useState<any>({ ativo: true }); const [saldoStr, setSaldoStr] = useState('')

  const carregar = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/pessoal/contas'); setRows(r.ok ? await r.json() : []) } finally { setLoading(false) } }, [])
  useEffect(() => { carregar() }, [carregar])
  const total = rows.reduce((s, c) => s + (c.saldo || 0), 0)

  function novo() { setEdit(null); setForm({ ativo: true, tipo: 'Conta corrente' }); setSaldoStr(''); setModal(true) }
  function editar(c: C) { setEdit(c); setForm({ ...c }); setSaldoStr(numStr(c.saldoInicial)); setModal(true) }
  async function salvar() {
    if (!form.nome?.trim()) return alert('Informe o nome.')
    const body = { ...form, saldoInicial: parseNum(saldoStr) }
    await fetch(edit ? `/api/pessoal/contas/${edit.id}` : '/api/pessoal/contas', { method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setModal(false); carregar()
  }
  async function excluir(c: C) { if (!confirm(`Excluir "${c.nome}"? Os lançamentos ficam sem conta.`)) return; await fetch(`/api/pessoal/contas/${c.id}`, { method: 'DELETE' }); carregar() }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Link href="/pessoal/financeiro" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Minhas Contas</h1></div>
        <button onClick={novo} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"><Plus className="w-4 h-4" /> Nova</button>
      </div>
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/15 p-4 flex items-center gap-3"><Wallet className="w-6 h-6 text-indigo-500" /><div><p className="text-xs text-indigo-500">Saldo total</p><p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{fmt(total)}</p></div></div>
      {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map(c => (
            <div key={c.id} className={`rounded-2xl border p-4 bg-white dark:bg-neutral-900 ${c.ativo ? 'border-gray-100 dark:border-neutral-800' : 'border-gray-100 dark:border-neutral-800 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: c.cor || '#6366f1' }} /><div><p className="font-semibold text-gray-800 dark:text-neutral-100">{c.nome}</p><p className="text-[11px] text-gray-400">{c.tipo || '—'}{c.instituicao ? ` · ${c.instituicao}` : ''}</p></div></div>
                <div className="flex gap-1"><button onClick={() => editar(c)} className="p-1 text-gray-400 hover:text-orange-500"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => excluir(c)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
              </div>
              <p className={`text-xl font-bold mt-2 ${c.saldo >= 0 ? 'text-gray-800 dark:text-neutral-100' : 'text-red-600'}`}>{fmt(c.saldo)}</p>
            </div>
          ))}
          {rows.length === 0 && <p className="text-gray-400 text-sm col-span-2 text-center py-6">Nenhuma conta. Crie a primeira.</p>}
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800 dark:text-neutral-100">{edit ? 'Editar' : 'Nova'} conta</h2><button onClick={() => setModal(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <input value={form.nome || ''} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: Nubank) *" className={inp} />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.tipo || ''} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={inp}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <input value={form.instituicao || ''} onChange={e => setForm((f: any) => ({ ...f, instituicao: e.target.value }))} placeholder="Instituição" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <input type="text" inputMode="decimal" value={saldoStr} onChange={e => setSaldoStr(e.target.value)} placeholder="Saldo inicial (0,00)" className={inp} />
              <input type="color" value={form.cor || '#6366f1'} onChange={e => setForm((f: any) => ({ ...f, cor: e.target.value }))} className="w-full h-9 rounded-lg border border-gray-200 dark:border-neutral-700" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-neutral-300"><input type="checkbox" checked={form.ativo !== false} onChange={e => setForm((f: any) => ({ ...f, ativo: e.target.checked }))} className="accent-orange-500" /> Conta ativa</label>
            <div className="flex justify-end gap-2"><button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button><button onClick={salvar} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Salvar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
