// Lote 22 (item 262): nomes dos PNG da geração — o nome do PDF + "_folha-01" (várias folhas saem num .zip). Puro.
export const nomeFolhaPng = (base: string, i: number, total: number) => (total > 1 ? `${base}_folha-${String(i + 1).padStart(2, '0')}.png` : `${base}.png`)
/** "Ariel_5anos_Sereia.pdf" → "Ariel_5anos_Sereia". */
export const semExtensao = (nome: string) => nome.replace(/\.[a-z0-9]+$/i, '')
