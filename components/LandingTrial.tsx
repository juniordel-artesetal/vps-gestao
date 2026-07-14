// Base compartilhada das landings evergreen de teste grátis (/30dias, /15dias, futuras).
// Recebe o PRAZO (dias) e o LINK de checkout como props — nada de evento, frictionless.
// Sem estado/hooks (server component leve). A Sofia não monta em rotas de landing.
import {
  Package, Calculator, Wallet, Users, ShoppingBag, KanbanSquare,
  Sparkles, Boxes, LineChart, FileSpreadsheet, Check,
} from 'lucide-react'
import { DEPOIMENTOS_IMG, DEPOIMENTOS_TEXTO } from '@/lib/depoimentos'

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

export default function LandingTrial({ dias, checkoutHref }: { dias: number; checkoutHref: string }) {
  // CTA repetível — link DIRETO para o checkout (abre em nova aba). O Meta Pixel
  // (InitiateCheckout) é configurado pelo Event Setup Tool sobre o clique do botão.
  const CtaHotmart = ({ className = '', bloco = false, texto = 'Começar meu teste grátis' }: { className?: string; bloco?: boolean; texto?: string }) => (
    <a
      href={checkoutHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`hotmart-fb hotmart__button-checkout inline-flex items-center justify-center gap-2 font-bold rounded-2xl transition active:scale-95 shadow-lg ${bloco ? 'w-full' : ''} ${className}`}
      style={{ background: '#f97316', color: '#fff', boxShadow: '0 10px 20px -6px rgba(249,115,22,.55)' }}
    >
      <Check size={18} /> {texto}
    </a>
  )

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ colorScheme: 'light' }}>
      {/* ─── Hero ─── */}
      <header className="px-5 pt-12 pb-8 text-center" style={{ background: 'linear-gradient(160deg,#fff7ed,#ffffff)' }}>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full mb-3">
          🧡 Sistema de Organização de Ateliês
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight max-w-2xl mx-auto">
          Organize seu ateliê com o <span className="text-orange-600">SOA</span> — <span className="whitespace-nowrap">{dias} dias grátis</span>
        </h1>
        <p className="text-gray-600 mt-3 max-w-xl mx-auto">
          O sistema que junta produção, preço, financeiro, loja e IA num lugar só. Feito para artesãs e pequenos ateliês.
        </p>
        <div className="mt-6 max-w-sm mx-auto"><CtaHotmart bloco className="py-4 text-base" /></div>
        <p className="text-[11px] text-gray-400 mt-2">Sem compromisso · leva menos de 1 minuto</p>
      </header>

      {/* ─── O que é o SOA ─── */}
      <section className="px-5 py-10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold">O que é o SOA?</h2>
          <p className="text-gray-600 mt-2">
            SOA é o <strong>Sistema de Organização de Ateliês</strong>: um só lugar para cuidar dos pedidos, dos preços, do dinheiro,
            dos clientes e da sua loja — com ajuda de inteligência artificial para você tomar decisões melhores.
          </p>
        </div>
      </section>

      {/* ─── Módulos ─── */}
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
          <div className="mt-7 max-w-sm mx-auto"><CtaHotmart bloco className="py-4 text-base" texto={`Quero testar ${dias} dias grátis`} /></div>
        </div>
      </section>

      {/* ─── Como funciona em 3 passos ─── */}
      <section className="px-5 py-10 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-6">Como funciona, em 3 passos</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { n: '1', t: 'Ative o teste', d: `Comece agora, com ${dias} dias grátis. Rápido e sem complicação.` },
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

      {/* ─── Prova social ─── */}
      <section className="px-5 py-10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="inline-block text-sm font-bold text-orange-700 bg-orange-100 px-4 py-1.5 rounded-full mb-5">+300 assinantes já organizam o ateliê com o SOA</p>

          {/* Depoimentos em imagem */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {DEPOIMENTOS_IMG.map((src, i) => (
              <img key={src} src={src} alt={`Depoimento ${i + 1}`} loading="lazy"
                className="w-full rounded-2xl border border-gray-100 shadow-sm object-cover" />
            ))}
          </div>

          {/* Depoimentos em texto (se houver) */}
          {DEPOIMENTOS_TEXTO.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-left">
              {DEPOIMENTOS_TEXTO.map((d, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    {d.foto && <img src={d.foto} alt={d.nome} className="w-10 h-10 rounded-full object-cover" />}
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{d.nome}</p>
                      {d.contexto && <p className="text-xs text-gray-400">{d.contexto}</p>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-snug">“{d.texto}”</p>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-semibold text-gray-500 mb-3">Um pouquinho do sistema por dentro</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {['dashboard', 'producao', 'precificacao', 'financeiro'].map(p => (
              <img key={p} src={`/prints/${p}.png`} alt={p} loading="lazy"
                className="w-full rounded-xl border border-gray-100 shadow-sm object-cover" />
            ))}
          </div>

          <div className="mt-8 max-w-sm mx-auto"><CtaHotmart bloco className="py-4 text-base" /></div>
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="px-5 py-12 text-center" style={{ background: 'linear-gradient(160deg,#f97316,#fb923c)' }}>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white max-w-xl mx-auto leading-tight">Comece hoje com {dias} dias grátis</h2>
        <p className="text-orange-50 mt-2 max-w-md mx-auto">Sem compromisso. Organize seu ateliê e veja a diferença.</p>
        <div className="mt-6 max-w-sm mx-auto">
          <a href={checkoutHref} target="_blank" rel="noopener noreferrer"
            className="hotmart-fb hotmart__button-checkout inline-flex w-full items-center justify-center gap-2 font-bold rounded-2xl py-4 text-base transition active:scale-95"
            style={{ background: '#fff', color: '#ea580c', boxShadow: '0 12px 24px -8px rgba(0,0,0,.3)' }}>
            <Check size={18} /> Começar meu teste grátis
          </a>
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-xs text-gray-400">
        <p>SOA — Sistema de Organização de Ateliês</p>
        <p className="mt-1">Teste grátis de {dias} dias · sem compromisso</p>
      </footer>
    </div>
  )
}
