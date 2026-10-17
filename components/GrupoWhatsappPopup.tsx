'use client'
// POP-UP do GRUPO DE SUPORTE das assinantes do SOA no WhatsApp (16/10/2026). Quem vê decide o servidor
// (/api/avisos/grupo-whatsapp: assinante ativa do SOA). "Entrar no grupo" ou "Já estou no grupo" → não aparece mais;
// "Agora não" → volta em 3 dias. Nunca abre por cima de outro pop-up (espera ele fechar).
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, MessageCircle, Check } from 'lucide-react'

// v2 (17/10/2026): link novo do grupo — quem já tinha entrado no antigo vê de novo
const CHAVE = 'soa_grupo_whatsapp_popup_v2'
const DIAS_DEPOIS = 3

export default function GrupoWhatsappPopup() {
  const pathname = usePathname()
  const [link, setLink] = useState<string | null>(null)
  const [mostrar, setMostrar] = useState(false)
  const foraDeLugar = !!pathname && (pathname.startsWith('/estudio/mae') || pathname.startsWith('/mae/') || pathname.startsWith('/setup'))

  useEffect(() => {
    if (foraDeLugar) return
    try {
      const v = localStorage.getItem(CHAVE)
      if (v === 'feito') return
      if (v && Date.now() < Number(v)) return
    } catch { /* sem localStorage: segue */ }
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    fetch('/api/avisos/grupo-whatsapp').then(r => (r.ok ? r.json() : null)).then(j => {
      if (!vivo || !j?.mostrar || !j.link) return
      setLink(j.link)
      // espera outro pop-up (Método Mãe, enquete) fechar antes de abrir
      let tentativas = 0
      const tentar = () => {
        if (!vivo) return
        const outro = document.querySelector('[role="dialog"][aria-modal="true"]:not([data-grupo-popup]), .fixed.inset-0.bg-black\\/40:not([data-grupo-popup])')
        if (outro && tentativas++ < 120) { timer = setTimeout(tentar, 2000); return }
        setMostrar(true)
      }
      timer = setTimeout(tentar, 3500)
    }).catch(() => {})
    return () => { vivo = false; if (timer) clearTimeout(timer) }
  }, [foraDeLugar])

  function guardar(v: string) { try { localStorage.setItem(CHAVE, v) } catch { /* ok */ } }
  function depois() { guardar(String(Date.now() + DIAS_DEPOIS * 86_400_000)); setMostrar(false) }
  function feito() { guardar('feito'); setMostrar(false) }

  if (!link || !mostrar || foraDeLugar) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="grupo-popup-titulo" data-grupo-popup>
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <button onClick={depois} className="absolute right-3 top-3 rounded-full p-1 text-white/80 hover:bg-white/20" aria-label="Fechar"><X className="h-5 w-5" /></button>
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Novidade para assinantes</p>
          <h2 id="grupo-popup-titulo" className="mt-1 flex items-center gap-2 text-2xl font-bold"><MessageCircle className="h-6 w-6" /> Grupo de suporte no WhatsApp</h2>
          <p className="mt-1 text-sm opacity-95">Um grupo só para assinantes do SOA, para suas respostas chegarem ainda mais rápido. <b>Link novo</b> — se entrou pelo anterior, entre por este.</p>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm text-gray-700 dark:text-gray-200">
          <ul className="space-y-1.5">
            {[
              'Dúvidas respondidas mais rápido, direto no WhatsApp',
              'Avisos de novidades e dicas do SOA',
              'Troca de experiências com outras artesãs',
            ].map(t => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t}</li>)}
          </ul>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button onClick={depois} className="rounded-xl px-4 py-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" data-grupo-popup-depois>Agora não</button>
            <button onClick={feito} className="rounded-xl px-4 py-2.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800" data-grupo-popup-ja>Já estou no grupo</button>
            <a href={link} target="_blank" rel="noopener noreferrer" onClick={feito} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-center font-semibold text-white hover:bg-[#1ebe5b]" data-grupo-popup-entrar>
              <MessageCircle className="h-4 w-4" /> Entrar no grupo
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
