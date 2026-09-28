// SOA Design — ACERVO DE CENAS (autoral, desenhado por código — nenhuma imagem de terceiros). Qualidade de foto:
// camadas com PROFUNDIDADE (o fundo é pintado pequeno e ampliado = desfoque real, funciona em todo navegador), bokeh,
// luz suave, paleta harmônica, piso/mesa com perspectiva — e sempre o CENTRO livre para o produto, que pousa no piso
// (a cena diz onde fica o "chão": `horizonte`). Categorias: festa infantil, céu/nuvens, clean/estúdio, temáticos, sazonais.
type G = CanvasRenderingContext2D
type RGB = [number, number, number]

export interface FundoArte { id: string; nome: string; categoria: string; tags: string[]; horizonte: number; brilhoPiso: number; desenhar: (g: G, W: number, H: number) => void }

// ── utilitários ────────────────────────────────────────────────────────────────────────────────────────────────
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const hex = (h: string): RGB => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const rgba = (c: RGB | string, a = 1) => { const [r, g, b] = typeof c === 'string' ? hex(c) : c; return `rgba(${r | 0},${g | 0},${b | 0},${a})` }
const mistura = (a: RGB | string, b: RGB | string, t: number): RGB => { const x = typeof a === 'string' ? hex(a) : a, y = typeof b === 'string' ? hex(b) : b; return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t] }
const claro = (c: string, t: number) => rgba(mistura(c, '#ffffff', t))
const escuro = (c: string, t: number) => rgba(mistura(c, '#000000', t))
function tela(w: number, h: number) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }
let temFiltro: boolean | null = null
const suportaFiltro = () => { if (temFiltro === null) { try { const c = tela(2, 2).getContext('2d')!; c.filter = 'blur(2px)'; temFiltro = c.filter === 'blur(2px)' } catch { temFiltro = false } } return temFiltro }
/**
 * Camada DESFOCADA (profundidade de campo). Com `filter: blur` (Chrome/Edge/Firefox) é desfoque gaussiano de verdade;
 * sem ele (Safari antigo), reduz em passos de ½ e amplia em passos de 2× — macio, sem degraus.
 */
