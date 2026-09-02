'use client'
// Lançamentos pessoais (versão completa): lista + filtros (período/tipo/categoria/conta/status)
// + criar/editar (tipo, valor, data, CATEGORIA, CONTA, MÉTODO, recorrência, parcelamento, status).
import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Search, Check, Clock, Pencil, Trash2, X, Paperclip, ImageIcon, ArrowUpDown } from 'lucide-react'
import { comprimirImagem } from '@/lib/pessoal/imagemClient'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const METODOS = ['PIX', 'CARTAO', 'DINHEIRO', 'BOLETO', 'TED']
const metLabel = (m?: string) => ({ PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro', BOLETO: 'Boleto', TED: 'TED' } as any)[m || ''] || null
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const brDate = (s: string) => { const [y, m, d] = (s || '').slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : '—' }
function parseNum(s: unknown) { let x = String(s ?? '').trim(); if (!x) return 0; if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); const n = parseFloat(x); return isNaN(n) ? 0 : n }
const numStr = (n: number | undefined | null) => (n == null || n === 0 ? '' : String(n).replace('.', ','))

interface L { id: string; tipo: string; categoriaId?: string; contaId?: string; caixinhaId?: string; descricao: string; valor: number; data: string; metodo?: string; referencia?: string; observacoes?: string; status: string; recorrenciaId?: string; recorrencia?: string; parcela?: number; totalParcelas?: number; categoriaNome?: string; categoriaIcone?: string; contaNome?: string; caixinhaNome?: string; temComprovante?: boolean }
interface Cat { id: string; nome: string; tipo: string; cor: string; icone: string }
interface Conta { id: string; nome: string }
const inp = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
// versão compacta p/ a barra de filtros (menos altura, ocupa a célula do grid)
const fsel = 'w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-400'

function Inner() {
  const params = useSearchParams()
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear()); const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [fTipo, setFTipo] = useState(''); const [fStatus, setFStatus] = useState(''); const [fCat, setFCat] = useState(''); const [fConta, setFConta] = useState(''); const [busca, setBusca] = useState('')
  const [de, setDe] = useState(''); const [ate, setAte] = useState(''); const usaPeriodo = !!(de || ate)
  const [ordem, setOrdem] = useState('data_desc') // data_desc(padrão)/data_asc/valor_desc/valor_asc/desc_az
  const [rows, setRows] = useState<L[]>([]); const [cats, setCats] = useState<Cat[]>([]); const [contas, setContas] = useState<Conta[]>([]); const [caixinhas, setCaixinhas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [edit, setEdit] = useState<L | null>(null)
  const [form, setForm] = useState<any>({ tipo: 'DESPESA', status: 'PAGO' }); const [valorStr, setValorStr] = useState('')
  const [recorrencia, setRecorrencia] = useState(''); const [totalParcelas, setTotalParcelas] = useState('6')
  const [saving, setSaving] = useState(false)
  // comprovante: undefined = inalterado, null = remover, string = novo (base64)
  const [comp, setComp] = useState<string | null | undefined>(undefined); const [compBusy, setCompBusy] = useState(false)
  // flag "levar para minha agenda": agenda (=tarefa c/ prazo) e/ou nota pessoal vinculada + lembrete
  const [agenda, setAgenda] = useState(false); const [nota, setNota] = useState(false)
  const [lembreteDias, setLembreteDias] = useState('0') // ''=sem · '0'=no dia · '1'=1d antes · '3'=3d antes

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (usaPeriodo) { if (de) p.set('de', de); if (ate) p.set('ate', ate) }
      else { p.set('ano', String(ano)); p.set('mes', String(mes)) }
      if (fTipo) p.set('tipo', fTipo); if (fStatus) p.set('status', fStatus); if (fCat) p.set('categoriaId', fCat); if (fConta) p.set('contaId', fConta)
      const r = await fetch('/api/pessoal/financeiro/lancamentos?' + p); setRows(r.ok ? await r.json() : [])
    } finally { setLoading(false) }
  }, [ano, mes, de, ate, usaPeriodo, fTipo, fStatus, fCat, fConta])
  const fetchAux = async () => {
    const [c, ct, cx] = await Promise.all([fetch('/api/pessoal/financeiro/categorias'), fetch('/api/pessoal/contas'), fetch('/api/pessoal/caixinhas')])
    if (c.ok) setCats(await c.json()); if (ct.ok) setContas((await ct.json()).map((x: any) => ({ id: x.id, nome: x.nome })))
    if (cx.ok) setCaixinhas((await cx.json()).map((x: any) => ({ id: x.id, nome: x.nome })))
  }
  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchAux() }, [])
  useEffect(() => { if (params.get('novo') === '1') openNovo() }, [params])

  function openNovo() { setEdit(null); setForm({ tipo: 'DESPESA', status: 'PAGO', data: new Date().toISOString().slice(0, 10) }); setValorStr(''); setRecorrencia(''); setComp(undefined); setAgenda(false); setNota(false); setLembreteDias('0'); setModal(true) }
  function openEdit(l: L) {
    setEdit(l); setForm({ ...l }); setValorStr(numStr(l.valor)); setRecorrencia(''); setComp(undefined); setAgenda(false); setNota(false); setLembreteDias('0'); setModal(true)
    // pré-marca os toggles + lembrete conforme o vínculo já existente (senão salvar apagaria).
    fetch(`/api/pessoal/vinculo?origemId=${l.id}&origemTipo=financeiro_pessoal`).then(r => r.ok ? r.json() : null).then(v => { if (v) { setAgenda(!!v.agenda); setNota(!!v.nota); setLembreteDias(v.lembreteDias == null ? '' : String(v.lembreteDias)) } }).catch(() => {})
  }
  async function escolherComp(file?: File) { if (!file) return; setCompBusy(true); try { setComp(await comprimirImagem(file)) } catch { alert('Não foi possível ler a imagem.') } finally { setCompBusy(false) } }

  async function salvar() {
    if (!form.descricao || parseNum(valorStr) <= 0 || !form.data) return alert('Preencha descrição, valor e data.')
    setSaving(true)
    try {
      const semAgenda = !!(recorrencia || edit?.recorrenciaId) // agenda/nota não se aplica a recorrência
      const usaAgenda = !semAgenda && agenda
      const body: any = { ...form, valor: parseNum(valorStr), recorrencia: edit ? null : (recorrencia || null), totalParcelas: recorrencia === 'PARCELAS' ? Number(totalParcelas) : null, agenda: semAgenda ? false : agenda, nota: semAgenda ? false : nota, lembreteDias: usaAgenda && lembreteDias !== '' ? Number(lembreteDias) : null }
      if (comp !== undefined) body.comprovante = comp === null ? '' : comp
      const url = edit ? `/api/pessoal/financeiro/lancamentos/${edit.id}` : '/api/pessoal/financeiro/lancamentos'
      await fetch(url, { method: edit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setModal(false); fetchRows()
    } finally { setSaving(false) }
  }
  async function toggle(l: L) { await fetch(`/api/pessoal/financeiro/lancamentos/${l.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: l.status === 'PAGO' ? 'PENDENTE' : 'PAGO' }) }); fetchRows() }
  async function excluir(l: L) { if (!confirm('Excluir este lançamento?')) return; await fetch(`/api/pessoal/financeiro/lancamentos/${l.id}${l.recorrenciaId ? '?deletarFuturos=true' : ''}`, { method: 'DELETE' }); fetchRows() }

  const bq = busca.trim().toLowerCase()
  const filtered = rows.filter(r => !bq || r.descricao.toLowerCase().includes(bq) || (r.categoriaNome || '').toLowerCase().includes(bq) || (r.contaNome || '').toLowerCase().includes(bq) || String(r.valor).includes(bq) || fmt(r.valor).toLowerCase().includes(bq))
  const somaR = filtered.filter(r => r.tipo === 'RECEITA' && r.status === 'PAGO').reduce((s, r) => s + r.valor, 0)
  const somaD = filtered.filter(r => r.tipo === 'DESPESA' && r.status === 'PAGO').reduce((s, r) => s + r.valor, 0)
  // Ordenação client-side (não altera filtros/totais); estável, então data_desc preserva a ordem createdAt vinda da API.
  const ordenados = [...filtered].sort((a, b) => {
    switch (ordem) {
      case 'data_asc': return a.data.localeCompare(b.data)
      case 'valor_desc': return b.valor - a.valor
      case 'valor_asc': return a.valor - b.valor
      case 'desc_az': return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR')
      default: return b.data.localeCompare(a.data) // data_desc
    }
  })
  const catsForm = cats.filter(c => c.tipo === form.tipo)
  const nFiltros = [fTipo, fStatus, fCat, fConta, busca.trim(), usaPeriodo ? '1' : ''].filter(Boolean).length
  function limparFiltros() { setFTipo(''); setFStatus(''); setFCat(''); setFConta(''); setBusca(''); setDe(''); setAte('') }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/pessoal/financeiro" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Entradas e Saídas</h1>
        </div>
        <button onClick={openNovo} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"><Plus className="w-4 h-4" /> Novo</button>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 p-3 space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
          <select aria-label="Mês" value={mes} onChange={e => setMes(Number(e.target.value))} disabled={usaPeriodo} className={fsel + ' disabled:opacity-40'}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
          <select aria-label="Ano" value={ano} onChange={e => setAno(Number(e.target.value))} disabled={usaPeriodo} className={fsel + ' disabled:opacity-40'}>{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
          {/* De → Até dividem uma célula (não gastam 2 colunas) */}
          <div className="col-span-2 md:col-span-1 xl:col-span-2 flex items-center gap-1">
            <input aria-label="Início do período" type="date" value={de} onChange={e => setDe(e.target.value)} className={fsel + ' flex-1 min-w-0'} />
            <span className="text-[11px] text-gray-400 shrink-0">até</span>
            <input aria-label="Fim do período" type="date" value={ate} onChange={e => setAte(e.target.value)} className={fsel + ' flex-1 min-w-0'} />
          </div>
          <select aria-label="Tipo" value={fTipo} onChange={e => setFTipo(e.target.value)} className={fsel}><option value="">Tipo</option><option value="RECEITA">Receitas</option><option value="DESPESA">Despesas</option></select>
          <select aria-label="Status" value={fStatus} onChange={e => setFStatus(e.target.value)} className={fsel}><option value="">Status</option><option value="PAGO">Pago</option><option value="PENDENTE">Pendente</option></select>
          {cats.length > 0 && <select aria-label="Categoria" value={fCat} onChange={e => setFCat(e.target.value)} className={fsel}><option value="">Categoria</option>{cats.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}</select>}
          {contas.length > 0 && <select aria-label="Conta" value={fConta} onChange={e => setFConta(e.target.value)} className={fsel}><option value="">Conta</option><option value="__sem__">Sem conta</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
          <div className="relative col-span-2 md:col-span-3 xl:col-span-4"><Search className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" /><input aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por descrição, categoria, conta ou valor…" className={fsel + ' pl-8'} /></div>
        </div>
        {nFiltros > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">{nFiltros} filtro{nFiltros > 1 ? 's' : ''} ativo{nFiltros > 1 ? 's' : ''}</span>
            <button onClick={limparFiltros} className="text-xs text-orange-500 hover:underline">Limpar filtros</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-green-50 dark:bg-green-900/15 p-3"><p className="text-xs text-green-600">Receitas</p><p className="font-bold text-green-700 dark:text-green-400">{fmt(somaR)}</p></div>
        <div className="rounded-xl bg-red-50 dark:bg-red-900/15 p-3"><p className="text-xs text-red-600">Despesas</p><p className="font-bold text-red-700 dark:text-red-400">{fmt(somaD)}</p></div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/15 p-3"><p className="text-xs text-blue-600">Resultado</p><p className="font-bold text-blue-700 dark:text-blue-400">{fmt(somaR - somaD)}</p></div>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400">{filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}</span>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select aria-label="Ordenar lançamentos" value={ordem} onChange={e => setOrdem(e.target.value)} className="border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-2 py-1 text-xs text-gray-600 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="data_desc">Data ↓ (mais recente)</option>
              <option value="data_asc">Data ↑ (mais antiga)</option>
              <option value="valor_desc">Valor ↓ (maior)</option>
              <option value="valor_asc">Valor ↑ (menor)</option>
              <option value="desc_az">Descrição A–Z</option>
            </select>
          </label>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
        {loading ? <p className="text-center py-10 text-gray-400 text-sm">Carregando…</p> : filtered.length === 0 ? <p className="text-center py-10 text-gray-400 text-sm">Nenhum lançamento.</p> : (
          <div className="divide-y divide-gray-50 dark:divide-neutral-800">
            {ordenados.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50/50 dark:hover:bg-neutral-800/40">
                <span className="text-gray-400 text-xs w-14">{brDate(l.data)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 dark:text-neutral-100 truncate">{l.categoriaIcone || ''} {l.descricao}{l.parcela ? <span className="text-[10px] text-gray-400 ml-1">{l.parcela}/{l.totalParcelas}</span> : ''}</p>
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">{l.categoriaNome || 'sem categoria'}{l.contaNome ? ` · ${l.contaNome}` : ''}{metLabel(l.metodo) ? ` · ${metLabel(l.metodo)}` : ''}{l.caixinhaNome ? ` · 🐷 ${l.caixinhaNome}` : ''}{l.temComprovante && <Paperclip className="w-3 h-3 text-gray-400" />}</p>
                </div>
                <button onClick={() => toggle(l)} className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${l.status === 'PAGO' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{l.status === 'PAGO' ? <><Check className="w-3 h-3 inline" /> pago</> : <><Clock className="w-3 h-3 inline" /> pendente</>}</button>
                <span className={`font-semibold tabular-nums w-24 text-right ${l.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{l.tipo === 'RECEITA' ? '+' : '−'}{fmt(l.valor)}</span>
                <button onClick={() => openEdit(l)} className="p-1 text-gray-400 hover:text-orange-500"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => excluir(l)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800 dark:text-neutral-100">{edit ? 'Editar' : 'Novo'} lançamento</h2><button onClick={() => setModal(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="flex gap-2">{(['RECEITA', 'DESPESA'] as const).map(t => <button key={t} onClick={() => setForm((f: any) => ({ ...f, tipo: t, categoriaId: undefined }))} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${form.tipo === t ? (t === 'RECEITA' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700') : 'border-gray-200 dark:border-neutral-700 text-gray-500'}`}>{t === 'RECEITA' ? '↑ Receita' : '↓ Despesa'}</button>)}</div>
            <input value={form.descricao || ''} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição *" className={inp} />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" inputMode="decimal" value={valorStr} onChange={e => setValorStr(e.target.value)} placeholder="Valor * (0,00)" className={inp} />
              <input type="date" value={form.data || ''} onChange={e => setForm((f: any) => ({ ...f, data: e.target.value }))} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.categoriaId || ''} onChange={e => setForm((f: any) => ({ ...f, categoriaId: e.target.value || undefined }))} className={inp}><option value="">Categoria</option>{catsForm.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}</select>
              <select value={form.contaId || ''} onChange={e => setForm((f: any) => ({ ...f, contaId: e.target.value || undefined }))} className={inp}><option value="">Conta</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.metodo || ''} onChange={e => setForm((f: any) => ({ ...f, metodo: e.target.value || undefined }))} className={inp}><option value="">Método</option>{METODOS.map(m => <option key={m} value={m}>{metLabel(m)}</option>)}</select>
              <div className="flex gap-2">{(['PAGO', 'PENDENTE'] as const).map(s => <button key={s} onClick={() => setForm((f: any) => ({ ...f, status: s }))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 ${form.status === s ? (s === 'PAGO' ? 'bg-green-50 border-green-400 text-green-700' : 'bg-yellow-50 border-yellow-400 text-yellow-700') : 'border-gray-200 dark:border-neutral-700 text-gray-500'}`}>{s === 'PAGO' ? '✓ Pago' : '⏳ Pendente'}</button>)}</div>
            </div>
            {caixinhas.length > 0 && !edit?.recorrenciaId && (
              <div>
                <select value={form.caixinhaId || ''} onChange={e => setForm((f: any) => ({ ...f, caixinhaId: e.target.value || undefined }))} className={inp}><option value="">🐷 Caixinha (opcional)</option>{caixinhas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                {form.caixinhaId && <p className="text-[11px] text-gray-400 mt-1">{form.tipo === 'RECEITA' ? 'Vai depositar nesta caixinha.' : 'Vai descontar desta caixinha (envelope).'}</p>}
              </div>
            )}
            {!recorrencia && !edit?.recorrenciaId && (
              <div className="rounded-lg border border-dashed border-gray-200 dark:border-neutral-700 p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">📌 Levar para minha agenda</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAgenda(a => !a)} className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 ${agenda ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 text-orange-700 dark:text-orange-300' : 'border-gray-200 dark:border-neutral-700 text-gray-500'}`}>📅 Agenda / Tarefa</button>
                  <button type="button" onClick={() => setNota(n => !n)} className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 ${nota ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 text-orange-700 dark:text-orange-300' : 'border-gray-200 dark:border-neutral-700 text-gray-500'}`}>📝 Nota</button>
                </div>
                {agenda && (
                  <div className="mt-2">
                    <p className="text-[11px] text-gray-400 mb-1">Cria uma tarefa com vencimento na data — já aparece na sua agenda.</p>
                    <select aria-label="Lembrete" value={lembreteDias} onChange={e => setLembreteDias(e.target.value)} className={inp + ' py-1.5 text-xs'}>
                      <option value="">🔔 Sem lembrete</option>
                      <option value="0">🔔 Lembrar no dia do vencimento (9h)</option>
                      <option value="1">🔔 Lembrar 1 dia antes</option>
                      <option value="3">🔔 Lembrar 3 dias antes</option>
                    </select>
                  </div>
                )}
              </div>
            )}
            {!edit && (
              <div>
                <div className="flex gap-2">{([['', 'Único'], ['MENSAL', '🔄 Mensal'], ['PARCELAS', '📆 Parcelado']] as const).map(([v, l]) => <button key={v} onClick={() => setRecorrencia(v)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${recorrencia === v ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 dark:border-neutral-700 text-gray-500'}`}>{l}</button>)}</div>
                {recorrencia === 'PARCELAS' && <input type="number" min="2" max="60" value={totalParcelas} onChange={e => setTotalParcelas(e.target.value)} className={inp + ' mt-2'} placeholder="Nº de parcelas" />}
              </div>
            )}
            <input value={form.observacoes || ''} onChange={e => setForm((f: any) => ({ ...f, observacoes: e.target.value }))} placeholder="Observações" className={inp} />
            {/* Comprovante (foto da compra) */}
            <div className="rounded-lg border border-dashed border-gray-200 dark:border-neutral-700 p-3">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Comprovante</p>
              {(() => {
                const src = typeof comp === 'string' ? comp : (comp === undefined && edit?.temComprovante ? `/api/pessoal/financeiro/lancamentos/${edit.id}/comprovante` : null)
                if (src) return (
                  <div className="flex items-center gap-3">
                    <a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt="comprovante" className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-neutral-700" /></a>
                    <label className="text-xs text-orange-500 cursor-pointer hover:underline">Trocar<input type="file" accept="image/*" className="hidden" onChange={e => escolherComp(e.target.files?.[0])} /></label>
                    <button type="button" onClick={() => setComp(null)} className="text-xs text-red-500 hover:underline">Remover</button>
                  </div>
                )
                return <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-orange-500"><ImageIcon className="w-4 h-4" /> {compBusy ? 'Processando…' : (comp === null ? 'Removido — anexar outro' : 'Anexar foto da compra')}<input type="file" accept="image/*" className="hidden" onChange={e => escolherComp(e.target.files?.[0])} /></label>
              })()}
            </div>
            <div className="flex justify-end gap-2 pt-1"><button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button><button onClick={salvar} disabled={saving} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Page() { return <Suspense fallback={null}><Inner /></Suspense> }
