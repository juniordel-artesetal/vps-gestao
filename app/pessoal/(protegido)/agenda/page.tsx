'use client'
// Super Agenda — Calendário (mês/semana). Tarefas por prazo; arrastar entre dias muda o prazo.
// Carrega só o intervalo visível (GET ?de&ate). Painel "Adicionar à agenda" (.ics / Google / assinatura).
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays, Download, Link2, RefreshCw, Copy, Check, ListTodo } from 'lucide-react'
import { linkGoogleCalendar } from '@/lib/pessoal/ics'

interface Tarefa { id: string; titulo: string; prazo?: string; prioridade: string; status: string }
const PRIO_DOT: Record<string, string> = { ALTA: 'bg-red-500', MEDIA: 'bg-amber-500', BAIXA: 'bg-gray-400' }
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function AgendaPage() {
  const [modo, setModo] = useState<'mes' | 'semana'>('mes')
  const [ancora, setAncora] = useState(() => new Date())
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [painel, setPainel] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const dragId = useRef<string | null>(null)

  // Intervalo visível.
  const { inicio, dias } = useMemo(() => {
    if (modo === 'semana') {
      const start = addDias(ancora, -ancora.getDay())
      return { inicio: start, dias: Array.from({ length: 7 }, (_, i) => addDias(start, i)) }
    }
    const primeiro = new Date(ancora.getFullYear(), ancora.getMonth(), 1)
    const start = addDias(primeiro, -primeiro.getDay())
    return { inicio: start, dias: Array.from({ length: 42 }, (_, i) => addDias(start, i)) }
  }, [modo, ancora])
  const fim = dias[dias.length - 1]

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/pessoal/tarefas?de=${iso(inicio)}&ate=${iso(fim)}`)
    setTarefas(r.ok ? await r.json() : [])
  }, [inicio, fim])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { fetch('/api/pessoal/agenda/token').then(r => r.ok ? r.json() : {}).then((d: any) => setToken(d?.token ?? null)).catch(() => {}) }, [])

  const porDia = useMemo(() => {
    const m = new Map<string, Tarefa[]>()
    for (const t of tarefas) { const d = t.prazo?.slice(0, 10); if (!d) continue; if (!m.has(d)) m.set(d, []); m.get(d)!.push(t) }
    return m
  }, [tarefas])

  async function soltarNoDia(diaISO: string) {
    const id = dragId.current; dragId.current = null
    if (!id) return
    const t = tarefas.find(x => x.id === id); if (!t || t.prazo?.slice(0, 10) === diaISO) return
    setTarefas(ts => ts.map(x => x.id === id ? { ...x, prazo: diaISO } : x))
    await fetch(`/api/pessoal/tarefas/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: t.titulo, prazo: diaISO, prioridade: t.prioridade, status: t.status }),
    })
  }

  const hojeISO = iso(new Date())
  const feedUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/pessoal/agenda/feed/${token}` : ''
  const webcalUrl = feedUrl.replace(/^https?:\/\//, 'webcal://')

  async function gerarToken() { const r = await fetch('/api/pessoal/agenda/token', { method: 'POST' }); if (r.ok) setToken((await r.json()).token) }
  async function revogar() { if (!confirm('Revogar o link? Ele para de funcionar na hora.')) return; await fetch('/api/pessoal/agenda/token', { method: 'DELETE' }); setToken(null) }
  function copiar() { navigator.clipboard?.writeText(feedUrl).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }) }

  const titulo = modo === 'semana'
    ? `${dias[0].getDate()}–${dias[6].getDate()} ${MESES[dias[6].getMonth()]} ${dias[6].getFullYear()}`
    : `${MESES[ancora.getMonth()]} ${ancora.getFullYear()}`

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex-wrap">
        <Link href="/pessoal" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-orange-500" /> Agenda</h1>
        <Link href="/pessoal/tarefas" className="text-sm text-orange-500 hover:underline flex items-center gap-1"><ListTodo className="w-4 h-4" /> Lista</Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
            {(['mes', 'semana'] as const).map(m => <button key={m} onClick={() => setModo(m)} className={`px-3 py-1.5 text-sm ${modo === m ? 'bg-orange-500 text-white' : 'text-gray-500'}`}>{m === 'mes' ? 'Mês' : 'Semana'}</button>)}
          </div>
          <button onClick={() => setPainel(p => !p)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-1"><Link2 className="w-4 h-4" /> Adicionar à agenda</button>
        </div>
      </div>

      {painel && (
        <div className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/pessoal/agenda/ics" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800"><Download className="w-4 h-4 text-orange-500" /> Baixar todas (.ics)</a>
            <span className="text-gray-400">ou</span>
            <div className="flex-1 min-w-[280px]">
              <p className="font-medium text-gray-700 dark:text-neutral-200 mb-1 flex items-center gap-1"><RefreshCw className="w-4 h-4 text-orange-500" /> Assinar sua agenda (atualiza sozinho)</p>
              {token ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input readOnly value={feedUrl} className="flex-1 min-w-[220px] text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-500" />
                  <button onClick={copiar} className="px-2.5 py-1.5 rounded-lg bg-orange-500 text-white text-xs flex items-center gap-1">{copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}</button>
                  <a href={webcalUrl} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs">Abrir no app</a>
                  <button onClick={revogar} className="px-2.5 py-1.5 rounded-lg text-xs text-red-500 hover:underline">Revogar</button>
                </div>
              ) : (
                <button onClick={gerarToken} className="px-3 py-2 rounded-lg bg-orange-500 text-white text-sm">Gerar link de assinatura</button>
              )}
              <p className="text-xs text-gray-400 mt-1">O link mostra só título e prazo — nada do conteúdo. Cole no Google Agenda → Adicionar calendário → De um URL. (O Google pode levar algumas horas pra atualizar.)</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setAncora(a => addDias(a, modo === 'semana' ? -7 : -30))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
          <button onClick={() => setAncora(new Date())} className="px-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300">Hoje</button>
          <button onClick={() => setAncora(a => addDias(a, modo === 'semana' ? 7 : 30))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
        </div>
        <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200 capitalize">{titulo}</span>
      </div>

      <div className="flex-1 px-2 pb-2 min-h-0">
        <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
          {DIAS.map(d => <div key={d} className="bg-white dark:bg-neutral-900 text-center text-xs font-semibold text-gray-400 py-1.5 uppercase">{d}</div>)}
          {dias.map(d => {
            const di = iso(d)
            const doMes = d.getMonth() === ancora.getMonth() || modo === 'semana'
            const ehHoje = di === hojeISO
            const lista = porDia.get(di) || []
            return (
              <div key={di} onDragOver={e => e.preventDefault()} onDrop={() => soltarNoDia(di)}
                className={`bg-white dark:bg-neutral-900 ${modo === 'mes' ? 'min-h-[92px]' : 'min-h-[62vh]'} p-1 ${doMes ? '' : 'opacity-40'}`}>
                <div className={`text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full ${ehHoje ? 'bg-orange-500 text-white font-bold' : 'text-gray-400'}`}>{d.getDate()}</div>
                <div className="space-y-1">
                  {lista.map(t => (
                    <div key={t.id} draggable onDragStart={() => { dragId.current = t.id }}
                      className={`text-[11px] px-1.5 py-1 rounded-md truncate cursor-grab flex items-center gap-1 ${t.status === 'CONCLUIDA' ? 'line-through text-gray-400 bg-gray-50 dark:bg-neutral-800' : 'bg-orange-50 dark:bg-orange-500/10 text-gray-700 dark:text-neutral-200'}`}
                      title={t.titulo}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIO_DOT[t.prioridade] || 'bg-gray-400'}`} />
                      <span className="truncate">{t.titulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Arraste uma tarefa para outro dia para mudar o prazo.</p>
      </div>
    </div>
  )
}
