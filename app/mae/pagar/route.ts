// usesoa.com.br/mae/pagar — o PREÇO clicado na página de vendas vai DIRETO para a página de pagamento do Asaas.
//   ?o=soa-mae | so-mae | anual-soa   ·   &ciclo=mensal|anual   ·   &parcelas=1..12 (anual)
// Sem sessão: só-MAE → cadastro (e volta para cá depois); SOA + MAE e troca para o anual → login (e volta para cá).
// Com sessão: abre o checkout certo (o mesmo das telas: sem cobrança dupla, link reaproveitado) e redireciona.
// Qualquer coisa fora do esperado (venda ainda fechada, plano da conta diferente do clicado, assinatura já ativa)
// leva para a tela da assinatura, que explica.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { criarCheckoutMae, planoDeVenda } from '@/lib/mae/assinatura/servidor'
import { criarCheckoutMigracao } from '@/lib/assinatura/migracaoAnual'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const o = url.searchParams.get('o')
  const ciclo = url.searchParams.get('ciclo') === 'anual' ? 'anual' : 'mensal'
  const parcelas = Math.max(1, Math.min(12, Math.floor(Number(url.searchParams.get('parcelas')) || 1)))
  const aqui = `/mae/pagar?o=${encodeURIComponent(o ?? '')}&ciclo=${ciclo}&parcelas=${parcelas}`
  const ir = (p: string) => NextResponse.redirect(p.startsWith('http') ? p : new URL(p, url.origin))
  const tela = o === 'anual-soa' ? '/assinatura/migrar-anual' : `/mae/assinatura?ciclo=${ciclo}`
  if (o !== 'soa-mae' && o !== 'so-mae' && o !== 'anual-soa') return ir('/mae#planos')

  const session = await getServerSession(authOptions)
  const ws = session?.user.workspaceId
  if (!ws) return ir(o === 'so-mae' ? `/mae/cadastro?depois=${encodeURIComponent(aqui)}` : `/login?callbackUrl=${encodeURIComponent(aqui)}`)
  if (session.user.role !== 'ADMIN') return ir(tela)
  try {
    if (o === 'anual-soa') {
      const r = await criarCheckoutMigracao({ workspaceId: ws, parcelas, baseUrl: url.origin })
      return ir(r.ok ? r.link : tela)
    }
    // o plano é o da CONTA (SOA ativo → SOA + MAE; sem SOA ativo → só o MAE): clicou no outro, a tela explica
    const plano = await planoDeVenda(ws)
    if ((o === 'so-mae') !== (plano === 'standalone')) return ir(tela)
    const r = await criarCheckoutMae({ workspaceId: ws, ciclo, parcelas: ciclo === 'anual' ? parcelas : 1, baseUrl: url.origin })
    return ir(r.ok ? r.link : tela)
  } catch (e) {
    console.error('[MAE PAGAR]', e)
    return ir(tela)
  }
}
