import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { criarCheckout, type MetodoPagamento } from '@/lib/assinatura/checkout'
import { ehPlanoValido } from '@/lib/assinatura/planos'
import { cpfValido, limparCpf } from '@/lib/assinatura/cpf'

export const dynamic = 'force-dynamic'

// POST — gera (ou REgera) o link de checkout. body: { plano, metodo, cpf? }
//
// Existe porque o link do Asaas morre em 24h: quem abandonou e voltou precisa de
// um novo, e ela não deve depender de suporte para isso. O CPF só é pedido de
// novo se ainda não tivermos um checkout anterior — o Asaas já o guardou.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const b = await req.json().catch(() => ({}))

  if (!ehPlanoValido(b.plano)) return NextResponse.json({ error: 'Escolha um plano válido.' }, { status: 400 })
  const metodo: MetodoPagamento = b.metodo === 'pix' ? 'pix' : 'cartao'
  const forma = b.forma === 'parcelado' ? 'parcelado' as const : 'avista' as const

  // CPF é OPCIONAL aqui: quem o coleta é a página do Asaas (ver checkout.ts).
  // Se vier, validamos por gentileza — errar o CPF lá é uma ida e volta a mais.
  const cpf = limparCpf(b.cpf)
  if (cpf && !cpfValido(cpf)) {
    return NextResponse.json({ error: 'Confira o CPF — os números não conferem.' }, { status: 400 })
  }

  const [ws] = await prisma.$queryRaw`
    SELECT "nome", "assinaturaStatus" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { nome: string; assinaturaStatus: string }[]
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })

  // Quem já está em dia não precisa de checkout — evita cobrar duas vezes.
  if (['TRIAL', 'ATIVA'].includes(ws.assinaturaStatus)) {
    return NextResponse.json({ error: 'Sua assinatura já está ativa.' }, { status: 409 })
  }

  const r = await criarCheckout({
    workspaceId, plano: b.plano, metodo, forma,
    nome: ws.nome, cpf, email: session.user.email ?? '',
    baseUrl: new URL(req.url).origin,
  })

  return r.ok
    ? NextResponse.json(serialize({ ok: true, link: r.link, checkoutId: r.checkoutId }))
    : NextResponse.json({ error: r.erro }, { status: 502 })
}
