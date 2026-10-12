// Método Mãe — página da ASSINATURA (add-on do SOA ou standalone). Fora da guarda do /estudio: quem ainda não
// assinou precisa chegar aqui. Só ADMIN. A conta standalone também cai aqui (é a "Minha assinatura" dela).
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import GuardaAssinatura from '@/components/GuardaAssinatura'
import AppShell from '@/components/AppShell'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login?callbackUrl=/mae/assinatura')
  if (session.user.role !== 'ADMIN') redirect(session.user.soMae ? '/estudio/mae' : '/dashboard')
  return (
    <>
      <GuardaAssinatura />
      <AppShell>{children}</AppShell>
    </>
  )
}
