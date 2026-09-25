// Templates Especiais — fora da guarda do /estudio: quem não assina precisa ver o acervo (com cadeado)
// e conseguir assinar. Só ADMIN.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import GuardaAssinatura from '@/components/GuardaAssinatura'
import AppShell from '@/components/AppShell'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')
  return (
    <>
      <GuardaAssinatura />
      <AppShell>{children}</AppShell>
    </>
  )
}
