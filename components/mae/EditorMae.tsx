'use client'
'use no memo'
// Editor MAE — Sprint 1 (Fundações): prancheta em mm com zoom "tamanho real", desfazer/refazer,
// pasta Biblioteca MAE e fontes locais. Sprint 2 (Motor de render): camadas, grupos, mesclagem e
// máscara de recorte — a arte da folha é a PRÉVIA renderizada pelo motor no Web Worker (a mesma
// função da exportação); o Konva só mostra a imagem e o contorno da camada selecionada. 'use no memo': o Konva guarda estado mutável (mesmo padrão do
// EditorCamadas) e o React Compiler não pode memoizar por cima dele.
// A arte é desenhada SÓ pelo mae-render (desenharPrancheta) dentro de um Konva.Shape; o Konva cuida
// apenas da interação. As réguas são moldura da interface.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Shape, Group, Rect, Transformer, Line, Text as KText } from 'react-konva'
import type Konva from 'konva'
import { Undo2, Redo2, Maximize, Ruler, ZoomIn, ZoomOut, FilePlus2, AlertTriangle } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { acharCamada } from '@/lib/mae/editor/camadas'
import { ajustar, tamanhoReal, zoomNoPonto, zoomPercentual, CALIBRACAO_PADRAO, desenharPrancheta, passoDaGrade, type Retangulo } from '@/lib/mae/render'
import type { Folha, Orientacao } from '@/lib/mae/schema'
import { suportaMae, MENSAGEM_NAVEGADOR } from '@/lib/mae/fontes/suporte'
import { desenharRegua, ESPESSURA_REGUA } from './reguas'
import Calibracao, { lerCalibracao } from './Calibracao'
import PainelBiblioteca from './PainelBiblioteca'
import PainelFontes from './PainelFontes'
import PainelCamadas from './PainelCamadas'
import PainelMotor from './PainelMotor'
import CamadaMoldes, { fecharLaco } from './CamadaMoldes'
import { useMoldes, editarFaces, moverMoldes } from './moldesEditor'
import { excluirFace } from '@/lib/mae/faces/ferramentas'
import { acoes, editarCamada } from './acoesCamadas'
import { usePrevias, resolucaoDaPrevia, garantirGrade, type PrancheteComCamadas } from './motorEditor'
import PainelBase from './PainelBase'
import PainelTema, { TIPO_ARRASTE } from './PainelTema'
import PainelExportar from './PainelExportar'
import Link from 'next/link'
import PainelLoja, { useLojaAberta } from './PainelLoja'
import PainelTemaPronto from './PainelTemaPronto'
import { BarraFuncoes, LadoPainel, TituloFuncao, painelClassico } from './Funcoes'
import { PainelDesign, ExportarImagem } from './EditorImagemMae'
import { materializar, fontesDosTextos } from '@/lib/mae/editor/materializar'
import { garantirFontes } from './fontesTexto'
import { paginaDe } from './acoesCamadas'
import BarraPedido, { useAbrirPedidoDaUrl } from './BarraPedido'
import TutorialMae, { useTutorial } from './TutorialMae'
import { usePedidoAberto, apiMae, type Addons } from './pedidosMae'
import { useEditor, responderEscopo, type ModoEditor } from './estado'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { localizarNoMundo, faceSemFuroNoPonto } from './CamadaMoldes'
import { soltarNaFace } from './acoesVinculo'
import { guardarImagem, infoImagem, lerIdentidade } from './arquivosMae'
import { arrobaDe } from './exportarMae'
import type { DocTema } from '@/lib/mae/schema'
import { registroFontes, garantirFontesDoTema, useFontes } from './fontesTexto'
import { useSync } from './sincronia'
import type { InfoTexto } from '@/lib/mae/texto/noTexto'
import { posicoesPranchetas, limitesPranchetas, organizarPranchetas, type ModoOrganizar } from '@/lib/mae/editor/pranchetas'
import { TitulosPranchetas, MenuPrancheta } from './PranchetasPalco'
import DicasMae from './Dicas'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'


/** Lote 1: cada prancheta na posição salva na base (sem ela: lado a lado, 20 mm de espaço). */
const posicoes = posicoesPranchetas
function limites(artboards: Parameters<typeof limitesPranchetas>[0]): Retangulo {
  // a barra de título das pranchetas (20 px) cabe na margem de 32 px do "Ajustar"
  return limitesPranchetas(artboards)
}

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

const ULTIMA_ABA = 'mae:ultima-aba'

