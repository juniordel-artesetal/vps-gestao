// mae-editor — POSIÇÃO DOS MOLDES NA PRANCHETA (Lote 2, item 15), pura: área útil (a prancheta menos as
// áreas da marca de registro), centralizar, alinhar (esquerda/centro/direita/topo/meio/base) à prancheta
// ou entre os selecionados, e distribuir com espaço igual. Tudo em mm, no sistema da prancheta.

export interface Caixa { x: number; y: number; w: number; h: number }
export type ModoAlinhar = 'esquerda' | 'centro' | 'direita' | 'topo' | 'meio' | 'base'
export interface Delta { dx: number; dy: number }

const r2 = (v: number) => Math.round(v * 100) / 100

/**
 * Área útil da prancheta: tira de cada lado o que as áreas da marca (cantos, réguas) ocupam naquele lado.
 * Uma zona conta para o lado de que está mais perto (terço da folha). Sem marca = a folha inteira menos `margem`.
 */
export function areaUtil(W: number, H: number, zonas: Caixa[] = [], margem = 0): Caixa {
  let esq = margem, dir = margem, topo = margem, base = margem
  for (const z of zonas) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2
    if (cx < W / 3) esq = Math.max(esq, z.x + z.w + margem)
    if (cx > (2 * W) / 3) dir = Math.max(dir, W - z.x + margem)
    if (cy < H / 3) topo = Math.max(topo, z.y + z.h + margem)
    if (cy > (2 * H) / 3) base = Math.max(base, H - z.y + margem)
  }
  // zonas só nos cantos podem "comer" demais em folhas pequenas: nunca menos de 20% da folha
  if (esq + dir > W * 0.8) { const k = (W * 0.8) / (esq + dir); esq *= k; dir *= k }
  if (topo + base > H * 0.8) { const k = (H * 0.8) / (topo + base); topo *= k; base *= k }
  return { x: r2(esq), y: r2(topo), w: r2(W - esq - dir), h: r2(H - topo - base) }
}

/** A caixa que envolve todas. */
export function uniao(cs: Caixa[]): Caixa {
  const x = Math.min(...cs.map(c => c.x)), y = Math.min(...cs.map(c => c.y))
  return { x, y, w: Math.max(...cs.map(c => c.x + c.w)) - x, h: Math.max(...cs.map(c => c.y + c.h)) - y }
}

/** Quanto mover o GRUPO (sem mudar as distâncias entre os moldes) para ficar no centro da área. */
export function centralizarGrupo(cs: Caixa[], area: Caixa): Delta {
  if (!cs.length) return { dx: 0, dy: 0 }
  const u = uniao(cs)
  return { dx: r2(area.x + (area.w - u.w) / 2 - u.x), dy: r2(area.y + (area.h - u.h) / 2 - u.y) }
}

function alinharUm(c: Caixa, alvo: Caixa, modo: ModoAlinhar): Delta {
  switch (modo) {
    case 'esquerda': return { dx: r2(alvo.x - c.x), dy: 0 }
    case 'centro': return { dx: r2(alvo.x + (alvo.w - c.w) / 2 - c.x), dy: 0 }
    case 'direita': return { dx: r2(alvo.x + alvo.w - c.w - c.x), dy: 0 }
    case 'topo': return { dx: 0, dy: r2(alvo.y - c.y) }
    case 'meio': return { dx: 0, dy: r2(alvo.y + (alvo.h - c.h) / 2 - c.y) }
    case 'base': return { dx: 0, dy: r2(alvo.y + alvo.h - c.h - c.y) }
  }
}

/**
 * Alinhar. `a: 'prancheta'` move a seleção INTEIRA como um bloco até a borda/centro da área útil (os moldes
 * não se amontoam); `a: 'selecao'` alinha cada molde à caixa que envolve os selecionados (precisa de 2+).
 */
export function alinhar(cs: Caixa[], modo: ModoAlinhar, a: 'prancheta' | 'selecao', area: Caixa): Delta[] {
  if (!cs.length) return []
  if (a === 'selecao' && cs.length > 1) { const u = uniao(cs); return cs.map(c => alinharUm(c, u, modo)) }
  const d = alinharUm(uniao(cs), area, modo)
  return cs.map(() => d)
}

/** Distribuir com espaço IGUAL entre os moldes (3+): o primeiro e o último ficam onde estão. */
export function distribuir(cs: Caixa[], eixo: 'h' | 'v'): Delta[] {
  const out: Delta[] = cs.map(() => ({ dx: 0, dy: 0 }))
  if (cs.length < 3) return out
  const ordem = cs.map((c, i) => ({ c, i })).sort((p, q) => eixo === 'h' ? p.c.x - q.c.x : p.c.y - q.c.y)
  const ini = eixo === 'h' ? ordem[0].c.x : ordem[0].c.y
  const ult = ordem[ordem.length - 1].c
  const fim = eixo === 'h' ? ult.x + ult.w : ult.y + ult.h
  const soma = ordem.reduce((s, o) => s + (eixo === 'h' ? o.c.w : o.c.h), 0)
  const gap = (fim - ini - soma) / (cs.length - 1)
  let pos = ini
  for (const o of ordem) {
    const atual = eixo === 'h' ? o.c.x : o.c.y
    out[o.i] = eixo === 'h' ? { dx: r2(pos - atual), dy: 0 } : { dx: 0, dy: r2(pos - atual) }
    pos += (eixo === 'h' ? o.c.w : o.c.h) + gap
  }
  return out
}
