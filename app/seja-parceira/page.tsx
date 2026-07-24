// Página pública do Programa de Parceiras — gateada por PARCEIRAS_ATIVO.
// Server Component fino: lê a flag no servidor (env não-pública) e, se ligada,
// renderiza a página. Flag off → 404 (o programa não existe até ligarmos).
import { notFound } from 'next/navigation'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import SejaParceiraClient from './SejaParceiraClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Seja parceira do SOA — ganhe dinheiro indicando',
  description: 'Indique artesãs, ganhe comissão recorrente. Enquanto elas forem assinantes, você recebe.',
}

export default function SejaParceiraPage() {
  if (!parceirasAtivo()) notFound()
  return <SejaParceiraClient />
}
