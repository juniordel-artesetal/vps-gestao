import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { criarCheckout, type MetodoPagamento } from '@/lib/assinatura/checkout'
import { ehPlanoValido } from '@/lib/assinatura/planos'
import { cpfValido, limparCpf } from '@/lib/assinatura/cpf'
import { identificarAssinante } from '@/lib/assinatura/identidadeSemLogin'

export const dynamic = 'force-dynamic'

// POST — gera (ou REgera) o link de checkout. body: { plano, metodo, cpf?, e?, t? }
//
// Existe porque o link do Asaas morre em 24h: quem abandonou e voltou precisa de
// um novo, e ela não deve depender de suporte para isso. O CPF só é pedido de
// novo se ainda não tivermos um checkout anterior — o Asaas já o guardou.
// Identifica pela SESSÃO ou pelo TOKEN do link de reativação (?e=&t=).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const who = await identificarAssinante({ email: b.e, token: b.t })
  if (!who) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = who.workspaceId

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

  // Quem já está em dia não precisa de checkout — evita cobrar duas vezes (idempotência).
  if (['TRIAL', 'ATIVA'].includes(ws.assinaturaStatus)) {
    return NextResponse.json({ error: 'Sua assinatura já está ativa.' }, { status: 409 })
  }

  const r = await criarCheckout({
    workspaceId, plano: b.plano, metodo, forma,
    nome: ws.nome, cpf, email: who.email,
    baseUrl: new URL(req.url).origin,
  })

  return r.ok
    ? NextResponse.json(serialize({ ok: true, link: r.link, checkoutId: r.checkoutId }))
    : NextResponse.json({ error: r.erro }, { status: 502 })
}
