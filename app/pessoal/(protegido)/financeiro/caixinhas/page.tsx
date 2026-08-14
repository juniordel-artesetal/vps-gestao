'use client'
// Caixinhas pessoais (reservas estilo Nubank): criar, ALOCAR (depositar) e RETIRAR.
// Saldo por caixinha + progresso da meta. Escopo por usuário (server).
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, PiggyBank, ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2, X } from 'lucide-react'

const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
function parseNum(s: unknown) { let x = String(s ?? '').trim(); if (!x) return 0; if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); const n = parseFloat(x); return isNaN(n) ? 0 : n }
const numStr = (n: number | undefined | null) => (n == null || n === 0 ? '' : String(n).replace('.', ','))
const CORES = ['#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#eab308', '#ef4444', '#14b8a6']
const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
interface Cx { id: string; nome: string; cor?: string; meta?: number | null; saldo: number; movimentos: number }
interface Conta { id: string; nome: string }

export default function CaixinhasPage() {
  const [rows, setRows] = useState<Cx[]>([]); const [contas, setContas] = useState<Conta[]>([]); const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [edit, setEdit] = useState<Cx | null>(null)
  const [form, setForm] = useState<any>({ cor: CORES[0] }); const [metaStr, setMetaStr] = useState('')
  const [mov, setMov] = useState<{ cx: Cx; tipo: 'DEPOSITO' | 'RETIRADA' } | null>(null)
  const [movVal, setMovVal] = useState(''); const [movConta, setMovConta] = useState(''); const [movObs, setMovObs] = useState(''); const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/pessoal/caixinhas'); setRows(r.ok ? await r.json() : []) } finally { setLoading(false) } }, [])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { fetch('/api/pessoal/contas').then(r => r.ok ? r.json() : []).then((c: any[]) => setContas(c.map(x => ({ id: x.id, nome: x.nome })))).catch(() => {}) }, [])

  const totalGuardado = rows.reduce((s, c) => s + (c.saldo || 0), 0)

  function novo() { setEdit(null); setForm({ cor: CORES[rows.length % CORES.length] }); setMetaStr(''); setModal(true) }
  function editar(c: Cx) { setEdit(c); setForm({ nome: c.nome, cor: c.cor || CORES[0] }); setMetaStr(numStr(c.meta)); setModal(true) }
  async function salvar() {
    if (!form.nome?.trim()) return alert('Dê um nome à caixinha.')
    const body = { nome: form.nome, cor: form.cor, meta: metaStr.trim() ? parseNum(metaStr) : '' }
    await fetch(edit ? `/api/pessoal/caixinhas/${edit.id}` : '/api/pessoal/caixinhas', { method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setModal(false); carregar()
  }
  async function excluir(c: Cx) { if (!confirm(`Excluir a caixinha "${c.nome}"? O histórico de movimentos vai junto.`)) return; await fetch(`/api/pessoal/caixinhas/${c.id}`, { method: 'DELETE' }); carregar() }

  function abrirMov(cx: Cx, tipo: 'DEPOSITO' | 'RETIRADA') { setMov({ cx, tipo }); setMovVal(''); setMovConta(''); setMovObs('') }
  async function confirmarMov() {
    if (!mov) return
    if (parseNum(movVal) <= 0) return alert('Informe o valor.')
    setSaving(true)
    try {
      const r = await fetch(`/api/pessoal/caixinhas/${mov.cx.id}/movimentar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: mov.tipo, valor: parseNum(movVal), contaId: movConta || null, obs: movObs || null }) })
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || 'Não foi possível concluir.'); return }
      setMov(null); carregar()
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Link href="/pessoal/financeiro" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Caixinhas</h1></div>
        <button onClick={novo} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"><Plus className="w-4 h-4" /> Nova</button>
      </div>

      <div className="rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/15 p-4 flex items-center gap-3">
        <PiggyBank className="w-6 h-6 text-purple-500" /><div><p className="text-xs text-purple-500">Total guardado</p><p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{fmt(totalGuardado)}</p></div>
      </div>

      {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map(c => {
            const meta = c.meta || 0
            const pct = meta > 0 ? Math.min(100, Math.round((c.saldo / meta) * 100)) : 0
            return (
              <div key={c.id} className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: (c.cor || '#8b5cf6') + '22' }}><PiggyBank className="w-4 h-4" style={{ color: c.cor || '#8b5cf6' }} /></span><div><p className="font-semibold text-gray-800 dark:text-neutral-100">{c.nome}</p><p className="text-[11px] text-gray-400">{c.movimentos} mov.</p></div></div>
                  <div className="flex gap-1"><button onClick={() => editar(c)} className="p-1 text-gray-300 hover:text-orange-500"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => excluir(c)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                </div>
                <p className="text-2xl font-bold mt-2 text-gray-800 dark:text-neutral-100 tabular-nums">{fmt(c.saldo)}</p>
                {meta > 0 && (
                  <div className="mt-2">
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.cor || '#8b5cf6' }} /></div>
                    <p className="text-[11px] text-gray-400 mt-1">{pct}% da meta de {fmt(meta)}</p>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => abrirMov(c, 'DEPOSITO')} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"><ArrowDownToLine className="w-3.5 h-3.5" /> Guardar</button>
                  <button onClick={() => abrirMov(c, 'RETIRADA')} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400"><ArrowUpFromLine className="w-3.5 h-3.5" /> Resgatar</button>
                </div>
              </div>
            )
          })}
          {rows.length === 0 && <p className="text-gray-400 text-sm col-span-2 text-center py-6">Nenhuma caixinha. Crie a primeira e comece a guardar. 🐷</p>}
        </div>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800 dark:text-neutral-100">{edit ? 'Editar' : 'Nova'} caixinha</h2><button onClick={() => setModal(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <input value={form.nome || ''} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: Viagem, Reserva) *" className={inp} />
            <input type="text" inputMode="decimal" value={metaStr} onChange={e => setMetaStr(e.target.value)} placeholder="Meta (opcional, 0,00)" className={inp} />
            <div className="flex gap-2 flex-wrap">{CORES.map(cor => <button key={cor} onClick={() => setForm((f: any) => ({ ...f, cor }))} className={`w-7 h-7 rounded-full ${form.cor === cor ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-neutral-900' : ''}`} style={{ background: cor }} />)}</div>
            <div className="flex justify-end gap-2"><button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button><button onClick={salvar} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Salvar</button></div>
          </div>
        </div>
      )}

      {/* Modal movimentar */}
      {mov && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setMov(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800 dark:text-neutral-100">{mov.tipo === 'DEPOSITO' ? 'Guardar em' : 'Resgatar de'} “{mov.cx.nome}”</h2><button onClick={() => setMov(null)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <p className="text-xs text-gray-400">Saldo atual: <b>{fmt(mov.cx.saldo)}</b></p>
            <input autoFocus type="text" inputMode="decimal" value={movVal} onChange={e => setMovVal(e.target.value)} placeholder="Valor * (0,00)" className={inp} />
            {contas.length > 0 && <select value={movConta} onChange={e => setMovConta(e.target.value)} className={inp}><option value="">Conta (opcional)</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
            <input value={movObs} onChange={e => setMovObs(e.target.value)} placeholder="Observação" className={inp} />
            <div className="flex justify-end gap-2"><button onClick={() => setMov(null)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button><button onClick={confirmarMov} disabled={saving} className={`px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${mov.tipo === 'DEPOSITO' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}>{saving ? '…' : mov.tipo === 'DEPOSITO' ? 'Guardar' : 'Resgatar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
