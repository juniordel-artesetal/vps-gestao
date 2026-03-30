'use client'

import { useState, useEffect, useCallback } from 'react'

interface Config {
  id: string; tipo: 'UNITARIO' | 'KIT'; qtdKit: number
  custoTotal: number; impostos: number; precoVenda: number | null
  canal: string; subOpcao: string
}
interface Produto { id: string; sku: string | null; nome: string; categoria: string | null; configs: Config[] }

const CANAIS = [
  { key: 'shopee',  label: 'Shopee',        emoji: '🛍️' },
  { key: 'ml',      label: 'Mercado Livre', emoji: '🟡' },
  { key: 'amazon',  label: 'Amazon',        emoji: '📦' },
  { key: 'tiktok',  label: 'TikTok Shop',   emoji: '🎵' },
  { key: 'elo7',    label: 'Elo7',          emoji: '🎨' },
  { key: 'magalu',  label: 'Magalu',        emoji: '🛒' },
  { key: 'direta',  label: 'Venda Direta',  emoji: '🤝' },
]

function getTaxa(canal: string, sub: string, preco: number) {
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

function calcPreco(custo: number, aliqPct: number, margem: number, taxa: number, fixo: number) {
  const denom = 1 - taxa - (aliqPct / 100) - margem
  if (denom <= 0) return null
  return (custo + fixo) / denom
}

function fmtBRL(n: number) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CanaisPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')
  const [prodSel, setProdSel]   = useState<string>('todos')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/precificacao/produtos').then(r => r.json()).catch(() => [])
    const prods = (Array.isArray(data) ? data : []).map((p: any) => ({
      ...p, configs: (p.variacoes || []).map((v: any) => ({
        ...v, tipo: v.tipo || 'UNITARIO', canal: v.canal || 'shopee', subOpcao: v.subOpcao || 'classico',
      }))
    }))
    setProdutos(prods)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: string) {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const produtosFiltrados = produtos.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()) && !(p.sku || '').toLowerCase().includes(busca.toLowerCase())) return false
    if (prodSel !== 'todos' && p.id !== prodSel) return false
    return p.configs && p.configs.length > 0
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Canais de Venda</h1>
        <p className="text-gray-500 text-sm mt-1">Compare o preço ideal em todos os canais com cenários de margem baixa, saudável e alta.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-64" />
        <select value={prodSel} onChange={e => setProdSel(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="todos">Todos os produtos</option>
          {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sku ? `(${p.sku})` : ''}</option>)}
        </select>
        <button onClick={() => setExpanded(new Set(produtosFiltrados.map(p => p.id)))}
          className="text-xs text-orange-600 border border-orange-200 px-3 py-2 rounded-lg hover:bg-orange-50">Expandir todos</button>
        <button onClick={() => setExpanded(new Set())}
          className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">Recolher todos</button>
      </div>

      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" />Margem baixa 15%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-200 inline-block" />Margem saudável 30%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-200 inline-block" />Margem alta 45%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-300 inline-block" />Preço atual definido</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Carregando...</div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Nenhum produto encontrado.</div>
      ) : (
        <div className="space-y-4">
          {produtosFiltrados.map(produto => (
            <div key={produto.id} className="bg-white rounded-xl border border-gray-100">
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 rounded-xl"
                onClick={() => toggleExpand(produto.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{expanded.has(produto.id) ? '▼' : '▶'}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{produto.nome}</p>
                    <p className="text-xs text-gray-400">
                      {produto.sku && <span className="font-mono mr-2">{produto.sku}</span>}
                      {produto.categoria && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full mr-2">{produto.categoria}</span>}
                      <span>{produto.configs.length} configuração(ões)</span>
                    </p>
                  </div>
                </div>
              </div>

              {expanded.has(produto.id) && produto.configs.map(config => {
                const custo      = Number(config.custoTotal)
                const aliqPct    = Number(config.impostos || 0)
                const precoAtual = config.precoVenda ? Number(config.precoVenda) : null

                return (
                  <div key={config.id} className="border-t border-gray-50 px-5 pb-5">
                    <div className="flex items-center gap-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.tipo === 'KIT' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {config.tipo === 'KIT' ? '🎁 Kit' : '📦 Unitário'} · {config.qtdKit} un
                      </span>
                      <span className="text-xs text-gray-500">Custo: <strong>{fmtBRL(custo)}</strong></span>
                      {aliqPct > 0 && <span className="text-xs text-gray-500">Impostos: <strong>{aliqPct}%</strong></span>}
                      {precoAtual && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">Preço atual: {fmtBRL(precoAtual)}</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {CANAIS.map(canal => {
                        const subOpcoes = canal.key === 'ml'
                          ? [{ key: 'classico', label: 'Clássico' }, { key: 'premium', label: 'Premium' }]
                          : canal.key === 'elo7'
                            ? [{ key: 'padrao', label: 'Padrão' }, { key: 'maxima', label: 'Máxima' }]
                            : [{ key: '', label: '' }]

                        return subOpcoes.map(sub => {
                          const refPreco = precoAtual || calcPreco(custo, aliqPct, 0.30, 0.20, 4) || 50
                          const { taxa, fixo } = getTaxa(canal.key, sub.key, refPreco)
                          const pBaixo    = calcPreco(custo, aliqPct, 0.15, taxa, fixo)
                          const pSaudavel = calcPreco(custo, aliqPct, 0.30, taxa, fixo)
                          const pAlto     = calcPreco(custo, aliqPct, 0.45, taxa, fixo)
                          let margemAtual: number | null = null
                          if (precoAtual) {
                            const { taxa: t, fixo: f } = getTaxa(canal.key, sub.key, precoAtual)
                            const lucro = precoAtual - custo - precoAtual*(aliqPct/100) - (precoAtual*t + f)
                            margemAtual = (lucro / precoAtual) * 100
                          }
                          const canalLabel = sub.label ? `${canal.label} ${sub.label}` : canal.label
                          const taxaLabel  = `${(taxa * 100).toFixed(0)}%${fixo > 0 ? ` + R$${fixo.toFixed(2)}` : ''}`

                          return (
                            <div key={`${canal.key}-${sub.key}`} className="border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{canal.emoji}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-700">{canalLabel}</p>
                                    <p className="text-xs text-gray-400">Taxa: {taxaLabel}</p>
                                  </div>
                                </div>
                                {margemAtual !== null && (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${margemAtual >= 35 ? 'bg-green-50 text-green-700' : margemAtual >= 20 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                                    {margemAtual.toFixed(1)}% atual
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[
                                  { label: 'Baixa',    valor: pBaixo,    bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
                                  { label: 'Saudável', valor: pSaudavel, bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200'  },
                                  { label: 'Alta',     valor: pAlto,     bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200'   },
                                ].map(({ label, valor, bg, text, border }) => {
                                  const margemVal = valor ? valor * (label === 'Baixa' ? 0.15 : label === 'Saudável' ? 0.30 : 0.45) : null
                                  return (
                                    <div key={label} className={`${bg} ${border} border rounded-lg p-2 text-center`}>
                                      <p className={`text-xs font-medium ${text} opacity-70`}>{label}</p>
                                      <p className={`text-sm font-bold ${text} mt-0.5`}>{valor ? fmtBRL(valor) : '—'}</p>
                                      {margemVal && <p className={`text-xs ${text} opacity-60`}>+{fmtBRL(margemVal)}</p>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
