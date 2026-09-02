'use client'
// Grid de módulos clicável + modal de detalhe (resumo de funções + telas do módulo +
// navegação anterior/próximo + CTA "Testar" sempre visível). Telas vêm do
// public/telas/manifest.json (mesma fonte do script de captura); módulo sem tela esconde o bloco.
// Deep-link ?modulo=<id>. Fecha por ✕, overlay e Esc. Mobile tela cheia + swipe. reduced-motion ok.
import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'ativo' | 'breve'
type Modulo = { id: string; nome: string; emoji: string; promessa: string; status: Status; telas: string[]; func: string[] }

const MODULOS: Modulo[] = [
  { id: 'producao', nome: 'Produção', emoji: '📦', status: 'ativo', telas: [], promessa: 'Do pedido à expedição, nada esquecido.',
    func: ['Pedidos com campos personalizados (foto, cor, tema, nome)', 'Prioridade e canal por pedido', 'Setores configuráveis (nome, cor, ícone)', 'Fluxo iniciar, concluir e devolver com motivo', 'Avanço automático entre setores', 'Expedição automática', 'Painel por setor', 'Calendário de envios', 'Impressão individual e em lista', 'Importação da planilha da Shopee', 'Operações em massa', 'Histórico e auditoria por pedido'] },
  { id: 'precificacao', nome: 'Precificação', emoji: '💰', status: 'ativo', telas: ['Precificação', 'Estoque'], promessa: 'Preço certo, com lucro por canal.',
    func: ['Materiais (custo do pacote vira custo unitário)', 'Embalagens', 'Produtos e variações', 'Combos e kits', 'Preço por canal (Shopee, Mercado Livre, Elo7, venda direta) com taxa e imposto', 'Calculadora de preço', 'Oráculo: compara os canais', 'Pesquisa de preço com IA', 'Tributos', 'Histórico de preço'] },
  { id: 'financeiro', nome: 'Financeiro', emoji: '💳', status: 'ativo', telas: ['Financeiro'], promessa: 'Você sabe o resultado do mês, sem susto.',
    func: ['Entradas e saídas', 'Recorrência e parcelamento', 'Anexo de comprovante no lançamento', 'Edições em massa', 'Caixa diário (clique no dia e veja o que vence)', 'Fluxo de caixa', 'Metas', 'Categorias e plano de contas', 'Resultado do mês (DRE)', 'Vendas de marketplace entram no caixa'] },
  { id: 'ia', nome: 'Análise do Negócio (IA)', emoji: '🤖', status: 'ativo', telas: ['Análise do Negócio'], promessa: 'A Sofia lê seus números e te aconselha.',
    func: ['A Sofia analisa seus dados reais e dá conselhos', 'Resumo do mês, maiores despesas e margem', 'Responde dúvidas do sistema passo a passo', 'Funciona também no bot do Telegram'] },
  { id: 'visao-geral', nome: 'Visão Geral', emoji: '📊', status: 'ativo', telas: ['Visão Geral'], promessa: 'Todos os seus números numa tela só.',
    func: ['Seus números em tempo real', 'Gráficos dos últimos meses', 'Lucro, produção e financeiro numa tela só'] },
  { id: 'calendario', nome: 'Calendário de envios', emoji: '📅', status: 'ativo', telas: [], promessa: 'Nunca mais atrasar uma entrega.',
    func: ['Todos os pedidos por data de envio', 'Visão mensal, semanal e diária', 'Bate o olho e sabe o que sai hoje'] },
  { id: 'orcamentos', nome: 'Orçamentos', emoji: '📝', status: 'ativo', telas: [], promessa: 'Orçamento profissional que vira pedido.',
    func: ['Orçamento com vários produtos, desconto e políticas', 'Link público de aprovação', 'Vira pedido com um clique', 'Cliente vinculado'] },
  { id: 'clientes', nome: 'Clientes', emoji: '👥', status: 'ativo', telas: [], promessa: 'Todos os clientes num lugar só.',
    func: ['Todos os clientes num lugar só', 'Histórico de cada cliente'] },
  { id: 'compras', nome: 'Compras', emoji: '🛒', status: 'ativo', telas: [], promessa: 'Compra que já vira custo e estoque.',
    func: ['Fornecedores', 'Pesquisa de preço', 'Pedido de compra que vira contas a pagar', 'Atualiza o custo do material', 'Dá entrada no estoque', 'Histórico com evolução de preço'] },
  { id: 'loja', nome: 'Minha Loja', emoji: '🛍️', status: 'ativo', telas: [], promessa: 'Sua loja, seu domínio, sem taxa de marketplace.',
    func: ['Vitrine online', 'Domínio próprio', 'Links diretos de produto e combo', 'Controle de estoque (mostra esgotado)', 'Checkout com contato', 'Aprovar ou recusar pedido', 'A venda entra no caixa'] },
  { id: 'tarefas', nome: 'Tarefas', emoji: '✅', status: 'ativo', telas: [], promessa: 'Organize, acompanhe e entregue.',
    func: ['Organize, acompanhe e entregue', 'Prazos e status'] },
  { id: 'pessoal', nome: 'Meu Pessoal', emoji: '🐷', status: 'ativo', telas: ['Meu Pessoal'], promessa: 'Seu dinheiro pessoal, separado do ateliê.',
    func: ['Finanças pessoais separadas do ateliê', 'Caixinhas (guardar e resgatar)', 'Lançamentos', 'Agenda com lembrete', 'Tarefas e notas', 'Saldo no Telegram'] },
  { id: 'suporte', nome: 'Suporte', emoji: '🎫', status: 'ativo', telas: [], promessa: 'Ajuda de verdade, quando você precisa.',
    func: ['FAQ', 'Chamados', 'Bot no Telegram'] },
  { id: 'config', nome: 'Configurações', emoji: '⚙️', status: 'ativo', telas: [], promessa: 'O sistema do jeito do seu ateliê.',
    func: ['Tema e cor', 'Setores', 'Campos do pedido', 'Freelancers', 'Usuários e permissões (Admin, Delegador, Operador)'] },
  { id: 'nfe', nome: 'Nota Fiscal (NF-e)', emoji: '🧾', status: 'breve', telas: [], promessa: 'Em breve: emita a nota direto do sistema.',
    func: ['Emita a nota fiscal (NF-e) direto do sistema'] },
  { id: 'integracao', nome: 'Integração com Marketplaces', emoji: '🔗', status: 'breve', telas: [], promessa: 'Em breve: conecte seus canais automaticamente.',
    func: ['Conexão automática com seus canais de venda'] },
]

