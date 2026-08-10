import { NextRequest, NextResponse } from 'next/server'
import { registrarCliqueOferta } from '@/lib/parceiros/distribuidores'

export const dynamic = 'force-dynamic'

// GET ?id= — conta o clique na oferta e redireciona pro link de compra do parceiro.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  const origin = new URL(req.url).origin
  if (!id) return NextResponse.redirect(origin)
  const link = await registrarCliqueOferta(id)
  return NextResponse.redirect(link && /^https?:\/\//.test(link) ? link : origin + '/precificacao/materiais')
}
