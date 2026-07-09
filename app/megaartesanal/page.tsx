'use client'
// app/megaartesanal/page.tsx
// Landing pública da feira Mega Artesanal 2026 — pop-up de lead (gate) + conteúdo +
// checkout Hotmart. Mobile-first e leve (aberta no celular, no meio da feira).
import { useState, useEffect } from 'react'
import Script from 'next/script'
import { trackLead } from '@/components/MetaPixel'
import {
  Package, Calculator, Wallet, Users, ShoppingBag, KanbanSquare,
  Sparkles, Boxes, LineChart, FileSpreadsheet, Check, MapPin, Calendar,
} from 'lucide-react'

const HOTMART_HREF = 'https://pay.hotmart.com/C105122525T?checkoutMode=2&off=793olsmv'
const LS_KEY = 'megaartesanal2026_lead'

// CTA repetível — mantém as classes/href que o widget da Hotmart intercepta.
function CtaHotmart({ className = '', bloco = false }: { className?: string; bloco?: boolean }) {
  return (
    <a
      onClick={e => e.preventDefault()}
      href={HOTMART_HREF}
      className={`hotmart-fb hotmart__button-checkout inline-flex items-center justify-center gap-2 font-bold rounded-2xl transition active:scale-95 shadow-lg ${bloco ? 'w-full' : ''} ${className}`}
      style={{ background: '#f97316', color: '#fff', boxShadow: '0 10px 20px -6px rgba(249,115,22,.55)' }}
    >
      <Check size={18} /> Teste agora — 30 dias grátis
    </a>
  )
}

const MODULOS = [
  { icon: Package, nome: 'Produção com setores', desc: 'Pedidos passando por cada etapa do ateliê, do início à expedição.' },
  { icon: Calculator, nome: 'Precificação', desc: 'Custo real, margem e preço certo por canal de venda.' },
  { icon: Wallet, nome: 'Financeiro', desc: 'Entradas, saídas, contas a pagar/receber e metas.' },
  { icon: Users, nome: 'Clientes (CRM)', desc: 'Cadastro, histórico de compras e contatos organizados.' },
  { icon: ShoppingBag, nome: 'Minha Loja', desc: 'Catálogo / loja virtual com link próprio para vender.' },
  { icon: KanbanSquare, nome: 'Tarefas', desc: 'Quadro Kanban para organizar o dia a dia da equipe.' },
  { icon: Sparkles, nome: 'Assistente de Compras (IA)', desc: 'Descubra a faixa de preço de mercado dos seus materiais.' },
  { icon: Boxes, nome: 'Estoque', desc: 'Controle de materiais e de produtos prontos.' },
  { icon: LineChart, nome: 'Análise de Gestão (IA)', desc: 'Converse com uma IA que conhece os números do seu negócio.' },
  { icon: FileSpreadsheet, nome: 'Importação de planilhas', desc: 'Traga seus dados de outro sistema sem digitar tudo de novo.' },
]

