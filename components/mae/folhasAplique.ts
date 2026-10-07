'use client'
// Lote 4 (item 46): "Ver folhas de aplique" — as duas folhas (impressos e silhuetas) aparecem como PRANCHETAS DE
// PRÉVIA na área de trabalho, ao lado das pranchetas do tema, antes de gerar. Só vista: não entram no documento,
// não exportam; "Fechar" tira. Geradas pelo mesmo montador das folhas de verdade (resolução menor).
import { create } from 'zustand'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { MarcaRegistro } from './sincronia'

export interface FolhaPrevia { nome: string; bitmap: ImageBitmap; wMm: number; hMm: number }
interface Estado { folhas: FolhaPrevia[] | null; gerando: boolean; avisos: string[] }
export const useFolhasAplique = create<Estado>()(() => ({ folhas: null, gerando: false, avisos: [] }))

export function fecharFolhasAplique() {
  useFolhasAplique.getState().folhas?.forEach(f => f.bitmap.close())
  useFolhasAplique.setState({ folhas: null, avisos: [] })
}

export async function verFolhasAplique(raiz: FileSystemDirectoryHandle, doc: DocTrabalho, tema: DocTema, marcas: MarcaRegistro[]): Promise<void> {
  useFolhasAplique.setState({ gerando: true })
  try {
    const { gerarFolhasDeApliques } = await import('./apliquesMae')
    const PX_MM = 4
    const s = await gerarFolhasDeApliques(raiz, doc, tema, marcas, q => q, PX_MM)
    const folhas: FolhaPrevia[] = []
    for (const a of s.arquivos) {
      const bitmap = await createImageBitmap(a.blob)
      folhas.push({ nome: a.nome === 'apliques-impressos' ? 'Folha de impressos (prévia)' : 'Folha de silhuetas (prévia)', bitmap, wMm: bitmap.width / PX_MM, hMm: bitmap.height / PX_MM })
    }
    useFolhasAplique.getState().folhas?.forEach(f => f.bitmap.close())
    useFolhasAplique.setState({ folhas: folhas.length ? folhas : null, avisos: s.avisos })
    if (folhas.length) window.dispatchEvent(new CustomEvent('mae:ver-folhas-aplique'))
  } finally { useFolhasAplique.setState({ gerando: false }) }
}
