'use client'
// SOA Edition — EDITOR DE IMAGEM EM CAMADAS (Fase 2): "Photoshop com jeito de Canva".
// Camadas (mover/girar/alinhar/agrupar/ordem/opacidade/mistura), objeto inteligente (troca do
// arquivo-fonte reflete em todos os designs), perspectiva 4 pontos e warp por malha, máscara por
// forma / pintura / recorte por camada, ajustes não-destrutivos, desfazer/refazer, salvamento
// automático e exportação nos tamanhos de cada marketplace.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Canvas, FabricImage, FabricObject, Textbox, Rect, Ellipse, Polygon, Circle, Group, ActiveSelection, Point, Shadow } from 'fabric'
import {
  ArrowLeft, Undo2, Redo2, Type, Square, Circle as CircleIcon, Star, Heart, ImagePlus, Upload, Eye, EyeOff, Lock, Unlock,
  ChevronUp, ChevronDown, Trash2, Copy, Group as GroupIcon, Ungroup, Download, Loader2, X, AlignStartVertical, AlignCenterVertical,
  AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Brush, Scan, Grid3x3, Link2, RefreshCw, Check,
} from 'lucide-react'
import { FONTES_NATIVAS, CLASSES_PRECARGA } from '../fontesNativas'
import CotaBarra from '../CotaBarra'
import {
  soa, camadas, criarCamadaImagem, processarCamada, aplicarRecortes, agrupar, desagrupar, serializar, desserializar,
  trocarFonteDasInstancias, renderizarDesign, cenaParaOriginal, originalParaCena, pintarMascara, gravarMascara, limparMascara,
  duplicarCamada, novoIdCamada, pontosEstrela, pontosCoracao, type FonteDesign, type DesignJson, type FormaMascaraTipo, type Soa,
} from '@/lib/estudio/camadas'
import { AJUSTES_NEUTROS, FILTROS, type Ajustes } from '@/lib/estudio/ajustes'
import { gradeNeutra, type Distorcao } from '@/lib/estudio/transform'
import { prepararMolde, enviarArquivo, enviarSoBlob, baixar, reservarCota, fecharCota, SemCota } from '@/lib/estudio/cliente'
import { TAMANHOS_CANAIS, TAMANHOS_REVISADOS_EM, rotuloTamanho } from '@/lib/estudio/tamanhos'
import { processarImagem, codificar, type Saida } from '@/lib/estudio/acoes'
import { LIMITE_LOTE } from '@/lib/estudio/dados'

const BLENDS = [
  { v: 'source-over', r: 'Normal' }, { v: 'multiply', r: 'Multiplicar' }, { v: 'screen', r: 'Tela' }, { v: 'overlay', r: 'Sobrepor' },
] as const
const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-0.5'
const btnIc = 'p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-400 disabled:opacity-30'

type Modo = 'normal' | 'distorcer' | 'mascara'
interface Design { nome: string; largura: number; altura: number }
interface BibliotecaFonte { id: string; nome: string; url: string; familia: string; acervo: boolean }

