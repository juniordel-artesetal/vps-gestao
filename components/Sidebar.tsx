'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard, DollarSign, TrendingUp, Brain,
  Settings, LogOut, Menu, X, ChevronDown, ChevronRight,
  Package, ShoppingBag, BarChart2, Tag, Layers,
  Wallet, Target, Wrench, Users, ListChecks, FormInput,
  Headphones, Archive, SlidersHorizontal, Layers as LayersIcon, UserCheck,
  Building2,
} from 'lucide-react'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { NotificationBell } from '@/components/NotificationBell'
import { NovidadesModal } from '@/components/NovidadesModal'

interface Setor   { id: string; nome: string; ordem: number }
interface NavItem { href: string; label: string; icon: React.ElementType }
interface NavGroup { label: string; icon: React.ElementType; base: string; items: NavItem[] }

const PRECIFICACAO_ITEMS: NavItem[] = [
  { href: '/precificacao/materiais',        label: 'Materiais',      icon: Package     },
  { href: '/precificacao/embalagens',       label: 'Embalagens',     icon: ShoppingBag },
  { href: '/precificacao/produtos',         label: 'Produtos',       icon: Tag         },
  { href: '/precificacao/combos',           label: 'Combos',         icon: Layers      },
  { href: '/precificacao/skus',             label: 'SKUs',           icon: Tag         },
  { href: '/precificacao/canais',           label: 'Canais',         icon: BarChart2   },
  { href: '/precificacao/estoque-materiais',label: 'Est. Materiais', icon: LayersIcon  },
  { href: '/precificacao/calcular',         label: 'Calcular',       icon: DollarSign  },
  { href: '/precificacao/config-tributos',  label: 'Tributos',       icon: Settings    },
  { href: '/precificacao/oraculo',          label: 'Oráculo IA',     icon: Brain       },
  { href: '/precificacao/fornecedores',     label: 'Fornecedores',   icon: Building2   },
]

const FINANCEIRO_ITEMS: NavItem[] = [
  { href: '/financeiro',             label: 'Dashboard',      icon: BarChart2  },
  { href: '/financeiro/lancamentos', label: 'Lançamentos',    icon: Wallet     },
  { href: '/financeiro/fluxo',       label: 'Fluxo de Caixa', icon: TrendingUp },
  { href: '/financeiro/metas',       label: 'Metas',          icon: Target     },
  { href: '/financeiro/categorias',  label: 'Categorias',     icon: Tag        },
]

