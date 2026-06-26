'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function TrocarSenhaPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const senhaOk = senha.length >= 6
  const coincidem = confirmar.length > 0 && senha === confirmar
  const podeEnviar = senhaOk && coincidem && !carregando

  async function handleSubmit() {
    setErro('')

    if (!senhaOk) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (!coincidem) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })

      let data: any = {}
      try { data = await res.json() } catch {}

      if (!res.ok) {
        setErro(data?.error ?? `Erro ao salvar senha (${res.status}). Tente novamente.`)
        setCarregando(false)
        return
      }

      // Sucesso → logout → login com nova senha
      await signOut({ redirect: false })
      router.push('/login?trocou=1')
    } catch (e) {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
      setCarregando(false)
    }
  }

  const forcaIdx = senha.length === 0 ? 0
    : senha.length < 4 ? 1
    : senha.length < 7 ? 2
    : senha.length < 10 ? 3 : 4
  const forcaLabel = ['', 'Muito fraca', 'Fraca', 'Boa', 'Forte']
  const forcaCor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500']

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Criar nova senha</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {session?.user?.name ? `Olá, ${session.user.name.split(' ')[0]}! ` : ''}
            Defina uma senha pessoal para continuar.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8">
          <div className="space-y-4">

            {/* Nova senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nova senha <span className="text-gray-400 font-normal">(mín. 6 caracteres)</span>
              </label>
              <div className="relative">
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={senha}
                  onChange={e => { setSenha(e.target.value); setErro('') }}
                  placeholder="Digite sua nova senha"
                  autoComplete="new-password"
                  className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 dark:text-white transition-colors ${
                    senha.length > 0 && !senhaOk
                      ? 'border-red-300 focus:ring-red-300'
                      : 'border-gray-200 dark:border-gray-700 focus:ring-orange-400'
                  }`}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setMostrar(!mostrar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 select-none text-xs"
                >
                  {mostrar ? '🙈' : '👁️'}
                </button>
              </div>
              {senha.length > 0 && !senhaOk && (
                <p className="text-xs text-red-500 mt-1">Mínimo 6 caracteres ({senha.length} digitados)</p>
              )}
            </div>

            {/* Indicador força */}
            {senha.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(n => (
                    <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${forcaIdx >= n ? forcaCor[forcaIdx] : 'bg-gray-200 dark:bg-gray-700'}`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">{forcaLabel[forcaIdx]}</p>
              </div>
            )}

            {/* Confirmar senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirmar senha
              </label>
              <input
                type={mostrar ? 'text' : 'password'}
                value={confirmar}
                onChange={e => { setConfirmar(e.target.value); setErro('') }}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 dark:text-white transition-colors ${
                  confirmar.length > 0 && !coincidem
                    ? 'border-red-300 focus:ring-red-300'
                    : confirmar.length > 0 && coincidem
                    ? 'border-green-400 focus:ring-green-400'
                    : 'border-gray-200 dark:border-gray-700 focus:ring-orange-400'
                }`}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              {confirmar.length > 0 && (
                <p className={`text-xs mt-1 ${coincidem ? 'text-green-500' : 'text-red-500'}`}>
                  {coincidem ? '✓ Senhas coincidem' : 'As senhas não coincidem'}
                </p>
              )}
            </div>

            {/* Erro da API */}
            {erro && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
                ⚠️ {erro}
              </div>
            )}

            {/* Botão */}
            <button
              onClick={handleSubmit}
              disabled={!podeEnviar}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm transition-colors mt-2"
            >
              {carregando ? 'Salvando...' : 'Salvar senha e entrar →'}
            </button>

          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          SOA · Sua senha é criptografada e segura
        </p>
      </div>
    </div>
  )
}
