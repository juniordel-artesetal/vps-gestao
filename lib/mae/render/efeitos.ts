// mae-render — ESTILOS DE CAMADA (Sprint 8) dentro do MOTOR ÚNICO: a mesma função desenha os efeitos na
// prévia e no arquivo. Cada camada com efeitos é desenhada num buffer do tamanho dela (+ folga), os
// efeitos são montados a partir da silhueta (alpha) e o resultado entra na folha com a opacidade e o
// modo da camada. Ordem de baixo para cima (como no Photoshop): sombra projetada, brilho externo,
// conteúdo (com o PREENCHIMENTO), padrão, degradê, cor, brilho interno, sombra interna, traçados, chanfro.
// Traçado em texto/caminho é EXATO (stroke do vetor); em imagem é por dilatação (aproximação).
// Chanfro e entalhe é uma aproximação boa (realce + sombra internos), não "igual ao Photoshop".
import type { Efeito, NoCamada } from '../schema'
import type { CanvasLike, Ctx, FabricaCanvas, ResolverBitmap } from './renderizar'
import { aplicarAjustes } from './ajustes'

export interface AmbienteEfeitos {
  k: number
  criarCanvas: FabricaCanvas
  bitmap: ResolverBitmap
  caminho: (d: string) => Path2D
  /** Tamanho da folha (px), para camadas sem caixa conhecida. */
  W: number; H: number
  /**
   * Lote 9 (item 140): a camada está RECORTADA na forma da face (papel, elemento da caixa) — a parte visível dela é
   * a camada ∩ face. Os efeitos INTERNOS (brilho interno, sombra interna, chanfro, traçado "dentro") nascem dessa
   * borda visível. Antes nasciam da borda do retângulo do papel, que fica fora da face e era cortada: nada aparecia.
   * `c` = buffer da forma da face (região começando em x0,y0 da folha).
   */
  recorte?: { c: CanvasLike; x0: number; y0: number }
  /**
   * Urgente pós-Lote 9 (12/10/2026): prévia da TELA — sombra/brilho (os desfoques) em meia resolução. A exportação e
   * a prévia de aprovação nunca ligam isto (saem em resolução cheia, idênticas a antes).
   */
  rapido?: boolean
}

/** Os efeitos já montados de uma camada (buffer + onde ele fica na folha) — o que o cache da tela guarda. */
export interface EfeitosMontados { c: CanvasLike; x0: number; y0: number; w: number; h: number }

type Buf = { c: CanvasLike; g: Ctx; w: number; h: number }
const ctx2d = (c: CanvasLike) => c.getContext('2d') as Ctx
const gco = (m: string | undefined): GlobalCompositeOperation => (!m || m === 'normal' ? 'source-over' : (m as GlobalCompositeOperation))
const rad = (g: number) => (g * Math.PI) / 180

/** Caixa (mm) de uma camada, ou null se não dá para saber (aí usa a folha toda). */
export function caixaMm(no: NoCamada): [number, number, number, number] | null {
  const deCantos = (pts: [number, number][]) => {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number]
  }
  if (no.type === 'solid') return [no.xMm, no.yMm, no.xMm + no.wMm, no.yMm + no.hMm]
  if (no.type === 'path') return no.bboxMm
  if (no.type === 'shape') return deCantos(no.rings.flat())
  if (no.type === 'adjust') return null
  if (no.type === 'text' || no.type === 'vshape') {
    const r = rad(no.rotationDeg || 0), cx = no.xMm + no.wMm / 2, cy = no.yMm + no.hMm / 2
    return deCantos([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const x = (sx * no.wMm) / 2, y = (sy * no.hMm) / 2
      return [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)] as [number, number]
    }))
  }
  if (no.type === 'image') {
    if (no.matrix) { const [a, b, c, d, e, f] = no.matrix; return deCantos([[e, f], [a + e, b + f], [c + e, d + f], [a + c + e, b + d + f]]) }
    const r = rad(no.rotationDeg || 0), cx = no.xMm + no.wMm / 2, cy = no.yMm + no.hMm / 2
    return deCantos([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const x = (sx * no.wMm) / 2, y = (sy * no.hMm) / 2
      return [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)] as [number, number]
    }))
  }
  const filhos = no.children.map(caixaMm)
  if (!filhos.length || filhos.some(f => !f)) return null
  const fs = filhos as [number, number, number, number][]
  return [Math.min(...fs.map(f => f[0])), Math.min(...fs.map(f => f[1])), Math.max(...fs.map(f => f[2])), Math.max(...fs.map(f => f[3]))]
}

