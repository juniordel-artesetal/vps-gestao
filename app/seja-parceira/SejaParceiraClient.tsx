'use client'
// Programa de Parceiras — página de vendas pública (tom SOA, mobile-first).
// Simulador 100% client-side (sem backend). Valores de exemplo, não garantidos.
import { useState } from 'react'

const COMISSAO_MENSAL = 8.97   // 30% de R$ 29,90/mês (recorrente)
const COMISSAO_ANUAL = 96.16   // 40% de R$ 240,40 (à vista)
const ASAAS_REF = 'https://www.asaas.com/r/7606c57d-94eb-4b39-a708-e2b5f0c8d179'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SejaParceiraClient() {
  const [mensais, setMensais] = useState(10)
  const [anuais, setAnuais] = useState(2)

  const ganhoMensal = mensais * COMISSAO_MENSAL
  const ganhoAnual = anuais * COMISSAO_ANUAL
  const totalAno = mensais * COMISSAO_MENSAL * 12 + anuais * COMISSAO_ANUAL

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <a href="/landing" className="text-lg font-bold tracking-tight">SOA<span className="text-orange-400">.</span></a>
          <a href="/parceira/candidatar" className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600">Quero ser parceira</a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-20">
        {/* HERO */}
        <section className="pt-14 pb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">Ganhe dinheiro indicando o SOA 💛</h1>
          <p className="mt-4 text-slate-300 text-lg">
            Vire parceira do SOA, indique artesãs e ganhe <b className="text-white">comissão recorrente</b> — enquanto elas forem assinantes, você recebe.
          </p>
          <a href="/parceira/candidatar" className="mt-7 inline-block rounded-2xl bg-orange-500 px-7 py-3.5 text-base font-semibold shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 active:scale-95">
            Quero ser parceira
          </a>
        </section>

        {/* COMO FUNCIONA */}
        <section className="py-8">
          <h2 className="text-xl font-bold text-center mb-6">Como funciona</h2>
          <div className="space-y-3">
            {[
              ['1', 'Cadastre-se e receba seu link exclusivo e seu cupom.'],
              ['2', 'Compartilhe com sua audiência (Stories, bio, grupos).'],
              ['3', 'Toda vez que alguém assina pelo seu link, você ganha — e continua ganhando a cada renovação.'],
            ].map(([n, t]) => (
              <div key={n} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-orange-500 font-bold">{n}</span>
                <p className="text-slate-200 pt-1">{t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* QUANTO GANHA */}
        <section className="py-8">
          <h2 className="text-xl font-bold text-center mb-6">Quanto você ganha</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="text-sm text-slate-400">Plano mensal</p>
              <p className="mt-1 text-3xl font-bold text-emerald-400">{brl(COMISSAO_MENSAL)}</p>
              <p className="text-sm text-slate-300">por mês, por assinante</p>
              <p className="mt-1 text-xs text-orange-300">30% de comissão · recorrente</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <p className="text-sm text-slate-400">Plano anual</p>
              <p className="mt-1 text-3xl font-bold text-emerald-400">{brl(COMISSAO_ANUAL)}</p>
              <p className="text-sm text-slate-300">por assinante</p>
              <p className="mt-1 text-xs text-orange-300">40% de comissão</p>
            </div>
          </div>
          <p className="mt-4 text-center text-slate-300">E o melhor: é <b className="text-white">recorrente</b>. Enquanto ela for assinante, você continua recebendo.</p>
        </section>

        {/* SIMULADOR */}
        <section className="py-8">
          <div className="rounded-3xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-transparent p-6">
            <h2 className="text-xl font-bold text-center mb-1">Simule seus ganhos</h2>
            <p className="text-center text-sm text-slate-400 mb-6">Arraste e veja quanto dá</p>

            <Slider label="Indicadas no plano mensal" valor={mensais} set={setMensais} />
            <Slider label="Indicadas no plano anual" valor={anuais} set={setAnuais} />

            <div className="mt-6 grid gap-3 sm:grid-cols-3 text-center">
              <Bloco titulo="Por mês (recorrente)" valor={brl(ganhoMensal)} />
              <Bloco titulo="Anuais (à vista)" valor={brl(ganhoAnual)} />
              <Bloco titulo="Total no 1º ano" valor={brl(totalAno)} destaque />
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-slate-400">
              <span>Ex.: 10 mensais = <b className="text-slate-200">R$ 89,70/mês</b></span>
              <span>10 anuais = <b className="text-slate-200">R$ 961,60</b></span>
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-500">Valores de exemplo. O ganho real depende das suas indicações e não é garantido.</p>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="py-8 text-center">
          <a href="/parceira/candidatar" className="inline-block rounded-2xl bg-orange-500 px-8 py-4 text-lg font-semibold shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 active:scale-95">
            Quero ser parceira
          </a>
        </section>

        {/* RODAPÉ ASAAS */}
        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-slate-400">
          Para receber suas comissões você precisa de uma conta Asaas (gratuita). Não tem?{' '}
          <a href={ASAAS_REF} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">Abra a sua pela nossa parceria</a>.
        </section>
      </main>
    </div>
  )
}

function Slider({ label, valor, set }: { label: string; valor: number; set: (n: number) => void }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-slate-300">{label}</label>
        <span className="text-lg font-bold text-orange-300">{valor}</span>
      </div>
      <input type="range" min={0} max={100} value={valor} onChange={e => set(Number(e.target.value))}
        className="w-full accent-orange-500" />
    </div>
  )
}
function Bloco({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${destaque ? 'bg-orange-500/20 border border-orange-400/40' : 'bg-white/5 border border-white/10'}`}>
      <p className="text-xs text-slate-400">{titulo}</p>
      <p className={`mt-1 text-xl font-bold ${destaque ? 'text-white' : 'text-emerald-400'}`}>{valor}</p>
    </div>
  )
}
