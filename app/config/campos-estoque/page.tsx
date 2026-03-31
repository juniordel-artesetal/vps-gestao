'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Trash2, GripVertical,
  Type, Hash, Calendar, List, CheckSquare,
  ChevronUp, ChevronDown, Archive,
} from 'lucide-react'

interface CampoEstoque {
  id: string
  nome: string
  tipo: string
  opcoes: string | null
  placeholder: string | null
  obrigatorio: boolean
  ordem: number
  ativo: boolean
}

interface CampoSugerido {
  nome: string
  tipo: string
  opcoes?: string[]
  placeholder?: string
  categoria: string
}

const TIPOS = [
  { id: 'texto',    label: 'Texto livre', icon: Type        },
  { id: 'numero',   label: 'Número',      icon: Hash        },
  { id: 'data',     label: 'Data',        icon: Calendar    },
  { id: 'lista',    label: 'Lista',       icon: List        },
  { id: 'checkbox', label: 'Sim / Não',   icon: CheckSquare },
]

const CATEGORIA_LABEL: Record<string, string> = {
  armazenamento: '📦 Armazenamento',
  producao:      '🏭 Produção',
  controle:      '📋 Controle',
  fornecedor:    '🔗 Fornecedor',
}

const SUGESTOES: CampoSugerido[] = [
  { nome: 'Localização na prateleira', tipo: 'texto',    placeholder: 'Ex: Prateleira A3, Caixa 2',    categoria: 'armazenamento' },
  { nome: 'Corredor / Seção',          tipo: 'texto',    placeholder: 'Ex: Corredor B',                categoria: 'armazenamento' },
  { nome: 'Depósito',                  tipo: 'lista',    opcoes: ['Principal', 'Secundário', 'Externo', 'Em casa'], categoria: 'armazenamento' },
  { nome: 'Lote de fabricação',        tipo: 'texto',    placeholder: 'Ex: LOTE-2026-03',              categoria: 'producao'      },
  { nome: 'Data de produção',          tipo: 'data',                                                   categoria: 'producao'      },
  { nome: 'Validade',                  tipo: 'data',                                                   categoria: 'producao'      },
  { nome: 'Responsável pela produção', tipo: 'texto',    placeholder: 'Ex: Maria',                     categoria: 'producao'      },
  { nome: 'Tempo de produção (dias)',   tipo: 'numero',   placeholder: 'Ex: 3',                         categoria: 'producao'      },
  { nome: 'Observações internas',      tipo: 'texto',    placeholder: 'Anotações sobre este produto',  categoria: 'controle'      },
  { nome: 'Código interno',            tipo: 'texto',    placeholder: 'Ex: INT-001',                   categoria: 'controle'      },
  { nome: 'Código de barras',          tipo: 'texto',    placeholder: 'Ex: 7891234567890',             categoria: 'controle'      },
  { nome: 'Peso (gramas)',             tipo: 'numero',   placeholder: 'Ex: 150',                       categoria: 'controle'      },
  { nome: 'Foto tirada',               tipo: 'checkbox',                                               categoria: 'controle'      },
  { nome: 'Fornecedor padrão',         tipo: 'texto',    placeholder: 'Ex: Distribuidora XYZ',         categoria: 'fornecedor'    },
  { nome: 'Código no fornecedor',      tipo: 'texto',    placeholder: 'Ex: REF-12345',                 categoria: 'fornecedor'    },
  { nome: 'Prazo de reposição (dias)', tipo: 'numero',   placeholder: 'Ex: 7',                         categoria: 'fornecedor'    },
  { nome: 'Compra mínima (unidades)',  tipo: 'numero',   placeholder: 'Ex: 10',                        categoria: 'fornecedor'    },
]

const CAMPOS_FIXOS = [
  'Produto', 'SKU', 'Canal de Venda', 'Variação', 'Tipo',
  'Custo Total', 'Preço de Venda', 'Saldo em Estoque',
  'Estoque Mínimo', 'Última Movimentação',
]

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

