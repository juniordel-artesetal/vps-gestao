'use client'
// app/financeiro/lancamentos/page.tsx
import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Check, Clock, Pencil, Trash2, X } from 'lucide-react'

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d: any) {
  if (!d) return '—'
  const s = d instanceof Date ? d.toISOString() : String(d)
  const [y, m, dia] = s.substring(0, 10).split('-')
  if (!y || !m || !dia) return '—'
  return `${dia}/${m}/${y}`
}
function isoDate(d: Date) { return d.toISOString().split('T')[0] }

const MESES   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const CANAIS  = ['shopee','mercado_livre','elo7','direta','instagram','outro']
const inputClass  = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
const selectClass = inputClass + " bg-white"

interface Lancamento {
  id: string; tipo: string; descricao: string
  valor: number; valorRealizado?: number
  data: string; dataRealizada?: string
  status: string; canal?: string; referencia?: string; observacoes?: string
  categoriaId?: string; categoriaNome?: string; categoriaCor?: string; categoriaIcone?: string
  recorrenciaId?: string; recorrencia?: string; parcela?: number; totalParcelas?: number
}
interface Categoria { id: string; nome: string; tipo: string; cor: string; icone: string }

const EMPTY: Partial<Lancamento> = { tipo: 'RECEITA', status: 'PENDENTE' }
type RecorrenciaTipo = '' | 'MENSAL' | 'PARCELAS'

