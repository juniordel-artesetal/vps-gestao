'use client'
// Destino do successUrl do checkout — abre DENTRO da popup do cartão.
//
// Faz três coisas, nesta ordem de confiança:
//   1. avisa a tela mãe por postMessage (instantâneo);
//   2. fecha a si mesma;
//   3. se não for popup (fallback de navegador que bloqueou), redireciona.
//
// A tela mãe TAMBÉM consulta o status por conta própria — esta página é o
// caminho rápido, não o único. Se o postMessage falhar, o polling destrava
// alguns segundos depois; se os dois falharem, ela recarrega e vê o estado real.
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

export default function CheckoutConcluido() {
  const [souPopup, setSouPopup] = useState(true)

  useEffect(() => {
    const ehPopup = typeof window !== 'undefined' && !!window.opener && window.opener !== window
    setSouPopup(ehPopup)

    if (ehPopup) {
      try {
        // origin explícito: postMessage com '*' entregaria a qualquer página.
        window.opener.postMessage({ tipo: 'SOA_CHECKOUT_CONCLUIDO' }, window.location.origin)
      } catch { /* a mãe pode ter navegado; o polling dela resolve */ }
      // Um respiro para a artesã ver a confirmação antes da janela sumir.
      const t = setTimeout(() => { try { window.close() } catch {} }, 1800)
      return () => clearTimeout(t)
    }

    // Não é popup: o navegador bloqueou e ela veio na mesma aba.
    const t = setTimeout(() => { window.location.href = '/assinatura' }, 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Pagamento registrado!</h1>
        <p className="text-sm text-gray-600">
          {souPopup
            ? 'Pode fechar esta janela — seu acesso já está liberado no SOA.'
            : 'Voltando para o seu ateliê…'}
        </p>
      </div>
    </div>
  )
}
