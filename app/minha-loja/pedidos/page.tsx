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
  const [agindo, setAgindo] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ id: string; acao: 'aprovar' | 'recusar'; nome: string } | null>(null)

  async function agir(id: string, acao: 'aprovar' | 'recusar') {
    setAgindo(id); setConfirmar(null)
    try {
      const r = await fetch(`/api/minha-loja/pedidos/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao }) })
      if (r.ok) setPedidos(ps => ps.map(p => p.id === id ? { ...p, aprovacao: acao === 'aprovar' ? 'aprovado' : 'recusado', status: acao === 'recusar' ? 'CANCELADO' : p.status } : p))
    } finally { setAgindo(null) }
  }

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
                <div key={o.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => router.push(`/dashboard/pedidos/${o.id}`)} className="min-w-0 text-left">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{o.destinatario || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{o.numero} · {fmtData(o.createdAt)}{o.contato ? ` · 📱 ${o.contato}` : ''}{o.metodoPagamento ? ` · ${METODO[o.metodoPagamento] || o.metodoPagamento}` : ''}</p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{brl(o.valor)}</span>
                      {o.aprovacao === 'aprovado' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600">Aprovado</span>}
                      {o.aprovacao === 'recusado' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-600">Recusado</span>}
                      {o.aprovacao === 'pendente' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600">Pendente</span>}
                    </div>
                  </div>
                  {o.aprovacao === 'pendente' && (
                    <div className="flex gap-2 mt-2 justify-end">
                      <button onClick={() => setConfirmar({ id: o.id, acao: 'recusar', nome: o.destinatario || 'este pedido' })} disabled={agindo === o.id}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 disabled:opacity-50">Recusar</button>
                      <button onClick={() => agir(o.id, 'aprovar')} disabled={agindo === o.id}
                        className="text-xs px-3 py-1 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">
                        {agindo === o.id ? '...' : 'Aprovar'}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      {confirmar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmar(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-white mb-1">Recusar o pedido de {confirmar.nome}?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">O pedido é <b>cancelado</b> e não entra na produção nem no caixa. Se já tinha lançamento, ele é removido, e o estoque é estornado.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmar(null)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Voltar</button>
              <button onClick={() => agir(confirmar.id, 'recusar')} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Sim, recusar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
