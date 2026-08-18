'use client'
// Notas pessoais — layout 3 colunas estilo Evernote: nav (cadernos/tags/filtros) · lista · editor Tiptap.
// Autosave (debounce). Tudo privado por userId (as rotas garantem). Dark mode + laranja do app.
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, Plus, Search, Pin, Star, Archive, Trash2, BookOpen, Tag as TagIcon,
  FileText, X, ChevronRight, ArchiveRestore,
} from 'lucide-react'

const EditorNota = dynamic(() => import('@/components/pessoal/EditorNota'), { ssr: false })

interface Tag { id: string; nome: string; cor?: string; notas?: number }
interface Caderno { id: string; nome: string; cor?: string; icone?: string; ordem: number; arquivado: boolean; notas?: number }
interface Nota { id: string; titulo?: string; resumo?: string; cor?: string; fixada: boolean; favorita: boolean; arquivada: boolean; cadernoId?: string; temImagem?: boolean; updatedAt: string; tags: Tag[] }
interface NotaDetalhe extends Nota { conteudo?: string; tagIds: string[] }
interface Anexo { id: string; nome: string; url: string; tipo?: string; tamanho: number; createdAt: string }
const kb = (n: number) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'

type View = { tipo: 'todas' | 'fixadas' | 'favoritas' | 'arquivadas' | 'sem' } | { tipo: 'caderno'; id: string } | { tipo: 'tag'; id: string }

