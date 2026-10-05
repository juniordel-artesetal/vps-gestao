'use client'
'use no memo'
// EDITOR DE PIXELS (Sprint 10) de uma camada de imagem do TEMA, no quadrado da própria camada — o que se
// pinta aqui vale para TODAS as faces da parte (a máscara anda com a camada):
//   • seleções: letreiro (retângulo/elipse), laço, laço poligonal, varinha, intervalo de cores, objeto (IA);
//     somar/subtrair/intersectar, expandir/contrair/suavizar, inverter, virar máscara;
//   • pintura na MÁSCARA (pincel revela, borracha esconde; lata; degradê VETORIAL = nítido no PDF) ou numa
//     camada nova de PINTURA (pincel, borracha, lata, degradê linear/radial/angular/refletido, conta-gotas,
//     paleta do tema);
//   • deformar: distorcer, perspectiva e malha.
//   • Ctrl+Z / Ctrl+Shift+Z desfazem e refazem CADA passo aqui dentro (pincelada, borracha, lata, degradê,
//     seleção, inverter…); ao Aplicar, tudo entra como UM passo no histórico do tema. Atalhos de seleção do
//     Photoshop: Ctrl+A (tudo), Ctrl+D (desmarcar), Ctrl+Shift+I (inverter).
import { useEffect, useRef, useState } from 'react'
import { X, Check, Loader2, Square, Circle as CircleIcon, Lasso, Pentagon, Wand2, Pipette, Paintbrush, Eraser, PaintBucket, Blend, Sparkles, Palette, Grid3x3, Move } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { gravar, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { selRetangulo, selElipse, selPoligono, varinha, intervaloDeCores, combinar, inverter, expandir, suavizar, borda, paraMascaraRgba, tudo, type Selecao, type OpSelecao } from '@/lib/mae/edicao/selecao'
import { carimbo, lata, pintarDegrade, contaGotas, paleta, tDoDegrade, hexParaRgb, rgbParaHex, type Pincel, type TipoDegrade } from '@/lib/mae/edicao/pintura'
import { desenharDeformada } from '@/lib/mae/render/renderizar'
import { deformacaoNeutra, type Deformacao } from '@/lib/mae/schema/edicao'
import type { CanvasLike, Ctx } from '@/lib/mae/render'
import type { DocTema } from '@/lib/mae/schema'
import { infoImagem } from './arquivosMae'
import { motorDaPagina } from './motorEditor'

type Ferramenta = 'retangulo' | 'elipse' | 'laco' | 'poligonal' | 'varinha' | 'intervalo' | 'objeto' | 'pincel' | 'borracha' | 'lata' | 'degrade' | 'contagotas'
type Modo = 'mascara' | 'pintura' | 'deformar'
const LADO_MAX = 1024
const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativo = ' !border-orange-500 bg-orange-50 text-orange-800'
const FERRAMENTAS: { f: Ferramenta; rotulo: string; Icone: typeof Square; grupo: 'sel' | 'pint' }[] = [
  { f: 'retangulo', rotulo: 'Letreiro retangular', Icone: Square, grupo: 'sel' },
  { f: 'elipse', rotulo: 'Letreiro elíptico', Icone: CircleIcon, grupo: 'sel' },
  { f: 'laco', rotulo: 'Laço', Icone: Lasso, grupo: 'sel' },
  { f: 'poligonal', rotulo: 'Laço poligonal (duplo clique fecha)', Icone: Pentagon, grupo: 'sel' },
  { f: 'varinha', rotulo: 'Varinha mágica', Icone: Wand2, grupo: 'sel' },
  { f: 'intervalo', rotulo: 'Intervalo de cores (clique na cor)', Icone: Palette, grupo: 'sel' },
  { f: 'objeto', rotulo: 'Objeto automático (IA, no computador) — Shift+clique = não é o objeto', Icone: Sparkles, grupo: 'sel' },
  { f: 'pincel', rotulo: 'Pincel (na máscara: revela)', Icone: Paintbrush, grupo: 'pint' },
  { f: 'borracha', rotulo: 'Borracha (na máscara: esconde)', Icone: Eraser, grupo: 'pint' },
  { f: 'lata', rotulo: 'Lata de tinta (Alt: esconde na máscara)', Icone: PaintBucket, grupo: 'pint' },
  { f: 'degrade', rotulo: 'Degradê (arraste)', Icone: Blend, grupo: 'pint' },
  { f: 'contagotas', rotulo: 'Conta-gotas', Icone: Pipette, grupo: 'pint' },
]

const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

async function pngDe(rgba: Uint8ClampedArray, w: number, h: number): Promise<Blob> {
  const c = new OffscreenCanvas(w, h)
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0)
  return c.convertToBlob({ type: 'image/png' })
}
async function rgbaDe(fonte: CanvasImageSource, w: number, h: number): Promise<Uint8ClampedArray> {
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(fonte, 0, 0, w, h)
  return g.getImageData(0, 0, w, h).data
}

