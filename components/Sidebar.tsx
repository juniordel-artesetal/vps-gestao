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
  Boxes, UserCog, Wrench, Building2, MessageCircle, Sun, Moon
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
  roles?:  Role[]
  hidden?: boolean
  items:   NavItem[]
}

function grupoInicial(pathname: string): string {
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/demandas') || pathname.startsWith('/orcamentos')) return 'producao'
  if (pathname.startsWith('/clientes')) return 'clientes'
  if (pathname.startsWith('/precificacao')) return 'precificacao'
  if (pathname.startsWith('/financeiro')) return 'financeiro'
  if (pathname.startsWith('/gestao')) return 'gestao'
  if (pathname.startsWith('/config') || pathname.startsWith('/usuarios')) return 'config'
  if (pathname.startsWith('/suporte')) return 'suporte'
  if (pathname.startsWith('/stars')) return 'stars'
  return 'producao'
}

export default function Sidebar() {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    document.cookie = `theme=${next ? 'dark' : 'light'};path=/;max-age=31536000`
  }
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role ?? 'OPERADOR'
  const workspaceNome = (session?.user as any)?.workspaceNome ?? ''
  const userName = session?.user?.name ?? ''

  const [setores,        setSetores]        = useState<Setor[]>([])
  const [moduloEstoque,  setModuloEstoque]  = useState(false)
  const [moduloDemandas, setModuloDemandas] = useState(true)
  const [moduloClientes, setModuloClientes] = useState(true)
  const [grupoAberto, setGrupoAberto] = useState<string>(grupoInicial(pathname))
  const [mobileAberto, setMobileAberto] = useState(false)
  const [notifs, setNotifs]   = useState<any[]>([])
  const [sinoAberto, setSinoAberto] = useState(false)

  useEffect(() => {
    setGrupoAberto(grupoInicial(pathname))
  }, [pathname])

  useEffect(() => {
    fetch('/api/notificacoes')
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setNotifs(d) : [])
      .catch(() => {})
    const t = setInterval(() => {
      fetch('/api/notificacoes').then(r => r.json()).then(d => Array.isArray(d) ? setNotifs(d) : []).catch(() => {})
    }, 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (role === 'ADMIN' || role === 'DELEGADOR' || role === 'OPERADOR') {
      fetch('/api/producao/setores')
        .then(r => r.json())
        .then(d => Array.isArray(d) ? setSetores(d) : [])
        .catch(() => {})
    }
    if (role === 'ADMIN' || role === 'DELEGADOR') {
      fetch('/api/config/geral')
        .then(r => r.ok ? r.json() : {})
        .then((d: Record<string, any>) => {
          setModuloEstoque(!!d.moduloEstoque)
          setModuloDemandas(d.moduloDemandas !== false)
          setModuloClientes(!!d.moduloClientes)
        })
        .catch(() => {})
    }
  }, [role])

  function toggleGrupo(id: string) {
    setGrupoAberto(prev => prev === id ? '' : id)
  }

  function isAtivo(href: string) {
    // Rotas que devem ser match exato (não highlight em sub-rotas)
    const exatas = ['/dashboard', '/financeiro', '/gestao', '/clientes']
    if (exatas.includes(href)) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  // ── Grupos de navegação com controle de role
  const grupos: NavGroup[] = [
    {
      id: 'producao',
      label: 'Produção',
      // todos os roles veem Produção
      items: [
        { href: '/dashboard/painel', label: 'Painel Geral', icon: Layers },
        { href: '/dashboard/pedidos', label: 'Pedidos', icon: ClipboardList },
        { href: '/dashboard/calendario', label: 'Calendário', icon: Calendar },
        { href: '/dashboard/orcamentos', label: 'Orçamentos', icon: FileText, roles: ['ADMIN', 'DELEGADOR'] },
        ...(moduloEstoque ? [
          { href: '/dashboard/estoque', label: 'Estoque de Produtos', icon: Boxes, roles: ['ADMIN', 'DELEGADOR'] as Role[] },
        ] : []),
        ...setores.map(s => ({
          href: `/dashboard/setor/${s.id}`,
          label: s.icone ? `${s.icone} ${s.nome}` : s.nome,
          icon: Scissors,
        })),
      ],
    },
    {
      id: 'clientes',
      label: 'Clientes',
      roles: ['ADMIN', 'DELEGADOR'],
      hidden: !moduloClientes,
      items: [
        { href: '/clientes/visao-geral', label: 'Visão Geral', icon: BarChart2 },
        { href: '/clientes', label: 'Clientes', icon: Users },
      ],
    },
    {
      id: 'demandas',
      label: 'Trabalhos',
      roles: ['ADMIN', 'DELEGADOR'],
      hidden: !moduloDemandas,
      items: [
        { href: '/demandas', label: 'Trabalhos', icon: Users },
        { href: '/demandas/historico', label: 'Histórico', icon: Clock },
      ],
    },
    {
      id: 'precificacao',
      label: 'Precificação',
      roles: ['ADMIN', 'DELEGADOR'],
      items: [
        { href: '/precificacao/materiais', label: 'Materiais', icon: Boxes },
        ...(moduloEstoque ? [
          { href: '/precificacao/estoque-materiais', label: 'Estoque de Materiais', icon: Boxes },
        ] : []),
        { href: '/precificacao/fornecedores', label: 'Fornecedores', icon: Building2 },
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
      roles: ['ADMIN'],
      items: [
        { href: '/financeiro', label: 'Visão Geral', icon: BarChart2 },
        { href: '/financeiro/lancamentos', label: 'Entradas e Saídas', icon: DollarSign },
        { href: '/financeiro/fluxo', label: 'Caixa Diário', icon: TrendingUp },
        { href: '/financeiro/metas', label: 'Metas', icon: BarChart2 },
        { href: '/financeiro/categorias', label: 'Categorias', icon: Tag },
      ],
    },
    {
      id: 'gestao',
      label: 'Análise do Negócio',
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
    .filter(g => !g.hidden)
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
          <span className="text-white font-bold text-xs">SOA</span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">SOA</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{workspaceNome}</p>
        </div>
      </div>

      {/* Usuário logado + Sino */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-orange-600 dark:text-orange-300 text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{userName}</p>
            <p className="text-xs text-gray-400 truncate">
              {role === 'ADMIN' ? 'Administradora' : role === 'DELEGADOR' ? 'Delegadora' : 'Operadora'}
            </p>
          </div>
          {/* Sino de notificações */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setSinoAberto(p => !p)}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <Bell size={16} className="text-gray-500 dark:text-gray-400" />
              {notifs.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            {sinoAberto && (
              <div className="absolute left-0 top-10 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[200] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-xs font-semibold text-gray-700 dark:text-white">Notificações</span>
                  <button onClick={() => setSinoAberto(false)}><X size={13} className="text-gray-400" /></button>
                </div>
                {notifs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Nenhuma notificação</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {notifs.map((n: any, i: number) => (
                      <Link key={i} href={n.href || '#'}
                        onClick={() => setSinoAberto(false)}
                        className={`flex items-start gap-2.5 px-3 py-2.5 hover:brightness-95 transition cursor-pointer ${
                          n.urgencia === 'critica' ? 'bg-red-50 dark:bg-red-950' :
                          n.urgencia === 'alta'    ? 'bg-orange-50 dark:bg-orange-950' :
                          n.urgencia === 'media'   ? 'bg-yellow-50 dark:bg-yellow-950' :
                          'bg-white dark:bg-gray-900'
                        }`}>
                        <span className={`mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                          n.urgencia === 'critica' ? 'bg-red-500' :
                          n.urgencia === 'alta'    ? 'bg-orange-500' :
                          n.urgencia === 'media'   ? 'bg-yellow-500' :
                          'bg-gray-400'
                        }`} />
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${
                            n.urgencia === 'critica' ? 'text-red-700 dark:text-red-300' :
                            n.urgencia === 'alta'    ? 'text-orange-700 dark:text-orange-300' :
                            n.urgencia === 'media'   ? 'text-yellow-700 dark:text-yellow-300' :
                            'text-gray-800 dark:text-gray-100'
                          }`}>{n.titulo}</p>
                          {n.descricao && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{n.descricao}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Geral — link fixo fora dos grupos */}
      {(role === 'ADMIN' || role === 'DELEGADOR') && (
        <div className="px-2 pt-2 pb-1">
          <Link
            href="/dashboard"
            onClick={() => setMobileAberto(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isAtivo('/dashboard')
                ? 'bg-orange-500 text-white font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard size={16} className="flex-shrink-0" />
            <span className="truncate">Visão Geral</span>
          </Link>
        </div>
      )}
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
        {/* Modo escuro / claro */}
        <button
          onClick={toggleDark}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
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
