import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'VPS Gestão — ERP para Artesãs',
  description: 'Sistema completo para gerenciar sua produção, precificação e financeiro. Feito para artesãs.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Script
        id="hotmart-widget"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            var imported = document.createElement('script');
            imported.src = 'https://static.hotmart.com/checkout/widget.min.js';
            document.head.appendChild(imported);
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = 'https://static.hotmart.com/css/hotmart-fb.min.css';
            document.head.appendChild(link);
          `,
        }}
      />

      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-sm">V</div>
          <span className="font-semibold text-white">VPS Gestão</span>
        </div>
        <a
          href="https://pay.hotmart.com/C105122525T?checkoutMode=2&off=6s58g8wc"
          className="hotmart-fb hotmart__button-checkout text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition"
         
        >
          Assinar agora
        </a>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <span className="inline-block text-xs font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full mb-6">
          ERP feito para artesãs 🎀
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
          Organize seu ateliê do<br />
          <span className="text-orange-500">jeito que você merece</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          Controle sua produção, calcule preços certos, cuide do financeiro e tome
          decisões com dados reais — tudo em um só lugar, simples como deve ser.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://pay.hotmart.com/C105122525T?checkoutMode=2&off=6s58g8wc"
            className="hotmart-fb hotmart__button-checkout inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl text-base font-semibold transition"
           
          >
            Começar agora →
          </a>
          <a
            href="#como-funciona"
            className="inline-flex items-center justify-center gap-2 border border-gray-700 text-gray-300 hover:border-gray-500 px-8 py-4 rounded-xl text-base transition"
          >
            Como funciona
          </a>
        </div>
      </section>

      {/* Módulos */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-3">Tudo que você precisa em um só lugar</h2>
        <p className="text-gray-400 text-center mb-12">6 módulos integrados, pensados para a realidade do seu ateliê</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { emoji: '📦', titulo: 'Produção', desc: 'Acompanhe cada pedido do início ao fim. Setores configuráveis do seu jeito.' },
            { emoji: '💰', titulo: 'Precificação', desc: 'Calcule o preço certo para cada canal: Shopee, ML, Elo7 e mais.' },
            { emoji: '💳', titulo: 'Financeiro', desc: 'Receitas, despesas, fluxo de caixa e metas mensais com clareza.' },
            { emoji: '🤖', titulo: 'IA de Gestão', desc: 'Converse com IA que conhece os dados reais do seu negócio.' },
            { emoji: '📊', titulo: 'Dashboard', desc: 'Visão geral do seu negócio em tempo real, do financeiro à produção.' },
            { emoji: '🎧', titulo: 'Suporte IA', desc: 'Assistente que te guia passo a passo no sistema a qualquer hora.' },
          ].map(m => (
            <div key={m.titulo} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-orange-500/30 transition">
              <div className="text-3xl mb-3">{m.emoji}</div>
              <h3 className="text-base font-semibold text-white mb-1">{m.titulo}</h3>
              <p className="text-sm text-gray-400">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Passo a passo da compra */}
      <section id="como-funciona" className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-3">Como funciona?</h2>
        <p className="text-gray-400 text-center mb-12">Da compra ao primeiro pedido em menos de 10 minutos</p>
        <div className="flex flex-col gap-4">
          {[
            {
              num: '1',
              titulo: 'Assine o plano',
              desc: 'Clique em "Começar agora" e conclua o pagamento na Hotmart. Aceitamos cartão, PIX e boleto.',
              detalhe: 'Você receberá um e-mail de confirmação da Hotmart com o comprovante.',
            },
            {
              num: '2',
              titulo: 'Acesse o sistema',
              desc: 'Após a confirmação do pagamento, acesse vps-gestao.natycostapro.com.br e clique em "Criar conta".',
              detalhe: 'Use o mesmo e-mail da compra na Hotmart para que seu acesso seja vinculado automaticamente.',
            },
            {
              num: '3',
              titulo: 'Crie sua conta',
              desc: 'Informe o nome do seu negócio, e-mail e crie uma senha. Em segundos seu workspace estará pronto.',
              detalhe: 'Cada negócio tem um ambiente próprio e isolado — seus dados são só seus.',
            },
            {
              num: '4',
              titulo: 'Configure seu ateliê',
              desc: 'Escolha o segmento do seu negócio (laços, bijuteria, sublimação...) e os setores de produção.',
              detalhe: 'O sistema sugere setores prontos para cada tipo de ateliê. Você pode ajustar à vontade.',
            },
            {
              num: '5',
              titulo: 'Cadastre seus produtos',
              desc: 'Adicione materiais, custos e deixe o sistema calcular o preço ideal para cada canal de venda.',
              detalhe: 'As taxas da Shopee, Mercado Livre e outros canais já estão atualizadas para 2026.',
            },
            {
              num: '6',
              titulo: 'Comece a usar!',
              desc: 'Crie seu primeiro pedido, acompanhe a produção e explore o dashboard com os dados do seu negócio.',
              detalhe: 'Qualquer dúvida, nossa IA de suporte está disponível 24h dentro do sistema.',
            },
          ].map(p => (
            <div key={p.num} className="flex gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">
                {p.num}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">{p.titulo}</h3>
                <p className="text-sm text-gray-300 mb-1">{p.desc}</p>
                <p className="text-xs text-gray-500">{p.detalhe}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Segmentos */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-3">Para qual negócio é?</h2>
        <p className="text-gray-400 text-center mb-10">Configurado para o seu segmento desde o primeiro acesso</p>
        <div className="flex flex-wrap gap-3 justify-center">
          {[
            '🎀 Laços e Tiaras', '🧵 Costura e Moda', '💍 Bijuteria e Joias',
            '🖨️ Sublimação', '🧶 Crochê e Tricô', '🪵 MDF e Madeira',
            '🎨 Biscuit', '🎉 Festas e Lembrancinhas', '📒 Papelaria',
            '🕯️ Velas e Cosméticos', '💎 Resina', '🏺 Cerâmica',
            '👜 Costura Criativa', '🎈 Balão Personalizado', '⚙️ Personalizado',
          ].map(s => (
            <span key={s} className="text-sm bg-gray-900 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/5 border border-orange-500/20 rounded-3xl p-10">
          <h2 className="text-2xl font-bold text-white mb-3">Pronta para organizar seu ateliê?</h2>
          <p className="text-gray-400 mb-8">Junte-se a centenas de artesãs que já organizam seus negócios com o VPS Gestão</p>
          <a
            href="https://pay.hotmart.com/C105122525T?checkoutMode=2&off=6s58g8wc"
            className="hotmart-fb hotmart__button-checkout inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-xl text-base font-semibold transition"
           
          >
            Assinar o VPS Gestão →
          </a>
          <p className="text-xs text-gray-600 mt-4">Pagamento seguro via Hotmart · Cartão, PIX ou Boleto</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-6 text-center">
        <p className="text-xs text-gray-600">© 2026 VPS Gestão · Suporte: <a href="https://vps-gestao.natycostapro.com.br/suporte" className="text-orange-500 hover:underline">Central de Suporte</a></p>
      </footer>
    </div>
  )
}
