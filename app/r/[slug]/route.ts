import { NextRequest, NextResponse } from 'next/server'
import { parceiroPorSlug } from '@/lib/parceiros'

export const dynamic = 'force-dynamic'

// GET /r/[slug] — LINK RASTREÁVEL. Grava a atribuição em cookie e leva ao cadastro.
// Se o slug não existe, ainda leva ao registro (sem atribuição).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const origin = new URL(req.url).origin
  const parceiro = await parceiroPorSlug(slug)

  const dest = new URL('/register', origin)
  if (parceiro) dest.searchParams.set('ref', parceiro.linkSlug || slug)

  const res = NextResponse.redirect(dest)
  if (parceiro) {
    // Cookie de atribuição (30 dias) — lido no cadastro.
    res.cookies.set('ref_parceiro', parceiro.linkSlug || slug, {
      httpOnly: false, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60,
    })
  }
  return res
}
