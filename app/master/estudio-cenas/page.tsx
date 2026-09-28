'use client'
// app/master/estudio-cenas — curadoria do ACERVO DE CENAS do SOA Design (fotos de fundo). Master-only (cookie
// master_token via middleware). Publicar = aparece para TODOS os ateliês. Regra de IP: só imagem autoral (foto nossa)
// ou com licença comercial conferida — a origem fica registrada na cena.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Check, X, Trash2, Loader2 } from 'lucide-react'

interface Cena { id: string; nome: string; fundo: { url?: string } | string; config: { produto?: { cy: number; altura: number }; origem?: string } | string; categoria: string | null; tags: string[] | string; aprovadaGlobal: boolean }
const J = <T,>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T

export default function MasterEstudioCenas() {
  const router = useRouter()
  const [cenas, setCenas] = useState<Cena[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [img, setImg] = useState<string | null>(null)
  const [nome, setNome] = useState(''); const [categoria, setCategoria] = useState('Festa infantil'); const [tags, setTags] = useState(''); const [origem, setOrigem] = useState('')
  const [altura, setAltura] = useState(0.46); const [cy, setCy] = useState(0.6); const [reflexo, setReflexo] = useState(0); const [publicar, setPublicar] = useState(true)
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState('')
  const prev = useRef<HTMLCanvasElement>(null)

  const carregar = useCallback(async () => {
    const r = await fetch('/api/master/estudio/cenas')
    if (r.status === 401) { router.push('/master/login'); return }
    const d = await r.json(); setCenas(d.cenas || []); setCategorias(d.categorias || [])
  }, [router])
  useEffect(() => { Promise.resolve().then(carregar) }, [carregar])

  async function abrir(f: File) {
    const u = URL.createObjectURL(f), im = new Image(); im.src = u; await im.decode()
    const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas')
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
    setImg(c.toDataURL('image/jpeg', 0.9)); if (!nome) setNome(f.name.replace(/\.[^.]+$/, ''))
  }
  // prévia: onde o produto vai ficar (retângulo de referência com sombra)
  useEffect(() => {
    const cv = prev.current; if (!cv || !img) return
    const im = new Image(); im.onload = () => {
      cv.width = 480; cv.height = Math.round(480 * im.naturalHeight / im.naturalWidth); const g = cv.getContext('2d')!; g.drawImage(im, 0, 0, cv.width, cv.height)
      const h = altura * cv.height, w = h * 0.7, x = cv.width / 2 - w / 2, y = cy * cv.height - h / 2
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cv.width / 2, y + h, w * 0.6, h * 0.06, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = 'rgba(249,115,22,0.55)'; g.fillRect(x, y, w, h); g.strokeStyle = '#fff'; g.strokeRect(x, y, w, h)
    }; im.src = img
  }, [img, altura, cy])

  async function salvar() {
    if (!img) return
    if (origem.trim().length < 5) { setErro('Declare a origem da imagem (autoral ou licença comercial).'); return }
    setOcupado(true); setErro('')
    const r = await fetch('/api/master/estudio/cenas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, categoria, tags: tags.split(',').map(t => t.trim()).filter(Boolean), imagem: img, origem, altura, cy, reflexo, publicar }) })
    const j = await r.json().catch(() => ({})); setOcupado(false)
    if (!r.ok) { setErro(j.error || 'Não consegui salvar.'); return }
    setImg(null); setNome(''); setTags(''); carregar()
  }
  const alterar = async (id: string, p: Record<string, unknown>) => { await fetch('/api/master/estudio/cenas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...p }) }); carregar() }
  const excluir = async (c: Cena) => { if (confirm(`Excluir a cena “${c.nome}”? Some do acervo de todos os ateliês.`)) { await fetch(`/api/master/estudio/cenas?id=${c.id}`, { method: 'DELETE' }); carregar() } }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/master" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link><h1 className="text-xl font-semibold">🖼️ Acervo de cenas — curadoria</h1></div>
      <p className="text-sm text-gray-400 max-w-3xl">Fotos de fundo que aparecem para todos os ateliês na aba Cenas (além das cenas desenhadas pelo SOA). <b className="text-gray-200">Só suba imagem autoral (foto nossa) ou com licença comercial conferida</b> — a origem fica registrada. Deixe o centro livre: é onde o produto pousa.</p>
      <div className="grid lg:grid-cols-[480px_1fr] gap-6 rounded-2xl border border-gray-800 bg-gray-900 p-4">
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 rounded-lg bg-orange-600 text-white text-sm font-semibold px-3 py-2 cursor-pointer"><Upload className="w-4 h-4" /> Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void abrir(f) }} /></label>
          {img ? <canvas ref={prev} className="w-full rounded-lg" /> : <div className="aspect-square rounded-lg border border-dashed border-gray-700 flex items-center justify-center text-gray-500 text-sm">prévia (o retângulo laranja é o produto)</div>}
        </div>
        <div className="space-y-3 text-sm">
          <input className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2" placeholder="Nome (ex.: Mesa de festa safari)" value={nome} onChange={e => setNome(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2" value={categoria} onChange={e => setCategoria(e.target.value)}>{categorias.map(c => <option key={c}>{c}</option>)}</select>
            <input className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2" placeholder="tags: safari, menino, verde" value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <input className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2" placeholder="Origem/licença (ex.: foto autoral SOA 09/2026 · ou licença X nº …)" value={origem} onChange={e => setOrigem(e.target.value)} />
          <div className="grid grid-cols-3 gap-3 text-xs text-gray-400">
            <label>Tamanho do produto {Math.round(altura * 100)}%<input type="range" min={20} max={80} value={Math.round(altura * 100)} onChange={e => setAltura(Number(e.target.value) / 100)} className="w-full accent-orange-500" /></label>
            <label>Altura na cena {Math.round(cy * 100)}%<input type="range" min={25} max={85} value={Math.round(cy * 100)} onChange={e => setCy(Number(e.target.value) / 100)} className="w-full accent-orange-500" /></label>
            <label>Reflexo no piso {reflexo}%<input type="range" min={0} max={50} value={reflexo} onChange={e => setReflexo(Number(e.target.value))} className="w-full accent-orange-500" /></label>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={publicar} onChange={e => setPublicar(e.target.checked)} className="accent-orange-500" /> Publicar já para todos os ateliês</label>
          <div className="flex items-center gap-3"><button onClick={salvar} disabled={!img || ocupado || !nome.trim()} className="rounded-lg bg-emerald-600 disabled:opacity-40 text-white font-semibold px-4 py-2 inline-flex items-center gap-2">{ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Salvar cena</button>{erro && <span className="text-red-400 text-xs">{erro}</span>}</div>
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {cenas.map(c => { const f = J<{ url?: string }>(c.fundo), cfg = J<{ origem?: string }>(c.config), tg = J<string[]>(c.tags) || []; return (
          <div key={c.id} className="rounded-xl border border-gray-800 bg-gray-900 p-2 space-y-1">
            {f?.url && <img src={f.url} alt="" className="w-full aspect-square object-cover rounded-lg" />}
            <p className="text-xs font-medium truncate">{c.nome}</p>
            <p className="text-[10px] text-gray-500 truncate">{c.categoria} · {tg.join(', ')}</p>
            <p className="text-[10px] text-gray-500 truncate" title={cfg?.origem}>origem: {cfg?.origem || '—'}</p>
            <div className="flex items-center gap-2">
              {c.aprovadaGlobal ? <button onClick={() => alterar(c.id, { publicar: false })} className="text-[11px] inline-flex items-center gap-1 text-emerald-400"><Check className="w-3.5 h-3.5" /> publicada</button> : <button onClick={() => alterar(c.id, { publicar: true })} className="text-[11px] inline-flex items-center gap-1 text-gray-400 hover:text-white"><X className="w-3.5 h-3.5" /> rascunho — publicar</button>}
              <span className="flex-1" /><button onClick={() => excluir(c)}><Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" /></button>
            </div>
          </div>) })}
        {!cenas.length && <p className="text-sm text-gray-500">Nenhuma cena curada ainda. As cenas desenhadas pelo SOA já aparecem para todos.</p>}
      </div>
    </div>
  )
}
