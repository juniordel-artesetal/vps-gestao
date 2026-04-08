'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function TrocarSenhaPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit() {
    setErro('')
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }

    setCarregando(true)
    try {
      const res = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error ?? 'Erro ao trocar senha')
        return
      }

      // Verificar se workspace já tem setores configurados
      // Se sim → /modulos (funcionária de workspace existente)
      // Se não → /setup (dono do workspace no primeiro acesso)
      try {
        const setoresRes = await fetch('/api/producao/setores')
        const setoresData = await setoresRes.json()
        if (Array.isArray(setoresData) && setoresData.length > 0) {
          router.push('/modulos')
        } else {
          router.push('/setup')
        }
      } catch {
        router.push('/modulos')
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Criar nova senha</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {session?.user?.name
              ? `Olá, ${session.user.name.split(' ')[0]}! `
              : ''}
            Defina uma senha pessoal para continuar.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8">
          <div className="space-y-5">
            {/* Nova senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 dark:text-white"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <button
                  type="button"
                  onClick={() => setMostrar(!mostrar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {mostrar ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirmar senha
              </label>
              <input
                type={mostrar ? 'text' : 'password'}
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 dark:text-white"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {/* Indicador de força */}
            {senha.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        senha.length >= n * 3
                          ? n <= 1 ? 'bg-red-400'
                          : n <= 2 ? 'bg-yellow-400'
                          : n <= 3 ? 'bg-blue-400'
                          : 'bg-green-400'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {senha.length < 3 ? 'Muito fraca' : senha.length < 6 ? 'Fraca' : senha.length < 9 ? 'Boa' : senha.length < 12 ? 'Forte' : 'Muito forte'}
                </p>
              </div>
            )}

            {/* Erro */}
            {erro && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400">
                ⚠️ {erro}
              </div>
            )}

            {/* Botão */}
            <button
              onClick={handleSubmit}
              disabled={carregando || !senha || !confirmar}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {carregando ? 'Salvando...' : 'Salvar e continuar →'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          VPS Gestão · Sua senha é criptografada e segura
        </p>
      </div>
    </div>
  )
}