/** Monta a máscara (alpha) no buffer e recorta o conteúdo por ela. */
export function aplicarMascara(C: { c: CanvasLike; g: Ctx; w: number; h: number }, m: NonNullable<NoCamada['mask']>, x0: number, y0: number, k: number,
  novo: () => { c: CanvasLike; g: Ctx; w: number; h: number }, amb: AmbienteEfeitos) {
  const { w, h } = C
  const M = novo()
  const img = (b: { c: CanvasLike }) => b.c as unknown as CanvasImageSource
  const px = (x: number, y: number): [number, number] => [x * k - x0, y * k - y0]
  if (m.gradient) {
    const gd = m.gradient
    // com matriz: o degradê é montado no quadrado da camada e o canvas leva para o buffer (exato)
    const mt = gd.matrix
    if (mt) M.g.setTransform(mt[0] * k, mt[1] * k, mt[2] * k, mt[3] * k, mt[4] * k - x0, mt[5] * k - y0)
    const [ax, ay] = mt ? [gd.x0, gd.y0] : px(gd.x0, gd.y0), [bx, by] = mt ? [gd.x1, gd.y1] : px(gd.x1, gd.y1)
    const st = [...gd.stops].sort((a, b) => a.pos - b.pos)
    let gr: CanvasGradient
    if (gd.type === 'radial') gr = M.g.createRadialGradient(ax, ay, 0, ax, ay, Math.max(0.5, Math.hypot(bx - ax, by - ay)))
    else if (gd.type === 'angular' && 'createConicGradient' in M.g) gr = (M.g as CanvasRenderingContext2D).createConicGradient(Math.atan2(by - ay, bx - ax), ax, ay)
    else if (gd.type === 'reflected') {
      gr = M.g.createLinearGradient(2 * ax - bx, 2 * ay - by, bx, by)
      for (const s of [...st].reverse()) gr.addColorStop((1 - s.pos) / 2, `rgba(0,0,0,${s.alpha})`)
      for (const s of st) gr.addColorStop(0.5 + s.pos / 2, `rgba(0,0,0,${s.alpha})`)
    } else gr = M.g.createLinearGradient(ax, ay, bx, by)
    if (gd.type !== 'reflected') for (const s of st) gr.addColorStop(s.pos, `rgba(0,0,0,${s.alpha})`)
    M.g.fillStyle = gr
    if (mt) { M.g.fillRect(-200, -200, 401, 401); M.g.setTransform(1, 0, 0, 1, 0, 0) } else M.g.fillRect(0, 0, w, h)
  } else { M.g.fillStyle = '#000'; M.g.fillRect(0, 0, w, h) }
  if (m.raster) {
    const fonte = amb.bitmap(m.raster.src.sha256)
    if (fonte) {
      const R = novo()
      const [a, b, c, d, e, f] = m.raster.matrix
      const fw = (fonte as { width?: number }).width ?? 1, fh = (fonte as { height?: number }).height ?? 1
      R.g.setTransform((a * k) / fw, (b * k) / fw, (c * k) / fh, (d * k) / fh, e * k - x0, f * k - y0)
      R.g.imageSmoothingEnabled = true
      R.g.drawImage(fonte, 0, 0)
      M.g.globalCompositeOperation = 'destination-in'; M.g.drawImage(img(R), 0, 0); M.g.globalCompositeOperation = 'source-over'
    }
  }
  // Lote 10 (item 155): máscara de FORMA (vetor, no quadrado da camada) — "mostrar só a seleção" / "usar a forma da face"
  if (m.forma?.aneis?.length) {
    const S = novo(), mt = m.forma.matrix
    S.g.setTransform(mt[0] * k, mt[1] * k, mt[2] * k, mt[3] * k, mt[4] * k - x0, mt[5] * k - y0)
    S.g.fillStyle = '#000'; S.g.beginPath()
    for (const a of m.forma.aneis) { a.forEach(([u, v], i) => (i ? S.g.lineTo(u, v) : S.g.moveTo(u, v))); S.g.closePath() }
    S.g.fill('evenodd'); S.g.setTransform(1, 0, 0, 1, 0, 0)
    M.g.globalCompositeOperation = 'destination-in'; M.g.drawImage(img(S), 0, 0); M.g.globalCompositeOperation = 'source-over'
  }
  let F = M
  if (m.invert) { const I = novo(); I.g.fillStyle = '#000'; I.g.fillRect(0, 0, w, h); I.g.globalCompositeOperation = 'destination-out'; I.g.drawImage(img(M), 0, 0); F = I }
  if (m.featherMm > 0) { const B = novo(); B.g.filter = `blur(${(m.featherMm * k * 0.5).toFixed(2)}px)`; B.g.drawImage(img(F), 0, 0); B.g.filter = 'none'; F = B }
  C.g.globalCompositeOperation = 'destination-in'; C.g.drawImage(img(F), 0, 0); C.g.globalCompositeOperation = 'source-over'
}

