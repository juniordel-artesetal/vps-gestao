'use client'
// SOA Design — CRIAR MOCKUP (1x) POR SMART AREAS: imagem-base do produto (foto dela, acervo ou FACA DXF) + áreas NOMEADAS (frente, lateral,
// alça…) desenhadas por cima. Cada área é um polígono editável por PONTOS (dá para adicionar pontos) e tem dois modos:
// "mexer na área" (a forma) × "mexer na imagem" (mover/escala/giro da arte dentro dela). A arte se deforma para a
// forma (perspectiva / Coons pelos pontos / cilindro) e recebe a luz, a sombra e o grão da imagem-base (realismo).
// Salva o mockup (reutilizável, sem a arte); GERAR fica em "Usar mockup" (uma porta só). Menu de botão direito nas áreas.
// 🔒 A foto e as artes são da assinante; o acervo é autoral.
'use no memo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Upload, Wand2, Save, X, ImagePlus, Plus, Check, Move, Spline, Eye, EyeOff, Trash2, Library, ArrowRight, FileUp } from 'lucide-react'
import {
  comporAreas, contornoDaArea, REALISMO_PADRAO, TRANSFORM_PADRAO, idArea, areaRetangulo, paraPoligono, inserirPonto, removerPonto,
  type AreaFoto, type Realismo, type SmartArea, type Pt,
} from '@/lib/estudio/mockupFoto'
import { chamarIA, CUSTO_IA } from '@/lib/estudio/iaCliente'
import { carregarMolde, enviarArquivo } from '@/lib/estudio/cliente'
import { blobDe, carregarImagem, nomeArquivo, novoCanvas } from '@/lib/estudio/mockup'
import { mockupsDaBiblioteca, type MockupPronto } from '@/lib/estudio/mockupCliente'
import { mockupDaFaca } from '@/lib/estudio/mockupMolde'
import FiltroSegmento, { filtrarPorSegmento } from './FiltroSegmento'
import AlcasArte, { ESCALA_MAX, ESCALA_MIN } from './AlcasArte'
import { useBaseEstudio, inp, btn, btnP, cartao } from '../caixas/comum'

const LADO_FOTO = 2400, LADO_PREVIA = 1000
type Fundo = { tipo: 'original' } | { tipo: 'cor'; cor: string }
type Modo = 'area' | 'imagem' | null
interface Arte { nome: string; canvas: HTMLCanvasElement }
type Acao =
  | { tipo: 'ponto'; id: string; i: number }
  | { tipo: 'criar'; x0: number; y0: number; x1: number; y1: number }
  | { tipo: 'area'; id: string; x: number; y: number; p0: Pt[] }
interface ItemMenu { rotulo: string; acao: () => void; perigo?: boolean; off?: boolean }

const reduzir = (src: HTMLCanvasElement | HTMLImageElement, lado: number) => {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width, h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const k = Math.min(1, lado / Math.max(w, h)), c = novoCanvas(w * k, h * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c
}
function arteExemplo(): HTMLCanvasElement {
  const c = novoCanvas(1200, 900), g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, 1200, 900); gr.addColorStop(0, '#fb923c'); gr.addColorStop(1, '#db2777'); g.fillStyle = gr; g.fillRect(0, 0, 1200, 900)
  g.fillStyle = 'rgba(255,255,255,0.28)'; for (let x = -900; x < 1200; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 45, 0); g.lineTo(x + 945, 900); g.lineTo(x + 900, 900); g.fill() }
  g.fillStyle = '#fff'; g.font = 'bold 140px sans-serif'; g.textAlign = 'center'; g.fillText('Sua arte', 600, 490)
  return c
}
const dentro = (p: Pt, pol: Pt[]) => { let d = false; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) { const a = pol[i], b = pol[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) d = !d } return d }
const novaArea = (nome: string, area: SmartArea['area']): SmartArea => ({ id: idArea(), nome, area, transform: { ...TRANSFORM_PADRAO }, arte: null })

