// SOA Design — MOCKUPS no navegador: os da artesã (foto dela + recorte + área), a BIBLIOTECA autoral
// (produtos gerados por código + caixas lisas do acervo montadas em 3D, já com a área definida) e as
// caixas montadas salvas. Tudo vira o mesmo "MockupPronto" para o gerador de fotos.
import { carregarImagem, novoCanvas } from './mockup'
import { PRODUTOS_ACERVO } from './produtosAcervo'
import { ACERVO_CAIXAS } from './caixasAcervo'
import { renderMontada } from './montada'
import { facePrincipal } from './caixas'
import type { AreaAplicacao } from './areaMolde'
import { LS_PADRAO, type ConfigMockup, type LuzSombra } from './mockupTipos'

export interface MockupPronto {
  id: string
  nome: string
  origem: 'meu' | 'biblioteca' | 'caixa'
  categoria: string
  /** Produto sem fundo (com a arte ainda não aplicada). */
  produto: HTMLCanvasElement
  cfg: ConfigMockup
  medidas: { largura: number; altura: number; profundidade: number | null }
  /** Linha do banco (mockups salvos). */
  linha?: Record<string, unknown>
  /** Mockup POR FOTO: aplica a arte na foto (perspectiva/curvatura + luz da foto) — usado no lugar de comporMockup. */
  compor?: (arte: CanvasImageSource) => HTMLCanvasElement
}

const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)

export async function listarMockupsSalvos(): Promise<Record<string, unknown>[]> {
  const r = await fetch('/api/estudio/mockups').then(x => x.json()).catch(() => ({}))
  return r.itens || []
}

/** Mockup salvo → pronto para uso (baixa o recorte do Blob). */
export async function prepararSalvo(l: Record<string, unknown>): Promise<MockupPronto | null> {
  const cfgExtra = (json(l.config) || {}) as Record<string, unknown>
  if (l.tipo === 'caixa') {
    // caixa montada salva: caixa lisa em 3/4 com a arte na FRENTE (laço/pedra ficam no Kit de caixas)
    const { listarMoldes, carregarMoldeCaixa, montagemDe } = await import('./caixasCliente')
    const m = (await listarMoldes()).find(x => x.id === l.moldeCaixaId)
    if (!m) return null
    const mc = await carregarMoldeCaixa(m), mont = montagemDe(mc)
    const frente = facePrincipal(m.faces, 'frente')
    if (!mont || !frente) return null
    const q: Record<string, { x: number; y: number }[]> = {}
    const c = renderMontada(mont, m.faces, null, mc.W, mc.H, { vista: 'frente34', lado: 1400, saidaQuadros: q })
    if (!q[frente.id]) return null
    return {
      id: String(l.id), nome: String(l.nome), origem: 'caixa', categoria: 'caixa', produto: c, linha: l,
      cfg: { area: { tipo: 'perspectiva', cols: 2, rows: 2, pontos: q[frente.id] }, recorte: null, ls: { sombra: 55, luz: 15, direcao: 60 }, cor: null, opacidade: 100 },
      medidas: { largura: mont.dims.l, altura: mont.dims.a, profundidade: mont.dims.p },
    }
  }
  if (l.tipo === 'foto') {
    // mockup POR FOTO: a arte vai na foto original, na área marcada, com a luz da foto
    const { aplicarArteNaFoto, aplicarAreas, contornoDaArea, REALISMO_PADRAO } = await import('./mockupFoto')
    if (!l.fotoUrl) return null
    const img = await carregarImagem(String(l.fotoUrl))
    const foto = novoCanvas(img.naturalWidth, img.naturalHeight); foto.getContext('2d')!.drawImage(img, 0, 0)
    // v2 = Smart Areas (várias áreas nomeadas); v1 = uma área só
    const aa = json(l.areaAplicacao) as import('./mockupFoto').AreaFoto & { versao?: number; areas?: import('./mockupFoto').SmartArea[] }
    const areas = aa?.versao === 2 && Array.isArray(aa.areas) ? aa.areas.filter(a => !a.oculta) : null
    if (areas && !areas.length) return null
    const areaF: import('./mockupFoto').AreaFoto = areas ? areas[0].area : aa
    const extra = cfgExtra as { realismo?: import('./mockupFoto').Realismo; mascaraProduto?: [number, number][] | null; furosProduto?: [number, number][][] }
    const real = { ...REALISMO_PADRAO, ...(extra.realismo || {}) }
    const cfgF = { ...real, area: areaF, mascaraProduto: extra.mascaraProduto || null, furosProduto: extra.furosProduto || null }
    const cont = areas ? areas.flatMap(a => contornoDaArea(a.area, 1, 1)) : contornoDaArea(areaF, 1, 1), xs = cont.map(p => p.x), ys = cont.map(p => p.y)
    const q = [{ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.min(...ys) }, { x: Math.min(...xs), y: Math.max(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) }]
    return {
      id: String(l.id), nome: String(l.nome), origem: 'meu', categoria: 'foto', produto: foto, linha: l,
      cfg: { area: { tipo: 'perspectiva', cols: 2, rows: 2, pontos: q }, recorte: null, ls: LS_PADRAO, cor: null, opacidade: 100 },
      medidas: (cfgExtra.medidas as MockupPronto['medidas']) || { largura: 10, altura: 10, profundidade: null },
      compor: areas ? arte => aplicarAreas(foto, [arte], areas, real, { mascaraProduto: extra.mascaraProduto || null }) : arte => aplicarArteNaFoto(foto, arte, cfgF),
    }
  }
  const url = (l.recorteUrl || l.fotoUrl) as string | null
  if (!url) return null
  const img = await carregarImagem(url)
  const c = novoCanvas(img.naturalWidth, img.naturalHeight); c.getContext('2d')!.drawImage(img, 0, 0)
  const area = json(l.areaAplicacao) as AreaAplicacao
  const ls = { ...LS_PADRAO, ...((json(l.sombra) || {}) as Partial<LuzSombra>), ...((json(l.luz) || {}) as Partial<LuzSombra>) }
  return {
    id: String(l.id), nome: String(l.nome), origem: 'meu', categoria: 'meus', produto: c, linha: l,
    cfg: { area, recorte: (cfgExtra.recorte as ConfigMockup['recorte']) || null, ls, cor: (cfgExtra.cor as ConfigMockup['cor']) || null, opacidade: Number(cfgExtra.opacidade ?? 100) },
    medidas: (cfgExtra.medidas as MockupPronto['medidas']) || { largura: 10, altura: 10, profundidade: null },
  }
}

