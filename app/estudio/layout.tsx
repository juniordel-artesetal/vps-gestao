// SOA Design — guarda do módulo. Quem não tem Workspace.moduloEstudio (ou não é ADMIN)
// não entra: vai para a página de assinatura (/soa-edition). Mesmo shell das demais áreas logadas.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import GuardaAssinatura from '@/components/GuardaAssinatura'
import AppShell from '@/components/AppShell'
import { estudioLiberado } from '@/lib/estudio/modulo'
import { addonsDaConta } from '@/lib/mae/servidor/addons'
import { vendaMaeAtiva } from '@/lib/mae/assinatura/precos'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')
  // Sem o módulo (nunca assinou, inadimplente ou cancelado) → página de assinatura. Dados ficam guardados.
  // Método Mãe (12/10/2026): quem tem o MAE (assinatura add-on/standalone, cortesia, beta) entra no /estudio/mae
  // mesmo sem o SOA Design; com a venda do MAE aberta, quem não tem vai assinar o MAE.
  if (!(await estudioLiberado(session.user.workspaceId)) && !(await addonsDaConta(session.user.workspaceId)).criacao.ativo)
    redirect(vendaMaeAtiva() ? '/mae/assinatura' : '/soa-edition')
  return (
    <>
      <GuardaAssinatura />
      <AppShell>{children}</AppShell>
    </>
  )
}
