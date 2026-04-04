'use client'

import { useState, useEffect, useCallback } from 'react'

interface Config {
  id: string
  tipo: 'UNITARIO' | 'KIT'
  qtdKit: number
  custoTotal: number
  impostos: number
  precoVenda: number | null
  canal: string
  subOpcao: string
  emPromo: boolean
  descontoPct: number
  precoPromocional: number | null
}

interface Produto {
  id: string
  sku: string | null
  nome: string
  categoria: string | null
  configs: Config[]
}

function getTaxa(canal: string, sub: string, preco: number): { taxa: number; fixo: number } {
  if (canal === 'shopee') {
    // Taxas Shopee 2026 CNPJ — por faixa de preço do item
    if (preco < 8)   return { taxa: 0.50, fixo: 0 }
    if (preco < 80)  return { taxa: 0.20, fixo: 4.00 }
    if (preco < 100) return { taxa: 0.14, fixo: 16.00 }
    if (preco < 200) return { taxa: 0.14, fixo: 20.00 }
    return             { taxa: 0.14, fixo: 26.00 }
  }
  if (canal === 'ml')     return sub === 'premium' ? { taxa: 0.16, fixo: 0 } : { taxa: 0.12, fixo: 0 }
  if (canal === 'amazon') return { taxa: 0.12, fixo: 2.00 }
  if (canal === 'tiktok') return { taxa: 0.06, fixo: 2.00 }
  if (canal === 'elo7')   return sub === 'maxima' ? { taxa: 0.20, fixo: 3.99 } : { taxa: 0.18, fixo: 3.99 }
  if (canal === 'magalu') return { taxa: 0.10, fixo: 0 }
  return { taxa: 0.03, fixo: 0 }
}

function sugerirPreco(custo: number, aliqPct: number, margem: number, taxa: number, fixo: number) {
  const denom = 1 - taxa - (aliqPct / 100) - margem
  if (denom <= 0) return null
  return (custo + fixo) / denom
}

const CANAL_LABELS: Record<string, string> = {
  shopee: 'Shopee', ml: 'Merc. Livre', amazon: 'Amazon',
  tiktok: 'TikTok', elo7: 'Elo7', magalu: 'Magalu', direta: 'Direta',
}

function fmtBRL(n: number) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type FiltroMargem = 'todos' | 'baixa' | 'saudavel' | 'alta' | 'sem_preco' | 'promo'

