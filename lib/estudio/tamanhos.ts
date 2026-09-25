// SOA Edition — tamanhos de imagem por canal. PONTO ÚNICO: quando um marketplace mudar a
// recomendação, é só atualizar aqui (e a data). Valores em pixels.
// Revisado em 25/09/2026 com as recomendações públicas de cada canal (foto de produto quadrada
// com folga para o zoom; formatos verticais do Instagram/Pinterest).
export interface TamanhoCanal { id: string; canal: string; rotulo: string; largura: number; altura: number; dica?: string }

export const TAMANHOS_REVISADOS_EM = '25/09/2026'

export const TAMANHOS_CANAIS: TamanhoCanal[] = [
  { id: 'shopee', canal: 'Shopee', rotulo: 'Produto 1:1', largura: 1024, altura: 1024, dica: 'quadrada, fundo limpo' },
  { id: 'mercadolivre', canal: 'Mercado Livre', rotulo: 'Produto 1:1', largura: 1200, altura: 1200, dica: '1200 px libera o zoom' },
  { id: 'elo7', canal: 'Elo7', rotulo: 'Produto 1:1', largura: 1000, altura: 1000 },
  { id: 'amazon', canal: 'Amazon', rotulo: 'Produto 1:1', largura: 2000, altura: 2000, dica: 'fundo branco na foto principal' },
  { id: 'ig-feed', canal: 'Instagram', rotulo: 'Feed 4:5', largura: 1080, altura: 1350 },
  { id: 'ig-quadrado', canal: 'Instagram', rotulo: 'Feed 1:1', largura: 1080, altura: 1080 },
  { id: 'ig-story', canal: 'Instagram', rotulo: 'Story / Reels 9:16', largura: 1080, altura: 1920 },
  { id: 'pinterest', canal: 'Pinterest', rotulo: 'Pin 2:3', largura: 1000, altura: 1500 },
]

export const rotuloTamanho = (t: TamanhoCanal) => `${t.canal} · ${t.rotulo} (${t.largura}×${t.altura})`

/** Impressão (300 dpi): tamanho do papel em mm × 300 / 25,4. Só no Editor de imagem (não entra nos canais). */
export const DPI_IMPRESSAO = 300
export const TAMANHOS_IMPRESSAO: TamanhoCanal[] = ([['A4', 2480, 3508, '210 × 297 mm'], ['A5', 1748, 2480, '148 × 210 mm'], ['A6', 1240, 1748, '105 × 148 mm']] as const)
  .flatMap(([n, w, h, mm]) => [
    { id: `${n.toLowerCase()}-retrato`, canal: 'Impressão', rotulo: `${n} retrato`, largura: w, altura: h, dica: `${mm} · 300 dpi` },
    { id: `${n.toLowerCase()}-paisagem`, canal: 'Impressão', rotulo: `${n} paisagem`, largura: h, altura: w, dica: `${mm} · 300 dpi` },
  ])
/** Lista do editor: impressão + canais. */
export const TAMANHOS_EDITOR: TamanhoCanal[] = [...TAMANHOS_IMPRESSAO, ...TAMANHOS_CANAIS]
/** O design é uma folha de impressão (A4/A5/A6)? Então o PDF sai no tamanho real do papel. */
export const ehImpressao = (w: number, h: number) => TAMANHOS_IMPRESSAO.some(t => t.largura === w && t.altura === h)
/** px → pontos do PDF: folha de impressão a 300 dpi; o resto na convenção de tela (96 dpi). */
export const pontosPdf = (w: number, h: number) => (ehImpressao(w, h) ? 72 / DPI_IMPRESSAO : 0.75)
