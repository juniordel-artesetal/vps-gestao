'use client'
// Notas pessoais estilo Keep: grid de cards coloridos, fixar (pin), busca em tempo real,
// edição inline com autosave (debounce), criar/excluir. Responsivo.
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Search, Pin, Trash2, ImageIcon, X } from 'lucide-react'
import { comprimirImagem } from '@/lib/pessoal/imagemClient'

const CORES = ['#fff7ed', '#fef2f2', '#f0fdf4', '#eff6ff', '#faf5ff', '#fefce8', '#ffffff']
const CORES_DARK: Record<string, string> = { '#fff7ed': '#3a2a12', '#fef2f2': '#3a1a1a', '#f0fdf4': '#12321f', '#eff6ff': '#122436', '#faf5ff': '#241233', '#fefce8': '#33300f', '#ffffff': '#1a1a1a' }
interface N { id: string; titulo?: string; conteudo?: string; cor?: string; fixada: boolean; updatedAt: string; temImagem?: boolean }

export default function NotasPage() {
  const [rows, setRows] = useState<N[]>([]); const [loading, setLoading] = useState(true); const [busca, setBusca] = useState('')
  const [de, setDe] = useState(''); const [ate, setAte] = useState('')
  const [novoT, setNovoT] = useState(''); const [novoC, setNovoC] = useState(''); const [novoAberto, setNovoAberto] = useState(false)
  const timers = useRef<Record<string, any>>({})

  const carregar = useCallback(async () => { setLoading(true); try { const r = await fetch('/api/pessoal/notas'); setRows(r.ok ? await r.json() : []) } finally { setLoading(false) } }, [])
  useEffect(() => { carregar() }, [carregar])

  async function criar() {
    if (!novoT.trim() && !novoC.trim()) { setNovoAberto(false); return }
    await fetch('/api/pessoal/notas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: novoT, conteudo: novoC, cor: '#ffffff' }) })
    setNovoT(''); setNovoC(''); setNovoAberto(false); carregar()
  }
  // Autosave com debounce por nota.
  function editarLocal(id: string, patch: Partial<N>) {
    setRows(rs => rs.map(n => n.id === id ? { ...n, ...patch } : n))
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => { fetch(`/api/pessoal/notas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }) }, 600)
  }
  async function pin(n: N) { editarLocal(n.id, { fixada: !n.fixada }); await fetch(`/api/pessoal/notas/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fixada: !n.fixada }) }); carregar() }
  async function anexarImagem(n: N, file?: File) { if (!file) return; try { const b64 = await comprimirImagem(file); await fetch(`/api/pessoal/notas/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagem: b64 }) }); setRows(rs => rs.map(x => x.id === n.id ? { ...x, temImagem: true } : x)) } catch { alert('Não foi possível ler a imagem.') } }
  async function removerImagem(n: N) { await fetch(`/api/pessoal/notas/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagem: '' }) }); setRows(rs => rs.map(x => x.id === n.id ? { ...x, temImagem: false } : x)) }
  async function excluir(id: string) { await fetch(`/api/pessoal/notas/${id}`, { method: 'DELETE' }); setRows(rs => rs.filter(n => n.id !== id)) }

  const q = busca.toLowerCase()
  const filtradas = rows.filter(n => {
    if (q && !((n.titulo || '').toLowerCase().includes(q) || (n.conteudo || '').toLowerCase().includes(q))) return false
    const dia = (n.updatedAt || '').slice(0, 10)
    if (de && dia < de) return false
    if (ate && dia > ate) return false
    return true
  })
  const fundo = (c?: string) => { const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark'); return isDark ? (CORES_DARK[c || '#ffffff'] || '#1a1a1a') : (c || '#ffffff') }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3"><Link href="/pessoal" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Minhas Notas</h1></div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-gray-400"><input type="date" value={de} onChange={e => setDe(e.target.value)} title="De" className="px-2 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-400" /><span>até</span><input type="date" value={ate} onChange={e => setAte(e.target.value)} title="Até" className="px-2 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-400" />{(de || ate) && <button onClick={() => { setDe(''); setAte('') }} className="text-orange-500 hover:underline">limpar</button>}</div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
        </div>
      </div>

      {/* Nova nota */}
      <div className="max-w-lg mx-auto w-full rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 shadow-sm">
        {!novoAberto ? (
          <button onClick={() => setNovoAberto(true)} className="w-full text-left text-sm text-gray-400 flex items-center gap-2 py-1"><Plus className="w-4 h-4" /> Criar uma nota…</button>
        ) : (
          <div className="space-y-2">
            <input autoFocus value={novoT} onChange={e => setNovoT(e.target.value)} placeholder="Título" className="w-full bg-transparent text-sm font-semibold outline-none text-gray-800 dark:text-neutral-100" />
            <textarea value={novoC} onChange={e => setNovoC(e.target.value)} placeholder="Anote algo…" rows={3} className="w-full bg-transparent text-sm outline-none text-gray-700 dark:text-neutral-200 resize-none" />
            <div className="flex justify-end gap-2"><button onClick={() => { setNovoAberto(false); setNovoT(''); setNovoC('') }} className="px-3 py-1 text-xs text-gray-500">Cancelar</button><button onClick={criar} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium">Salvar</button></div>
          </div>
        )}
      </div>

      {loading ? <p className="text-gray-400 text-sm text-center py-8">Carregando…</p> : (
        <div className="columns-2 md:columns-3 gap-3 [&>*]:mb-3">
          {filtradas.map(n => (
            <div key={n.id} className="break-inside-avoid rounded-2xl border border-gray-100 dark:border-neutral-800 p-3 group" style={{ background: fundo(n.cor) }}>
              <div className="flex items-start justify-between gap-2">
                <input value={n.titulo || ''} onChange={e => editarLocal(n.id, { titulo: e.target.value })} placeholder="Título" className="flex-1 bg-transparent text-sm font-semibold outline-none text-gray-800 dark:text-neutral-100 min-w-0" />
                <button onClick={() => pin(n)} className={`p-0.5 ${n.fixada ? 'text-orange-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}><Pin className="w-4 h-4" fill={n.fixada ? 'currentColor' : 'none'} /></button>
              </div>
              {n.temImagem && (
                <div className="relative mt-2 group/img">
                  <a href={`/api/pessoal/notas/${n.id}/imagem`} target="_blank" rel="noopener noreferrer"><img src={`/api/pessoal/notas/${n.id}/imagem`} alt="anexo" className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 max-h-48 object-cover" /></a>
                  <button onClick={() => removerImagem(n)} className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/img:opacity-100"><X className="w-3 h-3" /></button>
                </div>
              )}
              <textarea value={n.conteudo || ''} onChange={e => { editarLocal(n.id, { conteudo: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} placeholder="Anote algo…" rows={2} className="w-full bg-transparent text-sm outline-none text-gray-700 dark:text-neutral-200 resize-none mt-1" />
              <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition">
                <div className="flex gap-1 items-center">{CORES.map(c => <button key={c} onClick={() => editarLocal(n.id, { cor: c })} className={`w-4 h-4 rounded-full border ${n.cor === c ? 'ring-2 ring-orange-400' : 'border-gray-300'}`} style={{ background: c }} />)}</div>
                <div className="flex items-center gap-1">
                  {!n.temImagem && <label className="p-1 text-gray-400 hover:text-orange-500 cursor-pointer" title="Anexar imagem"><ImageIcon className="w-3.5 h-3.5" /><input type="file" accept="image/*" className="hidden" onChange={e => anexarImagem(n, e.target.files?.[0])} /></label>}
                  <button onClick={() => excluir(n.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          {filtradas.length === 0 && <p className="text-gray-400 text-sm text-center py-6 col-span-3">{busca ? 'Nada encontrado.' : 'Nenhuma nota ainda.'}</p>}
        </div>
      )}
    </div>
  )
}
