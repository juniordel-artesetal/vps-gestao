// usesoa.com.br/mae — PÁGINA DE VENDAS do Método MAE (Lote 20, item 247). Pública, sem login, feita para o celular
// (o tráfego vem do Instagram/WhatsApp e da live de 16/10). Copy do doc da Naty (docs/mae-ajustes-lote-20.md).
// Preços: lidos da MESMA config do checkout (MAE_* + o preço vigente do SOA) — nada chumbado aqui. Decisão do Júnior
// (15/10): os 4 planos já divulgados (só o MAE mensal/anual, SOA + MAE mensal/anual = a soma dos dois) + a troca do SOA
// mensal para o anual. Prints em /mae/img (os do guia, com nomes de clientes ocultos); o guia completo em /mae/guia.html.
import type { Metadata } from 'next'
import Link from 'next/link'
import { precosMae, cobrancaMae } from '@/lib/mae/assinatura/precos'
import { precoMensalVigente, anualAvistaVigente, calcularParcelamentoAnual } from '@/lib/assinatura/planos'
import { inicioLancamentoMae } from '@/lib/mae/assinatura/lancamento'
import { Cta, Calculadora, Contato } from './SiteMae'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Método MAE no SOA — seu pedido chega, a arte sai pronta',
  description: 'O Método MAE agora mora dentro do SOA: você monta o kit uma vez, veste cada tema em minutos e o sistema gera a arte de cada pedido com o nome, a idade e a quantidade certa.',
  openGraph: {
    title: 'Método MAE no SOA — seu pedido chega, a arte sai pronta',
    description: 'Monte o kit uma vez. O SOA gera a arte de cada pedido com o nome, a idade e a quantidade certa. Um PDF, um start na impressora.',
    url: 'https://www.usesoa.com.br/mae', siteName: 'SOA', locale: 'pt_BR', type: 'website',
    images: [{ url: 'https://www.usesoa.com.br/mae/img/pedidos.jpg', width: 1400, height: 671 }],
  },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const r2 = (v: number) => Math.round(v * 100) / 100
/** O aviso da live some 3 h depois do início do lançamento. */
const liveAindaNoAr = (agora = new Date()) => agora.getTime() < inicioLancamentoMae().getTime() + 3 * 3600_000

function Print({ src, alt, legenda, w, h }: { src: string; alt: string; legenda?: string; w: number; h: number }) {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-2xl border border-[#eadfd6] bg-white shadow-[0_10px_30px_-18px_rgba(124,45,18,0.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- prints estáticos já comprimidos; lazy nativo */}
        <img src={`/mae/img/${src}`} alt={alt} width={w} height={h} loading="lazy" decoding="async" className="block h-auto w-full" />
      </div>
      {legenda && <figcaption className="mt-2 text-sm text-[#7a6a5f]">{legenda}</figcaption>}
    </figure>
  )
}

const FAQ: [string, string][] = [
  ['Preciso saber Photoshop?', 'Não. Se você já usa o Método MAE no Photoshop, vai se sentir em casa; se não usa, o passo a passo te leva do molde ao PDF.'],
  ['Funciona no celular?', 'Não. É para computador, no Chrome ou no Edge.'],
  ['Minhas artes ficam na internet?', 'Não. Ficam numa pasta no seu computador. Recomendamos deixar dentro do Dropbox ou Drive para ter backup.'],
  ['Funciona com a minha máquina de corte?', 'Você sobe a marca de registro da sua máquina; o MAE coloca na folha em tamanho real e tem ajuste fino. Também gera linhas de corte para quem corta na faca.'],
  ['Posso usar as fontes que eu comprei?', 'Sim. O MAE usa as fontes instaladas no seu computador.'],
  ['Já tenho meus kits prontos em PDF. Perco tudo?', 'Não. Suba como tema pronto e o MAE só troca o nome e a idade.'],
  ['Como o sistema sabe o nome e a quantidade?', 'Do pedido no SOA (campos TEMA, NOME e IDADE do seu produto). A quantidade do pedido é o total de peças que a cliente recebe.'],
  ['Tem tutorial?', 'Tem o passo a passo ilustrado, do molde ao PDF, com prints reais do sistema — e a Central de Ajuda com busca e videoaulas está chegando.'],
  ['Posso cancelar?', 'Pode, quando quiser, na própria tela da assinatura. Nenhuma cobrança nova é feita e você continua usando até o fim do período que já pagou. Os 7 primeiros dias são grátis: cancelando no teste, não paga nada.'],
]

