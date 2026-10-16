'use client'
// TROCAR O SOA MENSAL PELO ANUAL — a 1ª cobrança do anual só vem quando a mensalidade atual vencer (o mês pago é
// respeitado) e a mensal é cancelada sozinha quando o cartão do anual é confirmado. Sem cobrança dupla.
import { useEffect, useState } from 'react'
import { Loader2, Check, CreditCard, CalendarCheck, ArrowLeft } from 'lucide-react'

interface Parcela { parcelas: number; valorParcela: number; total: number }
interface Estado {
  ok: boolean; texto?: string; motivo?: string; vencimentoMensal?: string; valorMensal?: number
  anual: { avista: number; tabela: Parcela[] }; pendente?: { link: string | null; parcelas: number } | null; admin?: boolean
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')

export default function MigrarAnualPage() {
  const [e, setE] = useState<Estado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [parcelas, setParcelas] = useState(12)
  const [indo, setIndo] = useState(false)
  const [pago, setPago] = useState(false)

  useEffect(() => {
    setPago(new URLSearchParams(window.location.search).get('pago') === '1')
    fetch('/api/assinatura/migrar-anual').then(async r => {
      if (r.status === 401) { window.location.href = '/login?callbackUrl=/assinatura/migrar-anual'; return }
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setE(j)
    }).catch(x => setErro((x as Error).message))
  }, [])

  async function trocar() {
    setIndo(true); setErro(null)
    try {
      const r = await fetch('/api/assinatura/migrar-anual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parcelas }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      window.location.href = j.link
    } catch (x) { setErro((x as Error).message); setIndo(false) }
  }

  const p = e?.anual.tabela.find(x => x.parcelas === parcelas)
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-xl space-y-5">
        <a href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" /> Voltar ao SOA</a>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trocar o SOA mensal pelo anual</h1>
          <p className="mt-1 text-sm text-gray-600">Pague uma vez por ano (ou em até 12× no cartão) e esqueça a mensalidade.</p>
        </div>
        {pago && (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" data-migracao-ok>
            <Check className="mt-0.5 h-5 w-5 shrink-0" /> Pronto! Seu cartão foi confirmado. A partir do vencimento da sua mensalidade, o SOA passa a ser anual, e a mensalidade não é mais cobrada.
          </p>
        )}
        {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {!e && !erro && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Conferindo a sua assinatura…</p>}
        {e && !e.ok && !pago && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700" data-migracao-indisponivel>
            <p>{e.texto}</p>
            <p className="mt-3"><a href="/assinatura" className="font-semibold text-orange-600 underline">Ir para Minha assinatura</a></p>
          </div>
        )}
        {e?.ok && !pago && (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5" data-migracao-form>
            <div className="flex items-start gap-3 rounded-xl bg-orange-50 px-4 py-3 text-sm text-gray-800">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <p>Sua mensalidade já está paga até <b>{dia(e.vencimentoMensal)}</b>. A <b>1ª cobrança do anual só vem nesse dia</b>, no lugar da mensalidade: você nunca paga os dois.</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">SOA anual</p>
              <p className="text-3xl font-bold text-gray-900">{brl(e.anual.avista)}<span className="text-base font-normal text-gray-500"> à vista</span></p>
              <p className="text-sm text-gray-500">ou até 12× de {brl(e.anual.tabela[11]?.valorParcela ?? 0)} no cartão</p>
            </div>
            <label className="block text-sm">Parcelas no cartão
              <select value={parcelas} onChange={x => setParcelas(Number(x.target.value))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2" data-migracao-parcelas>
                {e.anual.tabela.map(t => <option key={t.parcelas} value={t.parcelas}>{t.parcelas === 1 ? `1× de ${brl(t.total)} (à vista)` : `${t.parcelas}× de ${brl(t.valorParcela)} — total ${brl(t.total)} (com juros)`}</option>)}
              </select>
            </label>
            <ul className="space-y-1 text-sm text-gray-600">
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> Tudo continua igual na sua conta: dados, pedidos e módulos.</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" /> A mensalidade é cancelada sozinha quando o anual é confirmado.</li>
              <li className="flex gap-2"><CreditCard className="h-4 w-4 shrink-0" /> Cartão de crédito, na página segura do Asaas.</li>
            </ul>
            {e.admin === false
              ? <p className="text-sm text-amber-800">Só a administradora da conta pode trocar o plano.</p>
              : <button onClick={() => void trocar()} disabled={indo} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50" data-migracao-trocar>
                  {indo ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                  Trocar para o anual — {p ? (p.parcelas === 1 ? brl(p.total) : `${p.parcelas}× de ${brl(p.valorParcela)}`) : ''}
                </button>}
          </div>
        )}
      </div>
    </div>
  )
}