export default function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [cadernos, setCadernos] = useState<Caderno[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [view, setView] = useState<View>({ tipo: 'todas' })
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<NotaDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [novaTag, setNovaTag] = useState('')
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [subindo, setSubindo] = useState(false)
  const saveTimer = useRef<any>(null)
  const anexoRef = useRef<HTMLInputElement>(null)

  const queryDe = useCallback((v: View, q: string) => {
    const p = new URLSearchParams()
    if (v.tipo === 'favoritas') p.set('favoritas', '1')
    if (v.tipo === 'arquivadas') p.set('arquivadas', '1')
    if (v.tipo === 'sem') p.set('caderno', 'sem')
    if (v.tipo === 'caderno') p.set('caderno', v.id)
    if (v.tipo === 'tag') p.set('tag', v.id)
    if (q.trim()) p.set('q', q.trim())
    return p.toString()
  }, [])

  const carregarNotas = useCallback(async (v: View, q: string) => {
    setLoading(true)
    try {
      const r = await fetch('/api/pessoal/notas?' + queryDe(v, q))
      let arr: Nota[] = r.ok ? await r.json() : []
      if (v.tipo === 'fixadas') arr = arr.filter(n => n.fixada)
      setNotas(arr)
    } finally { setLoading(false) }
  }, [queryDe])

  const carregarLaterais = useCallback(async () => {
    const [rc, rt] = await Promise.all([fetch('/api/pessoal/cadernos'), fetch('/api/pessoal/tags')])
    setCadernos(rc.ok ? await rc.json() : [])
    setTags(rt.ok ? await rt.json() : [])
  }, [])

  useEffect(() => { carregarLaterais() }, [carregarLaterais])
  useEffect(() => { carregarNotas(view, busca) }, [view, busca, carregarNotas])

  async function abrir(id: string) {
    setSelId(id); setAnexos([])
    const r = await fetch(`/api/pessoal/notas/${id}`)
    setDetalhe(r.ok ? await r.json() : null)
    carregarAnexos(id)
  }
  async function carregarAnexos(id: string) {
    const r = await fetch('/api/pessoal/anexos?nota=' + id)
    setAnexos(r.ok ? await r.json() : [])
  }

  // Upload de anexo (imagem ou PDF) → Vercel Blob. Retorna a url (usada tb pra inserir imagem no editor).
  async function subirAnexo(file: File): Promise<string | null> {
    if (!selId) return null
    setSubindo(true)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('notaId', selId)
      const r = await fetch('/api/pessoal/anexos', { method: 'POST', body: fd })
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e?.error || 'Falha no upload'); return null }
      const a = await r.json()
      carregarAnexos(selId)
      return a.url as string
    } finally { setSubindo(false) }
  }
  async function removerAnexo(id: string) {
    await fetch(`/api/pessoal/anexos/${id}`, { method: 'DELETE' })
    if (selId) carregarAnexos(selId)
  }

  async function criar() {
    const cadernoId = view.tipo === 'caderno' ? view.id : null
    const r = await fetch('/api/pessoal/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: '', conteudo: '', cadernoId }) })
    if (!r.ok) return
    const { id } = await r.json()
    await carregarNotas(view, busca)
    abrir(id)
  }

  // Autosave (título/conteúdo) com debounce; atualiza a lista depois.
  function agendarSalvar(patch: Partial<NotaDetalhe>) {
    if (!selId) return
    setDetalhe(d => d ? { ...d, ...patch } as NotaDetalhe : d)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/pessoal/notas/${selId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      carregarNotas(view, busca)
    }, 800)
  }

  // Ações imediatas (flag/caderno/tags) — salvam na hora e refrescam.
  async function salvarJa(patch: Partial<NotaDetalhe> & { tags?: string[] }) {
    if (!selId) return
    setDetalhe(d => d ? { ...d, ...patch } as NotaDetalhe : d)
    await fetch(`/api/pessoal/notas/${selId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    await carregarNotas(view, busca); carregarLaterais()
  }

  async function excluir() {
    if (!selId || !confirm('Excluir esta nota?')) return
    await fetch(`/api/pessoal/notas/${selId}`, { method: 'DELETE' })
    setSelId(null); setDetalhe(null); carregarNotas(view, busca); carregarLaterais()
  }

  async function novoCaderno() {
    const nome = prompt('Nome do caderno:')?.trim(); if (!nome) return
    await fetch('/api/pessoal/cadernos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) })
    carregarLaterais()
  }

  async function addTag(nome: string) {
    const nm = nome.trim(); if (!nm || !detalhe) return
    const r = await fetch('/api/pessoal/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nm }) })
    if (!r.ok) return
    const { id } = await r.json()
    setNovaTag('')
    const novos = [...new Set([...(detalhe.tagIds || []), id])]
    salvarJa({ tags: novos, tagIds: novos } as any)
  }
  function removeTag(id: string) {
    if (!detalhe) return
    const novos = (detalhe.tagIds || []).filter(t => t !== id)
    salvarJa({ tags: novos, tagIds: novos } as any)
  }

  const navItem = (ativo: boolean, on: () => void, icon: React.ReactNode, label: string, count?: number, extra?: React.ReactNode) => (
    <button onClick={on} className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition ${ativo ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 font-medium' : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>
      {icon}<span className="flex-1 truncate">{label}</span>
      {extra}{count != null && <span className="text-xs text-gray-400">{count}</span>}
    </button>
  )
  const isView = (t: string, id?: string) => view.tipo === t && (!id || (view as any).id === id)
  const tagNome = (id: string) => tags.find(t => t.id === id)?.nome || '…'

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-neutral-800">
        <Link href="/pessoal" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100 flex items-center gap-2"><FileText className="w-5 h-5 text-orange-500" /> Notas</h1>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[220px_300px_1fr] min-h-0">
        {/* ── NAV ── */}
        <aside className="border-r border-gray-100 dark:border-neutral-800 p-2 overflow-y-auto hidden md:block">
          {navItem(isView('todas'), () => setView({ tipo: 'todas' }), <FileText className="w-4 h-4" />, 'Todas as notas')}
          {navItem(isView('fixadas'), () => setView({ tipo: 'fixadas' }), <Pin className="w-4 h-4" />, 'Fixadas')}
          {navItem(isView('favoritas'), () => setView({ tipo: 'favoritas' }), <Star className="w-4 h-4" />, 'Favoritas')}
          {navItem(isView('sem'), () => setView({ tipo: 'sem' }), <FileText className="w-4 h-4" />, 'Sem caderno')}

          <div className="flex items-center justify-between px-3 mt-3 mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Cadernos</span>
            <button onClick={novoCaderno} title="Novo caderno" className="p-0.5 text-gray-400 hover:text-orange-500"><Plus className="w-4 h-4" /></button>
          </div>
          {cadernos.filter(c => !c.arquivado).map(c => navItem(isView('caderno', c.id), () => setView({ tipo: 'caderno', id: c.id }), <BookOpen className="w-4 h-4" style={{ color: c.cor || undefined }} />, c.nome, c.notas))}
          {cadernos.filter(c => !c.arquivado).length === 0 && <p className="px-3 text-xs text-gray-400 py-1">Nenhum caderno.</p>}

          {tags.length > 0 && <div className="px-3 mt-3 mb-1 text-xs font-semibold text-gray-400 uppercase">Tags</div>}
          {tags.map(t => navItem(isView('tag', t.id), () => setView({ tipo: 'tag', id: t.id }), <TagIcon className="w-4 h-4" style={{ color: t.cor || undefined }} />, t.nome, t.notas))}

          <div className="mt-3">{navItem(isView('arquivadas'), () => setView({ tipo: 'arquivadas' }), <Archive className="w-4 h-4" />, 'Arquivadas')}</div>
        </aside>

        {/* ── LISTA ── */}
        <section className="border-r border-gray-100 dark:border-neutral-800 flex flex-col min-h-0">
          <div className="p-2 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-800">
            <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
            <button onClick={criar} title="Nova nota" className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : notas.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{busca ? 'Nada encontrado.' : 'Nenhuma nota aqui.'}</p>
            ) : notas.map(n => (
              <button key={n.id} onClick={() => abrir(n.id)} className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-neutral-800/60 hover:bg-gray-50 dark:hover:bg-neutral-800/50 ${selId === n.id ? 'bg-orange-50 dark:bg-orange-500/10' : ''}`}>
                <div className="flex items-center gap-1.5">
                  {n.fixada && <Pin className="w-3 h-3 text-orange-500 shrink-0" fill="currentColor" />}
                  {n.favorita && <Star className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" />}
                  <span className="font-medium text-sm text-gray-800 dark:text-neutral-100 truncate">{n.titulo || '(sem título)'}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-neutral-400 truncate mt-0.5">{n.resumo || '—'}</p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span className="text-[10px] text-gray-400">{(n.updatedAt || '').slice(0, 10)}</span>
                  {n.tags?.slice(0, 3).map(t => <span key={t.id} className="text-[10px] px-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500">{t.nome}</span>)}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── EDITOR ── */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-neutral-900">
          {!detalhe ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
              <FileText className="w-10 h-10" /><p className="text-sm">Selecione ou crie uma nota.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 px-4 pt-3 pb-2 flex-wrap">
                <button onClick={() => salvarJa({ fixada: !detalhe.fixada })} title="Fixar" className={`p-1.5 rounded-lg ${detalhe.fixada ? 'text-orange-500' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}><Pin className="w-4 h-4" fill={detalhe.fixada ? 'currentColor' : 'none'} /></button>
                <button onClick={() => salvarJa({ favorita: !detalhe.favorita })} title="Favoritar" className={`p-1.5 rounded-lg ${detalhe.favorita ? 'text-amber-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}><Star className="w-4 h-4" fill={detalhe.favorita ? 'currentColor' : 'none'} /></button>
                <button onClick={() => salvarJa({ arquivada: !detalhe.arquivada })} title={detalhe.arquivada ? 'Desarquivar' : 'Arquivar'} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800">{detalhe.arquivada ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}</button>
                <div className="flex items-center gap-1 ml-1">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  <select value={detalhe.cadernoId || ''} onChange={e => salvarJa({ cadernoId: e.target.value || undefined })} className="text-sm bg-transparent border border-gray-200 dark:border-neutral-700 rounded-lg px-2 py-1 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">Sem caderno</option>
                    {cadernos.filter(c => !c.arquivado).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <button onClick={excluir} title="Excluir" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 ml-auto"><Trash2 className="w-4 h-4" /></button>
              </div>

              <input value={detalhe.titulo || ''} onChange={e => agendarSalvar({ titulo: e.target.value })} placeholder="Título" className="px-4 pb-2 text-2xl font-bold bg-transparent outline-none text-gray-800 dark:text-neutral-100 w-full" />

              {/* Tags da nota */}
              <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
                {(detalhe.tagIds || []).map(id => (
                  <span key={id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                    {tagNome(id)}<button onClick={() => removeTag(id)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                <input value={novaTag} onChange={e => setNovaTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTag(novaTag) }} list="pessoal-tags" placeholder="+ tag" className="text-xs px-2 py-0.5 w-24 bg-transparent border border-dashed border-gray-300 dark:border-neutral-700 rounded-full outline-none focus:border-orange-400" />
                <datalist id="pessoal-tags">{tags.map(t => <option key={t.id} value={t.nome} />)}</datalist>
              </div>

              <div className="flex-1 min-h-0 px-4 pb-2 flex flex-col">
                <div className="flex-1 min-h-0">
                  <EditorNota key={detalhe.id} initialHtml={detalhe.conteudo || ''} onChange={html => agendarSalvar({ conteudo: html })} onUploadImage={subirAnexo} />
                </div>
                {/* Anexos (Fase 3 — Vercel Blob) */}
                <div className="border-t border-gray-100 dark:border-neutral-800 pt-2 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Anexos</span>
                    <button onClick={() => anexoRef.current?.click()} disabled={subindo} className="text-xs text-orange-500 hover:underline disabled:opacity-50">{subindo ? 'Enviando…' : '+ Anexar arquivo'}</button>
                    <input ref={anexoRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirAnexo(f); e.target.value = '' }} />
                  </div>
                  {anexos.length === 0 ? <p className="text-xs text-gray-400 pb-1">Nenhum anexo.</p> : (
                    <div className="flex flex-wrap gap-2 pb-1">
                      {anexos.map(a => (
                        <div key={a.id} className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-neutral-700 rounded-lg px-2 py-1">
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-neutral-300 hover:text-orange-500 truncate max-w-[160px]">📎 {a.nome}</a>
                          <span className="text-gray-400">{kb(a.tamanho)}</span>
                          <button onClick={() => removerAnexo(a.id)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