type Tela = { arquivo: string; modulo: string; titulo: string }

export default function ModulosDetalhe({ onTestar }: { onTestar: () => void }) {
  const [telas, setTelas] = useState<Tela[]>([])
  const [aberto, setAberto] = useState<number | null>(null) // índice do módulo no modal
  const [slide, setSlide] = useState(0) // índice da tela dentro do módulo
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    fetch('/telas/manifest.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then((d: Tela[]) => { if (Array.isArray(d)) setTelas(d) }).catch(() => {})
  }, [])

  const abrir = useCallback((i: number) => {
    setAberto(i); setSlide(0)
    try { history.replaceState(null, '', `?modulo=${MODULOS[i].id}`) } catch {}
  }, [])
  const fechar = useCallback(() => {
    setAberto(null)
    try { history.replaceState(null, '', location.pathname + '#modulos-planos') } catch {}
  }, [])
  const irPara = useCallback((i: number) => { const n = ((i % MODULOS.length) + MODULOS.length) % MODULOS.length; setAberto(n); setSlide(0); try { history.replaceState(null, '', `?modulo=${MODULOS[n].id}`) } catch {} }, [])

  // Deep-link ?modulo= na montagem.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('modulo')
    if (!id) return
    const i = MODULOS.findIndex(m => m.id === id)
    if (i >= 0) { setAberto(i); setSlide(0) }
  }, [])

  // Esc fecha.
  useEffect(() => {
    if (aberto === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); if (e.key === 'ArrowRight') irPara(aberto + 1); if (e.key === 'ArrowLeft') irPara(aberto - 1) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [aberto, fechar, irPara])

  const m = aberto !== null ? MODULOS[aberto] : null
  const telasDoModulo = m ? telas.filter(t => m.telas.includes(t.modulo)) : []
  const telaAtual = telasDoModulo[Math.min(slide, telasDoModulo.length - 1)]

  const Selo = ({ s }: { s: Status }) => (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${s === 'ativo' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-400/15 text-orange-400'}`}>{s === 'ativo' ? '✓ Ativo' : 'Em breve'}</span>
  )

  return (
    <>
      {/* GRID clicável */}
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((mod, i) => (
          <button
            key={mod.id}
            onClick={() => abrir(i)}
            aria-label={`Ver detalhes do módulo ${mod.nome}`}
            className={`group flex items-start justify-between gap-2 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer ${mod.status === 'ativo' ? 'border-orange-400/30 bg-orange-400/5 hover:border-orange-400/60' : 'border-orange-400/20 bg-orange-400/5 opacity-80 hover:opacity-100'}`}
          >
            <span>
              <span className="mb-2 block text-2xl">{mod.emoji}</span>
              <span className="block text-sm font-semibold text-white">{mod.nome}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{mod.promessa}</span>
              <span className="mt-2 inline-block text-[11px] font-medium text-orange-300 opacity-0 transition-opacity group-hover:opacity-100">ver detalhes →</span>
            </span>
            <Selo s={mod.status} />
          </button>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3 justify-center text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500/60" />Ativo agora</div>
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400/40" />Em breve</div>
      </div>

      {/* MODAL de detalhe */}
      {m && (
        <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={fechar} role="dialog" aria-modal="true" aria-label={`Módulo ${m.nome}`}>
          <div
            className="relative flex w-full max-w-2xl flex-col overflow-hidden bg-slate-950 sm:max-h-[92vh] sm:rounded-[28px] sm:border sm:border-white/10"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{m.emoji}</span>
                <div>
                  <div className="flex items-center gap-2"><h3 className="text-lg font-bold text-white">{m.nome}</h3><Selo s={m.status} /></div>
                  <p className="mt-0.5 text-sm text-slate-400">{m.promessa}</p>
                </div>
              </div>
              <button onClick={fechar} aria-label="Fechar" className="shrink-0 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10">✕</button>
            </div>

            {/* Corpo rolável */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Telas do módulo (só se houver) */}
              {telasDoModulo.length > 0 && telaAtual && (
                <div>
                  <div
                    className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
                    onTouchStart={e => { touchX.current = e.touches[0].clientX }}
                    onTouchEnd={e => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) setSlide(s => { const n = dx < 0 ? s + 1 : s - 1; return ((n % telasDoModulo.length) + telasDoModulo.length) % telasDoModulo.length }); touchX.current = null }}
                  >
                    <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-red-400" /><span className="h-2 w-2 rounded-full bg-yellow-400" /><span className="h-2 w-2 rounded-full bg-green-400" />
                      <span className="ml-1 truncate text-[11px] text-slate-400">app.usesoa.com.br</span>
                    </div>
                    <div className="relative bg-slate-950" style={{ aspectRatio: '1512 / 900' }}>
                      {telasDoModulo.map((t, idx) => (
                        <img key={t.arquivo} src={t.arquivo} alt={`SOA · ${m.nome}: ${t.titulo}`} loading="lazy" aria-hidden={idx !== slide}
                          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ${idx === (slide % telasDoModulo.length) ? 'opacity-100' : 'opacity-0'}`} />
                      ))}
                    </div>
                  </div>
                  {telasDoModulo.length > 1 && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {telasDoModulo.map((t, idx) => (
                        <button key={t.arquivo} onClick={() => setSlide(idx)} aria-label={`Tela ${t.titulo}`} className={`h-2 rounded-full transition-all ${idx === (slide % telasDoModulo.length) ? 'w-6 bg-orange-400' : 'w-2 bg-white/20 hover:bg-white/40'}`} />
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-center text-xs text-slate-500">{telaAtual.titulo}</p>
                </div>
              )}

              {/* Resumo de funcionalidades */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">O que este módulo faz</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {m.func.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300"><span className="mt-0.5 text-orange-400">✓</span><span>{f}</span></li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Rodapé: navegação + CTA sempre visível */}
            <div className="border-t border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <button onClick={() => irPara(aberto! - 1)} className="flex items-center gap-1 text-slate-400 hover:text-white">‹ Anterior</button>
                <span className="text-xs text-slate-500">{(aberto ?? 0) + 1} / {MODULOS.length}</span>
                <button onClick={() => irPara(aberto! + 1)} className="flex items-center gap-1 text-slate-400 hover:text-white">Próximo ›</button>
              </div>
              <button onClick={onTestar} className="w-full rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 active:scale-95">Testar 7 dias grátis →</button>
              <button onClick={fechar} className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-300">Ver todos os módulos</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
