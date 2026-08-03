'use client'
// Contas bancárias / carteiras — saldos, transferência e conciliação.
import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, ArrowRightLeft, Landmark, PiggyBank, Wallet, Banknote, CheckCircle2, Loader2 } from 'lucide-react'

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brDate = (s: string) => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—'
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

const TIPOS = [
  { id: 'CONTA_CORRENTE', nome: 'Conta corrente', icon: Landmark },
  { id: 'POUPANCA', nome: 'Poupança / Porquinho', icon: PiggyBank },
  { id: 'CARTEIRA_MKT', nome: 'Carteira de marketplace', icon: Wallet },
  { id: 'DINHEIRO', nome: 'Dinheiro (caixa físico)', icon: Banknote },
]
const tipoInfo = (t: string) => TIPOS.find(x => x.id === t) || TIPOS[0]

interface Conta {
  id: string; nome: string; tipo: string; banco: string | null; saldoInicial: number
  rendimento: number | null; ativo: boolean; saldo: number; entradas: number; saidas: number
  transfIn: number; transfOut: number; aReceber: number; aPagar: number; naoConciliados: number
}

export default function ContasPage() {
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [modalConta, setModalConta] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ nome: '', tipo: 'CONTA_CORRENTE', banco: '', saldoInicial: '', rendimento: '' })
  const [modalTransf, setModalTransf] = useState(false)
  const [transf, setTransf] = useState<any>({ contaOrigemId: '', contaDestinoId: '', valor: '', data: new Date().toISOString().slice(0, 10), descricao: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  // Conciliação
  const [concConta, setConcConta] = useState<Conta | null>(null)
  const [concRows, setConcRows] = useState<any[]>([])
  const [concLoading, setConcLoading] = useState(false)
  const [extrato, setExtrato] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/financeiro/contas')
      if (r.ok) setContas((await r.json()).contas || [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  function novaConta() { setEditId(null); setForm({ nome: '', tipo: 'CONTA_CORRENTE', banco: '', saldoInicial: '', rendimento: '' }); setModalConta(true) }
  function editarConta(c: Conta) { setEditId(c.id); setForm({ nome: c.nome, tipo: c.tipo, banco: c.banco || '', saldoInicial: String(c.saldoInicial), rendimento: c.rendimento != null ? String(c.rendimento) : '' }); setModalConta(true) }
  async function salvarConta() {
    if (!form.nome.trim()) return flash('Informe o nome da conta')
    setSalvando(true)
    try {
      const url = editId ? `/api/financeiro/contas/${editId}` : '/api/financeiro/contas'
      const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { setModalConta(false); flash(editId ? 'Conta atualizada' : 'Conta criada'); carregar() }
      else flash((await res.json()).error || 'Erro ao salvar')
    } finally { setSalvando(false) }
  }
  async function excluirConta(c: Conta) {
    if (!confirm(`Excluir "${c.nome}"? Os lançamentos vinculados ficam sem conta (não são apagados).`)) return
    await fetch(`/api/financeiro/contas/${c.id}`, { method: 'DELETE' }); flash('Conta excluída'); carregar()
  }
  async function salvarTransf() {
    if (!transf.contaOrigemId || !transf.contaDestinoId || !(Number(transf.valor) > 0)) return flash('Preencha origem, destino e valor')
    setSalvando(true)
    try {
      const res = await fetch('/api/financeiro/contas/transferencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transf) })
      if (res.ok) { setModalTransf(false); setTransf({ contaOrigemId: '', contaDestinoId: '', valor: '', data: new Date().toISOString().slice(0, 10), descricao: '' }); flash('Transferência registrada'); carregar() }
      else flash((await res.json()).error || 'Erro na transferência')
    } finally { setSalvando(false) }
  }

  async function abrirConciliacao(c: Conta) {
    setConcConta(c); setExtrato(''); setConcLoading(true); setConcRows([])
    try {
      const r = await fetch(`/api/financeiro/lancamentos?contaId=${c.id}&status=PAGO`)
      if (r.ok) setConcRows(await r.json())
    } finally { setConcLoading(false) }
  }
  async function toggleConciliado(row: any) {
    const novo = !row.conciliado
    setConcRows(rows => rows.map(x => x.id === row.id ? { ...x, conciliado: novo } : x))
    await fetch(`/api/financeiro/lancamentos/${row.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conciliado: novo }) })
    carregar()
  }

  const totalGeral = contas.reduce((s, c) => s + c.saldo, 0)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contas & Conciliação</h1>
          <p className="text-sm text-gray-500">Banco, porquinho, carteira de marketplace — saldo por conta e conciliação.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalTransf(true)} disabled={contas.length < 2}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium disabled:opacity-50">
            <ArrowRightLeft className="w-4 h-4" /> Transferência
          </button>
          <button onClick={novaConta} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Nova conta
          </button>
        </div>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-2.5">{msg}</div>}

      {loading ? <div className="text-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div> : contas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500 text-sm">
          Nenhuma conta ainda. Cadastre suas contas (banco, porquinho, carteira Shopee…) para conciliar.
          <button onClick={novaConta} className="block mx-auto mt-2 text-orange-500 hover:underline text-xs">+ Nova conta</button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Saldo total (todas as contas)</span>
            <span className={`text-xl font-bold ${totalGeral >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{brl(totalGeral)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contas.map(c => {
              const Ti = tipoInfo(c.tipo)
              const Icon = Ti.icon
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0"><Icon className="w-4.5 h-4.5" size={18} /></div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{c.nome}</p>
                        <p className="text-[11px] text-gray-400">{Ti.nome}{c.banco ? ` · ${c.banco}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => editarConta(c)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => excluirConta(c)} className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className={`text-2xl font-bold mt-3 ${c.saldo >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{brl(c.saldo)}</p>
                  <div className="text-[11px] text-gray-400 mt-1 space-y-0.5">
                    {(c.aReceber > 0 || c.aPagar > 0) && <p>{c.aReceber > 0 ? `A receber ${brl(c.aReceber)}` : ''}{c.aReceber > 0 && c.aPagar > 0 ? ' · ' : ''}{c.aPagar > 0 ? `A pagar ${brl(c.aPagar)}` : ''}</p>}
                    {c.rendimento != null && <p>Rendimento: {c.rendimento}% (informativo)</p>}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    {c.naoConciliados > 0
                      ? <span className="text-[11px] text-amber-600 font-medium">{c.naoConciliados} a conciliar</span>
                      : <span className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> conciliado</span>}
                    <button onClick={() => abrirConciliacao(c)} className="text-xs text-orange-600 hover:underline font-medium">Conciliar →</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal nova/editar conta */}
      {modalConta && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">{editId ? 'Editar conta' : 'Nova conta'}</h2>
              <button onClick={() => setModalConta(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-3">
              <div><label className="text-xs text-gray-500 block mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} className={inp} placeholder="Ex.: Banco Inter, Porquinho, Carteira Shopee" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} className={inp}>
                  {TIPOS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Banco (opcional)</label>
                  <input value={form.banco} onChange={e => setForm((f: any) => ({ ...f, banco: e.target.value }))} className={inp} placeholder="Ex.: Inter" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Saldo inicial (R$)</label>
                  <input type="number" step="0.01" value={form.saldoInicial} onChange={e => setForm((f: any) => ({ ...f, saldoInicial: e.target.value }))} className={inp} placeholder="0,00" /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Rendimento % (opcional, informativo)</label>
                <input type="number" step="0.01" value={form.rendimento} onChange={e => setForm((f: any) => ({ ...f, rendimento: e.target.value }))} className={inp} placeholder="Ex.: 0,5" /></div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModalConta(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarConta} disabled={salvando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal transferência */}
      {modalTransf && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-orange-500" /> Transferência entre contas</h2>
              <button onClick={() => setModalTransf(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-gray-400">Move saldo de uma conta para outra. Não conta como receita nem despesa.</p>
              <div><label className="text-xs text-gray-500 block mb-1">De (origem)</label>
                <select value={transf.contaOrigemId} onChange={e => setTransf((t: any) => ({ ...t, contaOrigemId: e.target.value }))} className={inp}>
                  <option value="">Selecione…</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome} · {brl(c.saldo)}</option>)}
                </select></div>
              <div><label className="text-xs text-gray-500 block mb-1">Para (destino)</label>
                <select value={transf.contaDestinoId} onChange={e => setTransf((t: any) => ({ ...t, contaDestinoId: e.target.value }))} className={inp}>
                  <option value="">Selecione…</option>{contas.filter(c => c.id !== transf.contaOrigemId).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" value={transf.valor} onChange={e => setTransf((t: any) => ({ ...t, valor: e.target.value }))} className={inp} placeholder="0,00" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Data</label>
                  <input type="date" value={transf.data} onChange={e => setTransf((t: any) => ({ ...t, data: e.target.value }))} className={inp} /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Descrição (opcional)</label>
                <input value={transf.descricao} onChange={e => setTransf((t: any) => ({ ...t, descricao: e.target.value }))} className={inp} placeholder="Ex.: repasse Shopee pro banco" /></div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModalTransf(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                <button onClick={salvarTransf} disabled={salvando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{salvando ? 'Salvando...' : 'Transferir'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer conciliação */}
      {concConta && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50" onClick={() => setConcConta(null)}>
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-gray-800">Conciliar — {concConta.nome}</h2>
                <p className="text-xs text-gray-400">Saldo no sistema: <b>{brl(concConta.saldo)}</b></p>
              </div>
              <button onClick={() => setConcConta(null)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Comparar com extrato */}
              <div className="bg-gray-50 rounded-xl p-3">
                <label className="text-xs text-gray-500 block mb-1">Saldo do extrato (banco/app) para comparar</label>
                <input type="number" step="0.01" value={extrato} onChange={e => setExtrato(e.target.value)} className={inp} placeholder="Digite o saldo do seu extrato" />
                {extrato !== '' && (() => {
                  const dif = concConta.saldo - Number(extrato)
                  return <p className={`text-sm font-medium mt-2 ${Math.abs(dif) < 0.005 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.abs(dif) < 0.005 ? '✅ Bateu certinho! Sistema = extrato.' : `Diferença de ${brl(dif)} entre o sistema e o extrato — confira os lançamentos abaixo.`}
                  </p>
                })()}
              </div>
              {/* Lista de lançamentos pagos da conta */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Lançamentos realizados nesta conta ({concRows.length}) — marque os que já bateram com o extrato:</p>
                {concLoading ? <div className="text-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : concRows.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum lançamento realizado vinculado a esta conta ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {concRows.map(r => (
                      <label key={r.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer ${r.conciliado ? 'bg-emerald-50 border-emerald-200' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={!!r.conciliado} onChange={() => toggleConciliado(r)} className="accent-emerald-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800 truncate">{r.descricao}</p>
                          <p className="text-[11px] text-gray-400">{brDate(r.data)}</p>
                        </div>
                        <span className={`text-sm font-semibold ${r.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{r.tipo === 'RECEITA' ? '+' : '−'}{brl(r.valorRealizado || r.valor)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
