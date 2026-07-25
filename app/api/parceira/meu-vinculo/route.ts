// Vínculo de parceira da ARTESÃ logada — alimenta o botão em /modulos.
// Só leitura, escopado pela sessão (userId). Gate por PARCEIRAS_ATIVO.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { vinculoDaArtesa } from '@/lib/parceiras/sessao'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!parceirasAtivo()) return NextResponse.json({ vinculada: false, ativo: false })
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!session || !userId) return NextResponse.json({ vinculada: false, ativo: true })
  const v = await vinculoDaArtesa(userId)
  return NextResponse.json({ ...v, ativo: true })
}
