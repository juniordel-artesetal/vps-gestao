'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Package, Clock, CheckCircle, AlertTriangle, TrendingUp, Plus } from 'lucide-react'

interface Resumo {
  totais: { total: number; abertos: number; em_producao: number; concluidos: number; enviados: number; cancelados: number }
  porCanal: { canal: string; total: number }[]
  porPrioridade: { prioridade: string; total: number }[]
  porSetor: { setorId: string; setorNome: string; total: number }[]
  recentes: any[]
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  ABERTO:      { label: 'Aguardando',  cor: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'    },
  EM_PRODUCAO: { label: 'Fazendo',     cor: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  CONCLUIDO:   { label: 'Pronto ✓',   cor: 'text-green-700',  bg: 'bg-green-50 border-green-200'   },
  CANCELADO:   { label: 'Cancelado',   cor: 'text-red-700',    bg: 'bg-red-50 border-red-200'       },
  ENVIADO:     { label: 'Enviado 📦',  cor: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
}

const PRIORIDADE_CONFIG: Record<string, { label: string; cor: string }> = {
  URGENTE: { label: '🔴 Urgente',      cor: 'text-red-600 bg-red-50 border-red-200'         },
  ALTA:    { label: '🟠 Precisa logo', cor: 'text-orange-600 bg-orange-50 border-orange-200' },
  NORMAL:  { label: '🟢 Normal',       cor: 'text-blue-600 bg-blue-50 border-blue-200'       },
  BAIXA:   { label: '⚪ Sem pressa',   cor: 'text-gray-500 bg-gray-50 border-gray-200'       },
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') carregarResumo()
  }, [status])

  async function carregarResumo() {
    try {
      const res = await fetch('/api/producao/resumo')
      const data = await res.json()
      setResumo(data)
    } catch { console.error('Erro ao carregar resumo') }
    finally { setLoading(false) }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    )
  }

  const t = resumo?.totais

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Minha Produção</h1>
            <p className="text-sm text-gray-500">{session?.user?.workspaceNome}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/pedidos')}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={15} />
            Novo pedido
          </button>
        </div>

        {/* Cards de status — clicáveis */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Aguardando',    valor: t?.abertos     || 0, icon: Package,     cor: 'text-blue-500',   bg: 'bg-blue-50',   filtro: '?status=ABERTO'      },
            { label: 'Fazendo agora', valor: t?.em_producao || 0, icon: Clock,       cor: 'text-orange-500', bg: 'bg-orange-50', filtro: '?status=EM_PRODUCAO' },
            { label: 'Prontos',       valor: t?.concluidos  || 0, icon: CheckCircle, cor: 'text-green-500',  bg: 'bg-green-50',  filtro: '?status=CONCLUIDO'   },
            { label: 'Enviados',      valor: t?.enviados    || 0, icon: TrendingUp,  cor: 'text-purple-500', bg: 'bg-purple-50', filtro: '?status=ENVIADO'     },
            { label: 'Total',         valor: t?.total       || 0, icon: Package,     cor: 'text-gray-500',   bg: 'bg-gray-50',   filtro: ''                    },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label}
                onClick={() => router.push('/dashboard/pedidos' + card.filtro)}
                className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-orange-200 hover:shadow-sm transition group">
                <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon size={18} className={card.cor} />
                </div>
                <div className="text-2xl font-semibold text-gray-900">{card.valor}</div>
                <div className="text-xs text-gray-500 mt-0.5 group-hover:text-orange-500 transition">{card.label}</div>
              </div>
            )
          })}
        </div>

        {/* Cards por setor */}
        {resumo?.porSetor && resumo.porSetor.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Package size={15} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-700">Pedidos por setor</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {resumo.porSetor.map(s => (
                <button key={s.setorId}
                  onClick={() => router.push(`/dashboard/setor/${s.setorId}`)}
                  className="flex flex-col items-center justify-center bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-xl p-3 transition cursor-pointer group">
                  <span className="text-2xl font-bold text-orange-600">{Number(s.total)}</span>
                  <span className="text-xs text-gray-600 font-medium mt-0.5 text-center leading-tight group-hover:text-orange-700">{s.setorNome}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Por urgência */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-700">Por urgência</h2>
            </div>
            <div className="flex flex-col gap-2">
              {['URGENTE', 'ALTA', 'NORMAL', 'BAIXA'].map(p => {
                const item = resumo?.porPrioridade?.find(i => i.prioridade === p)
                const cfg  = PRIORIDADE_CONFIG[p]
                const qtd  = Number(item?.total || 0)
                return (
                  <div key={p} className="flex items-center justify-between">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.cor}`}>
                      {cfg.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {qtd} {qtd === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                )
              })}
              {(!resumo?.porPrioridade || resumo.porPrioridade.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2">Nenhum pedido em aberto 🎉</p>
              )}
            </div>
          </div>

          {/* Por canal */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-700">De onde vieram os pedidos</h2>
            </div>
            <div className="flex flex-col gap-2">
              {resumo?.porCanal?.map(item => (
                <div key={item.canal} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.canal}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full"
                        style={{ width: `${Math.min((Number(item.total) / (Number(t?.total) || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-right">{Number(item.total)}</span>
                  </div>
                </div>
              ))}
              {(!resumo?.porCanal || resumo.porCanal.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2">Nenhum pedido cadastrado ainda</p>
              )}
            </div>
          </div>
        </div>

        {/* Últimos pedidos */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Últimos pedidos</h2>
            <button
              onClick={() => router.push('/dashboard/pedidos')}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium"
            >
              Ver todos →
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {resumo?.recentes?.map(pedido => {
              const statusCfg = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.ABERTO
              const priCfg    = PRIORIDADE_CONFIG[pedido.prioridade] || PRIORIDADE_CONFIG.NORMAL
              return (
                <div
                  key={pedido.id}
                  onClick={() => router.push(`/dashboard/pedidos?id=${pedido.id}`)}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-gray-400">{pedido.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${priCfg.cor}`}>
                        {priCfg.label}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate">{pedido.destinatario}</div>
                    <div className="text-xs text-gray-400 truncate">{pedido.produto}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.cor}`}>
                      {statusCfg.label}
                    </span>
                    {pedido.dataEnvio && (
                      <div className="text-xs text-gray-400 mt-1">
                        Envio: {new Date(pedido.dataEnvio).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {(!resumo?.recentes || resumo.recentes.length === 0) && (
              <div className="px-5 py-8 text-center">
                <Package size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nenhum pedido ainda</p>
                <button
                  onClick={() => router.push('/dashboard/pedidos')}
                  className="text-xs text-orange-500 hover:text-orange-600 mt-1 font-medium"
                >
                  Criar o primeiro pedido →
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
