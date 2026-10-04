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

type Molde = DocTrabalho['molds'][number]
const COR = { corte: '#dc2626', dobra: '#2563eb', sel: 'rgba(249,115,22,0.35)', eq: 'rgba(245,158,11,0.28)', furo: 'rgba(100,116,139,0.30)', face: 'rgba(14,165,233,0.07)' }

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
  if (!doc.molds.length) return null

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

  function clique(e: Konva.KonvaEventObject<MouseEvent>) {
    const l = localizar(e); if (!l) return
    const { m, local } = l
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
              return <Line key={f.id} points={pts} closed fill={sel ? COR.sel : eqs.has(`${m.id}/${f.id}`) ? COR.eq : f.hole ? COR.furo : COR.face} strokeEnabled={false} data-face={k} />
            })}
            {m.faces.map(f => {
              const pol = f.polygonMm as Pt[], tipos = tiposDeArestas(f.edges, pol.length)
              return pol.map((p, k) => {
                const q = pol[(k + 1) % pol.length], corte = tipos[k] === 'cut'
                return <Line key={`${f.id}-${k}`} points={[p[0], p[1], q[0], q[1]]} stroke={corte ? COR.corte : COR.dobra} strokeWidth={corte ? 1.6 : 1.3} strokeScaleEnabled={false} dash={corte ? undefined : [5 * fino, 3 * fino]} listening={false} />
              })
            })}
            {m.faces.filter(f => !f.hole).map(f => {
              const [cx, cy] = centroide(f.polygonMm as Pt[])
              return <Text key={`t-${f.id}`} x={cx - 6 * fino} y={cy - 5 * fino} text={f.id.split('_').pop()} fontSize={10 * fino} fill="#475569" listening={false} />
            })}
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

/** Fecha o laço em andamento: vira face nova (substitui as que cobrir). */
export function fecharLaco(moldeId: string, pts: Pt[]) {
  const set = useMoldes.getState().set
  // duplo clique conta 2 cliques no mesmo lugar: tira pontos repetidos; com menos de 3, continua o laço
  const unicos = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.05)
  if (unicos.length < 3) return
  const ok = editarFaces(moldeId, 'Laço: nova face', fs => lacoParaFace(fs, unicos))
  set({ pontos: [], moldeDosPontos: null, aviso: ok ? null : 'O laço precisa de pelo menos 3 pontos e alguma área.' })
}
