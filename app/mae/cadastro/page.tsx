'use client'
// MÉTODO MÃE STANDALONE — cadastro de quem quer SÓ o MAE (sem o SOA). Cria a conta, entra e segue para a assinatura
// (sem teste grátis — decisão de 15/10). Com a venda fechada, o servidor recusa e a tela mostra "em breve".
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

const inp = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'

export default function CadastroMaePage() {
  const router = useRouter()
  const [f, setF] = useState({ nome: '', nomeNegocio: '', email: '', senha: '', confirmar: '' })
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  const campo = (k: keyof typeof f, rotulo: string, tipo = 'text', auto?: string) => (
    <label className="block text-sm text-gray-700">{rotulo}
      <input type={tipo} autoComplete={auto} value={f[k]} onChange={e => { setF(x => ({ ...x, [k]: e.target.value })); setErro(null) }} className={inp} data-cadastro-mae={k} required />
    </label>
  )
  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (f.senha !== f.confirmar) { setErro('As senhas não são iguais.'); return }
    if (f.senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    setIndo(true); setErro(null)
    try {
      const r = await fetch('/api/mae/assinatura/cadastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: f.nome, nomeNegocio: f.nomeNegocio, email: f.email, senha: f.senha }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      const s = await signIn('credentials', { email: f.email, senha: f.senha, redirect: false })
      if (!s?.ok) throw new Error('Conta criada — entre com o seu e-mail e senha para assinar.')
      // veio de um preço da página de vendas (/mae/pagar…)? segue direto para o pagamento
      const depois = new URLSearchParams(window.location.search).get('depois') ?? ''
      if (depois.startsWith('/mae/pagar?')) window.location.assign(depois)
      else router.push('/mae/assinatura')
    } catch (x) { setErro((x as Error).message); setIndo(false) }
  }
  return (
    <div className="min-h-screen bg-orange-50/40 flex items-center justify-center p-4">
      <form onSubmit={enviar} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm space-y-3" data-form-cadastro-mae>
        <div className="flex justify-center"><Image src="/logo_vps_horizontal.png" alt="SOA" width={180} height={128} priority /></div>
        <h1 className="text-xl font-bold text-center">Método Mãe</h1>
        <p className="text-sm text-gray-500 text-center">Crie sua conta e assine o Método MAE.</p>
        {campo('nome', 'Seu nome', 'text', 'name')}
        {campo('nomeNegocio', 'Nome do ateliê')}
        {campo('email', 'E-mail', 'email', 'email')}
        {campo('senha', 'Senha (mínimo 8 caracteres)', 'password', 'new-password')}
        {campo('confirmar', 'Confirme a senha', 'password', 'new-password')}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button disabled={indo} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 font-semibold disabled:opacity-50" data-criar-conta-mae>
          {indo && <Loader2 className="w-4 h-4 animate-spin" />} Criar conta e continuar
        </button>
        <p className="text-xs text-center text-gray-500">Já tem conta? <Link href="/login" className="text-orange-600 underline">Entrar</Link></p>
      </form>
    </div>
  )
}
