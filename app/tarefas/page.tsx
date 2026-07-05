'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ClipboardList, AlertTriangle, Clock, Flame, Layers, User as UserIcon } from 'lucide-react'

const PERIODOS = [{ d: 7, l: '7 dias' }, { d: 30, l: '30 dias' }, { d: 90, l: '90 dias' }, { d: 365, l: '1 ano' }]
const fmtData = (s: string) => { try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }

export default function TarefasVisaoGeral() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(30)
  const [r, setR] = useState<any>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role === 'OPERADOR') router.push('/modulos')
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    fetch(`/api/tarefas/resumo?dias=${dias}`).then(x => x.json()).then(d => { setR(d); setLoading(false) }).catch(() => setLoading(false))
  }, [dias, status])

  const k = r?.kpis
  const maxCol = Math.max(1, ...(r?.porColuna || []).map((c: any) => c.n))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tarefas · Visão Geral</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/tarefas/quadros" className="text-xs text-orange-500 hover:text-orange-600">Ir para os quadros →</a>
            <select value={dias} onChange={e => setDias(Number(e.target.value))} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {PERIODOS.map(p => <option key={p.d} value={p.d}>Últimos {p.l}</option>)}
            </select>
          </div>
        </div>

        {loading ? <p className="text-gray-400 text-sm py-12 text-center">Carregando...</p> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card icon={<Layers size={16} className="text-blue-500" />} label="Total de tarefas" valor={String(k?.total || 0)} sub={`${k?.novasPeriodo || 0} novas no período`} />
              <Card icon={<AlertTriangle size={16} className="text-red-500" />} label="Prazos vencidos" valor={String(k?.vencidas || 0)} sub="precisam de atenção" />
              <Card icon={<Clock size={16} className="text-yellow-500" />} label="Prazo próximo" valor={String(k?.proximas || 0)} sub="próximos 7 dias" />
              <Card icon={<Flame size={16} className="text-orange-500" />} label="Urgentes" valor={String(k?.urgentes || 0)} sub="prioridade urgente" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Por coluna */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Tarefas por status (coluna)</p>
                {(r?.porColuna || []).length === 0 ? <p className="text-xs text-gray-400 py-4 text-center">Sem tarefas.</p> : (
                  <div className="space-y-2">
                    {r.porColuna.map((c: any, i: number) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs text-gray-500 mb-0.5"><span>{c.nome}</span><span>{c.n}</span></div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(c.n / maxCol) * 100}%`, backgroundColor: c.cor || '#f97316' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Por responsável */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-1"><UserIcon size={14} className="text-orange-500" /> Por responsável</p>
                {(r?.porResponsavel || []).length === 0 ? <p className="text-xs text-gray-400 py-4 text-center">Sem tarefas.</p> : (
                  <div className="space-y-1.5">
                    {r.porResponsavel.map((u: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm"><span className="text-gray-700 dark:text-gray-300 truncate">{u.nome}</span><span className="text-xs font-semibold text-orange-500">{u.n}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Vencidas */}
            {(r?.vencidasLista || []).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-100 dark:border-red-900/30 p-5 mt-4">
                <p className="text-sm font-semibold text-red-500 mb-3 flex items-center gap-1"><AlertTriangle size={14} /> Tarefas atrasadas</p>
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {r.vencidasLista.map((t: any) => (
                    <button key={t.id} onClick={() => router.push(`/tarefas/quadros/${t.quadroId}`)} className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded px-1">
                      <span className="text-sm text-gray-800 dark:text-white truncate">{t.titulo}</span>
                      <span className="text-xs text-red-500 flex-shrink-0 ml-2">{fmtData(t.prazo)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Card({ icon, label, valor, sub }: { icon: React.ReactNode; label: string; valor: string; sub: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{valor}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
  )
}
