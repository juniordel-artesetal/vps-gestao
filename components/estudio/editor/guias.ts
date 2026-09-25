// SOA Edition — guias inteligentes + grade do editor. Ao arrastar, a camada "gruda" nas bordas e no
// centro da arte e das outras camadas (linha laranja aparece); com a grade ligada, gruda na grade.
// As linhas são desenhadas por cima do canvas na tela e NUNCA entram na exportação.
import type { Canvas, FabricObject } from 'fabric'

export interface EstadoGuias { x: number[]; y: number[] }

const bordas = (r: { left: number; top: number; width: number; height: number }) => ({
  x: [r.left, r.left + r.width / 2, r.left + r.width], y: [r.top, r.top + r.height / 2, r.top + r.height],
})

/** Ajusta a posição do objeto que está sendo arrastado e devolve as guias a desenhar. */
export function grudar(
  canvas: Canvas, alvo: FabricObject, design: { largura: number; altura: number }, zoom: number,
  op: { guias: boolean; grade: number | null }, ignorar: (o: FabricObject) => boolean,
): EstadoGuias {
  const tol = 6 / zoom
  const out: EstadoGuias = { x: [], y: [] }
  const r = alvo.getBoundingRect()
  const minhas = bordas(r)
  let dx = 0, dy = 0
  if (op.guias) {
    const cx = [0, design.largura / 2, design.largura], cy = [0, design.altura / 2, design.altura]
    for (const o of canvas.getObjects()) {
      if (o === alvo || ignorar(o) || !o.visible) continue
      const b = bordas(o.getBoundingRect()); cx.push(...b.x); cy.push(...b.y)
    }
    let melhorX = tol + 1, melhorY = tol + 1
    for (const m of minhas.x) for (const c of cx) { const d = c - m; if (Math.abs(d) < Math.abs(melhorX)) { melhorX = d; } }
    for (const m of minhas.y) for (const c of cy) { const d = c - m; if (Math.abs(d) < Math.abs(melhorY)) { melhorY = d; } }
    if (Math.abs(melhorX) <= tol) dx = melhorX
    if (Math.abs(melhorY) <= tol) dy = melhorY
    const fx = bordas({ ...r, left: r.left + dx, top: r.top + dy })
    if (dx || Math.abs(melhorX) <= tol) for (const m of fx.x) if (cx.some(c => Math.abs(c - m) < 0.5)) out.x.push(m)
    if (dy || Math.abs(melhorY) <= tol) for (const m of fx.y) if (cy.some(c => Math.abs(c - m) < 0.5)) out.y.push(m)
  }
  if (op.grade && !dx && !out.x.length) dx = Math.round(r.left / op.grade) * op.grade - r.left
  if (op.grade && !dy && !out.y.length) dy = Math.round(r.top / op.grade) * op.grade - r.top
  if (dx || dy) { alvo.set({ left: (alvo.left || 0) + dx, top: (alvo.top || 0) + dy }); alvo.setCoords() }
  return out
}

/** Desenha grade e guias sobre o canvas (contexto de baixo, depois dos objetos). */
export function desenharSobreposicao(canvas: Canvas, design: { largura: number; altura: number }, g: EstadoGuias, grade: number | null) {
  const ctx = canvas.getContext()
  const v = canvas.viewportTransform
  ctx.save()
  ctx.setTransform(v[0], v[1], v[2], v[3], v[4], v[5])
  const z = v[0] || 1
  if (grade) {
    ctx.strokeStyle = 'rgba(100,116,139,0.18)'; ctx.lineWidth = 1 / z
    ctx.beginPath()
    for (let x = grade; x < design.largura; x += grade) { ctx.moveTo(x, 0); ctx.lineTo(x, design.altura) }
    for (let y = grade; y < design.altura; y += grade) { ctx.moveTo(0, y); ctx.lineTo(design.largura, y) }
    ctx.stroke()
  }
  if (g.x.length || g.y.length) {
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1 / z; ctx.setLineDash([4 / z, 3 / z])
    ctx.beginPath()
    for (const x of g.x) { ctx.moveTo(x, 0); ctx.lineTo(x, design.altura) }
    for (const y of g.y) { ctx.moveTo(0, y); ctx.lineTo(design.largura, y) }
    ctx.stroke()
  }
  ctx.restore()
}