export default function SkusPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')
  const [filtro, setFiltro]     = useState<FiltroMargem>('todos')
  const [salvando, setSalvando] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/precificacao/produtos').then(r => r.json()).catch(() => [])
    const prods = (Array.isArray(data) ? data : []).map((p: any) => ({
      ...p,
      configs: (p.variacoes || []).map((v: any) => ({
        ...v, tipo: v.tipo || 'UNITARIO', canal: v.canal || 'shopee', subOpcao: v.subOpcao || 'classico',
        emPromo: Boolean(v.emPromo),
        descontoPct: Number(v.descontoPct || 0),
        precoPromocional: v.precoPromocional ? Number(v.precoPromocional) : null,
      }))
    }))
    setProdutos(prods)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function atualizarPreco(configId: string, novoPreco: number, nomeProduto: string, margem: number) {
    const margemLabel = margem === 0.15 ? 'Margem baixa (15%)' : margem === 0.30 ? 'Margem saudável (30%)' : 'Margem alta (45%)'
    if (!window.confirm(`Atualizar preço de "${nomeProduto}"?\n\n${margemLabel}\nNovo preço: ${fmtBRL(novoPreco)}\n\nConfirma?`)) return
    setSalvando(configId)
    try {
      await fetch(`/api/precificacao/variacoes/${configId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precoVenda: novoPreco }),
      })
      await load()
    } finally { setSalvando(null) }
  }

  const linhas = produtos.flatMap(p => (p.configs || []).map(c => ({ produto: p, config: c })))

  const linhasFiltradas = linhas.filter(({ produto, config }) => {
    const q = busca.toLowerCase()
    if (q && !produto.nome.toLowerCase().includes(q) && !(produto.sku || '').toLowerCase().includes(q)) return false
    if (filtro !== 'todos') {
      const preco = Number(config.precoVenda)
      const custo = Number(config.custoTotal)
      if (filtro === 'sem_preco') return !config.precoVenda
      if (filtro === 'promo')     return config.emPromo
      if (!config.precoVenda) return false
      const margem = (preco - custo) / preco
      if (filtro === 'baixa')    return margem < 0.20
      if (filtro === 'saudavel') return margem >= 0.20 && margem < 0.40
      if (filtro === 'alta')     return margem >= 0.40
    }
    return true
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Lista de SKUs</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral de todos os produtos precificados. Clique em uma sugestão para aplicar o preço.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar SKU ou produto..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-64" />
        <div className="flex gap-1.5">
          {[
            { key: 'todos', label: 'Todos' }, { key: 'sem_preco', label: 'Sem preço' },
            { key: 'promo', label: '🏷 Em promoção' },
            { key: 'baixa', label: '⚠ Margem baixa' }, { key: 'saudavel', label: '✅ Saudável' }, { key: 'alta', label: '🚀 Alta' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key as FiltroMargem)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtro === f.key ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Carregando...</div>
      ) : linhasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Nenhum produto encontrado.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="px-4 py-3 text-left font-semibold text-gray-500">SKU / Produto</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500">Canal</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Custo total</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Custo/un</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Impostos</th>
                <th className="px-3 py-3 text-center font-semibold text-yellow-700 bg-yellow-50">Margem baixa 15%</th>
                <th className="px-3 py-3 text-center font-semibold text-green-700 bg-green-50">Margem saudável 30%</th>
                <th className="px-3 py-3 text-center font-semibold text-blue-700 bg-blue-50">Margem alta 45%</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Preço de venda</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Margem %</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Margem R$</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map(({ produto, config }, idx) => {
                const custo = Number(config.custoTotal)
                const preco = config.precoVenda ? Number(config.precoVenda) : null
                const aliqPct = Number(config.impostos || 0)
                const qtdProd = Math.max(Number(config.qtdKit) || 1, 1)
                const custoUnit = custo / qtdProd
                const refPreco = preco || sugerirPreco(custo, aliqPct, 0.30, 0.20, 4) || 50
                const { taxa, fixo } = getTaxa(config.canal, config.subOpcao || 'classico', refPreco)
                const pBaixo    = sugerirPreco(custo, aliqPct, 0.15, taxa, fixo)
                const pSaudavel = sugerirPreco(custo, aliqPct, 0.30, taxa, fixo)
                const pAlto     = sugerirPreco(custo, aliqPct, 0.45, taxa, fixo)
                const impostoR  = preco ? preco * (aliqPct / 100) : 0
                const comissaoR = preco ? preco * taxa + fixo : 0
                const lucroR    = preco ? preco - custo - impostoR - comissaoR : 0
                const margemPerc = preco ? (lucroR / preco) * 100 : null
                const margemRS   = preco ? lucroR : null
                const corMargem  = margemPerc === null ? 'text-gray-300' : margemPerc >= 35 ? 'text-green-600' : margemPerc >= 20 ? 'text-yellow-600' : 'text-red-500'

                return (
                  <tr key={config.id} className={'border-b border-gray-50 hover:bg-gray-50/40 ' + (idx % 2 === 0 ? '' : 'bg-gray-50/20')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{produto.nome}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {produto.sku && <span className="text-xs font-mono text-gray-400">{produto.sku}</span>}
                        {produto.categoria && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{produto.categoria}</span>}
                        <span className="text-xs text-gray-400">{config.qtdKit} un</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.tipo === 'KIT' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {config.tipo === 'KIT' ? '🎁 Kit' : '📦 Un'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{CANAL_LABELS[config.canal] || config.canal}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtBRL(custo)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{fmtBRL(custoUnit)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{aliqPct > 0 ? `${aliqPct}%` : '—'}</td>

                    {[
                      { valor: pBaixo,    bg: 'hover:bg-yellow-50 bg-yellow-50/50', ring: 'ring-yellow-300', text: 'text-yellow-800', m: 0.15 },
                      { valor: pSaudavel, bg: 'hover:bg-green-50 bg-green-50/50',   ring: 'ring-green-300',  text: 'text-green-800',  m: 0.30 },
                      { valor: pAlto,     bg: 'hover:bg-blue-50 bg-blue-50/50',     ring: 'ring-blue-300',   text: 'text-blue-800',   m: 0.45 },
                    ].map(({ valor, bg, ring, text, m }) => (
                      <td key={ring} className="px-3 py-3 text-center">
                        {valor ? (
                          <button onClick={() => atualizarPreco(config.id, valor, produto.nome, m)} disabled={salvando === config.id}
                            className={`inline-flex flex-col items-center px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${bg} ${text} ${preco === valor ? `ring-2 ${ring}` : 'hover:ring-1 ' + ring} disabled:opacity-50 cursor-pointer`}>
                            <span className="font-bold">{fmtBRL(valor)}</span>
                            <span className="opacity-60 text-xs">{salvando === config.id ? '...' : 'usar'}</span>
                          </button>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}

                    <td className="px-4 py-3 text-right">
                      {preco ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`font-bold ${config.emPromo ? 'line-through text-gray-400 text-xs' : 'text-green-700'}`}>{fmtBRL(preco)}</span>
                          {config.emPromo && config.precoPromocional && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">-{config.descontoPct}%</span>
                              <span className="font-bold text-red-600">{fmtBRL(config.precoPromocional)}</span>
                            </div>
                          )}
                          {config.emPromo && !config.precoPromocional && (
                            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">🏷 Em promoção</span>
                          )}
                        </div>
                      ) : <span className="text-xs text-gray-300 italic">não definido</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {margemPerc !== null ? <span className={`font-semibold text-sm ${corMargem}`}>{margemPerc.toFixed(1)}%</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {margemRS !== null ? <span className={`font-semibold text-sm ${corMargem}`}>{fmtBRL(margemRS)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
