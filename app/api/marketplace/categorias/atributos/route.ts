// Atributos de PRODUTO + regras de UMA categoria do TikTok (para o formulário dos Dados do
// Marketplace): o que é obrigatório, a lista de valores aceitos e se a categoria exige tabela de
// medidas/certificação. Confere também se a categoria é FOLHA. Gated + ADMIN.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { marketplacesLiberado } from '@/lib/marketplace/modulo'
import { buscarAtributosCategoria, buscarRegrasCategoria } from '@/lib/tiktok/catalogo'
import { atributosDeProduto, ehObrigatorio, checarRegras, type AtributoTT } from '@/lib/tiktok/regrasProduto'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  if (!(await marketplacesLiberado(workspaceId))) return NextResponse.json({ error: 'Módulo indisponível' }, { status: 404 })
  const categoriaId = String(new URL(req.url).searchParams.get('categoriaId') || '').trim()
  if (!/^\d+$/.test(categoriaId)) return NextResponse.json({ error: 'categoriaId inválido' }, { status: 400 })

  const [a, r] = await Promise.all([buscarAtributosCategoria(workspaceId, categoriaId), buscarRegrasCategoria(workspaceId, categoriaId)])
  if (!a.ok) return NextResponse.json({ ok: false, aviso: a.erro, atributos: [] })
  const atributos = atributosDeProduto((a.atributos ?? []) as AtributoTT[]).map(x => ({
    id: String(x.id), nome: x.name, obrigatorio: ehObrigatorio(x),
    customizavel: !!x.is_customizable, multipla: !!x.is_multiple_selection,
    valores: (x.values ?? []).slice(0, 300).map(v => v.name),
  })).sort((p, q) => Number(q.obrigatorio) - Number(p.obrigatorio))
  return NextResponse.json(serialize({ ok: true, atributos, exigencias: checarRegras(r.regras, true) }))
}
