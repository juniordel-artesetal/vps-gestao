// Vincular e publicar produto no TikTok (item C). Valida os obrigatórios ANTES de enviar.
// Idempotente (UPDATE do mesmo anúncio via vínculo). Antes de enviar, confere na API do TikTok a
// categoria folha, os atributos obrigatórios e as regras da categoria. Gated + ADMIN.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { marketplacesLiberado } from '@/lib/marketplace/modulo'
import { lerCampos, validarCamposObrigatorios } from '@/lib/marketplace/produtoCampos'
import { publicarProduto } from '@/lib/tiktok/catalogo'
import { dadosParaPublicarTikTok } from '@/lib/marketplace/variacoesTikTok'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  if (!(await marketplacesLiberado(workspaceId))) return NextResponse.json({ error: 'Módulo indisponível' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const produtoId = String(body?.produtoId ?? '')
  const rascunho = body?.rascunho !== false // default: rascunho (revisar no TikTok antes de ir ao ar)
  if (!produtoId) return NextResponse.json({ error: 'produtoId obrigatório' }, { status: 400 })

  const campos = await lerCampos(workspaceId, produtoId)
  const val = validarCamposObrigatorios(campos)
  if (!val.ok) return NextResponse.json({ error: 'Faltam campos obrigatórios: ' + val.faltando.join(', '), faltando: val.faltando }, { status: 400 })

  // SKUs = variações do canal TikTok (preço da precificação + estoque) e as fotos da variação.
  const dados = await dadosParaPublicarTikTok(workspaceId, produtoId, campos)
  if (!dados.ok) return NextResponse.json({ error: dados.erro, faltando: dados.faltando }, { status: 400 })

  // A publicação confere categoria FOLHA, atributos obrigatórios e regras da categoria na API do TikTok.
  const r = await publicarProduto(workspaceId, produtoId, dados.nome, { ...campos, imagens: dados.fotos }, dados.variacoes, dados.skuBase, { rascunho })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao publicar no TikTok.' }, { status: 502 })
  return NextResponse.json({ ok: true, status: r.status, produtoExternoId: r.produtoExternoId, avisos: r.avisos ?? [] })
}
