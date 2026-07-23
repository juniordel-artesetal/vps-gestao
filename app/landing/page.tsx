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
import LandingClient from './LandingClient'

export default function LandingPage() {
  return <LandingClient novoCadastro={landingAsaasLigada()} />
}
