'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Link2, ArrowLeft, RefreshCw, Check, X } from 'lucide-react'

type Sugestao = { variacaoId: string; label: string | null } | null
type ItemNome = { nome: string; pedidos: number; sugestao: Sugestao; status: 'match' | 'ambiguo' | 'nenhum' }
type Variacao = { id: string; label: string }

const inp = 'border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function VincularPedidosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [itens, setItens] = useState<ItemNome[]>([])
  const [variacoes, setVariacoes] = useState<Variacao[]>([])
  const [escolha, setEscolha] = useState<Record<string, string>>({})   // nome → variacaoId ('' = ignorar)
  const [recalc, setRecalc] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  // criar por cópia
  const [criarAberto, setCriarAberto] = useState<Record<string, boolean>>({})
  const [sugBase, setSugBase] = useState<Record<string, { id: string; nome: string; score: number }[]>>({})
  const [baseSel, setBaseSel] = useState<Record<string, string>>({})
  const [criando, setCriando] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/modulos')
      else carregar()
    }
  }, [status])

  async function carregar() {
    setLoading(true); setResultado(null)
    try {
      const d = await (await fetch('/api/precificacao/vincular-pedidos')).json()
      const its: ItemNome[] = Array.isArray(d.itens) ? d.itens : []
      setItens(its); setVariacoes(Array.isArray(d.variacoes) ? d.variacoes : [])
      // Pré-seleciona a sugestão de match único
      const pre: Record<string, string> = {}
      for (const it of its) if (it.status === 'match' && it.sugestao) pre[it.nome] = it.sugestao.variacaoId
      setEscolha(pre)
    } finally { setLoading(false) }
  }

  async function abrirCriar(nome: string) {
    setCriarAberto(s => ({ ...s, [nome]: !s[nome] }))
    if (sugBase[nome]) return
    try {
      const d = await (await fetch(`/api/precificacao/produtos/sugerir-base?nome=${encodeURIComponent(nome)}`)).json()
      const sug = Array.isArray(d.sugestoes) ? d.sugestoes : []
      setSugBase(s => ({ ...s, [nome]: sug })); if (sug[0]) setBaseSel(b => ({ ...b, [nome]: sug[0].id }))
    } catch {}
  }
  async function criarPorCopia(nome: string) {
    const baseId = baseSel[nome]; if (!baseId) { alert('Escolha um produto base.'); return }
    setCriando(c => ({ ...c, [nome]: true }))
    try {
      const r = await fetch('/api/importacao/criar-por-copia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseId, nome, canal: 'shopee' }) })
      const d = await r.json()
      if (!r.ok || !d.variacaoId) { alert(d?.error || 'Não consegui criar.'); return }
      // adiciona a nova variação ao dropdown e seleciona
      const novaLabel = nome
      setVariacoes(v => v.some(x => x.id === d.variacaoId) ? v : [{ id: d.variacaoId, label: novaLabel }, ...v])
      setEscolha(e => ({ ...e, [nome]: d.variacaoId }))
      setCriarAberto(s => ({ ...s, [nome]: false }))
    } finally { setCriando(c => ({ ...c, [nome]: false })) }
  }

  async function aplicar() {
    const mapeamentos = Object.entries(escolha).filter(([, vid]) => vid).map(([nome, variacaoId]) => ({ nome, variacaoId }))
    if (mapeamentos.length === 0) { alert('Nenhum mapeamento selecionado.'); return }
    if (recalc && !confirm('Recalcular as peças pelo kit também? O VALOR de cada pedido é preservado (valorUnitário re-derivado), mas a quantidade de peças muda. Continuar?')) return
    setAplicando(true)
    try {
      const r = await fetch('/api/precificacao/vincular-pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapeamentos, recalcularPecas: recalc }) })
      const d = await r.json()
      if (!r.ok) { alert(d?.error || 'Erro ao aplicar'); return }
      setResultado(d); carregar()
    } finally { setAplicando(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  const totalSelec = Object.values(escolha).filter(Boolean).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <a href="/precificacao/produtos" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"><ArrowLeft size={12} /> Voltar</a>
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Vincular pedidos à Precificação</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ligue os nomes de produto dos pedidos ao seu cadastro — os pedidos passam a contar no painel "Resultado das vendas" e as próximas importações desse nome vinculam sozinhas.</p>

        {resultado && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-4 text-sm text-emerald-700">
            ✓ {resultado.pedidosAtualizados} pedido(s) vinculado(s).{' '}
            {resultado.porteiro && (resultado.porteiro.ok
              ? <span>Faturamento intocado (R$ {resultado.porteiro.antes} → R$ {resultado.porteiro.depois}).</span>
              : <span className="text-red-600">⚠ Faturamento divergiu: {resultado.porteiro.antes} → {resultado.porteiro.depois}.</span>)}
          </div>
        )}

        {itens.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
            🎉 Todos os pedidos já estão vinculados à Precificação.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={recalc} onChange={e => setRecalc(e.target.checked)} className="accent-orange-500 w-3.5 h-3.5" />
                Também corrigir a quantidade de peças pelo kit <span className="text-gray-400">(opcional — o valor é preservado)</span>
              </label>
              <div className="flex items-center gap-2">
                <button onClick={carregar} className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50"><RefreshCw size={14} /></button>
                <button onClick={aplicar} disabled={aplicando || totalSelec === 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                  {aplicando ? 'Aplicando...' : `Aplicar (${totalSelec})`}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Produto (texto do pedido)</th>
                    <th className="px-3 py-2 text-center">Pedidos</th>
                    <th className="px-3 py-2 text-left">Vincular a</th>
                  </tr></thead>
                  <tbody>
                    {itens.map(it => (
                      <tr key={it.nome} className="border-b border-gray-50 dark:border-gray-700/50 align-top">
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[300px]">
                          <span title={it.nome} className="line-clamp-2">{it.nome}</span>
                          {it.status === 'ambiguo' && <span className="text-[10px] text-amber-500 block">nome ambíguo — escolha manual</span>}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">{it.pedidos}</td>
                        <td className="px-3 py-2">
                          <select value={escolha[it.nome] || ''} onChange={e => setEscolha(x => ({ ...x, [it.nome]: e.target.value }))} className={inp + ' w-full max-w-[300px]'}>
                            <option value="">— ignorar —</option>
                            {variacoes.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                          </select>
                          {it.status === 'match' && it.sugestao && escolha[it.nome] === it.sugestao.variacaoId && (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-0.5"><Check size={10} /> sugerido</span>
                          )}
                          <div className="mt-0.5">
                            <button onClick={() => abrirCriar(it.nome)} className="text-[10px] text-orange-600 hover:underline">
                              {criarAberto[it.nome] ? '− fechar' : '✚ criar copiando um produto igual'}
                            </button>
                          </div>
                          {criarAberto[it.nome] && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              {(sugBase[it.nome] || []).length === 0 ? (
                                <span className="text-[10px] text-gray-400">Nenhum produto parecido para copiar.</span>
                              ) : (
                                <>
                                  <select value={baseSel[it.nome] || ''} onChange={e => setBaseSel(b => ({ ...b, [it.nome]: e.target.value }))} className={inp + ' max-w-[220px]'}>
                                    {(sugBase[it.nome] || []).map(s => <option key={s.id} value={s.id}>{s.nome} ({s.score}%)</option>)}
                                  </select>
                                  <button onClick={() => criarPorCopia(it.nome)} disabled={criando[it.nome]}
                                    className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white rounded px-2 py-0.5 font-semibold disabled:opacity-50">
                                    {criando[it.nome] ? 'Criando...' : 'Criar e vincular'}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Vincular grava só o vínculo (variacaoId) — não muda quantidade nem valor. O de-para fica salvo para as próximas importações.</p>
          </>
        )}
      </div>
    </div>
  )
}
