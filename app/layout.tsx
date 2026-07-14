import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper'
import { ThemeLoader } from '@/components/ThemeLoader'
import { MetaPixel } from '@/components/MetaPixel'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import SofiaWidget from '@/components/SofiaWidget'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SOA — Sistema de Organização de Ateliês',
  description: 'Sistema ERP para ateliês e pequenos negócios',
}

// Força leitura fresca do cookie de tema a cada navegação (sem cache estático)
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Lê preferência de dark mode do cookie (server-side — sem flash, sem script)
  const cookieStore = await cookies()
  const darkMode = cookieStore.get('dark-mode')?.value === 'true'

  return (
    <html lang="pt-BR" className={darkMode ? 'dark' : ''} suppressHydrationWarning>
      <body className={geist.className}>
        <MetaPixel />
        <SessionProviderWrapper>
          <ThemeLoader />
          <ImpersonationBanner />
          {children}
          <SofiaWidget />
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
