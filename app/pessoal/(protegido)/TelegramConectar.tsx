'use client'
// BYO-bot: cada assinante cria o próprio bot no BotFather e cola o token aqui.
// Estados: sem token (passo-a-passo + colar) → PENDENTE (aguardando /start) → ATIVO.
import { useEffect, useState, useCallback } from 'react'
import { Send, Check, Loader2, ExternalLink } from 'lucide-react'

export default function TelegramConectar() {
  const [st, setSt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/pessoal/telegram/vincular'); if (r.ok) setSt(await r.json()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])
  // Enquanto PENDENTE, faz polling leve pra virar ATIVO assim que a pessoa mandar /start.
  useEffect(() => {
    if (st?.status !== 'PENDENTE') return
    const t = setInterval(carregar, 4000); return () => clearInterval(t)
  }, [st?.status, carregar])

  async function conectar() {
    setErro('')
    if (!token.trim()) { setErro('Cole o token do seu bot.'); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/pessoal/telegram/vincular', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não consegui conectar.'); return }
      setToken(''); carregar()
    } catch { setErro('Falha de conexão. Tente de novo.') } finally { setSalvando(false) }
  }
  async function desconectar() { if (!confirm('Desconectar o Telegram?')) return; await fetch('/api/pessoal/telegram/vincular', { method: 'DELETE' }); carregar() }

  if (loading) return null
  const card = 'rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5'
  const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400'
  const linkBot = st?.botUsername ? `https://t.me/${st.botUsername}` : null

  // ATIVO
  if (st?.vinculado) return (
    <div className={card + ' flex items-center gap-3'}>
      <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-500 flex items-center justify-center"><Send size={20} /></div>
      <div className="flex-1">
        <p className="font-semibold text-gray-800 dark:text-neutral-100 flex items-center gap-1.5">Telegram conectado <Check className="w-4 h-4 text-emerald-500" /></p>
        <p className="text-xs text-gray-500">{st.botUsername ? '@' + st.botUsername : 'seu bot'} · lance gastos por mensagem e use /saldo</p>
      </div>
      <button onClick={desconectar} className="text-xs text-gray-400 hover:text-red-500">Desconectar</button>
    </div>
  )

  // PENDENTE — token salvo, aguardando /start
  if (st?.status === 'PENDENTE') return (
    <div className={card}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center"><Loader2 size={20} className="animate-spin" /></div>
        <div className="flex-1">
          <p className="font-semibold text-gray-800 dark:text-neutral-100">Quase lá!</p>
          <p className="text-xs text-gray-500">Abra o seu bot e toque <b>/start</b> pra confirmar a conexão.</p>
        </div>
        <button onClick={desconectar} className="text-xs text-gray-400 hover:text-red-500">Cancelar</button>
      </div>
      {linkBot && <a href={linkBot} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-semibold">Abrir @{st.botUsername} <ExternalLink className="w-4 h-4" /></a>}
    </div>
  )

  // Sem token — passo-a-passo + colar
  return (
    <div className={card}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-500 flex items-center justify-center"><Send size={20} /></div>
        <div>
          <p className="font-semibold text-gray-800 dark:text-neutral-100">Conectar seu Telegram</p>
          <p className="text-xs text-gray-500">Lance gastos por mensagem: <i>"gastei 20 no mercado"</i>.</p>
        </div>
      </div>
      <ol className="text-xs text-gray-600 dark:text-neutral-300 space-y-1 mb-3 list-decimal list-inside">
        <li>Abra <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-600 font-medium">@BotFather</a> no Telegram → envie <code>/newbot</code> → escolha um nome.</li>
        <li>O BotFather te dá um <b>TOKEN</b> (algo como <code>1234:ABC…</code>). Copie.</li>
        <li>Cole aqui embaixo e toque <b>Conectar</b>.</li>
      </ol>
      <input value={token} onChange={e => setToken(e.target.value)} placeholder="Cole o token do seu bot" className={inp} />
      {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
      <button onClick={conectar} disabled={salvando} className="w-full mt-3 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando…</> : <><Send className="w-4 h-4" /> Conectar</>}
      </button>
      <p className="text-[11px] text-gray-400 mt-2 text-center">Seu token fica <b>criptografado</b> e só você usa este bot.</p>
    </div>
  )
}
