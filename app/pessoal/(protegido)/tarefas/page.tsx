'use client'
// Super Agenda — Tarefas premium: 3 áreas (visões · lista com quick-add e arrastar p/ reordenar ·
// detalhe com subtarefas/progresso e vínculo com nota). Privado por userId (as rotas garantem).
// Visual das Notas: orange-500, cards, dark mode.
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Circle, Clock, CheckCircle2, Trash2, X, Bell, FileText, ListTodo,
  CalendarDays, Sun, CalendarClock, AlertTriangle, Inbox, CheckCheck, GripVertical, Flag,
} from 'lucide-react'

const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
const PRIO: Record<string, { l: string; c: string }> = {
  ALTA: { l: 'Alta', c: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
  MEDIA: { l: 'Média', c: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
  BAIXA: { l: 'Baixa', c: 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400' },
}
const brDate = (s?: string) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}` }
const hojeISO = () => new Date().toISOString().slice(0, 10)
const maisDias = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

interface Sub { id: string; titulo: string; concluida: boolean; ordem: number }
interface Tarefa { id: string; titulo: string; descricao?: string; prazo?: string; prioridade: string; status: string; notaId?: string; lembrete?: string; ordem: number; subTotal: number; subFeitas: number; temImagem?: boolean }
interface NotaMini { id: string; titulo?: string }
type ViewId = 'todas' | 'hoje' | 'proximas' | 'atrasadas' | 'semPrazo' | 'concluidas' | 'alta'

const VIEWS: { id: ViewId; label: string; icon: any }[] = [
  { id: 'todas', label: 'Todas', icon: ListTodo },
  { id: 'hoje', label: 'Hoje', icon: Sun },
  { id: 'proximas', label: 'Próximas', icon: CalendarClock },
  { id: 'atrasadas', label: 'Atrasadas', icon: AlertTriangle },
  { id: 'semPrazo', label: 'Sem prazo', icon: Inbox },
  { id: 'concluidas', label: 'Concluídas', icon: CheckCheck },
  { id: 'alta', label: 'Prioridade alta', icon: Flag },
]

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [notas, setNotas] = useState<NotaMini[]>([])
  const [view, setView] = useState<ViewId>('todas')
  const [selId, setSelId] = useState<string | null>(null)
  const [subs, setSubs] = useState<Sub[]>([])
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaSub, setNovaSub] = useState('')
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<any>(null)
  const dragId = useRef<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/pessoal/tarefas'); setTarefas(r.ok ? await r.json() : []) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { fetch('/api/pessoal/notas').then(r => r.ok ? r.json() : []).then((ns: any[]) => setNotas(ns.map(n => ({ id: n.id, titulo: n.titulo })))).catch(() => {}) }, [])

  const hoje = hojeISO()
  const passa = (t: Tarefa, v: ViewId) => {
    const dia = t.prazo?.slice(0, 10)
    const ativa = t.status !== 'CONCLUIDA'
    switch (v) {
      case 'hoje': return ativa && dia === hoje
      case 'proximas': return ativa && !!dia && dia > hoje && dia <= maisDias(7)
      case 'atrasadas': return ativa && !!dia && dia < hoje
      case 'semPrazo': return ativa && !dia
      case 'concluidas': return t.status === 'CONCLUIDA'
      case 'alta': return ativa && t.prioridade === 'ALTA'
      default: return true
    }
  }
  const lista = tarefas.filter(t => passa(t, view))

  const detalhe = tarefas.find(t => t.id === selId) || null

  async function abrir(id: string) {
    setSelId(id); setSubs([])
    const r = await fetch('/api/pessoal/subtarefas?tarefa=' + id)
    setSubs(r.ok ? await r.json() : [])
  }

  async function criar() {
    const titulo = novoTitulo.trim(); if (!titulo) return
    setNovoTitulo('')
    const prazo = view === 'hoje' ? hoje : view === 'proximas' ? maisDias(1) : undefined
    await fetch('/api/pessoal/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo, prazo }) })
    carregar()
  }

  async function ciclar(t: Tarefa) {
    const prox = t.status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA'
    setTarefas(ts => ts.map(x => x.id === t.id ? { ...x, status: prox } : x))
    await fetch(`/api/pessoal/tarefas/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: prox }) })
    carregar()
  }

  // Edição do detalhe: salva o objeto completo (debounce p/ texto; imediato p/ selects/datas).
  function editar(patch: Partial<Tarefa>, imediato = false) {
    if (!detalhe) return
    const novo = { ...detalhe, ...patch }
    setTarefas(ts => ts.map(t => t.id === novo.id ? novo : t))
    const body = { titulo: novo.titulo, descricao: novo.descricao ?? '', prazo: novo.prazo ?? '', prioridade: novo.prioridade, status: novo.status, lembrete: novo.lembrete ?? '', notaId: novo.notaId ?? '' }
    const enviar = () => fetch(`/api/pessoal/tarefas/${novo.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    clearTimeout(saveTimer.current)
    if (imediato) enviar()
    else saveTimer.current = setTimeout(enviar, 700)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta tarefa?')) return
    await fetch(`/api/pessoal/tarefas/${id}`, { method: 'DELETE' })
    if (selId === id) setSelId(null)
    carregar()
  }

  // Subtarefas
  async function addSub() {
    const titulo = novaSub.trim(); if (!titulo || !selId) return
    setNovaSub('')
    await fetch('/api/pessoal/subtarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarefaId: selId, titulo }) })
    abrir(selId); carregar()
  }
  async function toggleSub(s: Sub) {
    setSubs(ss => ss.map(x => x.id === s.id ? { ...x, concluida: !x.concluida } : x))
    await fetch(`/api/pessoal/subtarefas/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concluida: !s.concluida }) })
    carregar()
  }
  async function delSub(s: Sub) {
    setSubs(ss => ss.filter(x => x.id !== s.id))
    await fetch(`/api/pessoal/subtarefas/${s.id}`, { method: 'DELETE' })
    carregar()
  }

  // Drag-and-drop p/ reordenar a lista visível.
  function onDrop(alvoId: string) {
    const from = dragId.current; dragId.current = null
    if (!from || from === alvoId) return
    const ids = lista.map(t => t.id)
    const iFrom = ids.indexOf(from), iTo = ids.indexOf(alvoId)
    if (iFrom < 0 || iTo < 0) return
    ids.splice(iTo, 0, ids.splice(iFrom, 1)[0])
    // aplica a nova ordem localmente e persiste
    const pos = new Map(ids.map((id, i) => [id, i]))
    setTarefas(ts => [...ts].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9)))
    fetch('/api/pessoal/tarefas/reordenar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
  }

  const navItem = (v: { id: ViewId; label: string; icon: any }) => {
    const ativo = view === v.id
    const Icon = v.icon
    const n = tarefas.filter(t => passa(t, v.id)).length
    return (
      <button key={v.id} onClick={() => setView(v.id)} className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition ${ativo ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 font-medium' : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>
        <Icon className="w-4 h-4" /><span className="flex-1 truncate">{v.label}</span>
        {n > 0 && <span className="text-xs text-gray-400">{n}</span>}
      </button>
    )
  }

  const Icon = (s: string) => s === 'CONCLUIDA' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : s === 'EM_ANDAMENTO' ? <Clock className="w-5 h-5 text-blue-500" /> : <Circle className="w-5 h-5 text-gray-300" />
  const notaTitulo = (id?: string) => notas.find(n => n.id === id)?.titulo || 'nota'

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
        <Link href="/pessoal" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-orange-500" /> Tarefas</h1>
        <Link href="/pessoal/agenda" className="ml-auto text-sm text-orange-500 hover:underline flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Ver agenda</Link>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[220px_320px_1fr] min-h-0">
        {/* NAV visões */}
        <aside className="border-r border-gray-100 dark:border-neutral-800 p-2 overflow-y-auto hidden md:block">
          {VIEWS.map(navItem)}
        </aside>

        {/* LISTA */}
        <section className="border-r border-gray-100 dark:border-neutral-800 flex flex-col min-h-0">
          <div className="p-2 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800">
            <Plus className="w-4 h-4 text-gray-400 shrink-0" />
            <input value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criar() }}
              placeholder="Nova tarefa… (Enter)" className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-neutral-100" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : lista.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Nada aqui.</p>
            ) : lista.map(t => {
              const dia = t.prazo?.slice(0, 10)
              const concl = t.status === 'CONCLUIDA'
              const atrasada = dia && dia < hoje && !concl
              const ehHoje = dia === hoje && !concl
              const prazoCls = atrasada ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                : ehHoje ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
              return (
                <div key={t.id} draggable onDragStart={() => { dragId.current = t.id }} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(t.id)}
                  onClick={() => abrir(t.id)}
                  className={`group flex items-start gap-2 px-3 py-2.5 border-b border-gray-50 dark:border-neutral-800/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 ${selId === t.id ? 'bg-orange-50 dark:bg-orange-500/10' : ''}`}>
                  <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                  <button onClick={e => { e.stopPropagation(); ciclar(t) }} className="mt-0.5 shrink-0">{Icon(t.status)}</button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${concl ? 'line-through text-gray-400' : 'text-gray-800 dark:text-neutral-100'}`}>{t.titulo}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIO[t.prioridade]?.c}`}>{PRIO[t.prioridade]?.l}</span>
                      {t.prazo && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${prazoCls}`}>📅 {brDate(t.prazo)}{atrasada ? ' • atrasada' : ehHoje ? ' • hoje' : ''}</span>}
                      {t.lembrete && <Bell className="w-3 h-3 text-gray-400" />}
                      {t.notaId && <FileText className="w-3 h-3 text-orange-400" />}
                      {t.subTotal > 0 && <span className="text-[10px] text-gray-400 inline-flex items-center gap-0.5"><ListTodo className="w-3 h-3" />{t.subFeitas}/{t.subTotal}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* DETALHE */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-neutral-900 overflow-y-auto">
          {!detalhe ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <CalendarDays className="w-10 h-10" /><p className="text-sm">Selecione ou crie uma tarefa.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <button onClick={() => ciclar(detalhe)} className="mt-1">{Icon(detalhe.status)}</button>
                <textarea value={detalhe.titulo} onChange={e => editar({ titulo: e.target.value })} rows={1}
                  className="flex-1 text-lg font-bold bg-transparent outline-none text-gray-800 dark:text-neutral-100 resize-none" />
                <button onClick={() => excluir(detalhe.id)} title="Excluir" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>

              <textarea value={detalhe.descricao || ''} onChange={e => editar({ descricao: e.target.value })} placeholder="Descrição…" rows={2} className={inp} />

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500 dark:text-neutral-400"><span className="block mb-0.5">Prazo</span>
                  <input type="date" value={detalhe.prazo?.slice(0, 10) || ''} onChange={e => editar({ prazo: e.target.value }, true)} className={inp} /></label>
                <label className="text-xs text-gray-500 dark:text-neutral-400"><span className="block mb-0.5">Prioridade</span>
                  <select value={detalhe.prioridade} onChange={e => editar({ prioridade: e.target.value }, true)} className={inp}>
                    <option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option>
                  </select></label>
              </div>

              <label className="block text-xs text-gray-500 dark:text-neutral-400"><span className="flex items-center gap-1 mb-0.5"><Bell className="w-3.5 h-3.5" /> Lembrete</span>
                <input type="datetime-local" value={detalhe.lembrete || ''} onChange={e => editar({ lembrete: e.target.value }, true)} className={inp} /></label>

              <label className="block text-xs text-gray-500 dark:text-neutral-400"><span className="flex items-center gap-1 mb-0.5"><FileText className="w-3.5 h-3.5" /> Vincular nota</span>
                <select value={detalhe.notaId || ''} onChange={e => editar({ notaId: e.target.value }, true)} className={inp}>
                  <option value="">— nenhuma —</option>
                  {notas.map(n => <option key={n.id} value={n.id}>{n.titulo || '(sem título)'}</option>)}
                </select></label>
              {detalhe.notaId && <Link href="/pessoal/notas" className="text-xs text-orange-500 hover:underline inline-flex items-center gap-1"><FileText className="w-3 h-3" /> abrir {notaTitulo(detalhe.notaId)}</Link>}

              {/* Subtarefas com progresso */}
              <div className="border-t border-gray-100 dark:border-neutral-800 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1"><ListTodo className="w-3.5 h-3.5" /> Subtarefas</span>
                  {subs.length > 0 && <span className="text-xs text-gray-400">{subs.filter(s => s.concluida).length}/{subs.length}</span>}
                </div>
                {subs.length > 0 && (
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 mb-2 overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all" style={{ width: `${Math.round(subs.filter(s => s.concluida).length / subs.length * 100)}%` }} />
                  </div>
                )}
                <div className="space-y-1">
                  {subs.map(s => (
                    <div key={s.id} className="group flex items-center gap-2 text-sm">
                      <button onClick={() => toggleSub(s)}>{s.concluida ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}</button>
                      <span className={`flex-1 ${s.concluida ? 'line-through text-gray-400' : 'text-gray-700 dark:text-neutral-200'}`}>{s.titulo}</span>
                      <button onClick={() => delSub(s)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                  <input value={novaSub} onChange={e => setNovaSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSub() }}
                    placeholder="Nova subtarefa… (Enter)" className="flex-1 text-sm bg-transparent outline-none text-gray-700 dark:text-neutral-200" />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
