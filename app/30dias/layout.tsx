import type { Metadata } from 'next'

// SEO + Open Graph da landing evergreen /30dias (bonita quando colam nos Stories/WhatsApp).
// Rota pública e indexável. Imagem de preview: troque em `OG_IMAGEM` se criar uma arte dedicada.
const OG_IMAGEM = '/prints/dashboard.png'
const DESCRICAO = 'Organize produção, preço, financeiro, clientes e sua loja num sistema só — com inteligência artificial. Experimente o SOA grátis por 30 dias. Feito para artesãs e pequenos ateliês.'

export const metadata: Metadata = {
  metadataBase: new URL('https://usesoa.com.br'),
  title: 'SOA — Teste grátis por 30 dias | Sistema de Organização de Ateliês',
  description: DESCRICAO,
  alternates: { canonical: '/30dias' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: 'https://usesoa.com.br/30dias',
    siteName: 'SOA — Sistema de Organização de Ateliês',
    locale: 'pt_BR',
    title: 'SOA — 30 dias grátis para organizar seu ateliê',
    description: DESCRICAO,
    images: [{ url: OG_IMAGEM, width: 1200, height: 630, alt: 'SOA — Sistema de Organização de Ateliês' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SOA — 30 dias grátis para organizar seu ateliê',
    description: DESCRICAO,
    images: [OG_IMAGEM],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
