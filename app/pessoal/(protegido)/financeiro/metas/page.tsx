'use client'
// Metas mensais pessoais (receita/despesa/economia) + progresso vs realizado.
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
function parseNum(s: unknown) { let x = String(s ?? '').trim(); if (!x) return 0; if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); const n = parseFloat(x); return isNaN(n) ? 0 : n }
const numStr = (n: number | undefined | null) => (n == null || n === 0 ? '' : String(n).replace('.', ','))
const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

function Barra({ label, real, meta, cor, invert }: { label: string; real: number; meta: number; cor: string; invert?: boolean }) {
  const pct = meta > 0 ? Math.min(100, Math.round((real / meta) * 100)) : 0
  const bom = invert ? real <= meta : real >= meta
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span className="text-gray-600 dark:text-neutral-300">{label}</span><span className="text-gray-500 tabular-nums">{fmt(real)} {meta > 0 && <span className="text-gray-400">/ {fmt(meta)}</span>}</span></div>
      <div className="h-2.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta > 0 && bom ? '#10b981' : cor }} /></div>
      {meta > 0 && <p className="text-[11px] text-gray-400 mt-0.5">{pct}% da meta{invert && real > meta ? ' — passou do limite ⚠️' : ''}</p>}
    </div>
  )
}

export default function MetasPage() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear()); const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [d, setD] = useState<any>(null); const [loading, setLoading] = useState(true)
  const [mr, setMr] = useState(''); const [md, setMd] = useState(''); const [me, setMe] = useState(''); const [saving, setSaving] = useState(false)
  const carregar = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch(`/api/pessoal/metas?ano=${ano}&mes=${mes}`); if (r.ok) { const j = await r.json(); setD(j); setMr(numStr(j.meta?.metaReceita)); setMd(numStr(j.meta?.metaDespesa)); setMe(numStr(j.meta?.metaEconomia)) } } finally { setLoading(false) }
  }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])
  const troca = (x: number) => { let m = mes + x, a = ano; if (m < 1) { m = 12; a-- } if (m > 12) { m = 1; a++ } setMes(m); setAno(a) }
  async function salvar() { setSaving(true); try { await fetch('/api/pessoal/metas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ano, mes, metaReceita: parseNum(mr), metaDespesa: parseNum(md), metaEconomia: parseNum(me) }) }); carregar() } finally { setSaving(false) } }

  return (
    <div className="max-w-xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3"><Link href="/pessoal/financeiro" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Metas</h1></div>
        <div className="flex items-center gap-2"><button onClick={() => troca(-1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700"><ChevronLeft className="w-4 h-4" /></button><span className="text-sm font-medium w-32 text-center">{MESES[mes - 1]} {ano}</span><button onClick={() => troca(1)} className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700"><ChevronRight className="w-4 h-4" /></button></div>
      </div>
      {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : d && (
        <>
          <div className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
            <Barra label="Receita" real={d.realizado.receita} meta={d.meta?.metaReceita || 0} cor="#3b82f6" />
            <Barra label="Despesa (limite)" real={d.realizado.despesa} meta={d.meta?.metaDespesa || 0} cor="#f59e0b" invert />
            <Barra label="Economia" real={d.realizado.economia} meta={d.meta?.metaEconomia || 0} cor="#8b5cf6" />
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-200">Definir metas do mês</h3>
            <div><label className="text-xs text-gray-500">Meta de receita</label><input type="text" inputMode="decimal" value={mr} onChange={e => setMr(e.target.value)} placeholder="0,00" className={inp} /></div>
            <div><label className="text-xs text-gray-500">Limite de despesa</label><input type="text" inputMode="decimal" value={md} onChange={e => setMd(e.target.value)} placeholder="0,00" className={inp} /></div>
            <div><label className="text-xs text-gray-500">Meta de economia</label><input type="text" inputMode="decimal" value={me} onChange={e => setMe(e.target.value)} placeholder="0,00" className={inp} /></div>
            <button onClick={salvar} disabled={saving} className="w-full py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar metas'}</button>
          </div>
        </>
      )}
    </div>
  )
}
