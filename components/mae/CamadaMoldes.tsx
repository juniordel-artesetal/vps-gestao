'use client'
'use no memo'
// Moldes e faces no palco (interface, não arte): a prévia das linhas do molde, as faces (cor por estado)
// e as arestas — CORTE em vermelho contínuo, DOBRA em azul tracejado. Os cliques das ferramentas são
// tratados aqui por geometria (ponto no polígono), com ímã opcional no centro da linha.
import { Layer, Group, Image as KImage, Line, Rect, Circle, Text } from 'react-konva'
import type Konva from 'konva'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { area, centroide, dentro, type Pt } from '@/lib/mae/faces/geometria'
import { dividirFace, ima, lacoParaFace, unirFaces } from '@/lib/mae/faces/ferramentas'
import { tiposDeArestas } from '@/lib/mae/faces/detectar'
import { editarFaces, preparadoDe, useMoldes, PX_MM_DETECCAO } from './moldesEditor'
import { equivalentesDaSelecao } from './PainelMoldes'
import type { DocTrabalho } from '@/lib/mae/schema'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { parteDaFace, sugerirParaParte } from '@/lib/mae/vinculo/partes'
import { quadroDaFace, type Quadro } from '@/lib/mae/vinculo/enquadramento'
import { aplicar as aplicarM, inversa } from '@/lib/mae/vinculo/matriz'
import { efetiva, ajustesDaFace, matrizDaCamada, posicaoEfetiva, ehAplique, type CamadaImagemTema } from '@/lib/mae/vinculo/resolver'
import CaixaTransformavel, { anguloFinal, cantosGirados } from './CaixaTransformavel'
import { escalarPosicao } from '@/lib/mae/editor/posicaoTexto'
import { usePedidoAberto } from './pedidosMae'
import type { DocTema } from '@/lib/mae/schema'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { useEditor } from './estado'
import { alternarFaceNaParte, editarCamadaTema } from './acoesVinculo'
import { infoEmCache } from './arquivosMae'
import { COR_PARTE } from './PainelBase'
import { duplicarPosicao, moverParaFace } from '@/lib/mae/editor/textosReplicar'
import { caixaNaFolha, daFolha, giroDo, paraFolha } from '@/lib/mae/editor/giroMolde'

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

