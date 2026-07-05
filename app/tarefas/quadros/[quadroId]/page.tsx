'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners, useDroppable, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, Plus, X, Trash2, Paperclip, MessageSquare, Search, Calendar, User as UserIcon, Upload, Clock, Link as LinkIcon } from 'lucide-react'

type Etiqueta = { id: string; nome: string; cor: string }
type Card = {
  id: string; colunaId: string; titulo: string; descricao: string | null
  clienteId: string | null; responsavelId: string | null; clienteNome: string | null; responsavelNome: string | null
  prazo: string | null; prioridade: string; ordem: number; nAnexos: number; nComentarios: number
  etiquetas?: Etiqueta[]; clTotal?: number; clFeitos?: number
}
type Coluna = { id: string; nome: string; cor: string | null; ordem: number }

const PRIO: Record<string, { label: string; cor: string }> = {
  baixa: { label: 'Baixa', cor: '#94a3b8' }, normal: { label: 'Normal', cor: '#3b82f6' },
  alta: { label: 'Alta', cor: '#f59e0b' }, urgente: { label: 'Urgente', cor: '#ef4444' },
}
const hojeISO = () => new Date().toISOString().split('T')[0]
const fmtPrazo = (s: string) => { try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }

async function comprimirImagem(file: File, MAX = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } } else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const ctx = c.getContext('2d'); if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, w, h); resolve(c.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = () => reject(new Error('img')); img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('reader')); reader.readAsDataURL(file)
  })
}

