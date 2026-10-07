'use client'
// Lote 4 do MAE (item 38): RECOLHER O MENU PRINCIPAL DO SOA — para sobrar tela no editor. Vale para o SOA
// inteiro; a escolha fica lembrada neste navegador. No Método MAE o menu já abre recolhido (e o que a usuária
// escolher lá fica lembrado à parte).
import { useCallback, useEffect, useState } from 'react'

const chave = (mae: boolean) => (mae ? 'soa:menu-recolhido:mae' : 'soa:menu-recolhido')
const ler = (mae: boolean): boolean => {
  try { const v = localStorage.getItem(chave(mae)); return v === null ? mae : v === '1' } catch { return mae }
}

export function useMenuRecolhido(pathname: string | null): [boolean, (v: boolean) => void] {
  const mae = !!pathname?.startsWith('/estudio/mae')
  const [recolhido, setRecolhido] = useState(false)
  // lê depois de montar (o servidor não sabe o localStorage) — evita diferença na hidratação
  useEffect(() => { setRecolhido(ler(mae)) }, [mae])
  const mudar = useCallback((v: boolean) => {
    setRecolhido(v)
    try { localStorage.setItem(chave(mae), v ? '1' : '0') } catch { /* sem storage */ }
  }, [mae])
  return [recolhido, mudar]
}
