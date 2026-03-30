'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Play, CheckCircle, Clock, AlertCircle, RotateCcw, Edit2, Save, X } from 'lucide-react'

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
  endereco: string | null
  camposExtras: string | null
}

// FIX B1: interface para campos personalizados configurados
interface CampoPedido {
  id: string
  nome: string
  tipo: string
  opcoes: string | null
  placeholder: string | null
  ativo: boolean
}

interface WorkflowItem {
  id: string
  setorId: string
  setorNome: string
  setorOrdem: number
  status: string
  responsavelNome: string | null
  observacoes: string | null
  iniciadoEm: string | null
  concluidoEm: string | null
}

interface Historico {
  id: string
  tipo: string
  descricao: string
  usuarioNome: string | null
  createdAt: string
}

const STATUS_WF: Record<string, { label: string; cor: string; icon: React.ElementType }> = {
  PENDENTE:     { label: 'Pendente',     cor: 'text-gray-400',   icon: Clock        },
  EM_ANDAMENTO: { label: 'Em andamento', cor: 'text-orange-500', icon: AlertCircle  },
  CONCLUIDO:    { label: 'Concluído',    cor: 'text-green-500',  icon: CheckCircle  },
  DEVOLVIDO:    { label: 'Devolvido',    cor: 'text-red-500',    icon: RotateCcw    },
}

const PRIORIDADE_COR: Record<string, string> = {
  URGENTE: 'text-red-600 bg-red-50 border-red-200',
  ALTA:    'text-orange-600 bg-orange-50 border-orange-200',
  NORMAL:  'text-blue-600 bg-blue-50 border-blue-200',
  BAIXA:   'text-gray-500 bg-gray-50 border-gray-200',
}

const STATUS_COR: Record<string, string> = {
  ABERTO:      'text-blue-700 bg-blue-50 border-blue-200',
  EM_PRODUCAO: 'text-orange-700 bg-orange-50 border-orange-200',
  CONCLUIDO:   'text-green-700 bg-green-50 border-green-200',
  CANCELADO:   'text-red-700 bg-red-50 border-red-200',
}

const inputClass = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"

