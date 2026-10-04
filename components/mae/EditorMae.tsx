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
import { Stage, Layer, Shape, Group, Rect } from 'react-konva'
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
import PainelMoldes from './PainelMoldes'
import CamadaMoldes, { fecharLaco } from './CamadaMoldes'
import { useMoldes, editarFaces } from './moldesEditor'
import { excluirFace } from '@/lib/mae/faces/ferramentas'
import { acoes, editarCamada } from './acoesCamadas'
import { usePrevias, resolucaoDaPrevia, garantirGrade, type PrancheteComCamadas } from './motorEditor'
import PainelBase from './PainelBase'
import PainelTema, { TIPO_ARRASTE } from './PainelTema'
import PainelExportar from './PainelExportar'
import PainelLoja, { useLojaAberta } from './PainelLoja'
import BarraPedido, { useAbrirPedidoDaUrl } from './BarraPedido'
import EdicaoEmMassa from './EdicaoEmMassa'
import TutorialMae, { useTutorial } from './TutorialMae'
import { usePedidoAberto, apiMae, type Addons } from './pedidosMae'
import { useEditor, responderEscopo, type ModoEditor } from './estado'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { localizarNoMundo, faceSemFuroNoPonto } from './CamadaMoldes'
import { soltarNaFace } from './acoesVinculo'
import { guardarImagem, infoImagem, lerIdentidade } from './arquivosMae'
import { registroFontes, garantirFontesDoTema, useFontes } from './fontesTexto'
import { useSync } from './sincronia'
import type { InfoTexto } from '@/lib/mae/texto/noTexto'


