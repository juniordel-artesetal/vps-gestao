'use client'
// Porta de entrada VISÍVEL para assinar/renovar (chamado VPS-20260918-0QB8).
//
// O link "Minha Assinatura" existia só como 7º item dentro de Configurações — quem
// estava com o teste acabando simplesmente não achava como pagar e abria chamado.
// Este aviso aparece no topo das áreas logadas quando a assinatura precisa de ação.
//
// NUNCA aparece para CORTESIA (liberacaoManual): quem o Master liberou não vê cobrança.
// Também não aparece para quem está em dia — só quando há o que resolver.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CreditCard, AlertTriangle } from 'lucide-react'

interface Estado {
  status: string
  temAcesso: boolean
  diasRestantes: number | null
  liberacaoManual: boolean
  origem: string | null
}

/** Copy por situação. null = não mostra nada. */
function mensagem(e: Estado, temCobrancaAberta: boolean): { texto: string; cta: string; urgente: boolean } | null {
  // Cortesia do Master: jamais cobrar.
  if (e.liberacaoManual) return null

  // Sem acesso = o caso mais urgente, venha de onde vier.
  if (!e.temAcesso) {
    return { texto: 'Seu acesso está suspenso porque a assinatura não está ativa.', cta: 'Reativar assinatura', urgente: true }
  }

  // Cobrança em aberto: existe boleto/pix esperando — mostrar em qualquer estado.
  if (temCobrancaAberta) {
    return { texto: 'Você tem uma cobrança em aberto.', cta: 'Pagar agora', urgente: true }
  }

  // Fora da máquina Asaas (Hotmart/legado): não inventamos alarme — quem paga por lá
  // está em dia. Só a ausência de acesso (acima) justifica aviso.
  if (e.origem !== 'asaas') return null

  const d = e.diasRestantes
  switch (e.status) {
    case 'TRIAL':
      if (d === null) return null
      if (d <= 0) return { texto: 'Seu teste terminou.', cta: 'Assinar agora', urgente: true }
      if (d <= 7) return { texto: `Seu teste termina em ${d} ${d === 1 ? 'dia' : 'dias'}.`, cta: 'Assinar agora', urgente: d <= 3 }
      return null
    case 'AGUARDANDO_PAGAMENTO':
      return { texto: 'Falta concluir o pagamento para liberar sua conta.', cta: 'Concluir pagamento', urgente: true }
    case 'INADIMPLENTE':
      return { texto: 'Não conseguimos confirmar seu último pagamento.', cta: 'Regularizar', urgente: true }
    case 'CANCELADA':
      return { texto: 'Sua assinatura está cancelada.', cta: 'Reativar assinatura', urgente: false }
    default:
      return null
  }
}

export default function AvisoAssinatura() {
  const [m, setM] = useState<ReturnType<typeof mensagem>>(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/assinatura')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (vivo && d?.estado) setM(mensagem(d.estado as Estado, !!d.cobrancaAberta)) })
      .catch(() => {}) // falha de rede nunca pode quebrar a tela
    return () => { vivo = false }
  }, [])

  if (!m) return null

  const cor = m.urgente
    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200'
    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200'

  return (
    <div className={`flex flex-wrap items-center gap-3 border rounded-xl px-4 py-3 mb-4 text-sm ${cor}`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 min-w-0">{m.texto}</span>
      <Link
        href="/assinatura"
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-1.5 font-semibold whitespace-nowrap"
      >
        <CreditCard className="w-4 h-4" /> {m.cta}
      </Link>
    </div>
  )
}
