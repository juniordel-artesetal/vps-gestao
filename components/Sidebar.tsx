'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard, Package, ClipboardList, Calendar, FileText,
  DollarSign, TrendingUp, BarChart2, Scissors, Tag, Calculator,
  BookOpen, Settings, Users, HelpCircle, ChevronDown, ChevronRight,
  Menu, X, Bell, LogOut, Layers, Truck, ShoppingBag, Clock,
  Boxes, UserCog, Wrench, Building2, MessageCircle
} from 'lucide-react'
import { signOut } from 'next-auth/react'

interface Setor {
  id: string
  nome: string
  icone?: string
}

type Role = 'ADMIN' | 'DELEGADOR' | 'OPERADOR'

interface NavItem {
  href: string
  label: string
  icon: any
  roles?: Role[]   // undefined = todos
}

interface NavGroup {
  id: string
  label: string
  roles?: Role[]
  items: NavItem[]
}

function grupoInicial(pathname: string): string {
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/demandas') || pathname.startsWith('/orcamentos')) return 'producao'
  if (pathname.startsWith('/precificacao')) return 'precificacao'
  if (pathname.startsWith('/financeiro')) return 'financeiro'
  if (pathname.startsWith('/gestao')) return 'gestao'
  if (pathname.startsWith('/config') || pathname.startsWith('/usuarios')) return 'config'
  if (pathname.startsWith('/suporte')) return 'suporte'
  return 'producao'
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role ?? 'OPERADOR'
  const workspaceNome = (session?.user as any)?.workspaceNome ?? ''
  const userName = session?.user?.name ?? ''

  const [setores, setSetores] = useState<Setor[]>([])
  const [grupoAberto, setGrupoAberto] = useState<string>(grupoInicial(pathname))
  const [mobileAberto, setMobileAberto] = useState(false)

  useEffect(() => {
    setGrupoAberto(grupoInicial(pathname))
  }, [pathname])

  useEffect(() => {
    if (role === 'ADMIN' || role === 'DELEGADOR' || role === 'OPERADOR') {
      fetch('/api/producao/setores')
        .then(r => r.json())
        .then(d => Array.isArray(d) ? setSetores(d) : [])
        .catch(() => {})
    }
  }, [role])

  function toggleGrupo(id: string) {
    setGrupoAberto(prev => prev === id ? '' : id)
  }

  function isAtivo(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  // ── Grupos de navegação com controle de role
  const grupos: NavGroup[] = [
    {
      id: 'producao',
      label: 'Produção',
      // todos os roles veem Produção
      items: [
        { href: '/dashboard', label: 'Dashboard Geral', icon: LayoutDashboard, roles: ['ADMIN', 'DELEGADOR'] },
        { href: '/dashboard/painel', label: 'Painel Geral', icon: Layers },
        { href: '/dashboard/pedidos', label: 'Pedidos', icon: ClipboardList },
        { href: '/dashboard/calendario', label: 'Calendário', icon: Calendar },
        { href: '/dashboard/orcamentos', label: 'Orçamentos', icon: FileText, roles: ['ADMIN', 'DELEGADOR'] },
        ...setores.map(s => ({
          href: `/dashboard/setor/${s.id}`,
          label: s.icone ? `${s.icone} ${s.nome}` : s.nome,
          icon: Scissors,
        })),
      ],
    },
    {
      id: 'demandas',
      label: 'Demandas',
      roles: ['ADMIN', 'DELEGADOR'],
      items: [
        { href: '/demandas', label: 'Demandas', icon: Users },
        { href: '/demandas/historico', label: 'Histórico', icon: Clock },
      ],
    },
    {
      id: 'precificacao',
      label: 'Precificação',
      roles: ['ADMIN'],
      items: [
        { href: '/precificacao/materiais', label: 'Materiais', icon: Boxes },
        { href: '/precificacao/embalagens', label: 'Embalagens', icon: Package },
        { href: '/precificacao/produtos', label: 'Produtos', icon: ShoppingBag },
        { href: '/precificacao/combos', label: 'Combos', icon: Layers },
        { href: '/precificacao/skus', label: 'SKUs', icon: Tag },
        { href: '/precificacao/canais', label: 'Canais de Venda', icon: Truck },
        { href: '/precificacao/calcular', label: 'Calculadora', icon: Calculator },
        { href: '/precificacao/config-tributos', label: 'Tributação', icon: BookOpen },
        { href: '/precificacao/oraculo', label: 'Oráculo Contábil', icon: BookOpen },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      roles: ['ADMIN', 'DELEGADOR'],
      items: [
        { href: '/financeiro', label: 'Dashboard', icon: BarChart2 },
        { href: '/financeiro/lancamentos', label: 'Lançamentos', icon: DollarSign },
        { href: '/financeiro/fluxo', label: 'Fluxo de Caixa', icon: TrendingUp },
        { href: '/financeiro/metas', label: 'Metas', icon: BarChart2 },
        { href: '/financeiro/categorias', label: 'Categorias', icon: Tag },
      ],
    },
    {
      id: 'gestao',
      label: 'Análise de Gestão',
      roles: ['ADMIN'],
      items: [
        { href: '/gestao', label: 'Análise IA', icon: BarChart2 },
      ],
    },
    {
      id: 'suporte',
      label: 'Suporte',
      // todos os roles podem acessar suporte
      items: [
        { href: '/suporte', label: 'Central de Suporte', icon: HelpCircle },
      ],
    },
    {
      id: 'config',
      label: 'Configurações',
      roles: ['ADMIN'],
      items: [
        { href: '/config/geral', label: 'Geral', icon: Settings },
        { href: '/config/producao', label: 'Produção', icon: Wrench },
        { href: '/config/campos-pedido', label: 'Campos do Pedido', icon: FileText },
        { href: '/config/freelancers', label: 'Freelancers', icon: Users },
        { href: '/config/usuarios', label: 'Usuários', icon: UserCog },
      ],
    },
  ]

  // Filtra grupos e items pelo role
  const gruposFiltrados = grupos
    .filter(g => !g.roles || g.roles.includes(role))
    .map(g => ({
      ...g,
      items: g.items.filter(i => !i.roles || i.roles.includes(role)),
    }))
    .filter(g => g.items.length > 0)

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow">
          <span className="text-white font-bold text-sm">VP</span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">VPS Gestão</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{workspaceNome}</p>
        </div>
      </div>

      {/* Usuário logado */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-orange-600 dark:text-orange-300 text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{userName}</p>
            <p className="text-xs text-gray-400 truncate">
              {role === 'ADMIN' ? 'Administradora' : role === 'DELEGADOR' ? 'Delegadora' : 'Operadora'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {gruposFiltrados.map(grupo => {
          const aberto = grupoAberto === grupo.id
          // Se só tem 1 item ou grupo com 1 item, mostrar direto sem collapse
          const simples = grupo.items.length === 1

          if (simples) {
            const item = grupo.items[0]
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileAberto(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isAtivo(item.href)
                    ? 'bg-orange-500 text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          }

          return (
            <div key={grupo.id}>
              {/* Cabeçalho do grupo */}
              <button
                onClick={() => toggleGrupo(grupo.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <span className="uppercase text-xs tracking-wide">{grupo.label}</span>
                {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {/* Items do grupo */}
              {aberto && (
                <div className="ml-2 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-gray-800 pl-2">
                  {grupo.items.map(item => {
                    const Icon = item.icon
                    const ativo = isAtivo(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileAberto(false)}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                          ativo
                            ? 'bg-orange-500 text-white font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={14} className="flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-2 py-3 space-y-0.5">
        {/* Modo escuro / claro — todos os roles */}
        {/* Botão Abrir Chamado — destaque */}
        <Link
          href="/suporte"
          onClick={() => setMobileAberto(false)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 transition-colors"
        >
          <MessageCircle size={15} />
          <span>Abrir Chamado</span>
        </Link>
        <Link
          href="/modulos"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <Layers size={15} />
          <span>Hub de módulos</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          <LogOut size={15} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-shrink-0">
        {navContent}
      </aside>

      {/* Mobile — botão hamburguer */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileAberto(!mobileAberto)}
          className="w-10 h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow flex items-center justify-center text-gray-600 dark:text-gray-300"
        >
          {mobileAberto ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile — drawer */}
      {mobileAberto && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileAberto(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 z-50 overflow-hidden">
            {navContent}
          </aside>
        </>
      )}
    </>
  )
}
