'use client'
import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, ShoppingCart, Loader2, CheckCircle2 } from 'lucide-react'
import { normNome } from '@/lib/normNome'

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

interface Mat { id: string; nome: string; precoPacote: number; qtdPacote: number; precoUnidade: number }
interface Item { key: string; materialId: string; nome: string; qtdPacotes: string; qtdPacote: string; precoPacote: string; atualizarCusto: boolean }
const novoItem = (): Item => ({ key: Math.random().toString(36).slice(2), materialId: '', nome: '', qtdPacotes: '1', qtdPacote: '1', precoPacote: '', atualizarCusto: false })

export default function ComprasPage() {
  const [modulo, setModulo] = useState<boolean | null>(null)
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([])
  const [materiais, setMateriais] = useState<Mat[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [mercado, setMercado] = useState<Record<string, { medio: number; confiabilidade: string } | null>>({})

  const [fornecedorId, setFornecedorId] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [nf, setNf] = useState('')
  const [itens, setItens] = useState<Item[]>([novoItem()])
  const [darEntrada, setDarEntrada] = useState(true)
  const [gerarContas, setGerarContas] = useState(true)
  const [categoriaId, setCategoriaId] = useState('')
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10))
  const [forma, setForma] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [freteValor, setFreteValor] = useState('')
  const [freteTipo, setFreteTipo] = useState<'NA_NF' | 'TERCEIRIZADO'>('NA_NF')
  const [freteResponsavel, setFreteResponsavel] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [resumo, setResumo] = useState<any>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const s = await fetch('/api/compras').then(r => r.ok ? r.json() : { modulo: false })
    setModulo(!!s.modulo)
    if (!s.modulo) return
    const [f, m, c] = await Promise.all([
      fetch('/api/fornecedores').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/precificacao/materiais').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/financeiro/categorias?arvore=1&tipo=DESPESA').then(r => r.ok ? r.json() : { contas: [] }).catch(() => ({ contas: [] })),
    ])
    setFornecedores(Array.isArray(f) ? f : (f.fornecedores || []))
    const mats = Array.isArray(m) ? m : []
    setMateriais(mats)
    setContas(c.contas || [])
    // Preço de mercado (crowd) dos materiais → indicador "boa compra" no pedido.
    if (mats.length) {
      fetch('/api/compras/mercado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nomes: mats.map((x: any) => x.nome) }) })
        .then(r => r.ok ? r.json() : { mercado: {} }).then(d => setMercado(d.mercado || {})).catch(() => {})
    }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function ativar() {
    await fetch('/api/compras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'ativar' }) })
    // Recarrega a página inteira para o Sidebar remontar e buscar a flag → grupo "Compras" com todos os submenus aparece na hora.
    window.location.reload()
  }

  function setItem(key: string, patch: Partial<Item>) { setItens(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i)) }
  function escolherMaterial(key: string, materialId: string) {
    const m = materiais.find(x => x.id === materialId)
    if (m) setItem(key, { materialId, nome: m.nome, qtdPacote: String(m.qtdPacote || 1), precoPacote: String(m.precoPacote || '') })
    else setItem(key, { materialId: '' })
  }
  const puAtual = (materialId: string) => materiais.find(m => m.id === materialId)?.precoUnidade ?? null
  const puNovo = (it: Item) => { const q = Number(it.qtdPacote) || 1; const p = Number(it.precoPacote) || 0; return q > 0 ? p / q : 0 }
  function indicadorMercado(nome: string, precoUnidade: number) {
    const mk = nome ? mercado[normNome(nome)] : null
    if (!mk || !mk.medio || precoUnidade <= 0) return null
    const r = precoUnidade / mk.medio
    if (r <= 0.98) return { txt: `Boa compra ✅ — mercado ~${brl(mk.medio)}/un`, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    if (r >= 1.05) return { txt: `Acima da média ⚠️ — mercado ~${brl(mk.medio)}/un`, cls: 'text-red-600 bg-red-50 border-red-200' }
    return { txt: `Na média — mercado ~${brl(mk.medio)}/un`, cls: 'text-gray-500 bg-gray-50 border-gray-200' }
  }
  const total = itens.reduce((s, i) => s + (Number(i.precoPacote) || 0) * (Number(i.qtdPacotes) || 0), 0)
  // Dinheiro NUNCA em type=number (scroll/seta decrementa); texto + parseNum (vírgula BR).
  const parseNum = (s: string) => Number(String(s).replace(',', '.').replace(/[^\d.]/g, '')) || 0
  const freteN = parseNum(freteValor)
  const totalComFrete = total + (freteTipo === 'NA_NF' ? freteN : 0)

  async function concluir() {
    setErro('')
    if (!fornecedorId) return setErro('Escolha o fornecedor.')
    const validos = itens.filter(i => i.nome && Number(i.qtdPacotes) > 0)
    if (!validos.length) return setErro('Adicione ao menos 1 item.')
    setSalvando(true)
    try {
      const body = {
        fornecedorId, data, nf: nf || null,
        itens: validos.map(i => ({ materialId: i.materialId || null, nome: i.nome, qtdPacotes: Number(i.qtdPacotes), qtdPacote: Number(i.qtdPacote) || 1, precoPacote: Number(i.precoPacote) || 0, atualizarCusto: i.atualizarCusto })),
        darEntrada,
        contasPagar: { gerar: gerarContas, categoriaId: categoriaId || null, vencimento, forma: forma || null, parcelas: Number(parcelas) || 1 },
        freteValor: freteN,
        freteTipo: freteN > 0 ? freteTipo : null,
        freteResponsavel: freteTipo === 'TERCEIRIZADO' ? (freteResponsavel.trim() || null) : null,
      }
      const r = await fetch('/api/compras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao concluir')
      setResumo(d)
      setItens([novoItem()]); setNf(''); setFreteValor(''); setFreteResponsavel('')
      await carregar()
    } catch (e: any) { setErro(e.message) }
    finally { setSalvando(false) }
  }

  if (modulo === null) return <div className="p-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div>

  if (!modulo) return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 text-center">
        <ShoppingCart className="w-8 h-8 text-orange-500 mx-auto mb-2" />
        <h1 className="text-lg font-bold text-gray-800 mb-1">Pedido de compra</h1>
        <p className="text-sm text-gray-600 mb-4">Um lançamento que gera <b>contas a pagar</b>, atualiza o <b>custo do material</b> e dá <b>entrada no estoque</b> — de uma vez.</p>
        <button onClick={ativar} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600">Ativar módulo de compras</button>
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pedido de compra</h1>
        <p className="text-sm text-gray-500">Gera contas a pagar + atualiza custo + entrada no estoque.</p>
      </div>

      {resumo && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>Compra registrada! <b>{resumo.itens}</b> item(ns) · {brl(resumo.total)}.
            {' '}Entradas no estoque: <b>{resumo.entradas}</b> · custos atualizados: <b>{resumo.custosAtualizados}</b> (produtos recalc.: {resumo.variacoesRecalc}) · contas a pagar: <b>{resumo.contasPagar}</b> parcela(s).</div>
        </div>
      )}
      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{erro}</div>}

      {/* Fornecedor + data */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="text-xs font-medium text-gray-500 block mb-1">Fornecedor *</label>
          <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={inp}>
            <option value="">Selecione…</option>
            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
        <div><label className="text-xs font-medium text-gray-500 block mb-1">Data da compra</label><input type="date" value={data} onChange={e => setData(e.target.value)} className={inp} /></div>
        <div><label className="text-xs font-medium text-gray-500 block mb-1">NF (opcional)</label><input value={nf} onChange={e => setNf(e.target.value)} className={inp} placeholder="nº da nota" /></div>
      </div>

      {/* Itens */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Itens</h2>
          <button onClick={() => setItens(p => [...p, novoItem()])} className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"><Plus className="w-3.5 h-3.5" /> Adicionar item</button>
        </div>
        {itens.map(it => {
          const atual = it.materialId ? puAtual(it.materialId) : null
          const novo = puNovo(it)
          const mudou = atual != null && Math.abs(novo - atual) > 0.0001
          return (
            <div key={it.key} className="rounded-xl border border-gray-100 p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <label className="text-[10px] text-gray-400 block">Material</label>
                  <select value={it.materialId} onChange={e => escolherMaterial(it.key, e.target.value)} className={inp}>
                    <option value="">— avulso (digite o nome) —</option>
                    {materiais.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                  {!it.materialId && <input value={it.nome} onChange={e => setItem(it.key, { nome: e.target.value })} placeholder="Nome do item" className={inp + ' mt-1'} />}
                </div>
                <div className="sm:col-span-2"><label className="text-[10px] text-gray-400 block">Qtd pacotes</label><input type="number" min="1" value={it.qtdPacotes} onChange={e => setItem(it.key, { qtdPacotes: e.target.value })} className={inp} /></div>
                <div className="sm:col-span-2"><label className="text-[10px] text-gray-400 block">Un/pacote</label><input type="number" min="1" value={it.qtdPacote} onChange={e => setItem(it.key, { qtdPacote: e.target.value })} className={inp} /></div>
                <div className="sm:col-span-2"><label className="text-[10px] text-gray-400 block">Preço/pacote</label><input type="number" step="0.01" value={it.precoPacote} onChange={e => setItem(it.key, { precoPacote: e.target.value })} className={inp} placeholder="0,00" /></div>
                <div className="sm:col-span-1 flex justify-end"><button onClick={() => setItens(p => p.length > 1 ? p.filter(x => x.key !== it.key) : p)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>
              </div>
              {it.materialId && mudou && (
                <label className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={it.atualizarCusto} onChange={e => setItem(it.key, { atualizarCusto: e.target.checked })} className="accent-amber-500" />
                  <span className="text-amber-800">O custo mudou: <b>{brl(atual!)}</b> → <b>{brl(novo)}</b> por unidade. Atualizar o custo do material e recalcular os produtos?</span>
                </label>
              )}
              {(() => { const mi = it.nome ? indicadorMercado(it.nome, novo) : null; return mi ? (
                <span className={`inline-block text-[10px] font-medium px-2 py-1 rounded-lg border ${mi.cls}`}>{mi.txt}</span>
              ) : null })()}
            </div>
          )
        })}
        <div className="text-right text-sm text-gray-600">
          Total{freteTipo === 'NA_NF' && freteN > 0 ? ' (com frete)' : ''}: <b className="text-gray-900">{brl(totalComFrete)}</b>
          {freteTipo === 'NA_NF' && freteN > 0 && <span className="text-xs text-gray-400"> — itens {brl(total)} + frete {brl(freteN)}</span>}
        </div>
      </div>

      {/* Opções */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={darEntrada} onChange={e => setDarEntrada(e.target.checked)} className="accent-orange-500" /> Dar <b>entrada no estoque</b> dos materiais comprados</label>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={gerarContas} onChange={e => setGerarContas(e.target.checked)} className="accent-orange-500" /> Gerar <b>contas a pagar</b> no financeiro</label>
        {gerarContas && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-6">
            <div><label className="text-[10px] text-gray-400 block">Conta (DRE)</label>
              <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className={inp}>
                <option value="">—</option>
                {contas.map((c: any) => [<option key={c.id} value={c.id}>{c.icone} {c.nome}</option>, ...(c.subcontas || []).map((s: any) => <option key={s.id} value={s.id}>&nbsp;&nbsp;↳ {s.nome}</option>)])}
              </select>
            </div>
            <div><label className="text-[10px] text-gray-400 block">1º vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={inp} /></div>
            <div><label className="text-[10px] text-gray-400 block">Forma</label>
              <select value={forma} onChange={e => setForma(e.target.value)} className={inp}>
                <option value="">—</option>{['dinheiro','pix','boleto','cartão','fiado/prazo'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div><label className="text-[10px] text-gray-400 block">Parcelas</label><input type="number" min="1" max="60" value={parcelas} onChange={e => setParcelas(e.target.value)} className={inp} /></div>
          </div>
        )}

        {/* Frete (Feature 1) — na NF soma na compra; terceirizado vira lançamento à parte */}
        <div className="border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="text-[10px] text-gray-400 block">🚚 Frete (R$)</label>
              <input type="text" inputMode="decimal" value={freteValor} onChange={e => setFreteValor(e.target.value)} placeholder="0,00" className={inp} /></div>
            <div><label className="text-[10px] text-gray-400 block">Tipo de frete</label>
              <select value={freteTipo} onChange={e => setFreteTipo(e.target.value as 'NA_NF' | 'TERCEIRIZADO')} className={inp} disabled={freteN <= 0}>
                <option value="NA_NF">Na nota (soma na compra)</option>
                <option value="TERCEIRIZADO">Terceirizado (à parte)</option>
              </select></div>
            {freteTipo === 'TERCEIRIZADO' && freteN > 0 && (
              <div><label className="text-[10px] text-gray-400 block">Responsável</label>
                <input type="text" value={freteResponsavel} onChange={e => setFreteResponsavel(e.target.value)} placeholder="Lalamove, Uber…" className={inp} /></div>
            )}
          </div>
          {freteTipo === 'TERCEIRIZADO' && freteN > 0 && <p className="text-[11px] text-gray-400 mt-1">Vira uma despesa separada (categoria Frete/Logística), vinculada a esta compra.</p>}
        </div>
      </div>

      <button onClick={concluir} disabled={salvando}
        className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
        {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
        {salvando ? 'Registrando…' : 'Concluir compra'}
      </button>
    </div>
  )
}
