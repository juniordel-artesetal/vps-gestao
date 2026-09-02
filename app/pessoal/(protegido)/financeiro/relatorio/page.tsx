'use client'
// Relatório financeiro pessoal (print-view). "Baixar PDF" usa a impressão do navegador
// (Salvar como PDF) — sem Puppeteer/serverless. Escopo por usuário (server).
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const brDate = (s: string) => { const [y, m, d] = (s || '').slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : '—' }
const metLabel = (m?: string) => ({ PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro', BOLETO: 'Boleto', TED: 'TED' } as any)[m || ''] || ''

interface Dados {
  periodo: { de: string; ate: string; ano: number; mes: number; usaPeriodo: boolean }
  resumo: { totalReceita: number; totalDespesa: number; resultado: number; aReceber: number; aPagar: number }
  porCategoria: { nome: string; tipo: string; icone: string; total: number }[]
  porConta: { nome: string; receita: number; despesa: number; saldo: number }[]
  caixinhas: { nome: string; meta: number | null; saldo: number }[]
  fluxo: { data: string; receita: number; despesa: number }[]
  lancamentos: { tipo: string; descricao: string; valor: number; data: string; status: string; metodo?: string; categoriaNome?: string; contaNome?: string }[]
}

export default function RelatorioPage() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear()); const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [de, setDe] = useState(''); const [ate, setAte] = useState('')
  const [d, setD] = useState<Dados | null>(null); const [loading, setLoading] = useState(true)
  const usaPeriodo = !!(de || ate)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (usaPeriodo) { if (de) p.set('de', de); if (ate) p.set('ate', ate) }
      else { p.set('ano', String(ano)); p.set('mes', String(mes)) }
      const r = await fetch('/api/pessoal/financeiro/relatorio?' + p)
      setD(r.ok ? await r.json() : null)
    } finally { setLoading(false) }
  }, [ano, mes, de, ate, usaPeriodo])
  useEffect(() => { carregar() }, [carregar])

  const receitasCat = (d?.porCategoria || []).filter(c => c.tipo === 'RECEITA')
  const despesasCat = (d?.porCategoria || []).filter(c => c.tipo === 'DESPESA')
  const totalGuardado = (d?.caixinhas || []).reduce((s, c) => s + c.saldo, 0)
  const tituloPeriodo = d?.periodo.usaPeriodo ? `${brDate(d.periodo.de)} a ${brDate(d.periodo.ate)}` : `${MESES[(d?.periodo.mes || mes) - 1]} de ${d?.periodo.ano || ano}`

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      {/* Barra de controle — escondida na impressão */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3"><Link href="/pessoal/financeiro" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link><h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Relatório PDF</h1></div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"><Printer className="w-4 h-4" /> Baixar PDF</button>
      </div>
      <div className="no-print bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 p-3 flex flex-wrap gap-2 items-center mb-4">
        <select value={mes} onChange={e => setMes(Number(e.target.value))} disabled={usaPeriodo} className="border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm disabled:opacity-40">{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))} disabled={usaPeriodo} className="border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm disabled:opacity-40">{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
        <div className="flex items-center gap-1 text-xs text-gray-400"><input type="date" value={de} onChange={e => setDe(e.target.value)} className="border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-2 py-2 text-sm" /><span>até</span><input type="date" value={ate} onChange={e => setAte(e.target.value)} className="border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-2 py-2 text-sm" />{usaPeriodo && <button onClick={() => { setDe(''); setAte('') }} className="text-orange-500 hover:underline">limpar</button>}</div>
      </div>

      {loading ? <p className="text-gray-400 text-sm text-center py-10">Carregando…</p> : d && (
        <div id="folha" className="bg-white text-gray-800 rounded-xl border border-gray-200 p-6 md:p-8 space-y-6 print:border-0 print:p-0">
          {/* Cabeçalho */}
          <div className="border-b border-gray-200 pb-3">
            <h2 className="text-xl font-bold">Relatório Financeiro Pessoal</h2>
            <p className="text-sm text-gray-500">Período: {tituloPeriodo}</p>
          </div>

          {/* Resumo */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Receitas', d.resumo.totalReceita, 'text-green-700'], ['Despesas', d.resumo.totalDespesa, 'text-red-700'], ['Resultado', d.resumo.resultado, d.resumo.resultado >= 0 ? 'text-blue-700' : 'text-orange-700'], ['A receber / pagar', 0, 'text-gray-600']].map(([l, v, cls], i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3">
                <p className="text-[11px] text-gray-500">{l as string}</p>
                {i === 3 ? <p className="text-sm font-semibold text-gray-600">{fmt(d.resumo.aReceber)} / {fmt(d.resumo.aPagar)}</p> : <p className={`text-lg font-bold ${cls as string}`}>{fmt(v as number)}</p>}
              </div>
            ))}
          </section>

          {/* Por categoria */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
            <div>
              <h3 className="text-sm font-semibold mb-2">Receitas por categoria</h3>
              {receitasCat.length ? <table className="w-full text-sm"><tbody>{receitasCat.map((c, i) => <tr key={i} className="border-b border-gray-100"><td className="py-1">{c.icone} {c.nome}</td><td className="py-1 text-right text-green-700 tabular-nums">{fmt(c.total)}</td></tr>)}</tbody></table> : <p className="text-xs text-gray-400">Sem receitas.</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Despesas por categoria</h3>
              {despesasCat.length ? <table className="w-full text-sm"><tbody>{despesasCat.map((c, i) => <tr key={i} className="border-b border-gray-100"><td className="py-1">{c.icone} {c.nome}</td><td className="py-1 text-right text-red-700 tabular-nums">{fmt(c.total)}</td></tr>)}</tbody></table> : <p className="text-xs text-gray-400">Sem despesas.</p>}
            </div>
          </section>

          {/* Por conta */}
          {d.porConta.length > 0 && (
            <section className="break-inside-avoid">
              <h3 className="text-sm font-semibold mb-2">Por conta</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-[11px] text-gray-500 border-b border-gray-200"><th className="text-left py-1">Conta</th><th className="text-right py-1">Entradas</th><th className="text-right py-1">Saídas</th><th className="text-right py-1">Saldo</th></tr></thead>
                <tbody>{d.porConta.map((c, i) => <tr key={i} className="border-b border-gray-100"><td className="py-1">{c.nome}</td><td className="py-1 text-right text-green-700 tabular-nums">{fmt(c.receita)}</td><td className="py-1 text-right text-red-700 tabular-nums">{fmt(c.despesa)}</td><td className="py-1 text-right font-semibold tabular-nums">{fmt(c.saldo)}</td></tr>)}</tbody>
              </table>
            </section>
          )}

          {/* Caixinhas */}
          {d.caixinhas.length > 0 && (
            <section className="break-inside-avoid">
              <h3 className="text-sm font-semibold mb-2">Caixinhas · guardado {fmt(totalGuardado)}</h3>
              <table className="w-full text-sm"><tbody>{d.caixinhas.map((c, i) => <tr key={i} className="border-b border-gray-100"><td className="py-1">{c.nome}</td><td className="py-1 text-right text-gray-500 text-xs">{c.meta ? `meta ${fmt(c.meta)}` : ''}</td><td className="py-1 text-right font-semibold tabular-nums">{fmt(c.saldo)}</td></tr>)}</tbody></table>
            </section>
          )}

          {/* Lançamentos */}
          <section className="break-inside-avoid">
            <h3 className="text-sm font-semibold mb-2">Lançamentos ({d.lancamentos.length})</h3>
            {d.lancamentos.length ? (
              <table className="w-full text-xs">
                <thead><tr className="text-[10px] text-gray-500 border-b border-gray-200"><th className="text-left py-1">Data</th><th className="text-left py-1">Descrição</th><th className="text-left py-1">Categoria</th><th className="text-left py-1">Conta</th><th className="text-right py-1">Valor</th></tr></thead>
                <tbody>{d.lancamentos.map((l, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 text-gray-500">{brDate(l.data)}</td>
                    <td className="py-1">{l.descricao}{l.status === 'PENDENTE' ? ' •pend.' : ''}</td>
                    <td className="py-1 text-gray-500">{l.categoriaNome || '—'}</td>
                    <td className="py-1 text-gray-500">{[l.contaNome, metLabel(l.metodo)].filter(Boolean).join(' / ') || '—'}</td>
                    <td className={`py-1 text-right tabular-nums ${l.tipo === 'RECEITA' ? 'text-green-700' : 'text-red-700'}`}>{l.tipo === 'RECEITA' ? '+' : '−'}{fmt(l.valor)}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <p className="text-xs text-gray-400">Nenhum lançamento no período.</p>}
          </section>

          <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">Gerado pelo SOA · módulo Pessoal</p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #folha { box-shadow: none !important; }
          @page { margin: 14mm; }
        }
      ` }} />
    </div>
  )
}