/** Biblioteca autoral: produtos procedurais + caixas lisas montadas (área = frente em perspectiva). */
export function mockupsDaBiblioteca(lado = 1400): MockupPronto[] {
  const out: MockupPronto[] = []
  for (const p of PRODUTOS_ACERVO) {
    try {
      const g = p.gerar(lado)
      out.push({ id: `acervo:${p.id}`, nome: p.nome, origem: 'biblioteca', categoria: p.categoria, produto: g.foto, cfg: { area: g.area, recorte: g.recorte, ls: g.ls, cor: null, opacidade: 100 }, medidas: g.medidas })
    } catch { /* um produto com problema não derruba a biblioteca */ }
  }
  for (const d of ACERVO_CAIXAS) {
    const q: Record<string, { x: number; y: number }[]> = {}
    const c = renderMontada(d.montagem, d.faces, null, 1000, 1000, { vista: 'frente34', lado, saidaQuadros: q })
    const frente = facePrincipal(d.faces, 'frente')
    const pts = frente && q[frente.id]
    if (!pts) continue
    out.push({
      id: `caixa:${d.id}`, nome: `${d.nome} (lisa)`, origem: 'biblioteca', categoria: d.categoria, produto: c,
      cfg: { area: { tipo: 'perspectiva', cols: 2, rows: 2, pontos: pts }, recorte: null, ls: { sombra: 55, luz: 15, direcao: 60 }, cor: null, opacidade: 100 },
      medidas: { largura: d.montagem.dims.l, altura: d.montagem.dims.a, profundidade: d.montagem.dims.p },
    })
  }
  return out
}

/** Arte de teste (autoral) para a prévia da área: faixas coloridas + "ARTE". */
export function arteDeTeste(w = 900, h = 700): HTMLCanvasElement {
  const c = novoCanvas(w, h), g = c.getContext('2d')!
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f472b6'); gr.addColorStop(0.5, '#fbbf24'); gr.addColorStop(1, '#38bdf8')
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = w / 90
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((w * i) / 6, 0); g.lineTo((w * i) / 6, h); g.stroke(); g.beginPath(); g.moveTo(0, (h * i) / 6); g.lineTo(w, (h * i) / 6); g.stroke() }
  g.fillStyle = '#fff'; g.font = `700 ${Math.round(h * 0.2)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('ARTE', w / 2, h / 2)
  return c
}

/** Segmento de cada produto da biblioteca/mockup (filtro "por segmento" do Mockup de produtos). */
const SEGMENTO_POR_CATEGORIA: Record<string, string> = {
  caneca: 'Canecas e copos', lata: 'Canecas e copos', copo: 'Canecas e copos',
  tag: 'Festa infantil', topo: 'Festa infantil',
  camiseta: 'Vestuário',
  sacola: 'Embalagens', caixa: 'Embalagens', maleta: 'Embalagens',
  papelaria: 'Papelaria', vela: 'Velas e aromas',
  foto: 'Meus produtos', meus: 'Meus produtos',
}
export const segmentoDe = (m: Pick<MockupPronto, 'categoria' | 'origem'>) => (m.origem === 'meu' ? 'Meus produtos' : SEGMENTO_POR_CATEGORIA[m.categoria] || 'Outros')
