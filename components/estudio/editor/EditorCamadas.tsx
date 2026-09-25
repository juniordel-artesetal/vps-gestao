'use client'
// SOA Edition — EDITOR DE IMAGEM EM CAMADAS. "Photoshop com jeito de Canva".
//  • Importação rápida: proxy leve na tela, original em alta só na exportação.
//  • OBJETO INTELIGENTE visível: converter, substituir conteúdo (atualiza todas as instâncias em
//    todos os designs), editar fonte (design próprio que regrava o objeto), nova instância.
//  • Replicar a arte em todos os moldes (área de 4 pontos/malha + área selecionada) → ZIP.
//  • Efeitos (catálogo + editáveis + meus efeitos), ajustes, distorção, máscaras, área de recorte.
//  • Alinhar/distribuir, guias inteligentes + grade, zoom, atalhos, copiar/colar (camada e estilo),
//    formas (linha, seta, polígono…), gradiente, espaçamento de texto, desfazer/refazer, autosave.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Canvas, StaticCanvas, FabricImage, FabricObject, Textbox, Rect, Ellipse, Polygon, Line, Circle, Group, ActiveSelection, Point, Gradient,
} from 'fabric'
import {
  ArrowLeft, Undo2, Redo2, Type, Square, Circle as CircleIcon, Star, Heart, ImagePlus, Upload, Eye, EyeOff, Lock, Unlock,
  ChevronUp, ChevronDown, Trash2, Copy, Group as GroupIcon, Ungroup, Download, Loader2, X, AlignStartVertical, AlignCenterVertical,
  AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Brush, Scan, Grid3x3, Link2, RefreshCw, Check,
  Minus, ArrowRight as Seta, Triangle, Hexagon, ZoomIn, ZoomOut, Maximize, Magnet, LayoutGrid, Layers3, SquareDashed, PencilRuler,
  Paintbrush, ClipboardPaste, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, CloudUpload,
} from 'lucide-react'
import { FONTES_NATIVAS, CLASSES_PRECARGA } from '../fontesNativas'
import CotaBarra from '../CotaBarra'
import PainelEfeitos from './PainelEfeitos'
import ReplicarMoldes, { type ConfigReplica } from './ReplicarMoldes'
import { grudar, desenharSobreposicao, type EstadoGuias } from './guias'
import {
  soa, camadas, imagensDo, criarCamadaDeProxy, criarCamadaImagem, criarProxy, vincularAsset, processarCamada, aplicarRecortes,
  aplicarEfeitos, agrupar, desagrupar, serializar, desserializar, trocarFonteDasInstancias, renderizarDesign, renderizarEmAlta,
  conteudoDaCamada, cenaParaOriginal, originalParaCena, pintarMascara, gravarMascara, limparMascara, duplicarCamada, novoIdCamada,
  pontosEstrela, pontosCoracao, pontosPoligono, type FonteDesign, type DesignJson, type FormaMascaraTipo, type Soa, type AssetRef,
} from '@/lib/estudio/camadas'
import { AJUSTES_NEUTROS, FILTROS, type Ajustes } from '@/lib/estudio/ajustes'
import { semEfeitos, type Efeitos } from '@/lib/estudio/efeitos'
import { gradeNeutra, type Distorcao } from '@/lib/estudio/transform'
import type { MoldeReplica } from '@/lib/estudio/areaMolde'
import { importarImagem } from '@/lib/estudio/importar'
import { enviarArquivo, enviarSoBlob, baixar, exigirSaldo, Autorizador, SemCota } from '@/lib/estudio/cliente'
import { TAMANHOS_CANAIS, TAMANHOS_REVISADOS_EM, rotuloTamanho } from '@/lib/estudio/tamanhos'
import { processarImagem, codificar, type Saida } from '@/lib/estudio/acoes'
import { LIMITE_LOTE } from '@/lib/estudio/dados'

const BLENDS = [
  { v: 'source-over', r: 'Normal' }, { v: 'multiply', r: 'Multiplicar' }, { v: 'screen', r: 'Tela' }, { v: 'overlay', r: 'Sobrepor' },
] as const
const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-0.5'
const btnIc = 'p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-400 disabled:opacity-30 bg-white dark:bg-gray-900'
const secao = 'space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2'

type Modo = 'normal' | 'distorcer' | 'mascara'
interface Design { nome: string; largura: number; altura: number }
interface BibliotecaFonte { id: string; nome: string; url: string; familia: string; acervo: boolean }
interface Estilo { vetor: Record<string, unknown>; texto: Record<string, unknown>; ajustes: Ajustes | null; efeitos: Efeitos | null; opacity: number; blend: string }
const blobDe = (c: HTMLCanvasElement, tipo: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), tipo, q))

