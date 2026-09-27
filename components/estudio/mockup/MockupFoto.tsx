'use client'
// SOA Edition — MOCKUP POR FOTO (o núcleo do mockup): a assinante sobe a foto do produto DELA → a IA propõe onde a arte
// vai (ela confirma/ajusta os pontos) → cada arte sai "impressa" na foto, com perspectiva/curvatura e a luz, o grão e a
// cor do produto passando por ela → salva como "mockup do produto" e gera várias fotos (lote) sem imprimir/montar/cortar.
// Fail-open: sem IA, marca a área à mão. 🔒 Foto e arte são da assinante.
'use no memo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Upload, Wand2, Save, Download, X, ImagePlus, RotateCcw } from 'lucide-react'
import { aplicarArteNaFoto, areaPadrao, contornoDaArea, recortarProduto, REALISMO_PADRAO, type AreaFoto, type ConfigFoto, type Pt, type Realismo } from '@/lib/estudio/mockupFoto'
import { chamarIA, CUSTO_IA } from '@/lib/estudio/iaCliente'
import { carregarMolde, enviarArquivo, baixar, exigirSaldo, Autorizador, SemCota } from '@/lib/estudio/cliente'
import { blobDe, carregarImagem, nomeArquivo, novoCanvas } from '@/lib/estudio/mockup'
import type { MockupPronto } from '@/lib/estudio/mockupCliente'
import { useBaseEstudio, inp, lbl, btn, btnP, cartao } from '../caixas/comum'

const LADO_FOTO = 2400, LADO_PREVIA = 1000
type Fundo = { tipo: 'original' } | { tipo: 'cor'; cor: string }
interface Arte { nome: string; canvas: HTMLCanvasElement }

const FORMAS: { id: AreaFoto['tipo']; nome: string; dica: string }[] = [
  { id: 'plano', nome: 'Face plana', dica: 'caixa, sacola, cartão, quadro, tag' },
  { id: 'cilindro', nome: 'Curva', dica: 'caneca, copo, lata, vela, pote' },
  { id: 'malha', nome: 'Tecido / livre', dica: 'camiseta, ecobag, almofada' },
]
const reduzir = (src: HTMLCanvasElement | HTMLImageElement, lado: number) => {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width, h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const k = Math.min(1, lado / Math.max(w, h)), c = novoCanvas(w * k, h * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c
}
/** 4 cantos → área da forma pedida (mantém onde a assinante já marcou). */
function converterArea(a: AreaFoto, tipo: AreaFoto['tipo']): AreaFoto {
  if (a.tipo === tipo) return a
  const cont = contornoDaArea(a, 1, 1)
  const xs = cont.map(p => p.x), ys = cont.map(p => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  if (tipo === 'plano') return { tipo, pontos: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] }
  if (tipo === 'cilindro') { const cy = (y1 - y0) * 0.04; return { tipo, arco: 70, pontos: [{ x: x0, y: y0 }, { x: (x0 + x1) / 2, y: y0 + cy }, { x: x1, y: y0 }, { x: x0, y: y1 }, { x: (x0 + x1) / 2, y: y1 + cy }, { x: x1, y: y1 }] } }
  const pts: Pt[] = []; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) pts.push({ x: x0 + ((x1 - x0) * i) / 2, y: y0 + ((y1 - y0) * j) / 2 })
  return { tipo: 'malha', cols: 3, rows: 3, pontos: pts }
}
/** Arte de exemplo (até a assinante subir a dela): listras + círculo + nome. */
function arteExemplo(): HTMLCanvasElement {
  const c = novoCanvas(1200, 900), g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 1200, 900); gr.addColorStop(0, '#fb923c'); gr.addColorStop(1, '#db2777'); g.fillStyle = gr; g.fillRect(0, 0, 1200, 900)
  g.fillStyle = 'rgba(255,255,255,0.28)'; for (let x = -900; x < 1200; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 45, 0); g.lineTo(x + 945, 900); g.lineTo(x + 900, 900); g.fill() }
  g.fillStyle = '#fff'; g.font = 'bold 140px sans-serif'; g.textAlign = 'center'; g.fillText('Sua arte', 600, 490)
  return c
}