export default function MegaArtesanalPage() {
  const [precisaCadastro, setPrecisaCadastro] = useState(false)
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [consent, setConsent] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    try { if (!localStorage.getItem(LS_KEY)) setPrecisaCadastro(true) }
    catch { setPrecisaCadastro(true) }
  }, [])

  function onTel(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    let f = d
    if (d.length > 2) f = `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length > 7) f = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    setTel(f)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const digits = tel.replace(/\D/g, '')
    if (nome.trim().length < 2) return setErro('Escreva seu nome.')
    if (digits.length < 10 || digits.length > 11) return setErro('Escreva um WhatsApp válido com DDD.')
    if (!consent) return setErro('Marque a caixinha para aceitar receber contato.')
    setEnviando(true)
    try {
      const r = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone: digits, consentimento: true, origem: 'megaartesanal2026' }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(d?.error || 'Não consegui registrar. Tente de novo.'); return }
      try { trackLead() } catch {}
      try { localStorage.setItem(LS_KEY, '1') } catch {}
      setPrecisaCadastro(false)
    } catch {
      setErro('Sem conexão. Tente de novo.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ colorScheme: 'light' }}>
      {/* Widget da Hotmart */}
      <Script src="https://static.hotmart.com/checkout/widget.min.js" strategy="afterInteractive" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://static.hotmart.com/css/hotmart-fb.min.css" />

      {/* ─── POP-UP DE LEAD (gate) ─── */}
      {precisaCadastro && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={enviar} className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full mb-2">🎁 Mega Artesanal 2026</div>
              <h2 className="text-xl font-extrabold leading-tight">Ganhe <span className="text-orange-600">30 dias grátis</span> do SOA</h2>
              <p className="text-sm text-gray-500 mt-1">Deixe seu contato para liberar o acesso e a página.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Seu nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Seu WhatsApp</label>
                <input value={tel} onChange={e => onTel(e.target.value)} inputMode="numeric" placeholder="(11) 98888-7777"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-orange-500 w-4 h-4 flex-shrink-0" />
                <span className="text-xs text-gray-500 leading-snug">
                  Aceito receber contato da equipe SOA sobre o teste gratuito. Consulte a{' '}
                  <a href="https://usesoa.com.br" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">política de privacidade</a>.
                </span>
              </label>
              {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
              <button type="submit" disabled={enviando}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl py-3 text-base transition disabled:opacity-60 active:scale-95">
                {enviando ? 'Enviando...' : 'Liberar meu acesso →'}
              </button>
              <p className="text-[10px] text-gray-400 text-center">Seus dados ficam seguros e são usados só para o contato do teste.</p>
            </div>
          </form>
        </div>
      )}

      {/* ─── CONTEÚDO ─── */}
      {/* Hero */}
      <header className="px-5 pt-10 pb-8 text-center" style={{ background: 'linear-gradient(160deg,#fff7ed,#ffffff)' }}>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full mb-3">🎀 Mega Artesanal 2026</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight max-w-2xl mx-auto">
          Organize seu ateliê com o <span className="text-orange-600">SOA</span> — <span className="whitespace-nowrap">30 dias grátis</span>
        </h1>
        <p className="text-gray-600 mt-3 max-w-xl mx-auto">
          O sistema que junta produção, preço, financeiro, loja e IA num lugar só. Feito para artesãs e pequenos ateliês.
        </p>
        <div className="mt-6 max-w-sm mx-auto"><CtaHotmart bloco className="py-4 text-base" /></div>
        <p className="text-[11px] text-gray-400 mt-2">Sem compromisso · leva menos de 1 minuto</p>
      </header>

      {/* A feira */}
      <section className="px-5 py-8 bg-orange-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-lg font-bold flex items-center justify-center gap-2"><Calendar size={18} className="text-orange-500" /> Estamos na Mega Artesanal 2026</h2>
          <p className="text-gray-600 mt-1 text-sm flex items-center justify-center gap-1.5"><MapPin size={14} /> 11 a 15/07/2026 · São Paulo Expo</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-left">
            <div className="bg-white rounded-2xl p-4 border border-orange-100">
              <p className="font-semibold text-gray-800">Stand da <span className="text-orange-600">Offpapper</span></p>
              <p className="text-sm text-gray-500 mt-0.5">Sábado (11/07)</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-orange-100">
              <p className="font-semibold text-gray-800">Stand da <span className="text-orange-600">Fofurices de Aplique</span></p>
              <p className="text-sm text-gray-500 mt-0.5">Sábado e domingo (11 e 12/07)</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">Venha nos conhecer pessoalmente! 💛</p>
        </div>
      </section>

      {/* O que é o SOA */}
      <section className="px-5 py-10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold">O que é o SOA?</h2>
          <p className="text-gray-600 mt-2">
            SOA é o <strong>Sistema de Organização de Ateliês</strong>: um só lugar para cuidar dos pedidos, dos preços, do dinheiro,
            dos clientes e da sua loja — com ajuda de inteligência artificial para você tomar decisões melhores.
          </p>
        </div>
      </section>

      {/* Módulos */}
      <section className="px-5 pb-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-5">Tudo o que você precisa, junto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULOS.map(m => (
              <div key={m.nome} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center mb-2">
                  <m.icon size={18} className="text-orange-500" />
                </div>
                <p className="font-semibold text-gray-800 text-sm">{m.nome}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona em 3 passos */}
      <section className="px-5 py-10 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-6">Como funciona, em 3 passos</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { n: '1', t: 'Ative o teste', d: 'Comece agora, com 30 dias grátis. Rápido e sem complicação.' },
              { n: '2', t: 'Traga seus dados', d: 'Importe planilhas de pedidos, produtos e clientes de onde você já usa.' },
              { n: '3', t: 'Organize e cresça', d: 'Acompanhe produção, preço e financeiro num painel só.' },
            ].map(p => (
              <div key={p.n} className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center mx-auto mb-3">{p.n}</div>
                <p className="font-semibold text-gray-800">{p.t}</p>
                <p className="text-sm text-gray-500 mt-1">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prova social */}
      <section className="px-5 py-10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="inline-block text-sm font-bold text-orange-700 bg-orange-100 px-4 py-1.5 rounded-full mb-5">+300 assinantes já organizam o ateliê com o SOA</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {[1, 2, 3].map(i => (
              <img key={i} src={`/depoimento-${i}.jpeg`} alt={`Depoimento ${i}`} loading="lazy"
                className="w-full rounded-2xl border border-gray-100 shadow-sm object-cover" />
            ))}
          </div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Um pouquinho do sistema por dentro</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {['dashboard', 'producao', 'precificacao', 'financeiro'].map(p => (
              <img key={p} src={`/prints/${p}.png`} alt={p} loading="lazy"
                className="w-full rounded-xl border border-gray-100 shadow-sm object-cover" />
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 py-12 text-center" style={{ background: 'linear-gradient(160deg,#f97316,#fb923c)' }}>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white max-w-xl mx-auto leading-tight">Comece hoje com 30 dias grátis</h2>
        <p className="text-orange-50 mt-2 max-w-md mx-auto">Sem compromisso. Organize seu ateliê e veja a diferença.</p>
        <div className="mt-6 max-w-sm mx-auto">
          <a onClick={e => e.preventDefault()} href={HOTMART_HREF}
            className="hotmart-fb hotmart__button-checkout inline-flex w-full items-center justify-center gap-2 font-bold rounded-2xl py-4 text-base transition active:scale-95"
            style={{ background: '#fff', color: '#ea580c', boxShadow: '0 12px 24px -8px rgba(0,0,0,.3)' }}>
            <Check size={18} /> Teste agora
          </a>
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-xs text-gray-400">
        <p>SOA — Sistema de Organização de Ateliês</p>
        <p className="mt-1">Mega Artesanal 2026 · oferta de teste de 30 dias</p>
      </footer>
    </div>
  )
}
