'use client'
// Carrossel "Veja por dentro": passa por TODAS as telas capturadas (public/telas/manifest.json,
// gerado por `npm run telas`). Auto-avanço suave em loop, pausa no hover, setas ‹ ›, bullets e
// swipe no mobile. prefers-reduced-motion: não auto-avança (navegação manual). Cada slide num
// frame de navegador (3 bolinhas + url) + rótulo do módulo. Enquanto o manifest não existe,
// cai nos 4 prints estáticos atuais (o site não quebra antes da captura).
import { useEffect, useRef, useState } from 'react'

type Tela = { arquivo: string; modulo: string; titulo: string; rota?: string }

const FALLBACK: Tela[] = [
  { arquivo: '/prints/producao.png',     modulo: 'Produção',     titulo: 'Fila de produção',      rota: '/dashboard/pedidos' },
  { arquivo: '/prints/precificacao.png', modulo: 'Precificação', titulo: 'Precificação por canal', rota: '/precificacao' },
  { arquivo: '/prints/financeiro.png',   modulo: 'Financeiro',   titulo: 'Financeiro visual',      rota: '/financeiro' },
  { arquivo: '/prints/dashboard.png',    modulo: 'Visão Geral',  titulo: 'Painel completo',        rota: '/dashboard' },
]

export default function TelasCarrossel() {
  const [telas, setTelas] = useState<Tela[]>(FALLBACK)
  const [i, setI] = useState(0)
  const pausado = useRef(false)
  const touchX = useRef<number | null>(null)

  // Carrega as telas capturadas (se já existir o manifest).
  useEffect(() => {
    fetch('/telas/manifest.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((data: Tela[] | null) => { if (Array.isArray(data) && data.length) { setTelas(data); setI(0) } })
      .catch(() => {})
  }, [])

  const total = telas.length
  const go = (n: number) => setI(((n % total) + total) % total)
  const prox = () => go(i + 1)
  const ant = () => go(i - 1)

  // Auto-avanço (respeita reduced-motion e pausa no hover).
  useEffect(() => {
    if (total <= 1) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => { if (!pausado.current) setI(v => (v + 1) % total) }, 4200)
    return () => clearInterval(id)
  }, [total])

  const atual = telas[i] || telas[0]

  return (
    <div
      className="mt-14"
      onMouseEnter={() => { pausado.current = true }}
      onMouseLeave={() => { pausado.current = false }}
    >
      <div className="relative mx-auto max-w-4xl">
        <div
          className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40"
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            if (touchX.current == null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            if (Math.abs(dx) > 40) (dx < 0 ? prox() : ant())
            touchX.current = null
          }}
        >
          {/* Barra do browser */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            <div className="ml-2 flex-1 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-400">
              app.usesoa.com.br{atual.rota || ''}
            </div>
            <div className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold text-orange-200">{atual.modulo}</div>
          </div>
          {/* Telas empilhadas com fade — a ativa aparece */}
          <div className="relative bg-slate-950" style={{ aspectRatio: '1512 / 900' }}>
            {telas.map((t, idx) => (
              <img
                key={t.arquivo}
                src={t.arquivo}
                alt={`SOA — ${t.modulo}: ${t.titulo}`}
                loading="lazy"
                aria-hidden={idx !== i}
                className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${idx === i ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
          </div>
          {/* Rótulo do módulo */}
          <div className="border-t border-white/10 bg-white/[0.02] p-5">
            <div className="text-sm font-semibold text-white">{atual.titulo}</div>
            <div className="mt-1 text-sm leading-6 text-slate-400">{atual.modulo}</div>
          </div>
        </div>

        {/* Setas */}
        {total > 1 && (
          <>
            <button onClick={ant} aria-label="Tela anterior"
              className="absolute left-2 top-[42%] -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition hover:bg-black/70 md:-left-4">‹</button>
            <button onClick={prox} aria-label="Próxima tela"
              className="absolute right-2 top-[42%] -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition hover:bg-black/70 md:-right-4">›</button>
          </>
        )}
      </div>

      {/* Bullets */}
      {total > 1 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {telas.map((t, idx) => (
            <button key={t.arquivo} onClick={() => go(idx)} aria-label={`Ir para ${t.titulo}`}
              className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-orange-400' : 'w-2 bg-white/20 hover:bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  )
}