function desfocado(g: G, W: number, H: number, fator: number, desenhar: (g: G, W: number, H: number) => void) {
  const raio = Math.max(0.5, fator * Math.max(W, H) / 900)
  if (suportaFiltro()) {
    // a camada é pintada um pouco MAIOR (margem = 3× o raio) e só o miolo entra: sem moldura escura nas bordas
    const pad = Math.ceil(raio * 3), c = tela(W + 2 * pad, H + 2 * pad), gc = c.getContext('2d')!
    gc.scale((W + 2 * pad) / W, (H + 2 * pad) / H); desenhar(gc, W, H)
    const b = tela(W + 2 * pad, H + 2 * pad), gb = b.getContext('2d')!; gb.filter = `blur(${raio.toFixed(1)}px)`; gb.drawImage(c, 0, 0)
    g.drawImage(b, pad, pad, W, H, 0, 0, W, H); return
  }
  const k = 1 / Math.max(1, fator), base = tela(W, H), gb = base.getContext('2d')!; desenhar(gb, W, H)
  let atual: HTMLCanvasElement = base
  while (atual.width * 0.5 >= W * k) { const n = tela(atual.width / 2, atual.height / 2), gn = n.getContext('2d')!; gn.imageSmoothingQuality = 'high'; gn.drawImage(atual, 0, 0, n.width, n.height); atual = n }
  while (atual.width * 2 <= W) { const n = tela(atual.width * 2, atual.height * 2), gn = n.getContext('2d')!; gn.imageSmoothingQuality = 'high'; gn.drawImage(atual, 0, 0, n.width, n.height); atual = n }
  g.save(); g.imageSmoothingQuality = 'high'; g.drawImage(atual, 0, 0, W, H); g.restore()
}
function vertical(g: G, x0: number, y0: number, x1: number, y1: number, cores: [number, string][]) {
  const gr = g.createLinearGradient(0, y0, 0, y1); cores.forEach(([t, c]) => gr.addColorStop(t, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0)
}
function luzSuave(g: G, x: number, y: number, r: number, cor: string, a: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(cor, a)); gr.addColorStop(1, rgba(cor, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r)
}
function vinheta(g: G, W: number, H: number, a = 0.18) {
  const v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.hypot(W, H) * 0.62)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = v; g.fillRect(0, 0, W, H)
}
function bokeh(g: G, W: number, H: number, n: number, cores: string[], r0: number, r1: number, seed: number, faixa: [number, number] = [0, 1], a = 0.35) {
  const R = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = (faixa[0] + R() * (faixa[1] - faixa[0])) * H, r = (r0 + R() * (r1 - r0)) * Math.min(W, H), c = cores[i % cores.length]
    const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r); gr.addColorStop(0, rgba(c, a * (0.6 + R() * 0.4))); gr.addColorStop(0.75, rgba(c, a * 0.55)); gr.addColorStop(1, rgba(c, 0))
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
  }
}
/** Parede + piso/mesa com perspectiva e a junção sombreada (dá a sensação de ambiente). */
function ambiente(g: G, W: number, H: number, hz: number, parede: [string, string], piso: [string, string], opc: { brilho?: number; luz?: [number, number] } = {}) {
  vertical(g, 0, 0, W, hz * H, [[0, parede[0]], [1, parede[1]]])
  vertical(g, 0, hz * H, W, H, [[0, piso[0]], [1, piso[1]]])
  const j = g.createLinearGradient(0, hz * H - H * 0.03, 0, hz * H + H * 0.06)
  j.addColorStop(0, 'rgba(0,0,0,0)'); j.addColorStop(0.35, 'rgba(0,0,0,0.10)'); j.addColorStop(0.5, 'rgba(0,0,0,0.04)'); j.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = j; g.fillRect(0, hz * H - H * 0.03, W, H * 0.09)
  if (opc.brilho) { const b = g.createLinearGradient(0, hz * H, 0, H); b.addColorStop(0, `rgba(255,255,255,${opc.brilho})`); b.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = b; g.fillRect(0, hz * H, W, H) }
  const [lx, ly] = opc.luz || [0.3, 0.2]; luzSuave(g, lx * W, ly * H, Math.max(W, H) * 0.7, '#ffffff', 0.35)
}
function balao(g: G, x: number, y: number, r: number, cor: string, fio = true) {
  if (fio) { g.strokeStyle = 'rgba(80,80,80,0.35)'; g.lineWidth = Math.max(1, r * 0.025); g.beginPath(); g.moveTo(x, y + r * 1.15); g.bezierCurveTo(x + r * 0.3, y + r * 1.8, x - r * 0.3, y + r * 2.4, x + r * 0.1, y + r * 3.2); g.stroke() }
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.15)
  gr.addColorStop(0, claro(cor, 0.65)); gr.addColorStop(0.35, cor); gr.addColorStop(1, escuro(cor, 0.25))
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 0.92, r * 1.08, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = escuro(cor, 0.2); g.beginPath(); g.moveTo(x - r * 0.1, y + r * 1.12); g.lineTo(x + r * 0.1, y + r * 1.12); g.lineTo(x, y + r * 1.02); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.45, r * 0.16, r * 0.28, -0.5, 0, Math.PI * 2); g.fill()
}
/** Arco orgânico de balões (painel de festa) — tamanhos e cores variados, os de trás mais escuros. */
function arcoBaloes(g: G, W: number, H: number, cores: string[], seed: number, cx = 0.5, topo = 0.12, largura = 0.95, base = 0.62) {
  const R = rng(seed), n = 70
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), ang = Math.PI * (1 - t)
    const x = (cx + Math.cos(ang) * largura / 2) * W + (R() - 0.5) * W * 0.05
    const y = (base - Math.sin(ang) * (base - topo)) * H + (R() - 0.5) * H * 0.06
    const r = (0.028 + R() * 0.035) * Math.min(W, H) * 1.6
    balao(g, x, y, r, cores[Math.floor(R() * cores.length)], false)
  }
}
function bandeirinhas(g: G, W: number, H: number, y0: number, curva: number, cores: string[], n = 14) {
  g.strokeStyle = 'rgba(90,70,60,0.55)'; g.lineWidth = Math.max(1, W * 0.0015)
  const p = (t: number) => ({ x: t * W, y: (y0 + curva * Math.sin(Math.PI * t)) * H })
  g.beginPath(); for (let i = 0; i <= 40; i++) { const q = p(i / 40); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y) } g.stroke()
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.1) / n, t1 = (i + 0.9) / n, a = p(t0), b = p(t1), m = p((t0 + t1) / 2), h = W / n * 0.9
    const gr = g.createLinearGradient(m.x, m.y, m.x, m.y + h); const c = cores[i % cores.length]; gr.addColorStop(0, c); gr.addColorStop(1, escuro(c, 0.15))
    g.fillStyle = gr; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(m.x, m.y + h); g.closePath(); g.fill()
  }
}
function confete(g: G, W: number, H: number, n: number, cores: string[], seed: number, faixa: [number, number], tam: [number, number]) {
  const R = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = (faixa[0] + R() * (faixa[1] - faixa[0])) * H, s = (tam[0] + R() * (tam[1] - tam[0])) * W
    g.save(); g.translate(x, y); g.rotate(R() * Math.PI); g.fillStyle = cores[i % cores.length]
    if (R() < 0.5) g.fillRect(-s / 2, -s / 5, s, s / 2.5); else { g.beginPath(); g.arc(0, 0, s / 3, 0, Math.PI * 2); g.fill() }
    g.restore()
  }
}
function nuvem(g: G, cx: number, cy: number, w: number, h: number, cor: string, sombra: string, seed: number) {
  const R = rng(seed), bolas = 14
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < bolas; i++) {
    const t = i / (bolas - 1), x = cx + (t - 0.5) * w * (0.9 + R() * 0.1), topo = Math.sin(Math.PI * t) * h * (0.55 + R() * 0.45)
    const r = h * (0.35 + R() * 0.35) * (0.6 + Math.sin(Math.PI * t) * 0.6), y = cy - topo * 0.6 + r * 0.2
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r)
    gr.addColorStop(0, pass ? rgba(cor, 1) : rgba(sombra, 0.9)); gr.addColorStop(0.7, pass ? rgba(cor, 0.95) : rgba(sombra, 0.6)); gr.addColorStop(1, pass ? rgba(cor, 0) : rgba(sombra, 0))
    g.fillStyle = gr; g.beginPath(); g.arc(x, pass ? y - r * 0.12 : y + r * 0.1, r, 0, Math.PI * 2); g.fill()
  }
}
function estrelas(g: G, W: number, H: number, n: number, seed: number, faixa: [number, number] = [0, 0.7], cor = '#ffffff') {
  const R = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = (faixa[0] + R() * (faixa[1] - faixa[0])) * H, r = (R() < 0.92 ? 0.0012 + R() * 0.002 : 0.004 + R() * 0.004) * W
    luzSuave(g, x, y, r * 3, cor, 0.9); g.fillStyle = rgba(cor, 0.95); g.beginPath(); g.arc(x, y, r * 0.6, 0, Math.PI * 2); g.fill()
    if (r > 0.004 * W) { g.strokeStyle = rgba(cor, 0.7); g.lineWidth = r * 0.25; g.beginPath(); g.moveTo(x - r * 3, y); g.lineTo(x + r * 3, y); g.moveTo(x, y - r * 3); g.lineTo(x, y + r * 3); g.stroke() }
  }
}
function brilhos(g: G, W: number, H: number, n: number, cor: string, seed: number, faixa: [number, number] = [0, 0.7]) {
  const R = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = (faixa[0] + R() * (faixa[1] - faixa[0])) * H, s = (0.006 + R() * 0.012) * W
    g.fillStyle = rgba(cor, 0.85); g.beginPath()
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, rr = k % 2 ? s * 0.22 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) }
    g.closePath(); g.fill(); luzSuave(g, x, y, s * 1.6, cor, 0.35)
  }
}
function colinas(g: G, W: number, H: number, camadas: { y: number; amp: number; cor: [string, string]; seed: number }[]) {
  for (const c of camadas) {
    const R = rng(c.seed), f1 = 1 + R() * 2, f2 = 2 + R() * 3, fase = R() * 6
    g.beginPath(); g.moveTo(0, H)
    for (let i = 0; i <= 60; i++) { const t = i / 60; g.lineTo(t * W, (c.y - c.amp * (0.6 * Math.sin(t * Math.PI * f1 + fase) + 0.4 * Math.sin(t * Math.PI * f2 + fase * 2))) * H) }
    g.lineTo(W, H); g.closePath()
    const gr = g.createLinearGradient(0, (c.y - c.amp) * H, 0, H); gr.addColorStop(0, c.cor[0]); gr.addColorStop(1, c.cor[1]); g.fillStyle = gr; g.fill()
  }
}
function flor(g: G, x: number, y: number, r: number, cor: string, miolo = '#fde68a') {
  for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; const gr = g.createRadialGradient(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, 0, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55); gr.addColorStop(0, claro(cor, 0.3)); gr.addColorStop(1, cor); g.fillStyle = gr; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.32, a, 0, Math.PI * 2); g.fill() }
  g.fillStyle = miolo; g.beginPath(); g.arc(x, y, r * 0.28, 0, Math.PI * 2); g.fill()
}
function folha(g: G, x: number, y: number, c: number, ang: number, cor: string) {
  g.save(); g.translate(x, y); g.rotate(ang)
  const gr = g.createLinearGradient(0, -c * 0.2, 0, c * 0.2); gr.addColorStop(0, claro(cor, 0.15)); gr.addColorStop(1, escuro(cor, 0.25))
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(c * 0.5, -c * 0.32, c, 0); g.quadraticCurveTo(c * 0.5, c * 0.32, 0, 0); g.fill()
  g.strokeStyle = rgba(escuro(cor, 0.35) as string, 0.6); g.lineWidth = c * 0.02; g.beginPath(); g.moveTo(0, 0); g.lineTo(c * 0.95, 0); g.stroke()
  g.restore()
}
function mesaToalha(g: G, W: number, H: number, hz: number, cor: string, franja = true) {
  vertical(g, 0, hz * H, W, H, [[0, claro(cor, 0.35)], [0.25, cor], [1, escuro(cor, 0.12)]])
  if (franja) { g.fillStyle = rgba('#ffffff', 0.35); for (let x = 0; x < W; x += W / 60) g.fillRect(x, hz * H + H * 0.004, W / 120, H * 0.006) }
  const brilho = g.createLinearGradient(0, hz * H, 0, hz * H + H * 0.12); brilho.addColorStop(0, 'rgba(255,255,255,0.35)'); brilho.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = brilho; g.fillRect(0, hz * H, W, H * 0.12)
}
function madeira(g: G, W: number, H: number, hz: number, base: string, seed: number) {
  vertical(g, 0, hz * H, W, H, [[0, claro(base, 0.12)], [1, escuro(base, 0.18)]])
  const R = rng(seed)
  for (let i = 0; i < 9; i++) { const y = hz * H + ((i + 1) / 10) ** 1.6 * (1 - hz) * H; g.strokeStyle = rgba(escuro(base, 0.3) as string, 0.18); g.lineWidth = 1 + i * 0.4; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (R() - 0.5) * 4); g.stroke() }
  for (let i = 0; i < 60; i++) { const y = hz * H + R() * (1 - hz) * H, x = R() * W, w = W * (0.05 + R() * 0.2); g.strokeStyle = rgba(escuro(base, 0.25) as string, 0.07); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + (R() - 0.5) * 2); g.stroke() }
}
function marmore(g: G, W: number, H: number, hz: number, seed: number) {
  vertical(g, 0, hz * H, W, H, [[0, '#f7f7f7'], [1, '#e7e5e4']])
  const R = rng(seed)
  for (let i = 0; i < 14; i++) {
    let x = R() * W, y = hz * H + R() * (1 - hz) * H
    g.strokeStyle = `rgba(120,113,108,${0.08 + R() * 0.12})`; g.lineWidth = 0.6 + R() * 1.6; g.beginPath(); g.moveTo(x, y)
    for (let k = 0; k < 8; k++) { x += (R() - 0.3) * W * 0.08; y += (R() - 0.5) * H * 0.03; g.lineTo(x, y) }
    g.stroke()
  }
}
const PASTEL = ['#f9a8d4', '#93c5fd', '#fde68a', '#a7f3d0', '#c4b5fd', '#fdba74']
const DOCE = ['#f472b6', '#fb7185', '#fbcfe8', '#fda4af', '#ffffff', '#f9a8d4']

