'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake } from 'lucide-react'

export default function ParceiroLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    try {
      const res = await fetch('/api/parceiro/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      if (res.ok) router.push('/parceiro')
      else { const d = await res.json(); setErro(d.error || 'Falha no login') }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Handshake className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Portal do Parceiro</h1>
            <p className="text-xs text-gray-400">SOA · Programa de Parceiros</p>
          </div>
        </div>
        <form onSubmit={entrar} className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-gray-300 block mb-1">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white" />
          </div>
          {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 mt-1">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
