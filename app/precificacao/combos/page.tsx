'use client'

import { useState, useEffect, useCallback } from 'react'

interface Variacao {
  id: string; qtdKit: number; custoTotal: number; precoVenda: number | null
  canal: string; subOpcao: string; isKit: boolean; impostos: number
}
interface Produto { id: string; nome: string; sku: string | null; configs: Variacao[] }
interface ComboItem { variacaoId: string; nomeProduto: string; qtd: number; custoUnit: number }
interface Combo {
  id: string; nome: string; descricao: string | null
  canal: string; subOpcao: string
  precoNormal: number | null; descontoPct: number | null; precoCombo: number | null
  items: ComboItem[]
}

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

const CANAIS_LISTA = [
  { key:'shopee', label:'Shopee', subs:null },
  { key:'ml',     label:'Mercado Livre', subs:[{key:'classico',label:'Clássico (12%)'},{key:'premium',label:'Premium (16%)'}] },
  { key:'amazon', label:'Amazon', subs:null },
  { key:'tiktok', label:'TikTok Shop', subs:null },
  { key:'elo7',   label:'Elo7', subs:[{key:'padrao',label:'Padrão (18%)'},{key:'maxima',label:'Máxima (20%)'}] },
  { key:'magalu', label:'Magalu', subs:null },
  { key:'direta', label:'Venda Direta', subs:null },
]
function getTaxa(canal: string, sub: string, preco: number) {
  if (canal==='shopee') {
    if (preco<80)  return {taxa:0.20,fixo:4.00}
    if (preco<100) return {taxa:0.14,fixo:16.00}
    if (preco<200) return {taxa:0.14,fixo:20.00}
    return              {taxa:0.14,fixo:26.00}
  }
  if (canal==='ml')     return sub==='premium'?{taxa:0.16,fixo:0}:{taxa:0.12,fixo:0}
  if (canal==='amazon') return {taxa:0.12,fixo:2.00}
  if (canal==='tiktok') return {taxa:0.06,fixo:2.00}
  if (canal==='elo7')   return sub==='maxima'?{taxa:0.20,fixo:3.99}:{taxa:0.18,fixo:3.99}
  if (canal==='magalu') return {taxa:0.10,fixo:0}
  return {taxa:0.03,fixo:0}
}
function fmtR(n: number) { return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) }

const EMPTY_FORM = {
  nome:'', descricao:'', canal:'shopee', subOpcao:'classico',
  descontoPct:'', precoCombo:'',
  items:[] as ComboItem[],
}

