'use client'

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Script from 'next/script'
import { trackInitiateCheckout } from '@/components/MetaPixel'
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
  CalendarDays,
  FileText,
  TrendingUp,
  Clock,
  DollarSign,
  Package,
} from 'lucide-react'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const HOTMART_MENSAL = 'https://pay.hotmart.com/C105122525T?off=6s58g8wc&bid=1777559645114'
const HOTMART_ANUAL  = 'https://pay.hotmart.com/C105122525T?off=wjn1po68'

const features = [
  {
    icon: Boxes,
    title: 'Produção sob controle',
    text: 'Do pedido à expedição, com status claros por setor, responsáveis definidos e menos retrabalho.',
  },
  {
    icon: Wallet,
    title: 'Preço sem achismo',
    text: 'Quanto sobra, taxas de canal, custos e lucro calculados com fórmula exata — Shopee, ML, Elo7 e mais.',
  },
  {
    icon: BarChart3,
    title: 'Números de verdade',
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
    text: 'Tudo numa tela só: produção, financeiro e precificação para você decidir.',
  },
  {
    icon: CalendarDays,
    title: 'Calendário de envios',
    text: 'Visualize todos os pedidos por data de envio — mensal, semanal e diário. Nunca mais atrasar uma entrega.',
  },
  {
    icon: FileText,
    title: 'Orçamentos profissionais',
    text: 'Crie orçamentos com layout profissional, envie link para aprovação e converta em pedido com um clique.',
  },
]

const proof = [
  'Controle de produção por setor',
  'Precificação automática por canal',
  'Visão Geral com seus números em tempo real',
  'Financeiro com caixa diário',
  'Análise com IA (Gemini)',
  'Múltiplos usuários com permissões',
]

const faqs = [
  {
    q: 'Funciona pro meu tipo de ateliê?',
    a: 'Funciona pra qualquer ateliê com produção sob encomenda — laços, costura, festa, sublimação, bordado, crochê, bijuteria, papelaria, encadernação, balão, cartonagem, presentes personalizados, qualquer nicho. Você configura os setores do seu jeito e o sistema se adapta. Não importa se você produz 10 ou 200 peças por mês.',
  },
  {
    q: 'E se eu não entender de tecnologia?',
    a: 'Se você usa WhatsApp, você usa o SOA. A interface é simples, com guias passo a passo e suporte por chat e Telegram quando você empacar. A maioria das artesãs configura tudo no mesmo dia que assina, sem ajuda de ninguém.',
  },
  {
    q: 'Consigo usar pelo celular enquanto produzo?',
    a: 'Sim. O sistema é responsivo e funciona perfeitamente no celular, tablet ou computador. Muita artesã deixa aberto no celular durante a produção pra atualizar o status do pedido na hora que termina.',
  },
  {
    q: 'E se eu assinar e não gostar?',
    a: 'Você tem 14 dias grátis pra testar antes mesmo de qualquer cobrança. E depois disso, ainda tem 15 dias de garantia total. Se em algum momento você achar que não é pra você, devolvemos 100% do seu dinheiro — sem pergunta, sem burocracia, sem cara fechada.',
  },
  {
    q: 'Como peço meu dinheiro de volta se não rolar?',
    a: 'Super simples: você manda mensagem pro nosso suporte pedindo o reembolso dentro do prazo de garantia. A Hotmart processa o estorno automaticamente direto no cartão ou na conta de origem. Não tem ligação, não tem questionário, não tem ninguém tentando te convencer a ficar.',
  },
  {
    q: 'Minha freelancer/funcionária consegue acessar também?',
    a: 'Sim. Você cria perfis com permissões diferentes: Admin (você, vê tudo), Delegadora (gerencia equipe e pedidos) e Operadora (só vê o que precisa pra produzir). Cada uma entra com seu próprio login, sem misturar.',
  },
  {
    q: 'Quanto tempo leva pra eu começar a usar?',
    a: 'Em menos de 10 minutos você está dentro do sistema com seu primeiro pedido cadastrado. A configuração inicial é guiada — você escolhe seu segmento, o sistema sugere os setores típicos do seu nicho, você ajusta do seu jeito e pronto.',
  },
  {
    q: 'Tenho que cadastrar tudo de uma vez?',
    a: 'De jeito nenhum. Você pode começar só com a produção (cadastrando os pedidos novos que entrarem) e ir adicionando materiais e cálculo de preço quando der. O sistema cresce no seu ritmo.',
  },
  {
    q: 'Os meus dados ficam seguros?',
    a: 'Ficam. Os dados são criptografados, com backups diários automáticos, armazenados em servidor com proteção SSL. Seus dados nunca são compartilhados com ninguém — são exclusivamente seus.',
  },
  {
    q: 'Tenho que baixar ou instalar alguma coisa?',
    a: 'Não. O SOA é 100% online — você acessa pelo navegador no celular, tablet ou computador. Funciona como Netflix ou WhatsApp Web: entra com login e senha, e está tudo lá.',
  },
  {
    q: 'E se meu volume de pedidos for grande?',
    a: 'O sistema foi feito pra escalar. Você pode ter centenas de pedidos ativos em produção, dezenas de produtos cadastrados, freelancers terceirizando peças, e tudo continua rodando rápido.',
  },
  {
    q: 'Posso testar antes de pagar?',
    a: 'Pode! 14 dias grátis pra usar o sistema completo — todos os módulos, todas as funções. A cobrança só acontece depois do prazo. E mesmo depois da primeira cobrança, você ainda tem 15 dias de garantia total. Resumo do risco zero: 14 dias grátis + 15 dias de garantia = 29 dias pra decidir com calma.',
  },
]


// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function VpsLogo() {
  return (
    // Logo horizontal: coloque o arquivo em public/logo_vps_horizontal.png
    // Logo ícone:      coloque o arquivo em public/logo_vps_gestao.png
    <img
      src="/logo_vps_horizontal.png"
      alt="SOA"
      className="h-11 w-auto object-contain"
      style={{ mixBlendMode: 'lighten' }}
    />
  )
}

function VpsIcon() {
  return (
    <img
      src="/logo_vps_gestao.png"
      alt="SOA"
      className="h-8 w-8 object-contain rounded-xl"
      style={{ mixBlendMode: 'lighten' }}
    />
  )
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text?: string }) {
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
          app.vps-gestao.com.br
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
          <span className={`font-semibold text-white ${tLg}`}>Visão Geral</span>
          <span className={`rounded-full border border-orange-500/20 bg-orange-500/15 px-2 py-0.5 text-orange-300 ${tSm}`}>Março 2026</span>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: 'Receita', v: 'R$8.420', d: '↑ 18%', c: 'text-emerald-400' },
            { l: 'Despesas', v: 'R$2.140', d: '↑ 4%', c: 'text-orange-400' },
            { l: 'Pedidos', v: '47', d: '+12 novos', c: 'text-blue-400' },
            { l: 'Lucro %', v: '38%', d: '↑ 3pts', c: 'text-purple-400' },
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
          { l: 'Lucro Shopee', v: '34%', c: 'text-orange-400', bc: 'border-orange-500/20 bg-orange-500/10' },
          { l: 'Lucro ML', v: '38%', c: 'text-yellow-400', bc: 'border-yellow-500/20 bg-yellow-500/10' },
          { l: 'Lucro Elo7', v: '42%', c: 'text-indigo-400', bc: 'border-indigo-500/20 bg-indigo-500/10' },
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
        <div className="border-b border-white/10 px-3 py-2 text-[9px] font-semibold text-slate-400">Entradas e Saídas de março</div>
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



