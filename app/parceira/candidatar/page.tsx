'use client'
// Candidatura pública LEVE — só contato. Ao enviar, ela ganha uma sessão de
// onboarding e cai direto na área dela para completar o cadastro (senha, código,
// walletId). Sem senha/código/walletId aqui.
import { useState } from 'react'

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500'

export default function Candidatar() {
  const [form, setForm] = useState({ nome: '', whatsapp: '', email: '', instagram: '' })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    try {
      const r = await fetch('/api/parceira/candidatar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(d.error || 'Não consegui enviar. Tente de novo.'); setLoading(false); return }
      // Sessão de onboarding já veio no cookie — navegação cheia para a área dela.
      window.location.href = '/parceira'
    } catch { setErro('Erro de conexão. Tente de novo.'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Seja parceira do SOA 💛</h1>
          <p className="text-gray-400 text-sm mt-1">Deixe seu contato — em seguida você completa seu cadastro.</p>
        </div>
        <form onSubmit={enviar} className="space-y-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div><label className="text-sm text-gray-300 block mb-1">Seu nome</label>
            <input className={input} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Maria Silva" required /></div>
          <div><label className="text-sm text-gray-300 block mb-1">WhatsApp</label>
            <input className={input} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" required /></div>
          <div><label className="text-sm text-gray-300 block mb-1">E-mail</label>
            <input type="email" className={input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="seu@email.com" required /></div>
          <div><label className="text-sm text-gray-300 block mb-1">Instagram</label>
            <input className={input} value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@seu_perfil" autoCapitalize="none" required /></div>
          {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}
          <button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition">
            {loading ? 'Enviando…' : 'Continuar'}
          </button>
          <p className="text-xs text-gray-600 text-center">Sua candidatura passa por uma aprovação rápida da nossa equipe.</p>
        </form>
      </div>
    </div>
  )
}
