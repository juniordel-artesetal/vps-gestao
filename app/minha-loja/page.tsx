'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, DollarSign, Clock, TrendingUp, Package, ExternalLink } from 'lucide-react'

const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (s: string) => { try { const d = new Date(s); return d.toLocaleDateString('pt-BR') } catch { return '—' } }

type Resumo = {
  dias: number
  kpis: { nPedidos: number; faturamentoTotal: number; faturamentoPago: number; nPagos: number; nAguardando: number; ticketMedio: number }
  ultimos: any[]
  maisVendidos: { nome: string; qtd: number }[]
}

const PERIODOS = [{ d: 7, l: '7 dias' }, { d: 30, l: '30 dias' }, { d: 90, l: '90 dias' }, { d: 365, l: '1 ano' }]

export default function MinhaLojaVisaoGeral() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(30)
  const [r, setR] = useState<Resumo | null>(null)
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/modulos')
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    fetch(`/api/minha-loja/resumo?dias=${dias}`).then(x => x.json()).then(d => { setR(d); setLoading(false) }).catch(() => setLoading(false))
  }, [dias, status])

  useEffect(() => {
    fetch('/api/config/loja').then(x => x.json()).then(d => setSlug(d?.config?.slug || null)).catch(() => {})
  }, [])

  const k = r?.kpis
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Minha Loja</h1>
          </div>
          <div className="flex items-center gap-2">
            {slug && <a href={`/loja/${slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">Ver loja <ExternalLink size={11} /></a>}
            <select value={dias} onChange={e => setDias(Number(e.target.value))} className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {PERIODOS.map(p => <option key={p.d} value={p.d}>Últimos {p.l}</option>)}
            </select>
          </div>
        </div>

        {loading ? <p className="text-gray-400 text-sm py-12 text-center">Carregando...</p> : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card icon={<DollarSign size={16} className="text-green-500" />} label="Faturamento pago" valor={brl(k?.faturamentoPago || 0)} sub={`${k?.nPagos || 0} pago(s)`} />
              <Card icon={<ShoppingBag size={16} className="text-orange-500" />} label="Pedidos" valor={String(k?.nPedidos || 0)} sub={`no período`} />
              <Card icon={<TrendingUp size={16} className="text-blue-500" />} label="Ticket médio" valor={brl(k?.ticketMedio || 0)} sub={`por pedido`} />
              <Card icon={<Clock size={16} className="text-yellow-500" />} label="Aguardando pgto" valor={String(k?.nAguardando || 0)} sub={brl((k?.faturamentoTotal || 0) - (k?.faturamentoPago || 0))} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Últimos pedidos */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Últimos pedidos</p>
                  <a href="/minha-loja/pedidos" className="text-xs text-orange-500 hover:text-orange-600">Ver todos</a>
                </div>
                {(!r?.ultimos || r.ultimos.length === 0) ? <p className="text-xs text-gray-400 py-6 text-center">Nenhum pedido pela loja ainda.</p> : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {r.ultimos.map(o => (
                      <div key={o.id} className="flex items-center justify-between py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 dark:text-white truncate">{o.destinatario || o.numero}</p>
                          <p className="text-xs text-gray-400">{fmtData(o.createdAt)} · {brl(o.valor)}</p>
                        </div>
                        <BadgePag status={o.statusPagamento} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mais vendidos */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-1"><Package size={14} className="text-orange-500" /> Mais vendidos</p>
                {(!r?.maisVendidos || r.maisVendidos.length === 0) ? <p className="text-xs text-gray-400 py-6 text-center">Sem vendas no período.</p> : (
                  <div className="space-y-2">
                    {r.maisVendidos.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{i + 1}. {p.nome}</span>
                        <span className="text-xs font-semibold text-orange-500 ml-2">{p.qtd}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

function BadgePag({ status }: { status: string | null }) {
  if (status === 'pago') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 flex-shrink-0">Pago</span>
  if (status === 'aguardando') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 flex-shrink-0">Aguardando</span>
  return <span className="text-[10px] text-gray-400 flex-shrink-0">—</span>
}
