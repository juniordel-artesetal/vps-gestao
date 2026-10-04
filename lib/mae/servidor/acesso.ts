// Método MAE — acesso às rotas /api/mae/*: sessão do SOA + workspace no beta (MAE_BETA_WORKSPACES, como
// a página). "Conta" da spec = workspaceId. As rotas só guardam RECEITAS (JSON), nunca arte.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const maeLiberado = (workspaceId: string) => {
  const beta = (process.env.MAE_BETA_WORKSPACES || '').split(',').map(s => s.trim()).filter(Boolean)
  return beta.includes('*') || beta.includes(workspaceId)
}

/** workspaceId da sessão, ou a resposta de erro (401/403). */
export async function contaMae(): Promise<{ workspaceId: string } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId
  if (!workspaceId || !maeLiberado(workspaceId)) return NextResponse.json({ error: 'Método MAE não liberado para esta conta' }, { status: 403 })
  return { workspaceId }
}

/** Corpo JSON com limite (receitas são pequenas; 5 MB é folga de sobra). */
export async function lerJson(req: Request, limite = 5_000_000): Promise<unknown> {
  const txt = await req.text()
  if (txt.length > limite) throw new Error('Receita grande demais')
  return JSON.parse(txt)
}