export default function MockupFoto({ salvos, onSalvo, abrir, onUsar }: { salvos: MockupPronto[]; onSalvo: () => void; abrir?: MockupPronto | null; onUsar?: (id: string) => void }) {
  const { workspaceId, storage } = useBaseEstudio()
  const [foto, setFoto] = useState<HTMLCanvasElement | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoAssetId, setFotoAssetId] = useState<string | null>(null)
  const [origem, setOrigem] = useState<'upload' | 'acervo' | 'faca'>('upload')
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [areas, setAreas] = useState<SmartArea[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>(null)
  const [criando, setCriando] = useState(false)
  const [mascara, setMascara] = useState<[number, number][] | null>(null)
  const [furos, setFuros] = useState<[number, number][][]>([])
  const [real, setReal] = useState<Realismo>(REALISMO_PADRAO)
  const [fundo, setFundo] = useState<Fundo>({ tipo: 'original' })
  const [artes, setArtes] = useState<Arte[]>([])
  const [principal, setPrincipal] = useState(0)
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null)
  const [acervo, setAcervo] = useState<MockupPronto[] | null | 'abrindo'>(null)
  const [segAcervo, setSegAcervo] = useState(''); const [buscaAcervo, setBuscaAcervo] = useState('')
  const [rascunhoRet, setRascunhoRet] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const exemplo = useMemo(() => arteExemplo(), [])
  const previaRef = useRef<HTMLCanvasElement>(null)
  const palcoRef = useRef<HTMLDivElement>(null)
  const acao = useRef<Acao | null>(null)
  const fotoPrev = useMemo(() => (foto ? reduzir(foto, LADO_PREVIA) : null), [foto])
  const meusFoto = salvos.filter(m => (m.linha as { tipo?: string } | undefined)?.tipo === 'foto')
  const sel = areas.find(a => a.id === selId) || null
  const artePrincipal = artes[principal]?.canvas || exemplo

  /** Composição (a mesma do "usar"): cada área visível com a sua arte (própria ou a de teste) + fundo. */
  const arteDaArea = (a: SmartArea, principalCv: CanvasImageSource) => (a.arte != null && artes[a.arte] ? artes[a.arte].canvas : principalCv)
  const compor = (base: HTMLCanvasElement, principalCv: CanvasImageSource) => comporAreas(base, { areas, real, mascara, furos, fundo }, a => arteDaArea(a, principalCv))
  // prévia ao vivo
  useEffect(() => {
    const cv = previaRef.current
    if (!cv || !fotoPrev) return
    const t = requestAnimationFrame(() => { const r = compor(fotoPrev, artePrincipal); cv.width = r.width; cv.height = r.height; cv.getContext('2d')!.drawImage(r, 0, 0) })
    return () => cancelAnimationFrame(t)
  }, [fotoPrev, artePrincipal, artes, JSON.stringify(areas), JSON.stringify(real), JSON.stringify(fundo), mascara]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { if (menu) setMenu(null); else if (modo || criando) { setModo(null); setCriando(false) } } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [menu, modo, criando])

  useEffect(() => { if (abrir) void abrirSalvo(abrir) }, [abrir]) // eslint-disable-line react-hooks/exhaustive-deps
  const mudarArea = (id: string, f: (a: SmartArea) => SmartArea) => setAreas(x => x.map(a => (a.id === id ? f(a) : a)))
  const selecionar = (id: string | null, m: Modo = null) => { setSelId(id); setModo(m); setCriando(false) }

  async function abrirFoto(f: File) {
    setErro(''); setAviso('')
    try {
      const m = await carregarMolde(f)
      setFoto(reduzir(m.fonte as HTMLCanvasElement, LADO_FOTO)); setFotoUrl(null); setFotoAssetId(null); setEditId(null); setOrigem('upload')
      setMascara(null); setFuros([]); setFundo({ tipo: 'original' }); setAreas([]); selecionar(null)
      if (!nome) setNome(f.name.replace(/\.[^.]+$/, '').slice(0, 60))
      setCriando(true)
      setAviso('Foto aberta. Desenhe um retângulo sobre a face onde a arte vai (ou use “Achar a área com IA”). Depois ajuste os pontos.')
    } catch (e) { setErro((e as Error).message) }
  }
  function abrirAcervo() {
    setAcervo('abrindo')
    setTimeout(() => { try { setAcervo(mockupsDaBiblioteca(1400)) } catch (e) { setErro((e as Error).message); setAcervo(null) } }, 30)
  }
  function usarDoAcervo(m: MockupPronto) {
    const c = novoCanvas(m.produto.width, m.produto.height), g = c.getContext('2d')!
    g.fillStyle = '#f5f5f4'; g.fillRect(0, 0, c.width, c.height); g.drawImage(m.produto, 0, 0)
    const a = m.cfg.area
    // pontos do acervo podem vir em px → fração da imagem
    const px = a.pontos.some(p => p.x > 1.5 || p.y > 1.5)
    const P = a.pontos.map(p => (px ? { x: p.x / c.width, y: p.y / c.height } : { x: p.x, y: p.y }))
    const pol: SmartArea['area'] = a.tipo === 'perspectiva'
      ? { tipo: 'poligono', pontos: [P[0], P[1], P[3], P[2]], cantos: [0, 1, 2, 3] }
      : { ...paraPoligono({ tipo: 'malha', cols: a.cols, rows: a.rows, pontos: P }), curvo: /caneca|lata|copo|garrafa/i.test(m.categoria) }
    setFoto(c); setFotoUrl(null); setFotoAssetId(null); setEditId(null); setOrigem('acervo'); setMascara(null); setFuros([]); setFundo({ tipo: 'original' })
    const nova = novaArea('frente', pol)
    setAreas([nova]); selecionar(nova.id); setNome(m.nome); setAcervo(null)
    setAviso(`“${m.nome}” do acervo, com a área “frente” pronta. Ajuste os pontos se quiser, suba a sua arte e gere.`)
  }
  async function abrirFaca(f: File) {
    setOcupado('Lendo a faca e montando a caixa…'); setErro(''); setAviso('')
    try {
      const r = await mockupDaFaca(f)
      setFoto(r.base); setFotoUrl(null); setFotoAssetId(null); setEditId(null); setOrigem('faca'); setMascara(null); setFuros([]); setFundo({ tipo: 'original' })
      setAreas(r.areas); selecionar(r.areas[0].id); setNome(f.name.replace(/\.[^.]+$/, '').slice(0, 60)); setAcervo(null)
      setAviso(`Faca lida: ${r.faces.length} face(s) reconhecida(s) — áreas ${r.areas.map(a => `“${a.nome}”`).join(', ')} prontas. ${r.avisos.join(' ')} Confira os pontos e salve.`)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function abrirSalvo(m: MockupPronto) {
    const l = m.linha as Record<string, unknown>
    const j = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)
    setOcupado('Abrindo o mockup…'); setErro('')
    try {
      const img = await carregarImagem(String(l.fotoUrl))
      const c = (j(l.config) || {}) as { realismo?: Realismo; mascaraProduto?: [number, number][] | null; furosProduto?: [number, number][][]; fundo?: Fundo; origem?: 'upload' | 'acervo' | 'faca' }
      const aa = j(l.areaAplicacao) as ({ versao?: number; areas?: SmartArea[] } & AreaFoto)
      setFoto(reduzir(img, LADO_FOTO)); setFotoUrl(String(l.fotoUrl)); setFotoAssetId(String(l.fotoAssetId || '') || null); setEditId(String(l.id)); setNome(String(l.nome))
      setAreas(aa?.versao === 2 && aa.areas ? aa.areas : [novaArea('frente', paraPoligono(aa))])
      setReal({ ...REALISMO_PADRAO, ...(c.realismo || {}) }); setMascara(c.mascaraProduto || null); setFuros(c.furosProduto || []); setFundo(c.fundo || { tipo: 'original' }); setOrigem(c.origem || 'upload')
      selecionar(null)
      setAviso(`“${m.nome}” aberto para editar as áreas. Para gerar fotos, use “Usar mockup”.`)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function acharComIA() {
    if (!foto || !confirm(CUSTO_IA)) return
    setOcupado('A IA está achando a superfície do produto…'); setErro(''); setAviso('')
    try {
      const r = await chamarIA('area-produto', { imagem: foto })
      if (!r.ok) { setErro(`${r.mensagem} Desenhe a área à mão (retângulo + pontos).`); return }
      if (!r.area) { setAviso('A IA não achou a superfície — desenhe a área à mão.'); return }
      const P = r.area.pontos.map(([x, y]) => ({ x, y }))
      const pol = paraPoligono(r.area.forma === 'cilindro' ? { tipo: 'cilindro', arco: 70, pontos: P } : { tipo: 'plano', pontos: P })
      const nova = novaArea(areas.length ? `área ${areas.length + 1}` : 'frente', pol)
      setAreas(x => [...x, nova]); selecionar(nova.id, 'area')
      setMascara(r.area.contorno?.length >= 3 ? r.area.contorno : null); setFuros(r.area.furos || [])
      setAviso(`A IA marcou “${nova.nome}” em ${r.area.label || 'produto'} (${r.area.forma === 'cilindro' ? 'superfície curva' : 'face'}). Confira os pontos e clique em Aplicar.`)
    } finally { setOcupado('') }
  }
  async function addArtes(fs: File[]) {
    const novas: Arte[] = []
    for (const f of fs) { try { const m = await carregarMolde(f); novas.push({ nome: f.name.replace(/\.[^.]+$/, ''), canvas: reduzir(m.fonte as HTMLCanvasElement, 3000) }) } catch { setErro(`Não consegui abrir “${f.name}”.`) } }
    setArtes(a => [...a, ...novas])
  }

  // ── ponteiro sobre a imagem ──
  const fracao = (e: { clientX: number; clientY: number }): Pt => {
    const b = palcoRef.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)) }
  }
  const areaEm = (p: Pt) => [...areas].reverse().find(a => !a.oculta && dentro(p, contornoDaArea(a.area, 1, 1)))
  function baixo(e: React.PointerEvent) {
    if (e.button !== 0 || !foto) return
    const p = fracao(e)
    if (criando) { acao.current = { tipo: 'criar', x0: p.x, y0: p.y, x1: p.x, y1: p.y }; setRascunhoRet({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); return }
    const a = areaEm(p)
    if (sel && modo === 'imagem' && a?.id === sel.id) return   // as alças da arte cuidam
    if (sel && modo === 'area' && a?.id === sel.id) { acao.current = { tipo: 'area', id: sel.id, x: p.x, y: p.y, p0: sel.area.pontos.map(q => ({ ...q })) }; return }
    if (a) selecionar(a.id, selId === a.id ? modo : null); else selecionar(null)
  }
  function mover(e: React.PointerEvent) {
    const ac = acao.current
    if (!ac) return
    const p = fracao(e)
    if (ac.tipo === 'criar') { ac.x1 = p.x; ac.y1 = p.y; setRascunhoRet({ x0: ac.x0, y0: ac.y0, x1: p.x, y1: p.y }) }
    else if (ac.tipo === 'ponto') mudarArea(ac.id, a => ({ ...a, area: { ...a.area, pontos: a.area.pontos.map((q, k) => (k === ac.i ? p : q)) } }))
    else if (ac.tipo === 'area') mudarArea(ac.id, a => ({ ...a, area: { ...a.area, pontos: ac.p0.map(q => ({ x: q.x + p.x - ac.x, y: q.y + p.y - ac.y })) } }))
  }
  function soltar() {
    const ac = acao.current
    acao.current = null
    if (ac?.tipo === 'criar') {
      setRascunhoRet(null)
      if (Math.abs(ac.x1 - ac.x0) < 0.02 || Math.abs(ac.y1 - ac.y0) < 0.02) return
      const n = areas.length ? `área ${areas.length + 1}` : 'frente'
      const nomeA = prompt('Nome da área (frente, lateral, alça, tampa…):', n)?.trim() || n
      const a = novaArea(nomeA, areaRetangulo(ac.x0, ac.y0, ac.x1, ac.y1))
      setAreas(x => [...x, a]); selecionar(a.id, 'area')
      setAviso(`Área “${nomeA}” criada. Arraste os pontos até os cantos da face; clique no “+” de um lado para ADICIONAR ponto. Depois “Aplicar”.`)
    }
  }
  const renomear = (a: SmartArea) => { const n = prompt('Nome da área:', a.nome)?.trim(); if (n) mudarArea(a.id, x => ({ ...x, nome: n })) }
  const duplicar = (a: SmartArea) => {
    const c: SmartArea = { ...structuredClone(a), id: idArea(), nome: `${a.nome} (cópia)` }
    c.area.pontos = c.area.pontos.map(p => ({ x: Math.min(1, p.x + 0.03), y: Math.min(1, p.y + 0.03) }))
    setAreas(x => [...x, c]); selecionar(c.id, 'area')
  }
  const excluir = (a: SmartArea) => { setAreas(x => x.filter(y => y.id !== a.id)); if (selId === a.id) selecionar(null) }
  function menuDaArea(e: React.MouseEvent, a: SmartArea | undefined, ponto?: number) {
    e.preventDefault()
    if (!foto) return
    if (!a) { setMenu({ x: e.clientX, y: e.clientY, itens: [{ rotulo: 'Nova área (desenhar)', acao: () => { setCriando(true); setModo(null) } }] }); return }
    const p = fracao(e)
    setSelId(a.id)
    const itens: ItemMenu[] = [
      { rotulo: 'Mexer na área (editar pontos)', acao: () => selecionar(a.id, 'area') },
      { rotulo: 'Mexer na imagem (arte dentro)', acao: () => selecionar(a.id, 'imagem') },
      { rotulo: 'Adicionar ponto aqui', acao: () => { mudarArea(a.id, x => ({ ...x, area: inserirPonto(x.area, p).area })); selecionar(a.id, 'area') } },
      ...(ponto !== undefined ? [{ rotulo: 'Remover este ponto', acao: () => mudarArea(a.id, x => ({ ...x, area: removerPonto(x.area, ponto) })), off: a.area.cantos.includes(ponto) || a.area.pontos.length <= 4 }] : []),
      { rotulo: a.area.curvo ? 'Superfície plana' : 'Superfície curva (caneca, copo…)', acao: () => mudarArea(a.id, x => ({ ...x, area: { ...x.area, curvo: !x.area.curvo } })) },
      { rotulo: 'Aplicar / OK', acao: () => setModo(null) },
      { rotulo: 'Renomear…', acao: () => renomear(a) },
      { rotulo: 'Duplicar área', acao: () => duplicar(a) },
      { rotulo: a.oculta ? 'Mostrar' : 'Ocultar', acao: () => mudarArea(a.id, x => ({ ...x, oculta: !x.oculta })) },
      { rotulo: 'Excluir área', acao: () => excluir(a), perigo: true },
    ]
    setMenu({ x: e.clientX, y: e.clientY, itens })
  }

  async function salvar() {
    if (!foto) return
    if (!nome.trim()) { setErro('Dê um nome ao mockup (ex.: Caixa Milk).'); return }
    if (!areas.length) { setErro('Crie pelo menos uma área (desenhe um retângulo sobre a face).'); return }
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível neste ambiente.'); return }
    setOcupado('Guardando o mockup…'); setErro('')
    try {
      let url = fotoUrl, id = fotoAssetId
      if (!url) { const up = await enviarArquivo(await blobDe(foto, 'image/jpeg', 0.92), `${nomeArquivo(nome.trim())}-base.jpg`, 'mockup', workspaceId, { pasta: 'Mockups', meta: { largura: foto.width, altura: foto.height, mockupFoto: true } }); url = up.url; id = up.id }
      const pv = previaRef.current!, k = 320 / Math.max(pv.width, pv.height), mini = novoCanvas(pv.width * k, pv.height * k)
      mini.getContext('2d')!.drawImage(pv, 0, 0, mini.width, mini.height)
      // salva só a imagem-base + as áreas (sem a arte): o mockup é reutilizável
      const corpo = { nome: nome.trim(), tipo: 'foto', fotoUrl: url, fotoAssetId: id, areaAplicacao: { versao: 2, areas: areas.map(a => ({ ...a, arte: null })) }, config: { realismo: real, mascaraProduto: mascara, furosProduto: furos, fundo, origem }, previewUrl: mini.toDataURL('image/jpeg', 0.75) }
      const r = await fetch(editId ? `/api/estudio/mockups/${editId}` : '/api/estudio/mockups', { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const jr = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(jr.error || 'Não consegui salvar.')
      setFotoUrl(url); setFotoAssetId(id); if (!editId && jr.id) setEditId(jr.id)
      setAviso(`Mockup “${nome.trim()}” salvo com ${areas.length} área(s): ${areas.map(a => a.nome).join(', ')}. Pronto para usar com qualquer arte — sem redesenhar as áreas.`); onSalvo()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  const faixa = (k: keyof Realismo, rot: string, dica: string, max = 100) => (
    <label className="block text-[11px] text-gray-600 dark:text-gray-300" title={dica}>{rot} <span className="text-gray-400 tabular-nums">{Number(real[k])}</span>
      <input type="range" min={0} max={max} step={k === 'borda' ? 0.2 : 1} value={Number(real[k])} onChange={e => setReal(r => ({ ...r, [k]: Number(e.target.value) }))} className="w-full accent-orange-500" />
    </label>
  )
  const poly = (a: SmartArea) => contornoDaArea(a.area, 1, 1).map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="space-y-4" onClick={() => menu && setMenu(null)}>
      <div className={cartao + ' space-y-2'}>
        <p className="text-sm text-gray-700 dark:text-gray-200"><b>Criar mockup — uma vez só por produto.</b> Escolha a imagem do produto em branco e defina as faces onde a arte vai (frente, lateral, alça…). Depois de salvo, o dia a dia é em <b>Usar mockup</b>: sobe as artes e gera, sem redesenhar nada.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className={btnP + ' cursor-pointer'}><Upload className="w-4 h-4" /> Subir foto do produto<input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void abrirFoto(f) }} /></label>
          <button onClick={abrirAcervo} className={btn}><Library className="w-4 h-4" /> Escolher do acervo</button>
          <label className={btn + ' cursor-pointer'} title="A faca (die-line) da caixa: as faces viram áreas sozinhas"><FileUp className="w-4 h-4" /> Importar faca (DXF)<input type="file" accept=".dxf,.svg,.pdf,image/png" className="hidden" data-faca onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void abrirFaca(f) }} /></label>
          {!!meusFoto.length && <select className={inp + ' !w-auto'} value="" onChange={e => { const m = meusFoto.find(x => x.id === e.target.value); if (m) void abrirSalvo(m) }}>
            <option value="">Editar um mockup meu…</option>{meusFoto.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>}
        </div>
      </div>
      {erro && <p className="text-sm text-red-600 flex gap-2 items-start"><X className="w-4 h-4 shrink-0 mt-0.5 cursor-pointer" onClick={() => setErro('')} />{erro}</p>}
      {aviso && <p className="text-sm text-emerald-700 dark:text-emerald-300">{aviso}</p>}

      {foto && fotoPrev && (
        <div className="grid lg:grid-cols-[1fr_330px] gap-4">
          <div className={cartao + ' space-y-2'}>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => { setCriando(true); setModo(null) }} className={`${btn} !text-xs ${criando ? '!border-orange-500 text-orange-700 bg-orange-50' : ''}`}><Plus className="w-3.5 h-3.5" /> Nova área</button>
              <button onClick={acharComIA} disabled={!!ocupado} className={btn + ' !text-xs'}><Wand2 className="w-3.5 h-3.5 text-violet-600" /> Achar a área com IA</button>
              {sel && <>
                <span className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{sel.nome}:</span>
                <button onClick={() => setModo('area')} className={`text-xs rounded-lg px-2 py-1 border inline-flex items-center gap-1 ${modo === 'area' ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-200 font-semibold' : 'border-gray-200 dark:border-gray-700'}`}><Spline className="w-3.5 h-3.5" /> Mexer na área</button>
                <button onClick={() => setModo('imagem')} className={`text-xs rounded-lg px-2 py-1 border inline-flex items-center gap-1 ${modo === 'imagem' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 font-semibold' : 'border-gray-200 dark:border-gray-700'}`}><Move className="w-3.5 h-3.5" /> Mexer na imagem</button>
                {modo && <button onClick={() => setModo(null)} className="text-xs rounded-lg px-2 py-1 bg-emerald-600 text-white font-semibold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Aplicar</button>}
              </>}
            </div>
            <div ref={palcoRef} className="relative select-none" style={{ touchAction: 'none', cursor: criando ? 'crosshair' : modo === 'imagem' ? 'move' : 'default' }}
              onPointerDown={baixo} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar}
              onContextMenu={e => menuDaArea(e, areaEm(fracao(e)))} data-palco>
              <canvas ref={previaRef} className="w-full h-auto rounded-lg bg-gray-100 dark:bg-gray-800 pointer-events-none" data-previa />
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                {areas.filter(a => !a.oculta).map(a => {
                  const eSel = a.id === selId
                  return <polygon key={a.id} points={poly(a)} fill={eSel && modo === 'area' ? 'rgba(14,165,233,0.08)' : 'none'} stroke={eSel ? (modo === 'imagem' ? '#f97316' : '#0ea5e9') : '#94a3b8'} strokeWidth={eSel ? 2 : 1.2} strokeDasharray={eSel ? undefined : '6 4'} vectorEffect="non-scaling-stroke" />
                })}
                {rascunhoRet && <rect x={Math.min(rascunhoRet.x0, rascunhoRet.x1)} y={Math.min(rascunhoRet.y0, rascunhoRet.y1)} width={Math.abs(rascunhoRet.x1 - rascunhoRet.x0)} height={Math.abs(rascunhoRet.y1 - rascunhoRet.y0)} fill="rgba(14,165,233,0.1)" stroke="#0ea5e9" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
              </svg>
              {/* nomes das áreas */}
              {areas.filter(a => !a.oculta).map(a => { const c = contornoDaArea(a.area, 1, 1); const x = c.reduce((s, p) => s + p.x, 0) / c.length, y = Math.min(...c.map(p => p.y)); return <span key={a.id} className={`absolute -translate-x-1/2 -translate-y-full text-[10px] px-1.5 rounded pointer-events-none ${a.id === selId ? 'bg-sky-600 text-white' : 'bg-white/80 text-gray-700'}`} style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>{a.nome}</span> })}
              {/* pontos da área em edição: vértices (arrastar; botão direito remove) + "+" no meio de cada lado (adiciona) */}
              {sel && modo === 'imagem' && foto && (() => { const ar = arteDaArea(sel, artePrincipal) as HTMLCanvasElement; return <AlcasArte area={sel.area} W={foto.width} H={foto.height} arte={{ w: ar.width, h: ar.height }} t={sel.transform} ajuste={real.ajuste} palco={palcoRef} onMudar={t => mudarArea(sel.id, x => ({ ...x, transform: t }))} /> })()}
              {sel && modo === 'area' && sel.area.pontos.map((p, i) => {
                const canto = sel.area.cantos.includes(i)
                return <span key={i} data-ponto={i} className={`absolute rounded-full border-2 border-sky-600 -translate-x-1/2 -translate-y-1/2 cursor-grab ${canto ? 'w-4 h-4 bg-white' : 'w-3 h-3 bg-sky-100'}`} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  onPointerDown={e => { if (e.button !== 0) return; e.stopPropagation(); acao.current = { tipo: 'ponto', id: sel.id, i } }}
                  onContextMenu={e => { e.stopPropagation(); menuDaArea(e, sel, i) }} />
              })}
              {sel && modo === 'area' && sel.area.pontos.map((p, i) => {
                const q = sel.area.pontos[(i + 1) % sel.area.pontos.length], m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
                return <button key={`m${i}`} data-mais={i} title="Adicionar ponto neste lado" className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600/80 text-white text-[11px] leading-4 text-center hover:bg-sky-700" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                  onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); mudarArea(sel.id, x => ({ ...x, area: inserirPonto(x.area, m).area })) }}>+</button>
              })}
            </div>
            <p className="text-[11px] text-gray-500">{criando ? 'Arraste sobre a imagem para desenhar a área.' : modo === 'area' ? 'Arraste os pontos (os maiores são os cantos). “+” adiciona ponto no lado; botão direito num ponto extra remove. Arraste dentro para mover a área inteira.' : modo === 'imagem' ? 'Arraste a arte; os cantos ampliam/reduzem (ou a rodinha do mouse), a bolinha gira. A arte pode ficar maior que a área — a área só recorta. Este é o enquadramento padrão do mockup.' : 'Clique numa área para escolher; botão direito para o menu. “Nova área” para desenhar outra.'}</p>
          </div>

          <div className="space-y-3">
            <div className={cartao + ' space-y-1.5'} data-lista-areas>
              <p className="text-xs font-semibold">Áreas ({areas.length})</p>
              {!areas.length && <p className="text-[11px] text-gray-400">Nenhuma ainda — “Nova área” e desenhe sobre a face do produto.</p>}
              {areas.map(a => (
                <div key={a.id} data-area={a.nome} className={`rounded-lg border px-2 py-1.5 space-y-1 ${a.id === selId ? 'border-sky-400 bg-sky-50/60 dark:bg-sky-950/20' : 'border-gray-200 dark:border-gray-700'}`} onContextMenu={e => menuDaArea(e, a)}>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => selecionar(a.id)} className="flex-1 text-left text-xs font-medium truncate">{a.nome} <span className="text-gray-400 font-normal">· {a.area.pontos.length} pts{a.area.curvo ? ' · curva' : ''}</span></button>
                    <button onClick={() => selecionar(a.id, 'area')} title="Mexer na área"><Spline className="w-3.5 h-3.5 text-gray-400 hover:text-sky-600" /></button>
                    <button onClick={() => selecionar(a.id, 'imagem')} title="Mexer na imagem"><Move className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>
                    <button onClick={() => mudarArea(a.id, x => ({ ...x, oculta: !x.oculta }))} title={a.oculta ? 'Mostrar' : 'Ocultar'}>{a.oculta ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}</button>
                    <button onClick={() => excluir(a)} title="Excluir"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                  </div>
                  {a.id === selId && <>
                    <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 flex-wrap">
                      <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={!!a.area.curvo} onChange={e => mudarArea(a.id, x => ({ ...x, area: { ...x.area, curvo: e.target.checked } }))} /> superfície curva</label>
                      {a.area.curvo && <label className="inline-flex items-center gap-1">{a.area.arco ?? 70}°<input type="range" min={30} max={88} value={a.area.arco ?? 70} onChange={e => mudarArea(a.id, x => ({ ...x, area: { ...x.area, arco: Number(e.target.value) } }))} className="w-16 accent-orange-500" /></label>}
                      {artes.length > 1 && <select data-arte-da-area className="text-[11px] border border-gray-200 dark:border-gray-700 rounded px-1 bg-white dark:bg-gray-800" value={a.arte ?? ''} onChange={e => mudarArea(a.id, x => ({ ...x, arte: e.target.value === '' ? null : Number(e.target.value) }))} title="Arte desta área">
                        <option value="">arte principal</option>{artes.map((ar, i) => <option key={i} value={i}>{ar.nome}</option>)}
                      </select>}
                    </div>
                    {modo === 'imagem' && <div className="grid grid-cols-2 gap-x-2" data-ajuste-arte>
                      <label className="text-[10px] text-gray-500">Escala {Math.round(a.transform.escala * 100)}%<input type="range" min={ESCALA_MIN * 100} max={ESCALA_MAX * 100} value={Math.round(a.transform.escala * 100)} onChange={e => mudarArea(a.id, x => ({ ...x, transform: { ...x.transform, escala: Number(e.target.value) / 100 } }))} className="w-full accent-orange-500" /></label>
                      <label className="text-[10px] text-gray-500">Giro {a.transform.rot}°<input type="range" min={-180} max={180} value={a.transform.rot} onChange={e => mudarArea(a.id, x => ({ ...x, transform: { ...x.transform, rot: Number(e.target.value) } }))} className="w-full accent-orange-500" /></label>
                      <button onClick={() => mudarArea(a.id, x => ({ ...x, transform: { ...TRANSFORM_PADRAO } }))} className="col-span-2 text-[10px] text-gray-500 hover:text-orange-600 text-left">centralizar e preencher de novo</button>
                    </div>}
                  </>}
                </div>
              ))}
            </div>
            <div className={cartao + ' space-y-2'}>
              <p className="text-xs font-semibold">Arte de teste <span className="font-normal text-gray-400">(só para conferir o enquadramento)</span></p>
              <label className={btn + ' cursor-pointer !text-xs'}><ImagePlus className="w-3.5 h-3.5" /> Subir arte(s)<input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" data-artes onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) void addArtes(fs) }} /></label>
              {artes.length > 0 && <div className="flex flex-wrap gap-1">{artes.map((a, i) => (
                <button key={i} onClick={() => setPrincipal(i)} className={`relative w-12 h-12 rounded border overflow-hidden ${i === principal ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-200'}`} title={`${a.nome}${i === principal ? ' (principal)' : ''}`}>
                  <img src={a.canvas.toDataURL('image/jpeg', 0.5)} alt="" className="w-full h-full object-cover" />
                  <span onClick={e => { e.stopPropagation(); setArtes(x => x.filter((_, k) => k !== i)); setPrincipal(0); setAreas(x => x.map(ar => (ar.arte === i ? { ...ar, arte: null } : ar.arte != null && ar.arte > i ? { ...ar, arte: ar.arte - 1 } : ar))) }} className="absolute top-0 right-0 bg-white/80 text-[9px] px-0.5">✕</span>
                </button>))}</div>}
              <p className="text-[10px] text-gray-400">As artes de verdade entram em “Usar mockup” — lá cada arte cai na face certa pelo nome do arquivo.</p>
            </div>
            <div className={cartao + ' space-y-1'}>
              <p className="text-xs font-semibold">Realismo <span className="font-normal text-gray-400">(a luz e a sombra do produto na arte)</span></p>
              {faixa('sombra', 'Sombras do produto', 'Curvatura, dobras e sombras da imagem escurecem a arte')}
              {faixa('brilho', 'Brilhos / reflexo', 'Reflexos da imagem clareiam a arte')}
              {faixa('textura', 'Textura da superfície', 'O grão do papel/tecido aparece na arte')}
              {faixa('relevo', 'Relevo (deslocamento)', 'A arte acompanha amassados e costuras')}
              {faixa('material', 'Cor do material', 'Produto colorido tinge a tinta')}
              {faixa('opacidade', 'Opacidade da arte', '')}
              {faixa('borda', 'Borda suave', 'Suaviza o recorte (px)', 4)}
              <button onClick={() => setReal(r => ({ ...REALISMO_PADRAO, ajuste: r.ajuste }))} className="text-[11px] text-gray-400 hover:text-orange-600">voltar ao padrão</button>
            </div>
            <div className={cartao + ' space-y-1.5'}>
              <p className="text-xs font-semibold">Fundo</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => setFundo({ tipo: 'original' })} className={`text-xs rounded-full px-2.5 py-0.5 border ${fundo.tipo === 'original' ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200'}`}>o da imagem</button>
                <button disabled={!mascara} onClick={() => setFundo({ tipo: 'cor', cor: '#ffffff' })} className={`text-xs rounded-full px-2.5 py-0.5 border disabled:opacity-40 ${fundo.tipo === 'cor' ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200'}`} title={mascara ? 'Produto recortado sobre uma cor' : 'Use “Achar a área com IA” (ela recorta o produto)'}>cor lisa</button>
                {fundo.tipo === 'cor' && <input type="color" value={fundo.cor} onChange={e => setFundo({ tipo: 'cor', cor: e.target.value })} className="w-8 h-6 rounded border" />}
              </div>
            </div>
            <div className={cartao + ' space-y-2'}>
              <input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do mockup (ex.: Caixa Milk)" />
              <button onClick={salvar} disabled={!!ocupado} className={btn + ' w-full justify-center'}><Save className="w-4 h-4" /> {editId ? 'Atualizar mockup' : 'Salvar mockup (reutilizável)'}</button>
              {editId && onUsar && <button onClick={() => onUsar(editId)} className={btnP + ' w-full justify-center'} data-usar-mockup>Usar este mockup (gerar fotos) <ArrowRight className="w-4 h-4" /></button>}
              <p className="text-[10px] text-gray-400">Salvar guarda só a imagem-base e as áreas (sem a arte) — é configuração, feita uma vez.</p>
            </div>
          </div>
        </div>
      )}

      {/* acervo de imagens-base por segmento (autoral) */}
      {acervo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAcervo(null)}>
          <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2"><p className="font-semibold">Acervo — produtos em branco</p>
              <div className="flex items-center gap-2"><label className={btn + ' cursor-pointer !text-xs'}><FileUp className="w-3.5 h-3.5" /> Importar faca (DXF) → mockup<input type="file" accept=".dxf,.svg,.pdf,image/png" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void abrirFaca(f) }} /></label>
              <button onClick={() => setAcervo(null)}><X className="w-5 h-5 text-gray-400" /></button></div></div>
            {acervo === 'abrindo' ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Preparando o acervo…</p> : <>
              <FiltroSegmento itens={acervo} segmento={segAcervo} onSegmento={setSegAcervo} busca={buscaAcervo} onBusca={setBuscaAcervo} />
              <div className="grid gap-2 grid-cols-3 sm:grid-cols-5">
                {filtrarPorSegmento(acervo, segAcervo, buscaAcervo).map(m => (
                  <button key={m.id} onClick={() => usarDoAcervo(m)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 hover:border-orange-400 text-left" data-acervo={m.nome}>
                    <img src={(() => { const k = 200 / Math.max(m.produto.width, m.produto.height), c = novoCanvas(m.produto.width * k, m.produto.height * k); c.getContext('2d')!.drawImage(m.produto, 0, 0, c.width, c.height); return c.toDataURL('image/png') })()} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" />
                    <p className="text-[10px] truncate mt-1">{m.nome}</p>
                  </button>
                ))}
              </div>
            </>}
          </div>
        </div>
      )}
      {/* menu de botão direito */}
      {menu && (
        <div className="fixed z-50 min-w-[210px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl py-1 text-sm" style={{ left: Math.min(menu.x, window.innerWidth - 230), top: Math.max(8, Math.min(menu.y, window.innerHeight - 34 * menu.itens.length - 16)) }} role="menu" data-menu-contexto onClick={e => e.stopPropagation()}>
          {menu.itens.map((it, i) => (
            <button key={i} role="menuitem" disabled={it.off} onClick={() => { setMenu(null); it.acao() }} className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 ${it.perigo ? 'text-red-600' : 'text-gray-700 dark:text-gray-200'}`}>{it.rotulo}</button>
          ))}
        </div>
      )}
      {ocupado && (
        <div className="fixed bottom-4 right-4 z-40 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg w-80 space-y-1.5" role="status">
          <p className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {ocupado}</p>
        </div>
      )}
    </div>
  )
}
