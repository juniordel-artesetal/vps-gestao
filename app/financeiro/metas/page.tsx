'use client'
// app/financeiro/metas/page.tsx
import { useEffect, useState, useCallback } from 'react'
import { Save, Target } from 'lucide-react'

function fmtR(n: number) { return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

interface Meta { id?: string; mes: number; ano: number; metaReceita: number; metaDespesa: number; metaLucro: number }
interface Resumo { totalReceita: number; totalDespesa: number; resultado: number }

function ProgressBar({ value, meta, color }: { value: number; meta: number; color: string }) {
  if (!meta) return null
  const pct = Math.min((value / meta) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{fmtR(value)}</span><span>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function MetasPage() {
  const hoje = new Date()
  const [ano, setAno]       = useState(hoje.getFullYear())
  const [metas, setMetas]   = useState<Meta[]>([])
  const [resumos, setResumos] = useState<Record<number, Resumo>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [editMes, setEditMes] = useState<number | null>(null)
  const [form, setForm]     = useState<Partial<Meta>>({})

  const fetchMetas = useCallback(async () => {
    const r = await fetch(`/api/financeiro/metas?ano=${ano}`)
    setMetas(await r.json())
  }, [ano])

  const fetchResumos = useCallback(async () => {
    const res: Record<number, Resumo> = {}
    await Promise.all(Array.from({ length: 12 }, (_, i) => i + 1).map(async m => {
      const r = await fetch(`/api/financeiro/resumo?ano=${ano}&mes=${m}`)
      const d = await r.json()
      res[m] = { totalReceita: d.totalReceita, totalDespesa: d.totalDespesa, resultado: d.resultado }
    }))
    setResumos(res)
  }, [ano])

  useEffect(() => { fetchMetas(); fetchResumos() }, [fetchMetas, fetchResumos])

  const getMeta = (mes: number): Meta => metas.find(m => m.mes === mes) || { mes, ano, metaReceita: 0, metaDespesa: 0, metaLucro: 0 }

  const openEdit = (mes: number) => {
    const m = getMeta(mes)
    setForm({ metaReceita: m.metaReceita, metaDespesa: m.metaDespesa, metaLucro: m.metaLucro })
    setEditMes(mes)
  }

  const handleSave = async (mes: number) => {
    setSaving(mes)
    try {
      await fetch('/api/financeiro/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ano, mes, ...form }),
      })
      await fetchMetas(); setEditMes(null)
    } finally { setSaving(null) }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Metas Mensais</h1>
          <p className="text-sm text-gray-500">Defina e acompanhe as metas do ateliê</p>
        </div>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MESES.map((nomeMes, i) => {
          const mes    = i + 1
          const meta   = getMeta(mes)
          const real   = resumos[mes] || { totalReceita: 0, totalDespesa: 0, resultado: 0 }
          const isHoje = mes === hoje.getMonth() + 1 && ano === hoje.getFullYear()
          const isEdit = editMes === mes

          return (
            <div key={mes} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isHoje ? 'border-orange-300 ring-2 ring-orange-200' : 'border-gray-100'}`}>
              <div className={`flex items-center justify-between px-4 py-3 ${isHoje ? 'bg-orange-500 text-white' : 'bg-gray-50 border-b border-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <Target className={`w-4 h-4 ${isHoje ? 'text-orange-200' : 'text-gray-400'}`} />
                  <span className={`font-semibold text-sm ${isHoje ? 'text-white' : 'text-gray-700'}`}>
                    {nomeMes} {ano}
                    {isHoje && <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">atual</span>}
                  </span>
                </div>
                <button onClick={() => isEdit ? setEditMes(null) : openEdit(mes)}
                  className={`text-xs px-2 py-1 rounded ${isHoje ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>
                  {isEdit ? 'Cancelar' : 'Editar'}
                </button>
              </div>

              <div className="p-4 space-y-3">
                {isEdit ? (
                  <div className="space-y-3">
                    {[
                      { key: 'metaReceita', label: 'Meta de Receita' },
                      { key: 'metaDespesa', label: 'Meta de Despesa' },
                      { key: 'metaLucro',   label: 'Meta de Lucro'   },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                        <input type="number" step="0.01" min="0" value={(form as any)[key] || ''}
                          onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                          placeholder="0,00" className={inputClass} />
                      </div>
                    ))}
                    <button onClick={() => handleSave(mes)} disabled={saving === mes}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                      <Save className="w-3.5 h-3.5" />
                      {saving === mes ? 'Salvando...' : 'Salvar Metas'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-500">Receita</span>
                        <span className="text-xs font-semibold text-green-600">{fmtR(real.totalReceita)}</span>
                      </div>
                      {meta.metaReceita > 0
                        ? <ProgressBar value={real.totalReceita} meta={meta.metaReceita} color="bg-green-500" />
                        : <p className="text-xs text-gray-300 italic">Sem meta</p>}
                      {meta.metaReceita > 0 && <p className="text-xs text-gray-400 mt-0.5">Meta: {fmtR(meta.metaReceita)}</p>}
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-500">Despesa</span>
                        <span className="text-xs font-semibold text-red-600">{fmtR(real.totalDespesa)}</span>
                      </div>
                      {meta.metaDespesa > 0
                        ? <ProgressBar value={real.totalDespesa} meta={meta.metaDespesa} color="bg-red-500" />
                        : <p className="text-xs text-gray-300 italic">Sem meta</p>}
                      {meta.metaDespesa > 0 && <p className="text-xs text-gray-400 mt-0.5">Meta: {fmtR(meta.metaDespesa)}</p>}
                    </div>
                    <div className={`rounded-lg p-2.5 ${real.resultado >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-500">Resultado</span>
                        <span className={`text-xs font-bold ${real.resultado >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtR(real.resultado)}</span>
                      </div>
                      {meta.metaLucro > 0 && <ProgressBar value={real.resultado} meta={meta.metaLucro} color="bg-blue-500" />}
                      {meta.metaLucro > 0 && <p className="text-xs text-gray-400 mt-0.5">Meta: {fmtR(meta.metaLucro)}</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
