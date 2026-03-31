'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Package, Clock, CheckCircle, ArrowRight } from 'lucide-react'

interface Pedido {
  id: string
  pedidoId: string       // ← id real do pedido para o link
  numero: string
  destinatario: string
  produto: string
  status: string
  prioridade: string
  dataEnvio: string | null
  createdAt: string
}

const URGENCIA_COR: Record<string, string> = {
  URGENTE:     'bg-red-100 text-red-700 border-red-200',
  ALTA:        'bg-orange-100 text-orange-700 border-orange-200',
  NORMAL:      'bg-green-100 text-green-700 border-green-200',
  BAIXA:       'bg-gray-100 text-gray-600 border-gray-200',
}

const URGENCIA_LABEL: Record<string, string> = {
  URGENTE:     '🔴 Urgente',
  ALTA:        '🟠 Alta',
  NORMAL:      '🟢 Normal',
  BAIXA:       '⚪ Baixa',
}

function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function SetorPage() {
  const params  = useParams()
  const setorId = params?.id as string

  const [nomeSetor, setNomeSetor] = useState('')
  const [pedidos, setPedidos]     = useState<Pedido[]>([])
  const [loading, setLoading]     = useState(true)

  const carregar = useCallback(async () => {
    if (!setorId) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/producao/workflow?setorId=${setorId}`)
      const data = await res.json()
      setPedidos(data.pedidos || [])
      setNomeSetor(data.nomeSetor || 'Setor')
    } catch {
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }, [setorId])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{nomeSetor || 'Setor'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} neste setor
          </p>
        </div>
        <button onClick={carregar}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
          Atualizar
        </button>
      </div>

      {/* Lista de pedidos */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
          <Clock size={16} className="animate-spin"/> Carregando...
        </div>
      ) : pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle size={40} className="text-green-300 mb-3"/>
          <p className="text-gray-500 font-medium">Nenhum pedido neste setor</p>
          <p className="text-gray-400 text-sm mt-1">Tudo em dia! 🎉</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pedidos.map(p => (
            <div key={p.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-orange-500"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.destinatario || '—'}</p>
                  {p.numero && (
                    <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                      #{p.numero}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${URGENCIA_COR[p.prioridade] || URGENCIA_COR.NORMAL}`}>
                    {URGENCIA_LABEL[p.prioridade] || p.prioridade}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{p.produto || 'Sem produto'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400">Envio</p>
                <p className="text-sm font-medium text-gray-700">{fmtData(p.dataEnvio)}</p>
              </div>
              <a href={`/dashboard/pedidos/${p.pedidoId || p.id}`}
                className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 transition flex-shrink-0">
                Ver <ArrowRight size={12}/>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
