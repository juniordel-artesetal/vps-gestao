'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Search, X, Package, ChevronDown, AlertTriangle, User, Save } from 'lucide-react'

interface PedidoSetor {
  id: string
  pedidoId: string
  setorId: string
  status: string
  responsavelId: string | null
  responsavelNome: string | null
  observacoes: string | null
  iniciadoEm: string | null
  concluidoEm: string | null
  estoqueInsuficiente: boolean
  numero: string
  destinatario: string
  produto: string
  quantidade: number
  prioridade: string
  dataEnvio: string | null
  dataEntrada: string | null
  observacoes_pedido: string | null
  canal: string | null
  idCliente: string | null
  camposExtras: string | null
  endereco: string | null
}

interface CampoPedido {
  id: string
  nome: string
  tipo: string
  opcoes: string | null
  placeholder: string | null
  ativo: boolean
  usarComoFiltro: boolean
  usarNaMassa: boolean
}

interface CampoSetor {
  id: string
  nome: string
  tipo: string
  opcoes: string | null
  obrigatorio: boolean
  placeholder: string | null
}

interface Usuario { id: string; nome: string }

const PRIO_COR: Record<string, string> = {
  URGENTE: 'text-red-600 bg-red-50 border-red-200',
  ALTA:    'text-orange-600 bg-orange-50 border-orange-200',
  NORMAL:  'text-blue-600 bg-blue-50 border-blue-200',
  BAIXA:   'text-gray-500 bg-gray-50 border-gray-200',
}

const STATUS_COR: Record<string, string> = {
  PENDENTE:     'text-gray-500 bg-gray-50 border-gray-200',
  EM_ANDAMENTO: 'text-orange-600 bg-orange-50 border-orange-200',
  CONCLUIDO:    'text-green-600 bg-green-50 border-green-200',
  DEVOLVIDO:    'text-red-600 bg-red-50 border-red-200',
}

