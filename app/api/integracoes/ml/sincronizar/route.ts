// Sincroniza taxa (Listing Prices) + pedidos do ML da workspace logada.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { refreshTaxasML } from '@/lib/mercadolivre/taxas'
import { sincronizarPedidosML } from '@/lib/mercadolivre/pedidos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  const taxa = await refreshTaxasML(workspaceId)
  const pedidos = await sincronizarPedidosML(workspaceId)

  if (!taxa.ok && !pedidos.ok)
    return NextResponse.json({ error: pedidos.motivo || taxa.motivo || 'Não conectado.' }, { status: 400 })

  return NextResponse.json(serialize({
    ok: true,
    taxasAtualizadas: taxa.atualizou,
    encontrados: pedidos.encontrados,
    importados: pedidos.importados,
    aviso: pedidos.motivo || taxa.motivo || undefined,
  }))
}
