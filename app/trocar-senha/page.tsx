'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Eye, EyeOff, Shield } from 'lucide-react'

export default function TrocarSenhaPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [novaSenha, setNovaSenha]   = useState('')
  const [confirmar, setConfirmar]   = useState('')
  const [mostrar, setMostrar]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [erro, setErro]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (novaSenha.length < 6) { setErro('A senha deve ter no mínimo 6 caracteres'); return }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem'); return }

    setLoading(true)
    setErro('')

    try {
      const res  = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novaSenha }),
      })
      const data = await res.json()

      if (!res.ok) { setErro(data.error || 'Erro ao trocar senha'); return }

      // Atualiza o token
      await update({ primeiroLogin: false })

      // Verifica se workspace já tem setores configurados
      // Se sim → dashboard (conta existente com senha resetada pelo master)
      // Se não → setup (conta nova criada pelo webhook Hotmart)
      try {
        const setoresRes  = await fetch('/api/producao/setores')
        const setoresData = await setoresRes.json()
        const temSetores  = (setoresData.setores || []).length > 0
        router.push(temSetores ? '/dashboard' : '/setup')
      } catch {
        router.push('/dashboard')
      }

    } catch {
      setErro('Erro ao trocar senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="VPS Gestão" width={200} height={64} priority />
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Shield size={18} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Criar sua senha</h2>
              <p className="text-gray-400 text-xs mt-0.5">Por segurança, escolha uma senha pessoal</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-3 mb-5">
            <p className="text-xs text-gray-400">
              Olá, <span className="text-white font-medium">{session?.user?.name?.split(' ')[0]}</span>! 👋
              Você está usando uma senha temporária. Crie agora uma senha segura para proteger sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={e => { setNovaSenha(e.target.value); setErro('') }}
                  className={inputClass + ' pr-10'}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button type="button" onClick={() => setMostrar(!mostrar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                  {mostrar ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Confirmar senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={e => { setConfirmar(e.target.value); setErro('') }}
                className={inputClass}
                placeholder="Repita a senha"
                required
              />
            </div>

            {/* Indicador de força */}
            {novaSenha && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4].map(n => (
                    <div key={n} className={`flex-1 h-1 rounded-full transition-colors ${
                      novaSenha.length >= n * 3
                        ? n <= 2 ? 'bg-red-500' : n === 3 ? 'bg-yellow-500' : 'bg-green-500'
                        : 'bg-gray-700'
                    }`}/>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {novaSenha.length < 6 ? 'Muito curta' : novaSenha.length < 9 ? 'Fraca' : novaSenha.length < 12 ? 'Média' : 'Forte ✓'}
                </p>
              </div>
            )}

            {erro && (
              <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 mt-1">
              {loading ? 'Salvando...' : 'Salvar senha e continuar →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">VPS Gestão © 2026</p>
      </div>
    </div>
  )
}
