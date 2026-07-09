'use client'

import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Botão "Ordenar" compartilhado — mesmas 10 opções e mesmo visual
// do botão que existia na lista de pedidos. A ordenação em si é
// SEMPRE server-side (o valor vira o parâmetro `ordenacao` da API).
// Este componente só controla a escolha (value) e devolve pelo
// callback (onChange); a persistência (localStorage) fica a cargo
// de quem usa, porque a chave varia por contexto (lista/setor).
// ─────────────────────────────────────────────────────────────

export const OPCOES_ORDEM_PEDIDOS: { value: string; label: string }[] = [
  { value: '',                  label: 'Padrão (mais recentes)' },
  { value: 'data_entrada_asc',  label: '📅 Data de entrada — mais antiga' },
  { value: 'data_entrada_desc', label: '📅 Data de entrada — mais recente' },
  { value: 'data_envio_asc',    label: '🚚 Data de envio — mais próxima' },
  { value: 'data_envio_desc',   label: '🚚 Data de envio — mais distante' },
  { value: 'valor_asc',         label: '💰 Valor — menor primeiro' },
  { value: 'valor_desc',        label: '💰 Valor — maior primeiro' },
  { value: 'canal_asc',         label: '🏪 Canal — A→Z' },
  { value: 'destinatario_asc',  label: '👤 Nome — A→Z' },
  { value: 'destinatario_desc', label: '👤 Nome — Z→A' },
]

export default function OrdenarPedidos({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className={`relative ${className}`}>
      <button onClick={() => setMenuAberto(p => !p)}
        className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition ${value ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
        <ArrowUpDown size={13} />
        Ordenar {value && '●'}
      </button>
      {menuAberto && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1 min-w-56">
          {OPCOES_ORDEM_PEDIDOS.map(op => (
            <button key={op.value} onClick={() => { onChange(op.value); setMenuAberto(false) }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition ${value === op.value ? 'text-orange-600 font-medium bg-orange-50 dark:bg-orange-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
              {op.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
