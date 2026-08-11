'use client'
// Custos fixos & rateio — 2º modelo de precificação (opcional). A artesã ATIVA, informa
// os custos fixos do mês (pode puxar do Financeiro), escolhe o MÉTODO de rateio (com
// explicação + simulação) e vê o LUCRO REAL, ao lado da margem de contribuição.
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Info, Save, Download } from 'lucide-react'

type Metodo = 'unidades' | 'horas' | 'faturamento' | 'manual'
interface Item { nome: string; valor: number }
interface Config { ativo: boolean; metodo: Metodo; custoFixoMensal: number; itens: Item[]; unidadesMes: number; horasMes: number; faturamentoMes: number; valorManual: number; percentualPerda: number }
interface Sugestao { despesasFixas: number; faturamentoMes: number; pedidosMes: number }
interface MetodoInfo { id: Metodo; nome: string; explicacao: string }
interface Sim { custoFixoRateado: number; lucroContribuicao: number; lucroReal: number; margemContribuicao: number | null; margemReal: number | null }

const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

export default function CustosFixosPage() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [sug, setSug] = useState<Sugestao>({ despesasFixas: 0, faturamentoMes: 0, pedidosMes: 0 })
  const [metodos, setMetodos] = useState<MetodoInfo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const [simIn, setSimIn] = useState({ preco: '', custoVariavel: '', horasProduto: '' })
  const [sim, setSim] = useState<Sim | null>(null)
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  const carregar = useCallback(async () => {
    const r = await fetch('/api/precificacao/custos-fixos')
    if (r.ok) { const d = await r.json(); setCfg(d.config); setSug(d.sugestao); setMetodos(d.metodos ?? []) }
    setCarregando(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const patch = (p: Partial<Config>) => setCfg(c => c ? { ...c, ...p } : c)
  const total = (cfg?.itens || []).reduce((s, i) => s + (Number(i.valor) || 0), 0)

  async function salvar(over?: Partial<Config>) {
    if (!cfg) return
    setOcupado(true)
    const body = { ...cfg, ...over, custoFixoMensal: total }
    const r = await fetch('/api/precificacao/custos-fixos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setOcupado(false)
    if (r.ok) { const d = await r.json(); setCfg(d.config); flash('Salvo ✅') } else flash('Erro ao salvar')
  }
  async function toggleAtivo(v: boolean) { patch({ ativo: v }); await salvar({ ativo: v }) }

  async function simular() {
    if (!cfg) return
    const r = await fetch('/api/precificacao/custos-fixos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'simular', config: { ...cfg, custoFixoMensal: total }, preco: Number(simIn.preco) || 0, custoVariavel: Number(simIn.custoVariavel) || 0, horasProduto: Number(simIn.horasProduto) || 0 }),
    })
    if (r.ok) setSim(await r.json())
  }

  if (carregando || !cfg) return <div className="min-h-screen bg-gray-50 text-gray-500 flex items-center justify-center">Carregando…</div>

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/precificacao/produtos" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold text-gray-800">Custos fixos & lucro real</h1>
        </div>
        <p className="text-sm text-gray-500 mb-4">Sua precificação já mostra a <b>margem de contribuição</b> (preço − custos variáveis). Aqui, opcionalmente, você rateia os <b>custos fixos do mês</b> (aluguel, energia, pró-labore…) por peça e passa a ver o <b>lucro real</b>.</p>

        {msg && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 text-sm">{msg}</div>}

        {/* Ativar */}
        <div className="mb-5 bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <span><b className="text-sm">Ratear custos fixos na precificação</b><br /><span className="text-xs text-gray-500">Desligado = só margem de contribuição (como hoje). Ligado = soma o custo fixo por peça e mostra o lucro real.</span></span>
          <input type="checkbox" checked={cfg.ativo} onChange={e => toggleAtivo(e.target.checked)} className="w-5 h-5 accent-orange-500 flex-shrink-0" />
        </div>

        <div className={cfg.ativo ? '' : 'opacity-50 pointer-events-none'}>
          {/* Custos fixos do mês */}
          <div className="mb-5 bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Seus custos fixos do mês</p>
              <button onClick={() => patch({ itens: [...cfg.itens, { nome: 'Custos fixos (Financeiro)', valor: sug.despesasFixas }] })}
                className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Puxar do Financeiro ({brl(sug.despesasFixas)})</button>
            </div>
            <div className="space-y-2">
              {cfg.itens.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputCls} placeholder="Ex.: Aluguel, Energia, Pró-labore" value={it.nome} onChange={e => patch({ itens: cfg.itens.map((x, j) => j === i ? { ...x, nome: e.target.value } : x) })} />
                  <input className={inputCls + ' w-32'} type="number" step="0.01" placeholder="R$" value={it.valor || ''} onChange={e => patch({ itens: cfg.itens.map((x, j) => j === i ? { ...x, valor: Number(e.target.value) || 0 } : x) })} />
                  <button onClick={() => patch({ itens: cfg.itens.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 px-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => patch({ itens: [...cfg.itens, { nome: '', valor: 0 }] })} className="mt-2 text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar custo fixo</button>
            <p className="text-sm text-gray-700 mt-3">Total de custos fixos/mês: <b>{brl(total)}</b></p>
            <p className="text-xs text-gray-400 mt-1">Inclua o <b>pró-labore</b> (o seu salário) — o seu trabalho de dona também é custo.</p>
          </div>

          {/* Método de rateio */}
          <div className="mb-5 bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Como dividir os custos fixos entre as peças?</p>
            <div className="space-y-2">
              {metodos.map(m => (
                <label key={m.id} className={`block rounded-xl border p-3 cursor-pointer transition ${cfg.metodo === m.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="metodo" checked={cfg.metodo === m.id} onChange={() => patch({ metodo: m.id })} className="accent-orange-500" />
                    <span className="text-sm font-medium text-gray-800">{m.nome}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">{m.explicacao}</p>
                  {cfg.metodo === m.id && (
                    <div className="mt-2 ml-6">
                      {m.id === 'unidades' && <label className="text-xs text-gray-600">Peças que você produz por mês<input type="number" className={inputCls + ' mt-0.5 w-40'} value={cfg.unidadesMes || ''} placeholder={String(sug.pedidosMes || '')} onChange={e => patch({ unidadesMes: Number(e.target.value) || 0 })} /></label>}
                      {m.id === 'horas' && <label className="text-xs text-gray-600">Horas de produção por mês<input type="number" step="any" className={inputCls + ' mt-0.5 w-40'} value={cfg.horasMes || ''} placeholder="ex.: 160" onChange={e => patch({ horasMes: Number(e.target.value) || 0 })} /></label>}
                      {m.id === 'faturamento' && <label className="text-xs text-gray-600">Faturamento do mês (R$)<input type="number" step="0.01" className={inputCls + ' mt-0.5 w-40'} value={cfg.faturamentoMes || ''} placeholder={String(sug.faturamentoMes || '')} onChange={e => patch({ faturamentoMes: Number(e.target.value) || 0 })} /></label>}
                      {m.id === 'manual' && <label className="text-xs text-gray-600">Custo fixo por peça (R$)<input type="number" step="0.01" className={inputCls + ' mt-0.5 w-40'} value={cfg.valorManual || ''} onChange={e => patch({ valorManual: Number(e.target.value) || 0 })} /></label>}
                    </div>
                  )}
                </label>
              ))}
            </div>
            <label className="block text-xs text-gray-600 mt-3">Perda de material (%) — opcional<input type="number" step="0.1" className={inputCls + ' mt-0.5 w-32'} value={cfg.percentualPerda || ''} placeholder="ex.: 5" onChange={e => patch({ percentualPerda: Number(e.target.value) || 0 })} /></label>
            <button onClick={() => salvar()} disabled={ocupado} className="mt-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"><Save className="w-4 h-4" /> {ocupado ? 'Salvando…' : 'Salvar'}</button>
          </div>

          {/* Simulador */}
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Simular: contribuição × lucro real</p>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <label className="text-xs text-gray-600">Preço de venda<input type="number" step="0.01" className={inputCls + ' mt-0.5 w-28'} value={simIn.preco} onChange={e => setSimIn(s => ({ ...s, preco: e.target.value }))} /></label>
              <label className="text-xs text-gray-600">Custos variáveis<input type="number" step="0.01" className={inputCls + ' mt-0.5 w-28'} value={simIn.custoVariavel} onChange={e => setSimIn(s => ({ ...s, custoVariavel: e.target.value }))} /></label>
              {cfg.metodo === 'horas' && <label className="text-xs text-gray-600">Horas da peça<input type="number" step="any" className={inputCls + ' mt-0.5 w-24'} value={simIn.horasProduto} onChange={e => setSimIn(s => ({ ...s, horasProduto: e.target.value }))} /></label>}
              <button onClick={simular} className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">Calcular</button>
            </div>
            {sim && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-2"><p className="text-[11px] text-gray-500">Custo fixo na peça</p><p className="text-sm font-bold text-gray-700">{brl(sim.custoFixoRateado)}</p></div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-2"><p className="text-[11px] text-gray-500">Contribuição</p><p className="text-sm font-bold text-gray-700">{brl(sim.lucroContribuicao)}</p><p className="text-[11px] text-gray-400">{sim.margemContribuicao ?? '—'}%</p></div>
                <div className={`rounded-xl border p-2 ${sim.lucroReal < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}><p className="text-[11px] text-gray-500">Lucro REAL</p><p className={`text-sm font-bold ${sim.lucroReal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{brl(sim.lucroReal)}</p><p className="text-[11px] text-gray-400">{sim.margemReal ?? '—'}%</p></div>
              </div>
            )}
            {sim && sim.lucroReal < 0 && <p className="text-xs text-red-500 mt-2">⚠️ Nesse preço, depois dos custos fixos você fica no vermelho. Aumente o preço ou reduza custos.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
