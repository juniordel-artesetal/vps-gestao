'use client'
// SOA Edition — MOLDES E KITS: acervo autoral de caixas (já com faces mapeadas), upload do molde próprio
// (mapeia as faces 1x) e montagem de kits (ex.: 6 caixas que andam juntas num tema).
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, Upload, Box, Check } from 'lucide-react'
import { ACERVO_CAIXAS } from '@/lib/estudio/caixasAcervo'
import { adicionarDoAcervo, listarMoldes } from '@/lib/estudio/caixasCliente'
import { carregarMolde, copiaDoCanvas, enviarArquivo } from '@/lib/estudio/cliente'
import type { MoldeCaixa } from '@/lib/estudio/caixasTipos'
import MapearFaces from './MapearFaces'
import { useBaseEstudio, inp, btn, btnP, cartao } from './comum'

type Kit = { id: string; nome: string; moldeIds: string[] }

export default function MoldesKits() {
  const { workspaceId, storage } = useBaseEstudio()
  const [moldes, setMoldes] = useState<MoldeCaixa[] | null>(null)
  const [kits, setKits] = useState<Kit[]>([])
  const [mapear, setMapear] = useState<MoldeCaixa[] | null>(null)
  const [novoKit, setNovoKit] = useState<{ nome: string; ids: string[] }>({ nome: '', ids: [] })
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState('')

  const recarregar = () => {
    listarMoldes().then(setMoldes)
    fetch('/api/estudio/kits-caixas').then(r => r.json()).then(d => setKits((d.itens || []).map((k: Record<string, unknown>) => ({ id: String(k.id), nome: String(k.nome), moldeIds: (typeof k.moldeIds === 'string' ? JSON.parse(k.moldeIds) : k.moldeIds) as string[] })))).catch(() => {})
  }
  useEffect(recarregar, [])
  const noAcervo = useMemo(() => new Set((moldes || []).map(m => m.acervoId).filter(Boolean)), [moldes])
  const miniSvg = useMemo(() => Object.fromEntries(ACERVO_CAIXAS.map(d => [d.id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(d.svg)}`])), [])

  async function adicionar(id: string) {
    const def = ACERVO_CAIXAS.find(d => d.id === id); if (!def) return
    setOcupado(def.nome); setErro('')
    try { await adicionarDoAcervo(def); recarregar() } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  async function subirProprio(f: File) {
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível neste ambiente.'); return }
    setOcupado('Enviando o molde…'); setErro('')
    try {
      const m = await carregarMolde(f)
      const c = document.createElement('canvas'); c.width = m.largura; c.height = m.altura
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(m.fonte, 0, 0)
      const cp = await copiaDoCanvas(c, f.name)
      const up = await enviarArquivo(cp.blob, cp.nome, 'molde', workspaceId, { pasta: 'Moldes de caixa', meta: { largura: c.width, altura: c.height, pagina: m.pagina } })
      const r = await fetch('/api/estudio/moldes-caixa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: f.name.replace(/\.[^.]+$/, '').slice(0, 100), tipo: 'proprio', dieLineAssetId: up.id, dieLineUrl: up.url, largura: c.width, altura: c.height, faces: [] }),
      }).then(x => x.json())
      if (!r.id) throw new Error(r.error || 'Não consegui cadastrar o molde.')
      const lista = await listarMoldes(); setMoldes(lista)
      const novo = lista.find(x => x.id === r.id); if (novo) setMapear([novo])
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  async function excluirMolde(m: MoldeCaixa) {
    if (!confirm(`Excluir o molde "${m.nome}"? Temas que usam este molde deixam de gerar esta caixa.`)) return
    await fetch(`/api/estudio/moldes-caixa/${m.id}`, { method: 'DELETE' }); recarregar()
  }
  async function criarKit() {
    if (!novoKit.nome.trim() || !novoKit.ids.length) { setErro('Dê um nome e escolha as caixas do kit.'); return }
    const r = await fetch('/api/estudio/kits-caixas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novoKit.nome.trim(), moldeIds: novoKit.ids }) }).then(x => x.json())
    if (!r.id) { setErro(r.error || 'Não consegui criar o kit.'); return }
    setNovoKit({ nome: '', ids: [] }); recarregar()
  }

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className={cartao}>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Acervo SOA (moldes autorais, faces já mapeadas)</p>
        <p className="text-xs text-gray-500 mb-3">Confira as medidas na primeira impressão. Tem um molde seu diferente? Suba abaixo.</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {ACERVO_CAIXAS.map(d => (
            <div key={d.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-2 space-y-1.5">
              <div className="aspect-[4/3] bg-white rounded-lg flex items-center justify-center overflow-hidden"><img src={miniSvg[d.id]} alt={d.nome} className="max-w-full max-h-full" /></div>
              <p className="text-xs font-semibold">{d.nome}</p>
              <p className="text-[10px] text-gray-400">{d.montagem.dims.l}×{d.montagem.dims.p}×{d.montagem.dims.a} cm · folha {d.larguraMm}×{d.alturaMm} mm</p>
              {noAcervo.has(d.id) ? <span className="text-[11px] text-green-600 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Nos seus moldes</span>
                : <button onClick={() => adicionar(d.id)} disabled={!!ocupado} className={`${btn} text-xs`}>{ocupado === d.nome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Usar</button>}
            </div>
          ))}
        </div>
      </div>

      <div className={cartao}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Meus moldes</p>
          <label className={`${btn} cursor-pointer text-xs`}>{ocupado.startsWith('Enviando') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Subir meu molde (PNG/JPG/SVG/PDF)
            <input type="file" accept=".png,.jpg,.jpeg,.svg,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirProprio(f); e.target.value = '' }} />
          </label>
        </div>
        {moldes === null ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : !moldes.length ? <p className="text-xs text-gray-400">Nenhum molde ainda — use um do acervo ou suba o seu.</p> : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {moldes.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <Box className="w-4 h-4 text-orange-500" />
                <span className="flex-1 truncate">{m.nome} <span className="text-[10px] text-gray-400">{m.tipo === 'acervo' ? 'acervo' : 'meu molde'} · {m.faces.length} face(s){m.montagem ? ' · monta em 3D' : ''}</span></span>
                <button onClick={() => setMapear([m])} className={`${btn} text-xs`}>Mapear faces</button>
                <button onClick={() => excluirMolde(m)}><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cartao}>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Kits de caixas</p>
        <div className="space-y-1.5 mb-3">
          {kits.map(k => (
            <div key={k.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{k.nome} <span className="text-[11px] text-gray-400">— {k.moldeIds.map(id => moldes?.find(m => m.id === id)?.nome || '?').join(', ')}</span></span>
              <button onClick={() => setMapear((moldes || []).filter(m => k.moldeIds.includes(m.id)))} className={`${btn} text-xs`}>Mapear faces do kit</button>
              <button onClick={async () => { if (confirm(`Excluir o kit "${k.nome}"?`)) { await fetch(`/api/estudio/kits-caixas/${k.id}`, { method: 'DELETE' }); recarregar() } }}><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" /></button>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3 space-y-2">
          <input className={inp} placeholder="Nome do kit (ex.: Kit festa 6 caixas)" value={novoKit.nome} onChange={e => setNovoKit(k => ({ ...k, nome: e.target.value }))} />
          <div className="flex flex-wrap gap-1.5">
            {(moldes || []).map(m => {
              const on = novoKit.ids.includes(m.id)
              return <button key={m.id} onClick={() => setNovoKit(k => ({ ...k, ids: on ? k.ids.filter(x => x !== m.id) : [...k.ids, m.id] }))} className={`rounded-lg px-2 py-1 text-xs border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>{m.nome}</button>
            })}
          </div>
          <button onClick={criarKit} className={btnP}><Plus className="w-4 h-4" /> Criar kit</button>
        </div>
      </div>
      {mapear && <MapearFaces moldes={mapear} onFechar={() => setMapear(null)} onSalvo={() => { setMapear(null); recarregar() }} />}
    </div>
  )
}
