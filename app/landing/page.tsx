// Rota da landing — Server Component fino.
//
// Só existe para ler a flag ASSINATURA_NOVO_CADASTRO no servidor (env não-pública,
// invisível para o client) e passá-la ao componente visual. Toda a página vive em
// LandingClient; aqui não há UI, só a decisão do funil:
//   flag OFF → CTAs abrem o checkout da Hotmart, exatamente como antes.
//   flag ON  → CTAs levam ao nosso /register.
import { cadastroAsaasLigado } from '@/lib/assinatura'
import LandingClient from './LandingClient'

export default function LandingPage() {
  return <LandingClient novoCadastro={cadastroAsaasLigado()} />
}
