'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Interfaces ────────────────────────────────────────────────
interface Config {
  id: string; nome: string | null; tipo: 'UNITARIO' | 'KIT'; qtdKit: number
  custoTotal: number; impostos: number; precoVenda: number | null
  canal: string; subOpcao: string
  peso: number | null  // ← NOVO: peso em gramas para cálculo ML
}

interface Produto { id: string; sku: string | null; nome: string; categoria: string | null; configs: Config[] }

interface ComboItem { nomeProduto: string; qtd: number; custoUnit: number }
interface Combo {
  id: string; nome: string; descricao: string | null
  canal: string; subOpcao: string | null
  precoNormal: number; descontoPct: number; precoCombo: number
  itens: ComboItem[]
}

interface TarifaML {
  id: string
  pesoMin: number; pesoMax: number
  precoMin: number; precoMax: number | null
  taxaFixa: number
  isDefault?: boolean
}

// ── Faixas de peso e preço para exibição da matriz ───────────
const PESO_RANGES = [
  { label: 'até 300g',   min: 0,     max: 300    },
  { label: '300g–1kg',   min: 300,   max: 1000   },
  { label: '1–2kg',      min: 1000,  max: 2000   },
  { label: '2–5kg',      min: 2000,  max: 5000   },
  { label: '5–6kg',      min: 5000,  max: 6000   },
  { label: '6–10kg',     min: 6000,  max: 10000  },
  { label: '10–11kg',    min: 10000, max: 11000  },
  { label: '11kg+',      min: 11000, max: 999999 },
]

const PRECO_RANGES = [
  { label: 'até R$19',    min: 0,   max: 18.99 },
  { label: 'R$19–R$49',  min: 19,  max: 48.99 },
  { label: 'R$49–R$79',  min: 49,  max: 78.99 },
  { label: 'R$79–R$100', min: 79,  max: 99.99 },
  { label: 'R$100+',     min: 100, max: null   },
]

const CANAIS = [
  { key: 'shopee',  label: 'Shopee',        emoji: '🛍️' },
  { key: 'ml',      label: 'Mercado Livre', emoji: '🟡' },
  { key: 'amazon',  label: 'Amazon',        emoji: '📦' },
  { key: 'tiktok',  label: 'TikTok Shop',   emoji: '🎵' },
  { key: 'magalu',  label: 'Magalu',        emoji: '🛒' },
  { key: 'direta',  label: 'Venda Direta',  emoji: '🤝' },
]

// ── Funções auxiliares ────────────────────────────────────────

function getTaxa(canal: string, sub: string, preco: number) {
  if (canal === 'shopee') {
    if (preco < 8)   return { taxa: 0.50, fixo: 0 }
    if (preco < 80)  return { taxa: 0.20, fixo: 4.00 }
    if (preco < 100) return { taxa: 0.14, fixo: 16.00 }
    if (preco < 200) return { taxa: 0.14, fixo: 20.00 }
    return             { taxa: 0.14, fixo: 26.00 }
  }
  // ML: taxa de comissão só — fixo_canal vem da matriz de peso
  if (canal === 'ml')     return sub === 'premium' ? { taxa: 0.16, fixo: 0 } : { taxa: 0.12, fixo: 0 }
  if (canal === 'amazon') return { taxa: 0.15, fixo: 2.00 }
  if (canal === 'tiktok') return { taxa: 0.06, fixo: 4.00 }
  if (canal === 'magalu') return { taxa: 0.10, fixo: 0 }
  return { taxa: 0.03, fixo: 0 }
}

// Lookup da taxa fixa ML na matriz peso × preço
function lookupTaxaFixaML(peso: number, preco: number, tarifas: TarifaML[]): number {
  const t = tarifas.find(t =>
    peso >= Number(t.pesoMin) && peso < Number(t.pesoMax) &&
    preco >= Number(t.precoMin) && (t.precoMax === null || preco <= Number(t.precoMax))
  )
  return t ? Number(t.taxaFixa) : 0
}