export default function CamadaMoldes({ posicoes, escala }: { posicoes: { xMm: number; yMm: number }[]; escala: number }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const { modo, face, pontos, moldeDosPontos, medida, ima: comIma, sel: moldesSel } = useMoldes()
  useMoldes(s => s.versao)   // redesenha quando a prévia de um molde fica pronta
  const set = useMoldes.getState().set
  const ed = useEditor()
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const valoresPedido = usePedidoAberto(s => s.valores)
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

  /** Cliques dos passos 4–9 da base e do tema. */
  function cliqueVinculo(m: Molde | null, local: Pt | null) {
    const es = useEditor.getState()
    const faceId = m && local ? faceSemFuroNoPonto(m, local) : null
    if (es.modo === 'tema') {
      const slotAqui = m && local && faceId && tema ? doc.textSlots.find(t => {
        if (t.faceId !== faceId) return false
        const q = quadroDe(doc, m, t.faceId); if (!q) return false
        const b = posicaoEfetiva(t, tema, valoresPedido).caixa
        const [u, v] = aplicarM(inversa(q.face), local[0], local[1])
        return u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h
      }) : undefined
      if (slotAqui) { es.set({ slot: slotAqui.id, face: faceId, camada: null }); return }
      if (es.slot) es.set({ slot: null })
      const parte = faceId ? parteDe.get(faceId) : null
      const cam = es.camada && tema ? acharCamadaTema(tema, es.camada) : null
      const manter = !!cam && ((!!cam.partId && cam.partId === parte?.id) || (!!cam.faceId && cam.faceId === faceId))
      es.set({ face: parte ? faceId : null, parteAtiva: parte?.id ?? es.parteAtiva, camada: manter ? es.camada : null })
      return
    }
    if (es.passo === 4) { if (faceId) alternarFaceNaParte(faceId); return }
    if (es.passo === 6 && es.posicionar?.tipo === 'texto' && m && faceId && local) {
      const q = quadroDe(doc, m, faceId)!
      const [u, v] = aplicarM(inversa(q.face), local[0], local[1])
      const w = 0.8, h = 0.18, r3 = (x: number) => Math.round(x * 1000) / 1000
      const variavel = es.posicionar.variavel
      const id = `ts_${variavel.toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`
      useMaeDoc.getState().aplicar(`Posicionar ${variavel}`, d => {
        d.textSlots.push({ id, variable: variavel, faceId, box: { x: r3(Math.min(Math.max(u - w / 2, 0), 1 - w)), y: r3(Math.min(Math.max(v - h / 2, 0), 1 - h)), w, h },
          single: { lines: 1, sizePt: variavel === 'NOME' ? 28 : 18 }, compound: { lines: 2, sizePt: variavel === 'NOME' ? 22 : 16, lineHeight: 0.9 }, autoFit: { minScale: 0.7 } })
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

  /** Botão direito no tema (Lote 2, item 16): acha o ELEMENTO de cima sob o cursor e abre o menu dele. */
  function menuDireito(e: Konva.KonvaEventObject<PointerEvent | MouseEvent>) {
    const es = useEditor.getState()
    if (es.modo !== 'tema' || !tema) return
    e.evt.preventDefault()
    const l = localizar(e as Konva.KonvaEventObject<MouseEvent>); if (!l?.m || !l.local) return
    const faceId = faceSemFuroNoPonto(l.m, l.local); if (!faceId) return
    const parte = parteDe.get(faceId); if (!parte) return
    const q = quadroDe(doc, l.m, faceId)!, A = parte.referenceAspect ?? 1
    const aj = ajustesDaFace(tema, faceId)
    const candidatas = [...(tema.partContent[parte.id] ?? []).map(c => efetiva(c, aj[c.id])), ...(tema.faceContent?.[faceId] ?? [])]
      .filter(c => c.type === 'image' && (c.anchor ?? 'face') !== 'paper' && c.visible !== false) as CamadaImagemTema[]
    const achada = [...candidatas].reverse().find(c => {
      const [u, v] = aplicarM(inversa(matrizDaCamada(c, q, A)), l.local![0], l.local![1])
      return u >= 0 && u <= 1 && v >= 0 && v <= 1
    })
    if (!achada) { es.set({ menuCamada: null }); return }
    es.set({ face: faceId, parteAtiva: parte.id, camada: achada.id, menuCamada: { x: e.evt.clientX, y: e.evt.clientY, camada: achada.id } })
  }

  function clique(e: Konva.KonvaEventObject<MouseEvent>) {
    const l = localizar(e); if (!l) return
    if (ed.modo === 'base' && useEditor.getState().prancheta !== (l.ab?.id ?? null)) useEditor.getState().set({ prancheta: l.ab?.id ?? null })
    const { m, local } = l
    if (vinculo) { cliqueVinculo(m, local); return }
    if (modo === 'selecionar') {
      const id = m && local ? faceNoPonto(m, local) : null
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
          <Group key={m.id} x={ox} y={oy} rotation={giroDo(m)} onClick={clique} onContextMenu={menuDireito} onDblClick={() => { if (modo === 'laco' && moldeDosPontos) fecharLaco(moldeDosPontos, useMoldes.getState().pontos) }}>
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
              return <Line key={f.id} points={pts} closed fill={preenchimento} strokeEnabled={vinculo && ed.face === f.id} stroke="#f97316" strokeWidth={3} strokeScaleEnabled={false} data-face={k} />
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
                          let novo: string | null = null
                          useMaeDoc.getState().aplicar(alt ? 'Duplicar texto' : 'Mover texto para outra página', d => {
                            if (alt) novo = duplicarPosicao(d as never, t.id, { faceId: outraFace, centro: { u: u2, v: v2 } })
                            else moverParaFace(d as never, t.id, outraFace, { u: u2, v: v2 })
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
            {ed.modo === 'tema' && tema && ed.slot && (() => {
              const t = doc.textSlots.find(x => x.id === ed.slot && m.faces.some(f => f.id === x.faceId))
              if (!t) return null
              const q = quadroDe(doc, m, t.faceId)!
              const ef = posicaoEfetiva(t, tema, valoresPedido)
              const b = ef.caixa
              const [cx, cy] = aplicarM(q.face, b.x + b.w / 2, b.y + b.h / 2)
              const g = (ef.rotacaoDeg * Math.PI) / 180
              const cs = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([u, v]) => aplicarM(q.face, u, v))
                .map(([x, y]) => [cx + (x - cx) * Math.cos(g) - (y - cy) * Math.sin(g), cy + (x - cx) * Math.sin(g) + (y - cy) * Math.cos(g)] as Pt)
              const aj = tema.textSlotAdjust?.[t.id] ?? {}
              const ajustar = (label: string, f: (a: NonNullable<DocTema['textSlotAdjust']>[string]) => void) => useMaeTema.getState().aplicar(`${label} (só nesta caixa)`, tt => {
                const x = tt as DocTema; x.textSlotAdjust ??= {}; const a = (x.textSlotAdjust[t.id] ??= {}); f(a)
              })
              const r3 = (x: number) => Math.round(x * 1000) / 1000
              return (
                <CaixaTransformavel key={`tsel:${t.id}`} cantos={cs} fino={fino} chave={`${t.id}:${JSON.stringify(aj)}:${JSON.stringify(b)}`}
                  onMover={(dx, dy) => { const [u, v] = aplicarM(inversa(q.face), cx + dx, cy + dy); ajustar('Mover texto', a => { a.dx = r3((a.dx ?? 0) + u - (b.x + b.w / 2)); a.dy = r3((a.dy ?? 0) + v - (b.y + b.h / 2)) }) }}
                  onEscalar={(k, dl) => { const [u, v] = aplicarM(inversa(q.face), cx + dl[0], cy + dl[1]); ajustar('Tamanho do texto', a => { a.scale = r3(Math.min(4, Math.max(0.2, (a.scale ?? 1) * k))); a.dx = r3((a.dx ?? 0) + u - (b.x + b.w / 2)); a.dy = r3((a.dy ?? 0) + v - (b.y + b.h / 2)) }) }}
                  onGirar={(gr, sh) => ajustar('Girar texto', a => { a.rotationDeg = anguloFinal(a.rotationDeg ?? 0, gr, sh) })} />
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
              const q = quadroDe(doc, m, f.id)
              if (!q) return []
              const A = parte.referenceAspect ?? 1
              const aj = ajustesDaFace(tema, f.id)
              return [...(tema.partContent[parte.id] ?? []), ...(tema.faceContent?.[f.id] ?? [])].filter(c => ehAplique(tema, c) && c.visible !== false).map(c => {
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
              const q = quadroDe(doc, m, ed.face!)!
              const A = parte.referenceAspect ?? 1
              const ef = (cam.faceId ? cam.c : efetiva(cam.c, ajustesDaFace(tema, ed.face!)[cam.c.id])) as CamadaImagemTema
              const M = matrizDaCamada(ef, q, A)
              const cs = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => aplicarM(M, u, v))
              // Sprint 10: alças — cantos escalam (em volta do centro), a de cima gira
              const T = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0, ...(ef.transform ?? {}) }
              const [ccx, ccy] = aplicarM(M, 0.5, 0.5)
              const giro = aplicarM(M, 0.5, -0.12)
              const r3 = (v: number) => Math.round(v * 1000) / 1000
              const chaveAlca = `${ed.camada}:${ed.face}:${JSON.stringify(ef.transform)}`
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
                        const k = Math.hypot(ev.target.x() - ccx, ev.target.y() - ccy) / Math.max(1e-6, Math.hypot(x - ccx, y - ccy))
                        editarCamadaTema(cam.c.id, { transform: { scale: r3(Math.min(20, Math.max(0.02, T.scale * k))) } }, 'Escala', undefined, ev.evt.altKey ? 'face' : undefined)
                      }} data-alca-escala={i} />
                  ))}
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
                      if (ev.evt.shiftKey) rot = Math.round(rot / 15) * 15
                      editarCamadaTema(cam.c.id, { transform: { rotationDeg: Math.round(rot * 10) / 10 } }, 'Girar', undefined, ev.evt.altKey ? 'face' : undefined)
                    }} data-alca-giro />
                </>
              )
              return (
                <Group key={`g:${chaveAlca}`}>
                <Line key={`${ed.camada}:${ed.face}:${JSON.stringify(ef.transform)}`} name="contorno-tema" points={cs.flat()} closed stroke="#f97316" strokeWidth={2} strokeScaleEnabled={false} dash={[6 * fino, 4 * fino]} fill="rgba(249,115,22,0.05)" draggable
                  onPointerDown={ev => { ev.evt.stopPropagation() }} onMouseEnter={ev => cursorPalco(ev, 'move')} onMouseLeave={ev => cursorPalco(ev, '')}
                  onDragEnd={ev => {
                    const dx = ev.target.x(), dy = ev.target.y()
                    const [cx, cy] = aplicarM(M, 0.5, 0.5)
                    const novo: [number, number] = [cx + dx, cy + dy]
                    let x: number, y: number
                    if ((ef.anchor ?? 'face') === 'paper') { const [s2, t2] = aplicarM(inversa(q.papel), novo[0], novo[1]); x = s2 / A; y = t2 }
                    else { [x, y] = aplicarM(inversa(q.face), novo[0], novo[1]) }
                    const r = (v: number) => Math.round(v * 1000) / 1000
                    editarCamadaTema(cam.c.id, { transform: { x: r(x), y: r(y) } }, 'Mover', undefined, ev.evt.altKey ? 'face' : undefined)
                    ev.target.position({ x: 0, y: 0 })
                  }} data-contorno-tema />
                {alcas}
                </Group>
              )
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
