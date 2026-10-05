// mae-texto — TEXTO LIVRE do editor de imagem (Sprint 13, vindo do SOA Design): parágrafos com quebra de
// linha (Enter) e quebra automática na largura da caixa, alinhamento, tracking, entrelinha, caixa alta/
// baixa/título, escala, recursos OpenType. Sai caminho em mm (origem no canto da caixa) — o motor desenha
// o mesmo caminho na tela e no arquivo. Puro.
import { moldar, type Cmd, type FonteHB, type GlifoMoldado } from './fonte'
import { MM_POR_PT } from './diagramar'

export interface EstiloLivre {
  tamanhoPt: number
  align?: 'left' | 'center' | 'right'
  tracking?: number
  lineHeight?: number
  caixa?: 'normal' | 'alta' | 'baixa' | 'titulo'
  scaleX?: number
  features?: string[]
  kerning?: boolean
}

export function aplicarCaixa(t: string, caixa: EstiloLivre['caixa']): string {
  if (caixa === 'alta') return t.toLocaleUpperCase('pt-BR')
  if (caixa === 'baixa') return t.toLocaleLowerCase('pt-BR')
  if (caixa === 'titulo') return t.toLocaleLowerCase('pt-BR').replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('pt-BR'))
  return t
}

const larg = (g: GlifoMoldado[], s: number, sx: number, tr: number, tam: number) => g.reduce((a, x) => a + x.xAdv * s * sx, 0) + Math.max(0, g.length - 1) * (tr / 1000) * tam * sx

/** Quebra o parágrafo em linhas que cabem em `w` mm (por palavra; palavra maior que a caixa fica sozinha). */
export function quebrarLinhas(f: FonteHB, texto: string, e: EstiloLivre, w: number): string[] {
  const tam = e.tamanhoPt * MM_POR_PT, s = tam / f.upem, sx = e.scaleX ?? 1, tr = e.tracking ?? 0
  const med = (t: string) => larg(moldar(f, t, { features: e.features, kerning: e.kerning !== false }), s, sx, tr, tam)
  const out: string[] = []
  for (const par of aplicarCaixa(texto, e.caixa).split(/\r?\n/)) {
    const palavras = par.split(/ +/)
    let linha = ''
    for (const p of palavras) {
      const tenta = linha ? `${linha} ${p}` : p
      if (!linha || med(tenta) <= w + 1e-6) linha = tenta
      else { out.push(linha); linha = p }
    }
    out.push(linha)
  }
  return out
}

export function diagramarLivre(f: FonteHB, valor: string, e: EstiloLivre, w: number): { cmds: Cmd[]; hMm: number; linhas: string[] } {
  const linhas = quebrarLinhas(f, valor, e, w)
  const tam = e.tamanhoPt * MM_POR_PT, s = tam / f.upem, sx = e.scaleX ?? 1, tr = e.tracking ?? 0
  const lh = (e.lineHeight ?? 1.15) * tam
  const cmds: Cmd[] = []
  linhas.forEach((l, li) => {
    const g = moldar(f, l, { features: e.features, kerning: e.kerning !== false })
    const wl = larg(g, s, sx, tr, tam)
    const x0 = e.align === 'right' ? w - wl : e.align === 'center' ? (w - wl) / 2 : 0
    const base = (f.ascender / f.upem) * tam + li * lh
    let pen = x0
    for (const gl of g) {
      for (const c0 of f.contorno(gl.gid)) {
        if (c0[0] === 'Z') { cmds.push(['Z']); continue }
        const v = c0.slice(1) as number[], o: number[] = []
        for (let i = 0; i < v.length; i += 2) o.push(pen + (v[i] + gl.xOff) * s * sx, base - (v[i + 1] + gl.yOff) * s)
        cmds.push([c0[0], ...o] as Cmd)
      }
      pen += gl.xAdv * s * sx + (tr / 1000) * tam * sx
    }
  })
  const hMm = linhas.length ? (f.ascender - f.descender) / f.upem * tam + (linhas.length - 1) * lh : 0
  return { cmds, hMm, linhas }
}
