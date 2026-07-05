// app/master/feedback/page.tsx
// Tela antiga de feedbacks — consolidada na Central de Atendimento (suporte +
// feedback unificado). Redireciona para /master/atendimento já filtrado em feedbacks,
// evitando link morto para quem tinha a rota salva/favoritada.
import { redirect } from 'next/navigation'

export default function MasterFeedbackRedirect() {
  redirect('/master/atendimento?tipo=FEEDBACK')
}