export default function PedidoDetalhePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const pedidoId = params.id as string

  const [pedido,        setPedido]        = useState<Pedido | null>(null)
  const [workflow,      setWorkflow]      = useState<WorkflowItem[]>([])
  const [historico,     setHistorico]     = useState<Historico[]>([])
  const [loading,       setLoading]       = useState(true)
  const [iniciando,     setIniciando]     = useState(false)
  const [sucesso,       setSucesso]       = useState('')
  const [erro,          setErro]          = useState('')
  const [editando,      setEditando]      = useState(false)
  const [formEdit,      setFormEdit]      = useState<Partial<Pedido>>({})

  // FIX B1+B2: estado para campos personalizados configurados e seus valores no formulário
  const [camposPedido,     setCamposPedido]     = useState<CampoPedido[]>([])
  const [camposExtrasForm, setCamposExtrasForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') { carregarPedido(); carregarCamposPedido() }
  }, [status, pedidoId])

  async function carregarPedido() {
    setLoading(true)
    try {
      const res = await fetch(`/api/producao/pedidos/${pedidoId}`)
      const data = await res.json()
      if (!res.ok) { setErro('Pedido não encontrado'); return }
      setPedido(data.pedido)
      setWorkflow(data.workflow || [])
      setFormEdit(data.pedido)

      // FIX B2: inicializa o form de campos extras com os valores já salvos no pedido
      if (data.pedido?.camposExtras) {
        try {
          setCamposExtrasForm(JSON.parse(data.pedido.camposExtras))
        } catch { setCamposExtrasForm({}) }
      }

      await carregarHistorico()
    } finally { setLoading(false) }
  }

  // FIX B1: busca os campos personalizados configurados para este workspace
  async function carregarCamposPedido() {
    try {
      const res = await fetch('/api/config/campos-pedido')
      const data = await res.json()
      setCamposPedido((data.campos || []).filter((c: CampoPedido) => c.ativo))
    } catch { }
  }

  async function carregarHistorico() {
    try {
      const res = await fetch(`/api/producao/historico/${pedidoId}`)
      const data = await res.json()
      setHistorico(data.historico || [])
    } catch { }
  }

  async function iniciarProducao() {
    setIniciando(true)
    try {
      const res = await fetch('/api/producao/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro'); return }
      mostrarSucesso(`Produção iniciada em ${data.setores} setor${data.setores !== 1 ? 'es' : ''}!`)
      carregarPedido()
    } finally { setIniciando(false) }
  }

  // FIX B2: inclui camposExtras ao salvar a edição
  async function salvarEdicao() {
    try {
      const payload = {
        ...formEdit,
        // Serializa campos extras do formulário de volta para JSON string
        camposExtras: Object.keys(camposExtrasForm).length > 0
          ? JSON.stringify(camposExtrasForm)
          : null,
      }
      const res = await fetch(`/api/producao/pedidos/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) return
      setPedido(prev => ({ ...prev!, ...payload }))
      setEditando(false)
      mostrarSucesso('Pedido atualizado!')
    } catch { setErro('Erro ao salvar') }
  }

  function cancelarEdicao() {
    setEditando(false)
    // Restaura valores originais do pedido
    if (pedido?.camposExtras) {
      try { setCamposExtrasForm(JSON.parse(pedido.camposExtras)) } catch { setCamposExtrasForm({}) }
    } else {
      setCamposExtrasForm({})
    }
  }

  // Renderiza input do campo personalizado conforme o tipo
  function renderCampoEdit(campo: CampoPedido) {
    const val = camposExtrasForm[campo.nome] || ''
    const set = (v: string) => setCamposExtrasForm(p => ({ ...p, [campo.nome]: v }))

    if (campo.tipo === 'lista' && campo.opcoes) {
      let opcoes: string[] = []
      try { opcoes = JSON.parse(campo.opcoes) } catch { }
      return (
        <select value={val} onChange={e => set(e.target.value)} className={inputClass}>
          <option value="">Selecione...</option>
          {opcoes.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      )
    }
    if (campo.tipo === 'checkbox') return (
      <label className="flex items-center gap-2 cursor-pointer mt-1">
        <input type="checkbox" checked={val === 'true'} onChange={e => set(String(e.target.checked))}
          className="accent-orange-500 w-4 h-4" />
        <span className="text-sm text-gray-700">Sim</span>
      </label>
    )
    if (campo.tipo === 'data')   return <input type="date"   value={val} onChange={e => set(e.target.value)} className={inputClass} />
    if (campo.tipo === 'cor')    return <input type="color"  value={val || '#000000'} onChange={e => set(e.target.value)} className="w-full h-9 border border-gray-200 rounded-lg px-1 cursor-pointer" />
    if (campo.tipo === 'numero') return <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={campo.placeholder || ''} className={inputClass} />
    return <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={campo.placeholder || ''} className={inputClass} />
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg); setTimeout(() => setSucesso(''), 3000)
  }

  // FIX B1: usa camposPedido configurados para exibir os campos em modo leitura
  // Se não houver config, faz fallback para exibição simples do camposExtras raw
  const camposExtrasObj: Record<string, string> = pedido?.camposExtras
    ? (() => { try { return JSON.parse(pedido.camposExtras) } catch { return {} } })()
    : {}

  const isAdmin = session?.user?.role === 'ADMIN'

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  )

  if (!pedido) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-2">Pedido não encontrado</p>
        <button onClick={() => router.push('/dashboard/pedidos')} className="text-orange-500 text-sm">← Voltar</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard/pedidos')}
            className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                {pedido.numero}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORIDADE_COR[pedido.prioridade]}`}>
                {pedido.prioridade}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COR[pedido.status]}`}>
                {pedido.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{pedido.destinatario}</h1>
          </div>

          {pedido.status === 'ABERTO' && workflow.length === 0 && (
            <button onClick={iniciarProducao} disabled={iniciando}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              <Play size={14} />
              {iniciando ? 'Iniciando...' : 'Iniciar produção'}
            </button>
          )}

          {!editando && session?.user?.role !== 'OPERADOR' && (
            <button onClick={() => setEditando(true)}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm transition">
              <Edit2 size={14} /> Editar
            </button>
          )}
        </div>

        {sucesso && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {sucesso}</div>}
        {erro    && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-600">{erro}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Coluna principal */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Dados do pedido */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Dados do pedido</h2>
                {editando && (
                  <div className="flex gap-2">
                    <button onClick={cancelarEdicao} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      <X size={12} /> Cancelar
                    </button>
                    <button onClick={salvarEdicao} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1 font-medium">
                      <Save size={12} /> Salvar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Destinatário',  key: 'destinatario', type: 'text'   },
                  { label: 'ID do cliente', key: 'idCliente',    type: 'text'   },
                  { label: 'Canal',         key: 'canal',        type: 'text'   },
                  { label: 'Produto',       key: 'produto',      type: 'text', span: 2 },
                  { label: 'Quantidade',    key: 'quantidade',   type: 'number' },
                  ...(isAdmin ? [{ label: 'Valor (R$)', key: 'valor', type: 'number' }] : []),
                  { label: 'Data entrada',  key: 'dataEntrada',  type: 'date'   },
                  { label: 'Data envio',    key: 'dataEnvio',    type: 'date'   },
                  { label: 'Prioridade',    key: 'prioridade',   type: 'select', opcoes: ['BAIXA','NORMAL','ALTA','URGENTE'] },
                ].map((campo: any) => (
                  <div key={campo.key} className={campo.span === 2 ? 'col-span-2' : ''}>
                    <p className="text-xs text-gray-400 mb-1">{campo.label}</p>
                    {editando ? (
                      campo.type === 'select' ? (
                        <select value={(formEdit as any)[campo.key] || ''}
                          onChange={e => setFormEdit(p => ({ ...p, [campo.key]: e.target.value }))}
                          className={inputClass}>
                          {campo.opcoes.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={campo.type} value={(formEdit as any)[campo.key] || ''}
                          onChange={e => setFormEdit(p => ({ ...p, [campo.key]: e.target.value }))}
                          className={inputClass} />
                      )
                    ) : (
                      <p className="text-sm text-gray-800">
                        {campo.key === 'valor' && pedido.valor
                          ? `R$ ${Number(pedido.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : campo.key.includes('data') && (pedido as any)[campo.key]
                          ? new Date((pedido as any)[campo.key]).toLocaleDateString('pt-BR')
                          : (pedido as any)[campo.key] || '—'}
                      </p>
                    )}
                  </div>
                ))}

                {/* Endereço */}
                {pedido.endereco && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-1">Endereço de entrega</p>
                    <p className="text-sm text-gray-800">{pedido.endereco}</p>
                  </div>
                )}

                {/* Observações */}
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-1">Observações</p>
                  {editando ? (
                    <textarea value={formEdit.observacoes || ''}
                      onChange={e => setFormEdit(p => ({ ...p, observacoes: e.target.value }))}
                      className={inputClass + ' resize-none'} rows={2} />
                  ) : (
                    <p className="text-sm text-gray-800">{pedido.observacoes || '—'}</p>
                  )}
                </div>
              </div>

              {/* ── CAMPOS PERSONALIZADOS ─────────────────────────────────
                  FIX B1: exibe campos configurados em PedidoCampoConfig com
                  seus nomes e valores.
                  FIX B2: em modo edição, renderiza inputs para cada campo
                  e inclui os valores em salvarEdicao().
                  ─────────────────────────────────────────────────────── */}
              {camposPedido.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Campos personalizados
                  </p>

                  {editando ? (
                    /* Modo edição — inputs para cada campo */
                    <div className="grid grid-cols-2 gap-3">
                      {camposPedido.map(campo => (
                        <div key={campo.id} className={campo.tipo === 'texto' || campo.tipo === 'text' ? '' : ''}>
                          <p className="text-xs text-gray-400 mb-1">{campo.nome}</p>
                          {renderCampoEdit(campo)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Modo leitura — exibe valor salvo ou "—" */
                    <div className="grid grid-cols-2 gap-3">
                      {camposPedido.map(campo => {
                        const valor = camposExtrasObj[campo.nome]
                        return (
                          <div key={campo.id}>
                            <p className="text-xs text-gray-400 mb-0.5">{campo.nome}</p>
                            {campo.tipo === 'checkbox' ? (
                              <p className="text-sm text-gray-800">
                                {valor === 'true' ? '✓ Sim' : valor === 'false' ? '✗ Não' : '—'}
                              </p>
                            ) : campo.tipo === 'cor' && valor ? (
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: valor }} />
                                <span className="text-sm text-gray-800">{valor}</span>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-800 font-medium text-orange-700">
                                {valor || <span className="text-gray-400 font-normal">—</span>}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Fallback: se não há campos configurados mas há dados em camposExtras */}
              {camposPedido.length === 0 && Object.keys(camposExtrasObj).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Campos extras</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(camposExtrasObj).map(([nome, valor]) => (
                      <div key={nome}>
                        <p className="text-xs text-gray-400">{nome}</p>
                        <p className="text-sm text-gray-800">{String(valor) || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Workflow */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Fluxo de produção</h2>

              {workflow.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400 mb-2">Produção ainda não iniciada</p>
                  {pedido.status === 'ABERTO' && (
                    <button onClick={iniciarProducao} disabled={iniciando}
                      className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-medium mx-auto">
                      <Play size={12} /> {iniciando ? 'Iniciando...' : 'Iniciar produção'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {workflow.map((item, i) => {
                    const cfg = STATUS_WF[item.status] || STATUS_WF.PENDENTE
                    const Icon = cfg.icon
                    return (
                      <div key={item.id}
                        onClick={() => router.push(`/dashboard/setor/${item.setorId}`)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-orange-300 transition ${
                          item.status === 'EM_ANDAMENTO' ? 'border-orange-200 bg-orange-50' :
                          item.status === 'CONCLUIDO'    ? 'border-green-100 bg-green-50'   :
                          item.status === 'DEVOLVIDO'    ? 'border-red-100 bg-red-50'       :
                          'border-gray-100'
                        }`}>
                        <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 1}</span>
                        <Icon size={15} className={cfg.cor} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{item.setorNome}</p>
                          {item.responsavelNome && <p className="text-xs text-gray-400">Resp: {item.responsavelNome}</p>}
                          {item.observacoes && <p className="text-xs text-gray-400 truncate">{item.observacoes}</p>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cor}`}>{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Coluna lateral — Histórico */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Histórico</h2>
              {historico.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum histórico ainda</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {historico.map(h => (
                    <div key={h.id} className="flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-700">{h.descricao}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {h.usuarioNome && `${h.usuarioNome} · `}
                          {new Date(h.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
