// Vincular e publicar produto no TikTok (item C). Valida os obrigatórios ANTES de enviar.
// Idempotente (UPDATE do mesmo anúncio via vínculo). ⚠️ A chamada de escrita ainda não foi
// exercitada contra a API real — validar na loja de dev. Gated + ADMIN.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { marketplacesLiberado } from '@/lib/marketplace/modulo'
import { lerCampos, validarCamposObrigatorios, fotosMarketplace } from '@/lib/marketplace/produtoCampos'
import { publicarProduto, type VariacaoPublicar } from '@/lib/tiktok/catalogo'
import { normalizarCanal } from '@/lib/canaisVendaCalc'

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

  const [prod] = await prisma.$queryRaw`
    SELECT "nome", "sku" FROM "PrecProduto" WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as { nome: string; sku: string | null }[]
  if (!prod) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const campos = await lerCampos(workspaceId, produtoId)
  const val = validarCamposObrigatorios(campos)
  if (!val.ok) return NextResponse.json({ error: 'Faltam campos obrigatórios: ' + val.faltando.join(', '), faltando: val.faltando }, { status: 400 })

  // SKUs = variações do canal TikTok, cada uma com o preço da precificação daquele canal.
  const vars = await prisma.$queryRaw`
    SELECT "id", "canal", "subOpcao", "tipo", "precoVenda"::float AS preco FROM "PrecVariacao" WHERE "produtoId" = ${produtoId}
  ` as { id: string; canal: string | null; subOpcao: string | null; tipo: string; preco: number }[]
  const varsTikTok = vars.filter(v => normalizarCanal(v.canal || '') === 'tiktokshop')
  if (varsTikTok.length === 0) return NextResponse.json({ error: 'Marque o canal TikTok em pelo menos uma variação (o preço vem da precificação).' }, { status: 400 })
  const variacoes: VariacaoPublicar[] = varsTikTok.map(v => ({ sku: prod.sku, preco: v.preco || 0, nome: v.subOpcao || v.tipo || null }))

  // Imagens = FOTOS DA VARIAÇÃO (LojaImagem, fonte única; sem exigir vitrine). Sem foto → aviso.
  const fotos = await fotosMarketplace(workspaceId, produtoId, varsTikTok.map(v => v.id))
  if (fotos.length === 0) return NextResponse.json({ error: 'Adicione fotos à variação para publicar no marketplace.', faltando: ['fotos da variação'] }, { status: 400 })

  const r = await publicarProduto(workspaceId, produtoId, prod.nome, { ...campos, imagens: fotos }, variacoes, { rascunho })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao publicar no TikTok.' }, { status: 502 })
  return NextResponse.json({ ok: true, status: r.status, produtoExternoId: r.produtoExternoId })
}
