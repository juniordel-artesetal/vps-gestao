'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Activity } from 'lucide-react'

const ICON: Record<string, string> = {
  criada: '✨', movida: '🔀', editada: '✏️', comentario: '💬', etiqueta: '🏷️', checklist: '☑️', vinculo: '🔗',
}
const fmt = (s: string) => { try { const d = new Date(s); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } catch { return s } }

export default function AtividadesFeed() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [eventos, setEventos] = useState<any[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status !== 'authenticated') return
    fetch('/api/tarefas/feed').then(x => x.json()).then(d => { setEventos(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [status])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Atividades</h1>
        </div>

        {loading ? <p className="text-gray-400 text-sm py-12 text-center">Carregando...</p>
          : eventos.length === 0 ? <p className="text-gray-400 text-sm py-12 text-center">Nenhuma atividade ainda.</p> : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50 overflow-hidden">
              {eventos.map(e => (
                <button key={e.id} onClick={() => router.push(`/tarefas/quadros/${e.quadroId}`)} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 text-left">
                  <span className="text-base flex-shrink-0">{ICON[e.tipo] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-white">
                      <strong>{e.usuarioNome}</strong> {e.descricao?.toLowerCase()} <span className="text-gray-400">em</span> <span className="text-orange-500">{e.tarefaTitulo}</span>
                    </p>
                    <p className="text-xs text-gray-400">{fmt(e.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
