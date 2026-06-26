'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, X, Package, Upload, ChevronDown, Play, Printer, Users, BookOpen, Trash2, ImageIcon, ArrowUpDown } from 'lucide-react'
import ModalImportacao from '@/components/ModalImportacao'

interface Pedido {
  id: string
  numero: string
  destinatario: string
  idCliente: string | null
  canal: string | null
  produto: string
  quantidade: number
  quantidadeSku: number | null
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

interface ItemPedido {
  _key: string
  variacaoId: string
  nomeProduto: string
  quantidade: number
  valorItem: number
  isKit: boolean
  qtdKitPecas: number
  custoMaoObra: number
}
function novoItem(nome = '', qtd = 1): ItemPedido {
  return { _key: Math.random().toString(36).slice(2), variacaoId: '', nomeProduto: nome, quantidade: qtd, valorItem: 0, isKit: false, qtdKitPecas: 0, custoMaoObra: 0 }
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

const CANAIS = ['Shopee', 'Mercado Livre', 'Direta', 'Instagram', 'WhatsApp', 'Outros']
const CANAIS_COM_ENDERECO = ['Direta', 'Outros']

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto', EM_PRODUCAO: 'Em produção', CONCLUIDO: 'Concluído', ENVIADO: 'Enviado', CANCELADO: 'Cancelado'
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

const inputClass = "w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"

// Formata data sem regex e sem timezone (YYYY-MM-DD → DD/MM/YYYY)
function fmtData(s: string | null | undefined): string {
  if (!s) return '—'
  if (s.length === 10 && s[4] === '-' && s[7] === '-')
    return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4)
  return new Date(s).toLocaleDateString('pt-BR')
}

function PedidosPageInner() {
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

  // ── ITENS DO PEDIDO (modal novo — idêntico ao [id]/page.tsx) ─────────────
  const [itensModal,     setItensModal]     = useState<ItemPedido[]>([novoItem()])
  const [variacoes,      setVariacoes]      = useState<any[]>([])
  // mantidos por compatibilidade com importação
  const [produtosForm,   setProdutosForm]   = useState<{uid:string;desc:string;qtd:number;valor:string}[]>([{uid:'p0',desc:'',qtd:1,valor:''}])
  const [prodCatalogo,   setProdCatalogo]   = useState<any[]>([])
  const [showCatalogo,   setShowCatalogo]   = useState<number|null>(null)

  // ── MASSA FREELANCER ─────────────────────────────────────────────────────
  const [massaFreelancer,  setMassaFreelancer]  = useState('')
  const [massaPrioridade,  setMassaPrioridade]  = useState('')
  const [massaStatus,      setMassaStatus]      = useState('')
  const [massaSetor,       setMassaSetor]       = useState('')
  const [imagemAmpliada, setImagemAmpliada] = useState<string | null>(null)

  // ── FILTROS ─────────────────────────────────────────────
  const [busca,             setBusca]             = useState('')
  const searchParams = useSearchParams()
  const [filtroStatus,      setFiltroStatus]      = useState(() => searchParams.get('status') || '')
  const [filtroAtrasados,   setFiltroAtrasados]   = useState(() => searchParams.get('atrasados') === '1')
  const [filtroPrioridade,  setFiltroPrioridade]  = useState('')
  const [filtroCanal,       setFiltroCanal]       = useState('')
  const [filtroSetor,       setFiltroSetor]       = useState('')
  const [filtroDataEntrada, setFiltroDataEntrada] = useState('')
  const [filtroDataEnvio,   setFiltroDataEnvio]   = useState('')
  const [filtroDataEntradaVazio, setFiltroDataEntradaVazio] = useState(false)
  const [filtroDataEnvioVazio,   setFiltroDataEnvioVazio]   = useState(false)
  const [filtroObs,              setFiltroObs]              = useState('')
  const [filtroObsVazio,         setFiltroObsVazio]         = useState(false)
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroFreelancer,  setFiltroFreelancer]  = useState('')
  const [filtrosWL,         setFiltrosWL]         = useState<Record<string, string>>({})
  const [mostrarFiltros,    setMostrarFiltros]    = useState(false)

  // ── SELEÇÃO + MASSA ─────────────────────────────────────
  const [selecionados,    setSelecionados]    = useState<string[]>([])
  const [massaResp,       setMassaResp]       = useState('')
  const [massaEnvio,      setMassaEnvio]      = useState('')
  const [massaWL,         setMassaWL]         = useState<Record<string, string>>({})
  const [massaObs,        setMassaObs]        = useState('')
  const [executandoMassa, setExecutandoMassa] = useState(false)

  // ── PAGINAÇÃO ────────────────────────────────────────────
  const [pagina, setPagina] = useState(1)
  const [obsModal, setObsModal] = useState<string | null>(null)
  const [obsModalTitulo, setObsModalTitulo] = useState('💬 Observações')
  const [ordenacao,      setOrdenacao]      = useState('')
  // ── Popup pagamento Venda Direta ─────────────────────────────────────
  const [pagPopup,             setPagPopup]             = useState<{pedidoId:string;valor:number;numero:string;destinatario:string}|null>(null)
  const [formaPag,             setFormaPag]             = useState<'entrada'|'cartao'|'parcelado'|'entrega'>('entrega')
  const [valorEntrada,         setValorEntrada]         = useState('')
  const [entradaPaga,          setEntradaPaga]          = useState(false)
  const [taxaCartao,           setTaxaCartao]           = useState('3.5')
  const [cartaoPago,           setCartaoPago]           = useState(false)
  const [numParcelas,          setNumParcelas]          = useState(2)
  const [sinalPago,            setSinalPago]            = useState(false)
  const [salvandoPag,          setSalvandoPag]          = useState(false)
  const [promoPopup, setPromoPopup] = useState<{ key: string; nomeProduto: string; precoVenda: number; precoPromo: number } | null>(null)
  const [menuOrdenar,    setMenuOrdenar]    = useState(false)
  // Limite dinâmico: com filtros específicos, mostra até 200 por página
  // (evita "68 pedidos espalhados em 4 páginas" ao filtrar)
  const temFiltroEspecifico = !!(filtroStatus || filtroPrioridade || filtroCanal || filtroSetor ||
    filtroDataEntrada || filtroDataEnvio || filtroDataEntradaVazio || filtroDataEnvioVazio ||
    filtroResponsavel || filtroFreelancer || filtroAtrasados || filtroObs || filtroObsVazio ||
    Object.values(filtrosWL).some(v => v && v !== ''))
  const LIMITE = temFiltroEspecifico ? 200 : 20


  // ── FORM NOVO PEDIDO ────────────────────────────────────
  const [form, setForm] = useState({
    numero: '', destinatario: '', idCliente: '', canal: '', produto: '',
    quantidade: 1, valor: '',
    dataEntrada: new Date().toISOString().split('T')[0],
    dataEnvio: '', observacoes: '', prioridade: 'NORMAL', endereco: '',
  })
  const [camposExtrasForm, setCamposExtrasForm] = useState<Record<string, string>>({})

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

