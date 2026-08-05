import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { baseUrlDeHeaders } from '@/lib/baseUrl'

// Metadados Open Graph — pra o link do orçamento virar um CARD bonito no WhatsApp/redes
// (título do orçamento + ateliê, chamada e imagem), em vez da URL crua.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const h = await headers()
  const base = baseUrlDeHeaders(h)

  let titulo = 'Seu orçamento'
  let atelie = 'SOA'
  try {
    const [orc] = await prisma.$queryRaw`
      SELECT o."titulo", o."numero", w."nome" AS "atelie"
      FROM "Orcamento" o
      JOIN "Workspace" w ON w."id" = o."workspaceId"
      WHERE o."tokenAprovacao" = ${token}
    ` as any[]
    if (orc) {
      titulo = (orc.titulo && String(orc.titulo).trim()) || `Orçamento ${orc.numero || ''}`.trim()
      atelie = (orc.atelie && String(orc.atelie).trim()) || 'SOA'
    }
  } catch { /* metadados são best-effort; a página abre normal mesmo sem eles */ }

  const title = `${titulo} · ${atelie}`
  const description = 'Seu orçamento está pronto — clique para ver os detalhes 💛'
  const image = `${base}/orcamento/${token}/og`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: atelie,
      url: `${base}/orcamento/${token}`,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: false, follow: false },
  }
}

export default function OrcamentoLayout({ children }: { children: React.ReactNode }) {
  return children
}
