'use client'

// Formulário público da influenciadora. Mobile-first, tom SOA. Cria a conta e já entra no
// sistema (sem portão de pagamento). Lê ?c= (campanha). @ do Instagram usa AtSign (lucide não
// tem Instagram).
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Gift, TrendingUp, Sparkles, AtSign, Loader2, CheckCircle2 } from 'lucide-react'
import { SEGMENTOS } from '@/lib/segmentos'

export default function InfluenciadoraForm() {
  const sp = useSearchParams()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [jaTemConta, setJaTemConta] = useState(false)
  const [f, setF] = useState({
    nome: '', email: '', telefone: '', instagram: '', nomeNegocio: '', segmento: '',
    senha: '', senha2: '', aceite: false, website: '', conviteCampanha: '',
  })
  useEffect(() => { const c = sp?.get('c'); if (c) setF(p => ({ ...p, conviteCampanha: c })) }, [sp])

  const up = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))
  const inputClass = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400'

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setJaTemConta(false)
    if (f.senha !== f.senha2) { setErro('As senhas não conferem.'); return }
    if (!f.aceite) { setErro('Marque o aceite dos termos do programa.'); return }
    setEnviando(true)
    try {
      const r = await fetch('/api/influenciadora/cadastrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d?.error || 'Não foi possível cadastrar.'); if (d?.jaTemConta) setJaTemConta(true); return }
      // Login automático (mesmo padrão pós-register) → onboarding.
      const login = await signIn('credentials', { email: f.email.trim().toLowerCase(), senha: f.senha, redirect: false })
      if (login?.ok) window.location.href = '/setup'
      else window.location.href = '/login'
    } catch { setErro('Falha de conexão. Tente de novo.') } finally { setEnviando(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug text-balance">Você foi convidada pro Programa de Parceiras do SOA 💛</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Use o SOA de graça, ganhe comissão indicando e mostre seu ateliê do seu jeito.</p>
        </div>

        {/* Como funciona */}
        <div className="grid grid-cols-1 gap-2 mb-5">
          {[
            { i: <Gift size={16} className="text-orange-500" />, t: 'Licença grátis', d: 'Você usa o SOA sem pagar enquanto for parceira.' },
            { i: <TrendingUp size={16} className="text-orange-500" />, t: '30% / 40% recorrente', d: 'Comissão do mensal e do anual, direto na sua conta Asaas.' },
            { i: <Sparkles size={16} className="text-orange-500" />, t: 'Stories/Reels sem roteiro', d: 'Mostre o sistema no seu dia a dia, do seu jeito.' },
          ].map((x, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-3 py-2.5">
              <span className="mt-0.5">{x.i}</span>
              <div><p className="text-sm font-semibold text-gray-800 dark:text-white">{x.t}</p><p className="text-xs text-gray-500 dark:text-gray-400">{x.d}</p></div>
            </div>
          ))}
        </div>

        {/* Formulário */}
        <form onSubmit={enviar} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          {erro && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {erro}{jaTemConta && <> <a href="/login" className="underline font-semibold">Entrar</a> e clicar em "Quero ser parceira".</>}
            </div>
          )}

          {/* honeypot */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={e => up('website', e.target.value)} className="hidden" aria-hidden="true" />

          <input type="text" value={f.nome} onChange={e => up('nome', e.target.value)} placeholder="Seu nome" className={inputClass} required />
          <input type="email" value={f.email} onChange={e => up('email', e.target.value)} placeholder="Seu e-mail" className={inputClass} required />
          <input type="text" inputMode="tel" value={f.telefone} onChange={e => up('telefone', e.target.value)} placeholder="WhatsApp (com DDD)" className={inputClass} required />
          <div className="relative">
            <AtSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={f.instagram} onChange={e => up('instagram', e.target.value.replace(/^@+/, ''))} placeholder="seu Instagram (sem @)" className={inputClass + ' pl-8'} required />
          </div>
          <input type="text" value={f.nomeNegocio} onChange={e => up('nomeNegocio', e.target.value)} placeholder="Nome do seu ateliê" className={inputClass} required />
          <select value={f.segmento} onChange={e => up('segmento', e.target.value)} className={inputClass} required>
            <option value="">Seu segmento…</option>
            {SEGMENTOS.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.nome}</option>)}
          </select>
          <input type="password" value={f.senha} onChange={e => up('senha', e.target.value)} placeholder="Crie uma senha (mín. 6)" className={inputClass} required />
          <input type="password" value={f.senha2} onChange={e => up('senha2', e.target.value)} placeholder="Confirme a senha" className={inputClass} required />

          <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 pt-1">
            <input type="checkbox" checked={f.aceite} onChange={e => up('aceite', e.target.checked)} className="mt-0.5 accent-orange-500" />
            <span>Li e aceito os termos do <a href="/parceiras/termos" target="_blank" rel="noopener" className="text-orange-600 underline">Programa de Parceiras</a>.</span>
          </label>

          <button type="submit" disabled={enviando}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
            {enviando ? <><Loader2 size={16} className="animate-spin" /> Criando sua conta…</> : <><CheckCircle2 size={16} /> Criar conta e entrar</>}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">Já tem conta? <a href="/login" className="text-orange-600 underline">Entrar</a></p>
      </div>
    </div>
  )
}
