import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VPS Gestão',
  description: 'Sistema ERP para ateliês e pequenos negócios',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={geist.className}>
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  )
}