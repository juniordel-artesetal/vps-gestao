'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import Script from 'next/script'
import {
  ArrowRight,
  Check,
  Sparkles,
  BarChart3,
  Wallet,
  Boxes,
  ShieldCheck,
  MessageSquareMore,
  LayoutDashboard,
  Users,
  ChevronRight,
  Star,
} from 'lucide-react'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const HOTMART = 'https://pay.hotmart.com/C105122525T?checkoutMode=2&off=6s58g8wc'

const features = [
  {
    icon: Boxes,
    title: 'Produção sob controle',
    text: 'Do pedido à expedição, com status claros por setor, responsáveis definidos e menos retrabalho.',
  },
  {
    icon: Wallet,
    title: 'Preço sem achismo',
    text: 'Margem, taxas de canal, custos e lucro calculados com fórmula exata — Shopee, ML, Elo7 e mais.',
  },
  {
    icon: BarChart3,
    title: 'Indicadores de verdade',
    text: 'Leia seu negócio por números reais, não por sensação. Saiba exatamente onde está o lucro.',
  },
  {
    icon: MessageSquareMore,
    title: 'IA consultiva',
    text: 'Gemini analisa seus dados reais e entrega insights acionáveis para crescer com segurança.',
  },
  {
    icon: Users,
    title: 'Equipe organizada',
    text: 'Permissões por perfil (Admin, Delegador, Operador) para delegar sem perder o controle.',
  },
  {
    icon: LayoutDashboard,
    title: 'Tudo em um lugar',
    text: 'Dashboard unificado com produção, financeiro e precificação em uma única tela de decisão.',
  },
]

const proof = [
  'Controle de produção por setor',
  'Precificação automática por canal',
  'Dashboard com KPIs em tempo real',
  'Financeiro com fluxo de caixa',
  'Análise com IA (Gemini)',
  'Múltiplos usuários com permissões',
]

const faqs = [
  {
    q: 'Para qual tipo de negócio o VPS Gestão serve?',
    a: 'Para qualquer negócio artesanal: laços, costura, bijuteria, sublimação, crochê, bordado, personalização e muito mais. O sistema é configurável — você define os setores e campos do seu jeito.',
  },
  {
    q: 'Preciso saber usar computador para configurar?',
    a: 'Não. O onboarding é guiado passo a passo. Em menos de 10 minutos você já está com o sistema funcionando e seus primeiros produtos cadastrados.',
  },
  {
    q: 'O sistema funciona no celular?',
    a: 'Sim. O VPS Gestão é totalmente responsivo — funciona em qualquer dispositivo. Em breve também teremos app nativo para Android e iOS.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Não tem fidelidade nem multa. Você cancela quando quiser direto pelo painel da Hotmart, sem precisar falar com ninguém.',
  },
  {
    q: 'Como funciona a garantia de 7 dias?',
    a: 'Se em 7 dias você não amar o sistema, é só pedir o reembolso. Sem perguntas, sem formulário complicado. 100% do valor de volta.',
  },
  {
    q: 'Posso ter mais de um usuário no meu ateliê?',
    a: 'Sim. Você pode cadastrar colaboradores com diferentes níveis de acesso — cada um vê só o que precisa ver.',
  },
]

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function VpsLogo() {
  return (
    // Logo horizontal: coloque o arquivo em public/logo_vps_horizontal.png
    // Logo ícone:      coloque o arquivo em public/logo_vps_gestao.png
    <img
      src="/logo_vps_horizontal.png"
      alt="VPS Gestão"
      className="h-11 w-auto object-contain"
      style={{ mixBlendMode: 'lighten' }}
    />
  )
}

function VpsIcon() {
  return (
    <img
      src="/logo_vps_gestao.png"
      alt="VPS Gestão"
      className="h-8 w-8 object-contain rounded-xl"
      style={{ mixBlendMode: 'lighten' }}
    />
  )
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="mb-3 inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
        {eyebrow}
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-7 text-slate-300 md:text-lg">{text}</p>}
    </div>
  )
}

