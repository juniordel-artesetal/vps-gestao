'use client'
// Pop-up guiado da migração (Hotmart→Asaas) — só para os workspaces da campanha
// (os 130) que ainda não migraram. NÃO bloqueia o uso; minimiza num banner.
// Passos sincronizados ao estado (✓). Reforço: a conta é a MESMA, nada se perde.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface Status { ativo: boolean; naCampanha: boolean; migrada?: boolean; primeiroNome?: string | null; passo1Ok?: boolean; passo2Ok?: boolean }
const CANCELAR = 'consumer.hotmart.com → produto SOA → Configurar pagamento → Cancelar assinatura → confirmar.'

export default function MigracaoPopup() {
  const pathname = usePathname()
  const [st, setSt] = useState<Status | null>(null)
  const [aberto, setAberto] = useState(true)

  const oculto = /^\/(login|register|master|loja|megaartesanal|30dias|15dias|obrigado|redefinir-senha|trocar-senha|setup|migrar)(\/|$)/.test(pathname || '')

  useEffect(() => {
    if (oculto) return
    fetch('/api/campanha/meu-status').then(r => r.ok ? r.json() : null).then(setSt).catch(() => {})
  }, [oculto])

  if (oculto || !st?.ativo || !st.naCampanha) return null
  const nome = st.primeiroNome || 'amiga'
  const p1 = !!st.passo1Ok, p2 = !!st.passo2Ok
  const tudoCerto = p1 && p2
  const titulo = tudoCerto ? `Tudo certo, ${nome}! 💚`
    : p1 && !p2 ? `Quase lá, ${nome}! Falta só ativar 💛`
    : p2 && !p1 ? `${nome}, falta só cancelar a Hotmart ⚠️`
    : `${nome}, vamos deixar sua mensalidade no valor certo? 💛`

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} aria-label="Ajustar mensalidade"
        className="fixed bottom-4 left-4 z-[55] flex items-center gap-2 rounded-full bg-amber-500 text-white shadow-lg px-4 py-2.5 text-sm font-semibold hover:bg-amber-600">
        💛 Sua mensalidade precisa de um ajuste rápido
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-[56] w-[min(92vw,360px)] bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-800">
        <div className="font-bold text-gray-800 dark:text-gray-100 text-sm pr-2">{titulo}</div>
        <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-none">–</button>
      </div>

      <div className="p-4 space-y-3">
        {tudoCerto ? (
          <p className="text-sm text-gray-700 dark:text-gray-200">Sua mensalidade está no valor certo e sua conta segue com tudo no lugar. Obrigada por continuar com a gente! 🧡</p>
        ) : (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-200">Sua assinatura foi cobrada R$ 49,90 por uma regra antiga. Ajustar leva 1 minutinho — e <b>sua conta continua a mesma</b>, com tudo que você já cadastrou. No 1º mês você paga só <b>R$ 9,90</b>!</p>

            <Passo ok={p1} n={1} titulo="Cancelar a cobrança antiga na Hotmart">
              {CANCELAR}
              <span className="block text-[11px] text-gray-500 mt-1">Não gera reembolso — só evita cobranças futuras. O crédito da diferença vem no 1º mês do SOA.</span>
            </Passo>

            <Passo ok={p2} n={2} titulo="Ativar sua mensalidade no SOA (1º mês R$ 9,90)">
              {!p2 && <a href="/migrar" className="mt-2 block text-center bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold">Migrar meu plano</a>}
            </Passo>

            <p className="text-[11px] text-gray-500">Seu acesso continua liberado enquanto você faz isso. 💜</p>
          </>
        )}
      </div>
    </div>
  )
}

function Passo({ ok, n, titulo, children }: { ok: boolean; n: number; titulo: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/15' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>{ok ? '✓' : n}</span>
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{titulo}</span>
      </div>
      {children && <div className="text-xs text-gray-600 dark:text-gray-300 pl-8">{children}</div>}
    </div>
  )
}
