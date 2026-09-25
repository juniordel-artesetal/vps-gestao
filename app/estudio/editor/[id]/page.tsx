'use client'
// SOA Edition — editor de camadas (Fabric só no navegador).
import { use } from 'react'
import dynamic from 'next/dynamic'

const EditorCamadas = dynamic(() => import('@/components/estudio/editor/EditorCamadas'), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-gray-400">Abrindo o editor…</p>,
})

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <EditorCamadas designId={id} />
}