export default function PaginaMae() {
  const p = precosMae()
  const soaMensal = precoMensalVigente(), soaAnual = anualAvistaVigente(), soa12 = calcularParcelamentoAnual(12, soaAnual).valorParcela
  const planos = p && {
    soMensal: p.standalone.mensal, soAnual: p.standalone.anual, so12: cobrancaMae(p, 'standalone', 'anual', 12).valorParcela,
    addMensal: p.addon.mensal, addAnual: p.addon.anual, add12: cobrancaMae(p, 'addon', 'anual', 12).valorParcela,
  }
  const liveAinda = liveAindaNoAr()

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffaf5] text-[#2b211b] [font-family:'Nunito_Sans',system-ui,sans-serif]">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,700&display=swap" precedence="default" />
      <style>{`.disp{font-family:'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-0.02em}`}</style>

      {/* topo fixo enxuto */}
      <header className="sticky top-0 z-30 border-b border-[#f1e4d8] bg-[#fffaf5]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="disp text-xl font-extrabold text-[#2b211b]">SOA <span className="text-[#f97316]">· Método MAE</span></Link>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#planos" className="hidden font-semibold text-[#7a6a5f] hover:text-[#c2410c] sm:inline">Planos</a>
            <a href="/mae/guia.html" className="hidden font-semibold text-[#7a6a5f] hover:text-[#c2410c] sm:inline">Como usar</a>
            <a href="/login" className="font-semibold text-[#c2410c]">Entrar</a>
          </nav>
        </div>
      </header>

      {/* 1. Topo */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 md:grid-cols-[1fr_1.15fr] md:pt-16">
        <div>
          <p className="inline-block rounded-full bg-[#ffedd5] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#c2410c]">Método MAE · agora dentro do SOA</p>
          <h1 className="disp mt-4 text-[2.6rem] font-extrabold leading-[1.02] [text-wrap:balance] sm:text-6xl">Seu pedido chega. <span className="text-[#f97316]">A arte sai pronta.</span></h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#5b4a3f]">O Método MAE agora mora dentro do SOA. Você monta seu kit uma vez, veste cada tema em minutos e o sistema gera a arte de cada pedido com o nome, a idade e a quantidade certa. Um PDF, um start na impressora.</p>
          <div className="mt-7">
            <Cta href="#planos" botao="topo" className="inline-flex w-full items-center justify-center rounded-2xl bg-[#f97316] px-6 py-4 text-lg font-bold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.8)] hover:bg-[#ea580c] sm:w-auto">Quero o Método MAE no meu ateliê</Cta>
            <p className="mt-3 text-sm text-[#7a6a5f]">Funciona no computador, no Chrome ou no Edge. Seus arquivos ficam no seu computador.</p>
          </div>
          {liveAinda && (
            <a href="https://youtube.com/live/2wxv5XOCLNA" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#b91c1c] hover:underline">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ef4444] motion-reduce:animate-none" /> Live de lançamento: sexta, 16/10, às 20h no YouTube
            </a>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- print do topo: carrega já (não lazy) */}
        <img src="/mae/img/pedidos.jpg" alt="Tela de pedidos do Método MAE no SOA, com o botão Gerar" width={1400} height={671} fetchPriority="high" className="block h-auto w-full rounded-2xl border border-[#eadfd6] bg-white shadow-[0_24px_50px_-28px_rgba(124,45,18,0.45)]" />
      </section>

      {/* 2. A dor */}
      <section className="bg-[#2b211b] text-[#fbeee3]">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="disp text-3xl font-extrabold sm:text-4xl">Me conta se o seu dia é assim</h2>
          <ul className="mt-7 space-y-4 text-lg leading-relaxed">
            {[
              'Abre o PSD do kit. Troca o nome na milk. Troca no cubo. Troca na pirâmide. Na maleta. No cone.',
              'Confere o acento, porque a fonte linda do tema não tem "ú".',
              'Exporta. Abre o próximo pedido. Repete.',
              'Na hora de imprimir, entra pedido por pedido, digita a quantidade de cada um… e reza pra não errar.',
              'E quando a máquina corta torto, é papel, tinta e tempo indo pro lixo.',
            ].map(t => <li key={t} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fb923c]" />{t}</li>)}
          </ul>
          <p className="mt-8 text-lg text-[#e7cdb8]">Agora multiplica isso por 30, 50, 100 pedidos na semana de pico.</p>
          <p className="disp mt-4 text-2xl font-extrabold text-white sm:text-3xl">Você não abriu um ateliê pra digitar nome. Abriu pra vender.</p>
        </div>
      </section>

      {/* 3. A virada */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="disp text-4xl font-extrabold sm:text-5xl">Molde. Arrasta. Encaixa.</h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#5b4a3f]">O Método MAE é a técnica que a Naty Costa criou em 10 anos de papelaria personalizada. Milhares de alunas usam no Photoshop. Agora ela virou sistema, ligado direto aos seus pedidos.</p>
        <p className="mt-6 font-bold">Três passos, e só o último se repete:</p>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ['Base', 'uma vez por kit', 'Seus moldes nas folhas, com cada face nomeada: frente, fundo, lateral. Você marca onde vai o nome.'],
            ['Tema', 'minutos', 'Arrasta o papel na FRENTE: todas as frentes de todas as caixas recebem na hora. Personagem, laço, estilo do nome: uma vez só.'],
            ['Pedidos', 'todo dia', 'O SOA já traz o tema, o nome, a idade e a quantidade. Você confere e clica em Gerar.'],
          ].map(([t, q, d], i) => (
            <li key={t} className="rounded-2xl border border-[#f1e4d8] bg-white p-5">
              <span className="disp flex h-9 w-9 items-center justify-center rounded-full bg-[#f97316] text-lg font-extrabold text-white">{i + 1}</span>
              <p className="disp mt-3 text-xl font-extrabold">{t} <span className="text-base font-semibold text-[#c2410c]">({q})</span></p>
              <p className="mt-1.5 leading-relaxed text-[#5b4a3f]">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Print src="base-partes.jpg" alt="Base com as partes coloridas" w={1400} h={704} legenda="Base: cada cor é uma parte (FRENTE, FUNDO, LATERAL…)." />
          <Print src="tema-papeis.jpg" alt="Tema com os papéis arrastados para as partes" w={1400} h={626} legenda="Tema: arrastou o papel na parte, aparece em todas as caixas." />
        </div>
      </section>

      {/* 4. O que você ganha */}
      <section className="border-y border-[#f1e4d8] bg-white">
        <div className="mx-auto max-w-6xl space-y-16 px-4 py-16">
          {[
            { t: 'Um PDF com o lote inteiro', d: 'Selecione os pedidos do dia e gere tudo num arquivo só, na quantidade certa de cada cliente. Ordem "a mesma caixa junta": todas as milk, depois todos os cubos, pra cortar em sequência. Um start na impressora.', img: <Print src="gerar.jpg" alt="Janela Gerar com as opções do lote" w={519} h={666} /> },
            { t: 'Corte em cima da linha', d: 'Você sobe a marca de registro da sua máquina e o MAE coloca na folha em tamanho real. Se a sua máquina desvia, o ajuste fino corrige em décimos de milímetro, e vale pra todos os pedidos.', img: <Print src="corte-antes-depois.jpg" alt="Caixas cortadas antes e depois do ajuste fino" w={1000} h={1333} legenda="Embaixo, antes. Em cima, depois do ajuste." /> },
            { t: 'Nome lindo em qualquer nome', d: 'Nome curto ou "Maria Eduarda", o MAE ajusta pra caber. Nome composto em uma ou duas linhas. Fonte sem acento? Ele coloca o acento. Cor por letra, enfeite preso ao nome (o lacinho na última letra), estilos prontos da Naty.', img: <Print src="tema-texto.jpg" alt="Painel de texto do tema" w={1400} h={581} /> },
            { t: 'Tags, rótulos e etiquetas no automático', d: 'Tag de 4 cm, rótulo de Nutella, etiqueta escolar: escolha a medida e o MAE distribui na folha. Pedido de 96 tags vira 4 folhas, sem conta de cabeça.', img: <Print src="sob-medida.jpg" alt="Peças sob medida: tag redonda com furo" w={1400} h={696} /> },
            { t: 'Já tem as artes prontas? Aproveita', d: 'Suba o PDF do kit que você já fez no Photoshop como "tema pronto". O MAE encaixa cada página na caixa certa e só troca o nome.', img: <Print src="tema-pronto-salvar.jpg" alt="Tema pronto em todas as caixas da base" w={1400} h={644} /> },
          ].map((b, i) => (
            <div key={b.t} className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 ? 'md:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <h3 className="disp text-3xl font-extrabold [text-wrap:balance]">{b.t}</h3>
                <p className="mt-3 text-lg leading-relaxed text-[#5b4a3f]">{b.d}</p>
              </div>
              <div className={b.t === 'Corte em cima da linha' || b.t === 'Um PDF com o lote inteiro' ? 'mx-auto w-full max-w-sm' : ''}>{b.img}</div>
            </div>
          ))}
          <div className="rounded-3xl bg-[#fff7ed] p-6 sm:p-8">
            <h3 className="disp text-3xl font-extrabold">Seus arquivos são seus</h3>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-[#5b4a3f]">Moldes, papéis, fontes e PDFs ficam numa pasta no seu computador (no Dropbox ou Drive, com backup). Nada de arte presa na nuvem de ninguém.</p>
          </div>
        </div>
      </section>

      {/* 5. A conta */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="disp text-4xl font-extrabold">Faz a conta com os seus números</h2>
            <p className="mt-4 text-lg leading-relaxed text-[#5b4a3f]">Pedidos por semana × minutos que você gasta trocando nome e montando o PDF de cada um.</p>
            <p className="mt-4 text-lg leading-relaxed text-[#5b4a3f]">Exemplo: 50 pedidos × 15 minutos = <b className="text-[#2b211b]">12 horas e meia por semana</b> só personalizando e organizando impressão. Com o MAE, o trabalho de montar fica no tema (uma vez) e o pedido vira conferir e gerar.</p>
            <p className="disp mt-5 text-2xl font-extrabold">Essas horas viram mais pedidos, mais anúncio, mais vida.</p>
          </div>
          <Calculadora />
        </div>
      </section>

      {/* 6. Para quem é */}
      <section className="border-y border-[#f1e4d8] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="disp text-3xl font-extrabold">É pra você se…</h2>
            <ul className="mt-5 space-y-3 text-lg leading-relaxed text-[#5b4a3f]">
              {['vende kits personalizados (Shopee, Elo7, Instagram, WhatsApp) e troca nome em vários arquivos por pedido;', 'corta na máquina (Silhouette, Cameo, Brother) ou na corte e vinco;', 'quer crescer sem contratar alguém só pra editar nome;', 'já usa o Método MAE no Photoshop e quer o mesmo jeito, automático.'].map(t => <li key={t} className="flex gap-3"><span className="font-bold text-[#16a34a]">✓</span>{t}</li>)}
            </ul>
          </div>
          <div>
            <h2 className="disp text-3xl font-extrabold">Não é pra você se…</h2>
            <ul className="mt-5 space-y-3 text-lg leading-relaxed text-[#5b4a3f]">
              {['trabalha só pelo celular (o MAE é para computador);', 'faz cada arte do zero, sem repetir kit.'].map(t => <li key={t} className="flex gap-3"><span className="font-bold text-[#b91c1c]">✕</span>{t}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* 7. Quem criou */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="disp text-4xl font-extrabold">Feito por quem vive isso todo dia</h2>
        <p className="mt-4 text-lg leading-relaxed text-[#5b4a3f]">Naty Costa, 10 anos de papelaria personalizada, dona das lojas Artes e Tal e Fofuras de Papel, criadora do Método MAE. Cada botão desse sistema foi testado na produção real do ateliê dela, com pedido de verdade, antes de chegar até você.</p>
      </section>

      {/* 8. Planos */}
      <section id="planos" className="scroll-mt-16 bg-[#2b211b] text-[#fbeee3]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="disp text-4xl font-extrabold text-white sm:text-5xl">Escolha o seu plano</h2>
          <p className="mt-3 max-w-2xl text-lg text-[#e7cdb8]">7 dias grátis para testar. Pagamento no cartão, na página segura do Asaas. Cancele quando quiser, pela própria tela da assinatura.</p>
          {!planos ? (
            <p className="mt-8 rounded-2xl bg-white/10 p-6 text-lg">Os planos estarão aqui em instantes. Volte em alguns minutos.</p>
          ) : (
            <>
              <div className="mt-10 grid gap-5 lg:grid-cols-2">
                <Plano destaque titulo="SOA + Método MAE" para="O sistema completo do ateliê (pedidos, produção, financeiro, precificação) + o Método MAE."
                  mensal={r2(soaMensal + planos.addMensal)} anual={r2(soaAnual + planos.addAnual)} doze={r2(soa12 + planos.add12)}
                  composicao={`SOA ${brl(soaMensal)} + MAE ${brl(planos.addMensal)} por mês · no anual, SOA ${brl(soaAnual)} + MAE ${brl(planos.addAnual)}`}
                  botoes={[
                    { href: '/mae/assinatura', botao: 'soa-mae-ja-assino', texto: 'Já assino o SOA: ativar o Método MAE', sub: `você paga só + ${brl(planos.addMensal)}/mês (ou ${brl(planos.addAnual)}/ano)`, principal: true },
                    { href: '/register', botao: 'soa-mae-novo', texto: 'Ainda não tenho o SOA', sub: 'crie sua conta no SOA e ative o Método MAE dentro dele' },
                  ]} />
                <Plano titulo="Só o Método MAE" para="Para quem quer só o módulo, sem o SOA. Os pedidos entram pela planilha da Shopee ou pelo cadastro manual."
                  mensal={planos.soMensal} anual={planos.soAnual} doze={planos.so12}
                  botoes={[
                    { href: '/mae/cadastro', botao: 'so-mae', texto: 'Assinar só o Método MAE', principal: true },
                    { href: '/mae/assinatura', botao: 'so-mae-conta', texto: 'Já tenho conta no SOA', sub: 'entre com ela e assine por lá' },
                  ]} />
              </div>
              <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between" data-plano="migrar-anual">
                <div>
                  <p className="disp text-xl font-extrabold text-white">Já paga o SOA mensal? Troque para o anual</p>
                  <p className="mt-1 text-[#e7cdb8]">SOA anual por {brl(soaAnual)} à vista ou 12× de {brl(soa12)}. A 1ª cobrança do anual só vem quando a sua mensalidade atual vencer, e a mensalidade é cancelada sozinha: você nunca paga os dois.</p>
                </div>
                <Cta href="/assinatura/migrar-anual" botao="migrar-anual" className="shrink-0 rounded-xl border-2 border-[#fb923c] px-5 py-3 text-center font-bold text-[#fdba74] hover:bg-[#fb923c] hover:text-[#2b211b]">Trocar para o anual</Cta>
              </div>
              <p className="mt-6 text-sm text-[#cdb5a2]">Todos os planos incluem: Base, Tema, Tema pronto, Peças sob medida, Marca de registro com ajuste fino, Pedidos em massa e o passo a passo ilustrado. Anual à vista ou em até 12× no cartão (parcelado com juros).</p>
            </>
          )}
        </div>
      </section>

      {/* 9. Perguntas frequentes */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="disp text-4xl font-extrabold">Perguntas frequentes</h2>
        <div className="mt-6 divide-y divide-[#f1e4d8] rounded-2xl border border-[#f1e4d8] bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">{q}<span className="text-2xl font-normal text-[#f97316] transition group-open:rotate-45">+</span></summary>
              <p className="mt-2 leading-relaxed text-[#5b4a3f]">{q === 'Tem tutorial?' ? <>{a} <a href="/mae/guia.html" className="font-semibold text-[#c2410c] underline">Ver o passo a passo</a></> : a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 10. Fechamento */}
      <section className="bg-[#fff1e6]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="disp text-4xl font-extrabold [text-wrap:balance] sm:text-5xl">Seu próximo pico de pedidos pode ser diferente</h2>
          <p className="mt-4 text-lg text-[#5b4a3f]">Você monta o kit uma vez. O sistema faz o resto, pedido por pedido.</p>
          <Cta href="#planos" botao="fechamento" className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#f97316] px-6 py-4 text-lg font-bold text-white hover:bg-[#ea580c] sm:w-auto">Quero o Método MAE no meu ateliê</Cta>
          <div className="mt-6 text-[#5b4a3f]"><Contato whatsapp={process.env.MAE_WHATSAPP_URL || null} /></div>
        </div>
      </section>

      <footer className="border-t border-[#f1e4d8] px-4 py-8 text-center text-sm text-[#9a8677]">
        SOA · Método MAE · <Link href="/" className="hover:underline">usesoa.com.br</Link> · <a href="/mae/guia.html" className="hover:underline">Como usar</a>
      </footer>
    </div>
  )
}

function Plano(p: {
  titulo: string; para: string; mensal: number; anual: number; doze: number; composicao?: string; destaque?: boolean
  botoes: { href: string; botao: string; texto: string; sub?: string; principal?: boolean }[]
}) {
  return (
    <div className={`relative flex flex-col rounded-3xl p-6 sm:p-7 ${p.destaque ? 'bg-[#fffaf5] text-[#2b211b] ring-4 ring-[#f97316]' : 'bg-[#fffaf5] text-[#2b211b]'}`} data-plano={p.titulo}>
      {p.destaque && <span className="absolute -top-3 left-6 rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Mais completo</span>}
      <h3 className="disp text-2xl font-extrabold">{p.titulo}</h3>
      <p className="mt-1 text-[#5b4a3f]">{p.para}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#eadfd6] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#9a8677]">Mensal</p>
          <p className="disp mt-1 text-[1.7rem] font-extrabold leading-none [font-variant-numeric:tabular-nums]">{brl(p.mensal)}</p>
          <p className="mt-1 text-sm text-[#7a6a5f]">por mês</p>
        </div>
        <div className="rounded-2xl border border-[#eadfd6] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#9a8677]">Anual</p>
          <p className="disp mt-1 text-[1.7rem] font-extrabold leading-none [font-variant-numeric:tabular-nums]">{brl(p.anual)}</p>
          <p className="mt-1 text-sm text-[#7a6a5f]">ou 12× de {brl(p.doze)}</p>
        </div>
      </div>
      {p.composicao && <p className="mt-3 text-sm text-[#7a6a5f]">{p.composicao}</p>}
      <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
        {p.botoes.map(b => (
          <Cta key={b.botao} href={b.href} botao={b.botao} className={`block rounded-2xl px-5 py-3.5 text-center font-bold ${b.principal ? 'bg-[#f97316] text-white hover:bg-[#ea580c]' : 'border-2 border-[#eadfd6] text-[#2b211b] hover:border-[#f97316]'}`}>
            {b.texto}{b.sub && <span className={`block text-xs font-semibold ${b.principal ? 'text-orange-50' : 'text-[#7a6a5f]'}`}>{b.sub}</span>}
          </Cta>
        ))}
      </div>
    </div>
  )
}
