'use client'
// SOA Edition — REPLICAR A ARTE EM TODOS OS MOLDES (1 clique). A artesã escolhe a arte (um objeto
// inteligente do design, ou o design inteiro), importa os moldes (caixa, tag, sacola…), marca em cada
// um a ÁREA onde a arte cai (4 pontos de perspectiva ou malha para superfície curva) e, se quiser,
// limita a uma ÁREA SELECIONADA. "Replicar" gera 1 arte por molde, em alta, num ZIP — cada uma
// autorizada/cobrada pelo servidor (cota). A área é a mesma peça que o Mockup vai usar.
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Upload, ImagePlus, Loader2, Download, Trash2, Copy, Crop } from 'lucide-react'
import { aplicarNaArea, areaPadrao, converterArea, type MoldeReplica, type RecorteArea } from '@/lib/estudio/areaMolde'
import { importarImagem } from '@/lib/estudio/importar'
import { carregarImagemUrl } from '@/lib/estudio/camadas'
import { exigirSaldo, Autorizador, SemCota, baixar, enviarArquivo } from '@/lib/estudio/cliente'
import { codificar } from '@/lib/estudio/acoes'
import { LIMITE_LOTE } from '@/lib/estudio/dados'

type Arte = HTMLCanvasElement | HTMLImageElement
export interface ConfigReplica { fonte: 'camada' | 'design'; camadaId: string | null; formato: 'jpg' | 'png' }

const idM = () => Math.random().toString(36).slice(2, 10)

