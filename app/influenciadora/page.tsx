// Página pública do Programa de Influenciadoras. Gateada por INFLUENCIADORAS_ATIVO:
// com a flag OFF, a rota nem existe (404).
import { notFound } from 'next/navigation'
import { influenciadorasAtivo } from '@/lib/influenciadora'
import InfluenciadoraForm from './InfluenciadoraForm'

export const dynamic = 'force-dynamic'

export default function InfluenciadoraPage() {
  if (!influenciadorasAtivo()) notFound()
  return <InfluenciadoraForm />
}
