'use client'

import { useState, useEffect } from 'react'

interface Variacao {
  id: string; qtdKit: number; custoTotal: number; precoVenda: number | null; precoPromocional: number | null
}
interface Produto { id: string; nome: string; sku: string | null; variacoes: Variacao[] }

interface Resultado {
  preco: number; custo: number; canal: string
  taxa: { comissaoPerc: number; taxaFixa: number; taxaFrete: number; total: number }
  lucroLiquido: number; margemLucro: number; markupCusto: number
}

const CANAIS = [
  { key: 'shopee',       label: 'Shopee',          emoji: '🛍️' },
  { key: 'mercadolivre', label: 'Mercado Livre',    emoji: '🟡' },
  { key: 'amazon',       label: 'Amazon',           emoji: '📦' },
  { key: 'tiktokshop',   label: 'TikTok Shop',      emoji: '🎵' },
  { key: 'elo7',         label: 'Elo7',             emoji: '🎨' },
  { key: 'magalu',       label: 'Magalu',           emoji: '🛒' },
  { key: 'direta',       label: 'Venda Direta',     emoji: '🤝' },
]

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function pct(n: number) { return (n * 100).toFixed(1) + '%' }

export default function CalcularPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading]   = useState(true)

  // Modo: produto cadastrado ou manual
  const [modo, setModo]               = useState<'produto' | 'manual'>('produto')
  const [produtoId, setProdutoId]     = useState('')
  const [variacaoId, setVariacaoId]   = useState('')
  const [custoManual, setCustoManual] = useState('')
  const [preco, setPreco]             = useState('')
  const [canal, setCanal]             = useState('shopee')

  // Opções por canal
  const [freteGratis, setFreteGratis]         = useState(false)
  const [tipoML, setTipoML]                   = useState<'classico'|'premium'>('classico')
  const [planoAmazon, setPlanoAmazon]         = useState<'individual'|'profissional'>('individual')
  const [exposicaoElo7, setExposicaoElo7]     = useState<'padrao'|'maxima'>('padrao')
  const [taxaDireta, setTaxaDireta]           = useState('2.99')

  const [resultado, setResultado]     = useState<Resultado | null>(null)
  const [calculando, setCalculando]   = useState(false)
  const [calcTodos, setCalcTodos]     = useState(false)
  const [resultadosTodos, setResultadosTodos] = useState<Resultado[]>([])

  useEffect(() => {
    fetch('/api/precificacao/produtos').then(r => r.json()).then(d => {
      setProdutos(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const prodSelecionado = produtos.find(p => p.id === produtoId)
  const varSelecionada  = prodSelecionado?.variacoes.find(v => v.id === variacaoId)
  const custoFinal      = modo === 'produto' ? (varSelecionada ? Number(varSelecionada.custoTotal) : null) : (custoManual ? Number(custoManual) : null)

  function buildOpcoes() {
    if (canal === 'shopee' || canal === 'tiktokshop') return { freteGratis }
    if (canal === 'mercadolivre') return { tipo: tipoML }
    if (canal === 'amazon') return { plano: planoAmazon }
    if (canal === 'elo7') return { exposicao: exposicaoElo7 }
    if (canal === 'direta') return { taxaTransacao: Number(taxaDireta) / 100 }
    return {}
  }

  async function calcular(canalTarget?: string) {
    if (!custoFinal || !preco) return alert('Informe o custo e o preço de venda')
    setCalculando(true)
    try {
      const res = await fetch('/api/precificacao/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custoTotal: custoFinal, precoVenda: preco, canal: canalTarget || canal, opcoes: buildOpcoes() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado(data)
    } catch (e: any) { alert(e.message) }
    finally { setCalculando(false) }
  }

  async function calcularTodos() {
    if (!custoFinal || !preco) return alert('Informe o custo e o preço de venda')
    setCalculando(true)
    try {
      const resultados = await Promise.all(
        CANAIS.map(c =>
          fetch('/api/precificacao/calcular', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custoTotal: custoFinal, precoVenda: preco, canal: c.key, opcoes: buildOpcoes() })
          }).then(r => r.json())
        )
      )
      setResultadosTodos(resultados)
      setCalcTodos(true)
    } catch (e: any) { alert(e.message) }
    finally { setCalculando(false) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Calculadora de Preços</h1>
        <p className="text-gray-500 text-sm mt-1">Simule o lucro por canal de venda considerando todas as taxas atualizadas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel esquerdo — inputs */}
        <div className="space-y-4">
          {/* Modo */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Origem do custo</p>
            <div className="flex gap-2 mb-4">
              {[{ k: 'produto', l: 'Produto cadastrado' }, { k: 'manual', l: 'Inserir manualmente' }].map(m => (
                <button key={m.k} onClick={() => setModo(m.k as any)}
                  className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors ${modo === m.k ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {m.l}
                </button>
              ))}
            </div>

            {modo === 'produto' ? (
              loading ? <p className="text-gray-400 text-sm">Carregando produtos...</p> : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Produto</label>
                    <select value={produtoId} onChange={e => { setProdutoId(e.target.value); setVariacaoId('') }} className={inputClass}>
                      <option value="">Selecionar produto...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sku ? `(${p.sku})` : ''}</option>)}
                    </select>
                  </div>
                  {prodSelecionado && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Variação (kit)</label>
                      <select value={variacaoId} onChange={e => setVariacaoId(e.target.value)} className={inputClass}>
                        <option value="">Selecionar variação...</option>
                        {prodSelecionado.variacoes.map(v => (
                          <option key={v.id} value={v.id}>{v.qtdKit} unidades — custo R$ {Number(v.custoTotal).toFixed(2)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {varSelecionada && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                      Custo total: <strong>R$ {Number(varSelecionada.custoTotal).toFixed(2)}</strong>
                      {' · '}Custo/un: <strong>R$ {(Number(varSelecionada.custoTotal)/varSelecionada.qtdKit).toFixed(4)}</strong>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Custo total do produto (R$) *</label>
                <input type="number" step="0.01" value={custoManual} onChange={e => setCustoManual(e.target.value)} className={inputClass} placeholder="Ex: 29.32" />
              </div>
            )}
          </div>

          {/* Preço e Canal */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Preço de venda (R$) *</label>
              <input type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} className={inputClass} placeholder="Ex: 99.00" />
            </div>

            {/* Canal */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Canal de venda</label>
              <div className="grid grid-cols-2 gap-2">
                {CANAIS.map(c => (
                  <button key={c.key} onClick={() => { setCanal(c.key); setResultado(null); setCalcTodos(false) }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${canal === c.key ? 'bg-orange-500 text-white border-orange-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <span>{c.emoji}</span>{c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opções por canal */}
            {(canal === 'shopee' || canal === 'tiktokshop') && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={freteGratis} onChange={e => setFreteGratis(e.target.checked)} className="accent-orange-500" />
                Participar do programa de frete grátis (+6%)
              </label>
            )}
            {canal === 'mercadolivre' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de anúncio</label>
                <select value={tipoML} onChange={e => setTipoML(e.target.value as any)} className={inputClass}>
                  <option value="classico">Clássico (12% comissão)</option>
                  <option value="premium">Premium (16% comissão)</option>
                </select>
              </div>
            )}
            {canal === 'amazon' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Plano</label>
                <select value={planoAmazon} onChange={e => setPlanoAmazon(e.target.value as any)} className={inputClass}>
                  <option value="individual">Individual (+ R$2,00/item)</option>
                  <option value="profissional">Profissional (R$19/mês)</option>
                </select>
              </div>
            )}
            {canal === 'elo7' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Exposição</label>
                <select value={exposicaoElo7} onChange={e => setExposicaoElo7(e.target.value as any)} className={inputClass}>
                  <option value="padrao">Padrão (18% + R$3,99)</option>
                  <option value="maxima">Máxima (20% + R$3,99)</option>
                </select>
              </div>
            )}
            {canal === 'direta' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Taxa de transação (%)</label>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" value={taxaDireta} onChange={e => setTaxaDireta(e.target.value)} className={inputClass} placeholder="Ex: 2.99" />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Defina a taxa da sua operadora (Mercado Pago, PagSeguro, Stone, etc.)</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => calcular()} disabled={calculando}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
                {calculando ? 'Calculando...' : 'Calcular'}
              </button>
              <button onClick={calcularTodos} disabled={calculando}
                className="flex-1 border border-orange-300 text-orange-600 hover:bg-orange-50 font-medium py-2.5 rounded-lg disabled:opacity-50 text-sm">
                Comparar todos os canais
              </button>
            </div>
          </div>
        </div>

        {/* Painel direito — resultado */}
        <div>
          {!resultado && !calcTodos && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">🧮</p>
              <p>Preencha os dados e clique em Calcular</p>
            </div>
          )}

          {/* Resultado canal único */}
          {resultado && !calcTodos && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{CANAIS.find(c => c.key === resultado.canal)?.emoji}</span>
                <h3 className="font-bold text-gray-800 text-lg">{CANAIS.find(c => c.key === resultado.canal)?.label}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Preço de venda</p>
                  <p className="font-bold text-gray-800 text-lg">{fmt(resultado.preco)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Custo total</p>
                  <p className="font-bold text-red-600 text-lg">{fmt(resultado.custo)}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Comissão ({pct(resultado.taxa.comissaoPerc)})</span>
                  <span className="text-red-500">- {fmt(resultado.preco * resultado.taxa.comissaoPerc)}</span>
                </div>
                {resultado.taxa.taxaFixa > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Taxa fixa por item</span>
                    <span className="text-red-500">- {fmt(resultado.taxa.taxaFixa)}</span>
                  </div>
                )}
                {resultado.taxa.taxaFrete > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Taxa de frete grátis</span>
                    <span className="text-red-500">- {fmt(resultado.taxa.taxaFrete)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span className="text-gray-600">Total de taxas</span>
                  <span className="text-red-600">- {fmt(resultado.taxa.total)}</span>
                </div>
              </div>

              <div className={`rounded-xl p-4 ${resultado.lucroLiquido >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs font-medium text-gray-500 mb-1">Lucro líquido</p>
                <p className={`text-3xl font-bold ${resultado.lucroLiquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(resultado.lucroLiquido)}
                </p>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-xs text-gray-400">Margem</p>
                    <p className={`font-semibold text-sm ${resultado.margemLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pct(resultado.margemLucro)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Markup s/ custo</p>
                    <p className={`font-semibold text-sm ${resultado.markupCusto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pct(resultado.markupCusto)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparativo todos os canais */}
          {calcTodos && resultadosTodos.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Comparativo — {fmt(Number(preco))}</h3>
                <p className="text-xs text-gray-400">Custo: {fmt(custoFinal || 0)}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {[...resultadosTodos]
                  .sort((a, b) => b.lucroLiquido - a.lucroLiquido)
                  .map(r => {
                    const c = CANAIS.find(x => x.key === r.canal)
                    return (
                      <div key={r.canal} className={`flex items-center justify-between px-5 py-3 ${r.lucroLiquido < 0 ? 'bg-red-50/40' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span>{c?.emoji}</span>
                          <span className="text-sm font-medium text-gray-700">{c?.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-xs text-gray-400">Taxas</p>
                            <p className="text-xs text-red-500 font-medium">- {fmt(r.taxa.total)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Lucro</p>
                            <p className={`font-bold text-sm ${r.lucroLiquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(r.lucroLiquido)}</p>
                          </div>
                          <div className="w-14">
                            <p className="text-xs text-gray-400">Margem</p>
                            <p className={`font-semibold text-sm ${r.margemLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pct(r.margemLucro)}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
