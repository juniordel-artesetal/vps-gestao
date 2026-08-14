'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard, Package, ClipboardList, Calendar, FileText,
  DollarSign, TrendingUp, BarChart2, Scissors, Tag, Calculator,
  BookOpen, Settings, Users, HelpCircle, ChevronDown, ChevronRight,
  Menu, X, Bell, LogOut, Layers, Truck, ShoppingBag, Clock,
  Boxes, UserCog, Wrench, Building2, MessageCircle, Sun, Moon, Sparkles, ScanLine,
  Wallet, Gift, History, PanelLeft, PanelRight, PanelTop, PanelBottom, MoreVertical, CreditCard, Plug, Lock
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useMenuPos } from './MenuPosContext'
import { ehHorizontal, type MenuPos } from '@/lib/sofia/menuPosTipos'
import { pessoalBetaVisivel } from '@/lib/pessoal/beta'

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

// Descobre o MÓDULO ativo (grupo) e o item ativo a partir da rota atual — pelo href que
// melhor casa (mais longo). Funciona em sub-rotas e telas de detalhe/edição: p.ex.
// /dashboard/pedidos/123 casa com o item /dashboard/pedidos (módulo "Produção"), e
// /precificacao/materiais/x casa com "Precificação". Robusto e sem lista manual de prefixos.
function acharAtivo(grupos: { id: string; items: { href: string }[] }[], pathname: string): { grupoId: string | null; href: string | null } {
  let best = { grupoId: null as string | null, href: null as string | null, len: -1 }
  for (const g of grupos) {
    for (const it of g.items) {
      const h = it.href
      const casa = pathname === h || pathname.startsWith(h + '/')
      if (casa && h.length > best.len) best = { grupoId: g.id, href: h, len: h.length }
    }
  }
  return { grupoId: best.grupoId, href: best.href }
}

