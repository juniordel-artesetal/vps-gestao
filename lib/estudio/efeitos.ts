// SOA Edition — BIBLIOTECA DE EFEITOS de camada (sombra, sombra interna, brilho, contorno,
// sobreposição de cor/gradiente, textura, moldura). 100% AUTORAL: as texturas (papel, kraft, tecido,
// linho) são GERADAS por código com ruído determinístico — nenhum arquivo de terceiros.
//
// Imagem: os efeitos são desenhados no pipeline não-destrutivo da camada (lib/estudio/camadas), ao
// redor do conteúdo já ajustado/distorcido — então a sombra acompanha a perspectiva. Texto e forma:
// viram propriedades nativas do Fabric (sombra, contorno, preenchimento com gradiente/textura).

export interface Efeitos {
  sombra?: { cor: string; opacidade: number; desfoque: number; dx: number; dy: number } | null
  sombraInterna?: { cor: string; opacidade: number; desfoque: number; dx: number; dy: number } | null
  brilho?: { cor: string; opacidade: number; desfoque: number } | null
  contorno?: { cor: string; largura: number } | null
  sobreposicao?: { tipo: 'cor' | 'gradiente'; cor: string; cor2: string; angulo: number; opacidade: number; mistura: 'normal' | 'multiply' | 'screen' | 'overlay' } | null
  textura?: { tipo: TipoTextura; intensidade: number } | null
  moldura?: { cor: string; largura: number; raio: number } | null
}
export type TipoTextura = 'papel' | 'kraft' | 'tecido' | 'linho' | 'granulado'

export const semEfeitos = (e: Efeitos | null | undefined) =>
  !e || !(e.sombra || e.sombraInterna || e.brilho || e.contorno || e.sobreposicao || e.textura || e.moldura)

