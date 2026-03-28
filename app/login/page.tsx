'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.png"
            alt="VPS Gestão"
            width={280}
            height={89}
            priority
          />
        </div>

        {/* Card de login */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <h2 className="text-white text-lg font-semibold text-center mb-1">
            Bem-vindo de volta
          </h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Entre com sua conta para acessar o sistema
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {erro && (
              <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2.5">
                <p className="text-sm text-red-400">{erro}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 mt-1"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            Não tem conta?{' '}
            <a href="/register" className="text-orange-500 hover:text-orange-400">
              Criar conta
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          VPS Gestão © 2026
        </p>
      </div>
    </div>
  )
}