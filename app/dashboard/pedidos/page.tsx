'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, Package, Upload, ChevronDown, Play, Printer, Users, BookOpen, Trash2 } from 'lucide-react'
import ModalImportacao from '@/components/ModalImportacao'

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
  setor_atual_nome: string | null
  setor_atual_id: string | null
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

interface Setor   { id: string; nome: string }
interface Usuario { id: string; nome: string }

const CANAIS = ['Shopee', 'Mercado Livre', 'Elo7', 'Direta', 'Instagram', 'WhatsApp', 'Outros']
const CANAIS_COM_ENDERECO = ['Direta', 'Outros']

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto', EM_PRODUCAO: 'Em produção', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado'
}
const STATUS_COR: Record<string, string> = {
  ABERTO:      'text-blue-700 bg-blue-50 border-blue-200',
  EM_PRODUCAO: 'text-orange-700 bg-orange-50 border-orange-200',
  CONCLUIDO:   'text-green-700 bg-green-50 border-green-200',
  CANCELADO:   'text-red-700 bg-red-50 border-red-200',
}
const PRIO_COR: Record<string, string> = {
  URGENTE: 'text-red-600 bg-red-50 border-red-200',
  ALTA:    'text-orange-600 bg-orange-50 border-orange-200',
  NORMAL:  'text-blue-600 bg-blue-50 border-blue-200',
  BAIXA:   'text-gray-500 bg-gray-50 border-gray-200',
}

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

