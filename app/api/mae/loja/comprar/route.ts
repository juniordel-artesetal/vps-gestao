// Método MAE — COMPRAR um pack/preset da Loja da Naty pelo checkout do SOA (Asaas, cobrança avulsa:
// Pix ou cartão na fatura hospedada). Grátis → libera na hora. Pago → devolve o link da fatura; a compra
// só é gravada quando o WEBHOOK confirma o pagamento (lib/mae/servidor/addons → aplicarEventoMae).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { limparCpf, cpfValido } from '@/lib/assinatura/cpf'
import { customerExistente } from '@/lib/estudio/compra'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'
import { MARCA_MAE } from '@/lib/mae/servidor/addons'

const Pedido = z.object({ tipo: z.enum(['pack', 'preset']), id: z.string().min(1).max(64), cpf: z.string().max(20).optional() })
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

export async function POST(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let b
  try {
    const r = Pedido.safeParse(await lerJson(req, 5_000))
    if (!r.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
    b = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    // item publicado + preço (centavos); null/0 = grátis
    let nome = '', preco: number | null = null
    if (b.tipo === 'pack') {
      const [p] = await prisma.$queryRaw<{ nome: string; preco: number | null }[]>`
        SELECT nome, (doc -> 'loja' ->> 'precoCentavos')::int AS preco FROM mae_themes
        WHERE workspace_id = 'naty' AND publicado AND id = ${b.id} ORDER BY version DESC LIMIT 1`
      if (!p) return NextResponse.json({ error: 'Pack não encontrado' }, { status: 404 })
      nome = p.nome; preco = p.preco
    } else {
      const [p] = await prisma.$queryRaw<{ nome: string; preco: number | null; gratis: boolean }[]>`
        SELECT nome, preco_centavos AS preco, gratis FROM mae_effect_presets WHERE workspace_id = 'naty' AND publicado AND id = ${b.id} LIMIT 1`
      if (!p) return NextResponse.json({ error: 'Preset não encontrado' }, { status: 404 })
      nome = p.nome; preco = p.gratis ? null : p.preco
    }
    const [ja] = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM mae_purchases WHERE workspace_id = ${c.workspaceId} AND item_tipo = ${b.tipo} AND item_id = ${b.id} LIMIT 1`
    if (ja) return NextResponse.json({ ok: true, liberado: true })
    if (!preco || preco <= 0) {
      await prisma.$executeRaw`INSERT INTO mae_purchases (id, workspace_id, item_tipo, item_id) VALUES (${'gratis_' + gid()}, ${c.workspaceId}, ${b.tipo}, ${b.id})`
      return NextResponse.json({ ok: true, liberado: true })
    }
    // pago: cobrança avulsa no Asaas
    let customer = await customerExistente(c.workspaceId, c.userId)
    if (!customer) {
      const cpf = limparCpf(b.cpf || '')
      if (!cpf || !cpfValido(cpf)) return NextResponse.json({ error: 'Informe um CPF válido para gerar a cobrança.', precisaCpf: true }, { status: 400 })
      const [u] = await prisma.$queryRaw<{ nome: string | null; email: string | null }[]>`
        SELECT COALESCE(w."nomeProprietaria", u."nome") AS nome, LOWER(u."email") AS email FROM "User" u JOIN "Workspace" w ON w."id" = u."workspaceId"
        WHERE u."id" = ${c.userId} AND u."workspaceId" = ${c.workspaceId} LIMIT 1`
      const r = await chamarAsaas<{ id: string }>('/customers', { metodo: 'POST', corpo: { name: u?.nome || 'Cliente SOA', cpfCnpj: cpf, email: u?.email || undefined, externalReference: `${MARCA_MAE}${c.workspaceId}` } })
      if (!r.ok || !r.dados?.id) return NextResponse.json({ error: r.erro || 'Falha ao criar o cliente no Asaas.' }, { status: 502 })
      customer = r.dados.id
    }
    const compraId = gid()
    const p = await chamarAsaas<{ id: string; invoiceUrl?: string }>('/payments', {
      metodo: 'POST',
      corpo: { customer, billingType: 'UNDEFINED', value: Math.round(preco) / 100, dueDate: hojeISO(), description: `Loja da Naty — ${b.tipo === 'pack' ? 'pack' : 'preset'} "${nome}"`, externalReference: `${MARCA_MAE}${c.workspaceId}:${b.tipo}:${b.id}:${compraId}` },
    })
    if (!p.ok || !p.dados?.id) return NextResponse.json({ error: p.erro || 'Falha ao gerar a cobrança.' }, { status: 502 })
    return NextResponse.json({ ok: true, liberado: false, invoiceUrl: p.dados.invoiceUrl ?? null })
  } catch (e) {
    console.error('[MAE LOJA COMPRAR]', e)
    return NextResponse.json({ error: 'Erro ao comprar' }, { status: 500 })
  }
}
