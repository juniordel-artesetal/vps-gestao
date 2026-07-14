// Landing evergreen do teste grátis de 30 dias — usa a base compartilhada LandingTrial.
// ★ Link do checkout Hotmart de 30 dias — troque AQUI se a oferta mudar. ★
import LandingTrial from '@/components/LandingTrial'

const HOTMART_HREF = 'https://pay.hotmart.com/C105122525T?checkoutMode=2&off=793olsmv'

export default function TrintaDiasPage() {
  return <LandingTrial dias={30} checkoutHref={HOTMART_HREF} />
}