const CONFIG_ITEMS: NavItem[] = [
  { href: '/config/geral',          label: 'Geral',            icon: Settings          },
  { href: '/config/producao',       label: 'Produção',         icon: Wrench            },
  // MELHORIA #15: Renomeado de "Campos Est. Prod." para "Campos do Pedido"
  { href: '/config/campos-pedido',  label: 'Campos do Pedido', icon: FormInput         },
  { href: '/config/campos-estoque', label: 'Campos de Estoque',icon: SlidersHorizontal },
  { href: '/config/usuarios',       label: 'Usuários',         icon: Users             },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileAberto, setMobileAberto] = useState(false)
  const [gruposAbertos, setGruposAbertos] = useState<string[]>(['Produção'])
  const [setores, setSetores] = useState<Setor[]>([])

  // BUG #9: toggles de módulos opcionais
  const [moduloEstoque,  setModuloEstoque]  = useState(false)
  const [moduloDemandas, setModuloDemandas] = useState(false)

  useEffect(() => {
    // Carrega setores
    fetch('/api/producao/setores')
      .then(r => r.json())
      .then(d => setSetores(d.setores || []))
      .catch(() => {})

    // BUG #9: Carrega toggles de módulos do workspace
    fetch('/api/config/geral')
      .then(r => r.json())
      .then(d => {
        setModuloEstoque(!!d.moduloEstoque)
        setModuloDemandas(!!d.moduloDemandas)
      })
      .catch(() => {})
  }, [])

  // BUG #9: Estoque só aparece se moduloEstoque = true
  const producaoItems: NavItem[] = [
    { href: '/dashboard/painel',  label: 'Painel Geral', icon: LayoutDashboard },
    { href: '/dashboard/pedidos', label: 'Pedidos',      icon: Package         },
    ...setores.map(s => ({ href: `/dashboard/setor/${s.id}`, label: s.nome, icon: ListChecks })),
    ...(moduloEstoque ? [{ href: '/dashboard/estoque', label: 'Estoque', icon: Archive }] : []),
  ]

  const suporteItems: NavItem[] = [
    { href: '/suporte', label: 'Central de Suporte', icon: Headphones },
    ...(session?.user?.role === 'ADMIN'
      ? [{ href: '/suporte/admin/faq', label: 'Gerenciar FAQ', icon: ListChecks }]
      : []
    ),
  ]

  const demandasItems: NavItem[] = [
    { href: '/demandas',                   label: 'Painel',            icon: UserCheck  },
    { href: '/demandas/freelancers',       label: 'Freelancers',       icon: Users      },
    { href: '/demandas/config-pagamento',  label: 'Config. Pagamento', icon: DollarSign },
  ]

  // BUG #9: Demandas só aparece no NAV se moduloDemandas = true
  const NAV: NavGroup[] = [
    { label: 'Produção',          icon: LayoutDashboard, base: '/dashboard',    items: producaoItems      },
    { label: 'Precificação',      icon: DollarSign,      base: '/precificacao', items: PRECIFICACAO_ITEMS },
    ...(moduloDemandas ? [{ label: 'Demandas', icon: UserCheck, base: '/demandas', items: demandasItems }] : []),
    { label: 'Financeiro',        icon: TrendingUp,      base: '/financeiro',   items: FINANCEIRO_ITEMS   },
    { label: 'Análise de Gestão', icon: Brain,           base: '/gestao',       items: [{ href: '/gestao', label: 'Chat IA', icon: Brain }] },
    { label: 'Suporte',           icon: Headphones,      base: '/suporte',      items: suporteItems       },
  ]

  function toggleGrupo(label: string) {
    setGruposAbertos(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    )
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Logo + Sino de notificações */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <Image src="/logo.png" alt="VPS Gestão" width={120} height={38} priority />
        <NotificationBell />
      </div>

      {/* Workspace info */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
          {session?.user?.workspaceNome || 'Meu Negócio'}
        </div>
        <div className="text-xs text-gray-400 truncate">{session?.user?.name}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">

        {/* Dashboard Geral */}
        <a
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-2 transition ${
            pathname === '/dashboard'
              ? 'text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
          style={pathname === '/dashboard' ? { backgroundColor: 'var(--cor-primaria)' } : {}}
        >
          <LayoutDashboard size={16} />
          Dashboard Geral
        </a>

        {NAV.map(grupo => {
          const GrupoIcon = grupo.icon
          const ativo  = pathname.startsWith(grupo.base)
          const aberto = gruposAbertos.includes(grupo.label)

          return (
            <div key={grupo.label} className="mb-1">
              <button
                onClick={() => toggleGrupo(grupo.label)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition ${
                  ativo ? 'text-gray-800 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                style={ativo ? { backgroundColor: 'var(--cor-primaria-light)', color: 'var(--cor-primaria)' } : {}}
              >
                <GrupoIcon size={16} style={{ color: ativo ? 'var(--cor-primaria)' : undefined }} className={ativo ? '' : 'text-gray-400'} />
                <span className="flex-1 text-sm font-medium">{grupo.label}</span>
                {aberto ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              </button>

              {aberto && (
                <div className="ml-2 mt-0.5 flex flex-col gap-0.5">
                  {grupo.items.map(item => {
                    const ItemIcon = item.icon
                    const itemAtivo = pathname === item.href
                    return (
                      <a key={item.href} href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition ${
                          itemAtivo
                            ? 'text-white font-medium'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white'
                        }`}
                        style={itemAtivo ? { backgroundColor: 'var(--cor-primaria)' } : {}}
                      >
                        <ItemIcon size={14} />
                        <span className="truncate">{item.label}</span>
                      </a>
                    )
                  })}

                  {grupo.label === 'Produção' && session?.user?.role === 'ADMIN' && (
                    <a href="/config/producao"
                      className="flex items-center gap-2 px-3 py-1.5 text-xs transition hover:opacity-80"
                      style={{ color: 'var(--cor-primaria)' }}>
                      <Wrench size={12} /> Configurar setores →
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Configurações */}
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="px-3 py-1 mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Configurações</span>
          </div>
          {CONFIG_ITEMS.map(item => {
            const ItemIcon = item.icon
            const itemAtivo = pathname === item.href
            return (
              <a key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition mb-0.5 ${
                  itemAtivo
                    ? 'text-white font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white'
                }`}
                style={itemAtivo ? { backgroundColor: 'var(--cor-primaria)' } : {}}
              >
                <ItemIcon size={14} />
                {item.label}
              </a>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <DarkModeToggle />
        <a href="/modulos"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 transition mb-1">
          <LayoutDashboard size={14} /> Hub de módulos
        </a>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition">
          <LogOut size={14} /> Sair
        </button>
      </div>

      {/* Modal de novidades */}
      <NovidadesModal />
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setMobileAberto(true)}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-sm">
          <Menu size={18} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileAberto && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileAberto(false)} />
          <aside className="relative w-64 bg-white dark:bg-gray-900 h-full shadow-xl flex flex-col">
            <button onClick={() => setMobileAberto(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