// Cálculo padrão (não-ML)
function calcPreco(custo: number, aliqPct: number, margem: number, taxa: number, fixo: number): number | null {
  const denom = 1 - taxa - (aliqPct / 100) - margem
  if (denom <= 0) return null
  return (custo + fixo) / denom
}

// ── Solver iterativo para ML (resolve referência circular) ────
// A taxa fixa do ML depende do preço, que depende da taxa fixa.
// Convergência em 3-5 iterações para produtos típicos de artesanato.
function solvePrecoML(
  custo: number,
  peso: number | null,
  taxa: number,
  aliqPct: number,
  margem: number,
  tarifas: TarifaML[]
): number | null {
  const denom = 1 - taxa - (aliqPct / 100) - margem
  if (denom <= 0) return null

  // Sem peso configurado: calcula sem taxa fixa (aviso aparece na UI)
  if (!peso || peso <= 0) return custo / denom

  // Estimativa inicial: sem taxa fixa
  let p = custo / denom

  for (let i = 0; i < 20; i++) {
    const fixo = lookupTaxaFixaML(peso, p, tarifas)
    const pNew = (custo + fixo) / denom
    if (Math.abs(pNew - p) < 0.005) { p = pNew; break }
    p = pNew
  }
  return p
}

function fmtBRL(n: number) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function canalLabel(canal: string) {
  const c = CANAIS.find(x => x.key === canal.toLowerCase())
  return c ? `${c.emoji} ${c.label}` : canal
}

// Monta chave da célula na matriz editável
function matrizKey(wi: number, pi: number) { return `${wi}_${pi}` }

