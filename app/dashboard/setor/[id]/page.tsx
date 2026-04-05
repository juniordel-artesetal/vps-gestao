'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Package, Clock, CheckCircle, ArrowRight, Search,
  X, RotateCcw, ChevronRight, Users, Play
} from 'lucide-react'

interface CampoPedido { id: string; nome: string; tipo: string; opcoes: string | null }
interface Usuario { id: string; nome: string }
interface Freelancer { id: string; nome: string; especialidade: string | null }
interface SetorOpcao { id: string; nome: string; ordem: number }

interface Pedido {
  id: string; pedidoId: string; numero: string; destinatario: string
  idCliente: string | null; produto: string; status: string; statusSetor: string
  prioridade: string; canal: string | null; dataEnvio: string | null
  dataEntrada: string | null; camposExtras: string | null
  responsavelNome: string | null; iniciadoEm: string | null; concluidoEm: string | null
  observacoesPedido: string | null
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
function diasAteEnvio(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export default function SetorPage() {
  const params  = useParams()
  const router  = useRouter()
  const { data: session } = useSession()
  const setorId = params?.id as string

  const [nomeSetor,   setNomeSetor]   = useState('')
  const [pedidos,     setPedidos]     = useState<Pedido[]>([])
  const [campos,      setCampos]      = useState<CampoPedido[]>([])
  const [usuarios,    setUsuarios]    = useState<Usuario[]>([])
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [loading,     setLoading]     = useState(true)
  const [atualizando, setAtualizando] = useState<Set<string>>(new Set())

  const [busca,             setBusca]             = useState('')
  const [filtroUrgencia,    setFiltroUrgencia]    = useState('')
  const [filtroData,        setFiltroData]        = useState('')
  const [filtroFreelancer,  setFiltroFreelancer]  = useState('')
  const [filtrosCampos,     setFiltrosCampos]     = useState<Record<string, string>>({})
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)

  const [selecionados,    setSelecionados]    = useState<string[]>([])
  const [massaResp,       setMassaResp]       = useState('')
  const [massaFreelancer, setMassaFreelancer] = useState('')
  const [massaEnvio,      setMassaEnvio]      = useState('')
  const [massaWL,         setMassaWL]         = useState<Record<string, string>>({})
  const [executandoMassa, setExecutandoMassa] = useState(false)

  // Modal devolução individual e em massa
  const [modalDevolver,   setModalDevolver]   = useState<string | null>(null) // pedidoId ou 'massa'
  const [setoresOpcoes,   setSetoresOpcoes]   = useState<SetorOpcao[]>([])
  const [setorDestino,    setSetorDestino]    = useState('')
  const [motivoDevolucao, setMotivoDevolucao] = useState('')

  const podeEditar = session?.user?.role !== 'OPERADOR'

  const carregar = useCallback(async () => {
    if (!setorId) return
    setLoading(true); setSelecionados([])
    try {
      const [resSetor, resCampos, resUsers, resFl, resSetores] = await Promise.all([
        fetch(`/api/producao/workflow?setorId=${setorId}&incluirConcluidos=${mostrarConcluidos}`),
        fetch('/api/config/campos-pedido').catch(() => ({ json: async () => ({ campos: [] }) })),
        fetch('/api/config/usuarios').catch(() => ({ json: async () => ({ usuarios: [] }) })),
        fetch('/api/demandas/freelancers?todos=true').catch(() => ({ json: async () => [] })),
        fetch('/api/producao/setores').catch(() => ({ json: async () => ({ setores: [] }) })),
      ])
      const data  = await resSetor.json()
      const cData = await (resCampos as any).json()
      const uData = await (resUsers as any).json()
      const flData  = await (resFl as any).json()
      const stData  = await (resSetores as any).json()
      setSetoresOpcoes((stData.setores || []).filter((s: any) => s.id !== setorId))
      setPedidos(data.pedidos || [])
      setNomeSetor(data.nomeSetor || 'Setor')
      setCampos((cData.campos || []).filter((c: any) => c.ativo))
      // Aceita { usuarios: [] } ou { users: [] } ou array direto; ativo=null/undefined = ativo
      const listaUsuarios = Array.isArray(uData) ? uData : (uData.usuarios || uData.users || [])
      setUsuarios(listaUsuarios.filter((u: any) => u.ativo !== false))
      setFreelancers(Array.isArray(flData) ? flData.filter((f: any) => f.ativo !== false) : [])
    } catch { setPedidos([]) }
    finally { setLoading(false) }
  }, [setorId, mostrarConcluidos])

  useEffect(() => { carregar() }, [carregar])

  async function chamarWorkflow(pedidoId: string, extra: any = {}) {
    setAtualizando(prev => new Set([...prev, pedidoId]))
    try {
      const res = await fetch('/api/producao/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error || 'Erro ao executar ação')
      else carregar()
    } finally {
      setAtualizando(prev => { const s = new Set(prev); s.delete(pedidoId); return s })
    }
  }

  // Iniciar no setor (iniciadoEm = NOW → aparece "Concluir")
  const handleIniciar  = (id: string) => chamarWorkflow(id, { acao: 'iniciar_setor' })
  // Concluir → avança para próximo setor
  const handleConcluir = (id: string) => chamarWorkflow(id)
  // Devolver → abre modal para escolher setor destino e motivo
  function handleDevolver(id: string) {
    setModalDevolver(id)
    setSetorDestino('')
    setMotivoDevolucao('')
  }

  // ── Ações em massa ────────────────────────────────────────
  async function massaIniciar() {
    if (!selecionados.length) return
    setExecutandoMassa(true)
    for (const id of selecionados) {
      const p = pedidos.find(x => (x.pedidoId || x.id) === id)
      if (!p || p.iniciadoEm) continue
      await fetch('/api/producao/workflow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: id, acao: 'iniciar_setor' }),
      })
    }
    setExecutandoMassa(false); carregar()
  }

  async function massaConcluir() {
    const aptos = selecionados.filter(id => {
      const p = pedidos.find(x => (x.pedidoId || x.id) === id)
      return p && p.iniciadoEm && p.statusSetor === 'EM_ANDAMENTO'
    })
    if (!aptos.length || !confirm(`Concluir ${aptos.length} pedido(s)?`)) return
    setExecutandoMassa(true)
    for (const id of aptos) {
      await fetch('/api/producao/workflow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: id }),
      })
    }
    setExecutandoMassa(false); carregar()
  }