export default function CamposEstoquePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [campos, setCampos]     = useState<CampoEstoque[]>([])
  const [loading, setLoading]   = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso]   = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [form, setForm] = useState({
    nome: '', tipo: 'texto', opcoes: '', placeholder: '', obrigatorio: false,
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/modulos')
      else carregar()
    }
  }, [status])

  async function carregar() {
    try {
      const res  = await fetch('/api/config/campos-estoque')
      const data = await res.json()
      setCampos(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }

  async function criarCampo(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) return
    setSalvando(true)
    try {
      const opcoes = form.tipo === 'lista'
        ? form.opcoes.split(',').map(o => o.trim()).filter(Boolean)
        : null
      const res = await fetch('/api/config/campos-estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:        form.nome.trim(),
          tipo:        form.tipo,
          opcoes:      opcoes ? JSON.stringify(opcoes) : null,
          placeholder: form.placeholder || null,
          obrigatorio: form.obrigatorio,
        }),
      })
      if (res.ok) {
        await carregar()
        setModalNovo(false)
        setForm({ nome: '', tipo: 'texto', opcoes: '', placeholder: '', obrigatorio: false })
        mostrarSucesso('Campo criado!')
      }
    } finally { setSalvando(false) }
  }

  async function adicionarSugerido(sug: CampoSugerido) {
    setSalvando(true)
    try {
      const res = await fetch('/api/config/campos-estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:        sug.nome,
          tipo:        sug.tipo,
          opcoes:      sug.opcoes ? JSON.stringify(sug.opcoes) : null,
          placeholder: sug.placeholder || null,
          obrigatorio: false,
        }),
      })
      if (res.ok) {
        await carregar()
        mostrarSucesso(`"${sug.nome}" adicionado!`)
      }
    } finally { setSalvando(false) }
  }

  async function toggleAtivo(campo: CampoEstoque) {
    await fetch(`/api/config/campos-estoque/${campo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !campo.ativo }),
    })
    setCampos(prev => prev.map(c => c.id === campo.id ? { ...c, ativo: !c.ativo } : c))
  }

  async function remover(id: string) {
    if (!confirm('Remover este campo? Os valores preenchidos também serão removidos.')) return
    await fetch(`/api/config/campos-estoque/${id}`, { method: 'DELETE' })
    setCampos(prev => prev.filter(c => c.id !== id))
    mostrarSucesso('Campo removido!')
  }

  async function moverOrdem(campo: CampoEstoque, direcao: 'up' | 'down') {
    const idx = campos.findIndex(c => c.id === campo.id)
    if (direcao === 'up' && idx === 0) return
    if (direcao === 'down' && idx === campos.length - 1) return
    const outro = campos[direcao === 'up' ? idx - 1 : idx + 1]
    await Promise.all([
      fetch(`/api/config/campos-estoque/${campo.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordem: outro.ordem }),
      }),
      fetch(`/api/config/campos-estoque/${outro.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordem: campo.ordem }),
      }),
    ])
    carregar()
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg); setTimeout(() => setSucesso(''), 3000)
  }

  const nomesJaCriados       = new Set(campos.map(c => c.nome.toLowerCase()))
  const sugeridosDisponiveis = SUGESTOES.filter(s => !nomesJaCriados.has(s.nome.toLowerCase()))
  const grupos               = sugeridosDisponiveis.reduce((acc, s) => {
    if (!acc[s.categoria]) acc[s.categoria] = []
    acc[s.categoria].push(s)
    return acc
  }, {} as Record<string, CampoSugerido[]>)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-orange-500" />
              Campos do Estoque
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure campos extras para os produtos em estoque
            </p>
          </div>
          <button onClick={() => setModalNovo(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus size={15} /> Novo campo
          </button>
        </div>

        {sucesso && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 mb-4 text-sm text-green-700 dark:text-green-400">
            ✓ {sucesso}
          </div>
        )}

        {/* Campos fixos */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Campos fixos — vindos da Precificação
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Sempre presentes e preenchidos automaticamente ao vincular o produto ao estoque.
          </p>
          <div className="flex flex-wrap gap-2">
            {CAMPOS_FIXOS.map(nome => (
              <span key={nome}
                className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-800">
                {nome}
              </span>
            ))}
          </div>
        </div>

        {/* Campos personalizados */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Campos personalizados ({campos.filter(c => c.ativo).length} ativo{campos.filter(c => c.ativo).length !== 1 ? 's' : ''})
            </p>
          </div>

          {campos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">Nenhum campo criado ainda</p>
              <p className="text-xs text-gray-400 mt-1">Use os atalhos abaixo para adicionar campos sugeridos</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {campos.map((campo, idx) => {
                const tipoInfo = TIPOS.find(t => t.id === campo.tipo)
                const TipoIcon = tipoInfo?.icon || Type
                return (
                  <div key={campo.id}
                    className={`flex items-center gap-3 px-5 py-3 transition ${!campo.ativo ? 'opacity-40' : ''}`}>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moverOrdem(campo, 'up')} disabled={idx === 0}
                        className="text-gray-300 dark:text-gray-600 hover:text-gray-500 disabled:opacity-20">
                        <ChevronUp size={12} />
                      </button>
                      <button onClick={() => moverOrdem(campo, 'down')} disabled={idx === campos.length - 1}
                        className="text-gray-300 dark:text-gray-600 hover:text-gray-500 disabled:opacity-20">
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <GripVertical size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    <TipoIcon size={14} className="text-orange-400 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 dark:text-white">{campo.nome}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded">
                          {tipoInfo?.label}
                        </span>
                        {campo.obrigatorio && (
                          <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      {campo.opcoes && (() => {
                        try {
                          const lista = JSON.parse(campo.opcoes)
                          return (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {lista.join(', ')}
                            </p>
                          )
                        } catch { return null }
                      })()}
                      {campo.placeholder && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">Ex: {campo.placeholder}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => toggleAtivo(campo)}
                        className={`text-xs px-2 py-1 rounded-lg border transition ${campo.ativo
                          ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                          : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-700 dark:border-gray-600'}`}>
                        {campo.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      <button onClick={() => remover(campo.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sugestões */}
        {Object.keys(grupos).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Atalhos — campos sugeridos para estoque
            </p>
            {Object.entries(grupos).map(([categoria, sugs]) => (
              <div key={categoria} className="mb-4 last:mb-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {CATEGORIA_LABEL[categoria] || categoria}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sugs.map(sug => (
                    <button key={sug.nome} onClick={() => adicionarSugerido(sug)} disabled={salvando}
                      className="flex items-center gap-1.5 text-xs border border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-1.5 rounded-full transition disabled:opacity-50">
                      <Plus size={11} /> {sug.nome}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {Object.keys(grupos).length === 0 && campos.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-3">
            ✓ Todos os campos sugeridos já foram adicionados
          </p>
        )}

      </div>

      {/* Modal novo campo */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
            <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Novo campo do estoque</h2>
              <button onClick={() => setModalNovo(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={criarCampo} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Nome do campo *</label>
                <input type="text" value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  className={inputClass} placeholder="Ex: Localização, Lote, Fornecedor..." required />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-2">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS.map(tipo => {
                    const Icon = tipo.icon
                    return (
                      <label key={tipo.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                          form.tipo === tipo.id
                            ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}>
                        <input type="radio" name="tipo" value={tipo.id}
                          checked={form.tipo === tipo.id}
                          onChange={() => setForm(p => ({ ...p, tipo: tipo.id }))}
                          className="hidden" />
                        <Icon size={13} className={form.tipo === tipo.id ? 'text-orange-500' : 'text-gray-400'} />
                        <span className="text-xs text-gray-700 dark:text-gray-300">{tipo.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {form.tipo === 'lista' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    Opções <span className="text-gray-400">(separadas por vírgula)</span>
                  </label>
                  <input type="text" value={form.opcoes}
                    onChange={e => setForm(p => ({ ...p, opcoes: e.target.value }))}
                    className={inputClass} placeholder="Prateleira A, Prateleira B, Depósito..." />
                </div>
              )}

              {(form.tipo === 'texto' || form.tipo === 'numero') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    Placeholder <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input type="text" value={form.placeholder}
                    onChange={e => setForm(p => ({ ...p, placeholder: e.target.value }))}
                    className={inputClass} placeholder="Texto de exemplo..." />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.obrigatorio}
                  onChange={e => setForm(p => ({ ...p, obrigatorio: e.target.checked }))}
                  className="accent-orange-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Campo obrigatório</span>
              </label>

              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setModalNovo(false)}
                  className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando || !form.nome.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
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
