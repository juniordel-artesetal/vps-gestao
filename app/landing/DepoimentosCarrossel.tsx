'use client'
// Carrossel de depoimentos em TEXTO (fala real de clientes, garimpada dos feedbacks/chamados).
// Auto-scroll contínuo e sem emenda (lista duplicada), pausa no hover (desktop) e arrasta/swipe
// no mobile (é um scroller nativo, o auto-scroll só empurra o scrollLeft). prefers-reduced-motion:
// não anima — vira um scroller manual. Estilo herda o do site (dark glassy + laranja).
import { useEffect, useRef } from 'react'

type Depoimento = { texto: string; nome: string; contexto?: string }

// ⚠️ Depoimentos REAIS (curados de feedbacks/chamados de clientes). Editar/curar aqui.
const DEPOIMENTOS: Depoimento[] = [
  { texto: 'Amo o SOA, me ajuda muito. Vocês estão de parabéns!', nome: 'Greyce', contexto: 'Gracinha de Lembrança' },
  { texto: 'Estou amando, e o Ju está de parabéns!', nome: 'Natalia', contexto: 'Nat Personaliza' },
  { texto: 'É tão incrível que dá pra organizar tudo num lugar só.', nome: 'Jenifer', contexto: 'Tutti Frutti Criativa' },
  { texto: 'Estou adorando o sistema.', nome: 'Elisângela', contexto: 'Lis Personalizados' },
  { texto: 'O novo módulo estilo quadro de tarefas? Amei!', nome: 'Folha Mágica', contexto: 'Ateliê' },
  { texto: 'Gostando muito das funcionalidades, ficou excelente pro nosso modelo de negócio.', nome: 'David', contexto: 'Gráfica Degrade Criative Design' },
  { texto: 'Mandei a sugestão e vocês habilitaram na hora. Agradeço demais!', nome: 'Carolline', contexto: 'Mimos com Capricho' },
  { texto: 'Impagável pelo que entrega.', nome: 'Káh', contexto: 'Personalizadus da Káh · Aluna Shopee' },
  { texto: 'Aqui consigo acompanhar cada detalhe.', nome: 'Rafa', contexto: 'Rafa Arts Personalizados' },
  { texto: 'Adorei o sistema, achei formidável!', nome: 'Artesã SOA', contexto: '' },
]

const CORES = ['#f97316', '#e11d48', '#8b5cf6', '#0ea5e9', '#10b981', '#eab308']

function Card({ d, i }: { d: Depoimento; i: number }) {
  const inicial = (d.nome || '?').trim().charAt(0).toUpperCase()
  const cor = CORES[i % CORES.length]
  return (
    <figure className="flex w-[300px] shrink-0 flex-col justify-between rounded-[24px] border border-white/10 bg-white/5 p-6 sm:w-[340px]">
      <div>
        <div className="mb-3 text-orange-400" aria-label="5 estrelas">★★★★★</div>
        <blockquote className="text-[15px] leading-relaxed text-slate-100">“{d.texto}”</blockquote>
      </div>
      <figcaption className="mt-5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: cor }}>{inicial}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{d.nome}</span>
          {d.contexto ? <span className="block truncate text-xs text-slate-400">{d.contexto}</span> : null}
        </span>
      </figcaption>
    </figure>
  )
}

export default function DepoimentosCarrossel() {
  const ref = useRef<HTMLDivElement | null>(null)
  const pausado = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Respeita reduced-motion: sem auto-scroll (fica scroller manual/swipe).
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const passo = () => {
      if (el && !pausado.current) {
        el.scrollLeft += 0.5
        // Loop sem emenda: a lista está duplicada, então ao passar da metade volta pro início.
        const metade = el.scrollWidth / 2
        if (metade > 0 && el.scrollLeft >= metade) el.scrollLeft -= metade
      }
      raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [])

  const pausar = () => { pausado.current = true }
  const retomar = () => { pausado.current = false }

  // Lista duplicada para o loop contínuo.
  const lista = [...DEPOIMENTOS, ...DEPOIMENTOS]

  return (
    <div className="mt-14">
      <div
        ref={ref}
        onMouseEnter={pausar} onMouseLeave={retomar}
        onPointerDown={pausar} onPointerUp={retomar} onPointerCancel={retomar}
        onTouchStart={pausar} onTouchEnd={retomar}
        className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: 'linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)' }}
        aria-label="Depoimentos de clientes"
      >
        {lista.map((d, i) => <Card key={i} d={d} i={i} />)}
      </div>
    </div>
  )
}