export default function EditorCamadas({ designId }: { designId: string }) {
  // Fora do React Compiler: o estado das camadas vive no canvas do Fabric (mutável, fora do
  // React); memoizar derivados dele deixaria painel/lista desatualizados.
  'use no memo'
  const { data: session } = useSession()
  const workspaceId = (session?.user as { workspaceId?: string } | undefined)?.workspaceId

  const hostRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<HTMLCanvasElement>(null)
  const fabRef = useRef<Canvas | null>(null)
  const [design, setDesign] = useState<Design | null>(null)
  const designRef = useRef<Design | null>(null)
  const zoomRef = useRef(1)
  const [, setVersao] = useState(0)
  const tocar = useCallback(() => setVersao(v => v + 1), [])
  const [ativos, setAtivos] = useState<FabricObject[]>([])
  const [status, setStatus] = useState<'carregando' | 'salvo' | 'pendente' | 'salvando' | 'erro'>('carregando')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [storage, setStorage] = useState(false)
  const [modo, setModo] = useState<Modo>('normal')
  const modoRef = useRef<Modo>('normal')
  const [pincel, setPincel] = useState<{ modo: 'esconder' | 'revelar'; raio: number }>({ modo: 'esconder', raio: 30 })
  const pincelRef = useRef(pincel)
  useEffect(() => { pincelRef.current = pincel }, [pincel])
  const [biblioteca, setBiblioteca] = useState<BibliotecaFonte[]>([])
  const fontesRef = useRef<FonteDesign[]>([])
  const [imagensLib, setImagensLib] = useState<{ id: string; nome: string; url: string }[] | null>(null)
  const [exportar, setExportar] = useState(false)
  const [cotaVersao, setCotaVersao] = useState(0)
  const [faltam, setFaltam] = useState(0)
  const [renomeando, setRenomeando] = useState<string | null>(null)

  // histórico / salvamento
  const carregandoRef = useRef(true)
  const pilhaRef = useRef<string[]>([])
  const refazerRef = useRef<string[]>([])
  const ultimoRef = useRef('')
  const histTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const salvarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  // distorção / máscara
  const alvoRef = useRef<FabricImage | null>(null)
  const backupDistRef = useRef<Distorcao | null>(null)
  const pintandoRef = useRef<{ x: number; y: number } | null>(null)
  const cursorRef = useRef<Circle | null>(null)
  const eventedRef = useRef<Map<FabricObject, boolean>>(new Map())

  // processamento coalescido (um por quadro)
  const pendentesRef = useRef<Set<FabricImage>>(new Set())
  const rodandoRef = useRef(false)
  const agendarProcessamento = useCallback((img: FabricImage) => {
    pendentesRef.current.add(img)
    if (rodandoRef.current) return
    rodandoRef.current = true
    requestAnimationFrame(async () => {
      const c = fabRef.current
      while (pendentesRef.current.size) {
        const lote = [...pendentesRef.current]; pendentesRef.current.clear()
        for (const i of lote) await processarCamada(i)
      }
      if (c) {
        if (camadas(c).some(o => soa(o).soaClipDe)) await aplicarRecortes(c)
        reposicionarAlcas()
        c.requestRenderAll()
      }
      rodandoRef.current = false
    })
  }, [])

  // ── salvar / histórico ───────────────────────────────────────────────────────
  const salvar = useCallback(async () => {
    const c = fabRef.current, d = designRef.current
    if (!c || !d) return
    setStatus('salvando')
    try {
      const { json, assetIds } = serializar(c, fontesRef.current)
      const previewUrl = renderizarDesign(c, zoomRef.current, 240 / Math.max(d.largura, d.altura)).toDataURL('image/jpeg', 0.7)
      const r = await fetch(`/api/estudio/designs/${designId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ json, assetIds, previewUrl, nome: d.nome }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'falha')
      setStatus('salvo')
    } catch (e) { setStatus('erro'); setErro('Não consegui salvar: ' + (e as Error).message) }
  }, [designId])

  const snapshot = useCallback(() => {
    const c = fabRef.current
    if (!c) return
    const s = JSON.stringify(serializar(c, fontesRef.current).json)
    if (s === ultimoRef.current) return
    if (ultimoRef.current) { pilhaRef.current.push(ultimoRef.current); if (pilhaRef.current.length > 40) pilhaRef.current.shift() }
    refazerRef.current = []
    ultimoRef.current = s
    tocar()
  }, [tocar])

  const alterou = useCallback(() => {
    if (carregandoRef.current) return
    tocar()
    setStatus('pendente')
    if (histTimer.current) clearTimeout(histTimer.current)
    histTimer.current = setTimeout(snapshot, 350)
    if (salvarTimer.current) clearTimeout(salvarTimer.current)
    salvarTimer.current = setTimeout(salvar, 2000)
  }, [salvar, snapshot, tocar])

  async function restaurar(s: string) {
    const c = fabRef.current
    if (!c) return
    carregandoRef.current = true
    try { await desserializar(c, JSON.parse(s) as DesignJson, {}) } finally { carregandoRef.current = false }
    ultimoRef.current = s
    setAtivos([]); tocar(); setStatus('pendente')
    if (salvarTimer.current) clearTimeout(salvarTimer.current)
    salvarTimer.current = setTimeout(salvar, 1200)
  }
  function desfazer() {
    if (modoRef.current !== 'normal' || !pilhaRef.current.length) return
    refazerRef.current.push(ultimoRef.current)
    restaurar(pilhaRef.current.pop()!)
  }
  function refazer() {
    if (modoRef.current !== 'normal' || !refazerRef.current.length) return
    pilhaRef.current.push(ultimoRef.current)
    restaurar(refazerRef.current.pop()!)
  }

  // ── zoom para caber na tela ─────────────────────────────────────────────────
  const ajustarZoom = useCallback(() => {
    const c = fabRef.current, host = hostRef.current, d = designRef.current
    if (!c || !host || !d) return
    const k = Math.min(host.clientWidth / d.largura, Math.max(320, window.innerHeight * 0.72) / d.altura, 1)
    zoomRef.current = k
    c.setDimensions({ width: Math.round(d.largura * k), height: Math.round(d.altura * k) })
    c.setZoom(k)
    reposicionarAlcas()
    c.requestRenderAll()
  }, [])

  // ── montar canvas + abrir design ───────────────────────────────────────────
  useEffect(() => {
    if (!elRef.current) return
    const c = new Canvas(elRef.current, { preserveObjectStacking: true, selection: true, backgroundColor: '#ffffff' })
    fabRef.current = c
    const selecao = () => setAtivos(c.getActiveObjects().filter(o => !soa(o).soaAjudante))
    c.on('selection:created', selecao); c.on('selection:updated', selecao); c.on('selection:cleared', selecao)
    c.on('object:modified', e => { if (!soa(e.target as FabricObject).soaAjudante) alterou() })
    c.on('object:added', e => { if (!soa(e.target as FabricObject).soaAjudante) alterou() })
    c.on('object:removed', e => { if (!soa(e.target as FabricObject).soaAjudante) alterou() })
    c.on('text:changed', () => alterou())
    c.on('object:moving', e => { const t = e.target as FabricObject & { soaIdx?: number }; if (soa(t).soaAjudante && t.soaIdx !== undefined) alcaMovida(t) })
    c.on('mouse:down', e => { if (modoRef.current === 'mascara') iniciarPincel(e.scenePoint) })
    c.on('mouse:move', e => { if (modoRef.current === 'mascara') moverPincel(e.scenePoint) })
    c.on('mouse:up', () => { if (modoRef.current === 'mascara') soltarPincel() })

    let vivo = true
    ;(async () => {
      fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => {})
      fetch('/api/estudio/fontes').then(r => r.json()).then(d => setBiblioteca([
        ...(d.minhas || []).map((f: BibliotecaFonte) => ({ ...f, acervo: false })),
        ...(d.acervo || []).map((f: BibliotecaFonte) => ({ ...f, acervo: true })),
      ].filter(f => f.url && f.familia))).catch(() => {})
      try {
        const r = await fetch(`/api/estudio/designs/${designId}`)
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Design não encontrado')
        if (!vivo) return
        const d: Design = { nome: j.design.nome, largura: j.design.largura, altura: j.design.altura }
        designRef.current = d; setDesign(d)
        ajustarZoom()
        const urls: Record<string, string> = {}
        for (const a of j.assets || []) urls[a.id] = a.url
        const json = j.design.json as DesignJson
        if (json?.fabric && (json.fabric as { objects?: unknown[] }).objects) {
          fontesRef.current = json.fontes || []
          await desserializar(c, json, urls)
        }
        await document.fonts?.ready
        c.getObjects().forEach(o => { if (o instanceof Textbox) o.initDimensions() })
        c.requestRenderAll()
        ultimoRef.current = JSON.stringify(serializar(c, fontesRef.current).json)
        setStatus('salvo')
      } catch (e) { setErro((e as Error).message); setStatus('erro') }
      finally { carregandoRef.current = false; tocar() }
    })()

    const teclas = (e: KeyboardEvent) => {
      const alvoTexto = (e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable]')
      const ativo = c.getActiveObject()
      if (alvoTexto || (ativo instanceof Textbox && ativo.isEditing)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); refazer() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && ativo && modoRef.current === 'normal') { e.preventDefault(); excluir() }
    }
    const antesDeSair = (e: BeforeUnloadEvent) => { if (statusRef.current === 'pendente' || statusRef.current === 'salvando') { salvar(); e.preventDefault() } }
    window.addEventListener('keydown', teclas)
    window.addEventListener('beforeunload', antesDeSair)
    window.addEventListener('resize', ajustarZoom)
    return () => {
      vivo = false
      window.removeEventListener('keydown', teclas)
      window.removeEventListener('beforeunload', antesDeSair)
      window.removeEventListener('resize', ajustarZoom)
      fabRef.current = null
      void c.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId])

  const c = fabRef.current
  const um = ativos.length === 1 ? ativos[0] : null
  const lista = c ? [...camadas(c)].reverse() : []

  // ── adicionar camadas ────────────────────────────────────────────────────────
  function centralizar(o: FabricObject) {
    const d = designRef.current!
    o.setPositionByOrigin(new Point(d.largura / 2, d.altura / 2), 'center', 'center')
    o.setCoords()
  }
  function adicionar(o: FabricObject, nome: string, tipo: Soa['soaTipo']) {
    if (!c) return
    Object.assign(o, { soaId: novoIdCamada(), soaNome: nome, soaTipo: tipo } satisfies Soa)
    centralizar(o)
    c.add(o); c.setActiveObject(o); c.requestRenderAll()
  }
  function addTexto() {
    const d = designRef.current!
    const t = new Textbox('Seu texto', {
      width: d.largura * 0.6, fontSize: Math.round(d.altura * 0.08), fontFamily: FONTES_NATIVAS[0].familia, fill: '#1f2937', textAlign: 'center',
    })
    ;(t as FabricObject & Soa).soaFonte = FONTES_NATIVAS[0].id
    adicionar(t, 'Texto', 'texto')
  }
  function addForma(f: 'retangulo' | 'elipse' | 'estrela' | 'coracao') {
    const d = designRef.current!
    const L = Math.min(d.largura, d.altura) * 0.35
    const base = { fill: '#fb923c', stroke: null as string | null, strokeWidth: 0 }
    const o = f === 'retangulo' ? new Rect({ ...base, width: L, height: L * 0.7, rx: 0, ry: 0 })
      : f === 'elipse' ? new Ellipse({ ...base, rx: L / 2, ry: L / 2 })
      : f === 'estrela' ? new Polygon(pontosEstrela(L, L), base)
      : new Polygon(pontosCoracao(L, L), base)
    adicionar(o, { retangulo: 'Retângulo', elipse: 'Círculo', estrela: 'Estrela', coracao: 'Coração' }[f], 'forma')
  }
  async function addImagemArquivo(f: File) {
    if (!c || !workspaceId) return
    if (!storage) { setErro('O armazenamento de arquivos não está configurado — não dá para guardar imagens no design.'); return }
    setOcupado('Enviando imagem…'); setErro('')
    try {
      const prep = await prepararMolde(f)
      const up = await enviarArquivo(prep.copia, prep.nomeCopia, 'imagem', workspaceId, { pasta: 'Imagens', meta: { largura: prep.molde.largura, altura: prep.molde.altura } })
      const img = await criarCamadaImagem(up.url, up.id, f.name.replace(/\.[^.]+$/, ''), designRef.current!)
      centralizar(img); c.add(img); c.setActiveObject(img); c.requestRenderAll()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function abrirBibliotecaImagens() {
    const d = await fetch('/api/estudio/assets').then(r => r.json()).catch(() => ({ assets: [] }))
    setImagensLib((d.assets || []).filter((a: { tipo: string; mime: string | null }) => ['imagem', 'molde', 'gerado', 'mockup'].includes(a.tipo) && (a.mime || '').startsWith('image/')))
  }
  async function addImagemBiblioteca(a: { id: string; nome: string; url: string }) {
    if (!c) return
    setImagensLib(null); setOcupado('Abrindo imagem…')
    try {
      const img = await criarCamadaImagem(a.url, a.id, a.nome.replace(/\.[^.]+$/, ''), designRef.current!)
      centralizar(img); c.add(img); c.setActiveObject(img); c.requestRenderAll()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  // ── ações de camada ─────────────────────────────────────────────────────────
  function mudar(o: FabricObject, props: Record<string, unknown>) {
    o.set(props); o.setCoords(); o.dirty = true
    if (o instanceof Textbox) o.initDimensions()
    c?.requestRenderAll(); alterou()
  }
  function excluir() {
    const c = fabRef.current
    if (!c) return
    const sel = c.getActiveObjects().filter(o => !soa(o).soaAjudante)
    if (!sel.length) return
    c.discardActiveObject(); c.remove(...sel)
    aplicarRecortes(c).then(() => c.requestRenderAll())
  }
  async function duplicar() {
    if (!c || !um) return
    const d = await duplicarCamada(um)
    d.set({ left: (d.left || 0) + 20, top: (d.top || 0) + 20 }); d.setCoords()
    c.add(d); c.setActiveObject(d); c.requestRenderAll()
  }
  function ordem(dir: 'frente' | 'tras' | 'topo' | 'fundo', o: FabricObject) {
    if (!c) return
    if (dir === 'frente') c.bringObjectForward(o); else if (dir === 'tras') c.sendObjectBackwards(o)
    else if (dir === 'topo') c.bringObjectToFront(o); else c.sendObjectToBack(o)
    c.requestRenderAll(); alterou()
  }
  function alinhar(tipo: 'esq' | 'centroH' | 'dir' | 'topo' | 'centroV' | 'base') {
    if (!c || !ativos.length) return
    const objs = [...ativos]
    c.discardActiveObject()
    const d = designRef.current!
    const rects = objs.map(o => o.getBoundingRect())
    const ref = objs.length === 1 ? { left: 0, top: 0, width: d.largura, height: d.altura } : {
      left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)),
      width: Math.max(...rects.map(r => r.left + r.width)) - Math.min(...rects.map(r => r.left)),
      height: Math.max(...rects.map(r => r.top + r.height)) - Math.min(...rects.map(r => r.top)),
    }
    objs.forEach((o, i) => {
      const r = rects[i]
      let dx = 0, dy = 0
      if (tipo === 'esq') dx = ref.left - r.left
      if (tipo === 'centroH') dx = ref.left + ref.width / 2 - (r.left + r.width / 2)
      if (tipo === 'dir') dx = ref.left + ref.width - (r.left + r.width)
      if (tipo === 'topo') dy = ref.top - r.top
      if (tipo === 'centroV') dy = ref.top + ref.height / 2 - (r.top + r.height / 2)
      if (tipo === 'base') dy = ref.top + ref.height - (r.top + r.height)
      o.set({ left: (o.left || 0) + dx, top: (o.top || 0) + dy }); o.setCoords()
    })
    c.setActiveObject(objs.length === 1 ? objs[0] : new ActiveSelection(objs, { canvas: c }))
    aplicarRecortes(c).then(() => { c.requestRenderAll(); alterou() })
  }
  function selecionarDaLista(o: FabricObject, multi: boolean) {
    if (!c || modoRef.current !== 'normal') return
    if (multi && ativos.length && !ativos.includes(o)) {
      const objs = [...ativos, o]
      c.discardActiveObject(); c.setActiveObject(new ActiveSelection(objs, { canvas: c }))
    } else c.setActiveObject(o)
    c.requestRenderAll(); setAtivos(c.getActiveObjects())
  }
  function travar(o: FabricObject, t: boolean) {
    soa(o).soaTravado = t
    o.set({ lockMovementX: t, lockMovementY: t, lockRotation: t, lockScalingX: t, lockScalingY: t, hasControls: !t })
    if (o instanceof Textbox) o.editable = !t
    c?.requestRenderAll(); alterou()
  }

  // ── ajustes (imagem) ────────────────────────────────────────────────────────
  function mudarAjuste(img: FabricImage, patch: Partial<Ajustes>) {
    const a = soa(img).soaAjustes || AJUSTES_NEUTROS
    soa(img).soaAjustes = { ...a, ...patch, curvas: { ...a.curvas, ...(patch.curvas || {}) } }
    agendarProcessamento(img); alterou()
  }

  // ── distorção ───────────────────────────────────────────────────────────────
  function reposicionarAlcas() {
    const cv = fabRef.current, img = alvoRef.current
    if (!cv || !img || modoRef.current !== 'distorcer') return
    const d = soa(img).soaDistorcao
    if (!d) return
    for (const h of cv.getObjects()) {
      const idx = (h as FabricObject & { soaIdx?: number }).soaIdx
      if (!soa(h).soaAjudante || idx === undefined || cv.getActiveObject() === h) continue
      const p = originalParaCena(img, d.pontos[idx].x, d.pontos[idx].y)
      h.set({ left: p.x, top: p.y, radius: 7 / zoomRef.current, strokeWidth: 2 / zoomRef.current }); h.setCoords()
    }
  }
  function entrarDistorcao(img: FabricImage, tipo: 'perspectiva' | 'malha', n: number) {
    if (!c) return
    const s = soa(img)
    const cols = tipo === 'perspectiva' ? 2 : n
    backupDistRef.current = s.soaDistorcao ? structuredClone(s.soaDistorcao) : null
    const mesmo = s.soaDistorcao && s.soaDistorcao.tipo === tipo && s.soaDistorcao.cols === cols
    s.soaDistorcao = mesmo ? s.soaDistorcao : { tipo, cols, rows: cols, pontos: gradeNeutra(1, 1, cols, cols) }
    c.discardActiveObject()
    img.set({ selectable: false, evented: false })
    alvoRef.current = img
    modoRef.current = 'distorcer'; setModo('distorcer')
    s.soaDistorcao!.pontos.forEach((pt, i) => {
      const p = originalParaCena(img, pt.x, pt.y)
      const h = new Circle({
        left: p.x, top: p.y, radius: 7 / zoomRef.current, fill: '#f97316', stroke: '#ffffff', strokeWidth: 2 / zoomRef.current,
        originX: 'center', originY: 'center', hasControls: false, hasBorders: false, excludeFromExport: true,
      })
      Object.assign(h, { soaAjudante: true, soaIdx: i })
      c.add(h)
    })
    agendarProcessamento(img)
  }
  function alcaMovida(h: FabricObject & { soaIdx?: number }) {
    const img = alvoRef.current
    if (!img || h.soaIdx === undefined) return
    const d = soa(img).soaDistorcao
    if (!d) return
    const { u, v } = cenaParaOriginal(img, h.left!, h.top!)
    d.pontos[h.soaIdx] = { x: u, y: v }
    agendarProcessamento(img)
  }
  function sairDistorcao(acao: 'aplicar' | 'cancelar' | 'zerar') {
    if (!c) return
    const img = alvoRef.current
    c.getObjects().filter(o => soa(o).soaAjudante).forEach(o => c.remove(o))
    if (img) {
      if (acao === 'cancelar') soa(img).soaDistorcao = backupDistRef.current
      if (acao === 'zerar') soa(img).soaDistorcao = null
      img.set({ selectable: true, evented: true })
      agendarProcessamento(img)
      c.setActiveObject(img)
    }
    alvoRef.current = null
    modoRef.current = 'normal'; setModo('normal')
    alterou()
  }

  // ── máscara de pintura ──────────────────────────────────────────────────────
  function entrarMascara(img: FabricImage) {
    if (!c) return
    if (soa(img).soaDistorcao) { setAviso('Pinte a máscara antes de distorcer (ou zere a distorção): a máscara segue a imagem original.'); return }
    c.discardActiveObject()
    eventedRef.current = new Map(camadas(c).map(o => [o, o.evented]))
    camadas(c).forEach(o => { o.evented = false })
    c.selection = false
    c.defaultCursor = 'crosshair'
    alvoRef.current = img
    const cur = new Circle({ radius: pincelRef.current.raio / zoomRef.current, fill: 'rgba(249,115,22,0.15)', stroke: '#f97316', strokeWidth: 1 / zoomRef.current, originX: 'center', originY: 'center', evented: false, selectable: false, excludeFromExport: true, left: -999, top: -999 })
    Object.assign(cur, { soaAjudante: true })
    cursorRef.current = cur; c.add(cur)
    modoRef.current = 'mascara'; setModo('mascara')
  }
  async function iniciarPincel(p: Point) {
    const img = alvoRef.current
    if (!img) return
    pintandoRef.current = { x: p.x, y: p.y }
    await pintarMascara(img, p, p, pincelRef.current.raio / zoomRef.current, pincelRef.current.modo)
    agendarProcessamento(img)
  }
  async function moverPincel(p: Point) {
    const cur = cursorRef.current
    if (cur && fabRef.current) { cur.set({ left: p.x, top: p.y, radius: pincelRef.current.raio / zoomRef.current }); fabRef.current.requestRenderAll() }
    const img = alvoRef.current, de = pintandoRef.current
    if (!img || !de) return
    pintandoRef.current = { x: p.x, y: p.y }
    await pintarMascara(img, de, p, pincelRef.current.raio / zoomRef.current, pincelRef.current.modo)
    agendarProcessamento(img)
  }
  function soltarPincel() {
    const img = alvoRef.current
    if (!img || !pintandoRef.current) return
    pintandoRef.current = null
    gravarMascara(img); alterou()
  }
  function sairMascara() {
    if (!c) return
    if (cursorRef.current) { c.remove(cursorRef.current); cursorRef.current = null }
    eventedRef.current.forEach((ev, o) => { o.evented = ev })
    c.selection = true; c.defaultCursor = 'default'
    const img = alvoRef.current
    alvoRef.current = null
    modoRef.current = 'normal'; setModo('normal')
    if (img) { c.setActiveObject(img); c.requestRenderAll() }
  }

  // ── máscara por forma / recorte por camada ──────────────────────────────────
  function mudarRecorte(o: FabricObject, patch: Partial<Soa>) {
    Object.assign(o, patch)
    if (!c) return
    aplicarRecortes(c).then(() => { c.requestRenderAll(); alterou(); tocar() })
  }

  // ── objeto inteligente: trocar arquivo-fonte ────────────────────────────────
  async function trocarArquivoFonte(img: FabricImage, f: File) {
    const assetId = soa(img).soaAssetId
    if (!c || !assetId || !workspaceId) return
    setOcupado('Trocando o arquivo-fonte…'); setErro('')
    try {
      const prep = await prepararMolde(f)
      const url = await enviarSoBlob(prep.copia, prep.nomeCopia, 'imagem', workspaceId)
      const r = await fetch(`/api/estudio/assets/${assetId}/versao`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mime: prep.mimeCopia, tamanhoBytes: prep.copia.size, largura: prep.molde.largura, altura: prep.molde.altura }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao trocar o arquivo')
      const n = await trocarFonteDasInstancias(c, assetId, url)
      const outros = Math.max(0, (j.usadoEm || 0) - 1)
      setAviso(`Arquivo-fonte trocado: ${n} camada(s) aqui${outros ? ` e ${outros} outro(s) design(s)` : ''} já mostram a versão nova.`)
      alterou()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  // ── fontes do texto ─────────────────────────────────────────────────────────
  async function mudarFonte(t: Textbox, valor: string) {
    if (valor.startsWith('b:')) {
      const f = biblioteca.find(x => x.id === valor.slice(2))
      if (!f) return
      try { const ff = new FontFace(f.familia, `url(${f.url})`); await ff.load(); document.fonts.add(ff) } catch { setErro('Não consegui carregar essa fonte.'); return }
      if (!fontesRef.current.some(x => x.id === f.id)) fontesRef.current = [...fontesRef.current, { id: f.id, familia: f.familia, url: f.url }]
      ;(t as FabricObject & Soa).soaFonte = `u:${f.id}`
      mudar(t, { fontFamily: f.familia })
    } else {
      const n = FONTES_NATIVAS.find(x => x.id === valor)
      if (!n) return
      await document.fonts.load(`40px ${n.familia}`).catch(() => [])
      ;(t as FabricObject & Soa).soaFonte = n.id
      mudar(t, { fontFamily: n.familia })
    }
  }

  // ─────────────────────────────────────────────────────────────── UI
  const statusTxt = { carregando: 'Abrindo…', salvo: 'Salvo', pendente: 'Alterações não salvas…', salvando: 'Salvando…', erro: 'Erro ao salvar' }[status]
  const img = um instanceof FabricImage ? um : null
  const txt = um instanceof Textbox ? um : null
  const forma = um && !img && !txt && !(um instanceof Group) ? um : null
  const s = um ? soa(um) : null

  return (
    <div className="max-w-[1500px] mx-auto p-3 sm:p-4 space-y-3">
      <div aria-hidden className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        {CLASSES_PRECARGA.map(cl => <span key={cl} className={cl}>Aa<b>Aa</b><i>Aa</i></span>)}
      </div>

      {/* barra superior */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/estudio/editor" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Designs</Link>
        {design && (
          <input value={design.nome} onChange={e => { const d = { ...design, nome: e.target.value }; designRef.current = d; setDesign(d); alterou() }}
            className="font-semibold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-400 focus:outline-none px-1 min-w-0 w-56" />
        )}
        {design && <span className="text-xs text-gray-400 tabular-nums">{design.largura}×{design.altura}px</span>}
        <span className={`text-xs ${status === 'erro' ? 'text-red-600' : status === 'salvo' ? 'text-emerald-600' : 'text-gray-400'}`}>{statusTxt}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={desfazer} disabled={!pilhaRef.current.length || modo !== 'normal'} className={btnIc} title="Desfazer (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
          <button onClick={refazer} disabled={!refazerRef.current.length || modo !== 'normal'} className={btnIc} title="Refazer (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4" /></button>
          <button onClick={() => setExportar(true)} disabled={!design || modo !== 'normal'} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      <CotaBarra atualizar={cotaVersao} faltam={faltam} />
      {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex justify-between gap-2"><span>{erro}</span><button onClick={() => setErro('')}><X className="w-4 h-4" /></button></div>}
      {aviso && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2 flex justify-between gap-2"><span>{aviso}</span><button onClick={() => setAviso('')}><X className="w-4 h-4" /></button></div>}

      <div className="grid gap-3 lg:grid-cols-[52px_1fr_300px]">
        {/* ferramentas */}
        <div className="flex lg:flex-col gap-1.5 flex-wrap">
          <button onClick={addTexto} disabled={modo !== 'normal'} className={btnIc} title="Texto"><Type className="w-5 h-5" /></button>
          <label className={btnIc + ' cursor-pointer'} title="Enviar imagem"><Upload className="w-5 h-5" />
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) addImagemArquivo(f); e.target.value = '' }} />
          </label>
          <button onClick={abrirBibliotecaImagens} disabled={modo !== 'normal'} className={btnIc} title="Imagem de Meus arquivos"><ImagePlus className="w-5 h-5" /></button>
          <button onClick={() => addForma('retangulo')} disabled={modo !== 'normal'} className={btnIc} title="Retângulo"><Square className="w-5 h-5" /></button>
          <button onClick={() => addForma('elipse')} disabled={modo !== 'normal'} className={btnIc} title="Círculo"><CircleIcon className="w-5 h-5" /></button>
          <button onClick={() => addForma('estrela')} disabled={modo !== 'normal'} className={btnIc} title="Estrela"><Star className="w-5 h-5" /></button>
          <button onClick={() => addForma('coracao')} disabled={modo !== 'normal'} className={btnIc} title="Coração"><Heart className="w-5 h-5" /></button>
          <label className={btnIc + ' cursor-pointer relative'} title="Cor de fundo">
            <span className="block w-5 h-5 rounded border border-gray-300" style={{ background: (c?.backgroundColor as string) || 'transparent' }} />
            <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={(c?.backgroundColor as string) || '#ffffff'} onChange={e => { if (c) { c.backgroundColor = e.target.value; c.requestRenderAll(); alterou() } }} />
          </label>
          <button onClick={() => { if (c) { c.backgroundColor = ''; c.requestRenderAll(); alterou() } }} className={btnIc + ' text-[9px] leading-none'} title="Fundo transparente">sem<br />fundo</button>
        </div>

        {/* área de trabalho */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3 min-h-[360px] relative"
          style={{ backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%)', backgroundSize: '16px 16px' }}>
          <div ref={hostRef} className="w-full flex justify-center"><div className="shadow-lg"><canvas ref={elRef} /></div></div>
          {(ocupado || status === 'carregando') && (
            <div className="absolute inset-0 bg-white/60 dark:bg-gray-950/60 flex items-center justify-center text-sm text-gray-700 dark:text-gray-200 gap-2 rounded-2xl">
              <Loader2 className="w-5 h-5 animate-spin" /> {ocupado || 'Abrindo o design…'}
            </div>
          )}
          {modo === 'distorcer' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-gray-900 text-white text-xs px-3 py-2 shadow-lg">
              Arraste os pontos laranja
              <button onClick={() => sairDistorcao('aplicar')} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2 py-1 font-semibold"><Check className="w-3.5 h-3.5" /> Aplicar</button>
              <button onClick={() => sairDistorcao('zerar')} className="rounded-lg border border-white/30 px-2 py-1">Zerar</button>
              <button onClick={() => sairDistorcao('cancelar')} className="rounded-lg border border-white/30 px-2 py-1">Cancelar</button>
            </div>
          )}
          {modo === 'mascara' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-wrap items-center gap-2 rounded-xl bg-gray-900 text-white text-xs px-3 py-2 shadow-lg">
              <button onClick={() => setPincel(p => ({ ...p, modo: 'esconder' }))} className={`rounded-lg px-2 py-1 ${pincel.modo === 'esconder' ? 'bg-orange-500 font-semibold' : 'border border-white/30'}`}>Esconder</button>
              <button onClick={() => setPincel(p => ({ ...p, modo: 'revelar' }))} className={`rounded-lg px-2 py-1 ${pincel.modo === 'revelar' ? 'bg-orange-500 font-semibold' : 'border border-white/30'}`}>Revelar</button>
              <span>Pincel</span>
              <input type="range" min={4} max={150} value={pincel.raio} onChange={e => setPincel(p => ({ ...p, raio: Number(e.target.value) }))} className="w-24 accent-orange-500" />
              <button onClick={sairMascara} className="inline-flex items-center gap-1 rounded-lg bg-white text-gray-900 px-2 py-1 font-semibold"><Check className="w-3.5 h-3.5" /> Pronto</button>
            </div>
          )}
        </div>

        {/* painel lateral: propriedades + camadas */}
        <div className="space-y-3 lg:max-h-[82vh] lg:overflow-y-auto">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-3">
            {!ativos.length && <p className="text-xs text-gray-400">Selecione uma camada para editar. Shift+clique na lista seleciona várias.</p>}
            {ativos.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{ativos.length} camadas selecionadas</p>
                <button onClick={() => { if (c) { agrupar(c); aplicarRecortes(c).then(() => { c.requestRenderAll(); alterou() }) } }} className="w-full inline-flex items-center justify-center gap-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 hover:border-orange-400"><GroupIcon className="w-4 h-4" /> Agrupar</button>
              </div>
            )}
            {!!ativos.length && modo === 'normal' && (
              <div>
                <p className={lbl}>Alinhar {ativos.length === 1 ? 'na arte' : 'entre si'}</p>
                <div className="flex gap-1">
                  {([['esq', AlignStartVertical], ['centroH', AlignCenterVertical], ['dir', AlignEndVertical], ['topo', AlignStartHorizontal], ['centroV', AlignCenterHorizontal], ['base', AlignEndHorizontal]] as const).map(([t, I]) => (
                    <button key={t} onClick={() => alinhar(t)} className={btnIc}><I className="w-4 h-4" /></button>
                  ))}
                </div>
              </div>
            )}
            {um && s && modo === 'normal' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>Opacidade {Math.round((um.opacity ?? 1) * 100)}%</label>
                    <input type="range" min={0} max={100} value={Math.round((um.opacity ?? 1) * 100)} onChange={e => mudar(um, { opacity: Number(e.target.value) / 100 })} className="w-full accent-orange-500" />
                  </div>
                  <div>
                    <label className={lbl}>Mistura</label>
                    <select className={inp} value={um.globalCompositeOperation || 'source-over'} onChange={e => mudar(um, { globalCompositeOperation: e.target.value })}>
                      {BLENDS.map(b => <option key={b.v} value={b.v}>{b.r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button onClick={duplicar} className={btnIc} title="Duplicar"><Copy className="w-4 h-4" /></button>
                  {um instanceof Group && <button onClick={() => { if (c) { const f = desagrupar(c, um); c.setActiveObject(new ActiveSelection(f, { canvas: c })); c.requestRenderAll(); alterou() } }} className={btnIc} title="Desagrupar"><Ungroup className="w-4 h-4" /></button>}
                  <button onClick={() => ordem('frente', um)} className={btnIc} title="Trazer para frente"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => ordem('tras', um)} className={btnIc} title="Enviar para trás"><ChevronDown className="w-4 h-4" /></button>
                  <button onClick={excluir} className={btnIc + ' text-red-600'} title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </div>

                {txt && (
                  <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                    <textarea className={inp + ' min-h-[56px]'} value={txt.text} onChange={e => mudar(txt, { text: e.target.value })} />
                    <div className="grid grid-cols-[1fr_64px] gap-2">
                      <select className={inp} value={(s.soaFonte?.startsWith('u:') ? `b:${s.soaFonte.slice(2)}` : s.soaFonte) || ''} onChange={e => mudarFonte(txt, e.target.value)}>
                        {FONTES_NATIVAS.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                        {!!biblioteca.filter(b => !b.acervo).length && <optgroup label="Minhas fontes">{biblioteca.filter(b => !b.acervo).map(b => <option key={b.id} value={`b:${b.id}`}>{b.nome.replace(/\.(ttf|otf)$/i, '')}</option>)}</optgroup>}
                        {!!biblioteca.filter(b => b.acervo).length && <optgroup label="Acervo SOA">{biblioteca.filter(b => b.acervo).map(b => <option key={b.id} value={`b:${b.id}`}>{b.nome.replace(/\.(ttf|otf)$/i, '')}</option>)}</optgroup>}
                      </select>
                      <input className={inp} inputMode="numeric" value={Math.round(txt.fontSize)} onChange={e => mudar(txt, { fontSize: Math.max(4, Number(e.target.value.replace(/\D/g, '')) || 4) })} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <input type="color" value={String(txt.fill || '#000000')} onChange={e => mudar(txt, { fill: e.target.value })} className="w-8 h-7 rounded border border-gray-200" title="Cor" />
                      <button onClick={() => mudar(txt, { fontWeight: txt.fontWeight === 'bold' || txt.fontWeight === 700 ? 'normal' : 'bold' })} className={btnIc + ' font-bold text-xs w-7'}>B</button>
                      <button onClick={() => mudar(txt, { fontStyle: txt.fontStyle === 'italic' ? 'normal' : 'italic' })} className={btnIc + ' italic text-xs w-7'}>I</button>
                      {(['left', 'center', 'right'] as const).map(a => <button key={a} onClick={() => mudar(txt, { textAlign: a })} className={btnIc + ` text-[10px] ${txt.textAlign === a ? 'border-orange-400' : ''}`}>{a === 'left' ? 'Esq' : a === 'center' ? 'Centro' : 'Dir'}</button>)}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <input type="checkbox" className="accent-orange-500" checked={!!txt.strokeWidth} onChange={e => mudar(txt, e.target.checked ? { stroke: '#ffffff', strokeWidth: Math.max(2, Math.round(txt.fontSize * 0.06)), paintFirst: 'stroke', strokeLineJoin: 'round' } : { stroke: null, strokeWidth: 0 })} /> Contorno
                      {!!txt.strokeWidth && <input type="color" value={String(txt.stroke || '#ffffff')} onChange={e => mudar(txt, { stroke: e.target.value })} className="w-7 h-6 rounded border border-gray-200" />}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <input type="checkbox" className="accent-orange-500" checked={!!txt.shadow} onChange={e => mudar(txt, { shadow: e.target.checked ? new Shadow({ color: 'rgba(0,0,0,0.4)', blur: 10, offsetX: 4, offsetY: 4 }) : null })} /> Sombra
                    </label>
                  </div>
                )}

                {forma && (
                  <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      Preenchimento <input type="color" value={String(forma.fill || '#000000')} onChange={e => mudar(forma, { fill: e.target.value })} className="w-8 h-7 rounded border border-gray-200" />
                      Borda <input type="color" value={String(forma.stroke || '#000000')} onChange={e => mudar(forma, { stroke: e.target.value, strokeWidth: forma.strokeWidth || 4 })} className="w-8 h-7 rounded border border-gray-200" />
                    </div>
                    <label className={lbl}>Espessura da borda {forma.strokeWidth || 0}px</label>
                    <input type="range" min={0} max={60} value={forma.strokeWidth || 0} onChange={e => mudar(forma, { strokeWidth: Number(e.target.value), stroke: forma.stroke || '#000000' })} className="w-full accent-orange-500" />
                    {forma instanceof Rect && <>
                      <label className={lbl}>Cantos arredondados</label>
                      <input type="range" min={0} max={Math.round(Math.min(forma.width, forma.height) / 2)} value={forma.rx || 0} onChange={e => mudar(forma, { rx: Number(e.target.value), ry: Number(e.target.value) })} className="w-full accent-orange-500" />
                    </>}
                  </div>
                )}

                {img && (
                  <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-2">
                    {s.soaAssetId
                      ? <p className="text-[11px] text-sky-700 dark:text-sky-300 inline-flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Objeto inteligente — vinculado ao arquivo-fonte</p>
                      : <p className="text-[11px] text-gray-400">Imagem sem vínculo (armazenamento desligado)</p>}
                    {s.soaAssetId && (
                      <label className="w-full inline-flex items-center justify-center gap-1.5 text-xs rounded-lg border border-sky-300 text-sky-800 dark:text-sky-200 py-1.5 cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30">
                        <RefreshCw className="w-3.5 h-3.5" /> Trocar arquivo-fonte (atualiza todas as instâncias)
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) trocarArquivoFonte(img, f); e.target.value = '' }} />
                      </label>
                    )}
                    <PainelAjustes a={s.soaAjustes || AJUSTES_NEUTROS} onMudar={p => mudarAjuste(img, p)} onZerar={() => { soa(img).soaAjustes = null; agendarProcessamento(img); alterou(); tocar() }} />
                    <div>
                      <p className={lbl}>Distorcer</p>
                      <div className="grid grid-cols-3 gap-1">
                        <button onClick={() => entrarDistorcao(img, 'perspectiva', 2)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Scan className="w-3.5 h-3.5" /> Perspectiva</button>
                        <button onClick={() => entrarDistorcao(img, 'malha', 3)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Grid3x3 className="w-3.5 h-3.5" /> Malha 3×3</button>
                        <button onClick={() => entrarDistorcao(img, 'malha', 4)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Grid3x3 className="w-3.5 h-3.5" /> Malha 4×4</button>
                      </div>
                      {s.soaDistorcao && <p className="text-[10px] text-gray-400 mt-1">Distorção ativa ({s.soaDistorcao.tipo}) — clique de novo para editar.</p>}
                    </div>
                    <div>
                      <p className={lbl}>Máscara de pintura</p>
                      <div className="flex gap-1">
                        <button onClick={() => entrarMascara(img)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Brush className="w-3.5 h-3.5" /> Pintar máscara</button>
                        {s.soaMascara && <button onClick={() => { limparMascara(img); agendarProcessamento(img); alterou() }} className={inp + ' !py-1.5 !w-auto'}>Limpar</button>}
                      </div>
                    </div>
                  </div>
                )}

                {/* máscara por forma + recorte por camada (qualquer camada) */}
                <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                  <div>
                    <p className={lbl}>Máscara por forma</p>
                    <select className={inp} value={s.soaFormaMascara?.forma || ''} onChange={e => {
                      const f = e.target.value as FormaMascaraTipo | ''
                      mudarRecorte(um, f ? { soaFormaMascara: { forma: f, x: s.soaFormaMascara?.x ?? 0.05, y: s.soaFormaMascara?.y ?? 0.05, w: s.soaFormaMascara?.w ?? 0.9, h: s.soaFormaMascara?.h ?? 0.9, invertida: s.soaFormaMascara?.invertida ?? false }, soaClipDe: null } : { soaFormaMascara: null })
                    }}>
                      <option value="">— nenhuma —</option>
                      <option value="retangulo">Retângulo</option><option value="arredondado">Arredondado</option><option value="elipse">Círculo / elipse</option>
                      <option value="estrela">Estrela</option><option value="coracao">Coração</option>
                    </select>
                    {s.soaFormaMascara && (
                      <div className="grid grid-cols-2 gap-x-2 mt-1">
                        {(['x', 'y', 'w', 'h'] as const).map(k => (
                          <label key={k} className="text-[10px] text-gray-500">{{ x: 'Posição ↔', y: 'Posição ↕', w: 'Largura', h: 'Altura' }[k]}
                            <input type="range" min={0} max={100} value={Math.round(s.soaFormaMascara![k] * 100)} onChange={e => mudarRecorte(um, { soaFormaMascara: { ...s.soaFormaMascara!, [k]: Number(e.target.value) / 100 } })} className="w-full accent-orange-500" />
                          </label>
                        ))}
                        <label className="col-span-2 flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                          <input type="checkbox" className="accent-orange-500" checked={s.soaFormaMascara.invertida} onChange={e => mudarRecorte(um, { soaFormaMascara: { ...s.soaFormaMascara!, invertida: e.target.checked } })} /> Inverter (esconde dentro da forma)
                        </label>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className={lbl}>Recortar pela camada (clipping)</p>
                    <select className={inp} value={s.soaClipDe || ''} onChange={e => mudarRecorte(um, e.target.value ? { soaClipDe: e.target.value, soaFormaMascara: null } : { soaClipDe: null })}>
                      <option value="">— nenhuma —</option>
                      {c && camadas(c).filter(o => o !== um && !soa(o).soaClipDe).map(o => <option key={soa(o).soaId} value={soa(o).soaId}>{soa(o).soaNome || 'Camada'}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* camadas */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 px-1 pb-1">Camadas</p>
            {!lista.length && <p className="text-xs text-gray-400 px-1 pb-1">Adicione texto, imagem ou forma pela barra à esquerda.</p>}
            <div className="space-y-0.5">
              {lista.map(o => {
                const so = soa(o)
                const sel = ativos.includes(o)
                return (
                  <div key={so.soaId} onClick={e => selecionarDaLista(o, e.shiftKey || e.ctrlKey || e.metaKey)}
                    className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs cursor-pointer ${sel ? 'bg-orange-100 dark:bg-orange-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <button onClick={e => { e.stopPropagation(); mudar(o, { visible: !o.visible }) }} className="text-gray-400 hover:text-gray-700" title={o.visible ? 'Ocultar' : 'Mostrar'}>{o.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
                    <button onClick={e => { e.stopPropagation(); travar(o, !so.soaTravado) }} className={so.soaTravado ? 'text-orange-600' : 'text-gray-300 hover:text-gray-600'} title={so.soaTravado ? 'Destravar' : 'Travar'}>{so.soaTravado ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</button>
                    <span className="text-[10px] text-gray-400 w-4">{so.soaTipo === 'imagem' ? (so.soaAssetId ? '🔗' : '🖼') : so.soaTipo === 'texto' ? 'T' : so.soaTipo === 'grupo' ? '▣' : '◆'}</span>
                    {renomeando === so.soaId ? (
                      <input autoFocus defaultValue={so.soaNome} onClick={e => e.stopPropagation()}
                        onBlur={e => { so.soaNome = e.target.value.trim() || so.soaNome; setRenomeando(null); alterou() }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={inp + ' !py-0'} />
                    ) : (
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-200" onDoubleClick={e => { e.stopPropagation(); setRenomeando(so.soaId || null) }} title="Dois cliques para renomear">
                        {so.soaNome || 'Camada'}{so.soaClipDe ? ' ↳' : ''}
                      </span>
                    )}
                    {sel && <span className="flex">
                      <button onClick={e => { e.stopPropagation(); ordem('frente', o) }} className="text-gray-400 hover:text-gray-700"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={e => { e.stopPropagation(); ordem('tras', o) }} className="text-gray-400 hover:text-gray-700"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {imagensLib && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setImagensLib(null)}>
          <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><h3 className="font-semibold text-gray-900 dark:text-white">Imagens de Meus arquivos</h3><button onClick={() => setImagensLib(null)}><X className="w-4 h-4" /></button></div>
            {!imagensLib.length && <p className="text-sm text-gray-400">Nenhuma imagem ainda — use o botão de enviar.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imagensLib.map(a => (
                <button key={a.id} onClick={() => addImagemBiblioteca(a)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1 hover:border-orange-400 text-left">
                  <img src={a.url} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" loading="lazy" />
                  <span className="block text-[10px] truncate mt-1 text-gray-600 dark:text-gray-300">{a.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {exportar && design && c && (
        <ModalExportar design={design} onFechar={() => setExportar(false)}
          renderizar={() => renderizarDesign(c, zoomRef.current)}
          workspaceId={workspaceId} storage={storage}
          onCota={f => { setFaltam(f); setCotaVersao(v => v + 1) }} />
      )}
    </div>
  )
}

// ── Ajustes não-destrutivos (sliders + filtros) ────────────────────────────────
function PainelAjustes({ a, onMudar, onZerar }: { a: Ajustes; onMudar: (p: Partial<Ajustes>) => void; onZerar: () => void }) {
  const faixa = (rot: string, v: number, min: number, max: number, f: (n: number) => void) => (
    <label className="block text-[10px] text-gray-500">{rot} <span className="tabular-nums text-gray-400">{v > 0 ? `+${v}` : v}</span>
      <input type="range" min={min} max={max} value={v} onChange={e => f(Number(e.target.value))} onDoubleClick={() => f(0)} className="w-full accent-orange-500" />
    </label>
  )
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between"><p className={lbl}>Ajustes (não destrutivos)</p><button onClick={onZerar} className="text-[10px] text-gray-400 hover:text-orange-600">zerar</button></div>
      <div className="flex flex-wrap gap-1">
        {FILTROS.map(f => <button key={f.id} onClick={() => onMudar({ filtro: f.id })} className={`text-[10px] rounded-full px-2 py-0.5 border ${a.filtro === f.id ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'}`}>{f.rotulo}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-x-2">
        {faixa('Brilho', a.brilho, -100, 100, v => onMudar({ brilho: v }))}
        {faixa('Contraste', a.contraste, -100, 100, v => onMudar({ contraste: v }))}
        {faixa('Saturação', a.saturacao, -100, 100, v => onMudar({ saturacao: v }))}
        {faixa('Matiz', a.matiz, -180, 180, v => onMudar({ matiz: v }))}
        {faixa('Temperatura', a.temperatura, -100, 100, v => onMudar({ temperatura: v }))}
      </div>
      <p className="text-[10px] font-medium text-gray-500 pt-1">Curvas</p>
      <div className="grid grid-cols-3 gap-x-2">
        {faixa('Sombras', a.curvas.sombras, -60, 60, v => onMudar({ curvas: { ...a.curvas, sombras: v } }))}
        {faixa('Meios', a.curvas.meios, -60, 60, v => onMudar({ curvas: { ...a.curvas, meios: v } }))}
        {faixa('Luzes', a.curvas.luzes, -60, 60, v => onMudar({ curvas: { ...a.curvas, luzes: v } }))}
      </div>
    </div>
  )
}

// ── Exportar: tamanho original + presets de marketplace (1 design → vários tamanhos) ──
function ModalExportar({ design, onFechar, renderizar, workspaceId, storage, onCota }: {
  design: Design; onFechar: () => void; renderizar: () => HTMLCanvasElement; workspaceId?: string; storage: boolean; onCota: (faltam: number) => void
}) {
  const [original, setOriginal] = useState(true)
  const [canais, setCanais] = useState<string[]>([])
  const [modo, setModo] = useState<'encaixar' | 'preencher'>('encaixar')
  const [fundo, setFundo] = useState('#ffffff')
  const [saida, setSaida] = useState<Saida>({ formato: 'jpg', qualidade: 92 })
  const [guardar, setGuardar] = useState(false)
  const [gerando, setGerando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const total = (original ? 1 : 0) + canais.length

  async function gerar() {
    if (!total) return
    setErro('')
    let reservaId = ''
    try { reservaId = (await reservarCota(total)).reservaId }
    catch (e) { if (e instanceof SemCota) onCota(e.faltam); setErro((e as Error).message); return }
    let feitos = 0
    try {
      setGerando('Renderizando…')
      const base = renderizar()
      const arquivos: { nome: string; blob: Blob }[] = []
      const nomeBase = design.nome.replace(/[\\/:*?"<>|]/g, '').trim() || 'design'
      if (original) { arquivos.push({ nome: `${nomeBase}.${saida.formato}`, blob: await codificar(base, saida) }); feitos++ }
      for (const id of canais) {
        const t = TAMANHOS_CANAIS.find(x => x.id === id)!
        setGerando(`${t.canal} ${t.rotulo}…`)
        const cv = processarImagem(base, [{ op: 'redimensionar', largura: t.largura, altura: t.altura, modo, fundo: modo === 'encaixar' ? fundo : null }], null)
        arquivos.push({ nome: `${nomeBase} - ${t.canal} ${t.rotulo.replace(/[/:]/g, '-')} ${t.largura}x${t.altura}.${saida.formato}`, blob: await codificar(cv, saida) })
        feitos++
        await new Promise(r => setTimeout(r, 0))
      }
      let final: { nome: string; blob: Blob }
      if (arquivos.length === 1) final = arquivos[0]
      else {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip(); for (const a of arquivos) zip.file(a.nome, a.blob)
        final = { nome: `${nomeBase}.zip`, blob: await zip.generateAsync({ type: 'blob', compression: 'STORE' }) }
      }
      baixar(final.blob, final.nome)
      if (guardar && storage && workspaceId) {
        setGerando('Guardando em Meus arquivos…')
        await enviarArquivo(final.blob, final.nome, 'gerado', workspaceId, { pasta: 'Designs exportados', meta: { itens: arquivos.length } }).catch(() => {})
      }
      onFechar()
    } catch (e) { setErro('Falha ao exportar: ' + (e as Error).message) }
    finally { await fecharCota(reservaId, feitos); onCota(0); setGerando(null) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h3 className="font-semibold text-gray-900 dark:text-white">Exportar</h3><button onClick={onFechar}><X className="w-4 h-4" /></button></div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" className="accent-orange-500" checked={original} onChange={e => setOriginal(e.target.checked)} /> Tamanho do design ({design.largura}×{design.altura})
        </label>
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Tamanhos dos canais <span className="font-normal text-gray-400">(revisados em {TAMANHOS_REVISADOS_EM})</span></p>
          <div className="grid sm:grid-cols-2 gap-1">
            {TAMANHOS_CANAIS.map(t => (
              <label key={t.id} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 rounded-lg border border-gray-100 dark:border-gray-800 px-2 py-1.5">
                <input type="checkbox" className="accent-orange-500 mt-0.5" checked={canais.includes(t.id)} onChange={e => setCanais(cs => e.target.checked ? [...cs, t.id] : cs.filter(x => x !== t.id))} />
                <span>{rotuloTamanho(t)}{t.dica && <span className="block text-[10px] text-gray-400">{t.dica}</span>}</span>
              </label>
            ))}
          </div>
        </div>
        {!!canais.length && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            Quando a proporção muda:
            <select className={inp + ' !w-auto'} value={modo} onChange={e => setModo(e.target.value as 'encaixar' | 'preencher')}>
              <option value="encaixar">Encaixar inteiro (com fundo)</option><option value="preencher">Preencher (corta as bordas)</option>
            </select>
            {modo === 'encaixar' && <input type="color" value={fundo} onChange={e => setFundo(e.target.value)} className="w-8 h-7 rounded border border-gray-200" title="Cor do fundo" />}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          Formato
          <select className={inp + ' !w-auto'} value={saida.formato} onChange={e => setSaida(s => ({ ...s, formato: e.target.value as Saida['formato'] }))}>
            <option value="jpg">JPG</option><option value="png">PNG (com transparência)</option><option value="webp">WebP</option>
          </select>
        </div>
        {storage && <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" className="accent-orange-500" checked={guardar} onChange={e => setGuardar(e.target.checked)} /> Guardar também em Meus arquivos</label>}
        {total > LIMITE_LOTE && <p className="text-xs text-red-600">Máximo de {LIMITE_LOTE} imagens por vez.</p>}
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <button onClick={gerar} disabled={!total || !!gerando || total > LIMITE_LOTE} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 text-sm disabled:opacity-40">
          {gerando ? <><Loader2 className="w-4 h-4 animate-spin" /> {gerando}</> : <><Download className="w-4 h-4" /> Exportar {total} imagem(ns)</>}
        </button>
        <p className="text-[10px] text-gray-400">Cada imagem exportada conta na sua cota do dia.</p>
      </div>
    </div>
  )
}
