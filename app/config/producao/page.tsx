'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Plus, X, GripVertical,
  Type, Hash, Calendar, List, CheckSquare, User, Upload, Palette, Trash2
} from 'lucide-react'

interface Setor {
  id: string
  nome: string
  ordem: number
  ativo: boolean
}

interface Campo {
  id: string
  setorId: string
  nome: string
  tipo: string
  obrigatorio: boolean
  opcoes: string | null
  placeholder: string | null
  ordem: number
  ativo: boolean
}

const TIPOS_CAMPO = [
  { id: 'texto',    label: 'Texto livre',     icon: Type,        cor: 'text-blue-500'   },
  { id: 'numero',   label: 'Número',          icon: Hash,        cor: 'text-purple-500' },
  { id: 'data',     label: 'Data',            icon: Calendar,    cor: 'text-green-500'  },
  { id: 'lista',    label: 'Lista (dropdown)', icon: List,        cor: 'text-orange-500' },
  { id: 'checkbox', label: 'Checkbox',        icon: CheckSquare, cor: 'text-teal-500'   },
  { id: 'usuario',  label: 'Responsável',     icon: User,        cor: 'text-indigo-500' },
  { id: 'arquivo',  label: 'Arquivo/Imagem',  icon: Upload,      cor: 'text-pink-500'   },
  { id: 'cor',      label: 'Cor',             icon: Palette,     cor: 'text-red-500'    },
]

const CAMPOS_BASE = [
  { nome: 'Status',         tipo: 'lista',   desc: 'Aguardando / Em andamento / Concluído / Devolvido' },
  { nome: 'Responsável',    tipo: 'usuario', desc: 'Quem executa este setor' },
  { nome: 'Data de entrega',tipo: 'data',    desc: 'Prazo para conclusão' },
  { nome: 'Quantidade',     tipo: 'numero',  desc: 'Qtd de itens' },
  { nome: 'Observações',    tipo: 'texto',   desc: 'Notas gerais' },
]

