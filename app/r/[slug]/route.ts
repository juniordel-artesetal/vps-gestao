// Link da parceira: usesoa.com.br/r/{slug}.
//
// Seta o cookie httpOnly `soa_ref` (parceiroId + timestamp) por 30 dias e manda a
// visitante para a landing/funil — nunca direto para /register, para ela ver a
// oferta antes. last-click: cada visita sobrescreve o cookie.
//
// Slug inexistente (ou flag OFF) → redireciona à landing SEM cookie e SEM erro:
// um link velho/errado não pode virar página quebrada.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parceirasAtivo, parceiroPorSlug, COOKIE_REF, JANELA_DIAS } from '@/lib/parceiras/atribuicao'

export const dynamic = 'force-dynamic'

const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const destino = new URL('/landing', req.url)
  const res = NextResponse.redirect(destino)

  if (!parceirasAtivo()) return res

  const parceiro = await parceiroPorSlug(slug)
  if (parceiro) {
    res.cookies.set(COOKIE_REF, JSON.stringify({ parceiroId: parceiro.id, via: 'link', ts: Date.now() }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: JANELA_DIAS * 24 * 60 * 60,
    })
    // Clique anônimo (best-effort) — só contagem, sem PII. Nunca bloqueia o redirect.
    try {
      await prisma.$executeRaw`
        INSERT INTO "ParceiroClique" ("id","parceiroId","via","criadoEm")
        VALUES (${novoId()}, ${parceiro.id}, 'link', NOW())
      `
    } catch (e) {
      console.error('[/r] falha ao registrar clique:', e)
    }
    console.log(`[/r] atribuição por link slug=${slug} parceiro=${parceiro.id}`)
  }
  return res
}