function CardView({ card, onClick }: { card: Card; onClick: () => void }) {
  const vencido = card.prazo && card.prazo < hojeISO()
  return (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-2.5 shadow-sm cursor-pointer hover:border-orange-300">
      {card.etiquetas && card.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.etiquetas.map(e => <span key={e.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: e.cor }}>{e.nome}</span>)}
        </div>
      )}
      <div className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: PRIO[card.prioridade]?.cor || '#3b82f6' }} />
        <p className="text-sm text-gray-800 dark:text-white leading-snug flex-1">{card.titulo}</p>
      </div>
      {(card.clienteNome || card.responsavelNome || card.prazo) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 ml-3.5">
          {card.clienteNome && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">👤 {card.clienteNome}</span>}
          {card.prazo && <span className={`text-[10px] ${vencido ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>📅 {fmtPrazo(card.prazo)}</span>}
        </div>
      )}
      {(card.nAnexos > 0 || card.nComentarios > 0 || (card.clTotal || 0) > 0 || card.responsavelNome) && (
        <div className="flex items-center gap-2 mt-2 ml-3.5 text-[10px] text-gray-400">
          {card.nAnexos > 0 && <span className="flex items-center gap-0.5"><Paperclip size={10} /> {card.nAnexos}</span>}
          {card.nComentarios > 0 && <span className="flex items-center gap-0.5"><MessageSquare size={10} /> {card.nComentarios}</span>}
          {(card.clTotal || 0) > 0 && <span className={`flex items-center gap-0.5 ${card.clFeitos === card.clTotal ? 'text-green-500' : ''}`}>☑ {card.clFeitos}/{card.clTotal}</span>}
          {card.responsavelNome && <span className="ml-auto bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 py-0.5">{card.responsavelNome.split(' ')[0]}</span>}
        </div>
      )}
    </div>
  )
}

function SortableCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <CardView card={card} onClick={onClick} />
    </div>
  )
}

function ColunaView({ coluna, cards, onAdd, onCard, onRename, onDelete }: {
  coluna: Coluna; cards: Card[]; onAdd: () => void; onCard: (c: Card) => void; onRename: () => void; onDelete: () => void
}) {
  const { setNodeRef } = useDroppable({ id: coluna.id })
  return (
    <div className="w-72 flex-shrink-0 bg-gray-100 dark:bg-gray-800/50 rounded-xl flex flex-col max-h-full">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: coluna.cor || '#94a3b8' }} />
          <button onClick={onRename} className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{coluna.nome}</button>
          <span className="text-xs text-gray-400">{cards.length}</span>
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
      </div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[60px]">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(c => <SortableCard key={c.id} card={c} onClick={() => onCard(c)} />)}
        </SortableContext>
      </div>
      <button onClick={onAdd} className="mx-2 mb-2 text-xs text-gray-500 hover:text-orange-500 flex items-center gap-1 py-1.5 rounded-lg hover:bg-white/50">
        <Plus size={13} /> Nova tarefa
      </button>
    </div>
  )
}

export default function KanbanPage() {
  const params = useParams(); const router = useRouter()
  const quadroId = String(params?.quadroId || '')

  const [loading, setLoading] = useState(true)
  const [quadro, setQuadro] = useState<{ nome: string; cor: string | null } | null>(null)
  const [colunas, setColunas] = useState<Coluna[]>([])
  const [byCol, setByCol] = useState<Record<string, Card[]>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([])
  const [busca, setBusca] = useState('')
  const [fPrio, setFPrio] = useState('')
  const [fResp, setFResp] = useState('')
  const [fEtiq, setFEtiq] = useState('')
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [detalhe, setDetalhe] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => { carregar(); carregarAux() }, [quadroId])

  async function carregar() {
    setLoading(true)
    const d = await (await fetch(`/api/tarefas?quadroId=${quadroId}`)).json()
    if (d.error) { router.push('/tarefas/quadros'); return }
    setQuadro(d.quadro); setColunas(d.colunas || [])
    const map: Record<string, Card[]> = {}
    for (const col of d.colunas || []) map[col.id] = []
    for (const t of d.tarefas || []) { (map[t.colunaId] ||= []).push(t) }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.ordem - b.ordem)
    setByCol(map); setLoading(false)
  }
  async function carregarAux() {
    try { const c = await (await fetch('/api/clientes')).json(); const arr = Array.isArray(c) ? c : (c.clientes || []); setClientes(arr.map((x: any) => ({ id: x.id, nome: x.nome }))) } catch {}
    try { const u = await (await fetch('/api/config/usuarios')).json(); const arr = Array.isArray(u) ? u : (u.usuarios || []); setUsuarios(arr.map((x: any) => ({ id: x.id, nome: x.nome }))) } catch {}
    carregarEtiquetas()
  }
  async function carregarEtiquetas() {
    try { const e = await (await fetch('/api/tarefas/etiquetas')).json(); setEtiquetas(Array.isArray(e) ? e : []) } catch {}
  }

  // Filtro (não afeta drag: filtra a exibição)
  const filtroAtivo = busca.trim() || fPrio || fResp || fEtiq
  const passa = (c: Card) => (!busca.trim() || c.titulo.toLowerCase().includes(busca.toLowerCase()) || (c.clienteNome || '').toLowerCase().includes(busca.toLowerCase()))
    && (!fPrio || c.prioridade === fPrio) && (!fResp || c.responsavelId === fResp)
    && (!fEtiq || (c.etiquetas || []).some(e => e.id === fEtiq))

  const findCol = (cardId: string) => Object.keys(byCol).find(col => byCol[col].some(c => c.id === cardId))
  const activeCard = useMemo(() => activeId ? Object.values(byCol).flat().find(c => c.id === activeId) : null, [activeId, byCol])

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)) }

  function onDragOver(e: DragOverEvent) {
    const activeCardId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (!overId) return
    const from = findCol(activeCardId)
    const to = colunas.some(c => c.id === overId) ? overId : findCol(overId)
    if (!from || !to || from === to) return
    setByCol(prev => {
      const src = [...prev[from]]; const dst = [...prev[to]]
      const idx = src.findIndex(c => c.id === activeCardId); if (idx < 0) return prev
      const [moved] = src.splice(idx, 1)
      const overIdx = dst.findIndex(c => c.id === overId)
      dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, { ...moved, colunaId: to })
      return { ...prev, [from]: src, [to]: dst }
    })
  }

  async function onDragEnd(e: DragEndEvent) {
    const activeCardId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    setActiveId(null)
    if (!overId) return
    const col = findCol(activeCardId); if (!col) return
    // reordena dentro da coluna final
    setByCol(prev => {
      const arr = [...prev[col]]
      const oldIdx = arr.findIndex(c => c.id === activeCardId)
      let newIdx = arr.findIndex(c => c.id === overId)
      if (newIdx < 0) newIdx = arr.length - 1
      if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
        const [m] = arr.splice(oldIdx, 1); arr.splice(newIdx, 0, m)
      }
      const novo = { ...prev, [col]: arr }
      // persiste
      fetch('/api/tarefas/mover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarefaId: activeCardId, colunaId: col, ids: arr.map(c => c.id) }) }).catch(() => {})
      return novo
    })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/tarefas/quadros')} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></button>
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: quadro?.cor || '#f97316' }} />
        <h1 className="font-semibold text-gray-900 dark:text-white">{quadro?.nome}</h1>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar" className="bg-gray-100 dark:bg-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none w-40" />
        </div>
        <select value={fPrio} onChange={e => setFPrio(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800">
          <option value="">Prioridade</option>
          {Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={fResp} onChange={e => setFResp(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800">
          <option value="">Responsável</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select value={fEtiq} onChange={e => setFEtiq(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800">
          <option value="">Etiqueta</option>
          {etiquetas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-3 h-full items-start">
            {colunas.map(col => (
              <ColunaView key={col.id} coluna={col}
                cards={(byCol[col.id] || []).filter(c => !filtroAtivo || passa(c))}
                onAdd={() => novaTarefa(col.id)}
                onCard={c => setDetalhe(c.id)}
                onRename={() => renomearColuna(col)}
                onDelete={() => excluirColuna(col)} />
            ))}
            <button onClick={novaColuna} className="w-56 flex-shrink-0 text-sm text-gray-500 hover:text-orange-500 bg-gray-100 dark:bg-gray-800/50 rounded-xl py-3 flex items-center justify-center gap-1">
              <Plus size={15} /> Coluna
            </button>
          </div>
        </div>
        <DragOverlay>{activeCard ? <div className="w-72"><CardView card={activeCard} onClick={() => {}} /></div> : null}</DragOverlay>
      </DndContext>

      {detalhe && <DetalheCard tarefaId={detalhe} clientes={clientes} usuarios={usuarios} etiquetas={etiquetas} recarregarEtiquetas={carregarEtiquetas} onClose={() => setDetalhe(null)} onChanged={carregar} />}
    </div>
  )

  async function novaTarefa(colunaId: string) {
    const titulo = prompt('Título da tarefa:'); if (!titulo?.trim()) return
    const r = await (await fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quadroId, colunaId, titulo }) })).json()
    if (r.ok) carregar()
  }
  async function novaColuna() {
    const nome = prompt('Nome da coluna:'); if (!nome?.trim()) return
    await fetch('/api/tarefas/colunas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quadroId, nome }) }); carregar()
  }
  async function renomearColuna(col: Coluna) {
    const nome = prompt('Renomear coluna:', col.nome); if (nome == null || !nome.trim()) return
    await fetch(`/api/tarefas/colunas/${col.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) }); carregar()
  }
  async function excluirColuna(col: Coluna) {
    if (!confirm(`Excluir a coluna "${col.nome}"?`)) return
    const r = await fetch(`/api/tarefas/colunas/${col.id}`, { method: 'DELETE' })
    if (!r.ok) { const d = await r.json(); alert(d.error || 'Não foi possível excluir.') } else carregar()
  }
}

