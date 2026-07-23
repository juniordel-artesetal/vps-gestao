'use client'
// Candidatura pública de parceira — auto-cadastro (vira ativa só após aprovação).
import { useState, useEffect } from 'react'

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500'

export default function Candidatar() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', walletId: '', codigo: '' })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [codStatus, setCodStatus] = useState<'' | 'checando' | 'livre' | 'ocupado' | 'invalido'>('')
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  // Disponibilidade do código em tempo real (debounced).
  useEffect(() => {
    const c = form.codigo.trim()
    if (!c) { setCodStatus(''); return }
    setCodStatus('checando')
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/parceira/candidatar?codigo=${encodeURIComponent(c)}`)
        const d = await r.json()
        setCodStatus(!d.valido ? 'invalido' : d.disponivel ? 'livre' : 'ocupado')
      } catch { setCodStatus('') }
    }, 400)
    return () => clearTimeout(t)
  }, [form.codigo])

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    try {
      const r = await fetch('/api/parceira/candidatar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não consegui enviar. Tente de novo.'); setLoading(false); return }
      setOk(true)
    } catch { setErro('Erro de conexão. Tente de novo.'); setLoading(false) }
  }

  if (ok) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-4xl mb-3">💛</p>
        <h1 className="text-xl font-semibold">Candidatura enviada!</h1>
        <p className="mt-2 text-gray-400 text-sm">A gente vai analisar e, assim que aprovar, você recebe um e-mail com o acesso ao seu painel.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Seja parceira do SOA 💛</h1>
          <p className="text-gray-400 text-sm mt-1">Indique artesãs, ganhe comissão a cada assinatura.</p>
        </div>
        <form onSubmit={enviar} className="space-y-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div><label className="text-sm text-gray-300 block mb-1">Seu nome</label>
            <input className={input} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Maria Silva" required /></div>
          <div><label className="text-sm text-gray-300 block mb-1">E-mail</label>
            <input type="email" className={input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="seu@email.com" required /></div>
          <div><label className="text-sm text-gray-300 block mb-1">Senha</label>
            <input type="password" className={input} value={form.senha} onChange={e => set('senha', e.target.value)} placeholder="Mínimo 6 caracteres" required /></div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">walletId da sua conta Asaas</label>
            <input className={input} value={form.walletId} onChange={e => set('walletId', e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" required />
            <p className="text-xs text-gray-500 mt-1">Crie uma conta grátis no <a href="https://www.asaas.com" target="_blank" className="text-orange-400 underline">asaas.com</a> → menu <b>Integrações → Carteira/Wallet</b> → copie o <b>Wallet ID</b>. É por onde sua comissão cai automática.</p>
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Seu código (link e cupom)</label>
            <input className={input} value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="MARIA10" required />
            <p className="text-xs mt-1">
              {codStatus === 'checando' && <span className="text-gray-500">conferindo…</span>}
              {codStatus === 'livre' && <span className="text-emerald-400">✅ disponível — seu link será usesoa.com.br/r/{form.codigo}</span>}
              {codStatus === 'ocupado' && <span className="text-red-400">já está em uso, escolha outro</span>}
              {codStatus === 'invalido' && <span className="text-red-400">3 a 20 letras/números</span>}
              {!codStatus && <span className="text-gray-500">3–20 letras/números. Vira seu link E seu cupom.</span>}
            </p>
          </div>
          {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}
          <button type="submit" disabled={loading || codStatus === 'ocupado' || codStatus === 'invalido'} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition">
            {loading ? 'Enviando…' : 'Quero ser parceira'}
          </button>
          <p className="text-xs text-gray-600 text-center">Sua candidatura passa por uma aprovação rápida da nossa equipe.</p>
        </form>
      </div>
    </div>
  )
}
