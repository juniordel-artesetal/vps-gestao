'use client'
import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Search, RefreshCw, Save } from 'lucide-react'

interface VariacaoConfig {
  variacaoId: string
  produtoNome: string
  canal: string
  tipo: string
  subOpcao: string | null
  sku: string | null
  custoTotal: number
  valorPorItem: number   // configurado para freelancer
  updatedAt: string | null
}

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CANAL_LABEL: Record<string, string> = {
  shopee: 'Shopee', ml: 'Mercado Livre', elo7: 'Elo7',
  tiktok: 'TikTok Shop', amazon: 'Amazon', magalu: 'Magalu',
  direta: 'Venda Direta', outro: 'Outro',
}

export default function ConfigPagamentoPage() {
  const [variacoes, setVariacoes] = useState<VariacaoConfig[]>([])
  const [loading, setLoading]     = useState(true)
  const [busca, setBusca]         = useState('')
  const [salvando, setSalvando]   = useState<Set<string>>(new Set())
  const [valores, setValores]     = useState<Record<string, string>>({})
  const [salvos, setSalvos]       = useState<Set<string>>(new Set())

  const carregar = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/demandas/config-pagamento')
    const data = await res.json()
    const lista = Array.isArray(data) ? data : []
    setVariacoes(lista)
    const init: Record<string, string> = {}
    lista.forEach((v: VariacaoConfig) => {
      init[v.variacaoId] = v.valorPorItem > 0 ? String(v.valorPorItem) : ''
    })
    setValores(init)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleSalvar(variacaoId: string, nomeProduto: string) {
    setSalvando(prev => new Set(prev).add(variacaoId))
    const val = parseFloat(valores[variacaoId] || '0') || 0
    await fetch('/api/demandas/config-pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variacaoId, nomeProduto, valorPorItem: val }),
    })
    setSalvando(prev => { const s = new Set(prev); s.delete(variacaoId); return s })
    setSalvos(prev => new Set(prev).add(variacaoId))
    setTimeout(() => setSalvos(prev => { const s = new Set(prev); s.delete(variacaoId); return s }), 2000)
  }

  const filtradas = variacoes.filter(v =>
    !busca ||
    v.produtoNome.toLowerCase().includes(busca.toLowerCase()) ||
    (v.sku || '').toLowerCase().includes(busca.toLowerCase()) ||
    v.canal.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-orange-500" />Configuração de Pagamento
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Defina o valor por item que cada produto paga ao freelancer
          </p>
        </div>
        <button onClick={carregar}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl px-4 py-3 mb-5">
        <p className="text-sm text-orange-700 dark:text-orange-300">
          💡 Os valores configurados aqui são preenchidos automaticamente ao criar uma demanda para este produto.
          Você ainda pode alterar o valor manualmente em cada demanda.
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white"
            placeholder="Buscar produto, SKU ou canal..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando produtos...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {variacoes.length === 0
              ? 'Nenhum produto ativo na precificação.'
              : 'Nenhum produto encontrado com este filtro.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">Canal</th>
                  <th className="px-4 py-3 text-left">Variação</th>
                  <th className="px-4 py-3 text-right">Custo total</th>
                  <th className="px-4 py-3 text-right w-40">R$ por item (freelancer)</th>
                  <th className="px-4 py-3 text-center w-24">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/40">
                {filtradas.map(v => (
                  <tr key={v.variacaoId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{v.produtoNome}</div>
                      {v.sku && <div className="text-xs text-gray-400">{v.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {CANAL_LABEL[v.canal] || v.canal}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {v.tipo}{v.subOpcao ? ` · ${v.subOpcao}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                      {fmtR(v.custoTotal)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                        <input
                          type="number" step="0.01" min="0"
                          className={`w-full pl-8 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 text-right ${
                            salvos.has(v.variacaoId)
                              ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:ring-green-400'
                              : 'border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-orange-400'
                          }`}
                          placeholder="0,00"
                          value={valores[v.variacaoId] || ''}
                          onChange={e => setValores(p => ({ ...p, [v.variacaoId]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleSalvar(v.variacaoId, `${v.produtoNome} · ${v.canal} · ${v.tipo}`)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {salvos.has(v.variacaoId) ? (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Salvo</span>
                      ) : (
                        <button
                          onClick={() => handleSalvar(v.variacaoId, `${v.produtoNome} · ${v.canal} · ${v.tipo}`)}
                          disabled={salvando.has(v.variacaoId)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50 mx-auto">
                          <Save className="w-3 h-3" />
                          {salvando.has(v.variacaoId) ? '...' : 'Salvar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
