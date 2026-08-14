// GATE do módulo Pessoal. Envolve só as páginas DENTRO do grupo (protegido) — a página
// de ativação (/pessoal/ativar) fica FORA deste grupo, então não entra em loop de redirect.
// Sem assinatura ATIVA (ou INADIMPLENTE dentro da carência) → manda pra /pessoal/ativar.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assinaturaAtiva } from '@/lib/pessoal/assinatura'

export default async function PessoalProtegidoLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!(await assinaturaAtiva(session.user.id))) redirect('/pessoal/ativar')
  return <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">{children}</div>
}
