'use client'

import { useState } from 'react'
import { CANAIS_ORIGEM } from '@/lib/canais'

// Select de origem do cliente: lista os canais conhecidos + "Outro…" que abre
// um campo livre para cadastrar uma origem que não está na lista.
export default function OrigemSelect({
  value, onChange, className,
}: { value: string; onChange: (v: string) => void; className?: string }) {
  const isCustom = !!value && !(CANAIS_ORIGEM as readonly string[]).includes(value)
  const [outro, setOutro] = useState(isCustom)
  const showFree = outro || isCustom

  return (
    <div className="space-y-1.5">
      <select
        className={className}
        value={showFree ? '__OUTRO__' : value}
        onChange={e => {
          const v = e.target.value
          if (v === '__OUTRO__') { setOutro(true); onChange('') }
          else { setOutro(false); onChange(v) }
        }}
      >
        <option value="">— Selecione —</option>
        {CANAIS_ORIGEM.map(c => <option key={c} value={c}>{c}</option>)}
        <option value="__OUTRO__">Outro…</option>
      </select>
      {showFree && (
        <input
          className={className}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Digite a origem"
        />
      )}
    </div>
  )
}