export default function ReplicarMoldes({ moldes, setMoldes, config, setConfig, fontes, obterArte, workspaceId, storage, onFechar, onCota }: {
  moldes: MoldeReplica[]
  setMoldes: (m: MoldeReplica[]) => void
  config: ConfigReplica
  setConfig: (c: ConfigReplica) => void
  /** Objetos inteligentes do design que podem ser a arte. */
  fontes: { id: string; nome: string }[]
  obterArte: (c: ConfigReplica, alta: boolean) => Promise<Arte | null>
  workspaceId?: string
  storage: boolean
  onFechar: () => void
  onCota: (faltam: number) => void
}) {
  const [arte, setArte] = useState<Arte | null>(null)
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement | HTMLCanvasElement>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')
  const [guardar, setGuardar] = useState(false)
  const [biblioteca, setBiblioteca] = useState<{ id: string; nome: string; url: string; meta?: { proxyUrl?: string; largura?: number; altura?: number } }[] | null>(null)

  // arte de prévia (leve)
  useEffect(() => { let vivo = true; obterArte(config, false).then(a => { if (vivo) setArte(a) }); return () => { vivo = false } }, [config.fonte, config.camadaId]) // eslint-disable-line react-hooks/exhaustive-deps
  // imagens leves dos moldes
  useEffect(() => {
    for (const m of moldes) if (!imgs[m.id]) carregarImagemUrl(m.proxyUrl || m.url).then(i => setImgs(x => ({ ...x, [m.id]: i }))).catch(() => {})
  }, [moldes]) // eslint-disable-line react-hooks/exhaustive-deps

  const molde = moldes.find(m => m.id === editando) || null
  const miniArte = useMemo(() => {
    if (!arte) return null
    if (arte instanceof HTMLImageElement) return arte.src
    const k = 72 / Math.max(arte.width, arte.height), c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(arte.width * k)); c.height = Math.max(1, Math.round(arte.height * k))
    c.getContext('2d')!.drawImage(arte, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  }, [arte])
  const mudar = (id: string, patch: Partial<MoldeReplica>) => setMoldes(moldes.map(m => (m.id === id ? { ...m, ...patch } : m)))
  const base = (): Pick<MoldeReplica, 'area' | 'recorte' | 'mistura' | 'opacidade'> => {
    const u = moldes[moldes.length - 1]
    return u ? { area: structuredClone(u.area), recorte: u.recorte ? { ...u.recorte } : null, mistura: u.mistura, opacidade: u.opacidade } : { area: areaPadrao(), recorte: null, mistura: 'normal', opacidade: 100 }
  }

  async function adicionarArquivos(fs: FileList) {
    if (!workspaceId || !storage) { setErro('O armazenamento precisa estar configurado para guardar os moldes.'); return }
    setErro('')
    const novos: MoldeReplica[] = []
    for (const f of [...fs]) {
      setOcupado(`Importando ${f.name}…`)
      try {
        const imp = await importarImagem(f)
        setImgs(x => ({ ...x, [`tmp-${f.name}`]: imp.proxy }))
        const up = await imp.enviar(workspaceId, { pasta: 'Moldes', tipo: 'molde' })
        const id = idM()
        setImgs(x => ({ ...x, [id]: imp.proxy }))
        novos.push({ id, assetId: up.id, url: up.url, proxyUrl: up.proxyUrl, nome: f.name.replace(/\.[^.]+$/, ''), largura: imp.largura, altura: imp.altura, ...base() })
      } catch (e) { setErro(`${f.name}: ${(e as Error).message}`) }
    }
    setOcupado('')
    if (novos.length) { setMoldes([...moldes, ...novos]); if (!moldes.length) setEditando(novos[0].id) }
  }
  async function abrirBiblioteca() {
    const d = await fetch('/api/estudio/assets').then(r => r.json()).catch(() => ({ assets: [] }))
    setBiblioteca((d.assets || []).filter((a: { tipo: string; mime: string | null }) => ['molde', 'imagem', 'mockup'].includes(a.tipo) && (a.mime || '').startsWith('image/')))
  }
  async function daBiblioteca(a: { id: string; nome: string; url: string; meta?: { proxyUrl?: string; largura?: number; altura?: number } }) {
    setBiblioteca(null); setOcupado('Abrindo molde…')
    try {
      const i = await carregarImagemUrl(a.meta?.proxyUrl || a.url)
      const id = idM()
      setImgs(x => ({ ...x, [id]: i }))
      const largura = a.meta?.largura || i.naturalWidth, altura = a.meta?.altura || i.naturalHeight
      setMoldes([...moldes, { id, assetId: a.id, url: a.url, proxyUrl: a.meta?.proxyUrl || null, nome: a.nome.replace(/\.[^.]+$/, ''), largura, altura, ...base() }])
      if (!moldes.length) setEditando(id)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  async function replicar() {
    if (!moldes.length) return
    if (moldes.length > LIMITE_LOTE) { setErro(`Máximo de ${LIMITE_LOTE} moldes por vez.`); return }
    setErro('')
    try { await exigirSaldo(moldes.length) } catch (e) { if (e instanceof SemCota) onCota(e.faltam); setErro((e as Error).message); return }
    const aut = new Autorizador(moldes.length)
    try {
      setOcupado('Preparando a arte em alta…')
      const arteAlta = await obterArte(config, true)
      if (!arteAlta) throw new Error('Escolha a arte a replicar.')
      const arquivos: { nome: string; blob: Blob }[] = []
      const usados = new Map<string, number>()
      for (let i = 0; i < moldes.length; i++) {
        const m = moldes[i]
        setOcupado(`Aplicando no molde ${i + 1} de ${moldes.length}…`)
        await aut.garantir(i)
        const moldeAlta = await carregarImagemUrl(m.url)
        const out = aplicarNaArea(moldeAlta, arteAlta, m)
        const blob = await codificar(out, { formato: config.formato, qualidade: 92 })
        const q = usados.get(m.nome) || 0; usados.set(m.nome, q + 1)
        arquivos.push({ nome: `${m.nome}${q ? `-${q + 1}` : ''}.${config.formato}`, blob })
        await new Promise(r => setTimeout(r, 0))
      }
      setOcupado('Montando o ZIP…')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip(); for (const a of arquivos) zip.file(a.nome, a.blob)
      const final = arquivos.length === 1 ? arquivos[0] : { nome: 'arte-nos-moldes.zip', blob: await zip.generateAsync({ type: 'blob', compression: 'STORE' }) }
      baixar(final.blob, final.nome)
      if (guardar && storage && workspaceId) await enviarArquivo(final.blob, final.nome, 'gerado', workspaceId, { pasta: 'Arte nos moldes', meta: { itens: arquivos.length }, lote: aut.lote }).catch(() => {})
      onCota(0)
    } catch (e) { if (e instanceof SemCota) onCota(e.faltam); setErro('Falha ao replicar: ' + (e as Error).message) }
    finally { setOcupado('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onFechar}>
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Replicar a arte em todos os moldes</h3>
            <p className="text-xs text-gray-500">Importe os moldes, ajuste a área onde a arte cai em cada um e gere tudo de uma vez.</p>
          </div>
          <button onClick={onFechar}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-600 dark:text-gray-300 font-medium">Arte:</span>
          <select className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800"
            value={config.fonte === 'design' ? 'design' : config.camadaId || ''}
            onChange={e => setConfig(e.target.value === 'design' ? { ...config, fonte: 'design', camadaId: null } : { ...config, fonte: 'camada', camadaId: e.target.value })}>
            <option value="design">O design inteiro</option>
            {fontes.map(f => <option key={f.id} value={f.id}>Objeto inteligente: {f.nome}</option>)}
          </select>
          {miniArte && <img src={miniArte} alt="" className="h-9 rounded border border-gray-200 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:10px_10px]" />}
          <span className="ml-auto flex gap-2">
            <label className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 cursor-pointer hover:border-orange-400"><Upload className="w-3.5 h-3.5" /> Importar moldes
              <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = '' }} />
            </label>
            <button onClick={abrirBiblioteca} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 hover:border-orange-400"><ImagePlus className="w-3.5 h-3.5" /> De Meus arquivos</button>
          </span>
        </div>

        {erro && <p className="text-xs text-red-600">{erro}</p>}
        {ocupado && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {ocupado}</p>}

        {!moldes.length ? (
          <p className="text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">Importe os moldes (caixa, tag, sacola…). O primeiro você ajusta; os próximos já vêm com a mesma área.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div>
              {molde && imgs[molde.id] && arte ? (
                <EditorArea molde={imgs[molde.id]} arte={arte} m={molde} onMudar={p => mudar(molde.id, p)} />
              ) : <p className="text-sm text-gray-400 p-6">Clique num molde para ajustar a área.</p>}
            </div>
            <div className="space-y-2 max-h-[62vh] overflow-y-auto">
              {moldes.map((m, i) => (
                <div key={m.id} onClick={() => setEditando(m.id)}
                  className={`flex items-center gap-2 rounded-xl border p-1.5 cursor-pointer ${editando === m.id ? 'border-orange-400 bg-orange-50/60 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <Miniatura molde={imgs[m.id]} arte={arte} m={m} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{i + 1}. {m.nome}</p>
                    <p className="text-[10px] text-gray-400">{m.area.tipo === 'malha' ? 'malha (curva)' : 'perspectiva'}{m.recorte ? ' · só na área' : ''}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setMoldes(moldes.filter(x => x.id !== m.id)); if (editando === m.id) setEditando(null) }} className="text-gray-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {molde && moldes.length > 1 && (
                <button onClick={() => setMoldes(moldes.map(x => ({ ...x, area: structuredClone(molde.area), recorte: molde.recorte ? { ...molde.recorte } : null, mistura: molde.mistura, opacidade: molde.opacidade })))}
                  className="w-full text-[11px] inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 py-1.5 hover:border-orange-400"><Copy className="w-3.5 h-3.5" /> Usar esta área em todos os moldes</button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs text-gray-600 dark:text-gray-300">
          Formato
          <select className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800" value={config.formato} onChange={e => setConfig({ ...config, formato: e.target.value as 'jpg' | 'png' })}>
            <option value="jpg">JPG</option><option value="png">PNG</option>
          </select>
          {storage && <label className="inline-flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={guardar} onChange={e => setGuardar(e.target.checked)} /> Guardar em Meus arquivos</label>}
          <button onClick={replicar} disabled={!moldes.length || !!ocupado || !arte} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
            <Download className="w-4 h-4" /> Replicar em {moldes.length} molde(s)
          </button>
        </div>
        <p className="text-[10px] text-gray-400">Cada molde gerado conta 1 imagem na cota do dia. Tudo sai em alta resolução (a prévia usa uma cópia leve).</p>

        {biblioteca && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setBiblioteca(null)}>
            <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-3"><h3 className="font-semibold text-gray-900 dark:text-white">Moldes e imagens de Meus arquivos</h3><button onClick={() => setBiblioteca(null)}><X className="w-4 h-4" /></button></div>
              {!biblioteca.length && <p className="text-sm text-gray-400">Nada guardado ainda.</p>}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {biblioteca.map(a => (
                  <button key={a.id} onClick={() => daBiblioteca(a)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1 hover:border-orange-400 text-left">
                    <img src={a.meta?.proxyUrl || a.url} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" loading="lazy" />
                    <span className="block text-[10px] truncate mt-1 text-gray-600 dark:text-gray-300">{a.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Miniatura({ molde, arte, m }: { molde?: HTMLImageElement | HTMLCanvasElement; arte: Arte | null; m: MoldeReplica }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !molde) return
    const dw = molde instanceof HTMLImageElement ? molde.naturalWidth : molde.width, dh = molde instanceof HTMLImageElement ? molde.naturalHeight : molde.height
    const k = 64 / Math.max(dw, dh)
    const W = Math.max(1, Math.round(dw * k)), H = Math.max(1, Math.round(dh * k))
    const out = arte ? aplicarNaArea(molde, arte, m, W, H) : null
    c.width = W; c.height = H
    const g = c.getContext('2d')!
    if (out) g.drawImage(out, 0, 0); else g.drawImage(molde, 0, 0, W, H)
  }, [molde, arte, m])
  return <canvas ref={ref} className="w-16 h-16 object-contain rounded-lg bg-gray-50 dark:bg-gray-800" />
}

/** Editor da ÁREA: arraste os pontos (perspectiva ou malha) e, se quiser, a área selecionada. */
function EditorArea({ molde, arte, m, onMudar }: { molde: HTMLImageElement | HTMLCanvasElement; arte: Arte; m: MoldeReplica; onMudar: (p: Partial<MoldeReplica>) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const arrasto = useRef<{ tipo: 'area' | 'recorte'; i: number } | null>(null)
  const [tam, setTam] = useState({ W: 560, H: 420 })

  useEffect(() => {
    const dw = molde instanceof HTMLImageElement ? molde.naturalWidth : molde.width, dh = molde instanceof HTMLImageElement ? molde.naturalHeight : molde.height
    const k = Math.min(620 / dw, 460 / dh)
    setTam({ W: Math.round(dw * k), H: Math.round(dh * k) })
  }, [molde])

  // desenha: molde + arte na área + contorno da área + alças
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const { W, H } = tam
    c.width = W; c.height = H
    const g = c.getContext('2d')!
    g.drawImage(aplicarNaArea(molde, arte, m, W, H), 0, 0)
    const P = m.area.pontos.map(p => ({ x: p.x * W, y: p.y * H }))
    g.strokeStyle = '#f97316'; g.lineWidth = 1.5; g.setLineDash([5, 4])
    const { cols, rows } = m.area
    g.beginPath()
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const a = P[r * cols + q]
      if (q < cols - 1) { const b = P[r * cols + q + 1]; g.moveTo(a.x, a.y); g.lineTo(b.x, b.y) }
      if (r < rows - 1) { const b = P[(r + 1) * cols + q]; g.moveTo(a.x, a.y); g.lineTo(b.x, b.y) }
    }
    g.stroke()
    if (m.recorte) {
      const q = m.recorte
      g.strokeStyle = '#0ea5e9'; g.beginPath()
      if (q.forma === 'elipse') g.ellipse((q.x + q.w / 2) * W, (q.y + q.h / 2) * H, (q.w / 2) * W, (q.h / 2) * H, 0, 0, Math.PI * 2)
      else g.rect(q.x * W, q.y * H, q.w * W, q.h * H)
      g.stroke()
    }
    g.setLineDash([])
    const alca = (x: number, y: number, cor: string) => { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fillStyle = cor; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke() }
    P.forEach(p => alca(p.x, p.y, '#f97316'))
    if (m.recorte) { alca(m.recorte.x * W, m.recorte.y * H, '#0ea5e9'); alca((m.recorte.x + m.recorte.w) * W, (m.recorte.y + m.recorte.h) * H, '#0ea5e9') }
  }, [molde, arte, m, tam])

  function ponto(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  function baixo(e: React.PointerEvent) {
    const p = ponto(e), { W, H } = tam
    const d = (a: { x: number; y: number }) => Math.hypot((a.x - p.x) * W, (a.y - p.y) * H)
    if (m.recorte) {
      const q = m.recorte
      if (d({ x: q.x, y: q.y }) < 14) { arrasto.current = { tipo: 'recorte', i: 0 }; }
      else if (d({ x: q.x + q.w, y: q.y + q.h }) < 14) { arrasto.current = { tipo: 'recorte', i: 1 } }
    }
    if (!arrasto.current) {
      let melhor = -1, dist = 16
      m.area.pontos.forEach((a, i) => { const x = d(a); if (x < dist) { dist = x; melhor = i } })
      if (melhor >= 0) arrasto.current = { tipo: 'area', i: melhor }
    }
    if (arrasto.current) (e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function mover(e: React.PointerEvent) {
    const a = arrasto.current
    if (!a) return
    const p = ponto(e)
    const lim = (v: number) => Math.max(-0.5, Math.min(1.5, v))
    if (a.tipo === 'area') {
      const pontos = m.area.pontos.map((x, i) => (i === a.i ? { x: lim(p.x), y: lim(p.y) } : x))
      onMudar({ area: { ...m.area, pontos } })
    } else if (m.recorte) {
      const q = m.recorte
      const nx = Math.max(0, Math.min(1, p.x)), ny = Math.max(0, Math.min(1, p.y))
      const novo: RecorteArea = a.i === 0
        ? { ...q, x: Math.min(nx, q.x + q.w - 0.02), y: Math.min(ny, q.y + q.h - 0.02), w: q.x + q.w - Math.min(nx, q.x + q.w - 0.02), h: q.y + q.h - Math.min(ny, q.y + q.h - 0.02) }
        : { ...q, w: Math.max(0.02, nx - q.x), h: Math.max(0.02, ny - q.y) }
      onMudar({ recorte: novo })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
        <span className="font-medium">{m.nome}</span>
        <select className="border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800" value={m.area.tipo} onChange={e => onMudar({ area: converterArea(m.area, e.target.value as 'perspectiva' | 'malha') })}>
          <option value="perspectiva">Perspectiva (4 pontos)</option><option value="malha">Malha 3×3 (superfície curva)</option>
        </select>
        <button onClick={() => onMudar({ area: areaPadrao(m.area.tipo) })} className="underline">resetar área</button>
        <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={m.mistura === 'multiplicar'} onChange={e => onMudar({ mistura: e.target.checked ? 'multiplicar' : 'normal' })} /> mesclar com o molde</label>
        <label className="inline-flex items-center gap-1"><Crop className="w-3.5 h-3.5 text-sky-600" />
          <input type="checkbox" className="accent-sky-500" checked={!!m.recorte} onChange={e => onMudar({ recorte: e.target.checked ? { forma: 'retangulo', x: 0.3, y: 0.3, w: 0.4, h: 0.4 } : null })} /> só na área selecionada</label>
        {m.recorte && (
          <select className="border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800" value={m.recorte.forma} onChange={e => onMudar({ recorte: { ...m.recorte!, forma: e.target.value as 'retangulo' | 'elipse' } })}>
            <option value="retangulo">Retângulo</option><option value="elipse">Elipse</option>
          </select>
        )}
      </div>
      <canvas ref={ref} onPointerDown={baixo} onPointerMove={mover} onPointerUp={() => { arrasto.current = null }}
        className="max-w-full rounded-xl border border-gray-200 dark:border-gray-700 touch-none cursor-crosshair" style={{ width: tam.W, height: tam.H }} />
      <p className="text-[10px] text-gray-400">Pontos laranja = onde a arte cai (arraste). {m.recorte ? 'Pontos azuis = área selecionada: a arte só aparece dentro dela.' : ''}</p>
    </div>
  )
}
