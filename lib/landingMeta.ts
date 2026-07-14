import type { Metadata } from 'next'

// Fábrica de metadados (SEO + Open Graph) das landings de teste grátis, por prazo.
// Assim /30dias, /15dias e futuras (7 dias etc.) saem consistentes em 1 minuto.
// Troque OG_IMAGEM se criar uma arte dedicada (1200×630).
const OG_IMAGEM = '/prints/dashboard.png'

export function metaTrial(dias: number): Metadata {
  const descricao = `Organize produção, preço, financeiro, clientes e sua loja num sistema só — com inteligência artificial. Experimente o SOA grátis por ${dias} dias. Feito para artesãs e pequenos ateliês.`
  const url = `https://usesoa.com.br/${dias}dias`
  const titulo = `SOA — ${dias} dias grátis para organizar seu ateliê`
  return {
    metadataBase: new URL('https://usesoa.com.br'),
    title: `SOA — Teste grátis por ${dias} dias | Sistema de Organização de Ateliês`,
    description: descricao,
    alternates: { canonical: `/${dias}dias` },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url,
      siteName: 'SOA — Sistema de Organização de Ateliês',
      locale: 'pt_BR',
      title: titulo,
      description: descricao,
      images: [{ url: OG_IMAGEM, width: 1200, height: 630, alt: 'SOA — Sistema de Organização de Ateliês' }],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descricao, images: [OG_IMAGEM] },
  }
}
