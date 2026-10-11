// Método MAE — pedidos do MAE AVULSO (Lote 7, itens 120/121): cadastro manual rápido e a importação da planilha
// da Shopee. POST { pedidos: [...] } (origem 'manual' | 'shopee'). Pedido com o mesmo nº (mesma origem) não se
// repete. Só no plano "só MAE" — no SOA completo os pedidos vêm do próprio SOA.
import { NextResponse } from 'next/server'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'
import { planoMae } from '@/lib/mae/servidor/plano'
import { criarPedidosMae, sanearNovoPedido, type NovoPedidoMae } from '@/lib/mae/servidor/fontes'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const c = await contaMae({ addon: 'massa' }); if (c instanceof NextResponse) return c
  if ((await planoMae(c.workspaceId)) !== 'mae') return NextResponse.json({ error: 'Os pedidos desta conta vêm do SOA' }, { status: 400 })
  let lista: NovoPedidoMae[], invalidos = 0
  try {
    const b = await lerJson(req, 3_000_000) as { pedidos?: unknown }
    const brutos = (Array.isArray(b.pedidos) ? b.pedidos : []).slice(0, 1000)
    lista = brutos.map(p => sanearNovoPedido(p as Partial<NovoPedidoMae>)).filter((p): p is NovoPedidoMae => !!p)
    invalidos = brutos.length - lista.length
    if (!lista.length) return NextResponse.json({ error: 'Nenhum pedido válido (falta o nº ou o produto)' }, { status: 400 })
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    const r = await criarPedidosMae(c.workspaceId, lista)
    return NextResponse.json({ ok: true, ...r, invalidos })
  } catch (e) {
    console.error('[MAE PEDIDOS MANUAL]', e)
    return NextResponse.json({ error: 'Erro ao gravar os pedidos' }, { status: 500 })
  }
}