export default function EditorMae({ secao }: { secao?: string } = {}) {
  const [suporte] = useState(() => suportaMae(window))
  const hist = useMaeDoc(s => s.hist)
  const viewport = useMaeDoc(s => s.viewport)
  const { setViewport, desfazer, refazer, novaPrancheta } = useMaeDoc.getState()
  const doc = hist.atual
  const selecao = useMaeDoc(s => s.selecao)
  const raiz = useBiblioteca(s => s.raiz)
  const versaoPasta = useBiblioteca(s => s.versao)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  // ── Sprints 5/6: o que cada folha mostra (base = papel de teste; tema = vínculo; imagem = camadas) ──
  const modoEd = useEditor(s => s.modo)
  // Sprint 12: pedido aberto pelo card ("Gerar arte"), edição em massa, add-ons e tutorial
  useAbrirPedidoDaUrl()
  const valoresDoPedido = usePedidoAberto(s => s.valores)
  // o @ do ateliê (Identidade) entra como a variável ARROBA das posições de texto
  const arroba = useEditor(s => arrobaDe(s.identidade))
  const valoresPedido = useMemo(() => (arroba ? { ARROBA: arroba, ...valoresDoPedido } : valoresDoPedido), [arroba, valoresDoPedido])
  const textosForaDaFace = useEditor(s => s.textos).filter(t => t.foraDaFace && t.cantosMm)
  const [addons, setAddons] = useState<Addons | null>(null)
  useEffect(() => { apiMae.addons().then(setAddons).catch(() => null) }, [])
  const tutorial = useTutorial()
  const transf = useRef<Konva.Transformer>(null)
  const caixaRef = useRef<Konva.Rect>(null)
  // apertou numa alça do transformador: o palco não começa a arrastar a folha (o Konva recebe antes do React)
  const alcaAtiva = useRef(false)
  // liga o transformador à caixa selecionada só quando ela muda (religar no meio de um arrasto cancela)
  useEffect(() => {
    const t = transf.current, n = caixaRef.current
    if (!t) return
    if ((t.nodes()[0] ?? null) !== n) { t.nodes(n ? [n] : []); t.getLayer()?.batchDraw() }
  })
  // editor de imagem: carrega as fontes dos textos livres (a prévia redesenha quando chegam)
  const docAtual = useMaeDoc(s => s.hist.atual)
  useEffect(() => {
    if (modoEd !== 'imagem') return
    const ps = new Set<string>(); for (const ab of docAtual.artboards) fontesDosTextos(ab.layers ?? [], ps)
    if (ps.size) void garantirFontes(ps, useBiblioteca.getState().raiz)
  }, [docAtual, modoEd])
  // item do menu "Método MAE": abre o editor direto na função
  useEffect(() => {
    if (!secao) {
      // sem atalho: volta para a última aba usada (Lote 2, item 25)
      let ult: string | null = null
      try { ult = localStorage.getItem(ULTIMA_ABA) } catch { /* sem storage */ }
      if (ult === 'base' || ult === 'tema' || ult === 'imagem') useEditor.getState().set({ modo: ult, face: null, camada: null, posicionar: null })
      return
    }
    if (secao === 'base' || secao === 'tema' || secao === 'imagem') useEditor.getState().set({ modo: secao, face: null, camada: null, posicionar: null })
    else if (secao === 'loja') {
      try { localStorage.setItem('mae:funcao:tema', 'loja') } catch { /* sem storage */ }
      useEditor.getState().set({ modo: 'tema', face: null, camada: null, funcao: 'loja' }); useLojaAberta.setState({ aberta: true })
    }
    else if (secao === 'ajuda') tutorial.abrir()
  }, [secao]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(ULTIMA_ABA, modoEd) } catch { /* sem storage */ } }, [modoEd])
  // barra de ícones (Lote 2, item 24): o "Próximo/Voltar" da base acompanha o ícone do passo
  const [classico] = useState(painelClassico)
  const funcao = useEditor(s => s.funcao), passoBase = useEditor(s => s.passo)
  useEffect(() => {
    if (classico || modoEd !== 'base') return
    const f = useEditor.getState().funcao
    if (f?.startsWith('passo-') && f !== `passo-${passoBase}`) {
      useEditor.getState().set({ funcao: `passo-${passoBase}` })
      try { localStorage.setItem('mae:funcao:base', `passo-${passoBase}`) } catch { /* sem storage */ }
    }
  }, [passoBase, modoEd, classico])
  const comFuncoes = !classico && modoEd !== 'imagem'
  const gradeOn = useEditor(s => s.grade)
  const pergunta = useEditor(s => s.pergunta)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const liberadaPasta = useBiblioteca(s => s.liberada)
  const [grades, setGrades] = useState<Map<string, { path: string; sha256: string; aspect: number }>>(() => new Map())
  useEffect(() => {
    if (modoEd !== 'base' || !gradeOn) return
    let vivo = true
    ;(async () => {
      const m = new Map<string, { path: string; sha256: string; aspect: number }>()
      for (const p of doc.parts) if (p.instances.length) m.set(`${p.id}:${(p.referenceAspect ?? 1).toFixed(3)}`, await garantirGrade(p.name, p.referenceAspect ?? 1))
      if (vivo) setGrades(m)
    })()
    return () => { vivo = false }
  }, [doc.parts, modoEd, gradeOn])
  useEffect(() => { if (raiz && liberadaPasta) lerIdentidade(raiz).then(async i => { for (const k of ['logo', 'qr'] as const) if (i[k]) await infoImagem(raiz, i[k]!.path).catch(() => null); useEditor.getState().set({ identidade: i }) }) }, [raiz, liberadaPasta])
  // Sprint 7: fontes dos estilos de texto do tema (locais/Google/substituta) — prontas antes de diagramar
  const versaoFontes = useFontes(s => s.versao)
  useEffect(() => { if (modoEd === 'tema') garantirFontesDoTema(tema, raiz).catch(e => console.warn('[MAE] fontes', e)) }, [modoEd, tema, raiz])
  const { folhas, infosTexto } = useMemo(() => {
    void versaoFontes
    const infos: InfoTexto[] = []
    const fs = doc.artboards.map((ab): PrancheteComCamadas => {
      // editor de imagem: texto e forma livres viram caminho (com as fontes já carregadas)
      if (modoEd === 'imagem') return { id: ab.id, widthMm: ab.widthMm, heightMm: ab.heightMm, layers: materializar(ab.layers ?? [], registroFontes) }
      const layers = resolverPrancheta(doc, ab.id, modoEd === 'tema'
        ? { tema, texto: { fontes: registroFontes, valores: valoresPedido, aoDiagramar: i => infos.push(i) } }
        : { gradeDaParte: gradeOn ? (id, A) => grades.get(`${id}:${A.toFixed(3)}`) ?? null : undefined })
      return { id: ab.id, widthMm: ab.widthMm, heightMm: ab.heightMm, layers }
    })
    return { folhas: fs, infosTexto: infos }
  }, [doc, modoEd, tema, grades, gradeOn, versaoFontes, valoresPedido])
  useEffect(() => { useEditor.getState().set({ textos: infosTexto }) }, [infosTexto])
  const resPrevia = Math.min(resolucaoDaPrevia(viewport.escala, dpr), folhas.filter(f => f.layers.length).length > 1 ? 6 : 99)
  const aoTerminar = useCallback((r: { ms: number; folhas: number; faltando: string[] }) => {
    useEditor.getState().set({ previa: { ms: Math.round(r.ms), em: performance.now(), folhas: r.folhas } })
    useBiblioteca.getState().setFaltando(r.faltando)
  }, [])
  const previas = usePrevias(folhas, resPrevia, raiz, versaoPasta, aoTerminar)

  const areaRef = useRef<HTMLDivElement>(null)
  const reguaH = useRef<HTMLCanvasElement>(null)
  const reguaV = useRef<HTMLCanvasElement>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [calib, setCalib] = useState(() => lerCalibracao())
  const [calibrando, setCalibrando] = useState(false)
  const [folha, setFolha] = useState<Folha | 'personalizada'>('A4')
  const [orient, setOrient] = useState<Orientacao>('retrato')
  const [pers, setPers] = useState({ w: '210', h: '297' })
  const ajustado = useRef(false)

  // tamanho da área do palco
  useLayoutEffect(() => {
    const el = areaRef.current; if (!el) return
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); setTam({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const fazerAjustar = useCallback(() => {
    if (tam.w && tam.h) setViewport(ajustar(limites(useMaeDoc.getState().hist.atual.artboards), tam.w, tam.h))
  }, [tam.w, tam.h, setViewport])
  const fazerTamanhoReal = useCallback(() => {
    if (tam.w && tam.h) setViewport(tamanhoReal(limites(useMaeDoc.getState().hist.atual.artboards), tam.w, tam.h, calib))
  }, [tam.w, tam.h, calib, setViewport])
  const zoomCentro = useCallback((f: number) => setViewport(zoomNoPonto(useMaeDoc.getState().viewport, f, tam.w / 2, tam.h / 2)), [tam.w, tam.h, setViewport])

  // primeira abertura: a prancheta inteira na tela
  useEffect(() => { if (!ajustado.current && tam.w && tam.h) { ajustado.current = true; fazerAjustar() } }, [tam.w, tam.h, fazerAjustar])

  // réguas acompanham o viewport
  useEffect(() => {
    if (reguaH.current && tam.w) desenharRegua(reguaH.current, 'h', viewport, tam.w, 0)
    if (reguaV.current && tam.h) desenharRegua(reguaV.current, 'v', viewport, tam.h, 0)
  }, [viewport, tam.w, tam.h])

  // atalhos no padrão Photoshop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (document.querySelector('[data-editor-pixels]')) return   // a janela de máscara/pintura tem os próprios atalhos
      const ctrl = e.ctrlKey || e.metaKey
      const noTema = useEditor.getState().modo === 'tema' && !!useMaeTema.getState().hist
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (noTema) { if (e.shiftKey) useMaeTema.getState().refazer(); else useMaeTema.getState().desfazer() } else if (e.shiftKey) refazer(); else desfazer() }
      else if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); if (noTema) useMaeTema.getState().refazer(); else refazer() }
      else if (ctrl && e.key === '0') { e.preventDefault(); fazerAjustar() }
      else if (ctrl && e.key === '1') { e.preventDefault(); fazerTamanhoReal() }
      else if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomCentro(1.25) }
      else if (ctrl && e.key === '-') { e.preventDefault(); zoomCentro(0.8) }
      // camadas (Photoshop): Ctrl+G agrupar · Shift+Ctrl+G desagrupar · Alt+Ctrl+G recorte · Ctrl+J duplicar
      else if (ctrl && e.code === 'KeyG') { e.preventDefault(); if (e.altKey) acoes.alternarRecorte(); else if (e.shiftKey) acoes.desagrupar(); else acoes.agrupar() }
      else if (ctrl && e.code === 'KeyJ') { e.preventDefault(); acoes.duplicar() }
      else if (ctrl && e.code === 'BracketRight') { e.preventDefault(); acoes.subir() }
      else if (ctrl && e.code === 'BracketLeft') { e.preventDefault(); acoes.descer() }
      else if (e.key === 'Enter' && useMoldes.getState().modo === 'laco') { const m = useMoldes.getState(); if (m.moldeDosPontos) { e.preventDefault(); fecharLaco(m.moldeDosPontos, m.pontos) } }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const fsel = useMoldes.getState().face
        if (fsel) { e.preventDefault(); editarFaces(fsel.moldeId, 'Excluir face', fs => { const i = fs.findIndex(f => f.id === fsel.faceId); return i < 0 ? null : excluirFace(fs, i) }); useMoldes.getState().set({ face: null }) }
        else if (useMaeDoc.getState().selecao) { e.preventDefault(); acoes.excluir() }
      }
      else if (!ctrl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && moverComSetas(e.key, e.shiftKey)) e.preventDefault()
      else if (e.key === 'Escape') {
        const m = useMoldes.getState()
        if (m.pontos.length || m.modo !== 'selecionar') m.set({ pontos: [], moldeDosPontos: null, modo: 'selecionar' })
        else { m.set({ face: null, medida: null }); useMaeDoc.getState().setSelecao(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desfazer, refazer, fazerAjustar, fazerTamanhoReal, zoomCentro])

  /** Menu do botão direito sobre um elemento do tema (Lote 2, item 16): "É aplique 3D" e "Pode vazar da face". */
function MenuCamadaTema() {
  const menu = useEditor(s => s.menuCamada)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  useEffect(() => {
    if (!menu) return
    const fechar = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.('[data-menu-camada]')) useEditor.getState().set({ menuCamada: null }) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') useEditor.getState().set({ menuCamada: null }) }
    window.addEventListener('mousedown', fechar); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', fechar); window.removeEventListener('keydown', esc) }
  }, [menu])
  const a = menu && tema ? acharCamadaTema(tema, menu.camada) : null
  if (!menu || !a || a.c.type !== 'image') return null
  const c = a.c
  const mudar = (label: string, f: (x: typeof c) => void) => useMaeTema.getState().aplicar(label, t => { const x = acharCamadaTema(t as never, menu.camada); if (x && x.c.type === 'image') f(x.c) })
  return (
    <div className="fixed z-50 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-lg" style={{ left: menu.x, top: menu.y }} data-menu-camada>
      <p className="px-3 py-1 text-[10px] uppercase text-gray-400 truncate">{c.name ?? 'Elemento'}</p>
      <label className="flex items-center gap-2 px-3 py-1 hover:bg-orange-50 cursor-pointer"><input type="checkbox" checked={!!c.applique?.enabled} onChange={e => mudar(e.target.checked ? 'Marcar como aplique 3D' : 'Tirar aplique 3D', x => { if (e.target.checked) x.applique = { ...(x.applique ?? {}), enabled: true }; else delete x.applique })} data-menu-aplique /> É aplique 3D</label>
      <label className="flex items-center gap-2 px-3 py-1 hover:bg-orange-50 cursor-pointer"><input type="checkbox" checked={!!c.bleed} onChange={e => mudar(e.target.checked ? 'Pode vazar da face' : 'Recortar na face', x => { if (e.target.checked) x.bleed = true; else delete x.bleed })} data-menu-vazar /> Pode vazar da face</label>
    </div>
  )
}

