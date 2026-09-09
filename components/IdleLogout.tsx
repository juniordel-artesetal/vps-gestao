'use client'
// Logout por inatividade (trava lógica de tela). Após 30 min sem interação, desloga
// e leva ao /login para reautenticar. Só arma quando há sessão (status authenticated);
// em telas públicas (login, loja, cadastro) fica inerte. Coordena entre abas por
// localStorage: atividade em qualquer aba mantém todas conectadas.
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'

const IDLE_MS  = 30 * 60 * 1000   // 30 min de inatividade → desloga
const AVISO_MS = 60 * 1000        // aviso 60s antes
const CHAVE    = 'soa:ultimaAtividade'
const EVENTOS  = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

export default function IdleLogout() {
  const { status } = useSession()
  const [avisando, setAvisando] = useState(false)
  const ultimoWrite = useRef(0)

  const registrarAtividade = useCallback(() => {
    const agora = Date.now()
    // Throttle: no máximo uma escrita a cada 2s (mousemove dispara muito).
    if (agora - ultimoWrite.current > 2000) {
      ultimoWrite.current = agora
      try { localStorage.setItem(CHAVE, String(agora)) } catch { /* modo privado */ }
    }
    setAvisando(v => (v ? false : v))
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    try { localStorage.setItem(CHAVE, String(Date.now())) } catch { /* modo privado */ }

    const onAtiv = () => registrarAtividade()
    EVENTOS.forEach(e => window.addEventListener(e, onAtiv, { passive: true }))

    const id = window.setInterval(() => {
      let ultima = Date.now()
      try { ultima = Number(localStorage.getItem(CHAVE)) || Date.now() } catch { /* modo privado */ }
      const inativo = Date.now() - ultima
      if (inativo >= IDLE_MS) {
        signOut({ callbackUrl: '/login?inatividade=1' })
      } else {
        setAvisando(inativo >= IDLE_MS - AVISO_MS)
      }
    }, 5000)

    return () => {
      EVENTOS.forEach(e => window.removeEventListener(e, onAtiv))
      window.clearInterval(id)
    }
  }, [status, registrarAtividade])

  if (status !== 'authenticated' || !avisando) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-6 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Você ainda está aí?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          Por segurança, sua sessão será encerrada em instantes por inatividade.
        </p>
        <button
          onClick={registrarAtividade}
          className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          Continuar conectada
        </button>
      </div>
    </div>
  )
}
