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
  Canvas, StaticCanvas, FabricImage, FabricObject, Textbox, Rect, Ellipse, Polygon, Line, Circle, Group, ActiveSelection, Point, Gradient, Polyline,
} from 'fabric'
import {
  ArrowLeft, Undo2, Redo2, Type, Square, Circle as CircleIcon, Star, Heart, ImagePlus, Upload, Eye, EyeOff, Lock, Unlock,
  ChevronUp, ChevronDown, Trash2, Copy, Group as GroupIcon, Ungroup, Download, Loader2, X, AlignStartVertical, AlignCenterVertical,
  AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Brush, Scan, Grid3x3, Link2, RefreshCw, Check,
  Minus, ArrowRight as Seta, Triangle, Hexagon, ZoomIn, ZoomOut, Maximize, Magnet, LayoutGrid, Layers3, SquareDashed, PencilRuler,
  Paintbrush, ClipboardPaste, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, CloudUpload,
  Crop, RotateCw, FlipHorizontal2, FlipVertical2, Lasso, WandSparkles, Shapes, LayoutTemplate, Scaling, Combine, Bot, BookmarkPlus,
  CaseUpper, CaseLower, CaseSensitive, SquareDashedMousePointer, SlidersHorizontal, Palette, FileType2,
  History,
} from 'lucide-react'
import { FONTES_NATIVAS, CLASSES_PRECARGA } from '../fontesNativas'
import CotaBarra from '../CotaBarra'
import PainelEfeitos from './PainelEfeitos'
import ReplicarMoldes, { type ConfigReplica } from './ReplicarMoldes'
import { grudar, desenharSobreposicao, type EstadoGuias } from './guias'
import ModalBiblioteca, { type AbaBiblioteca } from './ModalBiblioteca'
import PainelMarca from './PainelMarca'
import PainelIA, { type ResultadoIA } from './PainelIA'
import { criarElemento, criarMoldura, criarGrade, jsonDeTemplateMassa, type Elemento, type FormaMoldura, type Grade, type Modelo } from '@/lib/estudio/biblioteca'
import { selecaoPoligono, varinhaMagica, combinarSelecao, inverterAlfa } from '@/lib/estudio/selecao'
import {
  soa, camadas, imagensDo, criarCamadaDeProxy, criarCamadaImagem, criarProxy, vincularAsset, processarCamada, aplicarRecortes,
  aplicarEfeitos, agrupar, desagrupar, serializar, desserializar, trocarFonteDasInstancias, renderizarDesign, renderizarEmAlta,
  conteudoDaCamada, cenaParaOriginal, originalParaCena, pintarMascara, gravarMascara, limparMascara, duplicarCamada, novoIdCamada,
  pontosEstrela, pontosCoracao, pontosPoligono, CamadaAjuste, novaCamadaAjuste, dimMascara, conteudoParaSelecao, aplicarSelecaoNaMascara,
  camadaDaSelecao, sobreposicaoSelecao, type FonteDesign, type DesignJson, type FormaMascaraTipo, type Soa, type AssetRef,
} from '@/lib/estudio/camadas'
import { AJUSTES_NEUTROS, FILTROS, type Ajustes } from '@/lib/estudio/ajustes'
import { semEfeitos, type Efeitos } from '@/lib/estudio/efeitos'
import { gradeNeutra, type Distorcao } from '@/lib/estudio/transform'
import type { MoldeReplica } from '@/lib/estudio/areaMolde'
import { importarImagem } from '@/lib/estudio/importar'
import { camadasParaEditor, acharFonte, type CamadaEditor } from '@/lib/estudio/importarArte'
import type { Caixa } from '@/lib/estudio/tipos'
import { enviarArquivo, enviarSoBlob, baixar, exigirSaldo, Autorizador, SemCota } from '@/lib/estudio/cliente'
import { TAMANHOS_CANAIS, TAMANHOS_REVISADOS_EM, rotuloTamanho } from '@/lib/estudio/tamanhos'
import { processarImagem, codificar, type Saida } from '@/lib/estudio/acoes'
import { LIMITE_LOTE } from '@/lib/estudio/dados'
import { chaveRascunho, guardarRascunho, lerRascunho, marcarSincronizado, apagarRascunho, recuo, ehErroDeRede } from '@/lib/estudio/rascunho'

const BLENDS = [
  { v: 'source-over', r: 'Normal' }, { v: 'multiply', r: 'Multiplicar' }, { v: 'screen', r: 'Tela' }, { v: 'overlay', r: 'Sobrepor' },
] as const
const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-0.5'
const btnIc = 'p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-400 disabled:opacity-30 bg-white dark:bg-gray-900'
const secao = 'space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2'