  function massaDevolver() {
    if (!selecionados.length) return
    setModalDevolver('massa')
    setSetorDestino('')
    setMotivoDevolucao('')
  }

  async function confirmarDevolucao() {
    if (!motivoDevolucao.trim()) {
      alert('Informe o motivo da devolução antes de continuar.')
      return
    }
    const ids = modalDevolver === 'massa' ? selecionados : [modalDevolver!]
    setExecutandoMassa(true)
    for (const id of ids) {
      await fetch('/api/producao/workflow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: id,
          devolver: true,
          setorDestinoId: setorDestino || undefined,
          motivo: motivoDevolucao || undefined,
        }),
      })
    }
    setModalDevolver(null); setSetorDestino(''); setMotivoDevolucao('')
    setExecutandoMassa(false); carregar()
    if (modalDevolver !== 'massa') {} else { setSelecionados([]) }
  }

  async function massaResponsavel() {
    if (!massaResp || !selecionados.length) return
    setExecutandoMassa(true)
    for (const id of selecionados) {
      const p = pedidos.find(x => (x.pedidoId || x.id) === id)
      if (!p) continue
      // Responsável fica no PedidoSetor, não no pedido — usa workflow com acao específica
      await fetch('/api/producao/workflow', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: p.pedidoId || p.id, setorId, responsavelId: massaResp }),
      })
    }
    setMassaResp(''); setExecutandoMassa(false); carregar()
  }

  async function massaDataEnvio() {
    if (!massaEnvio || !selecionados.length) return
    setExecutandoMassa(true)
    // Converte "2026-04-29" para ISO completo para garantir parse correto na API
    const dataISO = new Date(massaEnvio + 'T12:00:00').toISOString()
    for (const id of selecionados) {
      const p = pedidos.find(x => (x.pedidoId || x.id) === id)
      if (!p) continue
      const res = await fetch(`/api/producao/pedidos/${p.pedidoId || p.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataEnvio: dataISO }),
      })
      if (!res.ok) console.error('Erro ao atualizar data de envio', await res.text())
    }
    setMassaEnvio(''); setExecutandoMassa(false); carregar()
  }

  async function massaCampo(campoNome: string) {
    const valor = massaWL[campoNome]
    if (!valor || !selecionados.length) return
    setExecutandoMassa(true)
    for (const id of selecionados) {
      const p = pedidos.find(x => (x.pedidoId || x.id) === id)
      if (!p) continue
      const extras = p.camposExtras ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })() : {}
      extras[campoNome] = valor
      await fetch(`/api/producao/pedidos/${p.pedidoId || p.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposExtras: extras }),
      })
    }
    setMassaWL(prev => { const n = { ...prev }; delete n[campoNome]; return n })
    setExecutandoMassa(false); carregar()
  }

  async function massaVincularFreelancer() {
    if (!massaFreelancer || !selecionados.length) return
    setExecutandoMassa(true)
    for (const id of selecionados) {
      const p = pedidos.find(x => (x.pedidoId || x.id) === id)
      if (!p) continue
      const extras = p.camposExtras
        ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })()
        : {}
      // Adiciona ao mapa _freelancers (mesmo formato que o sistema de demandas usa)
      extras._freelancers = { ...(extras._freelancers || {}), massa: massaFreelancer }
      await fetch(`/api/producao/pedidos/${p.pedidoId || p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposExtras: JSON.stringify(extras) }), // ← stringify obrigatório
      })
    }
    setMassaFreelancer('')
    setExecutandoMassa(false)
    carregar()
  }

  function toggleSel(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleTodos() {
    const ids = pedidosFiltrados.map(p => p.pedidoId || p.id)
    setSelecionados(prev => prev.length === ids.length ? [] : ids)
  }

  const pedidosFiltrados = pedidos.filter(p => {
    if (busca) {
      const q = busca.toLowerCase()
      const extras = p.camposExtras ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })() : {}
      const extrasStr = Object.values(extras).join(' ').toLowerCase()
      if (!p.destinatario.toLowerCase().includes(q) && !p.numero.toLowerCase().includes(q) &&
          !p.produto.toLowerCase().includes(q) && !(p.idCliente || '').toLowerCase().includes(q) &&
          !extrasStr.includes(q)) return false
    }
    if (filtroUrgencia && p.prioridade !== filtroUrgencia) return false
    if (filtroData && p.dataEnvio && !p.dataEnvio.startsWith(filtroData)) return false
    // Filtro freelancer
    if (filtroFreelancer) {
      const extras = p.camposExtras ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })() : {}
      const flMap = extras._freelancers || {}
      if (!Object.values(flMap).includes(filtroFreelancer)) return false
    }
    // Filtros de campos personalizados
    if (Object.keys(filtrosCampos).length > 0) {
      const extras = p.camposExtras ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })() : {}
      for (const [nome, val] of Object.entries(filtrosCampos)) {
        if (val && extras[nome] !== val) return false
      }
    }
    return true
  })

  const camposMassa = campos.filter(c => c.tipo === 'lista' || c.tipo === 'texto')
  const temFiltro   = busca || filtroUrgencia || filtroData || filtroFreelancer || Object.values(filtrosCampos).some(Boolean)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => router.push('/dashboard/pedidos')} className="text-gray-400 hover:text-gray-600">← Pedidos</button>
            <ChevronRight size={14} className="text-gray-300" />
            <h1 className="text-lg font-bold text-gray-900">{nomeSetor || 'Setor'}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {pedidosFiltrados.length} de {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={mostrarConcluidos} onChange={e => setMostrarConcluidos(e.target.checked)} className="accent-orange-500 w-3.5 h-3.5" />
            Ver concluídos
          </label>
          <button onClick={carregar} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Atualizar</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-3">
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
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          {/* Filtro Freelancer */}
          {freelancers.length > 0 && (
            <select value={filtroFreelancer} onChange={e => setFiltroFreelancer(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todo freelancer</option>
              {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          )}
          {temFiltro && (
            <button onClick={() => { setBusca(''); setFiltroUrgencia(''); setFiltroData(''); setFiltroFreelancer(''); setFiltrosCampos({}) }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2">
              <X size={12} /> Limpar
            </button>
          )}
        {/* Filtros campos personalizados */}
        {campos.filter(c => c.tipo === 'lista').length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 mt-2">
            {campos.filter(c => c.tipo === 'lista' && c.opcoes).map(campo => (
              <div key={campo.id}>
                <select
                  value={filtrosCampos[campo.nome] || ''}
                  onChange={e => setFiltrosCampos(prev => ({ ...prev, [campo.nome]: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">{campo.nome}: Todos</option>
                  {JSON.parse(campo.opcoes!).map((op: string) => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Barra de ações em massa */}
      {selecionados.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-orange-200 flex-wrap">
            <span className="text-sm font-semibold text-orange-700">
              {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
            </span>
            {podeEditar && (
              <>
                <button onClick={massaIniciar} disabled={executandoMassa}
                  className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                  <Play size={11} /> Iniciar selecionados
                </button>
                <button onClick={massaConcluir} disabled={executandoMassa}
                  className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                  <CheckCircle size={11} /> Concluir selecionados
                </button>
                <button onClick={massaDevolver} disabled={executandoMassa}
                  className="flex items-center gap-1.5 text-xs border border-orange-300 text-orange-700 hover:bg-orange-100 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                  <RotateCcw size={11} /> Devolver selecionados
                </button>
              </>
            )}
            <button onClick={() => setSelecionados([])} className="text-xs text-orange-400 hover:text-orange-600 ml-auto">Cancelar</button>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs font-medium text-orange-700 block mb-1">Responsável</label>
                <select value={massaResp} onChange={e => setMassaResp(e.target.value)}
                  className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none min-w-36">
                  <option value="">Selecionar...</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <button onClick={massaResponsavel} disabled={!massaResp || executandoMassa}
                className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">Aplicar</button>
            </div>
            {/* Data de envio — somente ADMIN pode alterar em massa */}
            {session?.user?.role === 'ADMIN' && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">
                    Data de envio
                    <span className="ml-1 text-orange-400 font-normal text-xs">(só admin)</span>
                  </label>
                  <input type="date" value={massaEnvio} onChange={e => setMassaEnvio(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                </div>
                <button onClick={massaDataEnvio} disabled={!massaEnvio || executandoMassa}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">Aplicar</button>
              </div>
            )}
            {camposMassa.map(campo => {
              const val = massaWL[campo.nome] || ''
              return (
                <div key={campo.id} className="flex items-end gap-2">
                  <div>
                    <label className="text-xs font-medium text-orange-700 block mb-1">{campo.nome}</label>
                    {campo.tipo === 'lista' && campo.opcoes ? (
                      <select value={val} onChange={e => setMassaWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                        className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none min-w-28">
                        <option value="">Selecionar...</option>
                        {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={val} onChange={e => setMassaWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                        placeholder={campo.nome + '...'} className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-32" />
                    )}
                  </div>
                  <button onClick={() => massaCampo(campo.nome)} disabled={!val || executandoMassa}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">Aplicar</button>
                </div>
              )
            })}
            {/* Freelancer em massa — só ADMIN */}
            {session?.user?.role === 'ADMIN' && freelancers.length > 0 && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">Vincular Freelancer</label>
                  <select value={massaFreelancer} onChange={e => setMassaFreelancer(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none min-w-36">
                    <option value="">Selecionar...</option>
                    {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}{f.especialidade ? ` — ${f.especialidade}` : ''}</option>)}
                  </select>
                </div>
                <button onClick={massaVincularFreelancer} disabled={!massaFreelancer || executandoMassa}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">Aplicar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
          <Clock size={16} className="animate-spin" /> Carregando...
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle size={40} className="text-green-300 mb-3" />
          <p className="text-gray-500 font-medium">{pedidos.length === 0 ? 'Nenhum pedido neste setor' : 'Nenhum resultado'}</p>
          <p className="text-gray-400 text-sm mt-1">{pedidos.length === 0 ? 'Tudo em dia! 🎉' : 'Ajuste os filtros'}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-4 py-2 mb-1">
            <input type="checkbox"
              checked={selecionados.length === pedidosFiltrados.length && pedidosFiltrados.length > 0}
              onChange={toggleTodos} className="accent-orange-500 w-4 h-4" />
            <span className="text-xs text-gray-400 font-medium">Selecionar todos ({pedidosFiltrados.length})</span>
          </div>

          <div className="flex flex-col gap-3">
            {pedidosFiltrados.map(p => {
              const pedidoRealId  = p.pedidoId || p.id
              const dias          = diasAteEnvio(p.dataEnvio)
              const atrasado      = dias !== null && dias < 0
              const urgente       = dias !== null && dias >= 0 && dias <= 2
              const extras        = p.camposExtras ? (() => { try { return JSON.parse(p.camposExtras!) } catch { return {} } })() : {}
              const extrasVis     = Object.entries(extras).filter(([k]) => !k.startsWith('_'))
              // Freelancers vinculados — lê _freelancers e resolve nomes
              const flMap         = (extras._freelancers || {}) as Record<string, string>
              const flNomes       = Object.values(flMap)
                .map(fid => freelancers.find(f => f.id === fid)?.nome)
                .filter(Boolean) as string[]
              const isAtualizando = atualizando.has(pedidoRealId)
              const isSel         = selecionados.includes(pedidoRealId)
              const concluido     = p.statusSetor === 'CONCLUIDO'
              const devolvido     = p.statusSetor === 'DEVOLVIDO'

              // Lógica de estado do setor
              // iniciadoEm = null → ainda não iniciou → mostrar "Iniciar"
              // iniciadoEm preenchido + EM_ANDAMENTO → mostrar "Concluir" + "Devolver"
              // DEVOLVIDO → mostrar "Iniciar" (recomeçar)
              const naoIniciado = !p.iniciadoEm || devolvido
              const emAndamento = p.iniciadoEm && p.statusSetor === 'EM_ANDAMENTO'

              return (
                <div key={p.id} className={`bg-white rounded-xl border transition ${
                  isSel    ? 'border-orange-300 bg-orange-50/30' :
                  atrasado ? 'border-red-200 bg-red-50/20' :
                  urgente  ? 'border-orange-200' :
                  concluido ? 'border-green-200 bg-green-50/20 opacity-70' :
                  devolvido ? 'border-orange-200 bg-orange-50/10' :
                  'border-gray-100 hover:border-gray-200'
                }`}>
                  <div className="flex items-start gap-3 p-4">
                    <input type="checkbox" checked={isSel} onChange={() => toggleSel(pedidoRealId)}
                      className="accent-orange-500 w-4 h-4 mt-1 flex-shrink-0" />
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Package size={16} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-gray-900">{p.destinatario}</p>
                        {p.numero && <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">#{p.numero}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${URGENCIA_COR[p.prioridade] || URGENCIA_COR.NORMAL}`}>
                          {URGENCIA_LABEL[p.prioridade] || p.prioridade}
                        </span>
                        {p.canal && <span className="text-xs text-gray-500">{CANAL_EMOJI[p.canal] || '📦'} {p.canal}</span>}
                        {p.idCliente && <span className="text-xs text-gray-400">User: {p.idCliente}</span>}
                        {concluido && <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">✓ Concluído aqui</span>}
                        {devolvido && <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full font-medium">↩ Devolvido</span>}
                        {naoIniciado && !devolvido && !concluido && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">Aguardando início</span>}
                      </div>
                      <p className="text-xs text-gray-500 mb-1.5 truncate">{p.produto}</p>
                      {/* Freelancer vinculado */}
                      {flNomes.length > 0 && (
                        <div className="flex items-center gap-1 mb-1.5">
                          <span className="text-xs text-purple-500">👤</span>
                          <span className="text-xs text-purple-500 font-medium">{flNomes.join(', ')}</span>
                        </div>
                      )}
                      {extrasVis.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1.5">
                          {extrasVis.map(([nome, valor]) => (
                            <span key={nome} className="text-xs">
                              <span className="text-gray-400">{nome}:</span>{' '}
                              <span className="text-orange-600 font-medium">{valor === 'true' ? 'Sim' : valor === 'false' ? 'Não' : String(valor)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        {p.dataEntrada && <span>Entrada: <strong className="text-gray-600">{fmtData(p.dataEntrada)}</strong></span>}
                        {p.dataEnvio && (
                          <span className={atrasado ? 'text-red-600 font-semibold' : urgente ? 'text-orange-600 font-semibold' : ''}>
                            Envio: <strong>{fmtData(p.dataEnvio)}</strong>
                            {atrasado && ' ⚠ Atrasado!'}{urgente && !atrasado && ` (${dias}d)`}
                          </span>
                        )}
                        {p.responsavelNome && <span className="flex items-center gap-1"><Users size={10} /> {p.responsavelNome}</span>}
                      </div>
                      {/* Motivo da devolução — destaque quando DEVOLVIDO */}
                      {devolvido && p.observacoes && (
                        <div className="mt-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-start gap-1.5">
                          <span className="text-orange-500 text-xs flex-shrink-0 mt-0.5">↩</span>
                          <p className="text-xs text-orange-700 font-medium leading-relaxed">
                            <span className="text-orange-500">Motivo:</span> {p.observacoes}
                          </p>
                        </div>
                      )}
                      {/* Observação do pedido */}
                      {p.observacoesPedido && (
                        <p className="text-xs text-gray-400 italic mt-1 border-l-2 border-gray-200 pl-2 truncate">
                          💬 {p.observacoesPedido}
                        </p>
                      )}
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                      <a href={`/dashboard/pedidos/${pedidoRealId}`}
                        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium">
                        Ver <ArrowRight size={11} />
                      </a>

                      {podeEditar && !concluido && (
                        <>
                          {/* Iniciar — aparece quando não iniciado ou devolvido */}
                          {naoIniciado && (
                            <button onClick={() => handleIniciar(pedidoRealId)} disabled={isAtualizando}
                              className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-50">
                              <Play size={11} />
                              {isAtualizando ? '...' : devolvido ? 'Reiniciar' : 'Iniciar'}
                            </button>
                          )}

                          {/* Concluir e Devolver — apenas após Iniciar */}
                          {emAndamento && (
                            <>
                              <button onClick={() => handleConcluir(pedidoRealId)} disabled={isAtualizando}
                                className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-50">
                                <CheckCircle size={11} />
                                {isAtualizando ? '...' : 'Concluir →'}
                              </button>
                              <button onClick={() => handleDevolver(pedidoRealId)} disabled={isAtualizando}
                                className="flex items-center gap-1 text-xs border border-orange-300 text-orange-600 hover:bg-orange-50 px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-50">
                                <RotateCcw size={11} />
                                Devolver
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── MODAL DEVOLUÇÃO ── */}
      {modalDevolver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <RotateCcw size={16} className="text-orange-500"/>
                {modalDevolver === 'massa' ? `Devolver ${selecionados.length} pedido(s)` : 'Devolver pedido'}
              </h2>
              <button onClick={() => setModalDevolver(null)}><X size={18} className="text-gray-400 hover:text-gray-600"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Devolver para qual setor?
                  <span className="ml-1 text-gray-400 font-normal">(opcional — padrão: setor anterior)</span>
                </label>
                <select value={setorDestino} onChange={e => setSetorDestino(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">← Setor anterior (padrão)</option>
                  {setoresOpcoes.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-red-600 block mb-1">Motivo da devolução *<span className="ml-1 text-red-400 font-normal">(obrigatório)</span></label>
                <textarea value={motivoDevolucao} onChange={e => setMotivoDevolucao(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${
                    !motivoDevolucao.trim() ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-200 focus:ring-orange-400'
                  }`}
                  rows={3} placeholder="Obrigatório: informe o motivo da devolução..."/>
                {!motivoDevolucao.trim() && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">⚠ Preenchimento obrigatório</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalDevolver(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={confirmarDevolucao} disabled={executandoMassa}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  <RotateCcw size={14}/>
                  {executandoMassa ? 'Devolvendo...' : 'Confirmar devolução'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
