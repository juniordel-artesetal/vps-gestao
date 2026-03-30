'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MasterLoginPage() {
  const router = useRouter()
  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      const res  = await fetch('/api/master/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Credenciais inválidas'); return }
      router.push('/master')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 className="text-white text-xl font-semibold">Master Admin</h1>
          <p className="text-gray-500 text-sm mt-1">VPS Gestão — Acesso restrito</p>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Usuário</label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="master user"
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Senha</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="••••••••"
              required
            />
          </div>

          {erro && (
            <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-700 mt-4">Acesso exclusivo para administradores do produto</p>
      </div>
    </div>
  )
}
