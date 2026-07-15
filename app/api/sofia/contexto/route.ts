import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMenuPos } from '@/lib/sofia/menuPos'
import { menuPosLabel, ehHorizontal } from '@/lib/sofia/menuPosTipos'

export const dynamic = 'force-dynamic'

// Contexto de layout para a Sofia (e para tours/dicas): posição real do menu da usuária.
// Assim a orientação cita a posição correta ("no menu à esquerda/direita/em cima/embaixo").
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const menuPosicao = await getMenuPos(session.user.id)
  return NextResponse.json({
    menuPosicao,
    menuLabel: menuPosLabel(menuPosicao),
    menuHorizontal: ehHorizontal(menuPosicao),
  })
}
