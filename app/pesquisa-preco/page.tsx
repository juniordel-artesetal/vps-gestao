'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp, TrendingDown, Minus, Sparkles, Store, ExternalLink, ShieldCheck, Info } from 'lucide-react'

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const CONF: Record<string, { label: string; cor: string }> = {
  baixa: { label: 'Confiabilidade baixa', cor: 'text-yellow-600 bg-yellow-50' },
  media: { label: 'Confiabilidade média', cor: 'text-blue-600 bg-blue-50' },
  alta: { label: 'Confiabilidade alta', cor: 'text-green-600 bg-green-50' },
}

export default function PesquisaPrecoPage() {
  const { status } = useSession()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<any>(null)
  const [erro, setErro] = useState('')
  const [seguindo, setSeguindo] = useState(false)
  const [comparar, setComparar] = useState<any>(null)
  const [loadingComp, setLoadingComp] = useState(false)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status])

  async function seguir() {
    if (!res?.termo) return
    setSeguindo(true)
    await fetch('/api/pesquisa-preco/alertas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ termo: res.termo, condicao: 'queda' }) })
  }
  async function carregarComparar() {
    if (comparar) { setComparar(null); return }
    setLoadingComp(true)
    try { const r = await fetch('/api/pesquisa-preco/comparar'); setComparar(await r.json()) } finally { setLoadingComp(false) }
  }

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault()
    if (!q.trim()) return
    setLoading(true); setErro(''); setRes(null); setSeguindo(false)
    try {
      const r = await fetch('/api/pesquisa-preco', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Erro na busca'); return }
      setRes(d)
    } finally { setLoading(false) }
  }

  async function clicarPatrocinado(p: any) {
    fetch('/api/pesquisa-preco/clique', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }).catch(() => {})
    if (p.link) window.open(p.link, '_blank')
  }

  const evolucao = res?.evolucao || []
  const maxEv = Math.max(1, ...evolucao.map((e: any) => e.precoMedio))
  const minEv = Math.min(...evolucao.map((e: any) => e.precoMedio), maxEv)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Assistente de Compras</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Digite um material e veja a faixa de preço de mercado, com base nos dados da comunidade de artesãs (anônimos e agregados).</p>

        <form onSubmit={buscar} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex: cola branca, feltro, fita de cetim..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <button type="submit" disabled={loading || !q.trim()} className="px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50">
            {loading ? '...' : 'Pesquisar'}
          </button>
        </form>

        {/* Meus preços vs mercado */}
        <button onClick={carregarComparar} className="mb-4 text-sm text-orange-500 hover:text-orange-600 font-medium">
          {comparar ? '← Voltar à busca' : loadingComp ? 'Carregando...' : '📊 Ver meus preços vs mercado'}
        </button>

        {comparar && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-4">
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Onde você pode economizar</p>
            <p className="text-xs text-gray-400 mb-3">Comparamos os seus materiais com a faixa de mercado (comparados: {comparar.comparados || 0}).</p>
            {(comparar.acima || []).length === 0 ? (
              <p className="text-sm text-green-600">🎉 Você não está pagando acima do mercado nos materiais com dados suficientes!</p>
            ) : (comparar.acima || []).map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{m.nome}</p>
                  <p className="text-xs text-gray-400">Você: {brl(m.seuPreco)} · Mercado: {brl(m.mercadoMedio)}</p>
                </div>
                <span className="text-xs font-semibold text-red-500 flex-shrink-0 ml-2">+{m.diffPct}%</span>
              </div>
            ))}
            {(comparar.abaixo || []).length > 0 && (
              <p className="text-xs text-green-600 mt-3">✓ Você compra bem em {comparar.abaixo.length} material(is) (abaixo do mercado).</p>
            )}
          </div>
        )}

        {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{erro}</div>}

        {res && !res.suficiente && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 text-center">
            <Info className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Dados insuficientes para "{res.termo}"</p>
            <p className="text-xs text-gray-400 mt-1">Ainda não temos amostra suficiente na comunidade para esse material. A cobertura melhora conforme mais artesãs cadastram seus materiais.</p>
          </div>
        )}

        {res && res.suficiente && (
          <div className="space-y-4">
            {/* Faixa + KPIs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-semibold text-gray-800 dark:text-white capitalize">{res.termo}</h2>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${CONF[res.confiabilidade]?.cor}`}><ShieldCheck size={11} className="inline mr-1" />{CONF[res.confiabilidade]?.label}</span>
              </div>
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">Faixa sugerida de mercado{res.unidade ? ` (por ${res.unidade})` : ''}</p>
                <p className="text-2xl font-bold text-orange-500">{brl(res.faixaMin)} — {brl(res.faixaMax)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div><p className="text-xs text-gray-400">Menor</p><p className="text-sm font-semibold text-green-600">{brl(res.menor)}</p></div>
                <div><p className="text-xs text-gray-400">Médio</p><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{brl(res.medio)}</p></div>
                <div><p className="text-xs text-gray-400">Fontes</p><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{res.nFontes}</p></div>
              </div>
              <button onClick={seguir} disabled={seguindo}
                className={`w-full mt-3 py-2 rounded-lg text-sm font-semibold border ${seguindo ? 'bg-green-50 text-green-600 border-green-200' : 'border-orange-200 text-orange-500 hover:bg-orange-50'}`}>
                {seguindo ? '🔔 Seguindo — avisamos quando o preço cair' : '🔔 Seguir preço deste material'}
              </button>
            </div>

            {/* IA */}
            {res.ia && (res.ia.resumo || res.ia.dica) && (
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-500 mb-1 flex items-center gap-1"><Sparkles size={12} /> Análise</p>
                {res.ia.resumo && <p className="text-sm text-gray-700 dark:text-gray-200">{res.ia.resumo}</p>}
                {res.ia.dica && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">💡 {res.ia.dica}</p>}
              </div>
            )}

            {/* Evolução */}
            {evolucao.length >= 2 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Evolução (30 dias)</p>
                  <span className="text-xs flex items-center gap-1">
                    {res.tendencia === 'subindo' ? <><TrendingUp size={13} className="text-red-500" /><span className="text-red-500">subindo</span></>
                      : res.tendencia === 'caindo' ? <><TrendingDown size={13} className="text-green-500" /><span className="text-green-500">caindo</span></>
                        : <><Minus size={13} className="text-gray-400" /><span className="text-gray-400">estável</span></>}
                  </span>
                </div>
                <div className="flex items-end gap-1 h-20">
                  {evolucao.map((e: any, i: number) => {
                    const h = maxEv === minEv ? 50 : ((e.precoMedio - minEv) / (maxEv - minEv)) * 80 + 10
                    return <div key={i} title={`${e.data}: ${brl(e.precoMedio)}`} className="flex-1 bg-orange-300 rounded-t" style={{ height: `${h}%` }} />
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center">O gráfico de evolução aparece quando houver histórico de mais dias.</p>
            )}

            {/* Onde comprar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-1"><Store size={14} className="text-orange-500" /> Onde comprar</p>
              {res.patrocinados?.map((p: any) => (
                <button key={p.id} onClick={() => clicarPatrocinado(p)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50/40 dark:bg-orange-900/10 mb-2 text-left hover:bg-orange-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{p.nome} <span className="text-[9px] font-bold text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full ml-1">Patrocinado</span></p>
                    {p.precoExibido && <p className="text-xs text-gray-500">{p.precoExibido}</p>}
                  </div>
                  <ExternalLink size={14} className="text-orange-400" />
                </button>
              ))}
              {(res.ondeComprar || []).length === 0 && (res.patrocinados || []).length === 0 ? (
                <p className="text-xs text-gray-400">Sem fornecedores suficientes na base ainda.</p>
              ) : (res.ondeComprar || []).map((o: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 dark:border-gray-700 mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{o.fornecedor}</p>
                    <p className="text-xs text-gray-400">{o.nCompras} registro(s) na comunidade</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{brl(o.precoMedio)}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1"><ShieldCheck size={11} /> Valores anônimos e agregados de {res.nFontes} fontes — nunca mostramos preço de uma artesã específica.</p>
          </div>
        )}
      </div>
    </div>
  )
}
