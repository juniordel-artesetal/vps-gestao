'use client'
// Tarefas pessoais: visão LISTA (por status) + AGENDA (por prazo), filtros, prioridade, concluir.
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Check, Pencil, Trash2, X, Circle, Clock, CheckCircle2, ImageIcon, Bell, FileText } from 'lucide-react'
import { comprimirImagem } from '@/lib/pessoal/imagemClient'

const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
const PRIO: Record<string, { l: string; c: string }> = { ALTA: { l: 'Alta', c: 'bg-red-100 text-red-600' }, MEDIA: { l: 'Média', c: 'bg-amber-100 text-amber-600' }, BAIXA: { l: 'Baixa', c: 'bg-gray-100 text-gray-500' } }
const brDate = (s?: string) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}` }
interface T { id: string; titulo: string; descricao?: string; prazo?: string; prioridade: string; status: string; concluidaEm?: string; temImagem?: boolean; lembrete?: string; notaId?: string }
interface NotaMini { id: string; titulo?: string }

export default function TarefasPage() {
  const [rows, setRows] = useState<T[]>([]); const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'lista' | 'agenda'>('lista'); const [filtro, setFiltro] = useState('')
  const [de, setDe] = useState(''); const [ate, setAte] = useState('')
  const [modal, setModal] = useState(false); const [edit, setEdit] = useState<T | null>(null)
  const [form, setForm] = useState<any>({ prioridade: 'MEDIA', status: 'PENDENTE' })
  const [img, setImg] = useState<string | null | undefined>(undefined); const [imgBusy, setImgBusy] = useState(false)
  const [notas, setNotas] = useState<NotaMini[]>([])

  const carregar = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/pessoal/tarefas'); setRows(r.ok ? await r.json() : []) } finally { setLoading(false) } }, [])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { fetch('/api/pessoal/notas').then(r => r.ok ? r.json() : []).then((ns: any[]) => setNotas(ns.map(n => ({ id: n.id, titulo: n.titulo })))).catch(() => {}) }, [])
  const notaTitulo = (id?: string) => notas.find(n => n.id === id)?.titulo || 'nota'
  function novo() { setEdit(null); setForm({ prioridade: 'MEDIA', status: 'PENDENTE' }); setImg(undefined); setModal(true) }
  function editar(t: T) { setEdit(t); setForm({ ...t, prazo: t.prazo?.slice(0, 10) }); setImg(undefined); setModal(true) }
  async function escolherImg(file?: File) { if (!file) return; setImgBusy(true); try { setImg(await comprimirImagem(file)) } catch { alert('Não foi possível ler a imagem.') } finally { setImgBusy(false) } }
  async function salvar() { if (!form.titulo?.trim()) return alert('Informe o título.'); const body: any = { ...form }; if (img !== undefined) body.imagem = img === null ? '' : img; await fetch(edit ? `/api/pessoal/tarefas/${edit.id}` : '/api/pessoal/tarefas', { method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setModal(false); carregar() }
  async function ciclar(t: T) { const prox = t.status === 'PENDENTE' ? 'EM_ANDAMENTO' : t.status === 'EM_ANDAMENTO' ? 'CONCLUIDA' : 'PENDENTE'; await fetch(`/api/pessoal/tarefas/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: prox }) }); carregar() }
  async function excluir(t: T) { if (!confirm('Excluir tarefa?')) return; await fetch(`/api/pessoal/tarefas/${t.id}`, { method: 'DELETE' }); carregar() }

  const hojeISO = new Date().toISOString().slice(0, 10)
  const fim = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const filtradas = rows.filter(t => {
    const prazo = t.prazo?.slice(0, 10)
    if (de && (!prazo || prazo < de)) return false
    if (ate && (!prazo || prazo > ate)) return false
    if (filtro === 'hoje') return prazo === hojeISO && t.status !== 'CONCLUIDA'
    if (filtro === 'proximas') return prazo && prazo >= hojeISO && prazo <= fim && t.status !== 'CONCLUIDA'
    if (filtro === 'atrasadas') return prazo && prazo < hojeISO && t.status !== 'CONCLUIDA'
    if (filtro === 'concluidas') return t.status === 'CONCLUIDA'
    if (['ALTA', 'MEDIA', 'BAIXA'].includes(filtro)) return t.prioridade === filtro
    return true
  })
  const Icon = (s: string) => s === 'CONCLUIDA' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : s === 'EM_ANDAMENTO' ? <Clock className="w-5 h-5 text-blue-500" /> : <Circle className="w-5 h-5 text-gray-300" />

  const Card = (t: T) => {
    const dia = t.prazo?.slice(0, 10)
    const concl = t.status === 'CONCLUIDA'
    const atrasada = dia && dia < hojeISO && !concl
    const ehHoje = dia === hojeISO && !concl
    // Badge tricolor: atrasada=vermelho, hoje=amarelo, futuro=verde.
    const prazoCls = atrasada ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
      : ehHoje ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
    return (
      <div key={t.id} className={`flex items-start gap-3 rounded-xl border bg-white dark:bg-neutral-900 px-3 py-2.5 ${concl ? 'border-gray-100 dark:border-neutral-800 opacity-60' : 'border-gray-100 dark:border-neutral-800'}`}>
        <button onClick={() => ciclar(t)} className="mt-0.5">{Icon(t.status)}</button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${concl ? 'line-through text-gray-400' : 'text-gray-800 dark:text-neutral-100'}`}>{t.titulo}</p>
          {t.descricao && <p className="text-xs text-gray-400 truncate">{t.descricao}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIO[t.prioridade]?.c}`}>{PRIO[t.prioridade]?.l}</span>
            {t.prazo && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${prazoCls}`}>📅 {brDate(t.prazo)}{atrasada ? ' • atrasada' : ehHoje ? ' • hoje' : ''}</span>}
            {t.lembrete && <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400" title={`Lembrete: ${t.lembrete.replace('T', ' ')}`}><Bell className="w-3 h-3" /> {t.lembrete.slice(5, 16).replace('T', ' ')}</span>}
            {t.notaId && <Link href="/pessoal/notas" className="inline-flex items-center gap-0.5 text-[10px] text-orange-500 hover:underline"><FileText className="w-3 h-3" /> {notaTitulo(t.notaId)}</Link>}
            {t.temImagem && <ImageIcon className="w-3 h-3 text-gray-400" />}
          </div>
        </div>
        <button onClick={() => editar(t)} className="p-1 text-gray-300 hover:text-orange-500"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={() => excluir(t)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    )
  }

  const grupos = [['PENDENTE', 'A fazer'], ['EM_ANDAMENTO', 'Em andamento'], ['CONCLUIDA', 'Concluídas']]
  const agenda = [...filtradas].filter(t => t.status !== 'CONCLUIDA').sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'))

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Link href="/pessoal" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Minhas Tarefas</h1></div>
        <button onClick={novo} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"><Plus className="w-4 h-4" /> Nova</button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">{(['lista', 'agenda'] as const).map(v => <button key={v} onClick={() => setVista(v)} className={`px-3 py-1.5 text-sm ${vista === v ? 'bg-orange-500 text-white' : 'text-gray-500'}`}>{v === 'lista' ? 'Lista' : 'Agenda'}</button>)}</div>
        {[['', 'Todas'], ['hoje', 'Hoje'], ['proximas', 'Próximas'], ['atrasadas', 'Atrasadas'], ['concluidas', 'Concluídas'], ['ALTA', 'Alta']].map(([v, l]) => <button key={v} onClick={() => setFiltro(v)} className={`px-2.5 py-1 rounded-lg text-xs border ${filtro === v ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-200 dark:border-neutral-700 text-gray-500'}`}>{l}</button>)}
        <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto"><span className="hidden sm:inline">Prazo:</span><input type="date" value={de} onChange={e => setDe(e.target.value)} title="De" className={inp + ' w-auto py-1'} /><span>até</span><input type="date" value={ate} onChange={e => setAte(e.target.value)} title="Até" className={inp + ' w-auto py-1'} />{(de || ate) && <button onClick={() => { setDe(''); setAte('') }} className="text-orange-500 hover:underline">limpar</button>}</div>
      </div>
      {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : vista === 'lista' ? (
        <div className="space-y-4">{grupos.map(([st, tit]) => { const l = filtradas.filter(t => t.status === st); if (!l.length) return null; return <div key={st}><h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">{tit} · {l.length}</h3><div className="space-y-2">{l.map(Card)}</div></div> })}{filtradas.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Nenhuma tarefa.</p>}</div>
      ) : (
        <div className="space-y-2">{agenda.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Nada agendado.</p> : agenda.map(Card)}</div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800 dark:text-neutral-100">{edit ? 'Editar' : 'Nova'} tarefa</h2><button onClick={() => setModal(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <input value={form.titulo || ''} onChange={e => setForm((f: any) => ({ ...f, titulo: e.target.value }))} placeholder="Título *" className={inp} />
            <textarea value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" rows={2} className={inp} />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={form.prazo || ''} onChange={e => setForm((f: any) => ({ ...f, prazo: e.target.value }))} className={inp} />
              <select value={form.prioridade} onChange={e => setForm((f: any) => ({ ...f, prioridade: e.target.value }))} className={inp}><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option></select>
            </div>
            <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))} className={inp}><option value="PENDENTE">A fazer</option><option value="EM_ANDAMENTO">Em andamento</option><option value="CONCLUIDA">Concluída</option></select>
            <label className="block text-xs text-gray-500 dark:text-neutral-400"><span className="flex items-center gap-1 mb-1"><Bell className="w-3.5 h-3.5" /> Lembrete (opcional)</span>
              <input type="datetime-local" value={form.lembrete || ''} onChange={e => setForm((f: any) => ({ ...f, lembrete: e.target.value }))} className={inp} />
            </label>
            <label className="block text-xs text-gray-500 dark:text-neutral-400"><span className="flex items-center gap-1 mb-1"><FileText className="w-3.5 h-3.5" /> Vincular a uma nota (opcional)</span>
              <select value={form.notaId || ''} onChange={e => setForm((f: any) => ({ ...f, notaId: e.target.value }))} className={inp}>
                <option value="">— nenhuma —</option>
                {notas.map(n => <option key={n.id} value={n.id}>{n.titulo || '(sem título)'}</option>)}
              </select>
            </label>
            {(() => {
              const src = typeof img === 'string' ? img : (img === undefined && edit?.temImagem ? `/api/pessoal/tarefas/${edit.id}/imagem` : null)
              if (src) return (
                <div className="flex items-center gap-3"><a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="imagem" className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-neutral-700" /></a><label className="text-xs text-orange-500 cursor-pointer hover:underline">Trocar<input type="file" accept="image/*" className="hidden" onChange={e => escolherImg(e.target.files?.[0])} /></label><button type="button" onClick={() => setImg(null)} className="text-xs text-red-500 hover:underline">Remover</button></div>
              )
              return <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-orange-500"><ImageIcon className="w-4 h-4" /> {imgBusy ? 'Processando…' : (img === null ? 'Removida — anexar outra' : 'Anexar imagem')}<input type="file" accept="image/*" className="hidden" onChange={e => escolherImg(e.target.files?.[0])} /></label>
            })()}
            <div className="flex justify-end gap-2"><button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button><button onClick={salvar} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Salvar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
