'use client'
// Opção "Pix Automático (sem cartão)" no checkout do SOA mensal: abre o link de pagamento do Asaas, onde ela paga o
// 1º Pix e autoriza no app do banco — as próximas mensalidades são debitadas sozinhas. Ao pagar, o webhook ativa a conta.
import { useState } from 'react'
import { Loader2, Repeat, ArrowRight } from 'lucide-react'

export default function PixAutomaticoBox() {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function abrir() {
    setErro(''); setCarregando(true)
    try {
      const r = await fetch('/api/assinatura/pix-automatico', { method: 'POST' })
      const d = await r.json()
      if (!r.ok || !d?.link) throw new Error(d?.error || 'Não foi possível abrir o Pix Automático')
      window.location.href = d.link
    } catch (e) { setErro((e as Error)?.message || 'Erro ao abrir'); setCarregando(false) }
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 p-4 space-y-3" data-pix-auto>
      <div className="flex items-center gap-2">
        <Repeat className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-gray-800 dark:text-neutral-100">Pix Automático <span className="text-xs font-normal text-gray-400">(sem cartão)</span></h3>
      </div>
      <ol className="text-sm text-gray-600 dark:text-neutral-300 list-decimal pl-5 space-y-1">
        <li>Abra a página segura do Asaas e pague o 1º Pix do plano mensal.</li>
        <li>No app do seu banco, <b>autorize o Pix Automático</b> (é uma vez só).</li>
        <li>Pronto: as próximas mensalidades são debitadas sozinhas. Cancele quando quiser.</li>
      </ol>
      {erro && <p className="text-sm text-red-500">{erro}</p>}
      <button onClick={() => void abrir()} disabled={carregando}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50">
        {carregando ? <><Loader2 className="w-4 h-4 animate-spin" /> Abrindo…</> : <>Assinar no Pix Automático <ArrowRight className="w-4 h-4" /></>}
      </button>
      <p className="text-xs text-gray-400">Assim que o 1º Pix cair, sua conta ativa sozinha.</p>
    </div>
  )
}
