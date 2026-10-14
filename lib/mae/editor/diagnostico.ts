// Lote 14 (item 193): MENSAGENS COM A CAUSA REAL — antes, qualquer base sem arte dizia "Nenhuma prancheta tem molde com
// faces" (a causa era outra: o molde tinha perdido o arquivo, o grupo estava vazio…). E o aviso ao importar uma ARTE
// como molde. Puro (a checagem dos arquivos vem de fora).
import type { DocTrabalho } from '../schema'

type Doc = DocTrabalho
const extensao = (p: string) => (p.split('.').pop() ?? '').toUpperCase()

/**
 * Por que o documento não tem nada para imprimir: sem peças (grupo/folha vazios), molde que perdeu o arquivo (o PNG
 * não está mais na Biblioteca) ou molde sem faces. `existe(path)` = o arquivo está na Biblioteca.
 */
export async function causaSemArte(d: Pick<Doc, 'molds'>, existe: (path: string) => Promise<boolean>): Promise<string> {
  if (!d.molds.length) return 'Este produto não tem peças: o grupo ou a folha dele na base está vazio. Abra a base e confira Grupos de produto (ou Folhas do kit, nas peças sob medida).'
  for (const m of d.molds) {
    if (m.faces.length) continue
    if (m.source.kind !== 'medida' && !(await existe(m.source.path).catch(() => false)))
      return `O molde "${m.name}" perdeu o arquivo — ${extensao(m.source.path) || 'o arquivo'} não encontrado na Biblioteca (${m.source.path}). Abra a base em Moldes: "Corrigir molde" (escolher o arquivo de novo) ou "Trocar por peça por medida".`
    return `O molde "${m.name}" não tem faces — abra a base em Faces e detecte de novo (ou troque por uma peça por medida).`
  }
  return 'Nenhuma prancheta tem molde com faces — monte a base antes de exportar.'
}

/**
 * Item 193: PNG/JPG colorido importado como MOLDE parece uma ARTE (o molde é só o contorno de corte). Pixels com cor
 * forte (saturação alta, nem branco nem preto) em mais de 12% da imagem. `rgba` de uma amostra reduzida.
 */
export function pareceArte(rgba: Uint8ClampedArray | Uint8Array, limite = 0.12): boolean {
  let cor = 0, total = 0
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 40) continue
    total++
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    if (mx > 40 && mx < 250 && (mx - mn) / mx > 0.35) cor++
  }
  return total > 0 && cor / total > limite
}
export const AVISO_ARTE_COMO_MOLDE = 'Isto parece uma arte, não um molde. O molde é só o contorno de corte; a arte vai no Tema.'
