// mae-importação — padrões por formato (puros, valem no navegador e nos testes).
export type TipoArquivo = 'pdf' | 'svg' | 'dxf' | 'png' | 'jpg'

/**
 * Limiar de binarização (luma 0–255 abaixo do qual o pixel é LINHA). Linha de molde costuma ser fina
 * (0,1 mm) e antisserrilhada — fica cinza-clara no raster; 235–240 pega sem pegar o papel.
 */
export const limiarPadrao = (tipo: TipoArquivo) => (tipo === 'png' || tipo === 'jpg' ? 235 : 240)

/** "Fechar pontilhado" padrão (mm): vetores de molde têm frestas de 0,2–0,4 mm nas pontas das linhas. */
export const fecharPadraoMm = (tipo: TipoArquivo) => (tipo === 'png' || tipo === 'jpg' ? 0.4 : 0.25)