type Modo = 'normal' | 'distorcer' | 'mascara' | 'selecao'
interface Design { nome: string; largura: number; altura: number }
interface BibliotecaFonte { id: string; nome: string; url: string; familia: string; acervo: boolean }
interface Estilo { vetor: Record<string, unknown>; texto: Record<string, unknown>; ajustes: Ajustes | null; efeitos: Efeitos | null; opacity: number; blend: string }
/** Rede de segurança: nenhuma etapa espera para sempre (o spinner sempre desliga). */
function comPrazo<T>(p: Promise<T>, ms: number, etapa: string, ac?: AbortController): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { ac?.abort(); rej(new Error(`Demorou demais em “${etapa}” — nada foi alterado. Confira a internet e tente de novo.`)) }, ms)
    p.then(v => { clearTimeout(t); res(v) }, e => { clearTimeout(t); rej(e) })
  })
}
/** fetch JSON com prazo: sem resposta do servidor → erro claro (não fica esperando). */
async function jsonComPrazo(url: string, init: RequestInit, ms: number, etapa: string): Promise<Record<string, unknown> & { id?: string; error?: string }> {
  const ac = new AbortController()
  const r = await comPrazo(fetch(url, { ...init, signal: ac.signal }), ms, etapa, ac)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Falha em “${etapa}” (erro ${r.status}).`)
  return j
}
const JSON_H = { 'Content-Type': 'application/json' }
const blobDe = (c: HTMLCanvasElement, tipo: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), tipo, q))

export default function EditorCamadas({ designId }: { designId: string }) {
  // Fora do React Compiler: o estado das camadas vive no canvas do Fabric (mutável, fora do React).
  'use no memo'
  const router = useRouter()
  const { data: session } = useSession()
  const workspaceId = (session?.user as { workspaceId?: string } | undefined)?.workspaceId
  const userId = (session?.user as { id?: string } | undefined)?.id
  // rascunho local (IndexedDB) por login + design: sobrevive a rede caindo, aba fechada e travamento
  const chaveRef = useRef('')
  chaveRef.current = userId ? chaveRascunho(userId, 'design', designId) : ''

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
  const [status, setStatus] = useState<'carregando' | 'salvo' | 'pendente' | 'salvando' | 'erro' | 'offline'>('carregando')
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)
  const tentativaRef = useRef(0)
  const servidorEmRef = useRef(0)            // updatedAt do servidor ao abrir (compara com o rascunho local)
  const [recuperar, setRecuperar] = useState<{ em: number; json: DesignJson; assetIds: string[] } | null>(null)
  const [historico, setHistorico] = useState<{ carregando: boolean; lista: { id: string; criadoEm: string; motivo: string; previewUrl: string | null }[] } | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState('')
  // rede de segurança geral: a mesma mensagem de "ocupado" parada por 3 min = travou → libera a tela
  useEffect(() => {
    if (!ocupado) return
    const t = setTimeout(() => { setOcupado(''); setErro(`A operação “${ocupado.replace(/….*$/, '')}” parou de responder e foi interrompida. Tente de novo.`) }, 180_000)
    return () => clearTimeout(t)
  }, [ocupado])
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
  // biblioteca / marca / redimensionar / IA / template
  const [biblio, setBiblio] = useState<AbaBiblioteca | null>(null)
  const [mostrarMarca, setMostrarMarca] = useState(false)
  const [redim, setRedim] = useState(false)
  const [ia, setIa] = useState(false)
  const [ehModelo, setEhModelo] = useState(false)
  const [estilosTexto, setEstilosTexto] = useState<{ id: string; nome: string; operacoes: Record<string, unknown>[] }[]>([])
  // seleção (retângulo / laço / varinha)
  const [selTool, setSelTool] = useState<'retangulo' | 'laco' | 'varinha'>('retangulo')
  const selToolRef = useRef(selTool)
  useEffect(() => { selToolRef.current = selTool }, [selTool])
  const [selModo, setSelModo] = useState<'nova' | 'somar' | 'subtrair'>('nova')
  const selModoRef = useRef(selModo)
  useEffect(() => { selModoRef.current = selModo }, [selModo])
  const [tolerancia, setTolerancia] = useState(28)
  const toleranciaRef = useRef(tolerancia)
  useEffect(() => { toleranciaRef.current = tolerancia }, [tolerancia])
  const selecaoRef = useRef<HTMLCanvasElement | null>(null)
  const [temSelecao, setTemSelecao] = useState(false)
  const selOverlayRef = useRef<FabricObject | null>(null)
  const selArrastoRef = useRef<{ pts: Point[]; ajuda: FabricObject | null } | null>(null)

  // histórico / salvamento
  const carregandoRef = useRef(true)
  // ── MULTIPÁGINA (estilo Canva): cada página guarda o próprio JSON; o canvas mostra a página atual
  type Pagina = { id: string; fabric: Record<string, unknown> | null; mini: string }
  const paginasRef = useRef<Pagina[]>([{ id: 'p1', fabric: null, mini: '' }])
  const atualRef = useRef(0)
  const assetsRef = useRef<Record<string, AssetRef>>({})
  const [paginasUi, setPaginasUi] = useState<{ id: string; mini: string }[]>([{ id: 'p1', mini: '' }])
  const [paginaAtual, setPaginaAtual] = useState(0)
  const [arrastoPagina, setArrastoPagina] = useState<number | null>(null)
  const [arrastoCamada, setArrastoCamada] = useState<string | null>(null)
  const [templateCriado, setTemplateCriado] = useState<string | null>(null)
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
    const pags = paginasRef.current
    if (pags.length > 1) {
      const todas = pags.map((p, i) => (i === atualRef.current ? r.json.fabric : p.fabric || { objects: [] }))
      const ids = (objs: unknown[]) => { for (const o of (objs || []) as Record<string, unknown>[]) { if (o.soaAssetId) r.assetIds.push(String(o.soaAssetId)); if (Array.isArray(o.objects)) ids(o.objects) } }
      for (const f of todas) ids((f as { objects?: unknown[] }).objects || [])
      r.json.paginas = todas.map((f, i) => ({ id: pags[i].id, fabric: f as Record<string, unknown> }))
      r.json.fabric = todas[0] as Record<string, unknown>
    }
    r.assetIds = [...new Set(r.assetIds)]
    return r
  }, [])

  const salvar = useCallback(async (versao?: string): Promise<boolean> => {
    const c = fabRef.current, d = designRef.current
    if (!c || !d) return false
    // Imagem recém-importada ainda subindo: espera (senão o design guardaria um endereço local).
    if (enviandoRef.current > 0) { if (salvarTimer.current) clearTimeout(salvarTimer.current); salvarTimer.current = setTimeout(() => salvar(), 1500); return false }
    if (salvarTimer.current) { clearTimeout(salvarTimer.current); salvarTimer.current = null }
    setStatus('salvando')
    const inicio = Date.now()
    const ac = new AbortController()
    const prazo = setTimeout(() => ac.abort(), 30_000)
    try {
      const { json, assetIds } = montarJson()
      const previewUrl = renderizarDesign(c, zoomRef.current, 240 / Math.max(d.largura, d.altura)).toDataURL('image/jpeg', 0.7)
      paginasRef.current[atualRef.current] = { ...paginasRef.current[atualRef.current], mini: previewUrl }
      setPaginasUi(paginasRef.current.map(p => ({ id: p.id, mini: p.mini })))
      const body = JSON.stringify({ json, assetIds, previewUrl, nome: d.nome, ...(versao ? { versao } : {}) })
      const r = await fetch(`/api/estudio/designs/${designId}`, {
        // keepalive só com corpo pequeno: acima de 64 KB o navegador RECUSA a requisição (design grande não salvava)
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, keepalive: body.length < 60_000, signal: ac.signal, body,
      })
      if (!r.ok) {
        const e = new Error((await r.json().catch(() => ({}))).error || `erro ${r.status}`) as Error & { status?: number }
        e.status = r.status; throw e
      }
      tentativaRef.current = 0
      setStatus('salvo'); setSalvoEm(new Date())
      if (chaveRef.current) void marcarSincronizado(chaveRef.current, inicio)
      return true
    } catch (e) {
      const st = (e as { status?: number }).status
      const rede = !st && ehErroDeRede(e)
      setStatus(rede ? 'offline' : 'erro')
      // rede/servidor fora: tenta de novo sozinho (2 s, 4 s, 8 s… até 60 s); erro de conteúdo (4xx) não adianta repetir
      if (rede || (st && st >= 500)) {
        const t = tentativaRef.current++
        if (salvarTimer.current) clearTimeout(salvarTimer.current)
        salvarTimer.current = setTimeout(() => salvar(), recuo(t))
      } else setErro('Não consegui salvar: ' + (e as Error).message)
      return false
    } finally { clearTimeout(prazo) }
  }, [designId, montarJson])

  const snapshot = useCallback(() => {
    if (!fabRef.current) return
    const m = montarJson()
    const s = JSON.stringify(m.json)
    if (s === ultimoRef.current) return
    // rascunho local (não bloqueia): com imagem ainda subindo o endereço é provisório — espera o próximo
    if (chaveRef.current && enviandoRef.current === 0) void guardarRascunho(chaveRef.current, { json: m.json, assetIds: m.assetIds })
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
    salvarTimer.current = setTimeout(() => salvar(), 1500)
  }, [salvar, snapshot, tocar])

  // Reabriu: há rascunho local MAIS NOVO que o servidor e diferente dele? Oferece restaurar.
  const checouRascunho = useRef(false)
  useEffect(() => {
    if (checouRascunho.current || !userId || status === 'carregando' || !fabRef.current) return
    checouRascunho.current = true
    void lerRascunho<{ json: DesignJson; assetIds: string[] }>(chaveRascunho(userId, 'design', designId)).then(r => {
      if (!r || r.sincronizado || r.em <= servidorEmRef.current) return
      if (JSON.stringify(r.dados.json) === ultimoRef.current) return
      setRecuperar({ em: r.em, json: r.dados.json, assetIds: r.dados.assetIds || [] })
    })
  }, [userId, status, designId])

  /** Garante as URLs dos objetos inteligentes citados (versão antiga/rascunho pode usar asset que não está aberto). */
  async function carregarRefs(ids: string[]) {
    const falta = ids.filter(id => !assetsRef.current[id])
    if (!falta.length) return
    const d = await fetch(`/api/estudio/assets?ids=${falta.join(',')}`).then(r => r.json()).catch(() => ({ assets: [] }))
    for (const a of d.assets || []) assetsRef.current[a.id] = { url: a.url, proxyUrl: a.meta?.proxyUrl || null }
  }
  async function restaurarRascunho() {
    const r = recuperar; if (!r) return
    setRecuperar(null); setOcupado('Restaurando as alterações…')
    try {
      await carregarRefs(r.assetIds)
      pilhaRef.current.push(ultimoRef.current)
      await restaurar(JSON.stringify(r.json))
      setAviso('Alterações recuperadas. Já estão sendo salvas.')
    } catch (e) { setErro('Não consegui restaurar: ' + (e as Error).message) } finally { setOcupado('') }
  }
  async function abrirHistorico() {
    setHistorico({ carregando: true, lista: [] })
    const d = await fetch(`/api/estudio/designs/${designId}/versoes`).then(r => r.json()).catch(() => ({ versoes: [] }))
    setHistorico({ carregando: false, lista: d.versoes || [] })
  }
  async function restaurarVersao(vid: string) {
    setOcupado('Restaurando a versão…'); setErro('')
    try {
      // guarda o estado atual como versão antes (restaurar nunca perde nada)
      await salvar('antes de restaurar')
      const d = await fetch(`/api/estudio/designs/${designId}/versoes?id=${vid}`).then(r => r.json())
      if (!d.versao) throw new Error(d.error || 'Versão não encontrada')
      await carregarRefs(Array.isArray(d.versao.assetIds) ? d.versao.assetIds : [])
      pilhaRef.current.push(ultimoRef.current)
      await restaurar(JSON.stringify(d.versao.json))
      setHistorico(null)
      setAviso(`Versão de ${new Date(d.versao.criadoEm).toLocaleString('pt-BR')} restaurada (a anterior ficou no histórico; Ctrl+Z também desfaz).`)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  const setMoldes = (m: MoldeReplica[]) => { moldesRef.current = m; setMoldesS(m); alterou() }
  const setReplica = (r: ConfigReplica) => { replicaRef.current = r; setReplicaS(r); alterou() }

  async function restaurar(s: string) {
    const c = fabRef.current
    if (!c) return
    carregandoRef.current = true
    const j = JSON.parse(s) as DesignJson
    if (j.paginas?.length) {
      paginasRef.current = j.paginas.map(p => ({ id: p.id, fabric: p.fabric, mini: paginasRef.current.find(x => x.id === p.id)?.mini || '' }))
      atualRef.current = Math.min(atualRef.current, j.paginas.length - 1); setPaginaAtual(atualRef.current)
      setPaginasUi(paginasRef.current.map(p => ({ id: p.id, mini: p.mini })))
    }
    const desta = j.paginas?.length ? { ...j, fabric: j.paginas[atualRef.current].fabric } : j
    try { c.clear(); await desserializar(c, desta, assetsRef.current) } finally { carregandoRef.current = false }
    moldesRef.current = (j.moldes as MoldeReplica[]) || []; setMoldesS(moldesRef.current)
    ultimoRef.current = s
    setAtivos([]); tocar(); setStatus('pendente')
    if (salvarTimer.current) clearTimeout(salvarTimer.current)
    salvarTimer.current = setTimeout(() => salvar(), 1200)
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
    c.on('mouse:down', e => { if (modoRef.current === 'mascara') iniciarPincel(e.scenePoint); else if (modoRef.current === 'selecao') selBaixo(e.scenePoint) })
    c.on('mouse:move', e => { if (modoRef.current === 'mascara') moverPincel(e.scenePoint); else if (modoRef.current === 'selecao') selMover(e.scenePoint) })
    c.on('mouse:up', () => { if (modoRef.current === 'mascara') soltarPincel(); else if (modoRef.current === 'selecao') selSoltar() })
    c.on('mouse:wheel', e => {
      const ev = e.e as WheelEvent
      if (!ev.ctrlKey && !ev.metaKey) return
      ev.preventDefault(); ev.stopPropagation()
      definirZoom(zoomRef.current * (ev.deltaY < 0 ? 1.1 : 1 / 1.1))
    })

    let vivo = true
    ;(async () => {
      fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => {})
      fetch('/api/estudio/presets?tipo=estilo-texto').then(r => r.json()).then(d => setEstilosTexto(d.presets || [])).catch(() => {})
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
        servidorEmRef.current = j.design.updatedAt ? new Date(j.design.updatedAt).getTime() : 0
        setEhModelo(!!j.design.ehModelo)
        ajustarATela()
        const refs: Record<string, AssetRef> = {}
        for (const a of j.assets || []) { refs[a.id] = { url: a.url, proxyUrl: a.meta?.proxyUrl || null }; versoesRef.current.set(a.id, Number(a.meta?.versao || 1)) }
        assetsRef.current = refs
        let json = j.design.json as DesignJson
        if (json?.paginas?.length) {
          paginasRef.current = json.paginas.map(p => ({ id: p.id, fabric: p.fabric, mini: '' }))
          atualRef.current = 0; setPaginaAtual(0)
          setPaginasUi(paginasRef.current.map(p => ({ id: p.id, mini: '' })))
          json = { ...json, fabric: json.paginas[0].fabric }
        }
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
        setStatus('salvo'); setSalvoEm(servidorEmRef.current ? new Date(servidorEmRef.current) : null)
        // "Criar cópia no novo tamanho": a cópia abre com ?redim=LxA e se redimensiona sozinha.
        const rd = new URLSearchParams(window.location.search).get('redim')
        if (rd && /^\d+x\d+$/.test(rd)) { const [W2, H2] = rd.split('x').map(Number); window.history.replaceState(null, '', window.location.pathname); redimensionarRef.current(W2, H2) }
      } catch (e) { setErro((e as Error).message); setStatus('erro') }
      finally { carregandoRef.current = false; tocar() }
    })()

    const teclas = (e: KeyboardEvent) => teclasRef.current(e)
    const antesDeSair = (e: BeforeUnloadEvent) => {
      if (enviandoRef.current > 0 || ['pendente', 'salvando', 'offline', 'erro'].includes(statusRef.current)) { void salvar(); e.preventDefault() }
    }
    // a rede voltou: sincroniza o que ficou guardado neste aparelho
    const voltouRede = () => { if (['offline', 'erro', 'pendente'].includes(statusRef.current)) { tentativaRef.current = 0; void salvar() } }
    window.addEventListener('online', voltouRede)
    const aoVoltar = () => { if (document.visibilityState === 'visible') checarVersoes() }
    window.addEventListener('keydown', teclas)
    window.addEventListener('beforeunload', antesDeSair)
    window.addEventListener('resize', ajustarATela)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      window.removeEventListener('keydown', teclas)
      window.removeEventListener('beforeunload', antesDeSair)
      window.removeEventListener('online', voltouRede)
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
    const moldura = molduraSelecionada()
    const EM_CAMADAS = /\.(psd|psb|svg|pdf|ai|dxf)$/i
    for (const f of [...fs].filter(x => EM_CAMADAS.test(x.name))) {
      // arquivo EM CAMADAS: cada camada vira uma camada editável (texto continua texto). Nunca achata calado.
      setOcupado('Lendo as camadas…')
      try { if (await importarCamadasDoArquivo(f)) continue; setErro(`Não consegui separar as camadas de “${f.name}”.`) }
      catch (e) { setErro(`Não consegui separar as camadas de “${f.name}”: ${(e as Error).message}`) } finally { setOcupado('') }
    }
    for (const f of [...fs].filter(x => x.type.startsWith('image/') && !EM_CAMADAS.test(x.name))) {
      setOcupado(/\.pdf$/i.test(f.name) ? 'Abrindo PDF…' : 'Abrindo imagem…')
      try {
        const imp = await importarImagem(f)
        const img = criarCamadaDeProxy(imp.proxy, imp.urlLocal, null, f.name.replace(/\.[^.]+$/, ''), designRef.current!)
        centralizar(img); c.add(img)
        if (moldura) colocarNaMoldura(img, moldura)
        c.setActiveObject(img); c.requestRenderAll()
        setOcupado('')
        enviandoRef.current++; setEnviando(enviandoRef.current)
        imp.enviar(workspaceId)
          .then(up => { vincularAsset(img, up.id, up.url); versoesRef.current.set(up.id, 1); alterou(); tocar() })
          .catch(e => setErro(`“${f.name}” abriu, mas não consegui guardá-la (${(e as Error).message}) — ela some ao fechar.`))
          .finally(() => { enviandoRef.current--; setEnviando(enviandoRef.current) })
      } catch (e) { setErro(`${f.name}: ${(e as Error).message}`) } finally { setOcupado('') }
    }
  }
  // ── páginas ───────────────────────────────────────────────────────────────────
  const syncPaginas = () => setPaginasUi(paginasRef.current.map(p => ({ id: p.id, mini: p.mini })))
  function miniDaAtual(): string {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d) return ''
    try { return renderizarDesign(cv, zoomRef.current, 110 / Math.max(d.largura, d.altura)).toDataURL('image/jpeg', 0.6) } catch { return '' }
  }
  function guardarAtual() {
    const cv = fabRef.current; if (!cv) return
    const r = serializar(cv, fontesRef.current)
    paginasRef.current[atualRef.current] = { ...paginasRef.current[atualRef.current], fabric: r.json.fabric, mini: miniDaAtual() }
  }
  async function carregarPagina(j: number) {
    const cv = fabRef.current; if (!cv) return
    carregandoRef.current = true
    try {
      cv.discardActiveObject(); cv.clear()
      await desserializar(cv, { versao: 1, fabric: paginasRef.current[j].fabric || { objects: [], background: '#ffffff' }, fontes: fontesRef.current }, assetsRef.current)
    } finally { carregandoRef.current = false }
    atualRef.current = j; setPaginaAtual(j); setAtivos([]); cv.requestRenderAll(); tocar()
  }
  async function aguardarEnvios() { for (let i = 0; i < 600 && enviandoRef.current > 0; i++) await new Promise(r => setTimeout(r, 200)) }
  async function irParaPagina(j: number): Promise<boolean> {
    if (j === atualRef.current || j < 0 || j >= paginasRef.current.length) return true
    if (modoRef.current !== 'normal') { setAviso('Termine a seleção/pintura antes de trocar de página.'); return false }
    if (enviandoRef.current > 0) { setOcupado('Terminando de subir as imagens…'); await aguardarEnvios(); setOcupado('') }
    guardarAtual(); await carregarPagina(j); syncPaginas()
    return true
  }
  async function novaPagina(duplicar: boolean) {
    if (enviandoRef.current > 0) await aguardarEnvios()
    guardarAtual()
    const atual = paginasRef.current[atualRef.current]
    const fundo = (fabRef.current?.backgroundColor as string) || '#ffffff'
    const nova: Pagina = { id: 'p' + Math.random().toString(36).slice(2, 9), fabric: duplicar && atual.fabric ? structuredClone(atual.fabric) : { objects: [], background: fundo }, mini: duplicar ? atual.mini : '' }
    paginasRef.current.splice(atualRef.current + 1, 0, nova)
    await carregarPagina(atualRef.current + 1); syncPaginas(); alterou()
  }
  async function removerPagina(i: number) {
    if (paginasRef.current.length <= 1) return
    if (!confirm(`Remover a página ${i + 1}? (dá para desfazer)`)) return
    if (i === atualRef.current) { paginasRef.current.splice(i, 1); await carregarPagina(Math.min(i, paginasRef.current.length - 1)) }
    else { guardarAtual(); paginasRef.current.splice(i, 1); if (i < atualRef.current) { atualRef.current--; setPaginaAtual(atualRef.current) } }
    syncPaginas(); alterou()
  }
  function moverPagina(de: number, para: number) {
    if (de === para || para < 0 || para >= paginasRef.current.length) return
    guardarAtual()
    const idAtual = paginasRef.current[atualRef.current].id
    const [pg] = paginasRef.current.splice(de, 1); paginasRef.current.splice(para, 0, pg)
    atualRef.current = paginasRef.current.findIndex(x => x.id === idAtual); setPaginaAtual(atualRef.current)
    syncPaginas(); alterou()
  }
  /** Solta uma camada sobre outra no painel = ela passa a ocupar aquele lugar na pilha. */
  function soltarCamada(alvo: FabricObject) {
    const cv = fabRef.current
    if (!cv || !arrastoCamada) return
    const o = camadas(cv).find(x => soa(x).soaId === arrastoCamada)
    setArrastoCamada(null)
    if (!o || o === alvo) return
    cv.moveObjectTo(o, cv.getObjects().indexOf(alvo))
    aplicarRecortes(cv).then(() => { cv.requestRenderAll(); alterou(); tocar() })
  }

  /** Fonte do texto importado: a EMBUTIDA no PDF (vira fonte do ateliê) ou a MESMA pelo nome; senão avisa. */
  async function fonteParaTexto(t: NonNullable<CamadaEditor['texto']>): Promise<{ familia: string; id: string; faltou: string | null }> {
    const fe = t.fonteEmbutida
    // subconjunto (só as letras do arquivo): a MESMA fonte completa pelo nome tem prioridade
    if (fe?.subconjunto) {
      const nat0 = FONTES_NATIVAS.find(x => acharFonte(fe.nome, [{ id: x.id, nome: x.rotulo }]))
      if (nat0) return { familia: nat0.familia, id: nat0.id, faltou: null }
    }
    if (fe?.dados?.length) {
      const familia = `PDF_${fe.nome.replace(/[^\w]/g, '').slice(0, 24)}_${fe.dados.length}`
      if (!fontesRef.current.some(x => x.familia === familia)) {
        try {
          const ff = new FontFace(familia, fe.dados as BufferSource); await ff.load(); document.fonts.add(ff)
          let url = ''
          if (storage && workspaceId) { try { url = (await enviarArquivo(new Blob([fe.dados as BlobPart], { type: 'font/otf' }), `${fe.nome}.otf`, 'fonte', workspaceId, { pasta: 'Fontes', meta: { familia, embutidaDoPdf: true, subconjunto: fe.subconjunto } })).url } catch { /* fica só na sessão */ } }
          fontesRef.current.push({ id: familia, familia, url })
        } catch { /* fonte ilegível → cai no nome */ }
      }
      if (fontesRef.current.some(x => x.familia === familia)) return { familia, id: `b:${familia}`, faltou: fe.subconjunto ? fe.nome : null }
    }
    const nome = t.fonteArquivo || fe?.nome || null
    const nativa = FONTES_NATIVAS.find(x => nome && acharFonte(nome, [{ id: x.id, nome: x.rotulo }]))
    if (nativa) return { familia: nativa.familia, id: nativa.id, faltou: null }
    const minha = nome ? biblioteca.find(b => acharFonte(nome, [{ id: b.id, nome: b.nome }])) : null
    if (minha?.familia) {
      try { const ff = new FontFace(minha.familia, `url(${minha.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue */ }
      if (!fontesRef.current.some(x => x.familia === minha.familia)) fontesRef.current.push({ id: minha.id, familia: minha.familia, url: minha.url })
      return { familia: minha.familia, id: `b:${minha.id}`, faltou: null }
    }
    const fam = FONTES_NATIVAS.find(x => x.id === t.fonte) || FONTES_NATIVAS[0]
    return { familia: fam.familia, id: fam.id, faltou: nome }
  }

  /** PSD/SVG/PDF/DXF → uma camada do editor por camada do arquivo (na mesma posição relativa); PDF com N páginas → N páginas. */
  async function importarCamadasDoArquivo(f: File): Promise<boolean> {
    if (!c || !workspaceId) return false
    if (f.size > 1024 * 1024 * 1024) throw new Error(`o arquivo tem ${(f.size / 1048576).toFixed(0)} MB — o limite é 1 GB`)
    setOcupado(`Lendo “${f.name}” (${(f.size / 1048576).toFixed(0)} MB)…`)
    const r = await camadasParaEditor(f, (feitas, total) => setOcupado(`Separando as camadas… ${feitas}/${total}`))
    setOcupado('Montando as camadas no editor…')
    if (!r || !r.itens.length) return false
    const paginas = [{ W: r.W, H: r.H, itens: r.itens }, ...(r.paginasExtras || [])]
    const faltaram = new Set<string>()
    for (let n = 0; n < paginas.length; n++) {
      if (n > 0) { await aguardarEnvios(); await novaPagina(false) }
      const falta = await colocarItens(paginas[n], paginas.length > 1)
      falta.forEach(x => faltaram.add(x))
    }
    const avisos = [...r.avisos]
    if (paginas.length > 1) avisos.unshift(`${paginas.length} páginas criadas (uma por página do arquivo).`)
    if (faltaram.size) avisos.push(`Fonte(s) não encontrada(s): ${[...faltaram].join(', ')} — suba o arquivo da fonte (.ttf/.otf) para o texto sair igual ao design.`)
    setAviso(`Camadas de “${f.name}” no editor — cada uma editável separada.${avisos.length ? ' ' + avisos.join(' ') : ''}`)
    return true
  }
  async function colocarItens(r: { W: number; H: number; itens: CamadaEditor[] }, aguardar: boolean): Promise<string[]> {
    if (!c || !workspaceId) return []
    const d = designRef.current!
    const k = Math.min(d.largura / r.W, d.altura / r.H), ox = (d.largura - r.W * k) / 2, oy = (d.altura - r.H * k) / 2
    const itens = r.itens.slice(-120)
    const faltou: string[] = []
    for (const it of itens) {
      const centro = new Point(ox + (it.x + it.w / 2) * k, oy + (it.y + it.h / 2) * k)
      if (it.texto) {
        const fo = await fonteParaTexto(it.texto)
        if (fo.faltou) faltou.push(fo.faltou)
        const t = new Textbox(it.texto.conteudo, { width: Math.max(40, it.w * k * 1.08), fontSize: Math.max(6, it.texto.tamanho * k), fontFamily: fo.familia, fill: it.texto.cor, textAlign: it.texto.alinhamento, fontWeight: it.texto.negrito ? 700 : 400, angle: it.texto.rotacao })
        Object.assign(t, { soaId: novoIdCamada(), soaNome: it.nome, soaTipo: 'texto', soaFonte: fo.id } satisfies Soa)
        t.setPositionByOrigin(centro, 'center', 'center'); t.setCoords(); c.add(t)
        continue
      }
      const blob = it.blob || await new Promise<Blob>((res, rej) => it.pixels!.toBlob(b => (b ? res(b) : rej(new Error('camada'))), 'image/png'))
      const imp = await importarImagem(new File([blob], `${it.nome}.png`, { type: 'image/png' }))
      const img = criarCamadaDeProxy(imp.proxy, imp.urlLocal, null, it.nome, d)
      img.set({ scaleX: (it.w * k) / (img.width || 1), scaleY: (it.h * k) / (img.height || 1), opacity: it.opacidade ?? 1 })
      img.setPositionByOrigin(centro, 'center', 'center'); img.setCoords(); c.add(img)
      enviandoRef.current++; setEnviando(enviandoRef.current)
      const envio = imp.enviar(workspaceId)
        .then(up => { vincularAsset(img, up.id, up.url); versoesRef.current.set(up.id, 1); alterou(); tocar() })
        .catch(e => setErro(`A camada “${it.nome}” entrou, mas não consegui guardá-la (${(e as Error).message}).`))
        .finally(() => { enviandoRef.current--; setEnviando(enviandoRef.current) })
      if (aguardar) await envio   // várias páginas: a página só é guardada com o endereço definitivo da imagem
    }
    c.requestRenderAll(); alterou()
    return faltou
  }
  // ── PONTE com a Edição em massa: o design vira TEMPLATE (textos com {variável} viram campos) ──────────
  /** Troca o conteúdo do texto por um campo, mantendo fonte, cor, contorno e efeitos. */
  function transformarEmCampo(t: Textbox, modelo: string) {
    mudar(t, { text: modelo })
    soa(t).soaNome = modelo === '{nome}' ? 'Campo: nome' : modelo === '{idade}' ? 'Campo: idade' : 'Campo: hashtag'
    tocar()
  }
  /** Texto do editor → campo do template (mesma caixa, giro, fonte e acabamento). */
  function caixaDeTexto(t: Textbox, fontes: { id: string; familia: string; url: string }[]): Caixa {
    const k = t.scaleY || 1, w = (t.width || 10) * (t.scaleX || 1), h = (t.height || 10) * k
    const ctr = t.getCenterPoint()
    const fam = String(t.fontFamily || '').replace(/["']/g, '').split(',')[0].trim()
    const nativa = FONTES_NATIVAS.find(f => f.familia.replace(/["']/g, '') === fam || soa(t).soaFonte === f.id)
    let fonte = nativa?.id || 'fredoka'
    if (!nativa) {
      const f = fontesRef.current.find(x => x.familia === fam)
      if (f?.url) { if (!fontes.some(x => x.id === f.id)) fontes.push({ id: f.id, familia: f.familia, url: f.url }); fonte = `u:${f.id}` }
    }
    const base = soa(t).soaBase as { fill?: unknown } | null | undefined
    const cor = typeof t.fill === 'string' ? t.fill : typeof base?.fill === 'string' ? base.fill : '#1f2937'
    const sh = t.shadow as { color?: string; blur?: number; offsetX?: number; offsetY?: number } | null
    return {
      id: Math.random().toString(36).slice(2, 10), tipo: 'texto', texto: t.text || '',
      x: Math.round(ctr.x - w / 2), y: Math.round(ctr.y - h / 2), w: Math.round(w), h: Math.round(h), rotacao: Math.round(t.angle || 0),
      fonte, tamanho: Math.round((t.fontSize || 40) * k), tamanhoMin: Math.round((t.fontSize || 40) * k * 0.45), cor,
      alinhamento: t.textAlign === 'left' || t.textAlign === 'right' ? t.textAlign : 'center',
      negrito: Number(t.fontWeight) >= 600 || t.fontWeight === 'bold', italico: t.fontStyle === 'italic', maiusculas: false,
      contorno: t.stroke && (t.strokeWidth || 0) > 0 ? { cor: String(t.stroke), largura: Math.max(1, ((t.strokeWidth || 0) * k) / 2) } : null,
      sombra: sh?.color ? { cor: sh.color, blur: (sh.blur || 0) * k, dx: (sh.offsetX || 0) * k, dy: (sh.offsetY || 0) * k } : null,
      curvatura: 0, autoAjuste: true,
    }
  }
  async function salvarComoTemplate() {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d || !workspaceId) return
    if (!storage) { setErro('O armazenamento precisa estar configurado para salvar templates.'); return }
    const temCampo = (o: FabricObject) => o instanceof Textbox && o.visible && /\{[^{}]+\}/.test(o.text || '')
    guardarAtual()
    const temAlgum = paginasRef.current.some((p, i) => i === atualRef.current ? camadas(cv).some(temCampo) : JSON.stringify(p.fabric || {}).match(/\{(nome|idade)[^}]*\}/))
    if (!temAlgum) { setErro('Nenhum texto com campo. Selecione o texto do nome e use “Transformar em campo” (ou escreva {nome} / {idade}).'); return }
    const nome = prompt('Nome do template (use o nome do tema, ex.: Astronauta — assim ele também sai sozinho nos pedidos com esse tema):', d.nome)?.trim()
    if (!nome) return
    setOcupado('Criando o template…'); setErro('')
    const voltar = atualRef.current
    try {
      await aguardarEnvios()
      const fontes: { id: string; familia: string; url: string }[] = []
      const paginas: { moldeAssetId: string; moldeUrl: string; caixas: Caixa[] }[] = []
      let preview = ''
      for (let i = 0; i < paginasRef.current.length; i++) {
        if (paginasRef.current.length > 1) await irParaPagina(i)
        const campos = camadas(cv).filter(temCampo) as Textbox[]
        const caixas = campos.map(t => caixaDeTexto(t, fontes))
        campos.forEach(t => t.set({ visible: false }))
        let fundo: HTMLCanvasElement
        try { fundo = await renderizarEmAlta(cv, zoomRef.current) } finally { campos.forEach(t => t.set({ visible: true })); cv.requestRenderAll() }
        const png = await new Promise<Blob>((res, rej) => fundo.toBlob(b => (b ? res(b) : rej(new Error('molde'))), 'image/png'))
        const up = await enviarArquivo(png, `${nome}${paginasRef.current.length > 1 ? `-p${i + 1}` : ''}.png`, 'molde', workspaceId, { pasta: 'Moldes', meta: { largura: d.largura, altura: d.altura, doEditor: true } })
        paginas.push({ moldeAssetId: up.id, moldeUrl: up.url, caixas })
        if (!i) preview = renderizarDesign(cv, zoomRef.current, 320 / Math.max(d.largura, d.altura)).toDataURL('image/jpeg', 0.75)
      }
      if (paginasRef.current.length > 1) await irParaPagina(voltar)
      const pagina = { larguraPt: d.largura * 0.75, alturaPt: d.altura * 0.75 }
      const config = {
        versao: 1, largura: d.largura, altura: d.altura, caixas: paginas[0].caixas, fontesUsuario: fontes, pagina,
        paginas: paginas.slice(1).map(p => ({ moldeAssetId: p.moldeAssetId, moldeUrl: p.moldeUrl, largura: d.largura, altura: d.altura, pagina, caixas: p.caixas })),
      }
      const r = await fetch('/api/estudio/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, temaNome: nome, moldeAssetId: paginas[0].moldeAssetId, config, preview }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar o template.')
      setTemplateCriado(j.id)
      setAviso(`Template “${nome}” salvo com ${paginas.reduce((n, p) => n + p.caixas.length, 0)} campo(s)${paginas.length > 1 ? ` em ${paginas.length} páginas` : ''}.`)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  /** Resultado de uma ferramenta de IA: camada NOVA acima da original, no mesmo lugar (a original fica). */
  async function adicionarResultadoIA(orig: FabricImage, r: ResultadoIA) {
    if (!c || !workspaceId) return
    const blob = await new Promise<Blob>((res, rej) => r.canvas.toBlob(b => (b ? res(b) : rej(new Error('Não consegui gerar a imagem.'))), 'image/png'))
    const nome = `${soa(orig).soaNome || 'Imagem'} · ${r.nome}`
    const imp = await importarImagem(new File([blob], `${nome}.png`, { type: 'image/png' }))
    const img = criarCamadaDeProxy(imp.proxy, imp.urlLocal, null, nome, designRef.current!)
    const k = r.modo === 'expandido' ? 1 + 2 * (r.margem || 0) : 1
    img.set({ angle: orig.angle, flipX: orig.flipX, flipY: orig.flipY, scaleX: (orig.getScaledWidth() * k) / (img.width || 1), scaleY: (orig.getScaledHeight() * k) / (img.height || 1) })
    img.setPositionByOrigin(orig.getCenterPoint(), 'center', 'center'); img.setCoords()
    c.insertAt(c.getObjects().indexOf(orig) + 1, img)
    c.setActiveObject(img); c.requestRenderAll(); alterou()
    enviandoRef.current++; setEnviando(enviandoRef.current)
    imp.enviar(workspaceId)
      .then(up => { vincularAsset(img, up.id, up.url); versoesRef.current.set(up.id, 1); alterou(); tocar() })
      .catch(e => setErro(`A camada “${r.nome}” entrou, mas não consegui guardá-la (${(e as Error).message}).`))
      .finally(() => { enviandoRef.current--; setEnviando(enviandoRef.current) })
    setAviso(`Camada “${r.nome}” criada acima da original (a original continua lá).`)
  }
  async function abrirBibliotecaImagens() {
    const d = await fetch('/api/estudio/assets').then(r => r.json()).catch(() => ({ assets: [] }))
    setImagensLib((d.assets || []).filter((a: { tipo: string; mime: string | null }) => ['imagem', 'molde', 'gerado', 'mockup'].includes(a.tipo) && (a.mime || '').startsWith('image/')))
  }
  async function addImagemBiblioteca(a: { id: string; nome: string; url: string; meta?: { proxyUrl?: string; versao?: number } }) {
    if (!c) return
    const moldura = molduraSelecionada()
    setImagensLib(null); setOcupado('Abrindo imagem…')
    try {
      const img = await criarCamadaImagem(a.url, a.id, a.nome.replace(/\.[^.]+$/, ''), designRef.current!, a.meta?.proxyUrl)
      versoesRef.current.set(a.id, Number(a.meta?.versao || 1))
      centralizar(img); c.add(img)
      if (moldura) colocarNaMoldura(img, moldura)
      c.setActiveObject(img); c.requestRenderAll()
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

  // ── BIBLIOTECA: elementos, molduras, grades, templates ─────────────────────────
  function molduraSelecionada(): FabricObject | null {
    const a = fabRef.current?.getActiveObject()
    return a && !(a instanceof ActiveSelection) && soa(a).soaMoldura ? a : null
  }
  /** A foto cobre a moldura (sem distorcer) e fica recortada no formato dela. */
  function colocarNaMoldura(img: FabricObject, mol: FabricObject) {
    const cv = fabRef.current
    if (!cv) return
    const r = mol.getBoundingRect(), ib = img.getBoundingRect()
    const k = Math.max(r.width / Math.max(1, ib.width), r.height / Math.max(1, ib.height))
    img.set({ scaleX: img.scaleX * k, scaleY: img.scaleY * k })
    img.setPositionByOrigin(new Point(r.left + r.width / 2, r.top + r.height / 2), 'center', 'center'); img.setCoords()
    soa(img).soaClipDe = soa(mol).soaId!; soa(img).soaFormaMascara = null
    const objs = cv.getObjects()
    if (objs.indexOf(img) < objs.indexOf(mol)) { cv.remove(img); cv.insertAt(cv.getObjects().indexOf(mol) + 1, img) }
    aplicarRecortes(cv).then(() => { cv.requestRenderAll(); alterou() })
  }
  async function addElemento(e: Elemento) {
    const d = designRef.current!
    const o = await criarElemento(e, Math.min(d.largura, d.altura) * 0.3)
    centralizar(o); c?.add(o); c?.setActiveObject(o); c?.requestRenderAll(); setBiblio(null)
  }
  function addMoldura(f: FormaMoldura) {
    const d = designRef.current!, L = Math.min(d.largura, d.altura) * 0.45
    const o = criarMoldura(f, L, f === 'arco' ? L * 1.25 : L)
    centralizar(o); c?.add(o); c?.setActiveObject(o); c?.requestRenderAll(); setBiblio(null)
    setAviso('Moldura colocada: com ela selecionada, importe ou escolha uma foto — a foto entra recortada.')
  }
  function addGrade(g: Grade) {
    if (!c) return
    const d = designRef.current!, m = Math.min(d.largura, d.altura) * 0.04
    const objs = criarGrade(g, { x: m, y: m, w: d.largura - 2 * m, h: d.altura - 2 * m }, Math.min(d.largura, d.altura) * 0.02)
    objs.forEach(o => c.add(o)); c.setActiveObject(objs[0]); c.requestRenderAll(); setBiblio(null)
    setAviso('Grade criada: selecione cada moldura e importe/escolha a foto dela.')
  }
  /** Template no design atual: encaixa os objetos no tamanho do design (e usa o fundo se estiver vazio). */
  async function inserirModelo(m: Modelo) {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d) return
    setBiblio(null); setOcupado('Aplicando o template…')
    try {
      const k = Math.min(d.largura / m.largura, d.altura / m.altura)
      const vazio = !camadas(cv).length
      if (vazio && m.fundo) cv.backgroundColor = m.fundo
      for (const o of await m.montar()) {
        const ctr = o.getCenterPoint()
        o.set({ scaleX: (o.scaleX || 1) * k, scaleY: (o.scaleY || 1) * k })
        o.setPositionByOrigin(new Point((ctr.x - m.largura / 2) * k + d.largura / 2, (ctr.y - m.altura / 2) * k + d.altura / 2), 'center', 'center')
        o.setCoords(); cv.add(o)
      }
      await aplicarRecortes(cv); cv.requestRenderAll(); alterou()
    } finally { setOcupado('') }
  }
  async function abrirMeuTemplate(id: string, nome: string) {
    setBiblio(null)
    if (!confirm(`Criar um design novo a partir de “${nome}”?`)) return
    await salvar()
    const r = await fetch('/api/estudio/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duplicarDe: id, nome }) }).then(x => x.json())
    if (r.id) router.push(`/estudio/editor/${r.id}`); else setErro(r.error || 'Não consegui abrir o template.')
  }
  async function abrirTemplateMassa(id: string) {
    setBiblio(null); setOcupado('Convertendo o template…')
    try {
      const t = await jsonDeTemplateMassa(id)
      await salvar()
      const r = await fetch('/api/estudio/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: t.nome, largura: t.largura, altura: t.altura, json: t.json }) }).then(x => x.json())
      if (!r.id) throw new Error(r.error || 'Não consegui criar o design')
      await fetch(`/api/estudio/designs/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetIds: t.assetIds }) })
      router.push(`/estudio/editor/${r.id}`)
    } catch (e) { setErro((e as Error).message); setOcupado('') }
  }
  async function alternarModelo() {
    const v = !ehModelo
    setEhModelo(v)
    await fetch(`/api/estudio/designs/${designId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ehModelo: v }) })
    setAviso(v ? 'Salvo como template: aparece em “Templates → Meus templates”.' : 'Não é mais template.')
  }

  // ── FONTES: importar no editor (privada do ateliê) ─────────────────────────────
  async function importarFonte(f: File) {
    if (!workspaceId) return
    if (!/\.(ttf|otf)$/i.test(f.name)) { setErro('Use arquivo .ttf ou .otf.'); return }
    if (f.size > 10 * 1024 * 1024) { setErro('Fonte acima de 10 MB — confira o arquivo.'); return }
    if (!confirm('Use apenas fontes que você tem licença para usar.\n\nA fonte fica só no seu ateliê — não é compartilhada com ninguém.')) return
    setOcupado('Importando a fonte…')
    try {
      const familia = `SOA_${Math.random().toString(36).slice(2, 8)}`
      const ff = new FontFace(familia, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff)
      if (!storage) throw new Error('O armazenamento precisa estar configurado para guardar a fonte.')
      const up = await enviarArquivo(f, f.name, 'fonte', workspaceId, { pasta: 'Fontes', meta: { familia } })
      const nova = { id: up.id, nome: f.name, url: up.url, familia, acervo: false }
      setBiblioteca(b => [nova, ...b])
      fontesRef.current = [...fontesRef.current, { id: up.id, familia, url: up.url }]
      const t = fabRef.current?.getActiveObject()
      if (t instanceof Textbox) { (t as FabricObject & Soa).soaFonte = `u:${up.id}`; mudar(t, { fontFamily: familia }) }
      setAviso(`Fonte “${f.name.replace(/\.(ttf|otf)$/i, '')}” importada — só o seu ateliê vê.`)
    } catch (e) { setErro((e as Error).message || 'Não consegui ler essa fonte.') } finally { setOcupado('') }
  }
  // ── TEXTO: maiúsculas, estilos salvos ─────────────────────────────────────────
  function caixaTexto(t: Textbox, modo: 'maiusculas' | 'minusculas' | 'titulo') {
    const x = t.text || ''
    const novo = modo === 'maiusculas' ? x.toLocaleUpperCase('pt-BR') : modo === 'minusculas' ? x.toLocaleLowerCase('pt-BR')
      : x.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('pt-BR'))
    mudar(t, { text: novo })
  }
  function estiloDoTexto(t: Textbox) {
    const s = soa(t)
    const fill = s.soaBase ? s.soaBase.fill : t.fill
    return { fontFamily: t.fontFamily, soaFonte: s.soaFonte, fontSize: t.fontSize, fontWeight: t.fontWeight, fontStyle: t.fontStyle, charSpacing: t.charSpacing, lineHeight: t.lineHeight, textAlign: t.textAlign, fill: typeof fill === 'string' ? fill : (fill as { toObject?: () => unknown })?.toObject?.() ?? '#1f2937', efeitos: s.soaEfeitos || null }
  }
  async function salvarEstiloTexto(t: Textbox) {
    const nome = prompt('Nome do estilo de texto:', 'Título da marca')
    if (!nome?.trim()) return
    const r = await fetch('/api/estudio/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, tipo: 'estilo-texto', operacoes: [estiloDoTexto(t)] }) }).then(x => x.json())
    if (r.id) setEstilosTexto(e => [...e, { id: r.id, nome, operacoes: [estiloDoTexto(t)] }])
  }
  async function aplicarEstiloTexto(t: Textbox, est: Record<string, unknown>) {
    const { soaFonte, efeitos, fill, ...props } = est as Record<string, unknown> & { soaFonte?: string; efeitos?: Efeitos | null; fill?: unknown }
    const fonteU = typeof soaFonte === 'string' && soaFonte.startsWith('u:') ? biblioteca.find(b => b.id === soaFonte.slice(2)) : null
    if (fonteU) { try { const ff = new FontFace(fonteU.familia, `url(${fonteU.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue */ } if (!fontesRef.current.some(x => x.id === fonteU.id)) fontesRef.current = [...fontesRef.current, { id: fonteU.id, familia: fonteU.familia, url: fonteU.url }] }
    soa(t).soaBase = null
    t.set({ ...props, fill: fill && typeof fill === 'object' ? new Gradient(fill as ConstructorParameters<typeof Gradient>[0]) : fill })
    ;(t as FabricObject & Soa).soaFonte = soaFonte || null
    t.initDimensions()
    await aplicarEfeitos(t, efeitos ? structuredClone(efeitos) : null)
    c?.requestRenderAll(); alterou(); tocar()
  }

  // ── RASTERIZAR / MESCLAR ──────────────────────────────────────────────────────
  // (reusa o fluxo do objeto inteligente, sem design-fonte)
  function rasterizar() { converterEmObjetoInteligente(false) }

  // ── CAMADA DE AJUSTE ──────────────────────────────────────────────────────────
  function addCamadaAjuste() {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d) return
    const a = novaCamadaAjuste(d, { ...AJUSTES_NEUTROS, contraste: 10, saturacao: 10 })
    const sel = cv.getActiveObject()
    const idx = sel && !(sel instanceof ActiveSelection) ? cv.getObjects().indexOf(sel) + 1 : cv.getObjects().length
    cv.insertAt(idx, a)
    cv.setActiveObject(a); setAtivos([a]); cv.requestRenderAll(); alterou()
    setAviso('Camada de ajuste: ajusta tudo o que está ABAIXO dela. Use o olho para comparar antes/depois.')
  }
  function mudarAjusteCamada(a: CamadaAjuste, patch: Partial<Ajustes>) {
    const x = a.soaAjustes || AJUSTES_NEUTROS
    a.soaAjustes = { ...x, ...patch, curvas: { ...x.curvas, ...(patch.curvas || {}) } }
    fabRef.current?.requestRenderAll(); alterou()
  }

  // ── CORTE / GIRAR / ESPELHAR ──────────────────────────────────────────────────
  function mudarCorte(img: FabricImage, corte: Soa['soaCorte']) {
    soa(img).soaCorte = corte && corte.w > 0.999 && corte.h > 0.999 && corte.x < 0.001 && corte.y < 0.001 ? null : corte
    agendarProcessamento(img); alterou(); tocar()
  }
  function cortarProporcao(img: FabricImage, r: number | null) {
    if (!r) { mudarCorte(img, null); return }
    const { w, h } = dimMascara(img), A = w / h
    const cw = A > r ? r / A : 1, ch = A > r ? 1 : A / r
    mudarCorte(img, { x: (1 - cw) / 2, y: (1 - ch) / 2, w: cw, h: ch })
  }
  function girar90(o: FabricObject) { o.rotate(((o.angle || 0) + 90) % 360); o.setCoords(); c?.requestRenderAll(); alterou(); tocar() }

  // ── SELEÇÃO (retângulo / laço / varinha) ──────────────────────────────────────
  function entrarSelecao(img: FabricImage) {
    if (!c) return
    if (soa(img).soaDistorcao) { setAviso('Use a seleção antes de distorcer (ou zere a distorção).'); return }
    c.discardActiveObject()
    eventedRef.current = new Map(camadas(c).map(o => [o, o.evented]))
    camadas(c).forEach(o => { o.evented = false })
    c.selection = false; c.defaultCursor = 'crosshair'
    alvoRef.current = img; selecaoRef.current = null; setTemSelecao(false)
    modoRef.current = 'selecao'; setModo('selecao')
    c.requestRenderAll()
  }
  function mostrarSelecao() {
    const cv = fabRef.current, img = alvoRef.current
    if (!cv || !img) return
    if (selOverlayRef.current) { cv.remove(selOverlayRef.current); selOverlayRef.current = null }
    if (selecaoRef.current) { const o = sobreposicaoSelecao(img, selecaoRef.current); selOverlayRef.current = o; cv.add(o) }
    setTemSelecao(!!selecaoRef.current)
    cv.requestRenderAll()
  }
  function usarSelecao(nova: HTMLCanvasElement) {
    selecaoRef.current = combinarSelecao(selecaoRef.current, nova, selModoRef.current)
    mostrarSelecao()
  }
  function selBaixo(p: Point) {
    const img = alvoRef.current, cv = fabRef.current
    if (!img || !cv) return
    if (selToolRef.current === 'varinha') {
      const { w, h } = dimMascara(img), { u, v } = cenaParaOriginal(img, p.x, p.y)
      usarSelecao(varinhaMagica(conteudoParaSelecao(img), w, h, { u, v }, toleranciaRef.current))
      return
    }
    selArrastoRef.current = { pts: [new Point(p.x, p.y)], ajuda: null }
  }
  function selDesenharAjuda(pts: Point[]) {
    const cv = fabRef.current, a = selArrastoRef.current
    if (!cv || !a) return
    if (a.ajuda) cv.remove(a.ajuda)
    const z = zoomRef.current
    const aj = new Polyline(pts.map(q => ({ x: q.x, y: q.y })), { fill: 'rgba(249,115,22,0.10)', stroke: '#f97316', strokeWidth: 1.5 / z, strokeDashArray: [5 / z, 4 / z], selectable: false, evented: false, excludeFromExport: true, objectCaching: false })
    Object.assign(aj, { soaAjudante: true })
    a.ajuda = aj; cv.add(aj); cv.requestRenderAll()
  }
  function selPontos(): Point[] {
    const a = selArrastoRef.current
    if (!a) return []
    if (selToolRef.current === 'retangulo' && a.pts.length >= 2) {
      const [p0, p1] = [a.pts[0], a.pts[a.pts.length - 1]]
      return [p0, new Point(p1.x, p0.y), p1, new Point(p0.x, p1.y)]
    }
    return a.pts
  }
  function selMover(p: Point) {
    const a = selArrastoRef.current
    if (!a) return
    if (selToolRef.current === 'retangulo') a.pts = [a.pts[0], new Point(p.x, p.y)]
    else { const u = a.pts[a.pts.length - 1]; if (Math.hypot(u.x - p.x, u.y - p.y) > 3 / zoomRef.current) a.pts.push(new Point(p.x, p.y)) }
    selDesenharAjuda(selPontos())
  }
  function selSoltar() {
    const a = selArrastoRef.current, img = alvoRef.current, cv = fabRef.current
    if (!a || !img || !cv) return
    const pts = selPontos()
    if (a.ajuda) cv.remove(a.ajuda)
    selArrastoRef.current = null
    if (pts.length < 3) { cv.requestRenderAll(); return }
    const { w, h } = dimMascara(img)
    usarSelecao(selecaoPoligono(w, h, pts.map(q => cenaParaOriginal(img, q.x, q.y))))
  }
  async function acaoSelecao(acao: 'esconder' | 'manter' | 'camada' | 'inverter' | 'limpar') {
    const img = alvoRef.current, sel = selecaoRef.current, cv = fabRef.current
    if (!img || !cv) return
    if (acao === 'limpar') { selecaoRef.current = null; mostrarSelecao(); return }
    if (!sel) return
    if (acao === 'inverter') { selecaoRef.current = inverterAlfa(sel); mostrarSelecao(); return }
    if (acao === 'camada') {
      const nova = await camadaDaSelecao(img, sel)
      if (nova) { cv.insertAt(cv.getObjects().indexOf(img) + 1, nova); setAviso('Nova camada com a seleção criada (acima da original).') }
    } else {
      await aplicarSelecaoNaMascara(img, sel, acao)
      await processarCamada(img)
    }
    await aplicarRecortes(cv)
    selecaoRef.current = null; mostrarSelecao(); alterou()
  }
  function sairSelecao() {
    const cv = fabRef.current
    if (!cv) return
    if (selOverlayRef.current) { cv.remove(selOverlayRef.current); selOverlayRef.current = null }
    if (selArrastoRef.current?.ajuda) cv.remove(selArrastoRef.current.ajuda)
    selArrastoRef.current = null; selecaoRef.current = null; setTemSelecao(false)
    eventedRef.current.forEach((ev, o) => { o.evented = ev })
    cv.selection = true; cv.defaultCursor = 'default'
    const img = alvoRef.current
    alvoRef.current = null
    modoRef.current = 'normal'; setModo('normal')
    if (img) cv.setActiveObject(img)
    cv.requestRenderAll()
  }

  // ── REDIMENSIONAR O DESIGN (magic resize) ─────────────────────────────────────
  const redimensionarRef = useRef<(W: number, H: number) => void>(() => {})
  function redimensionarDesign(W2: number, H2: number) {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d) return
    const k = Math.min(W2 / d.largura, H2 / d.altura)
    cv.discardActiveObject()
    for (const o of camadas(cv)) {
      if (o instanceof CamadaAjuste) { o.set({ left: 0, top: 0, width: W2, height: H2 }); continue }
      const ctr = o.getCenterPoint()
      o.set({ scaleX: (o.scaleX || 1) * k, scaleY: (o.scaleY || 1) * k })
      o.setPositionByOrigin(new Point((ctr.x - d.largura / 2) * k + W2 / 2, (ctr.y - d.altura / 2) * k + H2 / 2), 'center', 'center')
      o.setCoords()
      if (o instanceof FabricImage && !semEfeitos(soa(o).soaEfeitos)) agendarProcessamento(o)
    }
    const nd = { ...d, largura: W2, altura: H2 }
    designRef.current = nd; setDesign(nd)
    ajustarATela()
    aplicarRecortes(cv).then(() => cv.requestRenderAll())
    fetch(`/api/estudio/designs/${designId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ largura: W2, altura: H2 }) }).catch(() => {})
    alterou()
    setAviso(`Design redimensionado para ${W2}×${H2} — os elementos foram reposicionados proporcionalmente; confira os detalhes.`)
  }
  redimensionarRef.current = redimensionarDesign
  async function copiaRedimensionada(W2: number, H2: number) {
    await salvar()
    const r = await fetch('/api/estudio/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duplicarDe: designId, nome: `${designRef.current?.nome || 'Design'} ${W2}×${H2}` }) }).then(x => x.json())
    if (r.id) router.push(`/estudio/editor/${r.id}?redim=${W2}x${H2}`); else setErro(r.error || 'Não consegui criar a cópia.')
  }

  // ── KIT DA MARCA ──────────────────────────────────────────────────────────────
  function aplicarCorMarca(cor: string) {
    const cv = fabRef.current
    if (!cv) return
    const sel = cv.getActiveObjects().filter(o => !soa(o).soaAjudante)
    if (!sel.length) { cv.backgroundColor = cor; cv.requestRenderAll(); alterou(); return }
    for (const o of sel) {
      if (o instanceof Line) o.set({ stroke: cor })
      else if (o instanceof Group) o.getObjects().forEach(x => { if (x.fill && x.fill !== 'none') x.set({ fill: cor }) })
      else if (!(o instanceof FabricImage) && !(o instanceof CamadaAjuste)) { if (soa(o).soaBase) soa(o).soaBase = { ...soa(o).soaBase!, fill: cor }; else o.set({ fill: cor }); if (soa(o).soaBase) aplicarEfeitos(o, soa(o).soaEfeitos || null) }
      o.dirty = true
    }
    cv.requestRenderAll(); alterou(); tocar()
  }
  async function enviarLogo(f: File) {
    if (!workspaceId || !storage) { setErro('O armazenamento precisa estar configurado.'); return null }
    const imp = await importarImagem(f)
    const up = await imp.enviar(workspaceId, { pasta: 'Logos' })
    return { id: up.id, nome: f.name, url: up.url, meta: { proxyUrl: up.proxyUrl } }
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
  async function subirConteudo(full: HTMLCanvasElement, nome: string, passo?: <T>(etapa: string, p: Promise<T>, ms?: number, ac?: AbortController) => Promise<T>) {
    const p = passo || (<T,>(_e: string, x: Promise<T>) => x)
    const { proxy } = await p('preparando a miniatura', criarProxy(full))
    const [png, pr] = await p('comprimindo a imagem', Promise.all([blobDe(full, 'image/png'), blobDe(proxy, 'image/webp', 0.86)]))
    // upload: prazo proporcional ao tamanho (mín. 45 s) e cancelável
    const ac = new AbortController()
    const [url, proxyUrl] = await p('enviando a imagem', Promise.all([enviarSoBlob(png, `${nome}.png`, 'imagem', workspaceId!, ac.signal), enviarSoBlob(pr, `proxy-${nome}.webp`, 'imagem', workspaceId!, ac.signal)]), Math.max(45_000, png.size / 50), ac)
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
  /**
   * Converte a seleção (formas, imagens, grupo, texto junto com outras camadas) num objeto inteligente com fonte
   * editável — ou só rasteriza/mescla (`comFonte=false`). Cada etapa tem PRAZO e é medida (console “[objeto-inteligente]”):
   * se algo não responder, o spinner desliga com a etapa que travou e o canvas fica como estava.
   */
  async function converterEmObjetoInteligente(comFonte = true) {
    const cv = fabRef.current, d = designRef.current
    if (!cv || !d || !workspaceId || !storage) { setErro('O armazenamento precisa estar configurado.'); return }
    const sel = cv.getActiveObjects().filter(o => !soa(o).soaAjudante && !soa(o).soaArea && !(o instanceof CamadaAjuste))
    if (!sel.length) return
    if (comFonte && sel.every(o => o instanceof Textbox)) {
      setAviso('Texto não vira objeto inteligente: use “Transformar em campo” ({nome}, {idade}…) para personalizar, ou “Rasterizar” se quiser que vire imagem.')
      return
    }
    if (enviandoRef.current) { setAviso('Espere as imagens terminarem de subir.'); return }
    const titulo = comFonte ? 'Criando o objeto inteligente' : sel.length > 1 ? 'Mesclando as camadas' : 'Rasterizando'
    const total = comFonte ? 8 : 6
    let n = 0
    const t0 = performance.now()
    const passo = <T,>(etapa: string, p: Promise<T>, ms = 20_000, ac?: AbortController): Promise<T> => {
      n++; setOcupado(`${titulo}… ${etapa} (${Math.min(n, total)}/${total})`)
      const t = performance.now()
      return comPrazo(p, ms, etapa, ac).finally(() => console.debug(`[objeto-inteligente] ${etapa}: ${Math.round(performance.now() - t)} ms`))
    }
    setOcupado(`${titulo}…`); setErro('')
    const ordemAtual = cv.getObjects()
    sel.sort((a, b) => ordemAtual.indexOf(a) - ordemAtual.indexOf(b))
    let tmp: StaticCanvas | null = null
    try {
      const rs = sel.map(o => o.getBoundingRect())
      const r = { left: Math.floor(Math.min(...rs.map(x => x.left))), top: Math.floor(Math.min(...rs.map(x => x.top))) }
      const W = Math.max(1, Math.ceil(Math.max(...rs.map(x => x.left + x.width)) - r.left)), H = Math.max(1, Math.ceil(Math.max(...rs.map(x => x.top + x.height)) - r.top))
      const tela = new StaticCanvas(document.createElement('canvas'), { width: W, height: H, enableRetinaScaling: false })
      tmp = tela
      await passo('copiando as camadas', (async () => {
        for (const o of sel) {
          const cp = await duplicarCamada(o)
          Object.assign(cp, { soaId: soa(o).soaId, soaNome: soa(o).soaNome, soaClipDe: null })
          cp.set({ left: (cp.left || 0) - r.left, top: (cp.top || 0) - r.top }); cp.setCoords()
          tela.add(cp)
        }
        await aplicarRecortes(tela)
      })())
      const nome = sel.length === 1 ? soa(sel[0]).soaNome || 'Objeto' : comFonte ? 'Objeto inteligente' : 'Camadas mescladas'
      // 1) design-FONTE (editável) — só no objeto inteligente; rasterizar/mesclar não guarda as camadas
      const { json, assetIds } = serializar(tela, fontesRef.current)
      const nd = comFonte
        ? await passo('guardando as camadas originais', jsonComPrazo('/api/estudio/designs', { method: 'POST', headers: JSON_H, body: JSON.stringify({ nome: `Fonte — ${nome}`, largura: Math.max(50, W), altura: Math.max(50, H), json }) }, 20_000, 'guardar as camadas originais'), 25_000)
        : { id: null as string | null, error: undefined as string | undefined }
      if (comFonte && !nd.id) throw new Error(nd.error || 'Não consegui criar a fonte')
      // 2) conteúdo renderizado em alta (2× para ficar nítido ao ampliar)
      const escala = Math.min(2, 4000 / Math.max(W, H))
      const full = await passo('desenhando em alta', renderizarEmAlta(tela, 1, escala), 30_000)
      const up = await subirConteudo(full, nome.replace(/[^\w-]+/g, '_'), passo)
      const asset = await passo('registrando o objeto', jsonComPrazo('/api/estudio/assets', { method: 'POST', headers: JSON_H, body: JSON.stringify({ tipo: 'imagem', nome, url: up.url, mime: 'image/png', tamanhoBytes: up.bytes, pasta: comFonte ? 'Objetos inteligentes' : 'Rasterizadas', meta: { largura: full.width, altura: full.height, proxyUrl: up.proxyUrl, ...(comFonte ? { fonteDesignId: nd.id } : {}) } }) }, 20_000, 'registrar o objeto'), 25_000)
      if (!asset.id) throw new Error(asset.error || 'Não consegui guardar o objeto')
      if (comFonte) await passo('ligando a fonte ao objeto', jsonComPrazo(`/api/estudio/designs/${nd.id}`, { method: 'PUT', headers: JSON_H, body: JSON.stringify({ assetIds, fonteAssetId: asset.id }) }, 20_000, 'ligar a fonte ao objeto'), 25_000)
      // 3) troca a seleção pela instância do objeto inteligente, no mesmo lugar e tamanho (instantâneo, sem rede)
      const img = criarCamadaDeProxy(up.proxy, up.url, asset.id, nome, d)
      vincularAsset(img, asset.id, up.url)
      const k = W / up.proxy.width
      img.set({ scaleX: k, scaleY: k })
      img.setPositionByOrigin(new Point(r.left + W / 2, r.top + H / 2), 'center', 'center'); img.setCoords()
      cv.discardActiveObject()
      const idx = cv.getObjects().indexOf(sel[0])
      cv.remove(...sel)
      cv.insertAt(Math.max(0, idx), img)
      versoesRef.current.set(asset.id, 1)
      cv.setActiveObject(img); cv.requestRenderAll(); alterou()
      console.debug(`[objeto-inteligente] total: ${Math.round(performance.now() - t0)} ms`)
      setAviso(comFonte ? 'Pronto: virou objeto inteligente. “Editar fonte” abre as camadas originais; “Nova instância” cria cópias que mudam juntas.'
        : sel.length > 1 ? 'Camadas mescladas numa só imagem (Ctrl+Z desfaz).' : 'Camada rasterizada: agora é imagem (Ctrl+Z desfaz).')
    } catch (e) {
      console.debug('[objeto-inteligente] falhou:', (e as Error).message)
      setErro(`Não consegui ${comFonte ? 'criar o objeto inteligente' : sel.length > 1 ? 'mesclar as camadas' : 'rasterizar'}: ${(e as Error).message}`)
    } finally {
      void tmp?.dispose()
      setOcupado('')
    }
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
  const statusTxt = enviando ? `Enviando ${enviando} imagem(ns)…` : {
    carregando: 'Abrindo…', salvo: salvoEm ? `Salvo às ${salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Salvo',
    pendente: 'Alterações não salvas…', salvando: 'Salvando…', erro: 'Erro ao salvar — tentando de novo', offline: 'Sem conexão — salvo neste aparelho',
  }[status]
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
        <span className={`text-xs inline-flex items-center gap-1 ${status === 'erro' ? 'text-red-600' : status === 'offline' ? 'text-amber-600' : status === 'salvo' && !enviando ? 'text-emerald-600' : 'text-gray-400'}`} data-status={status}>
          {!!enviando && <CloudUpload className="w-3.5 h-3.5 animate-pulse" />}{statusTxt}
        </span>
        <button onClick={abrirHistorico} disabled={!design} className="text-xs inline-flex items-center gap-1 text-gray-500 hover:text-orange-600 disabled:opacity-40" title="Histórico de versões (salvas sozinhas)">
          <History className="w-3.5 h-3.5" /> Versões
        </button>
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
          <button onClick={alternarModelo} disabled={!design} className={btnIc + (ehModelo ? ' !border-orange-400 text-orange-600' : '')} title={ehModelo ? 'É template (clique para deixar de ser)' : 'Salvar como template'}><BookmarkPlus className="w-4 h-4" /></button>
          <button onClick={() => setRedim(true)} disabled={!design || modo !== 'normal'} className={btnIc} title="Redimensionar o design"><Scaling className="w-4 h-4" /></button>
          <button onClick={() => setReplicar(true)} disabled={!design || modo !== 'normal'} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 text-orange-700 dark:text-orange-300 px-3 py-1.5 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-40">
            <Layers3 className="w-4 h-4" /> Replicar em moldes
          </button>
          <button onClick={salvarComoTemplate} disabled={!design || modo !== 'normal'} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 text-orange-700 dark:text-orange-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40" title="Textos com {nome}/{idade} viram campos da Edição em massa">
            <BookmarkPlus className="w-4 h-4" /> Salvar como template
          </button>
          {templateCriado && <a href={`/estudio/artes?template=${templateCriado}`} className="text-sm font-semibold text-orange-600 hover:underline">Usar na Edição em massa →</a>}
          <button onClick={() => setExportar(true)} disabled={!design || modo !== 'normal'} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {recuperar && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-100" role="alert">
          <History className="w-4 h-4 shrink-0" />
          <span className="flex-1">Recuperamos alterações <b>não salvas</b> deste design, feitas neste aparelho em {new Date(recuperar.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Quer restaurar?</span>
          <button onClick={restaurarRascunho} className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 font-semibold">Restaurar</button>
          <button onClick={() => { setRecuperar(null); if (chaveRef.current) void apagarRascunho(chaveRef.current) }} className="rounded-lg border border-amber-300 dark:border-amber-800 px-2.5 py-1">Descartar</button>
        </div>
      )}
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
            <input type="file" accept="image/*,.pdf,.psd,.psb,.svg,.ai,.dxf,.eps,.cdr,.studio,.studio3" multiple className="hidden" onChange={e => { if (e.target.files?.length) importarArquivos(e.target.files); e.target.value = '' }} />
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
          <button onClick={() => setBiblio('elementos')} disabled={modo !== 'normal'} className={btnIc} title="Elementos, molduras e grades de fotos"><Shapes className="w-5 h-5" /></button>
          <button onClick={() => setBiblio('templates')} disabled={modo !== 'normal'} className={btnIc} title="Templates"><LayoutTemplate className="w-5 h-5" /></button>
          <button onClick={addCamadaAjuste} disabled={modo !== 'normal'} className={btnIc} title="Camada de ajuste (afeta as de baixo)"><SlidersHorizontal className="w-5 h-5" /></button>
          <button onClick={() => setMostrarMarca(v => !v)} className={btnIc + (mostrarMarca ? ' !border-orange-400 text-orange-600' : '')} title="Kit da marca"><Palette className="w-5 h-5" /></button>
          <button onClick={() => setIa(true)} className={btnIc + ' text-violet-600'} title="Ferramentas de IA (em breve)"><Bot className="w-5 h-5" /></button>
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
          {modo === 'selecao' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-gray-900 text-white text-xs px-3 py-2 shadow-lg max-w-[95%]">
              {([['retangulo', SquareDashedMousePointer, 'Retângulo'], ['laco', Lasso, 'Laço'], ['varinha', WandSparkles, 'Varinha']] as const).map(([k, I, t]) => (
                <button key={k} onClick={() => setSelTool(k)} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${selTool === k ? 'bg-orange-500 font-semibold' : 'border border-white/30'}`}><I className="w-3.5 h-3.5" /> {t}</button>
              ))}
              {selTool === 'varinha' && <label className="inline-flex items-center gap-1">tolerância <input type="range" min={2} max={80} value={tolerancia} onChange={e => setTolerancia(Number(e.target.value))} className="w-16 accent-orange-500" /></label>}
              <select value={selModo} onChange={e => setSelModo(e.target.value as 'nova')} className="bg-gray-800 rounded px-1 py-0.5">
                <option value="nova">nova</option><option value="somar">somar</option><option value="subtrair">subtrair</option>
              </select>
              <span className="w-px h-4 bg-white/30" />
              <button disabled={!temSelecao} onClick={() => acaoSelecao('esconder')} className="rounded-lg border border-white/30 px-2 py-1 disabled:opacity-30">Apagar seleção</button>
              <button disabled={!temSelecao} onClick={() => acaoSelecao('manter')} className="rounded-lg border border-white/30 px-2 py-1 disabled:opacity-30">Manter só ela</button>
              <button disabled={!temSelecao} onClick={() => acaoSelecao('camada')} className="rounded-lg border border-white/30 px-2 py-1 disabled:opacity-30">Nova camada</button>
              <button disabled={!temSelecao} onClick={() => acaoSelecao('inverter')} className="rounded-lg border border-white/30 px-2 py-1 disabled:opacity-30">Inverter</button>
              <button onClick={sairSelecao} className="inline-flex items-center gap-1 rounded-lg bg-white text-gray-900 px-2 py-1 font-semibold"><Check className="w-3.5 h-3.5" /> Pronto</button>
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
          {mostrarMarca && (
            <div className="rounded-2xl border border-orange-200 dark:border-orange-900 bg-white dark:bg-gray-900 p-3">
              <PainelMarca
                corAtual={um && typeof (soa(um).soaBase ? soa(um).soaBase!.fill : um.fill) === 'string' ? String(soa(um).soaBase ? soa(um).soaBase!.fill : um.fill) : null}
                fonteAtual={um instanceof Textbox ? soa(um).soaFonte || null : null}
                fontesDisponiveis={biblioteca.map(b => ({ id: `u:${b.id}`, nome: b.nome.replace(/\.(ttf|otf)$/i, '') }))}
                onCor={aplicarCorMarca}
                onFonte={id => { const t = fabRef.current?.getActiveObject(); if (t instanceof Textbox) mudarFonte(t, id.startsWith('u:') ? `b:${id.slice(2)}` : id); else setAviso('Selecione um texto para aplicar a fonte.') }}
                onLogo={l => addImagemBiblioteca(l)}
                onEnviarLogo={enviarLogo}
              />
            </div>
          )}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-3">
            {!ativos.length && (
              <div className="text-xs text-gray-400 space-y-1">
                <p>Selecione uma camada para editar. Shift+clique na lista seleciona várias.</p>
                <p className="text-[10px]">Atalhos: setas movem (Shift = 10px) · Ctrl+D duplica · Ctrl+G agrupa · Ctrl+C/V copia/cola · Ctrl+Alt+C/V copia/cola estilo · Del apaga · Ctrl+Z/Y · Ctrl+roda = zoom</p>
              </div>
            )}
            {!!ativos.length && modo === 'normal' && !(um instanceof CamadaAjuste) && (
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
                {ativos.length > 0 && ativos.every(o => o instanceof Textbox) && (
                  <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-2 space-y-1.5">
                    <p className="text-[11px] text-orange-800 dark:text-orange-200">Para personalizar este texto em massa, <b>transforme em campo</b> (texto não vira objeto inteligente):</p>
                    <div className="flex flex-wrap gap-1">
                      {([['{nome}', 'Nome'], ['{idade}', 'Idade'], ['#{nome|minusculas|semespaco|semacento}faz{idade}', 'Hashtag']] as const).map(([m, r]) => (
                        <button key={r} onClick={() => ativos.forEach(o => transformarEmCampo(o as Textbox, m))} className="rounded-md bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 text-[11px] font-semibold">{r}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(!img || !s?.soaAssetId) && !ativos.every(o => o instanceof Textbox) && !ativos.some(o => soa(o).soaArea || (o instanceof FabricImage && !soa(o).soaAssetId)) && (
                  <button onClick={() => converterEmObjetoInteligente(true)} disabled={!!ocupado} className="w-full inline-flex items-center justify-center gap-1.5 text-xs rounded-lg border border-sky-300 text-sky-800 dark:text-sky-200 py-1.5 hover:bg-sky-50 dark:hover:bg-sky-950/30">
                    <Link2 className="w-3.5 h-3.5" /> Converter em objeto inteligente
                  </button>
                )}
                {!ativos.some(o => soa(o).soaArea || o instanceof CamadaAjuste || (o instanceof FabricImage && !soa(o).soaAssetId)) && (ativos.length > 1 || !(um instanceof FabricImage)) && (
                  <button onClick={rasterizar} disabled={!!ocupado} className="w-full inline-flex items-center justify-center gap-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 hover:border-orange-400">
                    <Combine className="w-3.5 h-3.5" /> {ativos.length > 1 ? 'Mesclar camadas numa imagem' : 'Rasterizar (virar imagem)'}
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

                {um instanceof CamadaAjuste && (
                  <div className={secao}>
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">Camada de ajuste <span className="font-normal text-gray-400">— afeta tudo o que está abaixo</span></p>
                    <button onPointerDown={() => { um.visible = false; c?.requestRenderAll() }} onPointerUp={() => { um.visible = true; c?.requestRenderAll() }} onPointerLeave={() => { um.visible = true; c?.requestRenderAll() }}
                      className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 hover:border-orange-400">Segure para ver o antes</button>
                    <PainelAjustes a={um.soaAjustes || AJUSTES_NEUTROS} onMudar={p => mudarAjusteCamada(um, p)} onZerar={() => { um.soaAjustes = { ...AJUSTES_NEUTROS }; c?.requestRenderAll(); alterou(); tocar() }} />
                    <div>
                      <p className={lbl}>Máscara da camada de ajuste</p>
                      <select className={inp} value={um.soaAjusteMascara?.forma || ''} onChange={e => { const f = e.target.value as 'retangulo' | 'elipse' | ''; um.soaAjusteMascara = f ? { forma: f, x: um.soaAjusteMascara?.x ?? 0.2, y: um.soaAjusteMascara?.y ?? 0.2, w: um.soaAjusteMascara?.w ?? 0.6, h: um.soaAjusteMascara?.h ?? 0.6, invertida: um.soaAjusteMascara?.invertida ?? false, suave: um.soaAjusteMascara?.suave ?? 2 } : null; c?.requestRenderAll(); alterou(); tocar() }}>
                        <option value="">— o design inteiro —</option><option value="retangulo">Só num retângulo</option><option value="elipse">Só numa elipse</option>
                      </select>
                      {um.soaAjusteMascara && (
                        <div className="grid grid-cols-2 gap-x-2 mt-1">
                          {(['x', 'y', 'w', 'h'] as const).map(k => (
                            <label key={k} className="text-[10px] text-gray-500">{{ x: 'Posição ↔', y: 'Posição ↕', w: 'Largura', h: 'Altura' }[k]}
                              <input type="range" min={0} max={100} value={Math.round(um.soaAjusteMascara![k] * 100)} onChange={e => { um.soaAjusteMascara = { ...um.soaAjusteMascara!, [k]: Number(e.target.value) / 100 }; c?.requestRenderAll(); alterou(); tocar() }} className="w-full accent-orange-500" /></label>
                          ))}
                          <label className="text-[10px] text-gray-500">Suavizar borda
                            <input type="range" min={0} max={20} value={um.soaAjusteMascara.suave} onChange={e => { um.soaAjusteMascara = { ...um.soaAjusteMascara!, suave: Number(e.target.value) }; c?.requestRenderAll(); alterou(); tocar() }} className="w-full accent-orange-500" /></label>
                          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                            <input type="checkbox" className="accent-orange-500" checked={um.soaAjusteMascara.invertida} onChange={e => { um.soaAjusteMascara = { ...um.soaAjusteMascara!, invertida: e.target.checked }; c?.requestRenderAll(); alterou(); tocar() }} /> Inverter</label>
                        </div>
                      )}
                    </div>
                    <button onClick={excluir} className="text-xs text-red-600 inline-flex items-center gap-1 hover:underline"><Trash2 className="w-3.5 h-3.5" /> Excluir camada de ajuste</button>
                  </div>
                )}
                {s.soaMoldura && (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-2 space-y-1.5">
                    <p className="text-[11px] text-gray-600 dark:text-gray-300">Moldura: importe uma foto (ou escolha em Meus arquivos) com ela selecionada — a foto entra recortada.</p>
                    <div className="flex gap-1">
                      <label className="flex-1 text-[11px] text-center rounded-lg border border-gray-200 dark:border-gray-700 py-1 cursor-pointer hover:border-orange-400"><Upload className="w-3.5 h-3.5 inline" /> Importar foto
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.length) importarArquivos(e.target.files); e.target.value = '' }} /></label>
                      <button onClick={abrirBibliotecaImagens} className="flex-1 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 py-1 hover:border-orange-400"><ImagePlus className="w-3.5 h-3.5 inline" /> Meus arquivos</button>
                    </div>
                  </div>
                )}
                {img && c && camadas(c).some(o => soa(o).soaMoldura) && !s.soaClipDe && (
                  <select className={inp} value="" onChange={e => { const m = camadas(c).find(o => soa(o).soaId === e.target.value); if (m) colocarNaMoldura(img, m) }}>
                    <option value="">🖼 Colocar numa moldura…</option>
                    {camadas(c).filter(o => soa(o).soaMoldura).map(o => <option key={soa(o).soaId} value={soa(o).soaId}>{soa(o).soaNome}</option>)}
                  </select>
                )}

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
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      <span className="text-gray-500">Transformar em campo:</span>
                      {([['{nome}', 'nome'], ['{idade}', 'idade'], ['#{nome|minusculas|semespaco|semacento}faz{idade}', 'hashtag']] as const).map(([m, r]) => (
                        <button key={r} onClick={() => transformarEmCampo(txt, m)} className="rounded border border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 hover:bg-orange-50 dark:hover:bg-orange-950/30">{r}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-[1fr_64px] gap-2">
                      <select className={inp} value={(s.soaFonte?.startsWith('u:') ? `b:${s.soaFonte.slice(2)}` : s.soaFonte) || ''} onChange={e => mudarFonte(txt, e.target.value)}>
                        {FONTES_NATIVAS.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                        {!!biblioteca.filter(b => !b.acervo).length && <optgroup label="Minhas fontes">{biblioteca.filter(b => !b.acervo).map(b => <option key={b.id} value={`b:${b.id}`}>{b.nome.replace(/\.(ttf|otf)$/i, '')}</option>)}</optgroup>}
                        {!!biblioteca.filter(b => b.acervo).length && <optgroup label="Acervo SOA">{biblioteca.filter(b => b.acervo).map(b => <option key={b.id} value={`b:${b.id}`}>{b.nome.replace(/\.(ttf|otf)$/i, '')}</option>)}</optgroup>}
                      </select>
                      <input className={inp} inputMode="numeric" value={Math.round(txt.fontSize)} onChange={e => mudar(txt, { fontSize: Math.max(4, Number(e.target.value.replace(/\D/g, '')) || 4) })} />
                    </div>
                    <label className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] rounded-lg border border-dashed border-orange-300 text-orange-700 dark:text-orange-300 py-1 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30">
                      <FileType2 className="w-3.5 h-3.5" /> Importar fonte (TTF/OTF) — fica só no seu ateliê
                      <input type="file" accept=".ttf,.otf,font/ttf,font/otf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importarFonte(f); e.target.value = '' }} />
                    </label>
                    <div className="flex items-center gap-1">
                      <button onClick={() => caixaTexto(txt, 'maiusculas')} className={btnIc} title="MAIÚSCULAS"><CaseUpper className="w-4 h-4" /></button>
                      <button onClick={() => caixaTexto(txt, 'minusculas')} className={btnIc} title="minúsculas"><CaseLower className="w-4 h-4" /></button>
                      <button onClick={() => caixaTexto(txt, 'titulo')} className={btnIc} title="Primeira Letra Maiúscula"><CaseSensitive className="w-4 h-4" /></button>
                      <select className={inp + ' flex-1'} value="" onChange={e => { const est = estilosTexto.find(x => x.id === e.target.value); if (est) aplicarEstiloTexto(txt, est.operacoes[0]) }}>
                        <option value="">Estilos salvos…</option>
                        {estilosTexto.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                      <button onClick={() => salvarEstiloTexto(txt)} className={btnIc} title="Salvar este estilo de texto"><BookmarkPlus className="w-4 h-4" /></button>
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
                {um instanceof Group && !(um instanceof ActiveSelection) && (
                  <div className={secao}>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">Cor do elemento
                      <input type="color" value="#f97316" onChange={e => { um.getObjects().forEach(x => { if (x.fill && x.fill !== 'none' && typeof x.fill === 'string') x.set({ fill: e.target.value }) }); um.dirty = true; c?.requestRenderAll(); alterou() }} className="w-8 h-7 rounded border border-gray-200" />
                    </div>
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
                    <PainelIA
                      fonte={() => { const o = conteudoParaSelecao(img) as HTMLCanvasElement | HTMLImageElement; const w = (o as HTMLImageElement).naturalWidth || o.width, h = (o as HTMLImageElement).naturalHeight || o.height; const k = document.createElement('canvas'); k.width = w; k.height = h; k.getContext('2d')!.drawImage(o, 0, 0); return k }}
                      obterSelecao={() => (alvoRef.current === img ? selecaoRef.current : null)}
                      onResultado={r => { adicionarResultadoIA(img, r).catch(e => setErro((e as Error).message)) }}
                      onCota={() => setCotaVersao(v => v + 1)} />
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
                      <p className={lbl}>Girar e espelhar</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => girar90(img)} className={btnIc} title="Girar 90°"><RotateCw className="w-4 h-4" /></button>
                        <button onClick={() => mudar(img, { flipX: !img.flipX })} className={btnIc} title="Espelhar na horizontal"><FlipHorizontal2 className="w-4 h-4" /></button>
                        <button onClick={() => mudar(img, { flipY: !img.flipY })} className={btnIc} title="Espelhar na vertical"><FlipVertical2 className="w-4 h-4" /></button>
                        <label className="flex-1 text-[10px] text-gray-500">Endireitar {Math.round(((img.angle || 0) + 540) % 360 - 180)}°
                          <input type="range" min={-45} max={45} value={Math.max(-45, Math.min(45, Math.round(((img.angle || 0) + 540) % 360 - 180)))} onChange={e => { img.rotate(Number(e.target.value)); img.setCoords(); c?.requestRenderAll(); alterou(); tocar() }} className="w-full accent-orange-500" /></label>
                      </div>
                    </div>
                    <div>
                      <p className={lbl}><Crop className="w-3 h-3 inline" /> Cortar <span className="font-normal text-gray-400">(não destrutivo)</span></p>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {([['Livre', null], ['1:1', 1], ['4:5', 0.8], ['3:4', 0.75], ['16:9', 16 / 9], ['9:16', 9 / 16]] as const).map(([t, r]) => (
                          <button key={t} onClick={() => cortarProporcao(img, r)} className="text-[10px] rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 hover:border-orange-400">{t === 'Livre' ? 'Sem corte' : t}</button>
                        ))}
                      </div>
                      {(() => {
                        const k = s.soaCorte || { x: 0, y: 0, w: 1, h: 1 }
                        const lados = { esq: k.x, dir: 1 - k.x - k.w, topo: k.y, base: 1 - k.y - k.h }
                        const set = (l: keyof typeof lados, v: number) => {
                          const n = { ...lados, [l]: v / 100 }
                          if (n.esq + n.dir > 0.95 || n.topo + n.base > 0.95) return
                          mudarCorte(img, { x: n.esq, y: n.topo, w: 1 - n.esq - n.dir, h: 1 - n.topo - n.base })
                        }
                        return <div className="grid grid-cols-2 gap-x-2">{(['esq', 'dir', 'topo', 'base'] as const).map(l => (
                          <label key={l} className="text-[10px] text-gray-500">{{ esq: 'Esquerda', dir: 'Direita', topo: 'Topo', base: 'Base' }[l]} {Math.round(lados[l] * 100)}%
                            <input type="range" min={0} max={90} value={Math.round(lados[l] * 100)} onChange={e => set(l, Number(e.target.value))} className="w-full accent-orange-500" /></label>))}</div>
                      })()}
                    </div>
                    <div>
                      <p className={lbl}>Seleção e máscara</p>
                      <div className="grid grid-cols-2 gap-1">
                        <button onClick={() => entrarSelecao(img)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Lasso className="w-3.5 h-3.5" /> Selecionar área</button>
                        <button onClick={() => entrarMascara(img)} className={inp + ' !py-1.5 inline-flex items-center justify-center gap-1'}><Brush className="w-3.5 h-3.5" /> Pintar máscara</button>
                      </div>
                      {s.soaMascara && (
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300"><input type="checkbox" className="accent-orange-500" checked={!!s.soaMascaraInvertida} onChange={e => { soa(img).soaMascaraInvertida = e.target.checked; agendarProcessamento(img); alterou(); tocar() }} /> Inverter máscara</label>
                            <button onClick={() => { limparMascara(img); soa(img).soaMascaraInvertida = false; agendarProcessamento(img); alterou(); tocar() }} className="text-[10px] text-gray-400 hover:text-red-600 ml-auto">limpar máscara</button>
                          </div>
                          <label className="block text-[10px] text-gray-500">Suavizar borda {s.soaMascaraSuave || 0}
                            <input type="range" min={0} max={10} step={0.5} value={s.soaMascaraSuave || 0} onChange={e => { soa(img).soaMascaraSuave = Number(e.target.value); agendarProcessamento(img); alterou(); tocar() }} className="w-full accent-orange-500" /></label>
                        </div>
                      )}
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

          {/* páginas (estilo Canva) */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <div className="flex items-center justify-between px-1 pb-1">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Páginas <span className="font-normal text-gray-400">{paginaAtual + 1}/{paginasUi.length}</span></p>
              <span className="flex gap-1">
                <button onClick={() => novaPagina(false)} className="text-[11px] rounded border border-gray-200 dark:border-gray-700 px-1.5 hover:border-orange-400" title="Página nova">+ nova</button>
                <button onClick={() => novaPagina(true)} className="text-[11px] rounded border border-gray-200 dark:border-gray-700 px-1.5 hover:border-orange-400" title="Duplicar esta página">duplicar</button>
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {paginasUi.map((p, i) => (
                <div key={p.id} draggable onDragStart={() => setArrastoPagina(i)} onDragEnd={() => setArrastoPagina(null)}
                  onDragOver={e => { if (arrastoPagina !== null) e.preventDefault() }} onDrop={e => { e.preventDefault(); if (arrastoPagina !== null) moverPagina(arrastoPagina, i); setArrastoPagina(null) }}
                  onClick={() => irParaPagina(i)} title="Clique para abrir · arraste para reordenar"
                  className={`relative shrink-0 w-16 cursor-pointer rounded-lg border-2 ${i === paginaAtual ? 'border-orange-500' : 'border-gray-200 dark:border-gray-700'} bg-gray-50 dark:bg-gray-800`}>
                  <div className="aspect-square flex items-center justify-center overflow-hidden rounded-md">{p.mini ? <img src={p.mini} alt="" className="max-w-full max-h-full" /> : <span className="text-[10px] text-gray-400">vazia</span>}</div>
                  <span className="absolute bottom-0 left-0 text-[9px] bg-black/50 text-white rounded-tr px-1">{i + 1}</span>
                  {paginasUi.length > 1 && <button onClick={e => { e.stopPropagation(); removerPagina(i) }} className="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-900 rounded-full shadow" title="Remover página"><X className="w-3 h-3 text-red-500" /></button>}
                </div>
              ))}
            </div>
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
                    draggable onDragStart={() => setArrastoCamada(so.soaId || null)} onDragEnd={() => setArrastoCamada(null)}
                    onDragOver={e => { if (arrastoCamada) e.preventDefault() }} onDrop={e => { e.preventDefault(); soltarCamada(o) }}
                    title="Arraste para mudar a ordem (quem fica por cima)"
                    className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs cursor-pointer ${arrastoCamada && arrastoCamada !== so.soaId ? 'border-t-2 border-orange-300' : ''} ${sel ? 'bg-orange-100 dark:bg-orange-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <button onClick={e => { e.stopPropagation(); mudar(o, { visible: !o.visible }) }} className="text-gray-400 hover:text-gray-700" title={o.visible ? 'Ocultar' : 'Mostrar'}>{o.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
                    <button onClick={e => { e.stopPropagation(); travar(o, !so.soaTravado) }} className={so.soaTravado ? 'text-orange-600' : 'text-gray-300 hover:text-gray-600'} title={so.soaTravado ? 'Destravar' : 'Travar'}>{so.soaTravado ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</button>
                    {ehOI
                      ? <span className="text-[9px] font-bold rounded bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-200 px-1" title="Objeto inteligente">OI</span>
                      : <span className="text-[10px] text-gray-400 w-4 text-center">{o instanceof CamadaAjuste ? '◐' : so.soaMoldura ? '⬚' : so.soaArea ? '▭' : so.soaTipo === 'imagem' ? '🖼' : so.soaTipo === 'texto' ? 'T' : so.soaTipo === 'grupo' ? '▣' : '◆'}</span>}
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

      {biblio && (
        <ModalBiblioteca abaInicial={biblio} onFechar={() => setBiblio(null)} onElemento={addElemento} onMoldura={addMoldura} onGrade={addGrade}
          onModelo={inserirModelo} onMeuTemplate={abrirMeuTemplate} onTemplateMassa={abrirTemplateMassa} />
      )}
      {redim && design && <ModalRedimensionar design={design} onFechar={() => setRedim(false)} onAplicar={(w, h) => { setRedim(false); redimensionarDesign(w, h) }} onCopia={(w, h) => { setRedim(false); copiaRedimensionada(w, h) }} />}
      {ia && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setIa(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between"><h3 className="font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2"><Bot className="w-5 h-5 text-violet-600" /> Ferramentas de IA</h3><button onClick={() => setIa(false)}><X className="w-4 h-4" /></button></div>
            <p className="text-sm text-gray-500">Chegam junto com o Mockup (próxima fase):</p>
            <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1.5">
              {['Remover fundo com 1 clique', 'Apagar objeto da foto', 'Expandir a imagem (preencher as bordas)', 'Aumentar resolução (upscaling)', 'Recolorir a peça'].map(t => <li key={t} className="flex items-center gap-2"><span className="text-[10px] rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 px-2 py-0.5">em breve</span> {t}</li>)}
            </ul>
          </div>
        </div>
      )}
      {replicar && design && (
        <ReplicarMoldes moldes={moldes} setMoldes={setMoldes} config={replica} setConfig={setReplica} fontes={oi}
          obterArte={obterArte} workspaceId={workspaceId} storage={storage} onFechar={() => setReplicar(false)}
          onCota={f => { setFaltam(f); setCotaVersao(v => v + 1) }} />
      )}

      {historico && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setHistorico(null)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold flex-1">Versões deste design</h2>
              <button onClick={() => void salvar('manual').then(ok => { if (ok) void abrirHistorico() })} disabled={!!ocupado} className="text-xs rounded-lg border border-orange-300 text-orange-700 dark:text-orange-300 px-2 py-1">Guardar versão agora</button>
              <button onClick={() => setHistorico(null)} className="text-gray-400 hover:text-gray-700 px-1" aria-label="Fechar">✕</button>
            </div>
            <p className="text-xs text-gray-500">O SOA guarda uma versão sozinho a cada 5 minutos de edição (as 30 mais recentes). Restaurar não apaga nada: o estado atual vira uma versão antes.</p>
            {historico.carregando ? <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
              : !historico.lista.length ? <p className="text-sm text-gray-400">Ainda não há versões — continue editando, a primeira é guardada no próximo salvamento.</p>
              : (
                <ul className="space-y-2">
                  {historico.lista.map(v => (
                    <li key={v.id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-2">
                      {v.previewUrl ? <img src={v.previewUrl} alt="" className="w-16 h-16 object-contain rounded bg-gray-50 dark:bg-gray-800" /> : <div className="w-16 h-16 rounded bg-gray-100 dark:bg-gray-800" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium tabular-nums">{new Date(v.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[11px] text-gray-500">{v.motivo === 'auto' ? 'Automática' : v.motivo === 'manual' ? 'Guardada por você' : 'Antes de restaurar'}</p>
                      </div>
                      <button onClick={() => restaurarVersao(v.id)} disabled={!!ocupado} className="text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 font-semibold disabled:opacity-40">Restaurar</button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      )}
      {exportar && design && c && (
        <ModalExportar design={design} onFechar={() => setExportar(false)}
          renderizar={() => renderizarEmAlta(c, zoomRef.current)}
          paginas={paginasUi.length} paginaAtual={paginaAtual}
          renderizarPagina={async i => { await irParaPagina(i); await document.fonts?.ready; return renderizarEmAlta(c, zoomRef.current) }}
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
function ModalExportar({ design, onFechar, renderizar, workspaceId, storage, onCota, paginas = 1, paginaAtual = 0, renderizarPagina }: {
  design: Design; onFechar: () => void; renderizar: () => Promise<HTMLCanvasElement>; workspaceId?: string; storage: boolean; onCota: (faltam: number) => void
  paginas?: number; paginaAtual?: number; renderizarPagina?: (i: number) => Promise<HTMLCanvasElement>
}) {
  const [quais, setQuais] = useState<'atual' | 'todas' | 'selecionadas'>(paginas > 1 ? 'todas' : 'atual')
  const [selPags, setSelPags] = useState<number[]>([paginaAtual])
  const [pdfUnico, setPdfUnico] = useState(paginas > 1)
  const lista = quais === 'atual' || paginas <= 1 ? [paginaAtual] : quais === 'todas' ? Array.from({ length: paginas }, (_, i) => i) : [...selPags].sort((a, b) => a - b)
  const [original, setOriginal] = useState(true)
  const [canais, setCanais] = useState<string[]>([])
  const [modo, setModo] = useState<'encaixar' | 'preencher'>('encaixar')
  const [fundo, setFundo] = useState('#ffffff')
  const [saida, setSaida] = useState<Saida>({ formato: 'jpg', qualidade: 92 })
  const [guardar, setGuardar] = useState(false)
  const [gerando, setGerando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const porPagina = (original || pdfUnico ? 1 : 0) + canais.length
  const total = lista.length * porPagina

  async function gerar() {
    if (!total) return
    setErro('')
    try { await exigirSaldo(total) }
    catch (e) { if (e instanceof SemCota) onCota(e.faltam); setErro((e as Error).message); return }
    const aut = new Autorizador(total)
    let n = 0
    try {
      const arquivos: { nome: string; blob: Blob }[] = []
      const nomeBase = design.nome.replace(/[\\/:*?"<>|]/g, '').trim() || 'design'
      const pdf = pdfUnico ? await (await import('pdf-lib')).PDFDocument.create() : null
      for (const pi of lista) {
        setGerando(lista.length > 1 ? `Página ${pi + 1}: renderizando em alta…` : 'Renderizando em alta…')
        const base = lista.length === 1 && pi === paginaAtual ? await renderizar() : await renderizarPagina!(pi)
        const suf = lista.length > 1 || paginas > 1 ? ` - p${pi + 1}` : ''
        if (original || pdf) {
          await aut.garantir(n++)
          if (pdf) {
            const jpg = await codificar(base, { formato: 'jpg', qualidade: 93 })
            const im = await pdf.embedJpg(new Uint8Array(await jpg.arrayBuffer()))
            pdf.addPage([design.largura * 0.75, design.altura * 0.75]).drawImage(im, { x: 0, y: 0, width: design.largura * 0.75, height: design.altura * 0.75 })
          }
          if (original) arquivos.push({ nome: `${nomeBase}${suf}.${saida.formato}`, blob: await codificar(base, saida) })
        }
        for (const id of canais) {
          const t = TAMANHOS_CANAIS.find(x => x.id === id)!
          setGerando(`${lista.length > 1 ? `p${pi + 1} · ` : ''}${t.canal} ${t.rotulo}…`)
          await aut.garantir(n++)
          const cv = processarImagem(base, [{ op: 'redimensionar', largura: t.largura, altura: t.altura, modo, fundo: modo === 'encaixar' ? fundo : null }], null)
          arquivos.push({ nome: `${nomeBase}${suf} - ${t.canal} ${t.rotulo.replace(/[/:]/g, '-')} ${t.largura}x${t.altura}.${saida.formato}`, blob: await codificar(cv, saida) })
          await new Promise(r => setTimeout(r, 0))
        }
      }
      if (pdf) arquivos.unshift({ nome: `${nomeBase}.pdf`, blob: new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' }) })
      if (lista.some(pi => pi !== paginaAtual) && renderizarPagina) await renderizarPagina(paginaAtual)
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
        {paginas > 1 && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex flex-wrap gap-1.5">
              {([['atual', 'Página atual'], ['todas', `Todas (${paginas})`], ['selecionadas', 'Escolher']] as const).map(([k, t]) => <button key={k} onClick={() => setQuais(k)} className={`rounded-lg px-2 py-1 border ${quais === k ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>{t}</button>)}
            </div>
            {quais === 'selecionadas' && <div className="flex flex-wrap gap-1">{Array.from({ length: paginas }, (_, i) => <label key={i} className="flex items-center gap-1 rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5"><input type="checkbox" className="accent-orange-500" checked={selPags.includes(i)} onChange={e => setSelPags(s => e.target.checked ? [...s, i] : s.filter(x => x !== i))} /> {i + 1}</label>)}</div>}
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange-500" checked={pdfUnico} onChange={e => setPdfUnico(e.target.checked)} /> Juntar as páginas num PDF único</label>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" className="accent-orange-500" checked={original} onChange={e => setOriginal(e.target.checked)} /> Tamanho do design ({design.largura}×{design.altura}){paginas > 1 ? ' — um arquivo por página' : ''}
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

// ── Redimensionar o design (magic resize) ───────────────────────────────────────
function ModalRedimensionar({ design, onFechar, onAplicar, onCopia }: { design: Design; onFechar: () => void; onAplicar: (w: number, h: number) => void; onCopia: (w: number, h: number) => void }) {
  const [sel, setSel] = useState<string>(TAMANHOS_CANAIS[0].id)
  const [livre, setLivre] = useState({ w: String(design.largura), h: String(design.altura) })
  const t = TAMANHOS_CANAIS.find(x => x.id === sel)
  const W = t ? t.largura : Number(livre.w), H = t ? t.altura : Number(livre.h)
  const valido = W >= 50 && W <= 8000 && H >= 50 && H <= 8000
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h3 className="font-semibold text-gray-900 dark:text-white">Redimensionar o design</h3><button onClick={onFechar}><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-gray-500">Atual: {design.largura}×{design.altura}. Os elementos são reposicionados e reescalados proporcionalmente — confira os detalhes depois.</p>
        <select className={inp} value={sel} onChange={e => setSel(e.target.value)}>
          {TAMANHOS_CANAIS.map(x => <option key={x.id} value={x.id}>{rotuloTamanho(x)}</option>)}
          <option value="livre">Personalizado…</option>
        </select>
        {!t && (
          <div className="flex gap-2">
            {(['w', 'h'] as const).map(k => <input key={k} className={inp} inputMode="numeric" value={livre[k]} onChange={e => setLivre(l => ({ ...l, [k]: e.target.value.replace(/\D/g, '') }))} placeholder={k === 'w' ? 'Largura' : 'Altura'} />)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!valido} onClick={() => onCopia(W, H)} className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 text-sm disabled:opacity-40">Criar cópia {W}×{H}</button>
          <button disabled={!valido} onClick={() => onAplicar(W, H)} className="rounded-lg border border-gray-200 dark:border-gray-700 py-2 text-sm disabled:opacity-40">Mudar este design</button>
        </div>
      </div>
    </div>
  )
}
