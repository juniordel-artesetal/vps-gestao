'use client'
import { useEffect, useState, useCallback } from 'react'
import { Loader2, TrendingUp, TrendingDown, Search, ArrowRight } from 'lucide-react'
import { normNome } from '@/lib/normNome'

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brDate = (s: string) => s ? s.split('-').reverse().join('/') : '—'
const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function HistoricoComprasPage() {
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([])
  const [materiais, setMateriais] = useState<{ id: string; nome: string }[]>([])
  const [fFornecedor, setFFornecedor] = useState('')
  const [fMaterial, setFMaterial] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (fFornecedor) p.set('fornecedorId', fFornecedor)
    if (fMaterial) p.set('materialId', fMaterial)
    if (de) p.set('de', de); if (ate) p.set('ate', ate)
    const r = await fetch('/api/compras/historico?' + p.toString())
    if (r.ok) setDados(await r.json())
    setLoading(false)
  }, [fFornecedor, fMaterial, de, ate])
  useEffect(() => { carregar() }, [carregar])

  async function cancelarCompra(compraId: string) {
    setBusy(true); setAviso('')
    try {
      const r = await fetch(`/api/compras/${compraId}/cancelar`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Erro ao cancelar')
      setAviso(`Compra cancelada. ${d.lancamentosRemovidos || 0} lançamento(s) removido(s)` + (d.estoqueRevertido ? ` · estoque estornado (${d.estoqueRevertido})` : '') + '.')
      setCancelId(null)
      await carregar()
    } catch (e: any) { setAviso(e?.message || 'Erro ao cancelar') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    fetch('/api/fornecedores').then(r => r.ok ? r.json() : []).then(d => setFornecedores(Array.isArray(d) ? d : (d.fornecedores || []))).catch(() => {})
    fetch('/api/precificacao/materiais').then(r => r.ok ? r.json() : []).then(d => setMateriais(Array.isArray(d) ? d.map((m: any) => ({ id: m.id, nome: m.nome })) : [])).catch(() => {})
  }, [])

  const mercadoDe = (nome: string) => dados?.mercado?.[normNome(nome)] || null
  function indicador(nome: string, precoUnidade: number) {
    const mk = mercadoDe(nome)
    if (!mk || !mk.medio) return null
    const r = precoUnidade / mk.medio
    if (r <= 0.98) return { txt: `boa compra ✅ · mercado ~${brl(mk.medio)}`, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
    if (r >= 1.05) return { txt: `acima da média ⚠️ · mercado ~${brl(mk.medio)}`, cls: 'text-red-600 bg-red-50 border-red-200' }
    return { txt: `na média · mercado ~${brl(mk.medio)}`, cls: 'text-gray-500 bg-gray-50 border-gray-200' }
  }

  const evol = dados?.evolucao || {}
  const materiaisComEvolucao = Object.entries(evol).filter(([, arr]: any) => arr.length >= 2)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Histórico de compras</h1>
        <p className="text-sm text-gray-500">Tudo que você comprou — com contas a pagar, evolução de preço e comparação com o mercado.</p>
      </div>

      {aviso && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-3 py-2">{aviso}</div>}

      {cancelId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && setCancelId(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-1">Cancelar esta compra?</h3>
            <p className="text-sm text-gray-600 mb-4">Isso marca a compra como <b>CANCELADA</b> e <b>remove os lançamentos financeiros</b> desta compra (a despesa e o frete). Se ela deu entrada no estoque, o estoque é <b>estornado</b>. A compra continua no histórico.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelId(null)} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Voltar</button>
              <button onClick={() => cancelarCompra(cancelId)} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      {dados?.resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3"><p className="text-[10px] text-gray-400 uppercase">Total no filtro</p><p className="text-lg font-bold text-gray-800">{brl(dados.resumo.total)}</p></div>
          <div className="bg-white rounded-xl border border-gray-100 p-3"><p className="text-[10px] text-gray-400 uppercase">Compras</p><p className="text-lg font-bold text-gray-800">{dados.resumo.compras}</p></div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 col-span-2">
            <p className="text-[10px] text-gray-400 uppercase mb-0.5">Top fornecedores</p>
            {(dados.resumo.porFornecedor || []).slice(0, 3).map((f: any) => <div key={f.nome} className="flex justify-between text-xs text-gray-600"><span className="truncate">{f.nome}</span><span>{brl(f.total)}</span></div>)}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end bg-white rounded-xl border border-gray-100 p-3">
        <div><label className="text-[10px] text-gray-400 block">Fornecedor</label>
          <select value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} className={inp}><option value="">Todos</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
        <div><label className="text-[10px] text-gray-400 block">Material</label>
          <select value={fMaterial} onChange={e => setFMaterial(e.target.value)} className={inp}><option value="">Todos</option>{materiais.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
        <div><label className="text-[10px] text-gray-400 block">De</label><input type="date" value={de} onChange={e => setDe(e.target.value)} className={inp} /></div>
        <div><label className="text-[10px] text-gray-400 block">Até</label><input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inp} /></div>
      </div>

      {loading ? <div className="text-center py-10 text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div> : (
        <>
          {/* Lista */}
          <div className="space-y-2">
            {(dados?.itens || []).length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Nenhuma compra no filtro. Faça um <a href="/compras" className="text-orange-500 underline">Pedido de compra</a>.</p>}
            {(dados?.itens || []).map((it: any) => {
              const ind = indicador(it.nome, Number(it.precoUnidade))
              const cp = dados.contasPorCompra?.[it.compraId]
              return (
                <div key={it.id} className={`bg-white rounded-xl border border-gray-100 p-3 ${it.compraStatus === 'CANCELADA' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{it.nome}</p>
                      <p className="text-xs text-gray-500">{brDate(it.data)} · {it.fornecedorNome || 'sem fornecedor'} · {Number(it.qtdPacotes)}×{Number(it.qtdPacote)} un</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">{brl(it.subtotal)}</p>
                      <p className="text-[11px] text-gray-500">{brl(it.precoUnidade)}/un</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {ind && <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ind.cls}`}>{ind.txt}</span>}
                    {it.custoAtualizado && <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">custo do material atualizado</span>}
                    {cp && cp.total > 0 && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cp.pendente > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>contas a pagar: {cp.pendente > 0 ? `${brl(cp.pendente)} pendente` : 'quitado'}</span>}
                    {it.compraStatus === 'CANCELADA'
                      ? <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">CANCELADA</span>
                      : <button onClick={() => setCancelId(it.compraId)} className="text-[10px] text-gray-400 hover:text-red-600 hover:underline ml-auto">Cancelar compra</button>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Evolução de preço por material */}
          {materiaisComEvolucao.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">📈 Evolução de preço por material</h2>
              <div className="space-y-2">
                {materiaisComEvolucao.map(([mid, arr]: any) => {
                  const primeiro = arr[0], ultimo = arr[arr.length - 1]
                  const subiu = Number(ultimo.precoUnidade) > Number(primeiro.precoUnidade)
                  const igual = Number(ultimo.precoUnidade) === Number(primeiro.precoUnidade)
                  const pct = Number(primeiro.precoUnidade) > 0 ? ((Number(ultimo.precoUnidade) - Number(primeiro.precoUnidade)) / Number(primeiro.precoUnidade)) * 100 : 0
                  return (
                    <div key={mid} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-700 truncate flex-1">{ultimo.nome}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                        {brl(primeiro.precoUnidade)} <ArrowRight className="w-3 h-3" /> <b className="text-gray-700">{brl(ultimo.precoUnidade)}</b>
                        {!igual && (subiu
                          ? <span className="text-red-500 flex items-center"><TrendingUp className="w-3.5 h-3.5" />+{pct.toFixed(0)}%</span>
                          : <span className="text-emerald-600 flex items-center"><TrendingDown className="w-3.5 h-3.5" />{pct.toFixed(0)}%</span>)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1"><Search className="w-3 h-3" /> Compare com o mercado em <a href="/pesquisa-preco" className="text-orange-500 underline">Pesquisar preço</a>.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
