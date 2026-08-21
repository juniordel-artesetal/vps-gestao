'use client'
// Widget guiado de Primeiros Passos (pós-onboarding). Cada item marca ✓ sozinho quando a ação
// é feita. Some quando tudo estiver completo. Dispensável (a artesã pode fechar).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X, Sparkles } from 'lucide-react'

interface Status { setores: boolean; precoMaterial: boolean; produtos: boolean; pedido: boolean }
const PASSOS: { chave: keyof Status; label: string; href: string }[] = [
  { chave: 'setores', label: 'Confira seus setores de produção', href: '/config/producao' },
  { chave: 'precoMaterial', label: 'Preencha o preço dos seus materiais', href: '/precificacao/materiais' },
  { chave: 'produtos', label: 'Veja seus produtos já calculando o preço', href: '/precificacao/produtos' },
  { chave: 'pedido', label: 'Faça seu primeiro pedido', href: '/dashboard/pedidos' },
]

export default function PrimeirosPassos() {
  const [st, setSt] = useState<Status | null>(null)
  const [fechado, setFechado] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('primeirosPassosFechado') === '1') { setFechado(true); return }
    fetch('/api/onboarding/checklist').then(r => r.ok ? r.json() : null).then(setSt).catch(() => {})
  }, [])

  if (fechado || !st) return null
  const feitos = PASSOS.filter(p => st[p.chave]).length
  if (feitos === PASSOS.length) return null // tudo pronto → some sozinho

  function fechar() { setFechado(true); try { localStorage.setItem('primeirosPassosFechado', '1') } catch {} }

  return (
    <div className="rounded-2xl border border-orange-100 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-gray-800 dark:text-neutral-100">Primeiros passos</h3>
        <span className="text-xs text-gray-500">{feitos}/{PASSOS.length}</span>
        <button onClick={fechar} title="Fechar" className="ml-auto p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="h-1.5 rounded-full bg-orange-100 dark:bg-orange-500/20 mb-3 overflow-hidden">
        <div className="h-full bg-orange-500 transition-all" style={{ width: `${Math.round(feitos / PASSOS.length * 100)}%` }} />
      </div>
      <div className="space-y-1.5">
        {PASSOS.map(p => {
          const ok = st[p.chave]
          return (
            <Link key={p.chave} href={p.href}
              className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg transition ${ok ? 'text-gray-400' : 'text-gray-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-800'}`}>
              {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
              <span className={ok ? 'line-through' : ''}>{p.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
