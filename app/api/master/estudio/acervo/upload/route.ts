// Master — token de upload direto ao Blob para o molde processado do acervo (só na pasta do acervo).
import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { ACERVO_WS } from '@/lib/estudio/especiais'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: 'Armazenamento não configurado.' }, { status: 503 })
  const body = (await req.json()) as HandleUploadBody
  try {
    const r = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async pathname => {
        if (!(await ehMaster(req))) throw new Error('Não autorizado')
        if (!pathname.startsWith(`estudio/${ACERVO_WS}/molde/`)) throw new Error('Caminho inválido')
        return { allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'], maximumSizeInBytes: 25 * 1024 * 1024, addRandomSuffix: true }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(r)
  } catch (e) { return NextResponse.json({ error: (e as Error).message || 'Falha no upload' }, { status: 400 }) }
}
