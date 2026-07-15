// Casca autenticada (server): lê a posição do menu da usuária NO BANCO e injeta como
// posição inicial no AppShellClient — assim o layout já nasce na posição certa, sem flash.
// Substitui o antigo par `<div className="flex ..."><Sidebar/><main/></div>` dos layouts.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMenuPos } from '@/lib/sofia/menuPos'
import AppShellClient from './AppShellClient'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const pos = session?.user?.id ? await getMenuPos(session.user.id) : 'left'
  return <AppShellClient posInicial={pos}>{children}</AppShellClient>
}
