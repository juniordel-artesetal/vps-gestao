'use client'

// "Fale com a gente" — canal de contato SEM login, pra quem está trancada (login/bloqueio)
// conseguir pedir socorro. Abre um formulário simples e cria um chamado público.
import { useState } from 'react'
import { LifeBuoy, X, Check, Loader2 } from 'lucide-react'

export default function FaleConosco({ emailInicial = '', variante = 'link' as 'link' | 'card' }: { emailInicial?: string; variante?: 'link' | 'card' }) {
  const [aberto, setAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [protocolo, setProtocolo] = useState('')
  const [form, setForm] = useState({ nome: '', email: emailInicial, telefone: '', mensagem: '', website: '' })

  function abrir() {
    setForm(f => ({ ...f, email: f.email || emailInicial }))
    setErro(''); setProtocolo(''); setAberto(true)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    try {
      const r = await fetch('/api/suporte/publico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d?.error || 'Não foi possível enviar. Tente de novo.'); return }
      setProtocolo(d.protocolo || 'enviado')
    } catch { setErro('Falha de conexão. Tente de novo.') } finally { setEnviando(false) }
  }

  return (
    <>
      {variante === 'card' ? (
        <button type="button" onClick={abrir}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 rounded-xl px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition">
          <LifeBuoy size={16} /> Está com problema pra acessar? Fale com a gente
        </button>
      ) : (
        <button type="button" onClick={abrir}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 transition">
          <LifeBuoy size={14} /> Está com problema pra acessar? Fale com a gente
        </button>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setAberto(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2"><LifeBuoy size={18} className="text-orange-500" /> Fale com a gente</h3>
              <button type="button" onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {protocolo ? (
              <div className="py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 grid place-items-center mx-auto mb-3"><Check size={24} /></div>
                <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">Recebemos! 🧡</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vamos te responder no seu e-mail/WhatsApp o quanto antes.</p>
                <p className="text-xs text-gray-400 mt-3">Protocolo: <span className="font-mono font-semibold text-gray-600 dark:text-gray-300">{protocolo}</span></p>
                <button type="button" onClick={() => setAberto(false)} className="mt-5 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">Fechar</button>
              </div>
            ) : (
              <form onSubmit={enviar} className="space-y-3 mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Está sem acesso ou com algum problema? Preencha aqui que a gente te ajuda — não precisa estar logada.</p>
                {erro && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">{erro}</div>}

                {/* honeypot — invisível pra humano, bot preenche */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  className="hidden" aria-hidden="true" />

                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome"
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
                <input type="email" inputMode="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Seu e-mail"
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
                <input type="text" inputMode="tel" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="WhatsApp (com DDD)"
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
                <textarea value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Conte o que está acontecendo (ex.: paguei mas não consigo entrar)" rows={4}
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none" />

                <button type="submit" disabled={enviando}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : 'Enviar'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