export default function EditorCamadas({ designId }: { designId: string }) {
  // Fora do React Compiler: o estado das camadas vive no canvas do Fabric (mutável, fora do React).
  'use no memo'
  const router = useRouter()
  const { data: session } = useSession()
  const workspaceId = (session?.user as { workspaceId?: string } | undefined)?.workspaceId

  const hostRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<HTMLCanvasElement>(null)
  const fabRef = useRef<Canvas | null>(null)
  const [design, setDesign] = useState<Design | null>(null)
  const designRef = useRef<Design | null>(null)
  const [fonteDeAsset, setFonteDeAsset] = useState<string | null>(null)
  const zoomRef = useRef(1)
  const [zoom, setZoomUI] = useState(1)
  const [, setVersao] = useState(0)
  const tocar = useCallback(() => setVersao(v => v + 1), [])
  const [ativos, setAtivos] = useState<FabricObject[]>([])
  const [status, setStatus] = useState<'carregando' | 'salvo' | 'pendente' | 'salvando' | 'erro'>('carregando')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [enviando, setEnviando] = useState(0)
  const enviandoRef = useRef(0)
  const [storage, setStorage] = useState(false)
  const [modo, setModo] = useState<Modo>('normal')
  const modoRef = useRef<Modo>('normal')
  const [pincel, setPincel] = useState<{ modo: 'esconder' | 'revelar'; raio: number }>({ modo: 'esconder', raio: 30 })
  const pincelRef = useRef(pincel)
  useEffect(() => { pincelRef.current = pincel }, [pincel])
  const [biblioteca, setBiblioteca] = useState<BibliotecaFonte[]>([])
  const fontesRef = useRef<FonteDesign[]>([])
  const [imagensLib, setImagensLib] = useState<{ id: string; nome: string; url: string; meta?: { proxyUrl?: string } }[] | null>(null)
  const [exportar, setExportar] = useState(false)
  const [replicar, setReplicar] = useState(false)
  const [cotaVersao, setCotaVersao] = useState(0)
  const [faltam, setFaltam] = useState(0)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [guiasOn, setGuiasOn] = useState(true)
  const [gradeOn, setGradeOn] = useState(false)
  const opGuiasRef = useRef({ guias: true, grade: false })
  useEffect(() => { opGuiasRef.current = { guias: guiasOn, grade: gradeOn }; fabRef.current?.requestRenderAll() }, [guiasOn, gradeOn])
  const guiasRef = useRef<EstadoGuias>({ x: [], y: [] })
  const clipboardRef = useRef<FabricObject[]>([])
  const estiloRef = useRef<Estilo | null>(null)
  const versoesRef = useRef(new Map<string, number>())
  // moldes do "Replicar em todos os moldes" (salvos no design)
  const [moldes, setMoldesS] = useState<MoldeReplica[]>([])
  const moldesRef = useRef<MoldeReplica[]>([])
  const [replica, setReplicaS] = useState<ConfigReplica>({ fonte: 'design', camadaId: null, formato: 'jpg' })
  const replicaRef = useRef(replica)

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
  const montarJson = useCallback(() => {
    const c = fabRef.current!
    const r = serializar(c, fontesRef.current)
    r.json.moldes = moldesRef.current
    r.json.replica = replicaRef.current
    for (const m of moldesRef.current) if (m.assetId) r.assetIds.push(m.assetId)
    return r
  }, [])

  const salvar = useCallback(async () => {
    const c = fabRef.current, d = designRef.current
    if (!c || !d) return
    // Imagem recém-importada ainda subindo: espera (senão o design guardaria um endereço local).
    if (enviandoRef.current > 0) { if (salvarTimer.current) clearTimeout(salvarTimer.current); salvarTimer.current = setTimeout(salvar, 1500); return }
    setStatus('salvando')
    try {
      const { json, assetIds } = montarJson()
      const previewUrl = renderizarDesign(c, zoomRef.current, 240 / Math.max(d.largura, d.altura)).toDataURL('image/jpeg', 0.7)
      const r = await fetch(`/api/estudio/designs/${designId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ json, assetIds, previewUrl, nome: d.nome }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'falha')
      setStatus('salvo')
    } catch (e) { setStatus('erro'); setErro('Não consegui salvar: ' + (e as Error).message) }
  }, [designId, montarJson])

  const snapshot = useCallback(() => {
    if (!fabRef.current) return
    const s = JSON.stringify(montarJson().json)
    if (s === ultimoRef.current) return
    if (ultimoRef.current) { pilhaRef.current.push(ultimoRef.current); if (pilhaRef.current.length > 40) pilhaRef.current.shift() }
    refazerRef.current = []
    ultimoRef.current = s
    tocar()
  }, [tocar, montarJson])

  const alterou = useCallback(() => {
    if (carregandoRef.current) return
    tocar()
    setStatus('pendente')
    if (histTimer.current) clearTimeout(histTimer.current)
    histTimer.current = setTimeout(snapshot, 350)
    if (salvarTimer.current) clearTimeout(salvarTimer.current)
    salvarTimer.current = setTimeout(salvar, 2000)
  }, [salvar, snapshot, tocar])

  const setMoldes = (m: MoldeReplica[]) => { moldesRef.current = m; setMoldesS(m); alterou() }
  const setReplica = (r: ConfigReplica) => { replicaRef.current = r; setReplicaS(r); alterou() }

  async function restaurar(s: string) {
    const c = fabRef.current
    if (!c) return
    carregandoRef.current = true
    const j = JSON.parse(s) as DesignJson
    try { await desserializar(c, j, {}) } finally { carregandoRef.current = false }
    moldesRef.current = (j.moldes as MoldeReplica[]) || []; setMoldesS(moldesRef.current)
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

  // ── zoom ────────────────────────────────────────────────────────────────────
  const definirZoom = useCallback((z: number) => {
    const c = fabRef.current, d = designRef.current
    if (!c || !d) return
    const k = Math.max(0.05, Math.min(4, z))
    zoomRef.current = k; setZoomUI(k)
    c.setDimensions({ width: Math.round(d.largura * k), height: Math.round(d.altura * k) })
    c.setZoom(k)
    reposicionarAlcas()
    c.requestRenderAll()
  }, [])
  const ajustarATela = useCallback(() => {
    const host = hostRef.current, d = designRef.current
    if (!host || !d) return
    definirZoom(Math.min((host.clientWidth - 16) / d.largura, Math.max(320, window.innerHeight * 0.7) / d.altura, 1))
  }, [definirZoom])

  // ── objeto inteligente: versões (outra aba/design pode ter trocado o conteúdo) ──────
  async function checarVersoes() {
    const c = fabRef.current
    if (!c || modoRef.current !== 'normal') return
    const ids = [...new Set(imagensDo(c).map(o => soa(o).soaAssetId).filter(Boolean) as string[])]
    if (!ids.length) return
    const d = await fetch(`/api/estudio/assets?ids=${ids.join(',')}`).then(r => r.json()).catch(() => null)
    let n = 0
    for (const a of d?.assets || []) {
      const v = Number(a.meta?.versao || 1), conhecida = versoesRef.current.get(a.id) ?? v
      if (v > conhecida) { n += await trocarFonteDasInstancias(c, a.id, a.url, a.meta?.proxyUrl) }
      versoesRef.current.set(a.id, v)
    }
    if (n) { setAviso(`Objeto inteligente atualizado: ${n} instância(s) já mostram o conteúdo novo.`); alterou() }
  }

  // ── montar canvas + abrir design ───────────────────────────────────────────
  const teclasRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    if (!elRef.current) return
    const c = new Canvas(elRef.current, { preserveObjectStacking: true, selection: true, backgroundColor: '#ffffff', renderOnAddRemove: false })
    fabRef.current = c
    const selecao = () => setAtivos(c.getActiveObjects().filter(o => !soa(o).soaAjudante))
    c.on('selection:created', selecao); c.on('selection:updated', selecao); c.on('selection:cleared', selecao)
    c.on('object:modified', e => {
      const t = e.target as FabricObject
      guiasRef.current = { x: [], y: [] }
      if (soa(t).soaAjudante) return
      // efeitos de imagem têm espessura "de cena": ao redimensionar, recalcula
      if (t instanceof FabricImage && !semEfeitos(soa(t).soaEfeitos)) agendarProcessamento(t)
      if (camadas(c).some(o => soa(o).soaClipDe)) aplicarRecortes(c).then(() => c.requestRenderAll())
      alterou()
    })
    c.on('object:added', e => { if (!soa(e.target as FabricObject).soaAjudante) alterou() })
    c.on('object:removed', e => { if (!soa(e.target as FabricObject).soaAjudante) alterou() })
    c.on('text:changed', () => alterou())
    c.on('object:moving', e => {
      const t = e.target as FabricObject & { soaIdx?: number }
      if (soa(t).soaAjudante) { if (t.soaIdx !== undefined) alcaMovida(t); return }
      const d = designRef.current, op = opGuiasRef.current
      if (d && (op.guias || op.grade)) guiasRef.current = grudar(c, t, d, zoomRef.current, { guias: op.guias, grade: op.grade ? Math.max(8, Math.round(Math.min(d.largura, d.altura) / 24)) : null }, o => !!soa(o).soaAjudante)
    })
    c.on('after:render', () => {
      const d = designRef.current
      if (!d) return
      const op = opGuiasRef.current
      desenharSobreposicao(c, d, guiasRef.current, op.grade ? Math.max(8, Math.round(Math.min(d.largura, d.altura) / 24)) : null)
    })
    c.on('mouse:up', () => { if (guiasRef.current.x.length || guiasRef.current.y.length) { guiasRef.current = { x: [], y: [] }; c.requestRenderAll() } })
    c.on('mouse:down', e => { if (modoRef.current === 'mascara') iniciarPincel(e.scenePoint) })
    c.on('mouse:move', e => { if (modoRef.current === 'mascara') moverPincel(e.scenePoint) })
    c.on('mouse:up', () => { if (modoRef.current === 'mascara') soltarPincel() })
    c.on('mouse:wheel', e => {
      const ev = e.e as WheelEvent
      if (!ev.ctrlKey && !ev.metaKey) return
      ev.preventDefault(); ev.stopPropagation()
      definirZoom(zoomRef.current * (ev.deltaY < 0 ? 1.1 : 1 / 1.1))
    })

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
        setFonteDeAsset(j.design.fonteAssetId || null)
        ajustarATela()
        const refs: Record<string, AssetRef> = {}
        for (const a of j.assets || []) { refs[a.id] = { url: a.url, proxyUrl: a.meta?.proxyUrl || null }; versoesRef.current.set(a.id, Number(a.meta?.versao || 1)) }
        const json = j.design.json as DesignJson
        if (json?.fabric && (json.fabric as { objects?: unknown[] }).objects) {
          fontesRef.current = json.fontes || []
          await desserializar(c, json, refs)
          moldesRef.current = ((json.moldes as MoldeReplica[]) || []).map(m => (m.assetId && refs[m.assetId] ? { ...m, url: refs[m.assetId].url, proxyUrl: refs[m.assetId].proxyUrl || m.proxyUrl } : m))
          setMoldesS(moldesRef.current)
          if (json.replica) { replicaRef.current = json.replica; setReplicaS(json.replica) }
        }
        await document.fonts?.ready
        c.getObjects().forEach(o => { if (o instanceof Textbox) o.initDimensions() })
        c.requestRenderAll()
        ultimoRef.current = JSON.stringify(montarJson().json)
        setStatus('salvo')
      } catch (e) { setErro((e as Error).message); setStatus('erro') }
      finally { carregandoRef.current = false; tocar() }
    })()

    const teclas = (e: KeyboardEvent) => teclasRef.current(e)
    const antesDeSair = (e: BeforeUnloadEvent) => {
      if (enviandoRef.current > 0 || statusRef.current === 'pendente' || statusRef.current === 'salvando') { salvar(); e.preventDefault() }
    }
    const aoVoltar = () => { if (document.visibilityState === 'visible') checarVersoes() }
    window.addEventListener('keydown', teclas)
    window.addEventListener('beforeunload', antesDeSair)
    window.addEventListener('resize', ajustarATela)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      window.removeEventListener('keydown', teclas)
      window.removeEventListener('beforeunload', antesDeSair)
      window.removeEventListener('resize', ajustarATela)
      document.removeEventListener('visibilitychange', aoVoltar)
      fabRef.current = null
      void c.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId])

  const c = fabRef.current
  const um = ativos.length === 1 ? ativos[0] : null
  const lista = c ? [...camadas(c)].reverse() : []
  const instancias = new Map<string, number>()
  if (c) for (const o of imagensDo(c)) { const a = soa(o).soaAssetId; if (a) instancias.set(a, (instancias.get(a) || 0) + 1) }

  // ── adicionar camadas ────────────────────────────────────────────────────────
  function centralizar(o: FabricObject) {
    const d = designRef.current!
    o.setPositionByOrigin(new Point(d.largura / 2, d.altura / 2), 'center', 'center')
    o.setCoords()
  }
  function adicionar(o: FabricObject, nome: string, tipo: Soa['soaTipo'], extra: Partial<Soa> = {}) {
    if (!c) return
    Object.assign(o, { soaId: novoIdCamada(), soaNome: nome, soaTipo: tipo, ...extra } satisfies Soa)
    centralizar(o)
    c.add(o); c.setActiveObject(o); c.requestRenderAll()
  }
  function addTexto() {
    const d = designRef.current!
    const t = new Textbox('Seu texto', { width: d.largura * 0.6, fontSize: Math.round(d.altura * 0.08), fontFamily: FONTES_NATIVAS[0].familia, fill: '#1f2937', textAlign: 'center' })
    ;(t as FabricObject & Soa).soaFonte = FONTES_NATIVAS[0].id
    adicionar(t, 'Texto', 'texto')
  }
  function addForma(f: 'retangulo' | 'elipse' | 'estrela' | 'coracao' | 'triangulo' | 'hexagono' | 'linha' | 'seta') {
    const d = designRef.current!
    const L = Math.min(d.largura, d.altura) * 0.35
    const base = { fill: '#fb923c', stroke: null as string | null, strokeWidth: 0 }
    let o: FabricObject
    if (f === 'retangulo') o = new Rect({ ...base, width: L, height: L * 0.7, rx: 0, ry: 0 })
    else if (f === 'elipse') o = new Ellipse({ ...base, rx: L / 2, ry: L / 2 })
    else if (f === 'estrela') o = new Polygon(pontosEstrela(L, L), base)
    else if (f === 'coracao') o = new Polygon(pontosCoracao(L, L), base)
    else if (f === 'triangulo') o = new Polygon(pontosPoligono(3, L, L), base)
    else if (f === 'hexagono') o = new Polygon(pontosPoligono(6, L, L), base)
    else if (f === 'linha') o = new Line([0, 0, L * 1.4, 0], { stroke: '#1f2937', strokeWidth: Math.max(2, L * 0.03), strokeLineCap: 'round' })
    else {
      const w = L * 1.4, h = L * 0.5, t = h * 0.36
      o = new Polygon([{ x: 0, y: h / 2 - t / 2 }, { x: w * 0.7, y: h / 2 - t / 2 }, { x: w * 0.7, y: 0 }, { x: w, y: h / 2 }, { x: w * 0.7, y: h }, { x: w * 0.7, y: h / 2 + t / 2 }, { x: 0, y: h / 2 + t / 2 }], { ...base, fill: '#1f2937' })
    }
    const nomes = { retangulo: 'Retângulo', elipse: 'Círculo', estrela: 'Estrela', coracao: 'Coração', triangulo: 'Triângulo', hexagono: 'Hexágono', linha: 'Linha', seta: 'Seta' }
    adicionar(o, nomes[f], 'forma')
  }
  /** Área de recorte: retângulo tracejado que limita a camada selecionada (não sai na exportação). */
  function addArea() {
    if (!c) return
    const d = designRef.current!
    const alvo = um && !soa(um).soaArea ? um : null
    const r = alvo ? alvo.getBoundingRect() : null
    const a = new Rect({
      width: r ? r.width * 0.7 : d.largura * 0.4, height: r ? r.height * 0.7 : d.altura * 0.4,
      fill: 'rgba(14,165,233,0.06)', stroke: '#0ea5e9', strokeWidth: 2, strokeDashArray: [10, 6], strokeUniform: true,
    })
    Object.assign(a, { soaId: novoIdCamada(), soaNome: 'Área de recorte', soaTipo: 'forma', soaArea: true } satisfies Soa)
    if (r) a.setPositionByOrigin(new Point(r.left + r.width / 2, r.top + r.height / 2), 'center', 'center'); else centralizar(a)
    a.setCoords()
    c.add(a)
    if (alvo) { soa(alvo).soaClipDe = soa(a).soaId!; soa(alvo).soaFormaMascara = null }
    aplicarRecortes(c).then(() => { c.setActiveObject(a); c.requestRenderAll(); alterou() })
    setAviso(alvo ? `“${soa(alvo).soaNome}” agora só aparece dentro da área. Arraste/redimensione a área azul.` : 'Área criada: selecione uma camada e, em “Mostrar só dentro de…”, escolha a área.')
  }

  /** Importação rápida: aparece na hora (proxy); o envio corre em segundo plano. */
  async function importarArquivos(fs: FileList | File[]) {
    if (!c || !workspaceId) return
    if (!storage) { setErro('O armazenamento de arquivos não está configurado — não dá para guardar imagens no design.'); return }
    setErro('')
    for (const f of [...fs].filter(x => x.type.startsWith('image/') || /\.pdf$/i.test(x.name))) {
      setOcupado(/\.pdf$/i.test(f.name) ? 'Abrindo PDF…' : 'Abrindo imagem…')
      try {
        const imp = await importarImagem(f)
        const img = criarCamadaDeProxy(imp.proxy, imp.urlLocal, null, f.name.replace(/\.[^.]+$/, ''), designRef.current!)
        centralizar(img); c.add(img); c.setActiveObject(img); c.requestRenderAll()
        setOcupado('')
        enviandoRef.current++; setEnviando(enviandoRef.current)
        imp.enviar(workspaceId)
          .then(up => { vincularAsset(img, up.id, up.url); versoesRef.current.set(up.id, 1); alterou(); tocar() })
          .catch(e => setErro(`“${f.name}” abriu, mas não consegui guardá-la (${(e as Error).message}) — ela some ao fechar.`))
          .finally(() => { enviandoRef.current--; setEnviando(enviandoRef.current) })
      } catch (e) { setErro(`${f.name}: ${(e as Error).message}`) } finally { setOcupado('') }
    }
  }
  async function abrirBibliotecaImagens() {
    const d = await fetch('/api/estudio/assets').then(r => r.json()).catch(() => ({ assets: [] }))
    setImagensLib((d.assets || []).filter((a: { tipo: string; mime: string | null }) => ['imagem', 'molde', 'gerado', 'mockup'].includes(a.tipo) && (a.mime || '').startsWith('image/')))
  }
  async function addImagemBiblioteca(a: { id: string; nome: string; url: string; meta?: { proxyUrl?: string; versao?: number } }) {
    if (!c) return
    setImagensLib(null); setOcupado('Abrindo imagem…')
    try {
      const img = await criarCamadaImagem(a.url, a.id, a.nome.replace(/\.[^.]+$/, ''), designRef.current!, a.meta?.proxyUrl)
      versoesRef.current.set(a.id, Number(a.meta?.versao || 1))
      centralizar(img); c.add(img); c.setActiveObject(img); c.requestRenderAll()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  // ── ações de camada ─────────────────────────────────────────────────────────
  function mudar(o: FabricObject, props: Record<string, unknown>) {
    o.set(props); o.setCoords(); o.dirty = true
    if (o instanceof Textbox) o.initDimensions()
    c?.requestRenderAll(); alterou()
  }
  /** Preenchimento de texto/forma respeitando efeitos ativos (que guardam o preenchimento-base). */
  function mudarPreenchimento(o: FabricObject, fill: unknown) {
    const s = soa(o)
    if (s.soaBase) { s.soaBase = { ...s.soaBase, fill }; aplicarEfeitos(o, s.soaEfeitos || null).then(() => { c?.requestRenderAll(); alterou(); tocar() }) }
    else mudar(o, { fill })
  }
  function gradiente(o: FabricObject, c1: string, c2: string, ang: number) {
    const a = (ang * Math.PI) / 180, w = o.width || 1, h = o.height || 1, L = Math.hypot(w, h) / 2
    return new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: w / 2 - Math.cos(a) * L, y1: h / 2 - Math.sin(a) * L, x2: w / 2 + Math.cos(a) * L, y2: h / 2 + Math.sin(a) * L }, colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }] })
  }
  function excluir() {
    const cv = fabRef.current
    if (!cv) return
    const sel = cv.getActiveObjects().filter(o => !soa(o).soaAjudante)
    if (!sel.length) return
    cv.discardActiveObject(); cv.remove(...sel)
    aplicarRecortes(cv).then(() => cv.requestRenderAll())
  }
  async function duplicar() {
    const cv = fabRef.current
    if (!cv) return
    const sel = cv.getActiveObjects().filter(o => !soa(o).soaAjudante)
    if (!sel.length) return
    cv.discardActiveObject()
    const novos: FabricObject[] = []
    for (const o of sel) { const d = await duplicarCamada(o); d.set({ left: (d.left || 0) + 20, top: (d.top || 0) + 20 }); d.setCoords(); cv.add(d); novos.push(d) }
    cv.setActiveObject(novos.length === 1 ? novos[0] : new ActiveSelection(novos, { canvas: cv })); cv.requestRenderAll()
  }
  async function copiar() {
    const cv = fabRef.current
    if (!cv) return
    const sel = cv.getActiveObjects().filter(o => !soa(o).soaAjudante)
    clipboardRef.current = await Promise.all(sel.map(o => duplicarCamada(o)))
    if (sel.length) setAviso(`${sel.length} camada(s) copiada(s) — Ctrl+V cola.`)
  }
  async function colar() {
    const cv = fabRef.current
    if (!cv || !clipboardRef.current.length) return
    cv.discardActiveObject()
    const novos: FabricObject[] = []
    for (const o of clipboardRef.current) { const d = await duplicarCamada(o); d.set({ left: (d.left || 0) + 20, top: (d.top || 0) + 20 }); d.setCoords(); cv.add(d); novos.push(d) }
    cv.setActiveObject(novos.length === 1 ? novos[0] : new ActiveSelection(novos, { canvas: cv })); cv.requestRenderAll()
  }
  function copiarEstilo() {
    const cv = fabRef.current
    const o = cv?.getActiveObject()
    if (!o || o instanceof ActiveSelection) return
    const s = soa(o)
    const base = s.soaBase
    estiloRef.current = {
      vetor: { fill: base ? base.fill : o.fill, stroke: base ? base.stroke : o.stroke, strokeWidth: base ? base.strokeWidth : o.strokeWidth },
      texto: o instanceof Textbox ? { fontFamily: o.fontFamily, fontSize: o.fontSize, fontWeight: o.fontWeight, fontStyle: o.fontStyle, charSpacing: o.charSpacing, lineHeight: o.lineHeight, textAlign: o.textAlign, soaFonte: s.soaFonte } : {},
      ajustes: s.soaAjustes || null, efeitos: s.soaEfeitos || null, opacity: o.opacity ?? 1, blend: o.globalCompositeOperation || 'source-over',
    }
    setAviso('Estilo copiado — selecione outra camada e use “Colar estilo” (Ctrl+Alt+V).')
    tocar()
  }
  async function colarEstilo() {
    const e = estiloRef.current, cv = fabRef.current
    if (!e || !cv) return
    for (const o of cv.getActiveObjects().filter(x => !soa(x).soaAjudante)) {
      o.set({ opacity: e.opacity, globalCompositeOperation: e.blend })
      if (o instanceof FabricImage) { soa(o).soaAjustes = e.ajustes ? structuredClone(e.ajustes) : null; await aplicarEfeitos(o, e.efeitos ? structuredClone(e.efeitos) : null) }
      else if (!(o instanceof Group)) {
        soa(o).soaBase = null
        o.set(e.vetor)
        if (o instanceof Textbox) { const { soaFonte, ...t } = e.texto; o.set(t); soa(o).soaFonte = (soaFonte as string) || soa(o).soaFonte; o.initDimensions() }
        await aplicarEfeitos(o, e.efeitos ? structuredClone(e.efeitos) : null)
      } else await aplicarEfeitos(o, e.efeitos ? structuredClone(e.efeitos) : null)
      o.dirty = true
    }
    cv.requestRenderAll(); alterou(); tocar()
  }
  function ordem(dir: 'frente' | 'tras' | 'topo' | 'fundo', o: FabricObject) {
    if (!c) return
    if (dir === 'frente') c.bringObjectForward(o); else if (dir === 'tras') c.sendObjectBackwards(o)
    else if (dir === 'topo') c.bringObjectToFront(o); else c.sendObjectToBack(o)
    c.requestRenderAll(); alterou()
  }
  function reselecionar(objs: FabricObject[]) {
    if (!c) return
    c.setActiveObject(objs.length === 1 ? objs[0] : new ActiveSelection(objs, { canvas: c }))
    aplicarRecortes(c).then(() => { c.requestRenderAll(); alterou() })
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
    reselecionar(objs)
  }
  /** Espaços iguais entre 3+ camadas (a primeira e a última ficam onde estão). */
  function distribuir(eixo: 'h' | 'v') {
    if (!c || ativos.length < 3) return
    const objs = [...ativos]
    c.discardActiveObject()
    const itens = objs.map(o => ({ o, r: o.getBoundingRect() })).sort((a, b) => (eixo === 'h' ? a.r.left - b.r.left : a.r.top - b.r.top))
    const ini = eixo === 'h' ? itens[0].r.left : itens[0].r.top
    const ult = itens[itens.length - 1].r
    const fim = eixo === 'h' ? ult.left + ult.width : ult.top + ult.height
    const soma = itens.reduce((s, x) => s + (eixo === 'h' ? x.r.width : x.r.height), 0)
    const gap = (fim - ini - soma) / (itens.length - 1)
    let pos = ini
    for (const { o, r } of itens) {
      if (eixo === 'h') { o.set({ left: (o.left || 0) + (pos - r.left) }); pos += r.width + gap }
      else { o.set({ top: (o.top || 0) + (pos - r.top) }); pos += r.height + gap }
      o.setCoords()
    }
    reselecionar(objs)
  }
  function mover(dx: number, dy: number) {
    const cv = fabRef.current
    const sel = cv?.getActiveObject()
    if (!cv || !sel) return
    sel.set({ left: (sel.left || 0) + dx, top: (sel.top || 0) + dy }); sel.setCoords()
    cv.requestRenderAll(); alterou()
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
  function agruparSel() { const cv = fabRef.current; if (cv) { agrupar(cv); aplicarRecortes(cv).then(() => { cv.requestRenderAll(); alterou() }) } }
  function desagruparSel() {
    const cv = fabRef.current
    const g = cv?.getActiveObject()
    if (!cv || !(g instanceof Group) || g instanceof ActiveSelection) return
    const f = desagrupar(cv, g); cv.setActiveObject(new ActiveSelection(f, { canvas: cv })); cv.requestRenderAll(); alterou()
  }

  // ── atalhos de teclado (sempre a versão atual das funções) ────────────────────
  teclasRef.current = (e: KeyboardEvent) => {
    const cv = fabRef.current
    if (!cv) return
    const alvoTexto = (e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable]')
    const ativo = cv.getActiveObject()
    if (alvoTexto || (ativo instanceof Textbox && ativo.isEditing)) return
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase()
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer() }
    else if (mod && k === 'y') { e.preventDefault(); refazer() }
    else if (modoRef.current !== 'normal') return
    else if (mod && k === 'd') { e.preventDefault(); duplicar() }
    else if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) desagruparSel(); else agruparSel() }
    else if (mod && e.altKey && k === 'c') { e.preventDefault(); copiarEstilo() }
    else if (mod && e.altKey && k === 'v') { e.preventDefault(); colarEstilo() }
    else if (mod && k === 'c') { if (ativo) { e.preventDefault(); copiar() } }
    else if (mod && k === 'v') { if (clipboardRef.current.length) { e.preventDefault(); colar() } }
    else if (mod && (k === '=' || k === '+')) { e.preventDefault(); definirZoom(zoomRef.current * 1.2) }
    else if (mod && k === '-') { e.preventDefault(); definirZoom(zoomRef.current / 1.2) }
    else if (mod && k === '0') { e.preventDefault(); ajustarATela() }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && ativo) { e.preventDefault(); excluir() }
    else if (ativo && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const p = e.shiftKey ? 10 : 1
      mover(e.key === 'ArrowLeft' ? -p : e.key === 'ArrowRight' ? p : 0, e.key === 'ArrowUp' ? -p : e.key === 'ArrowDown' ? p : 0)
    }
  }

  // ── ajustes / efeitos ──────────────────────────────────────────────────────
  function mudarAjuste(img: FabricImage, patch: Partial<Ajustes>) {
    const a = soa(img).soaAjustes || AJUSTES_NEUTROS
    soa(img).soaAjustes = { ...a, ...patch, curvas: { ...a.curvas, ...(patch.curvas || {}) } }
    agendarProcessamento(img); alterou()
  }
  const efeitosConfirmados = useRef(new WeakMap<FabricObject, Efeitos | null>())
  async function mudarEfeitos(o: FabricObject, e: Efeitos | null) {
    efeitosConfirmados.current.delete(o)
    await aplicarEfeitos(o, e)
    const cv = fabRef.current
    if (cv && camadas(cv).some(x => soa(x).soaClipDe)) await aplicarRecortes(cv)
    cv?.requestRenderAll(); alterou(); tocar()
  }
  async function previaEfeitos(o: FabricObject, e: Efeitos | null) {
    if (e) { if (!efeitosConfirmados.current.has(o)) efeitosConfirmados.current.set(o, soa(o).soaEfeitos || null); await aplicarEfeitos(o, e) }
    else if (efeitosConfirmados.current.has(o)) { await aplicarEfeitos(o, efeitosConfirmados.current.get(o) || null); efeitosConfirmados.current.delete(o) }
    fabRef.current?.requestRenderAll()
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
      const h = new Circle({ left: p.x, top: p.y, radius: 7 / zoomRef.current, fill: '#f97316', stroke: '#ffffff', strokeWidth: 2 / zoomRef.current, originX: 'center', originY: 'center', hasControls: false, hasBorders: false, excludeFromExport: true })
      Object.assign(h, { soaAjudante: true, soaIdx: i })
      c.add(h)
    })
    agendarProcessamento(img); c.requestRenderAll()
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
    c.requestRenderAll(); alterou()
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
    c.requestRenderAll()
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
    if (img) c.setActiveObject(img)
    c.requestRenderAll()
  }

  function mudarRecorte(o: FabricObject, patch: Partial<Soa>) {
    Object.assign(o, patch)
    if (!c) return
    aplicarRecortes(c).then(() => { c.requestRenderAll(); alterou(); tocar() })
  }

  // ── OBJETO INTELIGENTE ──────────────────────────────────────────────────────
  async function subirConteudo(full: HTMLCanvasElement, nome: string) {
    const { proxy } = await criarProxy(full)
    const [png, pr] = await Promise.all([blobDe(full, 'image/png'), blobDe(proxy, 'image/webp', 0.86)])
    const [url, proxyUrl] = await Promise.all([enviarSoBlob(png, `${nome}.png`, 'imagem', workspaceId!), enviarSoBlob(pr, `proxy-${nome}.webp`, 'imagem', workspaceId!)])
    return { url, proxyUrl, bytes: png.size, proxy }
  }
  /** Substituir conteúdo: troca o arquivo-fonte → todas as instâncias (em todos os designs) mudam. */
  async function substituirConteudo(img: FabricImage, f: File) {
    const assetId = soa(img).soaAssetId
    if (!c || !assetId || !workspaceId) return
    setOcupado('Substituindo o conteúdo…'); setErro('')
    try {
      const imp = await importarImagem(f)
      const pr = await blobDe(imp.proxy, 'image/webp', 0.86)
      const proxyUrl = await enviarSoBlob(pr, `proxy-${f.name}.webp`, 'imagem', workspaceId)
      const url = await enviarSoBlob(f, f.name, 'imagem', workspaceId)
      const r = await fetch(`/api/estudio/assets/${assetId}/versao`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, proxyUrl, mime: f.type, tamanhoBytes: f.size, largura: imp.largura, altura: imp.altura }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao trocar o conteúdo')
      versoesRef.current.set(assetId, (versoesRef.current.get(assetId) || 1) + 1)
      const n = await trocarFonteDasInstancias(c, assetId, url, proxyUrl)
      const outros = Math.max(0, (j.usadoEm || 0) - 1)
      setAviso(`Conteúdo substituído: ${n} instância(s) aqui${outros ? ` e ${outros} outro(s) design(s)` : ''} já mostram a versão nova — cada uma no seu lugar.`)
      alterou()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  /** Converte a seleção (texto, formas, imagens, grupo) num objeto inteligente com fonte editável. */
  async function converterEmObjetoInteligente() {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d || !workspaceId || !storage) { setErro('O armazenamento precisa estar configurado.'); return }
    const sel = cv.getActiveObjects().filter(o => !soa(o).soaAjudante && !soa(o).soaArea)
    if (!sel.length) return
    if (enviandoRef.current) { setAviso('Espere as imagens terminarem de subir.'); return }
    setOcupado('Criando o objeto inteligente…')
    try {
      const ordemAtual = cv.getObjects()
      sel.sort((a, b) => ordemAtual.indexOf(a) - ordemAtual.indexOf(b))
      cv.discardActiveObject()
      const rs = sel.map(o => o.getBoundingRect())
      const r = { left: Math.floor(Math.min(...rs.map(x => x.left))), top: Math.floor(Math.min(...rs.map(x => x.top))) }
      const W = Math.ceil(Math.max(...rs.map(x => x.left + x.width)) - r.left), H = Math.ceil(Math.max(...rs.map(x => x.top + x.height)) - r.top)
      const tmp = new StaticCanvas(document.createElement('canvas'), { width: W, height: H, enableRetinaScaling: false })
      for (const o of sel) {
        const cp = await duplicarCamada(o)
        Object.assign(cp, { soaId: soa(o).soaId, soaNome: soa(o).soaNome, soaClipDe: null })
        cp.set({ left: (cp.left || 0) - r.left, top: (cp.top || 0) - r.top }); cp.setCoords()
        tmp.add(cp)
      }
      await aplicarRecortes(tmp)
      const nome = sel.length === 1 ? soa(sel[0]).soaNome || 'Objeto' : 'Objeto inteligente'
      // 1) design-FONTE (editável)
      const { json, assetIds } = serializar(tmp, fontesRef.current)
      const nd = await fetch('/api/estudio/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: `Fonte — ${nome}`, largura: Math.max(50, W), altura: Math.max(50, H), json }) }).then(x => x.json())
      if (!nd.id) throw new Error(nd.error || 'Não consegui criar a fonte')
      // 2) conteúdo renderizado em alta (2× para ficar nítido ao ampliar)
      const escala = Math.min(2, 4000 / Math.max(W, H))
      const full = await renderizarEmAlta(tmp, 1, escala)
      const up = await subirConteudo(full, nome.replace(/[^\w-]+/g, '_'))
      const asset = await fetch('/api/estudio/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'imagem', nome, url: up.url, mime: 'image/png', tamanhoBytes: up.bytes, pasta: 'Objetos inteligentes', meta: { largura: full.width, altura: full.height, proxyUrl: up.proxyUrl, fonteDesignId: nd.id } }) }).then(x => x.json())
      if (!asset.id) throw new Error(asset.error || 'Não consegui guardar o objeto')
      await fetch(`/api/estudio/designs/${nd.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetIds, fonteAssetId: asset.id }) })
      void tmp.dispose()
      // 3) troca a seleção pela instância do objeto inteligente, no mesmo lugar e tamanho
      const img = criarCamadaDeProxy(up.proxy, up.url, asset.id, nome, d)
      vincularAsset(img, asset.id, up.url)
      const k = W / up.proxy.width
      img.set({ scaleX: k, scaleY: k })
      img.setPositionByOrigin(new Point(r.left + W / 2, r.top + H / 2), 'center', 'center'); img.setCoords()
      const idx = cv.getObjects().indexOf(sel[0])
      cv.remove(...sel)
      cv.insertAt(Math.max(0, idx), img)
      versoesRef.current.set(asset.id, 1)
      cv.setActiveObject(img); cv.requestRenderAll(); alterou()
      setAviso('Pronto: virou objeto inteligente. “Editar fonte” abre as camadas originais; “Nova instância” cria cópias que mudam juntas.')
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  /** Editar fonte: abre o design que gera o objeto (cria um a partir da imagem, se ainda não houver). */
  async function editarFonte(img: FabricImage) {
    const assetId = soa(img).soaAssetId
    if (!assetId || !workspaceId) return
    setOcupado('Abrindo a fonte…')
    try {
      const d = await fetch(`/api/estudio/assets?ids=${assetId}`).then(r => r.json())
      const a = d.assets?.[0]
      if (!a) throw new Error('Arquivo não encontrado')
      let fonteId: string | undefined = a.meta?.fonteDesignId
      if (!fonteId) {
        const W0 = Number(a.meta?.largura) || 2000, H0 = Number(a.meta?.altura) || 2000
        const k = Math.min(1, 4000 / Math.max(W0, H0))
        const W = Math.max(50, Math.round(W0 * k)), H = Math.max(50, Math.round(H0 * k))
        // a fonte usa uma CÓPIA do arquivo (senão regravar o objeto sobrescreveria a própria fonte)
        const copia = await fetch('/api/estudio/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'imagem', nome: `${a.nome} (fonte)`, url: a.url, mime: a.mime, tamanhoBytes: a.tamanhoBytes, pasta: 'Objetos inteligentes', meta: { largura: W0, altura: H0, proxyUrl: a.meta?.proxyUrl } }) }).then(x => x.json())
        if (!copia.id) throw new Error(copia.error || 'Não consegui preparar a fonte')
        const tmp = new StaticCanvas(document.createElement('canvas'), { width: W, height: H, enableRetinaScaling: false })
        const cam = await criarCamadaImagem(a.url, copia.id, a.nome, { largura: W, altura: H }, a.meta?.proxyUrl)
        const s = W / cam.width; cam.set({ scaleX: s, scaleY: s }); cam.setPositionByOrigin(new Point(W / 2, H / 2), 'center', 'center'); cam.setCoords()
        tmp.add(cam)
        const { json, assetIds } = serializar(tmp, [])
        void tmp.dispose()
        const nd = await fetch('/api/estudio/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: `Fonte — ${a.nome}`, largura: W, altura: H, json }) }).then(x => x.json())
        if (!nd.id) throw new Error(nd.error || 'Não consegui criar a fonte')
        await fetch(`/api/estudio/designs/${nd.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetIds, fonteAssetId: assetId }) })
        await fetch(`/api/estudio/assets/${assetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fonteDesignId: nd.id }) })
        fonteId = nd.id
      }
      await salvar()
      router.push(`/estudio/editor/${fonteId}`)
    } catch (e) { setErro((e as Error).message); setOcupado('') }
  }
  /** Neste design-FONTE: regrava o objeto inteligente (todas as instâncias, em todos os designs). */
  async function atualizarObjetoInteligente() {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d || !fonteDeAsset || !workspaceId) return
    if (enviandoRef.current) { setAviso('Espere as imagens terminarem de subir.'); return }
    setOcupado('Atualizando o objeto inteligente…')
    try {
      await salvar()
      const escala = Math.min(2, 4000 / Math.max(d.largura, d.altura))
      const full = await renderizarEmAlta(cv, zoomRef.current, escala)
      const up = await subirConteudo(full, 'objeto')
      const r = await fetch(`/api/estudio/assets/${fonteDeAsset}/versao`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: up.url, proxyUrl: up.proxyUrl, mime: 'image/png', tamanhoBytes: up.bytes, largura: full.width, altura: full.height }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao atualizar')
      setAviso(`Objeto inteligente atualizado — ${j.usadoEm || 0} design(s) que usam esta arte já mostram a versão nova.`)
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

  // ── arte para replicar ──────────────────────────────────────────────────────
  async function obterArte(cfg: ConfigReplica, alta: boolean): Promise<HTMLCanvasElement | HTMLImageElement | null> {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d) return null
    if (cfg.fonte === 'design') return alta ? renderizarEmAlta(cv, zoomRef.current, 1) : renderizarDesign(cv, zoomRef.current, Math.min(1, 900 / Math.max(d.largura, d.altura)))
    const img = imagensDo(cv).find(o => soa(o).soaId === cfg.camadaId)
    if (!img) return null
    return conteudoDaCamada(img, alta)
  }

  // ─────────────────────────────────────────────────────────────── UI
  const statusTxt = enviando ? `Enviando ${enviando} imagem(ns)…` : { carregando: 'Abrindo…', salvo: 'Salvo', pendente: 'Alterações não salvas…', salvando: 'Salvando…', erro: 'Erro ao salvar' }[status]
  const img = um instanceof FabricImage ? um : null
  const txt = um instanceof Textbox ? um : null
  const linha = um instanceof Line ? um : null
  const forma = um && !img && !txt && !linha && !(um instanceof Group) ? um : null
  const s = um ? soa(um) : null
  const oi = c ? imagensDo(c).filter(o => soa(o).soaAssetId).map(o => ({ id: soa(o).soaId!, nome: soa(o).soaNome || 'Imagem' })) : []
  const preench = (o: FabricObject) => (soa(o).soaBase ? soa(o).soaBase!.fill : o.fill)
  const ehGrad = (f: unknown) => !!f && typeof f === 'object' && 'colorStops' in (f as object)

  return (
    <div className="max-w-[1600px] mx-auto p-3 sm:p-4 space-y-3">
      <div aria-hidden className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        {CLASSES_PRECARGA.map(cl => <span key={cl} className={cl}>Aa<b>Aa</b><i>Aa</i></span>)}
      </div>

      {/* barra superior */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/estudio/editor" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Designs</Link>
        {design && (
          <input value={design.nome} onChange={e => { const d = { ...design, nome: e.target.value }; designRef.current = d; setDesign(d); alterou() }}
            className="font-semibold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-400 focus:outline-none px-1 min-w-0 w-52" />
        )}
        {design && <span className="text-xs text-gray-400 tabular-nums">{design.largura}×{design.altura}px</span>}
        <span className={`text-xs inline-flex items-center gap-1 ${status === 'erro' ? 'text-red-600' : status === 'salvo' && !enviando ? 'text-emerald-600' : 'text-gray-400'}`}>
          {!!enviando && <CloudUpload className="w-3.5 h-3.5 animate-pulse" />}{statusTxt}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <button onClick={() => definirZoom(zoom / 1.2)} className="p-1.5 hover:text-orange-600" title="Diminuir (Ctrl −)"><ZoomOut className="w-4 h-4" /></button>
            <select value="" onChange={e => { if (e.target.value === 'fit') ajustarATela(); else if (e.target.value) definirZoom(Number(e.target.value)) }} className="text-xs bg-transparent w-16 text-center tabular-nums">
              <option value="">{Math.round(zoom * 100)}%</option>
              <option value="fit">Ajustar</option>
              {[0.25, 0.5, 0.75, 1, 1.5, 2].map(z => <option key={z} value={z}>{z * 100}%</option>)}
            </select>
            <button onClick={() => definirZoom(zoom * 1.2)} className="p-1.5 hover:text-orange-600" title="Aumentar (Ctrl +)"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={ajustarATela} className="p-1.5 hover:text-orange-600 border-l border-gray-200 dark:border-gray-700" title="Ajustar à tela (Ctrl 0)"><Maximize className="w-4 h-4" /></button>
          </div>
          <button onClick={() => setGuiasOn(v => !v)} className={btnIc + (guiasOn ? ' !border-orange-400 text-orange-600' : '')} title="Guias inteligentes (grudar)"><Magnet className="w-4 h-4" /></button>
          <button onClick={() => setGradeOn(v => !v)} className={btnIc + (gradeOn ? ' !border-orange-400 text-orange-600' : '')} title="Grade"><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={desfazer} disabled={!pilhaRef.current.length || modo !== 'normal'} className={btnIc} title="Desfazer (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
          <button onClick={refazer} disabled={!refazerRef.current.length || modo !== 'normal'} className={btnIc} title="Refazer (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
          <button onClick={() => setReplicar(true)} disabled={!design || modo !== 'normal'} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 text-orange-700 dark:text-orange-300 px-3 py-1.5 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-40">
            <Layers3 className="w-4 h-4" /> Replicar em moldes
          </button>
          <button onClick={() => setExportar(true)} disabled={!design || modo !== 'normal'} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {fonteDeAsset && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 px-3 py-2 text-xs text-sky-900 dark:text-sky-100">
          <Link2 className="w-4 h-4" />
          <span className="flex-1">Este design é a <b>fonte de um objeto inteligente</b>. Edite à vontade e clique em atualizar: todas as instâncias, em todos os designs, recebem a versão nova.</span>
          <button onClick={atualizarObjetoInteligente} disabled={!!ocupado} className="rounded-lg bg-sky-600 text-white px-2.5 py-1 font-semibold disabled:opacity-50">Atualizar objeto inteligente</button>
          <button onClick={() => router.back()} className="text-sky-700 dark:text-sky-300 hover:underline">voltar</button>
        </div>
      )}

      <CotaBarra atualizar={cotaVersao} faltam={faltam} />
      {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex justify-between gap-2"><span>{erro}</span><button onClick={() => setErro('')}><X className="w-4 h-4" /></button></div>}
      {aviso && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2 flex justify-between gap-2"><span>{aviso}</span><button onClick={() => setAviso('')}><X className="w-4 h-4" /></button></div>}

      <div className="grid gap-3 lg:grid-cols-[52px_1fr_320px]">
        {/* ferramentas */}
        <div className="flex lg:flex-col gap-1.5 flex-wrap">
          <label className={btnIc + ' cursor-pointer'} title="Importar imagem (ou arraste para a arte)"><Upload className="w-5 h-5" />
            <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => { if (e.target.files?.length) importarArquivos(e.target.files); e.target.value = '' }} />
          </label>
          <button onClick={abrirBibliotecaImagens} disabled={modo !== 'normal'} className={btnIc} title="Imagem de Meus arquivos"><ImagePlus className="w-5 h-5" /></button>
          <button onClick={addTexto} disabled={modo !== 'normal'} className={btnIc} title="Texto"><Type className="w-5 h-5" /></button>
          <button onClick={() => addForma('retangulo')} disabled={modo !== 'normal'} className={btnIc} title="Retângulo"><Square className="w-5 h-5" /></button>
          <button onClick={() => addForma('elipse')} disabled={modo !== 'normal'} className={btnIc} title="Círculo"><CircleIcon className="w-5 h-5" /></button>
          <button onClick={() => addForma('triangulo')} disabled={modo !== 'normal'} className={btnIc} title="Triângulo"><Triangle className="w-5 h-5" /></button>
          <button onClick={() => addForma('hexagono')} disabled={modo !== 'normal'} className={btnIc} title="Polígono (hexágono)"><Hexagon className="w-5 h-5" /></button>
          <button onClick={() => addForma('estrela')} disabled={modo !== 'normal'} className={btnIc} title="Estrela"><Star className="w-5 h-5" /></button>
          <button onClick={() => addForma('coracao')} disabled={modo !== 'normal'} className={btnIc} title="Coração"><Heart className="w-5 h-5" /></button>
          <button onClick={() => addForma('linha')} disabled={modo !== 'normal'} className={btnIc} title="Linha"><Minus className="w-5 h-5" /></button>
          <button onClick={() => addForma('seta')} disabled={modo !== 'normal'} className={btnIc} title="Seta"><Seta className="w-5 h-5" /></button>
          <button onClick={addArea} disabled={modo !== 'normal'} className={btnIc + ' text-sky-600'} title="Área de recorte (aplicar só dentro dela)"><SquareDashed className="w-5 h-5" /></button>
          <label className={btnIc + ' cursor-pointer relative'} title="Cor de fundo">
            <span className="block w-5 h-5 rounded border border-gray-300" style={{ background: (c?.backgroundColor as string) || 'transparent' }} />
            <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={(c?.backgroundColor as string) || '#ffffff'} onChange={e => { if (c) { c.backgroundColor = e.target.value; c.requestRenderAll(); alterou() } }} />
          </label>
          <button onClick={() => { if (c) { c.backgroundColor = ''; c.requestRenderAll(); alterou() } }} className={btnIc + ' text-[9px] leading-none'} title="Fundo transparente">sem<br />fundo</button>
        </div>

        {/* área de trabalho (arrastar arquivos = importar) */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3 min-h-[360px] relative"
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
          onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); importarArquivos(e.dataTransfer.files) } }}
          style={{ backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%)', backgroundSize: '16px 16px' }}>
          <div ref={hostRef} className="w-full overflow-auto max-h-[76vh] flex">
            <div className="shadow-lg m-auto"><canvas ref={elRef} /></div>
          </div>
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

        {/* painel lateral */}
        <div className="space-y-3 lg:max-h-[84vh] lg:overflow-y-auto">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-3">
            {!ativos.length && (
              <div className="text-xs text-gray-400 space-y-1">
                <p>Selecione uma camada para editar. Shift+clique na lista seleciona várias.</p>
                <p className="text-[10px]">Atalhos: setas movem (Shift = 10px) · Ctrl+D duplica · Ctrl+G agrupa · Ctrl+C/V copia/cola · Ctrl+Alt+C/V copia/cola estilo · Del apaga · Ctrl+Z/Y · Ctrl+roda = zoom</p>
              </div>
            )}
            {!!ativos.length && modo === 'normal' && (
              <div className="space-y-1.5">
                <p className={lbl}>Alinhar {ativos.length === 1 ? 'na arte' : 'entre si'}</p>
                <div className="flex gap-1 flex-wrap">
                  {([['esq', AlignStartVertical], ['centroH', AlignCenterVertical], ['dir', AlignEndVertical], ['topo', AlignStartHorizontal], ['centroV', AlignCenterHorizontal], ['base', AlignEndHorizontal]] as const).map(([t, I]) => (
                    <button key={t} onClick={() => alinhar(t)} className={btnIc}><I className="w-4 h-4" /></button>
                  ))}
                  {ativos.length >= 3 && <>
                    <button onClick={() => distribuir('h')} className={btnIc} title="Distribuir na horizontal"><AlignHorizontalSpaceAround className="w-4 h-4" /></button>
                    <button onClick={() => distribuir('v')} className={btnIc} title="Distribuir na vertical"><AlignVerticalSpaceAround className="w-4 h-4" /></button>
                  </>}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={duplicar} className={btnIc} title="Duplicar (Ctrl+D)"><Copy className="w-4 h-4" /></button>
                  {ativos.length > 1 && <button onClick={agruparSel} className={btnIc} title="Agrupar (Ctrl+G)"><GroupIcon className="w-4 h-4" /></button>}
                  {um instanceof Group && <button onClick={desagruparSel} className={btnIc} title="Desagrupar (Ctrl+Shift+G)"><Ungroup className="w-4 h-4" /></button>}
                  {um && <button onClick={() => ordem('frente', um)} className={btnIc} title="Trazer para frente"><ChevronUp className="w-4 h-4" /></button>}
                  {um && <button onClick={() => ordem('tras', um)} className={btnIc} title="Enviar para trás"><ChevronDown className="w-4 h-4" /></button>}
                  {um && <button onClick={copiarEstilo} className={btnIc} title="Copiar estilo (Ctrl+Alt+C)"><Paintbrush className="w-4 h-4" /></button>}
                  <button onClick={colarEstilo} disabled={!estiloRef.current} className={btnIc} title="Colar estilo (Ctrl+Alt+V)"><ClipboardPaste className="w-4 h-4" /></button>
                  <button onClick={excluir} className={btnIc + ' text-red-600'} title="Excluir (Del)"><Trash2 className="w-4 h-4" /></button>
                </div>
                {(!img || !s?.soaAssetId) && !ativos.some(o => soa(o).soaArea || (o instanceof FabricImage && !soa(o).soaAssetId)) && (
                  <button onClick={converterEmObjetoInteligente} disabled={!!ocupado} className="w-full inline-flex items-center justify-center gap-1.5 text-xs rounded-lg border border-sky-300 text-sky-800 dark:text-sky-200 py-1.5 hover:bg-sky-50 dark:hover:bg-sky-950/30">
                    <Link2 className="w-3.5 h-3.5" /> Converter em objeto inteligente
                  </button>
                )}
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

                {/* OBJETO INTELIGENTE */}
                {img && s.soaAssetId && (
                  <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 p-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-200 inline-flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Objeto inteligente
                      <span className="font-normal text-sky-600 dark:text-sky-400">· {instancias.get(s.soaAssetId) || 1} instância(s) aqui</span></p>
                    <div className="grid grid-cols-3 gap-1">
                      <label className="text-[10px] text-center rounded-lg border border-sky-300 py-1 cursor-pointer hover:bg-white dark:hover:bg-gray-900" title="Troca o arquivo — muda em todas as instâncias, em todos os designs">
                        <RefreshCw className="w-3.5 h-3.5 mx-auto" /> Substituir conteúdo
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) substituirConteudo(img, f); e.target.value = '' }} />
                      </label>
                      <button onClick={() => editarFonte(img)} className="text-[10px] rounded-lg border border-sky-300 py-1 hover:bg-white dark:hover:bg-gray-900" title="Abre as camadas que geram este objeto"><PencilRuler className="w-3.5 h-3.5 mx-auto" /> Editar fonte</button>
                      <button onClick={duplicar} className="text-[10px] rounded-lg border border-sky-300 py-1 hover:bg-white dark:hover:bg-gray-900" title="Cópia com transformação própria e o mesmo conteúdo"><Copy className="w-3.5 h-3.5 mx-auto" /> Nova instância</button>
                    </div>
                  </div>
                )}
                {img && !s.soaAssetId && <p className="text-[11px] text-gray-400 inline-flex items-center gap-1"><CloudUpload className="w-3.5 h-3.5" /> Enviando a imagem… (vira objeto inteligente ao terminar)</p>}

                {txt && (
                  <div className={secao}>
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
                      <button onClick={() => mudar(txt, { fontWeight: txt.fontWeight === 'bold' || txt.fontWeight === 700 ? 'normal' : 'bold' })} className={btnIc + ' font-bold text-xs w-7'}>B</button>
                      <button onClick={() => mudar(txt, { fontStyle: txt.fontStyle === 'italic' ? 'normal' : 'italic' })} className={btnIc + ' italic text-xs w-7'}>I</button>
                      {(['left', 'center', 'right'] as const).map(a => <button key={a} onClick={() => mudar(txt, { textAlign: a })} className={btnIc + ` text-[10px] ${txt.textAlign === a ? '!border-orange-400' : ''}`}>{a === 'left' ? 'Esq' : a === 'center' ? 'Centro' : 'Dir'}</button>)}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2">
                      <label className="text-[10px] text-gray-500">Espaço entre letras {txt.charSpacing || 0}
                        <input type="range" min={-100} max={800} value={txt.charSpacing || 0} onChange={e => mudar(txt, { charSpacing: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
                      <label className="text-[10px] text-gray-500">Altura da linha {(txt.lineHeight || 1.16).toFixed(2)}
                        <input type="range" min={70} max={300} value={Math.round((txt.lineHeight || 1.16) * 100)} onChange={e => mudar(txt, { lineHeight: Number(e.target.value) / 100 })} className="w-full accent-orange-500" /></label>
                    </div>
                  </div>
                )}

                {(txt || forma) && !s.soaArea && (
                  <div className={secao}>
                    <p className={lbl}>Preenchimento</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select className={inp + ' !w-auto'} value={ehGrad(preench(um)) ? 'grad' : 'cor'} onChange={e => mudarPreenchimento(um, e.target.value === 'grad' ? gradiente(um, '#f97316', '#db2777', 45) : '#fb923c')}>
                        <option value="cor">Cor</option><option value="grad">Gradiente</option>
                      </select>
                      {!ehGrad(preench(um)) ? (
                        <input type="color" value={typeof preench(um) === 'string' ? String(preench(um)) : '#000000'} onChange={e => mudarPreenchimento(um, e.target.value)} className="w-8 h-7 rounded border border-gray-200" />
                      ) : (() => {
                        const g = preench(um) as { colorStops: { color: string }[] }
                        const c1 = g.colorStops?.[0]?.color || '#f97316', c2 = g.colorStops?.[1]?.color || '#db2777'
                        return <>
                          <input type="color" value={c1} onChange={e => mudarPreenchimento(um, gradiente(um, e.target.value, c2, 45))} className="w-8 h-7 rounded border border-gray-200" />
                          <input type="color" value={c2} onChange={e => mudarPreenchimento(um, gradiente(um, c1, e.target.value, 45))} className="w-8 h-7 rounded border border-gray-200" />
                          {[0, 45, 90, 135].map(a => <button key={a} onClick={() => mudarPreenchimento(um, gradiente(um, c1, c2, a))} className="text-[10px] rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5">{a}°</button>)}
                        </>
                      })()}
                    </div>
                    {forma instanceof Rect && <>
                      <label className={lbl}>Cantos arredondados</label>
                      <input type="range" min={0} max={Math.round(Math.min(forma.width, forma.height) / 2)} value={forma.rx || 0} onChange={e => mudar(forma, { rx: Number(e.target.value), ry: Number(e.target.value) })} className="w-full accent-orange-500" />
                    </>}
                  </div>
                )}
                {linha && (
                  <div className={secao}>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">Cor <input type="color" value={String(linha.stroke || '#000000')} onChange={e => mudar(linha, { stroke: e.target.value })} className="w-8 h-7 rounded border border-gray-200" /></div>
                    <label className={lbl}>Espessura {linha.strokeWidth}px</label>
                    <input type="range" min={1} max={60} value={linha.strokeWidth} onChange={e => mudar(linha, { strokeWidth: Number(e.target.value) })} className="w-full accent-orange-500" />
                  </div>
                )}

                {!s.soaArea && (
                  <div className={secao}>
                    <PainelEfeitos efeitos={s.soaEfeitos || null} ehImagem={!!img} onMudar={e => mudarEfeitos(um, e)} onPrevia={e => previaEfeitos(um, e)} />
                  </div>
                )}

                {img && (
                  <div className={secao + ' space-y-3'}>
                    <PainelAjustes a={s.soaAjustes || AJUSTES_NEUTROS} onMudar={p => mudarAjuste(img, p)} onZerar={() => { soa(img).soaAjustes = null; agendarProcessamento(img); alterou(); tocar() }} />
                    <div>
                      <p className={lbl}>Distorcer</p>
                      <div className="grid grid-cols-3 gap-1">
                        <button onClick={() => entrarDistorcao(img, 'perspectiva', 2)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Scan className="w-3.5 h-3.5" /> Perspectiva</button>
                        <button onClick={() => entrarDistorcao(img, 'malha', 3)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Grid3x3 className="w-3.5 h-3.5" /> Malha 3×3</button>
                        <button onClick={() => entrarDistorcao(img, 'malha', 4)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Grid3x3 className="w-3.5 h-3.5" /> Malha 4×4</button>
                      </div>
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

                {!s.soaArea && (
                  <div className={secao}>
                    <div>
                      <p className={lbl}>Mostrar só dentro de…</p>
                      <select className={inp} value={s.soaClipDe || ''} onChange={e => mudarRecorte(um, e.target.value ? { soaClipDe: e.target.value, soaFormaMascara: null } : { soaClipDe: null })}>
                        <option value="">— a camada inteira —</option>
                        {c && camadas(c).filter(o => o !== um && !soa(o).soaClipDe).map(o => <option key={soa(o).soaId} value={soa(o).soaId}>{soa(o).soaArea ? '▭ ' : ''}{soa(o).soaNome || 'Camada'}</option>)}
                      </select>
                    </div>
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
                  </div>
                )}
                {s.soaArea && <p className="text-[11px] text-sky-700 dark:text-sky-300">Área de recorte: as camadas ligadas a ela só aparecem aqui dentro. Ela não sai na exportação.</p>}
              </>
            )}
          </div>

          {/* camadas */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 px-1 pb-1">Camadas</p>
            {!lista.length && <p className="text-xs text-gray-400 px-1 pb-1">Importe uma imagem (ou arraste o arquivo para a arte), ou adicione texto/forma.</p>}
            <div className="space-y-0.5">
              {lista.map(o => {
                const so = soa(o)
                const sel = ativos.includes(o)
                const ehOI = o instanceof FabricImage && !!so.soaAssetId
                return (
                  <div key={so.soaId} onClick={e => selecionarDaLista(o, e.shiftKey || e.ctrlKey || e.metaKey)}
                    className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs cursor-pointer ${sel ? 'bg-orange-100 dark:bg-orange-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <button onClick={e => { e.stopPropagation(); mudar(o, { visible: !o.visible }) }} className="text-gray-400 hover:text-gray-700" title={o.visible ? 'Ocultar' : 'Mostrar'}>{o.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
                    <button onClick={e => { e.stopPropagation(); travar(o, !so.soaTravado) }} className={so.soaTravado ? 'text-orange-600' : 'text-gray-300 hover:text-gray-600'} title={so.soaTravado ? 'Destravar' : 'Travar'}>{so.soaTravado ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</button>
                    {ehOI
                      ? <span className="text-[9px] font-bold rounded bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-200 px-1" title="Objeto inteligente">OI</span>
                      : <span className="text-[10px] text-gray-400 w-4 text-center">{so.soaArea ? '▭' : so.soaTipo === 'imagem' ? '🖼' : so.soaTipo === 'texto' ? 'T' : so.soaTipo === 'grupo' ? '▣' : '◆'}</span>}
                    {renomeando === so.soaId ? (
                      <input autoFocus defaultValue={so.soaNome} onClick={e => e.stopPropagation()}
                        onBlur={e => { so.soaNome = e.target.value.trim() || so.soaNome; setRenomeando(null); alterou() }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={inp + ' !py-0'} />
                    ) : (
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-200" onDoubleClick={e => { e.stopPropagation(); setRenomeando(so.soaId || null) }} title="Dois cliques para renomear">
                        {so.soaNome || 'Camada'}{so.soaClipDe ? ' ↳' : ''}{!semEfeitos(so.soaEfeitos) ? ' ✨' : ''}
                      </span>
                    )}
                    {ehOI && (instancias.get(so.soaAssetId!) || 0) > 1 && <span className="text-[9px] text-sky-600">×{instancias.get(so.soaAssetId!)}</span>}
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
            {!imagensLib.length && <p className="text-sm text-gray-400">Nenhuma imagem ainda — use o botão de importar.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imagensLib.map(a => (
                <button key={a.id} onClick={() => addImagemBiblioteca(a)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1 hover:border-orange-400 text-left">
                  <img src={a.meta?.proxyUrl || a.url} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" loading="lazy" />
                  <span className="block text-[10px] truncate mt-1 text-gray-600 dark:text-gray-300">{a.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {replicar && design && (
        <ReplicarMoldes moldes={moldes} setMoldes={setMoldes} config={replica} setConfig={setReplica} fontes={oi}
          obterArte={obterArte} workspaceId={workspaceId} storage={storage} onFechar={() => setReplicar(false)}
          onCota={f => { setFaltam(f); setCotaVersao(v => v + 1) }} />
      )}

      {exportar && design && c && (
        <ModalExportar design={design} onFechar={() => setExportar(false)}
          renderizar={() => renderizarEmAlta(c, zoomRef.current)}
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

// ── Exportar: tamanho original + presets de marketplace (em alta resolução) ─────
function ModalExportar({ design, onFechar, renderizar, workspaceId, storage, onCota }: {
  design: Design; onFechar: () => void; renderizar: () => Promise<HTMLCanvasElement>; workspaceId?: string; storage: boolean; onCota: (faltam: number) => void
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
    try { await exigirSaldo(total) }
    catch (e) { if (e instanceof SemCota) onCota(e.faltam); setErro((e as Error).message); return }
    const aut = new Autorizador(total)
    let n = 0
    try {
      setGerando('Renderizando em alta…')
      const base = await renderizar()
      const arquivos: { nome: string; blob: Blob }[] = []
      const nomeBase = design.nome.replace(/[\\/:*?"<>|]/g, '').trim() || 'design'
      if (original) { await aut.garantir(n++); arquivos.push({ nome: `${nomeBase}.${saida.formato}`, blob: await codificar(base, saida) }) }
      for (const id of canais) {
        const t = TAMANHOS_CANAIS.find(x => x.id === id)!
        setGerando(`${t.canal} ${t.rotulo}…`)
        await aut.garantir(n++)
        const cv = processarImagem(base, [{ op: 'redimensionar', largura: t.largura, altura: t.altura, modo, fundo: modo === 'encaixar' ? fundo : null }], null)
        arquivos.push({ nome: `${nomeBase} - ${t.canal} ${t.rotulo.replace(/[/:]/g, '-')} ${t.largura}x${t.altura}.${saida.formato}`, blob: await codificar(cv, saida) })
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
        await enviarArquivo(final.blob, final.nome, 'gerado', workspaceId, { pasta: 'Designs exportados', meta: { itens: arquivos.length }, lote: aut.lote }).catch(() => {})
      }
      onFechar()
    } catch (e) { if (e instanceof SemCota) onCota(e.faltam); setErro('Falha ao exportar: ' + (e as Error).message) }
    finally { onCota(0); setGerando(null) }
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
        <p className="text-[10px] text-gray-400">Sai na resolução cheia das imagens originais. Cada imagem exportada conta na sua cota do dia.</p>
      </div>
    </div>
  )
}
