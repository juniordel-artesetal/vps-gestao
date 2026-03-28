'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    nomeNegocio: '',
  })

  function atualiza(campo: string, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setErro('')
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (form.senha !== form.confirmarSenha) {
      setErro('As senhas não coincidem')
      return
    }
    if (form.senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres')
      return
    }
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao criar conta')
        setLoading(false)
        return
      }

      router.push('/setup?novo=1')
    } catch {
      setErro('Erro ao criar conta. Tente novamente.')
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="VPS Gestão" width={240} height={76} priority />
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">

          {/* Steps */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${step >= 1 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}`}>1</div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-orange-500' : 'bg-gray-700'}`}></div>
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${step >= 2 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}`}>2</div>
          </div>

          {step === 1 && (
            <form onSubmit={handleStep1} className="flex flex-col gap-4">
              <div>
                <h2 className="text-white text-lg font-semibold mb-1">Criar sua conta</h2>
                <p className="text-gray-400 text-sm mb-4">Preencha seus dados de acesso</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Seu nome</label>
                <input type="text" value={form.nome} onChange={e => atualiza('nome', e.target.value)} className={inputClass} placeholder="Maria Silva" required />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => atualiza('email', e.target.value)} className={inputClass} placeholder="seu@email.com" required />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Senha</label>
                <input type="password" value={form.senha} onChange={e => atualiza('senha', e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Confirmar senha</label>
                <input type="password" value={form.confirmarSenha} onChange={e => atualiza('confirmarSenha', e.target.value)} className={inputClass} placeholder="Repita a senha" required />
              </div>

              {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}

              <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition mt-1">
                Continuar →
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <h2 className="text-white text-lg font-semibold mb-1">Seu negócio</h2>
                <p className="text-gray-400 text-sm mb-4">Como se chama o seu ateliê ou negócio?</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Nome do negócio</label>
                <input type="text" value={form.nomeNegocio} onChange={e => atualiza('nomeNegocio', e.target.value)} className={inputClass} placeholder="Ex: Ateliê da Maria" required />
              </div>

              {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}

              <button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 mt-1">
                {loading ? 'Criando conta...' : 'Criar conta'}
              </button>

              <button type="button" onClick={() => setStep(1)} className="w-full text-gray-400 hover:text-gray-300 text-sm transition">
                ← Voltar
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-500 mt-5">
            Já tem conta?{' '}
            <a href="/login" className="text-orange-500 hover:text-orange-400">Entrar</a>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">VPS Gestão © 2026</p>
      </div>
    </div>
  )
}