function BrowserFrame({ badge, children, className = '' }: { badge: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40 ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-2 flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-400">
          vps-gestao.natycostapro.com.br
        </div>
        <div className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold text-orange-200">
          {badge}
        </div>
      </div>
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

// ─── MOCKUP SCREENS ──────────────────────────────────────────────────────────

function DashboardScreen({ compact = false }: { compact?: boolean }) {
  const p = compact ? 'p-3' : 'p-5'
  const tSm = compact ? 'text-[8px]' : 'text-[10px]'
  const tMd = compact ? 'text-[10px]' : 'text-xs'
  const tLg = compact ? 'text-xs' : 'text-sm'
  return (
    <div className="flex h-full bg-[#080e1c]">
      {/* Sidebar */}
      <div className="flex w-12 flex-shrink-0 flex-col items-center gap-1.5 border-r border-white/5 bg-[#050a15] py-3">
        <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-xs font-bold text-white">V</div>
        {['📊', '📦', '💰', '💳', '🤖'].map((ic) => (
          <div key={ic} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-sm hover:bg-white/10 transition-colors">{ic}</div>
        ))}
      </div>
      {/* Main */}
      <div className={`flex flex-1 flex-col gap-3 overflow-hidden ${p}`}>
        <div className="flex items-center justify-between">
          <span className={`font-semibold text-white ${tLg}`}>Dashboard Geral</span>
          <span className={`rounded-full border border-orange-500/20 bg-orange-500/15 px-2 py-0.5 text-orange-300 ${tSm}`}>Março 2026</span>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: 'Receita', v: 'R$8.420', d: '↑ 18%', c: 'text-emerald-400' },
            { l: 'Despesas', v: 'R$2.140', d: '↑ 4%', c: 'text-orange-400' },
            { l: 'Pedidos', v: '47', d: '+12 novos', c: 'text-blue-400' },
            { l: 'Margem', v: '38%', d: '↑ 3pts', c: 'text-purple-400' },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
              <div className={`text-slate-400 ${tSm}`}>{k.l}</div>
              <div className={`font-bold ${tMd} ${k.c}`}>{k.v}</div>
              <div className={`text-emerald-400 ${tSm}`}>{k.d}</div>
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className={`mb-2 text-slate-400 ${tSm}`}>Receitas vs Despesas — últimos 6 meses</div>
          <div className="flex items-end gap-1.5" style={{ height: compact ? 52 : 80 }}>
            {[[55, 28], [62, 32], [70, 30], [65, 35], [78, 33], [92, 25]].map(([r, d], i) => (
              <div key={i} className="flex flex-1 items-end gap-0.5">
                <div className="flex-1 rounded-t bg-gradient-to-t from-orange-500/80 to-amber-300/60" style={{ height: `${r}%` }} />
                <div className="flex-1 rounded-t bg-white/15" style={{ height: `${d}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-around">
            {['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'].map((m) => (
              <span key={m} className={`text-slate-500 ${tSm}`}>{m}</span>
            ))}
          </div>
        </div>
        {/* Orders */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <div className={`mb-2 text-slate-400 ${tSm}`}>Últimos pedidos</div>
          {[
            { n: 'Kit Laços Festa x12', c: 'Shopee', s: 'Em produção', v: 'R$187', sc: 'text-orange-300 bg-orange-500/15' },
            { n: 'Headband Veludo x4', c: 'ML', s: 'Enviado', v: 'R$89', sc: 'text-emerald-300 bg-emerald-500/15' },
            { n: 'Laços Gato x6', c: 'Direto', s: 'Em produção', v: 'R$124', sc: 'text-orange-300 bg-orange-500/15' },
          ].map((o) => (
            <div key={o.n} className="flex items-center justify-between border-b border-white/5 py-1.5 last:border-0">
              <div>
                <div className={`font-medium text-white ${tSm}`}>{o.n}</div>
                <div className={`text-slate-500 ${tSm}`}>{o.c}</div>
              </div>
              <span className={`rounded-full px-1.5 py-0.5 ${tSm} ${o.sc}`}>{o.s}</span>
              <span className={`font-semibold text-white ${tSm}`}>{o.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProducaoScreen() {
  return (
    <div className="h-full bg-[#080e1c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-white">Kanban de Produção</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-slate-400">47 pedidos ativos</span>
      </div>
      <div className="grid h-[calc(100%-36px)] grid-cols-3 gap-3">
        {[
          {
            col: '📥 Novos', color: 'border-blue-500/30',
            cards: [{ n: 'Kit Laços x12', c: 'Shopee', v: 'R$187', tag: 'shopee' }, { n: 'Festa Rosa x1', c: 'Direto', v: 'R$340', tag: 'direto' }],
          },
          {
            col: '⚙️ Produzindo', color: 'border-orange-500/30',
            cards: [{ n: 'Headband x4', c: 'ML', v: 'R$89', tag: 'ml' }, { n: 'Laços Gato x6', c: 'Shopee', v: 'R$124', tag: 'shopee' }],
          },
          {
            col: '✅ Pronto', color: 'border-emerald-500/30',
            cards: [{ n: 'Kit Festa x8', c: 'Elo7', v: 'R$412', tag: 'elo7' }],
          },
        ].map(({ col, color, cards }) => (
          <div key={col} className={`rounded-xl border bg-white/[0.025] p-2.5 ${color}`}>
            <div className="mb-2 border-b border-white/10 pb-2 text-[10px] font-semibold text-slate-300">{col}</div>
            <div className="space-y-2">
              {cards.map((card) => (
                <div key={card.n} className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
                  <div className="text-[10px] font-medium text-white">{card.n}</div>
                  <div className="mt-0.5 text-[9px] text-slate-500">{card.c} · {card.v}</div>
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-medium ${
                    card.tag === 'shopee' ? 'bg-orange-500/20 text-orange-300'
                    : card.tag === 'ml' ? 'bg-yellow-500/20 text-yellow-300'
                    : card.tag === 'elo7' ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-slate-500/20 text-slate-300'
                  }`}>{card.c}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrecificacaoScreen() {
  return (
    <div className="h-full bg-[#080e1c] p-4">
      <div className="mb-3 text-xs font-semibold text-white">Precificação por Canal de Venda</div>
      <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
        <div className="grid grid-cols-4 border-b border-white/10 px-3 py-2 text-[9px] font-semibold text-slate-400">
          <span>Produto</span>
          <span className="text-center text-orange-300">Shopee</span>
          <span className="text-center text-yellow-300">Mercado Livre</span>
          <span className="text-center text-indigo-300">Elo7</span>
        </div>
        {[
          ['Laço Gato P', 'R$14,90', 'R$16,50', 'R$18,00'],
          ['Headband', 'R$22,90', 'R$25,90', 'R$29,00'],
          ['Kit Festa x12', 'R$187,00', 'R$210,00', 'R$240,00'],
          ['Laço Veludo', 'R$9,90', 'R$11,90', 'R$13,90'],
          ['Scrunchie P', 'R$12,90', 'R$14,90', 'R$16,90'],
        ].map(([prod, ...vals]) => (
          <div key={prod} className="grid grid-cols-4 border-b border-white/5 px-3 py-2 text-[10px] last:border-0">
            <span className="text-slate-200">{prod}</span>
            <span className="text-center font-semibold text-orange-300">{vals[0]}</span>
            <span className="text-center font-semibold text-yellow-300">{vals[1]}</span>
            <span className="text-center font-semibold text-indigo-300">{vals[2]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Margem Shopee', v: '34%', c: 'text-orange-400', bc: 'border-orange-500/20 bg-orange-500/10' },
          { l: 'Margem ML', v: '38%', c: 'text-yellow-400', bc: 'border-yellow-500/20 bg-yellow-500/10' },
          { l: 'Margem Elo7', v: '42%', c: 'text-indigo-400', bc: 'border-indigo-500/20 bg-indigo-500/10' },
        ].map((s) => (
          <div key={s.l} className={`rounded-xl border p-2.5 text-center ${s.bc}`}>
            <div className={`text-base font-bold ${s.c}`}>{s.v}</div>
            <div className="mt-0.5 text-[9px] text-slate-400">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinanceiroScreen() {
  return (
    <div className="h-full bg-[#080e1c] p-4">
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { l: 'Receitas', v: 'R$8.420', c: 'text-emerald-400' },
          { l: 'Despesas', v: 'R$2.140', c: 'text-red-400' },
          { l: 'Resultado', v: 'R$6.280', c: 'text-white' },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
            <div className={`text-sm font-bold ${k.c}`}>{k.v}</div>
            <div className="text-[9px] text-slate-400">{k.l}</div>
          </div>
        ))}
      </div>
      <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
        <div className="border-b border-white/10 px-3 py-2 text-[9px] font-semibold text-slate-400">Lançamentos de março</div>
        {[
          { d: 'Venda Shopee #4821', c: 'Marketplace', v: '+R$187', col: 'text-emerald-400' },
          { d: 'Materiais — Armarinho', c: 'Matéria-prima', v: '-R$340', col: 'text-red-400' },
          { d: 'Venda Direta — Ana', c: 'Venda direta', v: '+R$420', col: 'text-emerald-400' },
          { d: 'Embalagens', c: 'Suprimentos', v: '-R$89', col: 'text-red-400' },
          { d: 'Venda ML #2213', c: 'Marketplace', v: '+R$250', col: 'text-emerald-400' },
        ].map((l) => (
          <div key={l.d} className="flex items-center justify-between border-b border-white/5 px-3 py-2 last:border-0">
            <div>
              <div className="text-[10px] text-white">{l.d}</div>
              <div className="text-[9px] text-slate-500">{l.c}</div>
            </div>
            <span className={`text-xs font-semibold ${l.col}`}>{l.v}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] text-slate-400">Meta de março</span>
          <span className="text-[9px] text-orange-300 font-semibold">84%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: '84%' }} />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="text-[9px] text-slate-300">R$8.420 realizados</span>
          <span className="text-[9px] text-slate-500">Meta: R$10.000</span>
        </div>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Script
        id="hotmart-widget"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            var s=document.createElement('script');s.src='https://static.hotmart.com/checkout/widget.min.js';document.head.appendChild(s);
            var l=document.createElement('link');l.rel='stylesheet';l.type='text/css';l.href='https://static.hotmart.com/css/hotmart-fb.min.css';document.head.appendChild(l);
          `,
        }}
      />

      {/* Fixed ambient gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.12),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(234,179,8,0.08),transparent_22%),linear-gradient(180deg,#020617_0%,#020617_100%)] pointer-events-none" />

      {/* ══════════════════════════════════════ HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <VpsLogo />
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#modulos" className="transition hover:text-white">Módulos</a>
            <a href="#preco" className="transition hover:text-white">Preço</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <button
            onClick={() => (document.getElementById('hotmart-checkout-trigger') as HTMLAnchorElement)?.click()}
            className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
          >
            Assinar por R$49,90/mês
          </button>
        </div>
      </header>

      <main className="relative z-10">

        {/* Botão Hotmart oculto — aciona o modal de checkout sem sobrescrever os estilos visuais */}
        <a
          id="hotmart-checkout-trigger"
          href={HOTMART}
          className="hotmart-fb hotmart__button-checkout"
          style={{ display: 'none' }}
          aria-hidden="true"
        >checkout</a>

        {/* ══════════════════════════════════════ HERO */}
        <section className="px-6 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm text-orange-200">
                  <Sparkles className="h-4 w-4" />
                  ERP feito para artesãs 🎀
                </div>
                <h1 className="max-w-4xl text-5xl font-semibold leading-[1.06] tracking-tight text-white md:text-[68px]">
                  Organize seu ateliê do jeito que você{' '}
                  <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                    merece.
                  </span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
                  Produção, precificação e financeiro em um só lugar — simples, bonito e feito para quem cria com as mãos.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => (document.getElementById('hotmart-checkout-trigger') as HTMLAnchorElement)?.click()}
                    className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/35 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
                  >
                    Começar por R$49,90/mês <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                  <a
                    href="#modulos"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base text-white transition hover:bg-white/10"
                  >
                    Ver como funciona
                  </a>
                </div>

                {/* Stats */}
                <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
                  {[
                    ['7 dias',      'de garantia total'],
                    ['6',           'módulos completos'],
                    ['+6',          'módulos em breve'],
                  ].map(([n, l]) => (
                    <div key={n} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                      <div className="text-xl font-semibold text-orange-400">{n}</div>
                      <div className="mt-1 text-sm text-slate-400">{l}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right: hero mockup */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="absolute -left-10 top-10 h-28 w-28 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
              <BrowserFrame badge="Dashboard" className="h-[460px]">
                <div className="h-[calc(460px-40px)]">
                  <DashboardScreen />
                </div>
              </BrowserFrame>

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="absolute -right-8 top-8 z-10 rounded-2xl border border-white/12 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-base">📦</div>
                  <div>
                    <div className="text-[10px] text-slate-400">Pedidos hoje</div>
                    <div className="text-sm font-semibold text-white">47 em produção</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 0.8 }}
                className="absolute -left-8 bottom-20 z-10 rounded-2xl border border-white/12 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-base">💰</div>
                  <div>
                    <div className="text-[10px] text-slate-400">Receita do mês</div>
                    <div className="text-sm font-semibold text-white">R$8.420 ↑ 18%</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════ PROVA VISUAL — 4 MOCKUPS */}
        <section id="mockups" className="px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="o sistema por dentro"
              title="Veja o sistema em ação"
              text="Cada módulo foi pensado para o dia a dia real de quem tem um ateliê. Sem complexidade desnecessária."
            />
            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              {[
                { badge: 'Produção', content: <ProducaoScreen />, title: 'Fila de produção', sub: 'Pedidos organizados por setor, canal e prioridade — nunca mais nada esquecido.' },
                { badge: 'Precificação', content: <PrecificacaoScreen />, title: 'Precificação por canal', sub: 'Margem por marketplace, taxa embutida e lucro estimado para cada produto.' },
                { badge: 'Financeiro', content: <FinanceiroScreen />, title: 'Financeiro visual', sub: 'Entradas, saídas, metas e leitura rápida do caixa em uma tela só.' },
                { badge: 'Dashboard', content: <DashboardScreen compact />, title: 'Dashboard executivo', sub: 'KPIs em tempo real, visão financeira e produção em uma única tela.' },
              ].map((item, index) => (
                <motion.div
                  key={item.badge}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                >
                  <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40">
                    <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                      <div className="ml-2 flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-400">
                        vps-gestao.natycostapro.com.br
                      </div>
                      <div className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold text-orange-200">{item.badge}</div>
                    </div>
                    <div className="h-[260px] overflow-hidden">{item.content}</div>
                    <div className="border-t border-white/10 bg-white/[0.02] p-5">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-400">{item.sub}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ DOR — ANTES X DEPOIS */}
        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-red-400/20 bg-red-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-red-200">
                a realidade sem o sistema
              </div>
              <h3 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Sem controle, você trabalha muito e lucra pouco.
              </h3>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Não é falta de esforço. É falta de visibilidade. Quando você não vê os números, não consegue tomar as decisões certas.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'Preço no achismo = margem negativa sem perceber.',
                  'Produção na cabeça = pedido esquecido ou atrasado.',
                  'Financeiro no papel = fim do mês sem saber o resultado.',
                  'Sem dados = decisões no escuro, crescimento travado.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <ChevronRight className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-300" />
                    <p className="text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Before / After cards */}
            <div className="grid gap-4 md:grid-cols-2">

              {/* ── SEM O VPS GESTÃO ── */}
              <div className="overflow-hidden rounded-[28px] border border-red-500/20 bg-slate-950/70 p-0">
                <div className="border-b border-red-500/20 bg-red-500/5 px-5 py-3 flex items-center gap-2">
                  <span className="text-sm text-red-400">😰</span>
                  <span className="text-sm font-medium text-red-300">Sem o VPS Gestão</span>
                </div>
                <div className="space-y-3 p-4">

                  {/* Planilha bagunçada */}
                  <div className="overflow-hidden rounded-xl border border-red-500/20 bg-red-950/20">
                    <div className="flex items-center gap-1.5 border-b border-red-500/15 bg-red-950/30 px-2 py-1.5">
                      <span className="text-[9px] text-red-400">📊</span>
                      <span className="text-[9px] text-red-300 line-through">planilha_pedidos_FINAL_v3_CERTO.xlsx</span>
                    </div>
                    <div className="overflow-x-auto p-1">
                      <table className="w-full border-collapse text-[7px]">
                        <thead>
                          <tr className="bg-white/5">
                            <td className="border border-white/10 px-1.5 py-1 text-slate-400">Produto</td>
                            <td className="border border-white/10 px-1.5 py-1 text-slate-400">Preço</td>
                            <td className="border border-white/10 px-1.5 py-1 text-slate-400">Custo</td>
                            <td className="border border-white/10 px-1.5 py-1 text-slate-400">Margem</td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-white/10 px-1.5 py-1 text-white">Laço Gato P</td>
                            <td className="border border-red-500/20 px-1.5 py-1 text-red-400 line-through">R$12</td>
                            <td className="border border-white/10 px-1.5 py-1 text-yellow-400">???</td>
                            <td className="border border-red-500/20 px-1.5 py-1 text-red-400">-8% 💸</td>
                          </tr>
                          <tr className="bg-red-950/10">
                            <td className="border border-white/10 px-1.5 py-1 text-white">Kit Festa</td>
                            <td className="border border-white/10 px-1.5 py-1 text-orange-300">R$180??</td>
                            <td className="border border-white/10 px-1.5 py-1 text-yellow-400">#ERRO!</td>
                            <td className="border border-red-500/20 px-1.5 py-1 text-red-400">#REF!</td>
                          </tr>
                          <tr>
                            <td className="border border-white/10 px-1.5 py-1 text-white">Headband</td>
                            <td className="border border-white/10 px-1.5 py-1 text-slate-400 line-through">R$25</td>
                            <td className="border border-white/10 px-1.5 py-1 text-slate-500">...</td>
                            <td className="border border-red-500/20 px-1.5 py-1 text-red-400">❌</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="px-2 py-1 text-[7px] text-red-400/70">⚠️ Fórmula quebrada na linha 14</div>
                  </div>

                  {/* Mensagem de reclamação */}
                  <div className="rounded-xl border border-red-500/25 bg-red-950/25 p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/30 text-[10px]">😠</div>
                      <span className="text-[9px] font-semibold text-red-300">Cliente — WhatsApp</span>
                      <span className="ml-auto text-[8px] text-slate-500">há 2h</span>
                    </div>
                    <div className="rounded-lg bg-red-950/40 px-2.5 py-2 text-[9px] leading-relaxed text-red-200">
                      "Cadê meu pedido?? Paguei faz 3 SEMANAS! Nunca mais compro com você 😡🤬"
                    </div>
                  </div>

                  {/* Símbolos de prejuízo */}
                  <div className="flex items-center justify-center gap-3 rounded-xl border border-red-500/15 bg-red-950/15 py-3">
                    <div className="text-center">
                      <div className="text-xl">💸</div>
                      <div className="mt-1 text-[8px] text-red-400">Prejuízo</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl">📉</div>
                      <div className="mt-1 text-[8px] text-red-400">Queda</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl">😓</div>
                      <div className="mt-1 text-[8px] text-red-400">Estresse</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl">❌</div>
                      <div className="mt-1 text-[8px] text-red-400">Sem controle</div>
                    </div>
                  </div>

                </div>
              </div>

              {/* ── COM O VPS GESTÃO ── */}
              <div className="overflow-hidden rounded-[28px] border border-orange-400/20 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.16),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.95))] p-0 shadow-2xl shadow-orange-500/10">
                <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center gap-2">
                  <span className="text-sm">✨</span>
                  <span className="text-sm font-medium text-orange-200">Com o VPS Gestão</span>
                </div>
                <div className="space-y-3 p-4">

                  {/* KPIs rápidos */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                      <div className="text-[9px] text-slate-400">Margem Shopee</div>
                      <div className="text-sm font-bold text-emerald-400">34% ↑</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                      <div className="text-[9px] text-slate-400">Pedidos no prazo</div>
                      <div className="text-sm font-bold text-orange-400">98% ✓</div>
                    </div>
                  </div>

                  {/* Mini chart */}
                  <div className="h-20 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.16),transparent_35%)]">
                    <div className="flex h-full items-end gap-1 p-3">
                      {[35, 55, 42, 78, 64, 88, 96].map((v, i) => (
                        <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-orange-500/80 to-amber-300/60" style={{ height: `${v}%` }} />
                      ))}
                    </div>
                  </div>

                  {/* Tudo sob controle */}
                  <div className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3 text-sm font-semibold text-slate-950">
                    Tudo sob controle 🎉
                  </div>

                  {/* Mensagem de elogio */}
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/25 p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-[10px]">😍</div>
                      <span className="text-[9px] font-semibold text-emerald-300">Cliente — WhatsApp</span>
                      <span className="ml-auto text-[8px] text-slate-500">agora</span>
                    </div>
                    <div className="rounded-lg bg-emerald-950/40 px-2.5 py-2 text-[9px] leading-relaxed text-emerald-200">
                      "AMEI!! Chegou super rápido e tudo perfeito 😭❤️ Já indiquei para minhas amigas!"
                    </div>
                  </div>

                  {/* Símbolos de satisfação */}
                  <div className="flex items-center justify-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-950/15 py-3">
                    <div className="text-center">
                      <div className="text-xl">⭐</div>
                      <div className="mt-1 text-[8px] text-emerald-400">5 estrelas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl">💚</div>
                      <div className="mt-1 text-[8px] text-emerald-400">Fidelidade</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl">🚀</div>
                      <div className="mt-1 text-[8px] text-emerald-400">Crescimento</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl">✨</div>
                      <div className="mt-1 text-[8px] text-emerald-400">Satisfação</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ MÓDULOS */}
        <section id="modulos" className="px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="6 módulos completos"
              title="Tudo que seu ateliê precisa em um só lugar"
              text="Cada módulo foi pensado para o dia a dia real de quem produz, vende e precisa crescer."
            />
            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.45, delay: index * 0.06 }}
                  >
                    <div className="h-full rounded-[28px] border border-white/10 bg-white/5 p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-orange-400/30 hover:bg-orange-400/[0.06]">
                      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-300/20 text-orange-200">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                      <p className="mt-3 leading-7 text-slate-300">{feature.text}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ OFERTA CLARA */}
        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_0.95fr]">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                o que está incluso
              </div>
              <h3 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Um sistema completo pelo preço de um almoço por dia.
              </h3>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                R$49,90 por mês. Menos de R$1,70 por dia. Tudo incluso — sem cobrança por módulo, sem surpresa na fatura.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {proof.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <Check className="h-4 w-4 text-emerald-300 flex-shrink-0" />
                    <span className="text-sm text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
              <div className="border-b border-white/10 px-6 py-4 text-sm text-slate-400">Como a decisão de assinar se paga</div>
              <div className="grid gap-3 p-6">
                {[
                  '1 pedido errado na Shopee → prejuízo de R$8 a R$30',
                  '1 mês perdendo em 10 pedidos → R$80 a R$300 de prejuízo',
                  'O VPS Gestão custa R$49,90 — e corrige isso no 1º dia',
                  'Produção sem atraso = cliente satisfeito = mais vendas',
                  'Dados reais = decisões certas = crescimento consistente',
                ].map((item, i) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-400/15 text-sm font-semibold text-orange-200">
                        0{i + 1}
                      </div>
                      <div className="text-sm text-slate-200">{item}</div>
                    </div>
                    <ArrowRight className="ml-2 h-4 w-4 flex-shrink-0 text-slate-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ PREÇO */}
        <section id="preco" className="px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="investimento"
              title="Simples. 1 plano. Tudo incluso."
              text="Sem plano básico sem funcionalidades. Sem pagar por módulo. Assinou, tem tudo."
            />
            <div className="mt-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              {/* Price card */}
              <div className="rounded-[32px] border border-orange-400/20 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.16),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))] p-8 shadow-2xl shadow-orange-500/10">
                <div className="inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">
                  plano único
                </div>
                <h3 className="mt-5 text-3xl font-semibold text-white">VPS Gestão</h3>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-3 text-xl text-slate-400">R$</span>
                  <span className="text-6xl font-semibold tracking-tight text-white">49</span>
                  <span className="pb-3 text-3xl text-white">,90</span>
                  <span className="pb-3 text-slate-400">/mês</span>
                </div>
                <p className="mt-2 text-slate-400">Menos de R$1,70 por dia para organizar sua operação.</p>
                <div className="mt-8 space-y-3">
                  {proof.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <Check className="h-4 w-4 flex-shrink-0 text-emerald-300" />
                      <span className="text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => (document.getElementById('hotmart-checkout-trigger') as HTMLAnchorElement)?.click()}
                  className="mt-8 flex w-full items-center justify-center rounded-2xl bg-orange-500 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/35 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
                >
                  Assinar agora <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <div className="mt-4 text-center text-sm text-slate-400">
                  Cancele quando quiser · Acesso imediato
                </div>
              </div>

              {/* Guarantee + Premium */}
              <div className="grid gap-6">
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-semibold text-white">7 dias de garantia total</h4>
                      <p className="mt-2 leading-7 text-slate-300">
                        Se em 7 dias você não amar o sistema, é só pedir o reembolso. Sem perguntas, sem formulário complicado. <strong className="text-white">100% do valor de volta.</strong>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
                      <Star className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-semibold text-white">Depoimento de artesã</h4>
                      <p className="mt-2 leading-7 text-slate-300">
                        "Descobri que estava perdendo R$8 em cada venda da Shopee, estava com o meu financeiro às escuras e minha produção com atrasos e punições na minha loja. Em 2 semanas organizei tudo. E hoje não vivo sem o VPS." —{' '}
                        <strong className="text-orange-300">Artes e Tal — SP</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ FAQ */}
        <section id="faq" className="px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <SectionTitle
              eyebrow="objeções frequentes"
              title="Perguntas frequentes"
              text="Tire suas dúvidas antes de assinar — ou fale com a gente no suporte."
            />
            <div className="mt-12 space-y-4">
              {faqs.map((item, i) => (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5 transition hover:border-orange-400/20"
                >
                  <button
                    className="flex w-full items-center justify-between gap-4 p-6 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <h4 className="text-lg font-semibold text-white">{item.q}</h4>
                    <span className={`text-2xl font-light text-orange-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6">
                      <p className="leading-7 text-slate-300">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ CTA FINAL */}
        <section className="px-6 pb-24 pt-8 lg:px-8 lg:pb-32">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-orange-400/20 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.18),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,1))] p-10 text-center shadow-2xl shadow-orange-500/10 md:p-14">
            <div className="mx-auto max-w-3xl">
              <img
                src="/logo_vps_gestao.png"
                alt="VPS Gestão"
                className="mb-2 h-20 w-20 object-contain"
                style={{ mixBlendMode: 'lighten' }}
              />
              <h2 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Seu ateliê organizado é{' '}
                <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                  um negócio de verdade.
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Chega de perder dinheiro sem saber. Chega de produzir no caos. Está na hora de gerir com profissionalismo — e com orgulho.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => (document.getElementById('hotmart-checkout-trigger') as HTMLAnchorElement)?.click()}
                  className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/35 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
                >
                  Assinar por R$49,90/mês <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <a
                  href="#modulos"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-base text-white transition hover:bg-white/10"
                >
                  Ver os módulos
                </a>
              </div>
              <p className="mt-6 text-sm text-slate-500">
                7 dias de garantia · Cancele quando quiser · Acesso imediato
              </p>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <VpsIcon />
            <span className="text-sm text-slate-500">VPS Gestão — ERP para artesãs</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href={HOTMART} className="transition hover:text-white">Assinar</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
            <a href="https://vps-gestao.natycostapro.com.br/login" className="transition hover:text-white">Entrar</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
