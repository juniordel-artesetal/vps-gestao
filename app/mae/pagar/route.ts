// usesoa.com.br/mae/pagar — o PREÇO clicado na página de vendas vai DIRETO para a página de pagamento do Asaas.
//   ?o=soa-mae | so-mae | anual-soa | alunas (Plano Alunas VPS, 16/10/2026: preço próprio, até 31/10)   ·   &ciclo=mensal|anual   ·   &parcelas=1..12 (anual)   ·   &metodo=pix (mensal no Pix Automático)
// Sem sessão: só-MAE → cadastro (e volta para cá depois); SOA + MAE e troca para o anual → login (e volta para cá).
// Com sessão: abre o checkout certo (o mesmo das telas: sem cobrança dupla, link reaproveitado) e redireciona.
// Qualquer coisa fora do esperado (venda ainda fechada, plano da conta diferente do clicado, assinatura já ativa)
// leva para a tela da assinatura, que explica.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { criarCheckoutMae, criarCheckoutCombo, contaJaPagaSoa, planoDeVenda } from '@/lib/mae/assinatura/servidor'
import { criarCheckoutMigracao } from '@/lib/assinatura/migracaoAnual'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const o = url.searchParams.get('o')
  const ciclo = url.searchParams.get('ciclo') === 'anual' ? 'anual' : 'mensal'
  const parcelas = Math.max(1, Math.min(12, Math.floor(Number(url.searchParams.get('parcelas')) || 1)))
  const metodo = ciclo === 'mensal' && url.searchParams.get('metodo') === 'pix' ? 'pix' : 'cartao'
  const aqui = `/mae/pagar?o=${encodeURIComponent(o ?? '')}&ciclo=${ciclo}&parcelas=${parcelas}${metodo === 'pix' ? '&metodo=pix' : ''}`
  const ir = (p: string) => NextResponse.redirect(p.startsWith('http') ? p : new URL(p, url.origin))
  const alunas = o === 'alunas'
  const tela = o === 'anual-soa' ? '/assinatura/migrar-anual' : alunas ? '/mae/alunas' : `/mae/assinatura?ciclo=${ciclo}${ciclo === 'anual' && parcelas > 1 ? `&parcelas=${parcelas}` : ''}`
  if (o !== 'soa-mae' && o !== 'so-mae' && o !== 'anual-soa' && !alunas) return ir('/mae#planos')

  const session = await getServerSession(authOptions)
  const ws = session?.user.workspaceId
  // &conta=1 (links dos e-mails): a pessoa JÁ tem conta → entra (nunca o cadastro de conta nova)
  const temConta = url.searchParams.get('conta') === '1'
  // Plano Alunas sem sessão: a aluna nova cria a conta (a que já tem conta entra pelo "Entrar" do cadastro, que volta para cá)
  // SOA + MAE sem sessão (pessoa nova): cria a conta e volta para o pagamento do PACOTE — quem já tem conta entra pelo "Entrar"
  if (!ws) return ir((o === 'so-mae' || o === 'soa-mae' || alunas) && !temConta ? `/mae/cadastro?depois=${encodeURIComponent(aqui)}` : `/login?callbackUrl=${encodeURIComponent(aqui)}`)
  if (session.user.role !== 'ADMIN') return ir(tela)
  if (alunas) {
    // qualquer aluna (com ou sem o SOA): direto para o pagamento — inclusive o anual em N× (a página já mostrou as parcelas)
    const r = await criarCheckoutMae({ workspaceId: ws, ciclo, parcelas: ciclo === 'anual' ? parcelas : 1, baseUrl: url.origin, metodo, oferta: 'alunas' })
    return ir(r.ok ? r.link : `/mae/alunas?erro=${encodeURIComponent(r.erro)}`)
  }
  try {
    if (o === 'anual-soa') {
      // pente-fino 16/10: a troca para o anual sai À VISTA (o parcelado do SOA fica para depois — o recorrente não parcela)
      const r = await criarCheckoutMigracao({ workspaceId: ws, parcelas: 1, baseUrl: url.origin })
      return ir(r.ok ? r.link : tela)
    }
    // SOA + MAE para quem ainda NÃO paga o SOA = o PACOTE numa cobrança única (R$ 89,80/mês ou R$ 753/ano), direto —
    // inclusive o anual em N× (16/10/2026, correção do Júnior). Quem já paga o SOA segue abaixo: o MAE à parte (R$ 39,90).
    if (o === 'soa-mae' && !(await contaJaPagaSoa(ws))) {
      const r = await criarCheckoutCombo({ workspaceId: ws, ciclo, parcelas: ciclo === 'anual' ? parcelas : 1, baseUrl: url.origin, metodo })
      return ir(r.ok ? r.link : tela)
    }
    // o plano é o da CONTA (SOA ativo → SOA + MAE; sem SOA ativo → só o MAE): clicou no outro, a tela explica
    const plano = await planoDeVenda(ws)
    if ((o === 'so-mae') !== (plano === 'standalone')) return ir(tela)
    // anual PARCELADO: passa pela nossa tela, com a lista das parcelas e os juros de cada uma (e o aviso de escolher as
    // mesmas parcelas na página do Asaas, que abre em "1x")
    if (ciclo === 'anual' && parcelas > 1) return ir(tela)
    const r = await criarCheckoutMae({ workspaceId: ws, ciclo, parcelas: ciclo === 'anual' ? parcelas : 1, baseUrl: url.origin, metodo })
    return ir(r.ok ? r.link : tela)
  } catch (e) {
    console.error('[MAE PAGAR]', e)
    return ir(tela)
  }
}
