// Método MAE — ASSINATURA (add-on do SOA ou standalone). GET: preços da config, plano da conta, tabela do anual
// (1–12×), economia, estado da assinatura e do acesso. POST { ciclo, parcelas }: abre o checkout do Asaas (só
// ADMIN; sem cobrança dupla). Com a venda fechada (MAE_VENDA_ATIVO ≠ on ou preço faltando) tudo responde "em breve".
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { precosMae, vendaMaeAtiva, tabelaAnualMae, economiaAnual, TRIAL_DIAS_MAE, hojeSP, acessoMae } from '@/lib/mae/assinatura/precos'
import { estadoMaeDaConta, assinaturaMaeDaConta, criarCheckoutMae } from '@/lib/mae/assinatura/servidor'
import { addonsDaConta } from '@/lib/mae/servidor/addons'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const ws = session?.user.workspaceId
  if (!ws) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  try {
    const [estado, assinatura, addons] = await Promise.all([estadoMaeDaConta(ws), assinaturaMaeDaConta(ws), addonsDaConta(ws)])
    const plano = estado.plano === 'standalone' ? 'standalone' : 'addon'
    const p = precosMae()
    return NextResponse.json({
      venda: vendaMaeAtiva(), plano, trialDias: TRIAL_DIAS_MAE,
      precos: p ? p[plano] : null,
      parcelamentoAnual: p ? tabelaAnualMae(p, plano) : [],
      economiaAnual: p ? economiaAnual(p, plano) : null,
      assinatura: assinatura ? { status: assinatura.status, ciclo: assinatura.ciclo, parcelas: assinatura.parcelas, valor: assinatura.valor, trialAte: assinatura.trialAte, proximoVencimento: assinatura.proximoVencimento, trialUsado: assinatura.trialUsado, checkoutAberto: !!assinatura.checkoutLink } : null,
      acesso: { liberado: addons.criacao.ativo, origem: addons.criacao.origem, ate: acessoMae(estado, hojeSP()) === 'asaas' ? estado.ate : null },
      admin: session.user.role === 'ADMIN',
    })
  } catch (e) {
    console.error('[MAE ASSINATURA GET]', e)
    return NextResponse.json({ error: 'Erro ao ler a assinatura' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const ws = session?.user.workspaceId
  if (!ws) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Só a administradora da conta assina o Método Mãe' }, { status: 403 })
  const b = await req.json().catch(() => ({})) as { ciclo?: unknown; parcelas?: unknown }
  const ciclo = b.ciclo === 'anual' ? 'anual' : b.ciclo === 'mensal' ? 'mensal' : null
  if (!ciclo) return NextResponse.json({ error: 'Escolha mensal ou anual' }, { status: 400 })
  try {
    const r = await criarCheckoutMae({ workspaceId: ws, ciclo, parcelas: Number(b.parcelas) || 1, baseUrl: new URL(req.url).origin })
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.erro }, { status: r.status })
  } catch (e) {
    console.error('[MAE ASSINATURA POST]', e)
    return NextResponse.json({ error: 'Erro ao abrir o pagamento' }, { status: 500 })
  }
}
