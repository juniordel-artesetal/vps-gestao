// Selo do canal — badge colorido com nome + ícone. Consistente em todo o sistema.
import { canalVisual } from '@/lib/canalVisual'

export default function CanalBadge({ canal, sub, label, className = '' }: { canal?: string | null; sub?: string | null; label?: string | null; className?: string }) {
  const v = canalVisual(canal, sub, label)
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${v.classe} ${className}`}>
      <span>{v.emoji}</span>{v.label}
    </span>
  )
}
