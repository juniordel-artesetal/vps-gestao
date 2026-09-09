'use client'

// Pedido de compra COMPLETO (Q3): fornecedor, data, todos os itens, subtotal, desconto, frete,
// total e as contas a pagar geradas. O histórico mostra item por item e não tinha essa visão.
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Package, Truck, Receipt, AlertTriangle } from 'lucide-react'

const fmtR = (n: any) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtD = (s: string | null) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—'
const fmtQtd = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })

const STATUS_LANC: Record<string, { label: string; cls: string }> = {
  PAGO:     { label: 'Pago',           cls: 'bg-green-50 text-green-700 border-green-200' },
  PARCIAL:  { label: 'Pago parcial',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENDENTE: { label: 'A pagar',        cls: 'bg-orange-50 text-orange-700 border-orange-200' },
}

export default function PedidoCompraPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch(`/api/compras/${id}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || 'Erro ao carregar'); return r.json() })
      .then(setDados)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>
  if (erro) return <div className="p-8 text-center text-red-500">{erro}</div>
  if (!dados) return null

  const { compra: c, itens, lancamentos, subtotalItens } = dados
  const cancelada = String(c.status || '').toUpperCase() === 'CANCELADA'
  const desconto = Number(c.descontoValor) || 0
  const frete = Number(c.freteValor) || 0
  const freteNaNf = c.freteTipo === 'NA_NF' ? frete : 0
  const totalPago = lancamentos.filter((l: any) => l.status === 'PAGO').reduce((s: number, l: any) => s + Number(l.valor || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push('/compras/historico')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-500 mb-4">
          <ArrowLeft size={15} /> Voltar ao histórico
        </button>

        {/* Cabeçalho */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-5 h-5 text-orange-500" />
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">{c.codigo || 'Pedido de compra'}</h1>
                {cancelada && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Cancelada</span>}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{c.fornecedorNome || 'Fornecedor não informado'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {fmtD(c.data)}{c.nf ? ` · NF ${c.nf}` : ''}{itens.length ? ` · ${itens.length} item(ns)` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total do pedido</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{fmtR(c.valor)}</p>
            </div>
          </div>
          {cancelada && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle size={13} /> Compra cancelada{c.canceladaEm ? ` em ${fmtD(c.canceladaEm)}` : ''}{c.canceladaPor ? ` por ${c.canceladaPor}` : ''} — os lançamentos foram removidos e o estoque estornado.
            </p>
          )}
          {c.observacoes && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{c.observacoes}</p>}
        </div>

        {/* Itens */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-5 pt-4 pb-2">Itens</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">Material</th>
                  <th className="text-right px-3 py-2 font-medium">Qtd</th>
                  <th className="text-right px-3 py-2 font-medium">Preço/pacote</th>
                  <th className="text-right px-3 py-2 font-medium">Un.</th>
                  <th className="text-right px-5 py-2 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it: any) => (
                  <tr key={it.id} className="border-t border-gray-50 dark:border-gray-800">
                    <td className="px-5 py-2.5 text-gray-800 dark:text-gray-100">
                      {it.nome}
                      {it.custoAtualizado && <span className="ml-2 text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">custo atualizado</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums">{fmtQtd(it.qtdPacotes)} × {fmtQtd(it.qtdPacote)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums">{fmtR(it.precoPacote)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400 tabular-nums">{fmtR(it.precoUnidade)}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-gray-900 dark:text-white tabular-nums">{fmtR(it.subtotal)}</td>
                  </tr>
                ))}
                {itens.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-400">Sem itens registrados.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Fechamento: subtotal · desconto · frete · total */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 space-y-1.5 bg-gray-50/60 dark:bg-gray-800/30">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Subtotal dos itens</span>
              <span className="tabular-nums text-gray-800 dark:text-gray-100">{fmtR(subtotalItens)}</span>
            </div>
            {desconto > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Desconto{c.descontoTipo === 'percentual' ? ' (%)' : ''}</span>
                <span className="tabular-nums text-red-500">− {fmtR(desconto)}</span>
              </div>
            )}
            {frete > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Truck size={13} /> Frete {c.freteTipo === 'NA_NF' ? '(na nota)' : `(terceirizado${c.freteResponsavel ? ` — ${c.freteResponsavel}` : ''})`}
                </span>
                <span className="tabular-nums text-gray-800 dark:text-gray-100">{c.freteTipo === 'NA_NF' ? fmtR(freteNaNf) : `${fmtR(frete)} · à parte`}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1.5 border-t border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-700 dark:text-gray-200">Total do pedido</span>
              <span className="tabular-nums font-bold text-gray-900 dark:text-white">{fmtR(c.valor)}</span>
            </div>
          </div>
        </div>

        {/* Contas a pagar geradas */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <Receipt size={15} className="text-orange-500" /> Contas a pagar geradas
            {lancamentos.length > 0 && <span className="text-xs font-normal text-gray-400">({lancamentos.length})</span>}
          </h2>
          {lancamentos.length === 0 ? (
            <p className="text-sm text-gray-400">Esta compra não gerou lançamento no financeiro.</p>
          ) : (
            <>
              <div className="space-y-2">
                {lancamentos.map((l: any) => {
                  const st = STATUS_LANC[l.status] || { label: l.status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">{l.descricao}</p>
                        <p className="text-xs text-gray-400">
                          vence {fmtD(l.data)}
                          {l.totalParcelas > 1 ? ` · parcela ${l.parcela}/${l.totalParcelas}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                        <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-white">{fmtR(l.valor)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {totalPago > 0 && (
                <p className="text-xs text-gray-500 mt-3">Já pago: <strong className="text-green-600">{fmtR(totalPago)}</strong></p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
