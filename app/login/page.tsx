'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const res = await signIn('credentials', {
      email,
      senha,
      redirect: false,
    })

    if (res?.ok) {
      router.push('/modulos')
    } else {
      setErro('Email ou senha incorretos')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">VPS Gestão</h1>
          <p className="text-sm text-gray-500 mt-1">Entre com sua conta</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="••••••••"
              required
            />
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Não tem conta?{' '}
          <a href="/register" className="text-purple-600 hover:underline">Criar conta</a>
        </p>
      </div>
    </div>
  )
}