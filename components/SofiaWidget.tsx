'use client'
// Sofia — Facilitadora Inteligente do SOA. Botão flutuante animado + painel de chat.
// Boas-vindas no primeiro acesso, dicas proativas (por rota) e tours guiados. Lê print.
// Self-gated: só renderiza para usuária autenticada. Aditivo — não altera as telas.
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Send, ImagePlus, Loader2, Compass, ChevronRight } from 'lucide-react'
import { useSofiaTour } from './SofiaTour'

interface Msg { role: 'user' | 'sofia'; content: string; tourId?: string | null }
interface Dica { id: string; texto: string; cta?: { label: string; href: string }; tourId?: string }

const SAUDACAO = 'Oi! Tô aqui do seu lado 🧡 Me conta o que você precisa — ou me manda um print se quiser que eu dê uma olhada.'

// Comprime a imagem no cliente (máx 1024px, jpeg) antes de enviar.
async function comprimir(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const blob = new Blob([buf])
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const max = 1024; let { width: w, height: h } = img
    if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r) }
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.7)
  } finally { URL.revokeObjectURL(url) }
}

export default function SofiaWidget() {
  const { status } = useSession()
  const pathname = usePathname()
  const { iniciar } = useSofiaTour()

  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(true)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [imagem, setImagem] = useState<string | null>(null)
  const [dica, setDica] = useState<Dica | null>(null)
  const [boasVindas, setBoasVindas] = useState(false)
  const fimRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Rotas onde a Sofia não aparece (públicas/master).
  const oculto = /^\/(login|register|master|loja|megaartesanal|obrigado|redefinir-senha|trocar-senha|setup|primeiros-passos)(\/|$)/.test(pathname || '')

  // Carrega config + dica proativa da rota.
  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/sofia/config?rota=${encodeURIComponent(pathname || '')}`)
      if (!res.ok) return
      const d = await res.json()
      setAtivo(d.ativo !== false)
      setDica(d.dica || null)
      if (d.ativo !== false && !d.primeiroAcessoVisto) { setBoasVindas(true); setAberto(true) }
    } catch {}
  }, [pathname])

  useEffect(() => { if (status === 'authenticated' && !oculto) carregar() }, [status, oculto, carregar])
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, aberto])

  if (status !== 'authenticated' || oculto || !ativo) return null

  function abrir() {
    setAberto(true)
    if (msgs.length === 0 && !boasVindas) setMsgs([{ role: 'sofia', content: SAUDACAO }])
  }
  async function marcarPrimeiroAcesso() {
    try { await fetch('/api/sofia/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ primeiroAcessoVisto: true }) }) } catch {}
    setBoasVindas(false)
  }
  async function dispensarDica() {
    if (!dica) return
    try { await fetch('/api/sofia/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dicaVista: dica.id }) }) } catch {}
    setDica(null)
  }
  function comecarTour(id: string) { marcarPrimeiroAcesso(); setDica(null); iniciar(id) }

  async function enviar() {
    const m = texto.trim()
    if ((!m && !imagem) || enviando) return
    const historico = msgs.slice(-6).map(x => ({ role: x.role === 'user' ? 'user' : 'model', content: x.content }))
    setMsgs(prev => [...prev, { role: 'user', content: m || '📷 (print)' }])
    setTexto(''); const img = imagem; setImagem(null); setEnviando(true)
    try {
      const res = await fetch('/api/sofia/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagem: m, historico, imagemBase64: img }) })
      const d = await res.json()
      setMsgs(prev => [...prev, { role: 'sofia', content: d.resposta || d.error || 'Deu um probleminha 😅', tourId: d.tourId }])
    } catch {
      setMsgs(prev => [...prev, { role: 'sofia', content: 'Deu um probleminha de conexão 😅 Tenta de novo?' }])
    } finally { setEnviando(false) }
  }

  async function anexar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    try { setImagem(await comprimir(f)) } catch {}
    e.target.value = ''
  }

  const AvatarSofia = (
    <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center flex-shrink-0 shadow">
      <Sparkles className="w-4 h-4 text-white" />
    </div>
  )

  return (
    <>
      {/* Painel */}
      {aberto && (
        <div className="fixed bottom-24 right-4 z-[60] w-[min(92vw,380px)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-gray-800 dark:to-gray-800">
            {AvatarSofia}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-gray-800 dark:text-gray-100 leading-tight">Sofia</div>
              <div className="text-[11px] text-gray-500">sua facilitadora no SOA</div>
            </div>
            <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {boasVindas ? (
              <div className="space-y-3">
                <BolhaSofia>Oi! Eu sou a Sofia 🧡 Vim pra te acompanhar aqui no SOA e deixar tudo mais fácil. Sempre que travar, é só me chamar aqui no canto. Quer que eu te mostre o básico num passeio rapidinho?</BolhaSofia>
                <div className="flex flex-col gap-2">
                  <BtnTour onClick={() => comecarTour('criar_primeiro_pedido')} texto="Bora criar meu primeiro pedido" />
                  <BtnTour onClick={() => comecarTour('precificar_produto')} texto="Me ensina a precificar" />
                  <BtnTour onClick={() => comecarTour('montar_loja')} texto="Quero montar minha loja" />
                  <button onClick={() => { marcarPrimeiroAcesso(); setMsgs([{ role: 'sofia', content: SAUDACAO }]) }} className="text-xs text-gray-400 hover:text-gray-600 py-1">Agora não, obrigada</button>
                </div>
              </div>
            ) : (
              msgs.map((m, i) => m.role === 'sofia'
                ? <div key={i}><BolhaSofia>{m.content}</BolhaSofia>{m.tourId && <BtnTour onClick={() => comecarTour(m.tourId!)} texto="Quer que eu te mostre? 😊" className="mt-1.5" />}</div>
                : <div key={i} className="flex justify-end"><div className="bg-orange-500 text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-[85%]">{m.content}</div></div>
              )
            )}
            {enviando && <BolhaSofia><Loader2 className="w-4 h-4 animate-spin inline" /> pensando…</BolhaSofia>}
            <div ref={fimRef} />
          </div>

          {!boasVindas && (
            <div className="p-2 border-t border-gray-100 dark:border-gray-800">
              {imagem && (
                <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-500">
                  <img src={imagem} alt="print" className="w-8 h-8 rounded object-cover border" />
                  print anexado · <span className="text-[10px]">só olho pra te ajudar; não guardo</span>
                  <button onClick={() => setImagem(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="flex items-end gap-1.5">
                <button onClick={() => fileRef.current?.click()} title="Anexar print" className="p-2 text-gray-400 hover:text-orange-500"><ImagePlus className="w-5 h-5" /></button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={anexar} />
                <textarea value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  rows={1} placeholder="Escreve sua dúvida…" className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm max-h-24" />
                <button onClick={enviar} disabled={enviando} className="p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dica proativa (bolha discreta acima do botão) */}
      {!aberto && dica && (
        <div className="fixed bottom-24 right-4 z-[55] w-[min(88vw,300px)] bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-2xl shadow-xl p-3">
          <div className="flex items-start gap-2">
            {AvatarSofia}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-200">{dica.texto}</p>
              <div className="flex items-center gap-2 mt-2">
                {dica.tourId && <button onClick={() => comecarTour(dica.tourId!)} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600">Me mostra</button>}
                {dica.cta && <a href={dica.cta.href} onClick={dispensarDica} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-0.5">{dica.cta.label} <ChevronRight className="w-3 h-3" /></a>}
                <button onClick={dispensarDica} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">agora não</button>
              </div>
            </div>
            <button onClick={dispensarDica} className="text-gray-300 hover:text-gray-500"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Botão flutuante animado */}
      <button onClick={() => (aberto ? setAberto(false) : abrir())}
        aria-label="Falar com a Sofia"
        className="fixed bottom-4 right-4 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform">
        {!aberto && <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-30" />}
        {aberto ? <X className="w-6 h-6 relative" /> : <Compass className="w-6 h-6 relative" />}
      </button>
    </>
  )
}

function BolhaSofia({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-800 dark:text-gray-100 max-w-[85%] whitespace-pre-wrap">{children}</div>
    </div>
  )
}
function BtnTour({ onClick, texto, className = '' }: { onClick: () => void; texto: string; className?: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 ${className}`}>
      <Compass className="w-4 h-4" /> {texto}
    </button>
  )
}
