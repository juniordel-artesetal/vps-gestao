'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Pencil, Save, X, Play, CheckCircle,
  XCircle, Package, Clock, AlertTriangle, ChevronRight,
  Users, Layers, Printer,
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
  custoMaoObra: number
}
interface FreelancerItem { id: string; nome: string; especialidade: string | null }
interface ItemPedido {
  _key: string; variacaoId: string; nomeProduto: string
  quantidade: number; custoMaoObra: number
  freelancerDemandaId: string; valorFreelancer: number
}
function novoItemEdit(nome = '', qtd = 1): ItemPedido {
  return { _key: Math.random().toString(36).slice(2), variacaoId: '', nomeProduto: nome, quantidade: qtd, custoMaoObra: 0, freelancerDemandaId: '', valorFreelancer: 0 }
}
interface CampoPedido {
  id: string; nome: string; tipo: string; opcoes: string | null; placeholder: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const inputClass = "w-full border border-gray-600 rounded-lg px-3 py-2 text-sm bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400"

const CANAIS = ['Shopee', 'Mercado Livre', 'Elo7', 'Direta', 'Instagram', 'WhatsApp', 'Outros']

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

export default function PedidoDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const { data: session } = useSession()

  const [pedido, setPedido]             = useState<Pedido | null>(null)
  const [setorHist, setSetorHist]       = useState<SetorHistorico[]>([])
  const [demandas, setDemandas]         = useState<Demanda[]>([])
  const [camposPedido, setCamposPedido] = useState<CampoPedido[]>([])
  const [variacoes,    setVariacoes]    = useState<Variacao[]>([])
  const [freelancers,  setFreelancers]  = useState<FreelancerItem[]>([])
  const [moduloDemandas, setModuloDemandas] = useState(false)
  const [itensPedido,  setItensPedido]  = useState<ItemPedido[]>([novoItemEdit()])
  const [loading, setLoading]           = useState(true)
  const [editando, setEditando]         = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [sucesso, setSucesso]           = useState('')

  // Form de edição
  const [form, setForm] = useState({
    numero: '', destinatario: '', idCliente: '', canal: '', produto: '',
    quantidade: 1, valor: '', dataEntrada: '', dataEnvio: '',
    observacoes: '', prioridade: 'NORMAL', endereco: '', status: 'ABERTO',
  })
  const [camposExtrasForm, setCamposExtrasForm] = useState<Record<string, string>>({})

  const carregar = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const safe = async (url: string, fb: any) => { try { const r = await fetch(url); return r.ok ? await r.json() : fb } catch { return fb } }
      const [resPedido, resCampos, varLista, dmCfg, flLista] = await Promise.all([
        fetch(`/api/producao/pedidos/${id}`).then(r => r.json()),
        safe('/api/config/campos-pedido',   { campos: [] }),
        safe('/api/precificacao/variacoes', []),
        safe('/api/demandas/config',        { moduloDemandas: false }),
        safe('/api/demandas/freelancers',   []),
      ])
      setVariacoes(Array.isArray(varLista) ? varLista : [])
      setModuloDemandas(dmCfg.moduloDemandas ?? false)
      setFreelancers(Array.isArray(flLista) ? flLista.filter((f: any) => f.ativo) : [])

      if (resPedido.pedido || resPedido.id) {
        const p: Pedido = resPedido.pedido || resPedido
        setPedido(p)
        setForm({
          numero:       p.numero || '',
          destinatario: p.destinatario || '',
          idCliente:    p.idCliente || '',
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
        if (p.camposExtras) {
          try { setCamposExtrasForm(JSON.parse(p.camposExtras)) } catch {}
        }
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

          const partes = p.produto.split(' + ').map((parte: string) => {
            const m = parte.match(/^(.+?)(?:\s+\((\d+)x\))?$/)
            const nome = m ? m[1].trim() : parte.trim()
            const qtd  = m && m[2] ? parseInt(m[2]) : 1
            const v = vList.find((vv: any) => {
              const fmt = `${vv.produtoNome} · ${vv.canal} · ${vv.tipo}${vv.subOpcao ? ' · ' + vv.subOpcao : ''}`
              return fmt === nome
            })
            if (v) {
              const custo = Number(v.custoMaoObra) || 0
              // Freelancer: primeiro tenta do camposExtras, depois da demanda existente
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
              }
            }
            return novoItemEdit(nome, qtd)
          })
          setItensPedido(partes.length > 0 ? partes : [novoItemEdit()])
        }
      }