// ── as cenas ───────────────────────────────────────────────────────────────────────────────────────────────────
export const FUNDOS_ARTE: FundoArte[] = [
  // FESTA INFANTIL
  { id: 'fx-festa-rosa', nome: 'Festa rosa — arco de balões', categoria: 'Festa infantil', tags: ['festa', 'aniversário', 'menina', 'balões', 'rosa'], horizonte: 0.64, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 7, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#fde2ec'], [1, '#f8c9d9']]); arcoBaloes(d, w, h, DOCE, 11); bokeh(d, w, h, 30, ['#ffffff', '#fbcfe8'], 0.01, 0.04, 3, [0, 0.6], 0.5) }); mesaToalha(g, W, H, 0.64, '#fbcfe8'); confete(g, W, H, 70, ['#f472b6', '#fbbf24', '#ffffff', '#a78bfa'], 5, [0.68, 0.98], [0.006, 0.012]); vinheta(g, W, H, 0.12) } },
  { id: 'fx-festa-azul', nome: 'Festa azul — arco de balões', categoria: 'Festa infantil', tags: ['festa', 'aniversário', 'menino', 'balões', 'azul'], horizonte: 0.64, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 7, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#dbeafe'], [1, '#bfdbfe']]); arcoBaloes(d, w, h, ['#60a5fa', '#93c5fd', '#ffffff', '#1d4ed8', '#fde68a'], 21); bokeh(d, w, h, 30, ['#ffffff'], 0.01, 0.04, 4, [0, 0.6], 0.5) }); mesaToalha(g, W, H, 0.64, '#dbeafe'); confete(g, W, H, 70, ['#3b82f6', '#fbbf24', '#ffffff', '#22d3ee'], 6, [0.68, 0.98], [0.006, 0.012]); vinheta(g, W, H, 0.12) } },
  { id: 'fx-festa-arco-iris', nome: 'Festa arco-íris', categoria: 'Festa infantil', tags: ['festa', 'colorido', 'balões', 'arco-íris'], horizonte: 0.64, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 7, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#fff7ed'], [1, '#fde68a']]); arcoBaloes(d, w, h, ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'], 31) }); mesaToalha(g, W, H, 0.64, '#ffffff'); confete(g, W, H, 90, ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'], 7, [0.68, 0.98], [0.006, 0.012]) } },
  { id: 'fx-festa-bandeirinhas', nome: 'Mesa com bandeirinhas', categoria: 'Festa infantil', tags: ['festa', 'bandeirinhas', 'mesa', 'madeira'], horizonte: 0.66, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 5, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#fef3c7'], [1, '#fde68a']]); bandeirinhas(d, w, h, 0.08, 0.1, PASTEL, 12); bandeirinhas(d, w, h, 0.26, 0.08, ['#f472b6', '#60a5fa', '#34d399', '#fbbf24'], 10); bokeh(d, w, h, 26, ['#ffffff', '#fde68a'], 0.01, 0.05, 8, [0, 0.62], 0.55) }); madeira(g, W, H, 0.66, '#d6a77a', 9); vinheta(g, W, H, 0.14) } },
  { id: 'fx-festa-confete-dourado', nome: 'Confete dourado', categoria: 'Festa infantil', tags: ['festa', 'dourado', 'confete', 'elegante'], horizonte: 0.66, brilhoPiso: 0.18,
    desenhar: (g, W, H) => { desfocado(g, W, H, 8, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#fffbeb'], [1, '#fdf2d6']]); bokeh(d, w, h, 60, ['#fcd34d', '#fbbf24', '#ffffff', '#fde68a'], 0.01, 0.05, 10, [0, 0.65], 0.55) }); ambiente(g, W, H, 0.66, ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], ['#fffaf0', '#f5e6c8'], { brilho: 0.4 }); confete(g, W, H, 110, ['#d4a017', '#fbbf24', '#fde68a', '#b45309'], 12, [0.7, 0.99], [0.005, 0.01]) } },
  { id: 'fx-festa-bolo', nome: 'Mesa de doces', categoria: 'Festa infantil', tags: ['festa', 'bolo', 'doces', 'mesa'], horizonte: 0.64, brilhoPiso: 0,
    desenhar: (g, W, H) => {
      desfocado(g, W, H, 6, (d, w, h) => {
        vertical(d, 0, 0, w, h, [[0, '#fdf2f8'], [1, '#fce7f3']]); bandeirinhas(d, w, h, 0.1, 0.07, PASTEL, 12)
        // bolo e cupcakes desfocados nas laterais
        for (const [cx, s] of [[0.1, 1.2], [0.9, 1]] as const) { const x = cx * w, b = 0.64 * h, r = w * 0.07 * s; d.fillStyle = '#fbcfe8'; d.fillRect(x - r, b - r * 1.2, r * 2, r * 1.2); d.fillStyle = '#fff'; d.fillRect(x - r, b - r * 1.2, r * 2, r * 0.25); d.fillStyle = '#f9a8d4'; d.fillRect(x - r * 0.7, b - r * 2, r * 1.4, r * 0.8); d.fillStyle = '#ef4444'; d.beginPath(); d.arc(x, b - r * 2.1, r * 0.15, 0, Math.PI * 2); d.fill() }
        for (const cx of [0.2, 0.8]) { const x = cx * w, b = 0.64 * h, r = w * 0.03; d.fillStyle = '#a78bfa'; d.beginPath(); d.moveTo(x - r, b - r * 1.5); d.lineTo(x + r, b - r * 1.5); d.lineTo(x + r * 0.7, b); d.lineTo(x - r * 0.7, b); d.fill(); d.fillStyle = '#fbcfe8'; d.beginPath(); d.arc(x, b - r * 1.7, r * 1.05, 0, Math.PI * 2); d.fill() }
        bokeh(d, w, h, 24, ['#ffffff'], 0.01, 0.04, 13, [0, 0.55], 0.5)
      })
      mesaToalha(g, W, H, 0.64, '#fce7f3'); confete(g, W, H, 50, DOCE, 14, [0.68, 0.98], [0.006, 0.011])
    } },
  // CÉU / NUVENS
  { id: 'fx-ceu-azul', nome: 'Céu azul com nuvens', categoria: 'Céu e nuvens', tags: ['céu', 'nuvens', 'azul', 'bebê', 'menino'], horizonte: 0.7, brilhoPiso: 0,
    desenhar: (g, W, H) => { vertical(g, 0, 0, W, H, [[0, '#7cc0f5'], [0.6, '#bfe3ff'], [1, '#e8f5ff']]); luzSuave(g, W * 0.8, H * 0.15, W * 0.5, '#fffbe6', 0.5); desfocado(g, W, H, 3, (d, w, h) => { nuvem(d, w * 0.15, h * 0.22, w * 0.35, h * 0.12, '#ffffff', '#cfe1f5', 1); nuvem(d, w * 0.8, h * 0.35, w * 0.4, h * 0.13, '#ffffff', '#cfe1f5', 2) }); nuvem(g, W * 0.5, H * 0.86, W * 1.3, H * 0.22, '#ffffff', '#dbe9f8', 3); nuvem(g, W * 0.05, H * 0.8, W * 0.5, H * 0.15, '#ffffff', '#dbe9f8', 4); nuvem(g, W * 0.95, H * 0.8, W * 0.5, H * 0.15, '#ffffff', '#dbe9f8', 5) } },
  { id: 'fx-ceu-algodao', nome: 'Céu algodão-doce', categoria: 'Céu e nuvens', tags: ['céu', 'nuvens', 'rosa', 'lilás', 'sonho', 'menina'], horizonte: 0.7, brilhoPiso: 0,
    desenhar: (g, W, H) => { vertical(g, 0, 0, W, H, [[0, '#c7b8f5'], [0.5, '#f5c6dd'], [1, '#ffe4ec']]); luzSuave(g, W * 0.5, H * 0.4, W * 0.6, '#fff5f8', 0.6); desfocado(g, W, H, 3, (d, w, h) => { nuvem(d, w * 0.2, h * 0.28, w * 0.4, h * 0.12, '#fff5fa', '#e9c6e6', 6); nuvem(d, w * 0.82, h * 0.2, w * 0.35, h * 0.1, '#fff5fa', '#e9c6e6', 7); brilhos(d, w, h, 18, '#ffffff', 8, [0, 0.5]) }); nuvem(g, W * 0.5, H * 0.87, W * 1.3, H * 0.22, '#fff5fa', '#efcfe4', 9); nuvem(g, W * 0.02, H * 0.8, W * 0.5, H * 0.16, '#fff5fa', '#efcfe4', 10); nuvem(g, W * 0.98, H * 0.8, W * 0.5, H * 0.16, '#fff5fa', '#efcfe4', 11) } },
  { id: 'fx-ceu-sonho', nome: 'Sonho — nuvens e estrelas', categoria: 'Céu e nuvens', tags: ['céu', 'estrelas', 'noite', 'sonho', 'bebê'], horizonte: 0.7, brilhoPiso: 0,
    desenhar: (g, W, H) => { vertical(g, 0, 0, W, H, [[0, '#3b3f8f'], [0.55, '#8d7dd6'], [1, '#e6d5f7']]); estrelas(g, W, H, 140, 12, [0, 0.55]); luzSuave(g, W * 0.78, H * 0.18, W * 0.1, '#fffbe6', 0.9); g.fillStyle = '#fff8dc'; g.beginPath(); g.arc(W * 0.78, H * 0.18, W * 0.05, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8d7dd6'; g.beginPath(); g.arc(W * 0.8, H * 0.165, W * 0.045, 0, Math.PI * 2); g.fill(); nuvem(g, W * 0.5, H * 0.88, W * 1.3, H * 0.22, '#f6efff', '#cdbcf0', 13); nuvem(g, W * 0.05, H * 0.8, W * 0.5, H * 0.16, '#f6efff', '#cdbcf0', 14); nuvem(g, W * 0.95, H * 0.8, W * 0.5, H * 0.16, '#f6efff', '#cdbcf0', 15) } },
  { id: 'fx-ceu-por-do-sol', nome: 'Pôr do sol', categoria: 'Céu e nuvens', tags: ['céu', 'pôr do sol', 'laranja', 'quente'], horizonte: 0.7, brilhoPiso: 0,
    desenhar: (g, W, H) => { vertical(g, 0, 0, W, H, [[0, '#7c6fd6'], [0.45, '#f9a8a8'], [0.75, '#fdcf8c'], [1, '#fff1d6']]); luzSuave(g, W * 0.5, H * 0.72, W * 0.6, '#fff4cc', 0.8); desfocado(g, W, H, 3, (d, w, h) => { nuvem(d, w * 0.2, h * 0.3, w * 0.4, h * 0.08, '#ffd8c2', '#e39aa6', 16); nuvem(d, w * 0.75, h * 0.22, w * 0.45, h * 0.08, '#ffd8c2', '#e39aa6', 17) }); nuvem(g, W * 0.5, H * 0.9, W * 1.3, H * 0.2, '#fff0e3', '#f3c1b2', 18) } },
  // CLEAN / ESTÚDIO
  { id: 'fx-estudio-branco', nome: 'Estúdio branco infinito', categoria: 'Clean e estúdio', tags: ['branco', 'clean', 'estúdio', 'marketplace'], horizonte: 0.66, brilhoPiso: 0.12,
    desenhar: (g, W, H) => { ambiente(g, W, H, 0.66, ['#f4f4f5', '#ffffff'], ['#ffffff', '#ececef'], { brilho: 0.3, luz: [0.5, 0.25] }); vinheta(g, W, H, 0.08) } },
  { id: 'fx-estudio-bege', nome: 'Estúdio bege quente', categoria: 'Clean e estúdio', tags: ['bege', 'clean', 'estúdio', 'neutro'], horizonte: 0.66, brilhoPiso: 0.1,
    desenhar: (g, W, H) => { ambiente(g, W, H, 0.66, ['#efe4d6', '#f7efe4'], ['#f5ebdd', '#e2d1bb'], { brilho: 0.25, luz: [0.25, 0.2] }); vinheta(g, W, H, 0.1) } },
  { id: 'fx-estudio-rosa', nome: 'Rosa suave', categoria: 'Clean e estúdio', tags: ['rosa', 'clean', 'estúdio', 'delicado'], horizonte: 0.66, brilhoPiso: 0.1,
    desenhar: (g, W, H) => { ambiente(g, W, H, 0.66, ['#f6d6df', '#fbe7ed'], ['#fbe7ed', '#eecad5'], { brilho: 0.25 }); vinheta(g, W, H, 0.1) } },
  { id: 'fx-estudio-lavanda', nome: 'Gradiente lavanda', categoria: 'Clean e estúdio', tags: ['lilás', 'lavanda', 'gradiente', 'clean'], horizonte: 0.66, brilhoPiso: 0.1,
    desenhar: (g, W, H) => { ambiente(g, W, H, 0.66, ['#ddd3f7', '#f3e8ff'], ['#f3e8ff', '#dccdf2'], { brilho: 0.25, luz: [0.7, 0.2] }); vinheta(g, W, H, 0.1) } },
  { id: 'fx-estudio-menta', nome: 'Menta fresca', categoria: 'Clean e estúdio', tags: ['menta', 'verde', 'clean'], horizonte: 0.66, brilhoPiso: 0.1,
    desenhar: (g, W, H) => { ambiente(g, W, H, 0.66, ['#cfeee2', '#e9f8f1'], ['#e9f8f1', '#c9e6da'], { brilho: 0.25 }); vinheta(g, W, H, 0.1) } },
  { id: 'fx-bokeh-dourado', nome: 'Bokeh dourado', categoria: 'Clean e estúdio', tags: ['bokeh', 'dourado', 'luzes', 'elegante'], horizonte: 0.68, brilhoPiso: 0.22,
    desenhar: (g, W, H) => { desfocado(g, W, H, 8, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#3b2a1a'], [1, '#7a5a35']]); bokeh(d, w, h, 70, ['#fcd34d', '#fbbf24', '#fde68a', '#fff7d6'], 0.015, 0.06, 20, [0, 0.7], 0.6) }); vertical(g, 0, 0.68 * H, W, H, [[0, '#8a6a45'], [1, '#4a3521']]); luzSuave(g, W * 0.5, H * 0.72, W * 0.5, '#fde68a', 0.25) } },
  { id: 'fx-marmore', nome: 'Mármore com reflexo', categoria: 'Clean e estúdio', tags: ['mármore', 'elegante', 'reflexo', 'luxo'], horizonte: 0.64, brilhoPiso: 0.3,
    desenhar: (g, W, H) => { desfocado(g, W, H, 6, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#e7e5e4'], [1, '#f5f5f4']]); luzSuave(d, w * 0.3, h * 0.2, w * 0.6, '#ffffff', 0.7) }); marmore(g, W, H, 0.64, 22); const b = g.createLinearGradient(0, 0.64 * H, 0, H); b.addColorStop(0, 'rgba(255,255,255,0.35)'); b.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = b; g.fillRect(0, 0.64 * H, W, H) } },
  { id: 'fx-madeira-clara', nome: 'Madeira clara', categoria: 'Clean e estúdio', tags: ['madeira', 'rústico', 'mesa', 'natural'], horizonte: 0.64, brilhoPiso: 0.05,
    desenhar: (g, W, H) => { desfocado(g, W, H, 6, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#f1ece4'], [1, '#e7ddcf']]); luzSuave(d, w * 0.25, h * 0.2, w * 0.7, '#ffffff', 0.6) }); madeira(g, W, H, 0.64, '#e3c49b', 23); vinheta(g, W, H, 0.12) } },
  // TEMÁTICOS
  { id: 'fx-tema-safari', nome: 'Safari', categoria: 'Temáticos', tags: ['safari', 'selva', 'animais', 'savana', 'menino'], horizonte: 0.72, brilhoPiso: 0,
    desenhar: (g, W, H) => {
      desfocado(g, W, H, 4, (d, w, h) => {
        vertical(d, 0, 0, w, h, [[0, '#f9c77e'], [0.6, '#fde3b4'], [1, '#fef3dc']]); luzSuave(d, w * 0.5, h * 0.55, w * 0.25, '#fff4c2', 0.9)
        colinas(d, w, h, [{ y: 0.6, amp: 0.04, cor: ['#d9a86b', '#c99458'], seed: 1 }, { y: 0.66, amp: 0.03, cor: ['#caa061', '#b88a4f'], seed: 2 }])
        for (const [x, s] of [[0.12, 1], [0.86, 0.8], [0.72, 0.5]] as const) { const bx = x * w, by = 0.62 * h, t = h * 0.14 * s; d.fillStyle = '#5b4632'; d.fillRect(bx - t * 0.03, by - t, t * 0.06, t); d.fillStyle = '#6b7a3a'; d.beginPath(); d.ellipse(bx, by - t, t * 0.9, t * 0.18, 0, 0, Math.PI * 2); d.fill() }
      })
      vertical(g, 0, 0.72 * H, W, H, [[0, '#d8b077'], [1, '#b98e56']])
      // capim em primeiro plano, DESFOCADO (profundidade de campo)
      desfocado(g, W, H, 3, (d, w, h) => { const R = rng(19); for (let i = 0; i < 160; i++) { const lado = i % 2 ? R() * w * 0.22 : w * (0.78 + R() * 0.22), y = h * (0.86 + R() * 0.16), c = h * (0.06 + R() * 0.12); d.strokeStyle = ['#a16207', '#ca8a04', '#854d0e', '#65a30d'][i % 4]; d.lineWidth = w * 0.004; d.beginPath(); d.moveTo(lado, y); d.quadraticCurveTo(lado + (R() - 0.5) * w * 0.03, y - c * 0.6, lado + (R() - 0.5) * w * 0.05, y - c); d.stroke() } })
    } },
  { id: 'fx-tema-fazendinha', nome: 'Fazendinha', categoria: 'Temáticos', tags: ['fazendinha', 'fazenda', 'campo', 'animais'], horizonte: 0.72, brilhoPiso: 0,
    desenhar: (g, W, H) => {
      vertical(g, 0, 0, W, H, [[0, '#8fd0f7'], [1, '#e2f4ff']]); desfocado(g, W, H, 3, (d, w, h) => { nuvem(d, w * 0.2, h * 0.18, w * 0.3, h * 0.08, '#ffffff', '#d4e7f5', 30); nuvem(d, w * 0.78, h * 0.12, w * 0.3, h * 0.07, '#ffffff', '#d4e7f5', 31) })
      desfocado(g, W, H, 3, (d, w, h) => { colinas(d, w, h, [{ y: 0.58, amp: 0.06, cor: ['#a3d977', '#86c25a'], seed: 3 }, { y: 0.66, amp: 0.04, cor: ['#7cbf4f', '#5fa33a'], seed: 4 }]); d.fillStyle = '#b91c1c'; d.fillRect(w * 0.8, h * 0.5, w * 0.1, h * 0.08); d.fillStyle = '#7f1d1d'; d.beginPath(); d.moveTo(w * 0.79, h * 0.5); d.lineTo(w * 0.85, h * 0.45); d.lineTo(w * 0.91, h * 0.5); d.fill(); d.fillStyle = '#fff'; d.fillRect(w * 0.835, h * 0.53, w * 0.03, h * 0.05) })
      vertical(g, 0, 0.72 * H, W, H, [[0, '#6fb34a'], [1, '#4d8a30']])
      g.fillStyle = '#f5e6c8'; for (let i = 0; i < 9; i++) { const x = (i / 8) * W; g.fillRect(x - W * 0.008, H * 0.66, W * 0.016, H * 0.1) } g.fillRect(0, H * 0.68, W, H * 0.014); g.fillRect(0, H * 0.72, W, H * 0.014)
    } },
  { id: 'fx-tema-sereia', nome: 'Fundo do mar (sereia)', categoria: 'Temáticos', tags: ['sereia', 'mar', 'oceano', 'fundo do mar', 'menina'], horizonte: 0.72, brilhoPiso: 0,
    desenhar: (g, W, H) => {
      vertical(g, 0, 0, W, H, [[0, '#0e7490'], [0.5, '#22b8cf'], [1, '#a5f3fc']])
      g.save(); g.globalCompositeOperation = 'screen'; for (let i = 0; i < 6; i++) { const x = W * (0.1 + i * 0.17); const gr = g.createLinearGradient(x, 0, x + W * 0.1, H * 0.8); gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + W * 0.06, 0); g.lineTo(x + W * 0.2, H * 0.8); g.lineTo(x + W * 0.08, H * 0.8); g.fill() } g.restore()
      desfocado(g, W, H, 4, (d, w, h) => { for (let i = 0; i < 7; i++) { const x = w * (i < 4 ? 0.03 + i * 0.05 : 0.8 + (i - 4) * 0.06); d.strokeStyle = i % 2 ? '#0f766e' : '#15803d'; d.lineWidth = w * 0.012; d.beginPath(); d.moveTo(x, h * 0.75); for (let k = 1; k <= 8; k++) d.lineTo(x + Math.sin(k) * w * 0.02, h * (0.75 - k * 0.06)); d.stroke() } })
      vertical(g, 0, 0.72 * H, W, H, [[0, '#f5deb3'], [1, '#e7c794']])
      const R = rng(40); for (let i = 0; i < 40; i++) { const x = R() * W, y = R() * 0.65 * H, r = (0.004 + R() * 0.012) * W; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = r * 0.15; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.2, 0, Math.PI * 2); g.fill() }
      for (const [x, c] of [[0.12, '#f9a8d4'], [0.88, '#fdba74']] as const) { g.fillStyle = c; g.beginPath(); for (let k = 0; k < 10; k++) { const a = Math.PI + (k / 9) * Math.PI, r = W * 0.045; g.lineTo(W * x + Math.cos(a) * r, H * 0.86 + Math.sin(a) * r) } g.fill() }
    } },
  { id: 'fx-tema-astronauta', nome: 'Espaço (astronauta)', categoria: 'Temáticos', tags: ['astronauta', 'espaço', 'planetas', 'estrelas', 'menino'], horizonte: 0.74, brilhoPiso: 0.05,
    desenhar: (g, W, H) => {
      vertical(g, 0, 0, W, H, [[0, '#0b1026'], [0.6, '#1e1b4b'], [1, '#312e81']]); luzSuave(g, W * 0.3, H * 0.35, W * 0.5, '#7c3aed', 0.35); luzSuave(g, W * 0.75, H * 0.25, W * 0.4, '#0ea5e9', 0.25); estrelas(g, W, H, 220, 50, [0, 0.72])
      desfocado(g, W, H, 3, (d, w, h) => { const p = (x: number, y: number, r: number, c1: string, c2: string, anel = false) => { const gr = d.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill(); if (anel) { d.strokeStyle = 'rgba(253,230,138,0.7)'; d.lineWidth = r * 0.12; d.beginPath(); d.ellipse(x, y, r * 1.7, r * 0.35, -0.3, 0, Math.PI * 2); d.stroke() } }; p(w * 0.14, h * 0.22, w * 0.07, '#fdba74', '#c2410c', true); p(w * 0.85, h * 0.18, w * 0.045, '#93c5fd', '#1d4ed8'); p(w * 0.9, h * 0.52, w * 0.03, '#f9a8d4', '#be185d') })
      vertical(g, 0, 0.74 * H, W, H, [[0, '#9ca3af'], [1, '#4b5563']]); const R = rng(51); for (let i = 0; i < 12; i++) { const x = R() * W, y = (0.78 + R() * 0.2) * H, r = (0.01 + R() * 0.03) * W; g.fillStyle = 'rgba(55,65,81,0.35)'; g.beginPath(); g.ellipse(x, y, r, r * 0.3, 0, 0, Math.PI * 2); g.fill() }
    } },
  { id: 'fx-tema-princesa', nome: 'Castelo de princesa', categoria: 'Temáticos', tags: ['princesa', 'castelo', 'rosa', 'menina', 'realeza'], horizonte: 0.68, brilhoPiso: 0.08,
    desenhar: (g, W, H) => {
      desfocado(g, W, H, 5, (d, w, h) => {
        vertical(d, 0, 0, w, h, [[0, '#f5d0fe'], [1, '#fce7f3']]); luzSuave(d, w * 0.5, h * 0.3, w * 0.5, '#ffffff', 0.7)
        const c = '#f0abfc', t = (x: number, y: number, lw: number, th: number) => { d.fillStyle = c; d.fillRect(x - lw / 2, y - th, lw, th); d.fillStyle = '#c026d3'; d.beginPath(); d.moveTo(x - lw * 0.7, y - th); d.lineTo(x, y - th - lw * 1.3); d.lineTo(x + lw * 0.7, y - th); d.fill() }
        d.fillStyle = c; d.fillRect(w * 0.3, h * 0.35, w * 0.4, h * 0.33); t(w * 0.3, h * 0.68, w * 0.07, h * 0.42); t(w * 0.7, h * 0.68, w * 0.07, h * 0.42); t(w * 0.5, h * 0.4, w * 0.09, h * 0.18); t(w * 0.4, h * 0.45, w * 0.05, h * 0.12); t(w * 0.6, h * 0.45, w * 0.05, h * 0.12)
        brilhos(d, w, h, 26, '#ffffff', 60, [0.02, 0.6])
      })
      ambiente(g, W, H, 0.68, ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], ['#fce7f3', '#f5c6e3'], { brilho: 0.25 }); brilhos(g, W, H, 10, '#fef3c7', 61, [0.72, 0.98])
    } },
  { id: 'fx-tema-unicornio', nome: 'Unicórnio arco-íris', categoria: 'Temáticos', tags: ['unicórnio', 'arco-íris', 'nuvens', 'menina', 'mágico'], horizonte: 0.7, brilhoPiso: 0,
    desenhar: (g, W, H) => { vertical(g, 0, 0, W, H, [[0, '#e0e7ff'], [1, '#fdf2f8']]); desfocado(g, W, H, 3, (d, w, h) => { const cores = ['#fca5a5', '#fdba74', '#fde68a', '#bbf7d0', '#bfdbfe', '#ddd6fe']; cores.forEach((c, i) => { d.strokeStyle = c; d.lineWidth = w * 0.035; d.beginPath(); d.arc(w * 0.5, h * 0.75, w * (0.42 - i * 0.035), Math.PI, 0); d.stroke() }); brilhos(d, w, h, 30, '#ffffff', 70, [0, 0.6]) }); nuvem(g, W * 0.1, H * 0.78, W * 0.5, H * 0.18, '#ffffff', '#e5dcf5', 71); nuvem(g, W * 0.9, H * 0.78, W * 0.5, H * 0.18, '#ffffff', '#e5dcf5', 72); nuvem(g, W * 0.5, H * 0.9, W * 1.4, H * 0.2, '#ffffff', '#ede4f8', 73) } },
  { id: 'fx-tema-floral', nome: 'Jardim floral', categoria: 'Temáticos', tags: ['flores', 'jardim', 'floral', 'primavera', 'delicado'], horizonte: 0.68, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 6, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#ecfccb'], [1, '#fef9c3']]); const R = rng(80); for (let i = 0; i < 40; i++) flor(d, R() * w, R() * h * 0.7, w * (0.02 + R() * 0.04), ['#f9a8d4', '#fda4af', '#fde68a', '#c4b5fd', '#ffffff'][i % 5]) }); vertical(g, 0, 0.68 * H, W, H, [[0, '#f7fee7'], [1, '#d9f99d']]); desfocado(g, W, H, 3, (d, w, h) => { const R = rng(81); for (let i = 0; i < 16; i++) { const lado = i % 2 ? w * (0.03 + R() * 0.1) : w * (0.87 + R() * 0.1); flor(d, lado, h * (0.74 + R() * 0.24), w * (0.03 + R() * 0.025), ['#f472b6', '#fb7185', '#facc15', '#a78bfa'][i % 4]) } }) } },
  { id: 'fx-tema-jardim-encantado', nome: 'Jardim encantado', categoria: 'Temáticos', tags: ['jardim', 'encantado', 'fadas', 'borboletas'], horizonte: 0.7, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 6, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#134e4a'], [1, '#65a30d']]); bokeh(d, w, h, 60, ['#fef08a', '#bbf7d0', '#ffffff'], 0.008, 0.03, 90, [0, 0.7], 0.7); for (let i = 0; i < 10; i++) folha(d, i < 5 ? 0 : w, h * (0.1 + (i % 5) * 0.15), w * 0.3, i < 5 ? 0.2 : Math.PI - 0.2, '#166534') }); vertical(g, 0, 0.7 * H, W, H, [[0, '#4d7c0f'], [1, '#365314']]); brilhos(g, W, H, 14, '#fef08a', 91, [0.1, 0.65]) } },
  { id: 'fx-tema-circo', nome: 'Circo', categoria: 'Temáticos', tags: ['circo', 'palhaço', 'listras', 'vermelho'], horizonte: 0.7, brilhoPiso: 0.06,
    desenhar: (g, W, H) => {
      // cortina de lona listrada com dobras + bambinela recortada + luzinhas; palco de madeira
      desfocado(g, W, H, 4, (d, w, h) => {
        const n = 14
        for (let i = 0; i < n; i++) { const x0 = (i / n) * w, x1 = ((i + 1) / n) * w, gr = d.createLinearGradient(x0, 0, x1, 0), c = i % 2 ? '#fff1f2' : '#dc2626'; gr.addColorStop(0, escuro(c, 0.15)); gr.addColorStop(0.5, claro(c, 0.08)); gr.addColorStop(1, escuro(c, 0.2)); d.fillStyle = gr; d.fillRect(x0, 0, x1 - x0 + 1, h * 0.7) }
        for (let i = 0; i < 10; i++) { const x = (i / 10) * w, r = w / 20; d.fillStyle = i % 2 ? '#facc15' : '#b91c1c'; d.beginPath(); d.moveTo(x, 0); d.lineTo(x + 2 * r, 0); d.lineTo(x + 2 * r, h * 0.08); d.arc(x + r, h * 0.08, r, 0, Math.PI); d.fill() }
        bokeh(d, w, h, 26, ['#fde68a', '#ffffff'], 0.008, 0.02, 100, [0.12, 0.6], 0.7)
      })
      madeira(g, W, H, 0.7, '#a0522d', 101); luzSuave(g, W * 0.5, H * 0.72, W * 0.4, '#fde68a', 0.3); vinheta(g, W, H, 0.22) } },
  // SAZONAIS
  { id: 'fx-natal', nome: 'Natal — luzinhas', categoria: 'Sazonais', tags: ['natal', 'dezembro', 'luzes', 'pinheiro'], horizonte: 0.68, brilhoPiso: 0.1,
    desenhar: (g, W, H) => { desfocado(g, W, H, 7, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#1f3b2d'], [1, '#2f5a43']]); bokeh(d, w, h, 80, ['#fde68a', '#fca5a5', '#ffffff', '#fbbf24'], 0.01, 0.045, 110, [0, 0.66], 0.65) }); vertical(g, 0, 0.68 * H, W, H, [[0, '#f5f0e6'], [1, '#e4d9c4']]); // bolas de Natal e presentes em primeiro plano, desfocados
      desfocado(g, W, H, 2.5, (d, w, h) => { for (const [x, y, r, c] of [[0.06, 0.9, 0.05, '#b91c1c'], [0.16, 0.95, 0.035, '#d4a017'], [0.9, 0.9, 0.055, '#15803d'], [0.97, 0.8, 0.03, '#b91c1c']] as const) balao(d, w * x, h * y, w * r, c, false) })
      luzSuave(g, W * 0.5, H * 0.7, W * 0.45, '#fde68a', 0.18) } },
  { id: 'fx-pascoa', nome: 'Páscoa', categoria: 'Sazonais', tags: ['páscoa', 'ovos', 'coelho', 'abril'], horizonte: 0.7, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 5, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#fef9c3'], [1, '#dcfce7']]); bokeh(d, w, h, 30, ['#ffffff', '#fbcfe8'], 0.01, 0.05, 120, [0, 0.6], 0.5) }); vertical(g, 0, 0.7 * H, W, H, [[0, '#bbf7d0'], [1, '#86efac']]); const R = rng(121); for (let i = 0; i < 90; i++) { const x = R() * W, y = (0.7 + R() * 0.3) * H; g.strokeStyle = '#4ade80'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * W * 0.01, y - H * 0.03); g.stroke() } for (const [x, c, c2] of [[0.1, '#f9a8d4', '#ffffff'], [0.18, '#93c5fd', '#fde68a'], [0.84, '#c4b5fd', '#ffffff'], [0.92, '#fde68a', '#f472b6']] as const) { const ex = W * x, ey = H * 0.86, r = W * 0.035; const gr = g.createRadialGradient(ex - r * 0.3, ey - r * 0.4, r * 0.1, ex, ey, r * 1.3); gr.addColorStop(0, claro(c, 0.4)); gr.addColorStop(1, c); g.fillStyle = gr; g.beginPath(); g.ellipse(ex, ey, r, r * 1.3, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = c2; g.lineWidth = r * 0.18; g.beginPath(); g.moveTo(ex - r, ey); g.bezierCurveTo(ex - r * 0.5, ey - r * 0.3, ex + r * 0.5, ey + r * 0.3, ex + r, ey); g.stroke() } } },
  { id: 'fx-dia-das-maes', nome: 'Dia das Mães', categoria: 'Sazonais', tags: ['dia das mães', 'maio', 'flores', 'rosa', 'amor'], horizonte: 0.66, brilhoPiso: 0.12,
    desenhar: (g, W, H) => { desfocado(g, W, H, 6, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#fce7f3'], [1, '#fbcfe8']]); const R = rng(130); for (let i = 0; i < 26; i++) flor(d, i % 2 ? R() * w * 0.3 : w * 0.7 + R() * w * 0.3, R() * h * 0.66, w * (0.03 + R() * 0.04), ['#f472b6', '#fb7185', '#ffffff', '#fda4af'][i % 4]); bokeh(d, w, h, 20, ['#ffffff'], 0.01, 0.04, 131, [0, 0.5], 0.5) }); ambiente(g, W, H, 0.66, ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], ['#fdf2f8', '#f5d0e2'], { brilho: 0.3 }); for (const x of [0.08, 0.92]) { g.fillStyle = '#e11d48'; g.save(); g.translate(W * x, H * 0.86); g.scale(W * 0.001, W * 0.001); g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-30, -10, -12, -32, 0, -14); g.bezierCurveTo(12, -32, 30, -10, 0, 12); g.fill(); g.restore() } } },
  { id: 'fx-festa-junina', nome: 'Festa junina', categoria: 'Sazonais', tags: ['festa junina', 'junho', 'bandeirinhas', 'arraiá'], horizonte: 0.68, brilhoPiso: 0,
    desenhar: (g, W, H) => { desfocado(g, W, H, 4, (d, w, h) => { vertical(d, 0, 0, w, h, [[0, '#1e3a8a'], [1, '#f59e0b']]); bokeh(d, w, h, 40, ['#fde68a', '#fb923c'], 0.01, 0.04, 140, [0.2, 0.65], 0.6); bandeirinhas(d, w, h, 0.06, 0.1, ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#f97316'], 14); bandeirinhas(d, w, h, 0.22, 0.08, ['#f97316', '#3b82f6', '#facc15', '#ef4444'], 12) }); madeira(g, W, H, 0.68, '#c89b6d', 141) } },
  { id: 'fx-halloween', nome: 'Halloween', categoria: 'Sazonais', tags: ['halloween', 'outubro', 'abóbora', 'noite'], horizonte: 0.7, brilhoPiso: 0.05,
    desenhar: (g, W, H) => { vertical(g, 0, 0, W, H, [[0, '#2e1065'], [0.6, '#7c2d12'], [1, '#f97316']]); luzSuave(g, W * 0.75, H * 0.2, W * 0.12, '#fef3c7', 0.95); g.fillStyle = '#fef3c7'; g.beginPath(); g.arc(W * 0.75, H * 0.2, W * 0.06, 0, Math.PI * 2); g.fill(); estrelas(g, W, H, 60, 150, [0, 0.4]); vertical(g, 0, 0.7 * H, W, H, [[0, '#3f2d1d'], [1, '#1c130c']]); for (const x of [0.1, 0.9]) { const px = W * x, py = H * 0.84, r = W * 0.05; const gr = g.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r * 1.2); gr.addColorStop(0, '#fdba74'); gr.addColorStop(1, '#c2410c'); g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, r * 1.2, r, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#365314'; g.fillRect(px - r * 0.08, py - r * 1.25, r * 0.16, r * 0.3) } } },
]
export const CATEGORIAS_ARTE = [...new Set(FUNDOS_ARTE.map(f => f.categoria))]

// cache do fundo pintado por (cena, tamanho) — lote de 200 fotos na mesma cena pinta 1 vez
const cacheFundo = new Map<string, HTMLCanvasElement>()
export function pintarFundoArte(g: G, id: string, W: number, H: number): boolean {
  const f = FUNDOS_ARTE.find(x => x.id === id)
  if (!f) return false
  const k = `${id}|${Math.round(W)}x${Math.round(H)}`
  let c = cacheFundo.get(k)
  if (!c) {
    c = tela(W, H); f.desenhar(c.getContext('2d')!, W, H)
    cacheFundo.set(k, c); while (cacheFundo.size > 16) cacheFundo.delete(cacheFundo.keys().next().value as string)
  }
  g.drawImage(c, 0, 0)
  return true
}
