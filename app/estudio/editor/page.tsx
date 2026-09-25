'use client'
// SOA Edition — Editor de imagem: meus designs + começar um novo (tamanho livre ou de canal).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Loader2, Palette } from 'lucide-react'
import { TAMANHOS_CANAIS, rotuloTamanho } from '@/lib/estudio/tamanhos'

interface Design { id: string; nome: string; largura: number; altura: number; previewUrl: string | null; updatedAt: string }

export default function Designs() {
  const router = useRouter()
  const [designs, setDesigns] = useState<Design[] | null>(null)
  const [tamanho, setTamanho] = useState(TAMANHOS_CANAIS[0].id)
  const [livre, setLivre] = useState({ largura: '1080', altura: '1080' })
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { fetch('/api/estudio/designs').then(r => r.json()).then(d => setDesigns(d.designs || [])).catch(() => setDesigns([])) }, [])

  async function criar() {
    setCriando(true); setErro('')
    const t = TAMANHOS_CANAIS.find(x => x.id === tamanho)
    const largura = t ? t.largura : Number(livre.largura), altura = t ? t.altura : Number(livre.altura)
    try {
      const r = await fetch('/api/estudio/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: t ? `${t.canal} ${t.rotulo}` : 'Novo design', largura, altura }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não consegui criar.')
      router.push(`/estudio/editor/${j.id}`)
    } catch (e) { setErro((e as Error).message); setCriando(false) }
  }

  async function excluir(d: Design) {
    if (!confirm(`Excluir o design "${d.nome}"? As imagens continuam em Meus arquivos.`)) return
    await fetch(`/api/estudio/designs/${d.id}`, { method: 'DELETE' })
    setDesigns(ds => (ds || []).filter(x => x.id !== d.id))
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Editor de imagem</h1>
        <p className="text-sm text-gray-500">Camadas, objeto inteligente, distorção, máscaras e ajustes — e exporta no tamanho de cada canal.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Tamanho</label>
          <select value={tamanho} onChange={e => setTamanho(e.target.value)} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-800">
            {TAMANHOS_CANAIS.map(t => <option key={t.id} value={t.id}>{rotuloTamanho(t)}</option>)}
            <option value="livre">Personalizado…</option>
          </select>
        </div>
        {tamanho === 'livre' && (
          <div className="flex items-end gap-2">
            {(['largura', 'altura'] as const).map(k => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{k === 'largura' ? 'Largura' : 'Altura'} (px)</label>
                <input value={livre[k]} onChange={e => setLivre(l => ({ ...l, [k]: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-800" />
              </div>
            ))}
          </div>
        )}
        <button onClick={criar} disabled={criando} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Novo design
        </button>
        {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
      </div>

      {designs === null ? <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
        : !designs.length ? <p className="text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">Nenhum design ainda.</p>
        : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map(d => (
              <div key={d.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                <Link href={`/estudio/editor/${d.id}`} className="block aspect-square bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                  {d.previewUrl ? <img src={d.previewUrl} alt={d.nome} className="w-full h-full object-contain" /> : <Palette className="w-8 h-8 text-gray-300" />}
                </Link>
                <div className="p-2.5 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{d.nome}</p>
                    <p className="text-[11px] text-gray-400 tabular-nums">{d.largura}×{d.altura}</p>
                  </div>
                  <button onClick={() => excluir(d)} className="text-gray-400 hover:text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