// ─── COMPARATIVO ─────────────────────────────────────────────────────────────

const COMPARE_MODULES = [
  {
    id: 'producao', label: 'Produção', icon: '📦',
    vps: [
      { text: 'Setores 100% configuráveis — nome, cor e ícone', yes: true, excl: true },
      { text: 'Página individual por setor — operadora vê só o dela', yes: true, excl: true },
      { text: 'Etapas: Iniciar → Concluir → Devolver', yes: true, excl: true },
      { text: 'Devolução com motivo obrigatório registrado', yes: true, excl: true },
      { text: 'Pedido avança de setor automaticamente ao concluir', yes: true, excl: true },
      { text: 'Expedição automática ao finalizar o último setor', yes: true, excl: true },
      { text: 'Histórico completo: data, hora e responsável', yes: true, excl: true },
      { text: 'Auditoria de cada edição por operadora', yes: true, excl: true },
      { text: 'Campos personalizados por pedido (foto, cor, tema, nome)', yes: true, excl: true },
      { text: 'Operações em massa (status, prioridade, impressão)', yes: true, excl: true },
      { text: 'Importação automática de planilha da Shopee', yes: true, excl: true },
      { text: 'Painel de produção visual com fila por setor', yes: true },
    ],
    other: [
      { text: 'Setores configuráveis com nome, cor e ícone', yes: false },
      { text: 'Página individual por setor', yes: false },
      { text: 'Fluxo de etapas com devolução', yes: false },
      { text: 'Motivo registrado ao devolver pedido', yes: false },
      { text: 'Avanço automático entre etapas', yes: false },
      { text: 'Expedição automática', yes: false },
      { text: 'Histórico rastreável por pedido', yes: false },
      { text: 'Auditoria de edições', yes: false },
      { text: 'Campos personalizados por pedido', yes: false },
      { text: 'Operações em massa', yes: false },
      { text: 'Importação automática de planilha', yes: false },
      { text: 'Painel de produção visual', partial: true, note: 'Status básico fixo no melhor caso' },
    ],
  },
  {
    id: 'orcamentos', label: 'Orçamentos', icon: '📝',
    vps: [
      { text: 'Orçamento com layout profissional', yes: true },
      { text: 'Link dedicado de aprovação online', yes: true, excl: true },
      { text: 'Cliente aprova com 1 clique — sem digitar resposta', yes: true, excl: true },
      { text: 'Aprovado → entra automaticamente no fluxo de produção', yes: true, excl: true },
      { text: 'Orçamento vinculado ao histórico completo do pedido', yes: true, excl: true },
    ],
    other: [
      { text: 'Orçamento com layout profissional', partial: true, note: 'PDF sem interatividade' },
      { text: 'Link dedicado de aprovação online', yes: false },
      { text: 'Aprovação com 1 clique sem digitar resposta', yes: false },
      { text: 'Aprovado → entra no fluxo de produção automaticamente', yes: false },
      { text: 'Orçamento vinculado ao histórico do pedido', yes: false },
    ],
  },
  {
    id: 'precificacao', label: 'Precificação', icon: '💰',
    vps: [
      { text: 'Custo completo: material + mão de obra + embalagem + arte', yes: true },
      { text: 'Preço diferente por canal (Shopee, ML, Elo7, TikTok, Magalu)', yes: true, excl: true },
      { text: 'Taxas de marketplace atualizadas para 2026', yes: true },
      { text: 'Taxas extras configuráveis por produto (% ou R$ fixo)', yes: true, excl: true },
      { text: 'Regime tributário na fórmula (MEI, Simples, Presumido)', yes: true, excl: true },
      { text: '35 NCMs de artesanato pré-cadastrados', yes: true, excl: true },
      { text: 'Embalagem como kit de materiais com custo automático', yes: true, excl: true },
      { text: 'Combos de produtos com desconto configurável', yes: true, excl: true },
      { text: 'Reajuste proporcional em massa (sobe X% em tudo)', yes: true, excl: true },
    ],
    other: [
      { text: 'Custo de material + mão de obra básico', yes: true },
      { text: 'Preço diferente por canal de venda', yes: false },
      { text: 'Taxas de marketplace atualizadas', partial: true, note: 'Desatualizadas ou parciais' },
      { text: 'Taxas extras por produto', yes: false },
      { text: 'Regime tributário na fórmula', yes: false },
      { text: 'NCMs de artesanato pré-cadastrados', yes: false },
      { text: 'Embalagem como kit de materiais', yes: false },
      { text: 'Combos com desconto', yes: false },
      { text: 'Reajuste em massa', yes: false },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: '💳',
    vps: [
      { text: 'Registros de receita e despesa com categorias', yes: true },
      { text: 'Registro automático na Venda Direta', yes: true, excl: true },
      { text: 'Recorrência automática (aluguel, internet, etc.)', yes: true, excl: true },
      { text: 'Parcelamento com geração automática de parcelas', yes: true, excl: true },
      { text: 'Caixa diário com projeção futura', yes: true },
      { text: 'Metas mensais de receita, despesa e lucro', yes: true, excl: true },
      { text: 'Anexar comprovante/nota ao registro', yes: true, excl: true },
    ],
    other: [
      { text: 'Registros básicos de receita e despesa', partial: true, note: 'Só no melhor caso' },
      { text: 'Registro automático por canal', yes: false },
      { text: 'Recorrência automática', yes: false },
      { text: 'Parcelamento com parcelas individuais', yes: false },
      { text: 'Caixa diário com projeção', partial: true, note: 'Simplificado' },
      { text: 'Metas mensais com barra de progresso', yes: false },
      { text: 'Anexar comprovantes', yes: false },
    ],
  },
  {
    id: 'ia', label: 'Ajudante com IA', icon: '🤖',
    vps: [
      { text: 'Chat com IA usando dados reais do seu ateliê', yes: true, excl: true },
      { text: 'Responde em português natural — sem tela complicada', yes: true, excl: true },
      { text: '150 análises por dia incluídas no plano', yes: true, excl: true },
      { text: 'Histórico de conversas dos últimos 30 dias', yes: true, excl: true },
      { text: 'Análise de imagens via Telegram (Gemini Vision)', yes: true, excl: true },
    ],
    other: [
      { text: 'IA conversacional com dados reais do ateliê', yes: false },
      { text: 'Resposta em português natural', yes: false },
      { text: 'Análises ilimitadas no plano', yes: false },
      { text: 'Histórico de conversas com IA', yes: false },
      { text: 'Análise de imagens via IA', yes: false },
    ],
  },
  {
    id: 'calendario', label: 'Calendário', icon: '📅',
    vps: [
      { text: 'Calendário de envios mensal, semanal e diário', yes: true, excl: true },
      { text: 'Alerta visual de atraso em pedidos', yes: true, excl: true },
      { text: 'Pedidos clicáveis direto no calendário', yes: true, excl: true },
    ],
    other: [
      { text: 'Calendário de envios', yes: false },
      { text: 'Alerta visual de atraso', yes: false },
      { text: 'Pedidos clicáveis no calendário', yes: false },
    ],
  },
  {
    id: 'estoque', label: 'Estoque', icon: '📦',
    vps: [
      { text: 'Estoque de materiais com entradas e saídas', yes: true },
      { text: 'Alerta de estoque mínimo em tempo real', yes: true, excl: true },
      { text: 'Estoque de produtos prontos para pronta entrega', yes: true, excl: true },
      { text: 'Módulo opcionalmente ocultável', yes: true, excl: true },
    ],
    other: [
      { text: 'Estoque de materiais', partial: true, note: 'Básico no melhor caso' },
      { text: 'Alerta de estoque mínimo', yes: false },
      { text: 'Estoque de produtos prontos', yes: false },
      { text: 'Módulo ocultável', yes: false },
    ],
  },
  {
    id: 'equipe', label: 'Equipe', icon: '👥',
    vps: [
      { text: '3 perfis: Administradora, Delegadora e Operadora', yes: true, excl: true },
      { text: 'Operadora vê SOMENTE o setor dela', yes: true, excl: true },
      { text: 'Financeiro e IA bloqueados para operadora', yes: true, excl: true },
      { text: 'Auditoria: toda edição registra nome e data', yes: true, excl: true },
      { text: 'Controle de freelancers com histórico e total a pagar', yes: true, excl: true },
    ],
    other: [
      { text: 'Multi-usuários com perfis de permissão', yes: false },
      { text: 'Acesso restrito por setor específico', yes: false },
      { text: 'Bloqueio de módulos financeiros por perfil', yes: false },
      { text: 'Auditoria de edições com nome', yes: false },
      { text: 'Controle de freelancers e produção terceirizada', yes: false },
    ],
  },
]

function CompareSection() {
  const [tab, setTab] = useState(0)
  const [opacity, setOpacity] = useState(1)
  const touchStartX = useRef(0)

  function changeTab(i: number) {
    setOpacity(0)
    setTimeout(() => { setTab(i); setOpacity(1) }, 200)
  }

  const m = COMPARE_MODULES[tab]

  function FeatureRow({ f, isVps }: { f: any; isVps: boolean }) {
    const icon = f.yes ? '✓' : f.partial ? '~' : '✗'
    const color = f.yes ? 'text-emerald-400' : f.partial ? 'text-yellow-400' : 'text-red-400'
    const bg    = f.yes ? 'bg-emerald-400/10' : f.partial ? 'bg-yellow-400/10' : 'bg-red-400/10'
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
        <div className={`flex-shrink-0 w-6 h-6 rounded-full ${bg} flex items-center justify-center text-xs font-bold ${color} mt-0.5`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-slate-200 leading-snug">{f.text}</span>
          {isVps && f.excl && (
            <span className="ml-2 inline-flex items-center rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-400">exclusivo</span>
          )}
          {f.note && <div className="text-xs text-slate-500 mt-0.5">{f.note}</div>}
        </div>
      </div>
    )
  }

  const vpsScore   = m.vps.filter((f: any) => f.yes).length
  const otherScore = m.other.filter((f: any) => f.yes).length
  const total      = m.vps.length

  return (
    <section id="comparativo" className="px-6 py-12 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionTitle
          eyebrow="por que o SOA"
          title="SOA vs outros sistemas"
          text="Funcionalidades reais, comparadas com honestidade. Sem citar nomes — você vai reconhecer."
        />

        {/* Tabs */}
        <div className="mt-10 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {COMPARE_MODULES.map((mod, i) => (
            <button key={mod.id} onClick={() => changeTab(i)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                tab === i
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-orange-400/40 hover:text-orange-300'
              }`}>
              <span>{mod.icon}</span>{mod.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div
          className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-200"
          style={{ opacity }}
          onTouchStart={e => { touchStartX.current = e.changedTouches[0].screenX }}
          onTouchEnd={e => {
            const diff = touchStartX.current - e.changedTouches[0].screenX
            if (Math.abs(diff) > 50) {
              if (diff > 0 && tab < COMPARE_MODULES.length - 1) changeTab(tab + 1)
              if (diff < 0 && tab > 0) changeTab(tab - 1)
            }
          }}
        >
          {/* SOA */}
          <div className="rounded-[20px] border border-orange-400/30 bg-slate-900/80 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-orange-500/5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <div>
                <div className="text-sm font-semibold text-white">SOA</div>
                <div className="text-xs text-slate-500">Módulo de {m.label}</div>
              </div>
            </div>
            <div className="px-5 py-4">
              {m.vps.map((f: any, i: number) => <FeatureRow key={i} f={f} isVps={true} />)}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/3">
              <div>
                <span className="text-xl font-bold text-orange-400">{vpsScore}</span>
                <span className="text-sm text-slate-500">/{total} recursos</span>
              </div>
              <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-orange-400 transition-all duration-500" style={{ width: `${Math.round(vpsScore/total*100)}%` }} />
              </div>
            </div>
          </div>

          {/* Outros */}
          <div className="rounded-[20px] border border-white/10 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/3">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <div>
                <div className="text-sm font-semibold text-slate-300">Outros sistemas</div>
                <div className="text-xs text-slate-500">Mesma categoria de produto</div>
              </div>
            </div>
            <div className="px-5 py-4">
              {m.other.map((f: any, i: number) => <FeatureRow key={i} f={f} isVps={false} />)}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
              <div>
                <span className="text-xl font-bold text-slate-400">{otherScore}</span>
                <span className="text-sm text-slate-500">/{total} recursos</span>
              </div>
              <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-slate-500 transition-all duration-500" style={{ width: `${Math.round(otherScore/total*100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Dots mobile */}
        <div className="flex md:hidden justify-center gap-1.5 mt-4">
          {COMPARE_MODULES.map((_, i) => (
            <button key={i} onClick={() => changeTab(i)}
              className={`h-1.5 rounded-full transition-all ${i === tab ? 'bg-orange-400 w-5' : 'bg-white/20 w-1.5'}`} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── DEPOIMENTO CARD — só aparece quando a imagem existir ─────────────────────
function DepoimentoCard({ src, index }: { src: string; index: number }) {
  const [show, setShow] = useState(false)
  return (
    <div className={`overflow-hidden rounded-[24px] border border-white/10 bg-white/5 transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none h-0'}`}>
      <div className="relative aspect-[4/5] w-full">
        <img
          src={src}
          alt={`Depoimento ${index} — print WhatsApp`}
          className="absolute inset-0 h-full w-full object-cover object-top rounded-[24px]"
          onLoad={() => setShow(true)}
          onError={() => setShow(false)}
        />
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function LandingClient({ novoCadastro }: { novoCadastro: boolean }) {
  const [anual, setAnual] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Preços mensais base → anual = mensal * 0.67 (33% desconto)
  const PRECO_BASIC_MENSAL = 29.90
  const PRECO_BASIC_ANUAL  = 20.03  // R$20,03/mês — R$240,40/ano à vista

  // CTA da landing, atrás da flag ASSINATURA_NOVO_CADASTRO (lida no server e
  // passada como prop — client component não enxerga env não-pública):
  //   OFF → abre o modal de checkout da Hotmart (comportamento histórico, byte a byte).
  //   ON  → leva ao NOSSO cadastro, com o plano na querystring.
  // O trackInitiateCheckout continua sendo disparado por quem chama, nos dois casos.
  function ctaCheckout(ehAnual: boolean) {
    if (novoCadastro) {
      window.location.href = `/register?plano=${ehAnual ? 'anual' : 'mensal'}`
      return
    }
    ;(document.getElementById(ehAnual ? 'hotmart-checkout-trigger-anual' : 'hotmart-checkout-trigger-mensal') as HTMLAnchorElement)?.click()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Widget da Hotmart só quando o funil antigo está ativo. Com o cadastro
          novo ligado, nem carregamos o JS/CSS da Hotmart — o CTA vai para /register. */}
      {!novoCadastro && (
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
      )}

      {/* Fixed ambient gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.12),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(234,179,8,0.08),transparent_22%),linear-gradient(180deg,#020617_0%,#020617_100%)] pointer-events-none" />

      {/* ══════════════════════════════════════ HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <VpsLogo />
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#modulos-planos" className="transition hover:text-white">Módulos</a>
            <a href="#preco" className="transition hover:text-white">Planos</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
            <a href="/login" className="transition hover:text-orange-300">Área do cliente</a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="/login"
              className="rounded-2xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Área do cliente
            </a>
            <button
              onClick={() => { trackInitiateCheckout(anual ? 0 : 29.90); ctaCheckout(anual) }}
              className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
            >
              Testar 14 dias grátis
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">

        {/* Botão Hotmart oculto — aciona o modal de checkout sem sobrescrever os
            estilos visuais. Só existe no funil antigo; no novo, ctaCheckout nem o procura. */}
        {!novoCadastro && (
          <>
            <a
              id="hotmart-checkout-trigger-mensal"
              href={HOTMART_MENSAL}
              className="hotmart-fb hotmart__button-checkout"
              style={{ display: 'none' }}
              aria-hidden="true"
            >checkout mensal</a>
            <a
              id="hotmart-checkout-trigger-anual"
              href={HOTMART_ANUAL}
              className="hotmart-fb hotmart__button-checkout"
              style={{ display: 'none' }}
              aria-hidden="true"
            >checkout anual</a>
          </>
        )}

        {/* ══════════════════════════════════════ HERO */}
        <section className="px-6 pb-12 pt-12 lg:px-8 lg:pb-16 lg:pt-16">
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm font-medium uppercase tracking-widest text-orange-300">
                  <Sparkles className="h-4 w-4" />
                  Sistema feito para artesãs 🎀
                </div>
                <h1 className="max-w-4xl text-5xl font-semibold leading-[1.06] tracking-tight text-white md:text-[64px]">
                  Você trabalha o dia todo e no fim do mês{' '}
                  <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                    não sabe quanto lucrou.
                  </span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
                  O SOA organiza sua produção do <strong className="text-white">jeito do seu ateliê</strong> — laços, costura, bijuteria, encadernação, papelaria, qualquer nicho — e te mostra quanto cada produto custa, quanto entra e quanto sobra de verdade.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => { trackInitiateCheckout(anual ? 0 : 29.90); ctaCheckout(anual) }}
                    className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-8 py-4 text-base font-medium text-white shadow-lg shadow-orange-500/35 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
                  >
                    Configurar meu ateliê em 10 minutos <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                  <a
                    href="#video-demo"
                    className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base text-white transition hover:bg-white/10"
                  >
                    Ver o sistema por dentro
                  </a>
                </div>
                {/* Bullets de credibilidade */}
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">✅</span> Pronto em menos de 10 minutos</span>
                  <span className="text-white/20">·</span>
                  <span className="flex items-center gap-1.5"><span className="text-orange-400">🛡️</span> 14 dias grátis + 15 dias de garantia</span>
                  <span className="text-white/20">·</span>
                  <span className="flex items-center gap-1.5"><span className="text-orange-400">🎯</span> Personalizado pro SEU ateliê</span>
                </div>

                {/* Stats */}
                <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
                  {[
                    ['14 dias',     'grátis para testar'],
                    ['+300',        'ateliês ativos'],
                    ['8',           'módulos disponíveis'],
                  ].map(([n, l]) => (
                    <div key={n} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                      <div className="text-xl font-semibold text-orange-400">{n}</div>
                      <div className="mt-1 text-sm text-slate-400">{l}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right: vídeo demo */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="absolute -left-10 top-10 h-28 w-28 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="absolute -right-10 bottom-10 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
              {/* Vídeo demo YouTube */}
              <div className="relative overflow-hidden rounded-[24px] border border-white/10 shadow-2xl shadow-orange-500/10" style={{ aspectRatio: '16/10' }}>
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/ma_uSY3FwVI?si=iuEJ0AbJS_B8Yi6m"
                  title="SOA — Demo do sistema"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full rounded-[24px]"
                />
              </div>

            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════ PROVA VISUAL — 4 MOCKUPS */}
        <section id="mockups" className="px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="o sistema por dentro"
              title="Veja o sistema em ação"
              text="Cada módulo foi pensado para o dia a dia real de quem tem um ateliê. Sem complexidade desnecessária."
            />
            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              {[
                { badge: 'Produção',     src: '/prints/producao.png',     title: 'Fila de produção',      sub: 'Pedidos organizados por setor, canal e prioridade — nunca mais nada esquecido.' },
                { badge: 'Precificação', src: '/prints/precificacao.png', title: 'Precificação por canal', sub: 'Quanto sobra por marketplace, taxa embutida e lucro estimado para cada produto.' },
                { badge: 'Financeiro',   src: '/prints/financeiro.png',   title: 'Financeiro visual',      sub: 'Entradas, saídas, metas e leitura rápida do caixa em uma tela só.' },
                { badge: 'Visão Geral',    src: '/prints/dashboard.png',    title: 'Painel completo',    sub: 'Seus números em tempo real, visão financeira e produção em uma única tela.' },
              ].map((item, index) => (
                <motion.div
                  key={item.badge}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                >
                  <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40">
                    {/* Barra do browser */}
                    <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                      <div className="ml-2 flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-400">
                        app.vps-gestao.com.br
                      </div>
                      <div className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[11px] font-semibold text-orange-200">{item.badge}</div>
                    </div>
                    {/* Print real do sistema — clicável para ampliar */}
                    <div className="overflow-hidden cursor-zoom-in relative group" onClick={() => setLightbox(item.src)}>
                      <img
                        src={item.src}
                        alt={`SOA — ${item.badge}`}
                        className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                        style={{ maxHeight: '280px' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-300">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                          🔍 Ampliar
                        </span>
                      </div>
                    </div>
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
        <section id="video-demo" className="px-6 py-12 lg:px-8">
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
                  'Preço no achismo = lucro negativo sem perceber.',
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

              {/* ── SEM O SOA ── */}
              <div className="overflow-hidden rounded-[28px] border border-red-500/20 bg-slate-950/70 p-0">
                <div className="border-b border-red-500/20 bg-red-500/5 px-5 py-3 flex items-center gap-2">
                  <span className="text-sm text-red-400">😰</span>
                  <span className="text-sm font-medium text-red-300">Sem o SOA</span>
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
                            <td className="border border-white/10 px-1.5 py-1 text-slate-400">Lucro</td>
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

              {/* ── COM O SOA ── */}
              <div className="overflow-hidden rounded-[28px] border border-orange-400/20 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.16),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.95))] p-0 shadow-2xl shadow-orange-500/10">
                <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center gap-2">
                  <span className="text-sm">✨</span>
                  <span className="text-sm font-medium text-orange-200">Com o SOA</span>
                </div>
                <div className="space-y-3 p-4">

                  {/* KPIs rápidos */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                      <div className="text-[9px] text-slate-400">Lucro Shopee</div>
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

        {/* ══════════════════════════════════════ DEPOIMENTOS */}
        <section id="depoimentos" className="px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="quem já usa"
              title="Artesãs reais, resultados reais"
              text="Mais de 300 ateliês já organizam sua produção com o SOA."
            />
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                { src: '/depoimento-1.jpeg', titulo: '"Impagável pelo que entrega"',             autor: 'Personalizadus da Káh · Aluna Shopee' },
                { src: '/depoimento-2.jpeg', titulo: '"Aqui consigo acompanhar cada detalhe"',   autor: 'Rafa · Rafa Arts Personalizados' },
              ].map((d) => (
                <div key={d.src} className="group flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-white/5">
                  {/* Imagem com aspect ratio fixo — sempre igual nos 3 cards */}
                  <div
                    className="relative cursor-zoom-in overflow-hidden"
                    style={{ aspectRatio: '3/4' }}
                    onClick={() => setLightbox(d.src)}
                  >
                    <img
                      src={d.src}
                      alt={d.titulo}
                      className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    {/* Gradient + botão ampliar */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="flex items-center gap-1.5 bg-black/70 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm">
                        🔍 Ver completo
                      </span>
                    </div>
                  </div>
                  {/* Rodapé do card */}
                  <div className="p-4 border-t border-white/10">
                    <p className="text-sm font-semibold text-orange-400">{d.titulo}</p>
                    <p className="text-xs text-slate-400 mt-1">{d.autor}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ══════════════════════════════════════ FUNDAÇÃO */}
        <section id="fundacao" className="px-6 py-12 lg:px-8 bg-slate-900/40">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <div className="inline-block mb-4 text-xs font-medium uppercase tracking-widest text-orange-400 border border-orange-400/20 bg-orange-400/10 rounded-full px-4 py-1.5">
                Por trás do SOA
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Esse sistema nasceu pra salvar o meu próprio ateliê.
              </h2>
              <p className="mt-3 text-slate-400 text-lg">E hoje organiza o de milhares de artesãs em todo o Brasil.</p>
            </div>

            {/* Foto composta — salve em public/composicao_naty_junior.jpg */}
            <div className="mx-auto mb-12 max-w-2xl overflow-hidden rounded-2xl border border-orange-400/20">
              <img
                src="/composicao_naty_junior.jpg"
                alt="Naty Costa e Junior Costa, fundadores do SOA"
                className="w-full object-cover"
              />
            </div>

            {/* Texto 2 colunas */}
            <div className="mx-auto max-w-4xl text-slate-300 leading-relaxed text-base" style={{ columns: '2', columnGap: '40px' }}>
              <p className="mb-4">
                Eu sou a <strong className="text-white">Naty Costa</strong>. Em 2015, com 31 anos, fiz a primeira caixa personalizada da minha vida — pro aniversário de 1 ano da minha caçula, a Bella. Em pouco tempo virei multitécnica: papelaria, encadernação, sublimação, cartonagem, costura criativa. Em 2017, sem nem imaginar que ensinaria um dia, comecei a responder as dúvidas de quem seguia minha empresa, a Artes e Tal. Foi orgânico — virou curso, virou comunidade, virou referência.
              </p>
              <p className="mb-4">
                Mas em 2022 eu quase perdi tudo. Vendia muito. Tinha equipe de 8 funcionárias. E <strong className="text-white">mesmo assim, no dia 5 de cada mês eu não tinha dinheiro pra pagar os salários.</strong> Misturava conta da empresa com conta pessoal, não conseguia tirar pró-labore real, e descobri o motivo do jeito mais doloroso: estava precificando errado havia meses. Vender muito não é lucrar.
              </p>
              <p className="mb-4">
                O <strong className="text-white">Junior</strong> é meu marido há 19 anos, pai das nossas 3 filhas, desenvolvedor desde os 15. Ele me via nesse caos e propôs construir alguma coisa só pra mim. Levou 6 meses pra primeira versão usável. Fui pedindo ajustes, e o sistema foi crescendo: produção, precificação, financeiro.
              </p>
              <p>
                Em <strong className="text-white">janeiro deste ano</strong>, com a loja na Shopee rodando há um ano e tudo integrado ao sistema, <strong className="text-white">fechei o mês com R$ 100 mil de faturamento</strong> — dessa vez, sabendo exatamente quanto era lucro de verdade. <strong className="text-white">Esse é o SOA. Feito pra mim primeiro. Pra você agora.</strong>
              </p>
            </div>

            {/* Números de autoridade */}
            <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { n: '11 anos', l: 'de mercado em artesanato' },
                { n: '+10 mil', l: 'alunas formadas no Brasil e no mundo' },
                { n: '85 mil', l: 'seguidores em @natycostaoficial' },
                { n: '+1 milhão', l: 'espectadores no reality No Topo do Sucesso' },
              ].map(({ n, l }) => (
                <div key={n} className="rounded-xl border border-white/10 bg-white/5 p-5 text-center">
                  <div className="text-2xl font-semibold text-orange-400 md:text-3xl">{n}</div>
                  <div className="mt-1 text-xs text-slate-400 leading-snug">{l}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => { ctaCheckout(anual) }}
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-medium text-white transition hover:bg-white/10">
                Quero organizar meu ateliê também <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ EXEMPLO DE CÁLCULO */}
        <section id="calculo" className="px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              eyebrow="cálculo real do sistema"
              title="Veja o que muda quando você sabe seu custo real."
              text="Esse é um cálculo de verdade, feito no SOA por uma artesã que vende cofrinhos personalizados na Shopee."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {/* SEM o SOA */}
              <div className="rounded-xl border-l-4 border-red-500/40 bg-slate-800/60 p-8 border border-white/5">
                <div className="mb-6">
                  <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">Sem o SOA</span>
                  <h3 className="mt-3 text-xl font-semibold text-white">Vendendo no achismo</h3>
                  <p className="mt-2 text-sm text-slate-400 italic">"Kit de 10 cofrinhos com adesivo, fita de cetim, embalagem... vou vender por R$ 25,76 na Shopee. Tá bom!"</p>
                </div>
                <div className="space-y-3">
                  {[
                    ['Lucro calculado', '15% — lucro bruto R$ 3,86'],
                    ['Lucro líquido por kit', 'menos de R$ 1,00'],
                    ['Por unidade vendida', 'R$ 0,38 😱'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm border-b border-white/5 pb-2">
                      <span className="text-slate-400">{k}</span>
                      <span className="text-red-400 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500 italic">Você está cobrando o que o vizinho cobra. E o vizinho também cobra errado.</p>
              </div>

              {/* COM o SOA */}
              <div className="rounded-xl border-l-4 border-orange-500 bg-orange-500/5 p-8 border border-orange-500/20">
                <div className="mb-6">
                  <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">Com o SOA</span>
                  <h3 className="mt-3 text-xl font-semibold text-white">Vendendo com clareza</h3>
                </div>
                <div className="space-y-1.5 mb-4">
                  {[
                    ['Cofrinho papelão 6x10 (c/ frete)', 'R$ 5,13'],
                    ['Matte adesivo A4', 'R$ 1,67'],
                    ['Plástico cofre 12x25', 'R$ 0,82'],
                    ['Fita de cetim 38mm', 'R$ 1,39'],
                    ['Fita de cetim 3mm', 'R$ 0,25'],
                    ['Offset A4 180g', 'R$ 0,07'],
                    ['Embalagem do kit', 'R$ 0,58'],
                  ].map(([k, v], i) => (
                    <div key={k} className={`flex justify-between text-xs px-2 py-1.5 rounded ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                      <span className="text-slate-300">{k}</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t border-orange-400/20 pt-2 mt-2 px-2">
                    <span className="text-white">Custo total do kit</span>
                    <span className="text-orange-400">R$ 9,91</span>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-xs text-emerald-400 font-medium uppercase tracking-wide mb-1">Preço correto na Shopee: R$ 49,90</p>
                  <p className="text-2xl font-semibold text-emerald-300">41,1% de lucro</p>
                  <p className="text-sm text-emerald-400 mt-0.5">R$ 20,52 de lucro líquido por kit ✅</p>
                </div>
              </div>
            </div>

            {/* Caixa destaque */}
            <div className="mt-6 rounded-xl bg-orange-500/10 border border-orange-500/20 p-6">
              <p className="text-sm leading-7 text-slate-200">
                💡 <strong className="text-white">Olha a coincidência:</strong> Vender 1 kit de cofrinhos na Shopee paga 1 mês de SOA (R$ 29,90) <strong className="text-orange-300">e ainda sobra R$ 40,52 de lucro pro seu bolso.</strong>
                Sem o sistema, você venderia o mesmo kit por R$ 25,76 achando que está lucrando — e estaria ganhando R$ 1 por kit.
                Em 30 vendas: <span className="text-red-400 line-through">R$ 30 de lucro</span> <strong className="text-emerald-400">vs R$ 615 de lucro.</strong> <strong className="text-white">Essa é a diferença que clareza faz.</strong>
              </p>
              <div className="mt-4">
                <button
                  onClick={() => { ctaCheckout(anual) }}
                  className="inline-flex items-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 transition cursor-pointer border-0">
                  Quero ver meu lucro real <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ PRONTO EM 10 MINUTOS */}
        <section id="pronto" className="px-6 py-12 lg:px-8 bg-slate-900/40">
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="sem fricção"
              title="Do clique no botão ao primeiro pedido cadastrado: 10 minutos."
              text="Sem instalação, sem suporte técnico, sem fricção."
            />
            <div className="mt-14 relative">
              {/* Linha conectora */}
              <div className="absolute top-8 left-0 right-0 h-0.5 bg-orange-500/20 hidden md:block" style={{ marginLeft: '10%', marginRight: '10%' }} />
              <div className="grid gap-8 md:grid-cols-4">
                {[
                  { n: 1, title: 'Você assina pela Hotmart', desc: 'Sua conta é criada automaticamente' },
                  { n: 2, title: 'Recebe e-mail com login e senha', desc: 'Guarda essa info — é seu acesso' },
                  { n: 3, title: 'Escolhe seu segmento', desc: 'Laços, costura, bijuteria, papelaria, etc.' },
                  { n: 4, title: 'Cadastra seu primeiro pedido', desc: 'Tá tudo no ar ✨' },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex flex-col items-center text-center">
                    <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-2xl font-semibold text-white shadow-lg shadow-orange-500/30 mb-4">
                      {n}
                    </div>
                    <h3 className="text-base font-medium text-white mb-1">{title}</h3>
                    <p className="text-sm text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-10 text-center">
              <button
                onClick={() => { ctaCheckout(anual) }}
                className="inline-flex items-center rounded-xl bg-orange-500 px-8 py-4 text-base font-medium text-white hover:bg-orange-600 transition cursor-pointer border-0 shadow-lg shadow-orange-500/25">
                Quero começar agora <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ COMPARATIVO */}
        <CompareSection />

        {/* ══════════════════════════════════════ MÓDULOS */}
        <section id="modulos" className="px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionTitle
              eyebrow="8 módulos completos"
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
        <section className="px-6 py-12 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_0.95fr]">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                o que você ganha
              </div>
              <h3 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Cada mês sem controle é dinheiro que some sem você ver.
              </h3>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Artesãs que usam o SOA identificam em média <strong className="text-orange-300">R$200 a R$800 de prejuízo oculto</strong> só na primeira semana — preço errado, pedido esquecido, custo subestimado.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Produção por setor com status em tempo real',
                  'Precificação exata por canal (Shopee, ML, Elo7)',
                  'Visão Geral com seus números — receita, lucro e pedidos',
                  'Financeiro com caixa diário e metas mensais',
                  'IA que analisa seus dados e sugere melhorias',
                  'Múltiplos usuários com permissões por função',
                  'Calendário de envios para nunca atrasar',
                  'Orçamentos profissionais com aprovação online',
                  'Estoque de pronta entrega com alertas de mínimo',
                  'Dark mode, modo claro e personalização de cor',
                  'Primeiros passos guiados — pronto em menos de 10 min',
                  'Suporte via chat, FAQ e bot no Telegram',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <Check className="h-4 w-4 text-emerald-300 flex-shrink-0" />
                    <span className="text-sm text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-slate-400">R$29,90/mês · Menos de R$1,00 por dia · Sem cobrança por módulo · Cancele quando quiser</p>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
              <div className="border-b border-white/10 px-6 py-4 text-sm text-slate-400">Como a decisão de assinar se paga</div>
              <div className="grid gap-3 p-6">
                {[
                  'Preço no achismo: você vende R$25 e lucra R$3 sem saber',
                  '1 pedido esquecido = reclamação, estorno e avaliação ruim',
                  'Sem caixa diário: fim do mês no vermelho sem entender por quê',
                  'O SOA identifica isso no 1º dia — e custa R$29,90/mês',
                  'Com controle: mais lucro, menos estresse, mais recompra',
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
        <section id="preco" className="px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="planos e investimento"
              title="Escolha o plano do seu ateliê."
              text="Comece com o Basic e evolua quando precisar. Sem surpresas na fatura."
            />

            {/* Toggle mensal / anual */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${!anual ? 'text-white' : 'text-slate-400'}`}>Mensal</span>
              <button
                onClick={() => setAnual(a => !a)}
                className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-300 ${anual ? 'bg-orange-500' : 'bg-white/20'}`}
                aria-label="Alternar plano anual">
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${anual ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className={`text-sm font-medium ${anual ? 'text-white' : 'text-slate-400'}`}>Anual</span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-400">-33%</span>
            </div>
            {anual && (
              <p className="mt-3 text-center text-sm text-slate-400">
                Cobrado anualmente · Você economiza <strong className="text-emerald-400">R$118,40</strong> por ano no Basic
              </p>
            )}

            <div className="mt-10 grid gap-6 lg:grid-cols-3">

              {/* ── BASIC ── */}
              <div className="relative rounded-[32px] border-2 border-orange-400/60 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.16),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))] p-8 shadow-2xl shadow-orange-500/20">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-orange-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-orange-500/30">DISPONÍVEL AGORA</span>
                </div>
                <div className="inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">Basic</div>
                <div className="mt-4 flex items-end gap-1">
                  <span className="pb-2 text-lg text-slate-400">R$</span>
                  <span className="text-5xl font-semibold tracking-tight text-white">
                    {anual ? '20' : '29'}
                  </span>
                  <span className="pb-2 text-2xl text-white">{anual ? ',03' : ',90'}</span>
                  <span className="pb-2 text-slate-400">/mês</span>
                </div>
                {anual && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm line-through text-slate-500">R$29,90/mês</span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">-33%</span>
                  </div>
                )}
                <p className="mt-1 text-sm text-slate-400">
                  {anual ? `R$240,40 à vista — ou 12x R$23,99 com juros` : 'Menos de R$1,00/dia'}
                </p>
                <div className="mt-6 space-y-2.5">
                  {[
                    'Produção completa',
                    'Precificação por canal',
                    'Financeiro e caixa diário',
                    'IA consultiva (Gemini)',
                    'Visão Geral com seus números',
                    'Suporte via chat e Telegram',
                    'Calendário de envio de pedidos',
                    'Orçamentos → virar pedido',
                    '7 dias de garantia total',
                  ].map(i => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span className="text-sm text-slate-200">{i}</span>
                    </div>
                  ))}
                </div>
                {/* Badge 14 dias grátis */}
                <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-emerald-300">🎁 14 dias grátis para testar</p>
                  <p className="text-xs text-slate-400 mt-0.5">Sem cobrar nada agora · Cancele antes se não amar</p>
                </div>
                <button
                  onClick={() => { trackInitiateCheckout(anual ? 0 : 29.90); ctaCheckout(anual) }}
                  className="mt-4 flex w-full items-center justify-center rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/35 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
                >
                  Começar grátis agora <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <p className="mt-3 text-center text-xs text-slate-500">Após 14 dias: R$29,90/mês · Cancele quando quiser</p>
              </div>

              {/* ── PRO ── */}
              <div className="relative rounded-[32px] border border-white/15 bg-white/5 p-8 opacity-90">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-500/80 px-4 py-1 text-xs font-bold text-white">Em breve</span>
                </div>
                <div className="inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Pro</div>
                <div className="mt-4">
                  <span className="text-2xl font-semibold text-slate-300">Em breve</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Preço a confirmar no lançamento</p>
                <div className="mt-6 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tudo do Basic, mais:</p>
                  {[
                    'Integração via webhook com lojas',
                    'Shopee, Mercado Livre, Elo7',
                    'Relatórios customizados',
                    'Exportação de dados avançada',
                    'Automações de status de pedido',
                  ].map(i => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="h-4 w-4 flex-shrink-0 rounded-full border border-blue-400/40 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400/60" />
                      </div>
                      <span className="text-sm text-slate-400">{i}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex w-full items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-400/5 py-3.5 text-sm font-semibold text-blue-300">
                  🎁 14 dias grátis quando lançar
                </div>
                <p className="mt-3 text-center text-xs text-slate-600">Assinantes Basic têm acesso antecipado</p>
              </div>

              {/* ── ENTERPRISE ── */}
              <div className="relative rounded-[32px] border border-white/10 bg-white/[0.03] p-8 opacity-80">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-purple-500/80 px-4 py-1 text-xs font-bold text-white">Em breve</span>
                </div>
                <div className="inline-flex rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-purple-200">Enterprise</div>
                <div className="mt-4">
                  <span className="text-2xl font-semibold text-slate-400">Em breve</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">Para ateliês de maior escala</p>
                <div className="mt-6 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Tudo do Pro, mais:</p>
                  {[
                    'NF-e integrada para impressão direta',
                    'Importação de planilha com IA',
                    'Análise preditiva de demanda',
                    'Suporte prioritário dedicado',
                    'API para integrações customizadas',
                  ].map(i => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="h-4 w-4 flex-shrink-0 rounded-full border border-purple-400/30 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-400/50" />
                      </div>
                      <span className="text-sm text-slate-500">{i}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex w-full items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-400/5 py-3.5 text-sm font-semibold text-purple-400/70">
                  🚀 Em desenvolvimento
                </div>
              </div>

            </div>

            {/* Garantia */}
            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">14 dias grátis + 7 dias de garantia</h4>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Teste por 14 dias sem pagar nada. Depois, mais 7 dias de garantia total — se não amar, <strong className="text-white">100% do valor de volta, sem perguntas.</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Selos e meios de pagamento */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">🔒 Compra 100% segura via Hotmart</span>
            <span>·</span>
            <span>💳 Visa · Master · Elo · Boleto · PIX</span>
            <span>·</span>
            <span>⚖️ Dados criptografados</span>
          </div>
          <p className="mt-3 text-center text-xs text-slate-600">Você pode mudar do mensal pro anual a qualquer momento. Os 14 dias grátis valem pra qualquer plano.</p>
        </section>

        {/* ══════════════════════════════════════ MÓDULOS */}
        <section id="modulos-planos" className="px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="módulos"
              title="8 módulos disponíveis agora. Mais chegando."
              text="Todos os módulos do plano Basic estão prontos. Novos recursos chegam com os planos Pro e Enterprise."
            />
            <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { emoji: '📦', nome: 'Produção', desc: 'Pedidos, setores, fluxo completo', status: 'basic' },
                { emoji: '💰', nome: 'Precificação', desc: 'Materiais, produtos, canais, calculadora', status: 'basic' },
                { emoji: '💳', nome: 'Financeiro', desc: 'Entradas e Saídas, Caixa Diário, metas', status: 'basic' },
                { emoji: '🤖', nome: 'Análise com IA', desc: 'Chat Gemini + resumo do mês', status: 'basic' },
                { emoji: '📊', nome: 'Visão Geral', desc: 'Seus números + gráficos 6 meses + lucros', status: 'basic' },
                { emoji: '🎫', nome: 'Suporte', desc: 'FAQ, chamados, bot Telegram', status: 'basic' },
                { emoji: '📅', nome: 'Calendário de envios', desc: 'Mensal, semanal e diário por data de envio', status: 'basic' },
                { emoji: '📝', nome: 'Orçamentos', desc: 'Orçamento profissional → link → virar pedido', status: 'basic' },
                { emoji: '👥', nome: 'Clientes', desc: 'Todos os seus clientes em um só lugar.', status: 'basic-soon' },
                { emoji: '🚚', nome: 'Fornecedores', desc: 'Cadastre, organize e reutilize.', status: 'basic-soon' },
                { emoji: '🛍️', nome: 'Catálogo Web', desc: 'Seu catálogo online, do seu jeito.', status: 'basic-soon' },
                { emoji: '🔎', nome: 'Pesquisa de preço (IA)', desc: 'Preços justos, com mais segurança.', status: 'basic-soon' },
                { emoji: '✅', nome: 'Tarefas', desc: 'Organize, acompanhe e entregue.', status: 'basic-soon' },
                { emoji: '🔗', nome: 'Integrações webhook', desc: 'Shopee, Mercado Livre, Elo7', status: 'pro' },
                { emoji: '📈', nome: 'Relatórios custom', desc: 'Exportação e relatórios avançados', status: 'pro' },
                { emoji: '🧾', nome: 'NF-e integrada', desc: 'Emissão direta pelo sistema', status: 'enterprise' },
                { emoji: '🧠', nome: 'Importação com IA', desc: 'Planilha inteligente via IA', status: 'enterprise' },
              ].map(m => {
                const isBasic = m.status === 'basic'
                const isBasicSoon = m.status === 'basic-soon'
                const isPro = m.status === 'pro'
                const isEnterprise = m.status === 'enterprise'
                return (
                  <div key={m.nome} className={`rounded-2xl border p-5 transition-all ${
                    isBasic ? 'border-orange-400/30 bg-orange-400/5' :
                    isBasicSoon ? 'border-orange-400/20 bg-orange-400/5 opacity-80' :
                    isPro ? 'border-blue-400/20 bg-blue-400/5 opacity-70' :
                    'border-purple-400/15 bg-purple-400/5 opacity-60'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-2xl mb-2">{m.emoji}</div>
                        <div className="font-semibold text-white text-sm">{m.nome}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{m.desc}</div>
                      </div>
                      <div className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        isBasic ? 'bg-orange-500/20 text-orange-300' :
                        isBasicSoon ? 'bg-orange-400/15 text-orange-400' :
                        isPro ? 'bg-blue-500/20 text-blue-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {isBasic ? '✓ Basic' : isBasicSoon ? 'Basic ↑' : isPro ? 'Pro' : 'Enterprise'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-center text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500/60" />Disponível no Basic</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400/40" />Em breve no Basic</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400/60" />Plano Pro</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-400/60" />Enterprise</div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ GARANTIA */}
        <section className="px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-[36px] border border-emerald-400/25 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_50%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,1))] p-10 md:p-14 text-center shadow-2xl shadow-emerald-500/10">
              {/* Glow */}
              <div className="absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl" />
              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/15 ring-2 ring-emerald-400/20">
                  <ShieldCheck className="h-10 w-10 text-emerald-300" />
                </div>
                <div className="text-6xl mb-4">🛡️</div>
                <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                  Você não tem nada a perder.
                </h2>
                <p className="mt-3 text-lg font-semibold text-orange-400 uppercase tracking-wider">Garantia Total · 30 dias de risco zero</p>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                  Você tem <strong className="text-white">14 dias grátis</strong> pra testar o sistema completo — todos os módulos, todas as funções. A cobrança só acontece depois desse prazo, e mesmo assim você ainda tem <strong className="text-white">15 dias de garantia total</strong> após a primeira cobrança.
                  Se em algum momento desses 30 dias você achar que não é pra você, devolvemos 100% do seu dinheiro. Sem pergunta, sem burocracia, sem cara fechada.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { icon: '🎁', title: '14 dias grátis', sub: 'Sem cobrar nada agora' },
                    { icon: '🛡️', title: '+ 15 dias de garantia', sub: '100% do valor de volta' },
                    { icon: '⚡', title: '= 30 dias de risco zero', sub: 'Pra decidir com calma' },
                  ].map(g => (
                    <div key={g.title} className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
                      <div className="text-2xl mb-2">{g.icon}</div>
                      <div className="font-semibold text-white text-sm">{g.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{g.sub}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-sm text-slate-500">
                  Garantia processada diretamente pela Hotmart · Prazo de 7 dias corridos a partir da compra
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════ FAQ */}
        <section id="faq" className="px-6 py-12 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <SectionTitle
              eyebrow="objeções frequentes"
              title="Perguntas frequentes"
              text="Tire suas dúvidas antes de assinar — ou fale com a gente no suporte."
            />
            <div className="mt-12 space-y-4">
              {faqs.map((item) => (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5"
                >
                  <div className="flex w-full items-center gap-4 px-6 pt-6 pb-3">
                    <span className="text-xl font-light text-orange-400 flex-shrink-0">✦</span>
                    <h4 className="text-lg font-semibold text-white">{item.q}</h4>
                  </div>
                  <div className="px-6 pb-6 pl-14">
                    <p className="leading-7 text-slate-300">{item.a}</p>
                  </div>
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
                alt="SOA"
                className="mb-2 h-20 w-20 object-contain"
                style={{ mixBlendMode: 'lighten' }}
              />
              <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Quanto tempo a mais você quer trabalhar{' '}
                <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                  sem saber se está lucrando?
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                O SOA se adapta ao <strong className="text-white">SEU ateliê</strong> — laços, costura, bijuteria, encadernação, papelaria, qualquer nicho. Você configura os setores do seu jeito, calcula preço por canal e descobre se está lucrando de verdade. Use 14 dias grátis com calma. Se não for pra você, não paga nada — e mesmo depois, ainda tem 15 dias de garantia total.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => { trackInitiateCheckout(anual ? 0 : 29.90); ctaCheckout(anual) }}
                  className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/35 transition hover:bg-orange-600 active:scale-95 cursor-pointer border-0"
                >
                  Configurar meu ateliê agora <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <a
                  href="#modulos"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-base text-white transition hover:bg-white/10"
                >
                  Ver os módulos
                </a>
              </div>
              <p className="mt-6 text-sm text-slate-500">
                14 dias grátis · Cancele quando quiser · Acesso imediato
              </p>
            </div>
          </div>
        </section>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-6xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-2"
            >
              ✕ Fechar
            </button>
            <img
              src={lightbox}
              alt="Print do sistema SOA"
              className="w-full rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <VpsIcon />
            <span className="text-sm text-slate-500">SOA — ERP para artesãs</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href={novoCadastro ? '/register?plano=anual' : HOTMART_ANUAL} className="transition hover:text-white">Assinar</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
            <a href="/login" className="transition hover:text-orange-300">Área do cliente →</a>
            <a href="https://app.vps-gestao.com.br/login" className="transition hover:text-white">Entrar</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
