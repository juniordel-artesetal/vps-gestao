'use client'

import { useState, useEffect, useCallback } from 'react'

interface Config {
  id: string; tipo: 'UNITARIO' | 'KIT'; qtdKit: number
  custoTotal: number; impostos: number; precoVenda: number | null
  canal: string; subOpcao: string
}
interface Produto { id: string; sku: string | null; nome: string; categoria: string | null; configs: Config[] }

// NOVO: interface para Combos
interface ComboItem { nomeProduto: string; qtd: number; custoUnit: number }
interface Combo {
  id: string; nome: string; descricao: string | null
  canal: string; subOpcao: string | null
  precoNormal: number; descontoPct: number; precoCombo: number
  itens: ComboItem[]
}

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

function canalLabel(canal: string) {
  const c = CANAIS.find(x => x.key === canal.toLowerCase())
  return c ? `${c.emoji} ${c.label}` : canal
}

export default function CanaisPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [combos,   setCombos]   = useState<Combo[]>([])
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')
  const [prodSel, setProdSel]   = useState<string>('todos')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [aba, setAba]           = useState<'produtos' | 'combos'>('produtos')

  const load = useCallback(async () => {
    setLoading(true)
    const [dataProds, dataCombos] = await Promise.all([
      fetch('/api/precificacao/produtos').then(r => r.json()).catch(() => []),
      // CORRIGIDO: busca combos também
      fetch('/api/precificacao/combos').then(r => r.json()).catch(() => []),
    ])

    const prods = (Array.isArray(dataProds) ? dataProds : []).map((p: any) => ({
      ...p,
      configs: (p.variacoes || []).map((v: any) => ({
        ...v, tipo: v.tipo || 'UNITARIO', canal: v.canal || 'shopee', subOpcao: v.subOpcao || 'classico',
      }))
    }))
    setProdutos(prods)

    // Normaliza combos
    const cbs = (Array.isArray(dataCombos) ? dataCombos : []).map((c: any) => ({
      id:          c.id,
      nome:        c.nome,
      descricao:   c.descricao || null,
      canal:       c.canal || 'shopee',
      subOpcao:    c.subOpcao || null,
      precoNormal: Number(c.precoNormal || 0),
      descontoPct: Number(c.descontoPct || 0),
      precoCombo:  Number(c.precoCombo || 0),
      itens:       (c.itens || []).map((i: any) => ({
        nomeProduto: i.nomeProduto,
        qtd:         Number(i.qtd || 1),
        custoUnit:   Number(i.custoUnit || 0),
      })),
    }))
    setCombos(cbs)
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

  const combosFiltrados = combos.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Canais de Venda</h1>
        <p className="text-gray-500 text-sm mt-1">Compare o preço ideal em todos os canais com cenários de margem baixa, saudável e alta.</p>
      </div>

      {/* Abas Produtos / Combos */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setAba('produtos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${aba === 'produtos' ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Produtos ({produtos.filter(p => p.configs.length > 0).length})
        </button>
        <button onClick={() => setAba('combos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${aba === 'combos' ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Combos ({combos.length})
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-64" />
        {aba === 'produtos' && (
          <select value={prodSel} onChange={e => setProdSel(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="todos">Todos os produtos</option>
            {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sku ? `(${p.sku})` : ''}</option>)}
          </select>
        )}
        <button onClick={() => setExpanded(new Set(aba === 'produtos' ? produtosFiltrados.map(p => p.id) : combosFiltrados.map(c => c.id)))}
          className="text-xs text-orange-600 border border-orange-200 px-3 py-2 rounded-lg hover:bg-orange-50">Expandir todos</button>
        <button onClick={() => setExpanded(new Set())}
          className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">Recolher todos</button>
      </div>

      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" />Margem baixa 15%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-200 inline-block" />Margem saudável 30%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-200 inline-block" />Margem alta 45%</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-300 inline-block" />Preço definido</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Carregando...</div>
      ) : aba === 'produtos' ? (
        /* ── ABA PRODUTOS ── */
        produtosFiltrados.length === 0 ? (
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
                            const cLabel = sub.label ? `${canal.label} ${sub.label}` : canal.label
                            const taxaLabel = `${(taxa * 100).toFixed(0)}%${fixo > 0 ? ` + R$${fixo.toFixed(2)}` : ''}`

                            return (
                              <div key={`${canal.key}-${sub.key}`} className="border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{canal.emoji}</span>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-700">{cLabel}</p>
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
        )
      ) : (
        /* ── ABA COMBOS ── */
        combosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
            {combos.length === 0 ? 'Nenhum combo cadastrado. Crie combos em Precificação → Combos.' : 'Nenhum combo encontrado.'}
          </div>
        ) : (
          <div className="space-y-4">
            {combosFiltrados.map(combo => {
              const custoTotal = combo.itens.reduce((s, i) => s + i.custoUnit * i.qtd, 0)
              const economiaReais = combo.precoNormal - combo.precoCombo

              return (
                <div key={combo.id} className="bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 rounded-xl"
                    onClick={() => toggleExpand(combo.id)}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{expanded.has(combo.id) ? '▼' : '▶'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{combo.nome}</p>
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            Combo · {canalLabel(combo.canal)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {combo.descricao || `${combo.itens.length} produto(s) · Desconto ${combo.descontoPct}%`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">{fmtBRL(combo.precoCombo)}</p>
                      {economiaReais > 0 && (
                        <p className="text-xs text-green-600">economia de {fmtBRL(economiaReais)}</p>
                      )}
                    </div>
                  </div>

                  {expanded.has(combo.id) && (
                    <div className="border-t border-gray-50 px-5 pb-5">
                      {/* Itens do combo */}
                      <div className="py-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Composição do combo</p>
                        <div className="space-y-1 mb-4">
                          {combo.itens.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm text-gray-600">
                              <span>{item.qtd}x {item.nomeProduto}</span>
                              <span className="text-gray-400">{fmtBRL(item.custoUnit * item.qtd)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-semibold text-gray-700 border-t border-gray-100 pt-2 mt-2">
                            <span>Custo total estimado</span>
                            <span>{fmtBRL(custoTotal)}</span>
                          </div>
                        </div>

                        {/* Análise de preço do combo no canal */}
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Análise no canal {canalLabel(combo.canal)}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Preço atual do combo */}
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                            <p className="text-xs text-orange-600 font-medium mb-1">Preço do combo</p>
                            <p className="text-xl font-bold text-orange-700">{fmtBRL(combo.precoCombo)}</p>
                            <p className="text-xs text-orange-500 mt-0.5">Desconto de {combo.descontoPct}%</p>
                          </div>
                          {/* Preço normal (sem combo) */}
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                            <p className="text-xs text-gray-500 font-medium mb-1">Preço separado</p>
                            <p className="text-xl font-bold text-gray-600">{fmtBRL(combo.precoNormal)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Sem desconto combo</p>
                          </div>
                          {/* Margem no canal */}
                          {(() => {
                            const { taxa, fixo } = getTaxa(combo.canal.toLowerCase(), combo.subOpcao || '', combo.precoCombo)
                            const lucro = combo.precoCombo - custoTotal - (combo.precoCombo * taxa + fixo)
                            const margem = combo.precoCombo > 0 ? (lucro / combo.precoCombo) * 100 : 0
                            return (
                              <div className={`border rounded-xl p-3 ${margem >= 30 ? 'bg-green-50 border-green-200' : margem >= 15 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                                <p className={`text-xs font-medium mb-1 ${margem >= 30 ? 'text-green-600' : margem >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>Margem estimada</p>
                                <p className={`text-xl font-bold ${margem >= 30 ? 'text-green-700' : margem >= 15 ? 'text-yellow-700' : 'text-red-700'}`}>{margem.toFixed(1)}%</p>
                                <p className={`text-xs mt-0.5 ${margem >= 30 ? 'text-green-500' : margem >= 15 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  Taxa canal: {(taxa * 100).toFixed(0)}%{fixo > 0 ? ` + R$${fixo.toFixed(2)}` : ''}
                                </p>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
