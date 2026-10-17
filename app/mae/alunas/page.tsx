// usesoa.com.br/mae/alunas — PLANO ALUNAS VPS · MÉTODO MÃE (16/10/2026, pedido do Júnior). Para a área de membros da
// Hotmart e os grupos: só o Método Mãe por R$ 49,90/mês ou R$ 419/ano (à vista no Pix/cartão ou até 12× com juros).
// Link com validade (31/10/2026 23h59) e UMA compra por conta — quem decide é o servidor (lib/mae/assinatura/alunas.ts e
// criarCheckoutMae); a página só mostra. Cada preço vai DIRETO ao pagamento (/mae/pagar?o=alunas…). Fora do Google.
import type { Metadata } from 'next'
import { precoAlunas, fimAlunas, alunasAberta } from '@/lib/mae/assinatura/alunas'
import { calcularParcelamentoAnual } from '@/lib/assinatura/planos'
import { Cta } from '../SiteMae'
import ParcelasAlunas from './ParcelasAlunas'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Plano Alunas VPS · Método Mãe',
  description: 'Condição exclusiva para alunas: o Método Mãe por R$ 49,90/mês.',
  robots: { index: false, follow: false },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pagar = (ciclo: 'mensal' | 'anual', parcelas = 1, pix = false) => `/mae/pagar?o=alunas&ciclo=${ciclo}&parcelas=${parcelas}${pix ? '&metodo=pix' : ''}`

export default async function PlanoAlunas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  const p = precoAlunas(), aberta = alunasAberta(), fim = fimAlunas()
  const tabela = Array.from({ length: 12 }, (_, k) => calcularParcelamentoAnual(k + 1, p.anual))
  const economia = Math.round((1 - p.anual / (12 * p.mensal)) * 100)
  const validade = fim.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="min-h-screen bg-[#fffaf5] px-4 py-8 text-[#2b211b] [font-family:'Nunito_Sans',system-ui,sans-serif]">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Nunito+Sans:opsz,wght@6..12,400;6..12,700&display=swap" precedence="default" />
      <style>{`.disp{font-family:'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-0.02em}`}</style>
      <main className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo pequeno do Método MAE */}
          <img src="/mae/img/logo-metodo-mae-256.webp" alt="" width={48} height={48} className="h-12 w-12" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#c2410c]">Exclusivo para alunas</p>
            <h1 className="disp text-3xl font-extrabold leading-tight sm:text-4xl">Plano Alunas VPS · Método Mãe</h1>
          </div>
        </header>
        <p className="text-lg text-[#5b4a3f]">O Método Mãe dentro do SOA: o pedido chega e a arte sai pronta, com o nome, a idade e o tema de cada cliente — edição em massa e lote de impressão organizado.</p>

        {q.pago === '1' && <p className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 font-bold text-emerald-900" data-alunas-pago>Pagamento recebido! Seu Método Mãe libera em instantes — entre no SOA e abra o Método Mãe. 💛</p>}
        {q.erro && <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-900" data-alunas-erro>{q.erro}</p>}

        {!aberta ? (
          <div className="rounded-3xl border-2 border-[#eadfd6] bg-white p-6 text-center" data-alunas-encerrado>
            <p className="disp text-2xl font-extrabold">Este link venceu</p>
            <p className="mt-2 text-[#5b4a3f]">A condição do Plano Alunas valeu até {validade}. Os planos do Método Mãe continuam em <a href="/mae" className="font-bold text-[#c2410c] underline">usesoa.com.br/mae</a>.</p>
          </div>
        ) : (
          <>
            <p className="inline-block rounded-full bg-[#2b211b] px-4 py-1.5 text-sm font-bold text-white" data-alunas-validade>Válido até {validade} · uma compra por conta</p>
            <div className="grid gap-4 sm:grid-cols-2" data-alunas-planos>
              <div className="flex flex-col rounded-3xl border-2 border-[#eadfd6] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#9a8677]">Mensal</p>
                <p className="disp mt-1 text-4xl font-extrabold [font-variant-numeric:tabular-nums]">{brl(p.mensal)}</p>
                <p className="text-sm text-[#7a6a5f]">por mês · cancele quando quiser</p>
                <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
                  <Cta href={pagar('mensal')} botao="alunas-mensal" className="block rounded-2xl bg-[#f97316] px-5 py-3 text-center font-bold text-white hover:bg-[#ea580c]">Assinar mensal (cartão) →</Cta>
                  <Cta href={pagar('mensal', 1, true)} botao="alunas-mensal-pix" className="block rounded-2xl border-2 border-[#eadfd6] px-5 py-3 text-center font-bold hover:border-[#f97316]">Mensal no Pix Automático →</Cta>
                </div>
              </div>
              <div className="relative flex flex-col rounded-3xl bg-[#fffaf5] p-5 ring-4 ring-[#f97316]">
                {economia > 0 && <span className="absolute -top-3 left-5 rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">economize {economia}%</span>}
                <p className="text-xs font-bold uppercase tracking-wider text-[#9a8677]">Anual</p>
                <p className="disp mt-1 text-4xl font-extrabold [font-variant-numeric:tabular-nums]">{brl(p.anual)}</p>
                <p className="text-sm text-[#7a6a5f]">à vista no Pix ou no cartão · 1 ano de acesso</p>
                <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
                  <Cta href={pagar('anual', 1)} botao="alunas-anual-avista" className="block rounded-2xl bg-[#f97316] px-5 py-3 text-center font-bold text-white hover:bg-[#ea580c]">Anual à vista →</Cta>
                  <ParcelasAlunas tabela={tabela.slice(1)} />
                </div>
              </div>
            </div>
            <ul className="space-y-1.5 text-sm text-[#5b4a3f]">
              <li>• Pagamento na página segura do Asaas. Sem teste grátis: o acesso libera assim que o pagamento é aprovado.</li>
              <li>• Ainda não tem conta? Ao clicar, você cria a sua em 1 minuto. Já tem conta no SOA? É só entrar — o Método Mãe soma à sua conta.</li>
              <li>• O link vale <b>uma compra por conta</b> e só até {validade}.</li>
            </ul>
          </>
        )}
      </main>
    </div>
  )
}
