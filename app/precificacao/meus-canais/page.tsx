'use client'
// app/precificacao/meus-canais/page.tsx — a artesã liga o módulo de canais, HABILITA os
// gerenciados pelo SOA (taxa pronta + "atualizado em DD/MM" + ajuste OPCIONAL) e cadastra
// as plataformas dela (custom). Aviso de responsabilidade sempre visível.
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Info, Save, Store } from 'lucide-react'

interface Regra { precoAte?: number | null; categoria?: string | null; variante?: string | null; taxaPercent: number; taxaFixa: number; label?: string }
interface Catalogo { canal: string; nome: string; regras: Regra[]; categorias: string[]; variantes: string[]; pixDias: number; cartaoDias: number; estrutura: string | null; atualizadoEm: string | null }
interface CanalVenda { canal: string; nome: string; origem: string; categoria: string | null; variante: string | null; overridePercent: number | null; overrideFixa: number | null; taxaPercent: number; taxaFixa: number; pixDias: number; cartaoDias: number }
interface SimLinha { canal: string; nome: string; ajustado: boolean; taxaPercent: number; taxaFixa: number; taxa: number; liquido: number; margem: number | null; lucro: number | null }
interface Prevista { id: string; descricao: string; valor: number; data: string; canal: string | null }

const brDate = (s: string | null) => s ? s.split('-').reverse().slice(0, 2).join('/') : '—'
const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
const CUSTOM_VAZIO = { nome: '', taxaPercent: '', taxaFixa: '', pixDias: '0', cartaoDias: '2' }

