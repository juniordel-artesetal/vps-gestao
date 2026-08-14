'use client'
// Card de conexão do Telegram na home do Pessoal: gera código + deep link (um toque).
import { useEffect, useState, useCallback } from 'react'
import { Send, Check, Loader2, ExternalLink } from 'lucide-react'

export default function TelegramConectar() {
  const [st, setSt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/pessoal/telegram/vincular'); if (r.ok) setSt(await r.json()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function conectar() {
    setGerando(true)
    try {
      const r = await fetch('/api/pessoal/telegram/vincular', { method: 'POST' })
      const d = await r.json()
      if (d.ok) { setCodigo(d.codigo); setDeepLink(d.deepLink); if (d.deepLink) window.open(d.deepLink, '_blank', 'noopener') }
    } finally { setGerando(false) }
  }
  async function desvincular() { if (!confirm('Desconectar o Telegram?')) return; await fetch('/api/pessoal/telegram/vincular', { method: 'DELETE' }); setCodigo(null); setDeepLink(null); carregar() }

  if (loading) return null
  const card = 'rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5'

  if (st?.vinculado) return (
    <div className={card + ' flex items-center gap-3'}>
      <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-500 flex items-center justify-center"><Send size={20} /></div>
      <div className="flex-1">
        <p className="font-semibold text-gray-800 dark:text-neutral-100 flex items-center gap-1.5">Telegram conectado <Check className="w-4 h-4 text-emerald-500" /></p>
        <p className="text-xs text-gray-500">{st.telegramUsername ? '@' + st.telegramUsername : 'Mande seus gastos por mensagem'} · lançamentos por texto e /saldo</p>
      </div>
      <button onClick={desvincular} className="text-xs text-gray-400 hover:text-red-500">Desconectar</button>
    </div>
  )

  return (
    <div className={card}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-500 flex items-center justify-center"><Send size={20} /></div>
        <div className="flex-1">
          <p className="font-semibold text-gray-800 dark:text-neutral-100">Conectar meu Telegram</p>
          <p className="text-xs text-gray-500">Lance gastos por mensagem: <i>"gastei 20 no mercado"</i>.</p>
        </div>
        {st?.botConfigurado ? (
          <button onClick={conectar} disabled={gerando} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Conectar
          </button>
        ) : <span className="text-xs text-gray-400">em breve</span>}
      </div>
      {codigo && (
        <div className="mt-3 rounded-lg bg-sky-50 dark:bg-sky-900/15 p-3 text-sm text-gray-600 dark:text-neutral-300">
          Abra o link no app do Telegram (código pré-preenchido). Se não abrir:
          {deepLink && <a href={deepLink} target="_blank" rel="noopener noreferrer" className="ml-1 text-sky-600 font-medium inline-flex items-center gap-1">abrir <ExternalLink className="w-3 h-3" /></a>}
          <div className="mt-1 text-xs text-gray-400">Código <b className="tracking-widest">{codigo}</b> · expira em 15 min. No bot: <code>/start {codigo}</code></div>
        </div>
      )}
    </div>
  )
}