/** A imagem que se edita (camada do tema ou do editor de imagem), no quadrado da própria camada. */
export interface FontePixels {
  path: string; aspect?: number; name?: string
  mask?: { invert?: boolean; featherMm?: number; gradient?: DegradeMascara | null; raster?: { path: string; sha256: string } } | null
  warp?: Deformacao | null
}
/** O que a janela devolve ao "Aplicar". `mask` undefined = não mexeu na máscara. */
export interface ResultadoPixels {
  modo: Modo
  warp?: Deformacao | null
  mask?: { invert: boolean; gradient: DegradeMascara | null; raster: { path: string; sha256: string } | null }
  pintura?: { path: string; sha256: string }
}
type DegradeMascara = NonNullable<NonNullable<CamadaTemaImg['mask']>['gradient']>
type CamadaTemaImg = Extract<DocTema['partContent'][string][number], { type: 'image' }>

/** Camada do TEMA: monta a fonte e aplica o resultado no tema (todas as faces da parte). */
export function EditorPixelsTema({ camadaId, modoInicial, onFechar }: { camadaId: string; modoInicial: Modo; onFechar: () => void }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const achada = tema ? acharCamadaTema(tema, camadaId) : null
  const c = achada?.c.type === 'image' ? achada.c : null
  if (!c) return null
  const irmas = (achada?.partId ? (tema!.partContent[achada.partId] ?? []) : [c]).filter(x => x.type === 'image').map(x => (x as CamadaTemaImg).path)
  return <EditorPixels fonte={c} paletaDe={irmas} modoInicial={modoInicial} onFechar={onFechar} onAplicar={r => {
    useMaeTema.getState().aplicar(r.modo === 'deformar' ? 'Deformar' : 'Editar máscara/pintura', t => {
      const a = acharCamadaTema(t as DocTema, camadaId)
      if (!a || a.c.type !== 'image') return
      const cc = a.c
      if (r.modo === 'deformar') { if (r.warp) cc.warp = r.warp; else delete cc.warp; return }
      if (r.mask) cc.mask = { enabled: true, featherMm: cc.mask?.featherMm ?? 0, invert: r.mask.invert, ...(r.mask.gradient ? { gradient: r.mask.gradient } : {}), ...(r.mask.raster ? { raster: r.mask.raster } : {}) }
      if (r.pintura) {
        const lista = a.faceId ? (t as DocTema).faceContent[a.faceId] : (t as DocTema).partContent[a.partId!]
        const i = lista.findIndex(x => x.id === camadaId)
        lista.splice(i + 1, 0, { id: novoId(), type: 'image', name: 'Pintura', anchor: cc.anchor, transform: cc.transform, aspect: cc.aspect, path: r.pintura.path, sha256: r.pintura.sha256 } as never)
      }
    })
  }} />
}

