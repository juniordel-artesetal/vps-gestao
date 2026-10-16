'use client'
// MÉTODO MÃE na landing — as 2 formas de ter (add-on do SOA × só o MAE), mensal/anual pelo MESMO toggle da landing.
// Preços vêm da config (precosMae: MAE_ADDON_* / MAE_STANDALONE_*), lidos no servidor — nada chumbado aqui.
// Gate de lançamento = o mesmo do checkout (vendaMaeAtiva): fechado → "Entrar na lista de espera" (o site não vende o
// que o checkout ainda não processa); aberto → add-on "Ativar no Hub de Módulos", só o MAE → cadastro + assinatura.
import { useState } from 'react'

export interface OfertaMae { mensal: number; anual: number; parcela12: number; economiaPct: number }
type Plano = 'addon' | 'standalone'

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PlanosMae({ ofertas, vendaAberta, anual, setAnual }: {
  ofertas: Record<Plano, OfertaMae> | null; vendaAberta: boolean; anual: boolean; setAnual: (v: boolean) => void
}) {
  const [lista, setLista] = useState<Plano | null>(null)
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [site, setSite] = useState('')
  const [estado, setEstado] = useState<{ plano: Plano; ok: boolean; msg: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrarNaLista(e: React.FormEvent, plano: Plano) {
    e.preventDefault()
    setEnviando(true)
    try {
      const r = await fetch('/api/mae/lista-espera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, nome, plano, site }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui guardar agora.')
      setEstado({ plano, ok: true, msg: 'Pronto! Você está na lista — avisamos no seu e-mail quando o Método Mãe abrir.' }); setLista(null)
    } catch (x) { setEstado({ plano, ok: false, msg: (x as Error).message }) }
    setEnviando(false)
  }

  const card = (plano: Plano, titulo: string, sub: string, destaque: boolean) => {
    const o = ofertas?.[plano]
    const [int, cent] = o ? brl(anual ? o.anual : o.mensal).split(',') : ['', '']
    return (
      <div className={`flex flex-col rounded-3xl border p-6 ${destaque ? 'border-orange-400/50 bg-orange-400/[0.07]' : 'border-white/10 bg-white/[0.03]'}`} data-plano-mae={plano}>
        <p className="text-xs font-bold uppercase tracking-wider text-orange-300">{titulo}</p>
        <p className="mt-1 text-sm text-slate-400">{sub}</p>
        {o ? (
          <div className="mt-5" data-preco-mae={plano}>
            <div className="flex items-baseline gap-1 text-white">
              <span className="text-lg font-semibold">R$</span>
              <span className="text-4xl font-bold tabular-nums">{int}</span>
              <span className="text-lg font-semibold tabular-nums">,{cent}</span>
              <span className="ml-1 text-sm text-slate-400">/{anual ? 'ano' : 'mês'}</span>
            </div>
            {anual
              ? <p className="mt-1 text-xs text-slate-400">ou 12× de R$ {brl(o.parcela12)} no cartão (com juros) · <strong className="text-emerald-300">economize {o.economiaPct}%</strong> vs. 12 meses no mensal</p>
              : <p className="mt-1 text-xs text-slate-400">no anual: R$ {brl(o.anual)} — <strong className="text-emerald-300">{o.economiaPct}% de economia</strong></p>}
          </div>
        ) : <p className="mt-5 text-sm font-semibold text-orange-300" data-preco-mae-breve>Preço no lançamento</p>}
        <div className="mt-auto pt-6">
          {vendaAberta && o ? (
            plano === 'addon'
              ? <a href="/modulos" className="block rounded-full bg-orange-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-400" data-cta-mae="addon">Ativar no Hub de Módulos</a>
              : <a href="/mae/cadastro" className="block rounded-full bg-orange-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-400" data-cta-mae="standalone">Assinar só o Método Mãe</a>
          ) : estado?.plano === plano && estado.ok ? (
            <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-200" role="status" data-lista-ok>{estado.msg}</p>
          ) : lista === plano ? (
            <form onSubmit={e => void entrarNaLista(e, plano)} className="space-y-2" data-form-lista-mae={plano}>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome (opcional)" aria-label="Seu nome" autoComplete="name"
                className="w-full rounded-full border border-white/15 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu melhor e-mail" aria-label="Seu e-mail" autoComplete="email"
                className="w-full rounded-full border border-white/15 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none" data-lista-email />
              {/* armadilha de robô: escondida de quem usa a página */}
              <input type="text" value={site} onChange={e => setSite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
              <button type="submit" disabled={enviando} className="w-full rounded-full bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-60" data-lista-enviar>{enviando ? 'Guardando…' : 'Me avise quando abrir'}</button>
              {estado?.plano === plano && !estado.ok && <p className="text-center text-xs text-red-300" role="alert">{estado.msg}</p>}
            </form>
          ) : (
            <button onClick={() => { setLista(plano); setEstado(null) }} className="w-full rounded-full border border-orange-400/50 px-5 py-3 text-sm font-bold text-orange-200 transition hover:bg-orange-400/10" data-cta-mae-espera={plano}>
              Em breve · Entrar na lista de espera
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div id="metodo-mae" className="mt-16 scroll-mt-24 rounded-[32px] border border-orange-400/25 bg-[linear-gradient(160deg,rgba(251,146,60,0.08),rgba(2,6,23,0.6))] p-6 sm:p-10" data-landing-mae>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <span className="inline-block rounded-full bg-orange-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-300">{vendaAberta ? 'Novo módulo' : 'Em breve'}</span>
          <h3 className="mt-3 text-2xl font-bold text-white text-balance">🎨 Método Mãe</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Crie a arte de um kit de caixas uma vez só: monte a <strong className="text-white">base</strong>, escolha o <strong className="text-white">tema</strong> e ele se replica em todas as faces — com o nome de cada pedido e o arquivo pronto para imprimir.</p>
        </div>
        {/* o mesmo toggle mensal/anual da seção de preço */}
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-xs font-semibold" role="group" aria-label="Período de cobrança">
          <button onClick={() => setAnual(false)} aria-pressed={!anual} className={`rounded-full px-4 py-1.5 transition ${!anual ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-white'}`} data-mae-ciclo="mensal">Mensal</button>
          <button onClick={() => setAnual(true)} aria-pressed={anual} className={`rounded-full px-4 py-1.5 transition ${anual ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-white'}`} data-mae-ciclo="anual">Anual</button>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {card('addon', 'Para quem já assina o SOA', 'Ative dentro do seu SOA, no Hub de Módulos. Tudo junto: pedidos, produção e a arte.', true)}
        {card('standalone', 'Só o Método Mãe', 'Sem o SOA: só a criação das artes e a edição em massa dos pedidos.', false)}
      </div>
    </div>
  )
}
