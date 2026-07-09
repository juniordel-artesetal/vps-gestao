'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Pencil, Save, X, Play, CheckCircle,
  XCircle, Package, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Users, Layers, Printer, ImageIcon,
} from 'lucide-react'

// ── Tipos ───────────────────────────────────────────────────────────────────

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
  statusPagamento?: string | null
  metodoPagamento?: string | null
  pagoEm?: string | null
  temComprovante?: boolean
}

interface SetorHistorico {
  setorId: string
  setorNome: string
  entradaEm: string | null
  saidaEm: string | null
  atual: boolean
}

interface Demanda {
  id: string
  freelancerNome: string
  nomeProduto: string
  qtdSolicitada: number
  qtdProduzida: number
  valorPorItem: number
  valorTotal: number
  status: string
}

interface Variacao {
  id: string; produtoNome: string; canal: string; tipo: string
  subOpcao: string | null; custoTotal: number; precoVenda: number
  custoMaoObra: number; isKit: boolean; qtdKit: number; nome?: string | null
}
interface FreelancerItem { id: string; nome: string; especialidade: string | null }
interface ItemPedido {
  _key: string; variacaoId: string; nomeProduto: string
  quantidade: number; custoMaoObra: number
  freelancerDemandaId: string; valorFreelancer: number
  valorItem: number
  isKit?: boolean
  qtdKitPecas?: number
}
function novoItemEdit(nome = '', qtd = 1): ItemPedido {
  return { _key: Math.random().toString(36).slice(2), variacaoId: '', nomeProduto: nome, quantidade: qtd, custoMaoObra: 0, freelancerDemandaId: '', valorFreelancer: 0, valorItem: 0, isKit: false, qtdKitPecas: 0 }
}
interface CampoPedido {
  id: string; nome: string; tipo: string; opcoes: string | null; placeholder: string | null
}
interface SetorCampoPedido {
  id: string; nome: string; tipo: string; opcoes: string | null; placeholder: string | null; setorId: string; ativo: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inputClass = "w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400 dark:placeholder-gray-400"

const CANAIS = ['Shopee', 'Mercado Livre', 'Direta', 'Instagram', 'WhatsApp', 'Outros']

// Canais com pagamento gerenciado manualmente pela artesã (vendas diretas).
// Marketplaces ficam de fora porque têm fluxo de pagamento próprio.
const CANAIS_PAGAMENTO_MANUAL = ['Direta', 'Instagram', 'WhatsApp', 'Outros']

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  ABERTO:      { label: 'Aberto',       cor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  EM_PRODUCAO: { label: 'Em produção',  cor: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  CONCLUIDO:   { label: 'Concluído',    cor: 'bg-green-500/20 text-green-300 border-green-500/40' },
  CANCELADO:   { label: 'Cancelado',    cor: 'bg-red-500/20 text-red-300 border-red-500/40' },
}

const PRIO_CONFIG: Record<string, { label: string; cor: string }> = {
  URGENTE: { label: 'Urgente', cor: 'text-red-400 bg-red-500/10 border-red-500/30' },
  ALTA:    { label: 'Alta',    cor: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  NORMAL:  { label: 'Normal',  cor: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  BAIXA:   { label: 'Baixa',   cor: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
}

const DEMANDA_STATUS: Record<string, string> = {
  PENDENTE:    'text-gray-400',
  EM_PRODUCAO: 'text-blue-400',
  PRODUZIDO:   'text-yellow-400',
  PAGO:        'text-green-400',
}

function fmtR(n: number | null) {
  if (!n) return '—'
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}
function fmtDateTime(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Componente ───────────────────────────────────────────────────────────────

// Formata o endereço do cliente (ClienteEndereco) para o campo texto do pedido
function fmtEnderecoCliente(e: any): string {
  if (!e) return ''
  const l1 = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const cidadeUf = [e.cidade, e.estado].filter(Boolean).join('-')
  return [l1, e.complemento, e.bairro, cidadeUf, e.cep].filter(Boolean).join(', ')
}

export default function PedidoDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()

  const [pedido, setPedido]             = useState<Pedido | null>(null)
  const [tarefasVinc, setTarefasVinc]   = useState<any[]>([])
  const [setorHist, setSetorHist]       = useState<SetorHistorico[]>([])
  const [historicoEventos, setHistoricoEventos] = useState<Array<{id:string; tipo:string; descricao:string; usuarioNome:string|null; createdAt:string}>>([])
  const [demandas, setDemandas]         = useState<Demanda[]>([])
  const [pagamentos, setPagamentos]     = useState<any[]>([])
  const [modalPag, setModalPag]         = useState(false)
  const [formPag, setFormPag]           = useState({ descricao: '', valor: '', data: new Date().toISOString().split('T')[0], status: 'PENDENTE', observacoes: '', categoriaId: '' })
  const [categoriasPag, setCategoriasPag] = useState<Array<{id:string;nome:string;cor?:string;icone?:string}>>([])
  const [salvandoPag, setSalvandoPag]   = useState(false)
  const [camposPedido, setCamposPedido] = useState<CampoPedido[]>([])
  const [setorCamposPorSetor, setSetorCamposPorSetor] = useState<Record<string, SetorCampoPedido[]>>({})
  const [variacoes,    setVariacoes]    = useState<Variacao[]>([])
  const [freelancers,  setFreelancers]  = useState<FreelancerItem[]>([])
  const [moduloDemandas, setModuloDemandas] = useState(false)
  const [moduloClientes, setModuloClientes] = useState(false)
  const [clientesLista, setClientesLista] = useState<{ id: string; nome: string }[]>([])
  const [cliEnderecos, setCliEnderecos] = useState<any[]>([])
  const [endSelId, setEndSelId] = useState('')
  const [itensPedido,  setItensPedido]  = useState<ItemPedido[]>([novoItemEdit()])
  const [qtdStr, setQtdStr] = useState<Record<string, string>>({})
  const [loading, setLoading]           = useState(true)
  const [editando, setEditando]         = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [sucesso, setSucesso]           = useState('')
  // Navegação próximo/anterior: ids ordenados do filtro de origem (lista de pedidos)
  const [navIds, setNavIds]             = useState<string[]>([])

  // "Demandar freelancer" direto do pedido — cria Demanda já vinculada a este pedido
  // (reutiliza POST /api/demandas, que já aceita pedidoId). Não altera itens/workflow.
  const [demandarModal, setDemandarModal] = useState(false)
  const [salvandoDem, setSalvandoDem]     = useState(false)
  const [demForm, setDemForm] = useState({ freelancerId: '', nomeProduto: '', qtdSolicitada: '1', valorPorItem: '', observacoes: '' })

  async function recarregarDemandas() {
    try { const r = await fetch(`/api/demandas?pedidoId=${id}`); if (r.ok) { const dd = await r.json(); setDemandas(Array.isArray(dd) ? dd : []) } } catch {}
  }
  async function demandarFreelancer() {
    if (!demForm.freelancerId || !(parseInt(demForm.qtdSolicitada) > 0)) { setErro('Escolha o freelancer e a quantidade.'); return }
    setSalvandoDem(true); setErro('')
    try {
      const res = await fetch('/api/demandas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freelancerId: demForm.freelancerId,
          nomeProduto: demForm.nomeProduto.trim() || 'Produção',
          qtdSolicitada: parseInt(demForm.qtdSolicitada) || 1,
          valorPorItem: parseFloat(demForm.valorPorItem) || 0,
          pedidoId: id,
          observacoes: demForm.observacoes.trim() || null,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setErro(e.error || 'Erro ao criar demanda'); return }
      setDemandarModal(false)
      setDemForm({ freelancerId: '', nomeProduto: '', qtdSolicitada: '1', valorPorItem: '', observacoes: '' })
      setSucesso('Demanda criada e vinculada ao pedido!'); setTimeout(() => setSucesso(''), 3000)
      await recarregarDemandas()
    } finally { setSalvandoDem(false) }
  }

  // Form de edição
  const [form, setForm] = useState({
    numero: '', destinatario: '', idCliente: '', canal: '', produto: '',
    quantidade: 1, valor: '', dataEntrada: '', dataEnvio: '',
    observacoes: '', prioridade: 'NORMAL', endereco: '', status: 'ABERTO', clienteId: '',
  })
  const [imagemAmpliada, setImagemAmpliada] = useState<string | null>(null)
  const [allSetores,   setAllSetores]     = useState<{id:string;nome:string}[]>([])
  const [setorMover,   setSetorMover]     = useState('')
  const [movendoSetor, setMovendoSetor]   = useState(false)
  const [camposExtrasForm, setCamposExtrasForm] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    try {
      const safe = async (url: string, fb: any) => { try { const r = await fetch(url); return r.ok ? await r.json() : fb } catch { return fb } }
      const [resPedido, resCampos, varLista, dmCfg, flLista, setLista, geralCfg, cliLista] = await Promise.all([
        fetch(`/api/producao/pedidos/${id}`).then(r => r.json()),
        safe('/api/config/campos-pedido',   { campos: [] }),
        safe('/api/precificacao/variacoes', []),
        safe('/api/demandas/config',        { moduloDemandas: false }),
        safe('/api/demandas/freelancers',   []),
        safe('/api/producao/setores',       []),
        safe('/api/config/geral',           {}),
        safe('/api/clientes?limite=100',    { clientes: [] }),
      ])
      setVariacoes(Array.isArray(varLista) ? varLista : [])
      setAllSetores(Array.isArray(setLista) ? setLista : [])
      setModuloDemandas(dmCfg.moduloDemandas ?? false)
      setModuloClientes(!!geralCfg.moduloClientes)
      setClientesLista((cliLista.clientes || []).map((c: any) => ({ id: c.id, nome: c.nome })))
      setFreelancers(Array.isArray(flLista) ? flLista.filter((f: any) => f.ativo) : [])

      // Carrega campos personalizados de cada setor (em paralelo) para mostrar agrupados na ficha
      const setoresArr: any[] = Array.isArray(setLista) ? setLista : []
      try {
        const camposPorSetor: Record<string, SetorCampoPedido[]> = {}
        const resultados = await Promise.all(
          setoresArr.map(s =>
            fetch(`/api/config/campos?setorId=${s.id}`)
              .then(r => r.ok ? r.json() : { campos: [] })
              .catch(() => ({ campos: [] }))
          )
        )
        setoresArr.forEach((s, idx) => {
          const lista = (resultados[idx]?.campos || []).filter((c: any) => c.ativo)
          if (lista.length > 0) camposPorSetor[s.id] = lista
        })
        setSetorCamposPorSetor(camposPorSetor)
      } catch { /* silencioso */ }

      if (resPedido.pedido || resPedido.id) {
        const p: Pedido = resPedido.pedido || resPedido
        setPedido(p)
        // Buscar pagamentos vinculados (canais de pagamento manual: Direta, Instagram, WhatsApp, Outros)
        if (CANAIS_PAGAMENTO_MANUAL.includes(p.canal || '') && p.numero) {
          fetch(`/api/financeiro/lancamentos?referencia=${encodeURIComponent(p.numero)}`)
            .then(r => r.ok ? r.json() : [])
            .then(rows => setPagamentos(Array.isArray(rows) ? rows : []))
            .catch(() => {})
          // Carrega categorias de RECEITA para o modal de registrar pagamento
          fetch('/api/financeiro/categorias?tipo=RECEITA')
            .then(r => r.ok ? r.json() : [])
            .then(rows => setCategoriasPag(Array.isArray(rows) ? rows : []))
            .catch(() => {})
        }
        setForm({
          numero:       p.numero || '',
          destinatario: p.destinatario || '',
          idCliente:    p.idCliente || '',
          clienteId:    (p as any).clienteId || '',
          canal:        p.canal || '',
          produto:      p.produto || '',
          quantidade:   p.quantidade || 1,
          valor:        p.valor ? String(p.valor) : '',
          dataEntrada:  p.dataEntrada ? p.dataEntrada.split('T')[0] : '',
          dataEnvio:    p.dataEnvio ? p.dataEnvio.split('T')[0] : '',
          observacoes:  p.observacoes || '',
          prioridade:   p.prioridade || 'NORMAL',
          endereco:     p.endereco || '',
          status:       p.status || 'ABERTO',
        })
        // CORRIGIDO Bug #8 + Bug #5:
        // 1. Inicializa TODOS os campos ativos com string vazia (novos campos aparecem no form)
        // 2. Sobrescreve com valores existentes EXCLUINDO chaves _internas (_freelancers, etc.)
        const camposAtivos = (resCampos.campos || []).filter((c: any) => c.ativo)
        const extrasLimpos: Record<string, string> = {}
        camposAtivos.forEach((c: any) => { extrasLimpos[c.nome] = '' })
        if (p.camposExtras) {
          try {
            const parsed = JSON.parse(p.camposExtras)
            Object.entries(parsed)
              .filter(([k]) => !k.startsWith('_') || k.startsWith('_setor_'))
              .forEach(([k, v]) => { extrasLimpos[k] = String(v) })
          } catch {}
        }
        setCamposExtrasForm(extrasLimpos)
        // Monta itensPedido a partir do texto salvo e tenta reconectar à variação
        if (p.produto) {
          const vList: any[] = Array.isArray(varLista) ? varLista : []

          // Carrega demandas já vinculadas a este pedido
          let demandasExistentes: any[] = []
          try {
            const rDem = await fetch(`/api/demandas?pedidoId=${id}`)
            if (rDem.ok) demandasExistentes = await rDem.json()
          } catch {}

          // Lê vínculos de freelancer salvos no camposExtras
          let extrasObj: any = {}
          try { if (p.camposExtras) extrasObj = JSON.parse(p.camposExtras) } catch {}
          const freelancerMap: Record<string, string> = extrasObj._freelancers || {}

          // Função auxiliar — conecta um item ao catálogo de variações e ao freelancer
          // valorSalvo: valor unitário persistido em camposExtras.produtos (usado p/ item manual)
          const conectarItem = (nome: string, qtd: number, valorSalvo?: number | null): ItemPedido => {
            const v = vList.find((vv: any) => {
              const fmtOld = `${vv.produtoNome} · ${vv.canal} · ${vv.tipo}${vv.subOpcao ? ' · ' + vv.subOpcao : ''}`
              const fmtNew = (vv as any).nome ? `${vv.produtoNome} — ${(vv as any).nome}` : ''
              return fmtOld === nome || (fmtNew !== '' && fmtNew === nome)
            })
            if (v) {
              const custo = Number(v.custoMaoObra) || 0
              const flId = freelancerMap[v.id]
                || demandasExistentes.find((d: any) => d.variacaoId === v.id || d.nomeProduto === nome)?.freelancerId
                || ''
              return {
                _key: Math.random().toString(36).slice(2),
                variacaoId: v.id,
                nomeProduto: nome,
                quantidade: qtd,
                custoMaoObra: custo,
                freelancerDemandaId: flId,
                valorFreelancer: custo,
                valorItem: Number(v.precoVenda) || 0,
              }
            }
            // Item manual (sem variação no catálogo): repuxa o valor unitário salvo
            const item = novoItemEdit(nome, qtd)
            const vSalvo = Number(valorSalvo)
            if (Number.isFinite(vSalvo) && vSalvo > 0) item.valorItem = vSalvo
            return item
          }

          // Prefere camposExtras.produtos quando disponível
          // (evita split ambíguo: nomes de produto podem conter " + " como parte do nome)
          const produtosJson: any[] = Array.isArray(extrasObj.produtos)
            ? extrasObj.produtos.filter((pp: any) => pp && pp.nome)
            : []

          let partes: ItemPedido[]
          if (produtosJson.length > 0) {
            // Caminho correto: usa lista estruturada do camposExtras
            partes = produtosJson.map((pp: any) =>
              conectarItem(String(pp.nome).trim(), Number(pp.quantidade) || 1, pp.valorUnitario)
            )
          } else {
            // Fallback: split por " + " para pedidos criados antes desta versão
            partes = p.produto.split(' + ').map((parte: string) => {
              const m = parte.match(/^(.+?)(?:\s+\((\d+)x\))?$/)
              const nome = m ? m[1].trim() : parte.trim()
              const qtd  = m && m[2] ? parseInt(m[2]) : 1
              return conectarItem(nome, qtd)
            })
          }
          setItensPedido(partes.length > 0 ? partes : [novoItemEdit()])
        }
      }

      setCamposPedido((resCampos.campos || []).filter((c: any) => c.ativo))

      // Carrega histórico de setores + eventos
      try {
        const resHist = await fetch(`/api/producao/historico/${id}`)
        if (resHist.ok) {
          const dataHist = await resHist.json()
          // fluxo = array de SetorHistorico para renderizar o fluxo visual
          setSetorHist(dataHist.fluxo || (Array.isArray(dataHist) ? dataHist : []))
          // historico = lista de eventos (criação, edições, workflow, cancelamento)
          setHistoricoEventos(Array.isArray(dataHist.historico) ? dataHist.historico : [])
        }
      } catch {}

      // Carrega demandas vinculadas
      try {
        const resDem = await fetch(`/api/demandas?pedidoId=${id}`)
        if (resDem.ok) {
          const dataDem = await resDem.json()
          setDemandas(Array.isArray(dataDem) ? dataDem : [])
        }
      } catch {}

    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // Carrega os ids ordenados do filtro de origem (guardado pela lista em sessionStorage)
  // para permitir a navegação próximo/anterior sem voltar à lista. Fallback: todos os pedidos.
  useEffect(() => {
    let cancel = false
    ;(async () => {
      let q = ''
      try { const raw = sessionStorage.getItem('pedidosNav'); if (raw) q = JSON.parse(raw).q || '' } catch {}
      try {
        const r = await fetch(`/api/producao/pedidos?${q}${q ? '&' : ''}onlyIds=1`)
        if (r.ok) { const d = await r.json(); if (!cancel && Array.isArray(d.ids)) setNavIds(d.ids) }
      } catch { /* navegação indisponível — botões ficam ocultos */ }
    })()
    return () => { cancel = true }
  }, [])

  // Vizinhos no conjunto filtrado
  const navIdx = navIds.indexOf(id)
  const prevPedidoId = navIdx > 0 ? navIds[navIdx - 1] : null
  const nextPedidoId = navIdx >= 0 && navIdx < navIds.length - 1 ? navIds[navIdx + 1] : null

  // Setas ← → navegam entre pedidos do filtro — desativadas ao digitar, editar ou com modal aberto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editando || modalPag || demandarModal || imagemAmpliada) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      if (e.key === 'ArrowLeft' && prevPedidoId) { e.preventDefault(); router.push(`/dashboard/pedidos/${prevPedidoId}`) }
      else if (e.key === 'ArrowRight' && nextPedidoId) { e.preventDefault(); router.push(`/dashboard/pedidos/${nextPedidoId}`) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevPedidoId, nextPedidoId, editando, modalPag, demandarModal, imagemAmpliada, router])

  // Tarefas vinculadas a este pedido (módulo Tarefas — reverso)
  useEffect(() => {
    if (!id) return
    fetch(`/api/tarefas/por-referencia?tipo=pedido&referenciaId=${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setTarefasVinc(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [id])

  // Endereços do cliente vinculado — para a ação "Usar endereço do cliente".
  // EDIÇÃO: NÃO auto-preenche (só disponibiliza o botão); não sobrescreve no escuro.
  useEffect(() => {
    if (!moduloClientes || !form.clienteId) { setCliEnderecos([]); setEndSelId(''); return }
    let cancel = false
    fetch(`/api/clientes/${form.clienteId}`).then(r => r.ok ? r.json() : null).then((d: any) => {
      if (cancel || !d) return
      const ends = d.enderecos || []
      setCliEnderecos(ends)
      const pr = ends.find((x: any) => x.principal) || ends[0]
      setEndSelId(pr?.id || '')
    }).catch(() => {})
    return () => { cancel = true }
  }, [form.clienteId, moduloClientes])

  function adicionarItemEdit() { setItensPedido(p => [...p, novoItemEdit()]) }
  function removerItemEdit(key: string) { setItensPedido(p => p.filter(i => i._key !== key)) }
  function atualizarItemEdit(key: string, changes: Partial<ItemPedido>) {
    setItensPedido(prev => {
      const novos = prev.map(i => i._key === key ? { ...i, ...changes } : i)
      // Recalcula valor total sempre que qtd ou valorItem muda
      if ('quantidade' in changes || 'valorItem' in changes) {
        const total = novos.reduce((acc, it) => acc + (it.valorItem * it.quantidade), 0)
        if (total > 0) setForm(p => ({ ...p, valor: total.toFixed(2) }))
      }
      return novos
    })
  }
  async function handleSelectVariacaoItemEdit(key: string, variacaoId: string) {
    const v = variacoes.find(x => x.id === variacaoId)
    const nomeProduto = v ? ((v as any).nome ? `${v.produtoNome} — ${(v as any).nome}` : `${v.produtoNome} · ${v.canal} · ${v.tipo}${v.subOpcao ? ' · ' + v.subOpcao : ''}`) : ''
    const custoMao2   = v ? Number(v.custoMaoObra) : 0
    const valorItem   = v ? Number(v.precoVenda)   : 0
    const isKit       = v ? (v.isKit ?? false) : false
    const qtdKitPecas = isKit ? Math.max(Number(v?.qtdKit) || 1, 1) : 0
    const novos = itensPedido.map(i => i._key === key ? { ...i, variacaoId, nomeProduto, custoMaoObra: custoMao2, freelancerDemandaId: '', valorFreelancer: custoMao2, valorItem, isKit, qtdKitPecas, quantidade: 1 } : i)
    setItensPedido(novos)
    // Recalcular valor total
    const total = novos.reduce((acc, it) => acc + (it.valorItem * it.quantidade), 0)
    if (total > 0) setForm(p => ({ ...p, valor: total.toFixed(2) }))
    if (variacaoId) {
      try {
        const res = await fetch(`/api/demandas/config-pagamento?variacaoId=${variacaoId}`)
        const data = await res.json()
        if (data.valorPorItem) atualizarItemEdit(key, { valorFreelancer: Number(data.valorPorItem) })
      } catch {}
    }
  }

  async function registrarPagamento() {
    if (!pedido || !formPag.valor || !formPag.descricao) return
    setSalvandoPag(true)
    try {
      const res = await fetch('/api/financeiro/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'RECEITA',
          descricao: formPag.descricao,
          valor: parseFloat(formPag.valor),
          data: formPag.data,
          status: formPag.status,
          observacoes: formPag.observacoes || null,
          referencia: pedido.numero,
          canal: pedido.canal || 'Direta',
          categoriaId: formPag.categoriaId || null,
        }),
      })
      if (res.ok) {
        const novo = await res.json()
        setPagamentos(prev => [novo, ...prev])
        setModalPag(false)
        setFormPag({ descricao: '', valor: '', data: new Date().toISOString().split('T')[0], status: 'PENDENTE', observacoes: '', categoriaId: '' })
      }
    } finally { setSalvandoPag(false) }
  }

  async function handleSalvar() {
    setSalvando(true); setErro('')
    try {
      const produtoTexto = itensPedido.filter(i => i.nomeProduto).map(i => `${i.nomeProduto}${i.quantidade > 1 ? ` (${i.quantidade}x)` : ''}`).join(' + ')
      const qtdTotal  = itensPedido.filter(i => i.nomeProduto).reduce((s, i) => s + (i.isKit && i.qtdKitPecas ? i.quantidade * i.qtdKitPecas : i.quantidade), 0)
      const qtdSku    = itensPedido.filter(i => i.nomeProduto).length || null
      // Salva mapa variacaoId→freelancerId no camposExtras para persistir o vínculo
      const freelancerMap: Record<string, string> = {}
      itensPedido.forEach(i => { if (i.variacaoId && i.freelancerDemandaId) freelancerMap[i.variacaoId] = i.freelancerDemandaId })
      // Persiste produtos[] no camposExtras para evitar split por " + " no próximo carregamento
      const produtosParaSalvar = itensPedido.filter(i => i.nomeProduto).map(i => ({
        nome: i.nomeProduto,
        quantidade: i.isKit && i.qtdKitPecas ? i.quantidade * i.qtdKitPecas : i.quantidade,
        valorUnitario: i.valorItem || null,
      }))
      const extrasComFreelancer = { ...camposExtrasForm, _freelancers: freelancerMap, produtos: produtosParaSalvar }
      const res = await fetch(`/api/producao/pedidos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          produto:     produtoTexto || form.produto,
          quantidade:  qtdTotal || parseInt(String(form.quantidade)),
          quantidadeSku: qtdSku,
          valor:       form.valor ? parseFloat(form.valor) : null,
          camposExtras: extrasComFreelancer,
        }),
      })
      if (!res.ok) { const data = await res.json(); setErro(data.error || 'Erro ao salvar'); return }
      // Cria demandas — evita duplicatas verificando existentes
      const itensComFreelancer = itensPedido.filter(i => i.freelancerDemandaId && i.custoMaoObra > 0)
      let demandasCriadas = 0
      if (itensComFreelancer.length > 0) {
        let demandasAtuais: any[] = []
        try { const rE = await fetch('/api/demandas?pedidoId=' + id); if (rE.ok) demandasAtuais = await rE.json() } catch {}
        for (const item of itensComFreelancer) {
          const jaExiste = demandasAtuais.some((d: any) =>
            d.freelancerId === item.freelancerDemandaId &&
            (d.variacaoId === item.variacaoId || d.nomeProduto === item.nomeProduto)
          )
          if (jaExiste) { demandasCriadas++; continue }
          try {
            const resDem = await fetch('/api/demandas', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pedidoId:      id,
                freelancerId:  item.freelancerDemandaId,
                variacaoId:    item.variacaoId || null,
                nomeProduto:   item.nomeProduto,
                qtdSolicitada: item.quantidade,
                valorPorItem:  item.valorFreelancer,
                status: 'PENDENTE',
              }),
            })
            if (resDem.ok) demandasCriadas++
            else { const txt = await resDem.text(); console.error('[demanda]', txt) }
          } catch (e) { console.error('[demanda create]', e) }
        }
      }
      setEditando(false)
      ok(demandasCriadas > 0
        ? `Pedido atualizado + ${demandasCriadas} trabalho${demandasCriadas > 1 ? 's' : ''} criado${demandasCriadas > 1 ? 's' : ''}!`
        : 'Pedido atualizado!')
      carregar()
    } finally { setSalvando(false) }
  }

  async function moverParaSetor() {
    if (!setorMover || !id) return
    setMovendoSetor(true)
    try {
      await fetch('/api/producao/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: id,
          devolver: true,
          setorDestinoId: setorMover,
          motivo: 'Movido manualmente via tela do pedido',
        }),
      })
      setSetorMover('')
      ok('Pedido movido para o setor!')
      carregar()
    } catch { }
    finally { setMovendoSetor(false) }
  }

  async function handleIniciar() {
    const res = await fetch('/api/producao/workflow', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedidoId: id }),
    })
    if (res.ok) { ok('Produção iniciada!'); carregar() }
  }

  async function handleCancelar() {
    if (!confirm('Cancelar este pedido?')) return
    const res = await fetch(`/api/producao/pedidos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELADO' }),
    })
    if (res.ok) { ok('Pedido cancelado.'); carregar() }
  }

  async function handleConcluir() {
    if (!confirm('Marcar como concluído?')) return
    const res = await fetch(`/api/producao/pedidos/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONCLUIDO' }),
    })
    if (res.ok) { ok('Pedido concluído!'); carregar() }
  }

  async function marcarPagamento(status: 'pago' | 'aguardando') {
    const res = await fetch(`/api/producao/pedidos/${id}/pagamento`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { ok(status === 'pago' ? 'Pagamento confirmado!' : 'Pagamento reaberto.'); carregar() }
  }

  function ok(msg: string) { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }

  const isAdmin        = session?.user?.role === 'ADMIN'
  const podeEditar     = !!session?.user
  const podeMoverSetor = session?.user?.role === 'ADMIN' || session?.user?.role === 'DELEGADOR'

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Carregando pedido...</div>
  )

  if (!pedido) return (
    <div className="p-8 text-center">
      <p className="text-gray-400 mb-4">Pedido não encontrado.</p>
      <button onClick={() => router.back()} className="text-orange-500 underline">Voltar</button>
    </div>
  )

  const statusCfg = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.ABERTO
  const prioCfg   = PRIO_CONFIG[pedido.prioridade] || PRIO_CONFIG.NORMAL
  const extras    = pedido.camposExtras ? (() => { try { return JSON.parse(pedido.camposExtras!) } catch { return {} } })() : {}

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard/pedidos')}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />Pedidos
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-mono text-orange-400">#{pedido.numero}</span>

          {navIdx >= 0 && navIds.length > 1 && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => prevPedidoId && router.push(`/dashboard/pedidos/${prevPedidoId}`)}
                disabled={!prevPedidoId}
                title="Pedido anterior (←)"
                className="flex items-center justify-center w-7 h-7 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400 tabular-nums">{navIdx + 1}/{navIds.length}</span>
              <button
                onClick={() => nextPedidoId && router.push(`/dashboard/pedidos/${nextPedidoId}`)}
                disabled={!nextPedidoId}
                title="Próximo pedido (→)"
                className="flex items-center justify-center w-7 h-7 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Imprimir Pedido */}
            <a
              href={`/dashboard/pedidos/${pedido.id}/print`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />Imprimir Pedido
            </a>
            {/* Ações de status */}
            {pedido.status === 'ABERTO' && podeEditar && (
              <button onClick={handleIniciar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Play className="w-3.5 h-3.5" />Iniciar produção
              </button>
            )}
            {pedido.status !== 'CANCELADO' && pedido.status !== 'CONCLUIDO' && isAdmin && (
              <button onClick={handleCancelar}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors">
                <XCircle className="w-3.5 h-3.5" />Cancelar pedido
              </button>
            )}
            <button onClick={() => router.push('/dashboard/pedidos')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition-colors">
              <X className="w-3.5 h-3.5" />Sair
            </button>
            {podeEditar && !editando && (
              <button onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
                <Pencil className="w-3.5 h-3.5" />Editar
              </button>
            )}
            {editando && (
              <>
                <button onClick={() => { setEditando(false); setErro('') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors">
                  <X className="w-3.5 h-3.5" />Cancelar
                </button>
                <button onClick={handleSalvar} disabled={salvando}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                  <Save className="w-3.5 h-3.5" />{salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </>
            )}
          </div>
        </div>

        {sucesso && (
          <div className="bg-green-500/20 border border-green-500/40 rounded-lg px-4 py-3 mb-4 text-sm text-green-300">
            ✓ {sucesso}
          </div>
        )}
        {erro && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-3 mb-4 text-sm text-red-300">
            {erro}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Coluna principal ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Card dados do pedido */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" />Dados do Pedido
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.cor}`}>
                    {statusCfg.label}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${prioCfg.cor}`}>
                    {prioCfg.label}
                  </span>
                </div>
              </div>

              {!editando ? (
                /* ── Modo visualização ── */
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Nº do pedido</p>
                    <p className="text-gray-900 dark:text-white font-mono font-medium">{pedido.numero}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Canal de venda</p>
                    <p className="text-gray-300">{pedido.canal || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Cliente / Destinatário</p>
                    <p className="text-gray-900 dark:text-white font-medium">{pedido.destinatario}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">ID na plataforma</p>
                    <p className="text-gray-300">{pedido.idCliente || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Produto(s)</p>
                    <p className="text-gray-300">{pedido.produto}</p>
                  </div>
                  {pedido.endereco && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Endereço</p>
                      <p className="text-gray-300">{pedido.endereco}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Quantidade</p>
                    <p className="text-gray-900 dark:text-white font-bold text-lg">{pedido.quantidade}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Valor</p>
                    <p className="text-green-400 font-bold text-lg">{fmtR(pedido.valor)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Data de entrada</p>
                    <p className="text-gray-300">{fmtDate(pedido.dataEntrada)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Data de envio</p>
                    <p className="text-gray-300">{fmtDate(pedido.dataEnvio)}</p>
                  </div>
                  {pedido.observacoes && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Observações</p>
                      <p className="text-gray-300">{pedido.observacoes}</p>
                    </div>
                  )}
                  {/* Campos extras */}
                  {Object.entries(extras).filter(([nome]) => !nome.startsWith('_')).map(([nome, valor]) => (
                    <div key={nome}>
                      <p className="text-xs text-gray-500 mb-0.5">{nome}</p>
                      {String(valor).startsWith('data:image') ? (
                        <div>
                          <img src={String(valor)} alt={nome}
                            onClick={() => setImagemAmpliada(String(valor))}
                            className="max-h-24 max-w-[160px] rounded-lg border border-gray-700 object-contain cursor-zoom-in hover:opacity-80 transition" />
                          <p className="text-xs text-orange-400 mt-1">🔍 Clique para ampliar</p>
                        </div>
                      ) : (
                        <p className="text-orange-300 font-medium">{String(valor)}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Modo edição ── */
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nº do pedido *</label>
                    <input className={inputClass} value={form.numero}
                      onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Canal de venda</label>
                    <select className={inputClass} value={form.canal}
                      onChange={e => setForm(p => ({ ...p, canal: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {moduloClientes && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Cliente (CRM)</label>
                      <select className={inputClass} value={form.clienteId}
                        onChange={e => {
                          const cid = e.target.value
                          const nome = clientesLista.find(c => c.id === cid)?.nome || ''
                          setForm(p => ({ ...p, clienteId: cid, destinatario: p.destinatario || nome }))
                        }}>
                        <option value="">— Sem cliente vinculado —</option>
                        {clientesLista.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  )}
                  {moduloClientes && form.clienteId && cliEnderecos.length > 0 && (
                    <div className="col-span-2 flex flex-wrap items-center gap-2 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-lg px-3 py-2">
                      <span className="text-xs text-orange-700 dark:text-orange-400">Endereço do cliente:</span>
                      {cliEnderecos.length > 1 && (
                        <select value={endSelId} onChange={e => setEndSelId(e.target.value)} className="text-xs border border-orange-200 rounded px-2 py-1 bg-white dark:bg-gray-800">
                          {cliEnderecos.map((x: any) => <option key={x.id} value={x.id}>{(x.apelido || fmtEnderecoCliente(x))}{x.principal ? ' (principal)' : ''}</option>)}
                        </select>
                      )}
                      <button type="button" onClick={() => {
                          const en = cliEnderecos.find((x: any) => x.id === endSelId) || cliEnderecos[0]
                          const nome = clientesLista.find(c => c.id === form.clienteId)?.nome || form.destinatario
                          setForm(p => ({ ...p, destinatario: nome, endereco: fmtEnderecoCliente(en) }))
                        }} className="text-xs font-medium text-orange-600 bg-white dark:bg-gray-800 border border-orange-200 hover:bg-orange-100 px-2.5 py-1 rounded-lg">
                        Usar endereço do cliente
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cliente / Destinatário *</label>
                    <input className={inputClass} value={form.destinatario}
                      onChange={e => setForm(p => ({ ...p, destinatario: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">ID na plataforma</label>
                    <input className={inputClass} value={form.idCliente}
                      onChange={e => setForm(p => ({ ...p, idCliente: e.target.value }))}
                      placeholder="Ex: shopee_user123" />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-gray-400">Produto(s)</label>
                      <button type="button" onClick={adicionarItemEdit} className="text-xs text-orange-400 hover:text-orange-300">+ Adicionar</button>
                    </div>
                    <div className="space-y-2">
                      {itensPedido.map((item, idx) => (
                        <div key={item._key} className="border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/60">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">Produto {idx + 1}</span>
                            {itensPedido.length > 1 && <button type="button" onClick={() => removerItemEdit(item._key)} className="text-xs text-red-400 hover:text-red-300">✕</button>}
                          </div>
                          {variacoes.length > 0 && (
                            <select value={item.variacaoId} onChange={e => handleSelectVariacaoItemEdit(item._key, e.target.value)} className={inputClass + ' mb-2'}>
                              <option value="">{variacoes.length === 0 ? 'Carregando...' : 'Selecionar da Precificação...'}</option>
                              {variacoes.map(v => {
                                const label = (v as any).nome ? `${v.produtoNome} — ${(v as any).nome}` : `${v.produtoNome} · ${v.canal} · ${v.tipo}${v.subOpcao ? ' · ' + v.subOpcao : ''}`
                                return <option key={v.id} value={v.id}>{label}{v.custoMaoObra > 0 ? ' 👤' : ''}</option>
                              })}
                            </select>
                          )}
                          <input type="text" value={item.nomeProduto} onChange={e => atualizarItemEdit(item._key, { nomeProduto: e.target.value, variacaoId: '' })} className={inputClass + ' mb-2'} placeholder="Ou descreva manualmente..." />
                          <div className="flex gap-2 flex-wrap">
                            <div className="flex-1 min-w-24">
                              <label className="text-xs text-gray-500 block mb-1">
                                {item.isKit ? 'Qtd. de SKUs' : 'Qtd.'}
                              </label>
                              <input
                                type="number" min="1" inputMode="numeric"
                                value={qtdStr[item._key] ?? String(item.quantidade)}
                                onChange={e => {
                                  setQtdStr(p => ({ ...p, [item._key]: e.target.value }))
                                  const n = parseInt(e.target.value)
                                  if (n >= 1) atualizarItemEdit(item._key, { quantidade: n })
                                }}
                                onBlur={e => {
                                  const n = parseInt(e.target.value) || 1
                                  atualizarItemEdit(item._key, { quantidade: n })
                                  setQtdStr(p => ({ ...p, [item._key]: String(n) }))
                                }}
                                className={inputClass} />
                            </div>
                            {item.isKit && item.qtdKitPecas ? (
                              <div className="flex-1 min-w-24">
                                <label className="text-xs text-gray-500 block mb-1">Peças por kit</label>
                                <div className={inputClass + ' bg-gray-50 dark:bg-gray-700 text-gray-500 cursor-not-allowed'}>
                                  {item.qtdKitPecas} <span className="text-xs text-gray-400">fixo</span>
                                </div>
                              </div>
                            ) : null}
                            {item.isKit && item.qtdKitPecas && item.quantidade > 1 ? (
                              <div className="flex-1 min-w-24">
                                <label className="text-xs text-gray-500 block mb-1">Total de peças</label>
                                <div className={inputClass + ' bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-semibold cursor-not-allowed'}>
                                  {item.quantidade * item.qtdKitPecas} peças
                                </div>
                              </div>
                            ) : null}
                            <div className="flex-1 min-w-24">
                              <label className="text-xs text-gray-500 block mb-1">
                                {item.isKit ? 'Valor do kit (R$)' : 'Valor unit. (R$)'}
                              </label>
                              <input type="number" step="0.01" min="0" value={item.valorItem || ''} onChange={e => atualizarItemEdit(item._key, { valorItem: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0,00" />
                            </div>
                            {item.valorItem > 0 && item.quantidade > 1 && (
                              <div className="flex-shrink-0 flex items-end pb-2">
                                <span className="text-xs text-orange-400 font-semibold whitespace-nowrap">= {fmtR(item.valorItem * item.quantidade)}</span>
                              </div>
                            )}
                            {moduloDemandas && item.custoMaoObra > 0 && freelancers.length > 0 && (
                              <div className="flex-1">
                                <label className="text-xs text-orange-400 block mb-1">👤 Freelancer</label>
                                <select value={item.freelancerDemandaId} onChange={e => atualizarItemEdit(item._key, { freelancerDemandaId: e.target.value })} className={inputClass + ' border-orange-600'}>
                                  <option value="">Sem freelancer</option>
                                  {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}{f.especialidade ? ` — ${f.especialidade}` : ''}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          {item.freelancerDemandaId && item.custoMaoObra > 0 && (
                            <div className="mt-2 flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5">
                              <span className="text-xs text-orange-300">
                                Demanda · {item.quantidade}x · R$ {item.valorFreelancer.toFixed(2)}/item
                              </span>
                              <span className="text-xs font-bold text-orange-400">
                                R$ {(item.valorFreelancer * item.quantidade).toFixed(2)} a pagar
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Subtotal calculado */}
                    {itensPedido.some(i => i.valorItem > 0) && (
                      <div className="flex justify-end mt-2">
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5 text-sm">
                          <span className="text-gray-500 text-xs">Total: </span>
                          <span className="font-bold text-orange-400">
                            {fmtR(itensPedido.reduce((acc, it) => acc + (it.valorItem * it.quantidade), 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Endereço de entrega</label>
                    <input className={inputClass} value={form.endereco}
                      onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))}
                      placeholder="Opcional" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantidade</label>
                    {itensPedido.length > 0 && itensPedido.some(i => i.nomeProduto) ? (
                      <div className={inputClass + " bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-300 cursor-not-allowed"}>
                        {itensPedido.reduce((s, i) => s + i.quantidade, 0)}
                        <span className="text-xs text-gray-400 ml-2">(soma dos itens)</span>
                      </div>
                    ) : (
                      <input type="number" min="1" inputMode="numeric" className={inputClass} value={form.quantidade}
                        onChange={e => setForm(p => ({ ...p, quantidade: e.target.value === '' ? 1 : Number(e.target.value) }))}
                        onBlur={e => { if (!e.target.value || Number(e.target.value) < 1) setForm(p => ({ ...p, quantidade: 1 })) }} />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Valor (R$)</label>
                    {itensPedido.some(i => i.valorItem > 0) ? (
                      <div className={inputClass + " bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-300 cursor-not-allowed"}>
                        R$ {itensPedido.reduce((s, i) => s + (i.valorItem * i.quantidade), 0).toFixed(2)}
                        <span className="text-xs text-gray-400 ml-2">(soma dos itens)</span>
                      </div>
                    ) : (
                      <input type="number" step="0.01" min="0" className={inputClass} value={form.valor}
                        onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                        placeholder="0,00" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Data de entrada</label>
                    <input type="date" className={inputClass} value={form.dataEntrada}
                      onChange={e => setForm(p => ({ ...p, dataEntrada: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Data de envio</label>
                    <input type="date" className={inputClass} value={form.dataEnvio}
                      onChange={e => setForm(p => ({ ...p, dataEnvio: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                    <select className={inputClass} value={form.prioridade}
                      onChange={e => setForm(p => ({ ...p, prioridade: e.target.value }))}>
                      <option value="BAIXA">Baixa</option>
                      <option value="NORMAL">Normal</option>
                      <option value="ALTA">Alta</option>
                      <option value="URGENTE">Urgente</option>
                    </select>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Status</label>
                      <select className={inputClass} value={form.status}
                        onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                        <option value="ABERTO">Aberto</option>
                        <option value="EM_PRODUCAO">Em produção</option>
                        <option value="CONCLUIDO">Concluído</option>
                        <option value="CANCELADO">Cancelado</option>
                      </select>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Observações</label>
                    <textarea className={inputClass + ' resize-none'} rows={2} value={form.observacoes}
                      onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                      placeholder="Instruções especiais..." />
                  </div>
                  {/* Campos personalizados */}
                  {camposPedido.map(campo => (
                    <div key={campo.id}>
                      <label className="block text-xs text-gray-400 mb-1">{campo.nome}</label>
                      {campo.tipo === 'lista' && campo.opcoes ? (
                        <select className={inputClass}
                          value={camposExtrasForm[campo.nome] || ''}
                          onChange={e => setCamposExtrasForm(p => ({ ...p, [campo.nome]: e.target.value }))}>
                          <option value="">Selecione...</option>
                          {JSON.parse(campo.opcoes).map((op: string) => <option key={op} value={op}>{op}</option>)}
                        </select>
                      ) : campo.tipo === 'checkbox' ? (
                        <label className="flex items-center gap-2 cursor-pointer mt-1">
                          <input type="checkbox"
                            checked={camposExtrasForm[campo.nome] === 'true'}
                            onChange={e => setCamposExtrasForm(p => ({ ...p, [campo.nome]: String(e.target.checked) }))}
                            className="accent-orange-500 w-4 h-4" />
                          <span className="text-sm text-gray-300">Sim</span>
                        </label>
                      ) : campo.tipo === 'data' ? (
                        <input type="date" className={inputClass}
                          value={camposExtrasForm[campo.nome] || ''}
                          onChange={e => setCamposExtrasForm(p => ({ ...p, [campo.nome]: e.target.value }))} />
                      ) : campo.tipo === 'imagem' ? (
                        <div>
                          {camposExtrasForm[campo.nome]?.startsWith('data:image') ? (
                            <div className="relative">
                              <a href={camposExtrasForm[campo.nome]} target="_blank" rel="noopener noreferrer">
                                <img src={camposExtrasForm[campo.nome]} alt={campo.nome}
                                  className="max-h-24 max-w-[160px] rounded-lg border border-gray-600 object-contain hover:opacity-80 transition cursor-pointer" />
                              </a>
                              <button type="button"
                                onClick={() => setCamposExtrasForm(p => ({ ...p, [campo.nome]: '' }))}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                                <X size={10} />
                              </button>
                              <p className="text-xs text-gray-500 mt-1">Clique na imagem para ampliar</p>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 border border-dashed border-gray-600 rounded-lg px-3 py-2.5 cursor-pointer hover:border-orange-500 hover:bg-orange-500/5 transition">
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
                                  reader.onload = () => setCamposExtrasForm(p => ({ ...p, [campo.nome]: reader.result as string }))
                                  reader.readAsDataURL(file)
                                  e.target.value = ''
                                }} />
                            </label>
                          )}
                        </div>
                      ) : (
                        <input type={campo.tipo === 'numero' ? 'number' : 'text'}
                          className={inputClass}
                          value={camposExtrasForm[campo.nome] || ''}
                          onChange={e => setCamposExtrasForm(p => ({ ...p, [campo.nome]: e.target.value }))}
                          placeholder={campo.placeholder || ''} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Campos personalizados POR SETOR ── */}
            {Object.keys(setorCamposPorSetor).length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <span className="text-orange-500">📋</span>
                  Campos por Setor
                </h2>
                <div className="space-y-5">
                  {allSetores.filter((s: any) => setorCamposPorSetor[s.id]?.length > 0).map((setor: any) => (
                    <div key={setor.id}>
                      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">{setor.nome}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {setorCamposPorSetor[setor.id].map(campo => {
                          const chave = `_setor_${setor.id}_${campo.nome}`
                          return (
                            <div key={campo.id}>
                              <label className="block text-xs text-gray-400 mb-1">{campo.nome}</label>
                              {campo.tipo === 'lista' && campo.opcoes ? (
                                <select className={inputClass}
                                  value={camposExtrasForm[chave] || ''}
                                  onChange={e => setCamposExtrasForm(p => ({ ...p, [chave]: e.target.value }))}>
                                  <option value="">Selecione...</option>
                                  {(() => { try { return JSON.parse(campo.opcoes!).map((op: string) => <option key={op} value={op}>{op}</option>) } catch { return null } })()}
                                </select>
                              ) : campo.tipo === 'checkbox' ? (
                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                  <input type="checkbox"
                                    checked={camposExtrasForm[chave] === 'true'}
                                    onChange={e => setCamposExtrasForm(p => ({ ...p, [chave]: String(e.target.checked) }))}
                                    className="accent-orange-500 w-4 h-4" />
                                  <span className="text-sm text-gray-300">Sim</span>
                                </label>
                              ) : campo.tipo === 'data' ? (
                                <input type="date" className={inputClass}
                                  value={camposExtrasForm[chave] || ''}
                                  onChange={e => setCamposExtrasForm(p => ({ ...p, [chave]: e.target.value }))} />
                              ) : (
                                <input type={campo.tipo === 'numero' ? 'number' : 'text'}
                                  className={inputClass}
                                  value={camposExtrasForm[chave] || ''}
                                  onChange={e => setCamposExtrasForm(p => ({ ...p, [chave]: e.target.value }))}
                                  placeholder={campo.placeholder || campo.nome} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Demandas vinculadas ── */}
            {moduloDemandas && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    Trabalhos de Freelancer
                    <span className="text-xs text-gray-500 font-normal">({demandas.length})</span>
                  </h2>
                  {session?.user?.role !== 'OPERADOR' && (
                    <button onClick={() => { setDemForm({ freelancerId: '', nomeProduto: '', qtdSolicitada: '1', valorPorItem: '', observacoes: '' }); setErro(''); setDemandarModal(true) }}
                      className="flex-shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                      <Users className="w-3.5 h-3.5" /> Demandar freelancer
                    </button>
                  )}
                </div>
                {demandas.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-2">Nenhum trabalho de freelancer neste pedido ainda. Use "Demandar freelancer" para criar um já vinculado.</p>
                ) : (
                <div className="space-y-3">
                  {demandas.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{d.freelancerNome}</p>
                        <p className="text-xs text-gray-400">{d.nomeProduto}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {d.qtdProduzida}/{d.qtdSolicitada} itens ·{' '}
                          {d.valorPorItem > 0 ? `R$ ${d.valorPorItem.toFixed(2)}/item` : 'Sem valor'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-semibold ${DEMANDA_STATUS[d.status] || 'text-gray-400'}`}>
                          {d.status === 'PENDENTE' ? 'Pendente'
                          : d.status === 'EM_PRODUCAO' ? 'Em produção'
                          : d.status === 'PRODUZIDO' ? 'Aguard. pagamento'
                          : 'Pago'}
                        </p>
                        {d.valorTotal > 0 && (
                          <p className="text-sm font-bold text-orange-400 mt-0.5">
                            R$ {d.valorTotal.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* ── Modal: Demandar freelancer (cria demanda vinculada em 1 passo) ── */}
            {demandarModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDemandarModal(false)}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-orange-500" /> Demandar freelancer</h2>
                    <button onClick={() => setDemandarModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
                  </div>
                  {freelancers.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Nenhum freelancer ativo cadastrado. Cadastre em Trabalhos → Freelancers primeiro.</p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Freelancer *</label>
                        <select value={demForm.freelancerId} onChange={e => setDemForm(f => ({ ...f, freelancerId: e.target.value }))} className={inputClass}>
                          <option value="">Selecione...</option>
                          {freelancers.map(f => <option key={f.id} value={f.id}>{f.nome}{f.especialidade ? ` — ${f.especialidade}` : ''}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Descrição / produto</label>
                        <input value={demForm.nomeProduto} onChange={e => setDemForm(f => ({ ...f, nomeProduto: e.target.value }))} placeholder="Ex.: Montagem de 10 laços" className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Quantidade *</label>
                          <input type="number" min={1} value={demForm.qtdSolicitada} onChange={e => setDemForm(f => ({ ...f, qtdSolicitada: e.target.value }))} className={inputClass} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Valor por item (R$)</label>
                          <input type="number" min={0} step="0.01" value={demForm.valorPorItem} onChange={e => setDemForm(f => ({ ...f, valorPorItem: e.target.value }))} placeholder="0,00" className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Observações</label>
                        <textarea value={demForm.observacoes} onChange={e => setDemForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                      </div>
                      {erro && <p className="text-xs text-red-500">{erro}</p>}
                      <button onClick={demandarFreelancer} disabled={salvandoDem || !demForm.freelancerId} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50">
                        {salvandoDem ? 'Criando...' : 'Criar demanda e vincular ao pedido'}
                      </button>
                      <p className="text-[11px] text-gray-400 text-center">A demanda aparece em Trabalhos, já vinculada a este pedido.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Coluna lateral ── */}
          <div className="space-y-5">

            {/* Fluxo de produção */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-orange-500" />Fluxo de Produção
              </h2>

              {pedido.setor_atual_nome ? (
                <div className="mb-4 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-xs text-orange-400 mb-0.5">Setor atual</p>
                  <p className="text-sm font-medium text-orange-300">{pedido.setor_atual_nome}</p>
                </div>
              ) : pedido.status === 'ABERTO' ? (
                <div className="mb-4 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">Aguardando início da produção</p>
                </div>
              ) : null}

              {/* Mover para outro setor */}
              {podeMoverSetor && allSetores.length > 0 && (
                <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-500 mb-2">🔀 Mover para outro setor</p>
                  <div className="flex gap-2">
                    <select value={setorMover} onChange={e => setSetorMover(e.target.value)}
                      className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 dark:text-white">
                      <option value="">Selecionar setor...</option>
                      {allSetores
                        .filter(s => s.id !== pedido.setor_atual_id)
                        .map(s => <option key={s.id} value={s.id}>{s.nome}</option>)
                      }
                    </select>
                    <button onClick={moverParaSetor} disabled={!setorMover || movendoSetor}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 transition">
                      {movendoSetor ? '...' : 'Mover'}
                    </button>
                  </div>
                </div>
              )}

              {setorHist.length > 0 ? (
                <div className="space-y-2">
                  {setorHist.map((s, i) => (
                    <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${s.atual ? 'bg-orange-500/10 border border-orange-500/20 dark:bg-orange-500/10' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.atual ? 'bg-orange-500' : s.saidaEm ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white font-medium">{s.setorNome}</p>
                        {s.entradaEm && <p className="text-xs text-gray-500">Entrada: {fmtDateTime(s.entradaEm)}</p>}
                        {s.saidaEm   && <p className="text-xs text-gray-500">Saída: {fmtDateTime(s.saidaEm)}</p>}
                      </div>
                      {s.atual && <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />}
                      {!s.atual && s.saidaEm && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-3">
                  {pedido.status === 'ABERTO' ? 'Inicie a produção para ver o fluxo.' : 'Sem histórico de setores.'}
                </p>
              )}
            </div>

            {/* Tarefas vinculadas (módulo Tarefas) */}
            {tarefasVinc.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                  📋 Tarefas vinculadas
                </h2>
                <div className="space-y-1.5">
                  {tarefasVinc.map((t: any) => (
                    <a key={t.id} href={`/tarefas/quadros/${t.quadroId}`}
                      className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 hover:text-orange-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                      <span className="truncate">{t.titulo}</span>
                      {t.colunaNome && <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{t.colunaNome}</span>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo financeiro */}
            {isAdmin && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />Resumo
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Valor do pedido</span>
                    <span className="text-green-400 font-medium">{fmtR(pedido.valor)}</span>
                  </div>

                  {/* Pagamento online (Loja Virtual) */}
                  {pedido.statusPagamento && pedido.statusPagamento !== 'nao_aplicavel' && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pagamento online</span>
                        {pedido.statusPagamento === 'pago' ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ Pago</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">⏳ Aguardando</span>
                        )}
                      </div>
                      {pedido.metodoPagamento && <p className="text-xs text-gray-400">Método: {pedido.metodoPagamento === 'mercadopago' ? 'Mercado Pago' : pedido.metodoPagamento === 'pix' ? 'PIX' : 'Link'}</p>}
                      {pedido.temComprovante && (
                        <a href={`/api/producao/pedidos/${pedido.id}/pagamento`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-orange-500 hover:text-orange-400 underline">Ver comprovante</a>
                      )}
                      {pedido.statusPagamento === 'pago' ? (
                        <button onClick={() => marcarPagamento('aguardando')}
                          className="text-xs text-gray-400 hover:text-gray-300 block">Desmarcar pago</button>
                      ) : (
                        <button onClick={() => marcarPagamento('pago')}
                          className="text-xs font-semibold text-white bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg transition">
                          Marcar como pago
                        </button>
                      )}
                    </div>
                  )}

                  {demandas.length > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Custo freelancers</span>
                        <span className="text-orange-400 font-medium">
                          {fmtR(demandas.reduce((s, d) => s + d.valorTotal, 0))}
                        </span>
                      </div>
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between">
                        <span className="text-gray-300 font-medium">Lucro estimado</span>
                        <span className={`font-bold ${
                          (pedido.valor || 0) - demandas.reduce((s, d) => s + d.valorTotal, 0) >= 0
                            ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {fmtR((pedido.valor || 0) - demandas.reduce((s, d) => s + d.valorTotal, 0))}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Histórico de pagamentos — canais de pagamento manual */}
                  {CANAIS_PAGAMENTO_MANUAL.includes(pedido.canal || '') && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">💰 Pagamentos</span>
                          <button onClick={() => setModalPag(true)}
                            className="text-xs text-orange-500 hover:text-orange-400 font-medium border border-orange-500/30 px-2 py-0.5 rounded-lg transition">
                            + Registrar
                          </button>
                        </div>
                        {pagamentos.length === 0 ? (
                          <p className="text-xs text-gray-600 italic">Nenhum pagamento registrado</p>
                        ) : (
                          <div className="space-y-1.5">
                            {pagamentos.map(pg => (
                              <div key={pg.id} className="flex items-center justify-between text-xs">
                                <div className="flex-1 min-w-0">
                                  <p className="text-gray-300 truncate">{pg.descricao}</p>
                                  <p className="text-gray-600">{pg.data ? pg.data.split('T')[0].split('-').reverse().join('/') : ''}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${pg.status === 'PAGO' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                                    {pg.status === 'PAGO' ? 'Pago' : 'Pendente'}
                                  </span>
                                  <span className="text-green-400 font-semibold">{fmtR(pg.valor)}</span>
                                </div>
                              </div>
                            ))}
                            <div className="border-t border-gray-700 pt-1.5 flex justify-between text-xs font-semibold">
                              <span className="text-gray-400">Total recebido</span>
                              <span className="text-green-400">{fmtR(pagamentos.filter(p => p.status === 'PAGO').reduce((s, p) => s + Number(p.valor), 0))}</span>
                            </div>
                            {(pedido.valor || 0) > 0 && (
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-gray-400">Saldo restante</span>
                                <span className={`${(pedido.valor || 0) - pagamentos.filter(p => p.status === 'PAGO').reduce((s, p) => s + Number(p.valor), 0) > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                  {fmtR((pedido.valor || 0) - pagamentos.filter(p => p.status === 'PAGO').reduce((s, p) => s + Number(p.valor), 0))}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Histórico de alterações (timeline) ─────────────────────── */}
            {historicoEventos.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <span className="text-orange-500">🕒</span>
                  Histórico do Pedido
                  <span className="text-xs text-gray-400 font-normal">({historicoEventos.length} {historicoEventos.length === 1 ? 'evento' : 'eventos'})</span>
                </h2>
                <div className="relative">
                  {/* Linha vertical da timeline */}
                  <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-gray-200 dark:bg-gray-700" />
                  <ul className="space-y-3">
                    {[...historicoEventos].reverse().map(ev => {
                      // Mapeia tipo → ícone/cor
                      const tipoMap: Record<string, { ico: string; cor: string; label: string }> = {
                        CRIACAO:   { ico: '✨', cor: 'bg-emerald-500', label: 'Criação'   },
                        EDICAO:    { ico: '✏️', cor: 'bg-blue-500',    label: 'Edição'    },
                        STATUS:    { ico: '🏷️', cor: 'bg-purple-500',  label: 'Status'    },
                        INICIADO:  { ico: '▶️', cor: 'bg-orange-500',  label: 'Iniciado'  },
                        AVANCO:    { ico: '➡️', cor: 'bg-orange-500',  label: 'Avanço'    },
                        DEVOLVIDO: { ico: '↩️', cor: 'bg-amber-500',   label: 'Devolução' },
                        PAGAMENTO: { ico: '💰', cor: 'bg-emerald-500', label: 'Pagamento' },
                      }
                      const info = tipoMap[ev.tipo] || { ico: '•', cor: 'bg-gray-400', label: ev.tipo }
                      const dataFmt = (() => {
                        try {
                          const d = new Date(ev.createdAt)
                          return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        } catch { return ev.createdAt }
                      })()
                      return (
                        <li key={ev.id} className="relative pl-8">
                          {/* Bolinha colorida na linha */}
                          <span className={`absolute left-0 top-1.5 w-4 h-4 rounded-full ${info.cor} flex items-center justify-center text-[10px] ring-4 ring-white dark:ring-gray-900`}>
                            <span className="text-white">{info.ico}</span>
                          </span>
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">{info.label}</span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-400">{dataFmt}</span>
                            {ev.usuarioNome && (
                              <>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">por <span className="font-medium text-gray-700 dark:text-gray-300">{ev.usuarioNome}</span></span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 break-words">{ev.descricao}</p>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ── Lightbox de imagem ── */}
      {imagemAmpliada && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setImagemAmpliada(null)}
        >
          <button onClick={() => setImagemAmpliada(null)}
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition">
            <X size={20} />
          </button>
          <img
            src={imagemAmpliada}
            alt="Imagem ampliada"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── MODAL REGISTRAR PAGAMENTO ── */}
      {modalPag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-orange-500 px-5 py-4">
              <p className="text-white font-bold">💰 Registrar Pagamento</p>
              <p className="text-orange-100 text-xs mt-0.5">{pedido?.numero} · {pedido?.destinatario}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Descrição *</label>
                <input type="text" value={formPag.descricao} onChange={e => setFormPag(p => ({...p, descricao: e.target.value}))}
                  placeholder="Ex: Sinal, 2ª parcela, pagamento final..."
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" value={formPag.valor} onChange={e => setFormPag(p => ({...p, valor: e.target.value}))}
                    placeholder="0,00"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Data</label>
                  <input type="date" value={formPag.data} onChange={e => setFormPag(p => ({...p, data: e.target.value}))}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Status</label>
                <select value={formPag.status} onChange={e => setFormPag(p => ({...p, status: e.target.value}))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white">
                  <option value="PAGO">✅ Pago — entra no caixa agora</option>
                  <option value="PENDENTE">⏳ Pendente — aguardando recebimento</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Categoria <span className="text-gray-400 font-normal">(opcional)</span></label>
                <select value={formPag.categoriaId} onChange={e => setFormPag(p => ({...p, categoriaId: e.target.value}))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white">
                  <option value="">— Sem categoria —</option>
                  {categoriasPag.map(c => (
                    <option key={c.id} value={c.id}>{c.icone || '📁'} {c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Observações</label>
                <input type="text" value={formPag.observacoes} onChange={e => setFormPag(p => ({...p, observacoes: e.target.value}))}
                  placeholder="Opcional"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setModalPag(false)}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancelar
              </button>
              <button onClick={registrarPagamento} disabled={salvandoPag || !formPag.valor || !formPag.descricao}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                {salvandoPag ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
