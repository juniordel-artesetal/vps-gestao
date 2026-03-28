'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Filter, X, Package, ChevronDown } from 'lucide-react'

interface Pedido {
  id: string
  numero: string
  destinatario: string
  idCliente: string | null
  canal: string | null
  produto: string
  quantidade: number
  valor: number | null
  dataEntrada: string | null
  dataEnvio: string | null
  observacoes: string | null
  prioridade: string
  status: string
  total_itens: number
  itens_concluidos: number
  createdAt: string
}

const CANAIS = ['Shopee', 'Mercado Livre', 'Elo7', 'Direta', 'Instagram', 'WhatsApp', 'Outros']

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  ABERTO:      { label: 'Aberto',      cor: 'text-blue-700 bg-blue-50 border-blue-200'    },
  EM_PRODUCAO: { label: 'Em produção', cor: 'text-orange-700 bg-orange-50 border-orange-200'},
  CONCLUIDO:   { label: 'Concluído',   cor: 'text-green-700 bg-green-50 border-green-200'  },
  CANCELADO:   { label: 'Cancelado',   cor: 'text-red-700 bg-red-50 border-red-200'        },
}

const PRIORIDADE_CONFIG: Record<string, { label: string; cor: string }> = {
  URGENTE: { label: 'Urgente', cor: 'text-red-600 bg-red-50 border-red-200'        },
  ALTA:    { label: 'Alta',    cor: 'text-orange-600 bg-orange-50 border-orange-200'},
  NORMAL:  { label: 'Normal',  cor: 'text-blue-600 bg-blue-50 border-blue-200'     },
  BAIXA:   { label: 'Baixa',   cor: 'text-gray-500 bg-gray-50 border-gray-200'     },
}

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

