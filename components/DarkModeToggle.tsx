'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'

export function DarkModeToggle() {
  const [dark, setDark] = useState(false)

  // Lê estado atual do HTML ao montar
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  async function toggle() {
    const novo = !dark
    setDark(novo)

    // Aplica imediatamente no DOM
    if (novo) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Salva como cookie (lido pelo servidor no próximo carregamento)
    document.cookie = `dark-mode=${novo}; path=/; max-age=${60 * 60 * 24 * 365}`

    // Recarrega para aplicar server-side (evita flash no próximo acesso)
    // Pequeno delay para a transição visual ser visível antes do reload
    setTimeout(() => window.location.reload(), 300)
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Modo claro' : 'Modo escuro'}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition w-full"
    >
      {dark
        ? <Sun  size={14} className="text-yellow-500" />
        : <Moon size={14} />
      }
      <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>
    </button>
  )
}
