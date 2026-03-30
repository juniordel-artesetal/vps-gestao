import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper'
import { ThemeLoader } from '@/components/ThemeLoader'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VPS Gestão',
  description: 'Sistema ERP para ateliês e pequenos negócios',
}

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
        <SessionProviderWrapper>
          <ThemeLoader />
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