export default function Sidebar() {
  const pathname = usePathname()
  const { pos, setPos } = useMenuPos()
  const horizontal = ehHorizontal(pos)
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
  const userEmail = session?.user?.email ?? ''
  const userId = (session?.user as any)?.id ?? ''
  const pessoalBeta = pessoalBetaVisivel(userEmail, userId)   // visibilidade do Pessoal em beta (allowlist: email OU userId)

  const [setores,        setSetores]        = useState<Setor[]>([])
  const [moduloEstoque,  setModuloEstoque]  = useState(false)
  const [moduloDemandas, setModuloDemandas] = useState(true)
  const [moduloClientes, setModuloClientes] = useState(true)
  const [moduloLoja, setModuloLoja] = useState(false)
  const [moduloTarefas, setModuloTarefas] = useState(false)
  const [moduloAssistente, setModuloAssistente] = useState(false)
  const [moduloPostagem, setModuloPostagem] = useState(false)
  const [moduloWhatsapp, setModuloWhatsapp] = useState(false)
  const [moduloLojas, setModuloLojas] = useState(false)
  const [moduloCompras, setModuloCompras] = useState(false)
  const [mostrarCreditos, setMostrarCreditos] = useState(false)   // Créditos oculto por padrão; reversível por flag (moduloCreditos)
  const [marketplaceAtivo, setMarketplaceAtivo] = useState(false)
  const [pessoalAtiva, setPessoalAtiva] = useState(false)   // add-on Pessoal (só ADMIN)
  const [grupoAberto, setGrupoAberto] = useState<string>('')
  const [mobileAberto, setMobileAberto] = useState(false)
  const [notifs, setNotifs]   = useState<any[]>([])
  const [sinoAberto, setSinoAberto] = useState(false)
  const [hDropdown, setHDropdown] = useState<string | null>(null)   // dropdown aberto na barra horizontal
  const [hAnchor, setHAnchor] = useState<{ left: number; top: number; bottom: number } | null>(null)  // rect do botão âncora

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
          setModuloLoja(!!d.moduloLoja)
          setModuloTarefas(!!d.moduloTarefas)
          setModuloAssistente(!!d.moduloAssistenteCompras)
          setModuloPostagem(!!d.moduloPostagem)
          setModuloWhatsapp(!!d.moduloWhatsapp)
          setModuloLojas(!!d.moduloLojas)
          setMostrarCreditos(!!d.moduloCreditos)   // flag reversível; ausente => oculto
        })
        .catch(() => {})
      // Compras: flag própria (coluna criada sob demanda) — endpoint dedicado.
      fetch('/api/compras')
        .then(r => r.ok ? r.json() : {})
        .then((d: any) => setModuloCompras(!!d.modulo))
        .catch(() => {})
    }
    if (role === 'ADMIN') {
      // "Números do Marketplace" — OPT-IN (default desligado). Só aparece se algum canal estiver ativo.
      fetch('/api/config/marketplace')
        .then(r => r.ok ? r.json() : { canais: [] })
        .then((d: any) => setMarketplaceAtivo(Array.isArray(d.canais) && d.canais.some((c: any) => c.ativo)))
        .catch(() => {})
      // Add-on Pessoal — só busca na allowlist beta. status define /pessoal × /pessoal/ativar (cadeado).
      if (pessoalBetaVisivel(userEmail, userId)) {
        fetch('/api/pessoal/assinatura')
          .then(r => r.ok ? r.json() : null)
          .then((d: any) => setPessoalAtiva(d?.status === 'ATIVA'))
          .catch(() => {})
      }
    }
  }, [role, userEmail, userId])

  function toggleGrupo(id: string) {
    setGrupoAberto(prev => prev === id ? '' : id)
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
      id: 'loja',
      label: 'Minha Loja',
      roles: ['ADMIN'],
      hidden: !moduloLoja,
      items: [
        { href: '/minha-loja', label: 'Visão Geral', icon: BarChart2 },
        { href: '/minha-loja/pedidos', label: 'Pedidos da Loja', icon: ClipboardList },
        { href: '/config/loja/vitrine', label: 'Vitrine', icon: ShoppingBag },
        { href: '/config/loja/pagamento', label: 'Pagamentos', icon: Building2 },
        { href: '/config/loja', label: 'Administração', icon: Wrench },
      ],
    },
    {
      id: 'tarefas',
      label: 'Tarefas',
      roles: ['ADMIN', 'DELEGADOR'],
      hidden: !moduloTarefas,
      items: [
        { href: '/tarefas', label: 'Visão Geral', icon: BarChart2 },
        { href: '/tarefas/quadros', label: 'Quadros', icon: ClipboardList },
        { href: '/tarefas/minhas', label: 'Minhas Tarefas', icon: UserCog },
        { href: '/tarefas/calendario', label: 'Calendário', icon: Calendar },
        { href: '/tarefas/atividades', label: 'Atividades', icon: Clock },
      ],
    },
    {
      id: 'compras',
      label: 'Compras',
      roles: ['ADMIN'],
      hidden: !moduloCompras,
      items: [
        { href: '/compras/visao', label: 'Visão geral', icon: BarChart2 },
        { href: '/precificacao/fornecedores', label: 'Fornecedores', icon: Building2 },
        { href: '/pesquisa-preco', label: 'Pesquisar preço', icon: Sparkles },
        { href: '/compras', label: 'Pedido de compra', icon: ShoppingBag },
        { href: '/compras/historico', label: 'Histórico de compras', icon: History },
        { href: '/promocoes', label: 'Ofertas & Cupons', icon: Gift },
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
        { href: '/financeiro/contas', label: 'Contas & Conciliação', icon: Wallet },
        ...(marketplaceAtivo ? [
          { href: '/financeiro/marketplace', label: 'Números do Marketplace', icon: ShoppingBag as any },
        ] : []),
        // Consolida a gestão financeira: DRE (mesma tela /gestao/dre) + Análise IA (movida do topo).
        { href: '/gestao/dre', label: 'DRE', icon: FileText },
        { href: '/gestao', label: 'Análise IA', icon: Sparkles },
      ],
    },
    {
      // Add-on PESSOAL — só ADMIN + allowlist BETA (visibilidade). Ativa → /pessoal; inativa → /pessoal/ativar (cadeado).
      id: 'pessoal',
      label: 'Pessoal',
      roles: ['ADMIN'],
      hidden: !pessoalBeta,
      items: [
        { href: pessoalAtiva ? '/pessoal' : '/pessoal/ativar', label: pessoalAtiva ? 'Pessoal' : 'Pessoal · Ativar', icon: pessoalAtiva ? Wallet : Lock },
      ],
    },
    {
      id: 'postagem',
      label: 'Postagem',
      roles: ['ADMIN'],
      hidden: !moduloPostagem,
      items: [
        { href: '/config/logistica', label: 'Postagem & Frete', icon: Truck },
      ],
    },
    {
      id: 'lojas',
      label: 'Integração de Lojas',
      roles: ['ADMIN'],
      hidden: !moduloLojas,
      items: [
        { href: '/integracoes', label: 'Integração de Lojas', icon: ShoppingBag },
      ],
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      roles: ['ADMIN'],
      hidden: !moduloWhatsapp,
      items: [
        { href: '/config/whatsapp', label: 'WhatsApp', icon: MessageCircle },
      ],
    },
    {
      id: 'creditos',
      label: 'Créditos',
      roles: ['ADMIN'],
      hidden: !mostrarCreditos,   // oculto por padrão (feature/dados intactos); reversível pela flag moduloCreditos
      items: [
        { href: '/creditos', label: 'Visão Geral', icon: BarChart2 },
        { href: '/creditos/saldos', label: 'Saldo & Pacotes', icon: Wallet },
        { href: '/creditos/historico', label: 'Histórico', icon: History },
      ],
    },
    {
      id: 'ofertas',
      label: 'Ofertas & Cupons',
      // benefício aberto a todas as usuárias. Quando o módulo Compras está ligado, Ofertas
      // vive dentro de Compras — aqui fica só como fallback (evita sumir p/ quem não tem Compras).
      hidden: moduloCompras,
      items: [
        { href: '/promocoes', label: 'Ofertas & Cupons', icon: Gift },
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
        { href: '/config/expedicao', label: 'Expedição (leitura)', icon: ScanLine },
        { href: '/config/campos-pedido', label: 'Campos do Pedido', icon: FileText },
        { href: '/config/freelancers', label: 'Freelancers', icon: Users },
        { href: '/config/usuarios', label: 'Usuários', icon: UserCog },
        { href: '/integracoes', label: 'Integrações', icon: Plug },
        { href: '/assinatura', label: 'Minha Assinatura', icon: CreditCard },
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

  // "Visão Geral" (/dashboard) é um link fixo fora dos grupos — entra como módulo próprio.
  const mostraVisaoGeral = role === 'ADMIN' || role === 'DELEGADOR'

  // Módulo/item ativo pela rota (inclui o link fixo /dashboard como módulo "__home").
  const { grupoId: ativoGrupoId, href: ativoHref } = useMemo(
    () => acharAtivo([{ id: '__home', items: [{ href: '/dashboard' }] }, ...gruposFiltrados], pathname),
    [gruposFiltrados, pathname]
  )
  const isAtivo = (href: string) => href === ativoHref

  // Abre automaticamente o grupo do módulo ativo (vertical). Some sem forçar nenhum default.
  useEffect(() => { setGrupoAberto(ativoGrupoId && ativoGrupoId !== '__home' ? ativoGrupoId : '') }, [ativoGrupoId])

  // Fecha o dropdown horizontal ao navegar ou ao clicar fora.
  useEffect(() => { setHDropdown(null) }, [pathname])
  useEffect(() => {
    if (!hDropdown) return
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-hmenu]')) setHDropdown(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [hDropdown])

  const fechaMobile = () => setMobileAberto(false)

  // ─────────────────────────────────────────────────────────────────────────
  // Controle de POSIÇÃO do menu (4 opções) — discreto, some no mobile.
  const OPCOES_POS: { v: MenuPos; icon: any; label: string }[] = [
    { v: 'left',   icon: PanelLeft,   label: 'Menu à esquerda' },
    { v: 'top',    icon: PanelTop,    label: 'Menu em cima' },
    { v: 'bottom', icon: PanelBottom, label: 'Menu embaixo' },
    { v: 'right',  icon: PanelRight,  label: 'Menu à direita' },
  ]
  const renderPosControl = (className = '') => (
    <div className={`hidden lg:flex items-center gap-0.5 ${className}`} role="group" aria-label="Posição do menu">
      {OPCOES_POS.map(o => {
        const Icon = o.icon
        const on = pos === o.v
        return (
          <button
            key={o.v}
            onClick={() => setPos(o.v)}
            title={o.label}
            aria-label={o.label}
            aria-pressed={on}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
              on ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={15} />
          </button>
        )
      })}
    </div>
  )

  // Sino de notificações (reutilizado nas duas orientações).
  const renderSino = (align: 'left' | 'right' = 'left') => (
    <div className="relative flex-shrink-0" data-hmenu>
      <button
        onClick={() => setSinoAberto(p => { const aberto = !p; if (aberto) fetch('/api/notificacoes/lidas', { method: 'POST' }).catch(() => {}); return aberto })}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        aria-label="Notificações"
      >
        <Bell size={16} className="text-gray-500 dark:text-gray-400" />
        {notifs.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
      </button>
      {sinoAberto && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-10 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[200] overflow-hidden`}>
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
  )

  // ─────────────────────────────────────────────────────────────────────────
  // NAV VERTICAL (esquerda/direita e drawer mobile).
  const navVertical = (
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
          {renderSino('left')}
        </div>
        {/* Posição do menu (desktop) */}
        <div className="mt-2 hidden lg:flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">Posição do menu</span>
          {renderPosControl()}
        </div>
      </div>

      {/* Dashboard Geral — link fixo fora dos grupos */}
      {mostraVisaoGeral && (
        <div className="px-2 pt-2 pb-1">
          <Link
            href="/dashboard"
            onClick={fechaMobile}
            className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isAtivo('/dashboard')
                ? 'bg-orange-500 text-white font-semibold shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {isAtivo('/dashboard') && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-orange-200" />}
            <LayoutDashboard size={16} className="flex-shrink-0" />
            <span className="truncate">Visão Geral</span>
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {gruposFiltrados.map(grupo => {
          const aberto = grupoAberto === grupo.id
          const moduloAtivo = grupo.id === ativoGrupoId
          const simples = grupo.items.length === 1

          if (simples) {
            const item = grupo.items[0]
            const Icon = item.icon
            const ativo = isAtivo(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={fechaMobile}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  ativo
                    ? 'bg-orange-500 text-white font-semibold shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {ativo && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-orange-200" />}
                <Icon size={16} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          }

          return (
            <div key={grupo.id}>
              {/* Cabeçalho do grupo — realça o MÓDULO ativo */}
              <button
                onClick={() => toggleGrupo(grupo.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  moduloAtivo
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-1.5 uppercase text-xs tracking-wide">
                  {moduloAtivo && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                  {grupo.label}
                </span>
                {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {/* Items do grupo */}
              {aberto && (
                <div className={`ml-2 mt-0.5 space-y-0.5 border-l pl-2 ${moduloAtivo ? 'border-orange-300 dark:border-orange-700' : 'border-gray-100 dark:border-gray-800'}`}>
                  {grupo.items.map(item => {
                    const Icon = item.icon
                    const ativo = isAtivo(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={fechaMobile}
                        className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                          ativo
                            ? 'bg-orange-500 text-white font-semibold shadow-sm'
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
        <button
          onClick={toggleDark}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
        <Link
          href="/suporte"
          onClick={fechaMobile}
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

  // ─────────────────────────────────────────────────────────────────────────
  // NAV HORIZONTAL (em cima/embaixo) — barra com scroll dos módulos + dropdowns.
  const dropAcima = pos === 'bottom'   // barra embaixo → dropdown abre pra cima

  // Um "módulo" da barra: link direto (grupo com 1 item) ou botão com dropdown.
  const moduloHorizontal = (grupo: NavGroup & { items: NavItem[] }) => {
    const moduloAtivo = grupo.id === ativoGrupoId
    const barra = (
      <span className={`absolute left-2 right-2 h-0.5 rounded-full bg-orange-400 ${dropAcima ? 'top-0' : 'bottom-0'}`} />
    )
    if (grupo.items.length === 1) {
      const item = grupo.items[0]
      const Icon = item.icon
      const ativo = isAtivo(item.href)
      return (
        <Link
          key={grupo.id}
          href={item.href}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
            ativo ? 'bg-orange-500 text-white font-semibold shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Icon size={15} className="flex-shrink-0" />
          <span>{item.label}</span>
          {ativo && barra}
        </Link>
      )
    }
    const aberto = hDropdown === grupo.id
    // O dropdown é renderizado FORA da <nav> (que rola horizontalmente e cortaria o balão):
    // aqui só o botão, ancorado por getBoundingClientRect → balão fixo em renderHDropdown().
    return (
      <button
        key={grupo.id}
        data-hmenu
        onClick={(e) => {
          if (aberto) { setHDropdown(null); return }
          const r = e.currentTarget.getBoundingClientRect()
          setHAnchor({ left: r.left, top: r.top, bottom: r.bottom })
          setHDropdown(grupo.id)
        }}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
          moduloAtivo
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-semibold'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        aria-expanded={aberto}
      >
        {moduloAtivo && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
        <span>{grupo.label}</span>
        <ChevronDown size={13} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
        {moduloAtivo && barra}
      </button>
    )
  }

  // Balão do submenu (posição FIXA, ancorado no botão) — escapa do overflow da barra.
  const renderHDropdown = () => {
    if (!hDropdown || !hAnchor) return null
    const grupo = gruposFiltrados.find(g => g.id === hDropdown)
    if (!grupo) return null
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0
    const left = Math.max(8, Math.min(hAnchor.left, vw - 230))
    const style: React.CSSProperties = dropAcima
      ? { left, bottom: vh - hAnchor.top + 4 }
      : { left, top: hAnchor.bottom + 4 }
    return (
      <div data-hmenu style={style} className="fixed min-w-[210px] max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[120] p-1">
        {grupo.items.map(item => {
          const Icon = item.icon
          const ativo = isAtivo(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setHDropdown(null)}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                ativo ? 'bg-orange-500 text-white font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon size={14} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    )
  }

  const navHorizontal = (
    <div className="flex items-center gap-2 w-full h-full px-3">
      {/* Logo compacto */}
      <Link href={mostraVisaoGeral ? '/dashboard' : '/suporte'} className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow">
          <span className="text-white font-bold text-[10px]">SOA</span>
        </div>
        <span className="hidden xl:block text-xs font-semibold text-gray-700 dark:text-gray-200 max-w-[120px] truncate">{workspaceNome}</span>
      </Link>

      {/* Balão do submenu (fixo, fora do overflow da barra) */}
      {renderHDropdown()}

      {/* Módulos com scroll horizontal (scrollbar oculta; roda do mouse rola na horizontal
          pra nenhum módulo ficar inacessível). Fecha o submenu ao rolar (balão é fixo). */}
      <nav
        data-hmenu
        onScroll={() => setHDropdown(null)}
        onWheel={(e) => { const el = e.currentTarget; if (el.scrollWidth > el.clientWidth && e.deltaY !== 0) el.scrollLeft += e.deltaY }}
        className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar px-1"
      >
        {mostraVisaoGeral && (
          <Link
            href="/dashboard"
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              isAtivo('/dashboard') ? 'bg-orange-500 text-white font-semibold shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <LayoutDashboard size={15} className="flex-shrink-0" />
            <span>Visão Geral</span>
            {isAtivo('/dashboard') && <span className={`absolute left-2 right-2 h-0.5 rounded-full bg-orange-400 ${dropAcima ? 'top-0' : 'bottom-0'}`} />}
          </Link>
        )}
        {gruposFiltrados.map(g => moduloHorizontal(g))}
      </nav>

      {/* Cluster à direita */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {renderSino('right')}
        <button
          onClick={toggleDark}
          title={isDark ? 'Modo claro' : 'Modo escuro'}
          aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {renderPosControl('mx-1')}
        <MenuUsuarioHorizontal
          userName={userName}
          role={role}
          dropAcima={dropAcima}
        />
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop — vertical (esquerda/direita) OU horizontal (topo/rodapé) */}
      {horizontal ? (
        <header className={`hidden lg:flex items-center h-14 w-full flex-shrink-0 bg-white dark:bg-gray-900 z-30 ${pos === 'bottom' ? 'border-t' : 'border-b'} border-gray-100 dark:border-gray-800`}>
          {navHorizontal}
        </header>
      ) : (
        <aside className={`hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-gray-900 flex-shrink-0 ${pos === 'right' ? 'border-l' : 'border-r'} border-gray-100 dark:border-gray-800`}>
          {navVertical}
        </aside>
      )}

      {/* Mobile — botão hamburguer (posição do menu não se aplica no mobile: sempre drawer) */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileAberto(!mobileAberto)}
          className="w-10 h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow flex items-center justify-center text-gray-600 dark:text-gray-300"
          aria-label="Abrir menu"
        >
          {mobileAberto ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile — drawer */}
      {mobileAberto && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={fechaMobile}
          />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 z-50 overflow-hidden">
            {navVertical}
          </aside>
        </>
      )}
    </>
  )
}

// Menu da usuária na barra horizontal (kebab): abrir chamado, hub, sair.
function MenuUsuarioHorizontal({ userName, role, dropAcima }: { userName: string; role: Role; dropAcima: boolean }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!aberto) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [aberto])
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto(p => !p)}
        className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        aria-label="Menu da usuária"
      >
        <span className="w-7 h-7 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-orange-600 dark:text-orange-300 text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
        </span>
        <MoreVertical size={15} className="text-gray-400" />
      </button>
      {aberto && (
        <div className={`absolute right-0 ${dropAcima ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[120] p-1`}>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{userName}</p>
            <p className="text-[11px] text-gray-400">{role === 'ADMIN' ? 'Administradora' : role === 'DELEGADOR' ? 'Delegadora' : 'Operadora'}</p>
          </div>
          <Link href="/suporte" onClick={() => setAberto(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition">
            <MessageCircle size={15} /> <span>Abrir Chamado</span>
          </Link>
          <Link href="/modulos" onClick={() => setAberto(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <Layers size={15} /> <span>Hub de módulos</span>
          </Link>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition">
            <LogOut size={15} /> <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  )
}
