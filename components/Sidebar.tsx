'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  Brain,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Package,
  ShoppingBag,
  BarChart2,
  Tag,
  Layers,
  Wallet,
  Target,
  Wrench,
  Users,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavGroup {
  label: string
  icon: React.ElementType
  base: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    label: 'Produção',
    icon: LayoutDashboard,
    base: '/dashboard',
    items: [
      { href: '/dashboard',          label: 'Painel',       icon: LayoutDashboard },
      { href: '/dashboard/pedidos',  label: 'Pedidos',      icon: Package },
      { href: '/dashboard/demandas', label: 'Demandas',     icon: ShoppingBag },
      { href: '/dashboard/lacos',    label: 'Estoque',      icon: Layers },
    ],
  },
  {
    label: 'Precificação',
    icon: DollarSign,
    base: '/precificacao',
    items: [
      { href: '/precificacao/materiais',      label: 'Materiais',  icon: Package },
      { href: '/precificacao/embalagens',     label: 'Embalagens', icon: ShoppingBag },
      { href: '/precificacao/produtos',       label: 'Produtos',   icon: Tag },
      { href: '/precificacao/combos',         label: 'Combos',     icon: Layers },
      { href: '/precificacao/canais',         label: 'Canais',     icon: BarChart2 },
      { href: '/precificacao/calcular',       label: 'Calcular',   icon: DollarSign },
      { href: '/precificacao/config-tributos',label: 'Tributos',   icon: Settings },
      { href: '/precificacao/oraculo',        label: 'Oráculo IA', icon: Brain },
    ],
  },
  {
    label: 'Financeiro',
    icon: TrendingUp,
    base: '/financeiro',
    items: [
      { href: '/financeiro',             label: 'Dashboard',      icon: BarChart2 },
      { href: '/financeiro/lancamentos', label: 'Lançamentos',    icon: Wallet },
      { href: '/financeiro/fluxo',       label: 'Fluxo de Caixa', icon: TrendingUp },
      { href: '/financeiro/metas',       label: 'Metas',          icon: Target },
      { href: '/financeiro/categorias',  label: 'Categorias',     icon: Tag },
    ],
  },
  {
    label: 'Análise de Gestão',
    icon: Brain,
    base: '/gestao',
    items: [
      { href: '/gestao', label: 'Chat IA', icon: Brain },
    ],
  },
]

const CONFIG_ITEMS: NavItem[] = [
  { href: '/config/geral',    label: 'Geral',     icon: Settings },
  { href: '/config/producao', label: 'Produção',  icon: Wrench   },
  { href: '/config/usuarios', label: 'Usuários',  icon: Users    },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileAberto, setMobileAberto] = useState(false)
  const [gruposAbertos, setGruposAbertos] = useState<string[]>(['Produção'])

  function toggleGrupo(label: string) {
    setGruposAbertos(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    )
  }

  function isGrupoAtivo(grupo: NavGroup) {
    return pathname.startsWith(grupo.base)
  }

  function isItemAtivo(href: string) {
    return pathname === href
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <Image src="/logo.png" alt="VPS Gestão" width={140} height={45} priority />
      </div>

      {/* Workspace info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-900 truncate">
          {session?.user?.workspaceNome || 'Meu Negócio'}
        </div>
        <div className="text-xs text-gray-400 truncate">{session?.user?.name}</div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV.map(grupo => {
          const GrupoIcon = grupo.icon
          const ativo = isGrupoAtivo(grupo)
          const aberto = gruposAbertos.includes(grupo.label)

          return (
            <div key={grupo.label} className="mb-1">
              <button
                onClick={() => toggleGrupo(grupo.label)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition ${
                  ativo ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <GrupoIcon size={16} className={ativo ? 'text-orange-500' : 'text-gray-400'} />
                <span className="flex-1 text-sm font-medium">{grupo.label}</span>
                {aberto
                  ? <ChevronDown size={14} className="text-gray-400" />
                  : <ChevronRight size={14} className="text-gray-400" />
                }
              </button>

              {aberto && (
                <div className="ml-2 mt-0.5 flex flex-col gap-0.5">
                  {grupo.items.map(item => {
                    const ItemIcon = item.icon
                    const itemAtivo = isItemAtivo(item.href)
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition ${
                          itemAtivo
                            ? 'bg-orange-500 text-white font-medium'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                        }`}
                      >
                        <ItemIcon size={14} />
                        {item.label}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Configurações */}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="px-3 py-1 mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Configurações</span>
          </div>
          {CONFIG_ITEMS.map(item => {
            const ItemIcon = item.icon
            const itemAtivo = isItemAtivo(item.href)
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition mb-0.5 ${
                  itemAtivo
                    ? 'bg-orange-500 text-white font-medium'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <ItemIcon size={14} />
                {item.label}
              </a>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100">
        <a
          href="/modulos"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition mb-1"
        >
          <LayoutDashboard size={14} />
          Hub de módulos
        </a>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-50 hover:text-red-600 transition"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>

    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-100 h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile — botão hamburguer */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileAberto(true)}
          className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm"
        >
          <Menu size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Mobile — drawer */}
      {mobileAberto && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileAberto(false)} />
          <aside className="relative w-56 bg-white h-full shadow-xl flex flex-col">
            <button
              onClick={() => setMobileAberto(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
