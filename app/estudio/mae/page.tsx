// SOA Edition — Método MAE (local-first). Sprint 1: fundações (prancheta em mm, pasta local, fontes locais).
// O layout de /estudio já exige sessão, ADMIN e o módulo SOA Design. Enquanto as sprints andam, só os
// workspaces da lista MAE_BETA_WORKSPACES (env, separados por vírgula; "*" = todos) veem a tela.
// Fora do menu até o beta (Sprint 9).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MaeCliente from '@/components/mae/MaeCliente'

export const metadata = { title: 'Método MAE · SOA' }

export default async function MetodoMae() {
  const session = await getServerSession(authOptions)
  const beta = (process.env.MAE_BETA_WORKSPACES || '').split(',').map(s => s.trim()).filter(Boolean)
  const liberado = !!session && (beta.includes('*') || beta.includes(session.user.workspaceId))
  if (!liberado) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Método MAE</h1>
        <p className="text-sm text-gray-500 mt-2">Em desenvolvimento. Em breve no SOA Edition.</p>
      </div>
    )
  }
  return <MaeCliente />
}
