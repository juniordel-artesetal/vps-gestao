'use client'
'use no memo'
// Moldes e faces no palco (interface, não arte): a prévia das linhas do molde, as faces (cor por estado)
// e as arestas — CORTE em vermelho contínuo, DOBRA em azul tracejado. Os cliques das ferramentas são
// tratados aqui por geometria (ponto no polígono), com ímã opcional no centro da linha.
import { useDocVisivel, temaAbertoId, idsDosTextos } from './textosDoTemaUi'
import { marcarDono } from '@/lib/mae/vinculo/textosDoTema'
import { Layer, Group, Image as KImage, Line, Rect, Circle, Text, Shape } from 'react-konva'
import type Konva from 'konva'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { area, centroide, dentro, type Pt } from '@/lib/mae/faces/geometria'
import { dividirFace, ima, lacoParaFace, unirFaces } from '@/lib/mae/faces/ferramentas'
import { tiposDeArestas } from '@/lib/mae/faces/detectar'
import { editarFaces, preparadoDe, useMoldes, PX_MM_DETECCAO, areaDentroDoMolde } from './moldesEditor'
import { equivalentesDaSelecao } from './PainelMoldes'
import type { DocTrabalho } from '@/lib/mae/schema'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { parteDaFace, sugerirParaParte } from '@/lib/mae/vinculo/partes'
import { quadroDaFace, type Quadro } from '@/lib/mae/vinculo/enquadramento'
import { aplicar as aplicarM, inversa } from '@/lib/mae/vinculo/matriz'
import { efetiva, ajustesDaFace, matrizDaCamada, posicaoEfetiva, areaPassaDaFace, ehAplique, type CamadaImagemTema } from '@/lib/mae/vinculo/resolver'
import CaixaTransformavel, { anguloFinal, cantosGirados } from './CaixaTransformavel'
import { escalarPosicao } from '@/lib/mae/editor/posicaoTexto'
import { usePedidoAberto, ajustarTextoDoPedido } from './pedidosMae'
import type { DocTema } from '@/lib/mae/schema'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { pilhaNoPonto, escolherNaPilha, type ItemPilha } from '@/lib/mae/vinculo/pilha'
import { liderDoCenario, arteDaFace, facesDoCenario } from '@/lib/mae/vinculo/cenario'
import { aplicarEstrutura, estruturaDaPeca, type Estrutura } from '@/lib/mae/medidas/pecas'
import { useEditor, teclasMae } from './estado'
import { alternarFaceNaParte, editarCamadaTema, duplicarCamada, alternarNaSelecao, transformarGrupoSelecionado, grupoDaSelecao, transformarSelecao } from './acoesVinculo'
import { grupoDe, gruposDo, membrosNaFace } from '@/lib/mae/vinculo/gruposTema'
import { juntarUltimos } from '@/lib/mae/editor/linhaDoTempo'
import { infoEmCache } from './arquivosMae'
import { useFotoCamada } from './fotoCamada'
import { useRef } from 'react'
import { COR_PARTE } from './PainelBase'
import { duplicarPosicao, moverParaFace } from '@/lib/mae/editor/textosReplicar'
import { caixaNaFolha, daFolha, giroDo, paraFolha } from '@/lib/mae/editor/giroMolde'
import { marcarRefTexto } from '@/lib/mae/vinculo/tema'

type Molde = DocTrabalho['molds'][number]
const COR = { corte: '#dc2626', dobra: '#2563eb', sel: 'rgba(249,115,22,0.35)', eq: 'rgba(245,158,11,0.28)', furo: 'rgba(100,116,139,0.30)', face: 'rgba(14,165,233,0.07)' }

/** Face de verdade (não furo) sob o ponto. */
export function faceSemFuroNoPonto(m: Molde, p: Pt): string | null {
  let melhor: { id: string; a: number } | null = null
  for (const f of m.faces) {
    if (f.hole) continue
    const pol = f.polygonMm as Pt[]
    if (!dentro(p, pol)) continue
    const a = area(pol)
    if (!melhor || a < melhor.a) melhor = { id: f.id, a }
  }
  return melhor?.id ?? null
}

/** Quadro (enquadramento) de uma face: o da instância da parte, ou o padrão. */
export function quadroDe(d: DocTrabalho, m: Molde, faceId: string): Quadro | null {
  const f = m.faces.find(x => x.id === faceId)
  if (!f) return null
  const parte = parteDaFace(d, faceId)
  const inst = parte?.instances.find(i => i.faceId === faceId)
  return quadroDaFace(f.polygonMm as Pt[], inst?.fit, parte?.referenceAspect ?? 1)
}

/** Ponto do palco (mm do mundo) → molde e ponto local (para soltar arquivos). */
export function localizarNoMundo(d: DocTrabalho, posicoes: { xMm: number; yMm: number }[], mundo: Pt): { m: Molde; local: Pt } | null {
  const abPos = new Map(d.artboards.map((a, i) => [a.id, posicoes[i]]))
  for (const m of d.molds) {
    const p = abPos.get(m.artboardId); if (!p) continue
    // Lote 4 (item 41): a caixa do molde na folha já considera o giro; o ponto local desfaz o giro
    const c = caixaNaFolha(m), ox = p.xMm + c.x, oy = p.yMm + c.y
    if (mundo[0] >= ox && mundo[1] >= oy && mundo[0] <= ox + c.w && mundo[1] <= oy + c.h) return { m, local: daFolha(m, [mundo[0] - p.xMm, mundo[1] - p.yMm]) }
  }
  return null
}

/** Face (do molde) sob o ponto local: a de menor área que contém o ponto (furo ganha da face em volta). */
function faceNoPonto(m: Molde, p: Pt): string | null {
  let melhor: { id: string; a: number } | null = null
  for (const f of m.faces) {
    const pol = f.polygonMm as Pt[]
    if (!dentro(p, pol)) continue
    const a = area(pol)
    if (!melhor || a < melhor.a) melhor = { id: f.id, a }
  }
  return melhor?.id ?? null
}

const cursorPalco = (ev: Konva.KonvaEventObject<MouseEvent>, c: string) => { const el = ev.target.getStage()?.container(); if (el) el.style.cursor = c }
/** Prévia ao vivo das alças do tema: redesenha o contorno do grupo enquanto arrasta (sem esperar soltar). */
const previaContorno = (ev: Konva.KonvaEventObject<DragEvent>, pts: Pt[]) => {
  const l = ev.target.getParent()?.findOne('.contorno-tema') as Konva.Line | undefined
  if (l) { l.points(pts.flat()); l.getLayer()?.batchDraw() }
}

/** Lote 21 (item 253): o cadeadinho recalcula no máximo a cada 90 ms (mover o mouse não pesa). */
const hoverMs = { ultimo: 0 }

