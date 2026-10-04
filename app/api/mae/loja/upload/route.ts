// Método MAE — token de upload DIRETO do navegador para o Vercel Blob, só para a Naty publicar os
// arquivos dos packs (pasta mae-loja/). Arte de aluna nunca sobe.
import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { contaMae } from '@/lib/mae/servidor/acesso'
import { ehNaty } from '@/lib/mae/servidor/addons'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: 'Armazenamento de arquivos não configurado' }, { status: 503 })
  const body = (await req.json()) as HandleUploadBody
  try {
    const r = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async pathname => {
        const c = await contaMae()
        if (c instanceof NextResponse || !ehNaty(c.workspaceId)) throw new Error('Só a Naty publica na Loja')
        if (!pathname.startsWith('mae-loja/')) throw new Error('Caminho inválido')
        return { allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'], maximumSizeInBytes: 25 * 1024 * 1024, addRandomSuffix: true }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
