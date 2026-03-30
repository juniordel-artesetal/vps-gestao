'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { VERSAO_ATUAL } from '@/lib/versao'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const result = await signIn('credentials', { email, senha, redirect: false })

    if (!result?.ok) {
      setErro('E-mail ou senha incorretos')
      setLoading(false)
      return
    }

    const sessionRes  = await fetch('/api/auth/session')
    const sessionData = await sessionRes.json()

    if (sessionData?.user?.primeiroLogin) {
      router.push('/trocar-senha')
    } else {
      router.push('/dashboard')
    }
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="VPS Gestão" width={200} height={64} priority />
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <h2 className="text-white text-lg font-semibold mb-1">Entrar</h2>
          <p className="text-gray-400 text-sm mb-6">Acesse seu painel de gestão</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">E-mail</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErro('') }}
                className={inputClass} placeholder="seu@email.com" required autoComplete="email"/>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Senha</label>
              <input type="password" value={senha} onChange={e => { setSenha(e.target.value); setErro('') }}
                className={inputClass} placeholder="••••••••" required autoComplete="current-password"/>
            </div>

            {erro && (
              <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 mt-1">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Versão + link para changelog */}
        <p className="text-center text-xs text-gray-600 mt-4">
          VPS Gestão <span className="text-gray-500">v{VERSAO_ATUAL}</span> © 2026
        </p>

      </div>
    </div>
  )
}
