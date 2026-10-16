'use client'
// Peças interativas da página de vendas /mae: botões com rastreio (Meta Pixel "CliqueMetodoMae", para a Naty saber de
// qual botão veio a venda), a calculadora de horas e o contato.
import { useState, type ReactNode } from 'react'
import FaleConosco from '@/components/FaleConosco'

export function Cta({ href, botao, className, children }: { href: string; botao: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} data-cta-mae={botao}
      onClick={() => { try { if (typeof window.fbq === 'function') window.fbq('trackCustom', 'CliqueMetodoMae', { botao }) } catch { /* rastreio nunca atrapalha o clique */ } }}>
      {children}
    </a>
  )
}

const num = (s: string) => { const v = Number(s.replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(v) ? v : 0 }

export function Calculadora() {
  const [pedidos, setPedidos] = useState('50')
  const [minutos, setMinutos] = useState('15')
  const horasSemana = (num(pedidos) * num(minutos)) / 60
  const horasMes = horasSemana * 4.33
  const fmt = (h: number) => {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60)
    return mm === 60 ? `${hh + 1} h` : mm ? `${hh} h ${mm} min` : `${hh} h`
  }
  const campo = (rotulo: string, v: string, set: (s: string) => void, id: string) => (
    <label className="block" htmlFor={id}>
      <span className="text-sm font-bold text-[#5b4a3f]">{rotulo}</span>
      <input id={id} value={v} onChange={e => set(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border-2 border-[#eadfd6] bg-white px-4 py-3 text-xl font-bold [font-variant-numeric:tabular-nums] outline-none focus:border-[#f97316]" data-calc-mae={id} />
    </label>
  )
  return (
    <div className="rounded-3xl border border-[#f1e4d8] bg-white p-6 shadow-[0_16px_40px_-30px_rgba(124,45,18,0.5)]">
      <p className="disp text-xl font-extrabold">Calcule as suas horas</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {campo('Pedidos por semana', pedidos, setPedidos, 'calc-pedidos')}
        {campo('Minutos por pedido', minutos, setMinutos, 'calc-minutos')}
      </div>
      <div className="mt-5 rounded-2xl bg-[#fff7ed] p-5">
        <p className="text-sm font-bold uppercase tracking-wider text-[#c2410c]">Você gasta hoje</p>
        <p className="disp mt-1 text-3xl font-extrabold [font-variant-numeric:tabular-nums]" data-calc-semana>{fmt(horasSemana)} <span className="text-lg font-semibold text-[#7a6a5f]">por semana</span></p>
        <p className="mt-1 text-lg text-[#5b4a3f] [font-variant-numeric:tabular-nums]">≈ <b>{fmt(horasMes)}</b> por mês só personalizando e organizando impressão.</p>
      </div>
    </div>
  )
}

export function Contato({ whatsapp }: { whatsapp: string | null }) {
  if (whatsapp) return <p>Dúvidas? Fale com a gente no <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-bold text-[#16a34a] underline">WhatsApp</a>.</p>
  return <div className="flex flex-wrap items-center justify-center gap-1.5"><span>Dúvidas?</span><FaleConosco rotulo="Fale com a gente" /></div>
}