// ── Modal de detalhe do card ──────────────────────────────────────────────
function DetalheCard({ tarefaId, clientes, usuarios, etiquetas, recarregarEtiquetas, onClose, onChanged }: {
  tarefaId: string; clientes: { id: string; nome: string }[]; usuarios: { id: string; nome: string }[]
  etiquetas: Etiqueta[]; recarregarEtiquetas: () => void; onClose: () => void; onChanged: () => void
}) {
  const [t, setT] = useState<any>(null)
  const [novoComent, setNovoComent] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [vinculos, setVinculos] = useState<any[]>([])
  const [pickerTipo, setPickerTipo] = useState<'' | 'pedido' | 'pagamento'>('')
  const [pickerQ, setPickerQ] = useState('')
  const [pickerRes, setPickerRes] = useState<any[]>([])
  const [etiqOpen, setEtiqOpen] = useState(false)
  const [novaEtiq, setNovaEtiq] = useState('')
  const [novoItemDe, setNovoItemDe] = useState<Record<string, string>>({})
  const [mencoes, setMencoes] = useState<{ id: string; nome: string }[]>([])
  const [mostrarMencao, setMostrarMencao] = useState(false)
  const inputC = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400'

  useEffect(() => { fetch(`/api/tarefas/${tarefaId}`).then(r => r.json()).then(setT) }, [tarefaId])
  useEffect(() => { fetch(`/api/tarefas/${tarefaId}/vinculos`).then(r => r.json()).then(v => setVinculos(Array.isArray(v) ? v : [])) }, [tarefaId])
  if (!t) return null

  const buscarVinc = async (tipo: string, q: string) => {
    const r = await (await fetch(`/api/tarefas/buscar-vinculo?tipo=${tipo}&q=${encodeURIComponent(q)}`)).json()
    setPickerRes(Array.isArray(r) ? r : [])
  }
  const adicionarVinc = async (referenciaId: string) => {
    const r = await (await fetch(`/api/tarefas/${tarefaId}/vinculos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: pickerTipo, referenciaId }) })).json()
    if (r.ok) { setVinculos(v => [...v.filter(x => x.id !== r.id), { id: r.id, tipo: pickerTipo, referenciaId, rotulo: r.rotulo, href: r.href }]); setPickerTipo(''); setPickerQ(''); setPickerRes([]) }
  }
  const removerVinc = async (vid: string) => {
    await fetch(`/api/tarefas/${tarefaId}/vinculos?vinculoId=${vid}`, { method: 'DELETE' })
    setVinculos(v => v.filter(x => x.id !== vid))
  }

  const salvarCampo = async (patch: any) => {
    setT((p: any) => ({ ...p, ...patch }))
    await fetch(`/api/tarefas/${tarefaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    onChanged()
  }
  const comentar = async () => {
    if (!novoComent.trim()) return
    setSalvando(true)
    try {
      const mencionados = mencoes.filter(m => novoComent.includes('@' + m.nome)).map(m => m.id)
      const r = await (await fetch(`/api/tarefas/${tarefaId}/comentarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: novoComent, mencionados }) })).json()
      setT((p: any) => ({ ...p, comentarios: [...(p.comentarios || []), { id: r.id, autorNome: r.autorNome, texto: novoComent, createdAt: new Date().toISOString() }] }))
      setNovoComent(''); setMencoes([]); setMostrarMencao(false); onChanged()
    } finally { setSalvando(false) }
  }

  // ── Etiquetas ──
  const temEtiq = (id: string) => (t.etiquetas || []).some((e: any) => e.id === id)
  const toggleEtiq = async (et: Etiqueta) => {
    if (temEtiq(et.id)) {
      await fetch(`/api/tarefas/${tarefaId}/etiquetas?etiquetaId=${et.id}`, { method: 'DELETE' })
      setT((p: any) => ({ ...p, etiquetas: (p.etiquetas || []).filter((e: any) => e.id !== et.id) }))
    } else {
      await fetch(`/api/tarefas/${tarefaId}/etiquetas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etiquetaId: et.id }) })
      setT((p: any) => ({ ...p, etiquetas: [...(p.etiquetas || []), et] }))
    }
    onChanged()
  }
  const criarEtiq = async () => {
    if (!novaEtiq.trim()) return
    const cores = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#ef4444']
    const cor = cores[Math.floor((etiquetas.length) % cores.length)]
    await fetch('/api/tarefas/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novaEtiq.trim(), cor }) })
    setNovaEtiq(''); recarregarEtiquetas()
  }

  // ── Checklists ──
  const addChecklist = async () => {
    const r = await (await fetch(`/api/tarefas/${tarefaId}/checklists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: 'Checklist' }) })).json()
    if (r.ok) setT((p: any) => ({ ...p, checklists: [...(p.checklists || []), { id: r.id, titulo: 'Checklist', itens: [] }] }))
  }
  const delChecklist = async (clId: string) => {
    await fetch(`/api/tarefas/checklists/${clId}`, { method: 'DELETE' })
    setT((p: any) => ({ ...p, checklists: (p.checklists || []).filter((c: any) => c.id !== clId) })); onChanged()
  }
  const addItem = async (clId: string) => {
    const texto = (novoItemDe[clId] || '').trim(); if (!texto) return
    const r = await (await fetch(`/api/tarefas/checklists/${clId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) })).json()
    if (r.ok) setT((p: any) => ({ ...p, checklists: (p.checklists || []).map((c: any) => c.id === clId ? { ...c, itens: [...(c.itens || []), { id: r.id, texto, concluido: false }] } : c) }))
    setNovoItemDe(d => ({ ...d, [clId]: '' })); onChanged()
  }
  const toggleItem = async (clId: string, item: any) => {
    const novo = !item.concluido
    setT((p: any) => ({ ...p, checklists: (p.checklists || []).map((c: any) => c.id === clId ? { ...c, itens: c.itens.map((i: any) => i.id === item.id ? { ...i, concluido: novo } : i) } : c) }))
    await fetch(`/api/tarefas/checklists/${clId}/itens/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concluido: novo }) })
    onChanged()
  }
  const delItem = async (clId: string, itemId: string) => {
    await fetch(`/api/tarefas/checklists/${clId}/itens/${itemId}`, { method: 'DELETE' })
    setT((p: any) => ({ ...p, checklists: (p.checklists || []).map((c: any) => c.id === clId ? { ...c, itens: c.itens.filter((i: any) => i.id !== itemId) } : c) })); onChanged()
  }

  // ── Menção no comentário ──
  const onComentInput = (val: string) => {
    setNovoComent(val)
    const m = val.match(/@([^\s@]*)$/)
    setMostrarMencao(!!m)
  }
  const escolherMencao = (u: { id: string; nome: string }) => {
    setNovoComent(prev => prev.replace(/@([^\s@]*)$/, '@' + u.nome + ' '))
    setMencoes(prev => prev.some(x => x.id === u.id) ? prev : [...prev, u])
    setMostrarMencao(false)
  }
  const filtroMencao = (() => { const m = novoComent.match(/@([^\s@]*)$/); const q = (m?.[1] || '').toLowerCase(); return usuarios.filter(u => u.nome.toLowerCase().includes(q)).slice(0, 5) })()
  const anexar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const f of files) {
      try {
        const b64 = await comprimirImagem(f)
        const r = await (await fetch(`/api/tarefas/${tarefaId}/anexos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagem: b64, nome: f.name }) })).json()
        setT((p: any) => ({ ...p, anexos: [...(p.anexos || []), { id: r.id, nome: f.name }] }))
      } catch {}
    }
    onChanged()
  }
  const removerAnexo = async (anexoId: string) => {
    await fetch(`/api/tarefas/${tarefaId}/anexo/${anexoId}`, { method: 'DELETE' })
    setT((p: any) => ({ ...p, anexos: (p.anexos || []).filter((a: any) => a.id !== anexoId) })); onChanged()
  }
  const excluir = async () => {
    if (!confirm('Excluir esta tarefa?')) return
    await fetch(`/api/tarefas/${tarefaId}`, { method: 'DELETE' }); onChanged(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-lg sm:rounded-2xl max-h-[92vh] flex flex-col rounded-t-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <input defaultValue={t.titulo} onBlur={e => e.target.value.trim() && e.target.value !== t.titulo && salvarCampo({ titulo: e.target.value })}
            className="text-base font-semibold text-gray-900 dark:text-white bg-transparent flex-1 focus:outline-none" />
          <button onClick={onClose} className="text-gray-400 ml-2"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Campos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Prioridade</label>
              <select value={t.prioridade} onChange={e => salvarCampo({ prioridade: e.target.value })} className={inputC}>
                {Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Prazo</label>
              <input type="date" value={t.prazo || ''} onChange={e => salvarCampo({ prazo: e.target.value || null })} className={inputC} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Cliente</label>
              <select value={t.clienteId || ''} onChange={e => salvarCampo({ clienteId: e.target.value || null })} className={inputC}>
                <option value="">—</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Responsável</label>
              <select value={t.responsavelId || ''} onChange={e => salvarCampo({ responsavelId: e.target.value || null })} className={inputC}>
                <option value="">—</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Etiquetas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400">Etiquetas</label>
              <button onClick={() => setEtiqOpen(o => !o)} className="text-xs text-orange-500 hover:underline">{etiqOpen ? 'Fechar' : 'Gerenciar'}</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(t.etiquetas || []).map((e: any) => (
                <span key={e.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex items-center gap-1" style={{ backgroundColor: e.cor }}>
                  {e.nome} <button onClick={() => toggleEtiq(e)}><X size={10} /></button>
                </span>
              ))}
              {(t.etiquetas || []).length === 0 && !etiqOpen && <span className="text-xs text-gray-300">Nenhuma</span>}
            </div>
            {etiqOpen && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2 space-y-1">
                {etiquetas.map(e => (
                  <button key={e.id} onClick={() => toggleEtiq(e)} className="w-full flex items-center gap-2 text-left px-2 py-1 rounded hover:bg-white dark:hover:bg-gray-600">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: e.cor }} />
                    <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">{e.nome}</span>
                    {temEtiq(e.id) && <span className="text-orange-500 text-xs">✓</span>}
                  </button>
                ))}
                <div className="flex gap-2 pt-1">
                  <input value={novaEtiq} onChange={e => setNovaEtiq(e.target.value)} onKeyDown={e => e.key === 'Enter' && criarEtiq()} placeholder="Nova etiqueta" className={inputC} />
                  <button onClick={criarEtiq} className="px-3 bg-orange-500 text-white rounded-lg text-sm">Criar</button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Descrição</label>
            <textarea defaultValue={t.descricao || ''} onBlur={e => e.target.value !== (t.descricao || '') && salvarCampo({ descricao: e.target.value })} rows={3} className={inputC} placeholder="Detalhes da tarefa..." />
          </div>

          {/* Checklists */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400">Checklists</label>
              <button onClick={addChecklist} className="text-xs text-orange-500 hover:underline">+ Checklist</button>
            </div>
            <div className="space-y-3">
              {(t.checklists || []).map((cl: any) => {
                const total = (cl.itens || []).length, feitos = (cl.itens || []).filter((i: any) => i.concluido).length
                const pct = total ? Math.round((feitos / total) * 100) : 0
                return (
                  <div key={cl.id} className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{cl.titulo}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{feitos}/{total}</span>
                        <button onClick={() => delChecklist(cl.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden mb-2"><div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                    <div className="space-y-1">
                      {(cl.itens || []).map((it: any) => (
                        <div key={it.id} className="flex items-center gap-2 group">
                          <input type="checkbox" checked={it.concluido} onChange={() => toggleItem(cl.id, it)} className="accent-green-500" />
                          <span className={`text-sm flex-1 ${it.concluido ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{it.texto}</span>
                          <button onClick={() => delItem(cl.id, it.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <input value={novoItemDe[cl.id] || ''} onChange={e => setNovoItemDe(d => ({ ...d, [cl.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addItem(cl.id)} placeholder="Adicionar item" className={inputC} />
                      <button onClick={() => addItem(cl.id)} className="px-2 text-orange-500"><Plus size={16} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Anexos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 flex items-center gap-1"><Paperclip size={12} /> Artes / imagens</label>
              <label className="text-xs text-orange-500 cursor-pointer flex items-center gap-1"><Upload size={12} /> Anexar<input type="file" accept="image/*" multiple className="hidden" onChange={anexar} /></label>
            </div>
            {(t.anexos || []).length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {t.anexos.map((a: any) => (
                  <div key={a.id} className="relative group">
                    <img src={`/api/tarefas/${tarefaId}/anexo/${a.id}`} alt={a.nome || ''} className="w-full h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                    <button onClick={() => removerAnexo(a.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vínculos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400 flex items-center gap-1"><LinkIcon size={12} /> Vínculos</label>
              {!pickerTipo && (
                <div className="flex gap-1">
                  <button onClick={() => { setPickerTipo('pedido'); setPickerRes([]); buscarVinc('pedido', '') }} className="text-xs text-orange-500 hover:underline">+ Pedido</button>
                  <button onClick={() => { setPickerTipo('pagamento'); setPickerRes([]); buscarVinc('pagamento', '') }} className="text-xs text-orange-500 hover:underline">+ Pagamento</button>
                </div>
              )}
            </div>
            {pickerTipo && (
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2 mb-2">
                <div className="flex gap-2 mb-2">
                  <input autoFocus value={pickerQ} onChange={e => { setPickerQ(e.target.value); buscarVinc(pickerTipo, e.target.value) }} placeholder={`Buscar ${pickerTipo}...`} className={inputC} />
                  <button onClick={() => { setPickerTipo(''); setPickerQ(''); setPickerRes([]) }} className="text-gray-400"><X size={16} /></button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {pickerRes.length === 0 ? <p className="text-xs text-gray-400 py-1">Nenhum resultado.</p> : pickerRes.map((it: any) => (
                    <button key={it.referenciaId} onClick={() => adicionarVinc(it.referenciaId)} className="w-full text-left text-xs text-gray-700 dark:text-gray-200 px-2 py-1.5 rounded hover:bg-white dark:hover:bg-gray-600">{it.rotulo}</button>
                  ))}
                </div>
              </div>
            )}
            {vinculos.length > 0 && (
              <div className="space-y-1">
                {vinculos.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/40 rounded-lg px-2.5 py-1.5">
                    <a href={v.href || '#'} className="text-xs text-gray-700 dark:text-gray-200 truncate hover:text-orange-500">
                      <span className="text-[10px] uppercase text-gray-400 mr-1">{v.tipo}</span>{v.rotulo}
                    </a>
                    <button onClick={() => removerVinc(v.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comentários */}
          <div>
            <label className="text-xs text-gray-400 flex items-center gap-1 mb-2"><MessageSquare size={12} /> Comentários</label>
            <div className="space-y-2 mb-2">
              {(t.comentarios || []).map((c: any) => (
                <div key={c.id} className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2">
                  <p className="text-xs text-gray-500"><strong>{c.autorNome}</strong> · {new Date(c.createdAt).toLocaleDateString('pt-BR')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{c.texto}</p>
                </div>
              ))}
            </div>
            <div className="relative">
              <div className="flex gap-2">
                <input value={novoComent} onChange={e => onComentInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !mostrarMencao) comentar() }} placeholder="Comente... use @ para mencionar" className={inputC} />
                <button onClick={comentar} disabled={salvando || !novoComent.trim()} className="px-3 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-50">Enviar</button>
              </div>
              {mostrarMencao && filtroMencao.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-48 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 overflow-hidden">
                  {filtroMencao.map(u => (
                    <button key={u.id} onClick={() => escolherMencao(u)} className="w-full text-left text-sm px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">@{u.nome}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Histórico */}
          {(t.historico || []).length > 0 && (
            <div>
              <label className="text-xs text-gray-400 flex items-center gap-1 mb-2"><Clock size={12} /> Histórico</label>
              <div className="space-y-1">
                {t.historico.map((h: any) => (
                  <p key={h.id} className="text-[11px] text-gray-400">{new Date(h.createdAt).toLocaleDateString('pt-BR')} · {h.descricao} <span className="text-gray-300">— {h.usuarioNome}</span></p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between">
          <button onClick={excluir} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"><Trash2 size={14} /> Excluir</button>
          <button onClick={onClose} className="text-sm text-gray-500 px-4 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Fechar</button>
        </div>
      </div>
    </div>
  )
}
