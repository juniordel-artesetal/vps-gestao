// Método MAE — acesso às rotas /api/mae/*: sessão do SOA + workspace no beta (MAE_BETA_WORKSPACES, como
// a página). "Conta" da spec = workspaceId. As rotas só guardam RECEITAS (JSON), nunca arte.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addonsDaConta, noBeta, type Addon } from './addons'

export const maeLiberado = (workspaceId: string) => noBeta(workspaceId)

/**
 * workspaceId da sessão, ou a resposta de erro (401/403). Sprint 12: liberado = beta OU add-on
 * "Criação de artes MAE" (e, quando pedido, também o "Edição em massa").
 */
export async function contaMae(o: { addon?: Addon } = {}): Promise<{ workspaceId: string; userId: string } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Sem conta' }, { status: 403 })
  const ad = await addonsDaConta(workspaceId)
  if (!ad.criacao.ativo) return NextResponse.json({ error: 'Método MAE não liberado para esta conta' }, { status: 403 })
  if (o.addon && !ad[o.addon].ativo) return NextResponse.json({ error: 'Add-on "Edição em massa" não liberado', addon: o.addon }, { status: 403 })
  return { workspaceId, userId: session.user.id }
}

/** Corpo JSON com limite (receitas são pequenas; 5 MB é folga de sobra). */
export async function lerJson(req: Request, limite = 5_000_000): Promise<unknown> {
  const txt = await req.text()
  if (txt.length > limite) throw new Error('Receita grande demais')
  return JSON.parse(txt)
}
