// SOA Design — guarda do módulo. Quem não tem Workspace.moduloEstudio (ou não é ADMIN)
// não entra: vai para a página de assinatura (/soa-edition). Mesmo shell das demais áreas logadas.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import GuardaAssinatura from '@/components/GuardaAssinatura'
import AppShell from '@/components/AppShell'
import { estudioLiberado } from '@/lib/estudio/modulo'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')
  // Sem o módulo (nunca assinou, inadimplente ou cancelado) → página de assinatura. Dados ficam guardados.
  if (!(await estudioLiberado(session.user.workspaceId))) redirect('/soa-edition')
  return (
    <>
      <GuardaAssinatura />
      <AppShell>{children}</AppShell>
    </>
  )
}