export default function LancamentosPage() {
  const hoje = new Date()
  const [ano, setAno]         = useState(hoje.getFullYear())
  const [mes, setMes]         = useState(hoje.getMonth() + 1)
  const [filtroTipo, setFT]   = useState('')
  const [filtroStatus, setFS] = useState('')
  const [busca, setBusca]     = useState('')
  const [rows, setRows]       = useState<Lancamento[]>([])
  const [cats, setCats]       = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editRow, setEditRow] = useState<Lancamento | null>(null)
  const [form, setForm]       = useState<Partial<Lancamento>>(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [delId, setDelId]     = useState<string | null>(null)
  const [recorrencia, setRecorrencia]     = useState<RecorrenciaTipo>('')
  const [totalParcelas, setTotalParcelas] = useState('6')
  const [modalConfirm, setModalConfirm]   = useState<{
    tipo: 'editar' | 'deletar'; id: string; temRecorrencia: boolean
  } | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ ano: String(ano), mes: String(mes) })
      if (filtroTipo)   p.set('tipo', filtroTipo)
      if (filtroStatus) p.set('status', filtroStatus)
      const res = await fetch('/api/financeiro/lancamentos?' + p)
      setRows(await res.json())
    } finally { setLoading(false) }
  }, [ano, mes, filtroTipo, filtroStatus])

  const fetchCats = async () => {
    const res = await fetch('/api/financeiro/categorias')
    setCats(await res.json())
  }

  useEffect(() => { fetchRows(); fetchCats() }, [fetchRows])

  const catsFiltradas = cats.filter(c => !form.tipo || c.tipo === form.tipo)

  const openModal = (row?: Lancamento) => {
    setEditRow(row || null)
    setForm(row ? { ...row } : { ...EMPTY, data: isoDate(new Date()) })
    setModal(true)
  }
  const closeModal = () => { setModal(false); setEditRow(null) }

  const handleSave = async (alterarFuturos = false) => {
    if (!form.descricao || !form.valor || !form.data)
      return alert('Preencha: descrição, valor e data.')
    if (editRow?.recorrenciaId && !alterarFuturos && !modalConfirm) {
      setModalConfirm({ tipo: 'editar', id: editRow.id, temRecorrencia: true })
      return
    }
    setSaving(true)
    try {
      const url    = editRow ? `/api/financeiro/lancamentos/${editRow.id}` : '/api/financeiro/lancamentos'
      const method = editRow ? 'PUT' : 'POST'
      const body   = editRow
        ? { ...form, alterarFuturos }
        : { ...form, recorrencia: recorrencia || null, totalParcelas: recorrencia === 'PARCELAS' ? Number(totalParcelas) : null }
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setModalConfirm(null)
      closeModal(); fetchRows()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string, deletarFuturos = false) => {
    setDelId(id)
    await fetch(`/api/financeiro/lancamentos/${id}?deletarFuturos=${deletarFuturos}`, { method: 'DELETE' })
    setDelId(null); setModalConfirm(null); fetchRows()
  }

  const confirmarDelete = (row: Lancamento) => {
    if (row.recorrenciaId) {
      setModalConfirm({ tipo: 'deletar', id: row.id, temRecorrencia: true })
    } else {
      handleDelete(row.id)
    }
  }

  const marcarPago = async (row: Lancamento) => {
    const updated = { ...row, status: 'PAGO', dataRealizada: row.dataRealizada || isoDate(new Date()), valorRealizado: row.valorRealizado || row.valor }
    await fetch(`/api/financeiro/lancamentos/${row.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    fetchRows()
  }

  const filtered = rows.filter(r =>
    !busca || r.descricao.toLowerCase().includes(busca.toLowerCase()) || (r.categoriaNome || '').toLowerCase().includes(busca.toLowerCase())
  )

  const totalReceita = filtered.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + (r.valorRealizado || r.valor), 0)
  const totalDespesa = filtered.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + (r.valorRealizado || r.valor), 0)

  return (
    <div className="p-6 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lançamentos</h1>
          <p className="text-sm text-gray-500">Receitas e despesas do ateliê</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
          <Plus className="w-4 h-4" /> Novo Lançamento
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFT(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">Todos os tipos</option>
          <option value="RECEITA">Receitas</option>
          <option value="DESPESA">Despesas</option>
        </select>
        <select value={filtroStatus} onChange={e => setFS(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">Todos os status</option>
          <option value="PAGO">Pago</option>
          <option value="PENDENTE">Pendente</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
            className="w-full pl-8 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
          <p className="text-xs text-green-600 font-medium">Total Receitas</p>
          <p className="text-lg font-bold text-green-700">{fmtR(totalReceita)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
          <p className="text-xs text-red-600 font-medium">Total Despesas</p>
          <p className="text-lg font-bold text-red-700">{fmtR(totalDespesa)}</p>
        </div>
        <div className={`rounded-xl p-3 border ${totalReceita - totalDespesa >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <p className={`text-xs font-medium ${totalReceita - totalDespesa >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Resultado</p>
          <p className={`text-lg font-bold ${totalReceita - totalDespesa >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmtR(totalReceita - totalDespesa)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Canal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Previsto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Realizado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">Carregando...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                  Nenhum lançamento encontrado.
                  <button onClick={() => openModal()} className="block mx-auto mt-2 text-orange-500 hover:underline text-xs">+ Adicionar primeiro lançamento</button>
                </td></tr>
              )}
              {filtered.map(row => (
                <tr key={row.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-600">{fmtDate(row.data)}</td>
                  <td className="px-4 py-3">
                    {row.categoriaNome
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: (row.categoriaCor || '#7c3aed') + '20', color: row.categoriaCor || '#7c3aed' }}>
                          {row.categoriaIcone} {row.categoriaNome}
                        </span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{row.descricao}</p>
                    {row.referencia && <p className="text-xs text-gray-400">{row.referencia}</p>}
                    {row.recorrencia === 'MENSAL' && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">🔄 Mensal</span>
                    )}
                    {row.recorrencia === 'PARCELAS' && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">
                        📆 {row.parcela}/{row.totalParcelas}x
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize text-xs">{row.canal?.replace('_', ' ') || '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{fmtR(row.valor)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.tipo === 'RECEITA' ? 'text-green-700' : 'text-red-700'}`}>
                    {row.valorRealizado ? fmtR(row.valorRealizado) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.status === 'PAGO'
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium"><Check className="w-3 h-3" /> PAGO</span>
                      : <button onClick={() => marcarPago(row)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium hover:bg-yellow-100">
                          <Clock className="w-3 h-3" /> PENDENTE
                        </button>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openModal(row)} className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => confirmarDelete(row)} disabled={delId === row.id} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-bold text-gray-800">{editRow ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Tipo */}
              <div className="flex gap-3">
                {(['RECEITA', 'DESPESA'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t, categoriaId: undefined }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      form.tipo === t
                        ? t === 'RECEITA' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
                        : 'border-gray-200 text-gray-500'
                    }`}>
                    {t === 'RECEITA' ? '↑ Receita' : '↓ Despesa'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Categoria</label>
                  <select value={form.categoriaId || ''} onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))} className={selectClass}>
                    <option value="">Sem categoria</option>
                    {catsFiltradas.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Canal</label>
                  <select value={form.canal || ''} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className={selectClass}>
                    <option value="">—</option>
                    {CANAIS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Descrição *</label>
                <input value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Venda laços de cabelo — Shopee" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Valor Previsto *</label>
                  <input type="number" step="0.01" min="0" value={form.valor || ''}
                    onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) }))} placeholder="0,00" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Data Prevista *</label>
                  <input type="date" value={form.data || ''} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={inputClass} />
                </div>
              </div>

              {/* Status */}
              <div className="flex gap-3">
                {(['PENDENTE', 'PAGO'] as const).map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      form.status === s
                        ? s === 'PAGO' ? 'bg-green-50 border-green-400 text-green-700' : 'bg-yellow-50 border-yellow-400 text-yellow-700'
                        : 'border-gray-200 text-gray-500'
                    }`}>
                    {s === 'PAGO' ? '✓ Pago' : '⏳ Pendente'}
                  </button>
                ))}
              </div>

              {/* Recorrência — só para novos lançamentos */}
              {!editRow && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-2">Recorrência</label>
                  <div className="flex gap-2">
                    {([['', 'Sem recorrência'], ['MENSAL', '🔄 Mensal'], ['PARCELAS', '📆 Parcelado']] as const).map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setRecorrencia(val as RecorrenciaTipo)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${
                          recorrencia === val
                            ? 'bg-blue-50 border-blue-400 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {recorrencia === 'MENSAL' && (
                    <p className="text-xs text-blue-600 mt-1.5">
                      🔄 Serão criados 24 lançamentos mensais a partir da data informada
                    </p>
                  )}
                  {recorrencia === 'PARCELAS' && (
                    <div className="mt-2">
                      <label className="text-xs font-medium text-gray-500 block mb-1">Número de parcelas</label>
                      <input type="number" min="2" max="60" value={totalParcelas}
                        onChange={e => setTotalParcelas(e.target.value)}
                        className={inputClass} placeholder="Ex: 6" />
                      <p className="text-xs text-orange-600 mt-1">
                        📆 Serão criados {totalParcelas} lançamentos mensais com indicador (1/{totalParcelas}), (2/{totalParcelas})...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {form.status === 'PAGO' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Valor Realizado</label>
                    <input type="number" step="0.01" min="0" value={form.valorRealizado || ''}
                      onChange={e => setForm(f => ({ ...f, valorRealizado: Number(e.target.value) }))}
                      placeholder={String(form.valor || 0)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Data Realizada</label>
                    <input type="date" value={form.dataRealizada || ''}
                      onChange={e => setForm(f => ({ ...f, dataRealizada: e.target.value }))} className={inputClass} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Referência</label>
                <input value={form.referencia || ''} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                  placeholder="Ex: Pedido #12345" className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Observações</label>
                <textarea value={form.observacoes || ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2} className={inputClass} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={() => handleSave()} disabled={saving}
                className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'Salvando...' : editRow ? 'Salvar Alterações' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal confirmação recorrência ── */}
      {modalConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl p-6">
            {modalConfirm.tipo === 'deletar' ? (
              <>
                <h3 className="font-bold text-gray-800 mb-2">Excluir lançamento recorrente</h3>
                <p className="text-sm text-gray-500 mb-5">Este lançamento faz parte de uma série. O que deseja fazer?</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleDelete(modalConfirm.id, false)}
                    className="w-full py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                    Excluir somente este
                  </button>
                  <button onClick={() => handleDelete(modalConfirm.id, true)}
                    className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">
                    Excluir este e os próximos pendentes
                  </button>
                  <button onClick={() => setModalConfirm(null)}
                    className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-gray-800 mb-2">Editar lançamento recorrente</h3>
                <p className="text-sm text-gray-500 mb-5">Este lançamento faz parte de uma série. O que deseja alterar?</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleSave(false)} disabled={saving}
                    className="w-full py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Somente este lançamento
                  </button>
                  <button onClick={() => handleSave(true)} disabled={saving}
                    className="w-full py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Este e os próximos pendentes'}
                  </button>
                  <button onClick={() => setModalConfirm(null)}
                    className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
