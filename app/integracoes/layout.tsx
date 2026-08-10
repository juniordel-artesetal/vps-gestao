import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'

export default async function IntegracoesLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/modulos')

  // Gating: só com moduloLojas ligado
  const [ws] = await prisma.$queryRaw`
    SELECT COALESCE("moduloLojas", false) AS "moduloLojas" FROM "Workspace" WHERE "id" = ${session.user.workspaceId} LIMIT 1
  ` as any[]
  if (!ws?.moduloLojas) redirect('/modulos')

  return <AppShell>{children}</AppShell>
}