export default function MeusCanaisPage() {
  const [catalogo, setCatalogo] = useState<Catalogo[]>([])
  const [canais, setCanais] = useState<CanalVenda[]>([])
  const [flags, setFlags] = useState({ modulo: false, financeiro: false, marketplace: true })
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [custom, setCustom] = useState(CUSTOM_VAZIO)
  const [msg, setMsg] = useState('')
  const [simPreco, setSimPreco] = useState('')
  const [simCusto, setSimCusto] = useState('')
  const [sim, setSim] = useState<SimLinha[]>([])
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  const [previstas, setPrevistas] = useState<Prevista[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())

  async function simular() {
    const p = Number(simPreco)
    if (!(p > 0)) { flash('Informe o preço de venda'); return }
    const r = await fetch(`/api/precificacao/canais-venda?preco=${p}&custo=${Number(simCusto) || 0}`)
    if (r.ok) { const d = await r.json(); setSim(d.simulacao ?? []) }
  }

  const carregarPrevistas = useCallback(async () => {
    const r = await fetch('/api/financeiro/lancamentos/confirmar-massa')
    if (r.ok) { const d = await r.json(); setPrevistas(d.previstas ?? []) }
  }, [])
  useEffect(() => { if (flags.financeiro) carregarPrevistas() }, [flags.financeiro, carregarPrevistas])

  async function confirmarPrevistas(todos: boolean) {
    const ids = [...sel]
    if (!todos && !ids.length) { flash('Selecione ao menos uma'); return }
    const r = await fetch('/api/financeiro/lancamentos/confirmar-massa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(todos ? { todos: true } : { ids }) })
    if (r.ok) { const d = await r.json(); flash(`${d.confirmadas} recebimento(s) confirmado(s) ✅`); setSel(new Set()); carregarPrevistas() }
  }

  const carregar = useCallback(async () => {
    const r = await fetch('/api/precificacao/canais-venda')
    if (r.ok) { const d = await r.json(); setCatalogo(d.catalogo ?? []); setCanais(d.canais ?? []); setFlags(d.flags ?? { modulo: false, financeiro: false, marketplace: true }); setAviso(d.aviso ?? '') }
    setCarregando(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const configurado = (slug: string) => canais.find(c => c.canal === slug) || null

  async function toggleFlag(campo: 'moduloCanais' | 'canaisLancaFinanceiro' | 'marketplaceLancaFinanceiro', valor: boolean) {
    const chave = campo === 'moduloCanais' ? 'modulo' : campo === 'canaisLancaFinanceiro' ? 'financeiro' : 'marketplace'
    setFlags(f => ({ ...f, [chave]: valor }))
    await fetch('/api/precificacao/canais-venda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'flags', [campo]: valor }) })
  }

  async function salvarCanal(payload: Record<string, unknown>, chave: string) {
    setOcupado(chave)
    const r = await fetch('/api/precificacao/canais-venda', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setOcupado('')
    if (r.ok) { await carregar(); flash('Salvo ✅') } else { const d = await r.json().catch(() => ({})); flash(d.error || 'Erro ao salvar') }
  }
  async function remover(slug: string) {
    setOcupado(slug)
    await fetch(`/api/precificacao/canais-venda?canal=${encodeURIComponent(slug)}`, { method: 'DELETE' })
    setOcupado(''); await carregar()
  }
  async function salvarCustom() {
    if (!custom.nome.trim()) { flash('Dê um nome à sua plataforma'); return }
    await salvarCanal({ origem: 'custom', nome: custom.nome, taxaPercent: Number(custom.taxaPercent) || 0, taxaFixa: Number(custom.taxaFixa) || 0, pixDias: Number(custom.pixDias) || 0, cartaoDias: Number(custom.cartaoDias) || 0 }, 'custom')
    setCustom(CUSTOM_VAZIO)
  }

  if (carregando) return <div className="min-h-screen bg-gray-50 text-gray-500 flex items-center justify-center">Carregando…</div>
  const customs = canais.filter(c => c.origem === 'custom')

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/precificacao/canais" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold text-gray-800">Canais de venda</h1>
        </div>
        <p className="text-sm text-gray-500 mb-4">Habilite os canais que você usa para ver quanto sobra em cada um (a taxa entra na precificação e, se quiser, na receita).</p>

        {msg && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 text-sm">{msg}</div>}

        {/* Aviso de responsabilidade */}
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" /> {aviso}
        </div>

        {/* Flags */}
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <label className="flex items-center justify-between gap-3">
            <span><b className="text-sm">Usar canais de venda</b><br /><span className="text-xs text-gray-500">Liga a taxa por canal na precificação.</span></span>
            <input type="checkbox" checked={flags.modulo} onChange={e => toggleFlag('moduloCanais', e.target.checked)} className="w-5 h-5 accent-orange-500" />
          </label>
          <label className={`flex items-center justify-between gap-3 ${!flags.modulo ? 'opacity-40' : ''}`}>
            <span><b className="text-sm">Lançar receita no financeiro ao concluir</b><br /><span className="text-xs text-gray-500">Ao concluir um pedido, cria uma <b>receita prevista</b> (líquida, editável) que você confirma em massa. Desligado = você lança do seu jeito.</span></span>
            <input type="checkbox" disabled={!flags.modulo} checked={flags.financeiro} onChange={e => toggleFlag('canaisLancaFinanceiro', e.target.checked)} className="w-5 h-5 accent-orange-500" />
          </label>
          <label className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <span><b className="text-sm">Lançar vendas de marketplace no financeiro</b><br /><span className="text-xs text-gray-500">Ao expedir um pedido de <b>Shopee, Mercado Livre</b> e afins, cria uma <b>receita prevista</b> (líquida) no financeiro. Desligado = você lança do seu jeito, sem entrar nada sozinho.</span></span>
            <input type="checkbox" checked={flags.marketplace} onChange={e => toggleFlag('marketplaceLancaFinanceiro', e.target.checked)} className="w-5 h-5 accent-orange-500" />
          </label>
        </div>

        {/* Recebimentos previstos — confirmar em massa */}
        {flags.financeiro && previstas.length > 0 && (
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Recebimentos previstos ({previstas.length})</p>
              <div className="flex gap-2">
                <button onClick={() => confirmarPrevistas(false)} className="text-xs border border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-semibold px-3 py-1.5 rounded-lg">Confirmar selecionadas</button>
                <button onClick={() => confirmarPrevistas(true)} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-3 py-1.5 rounded-lg">Confirmar todas</button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">Receitas líquidas geradas ao concluir pedidos. Confira o valor (editável no Financeiro) e confirme o recebimento.</p>
            <div className="space-y-1">
              {previstas.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={sel.has(p.id)} onChange={e => setSel(s => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n })} className="w-4 h-4 accent-emerald-500" />
                  <span className="text-gray-400 text-xs w-16">{p.data ? p.data.split('-').reverse().slice(0, 2).join('/') : '—'}</span>
                  <span className="flex-1 text-gray-700 truncate">{p.descricao.replace('[saldo-auto] ', '')}</span>
                  <span className="font-semibold text-gray-800">R$ {p.valor.toFixed(2)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Simulador: quanto sobra por canal */}
        {canais.length > 0 && (
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Quanto sobra por canal</p>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <label className="text-xs text-gray-600">Preço de venda<input className={inputCls + ' mt-0.5 w-32'} type="number" step="0.01" placeholder="0,00" value={simPreco} onChange={e => setSimPreco(e.target.value)} /></label>
              <label className="text-xs text-gray-600">Custo (opcional)<input className={inputCls + ' mt-0.5 w-32'} type="number" step="0.01" placeholder="0,00" value={simCusto} onChange={e => setSimCusto(e.target.value)} /></label>
              <button onClick={simular} className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">Calcular</button>
            </div>
            {sim.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-400 text-left">
                    <th className="py-1 pr-2">Canal</th><th className="py-1 px-2">Taxa</th><th className="py-1 px-2">Líquido</th><th className="py-1 px-2">Margem</th>
                  </tr></thead>
                  <tbody>
                    {sim.map(s => (
                      <tr key={s.canal} className="border-t border-gray-100">
                        <td className="py-1.5 pr-2 font-medium text-gray-700">{s.nome}{s.ajustado && <span className="ml-1 text-[10px] text-orange-500">(ajustada)</span>}</td>
                        <td className="py-1.5 px-2 text-gray-500">{s.taxaPercent}% + R$ {s.taxaFixa.toFixed(2)} <span className="text-gray-400">= R$ {s.taxa.toFixed(2)}</span></td>
                        <td className="py-1.5 px-2 font-semibold text-gray-800">R$ {s.liquido.toFixed(2)}</td>
                        <td className={`py-1.5 px-2 font-medium ${s.margem == null ? 'text-gray-300' : s.margem < 0 ? 'text-red-500' : s.margem < 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {s.margem == null ? '—' : `${s.margem}%`}{s.lucro != null && <span className="text-gray-400 font-normal"> · R$ {s.lucro.toFixed(2)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Gerenciados pelo SOA */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Canais gerenciados pelo SOA</h2>
        <div className="space-y-3 mb-8">
          {catalogo.map(cat => {
            const cfg = configurado(cat.canal)
            return (
              <div key={cat.canal} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{cat.nome}</p>
                    <p className="text-xs text-gray-400">Taxa atualizada pelo SOA em {brDate(cat.atualizadoEm)}</p>
                  </div>
                  {cfg
                    ? <button onClick={() => remover(cat.canal)} disabled={ocupado === cat.canal} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Desabilitar</button>
                    : <button onClick={() => salvarCanal({ canal: cat.canal, origem: 'gerenciado', categoria: cat.categorias[0] ?? null, variante: cat.variantes[0] ?? null }, cat.canal)} disabled={ocupado === cat.canal}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Habilitar</button>}
                </div>
                {cat.estrutura && <p className="text-xs text-gray-500 mt-2">{cat.estrutura}</p>}

                {cfg && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    {(cat.categorias.length > 0 || cat.variantes.length > 0) && (
                      <div className="flex flex-wrap gap-3">
                        {cat.categorias.length > 0 && (
                          <label className="text-xs text-gray-600">Sua categoria
                            <select value={cfg.categoria ?? ''} onChange={e => salvarCanal({ canal: cat.canal, origem: 'gerenciado', categoria: e.target.value, variante: cfg.variante }, cat.canal)} className={inputCls + ' mt-0.5'}>
                              {cat.categorias.map(c => <option key={c} value={c}>{c}</option>)}
                            </select></label>
                        )}
                        {cat.variantes.length > 0 && (
                          <label className="text-xs text-gray-600">Tipo de anúncio
                            <select value={cfg.variante ?? ''} onChange={e => salvarCanal({ canal: cat.canal, origem: 'gerenciado', categoria: cfg.categoria, variante: e.target.value }, cat.canal)} className={inputCls + ' mt-0.5'}>
                              {cat.variantes.map(v => <option key={v} value={v}>{v}</option>)}
                            </select></label>
                        )}
                      </div>
                    )}
                    <AjusteOpcional cfg={cfg} onSalvar={(op, of) => salvarCanal({ canal: cat.canal, origem: 'gerenciado', categoria: cfg.categoria, variante: cfg.variante, overridePercent: op, overrideFixa: of }, cat.canal)} ocupado={ocupado === cat.canal} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Custom */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Store className="w-4 h-4" /> Minhas plataformas</h2>
        <div className="space-y-2 mb-3">
          {customs.map(c => (
            <div key={c.canal} className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
              <span><b>{c.nome}</b> <span className="text-gray-500">— {c.taxaPercent}% + R$ {c.taxaFixa.toFixed(2)} · Pix D+{c.pixDias} / cartão D+{c.cartaoDias}</span></span>
              <button onClick={() => remover(c.canal)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Plus className="w-4 h-4" /> Cadastrar minha plataforma</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <input className={inputCls + ' col-span-2 sm:col-span-1'} placeholder="Nome *" value={custom.nome} onChange={e => setCustom(p => ({ ...p, nome: e.target.value }))} />
            <input className={inputCls} type="number" step="any" placeholder="Taxa %" value={custom.taxaPercent} onChange={e => setCustom(p => ({ ...p, taxaPercent: e.target.value }))} />
            <input className={inputCls} type="number" step="0.01" placeholder="Fixa R$" value={custom.taxaFixa} onChange={e => setCustom(p => ({ ...p, taxaFixa: e.target.value }))} />
            <input className={inputCls} type="number" placeholder="Pix D+" value={custom.pixDias} onChange={e => setCustom(p => ({ ...p, pixDias: e.target.value }))} />
            <input className={inputCls} type="number" placeholder="Cartão D+" value={custom.cartaoDias} onChange={e => setCustom(p => ({ ...p, cartaoDias: e.target.value }))} />
          </div>
          <button onClick={salvarCustom} disabled={ocupado === 'custom'} className="mt-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            {ocupado === 'custom' ? 'Salvando…' : 'Adicionar plataforma'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AjusteOpcional({ cfg, onSalvar, ocupado }: { cfg: CanalVenda; onSalvar: (op: number | null, of: number | null) => void; ocupado: boolean }) {
  const ativo = cfg.overridePercent != null || cfg.overrideFixa != null
  const [aberto, setAberto] = useState(ativo)
  const [op, setOp] = useState(cfg.overridePercent != null ? String(cfg.overridePercent) : '')
  const [of, setOf] = useState(cfg.overrideFixa != null ? String(cfg.overrideFixa) : '')
  if (!aberto) return (
    <button onClick={() => setAberto(true)} className="text-xs text-orange-600 hover:text-orange-700">Ajustar minha taxa (opcional)</button>
  )
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
      <p className="text-xs text-gray-600 mb-2">Se a taxa da sua categoria for diferente, ajuste aqui. Em branco = usa a do SOA.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-600">Minha taxa %<input className={inputCls + ' mt-0.5 w-24'} type="number" step="any" value={op} onChange={e => setOp(e.target.value)} placeholder="—" /></label>
        <label className="text-xs text-gray-600">Fixa R$<input className={inputCls + ' mt-0.5 w-24'} type="number" step="0.01" value={of} onChange={e => setOf(e.target.value)} placeholder="—" /></label>
        <button onClick={() => onSalvar(op === '' ? null : Number(op), of === '' ? null : Number(of))} disabled={ocupado}
          className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"><Save className="w-3.5 h-3.5" /> Salvar ajuste</button>
      </div>
    </div>
  )
}
