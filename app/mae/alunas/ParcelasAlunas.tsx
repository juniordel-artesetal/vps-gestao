'use client'
// Plano Alunas: o anual em N× (2 a 12) — a lista com o valor de cada parcela (juros da tabela Price) e o botão que vai
// DIRETO ao pagamento; na página do Asaas ela escolhe o mesmo N× em "Selecione o parcelamento".
import { useState } from 'react'
import { Cta } from '../SiteMae'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ParcelasAlunas({ tabela }: { tabela: { parcelas: number; valorParcela: number; total: number }[] }) {
  const [n, setN] = useState(tabela[tabela.length - 1]?.parcelas ?? 12)
  const p = tabela.find(x => x.parcelas === n) ?? tabela[tabela.length - 1]
  if (!p) return null
  return (
    <div className="space-y-2" data-alunas-parcelado>
      <select value={n} onChange={e => setN(Number(e.target.value))} className="w-full rounded-xl border-2 border-[#eadfd6] bg-white px-3 py-2 text-sm font-bold" aria-label="Parcelas do anual" data-alunas-parcelas>
        {tabela.map(x => <option key={x.parcelas} value={x.parcelas}>{x.parcelas}× de {brl(x.valorParcela)} — total {brl(x.total)} (com juros)</option>)}
      </select>
      <Cta href={`/mae/pagar?o=alunas&ciclo=anual&parcelas=${p.parcelas}`} botao={`alunas-anual-${p.parcelas}x`} className="block rounded-2xl border-2 border-[#eadfd6] px-5 py-3 text-center font-bold hover:border-[#f97316]">
        Anual em {p.parcelas}× de {brl(p.valorParcela)} →
      </Cta>
      <p className="text-xs text-[#7a6a5f]">Na página de pagamento, em “Selecione o parcelamento”, escolha <b>{p.parcelas}×</b> — o valor já inclui os juros.</p>
    </div>
  )
}
