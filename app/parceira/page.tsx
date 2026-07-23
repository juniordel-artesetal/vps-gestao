// Painel da parceira — STUB da Parte D (o painel completo é a Parte F).
// O acesso é garantido pelo middleware (role='parceira' + PARCEIRAS_ATIVO on).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ParceiraHome() {
  const session = await getServerSession(authOptions)
  // Cinturão + suspensório: o middleware já barra, mas a página não confia nisso.
  if (!session || (session.user as any).role !== 'parceira') redirect('/login')

  const nome = (session.user.name || '').split(' ')[0] || 'parceira'
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-4xl mb-3">💛</p>
        <h1 className="text-xl font-semibold">Oi, {nome}!</h1>
        <p className="mt-2 text-gray-400 text-sm">Seu painel de parceria está a caminho.</p>
      </div>
    </div>
  )
}
