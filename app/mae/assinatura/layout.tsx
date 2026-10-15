// Método Mãe — página da ASSINATURA (add-on do SOA ou standalone). Fora da guarda do /estudio: quem ainda não
// assinou precisa chegar aqui. SEM a GuardaAssinatura (lançamento 16/10): a conta com o SOA inativo/cortado chega aqui
// para assinar SÓ o Método Mãe (a tela de regularização /assinatura oferece o caminho). Só ADMIN. A conta standalone também cai aqui (é a "Minha assinatura" dela).
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/AppShell'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login?callbackUrl=/mae/assinatura')
  if (session.user.role !== 'ADMIN') redirect(session.user.soMae ? '/estudio/mae' : '/dashboard')
  return (
    <>
      <AppShell>{children}</AppShell>
    </>
  )
}
