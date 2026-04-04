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

  // ── Recuperação de senha ─────────────────────────────────
  const [telaRecuperar, setTelaRecuperar] = useState(false)
  const [emailRecup, setEmailRecup]       = useState('')
  const [enviando, setEnviando]           = useState(false)
  const [msgRecup, setMsgRecup]           = useState('')
  const [erroRecup, setErroRecup]         = useState('')

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
      router.push('/modulos')
    }
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErroRecup('')
    setMsgRecup('')
    try {
      const res  = await fetch('/api/auth/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailRecup }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Mostra mensagem específica — e-mail não cadastrado ou erro de envio
        setErroRecup(data.error || 'Erro ao enviar. Tente novamente.')
      } else {
        setMsgRecup('Link de recuperação enviado! Verifique sua caixa de entrada.')
      }
    } catch {
      setErroRecup('Erro de conexão. Tente novamente.')
    } finally {
      setEnviando(false)
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

          {/* ── TELA DE LOGIN ── */}
          {!telaRecuperar ? (
            <>
              <h2 className="text-white text-lg font-semibold mb-1">Entrar</h2>
              <p className="text-gray-400 text-sm mb-6">Acesse seu painel de gestão</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">E-mail</label>
                  <input
                    type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setErro('') }}
                    className={inputClass} placeholder="seu@email.com"
                    required autoComplete="email"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-300">Senha</label>
                    <button
                      type="button"
                      onClick={() => { setTelaRecuperar(true); setEmailRecup(email); setErroRecup(''); setMsgRecup('') }}
                      className="text-xs text-orange-400 hover:text-orange-300 transition"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <input
                    type="password" value={senha}
                    onChange={e => { setSenha(e.target.value); setErro('') }}
                    className={inputClass} placeholder="••••••••"
                    required autoComplete="current-password"
                  />
                </div>

                {erro && (
                  <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 mt-1">
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          ) : (
            /* ── TELA RECUPERAR SENHA ── */
            <>
              <button
                type="button"
                onClick={() => { setTelaRecuperar(false); setMsgRecup(''); setErroRecup('') }}
                className="text-xs text-gray-500 hover:text-gray-300 mb-4 flex items-center gap-1 transition"
              >
                ← Voltar ao login
              </button>
              <h2 className="text-white text-lg font-semibold mb-1">Recuperar senha</h2>
              <p className="text-gray-400 text-sm mb-6">
                Informe seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
              </p>

              {msgRecup ? (
                <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-3 text-sm text-green-400">
                  ✓ {msgRecup}
                </div>
              ) : (
                <form onSubmit={handleRecuperar} className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-1">E-mail cadastrado</label>
                    <input
                      type="email" value={emailRecup}
                      onChange={e => { setEmailRecup(e.target.value); setErroRecup('') }}
                      className={inputClass} placeholder="seu@email.com"
                      required autoComplete="email"
                    />
                  </div>

                  {erroRecup && (
                    <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
                      {erroRecup}
                    </p>
                  )}

                  <button type="submit" disabled={enviando}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50">
                    {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          VPS Gestão <span className="text-gray-500">v{VERSAO_ATUAL}</span> © 2026
        </p>

        {/* LGPD */}
        <p className="text-center text-xs text-gray-700 mt-2 leading-relaxed px-4">
          Este sistema está em conformidade com a{' '}
          <a
            href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-400 underline underline-offset-2 transition"
          >
            Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)
          </a>
        </p>

      </div>
    </div>
  )
}