export default function SetorPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const setorId = params.id as string

  const [setorNome,    setSetorNome]    = useState('')
  const [pedidos,      setPedidos]      = useState<PedidoSetor[]>([])
  const [totais,       setTotais]       = useState<Record<string, number>>({})
  const [usuarios,     setUsuarios]     = useState<Usuario[]>([])
  const [camposSetor,  setCamposSetor]  = useState<CampoSetor[]>([])
  const [camposPedido, setCamposPedido] = useState<CampoPedido[]>([])
  const [valoresCampos, setValoresCampos] = useState<Record<string, Record<string, string>>>({})
  const [responsaveisTemp, setResponsaveisTemp] = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [salvando,     setSalvando]     = useState<string | null>(null)
  const [sucesso,      setSucesso]      = useState('')

  // Filtros
  const [busca,                  setBusca]                  = useState('')
  const [filtroPrioridade,       setFiltroPrioridade]       = useState('')
  const [filtroStatus,           setFiltroStatus]           = useState('')
  const [filtroDataEnvio,        setFiltroDataEnvio]        = useState('')
  const [filtroDataEntrada,      setFiltroDataEntrada]      = useState('')
  const [filtroResponsavel,      setFiltroResponsavel]      = useState('')
  const [filtroSemData,          setFiltroSemData]          = useState(false)
  const [filtroSomenteDevolvidos,setFiltroSomenteDevolvidos]= useState(false)
  const [filtroEstoqueInsuf,     setFiltroEstoqueInsuf]     = useState(false)
  const [filtroSemResp,          setFiltroSemResp]          = useState(false)
  const [filtrosWL,              setFiltrosWL]              = useState<Record<string, string>>({})
  const [mostrarFiltros,         setMostrarFiltros]         = useState(false)

  // Seleção + massa
  const [selecionados,    setSelecionados]    = useState<string[]>([])
  const [massaResp,       setMassaResp]       = useState('')
  const [massaEnvio,      setMassaEnvio]      = useState('')
  const [massaWL,         setMassaWL]         = useState<Record<string, string>>({})
  const [executandoMassa, setExecutandoMassa] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') { carregarDados(); carregarUsuarios(); carregarCampos() }
  }, [status, setorId])

  async function carregarDados() {
    setLoading(true)
    try {
      const setoresRes = await fetch('/api/producao/setores')
      const setoresData = await setoresRes.json()
      setSetorNome((setoresData.setores || []).find((s: any) => s.id === setorId)?.nome || 'Setor')

      const res = await fetch(`/api/producao/workflow?setorId=${setorId}`)
      const data = await res.json()
      setPedidos(data.pedidos || [])

      const t: Record<string, number> = {}
      ;(data.totais || []).forEach((item: any) => { t[item.status] = Number(item.total) })
      setTotais(t)
    } finally { setLoading(false) }
  }

  async function carregarUsuarios() {
    const res = await fetch('/api/config/usuarios')
    const data = await res.json()
    setUsuarios((data.usuarios || []).filter((u: any) => u.ativo))
  }

  async function carregarCampos() {
    const [setorRes, pedidoRes] = await Promise.all([
      fetch(`/api/config/campos?setorId=${setorId}`),
      fetch('/api/config/campos-pedido'),
    ])
    setCamposSetor((await setorRes.json()).campos || [])
    setCamposPedido(((await pedidoRes.json()).campos || []).filter((c: CampoPedido) => c.ativo))
  }

  // Filtros locais
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroStatus && p.status !== filtroStatus) return false
    if (filtroPrioridade && p.prioridade !== filtroPrioridade) return false
    if (filtroSomenteDevolvidos && p.status !== 'DEVOLVIDO') return false
    if (filtroSemData && p.dataEnvio) return false
    if (filtroEstoqueInsuf && !p.estoqueInsuficiente) return false
    if (filtroSemResp && p.responsavelId) return false
    if (filtroResponsavel && p.responsavelId !== filtroResponsavel) return false
    if (filtroDataEnvio) {
      if (!p.dataEnvio) return false
      if (new Date(p.dataEnvio).toISOString().split('T')[0] !== filtroDataEnvio) return false
    }
    if (filtroDataEntrada) {
      if (!p.dataEntrada) return false
      if (new Date(p.dataEntrada).toISOString().split('T')[0] !== filtroDataEntrada) return false
    }
    if (busca) {
      const q = busca.toLowerCase()
      const extras = p.camposExtras ? JSON.parse(p.camposExtras) : {}
      const extraStr = Object.values(extras).join(' ').toLowerCase()
      if (!p.numero.toLowerCase().includes(q) &&
          !p.destinatario.toLowerCase().includes(q) &&
          !(p.idCliente || '').toLowerCase().includes(q) &&
          !p.produto.toLowerCase().includes(q) &&
          !extraStr.includes(q)) return false
    }
    for (const [nome, val] of Object.entries(filtrosWL)) {
      if (!val) continue
      const extras = p.camposExtras ? JSON.parse(p.camposExtras) : {}
      if (String(extras[nome] || '').toLowerCase() !== val.toLowerCase()) return false
    }
    return true
  })

  // ── Ações por card ────────────────────────────────────────────
  // FIX B4: concluir() agora REMOVE o pedido da lista local em vez
  // de apenas atualizar o status para CONCLUIDO. O pedido some da
  // fila do setor imediatamente após ser concluído, mas os totais
  // são atualizados para refletir a mudança.
  async function concluir(pedidoId: string) {
    setSalvando(pedidoId + '_c')
    await fetch(`/api/producao/workflow/${pedidoId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setorId, status: 'CONCLUIDO' }),
    })
    // Remove da lista (pedido concluído sai da fila do setor)
    setPedidos(p => p.filter(x => x.pedidoId !== pedidoId))
    setTotais(t => ({
      ...t,
      CONCLUIDO:    (t.CONCLUIDO    || 0) + 1,
      EM_ANDAMENTO: Math.max(0, (t.EM_ANDAMENTO || 0) - 1),
    }))
    setSelecionados(s => s.filter(id => {
      const ps = pedidos.find(x => x.pedidoId === pedidoId)
      return ps ? id !== ps.id : true
    }))
    setSalvando(null)
    ok('✓ Concluído! Pedido avançou para o próximo setor.')
  }

  async function devolver(pedidoId: string) {
    setSalvando(pedidoId + '_d')
    await fetch(`/api/producao/workflow/${pedidoId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setorId, status: 'DEVOLVIDO' }),
    })
    setPedidos(p => p.map(x => x.pedidoId === pedidoId ? { ...x, status: 'DEVOLVIDO' } : x))
    setSalvando(null)
    ok('↩ Devolvido')
  }

  async function iniciar(pedidoId: string) {
    await fetch(`/api/producao/workflow/${pedidoId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setorId, status: 'EM_ANDAMENTO' }),
    })
    setPedidos(p => p.map(x => x.pedidoId === pedidoId ? { ...x, status: 'EM_ANDAMENTO' } : x))
  }

  async function salvarResponsavel(pedidoId: string, psId: string) {
    const respId = responsaveisTemp[psId] ?? ''
    setSalvando(psId + '_r')
    await fetch(`/api/producao/workflow/${pedidoId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setorId, status: pedidos.find(p => p.pedidoId === pedidoId)?.status, responsavelId: respId || null }),
    })
    const nome = usuarios.find(u => u.id === respId)?.nome || null
    setPedidos(p => p.map(x => x.pedidoId === pedidoId ? { ...x, responsavelId: respId || null, responsavelNome: nome } : x))
    setSalvando(null)
    ok('Responsável salvo!')
  }

  async function toggleEstoque(pedidoId: string, atual: boolean) {
    await fetch(`/api/producao/workflow/${pedidoId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setorId, status: pedidos.find(p => p.pedidoId === pedidoId)?.status, estoqueInsuficiente: !atual }),
    })
    setPedidos(p => p.map(x => x.pedidoId === pedidoId ? { ...x, estoqueInsuficiente: !atual } : x))
  }

  async function salvarCampoSetor(pedidoId: string, campoId: string, valor: string) {
    await fetch('/api/producao/campos-valores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedidoId, setorId, campoId, valor }),
    })
  }

  // ── Ações em MASSA ────────────────────────────────────────────
  // FIX B4: massaConcluir() remove TODOS os pedidos concluídos da
  // lista de uma vez só, após o loop de API calls.
  async function massaConcluir() {
    setExecutandoMassa(true)
    const pedidoIdsConcluidosSet = new Set<string>()

    for (const psId of selecionados) {
      const p = pedidos.find(x => x.id === psId)
      if (!p) continue
      await fetch(`/api/producao/workflow/${p.pedidoId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setorId, status: 'CONCLUIDO' }),
      })
      pedidoIdsConcluidosSet.add(p.pedidoId)
    }

    const count = pedidoIdsConcluidosSet.size
    // Remove todos os concluídos da lista de uma vez
    setPedidos(prev => prev.filter(x => !pedidoIdsConcluidosSet.has(x.pedidoId)))
    setTotais(t => ({
      ...t,
      CONCLUIDO:    (t.CONCLUIDO    || 0) + count,
      EM_ANDAMENTO: Math.max(0, (t.EM_ANDAMENTO || 0) - count),
    }))
    setSelecionados([])
    setExecutandoMassa(false)
    ok(`${count} pedido${count !== 1 ? 's' : ''} concluído${count !== 1 ? 's' : ''}!`)
  }

  async function massaDevolver() {
    setExecutandoMassa(true)
    for (const psId of selecionados) {
      const p = pedidos.find(x => x.id === psId)
      if (!p) continue
      await fetch(`/api/producao/workflow/${p.pedidoId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setorId, status: 'DEVOLVIDO' }),
      })
      setPedidos(prev => prev.map(x => x.id === psId ? { ...x, status: 'DEVOLVIDO' } : x))
    }
    setSelecionados([])
    setExecutandoMassa(false)
    ok(`${selecionados.length} devolvido${selecionados.length > 1 ? 's' : ''}!`)
  }

  async function aplicarMassaResp() {
    if (!massaResp) return
    setExecutandoMassa(true)
    for (const psId of selecionados) {
      const p = pedidos.find(x => x.id === psId)
      if (!p) continue
      await fetch(`/api/producao/workflow/${p.pedidoId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setorId, status: p.status, responsavelId: massaResp }),
      })
      const nome = usuarios.find(u => u.id === massaResp)?.nome || null
      setPedidos(prev => prev.map(x => x.id === psId ? { ...x, responsavelId: massaResp, responsavelNome: nome } : x))
    }
    setMassaResp('')
    setExecutandoMassa(false)
    ok('Responsável atribuído!')
  }

  async function aplicarMassaEnvio() {
    if (!massaEnvio) return
    setExecutandoMassa(true)
    for (const psId of selecionados) {
      const p = pedidos.find(x => x.id === psId)
      if (!p) continue
      await fetch(`/api/producao/pedidos/${p.pedidoId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataEnvio: massaEnvio }),
      })
      setPedidos(prev => prev.map(x => x.id === psId ? { ...x, dataEnvio: massaEnvio } : x))
    }
    setMassaEnvio('')
    setExecutandoMassa(false)
    ok('Data de envio atualizada!')
  }

  async function aplicarMassaWL(campoNome: string) {
    const valor = massaWL[campoNome]
    if (!valor) return
    setExecutandoMassa(true)
    for (const psId of selecionados) {
      const p = pedidos.find(x => x.id === psId)
      if (!p) continue
      const extras = p.camposExtras ? JSON.parse(p.camposExtras) : {}
      extras[campoNome] = valor
      await fetch(`/api/producao/pedidos/${p.pedidoId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposExtras: JSON.stringify(extras) }),
      })
      setPedidos(prev => prev.map(x => x.id === psId ? { ...x, camposExtras: JSON.stringify(extras) } : x))
    }
    setMassaWL(p => { const n = { ...p }; delete n[campoNome]; return n })
    setExecutandoMassa(false)
    ok(`"${campoNome}" atualizado!`)
  }

  function ok(msg: string) { setSucesso(msg); setTimeout(() => setSucesso(''), 4000) }
  function toggleSel(id: string) { setSelecionados(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]) }
  function toggleTodos() { setSelecionados(p => p.length === pedidosFiltrados.length ? [] : pedidosFiltrados.map(x => x.id)) }

  const totalGeral     = Object.values(totais).reduce((a, b) => a + Number(b), 0)
  const somaItens      = selecionados.reduce((acc, id) => acc + (Number(pedidos.find(p => p.id === id)?.quantidade) || 0), 0)
  const camposMassa    = camposPedido.filter(c => c.usarNaMassa)
  const camposFiltroWL = camposPedido.filter(c => c.usarComoFiltro)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600 transition">←</button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">{setorNome}</h1>
            <p className="text-sm text-gray-500">{totalGeral} pedido{totalGeral !== 1 ? 's' : ''} neste setor</p>
          </div>
        </div>

        {sucesso && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">
            {sucesso}
          </div>
        )}

        {/* Cards totais por status */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { key: 'PENDENTE',     label: 'Aguardando',   cor: 'text-gray-600',   desc: 'na fila'         },
            { key: 'EM_ANDAMENTO', label: 'Em andamento', cor: 'text-orange-600', desc: 'neste setor'     },
            { key: 'CONCLUIDO',    label: 'Concluído',    cor: 'text-green-600',  desc: 'por este setor'  },
            { key: 'DEVOLVIDO',    label: 'Devolvido',    cor: 'text-red-600',    desc: 'para revisão'    },
          ].map(s => (
            <button key={s.key}
              onClick={() => setFiltroStatus(filtroStatus === s.key ? '' : s.key)}
              className={`p-3 rounded-xl border text-left transition ${filtroStatus === s.key ? 'border-orange-400 bg-orange-50' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
              <p className={`text-xs mb-0.5 ${s.cor}`}>{s.label}</p>
              <p className="text-xl font-semibold text-gray-900">{totais[s.key] || 0}</p>
              <p className="text-xs text-gray-400">{s.desc}</p>
            </button>
          ))}
        </div>

        {/* ── FILTROS ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex-1 min-w-48 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar: número, nome, ID user, produto..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todas as prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="NORMAL">Normal</option>
              <option value="BAIXA">Baixa</option>
            </select>
            <button onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition ${mostrarFiltros ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Mais filtros <ChevronDown size={12} className={`transition-transform ${mostrarFiltros ? 'rotate-180' : ''}`} />
            </button>
            {(busca || filtroPrioridade || filtroStatus || filtroDataEnvio || filtroDataEntrada || filtroResponsavel || filtroSemData || filtroSomenteDevolvidos || filtroEstoqueInsuf || filtroSemResp) && (
              <button onClick={() => {
                setBusca(''); setFiltroPrioridade(''); setFiltroStatus(''); setFiltroDataEnvio('')
                setFiltroDataEntrada(''); setFiltroResponsavel(''); setFiltroSemData(false)
                setFiltroSomenteDevolvidos(false); setFiltroEstoqueInsuf(false); setFiltroSemResp(false)
                setFiltrosWL({})
              }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2">
                <X size={12} /> Limpar
              </button>
            )}
          </div>

          {/* Filtros expandidos */}
          {mostrarFiltros && (
            <div className="pt-3 border-t border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Data de entrada</label>
                  <input type="date" value={filtroDataEntrada} onChange={e => setFiltroDataEntrada(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Data de envio</label>
                  <input type="date" value={filtroDataEnvio} onChange={e => setFiltroDataEnvio(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Responsável</label>
                  <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">Todos</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                {camposFiltroWL.map(campo => (
                  <div key={campo.id}>
                    <label className="text-xs font-medium text-gray-500 block mb-1">{campo.nome}</label>
                    {campo.tipo === 'lista' && campo.opcoes ? (
                      <select value={filtrosWL[campo.nome] || ''} onChange={e => setFiltrosWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="">Todos</option>
                        {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
                      </select>
                    ) : campo.tipo === 'checkbox' ? (
                      <select value={filtrosWL[campo.nome] || ''} onChange={e => setFiltrosWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="">Todos</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    ) : (
                      <input type={campo.tipo === 'data' ? 'date' : 'text'} value={filtrosWL[campo.nome] || ''}
                        onChange={e => setFiltrosWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                        placeholder={campo.nome + '...'}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'Sem data definida',   state: filtroSemData,           set: setFiltroSemData           },
                  { label: 'Somente devolvidos',   state: filtroSomenteDevolvidos, set: setFiltroSomenteDevolvidos },
                  { label: 'Estoque insuficiente', state: filtroEstoqueInsuf,      set: setFiltroEstoqueInsuf      },
                  { label: 'Sem resp. produção',   state: filtroSemResp,           set: setFiltroSemResp           },
                ].map(f => (
                  <label key={f.label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={f.state} onChange={e => f.set(e.target.checked)} className="accent-orange-500" />
                    <span className={`text-sm ${f.state ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selecionar todos */}
        {pedidosFiltrados.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3">
            <input type="checkbox"
              checked={selecionados.length === pedidosFiltrados.length && pedidosFiltrados.length > 0}
              onChange={toggleTodos} className="accent-orange-500" />
            <span className="text-sm text-gray-500">Selecionar todos ({pedidosFiltrados.length})</span>
          </div>
        )}

        {/* ── AÇÕES EM MASSA ── */}
        {selecionados.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-orange-200">
              <span className="text-sm font-semibold text-orange-700">
                {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-orange-600 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                Total de itens: {somaItens}
              </span>
              <button onClick={massaConcluir} disabled={executandoMassa}
                className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium">
                ✓ Concluir selecionados
              </button>
              <button onClick={massaDevolver} disabled={executandoMassa}
                className="flex items-center gap-1.5 text-xs bg-red-400 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium">
                ↩ Devolver selecionados
              </button>
              <button onClick={() => setSelecionados([])} className="text-xs text-orange-400 hover:text-orange-600 ml-auto">
                Cancelar
              </button>
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Data de envio em massa */}
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">Data de envio</label>
                  <input type="date" value={massaEnvio} onChange={e => setMassaEnvio(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                </div>
                <button onClick={aplicarMassaEnvio} disabled={!massaEnvio || executandoMassa}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Aplicar
                </button>
              </div>

              {/* Responsável em massa */}
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">Responsável</label>
                  <select value={massaResp} onChange={e => setMassaResp(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                    <option value="">Selecionar...</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <button onClick={aplicarMassaResp} disabled={!massaResp || executandoMassa}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Aplicar
                </button>
              </div>

              {/* Campos WL em massa */}
              {camposMassa.map(campo => {
                const val = massaWL[campo.nome] || ''
                const setVal = (v: string) => setMassaWL(p => ({ ...p, [campo.nome]: v }))
                return (
                  <div key={campo.id} className="flex items-end gap-2">
                    <div>
                      <label className="text-xs font-medium text-orange-700 block mb-1">{campo.nome}</label>
                      {campo.tipo === 'lista' && campo.opcoes ? (
                        <select value={val} onChange={e => setVal(e.target.value)}
                          className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none min-w-28">
                          <option value="">Selecionar...</option>
                          {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
                        </select>
                      ) : campo.tipo === 'data' ? (
                        <input type="date" value={val} onChange={e => setVal(e.target.value)}
                          className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                      ) : campo.tipo === 'checkbox' ? (
                        <select value={val} onChange={e => setVal(e.target.value)}
                          className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                          <option value="">Selecionar...</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      ) : (
                        <input type="text" value={val} onChange={e => setVal(e.target.value)}
                          placeholder={campo.nome + '...'} className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-32" />
                      )}
                    </div>
                    <button onClick={() => aplicarMassaWL(campo.nome)} disabled={!val || executandoMassa}
                      className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                      Aplicar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── CARDS ── */}
        {pedidosFiltrados.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 py-12 text-center">
            <Package size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {pedidos.length === 0
                ? 'Nenhum pedido em andamento neste setor'
                : 'Nenhum pedido encontrado com os filtros selecionados'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {pedidosFiltrados.map(pedido => {
            const extras = pedido.camposExtras ? JSON.parse(pedido.camposExtras) : {}
            const respTemp = responsaveisTemp[pedido.id] ?? (pedido.responsavelId || '')
            const isSaving = salvando?.startsWith(pedido.pedidoId)

            return (
              <div key={pedido.id}
                className={`bg-white rounded-xl border transition ${
                  pedido.estoqueInsuficiente ? 'border-red-200' :
                  pedido.status === 'EM_ANDAMENTO' ? 'border-orange-200' :
                  pedido.status === 'CONCLUIDO'    ? 'border-green-100' :
                  pedido.status === 'DEVOLVIDO'    ? 'border-red-100'   : 'border-gray-100'
                }`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selecionados.includes(pedido.id)} onChange={() => toggleSel(pedido.id)} className="accent-orange-500 mt-1 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      {/* Badges linha 1 */}
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COR[pedido.status] || STATUS_COR.PENDENTE}`}>
                          {pedido.status.replace('_', ' ')}
                        </span>
                        {pedido.canal && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">{pedido.canal}</span>
                        )}
                        {pedido.estoqueInsuficiente && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-red-300 text-red-600 bg-red-50 font-medium flex items-center gap-1">
                            <AlertTriangle size={10} /> Estoque insuficiente!
                          </span>
                        )}
                      </div>

                      {/* ID + User */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">{pedido.numero}</span>
                        {pedido.idCliente && <span className="text-xs text-gray-400">User: {pedido.idCliente}</span>}
                      </div>

                      {/* Nome */}
                      <p className="text-base font-semibold text-gray-900">{pedido.destinatario}</p>

                      {/* Produto */}
                      <p className="text-sm text-gray-600 mb-2">{pedido.produto}</p>

                      {/* Campos white-label do pedido */}
                      {Object.keys(extras).length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                          {Object.entries(extras).map(([nome, valor]) => (
                            <span key={nome} className="text-sm">
                              <span className="text-gray-400 text-xs">{nome}:</span>{' '}
                              <span className="text-orange-600 font-medium">{String(valor)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Prioridade + qtd */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIO_COR[pedido.prioridade] || PRIO_COR.NORMAL}`}>{pedido.prioridade}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{pedido.quantidade} iten{pedido.quantidade !== 1 ? 's' : ''}</span>
                      </div>

                      {/* Datas */}
                      <div className="flex flex-wrap gap-4 mb-2 text-xs text-gray-400">
                        {pedido.dataEntrada && (
                          <span>Entrada: <span className="text-gray-700">{new Date(pedido.dataEntrada).toLocaleDateString('pt-BR')}</span></span>
                        )}
                        {pedido.dataEnvio ? (
                          <span>Envio: <span className={`font-medium ${new Date(pedido.dataEnvio) < new Date() ? 'text-red-500' : 'text-gray-700'}`}>{new Date(pedido.dataEnvio).toLocaleDateString('pt-BR')}</span></span>
                        ) : (
                          <span className="text-orange-400">Envio: <button className="underline hover:text-orange-600" onClick={() => router.push(`/dashboard/pedidos/${pedido.pedidoId}`)}>Definir</button></span>
                        )}
                      </div>

                      {/* Endereço */}
                      {pedido.endereco && (
                        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 mb-2">📍 {pedido.endereco}</p>
                      )}

                      {/* Observações */}
                      {pedido.observacoes_pedido && (
                        <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 mb-2">Obs: {pedido.observacoes_pedido}</p>
                      )}

                      {/* Campos customizados do SETOR */}
                      {camposSetor.length > 0 && (
                        <div className="border-t border-gray-100 pt-3 mt-2">
                          <p className="text-xs font-semibold text-gray-400 mb-2">Campos do setor</p>
                          <div className="grid grid-cols-2 gap-2">
                            {camposSetor.map(campo => {
                              const val = valoresCampos[pedido.pedidoId]?.[campo.id] || ''
                              const setVal = (v: string) => {
                                setValoresCampos(p => ({ ...p, [pedido.pedidoId]: { ...(p[pedido.pedidoId] || {}), [campo.id]: v } }))
                              }
                              return (
                                <div key={campo.id}>
                                  <label className="text-xs text-gray-500 block mb-0.5">
                                    {campo.nome}{campo.obrigatorio && <span className="text-red-400 ml-0.5">*</span>}
                                  </label>
                                  {campo.tipo === 'lista' && campo.opcoes ? (
                                    <select value={val} onChange={e => { setVal(e.target.value); salvarCampoSetor(pedido.pedidoId, campo.id, e.target.value) }}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white">
                                      <option value="">Selecione...</option>
                                      {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
                                    </select>
                                  ) : campo.tipo === 'checkbox' ? (
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={val === 'true'} onChange={e => { const v = String(e.target.checked); setVal(v); salvarCampoSetor(pedido.pedidoId, campo.id, v) }} className="accent-orange-500" />
                                      <span className="text-xs text-gray-600">Sim</span>
                                    </label>
                                  ) : campo.tipo === 'data' ? (
                                    <input type="date" value={val} onChange={e => { setVal(e.target.value); salvarCampoSetor(pedido.pedidoId, campo.id, e.target.value) }}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                  ) : (
                                    <input type={campo.tipo === 'numero' ? 'number' : 'text'} value={val}
                                      onChange={e => setVal(e.target.value)}
                                      onBlur={e => salvarCampoSetor(pedido.pedidoId, campo.id, e.target.value)}
                                      placeholder={campo.placeholder || ''}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Responsável */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <User size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500">Resp. produção:</span>
                        <select value={respTemp}
                          onChange={e => setResponsaveisTemp(p => ({ ...p, [pedido.id]: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white">
                          <option value="">Sem responsável</option>
                          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                        <button onClick={() => salvarResponsavel(pedido.pedidoId, pedido.id)}
                          disabled={salvando === pedido.id + '_r'}
                          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg transition disabled:opacity-50 font-medium flex items-center gap-1">
                          <Save size={11} /> Salvar
                        </button>
                      </div>

                      {/* Estoque */}
                      <div className="flex items-center gap-2 mt-2">
                        <input type="checkbox" checked={!!pedido.estoqueInsuficiente}
                          onChange={() => toggleEstoque(pedido.pedidoId, !!pedido.estoqueInsuficiente)}
                          className="accent-red-500" id={`est-${pedido.id}`} />
                        <label htmlFor={`est-${pedido.id}`} className="text-xs text-gray-500 cursor-pointer">
                          Estoque insuficiente
                        </label>
                      </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-col gap-2 flex-shrink-0 ml-2">
                      {pedido.status === 'PENDENTE' && (
                        <button onClick={() => iniciar(pedido.pedidoId)} disabled={!!isSaving}
                          className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 font-medium min-w-24 text-center">
                          Iniciar
                        </button>
                      )}
                      {(pedido.status === 'EM_ANDAMENTO' || pedido.status === 'PENDENTE') && (
                        <button onClick={() => concluir(pedido.pedidoId)} disabled={!!isSaving}
                          className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 font-medium min-w-24 text-center">
                          {salvando === pedido.pedidoId + '_c' ? '...' : 'Concluir'}
                        </button>
                      )}
                      {pedido.status !== 'DEVOLVIDO' && pedido.status !== 'CONCLUIDO' && (
                        <button onClick={() => devolver(pedido.pedidoId)} disabled={!!isSaving}
                          className="border border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 font-medium min-w-24 text-center">
                          Devolver
                        </button>
                      )}
                      {(pedido.status === 'DEVOLVIDO' || pedido.status === 'CONCLUIDO') && (
                        <button onClick={() => iniciar(pedido.pedidoId)}
                          className="border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs px-3 py-1.5 rounded-lg transition">
                          Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
