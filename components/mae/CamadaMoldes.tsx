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
import { efetiva, ajustesDaFace, matrizDaCamada, type CamadaImagemTema } from '@/lib/mae/vinculo/resolver'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { useEditor } from './estado'
import { alternarFaceNaParte, editarCamadaTema } from './acoesVinculo'
import { infoEmCache } from './arquivosMae'
import { COR_PARTE } from './PainelBase'

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
    const ox = p.xMm + m.transform.xMm, oy = p.yMm + m.transform.yMm
    if (mundo[0] >= ox && mundo[1] >= oy && mundo[0] <= ox + m.source.widthMm && mundo[1] <= oy + (m.source.heightMm ?? m.source.widthMm)) return { m, local: [mundo[0] - ox, mundo[1] - oy] }
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

export default function CamadaMoldes({ posicoes, escala }: { posicoes: { xMm: number; yMm: number }[]; escala: number }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const { modo, face, pontos, moldeDosPontos, medida, ima: comIma } = useMoldes()
  useMoldes(s => s.versao)   // redesenha quando a prévia de um molde fica pronta
  const set = useMoldes.getState().set
  const ed = useEditor()
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  if (!doc.molds.length) return null
  const vinculo = ed.modo === 'tema' || (ed.modo === 'base' && ed.passo >= 4)
  const sugestoes = ed.modo === 'base' && ed.passo === 4 && ed.parteAtiva ? new Set(sugerirParaParte(doc, ed.parteAtiva).map(x => x.faceId)) : new Set<string>()
  const corDaParte = new Map(doc.parts.map((p, i) => [p.id, COR_PARTE[i % COR_PARTE.length]]))
  const parteDe = new Map(doc.parts.flatMap(p => p.instances.map(i => [i.faceId, p] as const)))

  const eqs = face ? new Set(equivalentesDaSelecao().map(e => `${e.moldeId}/${e.faceId}`)) : new Set<string>()
  const abPos = new Map(doc.artboards.map((a, i) => [a.id, posicoes[i]]))
  const origem = (m: Molde): Pt => { const p = abPos.get(m.artboardId) ?? { xMm: 0, yMm: 0 }; return [p.xMm + m.transform.xMm, p.yMm + m.transform.yMm] }
  const fino = 1 / escala

  /** Clique no palco → (prancheta, molde, ponto local). */
  function localizar(e: Konva.KonvaEventObject<MouseEvent>) {
    const st = e.target.getStage(); const p = st?.getPointerPosition(); if (!st || !p) return null
    const mundo: Pt = [(p.x - st.x()) / escala, (p.y - st.y()) / escala]
    const m = doc.molds.find(mm => {
      const [ox, oy] = origem(mm)
      return mundo[0] >= ox && mundo[1] >= oy && mundo[0] <= ox + mm.source.widthMm && mundo[1] <= oy + (mm.source.heightMm ?? mm.source.widthMm)
    }) ?? null
    let local: Pt | null = null
    if (m) {
      const [ox, oy] = origem(m)
      local = [mundo[0] - ox, mundo[1] - oy]
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
    const parte = faceId ? parteDe.get(faceId) : null
    es.set({ face: faceId, ...(parte ? { parteAtiva: parte.id } : {}) })
  }

  function clique(e: Konva.KonvaEventObject<MouseEvent>) {
    const l = localizar(e); if (!l) return
    const { m, local } = l
    if (vinculo) { cliqueVinculo(m, local); return }
    if (modo === 'selecionar') {
      const id = m && local ? faceNoPonto(m, local) : null
      set({ face: id && m ? { moldeId: m.id, faceId: id } : null })
      if (id) useMaeDoc.getState().setSelecao(null)
      return
    }
    if (modo === 'medir') {
      const ptMundo: Pt = m && local ? [origem(m)[0] + local[0], origem(m)[1] + local[1]] : l.mundo
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
          <Group key={m.id} x={ox} y={oy} onClick={clique} onDblClick={() => { if (modo === 'laco' && moldeDosPontos) fecharLaco(moldeDosPontos, useMoldes.getState().pontos) }}>
            {prep && <KImage image={prep.previa as unknown as HTMLImageElement} width={m.source.widthMm} height={m.source.heightMm ?? m.source.widthMm} listening={false} />}
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
              const cs = [[t.box.x, t.box.y], [t.box.x + t.box.w, t.box.y], [t.box.x + t.box.w, t.box.y + t.box.h], [t.box.x, t.box.y + t.box.h]].map(([u, v]) => aplicarM(q.face, u, v))
              const [cx, cy] = aplicarM(q.face, t.box.x + t.box.w / 2, t.box.y + t.box.h / 2)
              const exemplo = t.variable === 'NOME' ? 'Maria Júlia' : t.variable === 'IDADE' ? '1 ano' : t.variable === 'HASHTAG' ? '#MariaJúliafaz1' : t.variable
              const tam = Math.min(t.box.h * q.h * 0.55, (t.box.w * q.w) / Math.max(4, exemplo.length * 0.55))
              const sl = ed.slot === t.id
              return (
                <Group key={t.id} listening={false}>
                  <Line points={cs.flat()} closed stroke={sl ? '#f97316' : '#7c3aed'} strokeWidth={sl ? 2 : 1.2} strokeScaleEnabled={false} dash={[4 * fino, 3 * fino]} fill={sl ? 'rgba(249,115,22,0.10)' : 'rgba(124,58,237,0.06)'} />
                  <Text x={cx} y={cy} offsetX={(exemplo.length * tam * 0.5) / 2} offsetY={tam / 2} rotation={q.rot} text={exemplo} fontSize={tam} fontStyle="bold" fill={sl ? '#c2410c' : '#6d28d9'} />
                  <Text x={cs[0][0]} y={cs[0][1] - 9 * fino} rotation={q.rot} text={t.variable} fontSize={8 * fino} fill="#7c3aed" />
                </Group>
              )
            })}
            {vinculo && (ed.modo === 'tema' || ed.passo >= 7) && (['logo', 'qr'] as const).map(k => {
              const pos = m.identity?.[k], arq = ed.identidade[k]
              if (!pos) return null
              const info = arq ? infoEmCache(arq.path) : undefined
              const h = pos.wMm / (arq?.aspect || 1)
              return info?.bitmap
                ? <KImage key={k} image={info.bitmap as unknown as HTMLImageElement} x={pos.xMm} y={pos.yMm} width={pos.wMm} height={h} listening={false} opacity={0.95} data-identidade={k} />
                : <Rect key={k} x={pos.xMm} y={pos.yMm} width={pos.wMm} height={h} stroke="#0f172a" strokeWidth={1} strokeScaleEnabled={false} dash={[3 * fino, 2 * fino]} listening={false} />
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
              return (
                <Line key={`${ed.camada}:${ed.face}:${JSON.stringify(ef.transform)}`} points={cs.flat()} closed stroke="#f97316" strokeWidth={2} strokeScaleEnabled={false} dash={[6 * fino, 4 * fino]} fill="rgba(249,115,22,0.05)" draggable
                  onPointerDown={ev => { ev.evt.stopPropagation() }}
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