export default function CombosPage() {
  const [combos, setCombos]     = useState<Combo[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string|null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({...EMPTY_FORM})

  const load = useCallback(async () => {
    setLoading(true)
    const [c, p] = await Promise.all([
      fetch('/api/precificacao/combos').then(r=>r.json()).catch(()=>[]),
      fetch('/api/precificacao/produtos').then(r=>r.json()).catch(()=>[]),
    ])
    setCombos(Array.isArray(c)?c:[])
    const prods = (Array.isArray(p)?p:[]).map((prod:any) => ({
      ...prod,
      configs: (prod.variacoes||[]).map((v:any) => ({
        ...v, isKit: v.isKit ?? (v.tipo==='KIT')
      }))
    }))
    setProdutos(prods)
    setLoading(false)
  }, [])
  useEffect(()=>{load()},[load])

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const custoTotal = form.items.reduce((s,i) => s + Number(i.custoUnit)*Number(i.qtd), 0)
  // preço normal = soma dos preços de venda dos itens (ou sugestão se não tiver)
  const precoNormalCalc = form.items.reduce((s,i) => {
    const prod = produtos.find(p => p.configs.find(c => c.id === i.variacaoId))
    const conf = prod?.configs.find(c => c.id === i.variacaoId)
    return s + (conf?.precoVenda ? Number(conf.precoVenda) * i.qtd : 0)
  }, 0)
  const precoComboNum = form.precoCombo ? Number(form.precoCombo) : 0
  const descontoPctNum = form.descontoPct ? Number(form.descontoPct) : 0
  // Se digitou desconto mas não preço, calcula preço
  const precoFinal = precoComboNum > 0
    ? precoComboNum
    : descontoPctNum > 0 && precoNormalCalc > 0
      ? precoNormalCalc * (1 - descontoPctNum/100)
      : 0

  // Desconto em R$ para exibir
  const descontoR = precoNormalCalc > 0 && precoFinal > 0 ? precoNormalCalc - precoFinal : 0
  const descontoPctCalc = precoNormalCalc > 0 && descontoR > 0 ? (descontoR/precoNormalCalc)*100 : 0

  // Margem
  const canalTax = precoFinal > 0 ? getTaxa(form.canal, form.subOpcao, precoFinal) : {taxa:0,fixo:0}
  const comissaoR = precoFinal > 0 ? precoFinal * canalTax.taxa + canalTax.fixo : 0
  const lucroR = precoFinal > 0 ? precoFinal - custoTotal - comissaoR : 0
  const margemPct = precoFinal > 0 ? (lucroR/precoFinal)*100 : 0
  const corMargem = margemPct >= 25 ? 'text-green-600' : margemPct >= 15 ? 'text-yellow-600' : 'text-red-500'

  function addItem(variacaoId: string, prod: Produto) {
    const conf = prod.configs.find(c=>c.id===variacaoId)
    if (!conf) return
    // Verifica se já existe
    if (form.items.find(i=>i.variacaoId===variacaoId)) return
    const item: ComboItem = {
      variacaoId,
      nomeProduto: prod.nome + (conf.isKit ? ` (Kit ${conf.qtdKit}un)` : ''),
      qtd: 1,
      custoUnit: Number(conf.custoTotal),
    }
    setForm(p=>({...p, items:[...p.items, item]}))
  }
  function removeItem(variacaoId: string) {
    setForm(p=>({...p, items:p.items.filter(i=>i.variacaoId!==variacaoId)}))
  }
  function updateQtd(variacaoId: string, qtd: number) {
    setForm(p=>({...p, items:p.items.map(i=>i.variacaoId===variacaoId?{...i,qtd}:i)}))
  }

  async function handleSave() {
    if (!form.nome.trim()) return alert('Nome do combo obrigatório')
    if (form.items.length < 1) return alert('Adicione pelo menos 1 produto')
    if (precoFinal <= 0) return alert('Defina o preço ou desconto do combo')
    setSaving(true)
    try {
      const payload = {
        nome: form.nome, descricao: form.descricao||null,
        canal: form.canal, subOpcao: form.subOpcao,
        precoNormal: precoNormalCalc||null,
        descontoPct: descontoPctCalc||null,
        precoCombo: precoFinal,
        items: form.items,
      }
      const url = editId ? `/api/precificacao/combos/${editId}` : '/api/precificacao/combos'
      const res = await fetch(url, {method:editId?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
      if (!res.ok) throw new Error((await res.json()).error)
      setShowForm(false); setEditId(null); setForm({...EMPTY_FORM}); load()
    } catch(e:any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este combo?')) return
    await fetch(`/api/precificacao/combos/${id}`,{method:'DELETE'}); load()
  }

  function openEdit(c: Combo) {
    setForm({
      nome:c.nome, descricao:c.descricao||'',
      canal:c.canal, subOpcao:c.subOpcao,
      descontoPct: c.descontoPct?String(c.descontoPct):'',
      precoCombo: c.precoCombo?String(c.precoCombo):'',
      items: c.items.map(i=>({...i})),
    })
    setEditId(c.id); setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Combos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Monte combos de produtos com desconto e gere o destaque <strong>"De X por Y"</strong> para divulgação.
          </p>
        </div>
        <button onClick={()=>{setForm({...EMPTY_FORM});setEditId(null);setShowForm(true)}}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Novo Combo
        </button>
      </div>

      {/* ── Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl px-6 pt-5 pb-4 border-b border-gray-100 z-10">
              <h2 className="text-lg font-bold text-gray-800">{editId?'Editar':'Novo'} Combo</h2>
            </div>
            <div className="p-6 space-y-5">

              {/* Nome e descrição */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome do combo *</label>
                  <input value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))}
                    className={inputClass} placeholder="Ex: Kit Festa Completo" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Descrição (opcional)</label>
                  <input value={form.descricao} onChange={e=>setForm(p=>({...p,descricao:e.target.value}))}
                    className={inputClass} placeholder="Ex: Inclui cofrinho + laço + tag personalizada" />
                </div>
              </div>

              {/* Canal */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Canal de venda</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <select value={form.canal} onChange={e=>setForm(p=>({...p,canal:e.target.value,subOpcao:'classico'}))} className={inputClass}>
                      {CANAIS_LISTA.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  {CANAIS_LISTA.find(c=>c.key===form.canal)?.subs && (
                    <div className="flex-1">
                      <select value={form.subOpcao} onChange={e=>setForm(p=>({...p,subOpcao:e.target.value}))} className={inputClass}>
                        {CANAIS_LISTA.find(c=>c.key===form.canal)?.subs?.map(s=>(
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Produtos do combo */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Produtos do Combo</p>
                <select onChange={e=>{
                    if (!e.target.value) return
                    const [prodId, varId] = e.target.value.split('|')
                    const prod = produtos.find(p=>p.id===prodId)
                    if (prod) addItem(varId, prod)
                    e.target.value = ''
                  }}
                  className={inputClass + ' mb-3'} defaultValue="">
                  <option value="">+ Adicionar produto ao combo...</option>
                  {produtos.map(prod =>
                    prod.configs.map(conf => (
                      <option key={conf.id} value={`${prod.id}|${conf.id}`}>
                        {prod.nome} {conf.isKit ? `(Kit ${conf.qtdKit}un)` : '(Unitário)'}
                        {' — '}{conf.precoVenda ? fmtR(Number(conf.precoVenda)) : 'sem preço'}
                      </option>
                    ))
                  )}
                </select>

                {form.items.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Nenhum produto adicionado.</p>
                )}
                {form.items.map(item => (
                  <div key={item.variacaoId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">{item.nomeProduto}</p>
                      <p className="text-xs text-gray-400">Custo: {fmtR(item.custoUnit)} · Total: {fmtR(item.custoUnit * item.qtd)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="text-xs text-gray-500">Qtd</label>
                      <input type="number" min="1" step="1" value={item.qtd}
                        onChange={e=>updateQtd(item.variacaoId, Number(e.target.value)||1)}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <button onClick={()=>removeItem(item.variacaoId)} className="text-red-400 hover:text-red-600 text-lg flex-shrink-0">✕</button>
                  </div>
                ))}

                {custoTotal > 0 && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 font-medium">
                    Custo total dos itens: <strong>{fmtR(custoTotal)}</strong>
                  </div>
                )}
              </div>

              {/* Preço */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Precificação do Combo</p>

                {precoNormalCalc > 0 && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
                    💡 Preço normal (soma dos itens): <strong>{fmtR(precoNormalCalc)}</strong>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Desconto do combo (%)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" step="0.1" min="0" max="99" value={form.descontoPct}
                        onChange={e=>setForm(p=>({...p, descontoPct:e.target.value, precoCombo:''}))}
                        className={inputClass} placeholder="Ex: 20" />
                      <span className="text-gray-500 font-bold flex-shrink-0">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">— ou — Preço fixo do combo</label>
                    <input type="number" step="0.01" value={form.precoCombo}
                      onChange={e=>setForm(p=>({...p, precoCombo:e.target.value, descontoPct:''}))}
                      className={inputClass} placeholder="R$ 0,00" />
                  </div>
                </div>
              </div>

              {/* Preview "DE X POR Y" */}
              {precoFinal > 0 && precoNormalCalc > 0 && (
                <div className="rounded-2xl overflow-hidden border-2 border-orange-300">
                  <div className="bg-orange-500 px-4 py-2">
                    <p className="text-xs font-bold text-orange-200 uppercase tracking-widest">🏷️ Preview — Destaque Promocional</p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    {/* Nome do combo */}
                    <p className="font-bold text-gray-800 text-lg">{form.nome || 'Nome do combo'}</p>
                    {form.descricao && <p className="text-sm text-gray-500 mt-0.5">{form.descricao}</p>}
                    <div className="flex items-end gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">De</p>
                        <p className="text-2xl text-gray-400 line-through font-bold">{fmtR(precoNormalCalc)}</p>
                      </div>
                      <div className="text-4xl text-gray-400 font-light mb-1">→</div>
                      <div>
                        <p className="text-xs text-green-600 uppercase font-bold tracking-widest">Por</p>
                        <p className="text-4xl font-black text-green-600">{fmtR(precoFinal)}</p>
                      </div>
                      {descontoR > 0 && (
                        <div className="bg-red-500 text-white rounded-full px-3 py-1.5 mb-1 flex-shrink-0">
                          <p className="text-xs font-bold">-{descontoPctCalc.toFixed(0)}%</p>
                          <p className="text-xs font-bold">-{fmtR(descontoR)}</p>
                        </div>
                      )}
                    </div>
                    {/* Itens */}
                    {form.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Incluso no combo:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {form.items.map(i => (
                            <span key={i.variacaoId} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                              {i.qtd > 1 ? `${i.qtd}× ` : ''}{i.nomeProduto}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Margem */}
                    <div className={`mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs`}>
                      <span className="text-gray-400">Margem com {CANAIS_LISTA.find(c=>c.key===form.canal)?.label}</span>
                      <span className={`font-bold ${corMargem}`}>{margemPct.toFixed(1)}% · {fmtR(lucroR)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {saving?'Salvando...':'Salvar Combo'}
                </button>
                <button onClick={()=>{setShowForm(false);setEditId(null)}}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de combos ── */}
      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Carregando...</div>
      ) : combos.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          Nenhum combo criado ainda. Clique em "+ Novo Combo" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {combos.map(combo => {
            const des = combo.descontoPct ? Number(combo.descontoPct) : 0
            const pNorm = combo.precoNormal ? Number(combo.precoNormal) : 0
            const pCombo = combo.precoCombo ? Number(combo.precoCombo) : 0
            const custoItems = combo.items.reduce((s,i)=>s+Number(i.custoUnit)*i.qtd,0)
            const cTax = pCombo>0?getTaxa(combo.canal,combo.subOpcao,pCombo):{taxa:0,fixo:0}
            const lucro = pCombo>0? pCombo - custoItems - (pCombo*cTax.taxa+cTax.fixo) : 0
            const mPct = pCombo>0?(lucro/pCombo)*100:0
            const mCor = mPct>=25?'text-green-600':mPct>=15?'text-yellow-600':'text-red-500'
            return (
              <div key={combo.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {/* Badge desconto */}
                {des > 0 && (
                  <div className="bg-red-500 text-white text-center py-1.5">
                    <p className="text-sm font-black">🏷️ -{des.toFixed(0)}% de desconto</p>
                  </div>
                )}
                <div className="p-5">
                  <p className="font-bold text-gray-800 text-lg">{combo.nome}</p>
                  {combo.descricao && <p className="text-xs text-gray-400 mt-0.5">{combo.descricao}</p>}

                  {/* DE X POR Y */}
                  <div className="flex items-baseline gap-3 mt-3">
                    {pNorm > 0 && pNorm !== pCombo && (
                      <div className="text-center">
                        <p className="text-xs text-gray-400 font-bold uppercase">De</p>
                        <p className="text-lg text-gray-400 line-through font-bold">{fmtR(pNorm)}</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-xs text-green-600 font-bold uppercase">{pNorm > 0 && pNorm !== pCombo ? 'Por' : 'Preço'}</p>
                      <p className="text-3xl font-black text-green-600">{fmtR(pCombo)}</p>
                    </div>
                  </div>

                  {/* Itens */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {combo.items.map(i => (
                      <span key={i.variacaoId} className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full">
                        {i.qtd>1?`${i.qtd}× `:''}{i.nomeProduto}
                      </span>
                    ))}
                  </div>

                  {/* Margem */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                    <span className="text-gray-400">{CANAIS_LISTA.find(c=>c.key===combo.canal)?.label}</span>
                    <span className={`font-bold ${mCor}`}>{mPct.toFixed(1)}% · {fmtR(lucro)}</span>
                  </div>

                  {/* Ações */}
                  <div className="mt-3 flex gap-2">
                    <button onClick={()=>openEdit(combo)}
                      className="flex-1 text-xs text-blue-500 border border-blue-200 py-1.5 rounded-lg hover:bg-blue-50">
                      Editar
                    </button>
                    <button onClick={()=>handleDelete(combo.id)}
                      className="flex-1 text-xs text-red-500 border border-red-200 py-1.5 rounded-lg hover:bg-red-50">
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
