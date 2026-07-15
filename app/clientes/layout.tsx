import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { prisma } from '@/lib/prisma'

export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role === 'OPERADOR') redirect('/modulos')

  // Gating do módulo: se moduloClientes estiver desligado, sem acesso
  const [ws] = await prisma.$queryRaw`
    SELECT "moduloClientes" FROM "Workspace" WHERE "id" = ${session.user.workspaceId} LIMIT 1
  ` as any[]
  if (!ws?.moduloClientes) redirect('/modulos')

  return <AppShell>{children}</AppShell>
}
