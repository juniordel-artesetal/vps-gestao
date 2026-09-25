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
