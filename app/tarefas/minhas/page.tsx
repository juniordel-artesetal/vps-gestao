'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserCheck } from 'lucide-react'

const PRIO: Record<string, { label: string; cor: string }> = {
  baixa: { label: 'Baixa', cor: '#94a3b8' }, normal: { label: 'Normal', cor: '#3b82f6' },
  alta: { label: 'Alta', cor: '#f59e0b' }, urgente: { label: 'Urgente', cor: '#ef4444' },
}
const hojeISO = () => new Date().toISOString().split('T')[0]
const fmtData = (s: string) => { try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }

export default function MinhasTarefas() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tarefas, setTarefas] = useState<any[]>([])
  const [fPrio, setFPrio] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status !== 'authenticated') return
    fetch('/api/tarefas/minhas').then(x => x.json()).then(d => { setTarefas(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [status])

  const lista = tarefas.filter(t => !fPrio || t.prioridade === fPrio)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Minhas Tarefas</h1>
          </div>
          <select value={fPrio} onChange={e => setFPrio(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800">
            <option value="">Prioridade</option>
            {Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {loading ? <p className="text-gray-400 text-sm py-12 text-center">Carregando...</p>
          : lista.length === 0 ? <p className="text-gray-400 text-sm py-12 text-center">Nenhuma tarefa atribuída a você.</p> : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50 overflow-hidden">
              {lista.map(t => {
                const vencido = t.prazo && t.prazo < hojeISO()
                return (
                  <button key={t.id} onClick={() => router.push(`/tarefas/quadros/${t.quadroId}`)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 text-left">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIO[t.prioridade]?.cor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{t.titulo}</p>
                      <p className="text-xs text-gray-400">
                        <span style={{ color: t.quadroCor }}>●</span> {t.quadroNome} · {t.colunaNome}{t.clienteNome ? ` · 👤 ${t.clienteNome}` : ''}
                      </p>
                    </div>
                    {t.prazo && <span className={`text-xs flex-shrink-0 ${vencido ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>📅 {fmtData(t.prazo)}</span>}
                  </button>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