export default function MockupFoto({ salvos, onSalvo }: { salvos: MockupPronto[]; onSalvo: () => void }) {
  const { workspaceId, storage } = useBaseEstudio()
  const [foto, setFoto] = useState<HTMLCanvasElement | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)       // já guardada (editar)
  const [fotoAssetId, setFotoAssetId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [area, setArea] = useState<AreaFoto>(areaPadrao('plano'))
  const [mascara, setMascara] = useState<[number, number][] | null>(null)
  const [furos, setFuros] = useState<[number, number][][]>([])
  const [real, setReal] = useState<Realismo>(REALISMO_PADRAO)
  const [fundo, setFundo] = useState<Fundo>({ tipo: 'original' })
  const [artes, setArtes] = useState<Arte[]>([])
  const [atual, setAtual] = useState(0)
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [prog, setProg] = useState<{ feitos: number; total: number } | null>(null)
  const exemplo = useMemo(() => arteExemplo(), [])
  const previaRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const arrasto = useRef<number | null>(null)
  const fotoPrev = useMemo(() => (foto ? reduzir(foto, LADO_PREVIA) : null), [foto])
  const arteAtual = artes[atual]?.canvas || exemplo
  const cfg: ConfigFoto = { ...real, area, mascaraProduto: mascara, furosProduto: furos }
  const meusFoto = salvos.filter(m => (m.linha as { tipo?: string } | undefined)?.tipo === 'foto')

  /** Composição final (arte + fundo) numa foto base (prévia ou alta). */
  function compor(base: HTMLCanvasElement, arte: CanvasImageSource): HTMLCanvasElement {
    const c = aplicarArteNaFoto(base, arte, cfg)
    if (fundo.tipo === 'original' || !mascara?.length) return c
    const prod = recortarProduto(c, mascara, furos), out = novoCanvas(c.width, c.height), g = out.getContext('2d')!
    g.fillStyle = fundo.cor; g.fillRect(0, 0, out.width, out.height)
    // sombra de contato suave embaixo do produto
    const ys = mascara.map(p => p[1]), xs = mascara.map(p => p[0])
    const base0 = Math.max(...ys) * out.height, cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * out.width, rw = ((Math.max(...xs) - Math.min(...xs)) / 2) * out.width
    const gr = g.createRadialGradient(cx, base0, 0, cx, base0, rw * 1.1); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.save(); g.translate(cx, base0); g.scale(1, 0.16); g.translate(-cx, -base0); g.fillStyle = gr; g.beginPath(); g.arc(cx, base0, rw * 1.1, 0, Math.PI * 2); g.fill(); g.restore()
    g.drawImage(prod, 0, 0)
    return out
  }

  // prévia ao vivo (reduzida, ~30 ms)
  useEffect(() => {
    const cv = previaRef.current
    if (!cv || !fotoPrev) return
    const t = requestAnimationFrame(() => {
      const r = compor(fotoPrev, arteAtual)
      cv.width = r.width; cv.height = r.height
      cv.getContext('2d')!.drawImage(r, 0, 0)
    })
    return () => cancelAnimationFrame(t)
  }, [fotoPrev, arteAtual, JSON.stringify(cfg), JSON.stringify(fundo)]) // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirFoto(f: File) {
    setErro(''); setAviso('')
    try {
      const m = await carregarMolde(f)
      setFoto(reduzir(m.fonte as HTMLCanvasElement, LADO_FOTO)); setFotoUrl(null); setFotoAssetId(null); setEditId(null)
      setMascara(null); setFuros([]); setFundo({ tipo: 'original' }); setArea(areaPadrao('plano'))
      if (!nome) setNome(f.name.replace(/\.[^.]+$/, '').slice(0, 60))
      setAviso('Foto aberta. Use “Achar a área com IA” — ou arraste os pontos laranja até os cantos da superfície onde a arte vai.')
    } catch (e) { setErro((e as Error).message) }
  }
  async function abrirSalvo(m: MockupPronto) {
    const l = m.linha as Record<string, unknown>
    const j = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)
    setOcupado('Abrindo o mockup…'); setErro('')
    try {
      const img = await carregarImagem(String(l.fotoUrl))
      const c = (j(l.config) || {}) as { realismo?: Realismo; mascaraProduto?: [number, number][] | null; furosProduto?: [number, number][][]; fundo?: Fundo }
      setFoto(reduzir(img, LADO_FOTO)); setFotoUrl(String(l.fotoUrl)); setFotoAssetId(String(l.fotoAssetId || '') || null); setEditId(String(l.id)); setNome(String(l.nome))
      setArea(j(l.areaAplicacao) as AreaFoto); setReal({ ...REALISMO_PADRAO, ...(c.realismo || {}) }); setMascara(c.mascaraProduto || null); setFuros(c.furosProduto || []); setFundo(c.fundo || { tipo: 'original' })
      setAviso(`“${m.nome}” aberto — troque a arte e gere as fotos.`)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function acharComIA() {
    if (!foto || !confirm(CUSTO_IA)) return
    setOcupado('A IA está achando a superfície do produto…'); setErro(''); setAviso('')
    try {
      const r = await chamarIA('area-produto', { imagem: foto })
      if (!r.ok) { setErro(`${r.mensagem} Marque a área à mão (arraste os pontos).`); return }
      if (!r.area) { setAviso('A IA não achou a superfície — marque a área à mão.'); return }
      const P = r.area.pontos.map(([x, y]) => ({ x, y }))
      if (r.area.forma === 'cilindro') setArea({ tipo: 'cilindro', arco: 70, pontos: P })
      else if (r.area.forma === 'tecido') setArea(converterArea({ tipo: 'plano', pontos: P }, 'malha'))
      else setArea({ tipo: 'plano', pontos: P })
      setMascara(r.area.contorno?.length >= 3 ? r.area.contorno : null); setFuros(r.area.furos || [])
      setAviso(`A IA achou: ${r.area.label || 'produto'} (${r.area.forma === 'cilindro' ? 'superfície curva' : r.area.forma === 'tecido' ? 'tecido' : 'face plana'}). Confira os pontos e ajuste se precisar.`)
    } finally { setOcupado('') }
  }
  async function addArtes(fs: File[]) {
    const novas: Arte[] = []
    for (const f of fs) { try { const m = await carregarMolde(f); novas.push({ nome: f.name.replace(/\.[^.]+$/, ''), canvas: reduzir(m.fonte as HTMLCanvasElement, 3000) }) } catch { setErro(`Não consegui abrir “${f.name}”.`) } }
    setArtes(a => { const t = [...a, ...novas]; setAtual(a.length); return t })
  }

  // arrastar os pontos da área
  const moverPara = (e: React.PointerEvent) => {
    const i = arrasto.current, svg = svgRef.current
    if (i === null || !svg) return
    const b = svg.getBoundingClientRect()
    const p = { x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)) }
    setArea(a => ({ ...a, pontos: a.pontos.map((q, k) => (k === i ? p : q)) }) as AreaFoto)
  }

  async function salvar() {
    if (!foto) return
    if (!nome.trim()) { setErro('Dê um nome ao mockup (ex.: Caneca branca 325 ml).'); return }
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível neste ambiente.'); return }
    setOcupado('Guardando o mockup do produto…'); setErro('')
    try {
      let url = fotoUrl, id = fotoAssetId
      if (!url) { const up = await enviarArquivo(await blobDe(foto, 'image/jpeg', 0.92), `${nomeArquivo(nome.trim())}-foto.jpg`, 'mockup', workspaceId, { pasta: 'Mockups', meta: { largura: foto.width, altura: foto.height, mockupFoto: true } }); url = up.url; id = up.id }
      const pv = previaRef.current!, k = 320 / Math.max(pv.width, pv.height), mini = novoCanvas(pv.width * k, pv.height * k)
      mini.getContext('2d')!.drawImage(pv, 0, 0, mini.width, mini.height)
      const corpo = { nome: nome.trim(), tipo: 'foto', fotoUrl: url, fotoAssetId: id, areaAplicacao: area, config: { realismo: real, mascaraProduto: mascara, furosProduto: furos, fundo }, previewUrl: mini.toDataURL('image/jpeg', 0.75) }
      const r = await fetch(editId ? `/api/estudio/mockups/${editId}` : '/api/estudio/mockups', { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const jr = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(jr.error || 'Não consegui salvar.')
      setFotoUrl(url); setFotoAssetId(id); if (!editId && jr.id) setEditId(jr.id)
      setAviso(`Mockup “${nome.trim()}” salvo — a área e a luz ficam guardadas; é só trocar a arte.`); onSalvo()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  async function gerar() {
    if (!foto) return
    const lista = artes.length ? artes : [{ nome: 'exemplo', canvas: exemplo }]
    setErro(''); setAviso('')
    try { await exigirSaldo(lista.length) } catch (e) { setErro((e as Error).message); return }
    const aut = new Autorizador(lista.length)
    setProg({ feitos: 0, total: lista.length })
    try {
      const arquivos: { nome: string; blob: Blob }[] = []
      for (let i = 0; i < lista.length; i++) {
        setOcupado(`Gerando ${i + 1} de ${lista.length}: ${lista[i].nome}…`)
        await aut.garantir(i)
        await new Promise(r => setTimeout(r, 0))
        const c = compor(foto, lista[i].canvas)
        arquivos.push({ nome: `${nomeArquivo(nome || 'mockup')}_${nomeArquivo(lista[i].nome)}.jpg`, blob: await blobDe(c, 'image/jpeg', 0.93) })
        setProg({ feitos: i + 1, total: lista.length })
      }
      if (arquivos.length === 1) baixar(arquivos[0].blob, arquivos[0].nome)
      else { const JSZip = (await import('jszip')).default, zip = new JSZip(); arquivos.forEach(a => zip.file(a.nome, a.blob)); baixar(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${nomeArquivo(nome || 'mockup')}-fotos.zip`) }
      setAviso(`${arquivos.length} foto(s) prontas — o download começou.`)
    } catch (e) { setErro(e instanceof SemCota ? e.message : (e as Error).message) } finally { setOcupado(''); setProg(null) }
  }

  const faixa = (k: keyof Realismo, rot: string, dica: string, max = 100) => (
    <label className="block text-[11px] text-gray-600 dark:text-gray-300" title={dica}>{rot} <span className="text-gray-400 tabular-nums">{Number(real[k])}</span>
      <input type="range" min={0} max={max} step={k === 'borda' ? 0.2 : 1} value={Number(real[k])} onChange={e => setReal(r => ({ ...r, [k]: Number(e.target.value) }))} className="w-full accent-orange-500" />
    </label>
  )
  const cont = fotoPrev ? contornoDaArea(area, 1, 1) : []

  return (
    <div className="space-y-4">
      <div className={cartao + ' space-y-2'}>
        <p className="text-sm text-gray-700 dark:text-gray-200"><b>Foto do SEU produto → várias fotos com arte, sem imprimir, montar nem cortar.</b> Fotografe o produto liso (em branco), marque onde a arte vai e troque a arte quantas vezes quiser: ela sai com a curvatura, a luz, a sombra e a textura da sua foto.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className={btnP + ' cursor-pointer'}><Upload className="w-4 h-4" /> Subir foto do produto<input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void abrirFoto(f) }} /></label>
          {!!meusFoto.length && <select className={inp + ' !w-auto'} value="" onChange={e => { const m = meusFoto.find(x => x.id === e.target.value); if (m) void abrirSalvo(m) }}>
            <option value="">Abrir um mockup meu…</option>{meusFoto.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>}
        </div>
      </div>
      {erro && <p className="text-sm text-red-600 flex gap-2 items-start"><X className="w-4 h-4 shrink-0 mt-0.5 cursor-pointer" onClick={() => setErro('')} />{erro}</p>}
      {aviso && <p className="text-sm text-emerald-700 dark:text-emerald-300">{aviso}</p>}

      {foto && fotoPrev && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className={cartao + ' space-y-2'}>
            <div className="flex flex-wrap items-center gap-1.5">
              {FORMAS.map(f => <button key={f.id} onClick={() => setArea(a => converterArea(a, f.id))} title={f.dica} className={`text-xs rounded-full px-3 py-1 border ${area.tipo === f.id ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600'}`}>{f.nome}</button>)}
              <button onClick={acharComIA} disabled={!!ocupado} className={btn + ' !text-xs'}><Wand2 className="w-3.5 h-3.5 text-violet-600" /> Achar a área com IA</button>
              <button onClick={() => { setArea(areaPadrao(area.tipo)); setMascara(null); setFuros([]) }} className={btn + ' !text-xs'} title="Voltar ao quadro padrão"><RotateCcw className="w-3.5 h-3.5" /></button>
              {area.tipo === 'cilindro' && <label className="text-[11px] text-gray-500 inline-flex items-center gap-1" title="Quanto da volta aparece na foto (caneca de frente ≈ 70°)">curvatura {area.arco ?? 70}°<input type="range" min={30} max={88} value={area.arco ?? 70} onChange={e => setArea(a => ({ ...a, arco: Number(e.target.value) }) as AreaFoto)} className="w-20 accent-orange-500" /></label>}
            </div>
            <div className="relative select-none" style={{ touchAction: 'none' }}>
              <canvas ref={previaRef} className="w-full h-auto rounded-lg bg-gray-100 dark:bg-gray-800" data-previa />
              <svg ref={svgRef} viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" onPointerMove={moverPara} onPointerUp={() => { arrasto.current = null }} onPointerLeave={() => { arrasto.current = null }}>
                <polygon points={cont.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f97316" strokeWidth={0.003} strokeDasharray="0.01 0.006" vectorEffect="non-scaling-stroke" />
                {area.pontos.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={0.014} fill="#fff" stroke="#f97316" strokeWidth={0.006} className="cursor-grab" data-ponto={i}
                    style={{ transformOrigin: `${p.x}px ${p.y}px` }} onPointerDown={e => { arrasto.current = i; (e.target as Element).setPointerCapture?.(e.pointerId) }} />
                ))}
              </svg>
            </div>
            <p className="text-[11px] text-gray-500">{area.tipo === 'plano' ? 'Arraste os 4 pontos até os cantos da face onde a arte vai.' : area.tipo === 'cilindro' ? 'Pontos de cima: logo abaixo da borda (o do meio segue a curva). Pontos de baixo: logo acima da base. Os das pontas, um pouco para dentro da lateral.' : 'Malha: arraste os 9 pontos para acompanhar o tecido.'}</p>
          </div>

          <div className="space-y-3">
            <div className={cartao + ' space-y-2'}>
              <p className="text-xs font-semibold">Arte</p>
              <label className={btn + ' cursor-pointer !text-xs'}><ImagePlus className="w-3.5 h-3.5" /> Subir arte(s)<input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) void addArtes(fs) }} /></label>
              {artes.length > 0 && <div className="flex flex-wrap gap-1">{artes.map((a, i) => (
                <button key={i} onClick={() => setAtual(i)} className={`relative w-12 h-12 rounded border overflow-hidden ${i === atual ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-200'}`} title={a.nome}>
                  <img src={a.canvas.toDataURL('image/jpeg', 0.5)} alt="" className="w-full h-full object-cover" />
                  <span onClick={e => { e.stopPropagation(); setArtes(x => x.filter((_, k) => k !== i)); setAtual(0) }} className="absolute top-0 right-0 bg-white/80 text-[9px] px-0.5">✕</span>
                </button>))}</div>}
              <label className="text-[11px] text-gray-500 flex items-center gap-1">Encaixe
                <select className={inp + ' !w-auto !py-0.5 !text-xs'} value={real.ajuste || 'cobrir'} onChange={e => setReal(r => ({ ...r, ajuste: e.target.value as Realismo['ajuste'] }))}>
                  <option value="cobrir">cobrir a área (corta a sobra)</option><option value="conter">arte inteira</option><option value="esticar">esticar</option>
                </select></label>
            </div>
            <div className={cartao + ' space-y-1'}>
              <p className="text-xs font-semibold">Realismo <span className="font-normal text-gray-400">(o que faz parecer impresso)</span></p>
              {faixa('sombra', 'Sombras do produto', 'Curvatura, dobras e sombras da foto escurecem a arte')}
              {faixa('brilho', 'Brilhos / reflexo', 'Reflexos da foto clareiam a arte (caneca, verniz)')}
              {faixa('textura', 'Textura da superfície', 'O grão do papel/tecido aparece na arte')}
              {faixa('relevo', 'Relevo', 'A arte acompanha amassados e costuras')}
              {faixa('material', 'Cor do material', 'Produto colorido (kraft, tecido) tinge a tinta')}
              {faixa('opacidade', 'Opacidade da arte', '')}
              {faixa('borda', 'Borda suave', 'Suaviza o recorte da arte (px)', 4)}
              <button onClick={() => setReal(r => ({ ...REALISMO_PADRAO, ajuste: r.ajuste }))} className="text-[11px] text-gray-400 hover:text-orange-600">voltar ao padrão</button>
            </div>
            <div className={cartao + ' space-y-1.5'}>
              <p className="text-xs font-semibold">Fundo</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => setFundo({ tipo: 'original' })} className={`text-xs rounded-full px-2.5 py-0.5 border ${fundo.tipo === 'original' ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200'}`}>o da foto</button>
                <button disabled={!mascara} onClick={() => setFundo({ tipo: 'cor', cor: '#ffffff' })} className={`text-xs rounded-full px-2.5 py-0.5 border disabled:opacity-40 ${fundo.tipo === 'cor' ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200'}`} title={mascara ? 'Produto recortado sobre uma cor' : 'Use “Achar a área com IA” (ela também recorta o produto)'}>cor lisa</button>
                {fundo.tipo === 'cor' && <input type="color" value={fundo.cor} onChange={e => setFundo({ tipo: 'cor', cor: e.target.value })} className="w-8 h-6 rounded border" />}
              </div>
              {!mascara && <p className="text-[10px] text-gray-400">Trocar o fundo precisa do recorte do produto — vem junto com “Achar a área com IA”.</p>}
            </div>
            <div className={cartao + ' space-y-2'}>
              <input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do mockup (ex.: Caneca branca 325 ml)" />
              <div className="flex flex-wrap gap-2">
                <button onClick={salvar} disabled={!!ocupado} className={btn}><Save className="w-4 h-4" /> {editId ? 'Atualizar mockup' : 'Salvar mockup do produto'}</button>
                <button onClick={gerar} disabled={!!ocupado} className={btnP}><Download className="w-4 h-4" /> Gerar {Math.max(1, artes.length)} foto(s)</button>
              </div>
              <p className="text-[10px] text-gray-400">Cada foto gerada conta 1 imagem da sua cota. Sai na resolução da sua foto (até {LADO_FOTO}px).</p>
            </div>
          </div>
        </div>
      )}
      {ocupado && (
        <div className="fixed bottom-4 right-4 z-40 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg w-80 space-y-1.5" role="status">
          <p className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {ocupado}</p>
          {prog && <div className="h-1.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-orange-400 transition-[width]" style={{ width: `${Math.round((prog.feitos / Math.max(1, prog.total)) * 100)}%` }} /></div>}
        </div>
      )}
    </div>
  )
}
