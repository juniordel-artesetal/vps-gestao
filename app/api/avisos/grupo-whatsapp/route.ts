// Pop-up do GRUPO DE SUPORTE das assinantes do SOA: diz se esta conta deve ver o convite (assinante ativa do SOA) e
// devolve o link do grupo. Quem decide é o servidor; o "já vi" fica no navegador.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ehAssinanteAtivaSoa, linkGrupoWhatsapp } from '@/lib/avisos/grupoWhatsapp'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ mostrar: false }, { status: 401 })
  try {
    const [w] = await prisma.$queryRaw<{ ativo: boolean; assinaturaStatus: string | null; liberacaoManual: boolean }[]>`
      SELECT "ativo","assinaturaStatus","liberacaoManual" FROM "Workspace" WHERE "id" = ${session.user.workspaceId} LIMIT 1`
    const mostrar = !!w && ehAssinanteAtivaSoa({ ...w, soMae: !!(session.user as { soMae?: boolean }).soMae })
    return NextResponse.json({ mostrar, link: mostrar ? linkGrupoWhatsapp() : null })
  } catch (e) {
    console.error('[AVISOS/grupo-whatsapp]', (e as Error).message)
    return NextResponse.json({ mostrar: false })
  }
}
