'use client'
// VALUATION DA EMPRESA — o card do Master → Receitas. Recalculado a cada abertura com os números reais (MRR, assinantes,
// faturamento acumulado, pedidos das artesãs). As premissas ficam à vista em "Como é calculado".
import { useEffect, useState } from 'react'
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import type { Valuation, Cenario } from '@/lib/master/valuation'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const mi = (v: number) => (Math.abs(v) >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi` : Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : brl(v))
const n = (v: number) => v.toLocaleString('pt-BR')
const card = 'rounded-2xl border border-gray-800 bg-gray-900 p-4'
const rotulo = 'text-[11px] uppercase tracking-wider text-gray-500'
const NOME: Record<Cenario, string> = { conservador: 'Conservador', base: 'Base', otimista: 'Otimista' }

export default function CardValuation() {
  const [v, setV] = useState<Valuation | null>(null)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    fetch('/api/master/valuation').then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Erro'); setV(j) }).catch(e => setErro((e as Error).message))
  }, [])
  if (erro) return <div className={card + ' text-sm text-red-300'}>Valuation: {erro}</div>
  if (!v) return <div className={card + ' text-sm text-gray-500'}>Calculando o valuation…</div>
  const c = v.cenarios
  return (
    <section className={card + ' border-amber-700/60 space-y-4'} data-card-valuation>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[16rem] flex-1">
          <p className={rotulo + ' flex items-center gap-1'}><TrendingUp className="h-3.5 w-3.5 text-amber-400" /> Valuation da empresa · hoje</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-amber-300" data-valuation-base>{mi(v.valuationBase)}</p>
          <p className="text-xs text-gray-400">cenário base · faixa {mi(c.conservador.valuation)} – {mi(c.otimista.valuation)} · recalculado agora com os números reais</p>
        </div>
        <div className="grid flex-[2] grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Mini t="ARR hoje" v={mi(v.hoje.arr)} s={`MRR ${brl(v.hoje.mrr)}`} />
          <Mini t="Assinantes" v={n(v.hoje.ativos)} s={`meta para hoje ${n(v.hoje.metaHoje)} · execução ${Math.round(v.hoje.fatorExecucao * 100)}%`} />
          <Mini t="Já faturado pelo SOA" v={mi(v.hoje.faturamentoAcumulado)} s={`líquido ${mi(v.hoje.faturamentoLiquidoAcumulado)}`} />
          <Mini t="Vendido pelas artesãs no SOA" v={mi(v.hoje.gmvAcumulado)} s={`${n(v.hoje.pedidos)} pedidos · ritmo ${mi(v.hoje.gmvAnualizado)}/ano`} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(c) as Cenario[]).map(k => (
          <div key={k} className={`rounded-xl border p-3 ${k === 'base' ? 'border-amber-700/70 bg-amber-950/20' : 'border-gray-800'}`} data-cenario={k}>
            <p className="text-xs font-semibold text-gray-300">{NOME[k]} · {c[k].multiplo}x ARR · retorno exigido {Math.round(c[k].desconto * 100)}% a.a.</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-gray-100">{mi(c[k].valuation)}</p>
            <p className="text-[11px] text-gray-500">piso por tração {mi(c[k].piso)} · método VC (meta 2028) {mi(c[k].vc)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm tabular-nums" data-roadmap-valuation>
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
            <th className="py-1">Ano</th><th>Assinantes</th><th>Ticket/mês</th><th>ARR (fim do ano)</th><th>Receita do ano</th><th>Novas assinaturas</th><th>Valuation (base)</th>
          </tr></thead>
          <tbody>{v.roadmap.map(r => (
            <tr key={r.ano} className="border-t border-gray-800/70 text-gray-200">
              <td className="py-1 font-semibold">{r.ano}</td><td>{n(r.assinantes)}</td><td>{brl(r.ticket)}</td><td>{mi(r.arr)}</td><td>{mi(r.receitaAno)}</td><td>{n(r.novasBrutas)}</td><td className="text-amber-300">{mi(r.valuationFimDoAno)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-gray-800 p-3" data-uso-recursos>
          <p className="text-xs font-semibold text-gray-300">Captação sugerida: <span className="text-amber-300">{mi(v.captacao.valor)}</span> <span className="font-normal text-gray-500">(paga o CAC de {n(v.captacao.novasAte2027)} assinaturas até 2027 a {brl(v.captacao.cac)})</span></p>
          {(['marketing', 'desenvolvimento', 'comercial'] as const).map(k => (
            <div key={k} className="mt-2">
              <div className="flex justify-between text-sm"><span className="capitalize text-gray-200">{k} · {Math.round(v.captacao.uso[k].pct * 100)}%</span><span className="tabular-nums text-gray-100">{mi(v.captacao.uso[k].valor)}</span></div>
              <div className="mt-0.5 h-1.5 rounded bg-gray-800"><div className="h-1.5 rounded bg-amber-500/80" style={{ width: `${v.captacao.uso[k].pct * 100}%` }} /></div>
              <p className="mt-0.5 text-[11px] text-gray-500">{v.captacao.uso[k].foco}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-800 p-3 text-sm" data-mercado>
          <p className="text-xs font-semibold text-gray-300">Mercado (nicho: artesãs e ateliês de personalizados)</p>
          <Linha k="Artesãos no Brasil (Sebrae/IBGE)" v={`${n(v.mercado.tam)} · ${n(v.mercado.mulheres)} mulheres`} />
          <Linha k={`Vendem com recorrência (${Math.round(v.premissas.pctSam * 100)}%, premissa)`} v={n(v.mercado.sam)} />
          <Linha k="Meta 2030" v={`${n(v.mercado.som2030)} assinantes · ${v.mercado.pctSamEm2030}% desse público`} />
          <Linha k="Receita potencial do público (ticket atual)" v={`${mi(v.mercado.receitaPotencialSam)}/ano`} />
          {v.hoje.churnMensalObservado !== null && <Linha k="Saídas/mês ÷ ativos (cortes por inadimplência + fim das assinaturas antigas da Hotmart)" v={`${v.hoje.churnMensalObservado}% · alvo ${Math.round(v.premissas.churnAlvo * 100)}%`} cor={v.hoje.churnMensalObservado > v.premissas.churnAlvo * 100 ? 'text-red-300' : 'text-emerald-300'} />}
        </div>
      </div>

      <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200" onClick={() => setAberto(a => !a)} data-como-calcula>{aberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Como é calculado</button>
      {aberto && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-gray-400">
          <li><b className="text-gray-300">Piso por tração</b>: ARR de hoje × múltiplo de SaaS early-stage (3x / 5x / 8x; vertical de nicho com retenção boa chega ao topo da faixa).</li>
          <li><b className="text-gray-300">Método VC</b>: ARR projetado para o fim de {v.premissas.anoAlvoVC} ({n(v.premissas.metas[2028])} assinantes × ticket de {brl(Math.max(v.premissas.ticketFuturo, v.hoje.ticketAtual))}) × múltiplo, trazido a valor de hoje pelo retorno exigido, × <b>fator de execução</b> (√ assinantes de hoje ÷ meta do roadmap para hoje, entre 50% e 120%).</li>
          <li>O valuation do cenário é o maior entre o piso e o método VC. Ele sobe sozinho quando o MRR, os assinantes ou o ticket sobem.</li>
          <li>Premissas: ticket do assinante novo {brl(v.premissas.ticketFuturo)}/mês (SOA {brl(v.premissas.ticketSoa)} + Método MAE {brl(v.premissas.ticketMae)}), churn alvo {Math.round(v.premissas.churnAlvo * 100)}%/mês, CAC {brl(v.premissas.cac)}, verba 40% marketing · 30% desenvolvimento · 30% comercial. Ficam em <code>lib/master/valuation.ts</code>.</li>
          <li>Estimativa para negociação, não laudo: o número final depende de retenção, crescimento mês a mês e do investidor.</li>
        </ul>
      )}
    </section>
  )
}

const Mini = ({ t, v, s }: { t: string; v: string; s: string }) => (
  <div className="rounded-xl border border-gray-800 p-2"><p className={rotulo}>{t}</p><p className="text-lg font-bold tabular-nums text-gray-100">{v}</p><p className="text-[11px] text-gray-500">{s}</p></div>
)
const Linha = ({ k, v, cor }: { k: string; v: string; cor?: string }) => (
  <div className="flex justify-between gap-3 border-b border-gray-800/60 py-1 last:border-0"><span className="text-gray-400">{k}</span><span className={`text-right tabular-nums ${cor ?? 'text-gray-100'}`}>{v}</span></div>
)
