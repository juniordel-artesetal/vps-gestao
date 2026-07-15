'use client'
// Contexto da posição do menu (por usuária). Fica em módulo próprio pra AppShellClient e
// Sidebar consumirem sem dependência circular entre eles.
import { createContext, useContext } from 'react'
import type { MenuPos } from '@/lib/sofia/menuPosTipos'

export interface MenuPosCtx {
  pos: MenuPos
  setPos: (p: MenuPos) => void
}

export const MenuPosContext = createContext<MenuPosCtx>({ pos: 'left', setPos: () => {} })
export const useMenuPos = () => useContext(MenuPosContext)