// setas: ajuste fino do que está selecionado (posição de texto, logo/QR, texto ou camada do tema). Shift = maior.
function moverComSetas(tecla: string, grande: boolean): boolean {
  const ed = useEditor.getState()
  const [ux, uy] = tecla === 'ArrowLeft' ? [-1, 0] : tecla === 'ArrowRight' ? [1, 0] : tecla === 'ArrowUp' ? [0, -1] : [0, 1]
  const f = grande ? 0.05 : 0.005, mm = grande ? 5 : 0.5, r3 = (x: number) => Math.round(x * 1000) / 1000
  if (ed.modo === 'base' && ed.passo === 6 && ed.slot) {
    useMaeDoc.getState().aplicar('Mover texto (setas)', d => { const s = d.textSlots.find(x => x.id === ed.slot); if (s) { s.box.x = r3(s.box.x + ux * f); s.box.y = r3(s.box.y + uy * f) } }, `setas:${ed.slot}`)
    return true
  }
  if (ed.modo === 'base' && ed.passo === 7 && ed.identSel) {
    const { moldeId, k } = ed.identSel
    useMaeDoc.getState().aplicar('Mover identidade (setas)', d => { const p = d.molds.find(x => x.id === moldeId)?.identity?.[k]; if (p) { p.xMm = Math.round((p.xMm + ux * mm) * 100) / 100; p.yMm = Math.round((p.yMm + uy * mm) * 100) / 100 } }, `setas:${moldeId}:${k}`)
    return true
  }
  const msel = useMoldes.getState().sel
  if (ed.modo === 'base' && ed.passo <= 3 && msel.length) {
    moverMoldes('Mover molde (setas)', new Map(msel.map(id => [id, { dx: ux * mm, dy: uy * mm }])), `setas:moldes:${msel.join(',')}`)
    return true
  }
  if (ed.modo === 'tema' && ed.slot && useMaeTema.getState().hist) {
    useMaeTema.getState().aplicar('Mover texto (só nesta caixa)', t => { const x = t as DocTema; x.textSlotAdjust ??= {}; const a = (x.textSlotAdjust[ed.slot!] ??= {}); a.dx = r3((a.dx ?? 0) + ux * f); a.dy = r3((a.dy ?? 0) + uy * f) }, `setas:${ed.slot}`)
    return true
  }
  return false
}

