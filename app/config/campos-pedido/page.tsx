'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, X, Trash2, GripVertical, Type, Hash, Calendar, List, CheckSquare, Palette, Filter, Layers } from 'lucide-react'

interface CampoPedido {
  id: string
  nome: string
  tipo: string
  opcoes: string | null
  placeholder: string | null
  ativo: boolean
  ordem: number
  usarComoFiltro: boolean
  usarNaMassa: boolean
}

interface CampoSugerido {
  nome: string
  tipo: string
  opcoes?: string[]
  placeholder?: string
  segmento: string
}

const TIPOS = [
  { id: 'texto',    label: 'Texto livre', icon: Type     },
  { id: 'numero',   label: 'Número',      icon: Hash     },
  { id: 'data',     label: 'Data',        icon: Calendar },
  { id: 'lista',    label: 'Lista',       icon: List     },
  { id: 'checkbox', label: 'Checkbox',    icon: CheckSquare },
  { id: 'cor',      label: 'Cor',         icon: Palette  },
]

const SEGMENTO_LABEL: Record<string, string> = {
  lacos:  '🎀 Laços',
  festas: '🎉 Festas',
  moda:   '👗 Moda',
  geral:  '✨ Geral',
}

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

export default function CamposPedidoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [campos, setCampos] = useState<CampoPedido[]>([])
  const [sugeridos, setSugeridos] = useState<CampoSugerido[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [form, setForm] = useState({ nome: '', tipo: 'texto', opcoes: '', placeholder: '', usarComoFiltro: true, usarNaMassa: true })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/modulos')
      else carregar()
    }
  }, [status])

  async function carregar() {
    try {
      const res = await fetch('/api/config/campos-pedido')
      const data = await res.json()
      setCampos(data.campos || [])
      setSugeridos(data.sugeridos || [])
    } finally { setLoading(false) }
  }

  async function criarCampo(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const opcoes = form.tipo === 'lista'
        ? form.opcoes.split(',').map(o => o.trim()).filter(Boolean)
        : null
      const res = await fetch('/api/config/campos-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, opcoes }),
      })
      const data = await res.json()
      if (res.ok) {
        setCampos(prev => [...prev, data.campo])
        setModalNovo(false)
        setForm({ nome: '', tipo: 'texto', opcoes: '', placeholder: '', usarComoFiltro: true, usarNaMassa: true })
        mostrarSucesso('Campo criado!')
      }
    } finally { setSalvando(false) }
  }

  async function adicionarSugerido(sug: CampoSugerido) {
    setSalvando(true)
    try {
      const res = await fetch('/api/config/campos-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: sug.nome,
          tipo: sug.tipo,
          opcoes: sug.opcoes || null,
          placeholder: sug.placeholder || null,
          usarComoFiltro: true,
          usarNaMassa: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setCampos(prev => [...prev, data.campo])
        mostrarSucesso(`"${sug.nome}" adicionado!`)
      }
    } finally { setSalvando(false) }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch(`/api/config/campos-pedido/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    })
    setCampos(prev => prev.map(c => c.id === id ? { ...c, ativo: !ativo } : c))
  }

  async function toggleFlag(id: string, flag: 'usarComoFiltro' | 'usarNaMassa', val: boolean) {
    await fetch(`/api/config/campos-pedido/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [flag]: !val }),
    })
    setCampos(prev => prev.map(c => c.id === id ? { ...c, [flag]: !val } : c))
  }

  async function remover(id: string) {
    if (!confirm('Remover este campo?')) return
    await fetch(`/api/config/campos-pedido/${id}`, { method: 'DELETE' })
    setCampos(prev => prev.filter(c => c.id !== id))
    mostrarSucesso('Campo removido!')
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg); setTimeout(() => setSucesso(''), 3000)
  }

  const camposJaCriados = new Set(campos.map(c => c.nome.toLowerCase()))
  const sugeridosDisponiveis = sugeridos.filter(s => !camposJaCriados.has(s.nome.toLowerCase()))

  const segmentosGrupos = sugeridosDisponiveis.reduce((acc, s) => {
    if (!acc[s.segmento]) acc[s.segmento] = []
    acc[s.segmento].push(s)
    return acc
  }, {} as Record<string, CampoSugerido[]>)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Campos do Pedido</h1>
            <p className="text-sm text-gray-500">Personalize os dados que aparecem em cada pedido</p>
          </div>
          <button onClick={() => setModalNovo(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            <Plus size={14} /> Novo campo
          </button>
        </div>

        {sucesso && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {sucesso}</div>}

        {/* Campos fixos (informativos) */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campos fixos (sempre presentes)</p>
          <div className="flex flex-wrap gap-2">
            {['Nome da Cliente', 'ID Pedido', 'Destinatário', 'ID User', 'Produto', 'Quantidade', 'Valor', 'Data Entrada', 'Data Envio', 'Observações', 'Responsável', 'Prioridade', 'Canal'].map(nome => (
              <span key={nome} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200">
                {nome}
              </span>
            ))}
          </div>
        </div>

        {/* Campos white-label criados */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Campos personalizados</p>
          </div>

          {campos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">Nenhum campo criado ainda</p>
              <p className="text-xs text-gray-400 mt-1">Use os atalhos abaixo para adicionar campos sugeridos</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {campos.map(campo => {
                const tipoInfo = TIPOS.find(t => t.id === campo.tipo)
                const TipoIcon = tipoInfo?.icon || Type
                return (
                  <div key={campo.id} className={`flex items-center gap-3 px-5 py-3 ${!campo.ativo ? 'opacity-50' : ''}`}>
                    <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                    <TipoIcon size={14} className="text-orange-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{campo.nome}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{tipoInfo?.label}</span>
                      </div>
                      {campo.opcoes && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {JSON.parse(campo.opcoes).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle filtro */}
                      <button onClick={() => toggleFlag(campo.id, 'usarComoFiltro', campo.usarComoFiltro)}
                        title="Usar como filtro"
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition ${campo.usarComoFiltro ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        <Filter size={11} /> Filtro
                      </button>
                      {/* Toggle massa */}
                      <button onClick={() => toggleFlag(campo.id, 'usarNaMassa', campo.usarNaMassa)}
                        title="Usar em ação em massa"
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition ${campo.usarNaMassa ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        <Layers size={11} /> Massa
                      </button>
                      {/* Toggle ativo */}
                      <button onClick={() => toggleAtivo(campo.id, campo.ativo)}
                        className={`text-xs px-2 py-1 rounded-lg border transition ${campo.ativo ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        {campo.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      <button onClick={() => remover(campo.id)} className="text-gray-300 hover:text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Campos sugeridos */}
        {Object.keys(segmentosGrupos).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Atalhos — campos sugeridos</p>
            {Object.entries(segmentosGrupos).map(([segmento, sugs]) => (
              <div key={segmento} className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">{SEGMENTO_LABEL[segmento] || segmento}</p>
                <div className="flex flex-wrap gap-2">
                  {sugs.map(sug => (
                    <button key={sug.nome} onClick={() => adicionarSugerido(sug)} disabled={salvando}
                      className="flex items-center gap-1.5 text-xs border border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-full transition disabled:opacity-50">
                      <Plus size={11} /> {sug.nome}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal novo campo */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Novo campo</h2>
              <button onClick={() => setModalNovo(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={criarCampo} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome do campo *</label>
                <input type="text" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  className={inputClass} placeholder="Ex: Tema, Cor, Nome da criança..." required />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS.map(tipo => {
                    const Icon = tipo.icon
                    return (
                      <label key={tipo.id} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${form.tipo === tipo.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="tipo" value={tipo.id} checked={form.tipo === tipo.id}
                          onChange={() => setForm(p => ({ ...p, tipo: tipo.id }))} className="hidden" />
                        <Icon size={13} className={form.tipo === tipo.id ? 'text-orange-500' : 'text-gray-400'} />
                        <span className="text-xs text-gray-700">{tipo.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {form.tipo === 'lista' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Opções <span className="text-gray-400">(separadas por vírgula)</span></label>
                  <input type="text" value={form.opcoes} onChange={e => setForm(p => ({ ...p, opcoes: e.target.value }))}
                    className={inputClass} placeholder="Op1, Op2, Op3..." />
                </div>
              )}

              {(form.tipo === 'texto' || form.tipo === 'numero') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Placeholder</label>
                  <input type="text" value={form.placeholder} onChange={e => setForm(p => ({ ...p, placeholder: e.target.value }))}
                    className={inputClass} placeholder="Texto de exemplo..." />
                </div>
              )}

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.usarComoFiltro} onChange={e => setForm(p => ({ ...p, usarComoFiltro: e.target.checked }))} className="accent-orange-500" />
                  <span className="text-sm text-gray-700">Usar como filtro</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.usarNaMassa} onChange={e => setForm(p => ({ ...p, usarNaMassa: e.target.checked }))} className="accent-orange-500" />
                  <span className="text-sm text-gray-700">Usar em ação em massa</span>
                </label>
              </div>

              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setModalNovo(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
                  {salvando ? 'Criando...' : 'Criar campo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
