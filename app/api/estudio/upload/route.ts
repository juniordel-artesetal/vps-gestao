// SOA Edition — emite o token de upload DIRETO do navegador para o Vercel Blob.
// Upload pelo servidor não serve: funções da Vercel limitam o corpo a ~4,5 MB e molde em PDF
// passa disso fácil. O arquivo nunca passa pelo Neon; depois do upload o cliente grava os
// metadados em POST /api/estudio/assets.
import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { ctxEstudio, storageConfigurado } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'

const TIPOS_OK = [
  'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'application/pdf',
  'font/ttf', 'font/otf', 'font/sfnt', 'application/x-font-ttf', 'application/x-font-otf',
  'application/font-sfnt', 'application/octet-stream', 'application/zip',
]
const MAX_BYTES = 60 * 1024 * 1024 // 60 MB por arquivo (cota por plano vem depois)

export async function POST(req: NextRequest) {
  if (!storageConfigurado()) {
    return NextResponse.json({ error: 'Armazenamento de arquivos ainda não configurado neste ambiente.' }, { status: 503 })
  }
  const body = (await req.json()) as HandleUploadBody
  try {
    const r = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Só gera token para quem pode usar o módulo — e dentro da pasta do próprio workspace.
        const c = await ctxEstudio()
        if (!c.ok) throw new Error('Sem acesso ao SOA Edition')
        if (!pathname.startsWith(`estudio/${c.workspaceId}/`)) throw new Error('Caminho inválido')
        return { allowedContentTypes: TIPOS_OK, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true, tokenPayload: c.workspaceId }
      },
      // Metadados são gravados pelo cliente logo após o upload (este callback não roda em localhost).
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Falha no upload' }, { status: 400 })
  }
}
