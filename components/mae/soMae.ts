'use client'
// Conta "só Método Mãe" (plano standalone — Lote 22, item 258): marcada no LOGIN (session.user.soMae). Para ela não
// existe produto do SOA nem Configurações: os textos falam do produto "como vem na planilha".
import { useSession } from 'next-auth/react'

export function useSoMae(): boolean {
  // fora do <SessionProvider> o useSession devolve undefined em produção — nunca derrubar a tela por isso
  const s = useSession() as ReturnType<typeof useSession> | undefined
  return (s?.data?.user as { soMae?: boolean } | undefined)?.soMae === true
}

/** Dica dos Grupos/Folhas para quem é só MAE. */
export const DICA_KIT_SO_MAE = 'O kit é achado pelo nome do produto como vem na planilha.'
