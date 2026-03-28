'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Setor {
  id: string
  nome: string
  icone: string | null
  cor: string | null
  ordem: number
  ativo: boolean
}

const TEMPLATES = [
  { id: 'lacos',            nome: 'Laços e Tiaras',           emoji: '🎀', setores: ['Pedido', 'Produção', 'Embalagem', 'Expedição'] },
  { id: 'costura',          nome: 'Costura e Moda',            emoji: '🧵', setores: ['Modelagem', 'Corte', 'Costura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'bijuteria',        nome: 'Bijuteria e Joias',         emoji: '💍', setores: ['Design', 'Montagem', 'Controle de Qualidade', 'Embalagem', 'Expedição'] },
  { id: 'sublimacao',       nome: 'Sublimação',                emoji: '🖨️', setores: ['Arte', 'Impressão', 'Prensa', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'croche_trico',     nome: 'Crochê e Tricô',            emoji: '🧶', setores: ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'mdf_madeira',      nome: 'MDF e Madeira',             emoji: '🪵', setores: ['Design', 'Corte', 'Pintura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'biscuit',          nome: 'Biscuit e Modelagem',       emoji: '🎨', setores: ['Modelagem', 'Secagem', 'Pintura', 'Verniz', 'Embalagem', 'Expedição'] },
  { id: 'festas',           nome: 'Festas e Lembrancinhas',    emoji: '🎉', setores: ['Arte', 'Produção', 'Montagem', 'Embalagem', 'Expedição'] },
  { id: 'papelaria',        nome: 'Papelaria Criativa',        emoji: '📒', setores: ['Arte', 'Impressão', 'Corte', 'Montagem', 'Embalagem', 'Expedição'] },
  { id: 'encadernacao',     nome: 'Encadernação Artesanal',    emoji: '📚', setores: ['Arte', 'Impressão', 'Corte e Dobra', 'Furação', 'Costura', 'Capa e Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'velas_cosmeticos', nome: 'Velas e Cosméticos',        emoji: '🕯️', setores: ['Formulação', 'Produção', 'Rotulagem', 'Embalagem', 'Expedição'] },
  { id: 'macrame',          nome: 'Macramê e Têxtil',          emoji: '🪢', setores: ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'resina',           nome: 'Resina e Acrílico',         emoji: '💎', setores: ['Design', 'Moldagem', 'Cura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'ceramica',         nome: 'Cerâmica e Barro',          emoji: '🏺', setores: ['Modelagem', 'Secagem', 'Queima', 'Pintura', 'Embalagem', 'Expedição'] },
  { id: 'bolsas',           nome: 'Bolsas e Carteiras',        emoji: '👜', setores: ['Design', 'Corte', 'Montagem', 'Acabamento', 'Embalagem', 'Expedição'] },
]

export default function ConfigProducaoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  // Estado do template
  const [templateSelecionado, setTemplateSelecionado] = useState<string | null>(null)
  const [setoresTemplate, setSetoresTemplate] = useState<string[]>([])
  const [novoSetorTemplate, setNovoSetorTemplate] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') carregarSetores()
  }, [status])

  async function carregarSetores() {
    try {
      const res = await fetch('/api/config/producao')
      const data = await res.json()
      setSetores(data.setores || [])
    } catch {
      setErro('Erro ao carregar setores')
    } finally {
      setLoading(false)
    }
  }

  // ── Template helpers ──────────────────────────────────────
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
      for (let i = 0; i < setoresTemplate.length; i++) {
        const res = await fetch('/api/config/producao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: setoresTemplate[i] }),
        })
        const data = await res.json()
        if (res.ok) setSetores(prev => [...prev, data.setor])
      }
      setTemplateSelecionado(null)
      mostrarSucesso('Setores criados com sucesso!')
    } catch {
      setErro('Erro ao criar setores')
    } finally {
      setSalvando(false)
    }
  }

  // ── Setores existentes helpers ────────────────────────────
  async function salvarOrdem(novosSetores: Setor[]) {
    setSalvando(true)
    try {
      await fetch('/api/config/producao/reordenar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setores: novosSetores.map((s, i) => ({ id: s.id, ordem: i })) }),
      })
    } finally {
      setSalvando(false)
    }
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
    setErro('')
    try {
      const res = await fetch('/api/config/producao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao adicionar'); return }
      setSetores(prev => [...prev, data.setor])
      setNovoNome('')
      mostrarSucesso('Setor adicionado!')
    } catch {
      setErro('Erro ao adicionar setor')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarEdicao(id: string) {
    if (!editandoNome.trim()) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/config/producao/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editandoNome.trim() }),
      })
      if (res.ok) {
        setSetores(prev => prev.map(s => s.id === id ? { ...s, nome: editandoNome.trim() } : s))
        setEditandoId(null)
        mostrarSucesso('Setor renomeado!')
      }
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    setSalvando(true)
    try {
      await fetch(`/api/config/producao/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !ativo }),
      })
      setSetores(prev => prev.map(s => s.id === id ? { ...s, ativo: !ativo } : s))
    } finally {
      setSalvando(false)
    }
  }

  async function removerSetor(id: string) {
    if (!confirm('Remover este setor? Esta ação não pode ser desfeita.')) return
    setSalvando(true)
    try {
      await fetch(`/api/config/producao/${id}`, { method: 'DELETE' })
      setSetores(prev => prev.filter(s => s.id !== id))
      mostrarSucesso('Setor removido!')
    } finally {
      setSalvando(false)
    }
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 3000)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Configurar Produção</h1>
            <p className="text-sm text-gray-500">Gerencie os setores do seu fluxo de produção</p>
          </div>
          {salvando && <span className="text-xs text-orange-500 animate-pulse">Salvando...</span>}
        </div>

        {/* Alertas */}
        {sucesso && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {sucesso}</div>
        )}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-600">{erro}</div>
        )}

        {/* ── SEM SETORES: mostra templates ── */}
        {setores.length === 0 && !templateSelecionado && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">⚙️</div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Nenhum setor configurado ainda</h2>
              <p className="text-sm text-gray-500">Escolha um template para começar ou adicione setores manualmente abaixo.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => selecionarTemplate(t.id)}
                  className="text-left p-3 rounded-xl border border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition"
                >
                  <div className="text-lg mb-1">{t.emoji}</div>
                  <div className="text-xs font-semibold text-gray-800 leading-tight">{t.nome}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.setores.length} setores</div>
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-2 text-center">Ou adicione o primeiro setor manualmente:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetor())}
                  placeholder="Nome do setor..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={adicionarSetor}
                  disabled={salvando || !novoNome.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 font-medium"
                >
                  + Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TEMPLATE SELECIONADO: editar antes de aplicar ── */}
        {setores.length === 0 && templateSelecionado && (
          <div className="bg-white rounded-xl border border-orange-200 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {TEMPLATES.find(t => t.id === templateSelecionado)?.emoji}{' '}
                  {TEMPLATES.find(t => t.id === templateSelecionado)?.nome}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Edite os setores antes de aplicar</p>
              </div>
              <button
                onClick={() => setTemplateSelecionado(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ← Voltar aos templates
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-3">Arraste para reordenar • ↑↓ para mover • × para remover</p>

            <div className="flex flex-col gap-2 mb-3">
              {setoresTemplate.map((setor, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragIndex !== null && dragIndex !== i) moverSetorTemplate(dragIndex, i)
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing group transition ${
                    dragIndex === i ? 'border-orange-400 bg-orange-50 opacity-50' : 'border-gray-200 bg-gray-50 hover:border-orange-300'
                  }`}
                >
                  <span className="text-xs font-bold text-orange-500 w-5 text-center">{i + 1}</span>
                  <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                  </svg>
                  <span className="flex-1 text-sm text-gray-800">{setor}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => i > 0 && moverSetorTemplate(i, i - 1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-xs">↑</button>
                    <button onClick={() => i < setoresTemplate.length - 1 && moverSetorTemplate(i, i + 1)} disabled={i === setoresTemplate.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-xs">↓</button>
                  </div>
                  <button onClick={() => removerSetorTemplate(i)} className="text-gray-300 hover:text-red-500 transition font-bold opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={novoSetorTemplate}
                onChange={e => setNovoSetorTemplate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetorTemplate())}
                placeholder="Adicionar setor..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button onClick={adicionarSetorTemplate} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg transition">
                + Adicionar
              </button>
            </div>

            <button
              onClick={aplicarTemplate}
              disabled={salvando || !setoresTemplate.length}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50"
            >
              {salvando ? 'Criando setores...' : `Aplicar template (${setoresTemplate.length} setores)`}
            </button>
          </div>
        )}

        {/* ── COM SETORES: lista editável ── */}
        {setores.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Setores do fluxo de produção</h2>
              <span className="text-xs text-gray-400">{setores.filter(s => s.ativo).length} ativo{setores.filter(s => s.ativo).length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Arraste para reordenar • Clique no nome para renomear • Use ↑↓ para mover</p>

            <div className="flex flex-col gap-2 mb-4">
              {setores.map((setor, i) => (
                <div
                  key={setor.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragIndex !== null && dragIndex !== i) moverSetor(dragIndex, i)
                    setDragIndex(null)
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 transition group ${
                    dragIndex === i ? 'border-orange-400 bg-orange-50 opacity-60'
                    : setor.ativo ? 'border-gray-200 bg-white hover:border-orange-300 cursor-grab active:cursor-grabbing'
                    : 'border-gray-100 bg-gray-50 opacity-60 cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <span className="text-xs font-bold text-orange-500 w-5 text-center flex-shrink-0">{i + 1}</span>
                  <svg className="w-3 h-3 text-gray-300 flex-shrink-0 group-hover:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                  </svg>

                  {editandoId === setor.id ? (
                    <input
                      autoFocus
                      value={editandoNome}
                      onChange={e => setEditandoNome(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') salvarEdicao(setor.id)
                        if (e.key === 'Escape') setEditandoId(null)
                      }}
                      onBlur={() => salvarEdicao(setor.id)}
                      className="flex-1 bg-orange-50 border border-orange-300 rounded px-2 py-0.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  ) : (
                    <span
                      onClick={() => { setEditandoId(setor.id); setEditandoNome(setor.nome) }}
                      className={`flex-1 text-sm cursor-pointer hover:text-orange-600 transition ${setor.ativo ? 'text-gray-900' : 'text-gray-400 line-through'}`}
                      title="Clique para renomear"
                    >
                      {setor.nome}
                    </span>
                  )}

                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => i > 0 && moverSetor(i, i - 1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 py-0.5 text-xs rounded hover:bg-gray-100 transition">↑</button>
                    <button onClick={() => i < setores.length - 1 && moverSetor(i, i + 1)} disabled={i === setores.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 py-0.5 text-xs rounded hover:bg-gray-100 transition">↓</button>
                  </div>

                  <button
                    onClick={() => toggleAtivo(setor.id, setor.ativo)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition flex-shrink-0 ${
                      setor.ativo
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                    }`}
                  >
                    {setor.ativo ? 'Ativo' : 'Inativo'}
                  </button>

                  <button
                    onClick={() => removerSetor(setor.id)}
                    className="text-gray-300 hover:text-red-500 transition font-bold opacity-0 group-hover:opacity-100"
                  >×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetor())}
                placeholder="Nome do novo setor..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                onClick={adicionarSetor}
                disabled={salvando || !novoNome.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50 font-medium"
              >
                + Adicionar
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          Setores inativos não aparecem no fluxo mas mantêm o histórico
        </p>
      </div>
    </div>
  )
}