/** Pranchetas lado a lado, separadas por 20 mm (cada uma com origem própria em mm). */
const ESPACO_MM = 20
function posicoes(artboards: { widthMm: number; heightMm: number }[]) {
  let x = 0
  return artboards.map(a => { const p = { xMm: x, yMm: 0 }; x += a.widthMm + ESPACO_MM; return p })
}
function limites(artboards: { widthMm: number; heightMm: number }[]): Retangulo {
  const ps = posicoes(artboards)
  const wMm = artboards.reduce((s, a, i) => Math.max(s, ps[i].xMm + a.widthMm), 0)
  const hMm = artboards.reduce((s, a) => Math.max(s, a.heightMm), 0)
  return { xMm: 0, yMm: 0, wMm, hMm }
}

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

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
  const valoresPedido = usePedidoAberto(s => s.valores)
  const [massa, setMassa] = useState(false)
  const [addons, setAddons] = useState<Addons | null>(null)
  useEffect(() => { apiMae.addons().then(setAddons).catch(() => null) }, [])
  const tutorial = useTutorial()
  // item do menu "Método MAE": abre o editor direto na função
  useEffect(() => {
    if (!secao) return
    if (secao === 'base' || secao === 'tema' || secao === 'imagem') useEditor.getState().set({ modo: secao, face: null, camada: null, posicionar: null })
    else if (secao === 'pedidos') setMassa(true)
    else if (secao === 'loja') { useEditor.getState().set({ modo: 'tema', face: null, camada: null }); useLojaAberta.setState({ aberta: true }) }
    else if (secao === 'ajuda') tutorial.abrir()
  }, [secao]) // eslint-disable-line react-hooks/exhaustive-deps
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
      if (modoEd === 'imagem') return { id: ab.id, widthMm: ab.widthMm, heightMm: ab.heightMm, layers: ab.layers ?? [] }
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
      else if (e.key === 'Escape') {
        const m = useMoldes.getState()
        if (m.pontos.length || m.modo !== 'selecionar') m.set({ pontos: [], moldeDosPontos: null, modo: 'selecionar' })
        else { m.set({ face: null, medida: null }); useMaeDoc.getState().setSelecao(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desfazer, refazer, fazerAjustar, fazerTamanhoReal, zoomCentro])

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
  const onDown = (e: React.PointerEvent) => { if (useMoldes.getState().modo !== 'selecionar' && e.button === 0) return; const v = useMaeDoc.getState().viewport; arrasto.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }
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
  const sel = selecao && doc.artboards[0]?.layers ? acharCamada(doc.artboards[0].layers, selecao)?.no ?? null : null
  const caixaSel = sel && (sel.type === 'image' || sel.type === 'solid') ? sel : null
  const rotSel = caixaSel?.type === 'image' ? caixaSel.rotationDeg : 0

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[560px]" data-editor-mae>
      {/* barra */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-900">
        <span className="text-sm font-semibold text-gray-900 dark:text-white mr-1">Método MAE</span>
        <span className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mr-2" data-modos>
          {([['base', 'Base'], ['tema', 'Tema'], ['imagem', 'Imagem']] as [ModoEditor, string][]).map(([m, r]) => (
            <button key={m} className={`px-2.5 py-1.5 text-xs font-medium ${modoEd === m ? 'bg-orange-500 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={() => useEditor.getState().set({ modo: m, face: null, camada: null, posicionar: null })} data-modo-editor={m}>{r}</button>
          ))}
        </span>
        <select value={folha} onChange={e => setFolha(e.target.value as Folha | 'personalizada')} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs" data-folha>
          <option value="A4">A4 (210 × 297 mm)</option><option value="A5">A5 (148 × 210 mm)</option><option value="A6">A6 (105 × 148 mm)</option><option value="personalizada">Personalizada</option>
        </select>
        {folha === 'personalizada' ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <input inputMode="decimal" value={pers.w} onChange={e => setPers(p => ({ ...p, w: e.target.value }))} className="w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1.5" aria-label="Largura em mm" /> ×
            <input inputMode="decimal" value={pers.h} onChange={e => setPers(p => ({ ...p, h: e.target.value }))} className="w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1.5" aria-label="Altura em mm" /> mm
          </span>
        ) : (
          <select value={orient} onChange={e => setOrient(e.target.value as Orientacao)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs">
            <option value="retrato">Retrato</option><option value="paisagem">Paisagem</option>
          </select>
        )}
        <button className={btn} onClick={() => criarPrancheta()} data-nova-prancheta><FilePlus2 className="w-3.5 h-3.5" /> Nova prancheta</button>
        <button className={btn} onClick={() => criarPrancheta(true)} title="Acrescenta mais uma folha ao lado (várias pranchetas na mesma base)" data-adicionar-prancheta>+ Folha</button>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button className={btn} onClick={desfazer} disabled={!ultimoDesfazer} title={ultimoDesfazer ? `Desfazer: ${ultimoDesfazer} (Ctrl+Z)` : 'Nada para desfazer'} data-desfazer><Undo2 className="w-3.5 h-3.5" /></button>
        <button className={btn} onClick={refazer} disabled={!ultimoRefazer} title={ultimoRefazer ? `Refazer: ${ultimoRefazer} (Ctrl+Shift+Z)` : 'Nada para refazer'} data-refazer><Redo2 className="w-3.5 h-3.5" /></button>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button className={btn} onClick={fazerAjustar} title="Ajustar à tela (Ctrl+0)"><Maximize className="w-3.5 h-3.5" /> Ajustar</button>
        <button className={btn} onClick={fazerTamanhoReal} title="Tamanho real — 100 mm na tela = 100 mm (Ctrl+1)" data-tamanho-real><Ruler className="w-3.5 h-3.5" /> Tamanho real</button>
        <button className={btn} onClick={() => zoomCentro(0.8)} title="Diminuir (Ctrl −)"><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-xs tabular-nums w-12 text-center text-gray-600 dark:text-gray-300" data-zoom>{zoomPercentual(viewport, calib)}%</span>
        <button className={btn} onClick={() => zoomCentro(1.25)} title="Aumentar (Ctrl +)"><ZoomIn className="w-3.5 h-3.5" /></button>
        <button className={btn + (calib === CALIBRACAO_PADRAO ? ' !border-orange-300' : '')} onClick={() => setCalibrando(true)} title="Medir a tela com um cartão para o tamanho real ficar exato">Calibrar tela</button>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button className={btn} onClick={() => setMassa(true)} disabled={!addons?.addons.massa.ativo}
          title={addons?.addons.massa.ativo ? 'Edição em massa: todos os pedidos pendentes de arte' : `Add-on "Edição em massa" ${addons?.addons.massa.preco ? `· R$ ${addons.addons.massa.preco.toFixed(2).replace('.', ',')}/mês` : '· em breve'}`} data-abrir-massa>Pedidos (massa)</button>
        <button className={btn} onClick={tutorial.abrir} title="Como usar o Método MAE" aria-label="Tutorial" data-abrir-tutorial>?</button>
        <PreviaInfo />
        <span className="ml-auto text-[11px] text-gray-400" data-medidas>{doc.artboards.map(a => `${a.widthMm} × ${a.heightMm} mm`).join(' · ')}</span>
      </div>
      <BarraPedido />

      <div className="flex flex-1 min-h-0">
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
              const alt = e.altKey
              if (!raiz || !faceId) return
              ;(async () => {
                const itens = caminho ? [await infoImagem(raiz, caminho)] : await Promise.all(arquivos.map(async f => guardarImagem(raiz, f, await temTransparencia(f) ? 'Elementos' : 'Papéis')))
                for (const it of itens) soltarNaFace(faceId, achado!.local, it, alt)
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
                <CamadaMoldes posicoes={ps} escala={viewport.escala} />
                {caixaSel && caixaSel.visible && doc.artboards[0] && (
                  <Layer>
                    <Group x={ps[0].xMm} y={ps[0].yMm}>
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
                          editarCamada(caixaSel.id, 'Mover camada', c => { if (c.type === 'image' || c.type === 'solid') { c.xMm = x; c.yMm = y } })
                        }}
                        data-contorno />
                    </Group>
                  </Layer>
                )}
              </Stage>
            )}
          </div>
        </div>

        {/* painéis */}
        <aside className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-5 overflow-y-auto">
          {modoEd === 'base' && <PainelBase />}
          {modoEd === 'tema' && <><PainelTema /><PainelExportar /><PainelLoja /></>}
          {modoEd === 'imagem' && <><PainelMoldes /><PainelCamadas /><PainelMotor /></>}
          <PainelBiblioteca />
          <PainelFontes />
        </aside>
      </div>

      {pergunta && <PerguntaEscopo parte={pergunta.parte} />}
      {massa && <EdicaoEmMassa onFechar={() => setMassa(false)} />}
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