export function rgba(cor: string, opacidade: number): string {
  const h = cor.replace('#', '')
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0')
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, opacidade / 100))})`
}

// ── catálogo pronto (1 clique; tudo editável depois) ─────────────────────────────
export interface EfeitoPronto { id: string; nome: string; categoria: string; efeitos: Efeitos }
export const CATEGORIAS_EFEITOS = ['Texto', 'Sombras', 'Brilhos', 'Contornos', 'Cores', 'Texturas', 'Molduras', 'Combos'] as const

export const EFEITOS_PRONTOS: EfeitoPronto[] = [
  { id: 'txt-neon', nome: 'Neon', categoria: 'Texto', efeitos: { brilho: { cor: '#f97316', opacidade: 95, desfoque: 18 }, contorno: { cor: '#fff7ed', largura: 1 } } },
  { id: 'txt-neon-rosa', nome: 'Neon rosa', categoria: 'Texto', efeitos: { brilho: { cor: '#ec4899', opacidade: 95, desfoque: 18 }, contorno: { cor: '#fdf2f8', largura: 1 } } },
  { id: 'txt-bloco', nome: 'Bloco 3D', categoria: 'Texto', efeitos: { sombra: { cor: '#1f2937', opacidade: 100, desfoque: 0, dx: 5, dy: 5 } } },
  { id: 'txt-sombra-longa', nome: 'Sombra longa', categoria: 'Texto', efeitos: { sombra: { cor: '#000000', opacidade: 35, desfoque: 6, dx: 14, dy: 14 } } },
  { id: 'txt-adesivo', nome: 'Letra adesivo', categoria: 'Texto', efeitos: { contorno: { cor: '#ffffff', largura: 8 }, sombra: { cor: '#000000', opacidade: 30, desfoque: 8, dx: 0, dy: 4 } } },
  { id: 'txt-dourado', nome: 'Dourado', categoria: 'Texto', efeitos: { sobreposicao: { tipo: 'gradiente', cor: '#f5c542', cor2: '#b45309', angulo: 90, opacidade: 100, mistura: 'normal' } } },
  { id: 'sombra-suave', nome: 'Sombra suave', categoria: 'Sombras', efeitos: { sombra: { cor: '#000000', opacidade: 30, desfoque: 18, dx: 0, dy: 8 } } },
  { id: 'sombra-dura', nome: 'Sombra marcada', categoria: 'Sombras', efeitos: { sombra: { cor: '#000000', opacidade: 55, desfoque: 2, dx: 6, dy: 6 } } },
  { id: 'sombra-longa', nome: 'Sombra longa', categoria: 'Sombras', efeitos: { sombra: { cor: '#1f2937', opacidade: 35, desfoque: 30, dx: 18, dy: 24 } } },
  { id: 'sombra-interna', nome: 'Sombra interna', categoria: 'Sombras', efeitos: { sombraInterna: { cor: '#000000', opacidade: 45, desfoque: 14, dx: 4, dy: 4 } } },
  { id: 'brilho-laranja', nome: 'Neon laranja', categoria: 'Brilhos', efeitos: { brilho: { cor: '#f97316', opacidade: 85, desfoque: 22 } } },
  { id: 'brilho-dourado', nome: 'Brilho dourado', categoria: 'Brilhos', efeitos: { brilho: { cor: '#f5c542', opacidade: 80, desfoque: 18 } } },
  { id: 'brilho-branco', nome: 'Aura branca', categoria: 'Brilhos', efeitos: { brilho: { cor: '#ffffff', opacidade: 90, desfoque: 26 } } },
  { id: 'contorno-adesivo', nome: 'Adesivo (branco)', categoria: 'Contornos', efeitos: { contorno: { cor: '#ffffff', largura: 14 } } },
  { id: 'contorno-fino', nome: 'Fino preto', categoria: 'Contornos', efeitos: { contorno: { cor: '#111827', largura: 3 } } },
  { id: 'contorno-rosa', nome: 'Rosa grosso', categoria: 'Contornos', efeitos: { contorno: { cor: '#ec4899', largura: 10 } } },
  { id: 'cor-sepia', nome: 'Tom sépia', categoria: 'Cores', efeitos: { sobreposicao: { tipo: 'cor', cor: '#a0703c', cor2: '#a0703c', angulo: 0, opacidade: 35, mistura: 'multiply' } } },
  { id: 'grad-por-do-sol', nome: 'Pôr do sol', categoria: 'Cores', efeitos: { sobreposicao: { tipo: 'gradiente', cor: '#f97316', cor2: '#db2777', angulo: 45, opacidade: 45, mistura: 'overlay' } } },
  { id: 'grad-candy', nome: 'Candy', categoria: 'Cores', efeitos: { sobreposicao: { tipo: 'gradiente', cor: '#f9a8d4', cor2: '#93c5fd', angulo: 90, opacidade: 40, mistura: 'screen' } } },
  { id: 'tex-papel', nome: 'Papel', categoria: 'Texturas', efeitos: { textura: { tipo: 'papel', intensidade: 45 } } },
  { id: 'tex-kraft', nome: 'Kraft', categoria: 'Texturas', efeitos: { textura: { tipo: 'kraft', intensidade: 55 } } },
  { id: 'tex-tecido', nome: 'Tecido', categoria: 'Texturas', efeitos: { textura: { tipo: 'tecido', intensidade: 45 } } },
  { id: 'tex-linho', nome: 'Linho', categoria: 'Texturas', efeitos: { textura: { tipo: 'linho', intensidade: 40 } } },
  { id: 'tex-granulado', nome: 'Granulado', categoria: 'Texturas', efeitos: { textura: { tipo: 'granulado', intensidade: 35 } } },
  { id: 'mold-fina', nome: 'Moldura fina', categoria: 'Molduras', efeitos: { moldura: { cor: '#ffffff', largura: 12, raio: 0 } } },
  { id: 'mold-arred', nome: 'Arredondada', categoria: 'Molduras', efeitos: { moldura: { cor: '#ffffff', largura: 24, raio: 36 } } },
  { id: 'mold-escura', nome: 'Escura', categoria: 'Molduras', efeitos: { moldura: { cor: '#1f2937', largura: 18, raio: 8 } } },
  { id: 'combo-adesivo', nome: 'Adesivo com sombra', categoria: 'Combos', efeitos: { contorno: { cor: '#ffffff', largura: 16 }, sombra: { cor: '#000000', opacidade: 30, desfoque: 14, dx: 0, dy: 6 } } },
  { id: 'combo-polaroid', nome: 'Polaroid', categoria: 'Combos', efeitos: { moldura: { cor: '#fafafa', largura: 22, raio: 4 }, sombra: { cor: '#000000', opacidade: 28, desfoque: 16, dx: 0, dy: 8 } } },
]

// ── texturas geradas (determinísticas: mesmo tipo → mesma textura) ────────────────
function aleatorio(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const cacheTextura = new Map<string, HTMLCanvasElement>()

/** Ladrilho de textura em tons de cinza (claro = neutro), para mesclar por multiplicação. */
export function gerarTextura(tipo: TipoTextura, tam = 256): HTMLCanvasElement {
  const k = `${tipo}:${tam}`
  const ja = cacheTextura.get(k)
  if (ja) return ja
  const c = document.createElement('canvas'); c.width = c.height = tam
  const g = c.getContext('2d')!
  const img = g.createImageData(tam, tam)
  const r = aleatorio(tipo.length * 7919 + tam)
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    let v = 235
    const n = r()
    if (tipo === 'papel') v = 225 + n * 30
    else if (tipo === 'granulado') v = 200 + n * 55
    else if (tipo === 'kraft') v = 205 + n * 35 - ((Math.sin((x + y * 0.3) * 0.9) + 1) * 4)
    else if (tipo === 'tecido') v = 215 + n * 18 - ((x % 4 < 2) !== (y % 4 < 2) ? 22 : 0)
    else if (tipo === 'linho') v = 222 + n * 20 - ((x % 3 === 0) ? 14 : 0) - ((y % 5 === 0) ? 10 : 0)
    const i = (y * tam + x) * 4
    const b = Math.max(0, Math.min(255, v))
    img.data[i] = tipo === 'kraft' ? b : b; img.data[i + 1] = tipo === 'kraft' ? b * 0.86 : b; img.data[i + 2] = tipo === 'kraft' ? b * 0.68 : b; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  if (tipo === 'kraft' || tipo === 'papel') { // fibras
    g.globalAlpha = 0.08; g.strokeStyle = '#000'
    for (let i = 0; i < 90; i++) { g.beginPath(); const x = r() * tam, y = r() * tam; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 8); g.stroke() }
    g.globalAlpha = 1
  }
  cacheTextura.set(k, c)
  return c
}

/** Quanto os efeitos "vazam" para fora do conteúdo (px) — o canvas cresce para caber. */
export function margemEfeitos(e: Efeitos): number {
  let m = 0
  if (e.sombra) m = Math.max(m, e.sombra.desfoque * 2 + Math.max(Math.abs(e.sombra.dx), Math.abs(e.sombra.dy)))
  if (e.brilho) m = Math.max(m, e.brilho.desfoque * 2)
  if (e.contorno) m = Math.max(m, e.contorno.largura + 2)
  if (e.moldura) m = Math.max(m, e.moldura.largura)
  return Math.ceil(m)
}

/**
 * Desenha os efeitos ao redor/sobre `src` (w×h). Devolve o canvas maior e a margem usada.
 * `k` = px do elemento por px "nominal" (efeitos têm tamanho estável em qualquer resolução).
 */
export function aplicarEfeitosImagem(src: CanvasImageSource, w: number, h: number, e: Efeitos, k = 1): { canvas: HTMLCanvasElement; pad: number } {
  const pad = Math.ceil(margemEfeitos(e) * k)
  const W = w + pad * 2, H = h + pad * 2
  const out = document.createElement('canvas'); out.width = W; out.height = H
  const g = out.getContext('2d')!

  // conteúdo com efeitos INTERNOS (sobreposição, textura, sombra interna, moldura) num canvas à parte
  const corpo = document.createElement('canvas'); corpo.width = w; corpo.height = h
  const cg = corpo.getContext('2d')!
  if (e.moldura && e.moldura.raio > 0) {
    const r = e.moldura.raio * k
    cg.beginPath(); cg.roundRect(0, 0, w, h, r); cg.clip()
  }
  cg.drawImage(src, 0, 0, w, h)
  if (e.sobreposicao) {
    const s = e.sobreposicao
    // camada de cor/gradiente recortada no formato do conteúdo, composta com o modo escolhido
    const cam = document.createElement('canvas'); cam.width = w; cam.height = h
    const kg = cam.getContext('2d')!
    if (s.tipo === 'gradiente') {
      const a = (s.angulo * Math.PI) / 180, cx = w / 2, cy = h / 2, L = Math.hypot(w, h) / 2
      const gr = kg.createLinearGradient(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L)
      gr.addColorStop(0, s.cor); gr.addColorStop(1, s.cor2); kg.fillStyle = gr
    } else kg.fillStyle = s.cor
    kg.fillRect(0, 0, w, h)
    kg.globalCompositeOperation = 'destination-in'; kg.drawImage(corpo, 0, 0)
    cg.save()
    cg.globalCompositeOperation = s.mistura === 'normal' ? 'source-atop' : s.mistura
    cg.globalAlpha = Math.max(0, Math.min(1, s.opacidade / 100))
    cg.drawImage(cam, 0, 0)
    cg.restore()
  }
  if (e.textura) {
    const t = gerarTextura(e.textura.tipo)
    const cam = document.createElement('canvas'); cam.width = w; cam.height = h
    const kg = cam.getContext('2d')!
    kg.fillStyle = kg.createPattern(t, 'repeat')!; kg.fillRect(0, 0, w, h)
    kg.globalCompositeOperation = 'destination-in'; kg.drawImage(corpo, 0, 0)
    cg.save(); cg.globalCompositeOperation = 'multiply'; cg.globalAlpha = Math.max(0, Math.min(1, e.textura.intensidade / 100))
    cg.drawImage(cam, 0, 0); cg.restore()
  }
  if (e.sombraInterna) {
    const s = e.sombraInterna
    // sombra interna = sombra do "furo" (o avesso do conteúdo), recortada dentro do conteúdo
    const inv = document.createElement('canvas'); inv.width = w; inv.height = h
    const ig = inv.getContext('2d')!
    ig.fillStyle = '#000'; ig.fillRect(0, 0, w, h); ig.globalCompositeOperation = 'destination-out'; ig.drawImage(corpo, 0, 0)
    const sh = document.createElement('canvas'); sh.width = w; sh.height = h
    const sg = sh.getContext('2d')!
    sg.shadowColor = rgba(s.cor, s.opacidade); sg.shadowBlur = s.desfoque * k; sg.shadowOffsetX = s.dx * k; sg.shadowOffsetY = s.dy * k
    sg.drawImage(inv, 0, 0)
    sg.globalCompositeOperation = 'destination-out'; sg.shadowColor = 'transparent'; sg.drawImage(inv, 0, 0)
    sg.globalCompositeOperation = 'destination-in'; sg.drawImage(corpo, 0, 0)
    cg.drawImage(sh, 0, 0)
  }
  if (e.moldura) {
    const lw = e.moldura.largura * k, r = e.moldura.raio * k
    cg.save(); cg.strokeStyle = e.moldura.cor; cg.lineWidth = lw * 2
    cg.beginPath(); if (r > 0) cg.roundRect(0, 0, w, h, r); else cg.rect(0, 0, w, h); cg.stroke(); cg.restore()
  }

  // efeitos EXTERNOS, atrás do conteúdo: brilho, sombra, contorno
  if (e.brilho) {
    g.save(); g.shadowColor = rgba(e.brilho.cor, e.brilho.opacidade); g.shadowBlur = e.brilho.desfoque * k
    g.drawImage(corpo, pad, pad); g.drawImage(corpo, pad, pad); g.restore()
  }
  if (e.sombra) {
    const s = e.sombra
    g.save(); g.shadowColor = rgba(s.cor, s.opacidade); g.shadowBlur = s.desfoque * k; g.shadowOffsetX = s.dx * k; g.shadowOffsetY = s.dy * k
    g.drawImage(corpo, pad, pad); g.restore()
  }
  if (e.contorno && e.contorno.largura > 0) {
    // silhueta dilatada: o conteúdo pintado na cor do contorno, deslocado em volta (círculo)
    const sil = document.createElement('canvas'); sil.width = w; sil.height = h
    const lg = sil.getContext('2d')!; lg.drawImage(corpo, 0, 0); lg.globalCompositeOperation = 'source-in'; lg.fillStyle = e.contorno.cor; lg.fillRect(0, 0, w, h)
    const r = e.contorno.largura * k, passos = Math.max(16, Math.min(48, Math.round(r * 3)))
    for (let i = 0; i < passos; i++) {
      const a = (i / passos) * Math.PI * 2
      g.drawImage(sil, pad + Math.cos(a) * r, pad + Math.sin(a) * r)
    }
    g.drawImage(sil, pad, pad)
  }
  g.drawImage(corpo, pad, pad)
  return { canvas: out, pad }
}
