// Sincroniza estoque SOA → TikTok (Inventory). Fonte da verdade = SOA. As quantidades vêm no
// corpo (o botão/caller informa por SKU) — o auto-hook ao módulo de Estoque do SOA é o próximo
// passo. Idempotente. ⚠️ Chamada de escrita não exercitada na API real — validar na loja de dev.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { marketplacesLiberado } from '@/lib/marketplace/modulo'
import { sincronizarEstoque } from '@/lib/tiktok/catalogo'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId
  if (!(await marketplacesLiberado(workspaceId))) return NextResponse.json({ error: 'Módulo indisponível' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const produtoId = String(body?.produtoId ?? '')
  const skus = Array.isArray(body?.skus) ? body.skus.filter((s: any) => s?.sku && s?.quantidade != null) : []
  if (!produtoId || skus.length === 0) return NextResponse.json({ error: 'Informe produtoId e skus [{sku, quantidade}].' }, { status: 400 })

  const r = await sincronizarEstoque(workspaceId, produtoId, skus)
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao sincronizar estoque.' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
