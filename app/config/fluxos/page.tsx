'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Pencil, Trash2, X, Check, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'

interface Setor { id: string; nome: string; icone: string; cor: string }
interface FluxoSetor { fmsId: string; ordem: number; setorId: string; nome: string }
interface Fluxo { id: string; segmentoId: string; nome: string; emoji: string; ativo: boolean; setores: FluxoSetor[] }

const inputClass = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400'

export default function FluxosPage() {
  const { data: session } = useSession()
  const [fluxos, setFluxos] = useState<Fluxo[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [modalFluxo, setModalFluxo] = useState(false)
  const [editando, setEditando] = useState<Fluxo | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formEmoji, setFormEmoji] = useState('⚙️')
  const [formSetorIds, setFormSetorIds] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [rf, rs] = await Promise.all([
        fetch('/api/config/fluxos'),
        fetch('/api/producao/setores'),
      ])
      const fdata = await rf.json()
      const sdata = await rs.json()
      setFluxos(Array.isArray(fdata) ? fdata : [])
      setSetores(Array.isArray(sdata) ? sdata : (sdata.setores || []))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setFormNome('')
    setFormEmoji('⚙️')
    setFormSetorIds([])
    setModalFluxo(true)
  }

  function abrirEditar(f: Fluxo) {
    setEditando(f)
    setFormNome(f.nome)
    setFormEmoji(f.emoji)
    setFormSetorIds(f.setores.sort((a, b) => a.ordem - b.ordem).map(s => s.setorId))
    setModalFluxo(true)
  }

  async function handleSalvar() {
    if (!formNome.trim() || formSetorIds.length === 0) return
    setSalvando(true)
    try {
      if (editando) {
        await fetch(`/api/config/fluxos/${editando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: formNome, emoji: formEmoji, setorIds: formSetorIds }),
        })
      } else {
        await fetch('/api/config/fluxos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: formNome, emoji: formEmoji, segmentoId: formNome.toLowerCase().replace(/\s+/g, '_'), setorIds: formSetorIds }),
        })
      }
      setModalFluxo(false)
      carregar()
    } finally { setSalvando(false) }
  }

  async function handleExcluir(f: Fluxo) {
    if (!confirm(`Excluir o fluxo "${f.nome}"? Pedidos existentes não serão afetados.`)) return
    const res = await fetch(`/api/config/fluxos/${f.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Erro ao excluir'); return }
    carregar()
  }

  function toggleSetor(id: string) {
    setFormSetorIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  function moverFormSetor(de: number, para: number) {
    setFormSetorIds(prev => {
      const arr = [...prev]
      const [item] = arr.splice(de, 1)
      arr.splice(para, 0, item)
      return arr
    })
  }

  if (session?.user?.role !== 'ADMIN') return (
    <div className="p-8 text-center text-gray-500">Acesso restrito a administradores</div>
  )

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Fluxos de Produção</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie os modelos de fluxo para cada tipo de produto</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">
          <Plus size={16} />Novo fluxo
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : fluxos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-3">Nenhum fluxo configurado</p>
          <button onClick={abrirNovo} className="text-orange-500 text-sm hover:underline">Criar primeiro fluxo</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {fluxos.map(f => (
            <div key={f.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setExpandido(expandido === f.id ? null : f.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <span className="text-xl">{f.emoji}</span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{f.nome}</div>
                    <div className="text-xs text-gray-400">{f.setores.length} setor{f.setores.length !== 1 ? 'es' : ''}</div>
                  </div>
                  {expandido === f.id
                    ? <ChevronUp size={14} className="text-gray-400 ml-auto" />
                    : <ChevronDown size={14} className="text-gray-400 ml-auto" />
                  }
                </button>
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={() => abrirEditar(f)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleExcluir(f)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandido === f.id && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {f.setores.sort((a, b) => a.ordem - b.ordem).map((s, i) => (
                      <div key={s.fmsId} className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-bold text-orange-500">{i + 1}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{s.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal criar/editar ── */}
      {modalFluxo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {editando ? 'Editar fluxo' : 'Novo fluxo'}
              </h2>
              <button onClick={() => setModalFluxo(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Emoji</label>
                  <input className={inputClass} value={formEmoji}
                    onChange={e => setFormEmoji(e.target.value)} maxLength={2} />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome do fluxo *</label>
                  <input className={inputClass} placeholder="Ex: Sublimação, Biscuit..."
                    value={formNome} onChange={e => setFormNome(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Setores deste fluxo *
                  <span className="text-gray-400 font-normal ml-1">(marque e reordene)</span>
                </label>

                {/* Setores selecionados com ordem */}
                {formSetorIds.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-3 p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-100 dark:border-orange-500/20">
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Ordem do fluxo:</p>
                    {formSetorIds.map((sid, i) => {
                      const s = setores.find(x => x.id === sid)
                      if (!s) return null
                      return (
                        <div key={sid}
                          draggable
                          onDragStart={() => setDragIdx(i)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) moverFormSetor(dragIdx, i); setDragIdx(null) }}
                          onDragEnd={() => setDragIdx(null)}
                          className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 border border-orange-200 dark:border-orange-500/30 cursor-grab">
                          <GripVertical size={12} className="text-gray-400" />
                          <span className="text-xs font-bold text-orange-500 w-4">{i + 1}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{s.nome}</span>
                          <button onClick={() => toggleSetor(sid)} className="text-gray-400 hover:text-red-400 text-xs">×</button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Setores disponíveis */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  {setores.length === 0 ? (
                    <p className="text-xs text-gray-400 p-3">Nenhum setor cadastrado</p>
                  ) : (
                    setores.map((s, i) => {
                      const sel = formSetorIds.includes(s.id)
                      return (
                        <label key={s.id}
                          className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition ${
                            i < setores.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                          } ${sel ? 'bg-orange-50 dark:bg-orange-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                          <input type="checkbox" className="accent-orange-500" checked={sel}
                            onChange={() => toggleSetor(s.id)} />
                          <span className="text-sm text-gray-800 dark:text-white">{s.nome}</span>
                          {sel && (
                            <span className="ml-auto text-xs text-orange-500 font-medium">
                              #{formSetorIds.indexOf(s.id) + 1}
                            </span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
                {formSetorIds.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">Arraste os setores acima para reordenar</p>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-3 flex-shrink-0">
              <button onClick={() => setModalFluxo(false)}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={salvando || !formNome || formSetorIds.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {salvando ? 'Salvando...' : <><Check size={14} />{editando ? 'Salvar' : 'Criar fluxo'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