      setCamposPedido((resCampos.campos || []).filter((c: any) => c.ativo))

      // Carrega histórico de setores
      try {
        const resHist = await fetch(`/api/producao/historico/${id}`)
        if (resHist.ok) {
          const dataHist = await resHist.json()
          setSetorHist(Array.isArray(dataHist) ? dataHist : dataHist.historico || [])
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

  function adicionarItemEdit() { setItensPedido(p => [...p, novoItemEdit()]) }
  function removerItemEdit(key: string) { setItensPedido(p => p.filter(i => i._key !== key)) }
  function atualizarItemEdit(key: string, changes: Partial<ItemPedido>) {
    setItensPedido(prev => {
      const novos = prev.map(i => i._key === key ? { ...i, ...changes } : i)
      if ('quantidade' in changes) {
        const total = novos.reduce((acc, it) => {
          if (!it.variacaoId) return acc
          const v = variacoes.find(x => x.id === it.variacaoId)
          return acc + (v ? Number(v.precoVenda) * it.quantidade : 0)
        }, 0)
        if (total > 0) setForm(p => ({ ...p, valor: total.toFixed(2) }))
      }
      return novos
    })
  }
  async function handleSelectVariacaoItemEdit(key: string, variacaoId: string) {
    const v = variacoes.find(x => x.id === variacaoId)
    const nomeProduto = v ? `${v.produtoNome} · ${v.canal} · ${v.tipo}${v.subOpcao ? ' · ' + v.subOpcao : ''}` : ''
    const custoMao2 = v ? Number(v.custoMaoObra) : 0
    const novos = itensPedido.map(i => i._key === key ? { ...i, variacaoId, nomeProduto, custoMaoObra: custoMao2, freelancerDemandaId: '', valorFreelancer: custoMao2 } : i)
    setItensPedido(novos)
    // Recalcular valor
    const total = novos.reduce((acc, it) => {
      if (!it.variacaoId) return acc
      const vv = variacoes.find(x => x.id === it.variacaoId)
      return acc + (vv ? Number(vv.precoVenda) * it.quantidade : 0)
    }, 0)
    if (total > 0) setForm(p => ({ ...p, valor: total.toFixed(2) }))
    if (variacaoId) {
      try {
        const res = await fetch(`/api/demandas/config-pagamento?variacaoId=${variacaoId}`)
        const data = await res.json()
        if (data.valorPorItem) atualizarItemEdit(key, { valorFreelancer: Number(data.valorPorItem) })
      } catch {}
    }
  }

  async function handleSalvar() {
    setSalvando(true); setErro('')
    try {
      const produtoTexto = itensPedido.filter(i => i.nomeProduto).map(i => `${i.nomeProduto}${i.quantidade > 1 ? ` (${i.quantidade}x)` : ''}`).join(' + ')
      const qtdTotal = itensPedido.reduce((s, i) => s + i.quantidade, 0)
      // Salva mapa variacaoId→freelancerId no camposExtras para persistir o vínculo
      const freelancerMap: Record<string, string> = {}
      itensPedido.forEach(i => { if (i.variacaoId && i.freelancerDemandaId) freelancerMap[i.variacaoId] = i.freelancerDemandaId })
      const extrasComFreelancer = { ...camposExtrasForm, _freelancers: freelancerMap }
      const res = await fetch(`/api/producao/pedidos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          produto:     produtoTexto || form.produto,
          quantidade:  qtdTotal || parseInt(String(form.quantidade)),
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
        ? `Pedido atualizado + ${demandasCriadas} demanda${demandasCriadas > 1 ? 's' : ''} criada${demandasCriadas > 1 ? 's' : ''}!`
        : 'Pedido atualizado!')
      carregar()
    } finally { setSalvando(false) }
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

  function ok(msg: string) { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }

  const isAdmin    = session?.user?.role === 'ADMIN'
  const podeEditar = session?.user?.role !== 'OPERADOR'

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
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard/pedidos')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />Pedidos
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-mono text-orange-400">#{pedido.numero}</span>

          <div className="ml-auto flex items-center gap-2">
            {/* Imprimir Pedido */}
            <a
              href={`/dashboard/pedidos/${pedido.id}/print`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition-colors"
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
            {pedido.status === 'EM_PRODUCAO' && podeEditar && (
              <button onClick={handleConcluir}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                <CheckCircle className="w-3.5 h-3.5" />Concluir
              </button>
            )}
            {pedido.status !== 'CANCELADO' && pedido.status !== 'CONCLUIDO' && isAdmin && (
              <button onClick={handleCancelar}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors">
                <XCircle className="w-3.5 h-3.5" />Cancelar
              </button>
            )}
            {podeEditar && !editando && (
              <button onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors">
                <Pencil className="w-3.5 h-3.5" />Editar
              </button>
            )}
            {editando && (
              <>
                <button onClick={() => { setEditando(false); setErro('') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition-colors">
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
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white flex items-center gap-2">
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
                    <p className="text-white font-mono font-medium">{pedido.numero}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Canal de venda</p>
                    <p className="text-gray-300">{pedido.canal || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Cliente / Destinatário</p>
                    <p className="text-white font-medium">{pedido.destinatario}</p>
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
                    <p className="text-white font-bold text-lg">{pedido.quantidade}</p>
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
                      <p className="text-orange-300 font-medium">{String(valor)}</p>
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
                        <div key={item._key} className="border border-gray-600 rounded-xl p-3 bg-gray-800/60">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">Produto {idx + 1}</span>
                            {itensPedido.length > 1 && <button type="button" onClick={() => removerItemEdit(item._key)} className="text-xs text-red-400 hover:text-red-300">✕</button>}
                          </div>
                          {variacoes.length > 0 && (
                            <select value={item.variacaoId} onChange={e => handleSelectVariacaoItemEdit(item._key, e.target.value)} className={inputClass + ' mb-2'}>
                              <option value="">{variacoes.length === 0 ? 'Carregando...' : 'Selecionar da Precificação...'}</option>
                              {variacoes.map(v => (
                                <option key={v.id} value={v.id}>{v.produtoNome} · {v.canal} · {v.tipo}{v.subOpcao ? ` · ${v.subOpcao}` : ''}{v.custoMaoObra > 0 ? ' 👤' : ''}</option>
                              ))}
                            </select>
                          )}
                          <input type="text" value={item.nomeProduto} onChange={e => atualizarItemEdit(item._key, { nomeProduto: e.target.value, variacaoId: '' })} className={inputClass + ' mb-2'} placeholder="Ou descreva manualmente..." />
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 block mb-1">Qtd</label>
                              <input type="number" min="1" value={item.quantidade} onChange={e => atualizarItemEdit(item._key, { quantidade: parseInt(e.target.value) || 1 })} className={inputClass} />
                            </div>
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
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Endereço de entrega</label>
                    <input className={inputClass} value={form.endereco}
                      onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))}
                      placeholder="Opcional" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantidade</label>
                    <input type="number" min="1" className={inputClass} value={form.quantidade}
                      onChange={e => setForm(p => ({ ...p, quantidade: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Valor (R$)</label>
                    <input type="number" step="0.01" min="0" className={inputClass} value={form.valor}
                      onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                      placeholder="0,00" />
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

            {/* ── Demandas vinculadas ── */}
            {demandas.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-orange-500" />
                  Demandas de Freelancer
                  <span className="text-xs text-gray-500 font-normal">({demandas.length})</span>
                </h2>
                <div className="space-y-3">
                  {demandas.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                      <div>
                        <p className="text-sm font-medium text-white">{d.freelancerNome}</p>
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
              </div>
            )}
          </div>

          {/* ── Coluna lateral ── */}
          <div className="space-y-5">

            {/* Fluxo de produção */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
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

              {setorHist.length > 0 ? (
                <div className="space-y-2">
                  {setorHist.map((s, i) => (
                    <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${s.atual ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-gray-800/50'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.atual ? 'bg-orange-500' : s.saidaEm ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{s.setorNome}</p>
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

            {/* Resumo financeiro */}
            {isAdmin && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />Resumo
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Valor do pedido</span>
                    <span className="text-green-400 font-medium">{fmtR(pedido.valor)}</span>
                  </div>
                  {demandas.length > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Custo freelancers</span>
                        <span className="text-orange-400 font-medium">
                          {fmtR(demandas.reduce((s, d) => s + d.valorTotal, 0))}
                        </span>
                      </div>
                      <div className="border-t border-gray-700 pt-2 flex justify-between">
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
