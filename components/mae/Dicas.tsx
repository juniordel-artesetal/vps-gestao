'use client'
// DICAS (Lote 1, item 14): ao passar o mouse em QUALQUER botão do Método MAE, uma janelinha com o nome da
// ferramenta, uma frase curta do que ela faz e o atalho. A dica vem do dicionário (lib/mae/ajuda/dicas.ts)
// pelo atributo data-* do botão, pelo texto, ou pelo title — que é tirado na hora para o navegador não
// mostrar a dica dele por cima.
import { useEffect, useState } from 'react'
import { DICAS, dicaDe, type Dica } from '@/lib/mae/ajuda/dicas'

const ALVO = 'button, select, a[href], [data-dica], [data-titulo-prancheta]'

function dicaDoElemento(el: HTMLElement): Dica | null {
  const chave = el.getAttribute('data-dica')
  if (chave && DICAS[chave]) return DICAS[chave]
  const attrs: Record<string, string> = {}
  for (const n of el.getAttributeNames()) if (n.startsWith('data-')) attrs[n] = el.getAttribute(n) ?? ''
  const titulo = el.getAttribute('title') ?? el.dataset.dicaTitulo ?? ''
  const texto = el.tagName === 'SELECT' ? '' : (el.innerText || el.textContent || '')
  return dicaDe(attrs, texto.slice(0, 60), titulo, el.getAttribute('aria-label') ?? '')
}

export default function DicasMae() {
  const [dica, setDica] = useState<{ d: Dica; x: number; y: number } | null>(null)
  useEffect(() => {
    let atual: HTMLElement | null = null, timer: ReturnType<typeof setTimeout> | null = null
    const restaurar = () => { if (atual?.dataset.dicaTitulo !== undefined) { atual.setAttribute('title', atual.dataset.dicaTitulo); delete atual.dataset.dicaTitulo } atual = null }
    const sobre = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(ALVO) as HTMLElement | null
      if (el === atual) return
      restaurar(); if (timer) clearTimeout(timer); setDica(null)
      if (!el || !el.closest('[data-mae-raiz]')) return
      atual = el
      // o title vira a nossa dica (sem a do navegador por cima)
      const t = el.getAttribute('title'); if (t !== null) { el.dataset.dicaTitulo = t; el.removeAttribute('title') }
      const d = dicaDoElemento(el)
      if (!d || (!d.frase && !d.atalho && d.nome.length < 2)) return
      const r = el.getBoundingClientRect()
      timer = setTimeout(() => setDica({ d, x: Math.min(window.innerWidth - 260, Math.max(8, r.left)), y: r.bottom + 6 > window.innerHeight - 70 ? r.top - 64 : r.bottom + 6 }), 350)
    }
    const fora = () => { restaurar(); if (timer) clearTimeout(timer); setDica(null) }
    document.addEventListener('mouseover', sobre)
    document.addEventListener('mousedown', fora, true)
    window.addEventListener('scroll', fora, true)
    return () => { document.removeEventListener('mouseover', sobre); document.removeEventListener('mousedown', fora, true); window.removeEventListener('scroll', fora, true); fora() }
  }, [])
  if (!dica) return null
  return (
    <div role="tooltip" className="pointer-events-none fixed z-[100] max-w-[250px] rounded-lg bg-gray-900/95 px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg" style={{ left: dica.x, top: dica.y }} data-dica-janela>
      <p className="font-semibold">{dica.d.nome}{dica.d.atalho && <kbd className="ml-1.5 rounded bg-white/15 px-1 py-px font-mono text-[10px] font-normal">{dica.d.atalho}</kbd>}</p>
      {dica.d.frase && <p className="text-gray-200">{dica.d.frase}</p>}
    </div>
  )
}
