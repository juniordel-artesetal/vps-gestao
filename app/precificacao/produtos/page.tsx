'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Material { id: string; nome: string; precoUnidade: number; unidade: string }
interface MatLinha { materialId: string | null; nomeMaterial: string; qtdUsada: number; custoUnit: number; rendimento: number }
interface Embalagem { id: string; nome: string; custoTotal: number }
interface Config {
  id: string; isKit: boolean; qtdKit: number
  custoMaoObra: number; custoEmbalagem: number; custoArte: number
  custoTotal: number; impostos: number
  precoVenda: number | null
  canal: string; subOpcao: string
  materiais: MatLinha[]
}
interface Produto { id: string; sku: string | null; nome: string; categoria: string | null; configs: Config[] }

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

// ── Fórmulas ──────────────────────────────────────────────────────────────────
// preço = (custoUnit + fixo) / (1 - taxa - aliq% - margem)
// imposto incide sobre PREÇO DE VENDA
function sugerirPreco(custoUnit: number, aliqPct: number, margem: number, taxa = 0.20, fixo = 4) {
  const d = 1 - taxa - (aliqPct / 100) - margem
  if (d <= 0) return null
  return (custoUnit + fixo) / d
}
function fmtR(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// ── Canais ────────────────────────────────────────────────────────────────────
const CANAIS_LISTA = [
  { key: 'shopee', label: 'Shopee',        subs: null },
  { key: 'ml',     label: 'Mercado Livre', subs: [{ key: 'classico', label: 'Clássico (12%)' }, { key: 'premium', label: 'Premium (16%)' }] },
  { key: 'amazon', label: 'Amazon',        subs: null },
  { key: 'tiktok', label: 'TikTok Shop',   subs: null },
  { key: 'elo7',   label: 'Elo7',          subs: [{ key: 'padrao', label: 'Padrão (18%)' }, { key: 'maxima', label: 'Máxima (20%)' }] },
  { key: 'magalu', label: 'Magalu',        subs: null },
  { key: 'direta', label: 'Venda Direta',  subs: null },
]
function getTaxa(canal: string, sub: string, preco: number): { taxa: number; fixo: number; label: string } {
  if (canal === 'shopee') {
    // Taxas Shopee 2026 CNPJ — por faixa de preço do item
    if (preco < 8)   return { taxa: 0.50, fixo: 0,     label: 'Shopee Faixa 1 (<R$8) · 50%' }
    if (preco < 80)  return { taxa: 0.20, fixo: 4.00,  label: 'Shopee Faixa 2 (R$8–79) · 20%+R$4' }
    if (preco < 100) return { taxa: 0.14, fixo: 16.00, label: 'Shopee Faixa 3 (R$80–99) · 14%+R$16' }
    if (preco < 200) return { taxa: 0.14, fixo: 20.00, label: 'Shopee Faixa 4 (R$100–199) · 14%+R$20' }
    return             { taxa: 0.14, fixo: 26.00, label: 'Shopee Faixa 5 (≥R$200) · 14%+R$26' }
  }
  if (canal === 'ml')     return sub === 'premium' ? { taxa: 0.16, fixo: 0, label: 'ML Premium · 16%' } : { taxa: 0.12, fixo: 0, label: 'ML Clássico · 12%' }
  if (canal === 'amazon') return { taxa: 0.12, fixo: 2.00, label: 'Amazon · 12%+R$2' }
  if (canal === 'tiktok') return { taxa: 0.06, fixo: 2.00, label: 'TikTok · 6%+R$2' }
  if (canal === 'elo7')   return sub === 'maxima' ? { taxa: 0.20, fixo: 3.99, label: 'Elo7 Máxima · 20%+R$3,99' } : { taxa: 0.18, fixo: 3.99, label: 'Elo7 Padrão · 18%+R$3,99' }
  if (canal === 'magalu') return { taxa: 0.10, fixo: 0, label: 'Magalu · 10%' }
  return { taxa: 0.03, fixo: 0, label: 'Venda Direta · 3%' }
}

// ── Config vazia ──────────────────────────────────────────────────────────────
const EMPTY: {
  isKit: boolean; qtdKit: string; canal: string; subOpcao: string
  tipoMaoObra: 'local'|'freelancer'; custoMaoObra: string
  tipoArte: 'local'|'freelancer'; custoArte: string
  custoEmbalagem: string
  custosAdicionais: { descricao: string; valor: string }[]
  impostos: string; precoVenda: string
  emPromo: boolean; descontoPct: string
  materiais: MatLinha[]
  embalagemId: string
} = {
  isKit: false, qtdKit: '1', canal: 'shopee', subOpcao: 'classico',
  tipoMaoObra: 'local', custoMaoObra: '',
  tipoArte: 'local', custoArte: '',
  custoEmbalagem: '',
  custosAdicionais: [],
  impostos: '', precoVenda: '',
  emPromo: false, descontoPct: '',
  materiais: [],
  embalagemId: '',
}

export default function ProdutosPage() {
  const [produtos, setProdutos]         = useState<Produto[]>([])
  const [matCad, setMatCad]             = useState<Material[]>([])
  const [loading, setLoading]           = useState(true)
  const [busca, setBusca]               = useState('')
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [showProd, setShowProd]         = useState(false)
  const [editProdId, setEditProdId]     = useState<string | null>(null)
  const [prodForm, setProdForm]         = useState({ nome: '', sku: '', categoria: '' })
  const [savingProd, setSavingProd]     = useState(false)
  const [showConf, setShowConf]         = useState<string | null>(null)
  const [editConfId, setEditConfId]     = useState<string | null>(null)
  const [conf, setConf]                 = useState({ ...EMPTY })
  const [savingConf, setSavingConf]     = useState(false)
  const [novoMatIdx, setNovoMatIdx]     = useState<number | null>(null)
  const [novoMatForm, setNovoMatForm]   = useState({ nome: '', unidade: 'unidade', precoPacote: '', qtdPacote: '', fornecedor: '' })
  const [savingNovoMat, setSavingNovo]  = useState(false)
  const [aliqPadrao, setAliqPadrao]     = useState<number | null>(null)
  const [matModo, setMatModo]           = useState<('direto'|'proporcional')[]>([])
  const [embalagens, setEmbalagens]     = useState<Embalagem[]>([])
  const [confirmDelId, setConfirmDelId]   = useState<string | null>(null)
  const [copiandoId, setCopiandoId]       = useState<string | null>(null)
  const [showMassa, setShowMassa]         = useState(false)
  const [massaTexto, setMassaTexto]       = useState('')
  const [massaCategoria, setMassaCategoria] = useState('')
  const [salvandoMassa, setSalvandoMassa] = useState(false)
  const [massaResult, setMassaResult]     = useState<{ criados: number; erros: string[] } | null>(null)
  const [copiandoConfId, setCopiandoConfId] = useState<string | null>(null)
  const [showHistorico, setShowHistorico] = useState(false)
  const [historico, setHistorico]         = useState<any[]>([])
  const [loadingHist, setLoadingHist]     = useState(false)
  const [showMassaConf, setShowMassaConf] = useState<string | null>(null) // produtoId
  const [massaConfCanais, setMassaConfCanais] = useState<string[]>([])
  const [salvandoMassaConf, setSalvandoMassaConf] = useState(false)
  const [massaConfBase, setMassaConfBase] = useState<Config | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, m, trib, emb] = await Promise.all([
      fetch('/api/precificacao/produtos').then(r => r.json()).catch(() => []),
      fetch('/api/precificacao/materiais').then(r => r.json()).catch(() => []),
      fetch('/api/precificacao/config-tributos').then(r => r.json()).catch(() => null),
      fetch('/api/precificacao/embalagens').then(r => r.json()).catch(() => []),
    ])
    if (trib?.aliquotaPadrao) setAliqPadrao(Number(trib.aliquotaPadrao))
    setEmbalagens(Array.isArray(emb) ? emb : [])
    const prods = (Array.isArray(p) ? p : []).map((prod: any) => ({
      ...prod,
      configs: (prod.variacoes || []).map((v: any) => ({
        ...v,
        isKit: v.isKit ?? (v.tipo === 'KIT'),
        canal: v.canal || 'shopee',
        subOpcao: v.subOpcao || 'classico',
        materiais: v.materiais || [],
      }))
    }))
    setProdutos(prods)
    setMatCad(Array.isArray(m) ? m : [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // ── Cálculos em tempo real ────────────────────────────────────────────────
  const qtdKit = Math.max(Number(conf.qtdKit) || 1, 1)
  // Custo dos materiais: (qtd × custo/un ÷ rendimento) × qtdKit se for kit
  const custoMatUnit  = conf.materiais.reduce((s, m) => {
    const rend = Math.max(Number(m.rendimento) || 1, 0.0001)
    return s + (Number(m.qtdUsada) * Number(m.custoUnit)) / rend
  }, 0)
  const custoMatTotal = custoMatUnit * (conf.isKit ? qtdKit : 1)
  // Mão de obra e arte: por unidade, multiplicam pelo kit (igual aos materiais)
  const custoMaoObraUnit  = Number(conf.custoMaoObra || 0)
  const custoArteUnit     = Number(conf.custoArte || 0)
  const custoMaoObraTotal = custoMaoObraUnit * (conf.isKit ? qtdKit : 1)
  const custoArteTotal    = custoArteUnit    * (conf.isKit ? qtdKit : 1)
  const custoFixo         = custoMaoObraTotal + Number(conf.custoEmbalagem || 0) + custoArteTotal
  const custoAdicional    = conf.custosAdicionais.reduce((s, c) => s + Number(c.valor || 0), 0)
  const custoLote         = custoMatTotal + custoFixo + custoAdicional
  const custoUnitVenda= conf.isKit ? custoLote / qtdKit : custoLote  // custo para precificar

  const aliqPct  = Number(conf.impostos || 0)
  // Kit: preço é do KIT INTEIRO (canal cobra fixo 1x por venda)
  // Unitário: preço é por unidade = custoLote
  const custoPreco = custoLote  // sempre usa custo total (kit ou unitário)
  const precoRef   = Number(conf.precoVenda) || sugerirPreco(custoPreco, aliqPct, 0.30) || 10
  const canalSel   = getTaxa(conf.canal, conf.subOpcao, precoRef)
  const pBaixo     = sugerirPreco(custoPreco, aliqPct, 0.15, canalSel.taxa, canalSel.fixo)
  const pSaudavel  = sugerirPreco(custoPreco, aliqPct, 0.30, canalSel.taxa, canalSel.fixo)
  const pAlto      = sugerirPreco(custoPreco, aliqPct, 0.45, canalSel.taxa, canalSel.fixo)

  // ── Handlers produto ──────────────────────────────────────────────────────
  async function saveProd() {
    if (!prodForm.nome) return alert('Nome obrigatório')
    setSavingProd(true)
    try {
      const url = editProdId ? `/api/precificacao/produtos/${editProdId}` : '/api/precificacao/produtos'
      const res = await fetch(url, { method: editProdId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prodForm) })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowProd(false); load()
    } catch (e: any) { alert(e.message) }
    finally { setSavingProd(false) }
  }
  async function deleteProd(id: string) {
    await fetch(`/api/precificacao/produtos/${id}`, { method: 'DELETE' })
    setConfirmDelId(null)
    load()
  }

  async function copiarProd(id: string) {
    setCopiandoId(id)
    try {
      const res = await fetch(`/api/precificacao/produtos/${id}/copiar`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      load()
    } catch (e: any) { alert(e.message) }
    finally { setCopiandoId(null) }
  }

  async function salvarMassa() {
    const linhas = massaTexto.split('\n').map((l: string) => l.trim()).filter(Boolean)
    if (!linhas.length) return alert('Digite ao menos um produto')
    setSalvandoMassa(true)
    try {
      const produtos = linhas.map(nome => ({ nome, categoria: massaCategoria.trim() || undefined }))
      const res = await fetch('/api/precificacao/produtos/massa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtos }),
      })
      const data = await res.json()
      setMassaResult({
        criados: data.total,
        erros: (data.erros || []).map((e: any) => e.nome),
      })
      load()
    } catch (e: any) { alert(e.message) }
    finally { setSalvandoMassa(false) }
  }

  // ── Handlers material ─────────────────────────────────────────────────────
  function addMat() {
    setConf(p => ({ ...p, materiais: [...p.materiais, { materialId: null, nomeMaterial: '', qtdUsada: 1, custoUnit: 0, rendimento: 1 }] }))
    setMatModo(p => [...p, 'direto'])
  }
  function selMat(idx: number, matId: string) {
    const mat = matCad.find(m => m.id === matId)
    setConf(p => {
      const u = [...p.materiais]
      u[idx] = { ...u[idx], materialId: matId, nomeMaterial: mat?.nome || '', custoUnit: Number(mat?.precoUnidade || 0) }
      return { ...p, materiais: u }
    })
  }
  function updateMat(idx: number, field: keyof MatLinha, val: any) {
    setConf(p => { const u = [...p.materiais]; u[idx] = { ...u[idx], [field]: val }; return { ...p, materiais: u } })
  }
  function removeMat(idx: number) {
    setConf(p => ({ ...p, materiais: p.materiais.filter((_, i) => i !== idx) }))
    setMatModo(p => p.filter((_, i) => i !== idx))
  }
  async function saveNovoMat(idx: number) {
    if (!novoMatForm.nome || !novoMatForm.precoPacote || !novoMatForm.qtdPacote) return alert('Preencha os campos obrigatórios')
    setSavingNovo(true)
    try {
      const res = await fetch('/api/precificacao/materiais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novoMatForm) })
      if (!res.ok) throw new Error((await res.json()).error)
      const { id } = await res.json()
      const precoUnit = Number(novoMatForm.precoPacote) / Number(novoMatForm.qtdPacote)
      const mats = await fetch('/api/precificacao/materiais').then(r => r.json()).catch(() => [])
      setMatCad(Array.isArray(mats) ? mats : [])
      setConf(p => { const u = [...p.materiais]; u[idx] = { ...u[idx], materialId: id, nomeMaterial: novoMatForm.nome, custoUnit: precoUnit }; return { ...p, materiais: u } })
      setNovoMatIdx(null)
      setNovoMatForm({ nome: '', unidade: 'unidade', precoPacote: '', qtdPacote: '', fornecedor: '' })
    } catch (e: any) { alert(e.message) }
    finally { setSavingNovo(false) }
  }

  // ── Salvar configuração ───────────────────────────────────────────────────
  async function saveConf(produtoId: string) {
    setSavingConf(true)
    try {
      const payload = {
        produtoId,
        tipo: conf.isKit ? 'KIT' : 'UNITARIO',
        isKit: conf.isKit,
        qtdKit: qtdKit,
        canal: conf.canal,
        subOpcao: conf.subOpcao,
        custoMaterial: custoMatTotal,
        custoMaoObra: custoMaoObraTotal,   // total do kit (não por unidade)
        custoEmbalagem: Number(conf.custoEmbalagem || 0),
        custoArte: custoArteTotal,          // total do kit (não por unidade)
        impostos: aliqPct,
        precoVenda: conf.precoVenda ? Number(conf.precoVenda) : null,
        emPromo: conf.emPromo,
        descontoPct: conf.descontoPct ? Number(conf.descontoPct) : null,
        materiais: conf.materiais,
        kitItens: [],
      }
      const url = editConfId ? `/api/precificacao/variacoes/${editConfId}` : '/api/precificacao/variacoes'
      const res = await fetch(url, { method: editConfId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowConf(null); setEditConfId(null); load()
    } catch (e: any) { alert(e.message) }
    finally { setSavingConf(false) }
  }
  async function deleteConf(id: string) {
    if (!confirm('Excluir esta configuração?')) return
    await fetch(`/api/precificacao/variacoes/${id}`, { method: 'DELETE' }); load()
  }
  async function carregarHistorico(confId: string) {
    setLoadingHist(true)
    setShowHistorico(true)
    try {
      const res = await fetch(`/api/precificacao/variacoes/${confId}/historico`)
      const data = await res.json()
      setHistorico(Array.isArray(data) ? data : [])
    } catch { setHistorico([]) }
    finally { setLoadingHist(false) }
  }

  async function copiarConf(c: Config, produtoId: string) {
    setCopiandoConfId(c.id)
    try {
      const payload = {
        produtoId,
        tipo: c.isKit ? 'KIT' : 'UNITARIO',
        isKit: c.isKit,
        qtdKit: c.qtdKit,
        canal: c.canal,
        subOpcao: c.subOpcao,
        custoMaterial: Number(c.custoTotal) - Number(c.custoMaoObra || 0) - Number(c.custoEmbalagem || 0) - Number(c.custoArte || 0),
        custoMaoObra: Number(c.custoMaoObra || 0),
        custoEmbalagem: Number(c.custoEmbalagem || 0),
        custoArte: Number(c.custoArte || 0),
        impostos: Number(c.impostos || 0),
        precoVenda: c.precoVenda ? Number(c.precoVenda) : null,
        emPromo: false,
        descontoPct: null,
        materiais: c.materiais.map(m => ({ ...m })),
        kitItens: [],
      }
      const res = await fetch('/api/precificacao/variacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      load()
    } catch (e: any) { alert(e.message) }
    finally { setCopiandoConfId(null) }
  }

  async function salvarMassaConf(produtoId: string) {
    if (!massaConfBase || massaConfCanais.length === 0) return alert('Selecione ao menos um canal')
    setSalvandoMassaConf(true)
    try {
      const canaisComSub: { canal: string; subOpcao: string }[] = massaConfCanais.map(k => {
        const [canal, subOpcao] = k.split('|')
        return { canal, subOpcao: subOpcao || 'classico' }
      })
      let criados = 0
      for (const { canal, subOpcao } of canaisComSub) {
        const payload = {
          produtoId,
          tipo: massaConfBase.isKit ? 'KIT' : 'UNITARIO',
          isKit: massaConfBase.isKit,
          qtdKit: massaConfBase.qtdKit,
          canal,
          subOpcao,
          custoMaterial: Number(massaConfBase.custoTotal) - Number(massaConfBase.custoMaoObra || 0) - Number(massaConfBase.custoEmbalagem || 0) - Number(massaConfBase.custoArte || 0),
          custoMaoObra: Number(massaConfBase.custoMaoObra || 0),
          custoEmbalagem: Number(massaConfBase.custoEmbalagem || 0),
          custoArte: Number(massaConfBase.custoArte || 0),
          impostos: Number(massaConfBase.impostos || 0),
          precoVenda: massaConfBase.precoVenda ? Number(massaConfBase.precoVenda) : null,
          emPromo: false,
          descontoPct: null,
          materiais: massaConfBase.materiais.map(m => ({ ...m })),
          kitItens: [],
        }
        const res = await fetch('/api/precificacao/variacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) criados++
      }
      alert(`${criados} configuração(ões) criada(s) com sucesso!`)
      setShowMassaConf(null)
      setMassaConfCanais([])
      setMassaConfBase(null)
      load()
    } catch (e: any) { alert(e.message) }
    finally { setSalvandoMassaConf(false) }
  }

  function openMassaConf(produtoId: string) {
    const prod = produtos.find(p => p.id === produtoId)
    const baseConf = prod?.configs?.[0] || null
    setMassaConfBase(baseConf)
    setMassaConfCanais([])
    setShowMassaConf(produtoId)
  }

  function toggleCanal(key: string) {
    setMassaConfCanais(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function openEditConf(c: Config, produtoId: string) {
    const embMatch = embalagens.find(em => Math.abs(em.custoTotal - Number(c.custoEmbalagem || 0)) < 0.001)
    setConf({
      isKit: c.isKit || false,
      qtdKit: String(c.qtdKit || 1),
      canal: c.canal || 'shopee',
      subOpcao: c.subOpcao || 'classico',
      tipoMaoObra: c.custoMaoObra > 0 ? 'freelancer' : 'local',
      custoMaoObra: String(c.custoMaoObra || ''),
      tipoArte: c.custoArte > 0 ? 'freelancer' : 'local',
      custoArte: String(c.custoArte || ''),
      custoEmbalagem: String(c.custoEmbalagem || ''),
      embalagemId: embMatch?.id || '',
      custosAdicionais: (c as any).custosAdicionais || [],
      impostos: String(c.impostos || ''),
      precoVenda: c.precoVenda ? String(c.precoVenda) : '',
      emPromo: (c as any).emPromo || false,
      descontoPct: (c as any).descontoPct ? String((c as any).descontoPct) : '',
      materiais: c.materiais.map(m => ({ ...m })),
    })
    setMatModo((c.materiais || []).map(() => 'direto' as const))
    setEditConfId(c.id); setShowConf(produtoId)
  }

  const filtered = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
          <p className="text-gray-500 text-sm mt-1">Cadastro de produtos com precificação integrada</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowMassa(true); setMassaTexto(''); setMassaCategoria(''); setMassaResult(null) }}
            className="border border-orange-300 text-orange-500 hover:bg-orange-50 text-sm font-semibold px-4 py-2 rounded-lg">
            📋 Cadastro em Massa
          </button>
          <button onClick={() => { setProdForm({ nome: '', sku: '', categoria: '' }); setEditProdId(null); setShowProd(true) }}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Novo Produto
          </button>
        </div>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..."
        className={inputClass + ' max-w-sm mb-4'} />

      {/* ── Modal produto ── */}
      {showProd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editProdId ? 'Editar' : 'Novo'} Produto</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                <input value={prodForm.nome} onChange={e => setProdForm(p => ({ ...p, nome: e.target.value }))}
                  className={inputClass} placeholder="Ex: Cofrinho Personalizado" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>
                  <input value={prodForm.sku} onChange={e => setProdForm(p => ({ ...p, sku: e.target.value }))}
                    className={inputClass} placeholder="Opcional" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
                  <input value={prodForm.categoria} onChange={e => setProdForm(p => ({ ...p, categoria: e.target.value }))}
                    className={inputClass} placeholder="Ex: Laços" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveProd} disabled={savingProd}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
                {savingProd ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setShowProd(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal configuração ── */}
      {showConf && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

            {/* Header sticky */}
            <div className="sticky top-0 bg-white rounded-t-2xl px-6 pt-5 pb-4 border-b border-gray-100 z-10">
              <h2 className="text-lg font-bold text-gray-800 mb-3">{editConfId ? 'Editar' : 'Nova'} Configuração</h2>

              {/* Toggle Kit */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">🎁 É um Kit?</p>
                  <p className="text-xs text-gray-400">Ativa multiplicação dos materiais pela quantidade do kit</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={conf.isKit}
                    onChange={e => setConf(p => ({ ...p, isKit: e.target.checked, qtdKit: e.target.checked ? (p.qtdKit || '2') : '1' }))} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-orange-400 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                </label>
              </div>

              {/* Qtd do kit */}
              {conf.isKit && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Quantidade no kit:</label>
                  <input type="number" min="2" step="1" value={conf.qtdKit}
                    onChange={e => setConf(p => ({ ...p, qtdKit: e.target.value }))}
                    className={inputClass + ' max-w-28 font-bold text-orange-600'} />
                  <span className="text-xs text-gray-400">unidades</span>
                </div>
              )}
            </div>

            <div className="p-6 space-y-5">

              {/* Canal de venda */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Canal de venda</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <select value={conf.canal}
                      onChange={e => setConf(p => ({ ...p, canal: e.target.value, subOpcao: 'classico' }))}
                      className={inputClass}>
                      {CANAIS_LISTA.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  {CANAIS_LISTA.find(c => c.key === conf.canal)?.subs && (
                    <div className="flex-1">
                      <select value={conf.subOpcao}
                        onChange={e => setConf(p => ({ ...p, subOpcao: e.target.value }))}
                        className={inputClass}>
                        {CANAIS_LISTA.find(c => c.key === conf.canal)?.subs?.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Materiais */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">
                    Materiais
                    <span className="text-xs text-gray-400 font-normal ml-2">
                      (por unidade{conf.isKit ? ` × ${qtdKit} = kit` : ''})
                    </span>
                  </p>
                  <button onClick={addMat} className="text-xs text-orange-500 hover:underline font-medium">
                    + Adicionar material
                  </button>
                </div>

                {conf.materiais.length === 0 && (
                  <p className="text-xs text-gray-400 italic px-1 mb-2">Nenhum material adicionado.</p>
                )}

                {conf.materiais.map((m, i) => {
                  const custoLinha = (Number(m.qtdUsada) * Number(m.custoUnit)) / Math.max(Number(m.rendimento) || 1, 0.0001)
                  return (
                    <div key={i} className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {/* Linha 1: seletor */}
                      <div className="flex gap-2 items-end mb-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-0.5">Material</label>
                          <select value={m.materialId || ''} onChange={e => selMat(i, e.target.value)} className={inputClass}>
                            <option value="">Selecionar...</option>
                            {matCad.map(mc => (
                              <option key={mc.id} value={mc.id}>
                                {mc.nome} — R${Number(mc.precoUnidade).toFixed(2)}/{mc.unidade}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button onClick={() => removeMat(i)} className="text-red-400 hover:text-red-600 text-lg pb-1 flex-shrink-0">✕</button>
                      </div>

                      {/* Toggle modo direto / proporcional */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-400">Modo:</span>
                        <button type="button"
                          onClick={() => setMatModo(p => { const u = [...p]; u[i] = 'direto'; return u })}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${(matModo[i] || 'direto') === 'direto' ? 'bg-orange-100 border-orange-400 text-orange-700 font-semibold' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                          Qtd direta
                        </button>
                        <button type="button"
                          onClick={() => setMatModo(p => { const u = [...p]; u[i] = 'proporcional'; return u })}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${(matModo[i] || 'direto') === 'proporcional' ? 'bg-blue-100 border-blue-400 text-blue-700 font-semibold' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                          ÷ Proporcional
                        </button>
                      </div>

                      {/* Linha 2: campos numéricos */}
                      <div className="grid grid-cols-3 gap-2">
                        {(matModo[i] || 'direto') === 'proporcional' ? (
                          <>
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-400 mb-0.5">
                                Cabe quantos itens por unidade?
                              </label>
                              <input
                                type="number" step="1" min="1" inputMode="numeric"
                                value={m.rendimento || ''}
                                onChange={e => {
                                  const n = parseFloat(e.target.value) || 0
                                  setConf(p => {
                                    const u = [...p.materiais]
                                    u[i] = { ...u[i], rendimento: n || 1, qtdUsada: 1 }
                                    return { ...p, materiais: u }
                                  })
                                }}
                                className={inputClass} placeholder="Ex: 6 apliques por folha" />
                              {m.rendimento > 1 && (
                                <p className="text-xs text-blue-600 mt-1">
                                  Proporcional: <strong>1 ÷ {m.rendimento} = {(1/m.rendimento).toFixed(4)}</strong> por item
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-0.5">R$/uni</label>
                              <input
                                type="number" step="0.01" inputMode="decimal"
                                value={m.custoUnit === 0 ? '' : Number(m.custoUnit).toFixed(2)}
                                onChange={e => updateMat(i, 'custoUnit', parseFloat(e.target.value) || 0)}
                                className={inputClass} placeholder="0.00" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs text-gray-400 mb-0.5">Qtd usada</label>
                              <input
                                type="number" step="any" inputMode="decimal"
                                value={m.qtdUsada === 0 ? '' : m.qtdUsada}
                                onChange={e => updateMat(i, 'qtdUsada', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                className={inputClass} placeholder="1" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-0.5">R$/uni</label>
                              <input
                                type="number" step="0.01" inputMode="decimal"
                                value={m.custoUnit === 0 ? '' : Number(m.custoUnit).toFixed(2)}
                                onChange={e => updateMat(i, 'custoUnit', parseFloat(e.target.value) || 0)}
                                className={inputClass} placeholder="0.00" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-0.5" title="Quantos produtos saem desta quantidade">
                                Rendimento
                              </label>
                              <input
                                type="number" step="any" inputMode="decimal"
                                value={m.rendimento === 1 ? '' : m.rendimento}
                                onChange={e => updateMat(i, 'rendimento', e.target.value === '' ? 1 : parseFloat(e.target.value) || 1)}
                                className={inputClass} placeholder="1" />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Custo desta linha */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {m.qtdUsada > 0 && m.custoUnit > 0 && (
                            <>
                              {fmtR(custoLinha)}/un
                              {conf.isKit && qtdKit > 1 && (
                                <span className="text-gray-400 ml-1">× {qtdKit} = {fmtR(custoLinha * qtdKit)} no kit</span>
                              )}
                            </>
                          )}
                        </span>
                        <button
                          onClick={() => { setNovoMatIdx(i); setNovoMatForm({ nome: '', unidade: 'unidade', precoPacote: '', qtdPacote: '', fornecedor: '' }) }}
                          className="text-xs text-orange-500 hover:underline">
                          + Novo material
                        </button>
                      </div>

                      {/* Mini-form novo material */}
                      {novoMatIdx === i && (
                        <div className="mt-3 p-3 bg-orange-50 rounded-xl border border-orange-100 space-y-2">
                          <p className="text-xs font-semibold text-orange-600">Cadastrar novo material</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <input value={novoMatForm.nome} onChange={e => setNovoMatForm(p => ({ ...p, nome: e.target.value }))}
                                className={inputClass} placeholder="Nome do material *" autoFocus />
                            </div>
                            <input type="number" step="0.01" value={novoMatForm.precoPacote}
                              onChange={e => setNovoMatForm(p => ({ ...p, precoPacote: e.target.value }))}
                              className={inputClass} placeholder="Preço do pacote *" />
                            <input type="number" step="1" value={novoMatForm.qtdPacote}
                              onChange={e => setNovoMatForm(p => ({ ...p, qtdPacote: e.target.value }))}
                              className={inputClass} placeholder="Qtd no pacote *" />
                            <select value={novoMatForm.unidade} onChange={e => setNovoMatForm(p => ({ ...p, unidade: e.target.value }))} className={inputClass}>
                              {['unidade', 'metros', 'gramas', 'folha', 'pacote', 'rolo', 'kg'].map(u => <option key={u}>{u}</option>)}
                            </select>
                            <input value={novoMatForm.fornecedor} onChange={e => setNovoMatForm(p => ({ ...p, fornecedor: e.target.value }))}
                              className={inputClass} placeholder="Fornecedor (opcional)" />
                          </div>
                          {novoMatForm.precoPacote && novoMatForm.qtdPacote && (
                            <p className="text-xs text-orange-500 font-medium">
                              R$/unidade: {fmtR(Number(novoMatForm.precoPacote) / Number(novoMatForm.qtdPacote))}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => saveNovoMat(i)} disabled={savingNovoMat}
                              className="flex-1 bg-orange-500 text-white text-xs font-semibold py-1.5 rounded-lg disabled:opacity-50">
                              {savingNovoMat ? '...' : 'Salvar e usar'}
                            </button>
                            <button onClick={() => setNovoMatIdx(null)}
                              className="flex-1 border text-gray-500 text-xs py-1.5 rounded-lg">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Custo materiais total */}
                {custoMatTotal > 0 && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
                    {conf.isKit
                      ? <>Custo materiais do kit ({qtdKit}×): <strong>{fmtR(custoMatTotal)}</strong> · por unidade: {fmtR(custoMatUnit)}</>
                      : <>Custo materiais: <strong>{fmtR(custoMatTotal)}</strong></>
                    }
                  </div>
                )}
              </div>

              {/* Custos fixos */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Custos Fixos</p>

                {/* Mão de obra */}
                <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Mão de obra</label>
                  <div className="flex gap-2 mb-2">
                    {(['local', 'freelancer'] as const).map(t => (
                      <button key={t} onClick={() => setConf(p => ({ ...p, tipoMaoObra: t, custoMaoObra: t === 'local' ? '0' : p.custoMaoObra }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${conf.tipoMaoObra === t ? 'bg-orange-50 border-orange-400 text-orange-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {t === 'local' ? '🏠 Local (gratuito)' : '👤 Freelancer'}
                      </button>
                    ))}
                  </div>
                  {conf.tipoMaoObra === 'freelancer' ? (
                    <div>
                      <input type="number" step="0.01" value={conf.custoMaoObra}
                        onChange={e => setConf(p => ({ ...p, custoMaoObra: e.target.value }))}
                        className={inputClass} placeholder="Valor por unidade (R$)" />
                      {conf.isKit && Number(conf.custoMaoObra) > 0 && (
                        <p className="text-xs text-orange-500 mt-1">
                          {fmtR(Number(conf.custoMaoObra))}/un × {qtdKit} = <strong>{fmtR(Number(conf.custoMaoObra) * qtdKit)} no kit</strong>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Mão de obra própria — R$ 0,00</p>
                  )}
                </div>

                {/* Arte */}
                <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Arte / Design</label>
                  <div className="flex gap-2 mb-2">
                    {(['local', 'freelancer'] as const).map(t => (
                      <button key={t} onClick={() => setConf(p => ({ ...p, tipoArte: t, custoArte: t === 'local' ? '0' : p.custoArte }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${conf.tipoArte === t ? 'bg-orange-50 border-orange-400 text-orange-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {t === 'local' ? '🏠 Local (gratuito)' : '👤 Freelancer'}
                      </button>
                    ))}
                  </div>
                  {conf.tipoArte === 'freelancer' ? (
                    <div>
                      <input type="number" step="0.01" value={conf.custoArte}
                        onChange={e => setConf(p => ({ ...p, custoArte: e.target.value }))}
                        className={inputClass} placeholder="Valor por unidade (R$)" />
                      {conf.isKit && Number(conf.custoArte) > 0 && (
                        <p className="text-xs text-orange-500 mt-1">
                          {fmtR(Number(conf.custoArte))}/un × {qtdKit} = <strong>{fmtR(Number(conf.custoArte) * qtdKit)} no kit</strong>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Arte própria — R$ 0,00</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Embalagem</label>
                    <select value={conf.embalagemId || ''}
                      onChange={e => {
                        const emb = embalagens.find(em => em.id === e.target.value)
                        setConf(p => ({
                          ...p,
                          embalagemId: e.target.value,
                          custoEmbalagem: emb ? String(emb.custoTotal) : '0',
                        }))
                      }}
                      className={inputClass + ' bg-white'}>
                      <option value="">Sem embalagem</option>
                      {embalagens.map(emb => (
                        <option key={emb.id} value={emb.id}>
                          {emb.nome} — {fmtR(emb.custoTotal)}
                        </option>
                      ))}
                    </select>
                    {conf.embalagemId && (
                      <p className="text-xs text-orange-500 mt-1">
                        Custo fixo: <strong>{fmtR(Number(conf.custoEmbalagem))}</strong> por venda
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-500">Outros custos</label>
                      <button onClick={() => setConf(p => ({ ...p, custosAdicionais: [...p.custosAdicionais, { descricao: '', valor: '' }] }))}
                        className="text-xs text-orange-500 hover:underline">+ Adicionar</button>
                    </div>
                    {conf.custosAdicionais.map((c, i) => (
                      <div key={i} className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <input value={c.descricao}
                          onChange={e => { const u = [...conf.custosAdicionais]; u[i] = { ...u[i], descricao: e.target.value }; setConf(p => ({ ...p, custosAdicionais: u })) }}
                          className={inputClass + ' mb-1.5'} placeholder="Descrição do custo (ex: embalagem especial)" />
                        <div className="flex gap-1">
                          <input type="number" step="0.01" value={c.valor}
                            onChange={e => { const u = [...conf.custosAdicionais]; u[i] = { ...u[i], valor: e.target.value }; setConf(p => ({ ...p, custosAdicionais: u })) }}
                            className={inputClass} placeholder="Valor R$" />
                          <button onClick={() => setConf(p => ({ ...p, custosAdicionais: p.custosAdicionais.filter((_, j) => j !== i) }))}
                            className="text-red-400 hover:text-red-600 text-lg px-2 flex-shrink-0">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custo total */}
              <div className={`rounded-xl px-4 py-3 border ${conf.isKit ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-semibold ${conf.isKit ? 'text-orange-700' : 'text-green-700'}`}>
                    {conf.isKit ? `🎁 Custo do kit (${qtdKit} unidades)` : '📦 Custo do produto'}
                  </span>
                  <span className={`text-xl font-bold ${conf.isKit ? 'text-orange-700' : 'text-green-700'}`}>
                    {fmtR(custoLote)}
                  </span>
                </div>
                {conf.isKit && (
                  <>
                    <div className="flex justify-between mt-2 pt-2 border-t border-orange-200">
                      <span className="text-xs text-orange-600 font-medium">💡 Custo por unidade (informativo)</span>
                      <span className="text-sm font-bold text-orange-600">{fmtR(custoUnitVenda)}</span>
                    </div>
                    <p className="text-xs text-orange-400 mt-1">
                      O preço de venda e margem são calculados sobre o kit completo
                    </p>
                  </>
                )}
              </div>

              {/* Impostos */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-gray-700">Impostos (%)</label>
                  <a href="/precificacao/oraculo" className="text-xs text-blue-500 hover:underline">💬 Oráculo Contábil</a>
                </div>
                <div className="flex gap-2 items-center">
                  <input type="number" step="0.1" min="0" max="100" value={conf.impostos}
                    onChange={e => setConf(p => ({ ...p, impostos: e.target.value }))}
                    className={inputClass} placeholder="Ex: 9 = 9% sobre o preço de venda" />
                  <span className="text-gray-500 font-bold flex-shrink-0">%</span>
                  {aliqPadrao && aliqPadrao > 0 && !conf.impostos && (
                    <button onClick={() => setConf(p => ({ ...p, impostos: String(aliqPadrao) }))}
                      className="flex-shrink-0 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-lg whitespace-nowrap">
                      Usar {aliqPadrao}%
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Percentual sobre o preço de venda</p>
              </div>

              {/* Sugestões de preço */}
              {custoLote > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">
                      Sugestões de preço
                      <span className="text-xs text-gray-400 font-normal ml-1">
                        ({conf.isKit ? `kit ${qtdKit}un` : 'por unidade'} · clique para usar)
                      </span>
                    </p>
                    <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{canalSel.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Margem baixa',    m: 0.15, val: pBaixo,    cor: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
                      { label: 'Margem saudável', m: 0.30, val: pSaudavel, cor: 'border-green-200 bg-green-50 text-green-800'   },
                      { label: 'Margem alta',     m: 0.45, val: pAlto,     cor: 'border-blue-200 bg-blue-50 text-blue-800'      },
                    ].map(({ label, m, val, cor }) => (
                      <button key={label}
                        onClick={() => val && setConf(p => ({ ...p, precoVenda: val.toFixed(2) }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all hover:opacity-80 active:scale-95 ${cor} ${conf.precoVenda === val?.toFixed(2) ? 'ring-2 ring-orange-400' : ''}`}>
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="font-bold text-base mt-1">{val ? fmtR(val) : '—'}</p>
                        <div className="mt-1.5 pt-1.5 border-t border-current border-opacity-20">
                          <p className="text-xs font-bold">{(m * 100).toFixed(0)}% · {val ? fmtR(val * m) : '—'}</p>
                          <p className="text-xs opacity-60">lucro bruto</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Preço de venda */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Preço de venda <span className="text-orange-400 ml-1">← selecione uma sugestão ou digite</span>
                    </label>
                    <input type="number" step="0.01" value={conf.precoVenda}
                      onChange={e => setConf(p => ({ ...p, precoVenda: e.target.value }))}
                      className={inputClass + ' font-bold text-green-700'} placeholder="0,00" />

                    {conf.precoVenda && custoLote > 0 && (() => {
                      const p     = Number(conf.precoVenda)
                      const impR  = p * (aliqPct / 100)
                      const taxR  = p * canalSel.taxa + canalSel.fixo
                      const lucro = p - custoLote - impR - taxR
                      const pct   = (lucro / p) * 100
                      const cor   = pct >= 25 ? 'text-green-600 bg-green-50 border-green-200'
                                  : pct >= 15 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
                                  : 'text-red-600 bg-red-50 border-red-200'
                      return (
                        <div className={`mt-2 px-3 py-2 rounded-xl border ${cor}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs font-medium opacity-70">Lucro com {canalSel.label}</p>
                              <p className="text-xs opacity-50">
                                {fmtR(p)} − {fmtR(custoLote)} (custo) − {fmtR(impR)} ({aliqPct}%) − {fmtR(taxR)} (canal)
                              </p>
                            </div>
                            <div className="text-right ml-3 flex-shrink-0">
                              <p className="font-bold text-lg">{pct.toFixed(1)}%</p>
                              <p className="text-sm font-semibold">{fmtR(lucro)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Promoção */}
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={conf.emPromo}
                    onChange={e => setConf(p => ({ ...p, emPromo: e.target.checked }))}
                    className="accent-orange-500 w-4 h-4" />
                  <span className="text-sm font-semibold text-gray-700">🏷️ Produto em promoção</span>
                </label>
                {conf.emPromo && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Desconto (%)</label>
                        <input type="number" step="0.1" min="0" max="99" value={conf.descontoPct}
                          onChange={e => setConf(p => ({ ...p, descontoPct: e.target.value }))}
                          className={inputClass} placeholder="Ex: 20" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Preço promocional</label>
                        <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-orange-600 bg-white">
                          {conf.descontoPct && conf.precoVenda
                            ? fmtR(Number(conf.precoVenda) * (1 - Number(conf.descontoPct) / 100))
                            : '—'}
                        </div>
                      </div>
                    </div>
                    {conf.descontoPct && conf.precoVenda && (() => {
                      const pp   = Number(conf.precoVenda) * (1 - Number(conf.descontoPct) / 100)
                      const impR = pp * (aliqPct / 100)
                      const taxR = pp * canalSel.taxa + canalSel.fixo
                      const luc  = pp - custoLote - impR - taxR
                      const pct  = (luc / pp) * 100
                      const cor  = pct >= 20 ? 'text-green-600' : pct >= 10 ? 'text-yellow-600' : 'text-red-500'
                      return (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs">
                          <p className="font-semibold text-orange-700 mb-1">Margem na promoção</p>
                          <p className={`font-bold text-base ${cor}`}>{pct.toFixed(1)}% · {fmtR(luc)}</p>
                          <p className="text-gray-500">{fmtR(pp)} − {fmtR(custoUnitVenda)} − {fmtR(impR)} − {fmtR(taxR)}</p>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => saveConf(showConf!)} disabled={savingConf}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {savingConf ? 'Salvando...' : 'Salvar Configuração'}
                </button>
                <button onClick={() => { setShowConf(null); setEditConfId(null) }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cadastro em Massa ── */}
      {showMassa && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Cadastro em Massa</h2>
            <p className="text-sm text-gray-500 mb-4">Digite um produto por linha. Máximo 100 por vez.</p>
            {massaResult ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <p className="text-green-700 font-semibold">✅ {massaResult.criados} produto(s) criado(s) com sucesso!</p>
                </div>
                {massaResult.erros.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-red-600 font-semibold mb-1">❌ Erros ({massaResult.erros.length}):</p>
                    {massaResult.erros.map(e => <p key={e} className="text-xs text-red-500">{e}</p>)}
                  </div>
                )}
                <button onClick={() => setShowMassa(false)}
                  className="w-full bg-orange-500 text-white font-semibold py-2 rounded-lg hover:bg-orange-600">
                  Fechar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categoria (opcional — aplicada a todos)</label>
                  <input value={massaCategoria} onChange={e => setMassaCategoria(e.target.value)}
                    placeholder="Ex: Laços, Cofrinhos..." className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Produtos (um por linha) *</label>
                  <textarea value={massaTexto} onChange={e => setMassaTexto(e.target.value)}
                    rows={8} placeholder="Cofrinho Personalizado Simples&#10;Cofrinho Personalizado Luxo&#10;Laço de Cetim Grande" 
                    className={inputClass + ' resize-none font-mono text-xs'} />
                  <p className="text-xs text-gray-400 mt-1">
                    {massaTexto.split('\n').filter((l: string) => l.trim()).length} produto(s) detectado(s)
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={salvarMassa} disabled={salvandoMassa || !massaTexto.trim()}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
                    {salvandoMassa ? 'Criando...' : 'Criar Produtos'}
                  </button>
                  <button onClick={() => setShowMassa(false)}
                    className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lista de produtos ── */}
      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          {busca ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado ainda.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(prod => (
            <div key={prod.id} className="bg-white rounded-xl border border-gray-100">
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer"
                onClick={() => setExpanded(expanded === prod.id ? null : prod.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{expanded === prod.id ? '▼' : '▶'}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{prod.nome}</p>
                    <p className="text-xs text-gray-400">
                      {prod.sku && <span className="font-mono mr-2">{prod.sku}</span>}
                      {prod.categoria && <span className="bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full mr-2">{prod.categoria}</span>}
                      <span>{prod.configs?.length || 0} configuração(ões)</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={e => { e.stopPropagation(); setProdForm({ nome: prod.nome, sku: prod.sku || '', categoria: prod.categoria || '' }); setEditProdId(prod.id); setShowProd(true) }}
                    className="text-xs text-blue-500 hover:underline px-2">Editar</button>
                  <button onClick={e => { e.stopPropagation(); copiarProd(prod.id) }}
                    disabled={copiandoId === prod.id}
                    className="text-xs text-orange-500 hover:underline px-2 disabled:opacity-50">
                    {copiandoId === prod.id ? '...' : '📋 Copiar'}
                  </button>
                  {confirmDelId === prod.id ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <span className="text-xs text-red-600 font-medium">Confirmar?</span>
                      <button onClick={e => { e.stopPropagation(); deleteProd(prod.id) }}
                        className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600">Sim</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDelId(null) }}
                        className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-50">Não</button>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmDelId(prod.id) }}
                      className="text-xs text-red-500 hover:underline px-2">Excluir</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); setConf({ ...EMPTY }); setEditConfId(null); setMatModo([]); setShowConf(prod.id) }}
                    className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600">
                    + Configuração
                  </button>
                </div>
              </div>

              {expanded === prod.id && (
                <div className="border-t border-gray-50 overflow-x-auto">
                  {(!prod.configs || prod.configs.length === 0) ? (
                    <p className="px-5 py-4 text-gray-400 text-sm">Nenhuma configuração ainda.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs">
                          <th className="px-4 py-2 text-left text-gray-500">Tipo</th>
                          <th className="px-4 py-2 text-center text-gray-500">Qtd</th>
                          <th className="px-4 py-2 text-right text-gray-500">Custo/un</th>
                          <th className="px-4 py-2 text-right text-gray-500">Impostos</th>
                          <th className="px-4 py-2 text-right text-gray-500">Preço venda</th>
                          <th className="px-4 py-2 text-right text-gray-500">Preço c/ Desconto</th>
                          <th className="px-4 py-2 text-right text-gray-500">Margem</th>
                          <th className="px-4 py-2 text-center text-gray-500">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prod.configs.map(c => {
                          const qtd = Math.max(Number(c.qtdKit) || 1, 1)
                          const custoUn = Number(c.custoTotal) // custo total do kit/unidade — não dividir por qtd (precoVenda já é do kit inteiro)
                          const aliq = Number(c.impostos || 0)
                          const p = c.precoVenda ? Number(c.precoVenda) : null
                          const pp = (c as any).emPromo && (c as any).descontoPct && p
                            ? p * (1 - Number((c as any).descontoPct) / 100)
                            : ((c as any).precoPromocional ? Number((c as any).precoPromocional) : null)
                          const canal = getTaxa(c.canal || 'shopee', c.subOpcao || 'classico', p || 0)
                          const lucroR = p ? p - custoUn - p * (aliq / 100) - (p * canal.taxa + canal.fixo) : null
                          const pct = p && lucroR !== null ? (lucroR / p) * 100 : null
                          const cor = pct === null ? 'text-gray-300' : pct >= 25 ? 'text-green-600' : pct >= 15 ? 'text-yellow-600' : 'text-red-500'
                          return (
                            <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/40">
                              <td className="px-4 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.isKit ? 'bg-orange-50 text-orange-700' : 'bg-orange-50 text-orange-600'}`}>
                                  {c.isKit ? `🎁 Kit ${qtd}un` : '📦 Unitário'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center text-gray-600">{qtd}</td>
                              <td className="px-4 py-2.5 text-right text-gray-600">{fmtR(custoUn)}</td>
                              <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{aliq > 0 ? `${aliq}%` : '—'}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-green-700">{p ? fmtR(p) : '—'}</td>
                              <td className="px-4 py-2.5 text-right">
                                {pp ? (
                                  <div>
                                    <div className="text-sm font-bold text-orange-600">{fmtR(pp)}</div>
                                    {(c as any).descontoPct && (
                                      <div className="inline-flex items-center gap-0.5 bg-orange-50 text-orange-500 text-xs font-semibold px-1.5 py-0.5 rounded-full mt-0.5">
                                        -{(c as any).descontoPct}% off
                                      </div>
                                    )}
                                  </div>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {pct !== null
                                  ? <div className={`text-xs font-semibold ${cor}`}><div>{pct.toFixed(1)}%</div><div>{lucroR !== null ? fmtR(lucroR) : ''}</div></div>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex gap-2 justify-center">
                                  <button onClick={() => openEditConf(c, prod.id)} className="text-xs text-blue-500 hover:underline">Editar</button>
                                  <button onClick={() => copiarConf(c, prod.id)} disabled={copiandoConfId === c.id}
                                    className="text-xs text-orange-500 hover:underline disabled:opacity-50">
                                    {copiandoConfId === c.id ? '...' : '📋 Copiar'}
                                  </button>
                                  <button onClick={() => carregarHistorico(c.id)} className="text-xs text-gray-400 hover:underline">Histórico</button>
                                  <button onClick={() => deleteConf(c.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* ── Modal Histórico de Alterações ── */}
      {showHistorico && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-800">Histórico de Alterações</h2>
              <button onClick={() => setShowHistorico(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-4">
              {loadingHist ? (
                <p className="text-center text-gray-400 py-8">Carregando...</p>
              ) : historico.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Nenhuma alteração registrada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {historico.map((h: any) => (
                    <div key={h.id} className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700">{h.campo}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(h.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-red-50 text-red-500 px-2 py-0.5 rounded line-through">{h.valorAntes ?? '—'}</span>
                        <span className="text-gray-400">→</span>
                        <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium">{h.valorDepois ?? '—'}</span>
                      </div>
                      {h.usuarioNome && <p className="text-xs text-gray-400 mt-1">por {h.usuarioNome}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Configurações em Massa ── */}
      {showMassaConf && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Configurações em Massa</h2>
            <p className="text-sm text-gray-500 mb-4">
              Cria configurações para múltiplos canais usando os custos da primeira configuração existente como base.
            </p>
            {massaConfBase ? (
              <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-600">
                <p className="font-semibold">Base: {massaConfBase.isKit ? `Kit ${massaConfBase.qtdKit}un` : 'Unitário'}</p>
                <p>Custo total: {fmtR(Number(massaConfBase.custoTotal))} · Impostos: {massaConfBase.impostos}%</p>
              </div>
            ) : (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
                ⚠️ Nenhuma configuração base encontrada. Crie uma configuração primeiro.
              </div>
            )}
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Selecione os canais</p>
            <div className="grid grid-cols-1 gap-1 mb-4">
                  <label key="shopee|classico" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('shopee|classico')} onChange={() => toggleCanal('shopee|classico')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🛒 Shopee (até R$79,99 · 20%+R$4)</span>
                  </label>
                  <label key="ml|classico" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('ml|classico')} onChange={() => toggleCanal('ml|classico')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🟡 ML Clássico (12%)</span>
                  </label>
                  <label key="ml|premium" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('ml|premium')} onChange={() => toggleCanal('ml|premium')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🟡 ML Premium (16%)</span>
                  </label>
                  <label key="amazon|classico" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('amazon|classico')} onChange={() => toggleCanal('amazon|classico')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">📦 Amazon (12%+R$2)</span>
                  </label>
                  <label key="tiktok|classico" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('tiktok|classico')} onChange={() => toggleCanal('tiktok|classico')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🎵 TikTok Shop (6%+R$2)</span>
                  </label>
                  <label key="elo7|padrao" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('elo7|padrao')} onChange={() => toggleCanal('elo7|padrao')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🎨 Elo7 Padrão (18%+R$3,99)</span>
                  </label>
                  <label key="elo7|maxima" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('elo7|maxima')} onChange={() => toggleCanal('elo7|maxima')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🎨 Elo7 Máxima (20%+R$3,99)</span>
                  </label>
                  <label key="magalu|classico" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('magalu|classico')} onChange={() => toggleCanal('magalu|classico')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🛍️ Magalu (10%)</span>
                  </label>
                  <label key="direta|classico" className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <input type="checkbox" checked={massaConfCanais.includes('direta|classico')} onChange={() => toggleCanal('direta|classico')}
                      className="accent-orange-500" />
                    <span className="text-sm text-gray-700">🏠 Venda Direta (3%)</span>
                  </label>
            </div>
            <p className="text-xs text-gray-400 mb-4">{massaConfCanais.length} canal(is) selecionado(s)</p>
            <div className="flex gap-3">
              <button onClick={() => salvarMassaConf(showMassaConf!)}
                disabled={salvandoMassaConf || !massaConfBase || massaConfCanais.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
                {salvandoMassaConf ? 'Criando...' : `Criar ${massaConfCanais.length} Configuração(ões)`}
              </button>
              <button onClick={() => { setShowMassaConf(null); setMassaConfCanais([]) }}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