export default function EditorPixels({ fonte, paletaDe, modoInicial, onFechar, onAplicar }: { fonte: FontePixels; paletaDe?: string[]; modoInicial: Modo; onFechar: () => void; onAplicar: (r: ResultadoPixels) => void | Promise<void> }) {
  const raiz = useBiblioteca(s => s.raiz)
  const c = fonte
  const [modo, setModo] = useState<Modo>(modoInicial)
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null)
  const [fer, setFer] = useState<Ferramenta>(modoInicial === 'pintura' ? 'pincel' : 'pincel')
  const [op, setOp] = useState<OpSelecao>('nova')
  const [tol, setTol] = useState(32)
  const [contigua, setContigua] = useState(true)
  const [pincel, setPincel] = useState({ raio: 24, dureza: 0.6, opacidade: 1 })
  const [cor, setCor] = useState('#ec4899'), [cor2, setCor2] = useState('#ffffff')
  const [tipoDeg, setTipoDeg] = useState<TipoDegrade>('linear')
  const [grad, setGrad] = useState<NonNullable<NonNullable<typeof c>['mask']>['gradient'] | null>(null)
  const [invert, setInvert] = useState(false)
  const [sel, setSel] = useState<Selecao | null>(null)
  const [ajusteSel, setAjusteSel] = useState(4)
  const [paletaTema, setPaletaTema] = useState<string[]>([])
  const [warp, setWarp] = useState<Deformacao | null>(null)
  const [tipoWarp, setTipoWarp] = useState<'distorcer' | 'perspectiva' | 'malha'>('distorcer')
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [rascunho, setRascunho] = useState<{ pts: [number, number][]; fim?: [number, number] } | null>(null)
  const [versao, setVersao] = useState(0)
  const cv = useRef<HTMLCanvasElement>(null)
  const buf = useRef<{ base: Uint8ClampedArray; mascara: Uint8ClampedArray; pintura: Uint8ClampedArray; bitmap: ImageBitmap; mexeuMascara: boolean; mexeuPintura: boolean } | null>(null)
  const traco = useRef<{ alvo: Uint8ClampedArray; base: Uint8ClampedArray; acum: Float32Array; ultimo: [number, number] } | null>(null)
  const sam = useRef<{ im: unknown; pontos: { x: number; y: number; positivo: boolean }[] } | null>(null)

  // ── histórico local (Ctrl+Z / Ctrl+Shift+Z). Máscara guardada só no canal alfa (1 byte/pixel); a pintura
  //    só entra na foto quando já foi mexida — assim 40 passos cabem com folga na memória.
  type Foto = { mascaraA: Uint8Array; pintura: Uint8ClampedArray | null; mexeuMascara: boolean; mexeuPintura: boolean; grad: typeof grad; invert: boolean; sel: Selecao | null; warp: Deformacao | null }
  const pilha = useRef<{ desfazer: Foto[]; refazer: Foto[] }>({ desfazer: [], refazer: [] })
  const estadoAtual = useRef({ grad, invert, sel, warp })
  estadoAtual.current = { grad, invert, sel, warp }
  const foto = (): Foto | null => {
    const b = buf.current
    if (!b) return null
    const n = b.mascara.length / 4, a = new Uint8Array(n)
    for (let i = 0; i < n; i++) a[i] = b.mascara[i * 4 + 3]
    const s = estadoAtual.current
    return { mascaraA: a, pintura: b.mexeuPintura ? b.pintura.slice() : null, mexeuMascara: b.mexeuMascara, mexeuPintura: b.mexeuPintura, grad: s.grad, invert: s.invert, sel: s.sel, warp: s.warp }
  }
  /** Antes de cada mudança: guarda o estado para o Ctrl+Z (e zera o refazer). */
  const marcarPasso = () => {
    const f = foto()
    if (!f) return
    const p = pilha.current
    p.desfazer.push(f); if (p.desfazer.length > 40) p.desfazer.shift()
    p.refazer = []
  }
  const restaurar = (f: Foto) => {
    const b = buf.current
    if (!b) return
    for (let i = 0; i < f.mascaraA.length; i++) b.mascara[i * 4 + 3] = f.mascaraA[i]
    if (f.pintura) b.pintura.set(f.pintura); else b.pintura.fill(0)
    b.mexeuMascara = f.mexeuMascara; b.mexeuPintura = f.mexeuPintura
    setGrad(f.grad); setInvert(f.invert); setSel(f.sel); setWarp(f.warp); setRascunho(null)
    setVersao(v => v + 1)
  }
  const desfazerPasso = () => { const p = pilha.current, f = p.desfazer.pop(), agora = foto(); if (!f || !agora) return; p.refazer.push(agora); restaurar(f) }
  const refazerPasso = () => { const p = pilha.current, f = p.refazer.pop(), agora = foto(); if (!f || !agora) return; p.desfazer.push(agora); restaurar(f) }
  const mudarSel = (s: Selecao | null) => { marcarPasso(); setSel(s) }
  const atalhos = useRef<(e: KeyboardEvent) => void>(() => {})
  atalhos.current = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) return
    const k = e.key.toLowerCase()
    const consumir = () => { e.preventDefault(); e.stopImmediatePropagation() }
    if (k === 'z') { consumir(); if (e.shiftKey) refazerPasso(); else desfazerPasso() }
    else if (k === 'y') { consumir(); refazerPasso() }
    else if (k === 'a' && modo !== 'deformar') { consumir(); if (tam) mudarSel(tudo(tam.w, tam.h)) }
    else if (k === 'd' && modo !== 'deformar') { consumir(); if (sel) mudarSel(null) }
    else if (k === 'i' && e.shiftKey && modo !== 'deformar') { consumir(); if (sel) mudarSel(inverter(sel)) }
  }
  // captura: o editor de máscara responde ANTES do editor principal (que desfaria o tema por trás)
  useEffect(() => {
    const f = (e: KeyboardEvent) => atalhos.current(e)
    window.addEventListener('keydown', f, { capture: true })
    return () => window.removeEventListener('keydown', f, { capture: true })
  }, [])

  // carrega a imagem da camada, a máscara pintada (se houver) e a paleta do tema
  useEffect(() => {
    if (!c || !raiz) return
    let vivo = true
    ;(async () => {
      const info = await infoImagem(raiz, c.path)
      const bmp = info.bitmap ?? await createImageBitmap(await (await fetch(info.url)).blob())
      const asp = c.aspect ?? bmp.width / bmp.height
      const k = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
      const w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(w / asp))
      const base = await rgbaDe(bmp, w, h)
      let mascara = paraMascaraRgba(tudo(w, h))
      if (c.mask?.raster) {
        try { const mi = await infoImagem(raiz, c.mask.raster.path); if (mi.bitmap) mascara = await rgbaDe(mi.bitmap, w, h) } catch { setMsg('A máscara pintada desta camada não está na Biblioteca — começando com a máscara cheia.') }
      }
      if (!vivo) return
      buf.current = { base, mascara, pintura: new Uint8ClampedArray(w * h * 4), bitmap: bmp, mexeuMascara: false, mexeuPintura: false }
      setGrad(c.mask?.gradient ?? null); setInvert(!!c.mask?.invert)
      setWarp(c.warp ?? null)
      setTam({ w, h })
      // paleta: as imagens das camadas da mesma parte
      const imgs = []
      for (const pth of paletaDe ?? [c.path]) { try { const i = await infoImagem(raiz, pth); if (i.bitmap) imgs.push({ d: await rgbaDe(i.bitmap, 96, 96), w: 96, h: 96 }) } catch { /* sem arquivo */ } }
      if (vivo) setPaletaTema(paleta(imgs, 8).map(rgbParaHex))
    })().catch(e => setMsg(`Não consegui abrir a imagem: ${(e as Error).message}`))
    return () => { vivo = false }
  }, [c?.path, raiz]) // eslint-disable-line react-hooks/exhaustive-deps

  // desenha: imagem × máscara (+ degradê vetorial) sobre xadrez, pintura por cima, seleção em formigas
  useEffect(() => {
    const b = buf.current, el = cv.current
    if (!b || !tam || !el) return
    const { w, h } = tam
    el.width = w; el.height = h
    const g = el.getContext('2d')!
    const q = Math.max(8, Math.round(w / 48))
    for (let y = 0; y < h; y += q) for (let x = 0; x < w; x += q) { g.fillStyle = ((x + y) / q) % 2 ? '#e5e7eb' : '#ffffff'; g.fillRect(x, y, q, q) }
    if (modo === 'deformar') {
      const wp = warp ?? deformacaoNeutra(1, 1)
      desenharDeformada(g as unknown as Ctx, b.bitmap as unknown as CanvasLike, [w, 0, 0, h, 0, 0], wp, 1)
      return
    }
    const out = new Uint8ClampedArray(b.base)
    for (let p = 0; p < w * h; p++) {
      let m = b.mascara[p * 4 + 3] / 255
      if (grad) {
        const st = [...grad.stops].sort((a, z) => a.pos - z.pos)
        const t = tDoDegrade(grad.type, ((p % w) + 0.5) / w, (Math.floor(p / w) + 0.5) / h, grad.x0, grad.y0, grad.x1, grad.y1)
        let a = st[st.length - 1].alpha
        for (let k = 0; k + 1 < st.length; k++) if (t <= st[k + 1].pos) { const u = st[k + 1].pos > st[k].pos ? (t - st[k].pos) / (st[k + 1].pos - st[k].pos) : 0; a = st[k].alpha + (st[k + 1].alpha - st[k].alpha) * Math.max(0, u); break }
        m *= a
      }
      if (invert) m = 1 - m
      out[p * 4 + 3] = Math.round(out[p * 4 + 3] * m)
    }
    const tmp = new OffscreenCanvas(w, h), tg = tmp.getContext('2d')!
    tg.putImageData(new ImageData(out, w, h), 0, 0)
    g.drawImage(tmp, 0, 0)
    if (b.mexeuPintura || modo === 'pintura') { tg.clearRect(0, 0, w, h); tg.putImageData(new ImageData(new Uint8ClampedArray(b.pintura), w, h), 0, 0); g.drawImage(tmp, 0, 0) }
    if (sel) {
      const bd = borda(sel), id = g.getImageData(0, 0, w, h)
      for (let p = 0; p < w * h; p++) if (bd[p]) { const x = p % w, y = (p - x) / w, on = ((x + y) >> 2) % 2; id.data[p * 4] = on ? 0 : 255; id.data[p * 4 + 1] = on ? 0 : 255; id.data[p * 4 + 2] = on ? 0 : 255; id.data[p * 4 + 3] = 255 }
      g.putImageData(id, 0, 0)
    }
  }, [tam, modo, grad, invert, sel, warp, versao])

  if (!c) return null
  const pt = (e: React.PointerEvent | React.MouseEvent): [number, number] => {
    const r = cv.current!.getBoundingClientRect()
    return [((e.clientX - r.left) * tam!.w) / r.width, ((e.clientY - r.top) * tam!.h) / r.height]
  }
  const aplicarSel = (s: Selecao) => { marcarPasso(); setSel(prev => combinar(prev, s, op)); setRascunho(null) }
  const alvo = () => (modo === 'mascara' ? buf.current!.mascara : buf.current!.pintura)
  const marcarMexeu = () => { if (modo === 'mascara') buf.current!.mexeuMascara = true; else buf.current!.mexeuPintura = true }
  const pincelAtual = (apagar: boolean): Pincel => ({ ...pincel, cor: modo === 'mascara' ? [0, 0, 0] : hexParaRgb(cor), apagar })

  function down(e: React.PointerEvent) {
    if (!tam || !buf.current || modo === 'deformar') return
    const p = pt(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (fer === 'pincel' || fer === 'borracha') {
      marcarPasso()
      const a = alvo()
      traco.current = { alvo: a, base: a.slice(), acum: new Float32Array(tam.w * tam.h), ultimo: p }
      carimbo(a, tam.w, tam.h, p[0], p[1], pincelAtual(fer === 'borracha'), sel, traco.current.acum, traco.current.base)
      marcarMexeu(); setVersao(v => v + 1)
    } else if (fer === 'retangulo' || fer === 'elipse' || fer === 'laco' || fer === 'degrade') setRascunho({ pts: [p], fim: p })
    else if (fer === 'poligonal') setRascunho(r => ({ pts: [...(r?.pts ?? []), p], fim: p }))
  }
  function move(e: React.PointerEvent) {
    if (!tam || !buf.current) return
    const p = pt(e)
    if (traco.current && (fer === 'pincel' || fer === 'borracha')) {
      const t = traco.current, [ax, ay] = t.ultimo
      const L = Math.hypot(p[0] - ax, p[1] - ay), passo = Math.max(0.5, pincel.raio / 4), n = Math.ceil(L / passo)
      for (let k = 1; k <= n; k++) carimbo(t.alvo, tam.w, tam.h, ax + ((p[0] - ax) * k) / n, ay + ((p[1] - ay) * k) / n, pincelAtual(fer === 'borracha'), sel, t.acum, t.base)
      t.ultimo = p
      setVersao(v => v + 1)
    } else if (rascunho && e.buttons) setRascunho(r => r && (fer === 'laco' ? { pts: [...r.pts, p], fim: p } : { ...r, fim: p }))
    else if (rascunho && fer === 'poligonal') setRascunho(r => r && { ...r, fim: p })
  }
  async function up(e: React.PointerEvent) {
    if (!tam || !buf.current) return
    const p = pt(e)
    const { w, h } = tam
    if (traco.current) { traco.current = null; return }
    if (rascunho && (fer === 'retangulo' || fer === 'elipse')) { const [a] = rascunho.pts; if (Math.hypot(p[0] - a[0], p[1] - a[1]) > 2) aplicarSel((fer === 'retangulo' ? selRetangulo : selElipse)(w, h, a[0], a[1], p[0], p[1])); else setRascunho(null) }
    else if (rascunho && fer === 'laco') { if (rascunho.pts.length > 2) aplicarSel(selPoligono(w, h, rascunho.pts)); else setRascunho(null) }
    else if (rascunho && fer === 'degrade') {
      const [a] = rascunho.pts
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) < 3) { setRascunho(null); return }
      marcarPasso()
      if (modo === 'mascara') setGrad({ type: tipoDeg, x0: a[0] / w, y0: a[1] / h, x1: p[0] / w, y1: p[1] / h, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }] })
      else { pintarDegrade(buf.current.pintura, w, h, tipoDeg, a[0], a[1], p[0], p[1], [{ pos: 0, cor: hexParaRgb(cor) }, { pos: 1, cor: hexParaRgb(cor2) }], 1, sel); buf.current.mexeuPintura = true }
      setRascunho(null); setVersao(v => v + 1)
    } else if (fer === 'varinha') aplicarSel(varinha(buf.current.base, w, h, p[0], p[1], tol, contigua))
    else if (fer === 'intervalo') { const k = contaGotas(buf.current.base, w, h, p[0], p[1], 1); if (k) aplicarSel(intervaloDeCores(buf.current.base, w, h, k, tol)) }
    else if (fer === 'contagotas') { const k = contaGotas(buf.current.base, w, h, p[0], p[1], 1); if (k) setCor(rgbParaHex(k)) }
    else if (fer === 'lata') {
      marcarPasso()
      if (modo === 'mascara') {
        const reg = sel ?? varinha(buf.current.base, w, h, p[0], p[1], tol, contigua)
        const m = buf.current.mascara
        for (let i = 0; i < w * h; i++) if (reg.a[i]) m[i * 4 + 3] = e.altKey ? Math.round(m[i * 4 + 3] * (1 - reg.a[i] / 255)) : Math.max(m[i * 4 + 3], reg.a[i])
        buf.current.mexeuMascara = true
      } else { lata(buf.current.pintura, w, h, p[0], p[1], hexParaRgb(cor), tol, contigua, 1, sel); buf.current.mexeuPintura = true }
      setVersao(v => v + 1)
    } else if (fer === 'objeto') await objeto(p, !e.shiftKey)
  }
  function duplo() {
    if (fer === 'poligonal' && rascunho && rascunho.pts.length > 2 && tam) aplicarSel(selPoligono(tam.w, tam.h, rascunho.pts))
  }
  async function objeto(p: [number, number], positivo: boolean) {
    if (!tam || !buf.current) return
    setMsg('Carregando a IA de seleção (só na 1ª vez, ~14 MB)…')
    try {
      const { prepararImagem, segmentar } = await import('@/lib/mae/edicao/sam')
      if (!sam.current) sam.current = { im: await prepararImagem(buf.current.base, tam.w, tam.h, x => x.progresso != null && setMsg(`Baixando o modelo… ${Math.round(x.progresso)}%`)), pontos: [] }
      sam.current.pontos.push({ x: p[0], y: p[1], positivo })
      setMsg('Separando o objeto…')
      const s = await segmentar(sam.current.im as never, sam.current.pontos)
      marcarPasso()
      setSel(prev => (op === 'nova' && sam.current!.pontos.length > 1 ? s : combinar(prev, s, op)))
      setMsg('Objeto selecionado. Clique de novo para incluir; Shift+clique para tirar uma parte.')
    } catch (e) { setMsg(`A seleção automática não carregou (${(e as Error).message}). Use a varinha ou o laço.`); sam.current = null }
  }

  // deformar: alças da grade
  const wp = warp ?? deformacaoNeutra(1, 1)
  function moverAlca(i: number, e: React.PointerEvent) {
    if (!(e.buttons & 1) || !tam) return
    const [x, y] = pt(e), u = x / tam.w, v = y / tam.h
    setWarp(prev => {
      const w0 = prev ?? deformacaoNeutra(1, 1)
      const pts = w0.pts.map(q => [...q] as [number, number])
      const [ox, oy] = pts[i]
      pts[i] = [u, v]
      if (tipoWarp === 'perspectiva' && w0.cols === 1 && w0.rows === 1) {
        // perspectiva: o canto do mesmo lado de cima/baixo anda espelhado (trapézio)
        const par = i === 0 ? 1 : i === 1 ? 0 : i === 2 ? 3 : 2
        pts[par] = [pts[par][0] - (u - ox), pts[par][1] + (v - oy)]
      }
      return { ...w0, pts }
    })
  }

  async function salvar() {
    if (!buf.current || !tam || !raiz || !c) return
    setSalvando(true); setMsg(null)
    try {
      const b = buf.current
      let raster: { path: string; sha256: string } | undefined
      if (b.mexeuMascara) {
        const blob = await pngDe(b.mascara, tam.w, tam.h)
        const path = `Elementos/máscaras/${(c.name ?? 'camada').replace(/[\\/:*?"<>|]/g, '-')}-${novoId()}.png`
        await gravar(raiz, path, blob)
        raster = { path, sha256: await sha256(blob) }
        await motorDaPagina().enviarBitmap(raster.sha256, blob)
      }
      let pintura: { path: string; sha256: string } | undefined
      if (b.mexeuPintura) {
        const blob = await pngDe(b.pintura, tam.w, tam.h)
        const path = `Elementos/pinturas/pintura-${novoId()}.png`
        await gravar(raiz, path, blob)
        pintura = { path, sha256: await sha256(blob) }
        await motorDaPagina().enviarBitmap(pintura.sha256, blob)
      }
      if (modo === 'deformar') {
        const neutra = JSON.stringify(wp) === JSON.stringify(deformacaoNeutra(wp.cols, wp.rows))
        await onAplicar({ modo, warp: neutra ? null : wp })
      } else {
        const mud = raster || grad !== (c.mask?.gradient ?? null) || invert !== !!c.mask?.invert
        await onAplicar({ modo, ...(mud ? { mask: { invert, gradient: grad ?? null, raster: raster ?? c.mask?.raster ?? null } } : {}), ...(pintura ? { pintura } : {}) })
      }
      onFechar()
    } catch (e) { setMsg(`Não consegui salvar: ${(e as Error).message}`) } finally { setSalvando(false) }
  }

  const ra = rascunho
  const w = tam?.w ?? 1, h = tam?.h ?? 1
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="Editar pixels da camada" data-editor-pixels>
      <div className="flex max-h-full w-full max-w-5xl flex-col gap-2 rounded-xl bg-white dark:bg-gray-900 p-3 shadow-2xl">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="text-sm mr-2">{c.name ?? 'Camada'}</b>
          {(['mascara', 'pintura', 'deformar'] as Modo[]).map(m => (
            <button key={m} className={btn + (modo === m ? ativo : '')} onClick={() => { setModo(m); setRascunho(null) }} data-modo-pixels={m}>
              {m === 'mascara' ? 'Máscara' : m === 'pintura' ? 'Pintura (camada nova)' : 'Deformar'}
            </button>
          ))}
          <span className="flex-1" />
          <button className={btn} onClick={onFechar}><X className="w-3.5 h-3.5" /> Cancelar</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} onClick={salvar} disabled={salvando || !tam} data-salvar-pixels>{salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aplicar</button>
        </div>

        {modo !== 'deformar' ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]" data-opcoes-pixels>
            {FERRAMENTAS.map(({ f, rotulo, Icone }) => (
              <button key={f} title={rotulo} aria-label={rotulo} className={btn + ' !px-1.5' + (fer === f ? ativo : '')} onClick={() => { setFer(f); setRascunho(null) }} data-ferramenta={f}><Icone className="w-3.5 h-3.5" /></button>
            ))}
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <select value={op} onChange={e => setOp(e.target.value as OpSelecao)} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" title="Como a nova seleção combina com a atual" data-op-selecao>
              <option value="nova">Nova seleção</option><option value="somar">Somar</option><option value="subtrair">Subtrair</option><option value="intersectar">Intersectar</option>
            </select>
            <label className="flex items-center gap-1">Tolerância <input inputMode="numeric" value={tol} onChange={e => setTol(Math.max(0, Math.min(255, Number(e.target.value) || 0)))} className="w-10 rounded border border-gray-200 bg-transparent px-1" data-tolerancia /></label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={contigua} onChange={e => setContigua(e.target.checked)} /> Contígua</label>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <label className="flex items-center gap-1">Tamanho <input type="range" min={1} max={200} value={pincel.raio} onChange={e => setPincel(p => ({ ...p, raio: Number(e.target.value) }))} className="w-20 accent-orange-500" /></label>
            <label className="flex items-center gap-1">Dureza <input type="range" min={0} max={1} step={0.05} value={pincel.dureza} onChange={e => setPincel(p => ({ ...p, dureza: Number(e.target.value) }))} className="w-16 accent-orange-500" /></label>
            <label className="flex items-center gap-1">Opacidade <input type="range" min={0.05} max={1} step={0.05} value={pincel.opacidade} onChange={e => setPincel(p => ({ ...p, opacidade: Number(e.target.value) }))} className="w-16 accent-orange-500" /></label>
            <select value={tipoDeg} onChange={e => setTipoDeg(e.target.value as TipoDegrade)} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" title="Tipo de degradê" data-tipo-degrade>
              <option value="linear">Linear</option><option value="radial">Radial</option><option value="angular">Angular</option><option value="reflected">Refletido</option>
            </select>
            {modo === 'pintura' && (<>
              <input type="color" value={cor} onChange={e => setCor(e.target.value)} title="Cor" className="h-6 w-7" data-cor />
              <input type="color" value={cor2} onChange={e => setCor2(e.target.value)} title="Cor final do degradê" className="h-6 w-7" />
              {paletaTema.map(k => <button key={k} className="h-5 w-5 rounded border border-gray-300" style={{ background: k }} title={`Paleta do tema ${k}`} onClick={() => setCor(k)} data-paleta={k} />)}
            </>)}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Move className="w-3.5 h-3.5" />
            <button className={btn + (tipoWarp === 'distorcer' ? ativo : '')} onClick={() => { setTipoWarp('distorcer'); if ((warp?.cols ?? 1) !== 1) setWarp(deformacaoNeutra(1, 1)) }} data-warp="distorcer">Distorcer</button>
            <button className={btn + (tipoWarp === 'perspectiva' ? ativo : '')} onClick={() => { setTipoWarp('perspectiva'); if ((warp?.cols ?? 1) !== 1) setWarp(deformacaoNeutra(1, 1)) }} data-warp="perspectiva">Perspectiva</button>
            <button className={btn + (tipoWarp === 'malha' ? ativo : '')} onClick={() => { setTipoWarp('malha'); if ((warp?.cols ?? 1) !== 2) setWarp(deformacaoNeutra(2, 2)) }} data-warp="malha"><Grid3x3 className="w-3.5 h-3.5" /> Malha 3×3</button>
            <button className={btn} onClick={() => { marcarPasso(); setWarp(null) }}>Tirar deformação</button>
            <span className="text-gray-500">Arraste as alças.</span>
          </div>
        )}

        <div className="flex min-h-0 flex-1 gap-3">
          <div className="relative flex-1 min-h-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-2 overflow-hidden">
            {!tam && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
            <div className="relative" style={{ aspectRatio: `${w} / ${h}`, maxHeight: '62vh', maxWidth: '100%', height: tam ? '62vh' : 0 }}>
              <canvas ref={cv} className="absolute inset-0 w-full h-full touch-none cursor-crosshair" style={{ imageRendering: 'auto' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={duplo} data-canvas-pixels />
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                {ra && (fer === 'retangulo' || fer === 'elipse') && ra.fim && (fer === 'retangulo'
                  ? <rect x={Math.min(ra.pts[0][0], ra.fim[0])} y={Math.min(ra.pts[0][1], ra.fim[1])} width={Math.abs(ra.fim[0] - ra.pts[0][0])} height={Math.abs(ra.fim[1] - ra.pts[0][1])} fill="none" stroke="#f97316" strokeWidth={w / 400} strokeDasharray={`${w / 100}`} />
                  : <ellipse cx={(ra.pts[0][0] + ra.fim[0]) / 2} cy={(ra.pts[0][1] + ra.fim[1]) / 2} rx={Math.abs(ra.fim[0] - ra.pts[0][0]) / 2} ry={Math.abs(ra.fim[1] - ra.pts[0][1]) / 2} fill="none" stroke="#f97316" strokeWidth={w / 400} strokeDasharray={`${w / 100}`} />)}
                {ra && (fer === 'laco' || fer === 'poligonal') && <polyline points={[...ra.pts, ...(fer === 'poligonal' && ra.fim ? [ra.fim] : [])].map(p => p.join(',')).join(' ')} fill="none" stroke="#f97316" strokeWidth={w / 400} />}
                {ra && fer === 'degrade' && ra.fim && <line x1={ra.pts[0][0]} y1={ra.pts[0][1]} x2={ra.fim[0]} y2={ra.fim[1]} stroke="#f97316" strokeWidth={w / 300} />}
                {modo === 'mascara' && grad && <line x1={grad.x0 * w} y1={grad.y0 * h} x2={grad.x1 * w} y2={grad.y1 * h} stroke="#7c3aed" strokeWidth={w / 400} strokeDasharray={`${w / 80}`} />}
              </svg>
              {modo === 'deformar' && tam && wp.pts.map(([u, v], i) => (
                <div key={i} className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange-500 shadow cursor-move touch-none"
                  style={{ left: `${u * 100}%`, top: `${v * 100}%` }}
                  onPointerDown={e => { marcarPasso(); (e.target as Element).setPointerCapture(e.pointerId) }} onPointerMove={e => moverAlca(i, e)} data-alca-warp={i} />
              ))}
            </div>
          </div>

          {modo !== 'deformar' && (
            <aside className="w-48 shrink-0 space-y-2 text-[11px]">
              <p className="font-semibold">Seleção</p>
              <div className="flex flex-wrap gap-1">
                <button className={btn} onClick={() => tam && mudarSel(tudo(tam.w, tam.h))} title="Selecionar tudo (Ctrl+A)" data-selecionar-tudo>Tudo</button>
                <button className={btn} onClick={() => mudarSel(null)} title="Desmarcar a seleção (Ctrl+D)" data-desmarcar>Desmarcar</button>
                <button className={btn} disabled={!sel} onClick={() => sel && mudarSel(inverter(sel))} title="Inverter a seleção (Ctrl+Shift+I)" data-inverter-selecao>Inverter</button>
              </div>
              <div className="flex items-center gap-1">
                <input inputMode="numeric" value={ajusteSel} onChange={e => setAjusteSel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="w-9 rounded border border-gray-200 bg-transparent px-1" aria-label="pixels" /> px
              </div>
              <div className="flex flex-wrap gap-1">
                <button className={btn} disabled={!sel} onClick={() => sel && mudarSel(expandir(sel, ajusteSel))}>Expandir</button>
                <button className={btn} disabled={!sel} onClick={() => sel && mudarSel(expandir(sel, -ajusteSel))}>Contrair</button>
                <button className={btn} disabled={!sel} onClick={() => sel && mudarSel(suavizar(sel, ajusteSel))}>Suavizar</button>
              </div>
              <button className={btn + ' w-full justify-center'} disabled={!sel} onClick={() => { if (!sel || !buf.current) return; marcarPasso(); buf.current.mascara = paraMascaraRgba(sel, buf.current.mascara, op === 'nova' ? 'nova' : op); buf.current.mexeuMascara = true; setModo('mascara'); setSel(null); setVersao(v => v + 1) }} data-selecao-mascara>Virar máscara</button>
              {modo === 'mascara' && (<>
                <p className="font-semibold pt-1">Máscara</p>
                <label className="flex items-center gap-1"><input type="checkbox" checked={invert} onChange={e => { marcarPasso(); setInvert(e.target.checked) }} data-inverter-mascara /> Inverter</label>
                <p className="text-gray-500">Degradê: arraste com a ferramenta Degradê. {grad ? '' : '(sem degradê)'}</p>
                {grad && <button className={btn} onClick={() => { marcarPasso(); setGrad(null) }} data-tirar-degrade>Tirar o degradê</button>}
                <button className={btn} onClick={() => { if (!buf.current || !tam) return; marcarPasso(); buf.current.mascara = paraMascaraRgba(tudo(tam.w, tam.h)); buf.current.mexeuMascara = true; setVersao(v => v + 1) }}>Limpar pintura da máscara</button>
                <p className="text-gray-400">O degradê da máscara é vetorial: sai nítido em qualquer resolução.</p>
              </>)}
            </aside>
          )}
        </div>
        {msg && <p className="text-xs text-gray-600" data-msg-pixels>{msg}</p>}
      </div>
    </div>
  )
}
