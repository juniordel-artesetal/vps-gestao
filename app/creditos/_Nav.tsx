'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wallet, BarChart2, History } from 'lucide-react'

const ABAS = [
  { href: '/creditos', label: 'Visão Geral', icon: BarChart2 },
  { href: '/creditos/saldos', label: 'Saldo & Pacotes', icon: Wallet },
  { href: '/creditos/historico', label: 'Histórico', icon: History },
]

export default function CreditosNav() {
  const pathname = usePathname()
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Carteira de Créditos</h1>
          <p className="text-sm text-gray-500">Créditos pré-pagos por recurso, com franquia grátis mensal.</p>
        </div>
      </div>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {ABAS.map(a => {
          const ativo = pathname === a.href
          const Icone = a.icon
          return (
            <Link key={a.href} href={a.href}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                ativo
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              <Icone className="w-4 h-4" /> {a.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