/** Quanto os efeitos passam da caixa da camada (mm). */
export function folgaMm(efs: Efeito[]): number {
  let f = 0
  for (const e of efs) {
    if (e.enabled === false) continue
    if (e.type === 'stroke') f = Math.max(f, e.position === 'inside' ? 0 : e.position === 'center' ? e.sizeMm / 2 : e.sizeMm)
    else if (e.type === 'dropShadow') f = Math.max(f, e.distanceMm + e.sizeMm * 2)
    else if (e.type === 'outerGlow') f = Math.max(f, e.sizeMm * 2)
    // Lote 8 (item 131): os efeitos INTERNOS também precisam de folga — o brilho/sombra interna nascem do "fora" da
    // camada borrado; com o buffer cortado rente à caixa, a borda da forma ficava sem brilho
    else if (e.type === 'innerGlow' || e.type === 'bevel') f = Math.max(f, e.sizeMm * 2)
    else if (e.type === 'innerShadow') f = Math.max(f, e.distanceMm + e.sizeMm * 2)
  }
  return f + 0.5
}

/**
 * Desenha `no` com os efeitos em `ctx` (coordenadas da folha em px). `puro(g)` desenha o CONTEÚDO da
 * camada (com alpha 1) no contexto dado, já nas coordenadas da folha.
 */
export function desenharComEfeitos(ctx: Ctx, no: NoCamada, opacidade: number, preenchimento: number, modo: GlobalCompositeOperation,
  amb: AmbienteEfeitos, puro: (g: Ctx) => void): void {
  comporEfeitos(ctx, montarEfeitos(no, preenchimento, amb, puro), opacidade, modo)
}

/** Põe os efeitos montados na folha, com a opacidade e o modo da camada. */
export function comporEfeitos(ctx: Ctx, m: EfeitosMontados, opacidade: number, modo: GlobalCompositeOperation): void {
  ctx.save()
  ctx.globalAlpha = opacidade
  ctx.globalCompositeOperation = modo
  ctx.drawImage(m.c as unknown as CanvasImageSource, m.x0, m.y0)
  ctx.restore()
}

