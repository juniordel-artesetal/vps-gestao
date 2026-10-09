'use client'
'use no memo'
// DESLIZADOR (Lote 3, item 27): o controle deslizante + uma CAIXINHA para digitar o valor exato, com a
// unidade (pt, mm, %, °). Os dois andam juntos. Na caixinha, ↑↓ mudam 1 (Shift: 10) na unidade mostrada;
// Enter ou sair da caixa confirma. Mesma interface do <input type="range"> (os painéis só trocam a tag):
// o onChange recebe um evento com `target.value`, e os data-* vão para o controle deslizante.
import { useState, type InputHTMLAttributes, type ChangeEvent } from 'react'

type PropsRange = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value' | 'min' | 'max' | 'step'>
export interface PropsDeslizador extends PropsRange {
  value: number
  min: number
  max: number
  step?: number
  onChange: (e: ChangeEvent<HTMLInputElement> | { target: { value: string } }) => void
  /** Unidade mostrada na caixinha ('pt', 'mm', '%', '°'…). */
  unidade?: string
  /** O valor mostrado = valor × fator (ex.: 0,85 → 85 %). */
  fator?: number
  /** Casas decimais na caixinha (padrão: as do passo × fator). */
  casas?: number
  /** Classes do controle deslizante. */
  className?: string
  /** Classes do conjunto (controle + caixinha). */
  classeCaixa?: string
}

const casasDe = (passo: number) => { const s = String(passo); const i = s.indexOf('.'); return i < 0 ? 0 : Math.min(3, s.length - i - 1) }

export default function Deslizador({ value, min, max, step = 1, onChange, unidade = '', fator = 1, casas, className, classeCaixa, onPointerDown, disabled, ...rest }: PropsDeslizador) {
  const nCasas = casas ?? casasDe(step * fator)
  const mostrar = (v: number) => (Math.round(v * fator * 10 ** nCasas) / 10 ** nCasas).toLocaleString('pt-BR', { maximumFractionDigits: nCasas })
  const [texto, setTexto] = useState<string | null>(null)   // null = mostrando o valor atual
  const limitar = (v: number) => Math.min(max, Math.max(min, v))
  function aplicar(v: number) {
    if (!Number.isFinite(v)) return
    onPointerDown?.({} as never)   // começa um passo novo no Ctrl+Z (como pegar o controle)
    onChange({ target: { value: String(limitar(v)) } })
  }
  function confirmar() {
    if (texto === null) return
    const n = Number(texto.replace(/[^\d,.-]/g, '').replace(',', '.'))
    setTexto(null)
    // Lote 5 (item 67): só clicar na caixinha e sair NÃO grava nada (antes gravava o valor mostrado — herdado do
    // padrão — e o aplique virava "personalizado" sem a usuária perceber)
    if (texto.trim() === mostrar(value)) return
    if (texto.trim() !== '' && Number.isFinite(n)) aplicar(n / fator)
  }
  return (
    <span className={`flex items-center gap-1.5 ${classeCaixa ?? ''}`}>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onPointerDown={onPointerDown} onChange={onChange} className={`min-w-0 flex-1 ${className ?? 'accent-orange-500'}`} {...rest} />
      <span className="inline-flex shrink-0 items-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pr-1 focus-within:border-orange-400">
        <input type="text" inputMode="decimal" disabled={disabled} value={texto ?? mostrar(value)} aria-label={`${rest['aria-label'] ?? 'Valor'}${unidade ? ` (${unidade})` : ''}`}
          onFocus={e => { setTexto(mostrar(value)); e.target.select() }} onChange={e => setTexto(e.target.value)} onBlur={confirmar}
          onKeyDown={e => {
            if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); return }
            if (e.key === 'Escape') { setTexto(null); (e.target as HTMLInputElement).blur(); return }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              const d = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
              const novo = limitar(value + d / fator)
              aplicar(novo); setTexto(mostrar(novo))
            }
          }}
          className="w-12 bg-transparent px-1 py-0.5 text-right text-[11px] tabular-nums outline-none" data-numero />
        {unidade && <span className="text-[10px] text-gray-400">{unidade}</span>}
      </span>
    </span>
  )
}
