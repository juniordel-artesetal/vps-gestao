'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { LayoutDashboard, DollarSign, TrendingUp, Brain, Settings, LogOut } from 'lucide-react'

const modulos = [
  {
    href: '/dashboard',
    label: 'Produção',
    descricao: 'Pedidos, demandas e controle de produção',
    icon: LayoutDashboard,
    cor: 'bg-purple-50 text-purple-600',
    roles: ['ADMIN', 'DELEGADOR', 'OPERADOR'],
  },
  {
    href: '/precificacao',
    label: 'Precificação',
    descricao: 'Materiais, produtos, combos e canais',
    icon: DollarSign,
    cor: 'bg-blue-50 text-blue-600',
    roles: ['ADMIN'],
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    descricao: 'Lançamentos, fluxo de caixa e metas',
    icon: TrendingUp,
    cor: 'bg-green-50 text-green-600',
    roles: ['ADMIN'],
  },
  {
    href: '/gestao',
    label: 'Análise de Gestão',
    descricao: 'Chat com IA para análise do negócio',
    icon: Brain,
    cor: 'bg-amber-50 text-amber-600',
    roles: ['ADMIN'],
  },
  {
    href: '/config/geral',
    label: 'Configurações',
    descricao: 'Tema, produção e dados do negócio',
    icon: Settings,
    cor: 'bg-gray-50 text-gray-600',
    roles: ['ADMIN'],
  },
]

export default function ModulosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  )

  const role = session?.user?.role
  const modulosVisiveis = modulos.filter(m => m.roles.includes(role || ''))

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">VPS Gestão</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {session?.user?.workspaceNome} · {session?.user?.name}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modulosVisiveis.map(modulo => {
            const Icon = modulo.icon
            return (
              <a
                key={modulo.href}
                href={modulo.href}
                className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 transition group"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${modulo.cor}`}>
                  <Icon size={20} />
                </div>
                <h2 className="font-medium text-gray-900 mb-1 group-hover:text-purple-600 transition">
                  {modulo.label}
                </h2>
                <p className="text-xs text-gray-500">{modulo.descricao}</p>
              </a>
            )
          })}
        </div>

      </div>
    </div>
  )
}