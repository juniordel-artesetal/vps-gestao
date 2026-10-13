// Versão publicada (Lote 10, item 161): o editor do MAE compara com a dele e avisa "Saiu uma versão nova".
// Público e sem dados: só o identificador do deploy.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const versao = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'local'
  return NextResponse.json({ versao }, { headers: { 'Cache-Control': 'no-store' } })
}
