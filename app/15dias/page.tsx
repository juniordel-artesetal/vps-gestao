// Landing evergreen do teste grátis de 15 dias — usa a base compartilhada LandingTrial.
// ★ Link do checkout Hotmart de 15 dias — troque AQUI se a oferta mudar. ★
import LandingTrial from '@/components/LandingTrial'

const HOTMART_HREF = 'https://pay.hotmart.com/C105122525T'

export default function QuinzeDiasPage() {
  return <LandingTrial dias={15} checkoutHref={HOTMART_HREF} />
}
