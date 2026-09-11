// Sincroniza pedidos do TikTok da workspace logada (só leitura). Gated por INTEGRACOES_ATIVO.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { integracoesAtivo } from '@/lib/tiktok/conta'
import { sincronizarPedidosTikTok } from '@/lib/tiktok/pedidos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  if (!integracoesAtivo())
    return NextResponse.json({ error: 'Integração indisponível.' }, { status: 404 })
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const r = await sincronizarPedidosTikTok(session.user.workspaceId)
  if (!r.ok) return NextResponse.json({ error: r.motivo || 'Não conectado.' }, { status: 400 })
  return NextResponse.json(serialize({ ok: true, encontrados: r.encontrados, importados: r.importados }))
}