// roda: Ctrl = zoom no cursor; sem Ctrl = rolar (Shift = horizontal)
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const v = useMaeDoc.getState().viewport
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const p = e.target.getStage()?.getPointerPosition(); if (!p) return
      setViewport(zoomNoPonto(v, e.evt.deltaY < 0 ? 1.1 : 1 / 1.1, p.x, p.y))
    } else {
      const dx = e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX, dy = e.evt.shiftKey ? 0 : e.evt.deltaY
      setViewport({ ...v, x: v.x - dx, y: v.y - dy })
    }
  }
  // arrastar o fundo = mover a vista (mão)
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const onDown = (e: React.PointerEvent) => { if (e.button === 2) return; if (alcaAtiva.current) { alcaAtiva.current = false; return } if (useMoldes.getState().modo !== 'selecionar' && e.button === 0) return; const v = useMaeDoc.getState().viewport; arrasto.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { const a = arrasto.current; if (a) setViewport({ ...useMaeDoc.getState().viewport, x: a.vx + e.clientX - a.x, y: a.vy + e.clientY - a.y }) }
  const onUp = () => { arrasto.current = null }

  function criarPrancheta(adicionar = false) {
    const acao = adicionar ? useMaeDoc.getState().adicionarPrancheta : novaPrancheta
    if (folha === 'personalizada') {
      const w = Number(pers.w.replace(',', '.')), h = Number(pers.h.replace(',', '.'))
      if (!(w > 0 && h > 0 && w <= 2000 && h <= 2000)) { alert('Informe largura e altura em mm (até 2000 mm).'); return }
      acao({ widthMm: w, heightMm: h })
    } else acao(folha, orient)
    ajustado.current = false
    requestAnimationFrame(() => { ajustado.current = true; fazerAjustar() })
  }

  if (!suporte.ok) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2" data-sem-suporte>
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <h1 className="text-lg font-semibold text-gray-900">{MENSAGEM_NAVEGADOR}</h1>
        <p className="text-sm text-gray-600">O Método MAE trabalha com a pasta e as fontes do seu computador, e só o Chrome e o Edge (no computador) permitem isso.</p>
        <p className="text-xs text-gray-400">Falta neste navegador: {suporte.faltando.join(' · ')}</p>
      </div>
    )
  }

  const ps = posicoes(doc.artboards)
  const ultimoDesfazer = hist.desfazer[hist.desfazer.length - 1]?.label
  const ultimoRefazer = hist.refazer[hist.refazer.length - 1]?.label
  // contorno da camada selecionada (arrastar = mover; aplicado ao soltar, 1 passo de desfazer)
  const pagAtiva = paginaDe(doc.artboards)
  const iPag = Math.max(0, doc.artboards.indexOf(pagAtiva))
  const sel = selecao && pagAtiva?.layers ? acharCamada(pagAtiva.layers, selecao)?.no ?? null : null
  const caixaSel = sel && ((sel.type === 'image' && !sel.matrix) || sel.type === 'solid' || sel.type === 'text' || sel.type === 'vshape') ? sel : null
  const rotSel = caixaSel && caixaSel.type !== 'solid' ? caixaSel.rotationDeg : 0

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[560px]" data-editor-mae data-mae-raiz>
      <DicasMae />
      {/* barra */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-900">
        <span className="text-sm font-semibold text-gray-900 dark:text-white mr-1">Método MAE</span>
        <span className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mr-2" data-modos>
          {([['base', '1. Base', 'Monte os moldes uma vez: faces, partes e onde vão os textos'], ['tema', '2. Tema', 'Vista a base com papéis, elementos e textos'], ['imagem', '3. Editor livre', 'Uma arte solta, sem molde (convite, tag, topo de bolo…)']] as [ModoEditor, string, string][]).map(([m, r, dica]) => (
            <button key={m} title={dica} className={`px-2.5 py-1.5 text-xs font-medium ${modoEd === m ? 'bg-orange-500 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={() => useEditor.getState().set({ modo: m, face: null, camada: null, posicionar: null })} data-modo-editor={m}>{r}</button>
          ))}
        </span>
        <span className="text-[11px] text-gray-500" title="Tamanho e orientação valem para a PRÓXIMA prancheta criada; cada prancheta mostra a dela na barra de título">Nova prancheta:</span>
        <select value={folha} onChange={e => setFolha(e.target.value as Folha | 'personalizada')} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs" data-folha>
          <option value="A4">A4 (210 × 297 mm)</option><option value="A5">A5 (148 × 210 mm)</option><option value="A6">A6 (105 × 148 mm)</option><option value="personalizada">Personalizada</option>
        </select>
        {folha === 'personalizada' ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <input inputMode="decimal" value={pers.w} onChange={e => setPers(p => ({ ...p, w: e.target.value }))} className="w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1.5" aria-label="Largura em mm" /> ×
            <input inputMode="decimal" value={pers.h} onChange={e => setPers(p => ({ ...p, h: e.target.value }))} className="w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1.5" aria-label="Altura em mm" /> mm
          </span>
        ) : (
          <select value={orient} onChange={e => setOrient(e.target.value as Orientacao)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs" data-orientacao>
            <option value="retrato">Retrato</option><option value="paisagem">Paisagem</option>
          </select>
        )}
        <button className={btn} onClick={() => criarPrancheta()} data-nova-prancheta><FilePlus2 className="w-3.5 h-3.5" /> Nova área de trabalho</button>
        <button className={btn} onClick={() => criarPrancheta(true)} title="Acrescenta mais uma prancheta nesta área de trabalho, no tamanho e orientação escolhidos ao lado" data-adicionar-prancheta>+ Nova prancheta</button>
        {modoEd === 'base' && doc.artboards.length > 1 && (
          <select value="" onChange={e => { const m = e.target.value as ModoOrganizar; if (!m) return; useMaeDoc.getState().aplicar(`Organizar pranchetas (${m})`, d => organizarPranchetas(d, m)); requestAnimationFrame(fazerAjustar) }} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs" title="Organizar as pranchetas na área de trabalho" data-organizar>
            <option value="">Organizar…</option><option value="linha">Em linha</option><option value="coluna">Em coluna</option><option value="grade">Em grade</option>
          </select>
        )}
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button className={btn} onClick={desfazer} disabled={!ultimoDesfazer} title={ultimoDesfazer ? `Desfazer: ${ultimoDesfazer} (Ctrl+Z)` : 'Nada para desfazer'} data-desfazer><Undo2 className="w-3.5 h-3.5" /></button>
        <button className={btn} onClick={refazer} disabled={!ultimoRefazer} title={ultimoRefazer ? `Refazer: ${ultimoRefazer} (Ctrl+Shift+Z)` : 'Nada para refazer'} data-refazer><Redo2 className="w-3.5 h-3.5" /></button>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button className={btn} onClick={fazerAjustar} title="Ajustar à tela (Ctrl+0)"><Maximize className="w-3.5 h-3.5" /> Ajustar</button>
        <button className={btn} onClick={fazerTamanhoReal} title="Tamanho real — 100 mm na tela = 100 mm (Ctrl+1)" data-tamanho-real><Ruler className="w-3.5 h-3.5" /> Tamanho real</button>
        <button className={btn} onClick={() => zoomCentro(0.8)} title="Diminuir (Ctrl −)" data-zoom-menos><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-xs tabular-nums w-12 text-center text-gray-600 dark:text-gray-300" data-zoom>{zoomPercentual(viewport, calib)}%</span>
        <button className={btn} onClick={() => zoomCentro(1.25)} title="Aumentar (Ctrl +)" data-zoom-mais><ZoomIn className="w-3.5 h-3.5" /></button>
        <button className={btn + (calib === CALIBRACAO_PADRAO ? ' !border-orange-300' : '')} onClick={() => setCalibrando(true)} title="Medir a tela com um cartão para o tamanho real ficar exato">Calibrar tela</button>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        {addons?.addons.massa.ativo
          ? <Link className={btn} href="/estudio/mae/pedidos" title="Pedidos e edição em massa" data-abrir-massa>Pedidos (massa)</Link>
          : <button className={btn} disabled title={`Add-on "Edição em massa" ${addons?.addons.massa.preco ? `· R$ ${addons.addons.massa.preco.toFixed(2).replace('.', ',')}/mês` : '· em breve'}`} data-abrir-massa>Pedidos (massa)</button>}
        <button className={btn} onClick={tutorial.abrir} title="Como usar o Método MAE" aria-label="Tutorial" data-abrir-tutorial>?</button>
        <PreviaInfo />
        <span className="ml-auto text-[11px] text-gray-400" data-medidas>{doc.artboards.map(a => `${a.widthMm} × ${a.heightMm} mm`).join(' · ')}</span>
      </div>
      <BarraPedido />

      <div className="flex flex-1 min-h-0">
        {comFuncoes && <BarraFuncoes modo={modoEd} />}
        {/* painel da função aberta (fica montado mesmo fechado: a exportação em andamento não se perde) */}
        {comFuncoes && (
          <aside className={`w-80 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-4 overflow-y-auto ${funcao ? '' : 'hidden'}`} data-painel-funcao={funcao ?? ''}>
            <TituloFuncao modo={modoEd} />
            <LadoPainel lado="funcoes">
              {modoEd === 'base' && <PainelBase />}
              {modoEd === 'tema' && <><PainelTema /><PainelTemaPronto /><PainelExportar /><PainelLoja /></>}
            </LadoPainel>
          </aside>
        )}
        {/* palco com réguas */}
        <div className="flex-1 min-w-0 grid" style={{ gridTemplateColumns: `${ESPESSURA_REGUA}px 1fr`, gridTemplateRows: `${ESPESSURA_REGUA}px 1fr` }}>
          <div className="bg-slate-50 border-r border-b border-slate-300" />
          <div className="overflow-hidden"><canvas ref={reguaH} /></div>
          <div className="overflow-hidden"><canvas ref={reguaV} /></div>
          <div ref={areaRef} className="relative overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-grab active:cursor-grabbing" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
            onDrop={e => {
              const caminho = e.dataTransfer.getData(TIPO_ARRASTE)
              const arquivos = Array.from(e.dataTransfer.files)
              if (!caminho && !arquivos.length) return
              e.preventDefault()
              if (useEditor.getState().modo !== 'tema') { if (arquivos.length) window.dispatchEvent(new CustomEvent('mae:importar-moldes', { detail: arquivos })); return }
              // tema: o que foi solto numa face vai para a PARTE dela (com Alt: só para esta caixa)
              const box = e.currentTarget.getBoundingClientRect(), v = useMaeDoc.getState().viewport
              const mundo: [number, number] = [(e.clientX - box.left - v.x) / v.escala, (e.clientY - box.top - v.y) / v.escala]
              const d = useMaeDoc.getState().hist.atual
              const achado = localizarNoMundo(d, posicoes(d.artboards), mundo)
              const faceId = achado ? faceSemFuroNoPonto(achado.m, achado.local) : null
              const alt = e.altKey, empilhar = e.shiftKey
              if (!raiz || !faceId) return
              ;(async () => {
                const itens = caminho ? [await infoImagem(raiz, caminho)] : await Promise.all(arquivos.map(async f => guardarImagem(raiz, f, await temTransparencia(f) ? 'Elementos' : 'Papéis')))
                for (const it of itens) soltarNaFace(faceId, achado!.local, it, alt, empilhar)
              })()
            }} data-palco>
            {tam.w > 0 && tam.h > 0 && (
              <Stage width={tam.w} height={tam.h} scaleX={viewport.escala} scaleY={viewport.escala} x={viewport.x} y={viewport.y} onWheel={onWheel}>
                <Layer listening={false}>
                  {doc.artboards.map((a, i) => (
                    <Shape key={a.id} x={ps[i].xMm} y={ps[i].yMm} perfectDrawEnabled={false}
                      sceneFunc={ctx => {
                        const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
                        const arte = previas.get(a.id) ?? null
                        if (!arte) {
                          desenharPrancheta(c, a, { pxPorMmDoDispositivo: viewport.escala * dpr, grade: { passoMm: passoDaGrade(viewport.escala) }, borda: true })
                          return
                        }
                        // a arte inteira vem pronta do motor; aqui só se coloca na folha (em mm) e se desenha a borda
                        c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'
                        c.drawImage(arte.bitmap, 0, 0, a.widthMm, a.heightMm); c.restore()
                        desenharPrancheta(c, a, { pxPorMmDoDispositivo: viewport.escala * dpr, grade: false, borda: true, corFundo: 'rgba(0,0,0,0)' })
                      }} />
                  ))}
                </Layer>
                {modoEd === 'base' && <TitulosPranchetas ps={ps} escala={viewport.escala} />}
                <CamadaMoldes posicoes={ps} escala={viewport.escala} />
                {modoEd === 'tema' && textosForaDaFace.length > 0 && (
                  <Layer listening={false} data-textos-fora>
                    {textosForaDaFace.map(t => {
                      const i = doc.artboards.findIndex(a => a.id === t.artboardId)
                      if (i < 0) return null
                      const pts = t.cantosMm!.flatMap(([x, y]) => [x + ps[i].xMm, y + ps[i].yMm])
                      return (
                        <Group key={t.slotId}>
                          <Line points={pts} closed stroke="#dc2626" strokeWidth={2.5} strokeScaleEnabled={false} />
                          <KText x={pts[0]} y={pts[1] - 12 / viewport.escala} text="revise" fontSize={10 / viewport.escala} fill="#dc2626" fontStyle="bold" />
                        </Group>
                      )
                    })}
                  </Layer>
                )}
                {caixaSel && caixaSel.visible && modoEd === 'imagem' && (
                  <Layer>
                    <Group x={ps[iPag].xMm} y={ps[iPag].yMm}>
                      <Rect key={`${caixaSel.id}:${caixaSel.xMm}:${caixaSel.yMm}`}
                        x={caixaSel.xMm + caixaSel.wMm / 2} y={caixaSel.yMm + caixaSel.hMm / 2} offsetX={caixaSel.wMm / 2} offsetY={caixaSel.hMm / 2}
                        width={caixaSel.wMm} height={caixaSel.hMm} rotation={rotSel}
                        stroke="#f97316" strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} fill="rgba(249,115,22,0.04)"
                        draggable={!caixaSel.locked}
                        onPointerDown={e => { e.evt.stopPropagation() }}
                        onDragEnd={e => {
                          const n = e.target
                          const r = (v: number) => Math.round(v * 100) / 100
                          const x = r(n.x() - caixaSel.wMm / 2), y = r(n.y() - caixaSel.hMm / 2)
                          editarCamada(caixaSel.id, 'Mover camada', c => { if (c.type === 'image' || c.type === 'solid' || c.type === 'text' || c.type === 'vshape') { c.xMm = x; c.yMm = y } })
                        }}
                        ref={caixaRef}
                        onTransformEnd={e => {
                          // Sprint 13: alças de escala e giro (como no SOA Design / Photoshop)
                          const n = e.target, r = (v: number) => Math.round(v * 100) / 100
                          const w = r(caixaSel.wMm * Math.abs(n.scaleX())), h = r(caixaSel.hMm * Math.abs(n.scaleY()))
                          const cx = n.x(), cy = n.y(), rot = Math.round(n.rotation() * 10) / 10
                          n.scaleX(1); n.scaleY(1)
                          editarCamada(caixaSel.id, 'Transformar camada', c => {
                            if (c.type !== 'image' && c.type !== 'solid' && c.type !== 'text' && c.type !== 'vshape') return
                            c.wMm = w; c.hMm = h; c.xMm = r(cx - w / 2); c.yMm = r(cy - h / 2)
                            if (c.type !== 'solid') c.rotationDeg = ((rot % 360) + 540) % 360 - 180
                          })
                        }}
                        data-contorno />
                      {!caixaSel.locked && <Transformer ref={transf} onPointerDown={() => { alcaAtiva.current = true }} rotateEnabled={caixaSel.type !== 'solid'} keepRatio={caixaSel.type === 'image'} flipEnabled={false} ignoreStroke anchorSize={8} borderStroke="#f97316" anchorStroke="#f97316" rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]} data-transformador />}
                    </Group>
                  </Layer>
                )}
              </Stage>
            )}
            {modoEd === 'base' && <MenuPrancheta ps={ps} viewport={viewport} />}
            {modoEd === 'tema' && <MenuCamadaTema />}
          </div>
        </div>

        {/* painéis */}
        <aside className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-5 overflow-y-auto" data-painel-propriedades>
          {comFuncoes
            ? modoEd === 'tema' && <LadoPainel lado="propriedades"><PainelTema /></LadoPainel>
            : <>
              {modoEd === 'base' && <PainelBase />}
              {modoEd === 'tema' && <><PainelTema /><PainelTemaPronto /><PainelExportar /><PainelLoja /></>}
            </>}
          {modoEd === 'imagem' && <><PainelDesign /><PainelCamadas /><ExportarImagem />
            <details className="text-xs text-gray-500" data-avancado-motor><summary className="cursor-pointer">Avançado: teste do motor</summary><div className="pt-2"><PainelMotor /></div></details></>}
          <PainelBiblioteca />
          <PainelFontes />
        </aside>
      </div>

      {pergunta && <PerguntaEscopo parte={pergunta.parte} />}
      {tutorial.aberto && <TutorialMae onFechar={tutorial.fechar} />}
      {calibrando && <Calibracao atual={calib} onFechar={() => setCalibrando(false)} onSalvar={k => { setCalib(k); setCalibrando(false) }} />}
    </div>
  )
}

/** "Todas as FRENTES" ou "Só nesta caixa"? (com "lembrar escolha") — spec, Partes e vínculo. */
function PerguntaEscopo({ parte }: { parte: string }) {
  const [lembrar, setLembrar] = useState(false)
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-pergunta-escopo>
      <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl space-y-3 max-w-sm w-full">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Esta mudança vale para…</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-xl border-2 border-orange-400 bg-orange-50 px-3 py-3 text-sm font-semibold text-orange-800" onClick={() => responderEscopo('parte', lembrar)} data-resposta="parte">Todas as {parte}</button>
          <button className="rounded-xl border-2 border-gray-300 px-3 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100" onClick={() => responderEscopo('face', lembrar)} data-resposta="face">Só nesta caixa</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={lembrar} onChange={() => setLembrar(!lembrar)} className="accent-orange-500" /> Lembrar a escolha</label>
        <button className="text-xs text-gray-500 underline" onClick={() => useEditor.getState().set({ pergunta: null })}>Cancelar</button>
      </div>
    </div>
  )
}

/** Tempo da última prévia (o "< 0,3 s" da Sprint 6, à vista). */
function PreviaInfo() {
  const p = useEditor(s => s.previa)
  const modo = useEditor(s => s.modo)
  const sy = useSync()
  return (
    <>
      {p && modo !== 'imagem' && <span className="text-[11px] tabular-nums text-gray-400" title="Tempo para redesenhar todas as folhas" data-previa-ms={p.ms}>atualizado em {p.ms} ms</span>}
      {sy.estado !== 'nunca' && <span className={`text-[11px] ${sy.estado === 'erro' ? 'text-amber-600' : 'text-gray-400'}`} title={sy.mensagem ?? ''} data-sync={sy.estado}>{sy.estado === 'ok' ? '☁ sincronizado' : sy.estado === 'enviando' ? '☁ enviando…' : '☁ não sincronizado'}</span>}
    </>
  )
}

/** PNG com transparência = elemento; foto/papel opaco = papel. */
async function temTransparencia(f: File): Promise<boolean> {
  if (!/png|webp/i.test(f.type)) return false
  const b = await createImageBitmap(f)
  const w = Math.min(64, b.width), h = Math.min(64, b.height)
  const c = new OffscreenCanvas(w, h); const g = c.getContext('2d')!
  g.drawImage(b, 0, 0, w, h); b.close()
  const d = g.getImageData(0, 0, w, h).data
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true
  return false
}

