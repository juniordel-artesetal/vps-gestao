import { metaTrial } from '@/lib/landingMeta'

// SEO + Open Graph da landing /15dias (fábrica compartilhada por prazo).
export const metadata = metaTrial(15)

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
