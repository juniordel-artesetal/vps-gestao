'use client'
// Casca autenticada (client): controla a DIREÇÃO do layout conforme a posição do menu
// escolhida pela usuária e expõe { pos, setPos } via contexto pro Sidebar. A posição inicial
// vem do SERVIDOR (lida do banco em AppShell), então não há "flash"/pulo no carregamento.
// Trocar a posição aplica na hora (estado) e persiste no banco (por usuária).
import { useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import { MenuPosContext } from './MenuPosContext'
import { normalizarPos, type MenuPos } from '@/lib/sofia/menuPosTipos'

export default function AppShellClient({
  posInicial,
  children,
}: {
  posInicial: MenuPos
  children: React.ReactNode
}) {
  const [pos, setPosState] = useState<MenuPos>(normalizarPos(posInicial))

  const setPos = useCallback((p: MenuPos) => {
    const np = normalizarPos(p)
    setPosState(np)
    // Persiste por usuária (segue em qualquer dispositivo). Falha silenciosa: o estado local
    // já mudou; na próxima carga o servidor relê do banco.
    fetch('/api/sofia/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuPosicao: np }),
    }).catch(() => {})
  }, [])

  // Direção só muda no desktop (lg+). No mobile é sempre coluna (o Sidebar vira drawer).
  const dirLg =
    pos === 'right'  ? 'lg:flex-row-reverse' :
    pos === 'top'    ? 'lg:flex-col' :
    pos === 'bottom' ? 'lg:flex-col-reverse' :
                       'lg:flex-row'

  return (
    <MenuPosContext.Provider value={{ pos, setPos }}>
      <div className={`flex flex-col h-screen bg-gray-50 dark:bg-gray-900 ${dirLg}`}>
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </MenuPosContext.Provider>
  )
}