// ─────────────────────────────────────────────────────────────
export default function CanaisPage() {
  const [produtos, setProdutos]   = useState<Produto[]>([])
  const [combos,   setCombos]     = useState<Combo[]>([])
  const [loading,  setLoading]    = useState(true)
  const [busca,    setBusca]      = useState('')
  const [prodSel,  setProdSel]    = useState<string>('todos')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [aba,      setAba]        = useState<'produtos' | 'combos'>('produtos')

  // ── Tarifas ML — inicializa com defaults embutidos (sobrescreve com API se customizado)
  const [tarifasML,    setTarifasML]    = useState<TarifaML[]>(() => PESO_RANGES.flatMap((pr, wi) =>
    PRECO_RANGES.map((pp, pi) => ({
      id: `default_${wi}_${pi}`,
      pesoMin: pr.min, pesoMax: pr.max,
      precoMin: pp.min, precoMax: pp.max,
      taxaFixa: [
        [5.65,6.55,7.75,12.35,14.00],
        [5.90,6.75,7.95,13.25,15.00],
        [6.25,6.95,8.15,14.45,18.00],
        [6.45,7.50,9.00,19.00,24.00],
        [6.65,8.55,9.95,25.45,30.00],
        [6.85,9.05,10.45,33.00,38.00],
        [7.05,9.55,10.95,41.25,48.00],
        [7.50,10.50,12.00,50.00,58.00],
      ][wi][pi],
    }))
  ))
  const [isDefault,    setIsDefault]    = useState(true)
  const [modalTarifas, setModalTarifas] = useState(false)
  const [editMatrix,   setEditMatrix]   = useState<Record<string, string>>({})
  const [salvando,     setSalvando]     = useState(false)
  const [msgSalvo,     setMsgSalvo]     = useState('')

  // ── Load ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [dataProds, dataCombos, dataTarifas] = await Promise.all([
      fetch('/api/precificacao/produtos').then(r => r.json()).catch(() => []),
      fetch('/api/precificacao/combos').then(r => r.json()).catch(() => []),
      fetch('/api/precificacao/canal-tarifas-ml').then(r => r.json()).catch(() => ({ tarifas: [], isDefault: true })),
    ])

    const prods = (Array.isArray(dataProds) ? dataProds : []).map((p: any) => ({
      ...p,
      configs: (p.variacoes || []).map((v: any) => ({
        ...v,
        nome:     v.nome     || null,
        tipo:     v.tipo     || 'UNITARIO',
        canal:    v.canal    || 'shopee',
        subOpcao: v.subOpcao || 'classico',
        peso:     v.peso ? Number(v.peso) : null,   // ← inclui peso
      }))
    }))
    setProdutos(prods)

    const cbs = (Array.isArray(dataCombos) ? dataCombos : []).map((c: any) => ({
      id: c.id, nome: c.nome, descricao: c.descricao || null,
      canal: c.canal || 'shopee', subOpcao: c.subOpcao || null,
      precoNormal: Number(c.precoNormal || 0),
      descontoPct: Number(c.descontoPct || 0),
      precoCombo:  Number(c.precoCombo  || 0),
      itens: (c.itens || []).map((i: any) => ({
        nomeProduto: i.nomeProduto,
        qtd:         Number(i.qtd      || 1),
        custoUnit:   Number(i.custoUnit || 0),
      })),
    }))
    setCombos(cbs)

    const tarifas = dataTarifas?.tarifas || []
    // Só sobrescreve os defaults se a API retornou dados reais do banco
    if (tarifas.length > 0) setTarifasML(tarifas)
    setIsDefault(dataTarifas?.isDefault ?? true)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Abre modal e inicializa matriz editável ───────────────
  function abrirModalTarifas() {
    const matrix: Record<string, string> = {}
    PESO_RANGES.forEach((pr, wi) => {
      PRECO_RANGES.forEach((pp, pi) => {
        // Busca primeiro nas tarifas carregadas (banco ou defaults da API)
        const t = tarifasML.find(t =>
          Number(t.pesoMin) === pr.min && Number(t.pesoMax) === pr.max &&
          Number(t.precoMin) === pp.min &&
          (pp.max === null ? t.precoMax === null : Number(t.precoMax) === pp.max)
        )
        matrix[matrizKey(wi, pi)] = t ? String(t.taxaFixa) : ''
      })
    })
    setEditMatrix(matrix)
    setMsgSalvo('')
    setModalTarifas(true)
  }

  async function salvarTarifas() {
    setSalvando(true)
    try {
      const tarifas = PESO_RANGES.flatMap((pr, wi) =>
        PRECO_RANGES.map((pp, pi) => ({
          pesoMin:  pr.min,
          pesoMax:  pr.max,
          precoMin: pp.min,
          precoMax: pp.max,
          taxaFixa: parseFloat(editMatrix[matrizKey(wi, pi)] || '0') || 0,
        }))
      )
      const res = await fetch('/api/precificacao/canal-tarifas-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', tarifas }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgSalvo('✅ ' + data.mensagem)
        await load()
      } else {
        setMsgSalvo('❌ Erro ao salvar')
      }
    } catch {
      setMsgSalvo('❌ Erro de conexão')
    } finally {
      setSalvando(false)
    }
  }

  async function restaurarPadroes() {
    if (!confirm('Restaurar os valores padrão do ML (tabela oficial março/2026)?\nSeus valores customizados serão perdidos.')) return
    setSalvando(true)
    try {
      const res = await fetch('/api/precificacao/canal-tarifas-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgSalvo('✅ ' + data.mensagem)
        await load()
        setModalTarifas(false)
      }
    } catch {
      setMsgSalvo('❌ Erro ao restaurar')
    } finally {
      setSalvando(false)
    }
  }

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

  // ─────────────────────────────────────────────────────────
  // Há algum produto com canal ML configurado?
  const temProdutoML = produtos.some(p => p.configs.some(c => c.canal === 'ml'))

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Canais de Venda</h1>
          <p className="text-gray-500 text-sm mt-1">Compare o preço ideal em todos os canais com cenários de margem baixa, saudável e alta.</p>
        </div>
        {/* Botão Tarifas ML — só aparece se houver produto com canal ML */}
        {temProdutoML && (
          <button onClick={abrirModalTarifas}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-700 text-xs font-medium hover:bg-yellow-100 transition whitespace-nowrap">
            🟡 Tarifas ML
            {isDefault && (
              <span className="bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">Padrão</span>
            )}
          </button>
        )}
      </div>

      {/* Abas Produtos / Combos */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setAba('produtos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${aba === 'produtos' ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'}`}>
          Produtos ({produtos.filter(p => p.configs.length > 0).length})
        </button>
        <button onClick={() => setAba('combos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${aba === 'combos' ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'}`}>
          Combos ({combos.length})
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-64 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        {aba === 'produtos' && (
          <select value={prodSel} onChange={e => setProdSel(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
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

      {/* ── Aviso tarifas padrão — só aparece se houver produto ML ── */}
      {temProdutoML && isDefault && (
        <div className="mb-4 flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
          <span className="text-lg">🟡</span>
          <div>
            <strong>Tarifas ML usando valores padrão (março/2026).</strong>{' '}
            Se o ML atualizou as tarifas, clique em{' '}
            <button onClick={abrirModalTarifas} className="underline font-medium">Tarifas ML</button>{' '}
            para personalizar ou restaurar.
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400 dark:bg-gray-800 dark:border-gray-700">Carregando...</div>
      ) : aba === 'produtos' ? (

        /* ── ABA PRODUTOS ─────────────────────────────────── */
        produtosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400 dark:bg-gray-800 dark:border-gray-700">Nenhum produto encontrado.</div>
        ) : (
          <div className="space-y-4">
            {produtosFiltrados.map(produto => (
              <div key={produto.id} className="bg-white rounded-xl border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 rounded-xl"
                  onClick={() => toggleExpand(produto.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">{expanded.has(produto.id) ? '▼' : '▶'}</span>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-white">{produto.nome}</p>
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
                  const peso       = config.peso

                  return (
                    <div key={config.id} className="border-t border-gray-50 dark:border-gray-700 px-5 pb-5">
                      <div className="flex flex-wrap items-center gap-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.tipo === 'KIT' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {config.tipo === 'KIT' ? '🎁 Kit' : '📦 Unitário'} · {config.qtdKit} un
                        </span>
                        {config.nome && <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{config.nome}</span>}
                        <span className="text-xs text-gray-500">Custo: <strong>{fmtBRL(custo)}</strong></span>
                        {aliqPct > 0 && <span className="text-xs text-gray-500">Impostos: <strong>{aliqPct}%</strong></span>}
                        {precoAtual && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">Preço atual: {fmtBRL(precoAtual)}</span>}
                        {/* Peso para cálculo ML */}
                        {peso && peso > 0
                          ? <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">⚖️ {peso >= 1000 ? `${(peso/1000).toFixed(2)}kg` : `${peso}g`}</span>
                          : <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full cursor-pointer" title="Sem peso cadastrado: cálculo ML sem taxa fixa">⚠️ ML: sem peso</span>
                        }
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {CANAIS.map(canal => {
                          const subOpcoes = canal.key === 'ml'
                            ? [{ key: 'classico', label: 'Clássico' }, { key: 'premium', label: 'Premium' }]
                            : [{ key: '', label: '' }]

                          return subOpcoes.map(sub => {
                            // ── cálculo por canal ──────────────────────────
                            const { taxa } = getTaxa(canal.key, sub.key, 50)

                            let pBaixo:    number | null
                            let pSaudavel: number | null
                            let pAlto:     number | null
                            let taxaFixoLabel: string
                            let margemAtual: number | null = null

                            if (canal.key === 'ml') {
                              // Solver iterativo ML (referência circular)
                              pBaixo    = solvePrecoML(custo, peso, taxa, aliqPct, 0.15, tarifasML)
                              pSaudavel = solvePrecoML(custo, peso, taxa, aliqPct, 0.30, tarifasML)
                              pAlto     = solvePrecoML(custo, peso, taxa, aliqPct, 0.45, tarifasML)

                              // Taxa fixa exibida (baseada no preço saudável)
                              const fixoRef = peso && pSaudavel ? lookupTaxaFixaML(peso, pSaudavel, tarifasML) : 0
                              taxaFixoLabel = `${(taxa * 100).toFixed(0)}% + ${fmtBRL(fixoRef)} (peso/preço)`

                              // Margem atual
                              if (precoAtual) {
                                const fixoAtual = peso ? lookupTaxaFixaML(peso, precoAtual, tarifasML) : 0
                                const lucro = precoAtual - custo - precoAtual * taxa - fixoAtual - precoAtual * (aliqPct / 100)
                                margemAtual = (lucro / precoAtual) * 100
                              }
                            } else {
                              // Cálculo padrão para outros canais
                              const refPreco = precoAtual || calcPreco(custo, aliqPct, 0.30, 0.20, 4) || 50
                              const { taxa: t, fixo: f } = getTaxa(canal.key, sub.key, refPreco)
                              pBaixo    = calcPreco(custo, aliqPct, 0.15, t, f)
                              pSaudavel = calcPreco(custo, aliqPct, 0.30, t, f)
                              pAlto     = calcPreco(custo, aliqPct, 0.45, t, f)
                              taxaFixoLabel = `${(t * 100).toFixed(0)}%${f > 0 ? ` + R$${f.toFixed(2)}` : ''}`

                              if (precoAtual) {
                                const { taxa: tt, fixo: ff } = getTaxa(canal.key, sub.key, precoAtual)
                                const lucro = precoAtual - custo - precoAtual * tt - ff - precoAtual * (aliqPct / 100)
                                margemAtual = (lucro / precoAtual) * 100
                              }
                            }

                            const cLabel = sub.label ? `${canal.label} ${sub.label}` : canal.label

                            return (
                              <div key={`${canal.key}-${sub.key}`}
                                className={`border rounded-xl p-3 hover:border-gray-200 transition-colors ${canal.key === 'ml' && (!peso || peso <= 0) ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{canal.emoji}</span>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{cLabel}</p>
                                      <p className="text-xs text-gray-400">Taxa: {taxaFixoLabel}</p>
                                    </div>
                                  </div>
                                  {margemAtual !== null && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${margemAtual >= 35 ? 'bg-green-50 text-green-700' : margemAtual >= 20 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                                      {margemAtual.toFixed(1)}% atual
                                    </span>
                                  )}
                                </div>

                                {/* Aviso ML sem peso */}
                                {canal.key === 'ml' && (!peso || peso <= 0) && (
                                  <p className="text-[10px] text-yellow-600 bg-yellow-50 rounded px-2 py-1 mb-2">
                                    ⚠️ Cadastre o peso do produto para cálculo preciso das tarifas ML
                                  </p>
                                )}

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
        /* ── ABA COMBOS ───────────────────────────────────── */
        combosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400 dark:bg-gray-800 dark:border-gray-700">
            {combos.length === 0 ? 'Nenhum combo cadastrado. Crie combos em Precificação → Combos.' : 'Nenhum combo encontrado.'}
          </div>
        ) : (
          <div className="space-y-4">
            {combosFiltrados.map(combo => {
              const custoTotal   = combo.itens.reduce((s, i) => s + i.custoUnit * i.qtd, 0)
              const economiaReais = combo.precoNormal - combo.precoCombo

              return (
                <div key={combo.id} className="bg-white rounded-xl border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50 rounded-xl"
                    onClick={() => toggleExpand(combo.id)}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{expanded.has(combo.id) ? '▼' : '▶'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 dark:text-white">{combo.nome}</p>
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
                    <div className="border-t border-gray-50 dark:border-gray-700 px-5 pb-5">
                      <div className="py-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Composição do combo</p>
                        <div className="space-y-1 mb-4">
                          {combo.itens.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                              <span>{item.qtd}x {item.nomeProduto}</span>
                              <span className="text-gray-400">{fmtBRL(item.custoUnit * item.qtd)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-semibold text-gray-700 dark:text-gray-200 border-t border-gray-100 pt-2 mt-2">
                            <span>Custo total estimado</span>
                            <span>{fmtBRL(custoTotal)}</span>
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Análise no canal {canalLabel(combo.canal)}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                            <p className="text-xs text-orange-600 font-medium mb-1">Preço do combo</p>
                            <p className="text-xl font-bold text-orange-700">{fmtBRL(combo.precoCombo)}</p>
                            <p className="text-xs text-orange-500 mt-0.5">Desconto de {combo.descontoPct}%</p>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 dark:bg-gray-700 dark:border-gray-600">
                            <p className="text-xs text-gray-500 font-medium mb-1">Preço separado</p>
                            <p className="text-xl font-bold text-gray-600 dark:text-gray-200">{fmtBRL(combo.precoNormal)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Sem desconto combo</p>
                          </div>
                          {(() => {
                            const canal = combo.canal.toLowerCase()
                            const { taxa, fixo } = getTaxa(canal, combo.subOpcao || '', combo.precoCombo)
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

      {/* ══════════════════════════════════════════════════════
          Modal — Tabela de Tarifas ML (peso × preço)
      ══════════════════════════════════════════════════════ */}
      {modalTarifas && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-auto py-8 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl">

            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  🟡 Tarifas Mercado Livre — por Peso × Preço
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Taxa fixa cobrada pelo ML conforme o peso e a faixa de preço do produto.
                  Atualizada em <strong>março/2026</strong>. Edite as células quando o ML mudar.
                </p>
              </div>
              <button onClick={() => setModalTarifas(false)}
                className="text-gray-400 hover:text-gray-600 text-xl ml-4">✕</button>
            </div>

            {/* Explicação */}
            <div className="px-6 pt-4 pb-2">
              <div className="flex gap-3 flex-wrap text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <span>💡 <strong>Como funciona:</strong> o VPS calcula o preço ideal para cada cenário de margem usando um solver iterativo — resolve a referência circular onde a taxa fixa depende do preço e o preço depende da taxa fixa.</span>
              </div>
            </div>

            {/* Matriz editável */}
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 bg-gray-50 dark:bg-gray-700 rounded-tl-lg font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 min-w-[90px]">
                      Peso \ Preço
                    </th>
                    {PRECO_RANGES.map((pr, pi) => (
                      <th key={pi} className="p-2 bg-yellow-50 border border-yellow-200 text-yellow-800 font-semibold text-center min-w-[80px]">
                        {pr.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PESO_RANGES.map((pr, wi) => (
                    <tr key={wi}>
                      <td className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-semibold text-gray-600 dark:text-gray-300">
                        {pr.label}
                      </td>
                      {PRECO_RANGES.map((pp, pi) => {
                        const key = matrizKey(wi, pi)
                        return (
                          <td key={pi} className="p-1 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 text-[10px]">R$</span>
                              <input
                                type="number" step="0.01" min="0"
                                value={editMatrix[key] ?? ''}
                                onChange={e => setEditMatrix(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-yellow-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-gray-400 mt-2">
                * Valores em R$ por venda. Fonte: tabela oficial ML março/2026, reputação verde, Mercado Envios 1 (logística própria).
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button onClick={restaurarPadroes} disabled={salvando}
                  className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  🔄 Restaurar padrões ML (março/2026)
                </button>
                {msgSalvo && (
                  <span className={`text-xs font-medium ${msgSalvo.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                    {msgSalvo}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setModalTarifas(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={salvarTarifas} disabled={salvando}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium">
                  {salvando ? 'Salvando...' : 'Salvar tarifas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
