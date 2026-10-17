'use client'
// CADASTRAR O PIX AUTOMÁTICO — destino do convite da véspera do vencimento (régua das mensalidades, 16/10/2026) para
// quem paga o SOA no Pix avulso. Mesmo valor de hoje; a mensalidade em aberto já sai pelo Pix Automático e o Pix avulso é
// cancelado sozinho. Sem login → entra e volta para cá.
import { useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import PixAutomaticoBox from '@/components/PixAutomaticoBox'
import { PIX_AUTOMATICO_LIBERADO } from '@/lib/pagamento/pixAutomaticoLiberado'

export default function PixAutomaticoPage() {
  const [logada, setLogada] = useState<boolean | null>(null)
  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      if (!s?.user) { window.location.href = '/login?callbackUrl=/assinatura/pix-automatico'; return }
      setLogada(true)
    }).catch(() => setLogada(true))
  }, [])
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-xl space-y-5">
        <a href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Voltar ao SOA</a>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pix Automático</h1>
          <p className="mt-1 text-sm text-gray-600">Pare de pagar o Pix todo mês: autorize uma vez no app do seu banco e a mensalidade é debitada sozinha.</p>
        </div>
        <ul className="space-y-1 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700" data-pix-auto-vantagens>
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> O valor da sua mensalidade continua o mesmo.</li>
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> A mensalidade em aberto já sai pelo Pix Automático, e o Pix avulso é cancelado sozinho — não pague os dois.</li>
          <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Sem cartão e sem risco de esquecer e ficar sem acesso. Cancele quando quiser.</li>
        </ul>
        {PIX_AUTOMATICO_LIBERADO ? logada && <PixAutomaticoBox /> : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-pix-auto-em-breve>
            O Pix Automático chega em breve. Por enquanto, sua mensalidade continua no Pix mês a mês: o Pix de cada mês chega por e-mail, com lembrete antes do vencimento.
            Prefere não se preocupar? Em <a href="/assinatura" className="font-semibold underline">Minha Assinatura</a> você pode passar para o cartão.
          </p>
        )}
      </div>
    </div>
  )
}