export default function PedidosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [pedidos,     setPedidos]     = useState<Pedido[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [salvando,    setSalvando]    = useState(false)
  const [modalNovo,   setModalNovo]   = useState(false)
  const [modalImport, setModalImport] = useState(false)
  const [sucesso,     setSucesso]     = useState('')
  const [erro,        setErro]        = useState('')

  // Meta
  const [camposPedido, setCamposPedido] = useState<CampoPedido[]>([])
  const [setores,      setSetores]      = useState<Setor[]>([])
  const [usuarios,     setUsuarios]     = useState<Usuario[]>([])
  const [freelancers,  setFreelancers]  = useState<Record<string, string>>({})
  const [freelancersList, setFreelancersList] = useState<{id:string;nome:string}[]>([])

  // ── MÚLTIPLOS PRODUTOS ──────────────────────────────────────────────────
  const [produtosForm,   setProdutosForm]   = useState<{uid:string;desc:string}[]>([{uid:'p0',desc:''}])
  const [prodCatalogo,   setProdCatalogo]   = useState<{id:string;nome:string}[]>([])
  const [showCatalogo,   setShowCatalogo]   = useState<number|null>(null)

  // ── MASSA FREELANCER ─────────────────────────────────────────────────────
  const [massaFreelancer, setMassaFreelancer] = useState('')

  // ── FILTROS ─────────────────────────────────────────────
  const [busca,             setBusca]             = useState('')
  const [filtroStatus,      setFiltroStatus]      = useState('')
  const [filtroPrioridade,  setFiltroPrioridade]  = useState('')
  const [filtroCanal,       setFiltroCanal]       = useState('')
  const [filtroSetor,       setFiltroSetor]       = useState('')
  const [filtroDataEntrada, setFiltroDataEntrada] = useState('')
  const [filtroDataEnvio,   setFiltroDataEnvio]   = useState('')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroFreelancer,  setFiltroFreelancer]  = useState('')
  const [filtrosWL,         setFiltrosWL]         = useState<Record<string, string>>({})
  const [mostrarFiltros,    setMostrarFiltros]    = useState(false)

  // ── SELEÇÃO + MASSA ─────────────────────────────────────
  const [selecionados,    setSelecionados]    = useState<string[]>([])
  const [massaResp,       setMassaResp]       = useState('')
  const [massaEnvio,      setMassaEnvio]      = useState('')
  const [massaWL,         setMassaWL]         = useState<Record<string, string>>({})
  const [executandoMassa, setExecutandoMassa] = useState(false)


  // ── FORM NOVO PEDIDO ────────────────────────────────────
  const [form, setForm] = useState({
    numero: '', destinatario: '', idCliente: '', canal: '', produto: '',
    quantidade: 1, valor: '',
    dataEntrada: new Date().toISOString().split('T')[0],
    dataEnvio: '', observacoes: '', prioridade: 'NORMAL', endereco: '',
  })
  const [camposExtrasForm, setCamposExtrasForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') { carregarPedidos(); carregarMeta() }
  }, [status])

  useEffect(() => {
    if (status === 'authenticated') carregarPedidos()
  }, [filtroStatus, filtroPrioridade, filtroCanal, filtroSetor])

  async function carregarMeta() {
    // Freelancers em fetch separado — não pode quebrar o carregamento principal
    fetch('/api/demandas/freelancers')
      .then(r => r.ok ? r.json() : [])
      .then(fl => {
        const flMap: Record<string, string> = {}
        const flList: {id:string;nome:string}[] = []
        ;(Array.isArray(fl) ? fl : []).forEach((f: any) => { if (f.id && f.nome) { flMap[f.id] = f.nome; flList.push({id:f.id, nome:f.nome}) } })
        setFreelancers(flMap)
        setFreelancersList(flList)
      })
      .catch(() => {})

    // Catálogo de produtos da precificação (para importar no form)
    fetch('/api/precificacao/produtos')
      .then(r => r.ok ? r.json() : [])
      .then(prods => setProdCatalogo(Array.isArray(prods) ? prods.map((p:any) => ({id:p.id, nome:p.nome})) : []))
      .catch(() => {})

    const [c, s, u] = await Promise.all([
      fetch('/api/config/campos-pedido').then(r => r.json()),
      fetch('/api/producao/setores').then(r => r.json()),
      fetch('/api/config/usuarios').then(r => r.json()),
    ])
    const camposAtivos = (c.campos || []).filter((x: CampoPedido) => x.ativo)
    setCamposPedido(camposAtivos)
    setSetores(s.setores || [])
    setUsuarios((u.usuarios || []).filter((x: any) => x.ativo))
    return camposAtivos
  }

  const carregarPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (filtroStatus)      p.set('status',      filtroStatus)
      if (filtroPrioridade)  p.set('prioridade',  filtroPrioridade)
      if (filtroCanal)       p.set('canal',       filtroCanal)
      if (filtroSetor)       p.set('setorId',     filtroSetor)
      if (busca)             p.set('busca',       busca)
      if (filtroDataEntrada) p.set('dataEntrada', filtroDataEntrada)
      if (filtroDataEnvio)   p.set('dataEnvio',   filtroDataEnvio)
      const res = await fetch(`/api/producao/pedidos?${p}`)
      const data = await res.json()
      setPedidos(data.pedidos || [])
      setTotal(data.total || 0)
    } finally { setLoading(false) }
  }, [filtroStatus, filtroPrioridade, filtroCanal, filtroSetor, busca, filtroDataEntrada, filtroDataEnvio])

  // ── Abrir modal novo pedido ───────────────────────────────
  // CORRIGIDO: recarrega campos frescos ao abrir e inicializa todos com string vazia
  async function abrirModalNovo() {
    const campos = await carregarMeta()
    // BUG #5: inicializa TODOS os campos ativos como vazio
    // assim campos adicionados depois do pedido criado também aparecem
    const extrasInit: Record<string, string> = {}
    campos.forEach((c: CampoPedido) => { extrasInit[c.nome] = '' })
    setCamposExtrasForm(extrasInit)
    setProdutosForm([{uid:'p0',desc:''}])
    setShowCatalogo(null)
    setModalNovo(true)
  }

  // ── Criar pedido ─────────────────────────────────────────
  async function criarPedido(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro('')
    try {
      // Filtra campos vazios antes de salvar
      const extrasLimpos = Object.fromEntries(
        Object.entries(camposExtrasForm).filter(([, v]) => v !== '')
      )
      const produtoFinal = produtosForm.map(p => p.desc).filter(Boolean).join(' + ') || form.produto
      const res = await fetch('/api/producao/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          produto:     produtoFinal,
          valor:       form.valor ? parseFloat(form.valor) : null,
          quantidade:  parseInt(String(form.quantidade)),
          endereco:    CANAIS_COM_ENDERECO.includes(form.canal) ? form.endereco : null,
          camposExtras: Object.keys(extrasLimpos).length ? extrasLimpos : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro'); return }
      setPedidos(p => [data.pedido, ...p]); setTotal(t => t + 1)
      fecharModalNovo()
      ok('Pedido criado!')
    } finally { setSalvando(false) }
  }

  function fecharModalNovo() {
    setModalNovo(false)
    setForm({
      numero: '', destinatario: '', idCliente: '', canal: '', produto: '',
      quantidade: 1, valor: '',
      dataEntrada: new Date().toISOString().split('T')[0],
      dataEnvio: '', observacoes: '', prioridade: 'NORMAL', endereco: '',
    })
    setCamposExtrasForm({})
    setProdutosForm([{uid:'p0',desc:''}])
    setShowCatalogo(null)
    setErro('')
  }

  // ── Iniciar produção individual ───────────────────────────
  async function iniciar(pedidoId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const res = await fetch('/api/producao/workflow', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedidoId }),
    })
    if (res.ok) { setPedidos(p => p.map(x => x.id === pedidoId ? { ...x, status: 'EM_PRODUCAO' } : x)); ok('Produção iniciada!') }
  }

  // ── Ações em massa ───────────────────────────────────────
  async function excluirMassa() {
    if (!selecionados.length) return
    if (!confirm(`Excluir ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`)) return
    setExecutandoMassa(true)
    let excluidos = 0
    for (const id of selecionados) {
      const res = await fetch(`/api/producao/pedidos/${id}`, { method: 'DELETE' })
      if (res.ok) excluidos++
    }
    ok(`${excluidos} pedido${excluidos > 1 ? 's excluídos' : ' excluído'}!`)
    setSelecionados([])
    setExecutandoMassa(false)
    carregarPedidos()
  }


  async function aplicarMassaResponsavel() {
    if (!massaResp || !selecionados.length) return
    setExecutandoMassa(true)
    try {
      for (const id of selecionados) {
        await fetch(`/api/producao/pedidos/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responsavelId: massaResp }),
        })
      }
      ok(`Responsável atribuído a ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''}!`)
      setMassaResp('')
    } finally { setExecutandoMassa(false) }
  }

  async function aplicarMassaEnvio() {
    if (!massaEnvio || !selecionados.length) return
    setExecutandoMassa(true)
    try {
      for (const id of selecionados) {
        await fetch(`/api/producao/pedidos/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataEnvio: massaEnvio }),
        })
        setPedidos(p => p.map(x => x.id === id ? { ...x, dataEnvio: massaEnvio } : x))
      }
      ok('Data de envio atualizada!')
      setMassaEnvio('')
    } finally { setExecutandoMassa(false) }
  }

  async function aplicarMassaWL(campoNome: string) {
    const valor = massaWL[campoNome]
    if (!valor || !selecionados.length) return
    setExecutandoMassa(true)
    try {
      for (const id of selecionados) {
        const pedido = pedidos.find(p => p.id === id)
        if (!pedido) continue
        const extras = pedido.camposExtras ? JSON.parse(pedido.camposExtras) : {}
        extras[campoNome] = valor
        await fetch(`/api/producao/pedidos/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camposExtras: JSON.stringify(extras) }),
        })
        setPedidos(p => p.map(x => x.id === id ? { ...x, camposExtras: JSON.stringify(extras) } : x))
      }
      ok(`"${campoNome}" atualizado!`)
      setMassaWL(p => { const n = { ...p }; delete n[campoNome]; return n })
    } finally { setExecutandoMassa(false) }
  }

  async function iniciarMassa() {
    const abertos = selecionados.filter(id => pedidos.find(p => p.id === id)?.status === 'ABERTO')
    if (!abertos.length) return
    setExecutandoMassa(true)
    try {
      for (const id of abertos) {
        await fetch('/api/producao/workflow', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedidoId: id }),
        })
        setPedidos(p => p.map(x => x.id === id ? { ...x, status: 'EM_PRODUCAO' } : x))
      }
      ok(`${abertos.length} pedido${abertos.length > 1 ? 's' : ''} iniciado${abertos.length > 1 ? 's' : ''}!`)
    } finally { setExecutandoMassa(false) }
  }

  async function aplicarMassaFreelancer() {
    if (!massaFreelancer || !selecionados.length) return
    setExecutandoMassa(true)
    try {
      for (const id of selecionados) {
        const pedido = pedidos.find(p => p.id === id)
        if (!pedido) continue
        const extras = pedido.camposExtras ? (() => { try { return JSON.parse(pedido.camposExtras) } catch { return {} } })() : {}
        if (!extras._freelancers) extras._freelancers = {}
        extras._freelancers[massaFreelancer] = freelancers[massaFreelancer] || massaFreelancer
        await fetch(`/api/producao/pedidos/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camposExtras: JSON.stringify(extras) }),
        })
        setPedidos(p => p.map(x => x.id === id ? { ...x, camposExtras: JSON.stringify(extras) } : x))
      }
      ok(`Freelancer vinculada a ${selecionados.length} pedido(s) · ${somaItens} itens no total`)
      setMassaFreelancer('')
    } finally { setExecutandoMassa(false) }
  }


  function ok(msg: string) { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }
  function toggleSel(id: string) { setSelecionados(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]) }
  function toggleTodos() { setSelecionados(p => p.length === pedidos.length ? [] : pedidos.map(p => p.id)) }
  function limparFiltros() {
    setFiltroStatus(''); setFiltroPrioridade(''); setFiltroCanal(''); setFiltroSetor('')
    setFiltroDataEntrada(''); setFiltroDataEnvio(''); setFiltroResponsavel(''); setBusca(''); setFiltrosWL({})
    setFiltroFreelancer('')
  }

  function renderCampoForm(campo: CampoPedido) {
    const val = camposExtrasForm[campo.nome] || ''
    const set = (v: string) => setCamposExtrasForm(p => ({ ...p, [campo.nome]: v }))
    if (campo.tipo === 'lista' && campo.opcoes) return (
      <select value={val} onChange={e => set(e.target.value)} className={inputClass}>
        <option value="">Selecione...</option>
        {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
      </select>
    )
    if (campo.tipo === 'checkbox') return (
      <label className="flex items-center gap-2 cursor-pointer mt-1">
        <input type="checkbox" checked={val === 'true'} onChange={e => set(String(e.target.checked))} className="accent-orange-500 w-4 h-4" />
        <span className="text-sm text-gray-700">Sim</span>
      </label>
    )
    if (campo.tipo === 'data') return <input type="date" value={val} onChange={e => set(e.target.value)} className={inputClass} />
    if (campo.tipo === 'cor')  return <input type="color" value={val || '#000000'} onChange={e => set(e.target.value)} className="w-full h-10 border border-gray-200 rounded-lg px-1 cursor-pointer" />
    return <input type={campo.tipo === 'numero' ? 'number' : 'text'} value={val} onChange={e => set(e.target.value)} placeholder={campo.placeholder || ''} className={inputClass} />
  }

  const isAdmin    = session?.user?.role === 'ADMIN'
  const podeEditar = session?.user?.role !== 'OPERADOR'
  const temFiltro  = filtroStatus || filtroPrioridade || filtroCanal || filtroSetor || busca || filtroDataEntrada || filtroDataEnvio || filtroResponsavel || filtroFreelancer

  // Filtro client-side de freelancer (camposExtras._freelancers)
  const pedidosFiltrados = filtroFreelancer
    ? pedidos.filter(p => {
        const extras = p.camposExtras ? (() => { try { return JSON.parse(p.camposExtras) } catch { return {} } })() : {}
        const flMap = extras._freelancers || {}
        return Object.values(flMap).includes(filtroFreelancer)
      })
    : pedidos
  const abertosSelec = selecionados.filter(id => pedidos.find(p => p.id === id)?.status === 'ABERTO').length
  const somaItens    = selecionados.reduce((acc, id) => acc + (Number(pedidos.find(p => p.id === id)?.quantidade) || 0), 0)
  const camposMassa  = camposPedido.filter(c => c.usarNaMassa)
  const camposFiltro = camposPedido.filter(c => c.usarComoFiltro)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Pedidos</h1>
            <p className="text-sm text-gray-500">{total} pedido{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModalImport(true)} className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition">
              <Upload size={14} /> Importar planilha
            </button>
            {podeEditar && (
              <button onClick={abrirModalNovo} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                <Plus size={14} /> Novo pedido
              </button>
            )}
          </div>
        </div>

        {sucesso && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {sucesso}</div>}

        {/* ── FILTROS ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex-1 min-w-52 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && carregarPedidos()}
                placeholder="Buscar: número, cliente, ID user, produto..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filtroCanal} onChange={e => setFiltroCanal(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todos os canais</option>
              {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todas as prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="NORMAL">Normal</option>
              <option value="BAIXA">Baixa</option>
            </select>
            <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Todos os setores</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <button onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition ${mostrarFiltros ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Mais filtros <ChevronDown size={12} className={`transition-transform ${mostrarFiltros ? 'rotate-180' : ''}`} />
            </button>
            {temFiltro && <button onClick={limparFiltros} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2"><X size={12} /> Limpar</button>}
          </div>

          {mostrarFiltros && (
            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Data de entrada</label>
                <input type="date" value={filtroDataEntrada} onChange={e => setFiltroDataEntrada(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Data de envio</label>
                <input type="date" value={filtroDataEnvio} onChange={e => setFiltroDataEnvio(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Responsável</label>
                <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Todos</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Freelancer</label>
                <select value={filtroFreelancer} onChange={e => setFiltroFreelancer(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Todos</option>
                  {Object.entries(freelancers).map(([id, nome]) => <option key={id} value={id}>{nome as string}</option>)}
                </select>
              </div>
              {camposFiltro.map(campo => (
                <div key={campo.id}>
                  <label className="text-xs text-gray-500 font-medium block mb-1">{campo.nome}</label>
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
                      placeholder={campo.placeholder || campo.nome + '...'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── AÇÕES EM MASSA ── */}
        {selecionados.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-orange-200">
              <span className="text-sm font-semibold text-orange-700">{selecionados.length} pedido{selecionados.length > 1 ? 's' : ''} selecionado{selecionados.length > 1 ? 's' : ''}</span>
              <span className="text-xs text-orange-600 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                Total de itens: {somaItens}
              </span>
              {abertosSelec > 0 && (
                <button onClick={iniciarMassa} disabled={executandoMassa}
                  className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium">
                  <Play size={11} /> Iniciar {abertosSelec} em produção
                </button>
              )}
              <button
                onClick={() => window.open(`/dashboard/pedidos/print?ids=${selecionados.join(',')}`, '_blank')}
                className="flex items-center gap-1.5 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300 px-3 py-1.5 rounded-lg transition font-medium">
                <Printer size={11} /> Imprimir {selecionados.length} pedido{selecionados.length !== 1 ? 's' : ''}
              </button>
              <button onClick={excluirMassa} disabled={executandoMassa}
                className="flex items-center gap-1.5 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium ml-auto">
                <Trash2 size={11}/> Excluir {selecionados.length} pedido{selecionados.length !== 1 ? 's' : ''}
              </button>
              <button onClick={() => setSelecionados([])} className="text-xs text-orange-400 hover:text-orange-600">Cancelar</button>
            </div>
            <div className="flex flex-wrap gap-4">
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
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">Responsável</label>
                  <select value={massaResp} onChange={e => setMassaResp(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                    <option value="">Selecionar...</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <button onClick={aplicarMassaResponsavel} disabled={!massaResp || executandoMassa}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Aplicar
                </button>
              </div>
              {/* Vincular Freelancer em massa */}
              {Object.keys(freelancers).length > 0 && (
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-xs font-medium text-orange-700 block mb-1 flex items-center gap-1">
                      <Users size={10}/> Vincular Freelancer
                    </label>
                    <select value={massaFreelancer} onChange={e => setMassaFreelancer(e.target.value)}
                      className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none min-w-36">
                      <option value="">Selecionar...</option>
                      {Object.entries(freelancers).map(([id, nome]) => <option key={id} value={id}>{nome as string}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 items-start">
                    <button onClick={aplicarMassaFreelancer} disabled={!massaFreelancer || executandoMassa}
                      className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium">
                      Aplicar
                    </button>
                    {massaFreelancer && somaItens > 0 && (
                      <span className="text-xs text-orange-600 font-medium">{somaItens} itens</span>
                    )}
                  </div>
                </div>
              )}
              {camposMassa.map(campo => {
                const val = massaWL[campo.nome] || ''
                const setVal = (v: string) => setMassaWL(p => ({ ...p, [campo.nome]: v }))
                return (
                  <div key={campo.id} className="flex items-end gap-2">
                    <div>
                      <label className="text-xs font-medium text-orange-700 block mb-1">{campo.nome}</label>
                      {campo.tipo === 'lista' && campo.opcoes ? (
                        <select value={val} onChange={e => setVal(e.target.value)} className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none min-w-28">
                          <option value="">Selecionar...</option>
                          {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
                        </select>
                      ) : campo.tipo === 'data' ? (
                        <input type="date" value={val} onChange={e => setVal(e.target.value)} className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                      ) : campo.tipo === 'checkbox' ? (
                        <select value={val} onChange={e => setVal(e.target.value)} className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                          <option value="">Selecionar...</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      ) : (
                        <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder={campo.nome + '...'} className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-32" />
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

        {/* ── TABELA ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Carregando...</div>
          ) : pedidos.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-1">Nenhum pedido encontrado</p>
              {temFiltro && <button onClick={limparFiltros} className="text-xs text-orange-500">Limpar filtros</button>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <input type="checkbox" checked={selecionados.length === pedidos.length && pedidos.length > 0} onChange={toggleTodos} className="accent-orange-500" />
                <div className="w-28">Nº Pedido</div>
                <div className="flex-1">Destinatário / Produto</div>
                <div className="w-24">Canal</div>
                <div className="w-28">Setor atual</div>
                <div className="w-10 text-center">Qtd</div>
                {isAdmin && <div className="w-24">Valor</div>}
                <div className="w-24">Data envio</div>
                <div className="w-20">Prioridade</div>
                <div className="w-28">Status / Ação</div>
              </div>
              <div className="divide-y divide-gray-50">
                {pedidosFiltrados.map(pedido => {
                  const extras = pedido.camposExtras ? JSON.parse(pedido.camposExtras) : {}
                  return (
                    <div key={pedido.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition text-sm ${selecionados.includes(pedido.id) ? 'bg-orange-50/50' : ''}`}>
                      <input type="checkbox" checked={selecionados.includes(pedido.id)} onChange={() => toggleSel(pedido.id)} onClick={e => e.stopPropagation()} className="accent-orange-500 flex-shrink-0 mt-1" />
                      <div className="w-28 flex-shrink-0 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                        <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">{pedido.numero}</span>
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                        <div className="font-medium text-gray-900 truncate">{pedido.destinatario}</div>
                        {pedido.idCliente && <div className="text-xs text-gray-400">User: {pedido.idCliente}</div>}
                        <div className="text-xs text-gray-400 truncate">{pedido.produto}</div>
                        {/* Freelancers vinculados */}
                        {(() => {
                          const extras = pedido.camposExtras ? (() => { try { return JSON.parse(pedido.camposExtras) } catch { return {} } })() : {}
                          const flMap = extras._freelancers || {}
                          const nomes = Object.values(flMap).map((fid: any) => freelancers[fid]).filter(Boolean)
                          if (!nomes.length) return null
                          return (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-purple-400">👤</span>
                              <span className="text-xs text-purple-400 font-medium">{(nomes as string[]).join(', ')}</span>
                            </div>
                          )
                        })()}
                        {/* Campos white-label — mostra todos os campos ativos, mesmo os vazios */}
                        {camposPedido.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 mt-0.5">
                            {camposPedido
                              .filter(c => !c.nome.startsWith('_'))
                              .map(campo => {
                                const valor = extras[campo.nome]
                                if (!valor) return null
                                return (
                                  <span key={campo.nome} className="text-xs">
                                    <span className="text-gray-400">{campo.nome}:</span>{' '}
                                    <span className="text-orange-600 font-medium">
                                      {campo.tipo === 'checkbox' ? (valor === 'true' ? 'Sim' : 'Não') : String(valor)}
                                    </span>
                                  </span>
                                )
                              })}
                          </div>
                        )}
                      </div>
                      <div className="w-24 flex-shrink-0 text-xs text-gray-500 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>{pedido.canal || '—'}</div>
                      <div className="w-28 flex-shrink-0 pt-0.5">
                        {pedido.setor_atual_nome ? (
                          <button onClick={() => router.push(`/dashboard/setor/${pedido.setor_atual_id}`)}
                            className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full hover:bg-orange-100 transition truncate block max-w-full">
                            {pedido.setor_atual_nome}
                          </button>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </div>
                      <div className="w-10 flex-shrink-0 text-center text-gray-700 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>{pedido.quantidade}</div>
                      {isAdmin && (
                        <div className="w-24 flex-shrink-0 text-xs text-gray-600 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                          {pedido.valor && !isNaN(Number(pedido.valor)) ? `R$ ${Number(pedido.valor).toFixed(2)}` : '—'}
                        </div>
                      )}
                      <div className="w-24 flex-shrink-0 text-xs text-gray-500 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                        {pedido.dataEnvio ? new Date(pedido.dataEnvio).toLocaleDateString('pt-BR') : '—'}
                      </div>
                      <div className="w-20 flex-shrink-0 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIO_COR[pedido.prioridade] || PRIO_COR.NORMAL}`}>
                          {pedido.prioridade}
                        </span>
                      </div>
                      <div className="w-28 flex-shrink-0 flex flex-col gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COR[pedido.status] || STATUS_COR.ABERTO}`}>
                          {STATUS_LABEL[pedido.status] || pedido.status}
                        </span>
                        {pedido.status === 'ABERTO' && podeEditar && (
                          <button onClick={e => iniciar(pedido.id, e)} className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium">
                            <Play size={10} /> Iniciar
                          </button>
                        )}
                        <a href={`/dashboard/pedidos/${pedido.id}/print`} target="_blank" onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium transition-colors">
                          <Printer size={10} /> Imprimir
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MODAL NOVO PEDIDO ── */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-base font-semibold text-gray-900">Novo pedido</h2>
              <button onClick={fecharModalNovo} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={criarPedido} className="p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dados obrigatórios</p>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">ID do Pedido (número) *</label>
                  <input type="text" value={form.numero} onChange={e => setForm(p => ({...p, numero: e.target.value}))} className={inputClass} placeholder="Ex: SHOP-12345" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Canal de venda</label>
                  <select value={form.canal} onChange={e => setForm(p => ({...p, canal: e.target.value}))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Nome da cliente (destinatário) *</label>
                  <input type="text" value={form.destinatario} onChange={e => setForm(p => ({...p, destinatario: e.target.value}))} className={inputClass} placeholder="Nome completo" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">ID User (plataforma)</label>
                  <input type="text" value={form.idCliente} onChange={e => setForm(p => ({...p, idCliente: e.target.value}))} className={inputClass} placeholder="Ex: shopee_user123" />
                </div>
                {CANAIS_COM_ENDERECO.includes(form.canal) && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Endereço de entrega
                      <span className="ml-1 text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Venda {form.canal}</span>
                    </label>
                    <input type="text" value={form.endereco} onChange={e => setForm(p => ({...p, endereco: e.target.value}))} className={inputClass} placeholder="Rua, número, bairro, cidade, CEP..." />
                  </div>
                )}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Produto *</label>
                    <button type="button"
                      onClick={() => setProdutosForm(p => [...p, {uid:'p'+Date.now(), desc:''}])}
                      className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium">
                      <Plus size={10}/> Adicionar produto
                    </button>
                  </div>
                  <div className="space-y-2">
                    {produtosForm.map((prod, idx) => (
                      <div key={prod.uid} className="flex gap-2 items-center relative">
                        <div className="flex-1 relative">
                          <input type="text" value={prod.desc}
                            onChange={e => setProdutosForm(p => p.map((x,i) => i===idx ? {...x, desc:e.target.value} : x))}
                            className={inputClass} placeholder="Descreva o produto ou selecione da lista..."
                            required={idx===0} />
                          {/* Dropdown catálogo */}
                          {showCatalogo === idx && prodCatalogo.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                              {prodCatalogo.filter(p => !prod.desc || p.nome.toLowerCase().includes(prod.desc.toLowerCase())).map(p => (
                                <button key={p.id} type="button"
                                  onClick={() => { setProdutosForm(prev => prev.map((x,i) => i===idx ? {...x, desc:p.nome} : x)); setShowCatalogo(null) }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-orange-700 border-b border-gray-50 last:border-0">
                                  {p.nome}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button type="button" title="Importar da lista de produtos"
                          onClick={() => setShowCatalogo(showCatalogo===idx ? null : idx)}
                          className={`flex-shrink-0 flex items-center gap-1 text-xs border px-2.5 py-2 rounded-lg transition ${showCatalogo===idx ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500'}`}>
                          <BookOpen size={12}/> Lista
                        </button>
                        {produtosForm.length > 1 && (
                          <button type="button" onClick={() => setProdutosForm(p => p.filter((_,i) => i!==idx))}
                            className="flex-shrink-0 text-gray-300 hover:text-red-400 p-1 transition">
                            <X size={14}/>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Quantidade de itens</label>
                  <input type="number" value={form.quantidade} onChange={e => setForm(p => ({...p, quantidade: Number(e.target.value)}))} className={inputClass} min={1} />
                </div>
                {isAdmin && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Valor (R$)</label>
                    <input type="number" value={form.valor} onChange={e => setForm(p => ({...p, valor: e.target.value}))} className={inputClass} placeholder="0,00" step="0.01" min="0" />
                  </div>
                )}
              </div>

              {/* Campos personalizados — movidos para cima para fácil acesso */}
              {camposPedido.length > 0 ? (
                <div className="border border-orange-100 bg-orange-50/30 rounded-xl p-4 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Campos do pedido</p>
                    {isAdmin && (
                      <button type="button"
                        onClick={() => { fecharModalNovo(); router.push('/config/campos-pedido') }}
                        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 border border-orange-200 bg-white px-2 py-1 rounded-lg font-medium">
                        <Plus size={11} /> Novo campo
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {camposPedido.map(campo => (
                      <div key={campo.id}>
                        <label className="text-xs font-medium text-gray-600 block mb-1">{campo.nome}</label>
                        {renderCampoForm(campo)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : isAdmin && (
                <button type="button"
                  onClick={() => { fecharModalNovo(); router.push('/config/campos-pedido') }}
                  className="w-full mt-3 border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 rounded-xl py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition">
                  <Plus size={13} /> Adicionar campos personalizados ao pedido
                </button>
              )}

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Data de entrada do pedido</label>
                  <input type="date" value={form.dataEntrada} onChange={e => setForm(p => ({...p, dataEntrada: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Data de envio do pedido</label>
                  <input type="date" value={form.dataEnvio} onChange={e => setForm(p => ({...p, dataEnvio: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Prioridade</label>
                  <select value={form.prioridade} onChange={e => setForm(p => ({...p, prioridade: e.target.value}))} className={inputClass}>
                    <option value="BAIXA">Baixa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Observação do pedido</label>
                  <textarea value={form.observacoes} onChange={e => setForm(p => ({...p, observacoes: e.target.value}))} className={inputClass + ' resize-none'} rows={2} placeholder="Instruções especiais, detalhes importantes..." />
                </div>
              </div>

              {erro && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{erro}</p>}
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={fecharModalNovo} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
                  {salvando ? 'Criando...' : 'Criar pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL IMPORTAR ── */}
      {modalImport && (
        <ModalImportacao
          onClose={() => setModalImport(false)}
          onImportado={() => { setModalImport(false); carregarPedidos() }}
        />
      )}
    </div>
  )
}