export default function CamadaMoldes({ posicoes, escala }: { posicoes: { xMm: number; yMm: number }[]; escala: number }) {
  const doc = useDocVisivel()   // Lote 18: só os textos que valem no tema aberto
  const { modo, face, pontos, moldeDosPontos, medida, ima: comIma, sel: moldesSel } = useMoldes()
  useMoldes(s => s.versao)   // redesenha quando a prévia de um molde fica pronta
  const set = useMoldes.getState().set
  const ed = useEditor()
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  // Lote 9 (itens 135/136): FOTO da camada selecionada (carrega ao selecionar) e o arraste em andamento
  const camSelTema = ed.modo === 'tema' && tema && ed.camada ? acharCamadaTema(tema, ed.camada) : null
  const fotoSel = useFotoCamada(camSelTema && camSelTema.c.type === 'image' ? camSelTema.c as { path: string; sha256: string } : null)
  const arrastando = useEditor(s => s.arrastando)
  const fotoRef = useRef<Konva.Shape | null>(null)
  const faceDaArte = (f: string) => !!f && !!parteDe.get(f)
  /** O arraste começou pelo clique direto na arte (um gesto só): não re-escolhe o objeto no início do arraste. */
  const arrasteDireto = useRef(false)
  /** O clique que vem depois do arraste direto não deve re-selecionar (com Alt, desceria mais um na pilha). */
  const ignorarClique = useRef(false)
  // o botão ainda está apertado? (clique rápido solta antes dos 2 quadros — aí NÃO pode começar o arraste: o objeto
  // ficava grudado no mouse até o clique seguinte)
  const botaoApertado = useRef(false)
  const marcarApertado = () => { botaoApertado.current = true; window.addEventListener('pointerup', () => { botaoApertado.current = false }, { once: true, capture: true }) }
  const valoresPedido = usePedidoAberto(s => s.valores)
  // Lote 13 (item 185): o lado da área que segura o nome (para destacar na arte)
  const infosTextoArte = useEditor(s => s.textos)
  if (!doc.molds.length) return null
  const vinculo = ed.modo === 'tema' || (ed.modo === 'base' && ed.passo >= 4)
  const sugestoes = ed.modo === 'base' && ed.passo === 4 && ed.parteAtiva ? new Set(sugerirParaParte(doc, ed.parteAtiva).map(x => x.faceId)) : new Set<string>()
  const corDaParte = new Map(doc.parts.map((p, i) => [p.id, COR_PARTE[i % COR_PARTE.length]]))
  const parteDe = new Map(doc.parts.flatMap(p => p.instances.map(i => [i.faceId, p] as const)))

  const eqs = face ? new Set(equivalentesDaSelecao().map(e => `${e.moldeId}/${e.faceId}`)) : new Set<string>()
  const abPos = new Map(doc.artboards.map((a, i) => [a.id, posicoes[i]]))
  const abDe = (m: Molde) => abPos.get(m.artboardId) ?? { xMm: 0, yMm: 0 }
  /** Lote 4 (item 41): ponto (0,0) do molde no mundo — o "grupo" do molde fica aqui, girado `giroDo(m)`. */
  const origem = (m: Molde): Pt => { const p = abDe(m), o = paraFolha(m, [0, 0]); return [p.xMm + o[0], p.yMm + o[1]] }
  /** Ponto local do molde → mundo, e mundo → local (com o giro). */
  const noMundo = (m: Molde, l: Pt): Pt => { const p = abDe(m), f = paraFolha(m, l); return [p.xMm + f[0], p.yMm + f[1]] }
  const doMundo = (m: Molde, w: Pt): Pt => { const p = abDe(m); return daFolha(m, [w[0] - p.xMm, w[1] - p.yMm]) }
  const fino = 1 / escala

  /** Clique no palco → (prancheta, molde, ponto local). */
  function localizar(e: Konva.KonvaEventObject<MouseEvent>) {
    const st = e.target.getStage(); const p = st?.getPointerPosition(); if (!st || !p) return null
    const mundo: Pt = [(p.x - st.x()) / escala, (p.y - st.y()) / escala]
    const m = doc.molds.find(mm => {
      const p = abDe(mm), c = caixaNaFolha(mm)
      return mundo[0] >= p.xMm + c.x && mundo[1] >= p.yMm + c.y && mundo[0] <= p.xMm + c.x + c.w && mundo[1] <= p.yMm + c.y + c.h
    }) ?? null
    let local: Pt | null = null
    if (m) {
      local = doMundo(m, mundo)
      const prep = preparadoDe(m.id)
      if (comIma && prep && modo !== 'selecionar' && modo !== 'unir') local = ima(local, prep.linhas, prep.pxPorMm, 2)
    }
    const ab = doc.artboards.find(a => { const q = abPos.get(a.id)!; return mundo[0] >= q.xMm && mundo[1] >= q.yMm && mundo[0] <= q.xMm + a.widthMm && mundo[1] <= q.yMm + a.heightMm })
    return { mundo, m, local, ab }
  }

  /**
   * Lote 6 (item 81): o que está SOB o ponto, de cima para baixo (textos e apliques → elementos, formas e moldurinha
   * → papel). Camada travada (cadeado) não se seleciona na arte.
   */
  function pilhaAqui(m: Molde, faceId: string, local: Pt, soTextos = false, comTravados = false): ItemPilha[] {
    if (!tema) return []
    const q = quadroDe(doc, m, faceId); if (!q) return []
    const f = m.faces.find(x => x.id === faceId); if (!f) return []
    // Lote 9 (item 136): as camadas são testadas onde são DESENHADAS (cenário contínuo: quadro das faces juntas)
    const arte = arteDaFace(doc, tema, m, faceId)
    // Lote 21 (item 253): o travado fica fora do clique (passa para o de baixo); só o botão direito o enxerga
    const p = pilhaNoPonto({ doc, tema, faceId, poligono: f.polygonMm as Pt[], local, quadro: q, valores: valoresPedido, quadroArte: arte?.quadro, poligonoArte: arte?.poligono, comTravados })
    return soTextos ? p.filter(x => x.tipo === 'texto') : p
  }

  function cliqueVinculo(m: Molde | null, local: Pt | null, ctrl = false, alt = false, shift = false, membro = false) {
    const es = useEditor.getState()
    const faceId = m && local ? faceSemFuroNoPonto(m, local) : null
    if (es.modo === 'tema') {
      // Lote 4 (item 34): Ctrl + clique na FACE soma/tira a parte da seleção (como nas miniaturas)
      const somarParte = () => {
        const p = faceId ? parteDe.get(faceId) : null
        if (!p) return
        const atual = es.partesSel.length ? es.partesSel : es.parteAtiva ? [es.parteAtiva] : []
        const nova = atual.includes(p.id) ? atual.filter(x => x !== p.id) : [...atual, p.id]
        es.set({ partesSel: nova.length > 1 ? nova : [], parteAtiva: nova.at(-1) ?? p.id, face: faceId, camada: null, slot: null, multiSel: [], grupoSel: null })
      }
      // Lote 22 (item 261): Ctrl + clique num ELEMENTO/texto soma o item (como o Shift); sem elemento em cima, a PARTE
      if (ctrl && faceId && m && local) {
        const pc = pilhaAqui(m, faceId, local, false), ac = escolherNaPilha(pc, es.slot ?? es.camada, alt)
        if (ac && !(ac.tipo === 'camada' && ac.papel)) { alternarNaSelecao({ tipo: ac.tipo, id: ac.id }); return }
      }
      if (ctrl && faceId) { somarParte(); return }
      // Lote 6 (item 84): clicou DENTRO do molde numa área branca que não é face → por quê + "Criar face aqui"
      if (m && local && !faceId && !m.faces.some(f => dentro(local, f.polygonMm as Pt[])) && areaDentroDoMolde(m.id, local)) useMoldes.getState().set({ semFace: { moldeId: m.id, ponto: local } })
      else if (useMoldes.getState().semFace) useMoldes.getState().set({ semFace: null })
      // Lote 5 (item 59): "Ajustar" do pedido — o tema fica travado: só os textos se selecionam
      const soTextos = !!(usePedidoAberto.getState().ajustar && usePedidoAberto.getState().pedido)
      // Lote 6 (item 81): seleciona o objeto DE CIMA no ponto; Alt + clique desce para o de baixo (como no Photoshop)
      const pilha = m && local && faceId ? pilhaAqui(m, faceId, local, soTextos) : []
      const alvo = escolherNaPilha(pilha, es.slot ?? es.camada, alt)
      // Lote 9 (item 142): Shift + clique num ELEMENTO/texto soma o item à seleção (para agrupar)
      if (shift && alvo && !(alvo.tipo === 'camada' && alvo.papel)) { alternarNaSelecao({ tipo: alvo.tipo, id: alvo.id }); return }
      // Lote 21 (item 251): Shift + clique na FACE (só papel/cor, sem elemento em cima) soma/tira a PARTE — como o Ctrl
      if (shift && faceId) { somarParte(); return }
      // Lote 9 (item 142): item de um GRUPO → seleciona o grupo (move, gira e redimensiona junto); duplo clique = o item
      const grupo = !membro && alvo && tema ? grupoDe(tema, alvo.tipo === 'camada' ? { camada: alvo.id } : { variavel: doc.textSlots.find(x => x.id === alvo.id)?.variable, parte: faceId ? parteDe.get(faceId)?.id : null }) : null
      if (grupo && faceId) { es.set({ grupoSel: grupo.id, face: faceId, camada: null, slot: null, multiSel: [], parteAtiva: grupo.parte }); return }
      if (es.grupoSel || es.multiSel.length) es.set({ grupoSel: null, multiSel: [] })
      if (alvo?.tipo === 'texto') { es.set({ slot: alvo.id, face: faceId, camada: null }); return }
      if (es.slot) es.set({ slot: null })
      if (soTextos) return
      // Lote 6 (item 104): face de um CENÁRIO → a edição vai para a face líder (o cenário é uma peça só)
      const lid = faceId && tema ? liderDoCenario(doc, tema, faceId) : null
      const faceSel = lid?.faceId ?? faceId
      const parte = faceSel ? parteDe.get(faceSel) : null
      // Lote 5 (item 69): clicou numa FACE na arte → "Só nesta caixa" (clicar na parte no painel volta para todas)
      es.set({ face: parte ? faceSel : null, parteAtiva: parte?.id ?? es.parteAtiva, camada: alvo?.id ?? null, ...(parte ? { escopo: 'face' as const } : {}), ...(es.partesSel.length ? { partesSel: [] } : {}) })
      return
    }
    if (es.passo === 4) { if (faceId) alternarFaceNaParte(faceId); return }
    if (es.passo === 6 && es.posicionar?.tipo === 'texto' && m && faceId && local) {
      const q = quadroDe(doc, m, faceId)!
      const [u, v] = aplicarM(inversa(q.face), local[0], local[1])
      const w = 0.8, h = 0.18, r3 = (x: number) => Math.round(x * 1000) / 1000
      const variavel = es.posicionar.variavel
      // Lote 10 (item 164): a letra nasce proporcional à face (numa face pequena, 28 pt não cabia e o nome passava)
      const hMm = h * q.h, pt = (mm: number) => Math.round((mm / (25.4 / 72)) * 10) / 10
      const ptSimples = Math.min(variavel === 'NOME' ? 28 : 18, pt(hMm / 1.3)), ptComposto = Math.min(variavel === 'NOME' ? 22 : 16, pt(hMm / 2.2))
      const id = `ts_${variavel.toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`
      useMaeDoc.getState().aplicar(`Posicionar ${variavel}`, d => {
        d.textSlots.push({ id, variable: variavel, faceId, box: { x: r3(Math.min(Math.max(u - w / 2, 0), 1 - w)), y: r3(Math.min(Math.max(v - h / 2, 0), 1 - h)), w, h },
          single: { lines: 1, sizePt: Math.max(4, ptSimples) }, compound: { lines: 2, sizePt: Math.max(4, ptComposto), lineHeight: 0.9 }, autoFit: { minScale: 0.4 } })
      })
      es.set({ slot: id, face: faceId })
      return
    }
    if (es.passo === 6 && m && local) {
      const sl = doc.textSlots.find(t => {
        if (!m.faces.some(f => f.id === t.faceId)) return false
        const q = quadroDe(doc, m, t.faceId); if (!q) return false
        const [u, v] = aplicarM(inversa(q.face), local[0], local[1])
        return u >= t.box.x && u <= t.box.x + t.box.w && v >= t.box.y && v <= t.box.y + t.box.h
      })
      es.set({ slot: sl?.id ?? null, face: faceId })
      return
    }
    if (es.passo === 7 && (es.posicionar?.tipo === 'logo' || es.posicionar?.tipo === 'qr') && m && local) {
      const k = es.posicionar.tipo
      const arq = es.identidade[k]
      const w = k === 'logo' ? 15 : 14, h = w / (arq?.aspect || 1), r2 = (x: number) => Math.round(x * 100) / 100
      useMaeDoc.getState().aplicar(`Posicionar ${k === 'logo' ? 'logo' : 'QR'}`, d => {
        const dm = d.molds.find(x => x.id === m.id); if (!dm) return
        dm.identity = { ...(dm.identity ?? {}), [k]: { xMm: r2(local[0] - w / 2), yMm: r2(local[1] - h / 2), wMm: w } }
      })
      return
    }
    if (es.passo === 7 && m && local) {
      const k = (['qr', 'logo'] as const).find(k => {
        const pos = m.identity?.[k]; if (!pos) return false
        const h = pos.wMm / (es.identidade[k]?.aspect || 1)
        return local[0] >= pos.xMm && local[0] <= pos.xMm + pos.wMm && local[1] >= pos.yMm && local[1] <= pos.yMm + h
      })
      es.set({ identSel: k ? { moldeId: m.id, k } : null })
      if (k) return
    }
    const parte = faceId ? parteDe.get(faceId) : null
    es.set({ face: faceId, ...(parte ? { parteAtiva: parte.id } : {}) })
  }

  /**
   * Lote 9 (item 136): CLICAR E ARRASTAR direto na arte, num gesto só — apertar o mouse sobre um elemento, forma ou
   * aplique (de qualquer face, inclusive cenário contínuo) já seleciona e começa a arrastar. Antes só o que já estava
   * selecionado tinha alça; apertar sobre o resto movia a vista. Papel e cor ficam de fora (o arraste em cima deles
   * continua movendo a vista); cadeado não se move. Alt = o de baixo.
   */
  function pegarNaArte(e: Konva.KonvaEventObject<PointerEvent>) {
    const es = useEditor.getState()
    // o arraste iniciado aqui (startDrag) não gera "click" no fim — sem isto o PRÓXIMO clique era engolido
    ignorarClique.current = false
    if (es.modo !== 'tema' || !tema || e.evt.button !== 0 || e.evt.ctrlKey || e.evt.metaKey || modo !== 'selecionar' || teclasMae.espaco) return
    if (usePedidoAberto.getState().ajustar && usePedidoAberto.getState().pedido) return
    const l = localizar(e as unknown as Konva.KonvaEventObject<MouseEvent>); if (!l?.m || !l.local) return
    const faceId = faceSemFuroNoPonto(l.m, l.local); if (!faceId) return
    const alvo = escolherNaPilha(pilhaAqui(l.m, faceId, l.local), es.slot ?? es.camada, e.evt.altKey)
    if (e.evt.shiftKey) return
    // Lote 9 (item 142): item de grupo → seleciona e arrasta o GRUPO inteiro
    const grupo = alvo && !(alvo.tipo === 'camada' && alvo.papel) ? grupoDe(tema, alvo.tipo === 'camada' ? { camada: alvo.id } : { variavel: doc.textSlots.find(x => x.id === alvo.id)?.variable, parte: parteDe.get(faceId)?.id }) : null
    if (grupo && !grupo.locked) {
      e.evt.stopPropagation()
      es.set({ grupoSel: grupo.id, face: faceId, camada: null, slot: null, multiSel: [], parteAtiva: grupo.parte })
      ignorarClique.current = true
      marcarApertado()
      const st0 = e.target.getStage()
      requestAnimationFrame(() => requestAnimationFrame(() => { const n = st0?.findOne('.contorno-grupo'); if (n && botaoApertado.current) n.startDrag() }))
      return
    }
    if (!alvo || alvo.tipo !== 'camada' || alvo.papel) return
    const c = alvo.camada as { type: string; locked?: boolean }
    if ((c.type !== 'image' && c.type !== 'shape' && c.type !== 'conjunto') || c.locked) return
    e.evt.stopPropagation()                  // não move a vista
    cliqueVinculo(l.m, l.local, false, e.evt.altKey)
    ignorarClique.current = true
    arrasteDireto.current = true
    marcarApertado()
    // o contorno da camada aparece no próximo quadro; o arraste continua nele com o mouse ainda apertado
    const st = e.target.getStage()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const n = st?.findOne('.contorno-tema')
      if (n && botaoApertado.current) n.startDrag(); else arrasteDireto.current = false
    }))
  }

  /** Lote 21 (item 253): passando o mouse sobre um item TRAVADO aparece o cadeadinho (o clique passa para o de baixo). */
  function hoverTravado(e: Konva.KonvaEventObject<MouseEvent>) {
    const es = useEditor.getState()
    if (es.modo !== 'tema' || !tema) return
    const agora = performance.now(); if (agora - hoverMs.ultimo < 90) return
    hoverMs.ultimo = agora
    const l = localizar(e); const faceId = l?.m && l.local ? faceSemFuroNoPonto(l.m, l.local) : null
    const topo = faceId && l?.m && l.local ? pilhaAqui(l.m, faceId, l.local, false, true)[0] : null
    const trava = topo?.travado ? { x: e.evt.clientX, y: e.evt.clientY, nome: topo.nome } : null
    if (!!trava !== !!es.travaHover || (trava && es.travaHover && (Math.abs(trava.x - es.travaHover.x) > 3 || Math.abs(trava.y - es.travaHover.y) > 3))) es.set({ travaHover: trava })
  }

  /** Botão direito no tema (Lote 2, item 16): acha o ELEMENTO de cima sob o cursor e abre o menu dele. */
  function menuDireito(e: Konva.KonvaEventObject<PointerEvent | MouseEvent>) {
    const es = useEditor.getState()
    if (es.modo !== 'tema' || !tema) return
    e.evt.preventDefault()
    const l = localizar(e as Konva.KonvaEventObject<MouseEvent>); if (!l?.m || !l.local) return
    const faceId = faceSemFuroNoPonto(l.m, l.local); if (!faceId) return
    const parte = parteDe.get(faceId); if (!parte) return
    // Lote 6 (item 81): o menu vale para QUALQUER camada sob o cursor (elemento, forma, moldurinha, papel)
    // Lote 10 (item 152): o objeto DE CIMA — texto incluído (antes pulava o texto e abria o menu do papel de baixo)
    // Lote 21 (item 253): o menu abre MESMO no travado (para "Destravar"); "Selecionar o que está embaixo" = o próximo
    // não travado da pilha
    const pilha = pilhaAqui(l.m, faceId, l.local, false, true)
    const achada = pilha[0]
    const de = pilha.slice(1).find(x => !x.travado)
    const abaixo = de ? { tipo: de.tipo, id: de.id } : undefined
    if (!achada) { es.set({ menuCamada: null }); return }
    if (achada.tipo === 'texto') { es.set({ slot: achada.id, camada: null, face: faceId, parteAtiva: parte.id, menuCamada: { x: e.evt.clientX, y: e.evt.clientY, camada: '', texto: achada.id, abaixo } }); return }
    // Lote 9 (item 136): no cenário a caixa da edição é a LÍDER (é lá que ficam as camadas e os ajustes)
    const arte = arteDaFace(doc, tema, l.m, faceId)
    const faceSel = arte?.faceArte ?? faceId
    // a seleção acompanha o menu (antes o texto selecionado continuava e "Excluir" apagava o texto, não a camada)
    es.set({ face: faceSel, parteAtiva: parteDe.get(faceSel)?.id ?? parte.id, camada: achada.id, slot: null, menuCamada: { x: e.evt.clientX, y: e.evt.clientY, camada: achada.id, abaixo } })
  }

  /** Lote 8 (item 123): geometria do texto do tema na face (caixa efetiva, centro, cantos girados) e como gravar o ajuste
   *  (no tema — só nesta caixa — ou, no Ajustar, só no pedido). */
  function geoTexto(m: Molde, t: DocTrabalho['textSlots'][number]) {
    if (!tema) return null
    const q = quadroDe(doc, m, t.faceId); if (!q) return null
    const ef = posicaoEfetiva(t, tema, valoresPedido)
    const b = ef.caixa
    const [cx, cy] = aplicarM(q.face, b.x + b.w / 2, b.y + b.h / 2)
    const g = (ef.rotacaoDeg * Math.PI) / 180
    const cs = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([u, v]) => aplicarM(q.face, u, v))
      .map(([x, y]) => [cx + (x - cx) * Math.cos(g) - (y - cy) * Math.sin(g), cy + (x - cx) * Math.sin(g) + (y - cy) * Math.cos(g)] as Pt)
    const aj = tema.textSlotAdjust?.[t.id] ?? {}
    const soPedido = !!(usePedidoAberto.getState().ajustar && usePedidoAberto.getState().pedido)
    const ajustar = (label: string, f: (a: NonNullable<DocTema['textSlotAdjust']>[string]) => void) => soPedido
      ? ajustarTextoDoPedido(t.id, a => f(a as never))
      : useMaeTema.getState().aplicar(`${label} (só nesta caixa)`, tt => {
        const x = tt as DocTema; x.textSlotAdjust ??= {}; const a = (x.textSlotAdjust[t.id] ??= {}); f(a)
      })
    return { q, ef, b, cx, cy, cs, aj, soPedido, ajustar }
  }
  const soPedidoTexto = () => !!(usePedidoAberto.getState().ajustar && usePedidoAberto.getState().pedido)
  /** Soltou o texto do tema depois de arrastar `dx, dy` (mm do molde). */
  function moverTextoTema(m: Molde, t: DocTrabalho['textSlots'][number], dx: number, dy: number, alt: boolean) {
    const gt = geoTexto(m, t); if (!gt) return
    const { q, b, cx, cy, aj, soPedido, ajustar } = gt
    // Lote 5 (item 56): soltou sobre OUTRA face (em qualquer página) → o texto vai para ela, com o mesmo tamanho em mm
    const achado = soPedido ? null : localizarNoMundo(doc, posicoes, noMundo(m, [cx + dx, cy + dy]))
    const outraFace = achado ? faceSemFuroNoPonto(achado.m, achado.local) : null
    if (achado && outraFace && (outraFace !== t.faceId || alt)) {
      const q2 = quadroDe(doc, achado.m, outraFace)!
      const [u2, v2] = aplicarM(inversa(q2.face), achado.local[0], achado.local[1])
      const escala = { kx: q.w / q2.w, ky: q.h / q2.h }
      let novo: string | null = null
      const antes = idsDosTextos(), dono = temaAbertoId()
      useMaeDoc.getState().aplicar(alt ? 'Duplicar texto' : 'Mover texto para outra caixa', d => {
        if (alt) { novo = duplicarPosicao(d as never, t.id, { faceId: outraFace, centro: { u: u2 - (aj.dx ?? 0), v: v2 - (aj.dy ?? 0) }, escala }); marcarDono(d as never, antes, dono) }
        else moverParaFace(d as never, t.id, outraFace, { u: u2 - (aj.dx ?? 0), v: v2 - (aj.dy ?? 0) }, escala)
      })
      useEditor.getState().set({ slot: novo ?? t.id, face: outraFace })
      return
    }
    const [u, v] = aplicarM(inversa(q.face), cx + dx, cy + dy)
    // o tema só guarda deslocamentos de −1 a 1 da face: além disso, para na borda (nunca some)
    const lim = (x: number) => Math.max(-1, Math.min(1, x)), r3 = (x: number) => Math.round(x * 1000) / 1000
    ajustar('Mover texto', a => { a.dx = r3(lim((a.dx ?? 0) + u - (b.x + b.w / 2))); a.dy = r3(lim((a.dy ?? 0) + v - (b.y + b.h / 2))) })
  }

  function clique(e: Konva.KonvaEventObject<MouseEvent>) {
    if (ignorarClique.current) { ignorarClique.current = false; return }
    const l = localizar(e); if (!l) return
    if (useEditor.getState().prancheta !== (l.ab?.id ?? null)) useEditor.getState().set({ prancheta: l.ab?.id ?? null })
    const { m, local } = l
    if (vinculo) { cliqueVinculo(m, local, e.evt.ctrlKey || e.evt.metaKey, e.evt.altKey, e.evt.shiftKey); return }
    if (modo === 'selecionar') {
      const id = m && local ? faceNoPonto(m, local) : null
      // Lote 6 (item 84): área do molde sem face (linha aberta) → aviso + "Criar face aqui"
      useMoldes.getState().set({ semFace: m && local && !id && areaDentroDoMolde(m.id, local) ? { moldeId: m.id, ponto: local } : null })
      // Lote 2 (item 15): o molde clicado fica selecionado (Shift+clique soma/tira) para alinhar e mover com as setas
      const atual = useMoldes.getState().sel
      const sel = !m ? (e.evt.shiftKey ? atual : []) : e.evt.shiftKey ? (atual.includes(m.id) ? atual.filter(x => x !== m.id) : [...atual, m.id]) : [m.id]
      set({ face: id && m && !e.evt.shiftKey ? { moldeId: m.id, faceId: id } : null, sel })
      if (id) useMaeDoc.getState().setSelecao(null)
      return
    }
    if (modo === 'medir') {
      const ptMundo: Pt = m && local ? noMundo(m, local) : l.mundo
      if (pontos.length !== 1) { set({ pontos: [ptMundo], medida: null }); return }
      const a = pontos[0], b = ptMundo
      set({ pontos: [], medida: { a, b, mm: Math.hypot(b[0] - a[0], b[1] - a[1]), artboardId: l.ab?.id ?? '' } })
      return
    }
    if (!m || !local) return
    if (modo === 'unir') {
      const alvo = faceNoPonto(m, local)
      if (!face || face.moldeId !== m.id) { if (alvo) set({ face: { moldeId: m.id, faceId: alvo } }); return }
      if (!alvo || alvo === face.faceId) return
      const ok = editarFaces(m.id, 'Unir faces', fs => {
        const i = fs.findIndex(f => f.id === face.faceId), j = fs.findIndex(f => f.id === alvo)
        return i < 0 || j < 0 ? null : unirFaces(fs, i, j, PX_MM_DETECCAO)
      })
      set(ok ? { face: null, aviso: null } : { aviso: 'Só dá para unir faces vizinhas (que encostam uma na outra).' })
      return
    }
    // laço e dividir: pontos no mesmo molde
    if (moldeDosPontos && moldeDosPontos !== m.id) { set({ pontos: [local], moldeDosPontos: m.id }); return }
    const novos = [...pontos, local]
    if (modo === 'dividir' && novos.length === 2) {
      const meio: Pt = [(novos[0][0] + novos[1][0]) / 2, (novos[0][1] + novos[1][1]) / 2]
      const alvo = faceNoPonto(m, meio)
      const ok = !!alvo && editarFaces(m.id, 'Dividir face', fs => { const i = fs.findIndex(f => f.id === alvo); return i < 0 ? null : dividirFace(fs, i, novos[0], novos[1]) })
      set({ pontos: [], moldeDosPontos: null, face: null, aviso: ok ? null : 'A linha precisa atravessar uma face de lado a lado.' })
      return
    }
    if (modo === 'laco' && novos.length >= 4 && Math.hypot(local[0] - novos[0][0], local[1] - novos[0][1]) < 2) { fecharLaco(m.id, novos.slice(0, -1)); return }
    set({ pontos: novos, moldeDosPontos: m.id })
  }

  return (
    <Layer data-camada-moldes>
      {doc.artboards.map((a, i) => (
        <Rect key={a.id} x={posicoes[i].xMm} y={posicoes[i].yMm} width={a.widthMm} height={a.heightMm} fill="rgba(0,0,0,0)" onClick={clique} onDblClick={() => { if (modo === 'laco' && moldeDosPontos) fecharLaco(moldeDosPontos, useMoldes.getState().pontos) }} />
      ))}
      {doc.molds.map(m => {
        const [ox, oy] = origem(m)
        const prep = preparadoDe(m.id)
        return (
          <Group key={m.id} x={ox} y={oy} rotation={giroDo(m)} onClick={clique} onPointerDown={pegarNaArte} onContextMenu={menuDireito} onMouseMove={hoverTravado} onMouseLeave={() => { if (useEditor.getState().travaHover) useEditor.getState().set({ travaHover: null }) }} onDblClick={e => {
            if (modo === 'laco' && moldeDosPontos) { fecharLaco(moldeDosPontos, useMoldes.getState().pontos); return }
            // Lote 9 (item 142): duplo clique num item de grupo seleciona o ITEM (para editar dentro do grupo)
            if (ed.modo === 'tema') { const l = localizar(e as unknown as Konva.KonvaEventObject<MouseEvent>); if (l?.m && l.local) cliqueVinculo(l.m, l.local, false, false, false, true) }
          }}>
            {prep && <KImage image={prep.previa as unknown as HTMLImageElement} width={m.source.widthMm} height={m.source.heightMm ?? m.source.widthMm} listening={false} />}
            {ed.modo === 'base' && ed.passo <= 3 && moldesSel.includes(m.id) && (() => {
              // caixa no sistema do molde (o grupo já está girado)
              const pts = m.faces.flatMap(f => f.polygonMm as Pt[])
              if (!pts.length) return null
              const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), fg = 1.5
              return <Rect x={Math.min(...xs) - fg} y={Math.min(...ys) - fg} width={Math.max(...xs) - Math.min(...xs) + 2 * fg} height={Math.max(...ys) - Math.min(...ys) + 2 * fg} stroke="#f97316" strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} listening={false} data-molde-selecionado />
            })()}
            {m.faces.map((f, k) => {
              const sel = face?.moldeId === m.id && face.faceId === f.id
              const pts = (f.polygonMm as Pt[]).flat()
              const pf = parteDe.get(f.id)
              const preenchimento = !vinculo
                ? (sel ? COR.sel : eqs.has(`${m.id}/${f.id}`) ? COR.eq : f.hole ? COR.furo : COR.face)
                : f.hole ? COR.furo
                : ed.modo === 'base' && ed.passo === 4 ? (pf ? hexA(corDaParte.get(pf.id)!, 0.35) : sugestoes.has(f.id) ? 'rgba(245,158,11,0.40)' : COR.face)
                : 'rgba(0,0,0,0)'
              // Lote 4 (item 34): partes selecionadas (Ctrl+clique, retângulo, Ctrl+A) ficam destacadas na folha
              const multi = ed.modo === 'tema' && !!pf && ed.partesSel.length > 1 && ed.partesSel.includes(pf.id)
              if (ed.realce === f.id) return <Line key={f.id} points={pts} closed fill="rgba(14,165,233,0.35)" stroke="#0284c7" strokeWidth={3} strokeScaleEnabled={false} data-face-realce />
              // Lote 9 (item 146): na Base, as faces juntadas num cenário contínuo ganham contorno roxo (para ver o efeito)
              const noCenario = ed.modo === 'base' && (ed.passo === 4 || ed.passo === 5) && !f.hole && !!facesDoCenario(doc, null, m, f.id)
              if (noCenario && ed.face !== f.id && !multi) return <Line key={f.id} points={pts} closed fill={preenchimento} stroke="#7c3aed" strokeWidth={2} dash={[5 * fino, 3 * fino]} strokeScaleEnabled={false} data-face={k} data-face-cenario />
              return <Line key={f.id} points={pts} closed fill={multi ? 'rgba(249,115,22,0.12)' : preenchimento} strokeEnabled={(vinculo && ed.face === f.id) || multi} stroke="#f97316" strokeWidth={multi ? 2 : 3} dash={multi && ed.face !== f.id ? [6 * fino, 3 * fino] : undefined} strokeScaleEnabled={false} data-face={k} data-face-multi={multi ? 1 : undefined} />
            })}
            {m.faces.map(f => {
              const pol = f.polygonMm as Pt[], tipos = tiposDeArestas(f.edges, pol.length)
              return pol.map((p, k) => {
                const q = pol[(k + 1) % pol.length], corte = tipos[k] === 'cut'
                return <Line key={`${f.id}-${k}`} points={[p[0], p[1], q[0], q[1]]} stroke={corte ? COR.corte : COR.dobra} strokeWidth={corte ? 1.6 : 1.3} strokeScaleEnabled={false} dash={corte ? undefined : [5 * fino, 3 * fino]} listening={false} />
              })
            })}
            {!(ed.modo === 'tema' || (ed.modo === 'base' && ed.passo >= 5)) && m.faces.filter(f => !f.hole).map(f => {
              const [cx, cy] = centroide(f.polygonMm as Pt[])
              const pf = vinculo ? parteDe.get(f.id) : null
              const txt = pf ? pf.name : f.id.split('_').pop()!
              return <Text key={`t-${f.id}`} x={cx - (pf ? txt.length * 3.2 : 6) * fino} y={cy - 5 * fino} text={txt} fontSize={10 * fino} fontStyle={pf ? 'bold' : 'normal'} fill={pf ? corDaParte.get(pf.id) : '#475569'} listening={false} />
            })}
            {vinculo && ed.modo === 'base' && ed.passo >= 6 && doc.textSlots.filter(t => m.faces.some(f => f.id === t.faceId)).map(t => {
              const q = quadroDe(doc, m, t.faceId)!
              const [cx, cy] = aplicarM(q.face, t.box.x + t.box.w / 2, t.box.y + t.box.h / 2)
              const g = ((t.rotationDeg ?? 0) * Math.PI) / 180
              const cs = [[t.box.x, t.box.y], [t.box.x + t.box.w, t.box.y], [t.box.x + t.box.w, t.box.y + t.box.h], [t.box.x, t.box.y + t.box.h]].map(([u, v]) => aplicarM(q.face, u, v))
                .map(([x, y]) => [cx + (x - cx) * Math.cos(g) - (y - cy) * Math.sin(g), cy + (x - cx) * Math.sin(g) + (y - cy) * Math.cos(g)] as Pt)
              const exemplo = t.variable === 'NOME' ? 'Maria Júlia' : t.variable === 'IDADE' ? '1 ano' : t.variable === 'HASHTAG' ? '#MariaJúliafaz1' : t.variable
              const tam = Math.min(t.box.h * q.h * 0.55, (t.box.w * q.w) / Math.max(4, exemplo.length * 0.55))
              const sl = ed.slot === t.id
              return (
                <Group key={t.id}>
                  <Group listening={false}>
                    <Line points={cs.flat()} closed stroke={sl ? '#f97316' : '#7c3aed'} strokeWidth={sl ? 2 : 1.2} strokeScaleEnabled={false} dash={[4 * fino, 3 * fino]} fill={sl ? 'rgba(249,115,22,0.10)' : 'rgba(124,58,237,0.06)'} />
                    <Text x={cx} y={cy} offsetX={(exemplo.length * tam * 0.5) / 2} offsetY={tam / 2} rotation={q.rot + (t.rotationDeg ?? 0)} text={exemplo} fontSize={tam} fontStyle="bold" fill={sl ? '#c2410c' : '#6d28d9'} />
                    <Text x={cs[0][0]} y={cs[0][1] - 9 * fino} rotation={q.rot + (t.rotationDeg ?? 0)} text={t.variable === 'ARROBA' ? '@' : t.variable} fontSize={8 * fino} fill="#7c3aed" />
                  </Group>
                  {sl && ed.passo === 6 && (
                    <CaixaTransformavel cantos={cs} fino={fino} chave={`${t.id}:${JSON.stringify(t.box)}:${t.rotationDeg ?? 0}:${t.single?.sizePt}`}
                      onMover={(dx, dy, alt) => {
                        // Lote 4 (item 52): soltou em OUTRA face/página → o texto vai para lá (Alt = uma cópia vai)
                        const achado = localizarNoMundo(doc, posicoes, noMundo(m, [cx + dx, cy + dy]))
                        const outraFace = achado ? faceSemFuroNoPonto(achado.m, achado.local) : null
                        if (achado && outraFace && (outraFace !== t.faceId || alt)) {
                          const q2 = quadroDe(doc, achado.m, outraFace)!
                          const [u2, v2] = aplicarM(inversa(q2.face), achado.local[0], achado.local[1])
                          const escala = { kx: q.w / q2.w, ky: q.h / q2.h }   // Lote 5 (item 56): mesmo tamanho em mm
                          let novo: string | null = null
                          useMaeDoc.getState().aplicar(alt ? 'Duplicar texto' : 'Mover texto para outra página', d => {
                            if (alt) novo = duplicarPosicao(d as never, t.id, { faceId: outraFace, centro: { u: u2, v: v2 }, escala })
                            else moverParaFace(d as never, t.id, outraFace, { u: u2, v: v2 }, escala)
                          })
                          useEditor.getState().set({ slot: novo ?? t.id, face: outraFace })
                          return
                        }
                        const [u, v] = aplicarM(inversa(q.face), cx + dx, cy + dy)
                        const du = u - (t.box.x + t.box.w / 2), dv = v - (t.box.y + t.box.h / 2), r3 = (x: number) => Math.round(x * 1000) / 1000
                        useMaeDoc.getState().aplicar('Mover texto', d => { const s = d.textSlots.find(x => x.id === t.id); if (s) { s.box.x = r3(s.box.x + du); s.box.y = r3(s.box.y + dv) } })
                      }}
                      onEscalar={(k, dl) => {
                        const [u, v] = aplicarM(inversa(q.face), cx + dl[0], cy + dl[1]), r3 = (x: number) => Math.round(x * 1000) / 1000
                        const du = u - (t.box.x + t.box.w / 2), dv = v - (t.box.y + t.box.h / 2)
                        useMaeDoc.getState().aplicar('Tamanho do texto', d => { const s = d.textSlots.find(x => x.id === t.id); if (s) { escalarPosicao(s, k); s.box.x = r3(s.box.x + du); s.box.y = r3(s.box.y + dv) } })
                      }}
                      onEsticar={(eixo, k, dl) => {
                        const [u, v] = aplicarM(inversa(q.face), cx + dl[0], cy + dl[1]), r3 = (x: number) => Math.round(x * 1000) / 1000
                        const du = u - (t.box.x + t.box.w / 2), dv = v - (t.box.y + t.box.h / 2)
                        useMaeDoc.getState().aplicar(eixo === 'x' ? 'Largura do texto' : 'Altura do texto', d => {
                          const s = d.textSlots.find(x => x.id === t.id); if (!s) return
                          const ccx = s.box.x + s.box.w / 2, ccy = s.box.y + s.box.h / 2
                          if (eixo === 'x') s.box.w = r3(Math.min(2, Math.max(0.02, s.box.w * k))); else s.box.h = r3(Math.min(2, Math.max(0.02, s.box.h * k)))
                          s.box.x = r3(ccx - s.box.w / 2 + du); s.box.y = r3(ccy - s.box.h / 2 + dv)
                        })
                      }}
                      onGirar={(gr, sh) => useMaeDoc.getState().aplicar('Girar texto', d => { const s = d.textSlots.find(x => x.id === t.id); if (s) s.rotationDeg = anguloFinal(s.rotationDeg ?? 0, gr, sh) })} />
                  )}
                </Group>
              )
            })}
            {/* tema: caixa de transformação do texto clicado — ajuste SÓ NESTA CAIXA (tamanho, posição, giro) */}
            {/* Lote 8 (item 123): TODO texto do tema se pega e arrasta direto (sem precisar clicar antes): área de pegar
                invisível sobre a caixa dele; o arraste seleciona e move no mesmo gesto. Clique simples continua indo para a
                pilha (Alt = o de baixo). Travado (cadeado) ou oculto (olho) não tem área. */}
            {ed.modo === 'tema' && tema && doc.textSlots.filter(t => t.id !== ed.slot && m.faces.some(f => f.id === t.faceId) && !tema.textSlotAdjust?.[t.id]?.locked && !tema.textSlotAdjust?.[t.id]?.hidden).map(t => {
              const gt = geoTexto(m, t); if (!gt) return null
              return (
                <Line key={`pegar:${t.id}:${JSON.stringify(gt.b)}`} points={gt.cs.flat()} closed fill="rgba(0,0,0,0.001)" strokeEnabled={false} strokeScaleEnabled={false} draggable dragDistance={3}
                  onPointerDown={ev => { ev.evt.stopPropagation() }}
                  onMouseEnter={ev => cursorPalco(ev, 'move')} onMouseLeave={ev => cursorPalco(ev, '')}
                  onDragStart={ev => { useEditor.getState().set({ slot: t.id, face: t.faceId, camada: null }); ev.target.setAttrs({ strokeEnabled: true, stroke: '#f97316', strokeWidth: 2, dash: [6 * fino, 4 * fino], fill: 'rgba(249,115,22,0.10)' }) }}
                  onDragEnd={ev => { const dx = ev.target.x(), dy = ev.target.y(); ev.target.position({ x: 0, y: 0 }); if (Math.hypot(dx, dy) > 0.05) moverTextoTema(m, t, dx, dy, ev.evt?.altKey) }}
                  data-texto-pegar={t.variable} />
              )
            })}
            {ed.modo === 'tema' && tema && ed.slot && (() => {
              const t = doc.textSlots.find(x => x.id === ed.slot && m.faces.some(f => f.id === x.faceId))
              if (!t) return null
              const gt = geoTexto(m, t); if (!gt) return null
              const { q, b, cx, cy, cs, aj, ajustar } = gt
              // travado (cadeado): só o contorno, sem alças
              if (aj.locked) return <Line key={`ttrav:${t.id}`} points={cs.flat()} closed stroke="#64748b" strokeWidth={1.5} strokeScaleEnabled={false} dash={[3 * fino, 3 * fino]} listening={false} data-texto-travado />
              const r3 = (x: number) => Math.round(x * 1000) / 1000
              const fora = areaPassaDaFace(b)
              return (
                <Group key={`tsel:${t.id}`}>
                {(() => { const lim = infosTextoArte.find(i => i.slotId.split(':')[0] === t.id)?.limite
                  if (!lim) return null
                  // o lado que segura: altura → em cima e embaixo; largura → nas laterais
                  const lados = lim === 'altura' ? [[cs[0], cs[1]], [cs[3], cs[2]]] : [[cs[0], cs[3]], [cs[1], cs[2]]]
                  return lados.map((l, k) => <Line key={`lim${k}`} points={l.flat()} stroke="#ea580c" strokeWidth={4} strokeScaleEnabled={false} listening={false} data-lado-limite={lim} />) })()}
                <Text x={cs[3][0]} y={cs[3][1] + 2 * fino} text={fora ? `⚠ a área do nome passa da face` : (() => { const i = infosTextoArte.find(x => x.slotId.split(':')[0] === t.id); return i?.limite ? `no limite da ${i.limite} da área — aumente a área para o nome crescer${i.escala < 1 ? ` · encolhido para ${Math.round(i.escala * 100)}%` : ''}` : 'área do nome — nomes longos encolhem para caber aqui' })()} fontSize={7 * fino} fill={fora ? '#b91c1c' : '#c2410c'} listening={false} data-rotulo-area-nome />
                <CaixaTransformavel cantos={cs} fino={fino} chave={`${t.id}:${JSON.stringify(aj)}:${JSON.stringify(b)}`}
                  onMover={(dx, dy, alt) => moverTextoTema(m, t, dx, dy, !!alt)}
                  onEscalar={k => {
                    // Lote 10 (item 164): cantos = TAMANHO da letra; a área do nome fica onde está (na 1ª vez, fica a atual)
                    ajustar('Tamanho do nome', a => { if (!a.area && !soPedidoTexto()) a.area = { w: r3(b.w), h: r3(b.h) }; marcarRefTexto(a as never); a.scale = r3(Math.min(4, Math.max(0.2, (a.scale ?? 1) * k))) })
                  }}
                  onEsticar={soPedidoTexto() ? undefined : (eixo, k, dl) => {
                    // laterais = ÁREA do nome (o limite); a letra não muda
                    const [u, v] = aplicarM(inversa(q.face), cx + dl[0], cy + dl[1])
                    ajustar('Área do nome', a => {
                      const ar = a.area ?? { w: b.w, h: b.h }
                      a.area = { w: r3(Math.min(2, Math.max(0.02, eixo === 'x' ? ar.w * k : ar.w))), h: r3(Math.min(2, Math.max(0.02, eixo === 'y' ? ar.h * k : ar.h))) }
                      a.dx = r3((a.dx ?? 0) + u - (b.x + b.w / 2)); a.dy = r3((a.dy ?? 0) + v - (b.y + b.h / 2))
                    })
                  }}
                  onGirar={(gr, sh) => ajustar('Girar texto', a => { a.rotationDeg = anguloFinal(a.rotationDeg ?? 0, gr, sh) })} />
                </Group>
              )
            })()}
            {vinculo && (ed.modo === 'tema' || ed.passo >= 7) && (['logo', 'qr'] as const).map(k => {
              const pos = m.identity?.[k], arq = ed.identidade[k]
              if (!pos) return null
              const info = arq ? infoEmCache(arq.path) : undefined
              const h = pos.wMm / (arq?.aspect || 1), rot = pos.rotationDeg ?? 0
              const sel = ed.modo === 'base' && ed.passo === 7 && ed.identSel?.moldeId === m.id && ed.identSel.k === k
              const desenho = info?.bitmap
                ? <KImage key={k} image={info.bitmap as unknown as HTMLImageElement} x={pos.xMm + pos.wMm / 2} y={pos.yMm + h / 2} offsetX={pos.wMm / 2} offsetY={h / 2} rotation={rot} width={pos.wMm} height={h} listening={false} opacity={0.95} data-identidade={k} />
                : <Rect key={k} x={pos.xMm + pos.wMm / 2} y={pos.yMm + h / 2} offsetX={pos.wMm / 2} offsetY={h / 2} rotation={rot} width={pos.wMm} height={h} stroke="#0f172a" strokeWidth={1} strokeScaleEnabled={false} dash={[3 * fino, 2 * fino]} listening={false} />
              if (!sel) return desenho
              const r2 = (x: number) => Math.round(x * 100) / 100
              const mudar = (label: string, f: (p: NonNullable<NonNullable<Molde['identity']>['logo']>) => void) => useMaeDoc.getState().aplicar(label, d => { const p = d.molds.find(x => x.id === m.id)?.identity?.[k]; if (p) f(p) })
              return (
                <Group key={k}>
                  {desenho}
                  <CaixaTransformavel cantos={cantosGirados(pos.xMm, pos.yMm, pos.wMm, h, rot)} fino={fino} chave={`${m.id}:${k}:${pos.xMm}:${pos.yMm}:${pos.wMm}:${rot}`}
                    onMover={(dx, dy) => mudar(`Mover ${k === 'logo' ? 'logo' : 'QR'}`, p => { p.xMm = r2(p.xMm + dx); p.yMm = r2(p.yMm + dy) })}
                    onEscalar={(kk, dl) => mudar(`Tamanho ${k === 'logo' ? 'da logo' : 'do QR'}`, p => { const cxm = p.xMm + p.wMm / 2 + dl[0], cym = p.yMm + h / 2 + dl[1], w = Math.min(200, Math.max(2, p.wMm * kk)); p.wMm = r2(w); p.xMm = r2(cxm - w / 2); p.yMm = r2(cym - (w / (arq?.aspect || 1)) / 2) })}
                    onGirar={(gr, sh) => mudar(`Girar ${k === 'logo' ? 'logo' : 'QR'}`, p => { p.rotationDeg = anguloFinal(p.rotationDeg ?? 0, gr, sh) })} />
                </Group>
              )
            })}
            {/* Lote 4 (item 47): aplique 3D aparece na caixa (para ver a composição), com contorno pontilhado e "3D": não é impresso nela */}
            {ed.modo === 'tema' && tema && m.faces.flatMap(f => {
              const parte = parteDe.get(f.id)
              if (!parte || f.hole) return []
              const arteF = arteDaFace(doc, tema, m, f.id)
              const q = arteF?.quadro ?? quadroDe(doc, m, f.id)
              if (!q) return []
              const A = arteF?.A ?? parte.referenceAspect ?? 1
              const fa = arteF?.faceArte ?? f.id, pa = arteF?.parteArte ?? parte.id
              const aj = ajustesDaFace(tema, fa)
              return [...(tema.partContent[pa] ?? []), ...(tema.faceContent?.[fa] ?? [])].filter(c => ehAplique(tema, c) && c.visible !== false).map(c => {
                const ef = efetiva(c, aj[c.id]) as CamadaImagemTema
                const cs = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => aplicarM(matrizDaCamada(ef, q, A), u, v))
                const [tx, ty] = cs.reduce(([a, b], [x, y]) => [Math.min(a, x), Math.min(b, y)], [Infinity, Infinity])
                return (
                  <Group key={`ap:${f.id}:${c.id}`} listening={false} data-indicador-aplique>
                    <Line points={cs.flat()} closed stroke="#0284c7" strokeWidth={1.4} strokeScaleEnabled={false} dash={[3 * fino, 2 * fino]} />
                    <Text x={tx} y={ty - 9 * fino} text="3D · só na folha de aplique" fontSize={9 * fino} fill="#0284c7" fontStyle="bold" />
                  </Group>
                )
              })
            })}
            {ed.modo === 'tema' && tema && ed.face && ed.camada && m.faces.some(f => f.id === ed.face) && (() => {
              const cam = acharCamadaTema(tema, ed.camada)
              const parte = parteDe.get(ed.face!)
              if (!cam || !parte || (cam.partId && cam.partId !== parte.id) || (cam.faceId && cam.faceId !== ed.face)) return null
              // Lote 9 (item 136): contorno e alças onde a camada é DESENHADA (cenário contínuo: quadro das faces juntas)
              const arteSel = arteDaFace(doc, tema, m, ed.face!)
              const q = arteSel?.quadro ?? quadroDe(doc, m, ed.face!)!
              const A = arteSel?.A ?? parte.referenceAspect ?? 1
              const ef = (cam.faceId ? cam.c : efetiva(cam.c, ajustesDaFace(tema, ed.face!)[cam.c.id])) as CamadaImagemTema
              // Lote 6 (item 81): moldurinha e cor sólida não se movem — o contorno é o da própria face
              const movel = (ef.type === 'image' || (ef as { type: string }).type === 'shape' || (ef as { type: string }).type === 'conjunto') && !(ef as { locked?: boolean }).locked
              if (!movel) {
                const fpol = (m.faces.find(x => x.id === ed.face)?.polygonMm ?? []) as Pt[]
                return <Line key={`fixo:${ed.camada}:${ed.face}`} points={fpol.flat()} closed stroke="#f97316" strokeWidth={2} strokeScaleEnabled={false} dash={[6 * fino, 4 * fino]} listening={false} data-contorno-tema-fixo />
              }
              const M = matrizDaCamada(ef, q, A)
              const cs = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => aplicarM(M, u, v))
              // Sprint 10: alças — cantos escalam (em volta do centro), a de cima gira
              const T = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0, ...(ef.transform ?? {}) }
              const [ccx, ccy] = aplicarM(M, 0.5, 0.5)
              const giro = aplicarM(M, 0.5, -0.12)
              const r3 = (v: number) => Math.round(v * 1000) / 1000
              const chaveAlca = `${ed.camada}:${ed.face}:${JSON.stringify(ef.transform)}`
              // Lote 14 (item 198): forma esticada livre — largura × kx, altura × ky (a altura independe: scaleY)
              const ehForma = (ef as { type: string }).type === 'shape'
              const redimensionarForma = (kx: number, ky: number, soNaCaixa?: boolean) => {
                const s1 = Math.min(20, Math.max(0.02, T.scale * kx)), sy1 = Math.min(20, Math.max(0.05, ((T as { scaleY?: number }).scaleY ?? 1) * ky / kx))
                editarCamadaTema(cam.c.id, { transform: { scale: r3(s1), scaleY: r3(sy1) } }, kx !== 1 && ky !== 1 ? 'Redimensionar a forma' : kx !== 1 ? 'Largura da forma' : 'Altura da forma', undefined, soNaCaixa ? 'face' : undefined)
              }
              const alcas = (
                <>
                  {cs.map(([x, y], i) => (
                    <Circle key={`esc${i}:${chaveAlca}`} x={x} y={y} radius={5 * fino} fill="#ffffff" stroke="#f97316" strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={12} draggable
                      onPointerDown={ev => { ev.evt.stopPropagation() }}
                      onMouseEnter={ev => cursorPalco(ev, i % 2 === 0 ? 'nwse-resize' : 'nesw-resize')} onMouseLeave={ev => cursorPalco(ev, '')}
                      onDragMove={ev => {
                        // Lote 3 (item 28): o contorno acompanha o mouse
                        const k = Math.hypot(ev.target.x() - ccx, ev.target.y() - ccy) / Math.max(1e-6, Math.hypot(x - ccx, y - ccy))
                        previaContorno(ev, cs.map(([px, py]) => [ccx + (px - ccx) * k, ccy + (py - ccy) * k] as Pt))
                      }}
                      onDragEnd={ev => {
                        // Lote 14 (item 198): FORMA — o canto muda largura e altura livres; com Shift, mantém a proporção
                        if (ehForma && !ev.evt?.shiftKey) {
                          const [u, v] = aplicarM(inversa(M), ev.target.x(), ev.target.y())
                          const kx = Math.max(0.05, Math.abs(u - 0.5) / 0.5), ky = Math.max(0.05, Math.abs(v - 0.5) / 0.5)
                          redimensionarForma(kx, ky, ev.evt?.altKey)
                          return
                        }
                        const k = Math.hypot(ev.target.x() - ccx, ev.target.y() - ccy) / Math.max(1e-6, Math.hypot(x - ccx, y - ccy))
                        editarCamadaTema(cam.c.id, { transform: { scale: r3(Math.min(20, Math.max(0.02, T.scale * k))) } }, 'Escala', undefined, ev.evt?.altKey ? 'face' : undefined)
                      }} data-alca-escala={i} />
                  ))}
                  {/* Lote 14 (item 198): FORMA — alças das laterais (só a largura) e de cima/baixo (só a altura) */}
                  {ehForma && ([[0, 0.5, 'x'], [1, 0.5, 'x'], [0.5, 0, 'y'], [0.5, 1, 'y']] as const).map(([u0, v0, eixo], i) => {
                    const [hx, hy] = aplicarM(M, u0, v0)
                    return (
                      <Rect key={`lado${i}:${chaveAlca}`} x={hx - 4 * fino} y={hy - 4 * fino} width={8 * fino} height={8 * fino} fill="#ffffff" stroke="#f97316" strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={12} draggable
                        onPointerDown={ev => { ev.evt.stopPropagation() }} onMouseEnter={ev => cursorPalco(ev, eixo === 'x' ? 'ew-resize' : 'ns-resize')} onMouseLeave={ev => cursorPalco(ev, '')}
                        onDragEnd={ev => {
                          const [u, v] = aplicarM(inversa(M), ev.target.x() + 4 * fino, ev.target.y() + 4 * fino)
                          const k = Math.max(0.05, eixo === 'x' ? Math.abs(u - 0.5) / 0.5 : Math.abs(v - 0.5) / 0.5)
                          redimensionarForma(eixo === 'x' ? k : 1, eixo === 'y' ? k : 1, ev.evt?.altKey)
                        }} data-alca-lado={eixo === 'x' ? (u0 === 0 ? 'esq' : 'dir') : (v0 === 0 ? 'topo' : 'base')} />
                    )
                  })}
                  <Line points={[...aplicarM(M, 0.5, 0), ...giro]} stroke="#f97316" strokeWidth={1} strokeScaleEnabled={false} listening={false} />
                  <Circle key={`giro:${chaveAlca}`} x={giro[0]} y={giro[1]} radius={5 * fino} fill="#f97316" stroke="#ffffff" strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={12} draggable
                    onPointerDown={ev => { ev.evt.stopPropagation() }}
                    onMouseEnter={ev => cursorPalco(ev, 'grab')} onMouseLeave={ev => cursorPalco(ev, '')}
                    onDragMove={ev => {
                      const a0 = Math.atan2(giro[1] - ccy, giro[0] - ccx), a1 = Math.atan2(ev.target.y() - ccy, ev.target.x() - ccx), c = Math.cos(a1 - a0), sn = Math.sin(a1 - a0)
                      previaContorno(ev, cs.map(([px, py]) => [ccx + (px - ccx) * c - (py - ccy) * sn, ccy + (px - ccx) * sn + (py - ccy) * c] as Pt))
                    }}
                    onDragEnd={ev => {
                      const a0 = Math.atan2(giro[1] - ccy, giro[0] - ccx), a1 = Math.atan2(ev.target.y() - ccy, ev.target.x() - ccx)
                      let rot = T.rotationDeg + ((a1 - a0) * 180) / Math.PI
                      rot = ((rot + 540) % 360) - 180
                      if (ev.evt?.shiftKey) rot = Math.round(rot / 15) * 15
                      editarCamadaTema(cam.c.id, { transform: { rotationDeg: Math.round(rot * 10) / 10 } }, 'Girar', undefined, ev.evt?.altKey ? 'face' : undefined)
                    }} data-alca-giro />
                </>
              )
              // Lote 9 (itens 135/136): a FOTO da camada (proxy) — visível só no arraste e até a arte nova chegar
              const mostrarFoto = arrastando?.camada === cam.c.id && ef.type === 'image' && !!fotoSel
              const foto = mostrarFoto ? (
                <Shape key={`foto:${chaveAlca}`} ref={n => { fotoRef.current = n }} listening={false} opacity={0.95}
                  sceneFunc={ctx => { const g = ctx._context; g.save(); g.transform(M[0], M[1], M[2], M[3], M[4], M[5]); g.drawImage(fotoSel!, 0, 0, 1, 1); g.restore() }} data-foto-arraste />
              ) : null
              return (
                <Group key={`g:${chaveAlca}`}>
                {foto}
                <Line key={`${ed.camada}:${ed.face}:${JSON.stringify(ef.transform)}`} name="contorno-tema" points={cs.flat()} closed stroke="#f97316" strokeWidth={2} strokeScaleEnabled={false} dash={[6 * fino, 4 * fino]} fill="rgba(249,115,22,0.05)" draggable dragDistance={4}
                  onPointerDown={ev => { if (!teclasMae.espaco) ev.evt.stopPropagation() }} onMouseEnter={ev => cursorPalco(ev, 'move')} onMouseLeave={ev => cursorPalco(ev, '')}
                  onDragStart={ev => {
                    // Lote 9 (item 148): Espaço segurado = mão (move a vista, não o objeto)
                    if (teclasMae.espaco) { ev.target.stopDrag(); ev.target.position({ x: 0, y: 0 }); return }
                    const comecar = () => useEditor.getState().set({ arrastando: { camada: cam.c.id, soltou: false } })
                    if (arrasteDireto.current) { arrasteDireto.current = false; comecar(); return }
                    // Lote 6 (item 81): começou a arrastar em cima de OUTRO objeto (texto, aplique, forma)? Não arrasta o
                    // papel por baixo: seleciona o de cima (o próximo arrasto já move ele)
                    const l = localizar(ev as unknown as Konva.KonvaEventObject<MouseEvent>)
                    if (!l?.m || !l.local) { comecar(); return }
                    const topo = pilhaAqui(l.m, ed.face!, l.local)[0]
                    if (!topo || topo.id === ed.camada) { comecar(); return }
                    ev.target.stopDrag(); ev.target.position({ x: 0, y: 0 })
                    if (topo.tipo === 'texto') useEditor.getState().set({ slot: topo.id, camada: null })
                    else useEditor.getState().set({ camada: topo.id })
                  }}
                  onDragMove={ev => { const f = fotoRef.current; if (f) { f.position(ev.target.position()); f.getLayer()?.batchDraw() } }}
                  onDragEnd={ev => {
                    const dx = ev.target.x(), dy = ev.target.y()
                    const [cx, cy] = aplicarM(M, 0.5, 0.5)
                    const novo: [number, number] = [cx + dx, cy + dy]
                    let x: number, y: number
                    if ((ef.anchor ?? 'face') === 'paper') { const [s2, t2] = aplicarM(inversa(q.papel), novo[0], novo[1]); x = s2 / A; y = t2 }
                    else { [x, y] = aplicarM(inversa(q.face), novo[0], novo[1]) }
                    const r = (v: number) => Math.round(v * 1000) / 1000
                    // Lote 9 (item 137): Alt + arrastar = DUPLICAR (a cópia fica no lugar novo, a original não sai) — um Ctrl+Z
                    if (ev.evt?.altKey) {
                      const novo = duplicarCamada(cam.c.id, 0)
                      if (novo) { editarCamadaTema(novo, { transform: { x: r(x), y: r(y) } }, 'Mover', undefined, faceDaArte(ed.face!) ? 'face' : 'parte'); juntarUltimos(2) }
                      ev.target.position({ x: 0, y: 0 })
                      useEditor.getState().set({ arrastando: { camada: cam.c.id, soltou: true, soltouEm: performance.now() } })
                      return
                    }
                    editarCamadaTema(cam.c.id, { transform: { x: r(x), y: r(y) } }, 'Mover')
                    ev.target.position({ x: 0, y: 0 })
                    // a foto fica no lugar novo até a arte nova chegar (sem piscar)
                    useEditor.getState().set({ arrastando: { camada: cam.c.id, soltou: true, soltouEm: performance.now() } })
                  }} data-contorno-tema />
                {alcas}
                </Group>
              )
            })()}
            {/* Lote 9 (item 142): GRUPO selecionado — o contorno de todos os itens dele nesta caixa */}
            {ed.modo === 'tema' && tema && (ed.grupoSel || ed.multiSel.length >= 2) && ed.face && m.faces.some(f => f.id === ed.face) && (() => {
              // Lote 14 (item 196): a SELEÇÃO MÚLTIPLA usa o mesmo contorno e as mesmas alças do grupo
              const g = ed.grupoSel ? gruposDo(tema).find(x => x.id === ed.grupoSel) : grupoDaSelecao()
              if (!g) return null
              const transformar = ed.grupoSel ? transformarGrupoSelecionado : transformarSelecao
              const ms = membrosNaFace(doc, tema, g, m, ed.face!, valoresPedido)
              if (!ms.length) return null
              const xs = ms.flatMap(x => x.cantos.map(c => c[0])), ys = ms.flatMap(x => x.cantos.map(c => c[1]))
              const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys)
              const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2]
              const chave = `grp:${g.id}:${ed.face}:${x0.toFixed(2)}:${y0.toFixed(2)}:${x1.toFixed(2)}:${y1.toFixed(2)}`
              const travado = !!g.locked, cor = ed.grupoSel ? '#7c3aed' : '#0ea5e9'
              return (
                <Group key={chave}>
                  {ms.map(x => <Line key={`gm:${x.id}`} points={x.cantos.flat()} closed stroke={cor} strokeWidth={1} dash={[3 * fino, 2 * fino]} strokeScaleEnabled={false} listening={false} />)}
                  <Rect name="contorno-grupo" x={x0} y={y0} width={x1 - x0} height={y1 - y0} stroke={cor} strokeWidth={2} strokeScaleEnabled={false} dash={[6 * fino, 4 * fino]} fill={ed.grupoSel ? 'rgba(124,58,237,0.05)' : 'rgba(14,165,233,0.05)'}
                    draggable={!travado} dragDistance={3}
                    onPointerDown={ev => { if (!teclasMae.espaco) ev.evt.stopPropagation() }} onMouseEnter={ev => cursorPalco(ev, travado ? '' : 'move')} onMouseLeave={ev => cursorPalco(ev, '')}
                    onDragStart={ev => { if (teclasMae.espaco) { ev.target.stopDrag(); ev.target.position({ x: x0, y: y0 }) } }}
                    onDragEnd={ev => {
                      const dx = ev.target.x() - x0, dy = ev.target.y() - y0
                      ev.target.position({ x: x0, y: y0 })
                      if (Math.hypot(dx, dy) > 0.05) transformar({ dx, dy }, ed.grupoSel ? 'Mover grupo' : 'Mover a seleção', valoresPedido)
                    }} data-contorno-grupo={g.nome} {...(ed.grupoSel ? {} : { 'data-contorno-selecao': g.nome })} />
                  {!travado && <>
                    <Circle key={`ge:${chave}`} x={x1} y={y1} radius={5 * fino} fill="#ffffff" stroke={cor} strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={12} draggable
                      onPointerDown={ev => { ev.evt.stopPropagation() }} onMouseEnter={ev => cursorPalco(ev, 'nwse-resize')} onMouseLeave={ev => cursorPalco(ev, '')}
                      onDragEnd={ev => {
                        const k = Math.hypot(ev.target.x() - cx, ev.target.y() - cy) / Math.max(1e-6, Math.hypot(x1 - cx, y1 - cy))
                        ev.target.position({ x: x1, y: y1 })
                        if (Math.abs(k - 1) > 0.005) transformar({ escala: Math.max(0.1, Math.min(10, k)) }, ed.grupoSel ? 'Redimensionar grupo' : 'Redimensionar a seleção', valoresPedido)
                      }} data-alca-grupo="escala" />
                    <Line points={[cx, y0, cx, y0 - (y1 - y0) * 0.15 - 4]} stroke={cor} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
                    <Circle key={`gg:${chave}`} x={cx} y={y0 - (y1 - y0) * 0.15 - 4} radius={5 * fino} fill={cor} stroke="#ffffff" strokeWidth={1.5} strokeScaleEnabled={false} hitStrokeWidth={12} draggable
                      onPointerDown={ev => { ev.evt.stopPropagation() }} onMouseEnter={ev => cursorPalco(ev, 'grab')} onMouseLeave={ev => cursorPalco(ev, '')}
                      onDragEnd={ev => {
                        const gy = y0 - (y1 - y0) * 0.15 - 4
                        const a0 = Math.atan2(gy - cy, 0), a1 = Math.atan2(ev.target.y() - cy, ev.target.x() - cx)
                        let giro = ((a1 - a0) * 180) / Math.PI
                        giro = ((giro + 540) % 360) - 180
                        if (ev.evt?.shiftKey) giro = Math.round(giro / 15) * 15
                        ev.target.position({ x: cx, y: gy })
                        if (Math.abs(giro) > 0.2) transformar({ giroDeg: Math.round(giro * 10) / 10 }, ed.grupoSel ? 'Girar grupo' : 'Girar a seleção', valoresPedido)
                      }} data-alca-grupo="giro" />
                  </>}
                </Group>
              )
            })()}
            {/* Lote 6 (item 91): DIVISÓRIAS da estrutura (peças por medida) — arrastar sobe/desce a base, muda a lateral */}
            {/* Lote 16 (item 207): também na etapa Fundo e miolo; com "Aplicar em" uma peça, só nela */}
            {ed.modo === 'base' && (ed.funcao === 'medidas' || ed.funcao === 'miolo') && m.medida && (!ed.estruturaAlvo || ed.estruturaAlvo === m.id) && estruturaDaPeca(doc as never, m.id).divisorias.map(dv => {
              const W = m.medida!.larguraMm, H = m.medida!.alturaMm
              const T = dv.eixo === 'h' ? H : W, L = dv.eixo === 'h' ? W : H, k = Math.tan(((dv.inclinacaoDeg ?? 0) * Math.PI) / 180) * (L / 2), c = dv.pos * T
              const pts = dv.eixo === 'h' ? [0, c - k, W, c + k] : [c - k, 0, c + k, H]
              return (
                <Line key={`div:${m.id}:${dv.id}:${dv.pos}`} points={pts} stroke="#f97316" strokeWidth={2.5} strokeScaleEnabled={false} dash={dv.tipo === 'suave' ? [5 * fino, 3 * fino] : undefined} hitStrokeWidth={14} draggable
                  onDragMove={ev => { if (dv.eixo === 'h') ev.target.x(0); else ev.target.y(0) }}
                  onMouseEnter={ev => cursorPalco(ev, dv.eixo === 'h' ? 'ns-resize' : 'ew-resize')} onMouseLeave={ev => cursorPalco(ev, '')}
                  onDragEnd={ev => {
                    const d = dv.eixo === 'h' ? ev.target.y() : ev.target.x()
                    ev.target.position({ x: 0, y: 0 })
                    const novo = Math.max(0.05, Math.min(0.95, (c + d) / T))
                    const e0: Estrutura = estruturaDaPeca(doc as never, m.id)
                    // a peça com estrutura própria (ou "Aplicar em" ela) muda só ela; senão, todas
                    const so = ed.estruturaAlvo === m.id || !!m.medida?.estrutura ? m.id : null
                    useMaeDoc.getState().aplicar('Mover divisória', dd => aplicarEstrutura(dd as never, { ...e0, divisorias: e0.divisorias.map(x => (x.id === dv.id ? { ...x, pos: Math.round(novo * 1000) / 1000 } : x)) }, so ? { peca: so } : {}))
                  }} data-divisoria-arte={dv.id} />
              )
            })}
            {useMoldes.getState().semFace?.moldeId === m.id && (() => {
              const sf = useMoldes.getState().semFace!
              return <Group listening={false} data-sem-face>
                <Circle x={sf.ponto[0]} y={sf.ponto[1]} radius={6 * fino} stroke="#dc2626" strokeWidth={2} strokeScaleEnabled={false} dash={[3 * fino, 2 * fino]} />
                <Text x={sf.ponto[0] + 8 * fino} y={sf.ponto[1] - 6 * fino} text="linha aberta aqui (não é face)" fontSize={10 * fino} fill="#dc2626" fontStyle="bold" />
              </Group>
            })()}
            {moldeDosPontos === m.id && pontos.length > 0 && (
              <>
                <Line points={pontos.flat()} stroke="#f97316" strokeWidth={2} strokeScaleEnabled={false} closed={false} listening={false} />
                {pontos.map((p, k) => <Circle key={k} x={p[0]} y={p[1]} radius={3 * fino} fill="#f97316" listening={false} />)}
              </>
            )}
          </Group>
        )
      })}
      {modo === 'medir' && pontos.length === 1 && <Circle x={pontos[0][0]} y={pontos[0][1]} radius={3 * fino} fill="#0284c7" listening={false} />}
      {medida && (
        <>
          <Line points={[...medida.a, ...medida.b]} stroke="#0284c7" strokeWidth={2} strokeScaleEnabled={false} listening={false} />
          <Text x={(medida.a[0] + medida.b[0]) / 2 + 4 * fino} y={(medida.a[1] + medida.b[1]) / 2 - 16 * fino} text={`${medida.mm.toFixed(2).replace('.', ',')} mm`} fontSize={13 * fino} fill="#0369a1" fontStyle="bold" listening={false} />
        </>
      )}
    </Layer>
  )
}

function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }

/** Fecha o laço em andamento: vira face nova (substitui as que cobrir). */
export function fecharLaco(moldeId: string, pts: Pt[]) {
  const set = useMoldes.getState().set
  // duplo clique conta 2 cliques no mesmo lugar: tira pontos repetidos; com menos de 3, continua o laço
  const unicos = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.05)
  if (unicos.length < 3) return
  const ok = editarFaces(moldeId, 'Laço: nova face', fs => lacoParaFace(fs, unicos))
  set({ pontos: [], moldeDosPontos: null, aviso: ok ? null : 'O laço precisa de pelo menos 3 pontos e alguma área.' })
}