    // Fluxos de produção (multi-segmento)
    // Variações + Combos para o select do modal
    Promise.all([
      fetch('/api/precificacao/variacoes').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/precificacao/combos').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([vars, combData]) => {
      const lista: any[] = Array.isArray(vars) ? [...vars] : []
      const combos: any[] = Array.isArray(combData) ? combData : (combData.combos || [])
      combos.filter((c: any) => c.ativo !== false).forEach((c: any) => {
        lista.push({
          id: c.id,
          produtoNome: c.nome,
          nome: '🎁 Combo',
          canal: c.canal || 'Venda Direta',
          precoVenda: c.precoCombo,
          isKit: false,
          qtdKit: 0,
          _tipo: 'combo',
        })
      })
      setVariacoes(lista)
    }).catch(() => {})

    const [c, s, u] = await Promise.all([
      fetch('/api/config/campos-pedido').then(r => r.json()),
      fetch('/api/producao/setores').then(r => r.json()),
      fetch('/api/config/usuarios').then(r => r.json()),
    ])
    const camposAtivos = (c.campos || []).filter((x: CampoPedido) => x.ativo)
    setCamposPedido(camposAtivos)
    setSetores(Array.isArray(s) ? s : [])
    setUsuarios((Array.isArray(u) ? u : []).filter((x: any) => x.ativo))
    return camposAtivos
  }

  const carregarPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (filtroStatus)      p.set('status',      filtroStatus)
      if (filtroAtrasados)   p.set('atrasados',   '1')
      if (filtroPrioridade)  p.set('prioridade',  filtroPrioridade)
      if (filtroCanal)       p.set('canal',       filtroCanal)
      if (filtroSetor)       p.set('setorId',     filtroSetor)
      if (busca)             p.set('busca',       busca)
      if (filtroDataEntradaVazio)      p.set('dataEntrada', '__VAZIO__')
      else if (filtroDataEntrada)      p.set('dataEntrada', filtroDataEntrada)
      if (filtroDataEnvioVazio)        p.set('dataEnvio',   '__VAZIO__')
      else if (filtroDataEnvio)        p.set('dataEnvio',   filtroDataEnvio)
      if (filtroResponsavel) p.set('responsavel', filtroResponsavel)
      if (filtroFreelancer)  p.set('freelancer',  filtroFreelancer)
      if (filtroObsVazio)    p.set('obsVazio',    '1')
      else if (filtroObs)    p.set('obs',         filtroObs)
      const filtrosWLAtivos = Object.entries(filtrosWL).filter(([, v]) => v && v !== '')
      if (filtrosWLAtivos.length > 0) {
        p.set('filtrosWL', JSON.stringify(Object.fromEntries(filtrosWLAtivos)))
      }
      if (ordenacao) p.set('ordenacao', ordenacao)
      p.set('pagina', String(pagina))
      p.set('limite', String(LIMITE))
      const res = await fetch(`/api/producao/pedidos?${p}`)
      const data = await res.json()
      setPedidos(data.pedidos || [])
      setTotal(data.total || 0)
    } finally { setLoading(false) }
  }, [filtroStatus, filtroAtrasados, filtroPrioridade, filtroCanal, filtroSetor, busca, filtroDataEntrada, filtroDataEnvio, filtroDataEntradaVazio, filtroDataEnvioVazio, filtroResponsavel, filtroFreelancer, filtroObs, filtroObsVazio, filtrosWL, ordenacao, pagina])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') { carregarPedidos(); carregarMeta() }
  }, [status])

  useEffect(() => {
    if (status === 'authenticated') { setPagina(1) }
  }, [filtroStatus, filtroAtrasados, filtroPrioridade, filtroCanal, filtroSetor, filtroDataEntrada, filtroDataEnvio, filtroDataEntradaVazio, filtroDataEnvioVazio, filtroResponsavel, filtroFreelancer, filtroObs, filtroObsVazio, filtrosWL, ordenacao])

  // Lê ?status= da URL quando o painel navega com filtro
  useEffect(() => {
    const s = searchParams.get('status') || ''
    const a = searchParams.get('atrasados') === '1'
    setFiltroStatus(s)
    setFiltroAtrasados(a)
    setPagina(1)
  }, [searchParams])

  useEffect(() => {
    if (status === 'authenticated') carregarPedidos()
  }, [carregarPedidos, pagina])

  // ── Abrir modal novo pedido ───────────────────────────────
  // CORRIGIDO: recarrega campos frescos ao abrir e inicializa todos com string vazia
  async function abrirModalNovo() {
    const campos = await carregarMeta()
    // BUG #5: inicializa TODOS os campos ativos como vazio
    // assim campos adicionados depois do pedido criado também aparecem
    const extrasInit: Record<string, string> = {}
    campos.forEach((c: CampoPedido) => { extrasInit[c.nome] = '' })
    setCamposExtrasForm(extrasInit)
    setItensModal([novoItem()])
    setModalNovo(true)
  }

  // ── Criar pedido ─────────────────────────────────────────
  async function criarPedido(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro('')
    try {
      const extrasLimpos = Object.fromEntries(
        Object.entries(camposExtrasForm).filter(([, v]) => v !== '')
      )
      const produtoTexto = itensModal.filter(i => i.nomeProduto).map(i => `${i.nomeProduto}${i.quantidade > 1 ? ` (${i.quantidade}x)` : ''}`).join(' + ') || form.produto
      const qtdTotal = itensModal.filter(i => i.nomeProduto).reduce((s, i) => s + (i.isKit && i.qtdKitPecas ? i.quantidade * i.qtdKitPecas : i.quantidade), 0) || parseInt(String(form.quantidade))
      const qtdSku   = itensModal.filter(i => i.nomeProduto).length || null
      const valorTotal = itensModal.some(i => i.valorItem > 0) ? itensModal.reduce((s, i) => s + (i.valorItem * i.quantidade), 0) : (form.valor ? parseFloat(form.valor) : null)
      const res = await fetch('/api/producao/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          produto:       produtoTexto,
          quantidade:    qtdTotal,
          quantidadeSku: qtdSku,
          valor:         valorTotal,
          endereco:      CANAIS_COM_ENDERECO.includes(form.canal) ? form.endereco : null,
          camposExtras:  Object.keys(extrasLimpos).length ? extrasLimpos : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro'); return }
      setPedidos(p => [data.pedido, ...p]); setTotal(t => t + 1)
      fecharModalNovo()
      ok('Pedido criado!')
      // Popup de pagamento para Venda Direta
      if (form.canal === 'Direta' && valorTotal && valorTotal > 0) {
        setPagPopup({ pedidoId: data.pedido.id, valor: valorTotal, numero: data.pedido.numero, destinatario: form.destinatario })
        setFormaPag('entrega')
        setValorEntrada('')
        setEntradaPaga(false)
        setTaxaCartao('3.5')
        setCartaoPago(false)
        setNumParcelas(2)
        setSinalPago(false)
      }
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
    setItensModal([novoItem()])
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

  async function aplicarMassaObs(modo: 'substituir' | 'adicionar' | 'limpar') {
    if (!selecionados.length) return
    if (modo !== 'limpar' && !massaObs.trim()) return
    const qtd = selecionados.length
    const msg = modo === 'limpar'
      ? `Limpar as observações de ${qtd} pedido${qtd > 1 ? 's' : ''}?`
      : modo === 'substituir'
        ? `Substituir as observações de ${qtd} pedido${qtd > 1 ? 's' : ''}?`
        : `Adicionar ao final das observações de ${qtd} pedido${qtd > 1 ? 's' : ''}?`
    if (!confirm(msg)) return
    setExecutandoMassa(true)
    try {
      for (const id of selecionados) {
        let novaObs: string | null = null
        if (modo === 'substituir') {
          novaObs = massaObs
        } else if (modo === 'limpar') {
          novaObs = null
        } else {
          // adicionar: concatena no final com quebra de linha
          const atual = pedidos.find(x => x.id === id)?.observacoes || ''
          novaObs = atual ? `${atual}\n${massaObs}` : massaObs
        }
        await fetch(`/api/producao/pedidos/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ observacoes: novaObs }),
        })
        setPedidos(p => p.map(x => x.id === id ? { ...x, observacoes: novaObs } : x))
      }
      ok(modo === 'limpar' ? 'Observações limpas!' : 'Observações atualizadas!')
      setMassaObs('')
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

  async function aplicarMassaStatus() {
    if (!massaStatus || !selecionados.length) return
    if (!confirm(`Alterar status de ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''} para "${massaStatus}"? Esta ação não pode ser desfeita.`)) return
    setExecutandoMassa(true)
    try {
      for (const id of selecionados) {
        await fetch(`/api/producao/pedidos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: massaStatus }),
        })
        setPedidos(p => p.map(x => x.id === id ? { ...x, status: massaStatus } : x))
      }
      ok(`Status "${massaStatus}" aplicado a ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''}!`)
      setMassaStatus('')
    } catch { setErro('Erro ao atualizar status') }
    finally { setExecutandoMassa(false) }
  }

  async function aplicarMassaSetor() {
    if (!massaSetor || !selecionados.length) return
    const setorAlvo = setores.find(s => s.id === massaSetor)
    if (!setorAlvo) return
    if (!confirm(`Mover ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''} para o setor "${setorAlvo.nome}"? Os setores anteriores ficarão como Concluídos e os posteriores como Pendentes.`)) return
    setExecutandoMassa(true)
    let sucesso = 0
    let falhas = 0
    try {
      for (const id of selecionados) {
        try {
          const res = await fetch('/api/producao/workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pedidoId: id,
              devolver: true,
              setorDestinoId: massaSetor,
              motivo: 'Movido em massa via lista de pedidos',
            }),
          })
          if (res.ok) sucesso++
          else falhas++
        } catch { falhas++ }
      }
      if (sucesso > 0) ok(`${sucesso} pedido${sucesso > 1 ? 's movidos' : ' movido'} para "${setorAlvo.nome}"${falhas > 0 ? ` (${falhas} falhou)` : '!'}`)
      if (falhas > 0 && sucesso === 0) setErro(`Falha ao mover ${falhas} pedido${falhas > 1 ? 's' : ''}`)
      setMassaSetor('')
      await carregarPedidos()
    } catch { setErro('Erro ao mover pedidos') }
    finally { setExecutandoMassa(false) }
  }

  async function aplicarMassaPrioridade() {
    if (!massaPrioridade || !selecionados.length) return
    setExecutandoMassa(true)
    try {
      for (const id of selecionados) {
        await fetch(`/api/producao/pedidos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prioridade: massaPrioridade }),
        })
        setPedidos(p => p.map(x => x.id === id ? { ...x, prioridade: massaPrioridade } : x))
      }
      ok(`Prioridade ${massaPrioridade} aplicada a ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''}!`)
      setMassaPrioridade('')
    } catch { setErro('Erro ao atualizar prioridade') }
    finally { setExecutandoMassa(false) }
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

  async function confirmarPagamento() {
    if (!pagPopup) return
    setSalvandoPag(true)
    const { valor, numero, destinatario } = pagPopup
    const dataHoje = new Date().toISOString().split('T')[0]
    function addMeses(data: string, n: number) {
      const d = new Date(data + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().split('T')[0]
    }
    try {
      if (formaPag === 'entrada') {
        const vEnt = parseFloat(valorEntrada) || 0
        if (vEnt > 0) {
          await fetch('/api/financeiro/lancamentos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'RECEITA', descricao: `Entrada - ${numero} - ${destinatario}`, valor: vEnt, data: dataHoje, status: entradaPaga ? 'PAGO' : 'PENDENTE', referencia: numero }),
          })
        }
      } else if (formaPag === 'cartao') {
        const taxa = parseFloat(taxaCartao) || 0
        const vliq = valor * (1 - taxa / 100)
        await fetch('/api/financeiro/lancamentos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'RECEITA', descricao: `Venda Direta (cartão) - ${numero} - ${destinatario}`, valor: vliq, data: dataHoje, status: cartaoPago ? 'PAGO' : 'PENDENTE', observacoes: `Taxa cartão: ${taxa}%`, referencia: numero }),
        })
      } else if (formaPag === 'parcelado') {
        const vlParc = valor / numParcelas
        for (let i = 0; i < numParcelas; i++) {
          await fetch('/api/financeiro/lancamentos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'RECEITA', descricao: `${numero} - ${destinatario} (${i + 1}/${numParcelas})${i === 0 ? ' - Sinal' : ''}`, valor: vlParc, data: addMeses(dataHoje, i), status: i === 0 && sinalPago ? 'PAGO' : 'PENDENTE', referencia: numero }),
          })
        }
      }
      // 'entrega': workflow já lança automaticamente na expedição
      setPagPopup(null)
      ok('Pagamento registrado!')
    } catch { ok('Pedido criado! Registre o pagamento no financeiro.') }
    finally { setSalvandoPag(false) }
  }
  function toggleSel(id: string) { setSelecionados(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]) }

  // Estado: marcando-todos? (loading do botão)
  const [marcandoTodos, setMarcandoTodos] = useState(false)

  async function toggleTodos() {
    // Se já tem itens marcados → desmarca tudo
    if (selecionados.length > 0) {
      setSelecionados([])
      return
    }
    // Senão, busca TODOS os IDs do filtro atual no servidor
    setMarcandoTodos(true)
    try {
      const p = new URLSearchParams()
      if (filtroStatus)      p.set('status',      filtroStatus)
      if (filtroAtrasados)   p.set('atrasados',   '1')
      if (filtroPrioridade)  p.set('prioridade',  filtroPrioridade)
      if (filtroCanal)       p.set('canal',       filtroCanal)
      if (filtroSetor)       p.set('setorId',     filtroSetor)
      if (busca)             p.set('busca',       busca)
      if (filtroDataEntradaVazio)      p.set('dataEntrada', '__VAZIO__')
      else if (filtroDataEntrada)      p.set('dataEntrada', filtroDataEntrada)
      if (filtroDataEnvioVazio)        p.set('dataEnvio',   '__VAZIO__')
      else if (filtroDataEnvio)        p.set('dataEnvio',   filtroDataEnvio)
      if (filtroResponsavel) p.set('responsavel', filtroResponsavel)
      if (filtroFreelancer)  p.set('freelancer',  filtroFreelancer)
      if (filtroObsVazio)    p.set('obsVazio',    '1')
      else if (filtroObs)    p.set('obs',         filtroObs)
      const filtrosWLAtivos = Object.entries(filtrosWL).filter(([, v]) => v && v !== '')
      if (filtrosWLAtivos.length > 0) {
        p.set('filtrosWL', JSON.stringify(Object.fromEntries(filtrosWLAtivos)))
      }
      p.set('onlyIds', '1')
      const r = await fetch(`/api/producao/pedidos?${p.toString()}`)
      const d = await r.json()
      if (Array.isArray(d.ids)) setSelecionados(d.ids)
    } catch {
      // Fallback: marca apenas os da página atual
      setSelecionados(pedidosFiltrados.map(p => p.id))
    } finally {
      setMarcandoTodos(false)
    }
  }

  function limparFiltros() {
    setFiltroStatus(''); setFiltroAtrasados(false); setFiltroPrioridade(''); setFiltroCanal(''); setFiltroSetor('')
    setFiltroDataEntrada(''); setFiltroDataEnvio(''); setFiltroResponsavel(''); setBusca(''); setFiltrosWL({})
    setFiltroFreelancer('')
    setFiltroDataEntradaVazio(false); setFiltroDataEnvioVazio(false)
    setFiltroObs(''); setFiltroObsVazio(false)
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
    if (campo.tipo === 'imagem') return (
      <div>
        {val?.startsWith('data:image') ? (
          <div className="relative inline-block">
            <img src={val} alt={campo.nome}
              className="max-h-24 max-w-[160px] rounded-lg border border-gray-600 object-contain" />
            <button type="button"
              onClick={() => set('')}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
              <X size={10} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 border border-dashed border-gray-500 dark:border-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 cursor-pointer hover:border-orange-500 hover:bg-orange-500/5 transition">
            <ImageIcon size={15} className="text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Clique para anexar imagem</p>
              <p className="text-xs text-gray-600">PNG, JPG · máx. 1MB</p>
            </div>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 1024 * 1024) { alert('Imagem muito grande. Máximo 1MB.'); return }
                const reader = new FileReader()
                reader.onload = () => set(reader.result as string)
                reader.readAsDataURL(file)
                e.target.value = ''
              }} />
          </label>
        )}
      </div>
    )
    return <input type={campo.tipo === 'numero' ? 'number' : 'text'} value={val} onChange={e => set(e.target.value)} placeholder={campo.placeholder || ''} className={inputClass} />
  }

  const isAdmin    = session?.user?.role === 'ADMIN'
  const podeEditar = session?.user?.role !== 'OPERADOR'
  const OPCOES_ORDEM: { value: string; label: string }[] = [
    { value: '',                  label: 'Padrão (mais recentes)' },
    { value: 'data_entrada_asc',  label: '📅 Data de entrada — mais antiga' },
    { value: 'data_entrada_desc', label: '📅 Data de entrada — mais recente' },
    { value: 'data_envio_asc',    label: '🚚 Data de envio — mais próxima' },
    { value: 'data_envio_desc',   label: '🚚 Data de envio — mais distante' },
    { value: 'valor_asc',         label: '💰 Valor — menor primeiro' },
    { value: 'valor_desc',        label: '💰 Valor — maior primeiro' },
    { value: 'canal_asc',         label: '🏪 Canal — A→Z' },
    { value: 'destinatario_asc',  label: '👤 Nome — A→Z' },
    { value: 'destinatario_desc', label: '👤 Nome — Z→A' },
  ]

  const temFiltro  = filtroStatus || filtroAtrasados || filtroPrioridade || filtroCanal || filtroSetor || busca || filtroDataEntrada || filtroDataEnvio || filtroDataEntradaVazio || filtroDataEnvioVazio || filtroResponsavel || filtroFreelancer || filtroObs || filtroObsVazio || Object.values(filtrosWL).some(v => v !== '')

  // Helper para parsear camposExtras com segurança
  function parseExtras(raw: string | null): Record<string, any> {
    if (!raw) return {}
    try { return JSON.parse(raw) } catch { return {} }
  }

  // Filtros e ordenação agora são server-side. Mantém apenas a referência.
  const pedidosFiltrados = (() => {
    return pedidos
  })()

  // Somar quantidade padrão dos pedidos selecionados
  const abertosSelec = selecionados.filter(id => pedidos.find(p => p.id === id)?.status === 'ABERTO').length
  const somaItens    = selecionados.reduce((acc, id) => acc + (Number(pedidos.find(p => p.id === id)?.quantidade) || 0), 0)

  // Somar campos numéricos dos pedidos selecionados
  const camposNumericos = camposPedido.filter(c => c.tipo === 'numero')
  const somasCampos = camposNumericos.reduce((acc, campo) => {
    const soma = selecionados.reduce((s, id) => {
      const extras = parseExtras(pedidos.find(p => p.id === id)?.camposExtras ?? null)
      return s + (Number(extras[campo.nome]) || 0)
    }, 0)
    return soma > 0 ? { ...acc, [campo.nome]: soma } : acc
  }, {} as Record<string, number>)

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
              <option value="__VAZIO__">— Sem canal —</option>
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
              <option value="__VAZIO__">— Sem setor —</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <button onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition ${mostrarFiltros ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Mais filtros <ChevronDown size={12} className={`transition-transform ${mostrarFiltros ? 'rotate-180' : ''}`} />
            </button>
            {/* Botão Ordenar */}
            <div className="relative">
              <button onClick={() => setMenuOrdenar(p => !p)}
                className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition ${ordenacao ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <ArrowUpDown size={13} />
                Ordenar {ordenacao && '●'}
              </button>
              {menuOrdenar && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1 min-w-56">
                  {OPCOES_ORDEM.map(op => (
                    <button key={op.value} onClick={() => { setOrdenacao(op.value); setMenuOrdenar(false) }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition ${ordenacao === op.value ? 'text-orange-600 font-medium bg-orange-50 dark:bg-orange-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                      {op.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {temFiltro && <button onClick={limparFiltros} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2"><X size={12} /> Limpar</button>}
          </div>

          {mostrarFiltros && (
            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Data de entrada</label>
                <input type="date" value={filtroDataEntradaVazio ? '' : filtroDataEntrada} disabled={filtroDataEntradaVazio} onChange={e => setFiltroDataEntrada(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400" />
                <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={filtroDataEntradaVazio} onChange={e => { setFiltroDataEntradaVazio(e.target.checked); if (e.target.checked) setFiltroDataEntrada('') }} className="accent-orange-500" />
                  Sem data de entrada
                </label>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Data de envio</label>
                <input type="date" value={filtroDataEnvioVazio ? '' : filtroDataEnvio} disabled={filtroDataEnvioVazio} onChange={e => setFiltroDataEnvio(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400" />
                <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={filtroDataEnvioVazio} onChange={e => { setFiltroDataEnvioVazio(e.target.checked); if (e.target.checked) setFiltroDataEnvio('') }} className="accent-orange-500" />
                  Sem data de envio
                </label>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Responsável</label>
                <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Todos</option>
                  <option value="__VAZIO__">— Sem responsável —</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Freelancer</label>
                <select value={filtroFreelancer} onChange={e => setFiltroFreelancer(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Todos</option>
                  <option value="__VAZIO__">— Sem freelancer —</option>
                  {Object.entries(freelancers).map(([id, nome]) => <option key={id} value={id}>{nome as string}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Observações</label>
                <input type="text" value={filtroObsVazio ? '' : filtroObs} disabled={filtroObsVazio}
                  onChange={e => setFiltroObs(e.target.value)}
                  placeholder="Buscar no texto..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400" />
                <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={filtroObsVazio}
                    onChange={e => { setFiltroObsVazio(e.target.checked); if (e.target.checked) setFiltroObs('') }}
                    className="accent-orange-500" />
                  Sem observações
                </label>
              </div>
              {camposFiltro.map(campo => (
                <div key={campo.id}>
                  <label className="text-xs text-gray-500 font-medium block mb-1">{campo.nome}</label>
                  {campo.tipo === 'lista' && campo.opcoes ? (
                    <select value={filtrosWL[campo.nome] || ''} onChange={e => setFiltrosWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                      <option value="">Todos</option>
                      <option value="__VAZIO__">— Sem preenchimento —</option>
                      {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : campo.tipo === 'checkbox' ? (
                    <select value={filtrosWL[campo.nome] || ''} onChange={e => setFiltrosWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                      <option value="">Todos</option>
                      <option value="__VAZIO__">— Sem preenchimento —</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  ) : (
                    <div>
                      <input type={campo.tipo === 'data' ? 'date' : 'text'} value={filtrosWL[campo.nome] === '__VAZIO__' ? '' : (filtrosWL[campo.nome] || '')}
                        disabled={filtrosWL[campo.nome] === '__VAZIO__'}
                        onChange={e => setFiltrosWL(p => ({ ...p, [campo.nome]: e.target.value }))}
                        placeholder={campo.placeholder || campo.nome + '...'}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400" />
                      <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={filtrosWL[campo.nome] === '__VAZIO__'}
                          onChange={e => setFiltrosWL(p => ({ ...p, [campo.nome]: e.target.checked ? '__VAZIO__' : '' }))}
                          className="accent-orange-500" />
                        Sem preenchimento
                      </label>
                    </div>
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
                Total de pedidos: {selecionados.length}
              </span>
              <span className="text-xs text-orange-600 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                Total de peças: {selecionados.reduce((acc, id) => acc + (Number(pedidos.find(p => p.id === id)?.quantidade) || 0), 0)}
              </span>
              {Object.entries(somasCampos).map(([nome, soma]) => (
                <span key={nome} className="text-xs text-orange-600 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                  {nome}: {soma}
                </span>
              ))}
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
              <div className="flex items-end gap-2 w-full">
                <div className="flex-1 min-w-[260px]">
                  <label className="text-xs font-medium text-orange-700 block mb-1">Observações</label>
                  <textarea value={massaObs} onChange={e => setMassaObs(e.target.value)}
                    rows={2} placeholder="Texto a aplicar aos pedidos selecionados..."
                    className="w-full border border-orange-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none resize-none" />
                </div>
                <button onClick={() => aplicarMassaObs('substituir')} disabled={!massaObs.trim() || executandoMassa}
                  title="Substitui a observação atual"
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Substituir
                </button>
                <button onClick={() => aplicarMassaObs('adicionar')} disabled={!massaObs.trim() || executandoMassa}
                  title="Adiciona ao final da observação atual"
                  className="text-xs bg-white border border-orange-400 text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Adicionar
                </button>
                <button onClick={() => aplicarMassaObs('limpar')} disabled={executandoMassa}
                  title="Remove a observação de todos os pedidos selecionados"
                  className="text-xs bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Limpar
                </button>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">Status</label>
                  <select value={massaStatus} onChange={e => setMassaStatus(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                    <option value="">Selecionar...</option>
                    <option value="ABERTO">Aberto</option>
                    <option value="EM_PRODUCAO">Em produção</option>
                    <option value="CONCLUIDO">Concluído</option>
                    <option value="ENVIADO">Enviado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
                <button onClick={aplicarMassaStatus} disabled={!massaStatus || executandoMassa}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Aplicar
                </button>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">Mover para setor</label>
                  <select value={massaSetor} onChange={e => setMassaSetor(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                    <option value="">Selecionar...</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <button onClick={aplicarMassaSetor} disabled={!massaSetor || executandoMassa}
                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 font-medium mb-0.5">
                  Mover
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
              {/* Prioridade em massa */}
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-orange-700 block mb-1">Prioridade</label>
                  <select value={massaPrioridade} onChange={e => setMassaPrioridade(e.target.value)}
                    className="border border-orange-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                    <option value="">Selecionar...</option>
                    <option value="URGENTE">🔴 Urgente</option>
                    <option value="ALTA">🟠 Alta</option>
                    <option value="NORMAL">🟡 Normal</option>
                    <option value="BAIXA">🟢 Baixa</option>
                  </select>
                </div>
                <button onClick={aplicarMassaPrioridade} disabled={!massaPrioridade || executandoMassa}
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
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
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
              {/* Linha de controles (separada dos headers de coluna) */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                <input type="checkbox"
                  disabled={marcandoTodos}
                  checked={selecionados.length > 0 && selecionados.length >= total && total > 0}
                  ref={el => { if (el) el.indeterminate = selecionados.length > 0 && selecionados.length < total }}
                  onChange={toggleTodos}
                  className="accent-orange-500 flex-shrink-0"
                  title={selecionados.length > 0 ? 'Desmarcar todos' : `Selecionar todos os ${total} pedido${total !== 1 ? 's' : ''}`} />
                <button onClick={toggleTodos} disabled={marcandoTodos}
                  className="text-xs text-gray-500 hover:text-orange-600 disabled:opacity-50 font-medium">
                  {marcandoTodos
                    ? 'Selecionando...'
                    : selecionados.length > 0
                      ? `Desmarcar (${selecionados.length})`
                      : `Selecionar todos (${total})`}
                </button>
                {total > LIMITE && (
                  <span className="text-xs text-gray-400 ml-auto">
                    Pág. {pagina}/{Math.ceil(total / LIMITE)}
                  </span>
                )}
              </div>
              {/* Headers de coluna — estrutura idêntica à das linhas de dados */}
              <div className="min-w-[1180px]">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <div className="w-4 flex-shrink-0" />
                <div className="w-28 flex-shrink-0">Nº Pedido</div>
                <div className="flex-1" style={{ minWidth: '200px' }}>Destinatário / Produto</div>
                <div className="w-24 flex-shrink-0">Canal</div>
                <div className="w-28 flex-shrink-0 text-center">Setor atual</div>
                <div className="w-10 flex-shrink-0 text-center">Peças</div>
                <div className="w-10 flex-shrink-0 text-center">SKUs</div>
                {isAdmin && <div className="w-24 flex-shrink-0">Valor</div>}
                <div className="w-24 flex-shrink-0">Data envio</div>
                <div className="w-20 flex-shrink-0">Prioridade</div>
                <div className="w-28 flex-shrink-0 whitespace-nowrap">Status / Ação</div>
              </div>
              <div className="divide-y divide-gray-50">
                {pedidosFiltrados.map(pedido => {
                  const extras: Record<string,any> = (() => { try { return pedido.camposExtras ? JSON.parse(pedido.camposExtras) : {} } catch { return {} } })()
                  // Soma de peças a partir de camposExtras.produtos (mais preciso que pedido.quantidade para imports Shopee)
                  const qtdPecas = Array.isArray(extras.produtos) && extras.produtos.length > 0
                    ? extras.produtos.reduce((s: number, p: any) => s + (Number(p.quantidade) || 1), 0)
                    : Number(pedido.quantidade)
                  return (
                    <div key={pedido.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition text-sm ${selecionados.includes(pedido.id) ? 'bg-orange-50/50' : ''}`}>
                      <input type="checkbox" checked={selecionados.includes(pedido.id)} onChange={() => toggleSel(pedido.id)} onClick={e => e.stopPropagation()} className="accent-orange-500 flex-shrink-0 w-4 mt-1" />
                      <div className="w-28 flex-shrink-0 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                        <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">{pedido.numero}</span>
                      </div>
                      <div className="flex-1 cursor-pointer" style={{ minWidth: '200px' }} onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                        <div className="font-medium text-gray-900 truncate">{pedido.destinatario}</div>
                        {pedido.idCliente && <div className="text-xs text-gray-400">User: {pedido.idCliente}</div>}
                        <div className="text-xs text-gray-400 truncate">{pedido.produto}</div>
                        {pedido.endereco && (
                          <div className="flex items-start gap-1 mt-0.5">
                            <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">📍</span>
                            <div>
                              <p className="text-xs text-gray-400 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'horizontal', overflow: 'hidden' }}>{pedido.endereco}</p>
                              {pedido.endereco.length > 60 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setObsModalTitulo('📍 Endereço Completo'); setObsModal(pedido.endereco) }}
                                  className="text-xs text-orange-400 font-semibold mt-0.5 hover:text-orange-500">
                                  Ler mais →
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Observações do pedido — destaque */}
                        {pedido.observacoes && (
                          <div style={{
                            marginTop: '6px',
                            borderRadius: '6px',
                            border: '1px solid #f97316',
                            background: '#fff7ed',
                            padding: '6px 8px',
                          }}>
                            <p style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#c2410c',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              marginBottom: '2px',
                            }}>💬 Observações</p>
                            <p style={{
                              fontSize: '12px',
                              color: '#111827',
                              fontWeight: 500,
                              whiteSpace: 'pre-line',
                              wordBreak: 'break-word',
                            }}>{pedido.observacoes}</p>
                            {pedido.observacoes.length > 150 && (
                              <button
                                onClick={e => { e.stopPropagation(); setObsModalTitulo('💬 Observações'); setObsModal(pedido.observacoes) }}
                                style={{ fontSize: '11px', color: '#f97316', fontWeight: 600, marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                Ler mais →
                              </button>
                            )}
                          </div>
                        )}
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
                                if (campo.tipo === 'imagem' && String(valor).startsWith('data:image')) {
                                  return (
                                    <span key={campo.nome} className="text-xs flex items-center gap-1">
                                      <span className="text-gray-400">{campo.nome}:</span>
                                      <img
                                        src={String(valor)}
                                        alt={campo.nome}
                                        onClick={() => setImagemAmpliada(String(valor))}
                                        className="w-7 h-7 rounded object-cover border border-gray-600 cursor-pointer hover:opacity-80 transition"
                                        title="Clique para ampliar"
                                      />
                                    </span>
                                  )
                                }
                                return (
                                  <span key={campo.nome} className="text-xs">
                                    <span className="text-gray-400">{campo.nome}:</span>{' '}
                                    <span className="text-orange-600 font-medium">
                                      {campo.tipo === 'checkbox'
                                        ? (valor === 'true' ? 'Sim' : 'Não')
                                        : campo.tipo === 'data'
                                          ? (() => {
                                              const s = String(valor)
                                              const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
                                              return m ? `${m[3]}/${m[2]}/${m[1]}` : s
                                            })()
                                          : String(valor)}
                                    </span>
                                  </span>
                                )
                              })}
                          </div>
                        )}
                      </div>
                      <div className="w-24 flex-shrink-0 text-xs text-gray-500 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>{pedido.canal || '—'}</div>
                      <div className="w-28 flex-shrink-0 pt-0.5 text-center">
                        {pedido.setor_atual_nome ? (
                          <button onClick={() => router.push(`/dashboard/setor/${pedido.setor_atual_id}`)}
                            className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full hover:bg-orange-100 transition truncate max-w-full">
                            {pedido.setor_atual_nome}
                          </button>
                        ) : <span className="text-xs text-gray-200">—</span>}
                      </div>
                      <div className="w-10 flex-shrink-0 text-center text-gray-700 pt-0.5 cursor-pointer font-medium" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>{qtdPecas}</div>
                      <div className="w-10 flex-shrink-0 text-center text-gray-500 pt-0.5 text-xs cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>{pedido.quantidadeSku ?? '—'}</div>
                      {isAdmin && (
                        <div className="w-24 flex-shrink-0 text-xs text-gray-600 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                          {pedido.valor && !isNaN(Number(pedido.valor)) ? `R$ ${Number(pedido.valor).toFixed(2)}` : '—'}
                        </div>
                      )}
                      <div className="w-24 flex-shrink-0 text-xs text-gray-500 pt-0.5 cursor-pointer" onClick={() => router.push(`/dashboard/pedidos/${pedido.id}`)}>
                        {fmtData(pedido.dataEnvio)}
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
              </div>
            </>
          )}
        </div>

        {/* ── PAGINAÇÃO ── */}
        {total > LIMITE && (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-sm text-gray-500">
              Mostrando <strong>{((pagina - 1) * LIMITE) + 1}–{Math.min(pagina * LIMITE, total)}</strong> de <strong>{total}</strong> pedidos
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPagina(p => Math.max(1, p - 1)); setSelecionados([]) }}
                disabled={pagina === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                ← Anterior
              </button>
              {Array.from({ length: Math.ceil(total / LIMITE) }, (_, i) => i + 1)
                .filter(p => p === 1 || p === Math.ceil(total / LIMITE) || Math.abs(p - pagina) <= 1)
                .reduce((acc: (number | string)[], p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i-1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) => p === '...'
                  ? <span key={`dot-${i}`} className="px-1 text-gray-400">…</span>
                  : <button key={p} onClick={() => { setPagina(p as number); setSelecionados([]) }}
                      className={`w-8 h-8 text-sm rounded-lg border transition ${pagina === p ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                )}
              <button
                onClick={() => { setPagina(p => Math.min(Math.ceil(total / LIMITE), p + 1)); setSelecionados([]) }}
                disabled={pagina >= Math.ceil(total / LIMITE)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL NOVO PEDIDO ── */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Novo pedido</h2>
              <button onClick={fecharModalNovo} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={criarPedido} className="p-6">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Dados obrigatórios</p>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">ID do Pedido (número) *</label>
                  <input type="text" value={form.numero} onChange={e => setForm(p => ({...p, numero: e.target.value}))} className={inputClass} placeholder="Ex: SHOP-12345" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Canal de venda</label>
                  <select value={form.canal} onChange={e => setForm(p => ({...p, canal: e.target.value}))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Nome da cliente (destinatário) *</label>
                  <input type="text" value={form.destinatario} onChange={e => setForm(p => ({...p, destinatario: e.target.value}))} className={inputClass} placeholder="Nome completo" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">ID User (plataforma)</label>
                  <input type="text" value={form.idCliente} onChange={e => setForm(p => ({...p, idCliente: e.target.value}))} className={inputClass} placeholder="Ex: shopee_user123" />
                </div>
                {CANAIS_COM_ENDERECO.includes(form.canal) && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
                      Endereço de entrega
                      <span className="ml-1 text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">Venda {form.canal}</span>
                    </label>
                    <input type="text" value={form.endereco} onChange={e => setForm(p => ({...p, endereco: e.target.value}))} className={inputClass} placeholder="Rua, número, bairro, cidade, CEP..." />
                  </div>
                )}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">Produto(s) *</label>
                    <button type="button" onClick={() => setItensModal(p => [...p, novoItem()])} className="text-xs text-orange-400 hover:text-orange-300">+ Adicionar</button>
                  </div>
                  <div className="space-y-2">
                    {itensModal.map((item, idx) => (
                      <div key={item._key} className="border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/60">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Produto {idx + 1}</span>
                          {itensModal.length > 1 && <button type="button" onClick={() => setItensModal(p => p.filter(i => i._key !== item._key))} className="text-xs text-red-400 hover:text-red-300">✕</button>}
                        </div>
                        {variacoes.length > 0 && (
                          <select value={item.variacaoId} onChange={e => {
                            const v = variacoes.find((x: any) => x.id === e.target.value)
                            const nomeProduto = v ? ((v as any).nome ? `${v.produtoNome} — ${(v as any).nome}` : `${v.produtoNome} · ${v.canal} · ${v.tipo}${v.subOpcao ? ' · ' + v.subOpcao : ''}`) : ''
                            const valorItem   = v ? Number(v.precoVenda) : 0
                            const isKit       = v ? (v.isKit ?? false) : false
                            const qtdKitPecas = isKit ? Math.max(Number(v?.qtdKit) || 1, 1) : 0
                            setItensModal(prev => prev.map(i => i._key === item._key ? { ...i, variacaoId: e.target.value, nomeProduto, valorItem, isKit, qtdKitPecas, custoMaoObra: v ? Number(v.custoMaoObra) : 0 } : i))
                            if (v?.emPromo && v?.precoPromocional) {
                              setPromoPopup({ key: item._key, nomeProduto, precoVenda: valorItem, precoPromo: Number(v.precoPromocional) })
                            }
                          }} className={inputClass + ' mb-2'}>
                            <option value="">Selecionar da Precificação...</option>
                            {variacoes.map((v: any) => {
                              const label = (v as any).nome ? `${v.produtoNome} — ${(v as any).nome}` : `${v.produtoNome} · ${v.canal} · ${v.tipo}${v.subOpcao ? ' · ' + v.subOpcao : ''}`
                              return <option key={v.id} value={v.id}>{label}{v.emPromo ? ' 🏷️' : ''}</option>
                            })}
                          </select>
                        )}
                        <input type="text" value={item.nomeProduto} onChange={e => setItensModal(prev => prev.map(i => i._key === item._key ? { ...i, nomeProduto: e.target.value, variacaoId: '' } : i))} className={inputClass + ' mb-2'} placeholder="Ou descreva manualmente..." required={idx === 0} />
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex-1 min-w-24">
                            <label className="text-xs text-gray-500 block mb-1">{item.isKit ? 'Qtd. de SKUs' : 'Qtd.'}</label>
                            <input type="number" min="1" value={item.quantidade} onChange={e => setItensModal(prev => prev.map(i => i._key === item._key ? { ...i, quantidade: parseInt(e.target.value) || 1 } : i))} className={inputClass} />
                          </div>
                          {item.isKit && item.qtdKitPecas ? (
                            <div className="flex-1 min-w-24">
                              <label className="text-xs text-gray-500 block mb-1">Peças por kit</label>
                              <div className={inputClass + ' bg-gray-50 dark:bg-gray-700 text-gray-500 cursor-not-allowed'}>{item.qtdKitPecas} <span className="text-xs text-gray-400">fixo</span></div>
                            </div>
                          ) : null}
                          {item.isKit && item.qtdKitPecas && item.quantidade > 1 ? (
                            <div className="flex-1 min-w-24">
                              <label className="text-xs text-gray-500 block mb-1">Total de peças</label>
                              <div className={inputClass + ' bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-semibold cursor-not-allowed'}>{item.quantidade * item.qtdKitPecas} peças</div>
                            </div>
                          ) : null}
                          <div className="flex-1 min-w-24">
                            <label className="text-xs text-gray-500 block mb-1">{item.isKit ? 'Valor do kit (R$)' : 'Valor unit. (R$)'}</label>
                            <input type="number" step="0.01" min="0" value={item.valorItem || ''} onChange={e => setItensModal(prev => prev.map(i => i._key === item._key ? { ...i, valorItem: parseFloat(e.target.value) || 0 } : i))} className={inputClass} placeholder="0,00" />
                          </div>
                          {item.valorItem > 0 && item.quantidade > 1 && (
                            <div className="flex-shrink-0 flex items-end pb-2">
                              <span className="text-xs text-orange-400 font-semibold whitespace-nowrap">= R$ {(item.valorItem * item.quantidade).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {itensModal.some(i => i.valorItem > 0) && (
                      <div className="flex justify-end mt-1">
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5 text-sm">
                          <span className="text-gray-500 text-xs">Total: </span>
                          <span className="font-bold text-orange-400">R$ {itensModal.reduce((acc, i) => acc + (i.valorItem * i.quantidade), 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Quantidade (soma automática)</label>
                  {itensModal.some(i => i.nomeProduto) ? (
                    <div className={inputClass + ' bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed'}>
                      {itensModal.filter(i => i.nomeProduto).reduce((s, i) => s + (i.isKit && i.qtdKitPecas ? i.quantidade * i.qtdKitPecas : i.quantidade), 0)} <span className="text-xs text-gray-400">(soma dos itens)</span>
                    </div>
                  ) : (
                    <input type="number" value={form.quantidade} onChange={e => setForm(p => ({...p, quantidade: Number(e.target.value)}))} className={inputClass} min={1} />
                  )}
                </div>
                {isAdmin && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Valor (R$)</label>
                    {itensModal.some(i => i.valorItem > 0) ? (
                      <div className={inputClass + ' bg-gray-50 dark:bg-gray-800 text-orange-500 font-semibold cursor-not-allowed'}>
                        R$ {itensModal.reduce((acc, i) => acc + (i.valorItem * i.quantidade), 0).toFixed(2)}
                      </div>
                    ) : (
                      <input type="number" value={form.valor} onChange={e => setForm(p => ({...p, valor: e.target.value}))} className={inputClass} placeholder="0,00" step="0.01" min="0" />
                    )}
                  </div>
                )}
              </div>

              {/* Campos personalizados — movidos para cima para fácil acesso */}
              {camposPedido.length > 0 ? (
                <div className="border border-orange-100 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-900/10 rounded-xl p-4 mt-3">
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
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">{campo.nome}</label>
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
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Data de entrada do pedido</label>
                  <input type="date" value={form.dataEntrada} onChange={e => setForm(p => ({...p, dataEntrada: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Data de envio do pedido</label>
                  <input type="date" value={form.dataEnvio} onChange={e => setForm(p => ({...p, dataEnvio: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Prioridade</label>
                  <select value={form.prioridade} onChange={e => setForm(p => ({...p, prioridade: e.target.value}))} className={inputClass}>
                    <option value="BAIXA">Baixa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Observação do pedido</label>
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

      {/* ── LIGHTBOX IMAGEM ── */}
      {imagemAmpliada && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
          onClick={() => setImagemAmpliada(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setImagemAmpliada(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow z-10 hover:bg-gray-100"
            >✕</button>
            <img
              src={imagemAmpliada}
              alt="Imagem do pedido"
              className="w-full max-h-[80vh] object-contain rounded-xl border border-gray-700"
            />
          </div>
        </div>
      )}

      {/* ── POPUP PROMOÇÃO ── */}
      {promoPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-orange-500 px-5 py-4">
              <p className="text-white font-bold text-sm">🏷️ Produto em promoção!</p>
              <p className="text-orange-100 text-xs mt-0.5 truncate">{promoPopup.nomeProduto}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Qual preço deseja usar neste pedido?</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => setPromoPopup(null)}
                  className="w-full flex items-center justify-between border border-gray-200 hover:border-orange-300 hover:bg-orange-50 rounded-xl px-4 py-3 transition">
                  <span className="text-sm font-medium text-gray-700">Preço padrão</span>
                  <span className="text-sm font-bold text-gray-900">R$ {promoPopup.precoVenda.toFixed(2).replace('.',',')}</span>
                </button>
                <button onClick={() => {
                  setItensModal(prev => prev.map(i => i._key === promoPopup.key ? { ...i, valorItem: promoPopup.precoPromo } : i))
                  setPromoPopup(null)
                }} className="w-full flex items-center justify-between bg-orange-500 hover:bg-orange-600 rounded-xl px-4 py-3 transition">
                  <span className="text-sm font-semibold text-white">🏷️ Preço promocional</span>
                  <span className="text-sm font-bold text-white">R$ {promoPopup.precoPromo.toFixed(2).replace('.',',')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP PAGAMENTO VENDA DIRETA ── */}
      {pagPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-orange-500 px-5 py-4">
              <p className="text-white font-bold">💰 Como será o pagamento?</p>
              <p className="text-orange-100 text-xs mt-0.5">{pagPopup.numero} · {pagPopup.destinatario} · R$ {pagPopup.valor.toFixed(2).replace('.',',')}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Opções */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'entrada',   label: '💵 Entrada/Sinal',        sub: 'Parte agora, resto depois' },
                  { key: 'cartao',    label: '💳 Cartão de crédito',    sub: 'Valor líquido após taxa' },
                  { key: 'parcelado', label: '📅 Parcelado',            sub: '1ª parcela como sinal' },
                  { key: 'entrega',   label: '📦 Na entrega',           sub: 'Entra ao expedir' },
                ] as const).map(op => (
                  <button key={op.key} onClick={() => setFormaPag(op.key)}
                    className={`text-left p-3 rounded-xl border-2 transition ${formaPag === op.key ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
                    <p className="text-sm font-semibold text-gray-800">{op.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{op.sub}</p>
                  </button>
                ))}
              </div>

              {/* Campos por forma */}
              {formaPag === 'entrada' && (
                <div className="space-y-2 border border-orange-200 bg-orange-50 rounded-xl p-3">
                  <label className="text-xs font-medium text-gray-600 block">Valor de entrada (R$)</label>
                  <input type="number" step="0.01" value={valorEntrada} onChange={e => setValorEntrada(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="0,00" />
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={entradaPaga} onChange={e => setEntradaPaga(e.target.checked)} className="accent-orange-500" />
                    <span className="text-xs text-gray-600">Entrada já foi recebida (entra no caixa agora)</span>
                  </label>
                </div>
              )}

              {formaPag === 'cartao' && (
                <div className="space-y-2 border border-orange-200 bg-orange-50 rounded-xl p-3">
                  <label className="text-xs font-medium text-gray-600 block">Taxa do cartão (%)</label>
                  <input type="number" step="0.01" value={taxaCartao} onChange={e => setTaxaCartao(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  {taxaCartao && <p className="text-xs text-orange-600 font-medium">Valor líquido: R$ {(pagPopup.valor * (1 - parseFloat(taxaCartao||'0') / 100)).toFixed(2).replace('.',',')}</p>}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cartaoPago} onChange={e => setCartaoPago(e.target.checked)} className="accent-orange-500" />
                    <span className="text-xs text-gray-600">Pagamento já confirmado</span>
                  </label>
                </div>
              )}

              {formaPag === 'parcelado' && (
                <div className="space-y-2 border border-orange-200 bg-orange-50 rounded-xl p-3">
                  <label className="text-xs font-medium text-gray-600 block">Número de parcelas</label>
                  <select value={numParcelas} onChange={e => setNumParcelas(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {[2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n}x de R$ {(pagPopup.valor/n).toFixed(2).replace('.',',')}</option>)}
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sinalPago} onChange={e => setSinalPago(e.target.checked)} className="accent-orange-500" />
                    <span className="text-xs text-gray-600">1ª parcela (sinal) já recebida</span>
                  </label>
                </div>
              )}

              {formaPag === 'entrega' && (
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-700">📦 O registro será criado automaticamente quando o pedido for expedido. Nada a fazer agora.</p>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setPagPopup(null)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50">
                Pular
              </button>
              <button onClick={confirmarPagamento} disabled={salvandoPag}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                {salvandoPag ? 'Salvando...' : formaPag === 'entrega' ? 'Confirmar' : 'Registrar pagamento'}
              </button>
            </div>
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
      {/* Modal — texto completo */}
      {obsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setObsModal(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-bold text-orange-600 uppercase tracking-wide">{obsModalTitulo}</p>
              <button onClick={() => setObsModal(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{obsModal}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PedidosPage() {
  return <Suspense><PedidosPageInner /></Suspense>
}
