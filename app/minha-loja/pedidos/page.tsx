'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ClipboardList, ArrowLeft } from 'lucide-react'

const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (s: string) => { try { return new Date(s).toLocaleDateString('pt-BR') } catch { return '—' } }
const METODO: Record<string, string> = { pix: 'PIX', mercadopago: 'Mercado Pago', link: 'Link' }

export default function MinhaLojaPedidos() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'pago' | 'aguardando'>('todos')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role === 'OPERADOR') router.push('/modulos')
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    const q = filtro === 'todos' ? '' : `?pagamento=${filtro}`
    fetch(`/api/minha-loja/pedidos${q}`).then(x => x.json()).then(d => { setPedidos(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [filtro, status])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <a href="/minha-loja" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"><ArrowLeft size={12} /> Visão Geral</a>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pedidos da Loja</h1>
        </div>

        <div className="flex gap-2 mb-4">
          {(['todos', 'pago', 'aguardando'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${filtro === f ? 'bg-orange-500 text-white border-orange-500' : 'text-gray-600 border-gray-200 dark:border-gray-600'}`}>
              {f === 'todos' ? 'Todos' : f === 'pago' ? 'Pagos' : 'Aguardando'}
            </button>
          ))}
        </div>

        {loading ? <p className="text-gray-400 text-sm py-12 text-center">Carregando...</p>
          : pedidos.length === 0 ? <p className="text-gray-400 text-sm py-12 text-center">Nenhum pedido encontrado.</p> : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50 overflow-hidden">
              {pedidos.map(o => (
                <button key={o.id} onClick={() => router.push(`/dashboard/pedidos/${o.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 text-left transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{o.destinatario || '—'}</p>
                    <p className="text-xs text-gray-400">{o.numero} · {fmtData(o.createdAt)}{o.metodoPagamento ? ` · ${METODO[o.metodoPagamento] || o.metodoPagamento}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{brl(o.valor)}</span>
                    {o.statusPagamento === 'pago' ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">Pago</span>
                      : o.statusPagamento === 'aguardando' ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">Aguardando</span>
                        : <span className="text-[10px] text-gray-400">—</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