export default function PedidosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroCanal, setFiltroCanal] = useState('')

  // Form novo pedido
  const [form, setForm] = useState({
    numero: '', destinatario: '', idCliente: '', canal: '',
    produto: '', quantidade: 1, valor: '',
    dataEntrada: new Date().toISOString().split('T')[0],
    dataEnvio: '', observacoes: '', prioridade: 'NORMAL',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') carregarPedidos()
  }, [status, filtroStatus, filtroPrioridade, filtroCanal])

  const carregarPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroStatus)     params.set('status', filtroStatus)
      if (filtroPrioridade) params.set('prioridade', filtroPrioridade)
      if (filtroCanal)      params.set('canal', filtroCanal)
      if (busca)            params.set('busca', busca)

      const res = await fetch(`/api/producao/pedidos?${params}`)
      const data = await res.json()
      setPedidos(data.pedidos || [])
      setTotal(data.total || 0)
    } finally { setLoading(false) }
  }, [filtroStatus, filtroPrioridade, filtroCanal, busca])

  function atualiza(campo: string, valor: any) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  async function criarPedido(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      const res = await fetch('/api/producao/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          valor: form.valor ? parseFloat(form.valor) : null,
          quantidade: parseInt(String(form.quantidade)),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao criar pedido'); return }
      setPedidos(prev => [data.pedido, ...prev])
      setModalAberto(false)
      setForm({
        numero: '', destinatario: '', idCliente: '', canal: '',
        produto: '', quantidade: 1, valor: '',
        dataEntrada: new Date().toISOString().split('T')[0],
        dataEnvio: '', observacoes: '', prioridade: 'NORMAL',
      })
      setSucesso('Pedido criado!')
      setTimeout(() => setSucesso(''), 3000)
    } finally { setSalvando(false) }
  }

  const isAdmin = session?.user?.role === 'ADMIN'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Pedidos</h1>
            <p className="text-sm text-gray-500">{total} pedido{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
          </div>
          {session?.user?.role !== 'OPERADOR' && (
            <button onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <Plus size={15} /> Novo pedido
            </button>
          )}
        </div>

        {/* Alertas */}
        {sucesso && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {sucesso}</div>}

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && carregarPedidos()}
                placeholder="Buscar por número, cliente ou produto..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
              <option value="">Todos os status</option>
              <option value="ABERTO">Aberto</option>
              <option value="EM_PRODUCAO">Em produção</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
              <option value="">Todas as prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="NORMAL">Normal</option>
              <option value="BAIXA">Baixa</option>
            </select>
            <select value={filtroCanal} onChange={e => setFiltroCanal(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
              <option value="">Todos os canais</option>
              {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filtroStatus || filtroPrioridade || filtroCanal || busca) && (
              <button onClick={() => { setFiltroStatus(''); setFiltroPrioridade(''); setFiltroCanal(''); setBusca('') }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2">
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Lista de pedidos */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
          ) : pedidos.length === 0 ? (
            <div className="py-12 text-center">
              <Package size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* Header da tabela */}
              <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500">
                <div className="col-span-1">Nº</div>
                <div className="col-span-3">Cliente / Produto</div>
                <div className="col-span-2">Canal</div>
                <div className="col-span-1">Qtd</div>
                {isAdmin && <div className="col-span-1">Valor</div>}
                <div className="col-span-2">Envio</div>
                <div className="col-span-1">Prioridade</div>
                <div className="col-span-1">Status</div>
              </div>

              {pedidos.map(pedido => {
                const stCfg = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.ABERTO
                const priCfg = PRIORIDADE_CONFIG[pedido.prioridade] || PRIORIDADE_CONFIG.NORMAL
                const progresso = pedido.total_itens > 0
                  ? Math.round((Number(pedido.itens_concluidos) / Number(pedido.total_itens)) * 100)
                  : 0

                return (
                  <div key={pedido.id}
                    onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}
                    className="flex flex-col lg:grid lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition">
                    <div className="col-span-1">
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {pedido.numero}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <div className="text-sm font-medium text-gray-900">{pedido.destinatario}</div>
                      <div className="text-xs text-gray-400 truncate">{pedido.produto}</div>
                      {pedido.total_itens > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${progresso}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{progresso}%</span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500">{pedido.canal || '—'}</span>
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm text-gray-700">{pedido.quantidade}</span>
                    </div>
                    {isAdmin && (
                      <div className="col-span-1">
                        <span className="text-sm text-gray-700">
                          {pedido.valor ? `R$ ${Number(pedido.valor).toFixed(2)}` : '—'}
                        </span>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500">
                        {pedido.dataEnvio
                          ? new Date(pedido.dataEnvio).toLocaleDateString('pt-BR')
                          : '—'}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priCfg.cor}`}>
                        {priCfg.label}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${stCfg.cor}`}>
                        {stCfg.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Modal novo pedido */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-base font-semibold text-gray-900">Novo pedido</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={criarPedido} className="p-6">
              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Número do pedido *</label>
                  <input type="text" value={form.numero} onChange={e => atualiza('numero', e.target.value)}
                    className={inputClass} placeholder="Ex: SHOP-12345" required />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Canal de venda</label>
                  <select value={form.canal} onChange={e => atualiza('canal', e.target.value)} className={inputClass}>
                    <option value="">Selecione...</option>
                    {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Destinatário (cliente) *</label>
                  <input type="text" value={form.destinatario} onChange={e => atualiza('destinatario', e.target.value)}
                    className={inputClass} placeholder="Nome do cliente" required />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">ID do cliente</label>
                  <input type="text" value={form.idCliente} onChange={e => atualiza('idCliente', e.target.value)}
                    className={inputClass} placeholder="ID na plataforma" />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Produto *</label>
                  <input type="text" value={form.produto} onChange={e => atualiza('produto', e.target.value)}
                    className={inputClass} placeholder="Descreva o produto pedido" required />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Quantidade</label>
                  <input type="number" value={form.quantidade} onChange={e => atualiza('quantidade', e.target.value)}
                    className={inputClass} min={1} />
                </div>

                {isAdmin && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Valor (R$)</label>
                    <input type="number" value={form.valor} onChange={e => atualiza('valor', e.target.value)}
                      className={inputClass} placeholder="0,00" step="0.01" min="0" />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Data de entrada</label>
                  <input type="date" value={form.dataEntrada} onChange={e => atualiza('dataEntrada', e.target.value)}
                    className={inputClass} />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Data de envio</label>
                  <input type="date" value={form.dataEnvio} onChange={e => atualiza('dataEnvio', e.target.value)}
                    className={inputClass} />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Prioridade</label>
                  <select value={form.prioridade} onChange={e => atualiza('prioridade', e.target.value)} className={inputClass}>
                    <option value="BAIXA">Baixa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Observações do cliente</label>
                  <textarea value={form.observacoes} onChange={e => atualiza('observacoes', e.target.value)}
                    className={inputClass + ' resize-none'} rows={3}
                    placeholder="Instruções especiais, detalhes do pedido..." />
                </div>
              </div>

              {erro && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{erro}</p>}

              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setModalAberto(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50">
                  {salvando ? 'Criando...' : 'Criar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