const TEMPLATES = [
  { id: 'lacos',            nome: 'Laços e Tiaras',        emoji: '🎀', setores: ['Pedido', 'Produção', 'Embalagem', 'Expedição'] },
  { id: 'costura',          nome: 'Costura e Moda',         emoji: '🧵', setores: ['Modelagem', 'Corte', 'Costura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'bijuteria',        nome: 'Bijuteria e Joias',      emoji: '💍', setores: ['Design', 'Montagem', 'Controle de Qualidade', 'Embalagem', 'Expedição'] },
  { id: 'sublimacao',       nome: 'Sublimação',             emoji: '🖨️', setores: ['Arte', 'Impressão', 'Prensa', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'croche_trico',     nome: 'Crochê e Tricô',         emoji: '🧶', setores: ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'mdf_madeira',      nome: 'MDF e Madeira',          emoji: '🪵', setores: ['Design', 'Corte', 'Pintura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'biscuit',          nome: 'Biscuit e Modelagem',    emoji: '🎨', setores: ['Modelagem', 'Secagem', 'Pintura', 'Verniz', 'Embalagem', 'Expedição'] },
  { id: 'festas',           nome: 'Festas e Lembrancinhas', emoji: '🎉', setores: ['Arte', 'Produção', 'Montagem', 'Embalagem', 'Expedição'] },
  { id: 'papelaria',        nome: 'Papelaria Criativa',     emoji: '📒', setores: ['Arte', 'Impressão', 'Corte', 'Montagem', 'Embalagem', 'Expedição'] },
  { id: 'encadernacao',     nome: 'Encadernação Artesanal', emoji: '📚', setores: ['Arte', 'Impressão', 'Corte e Dobra', 'Furação', 'Costura', 'Capa e Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'velas_cosmeticos', nome: 'Velas e Cosméticos',     emoji: '🕯️', setores: ['Formulação', 'Produção', 'Rotulagem', 'Embalagem', 'Expedição'] },
  { id: 'macrame',          nome: 'Macramê e Têxtil',       emoji: '🪢', setores: ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'resina',           nome: 'Resina e Acrílico',      emoji: '💎', setores: ['Design', 'Moldagem', 'Cura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'ceramica',         nome: 'Cerâmica e Barro',       emoji: '🏺', setores: ['Modelagem', 'Secagem', 'Queima', 'Pintura', 'Embalagem', 'Expedição'] },
  { id: 'bolsas',           nome: 'Bolsas e Carteiras',     emoji: '👜', setores: ['Design', 'Corte', 'Montagem', 'Acabamento', 'Embalagem', 'Expedição'] },
]

export default function ConfigProducaoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [setores, setSetores] = useState<Setor[]>([])
  const [camposPorSetor, setCamposPorSetor] = useState<Record<string, Campo[]>>({})
  const [setorExpandido, setSetorExpandido] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  // Estado setor
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Estado template
  const [templateSelecionado, setTemplateSelecionado] = useState<string | null>(null)
  const [setoresTemplate, setSetoresTemplate] = useState<string[]>([])
  const [novoSetorTemplate, setNovoSetorTemplate] = useState('')
  const [dragIndexTpl, setDragIndexTpl] = useState<number | null>(null)

  // Estado form builder
  const [modalCampo, setModalCampo] = useState(false)
  const [setorAtivoCampo, setSetorAtivoCampo] = useState<string | null>(null)
  const [formCampo, setFormCampo] = useState({
    nome: '', tipo: 'texto', obrigatorio: false,
    placeholder: '', opcoes: '' // para lista: opções separadas por vírgula
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') carregarSetores()
  }, [status])

  async function carregarSetores() {
    try {
      const res = await fetch('/api/config/producao')
      const data = await res.json()
      setSetores(data.setores || [])
    } catch { setErro('Erro ao carregar') }
    finally { setLoading(false) }
  }

  async function carregarCampos(setorId: string) {
    if (camposPorSetor[setorId]) return
    try {
      const res = await fetch(`/api/config/campos?setorId=${setorId}`)
      const data = await res.json()
      setCamposPorSetor(prev => ({ ...prev, [setorId]: data.campos || [] }))
    } catch { console.error('Erro ao carregar campos') }
  }

  function toggleSetor(setorId: string) {
    if (setorExpandido === setorId) {
      setSetorExpandido(null)
    } else {
      setSetorExpandido(setorId)
      carregarCampos(setorId)
    }
  }

  // ── APIs Setor ────────────────────────────────────────────
  async function salvarOrdem(novosSetores: Setor[]) {
    setSalvando(true)
    try {
      await fetch('/api/config/producao/reordenar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setores: novosSetores.map((s, i) => ({ id: s.id, ordem: i })) }),
      })
    } finally { setSalvando(false) }
  }

  function moverSetor(de: number, para: number) {
    const novos = [...setores]
    const [item] = novos.splice(de, 1)
    novos.splice(para, 0, item)
    setSetores(novos)
    salvarOrdem(novos)
  }

  async function adicionarSetor() {
    if (!novoNome.trim()) return
    setSalvando(true)
    try {
      const res = await fetch('/api/config/producao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error); return }
      setSetores(prev => [...prev, data.setor])
      setNovoNome('')
      mostrarSucesso('Setor adicionado!')
    } finally { setSalvando(false) }
  }

  async function salvarEdicao(id: string) {
    if (!editandoNome.trim()) return
    setSalvando(true)
    try {
      await fetch(`/api/config/producao/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editandoNome.trim() }),
      })
      setSetores(prev => prev.map(s => s.id === id ? { ...s, nome: editandoNome.trim() } : s))
      setEditandoId(null)
      mostrarSucesso('Renomeado!')
    } finally { setSalvando(false) }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch(`/api/config/producao/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    })
    setSetores(prev => prev.map(s => s.id === id ? { ...s, ativo: !ativo } : s))
  }

  async function removerSetor(id: string) {
    if (!confirm('Remover este setor e todos os seus campos configurados?')) return
    await fetch(`/api/config/producao/${id}`, { method: 'DELETE' })
    setSetores(prev => prev.filter(s => s.id !== id))
    mostrarSucesso('Setor removido!')
  }

  // ── Template ──────────────────────────────────────────────
  function selecionarTemplate(id: string) {
    const t = TEMPLATES.find(t => t.id === id)
    setTemplateSelecionado(id)
    setSetoresTemplate(t ? [...t.setores] : [])
  }

  function adicionarSetorTemplate() {
    if (!novoSetorTemplate.trim()) return
    setSetoresTemplate(prev => [...prev, novoSetorTemplate.trim()])
    setNovoSetorTemplate('')
  }

  function removerSetorTemplate(i: number) {
    setSetoresTemplate(prev => prev.filter((_, idx) => idx !== i))
  }

  function moverSetorTemplate(de: number, para: number) {
    const novos = [...setoresTemplate]
    const [item] = novos.splice(de, 1)
    novos.splice(para, 0, item)
    setSetoresTemplate(novos)
  }

  async function aplicarTemplate() {
    if (!setoresTemplate.length) { setErro('Adicione pelo menos um setor'); return }
    setSalvando(true)
    setErro('')
    try {
      const novos: Setor[] = []
      for (let i = 0; i < setoresTemplate.length; i++) {
        const res = await fetch('/api/config/producao', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: setoresTemplate[i] }),
        })
        const data = await res.json()
        if (res.ok) novos.push(data.setor)
      }
      setSetores(novos)
      setTemplateSelecionado(null)
      mostrarSucesso('Setores criados!')
    } finally { setSalvando(false) }
  }

  // ── Form builder ──────────────────────────────────────────
  function abrirModalCampo(setorId: string) {
    setSetorAtivoCampo(setorId)
    setFormCampo({ nome: '', tipo: 'texto', obrigatorio: false, placeholder: '', opcoes: '' })
    setModalCampo(true)
  }

  async function criarCampo(e: React.FormEvent) {
    e.preventDefault()
    if (!setorAtivoCampo) return
    setSalvando(true)
    try {
      const opcoes = formCampo.tipo === 'lista'
        ? formCampo.opcoes.split(',').map(o => o.trim()).filter(Boolean)
        : null

      const res = await fetch('/api/config/campos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setorId: setorAtivoCampo,
          nome: formCampo.nome,
          tipo: formCampo.tipo,
          obrigatorio: formCampo.obrigatorio,
          placeholder: formCampo.placeholder || null,
          opcoes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error); return }

      setCamposPorSetor(prev => ({
        ...prev,
        [setorAtivoCampo]: [...(prev[setorAtivoCampo] || []), data.campo],
      }))
      setModalCampo(false)
      mostrarSucesso('Campo adicionado!')
    } finally { setSalvando(false) }
  }

  async function removerCampo(setorId: string, campoId: string) {
    if (!confirm('Remover este campo?')) return
    await fetch(`/api/config/campos/${campoId}`, { method: 'DELETE' })
    setCamposPorSetor(prev => ({
      ...prev,
      [setorId]: (prev[setorId] || []).filter(c => c.id !== campoId),
    }))
    mostrarSucesso('Campo removido!')
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg); setTimeout(() => setSucesso(''), 3000)
  }

  function getTipoCampo(tipo: string) {
    return TIPOS_CAMPO.find(t => t.id === tipo)
  }

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Configurar Produção</h1>
            <p className="text-sm text-gray-500">Setores e campos do fluxo de produção</p>
          </div>
          {salvando && <span className="text-xs text-orange-500 animate-pulse">Salvando...</span>}
        </div>

        {/* Alertas */}
        {sucesso && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {sucesso}</div>}
        {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-600">{erro}</div>}

        {/* ── SEM SETORES: templates ── */}
        {setores.length === 0 && !templateSelecionado && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">⚙️</div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Nenhum setor configurado ainda</h2>
              <p className="text-sm text-gray-500">Escolha um template ou adicione setores manualmente.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => selecionarTemplate(t.id)}
                  className="text-left p-3 rounded-xl border border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition">
                  <div className="text-lg mb-1">{t.emoji}</div>
                  <div className="text-xs font-semibold text-gray-800">{t.nome}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.setores.length} setores</div>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-2 text-center">Ou adicione manualmente:</p>
              <div className="flex gap-2">
                <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetor())}
                  placeholder="Nome do setor..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <button onClick={adicionarSetor} disabled={salvando || !novoNome.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 font-medium">
                  + Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TEMPLATE SELECIONADO ── */}
        {setores.length === 0 && templateSelecionado && (
          <div className="bg-white rounded-xl border border-orange-200 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {TEMPLATES.find(t => t.id === templateSelecionado)?.emoji}{' '}
                  {TEMPLATES.find(t => t.id === templateSelecionado)?.nome}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Edite antes de aplicar</p>
              </div>
              <button onClick={() => setTemplateSelecionado(null)} className="text-xs text-gray-400 hover:text-gray-600">← Voltar</button>
            </div>
            <div className="flex flex-col gap-2 mb-3">
              {setoresTemplate.map((setor, i) => (
                <div key={i} draggable
                  onDragStart={() => setDragIndexTpl(i)} onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (dragIndexTpl !== null && dragIndexTpl !== i) moverSetorTemplate(dragIndexTpl, i); setDragIndexTpl(null) }}
                  onDragEnd={() => setDragIndexTpl(null)}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-grab group transition ${dragIndexTpl === i ? 'border-orange-400 bg-orange-50 opacity-50' : 'border-gray-200 hover:border-orange-300'}`}>
                  <span className="text-xs font-bold text-orange-500 w-5 text-center">{i + 1}</span>
                  <GripVertical size={12} className="text-gray-300" />
                  <span className="flex-1 text-sm text-gray-800">{setor}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => i > 0 && moverSetorTemplate(i, i - 1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-xs">↑</button>
                    <button onClick={() => i < setoresTemplate.length - 1 && moverSetorTemplate(i, i + 1)} disabled={i === setoresTemplate.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-xs">↓</button>
                  </div>
                  <button onClick={() => removerSetorTemplate(i)} className="text-gray-300 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input type="text" value={novoSetorTemplate} onChange={e => setNovoSetorTemplate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetorTemplate())}
                placeholder="Adicionar setor..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <button onClick={adicionarSetorTemplate} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg transition">+ Adicionar</button>
            </div>
            <button onClick={aplicarTemplate} disabled={salvando || !setoresTemplate.length}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50">
              {salvando ? 'Criando...' : `Aplicar template (${setoresTemplate.length} setores)`}
            </button>
          </div>
        )}

        {/* ── COM SETORES ── */}
        {setores.length > 0 && (
          <div className="flex flex-col gap-3">
            {setores.map((setor, i) => (
              <div key={setor.id}
                draggable
                onDragStart={() => setDragIndex(i)} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) moverSetor(dragIndex, i); setDragIndex(null) }}
                onDragEnd={() => setDragIndex(null)}
                className={`bg-white rounded-xl border transition ${dragIndex === i ? 'border-orange-400 opacity-60' : 'border-gray-100'}`}>

                {/* Cabeçalho do setor */}
                <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${setor.ativo ? '' : 'opacity-50'}`}
                  onClick={() => toggleSetor(setor.id)}>
                  <GripVertical size={14} className="text-gray-300 flex-shrink-0 cursor-grab" onClick={e => e.stopPropagation()} />
                  <span className="text-xs font-bold text-orange-500 w-5 text-center flex-shrink-0">{i + 1}</span>

                  {editandoId === setor.id ? (
                    <input autoFocus value={editandoNome} onChange={e => setEditandoNome(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(setor.id); if (e.key === 'Escape') setEditandoId(null) }}
                      onBlur={() => salvarEdicao(setor.id)}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-orange-50 border border-orange-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  ) : (
                    <span
                      className={`flex-1 text-sm font-medium cursor-pointer hover:text-orange-600 transition ${setor.ativo ? 'text-gray-900' : 'text-gray-400 line-through'}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditandoId(setor.id); setEditandoNome(setor.nome) }}
                      title="Duplo clique para renomear"
                    >
                      {setor.nome}
                    </span>
                  )}

                  {/* Badge campos */}
                  {camposPorSetor[setor.id] && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {camposPorSetor[setor.id].length} campo{camposPorSetor[setor.id].length !== 1 ? 's' : ''}
                    </span>
                  )}

                  <button onClick={e => { e.stopPropagation(); toggleAtivo(setor.id, setor.ativo) }}
                    className={`text-xs px-2 py-0.5 rounded-full border transition flex-shrink-0 ${
                      setor.ativo ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'}`}>
                    {setor.ativo ? 'Ativo' : 'Inativo'}
                  </button>

                  <button onClick={e => { e.stopPropagation(); removerSetor(setor.id) }}
                    className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                    <Trash2 size={14} />
                  </button>

                  {setorExpandido === setor.id
                    ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                    : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                  }
                </div>

                {/* Painel expandido — campos */}
                {setorExpandido === setor.id && (
                  <div className="border-t border-gray-100 px-4 py-4">

                    {/* Campos base (fixos) */}
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Campos base (presentes em todos os setores)</p>
                      <div className="flex flex-wrap gap-2">
                        {CAMPOS_BASE.map(cb => (
                          <div key={cb.nome} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5" title={cb.desc}>
                            <span className="text-xs text-gray-500">{cb.nome}</span>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{getTipoCampo(cb.tipo)?.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Campos customizados */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500">Campos customizados deste setor</p>
                        <button onClick={() => abrirModalCampo(setor.id)}
                          className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium transition">
                          <Plus size={12} /> Adicionar campo
                        </button>
                      </div>

                      {!camposPorSetor[setor.id] && (
                        <p className="text-xs text-gray-400 text-center py-2">Carregando campos...</p>
                      )}

                      {camposPorSetor[setor.id]?.length === 0 && (
                        <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-gray-400">Nenhum campo customizado ainda</p>
                          <button onClick={() => abrirModalCampo(setor.id)}
                            className="text-xs text-orange-500 hover:text-orange-600 mt-1 font-medium">
                            + Adicionar primeiro campo
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {(camposPorSetor[setor.id] || []).map(campo => {
                          const tipoDef = getTipoCampo(campo.tipo)
                          const TipoIcon = tipoDef?.icon || Type
                          return (
                            <div key={campo.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 group">
                              <TipoIcon size={13} className={tipoDef?.cor || 'text-gray-400'} />
                              <span className="flex-1 text-sm text-gray-800">{campo.nome}</span>
                              <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{tipoDef?.label}</span>
                              {campo.obrigatorio && (
                                <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Obrigatório</span>
                              )}
                              {campo.opcoes && (
                                <span className="text-xs text-gray-400">
                                  {JSON.parse(campo.opcoes).length} opções
                                </span>
                              )}
                              <button onClick={() => removerCampo(setor.id, campo.id)}
                                className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                                <X size={13} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Adicionar novo setor */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex gap-2">
                <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetor())}
                  placeholder="Nome do novo setor..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <button onClick={adicionarSetor} disabled={salvando || !novoNome.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 font-medium">
                  + Setor
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          Setores inativos não aparecem no fluxo mas mantêm o histórico
        </p>
      </div>

      {/* ── Modal adicionar campo ── */}
      {modalCampo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Novo campo</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Setor: {setores.find(s => s.id === setorAtivoCampo)?.nome}
                </p>
              </div>
              <button onClick={() => setModalCampo(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={criarCampo} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome do campo</label>
                <input type="text" value={formCampo.nome}
                  onChange={e => setFormCampo(p => ({ ...p, nome: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Ex: Cor do tecido, Temperatura, Arte cliente..."
                  required />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Tipo do campo</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_CAMPO.map(tipo => {
                    const TipoIcon = tipo.icon
                    return (
                      <label key={tipo.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                          formCampo.tipo === tipo.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="tipo" value={tipo.id} checked={formCampo.tipo === tipo.id}
                          onChange={() => setFormCampo(p => ({ ...p, tipo: tipo.id }))} className="hidden" />
                        <TipoIcon size={14} className={tipo.cor} />
                        <span className="text-xs text-gray-700">{tipo.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Opções para lista */}
              {formCampo.tipo === 'lista' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Opções da lista <span className="text-gray-400">(separadas por vírgula)</span></label>
                  <input type="text" value={formCampo.opcoes}
                    onChange={e => setFormCampo(p => ({ ...p, opcoes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Ex: Pequeno, Médio, Grande" />
                </div>
              )}

              {/* Placeholder para texto/número */}
              {(formCampo.tipo === 'texto' || formCampo.tipo === 'numero') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Placeholder <span className="text-gray-400">(opcional)</span></label>
                  <input type="text" value={formCampo.placeholder}
                    onChange={e => setFormCampo(p => ({ ...p, placeholder: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Texto de exemplo no campo..." />
                </div>
              )}

              {/* Obrigatório */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formCampo.obrigatorio}
                  onChange={e => setFormCampo(p => ({ ...p, obrigatorio: e.target.checked }))}
                  className="accent-orange-500" />
                <span className="text-sm text-gray-700">Campo obrigatório</span>
              </label>

              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setModalCampo(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Adicionar campo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
