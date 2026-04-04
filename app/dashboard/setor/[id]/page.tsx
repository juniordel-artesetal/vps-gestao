'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Package, Clock, CheckCircle, ArrowRight, Search,
  ChevronDown, X, Play, RotateCcw, Filter
} from 'lucide-react'

interface CampoPedido {
  id: string; nome: string; tipo: string; opcoes: string | null
}

interface Pedido {
  id: string
  pedidoId: string
  numero: string
  destinatario: string
  idCliente: string | null
  produto: string
  status: string
  prioridade: string
  canal: string | null
  dataEnvio: string | null
  dataEntrada: string | null
  camposExtras: string | null
  createdAt: string
  setor_atual_id: string | null
}

const URGENCIA_COR: Record<string, string> = {
  URGENTE: 'bg-red-100 text-red-700 border-red-200',
  ALTA:    'bg-orange-100 text-orange-700 border-orange-200',
  NORMAL:  'bg-green-100 text-green-700 border-green-200',
  BAIXA:   'bg-gray-100 text-gray-600 border-gray-200',
}
const URGENCIA_LABEL: Record<string, string> = {
  URGENTE: '🔴 Urgente', ALTA: '🟠 Alta', NORMAL: '🟢 Normal', BAIXA: '⚪ Baixa',
}
const CANAL_EMOJI: Record<string, string> = {
  Shopee: '🛍️', 'Mercado Livre': '🟡', Elo7: '🎨', Direta: '🤝',
  Instagram: '📸', WhatsApp: '💬', Outros: '📦',
}

