'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function CalendarioTarefas() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tarefas, setTarefas] = useState<any[]>([])
  const [ref, setRef] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() } })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status !== 'authenticated') return
    fetch('/api/tarefas/agenda').then(x => x.json()).then(d => setTarefas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [status])

  const porDia = useMemo(() => {
    const m: Record<string, any[]> = {}
    for (const t of tarefas) { (m[t.prazo] ||= []).push(t) }
    return m
  }, [tarefas])

  const primeiroDiaSemana = new Date(ref.ano, ref.mes, 1).getDay()
  const diasNoMes = new Date(ref.ano, ref.mes + 1, 0).getDate()
  const hoje = new Date().toISOString().split('T')[0]
  const celulas: (number | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const iso = (dia: number) => `${ref.ano}-${String(ref.mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  const mudarMes = (delta: number) => setRef(r => {
    let mes = r.mes + delta, ano = r.ano
    if (mes < 0) { mes = 11; ano-- } else if (mes > 11) { mes = 0; ano++ }
    return { ano, mes }
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalIcon className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Calendário de Tarefas</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => mudarMes(-1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center"><ChevronLeft size={15} /></button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-36 text-center">{MESES[ref.mes]} {ref.ano}</span>
            <button onClick={() => mudarMes(1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center"><ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS.map((d, i) => <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((dia, i) => {
              if (dia === null) return <div key={i} />
              const dISO = iso(dia)
              const ts = porDia[dISO] || []
              const ehHoje = dISO === hoje
              return (
                <div key={i} className={`min-h-[68px] rounded-lg border p-1 ${ehHoje ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                  <div className={`text-[11px] font-medium mb-0.5 ${ehHoje ? 'text-orange-500' : 'text-gray-400'}`}>{dia}</div>
                  <div className="space-y-0.5">
                    {ts.slice(0, 3).map((t: any) => (
                      <button key={t.id} onClick={() => router.push(`/tarefas/quadros/${t.quadroId}`)}
                        className="w-full text-left text-[9px] px-1 py-0.5 rounded truncate text-white" style={{ backgroundColor: t.quadroCor || '#f97316' }} title={t.titulo}>
                        {t.titulo}
                      </button>
                    ))}
                    {ts.length > 3 && <p className="text-[9px] text-gray-400 px-1">+{ts.length - 3}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
