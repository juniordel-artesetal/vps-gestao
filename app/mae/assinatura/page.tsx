'use client'
// MÉTODO MÃE — ASSINATURA (add-on de quem já assina o SOA, ou standalone: só o MAE). Mensal ou anual (até 12× no
// cartão, juros do cliente). SEM teste grátis (decisão de 15/10: TRIAL_DIAS_MAE = 0). Os preços vêm da config (/api/mae/assinatura);
// com a venda fechada, "em breve". Pagamento na página do Asaas (nenhum dado de cartão passa pelo SOA).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Check, Sparkles, CreditCard, ArrowRight } from 'lucide-react'

interface Parcela { parcelas: number; valorParcela: number; total: number }
interface Estado {
  venda: boolean; plano: 'addon' | 'standalone'; trialDias: number
  precos: { mensal: number; anual: number } | null; parcelamentoAnual: Parcela[]; economiaAnual: number | null
  assinatura: { status: string; ciclo: string; parcelas: number; valor: number; trialAte: string | null; proximoVencimento: string | null; trialUsado: boolean; checkoutAberto: boolean } | null
  acesso: { liberado: boolean; origem: string | null; ate: string | null }
  /** Lançamento 16/10: conta com o SOA inativo assina SÓ o Método Mãe */
  soaInativo?: boolean
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const ROTULO: Record<string, string> = { AGUARDANDO_PAGAMENTO: 'aguardando o pagamento', TRIAL: 'em teste', ATIVA: 'ativa', INADIMPLENTE: 'pagamento atrasado', CANCELADA: 'cancelada' }

export default function AssinaturaMaePage() {
  const [e, setE] = useState<Estado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('anual')
  const [parcelas, setParcelas] = useState(12)
  const [indo, setIndo] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [voltouPago, setVoltouPago] = useState(false)

  async function carregar() {
    try { const r = await fetch('/api/mae/assinatura'); const j = await r.json(); if (!r.ok) throw new Error(j.error); setE(j) } catch (x) { setErro((x as Error).message) }
  }
  useEffect(() => {
    void carregar()
    const q = new URLSearchParams(window.location.search)
    setVoltouPago(q.get('pago') === '1')
    // veio de um preço da página de vendas (/mae → /mae/pagar): já abre no ciclo escolhido
    if (q.get('ciclo') === 'mensal' || q.get('ciclo') === 'anual') setCiclo(q.get('ciclo') as 'mensal' | 'anual')
    const np = Number(q.get('parcelas')); if (np >= 1 && np <= 12) setParcelas(Math.floor(np))
  }, [])
  // voltou do pagamento: o webhook pode levar alguns segundos — confere de novo
  useEffect(() => { if (!voltouPago) return; const t = setInterval(() => void carregar(), 4000); const f = setTimeout(() => clearInterval(t), 60000); return () => { clearInterval(t); clearTimeout(f) } }, [voltouPago])

  /** Cancelar pela tela: nenhuma cobrança nova; o acesso segue até o fim do teste/período pago. */
  async function cancelar() {
    if (!e?.assinatura) return
    const fim = e.assinatura.status === 'TRIAL' ? `o fim do teste (${dia(e.assinatura.trialAte)})` : e.acesso.ate ? dia(e.acesso.ate) : 'o fim do período pago'
    if (!confirm(`Cancelar a assinatura do Método Mãe?

Nenhuma nova cobrança será feita e você continua usando até ${fim}. Suas bases, temas e artes continuam no seu computador.`)) return
    setCancelando(true); setErro(null)
    try {
      const r = await fetch('/api/mae/assinatura/cancelar', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      await carregar()
    } catch (x) { setErro((x as Error).message) } finally { setCancelando(false) }
  }
  async function assinar() {
    setIndo(true); setErro(null)
    try {
      const r = await fetch('/api/mae/assinatura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ciclo, parcelas: ciclo === 'anual' ? parcelas : 1 }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      window.location.href = j.link
    } catch (x) { setErro((x as Error).message); setIndo(false) }
  }

  if (!e) return <div className="p-6 text-sm text-gray-500 flex items-center gap-2">{erro ?? <><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</>}</div>
  const a = e.assinatura, standalone = e.plano === 'standalone'
  // Lançamento 16/10/2026: quem assina o SOA compra "SOA + Método Mãe" (o MAE soma à assinatura do SOA, que continua como está)
  const titulo = standalone ? 'Método Mãe' : 'SOA + Método Mãe'
  const rotuloCiclo = (c: 'mensal' | 'anual') => (standalone ? (c === 'mensal' ? 'Mensal' : 'Anual') : c === 'mensal' ? 'SOA + Método Mãe · mensal' : 'SOA + Método Mãe · anual')
  const mais = standalone ? '' : '+ '
  const parc = e.parcelamentoAnual.find(p => p.parcelas === parcelas) ?? e.parcelamentoAnual[0]
  const vivo = a && ['TRIAL', 'ATIVA'].includes(a.status)

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5" data-mae-assinatura>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="w-6 h-6 text-orange-500" /> {titulo}</h1>
        <p className="text-sm text-gray-500">Artes personalizadas por pedido, edição em massa e lote de impressão — tudo no seu computador.</p>
      </div>

      {e.acesso.liberado && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm flex flex-wrap items-center gap-3" data-mae-ativo>
          <Check className="w-5 h-5 text-emerald-600" />
          <span className="flex-1">
            {e.acesso.origem === 'cortesia' || e.acesso.origem === 'beta' ? 'O Método Mãe está liberado na sua conta (cortesia).'
              : e.acesso.origem === 'soa-design' ? 'O Método Mãe está liberado na sua conta (assinante do SOA Design).'
              : a?.status === 'TRIAL' ? <>Você está no teste grátis até <b>{dia(a.trialAte)}</b>. A 1ª cobrança vem nessa data.</>
              : a?.status === 'INADIMPLENTE' ? <>O pagamento está atrasado — o acesso continua até <b>{dia(e.acesso.ate)}</b>.</>
              : <>Assinatura {a ? ROTULO[a.status] : 'ativa'}{a?.proximoVencimento ? <> · próxima cobrança em <b>{dia(a.proximoVencimento)}</b></> : null}.</>}
          </span>
          <Link href="/estudio/mae" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-semibold">Abrir o Método Mãe <ArrowRight className="w-4 h-4" /></Link>
        </div>
      )}
      {a?.status === 'CANCELADA' && (
        <p className="rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm" data-mae-cancelada>
          Assinatura cancelada{e.acesso.liberado && e.acesso.ate ? <> — você continua usando até <b>{dia(e.acesso.ate)}</b></> : null}. Nenhuma nova cobrança será feita. Se quiser voltar, é só assinar de novo abaixo.
        </p>
      )}
      {e.soaInativo && !e.acesso.liberado && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 px-4 py-3 text-sm space-y-1" data-mae-soa-inativo>
          <p>Sua assinatura do SOA está <b>inativa</b>. Aqui você pode assinar <b>só o Método Mãe</b>: depois de assinar, sua conta abre direto no Método Mãe (seus dados do SOA continuam guardados).</p>
          <p className="text-gray-600">Quer voltar ao SOA completo? <Link href="/assinatura" className="font-semibold text-orange-700 underline">Regularizar a assinatura do SOA</Link></p>
        </div>
      )}
      {voltouPago && !e.acesso.liberado && <p className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Confirmando o pagamento com o banco…</p>}
      {erro && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{erro}</p>}

      {!e.venda || !e.precos ? (
        !e.acesso.liberado && <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center" data-mae-em-breve><p className="text-lg font-semibold">Em breve</p><p className="text-sm text-gray-500">O Método Mãe abre para assinatura em breve.</p></div>
      ) : !vivo && !(e.acesso.liberado && e.acesso.origem !== 'compra') && (
        <div className="space-y-4" data-mae-planos>
          {a?.status === 'INADIMPLENTE' && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">Seu pagamento está atrasado. Regularize para não perder o acesso.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => setCiclo('mensal')} className={`rounded-2xl border-2 p-4 text-left ${ciclo === 'mensal' ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-700'}`} data-ciclo-mae="mensal">
              <p className="text-sm text-gray-500">{rotuloCiclo('mensal')}</p>
              <p className="text-2xl font-bold">{mais}{brl(e.precos.mensal)}<span className="text-sm font-normal text-gray-500">/mês</span></p>
              {!standalone && <p className="text-xs text-gray-500">somado ao seu SOA, que continua como está</p>}
            </button>
            <button onClick={() => setCiclo('anual')} className={`rounded-2xl border-2 p-4 text-left relative ${ciclo === 'anual' ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-700'}`} data-ciclo-mae="anual">
              {e.economiaAnual ? <span className="absolute -top-2 right-3 rounded-full bg-emerald-600 text-white text-[11px] font-semibold px-2 py-0.5" data-economia-mae>economize {e.economiaAnual}%</span> : null}
              <p className="text-sm text-gray-500">{rotuloCiclo('anual')}</p>
              <p className="text-2xl font-bold">{mais}{brl(e.precos.anual)}<span className="text-sm font-normal text-gray-500"> à vista no Pix ou cartão</span></p>
              <p className="text-xs text-gray-500">ou até 12× de {brl(e.parcelamentoAnual[11]?.valorParcela ?? 0)} no cartão</p>
            </button>
          </div>
          {ciclo === 'anual' && (
            <label className="block text-sm">Parcelas no cartão
              <select value={parcelas} onChange={x => setParcelas(Number(x.target.value))} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2" data-parcelas-mae>
                {e.parcelamentoAnual.map(p => <option key={p.parcelas} value={p.parcelas}>{p.parcelas === 1 ? `À vista: ${brl(p.total)} (Pix ou cartão)` : `${p.parcelas}× de ${brl(p.valorParcela)} — total ${brl(p.total)} (com juros)`}</option>)}
              </select>
            </label>
          )}
          {ciclo === 'anual' && parcelas === 1 && <p className="text-xs text-gray-500" data-aviso-anual-avista>Anual à vista no Pix ou no cartão (1×). Vale por 1 ano e não renova sozinho: no fim do ano, é só assinar de novo.</p>}
          {/* pente-fino 16/10/2026: no Asaas, a lista de parcelas abre em "1x" e não dá para travar — avisamos */}
          {ciclo === 'anual' && parcelas > 1 && parc && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-aviso-parcelas-asaas>
              Na página de pagamento, em <b>“Selecione o parcelamento”</b>, escolha <b>{parcelas}×</b> — o valor ({brl(parc.total)}) já inclui os juros de {parcelas}×.
              O anual parcelado não renova sozinho: no fim do ano, é só assinar de novo.
            </p>
          )}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {!a?.trialUsado && e.trialDias > 0 && <p className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> <b>{e.trialDias} dias grátis</b> — a 1ª cobrança só vem no fim do teste (cancele antes e não paga nada).</p>}
            <p className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> {ciclo === 'anual' && parcelas === 1 ? 'Pix ou cartão de crédito' : 'Cartão de crédito'}, na página segura do Asaas{e.trialDias > 0 ? '. Para validar o cartão fazemos uma reserva de R$ 5,00 que é liberada na hora.' : '. A 1ª cobrança é feita na hora; cancele quando quiser, sem novas cobranças.'}</p>
            {!standalone && <p className="text-xs text-gray-500">O Método Mãe é cobrado à parte e soma à sua assinatura do SOA (mensal ou anual, como já está). Vale enquanto o SOA estiver ativo.</p>}
          </div>
          <button onClick={() => void assinar()} disabled={indo} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 font-semibold disabled:opacity-50" data-assinar-mae>
            {indo ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
            {a?.status === 'INADIMPLENTE' ? 'Pagar a fatura em aberto' : !a?.trialUsado && e.trialDias > 0 ? `Começar o teste de ${e.trialDias} dias` : `Assinar — ${ciclo === 'mensal' ? `${brl(e.precos.mensal)}/mês` : parc?.parcelas === 1 ? brl(parc.total) : `${parc?.parcelas}× de ${brl(parc?.valorParcela ?? 0)}`}`}
          </button>
        </div>
      )}
      {/* anual parcelado = compra no cartão (as parcelas seguem na fatura); não renova sozinho — nada a cancelar */}
      {a && a.status === 'ATIVA' && a.ciclo === 'anual' && (
        <p className="pt-4 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500" data-mae-anual-parcelado>Plano anual{a.parcelas > 1 ? ` em ${a.parcelas}× no cartão` : ' à vista'} · não renova sozinho{e.acesso.ate ? <> · acesso até <b>{dia(e.acesso.ate)}</b></> : null}.</p>
      )}
      {/* cancelar pela tela (nada é estornado; o acesso segue até o fim do teste/período pago) */}
      {a && ['TRIAL', 'ATIVA', 'INADIMPLENTE'].includes(a.status) && a.ciclo !== 'anual' && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500 flex flex-wrap items-center gap-2">
          <span className="flex-1">{a.ciclo === 'anual' ? 'Plano anual' : 'Plano mensal'}{a.valor ? ` · ${a.parcelas > 1 ? `${a.parcelas}× de ${brl(Math.round((a.valor / a.parcelas) * 100) / 100)}` : brl(a.valor)}` : ''}</span>
          <button onClick={() => void cancelar()} disabled={cancelando} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-gray-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50" data-cancelar-mae>
            {cancelando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Cancelar assinatura
          </button>
        </div>
      )}
    </div>
  )
}