function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function diasAteEnvio(d: string | null): number | null {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function SetorPage() {
  const params  = useParams()
  const router  = useRouter()
  const { data: session } = useSession()
  const setorId = params?.id as string

  const [nomeSetor, setNomeSetor]   = useState('')
  const [pedidos,   setPedidos]     = useState<Pedido[]>([])
  const [campos,    setCampos]      = useState<CampoPedido[]>([])
  const [loading,   setLoading]     = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  // Filtros
  const [busca,         setBusca]         = useState('')
  const [filtroUrgencia, setFiltroUrgencia] = useState('')
  const [filtroData,    setFiltroData]    = useState('')
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)
  const [mostrarFiltros,    setMostrarFiltros]    = useState(false)

  const podeEditar = session?.user?.role !== 'OPERADOR'

  const carregar = useCallback(async () => {
    if (!setorId) return
    setLoading(true)
    try {
      const [resSetor, resCampos] = await Promise.all([
        fetch(`/api/producao/workflow?setorId=${setorId}&incluirConcluidos=${mostrarConcluidos}`),
        fetch('/api/config/campos-pedido').catch(() => ({ json: async () => ({ campos: [] }) })),
      ])
      const data   = await resSetor.json()
      const cData  = await (resCampos as any).json()
      setPedidos(data.pedidos || [])
      setNomeSetor(data.nomeSetor || 'Setor')
      setCampos((cData.campos || []).filter((c: any) => c.ativo))
    } catch {
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }, [setorId, mostrarConcluidos])

  useEffect(() => { carregar() }, [carregar])

  async function handleAvancar(pedidoId: string) {
    if (!confirm('Concluir este pedido neste setor e avançar para o próximo?')) return
    setAtualizando(pedidoId)
    try {
      const res = await fetch('/api/producao/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      })
      if (res.ok) carregar()
      else alert('Erro ao avançar pedido')
    } finally { setAtualizando(null) }
  }

  async function handleDevolver(pedidoId: string) {
    if (!confirm('Devolver este pedido para o setor anterior?')) return
    setAtualizando(pedidoId)
    try {
      const res = await fetch('/api/producao/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, devolver: true }),
      })
      if (res.ok) carregar()
      else alert('Erro ao devolver pedido')
    } finally { setAtualizando(null) }
  }

  // Filtragem local
  const pedidosFiltrados = pedidos.filter(p => {
    if (busca) {
      const q = busca.toLowerCase()
      const extras = p.camposExtras ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })() : {}
      const extrasStr = Object.values(extras).join(' ').toLowerCase()
      if (
        !p.destinatario.toLowerCase().includes(q) &&
        !p.numero.toLowerCase().includes(q) &&
        !p.produto.toLowerCase().includes(q) &&
        !(p.idCliente || '').toLowerCase().includes(q) &&
        !extrasStr.includes(q)
      ) return false
    }
    if (filtroUrgencia && p.prioridade !== filtroUrgencia) return false
    if (filtroData && p.dataEnvio) {
      if (!p.dataEnvio.startsWith(filtroData)) return false
    }
    return true
  })

  const temFiltro = busca || filtroUrgencia || filtroData

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/dashboard/pedidos')}
              className="text-xs text-gray-400 hover:text-gray-600">← Pedidos</button>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-bold text-gray-900">{nomeSetor || 'Setor'}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {pedidosFiltrados.length} de {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
            {mostrarConcluidos ? ' (incluindo concluídos)' : ' em produção'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={mostrarConcluidos}
              onChange={e => setMostrarConcluidos(e.target.checked)}
              className="accent-orange-500 w-3.5 h-3.5" />
            Ver concluídos
          </label>
          <button onClick={carregar}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente, produto, número, campos..."
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <select value={filtroUrgencia} onChange={e => setFiltroUrgencia(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Toda urgência</option>
            <option value="URGENTE">🔴 Urgente</option>
            <option value="ALTA">🟠 Alta</option>
            <option value="NORMAL">🟢 Normal</option>
            <option value="BAIXA">⚪ Baixa</option>
          </select>
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            title="Filtrar por data de envio" />
          {temFiltro && (
            <button onClick={() => { setBusca(''); setFiltroUrgencia(''); setFiltroData('') }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-2">
              <X size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
          <Clock size={16} className="animate-spin" /> Carregando...
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle size={40} className="text-green-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {pedidos.length === 0 ? 'Nenhum pedido neste setor' : 'Nenhum pedido encontrado com esses filtros'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {pedidos.length === 0 ? 'Tudo em dia! 🎉' : 'Tente ajustar os filtros acima'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pedidosFiltrados.map(p => {
            const dias    = diasAteEnvio(p.dataEnvio)
            const atrasado = dias !== null && dias < 0
            const urgente  = dias !== null && dias <= 2 && dias >= 0
            const extras   = p.camposExtras
              ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })()
              : {}
            const extrasVisiveis = Object.entries(extras).filter(([k]) => !k.startsWith('_'))
            const isAtualizando  = atualizando === (p.pedidoId || p.id)

            return (
              <div key={p.id}
                className={`bg-white rounded-xl border transition ${
                  atrasado ? 'border-red-200 bg-red-50/20' :
                  urgente  ? 'border-orange-200' : 'border-gray-100 hover:border-gray-200'
                }`}>

                {/* Linha principal */}
                <div className="flex items-start gap-3 p-4">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Package size={16} className="text-orange-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Linha 1: nome + badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-gray-900">{p.destinatario}</p>
                      {p.numero && (
                        <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                          #{p.numero}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${URGENCIA_COR[p.prioridade] || URGENCIA_COR.NORMAL}`}>
                        {URGENCIA_LABEL[p.prioridade] || p.prioridade}
                      </span>
                      {p.canal && (
                        <span className="text-xs text-gray-500">
                          {CANAL_EMOJI[p.canal] || '📦'} {p.canal}
                        </span>
                      )}
                      {p.idCliente && (
                        <span className="text-xs text-gray-400">User: {p.idCliente}</span>
                      )}
                    </div>

                    {/* Linha 2: produto */}
                    <p className="text-xs text-gray-500 mb-1.5 truncate">{p.produto}</p>

                    {/* Campos personalizados */}
                    {extrasVisiveis.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1.5">
                        {extrasVisiveis.map(([nome, valor]) => (
                          <span key={nome} className="text-xs">
                            <span className="text-gray-400">{nome}:</span>{' '}
                            <span className="text-orange-600 font-medium">
                              {valor === 'true' ? 'Sim' : valor === 'false' ? 'Não' : String(valor)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Linha 3: datas */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {p.dataEntrada && (
                        <span>Entrada: <strong className="text-gray-600">{fmtData(p.dataEntrada)}</strong></span>
                      )}
                      {p.dataEnvio && (
                        <span className={atrasado ? 'text-red-600 font-semibold' : urgente ? 'text-orange-600 font-semibold' : ''}>
                          Envio: <strong>{fmtData(p.dataEnvio)}</strong>
                          {atrasado && ' ⚠ Atrasado!'}
                          {urgente && !atrasado && ` (${dias}d)`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                    {/* Ver pedido */}
                    <a href={`/dashboard/pedidos/${p.pedidoId || p.id}`}
                      className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium transition">
                      Ver <ArrowRight size={11} />
                    </a>

                    {podeEditar && p.status !== 'CONCLUIDO' && p.status !== 'CANCELADO' && (
                      <>
                        {/* Concluir / Avançar */}
                        <button
                          onClick={() => handleAvancar(p.pedidoId || p.id)}
                          disabled={!!isAtualizando}
                          className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-lg font-medium transition disabled:opacity-50">
                          <CheckCircle size={11} />
                          {isAtualizando ? '...' : 'Concluir'}
                        </button>

                        {/* Devolver */}
                        <button
                          onClick={() => handleDevolver(p.pedidoId || p.id)}
                          disabled={!!isAtualizando}
                          className="flex items-center gap-1 text-xs border border-orange-300 text-orange-600 hover:bg-orange-50 px-2.5 py-1.5 rounded-lg font-medium transition disabled:opacity-50">
                          <RotateCcw size={11} />
                          Devolver
                        </button>
                      </>
                    )}

                    {p.status === 'CONCLUIDO' && (
                      <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-lg font-medium">
                        ✓ Concluído
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
