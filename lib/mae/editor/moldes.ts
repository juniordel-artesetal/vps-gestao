// mae-editor — MOLDES NA BASE (puras): "Organizar" (onde cada molde novo entra nas pranchetas) e a
// conversão entre a detecção (polígono + tipo por aresta) e a receita (polygonMm + edges {from,to,kind}).
import { arestasDeTipos, tiposDeArestas, type FaceDetectada } from '../faces/detectar'
import type { FaceEdit } from '../faces/ferramentas'
import { FOLHAS } from '../schema/prancheta'
import type { z } from 'zod'
import type { Face } from '../schema/base'

type FaceReceita = z.infer<typeof Face>
export interface Retangulo { x: number; y: number; w: number; h: number }
interface PranchetaMin { id: string; widthMm: number; heightMm: number }
interface MoldeMin { artboardId: string; transform: { xMm: number; yMm: number }; source: { widthMm: number; heightMm?: number } }

/** O recorte do molde já tem 3 mm de branco em volta; aqui é só um respiro. */
export const MARGEM_MM = 2, ESPACO_MM = 2

const sobrepoe = (a: Retangulo, b: Retangulo, g: number) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g

/** Primeira posição livre (de cima para baixo, da esquerda para a direita) para w × h na folha. */
export function lugarNaFolha(W: number, H: number, ocupados: Retangulo[], w: number, h: number): { x: number; y: number } | null {
  const cand: { x: number; y: number }[] = [{ x: MARGEM_MM, y: MARGEM_MM }]
  for (const r of ocupados) cand.push({ x: r.x + r.w + ESPACO_MM, y: r.y }, { x: MARGEM_MM, y: r.y + r.h + ESPACO_MM }, { x: r.x, y: r.y + r.h + ESPACO_MM })
  cand.sort((a, b) => a.y - b.y || a.x - b.x)
  for (const c of cand) {
    if (c.x + w > W - MARGEM_MM + 1e-6 || c.y + h > H - MARGEM_MM + 1e-6) continue
    const r = { x: c.x, y: c.y, w, h }
    if (!ocupados.some(o => sobrepoe(r, o, ESPACO_MM - 1e-6))) return c
  }
  return null
}

export interface ResultadoOrganizar {
  /** Pranchetas novas (ou trocadas de orientação, quando a folha estava vazia). */
  pranchetas: PranchetaMin[]
  posicoes: { artboardId: string; xMm: number; yMm: number }[]
}

/**
 * Coloca os moldes novos nas pranchetas: primeiro onde couber; uma folha VAZIA pode girar para paisagem;
 * se não couber em nenhuma, cria uma A4 (na orientação que couber) ou uma folha do tamanho do molde.
 * `vazia(id)` diz se a folha não tem molde nem camada.
 */
export function organizar(pranchetas: PranchetaMin[], moldes: MoldeMin[], novos: { wMm: number; hMm: number }[], vazia: (id: string) => boolean, novoId: () => string): ResultadoOrganizar {
  const folhas = pranchetas.map(p => ({ ...p }))
  const ocupado = new Map<string, Retangulo[]>()
  for (const p of folhas) ocupado.set(p.id, [])
  for (const m of moldes) ocupado.get(m.artboardId)?.push({ x: m.transform.xMm, y: m.transform.yMm, w: m.source.widthMm, h: m.source.heightMm ?? m.source.widthMm })
  const posicoes: ResultadoOrganizar['posicoes'] = []
  for (const n of novos) {
    let feito = false
    for (const p of folhas) {
      const lugar = lugarNaFolha(p.widthMm, p.heightMm, ocupado.get(p.id)!, n.wMm, n.hMm)
      if (lugar) { ocupado.get(p.id)!.push({ x: lugar.x, y: lugar.y, w: n.wMm, h: n.hMm }); posicoes.push({ artboardId: p.id, xMm: lugar.x, yMm: lugar.y }); feito = true; break }
      // folha vazia na orientação errada: gira
      if (!ocupado.get(p.id)!.length && vazia(p.id) && lugarNaFolha(p.heightMm, p.widthMm, [], n.wMm, n.hMm)) {
        ;[p.widthMm, p.heightMm] = [p.heightMm, p.widthMm]
        ocupado.get(p.id)!.push({ x: MARGEM_MM, y: MARGEM_MM, w: n.wMm, h: n.hMm })
        posicoes.push({ artboardId: p.id, xMm: MARGEM_MM, yMm: MARGEM_MM }); feito = true; break
      }
    }
    if (feito) continue
    const a4 = FOLHAS.A4
    const opcoes = n.wMm > n.hMm ? [[a4.heightMm, a4.widthMm], [a4.widthMm, a4.heightMm]] : [[a4.widthMm, a4.heightMm], [a4.heightMm, a4.widthMm]]
    const cabe = opcoes.find(([W, H]) => n.wMm + 2 * MARGEM_MM <= W && n.hMm + 2 * MARGEM_MM <= H)
    const [W, H] = cabe ?? [Math.ceil(n.wMm + 2 * MARGEM_MM), Math.ceil(n.hMm + 2 * MARGEM_MM)]
    const nova = { id: novoId(), widthMm: W, heightMm: H }
    folhas.push(nova)
    ocupado.set(nova.id, [{ x: MARGEM_MM, y: MARGEM_MM, w: n.wMm, h: n.hMm }])
    posicoes.push({ artboardId: nova.id, xMm: MARGEM_MM, yMm: MARGEM_MM })
  }
  return { pranchetas: folhas, posicoes }
}

// ── faces: detecção/edição ↔ receita ─────────────────────────────────────────────────────────────
/** Detecção/edição → receita. Faces que já têm id mantêm; as novas ganham o próximo número livre. */
export function facesParaReceita(moldeId: string, faces: (FaceDetectada | FaceEdit)[]): FaceReceita[] {
  const usados = new Set(faces.map(f => (f as FaceEdit).id).filter(Boolean) as string[])
  let n = 0
  const proximo = () => { let id: string; do id = `f_${moldeId}_${++n}`; while (usados.has(id)); usados.add(id); return id }
  return faces.map(f => {
    const e = f as FaceEdit
    return {
      id: e.id ?? proximo(),
      polygonMm: f.poligono.map(([x, y]) => [x, y] as [number, number]),
      edges: arestasDeTipos(f.tipos),
      ...(f.furo ? { hole: true } : {}),
      ...(e.manual ? { manual: true } : {}),
    }
  })
}

export function facesDaReceita(faces: FaceReceita[]): FaceEdit[] {
  return faces.map(f => ({
    id: f.id, poligono: f.polygonMm.map(([x, y]) => [x, y] as [number, number]),
    tipos: tiposDeArestas(f.edges, f.polygonMm.length), furo: !!f.hole, ...(f.manual ? { manual: true } : {}),
  }))
}
