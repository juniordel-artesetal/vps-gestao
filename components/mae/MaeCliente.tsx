'use client'
// Carrega o editor MAE só no navegador (Konva, File System Access e Local Font Access não existem no
// servidor). `ssr: false` só é permitido dentro de Client Component (guia lazy-loading do Next 16).
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const EditorMae = dynamic(() => import('./EditorMae'), {
  ssr: false,
  loading: () => <div className="p-8 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo o Método MAE…</div>,
})

export default function MaeCliente({ secao }: { secao?: string }) {
  return <EditorMae secao={secao} />
}
