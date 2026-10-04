// Método MAE — estado dos ADD-ONS da conta (Criação de artes MAE, Edição em massa) e se é a conta da
// Naty (publica na Loja). Não exige o add-on (é o que decide se a tela mostra o MAE ou o "em breve").
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addonsDaConta, ehNaty } from '@/lib/mae/servidor/addons'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user.workspaceId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const addons = await addonsDaConta(session.user.workspaceId)
  return NextResponse.json({ addons, ehNaty: ehNaty(session.user.workspaceId) })
}