/** Monta a camada com os efeitos num buffer do tamanho dela (+ folga) — sem pôr na folha (o cache guarda isto). */
export function montarEfeitos(no: NoCamada, preenchimento: number, amb: AmbienteEfeitos, puro: (g: Ctx) => void): EfeitosMontados {
  const efs = (no.effects ?? []).filter(e => e.enabled !== false)
  const { k } = amb
  const cx = caixaMm(no)
  const folga = folgaMm(efs) * k
  let x0 = 0, y0 = 0, x1 = amb.W, y1 = amb.H
  if (cx) { x0 = Math.floor(cx[0] * k - folga - 2); y0 = Math.floor(cx[1] * k - folga - 2); x1 = Math.ceil(cx[2] * k + folga + 2); y1 = Math.ceil(cx[3] * k + folga + 2) }
  const w = Math.max(1, Math.min(8192, x1 - x0)), h = Math.max(1, Math.min(8192, y1 - y0))
  const novo = (): Buf => { const c = amb.criarCanvas(w, h); return { c, g: ctx2d(c), w, h } }
  const img = (b: Buf) => b.c as unknown as CanvasImageSource

  // conteúdo (silhueta) em alpha 1
  const C = novo()
  C.g.save(); C.g.translate(-x0, -y0); puro(C.g); C.g.restore()
  // Sprint 10: AJUSTES não destrutivos e MÁSCARA, antes dos efeitos (os efeitos seguem a forma mascarada)
  if (no.adjustments?.some(a => a.enabled !== false)) {
    const id = C.g.getImageData(0, 0, w, h)
    aplicarAjustes(id.data, no.adjustments)
    C.g.putImageData(id, 0, 0)
  }
  if (no.mask && no.mask.enabled !== false) aplicarMascara(C, no.mask, x0, y0, k, novo, amb)

  // Lote 9 (item 140): silhueta VISÍVEL (camada ∩ face) — base dos efeitos INTERNOS numa camada recortada
  const Ci: Buf = (() => {
    if (!amb.recorte) return C
    const b = novo(); b.g.drawImage(img(C), 0, 0)
    b.g.globalCompositeOperation = 'destination-in'
    b.g.drawImage(amb.recorte.c as unknown as CanvasImageSource, amb.recorte.x0 - x0, amb.recorte.y0 - y0)
    b.g.globalCompositeOperation = 'source-over'
    return b
  })()
  const colorir = (src: Buf, cor: string): Buf => { const b = novo(); b.g.drawImage(img(src), 0, 0); b.g.globalCompositeOperation = 'source-in'; b.g.fillStyle = cor; b.g.fillRect(0, 0, w, h); return b }
  const desfocar = (src: Buf, sigma: number): Buf => {
    if (sigma < 0.3) return src
    if (amb.rapido && sigma >= 1.5 && w > 8 && h > 8) {
      // TELA: reduz à metade desfocando (sigma/2 na metade = sigma na cheia) e volta ao tamanho — ~4× menos pixels
      const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2)
      const p = amb.criarCanvas(hw, hh), pg = ctx2d(p)
      pg.imageSmoothingEnabled = true; pg.filter = `blur(${(sigma / 2).toFixed(2)}px)`; pg.drawImage(img(src), 0, 0, hw, hh); pg.filter = 'none'
      const b = novo(); b.g.imageSmoothingEnabled = true; b.g.drawImage(p as unknown as CanvasImageSource, 0, 0, w, h); return b
    }
    const b = novo(); b.g.filter = `blur(${sigma.toFixed(2)}px)`; b.g.drawImage(img(src), 0, 0); b.g.filter = 'none'; return b
  }
  const dilatar = (src: Buf, r: number): Buf => {
    if (r < 0.5) return src
    const b = novo()
    b.g.drawImage(img(src), 0, 0)
    for (const frac of [1, 0.66, 0.33]) {
      const rr = r * frac, n = Math.max(8, Math.min(32, Math.ceil(rr * 2)))
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; b.g.drawImage(img(src), Math.cos(a) * rr, Math.sin(a) * rr) }
    }
    return b
  }
  const inverso = (src: Buf): Buf => { const b = novo(); b.g.fillStyle = '#000'; b.g.fillRect(0, 0, w, h); b.g.globalCompositeOperation = 'destination-out'; b.g.drawImage(img(src), 0, 0); return b }
  const erodir = (src: Buf, r: number): Buf => { if (r < 0.5) return src; const d = dilatar(inverso(src), r); const b = novo(); b.g.drawImage(img(src), 0, 0); b.g.globalCompositeOperation = 'destination-out'; b.g.drawImage(img(d), 0, 0); return b }
  const mascarar = (b: Buf, m: Buf): Buf => { b.g.globalCompositeOperation = 'destination-in'; b.g.drawImage(img(m), 0, 0); b.g.globalCompositeOperation = 'source-over'; return b }
  const menos = (b: Buf, m: Buf): Buf => { b.g.globalCompositeOperation = 'destination-out'; b.g.drawImage(img(m), 0, 0); b.g.globalCompositeOperation = 'source-over'; return b }
  // traço exato do caminho (texto)
  const tracoDoCaminho = (larguraPx: number): Buf | null => {
    if (no.type !== 'path') return null
    const b = novo(), p = amb.caminho(no.d)
    b.g.save(); b.g.translate(-x0, -y0); b.g.scale(k, k)
    b.g.lineWidth = larguraPx / k; b.g.lineJoin = 'round'; b.g.lineCap = 'round'; b.g.strokeStyle = '#000'
    b.g.stroke(p); b.g.restore()
    return b
  }
  /** Anel do traçado (silhueta) na posição pedida. */
  const anel = (s: number, pos: 'outside' | 'center' | 'inside'): Buf => {
    const exato = no.type === 'path'
    if (pos === 'outside') {
      const t = exato ? tracoDoCaminho(2 * s)! : dilatar(C, s)
      if (exato) t.g.drawImage(img(C), 0, 0)
      return menos(t, C)
    }
    if (pos === 'inside') return exato ? mascarar(tracoDoCaminho(2 * s)!, C) : menos(copia(C), erodir(C, s))
    return exato ? tracoDoCaminho(s)! : menos(dilatar(C, s / 2), erodir(C, s / 2))
  }
  const copia = (src: Buf): Buf => { const b = novo(); b.g.drawImage(img(src), 0, 0); return b }
  /** Sombra/realce INTERNO: cor fora da silhueta (visível) deslocada, desfocada e presa à silhueta. */
  const interno = (cor: string, dx: number, dy: number, sigma: number): Buf => {
    const b = novo(); b.g.fillStyle = cor; b.g.fillRect(0, 0, w, h)
    b.g.globalCompositeOperation = 'destination-out'; b.g.drawImage(img(Ci), dx, dy); b.g.globalCompositeOperation = 'source-over'
    return mascarar(desfocar(b, sigma), Ci)
  }

  const R = novo()
  const desenhar = (b: Buf, alpha: number, m: GlobalCompositeOperation = 'source-over', dx = 0, dy = 0) => {
    R.g.save(); R.g.globalAlpha = alpha; R.g.globalCompositeOperation = m; R.g.drawImage(img(b), dx, dy); R.g.restore()
  }
  const de = <T extends Efeito['type']>(t: T) => efs.filter(e => e.type === t) as Extract<Efeito, { type: T }>[]

  for (const e of de('dropShadow')) {
    let s = colorir(C, e.color)
    if (e.spread > 0) s = dilatar(s, e.spread * e.sizeMm * k)
    s = desfocar(s, (1 - e.spread) * e.sizeMm * k * 0.5)
    desenhar(s, e.opacity, 'source-over', -Math.cos(rad(e.angleDeg)) * e.distanceMm * k, Math.sin(rad(e.angleDeg)) * e.distanceMm * k)
  }
  for (const e of de('outerGlow')) {
    let s = colorir(C, e.color)
    if (e.spread > 0) s = dilatar(s, e.spread * e.sizeMm * k)
    desenhar(desfocar(s, (1 - e.spread) * e.sizeMm * k * 0.5), e.opacity, gco(e.blendMode) === 'screen' ? 'source-over' : 'source-over')
  }
  desenhar(C, preenchimento)
  for (const e of de('patternOverlay')) {
    const fonte = amb.bitmap(e.src.sha256)
    if (!fonte) continue
    const p = novo(), lado = Math.max(2, 20 * e.scale * k)
    const fw = (fonte as { width?: number }).width ?? 1, fh = (fonte as { height?: number }).height ?? 1
    const tw = lado, th = (lado * fh) / fw
    for (let y = -((y0 % th) + th) % th; y < h; y += th) for (let x = -((x0 % tw) + tw) % tw; x < w; x += tw) p.g.drawImage(fonte, x, y, tw, th)
    desenhar(mascarar(p, C), e.opacity, gco(e.blendMode))
  }
  for (const e of de('gradientOverlay')) {
    const p = novo()
    const bx = cx ? cx[0] * k - x0 : 0, by = cx ? cx[1] * k - y0 : 0, bw = cx ? (cx[2] - cx[0]) * k : w, bh = cx ? (cx[3] - cx[1]) * k : h
    const mx = bx + bw / 2, my = by + bh / 2
    let gr: CanvasGradient
    if (e.style === 'radial') gr = p.g.createRadialGradient(mx, my, 0, mx, my, Math.hypot(bw, bh) / 2)
    else {
      const a = rad(e.angleDeg), L = Math.abs(bw * Math.cos(a)) / 2 + Math.abs(bh * Math.sin(a)) / 2
      gr = p.g.createLinearGradient(mx - Math.cos(a) * L, my + Math.sin(a) * L, mx + Math.cos(a) * L, my - Math.sin(a) * L)
    }
    for (const s of e.stops) gr.addColorStop(s.pos, s.color)
    p.g.fillStyle = gr; p.g.fillRect(0, 0, w, h)
    desenhar(mascarar(p, C), e.opacity, gco(e.blendMode))
  }
  for (const e of de('colorOverlay')) desenhar(colorir(C, e.color), e.opacity, gco(e.blendMode))
  for (const e of de('innerGlow')) {
    const s = e.sizeMm * k
    // Lote 21 (item 252): ENGASGAR (choke) engrossa a cor antes de esfumar; técnica PRECISA = faixa cheia seguindo a
    // borda (esfuma só um pouco). Sem os dois (temas antigos), o desenho é exatamente o de antes.
    const ch = Math.min(1, Math.max(0, e.choke ?? 0)), precisa = e.tecnica === 'precisa'
    let g: Buf
    if (e.source === 'center') g = mascarar(colorir(desfocar(erodir(Ci, s * 0.5), s * 0.5 * (precisa ? 0.25 : 1 - ch)), e.color), Ci)
    else if (!ch && !precisa) g = interno(e.color, 0, 0, s * 0.5)
    else {
      // a cor por fora da silhueta "entra" ch × tamanho (ou o tamanho todo, na precisa) e depois esfuma o resto
      const b = novo(); b.g.fillStyle = e.color; b.g.fillRect(0, 0, w, h)
      const entra = precisa ? s : ch * s
      b.g.globalCompositeOperation = 'destination-out'; b.g.drawImage(img(entra > 0 ? erodir(Ci, entra) : Ci), 0, 0); b.g.globalCompositeOperation = 'source-over'
      g = mascarar(desfocar(b, precisa ? s * 0.12 : (1 - ch) * s * 0.5), Ci)
    }
    desenhar(g, e.opacity, 'source-over')
  }
  for (const e of de('innerShadow')) {
    const dx = -Math.cos(rad(e.angleDeg)) * e.distanceMm * k, dy = Math.sin(rad(e.angleDeg)) * e.distanceMm * k
    desenhar(interno(e.color, dx, dy, e.sizeMm * k * 0.5), e.opacity, gco(e.blendMode))
  }
  for (const e of de('stroke')) desenhar(colorir(anel(e.sizeMm * k, e.position), e.color), e.opacity)
  for (const e of de('bevel')) {
    const s = e.sizeMm * k, d = Math.max(0.5, s * 0.6 * e.depth), a = rad(e.angleDeg)
    // luz vem do ângulo: o realce fica do lado da luz (sombra interna da cor clara deslocada para o lado oposto)
    desenhar(interno(e.highlightColor, Math.cos(a) * d, -Math.sin(a) * d, s * 0.5), e.highlightOpacity, 'screen')
    desenhar(interno(e.shadowColor, -Math.cos(a) * d, Math.sin(a) * d, s * 0.5), e.shadowOpacity, 'multiply')
    if (e.style === 'emboss') {
      const fora = menos(desfocar(colorir(C, e.shadowColor), s * 0.5), C)
      desenhar(fora, e.shadowOpacity * 0.6, 'source-over', -Math.cos(a) * d * 0.5, Math.sin(a) * d * 0.5)
    }
  }

  return { c: R.c, x0, y0, w, h }
}
