// Rota da landing — Server Component fino.
//
// Só existe para ler a flag no servidor (env não-pública, invisível para o client)
// e passá-la ao componente visual. Toda a página vive em LandingClient.
//
// ⚠️ Usa LANDING_ASAAS, NÃO ASSINATURA_NOVO_CADASTRO: o site e o funil de cadastro
// são ligados em momentos diferentes no rollout. Aqui:
//   LANDING_ASAAS OFF → CTAs abrem o checkout da Hotmart, exatamente como antes.
//   LANDING_ASAAS ON  → CTAs levam ao nosso /register.
import { landingAsaasLigada } from '@/lib/assinatura'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import LandingClient from './LandingClient'
import { precoMensalVigente, anualAvistaVigente, parcelado12xVigente } from '@/lib/assinatura/planos'
import { precosMae, vendaMaeAtiva, cobrancaMae, economiaAnual, type PlanoMaeVenda } from '@/lib/mae/assinatura/precos'
import type { OfertaMae } from './PlanosMae'

// Método Mãe: os 2 planos lidos da MESMA config e do MESMO gate do checkout (precos.ts) — nada chumbado na landing
function ofertasMae(): Record<PlanoMaeVenda, OfertaMae> | null {
  const p = precosMae()
  if (!p) return null
  const o = (pl: PlanoMaeVenda): OfertaMae => ({ mensal: p[pl].mensal, anual: p[pl].anual, parcela12: cobrancaMae(p, pl, 'anual', 12).valorParcela, economiaPct: economiaAnual(p, pl) })
  return { addon: o('addon'), standalone: o('standalone') }
}

export default function LandingPage() {
  return <LandingClient novoCadastro={landingAsaasLigada()} parceiras={parceirasAtivo()} precoMensal={precoMensalVigente()} precoAnual={anualAvistaVigente()} parcelaAnual12={parcelado12xVigente().valorParcela} mae={ofertasMae()} maeVenda={vendaMaeAtiva()} />
}
