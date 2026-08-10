'use client'
// app/master/creditos/page.tsx — gestão da Carteira de Créditos (Master)
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Pencil, Trash2, Wallet, Gift, Search, ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'

interface Pacote { id: string; tipo: string; nome: string; quantidade: number; preco: number; ativo: boolean }
interface CarteiraRow { workspaceId: string; workspaceNome: string; tipo: string; saldo: number; cotaGratisMes: number }
interface SaldoTipo { tipo: string; saldo: number; cotaGratisMes: number; cotaUsadaMes: number; cotaGratisRestante: number; mesReferencia: string | null }
interface Mov { id: string; tipo: string; delta: number; motivo: string; referencia: string | null; saldoResultante: number | null; createdAt: string }

const MOTIVO_LABEL: Record<string, string> = {
  compra: 'Compra', consumo: 'Uso', estorno: 'Estorno', ajuste_master: 'Crédito VPS',
}
function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDataHora(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d); if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const PACOTE_VAZIO = { id: '', tipo: 'foto', nome: '', quantidade: 10, preco: 0, ativo: true }

export default function MasterCreditosPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'pacotes' | 'carteiras'>('pacotes')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  // Pacotes
  const [pacotes, setPacotes] = useState<Pacote[]>([])
  const [pacoteForm, setPacoteForm] = useState<typeof PACOTE_VAZIO | null>(null)
  const [salvandoPac, setSalvandoPac] = useState(false)

  // Carteiras
  const [carteiras, setCarteiras] = useState<CarteiraRow[]>([])
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState<{ workspace: any; saldos: SaldoTipo[]; historico: Mov[] } | null>(null)

  // Conceder
  const [concederForm, setConcederForm] = useState<{ workspaceId: string; workspaceNome: string; tipo: string; qtd: string; motivo: string } | null>(null)
  const [concedendo, setConcedendo] = useState(false)

  const carregarPacotes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/master/creditos/pacotes')
    if (res.status === 401) { router.push('/master/login'); return }
    if (res.ok) setPacotes(await res.json())
    setLoading(false)
  }, [router])

  const carregarCarteiras = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/master/creditos/conceder')
    if (res.status === 401) { router.push('/master/login'); return }
    if (res.ok) setCarteiras(await res.json())
    setLoading(false)
  }, [router])

  useEffect(() => {
    if (tab === 'pacotes') carregarPacotes()
    else carregarCarteiras()
  }, [tab, carregarPacotes, carregarCarteiras])

  function aviso(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(''), 3000) }

  async function salvarPacote() {
    if (!pacoteForm) return
    if (!pacoteForm.tipo.trim() || !pacoteForm.nome.trim() || pacoteForm.quantidade <= 0) { aviso('Preencha tipo, nome e quantidade.'); return }
    setSalvandoPac(true)
    const res = await fetch('/api/master/creditos/pacotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pacoteForm),
    })
    setSalvandoPac(false)
    if (res.ok) { setPacoteForm(null); aviso('Pacote salvo.'); carregarPacotes() }
    else aviso('Erro ao salvar pacote.')
  }

  async function excluirPacote(id: string) {
    if (!confirm('Excluir este pacote?')) return
    const res = await fetch(`/api/master/creditos/pacotes?id=${id}`, { method: 'DELETE' })
    if (res.ok) { aviso('Pacote excluído.'); carregarPacotes() }
  }

  async function abrirDetalhe(workspaceId: string) {
    const res = await fetch(`/api/master/creditos/conceder?workspaceId=${workspaceId}`)
    if (res.ok) setDetalhe(await res.json())
  }

  async function conceder() {
    if (!concederForm) return
    const qtd = Number(concederForm.qtd)
    if (!concederForm.tipo.trim() || !qtd || qtd <= 0) { aviso('Informe tipo e quantidade > 0.'); return }
    setConcedendo(true)
    const res = await fetch('/api/master/creditos/conceder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: concederForm.workspaceId, tipo: concederForm.tipo, qtd, motivo: concederForm.motivo || 'ajuste_master' }),
    })
    setConcedendo(false)
    if (res.ok) {
      const wsId = concederForm.workspaceId
      setConcederForm(null); aviso('Crédito concedido.')
      carregarCarteiras()
      if (detalhe) abrirDetalhe(wsId)
    } else aviso('Erro ao conceder crédito.')
  }

  const carteirasFiltradas = carteiras.filter(c =>
    !busca || c.workspaceNome?.toLowerCase().includes(busca.toLowerCase()))

  // Agrupa carteiras por workspace p/ exibição
  const porWorkspace = carteirasFiltradas.reduce<Record<string, { nome: string; tipos: CarteiraRow[] }>>((acc, c) => {
    if (!acc[c.workspaceId]) acc[c.workspaceId] = { nome: c.workspaceNome, tipos: [] }
    acc[c.workspaceId].tipos.push(c)
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <Wallet className="w-6 h-6 text-orange-500" />
        <h1 className="text-xl font-bold">Carteira de Créditos</h1>
      </div>

      {feedback && <div className="mb-4 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-200 text-sm">{feedback}</div>}

      <div className="flex gap-2 mb-6">
        {(['pacotes', 'carteiras'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {t === 'pacotes' ? 'Pacotes' : 'Carteiras'}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-500 text-sm">Carregando…</div>}

      {/* ── PACOTES ─────────────────────────────────────────── */}
      {!loading && tab === 'pacotes' && (
        <div>
          <button onClick={() => setPacoteForm({ ...PACOTE_VAZIO })}
            className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> Novo pacote
          </button>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {pacotes.length === 0 ? (
              <div className="p-6 text-gray-500 text-sm text-center">Nenhum pacote cadastrado.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-400">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold">Tipo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold">Nome</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold">Qtd.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold">Preço</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold">Ativo</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {pacotes.map(p => (
                    <tr key={p.id} className="border-t border-gray-800">
                      <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-xs">{p.tipo}</span></td>
                      <td className="px-4 py-2.5 text-gray-200">{p.nome}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{p.quantidade}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{fmtBRL(p.preco)}</td>
                      <td className="px-4 py-2.5 text-center">{p.ativo ? '✅' : '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => setPacoteForm({ ...p })} className="text-gray-400 hover:text-white mr-2"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => excluirPacote(p.id)} className="text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── CARTEIRAS ───────────────────────────────────────── */}
      {!loading && tab === 'carteiras' && (
        <div>
          <div className="flex items-center gap-2 mb-4 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 max-w-sm">
            <Search className="w-4 h-4 text-gray-500" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ateliê…"
              className="bg-transparent text-sm text-gray-200 outline-none flex-1" />
          </div>
          <div className="space-y-2">
            {Object.keys(porWorkspace).length === 0 && (
              <div className="p-6 text-gray-500 text-sm text-center bg-gray-900 border border-gray-800 rounded-xl">Nenhuma carteira com saldo/franquia ainda.</div>
            )}
            {Object.entries(porWorkspace).map(([wsId, w]) => (
              <div key={wsId} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-100">{w.nome}</div>
                  <div className="flex gap-2">
                    <button onClick={() => abrirDetalhe(wsId)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200">Histórico</button>
                    <button onClick={() => setConcederForm({ workspaceId: wsId, workspaceNome: w.nome, tipo: 'foto', qtd: '', motivo: 'ajuste_master' })}
                      className="text-xs px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1">
                      <Gift className="w-3 h-3" /> Conceder
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {w.tipos.map(t => (
                    <div key={t.tipo} className="text-sm text-gray-300 bg-gray-800/60 rounded-lg px-3 py-1.5">
                      <span className="text-gray-400">{t.tipo}:</span> <span className="font-semibold text-white">{t.saldo}</span>
                      {t.cotaGratisMes > 0 && <span className="text-emerald-400 text-xs"> · {t.cotaGratisMes} grátis/mês</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal editar pacote */}
      {pacoteForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPacoteForm(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2"><Package className="w-5 h-5 text-orange-500" /> {pacoteForm.id ? 'Editar' : 'Novo'} pacote</h3>
              <button onClick={() => setPacoteForm(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Tipo de crédito (ex.: foto, nf)</label>
                <input value={pacoteForm.tipo} onChange={e => setPacoteForm({ ...pacoteForm, tipo: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome do pacote</label>
                <input value={pacoteForm.nome} onChange={e => setPacoteForm({ ...pacoteForm, nome: e.target.value })}
                  placeholder="Ex.: Pacote 50 fotos" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Quantidade</label>
                  <input type="number" min="1" value={pacoteForm.quantidade} onChange={e => setPacoteForm({ ...pacoteForm, quantidade: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Preço (R$)</label>
                  <input type="number" step="0.01" min="0" value={pacoteForm.preco} onChange={e => setPacoteForm({ ...pacoteForm, preco: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={pacoteForm.ativo} onChange={e => setPacoteForm({ ...pacoteForm, ativo: e.target.checked })} /> Ativo
              </label>
            </div>
            <button onClick={salvarPacote} disabled={salvandoPac}
              className="mt-5 w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50">
              {salvandoPac ? 'Salvando…' : 'Salvar pacote'}
            </button>
          </div>
        </div>
      )}

      {/* Modal conceder crédito */}
      {concederForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setConcederForm(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2"><Gift className="w-5 h-5 text-orange-500" /> Conceder crédito</h3>
              <button onClick={() => setConcederForm(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Ateliê: <span className="text-gray-200 font-medium">{concederForm.workspaceNome}</span></p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tipo</label>
                  <input value={concederForm.tipo} onChange={e => setConcederForm({ ...concederForm, tipo: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Quantidade</label>
                  <input type="number" min="1" value={concederForm.qtd} onChange={e => setConcederForm({ ...concederForm, qtd: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Motivo</label>
                <select value={concederForm.motivo} onChange={e => setConcederForm({ ...concederForm, motivo: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100">
                  <option value="ajuste_master">Crédito VPS (ajuste manual)</option>
                  <option value="compra">Compra de pacote</option>
                  <option value="estorno">Estorno</option>
                </select>
              </div>
            </div>
            <button onClick={conceder} disabled={concedendo}
              className="mt-5 w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50">
              {concedendo ? 'Concedendo…' : 'Conceder'}
            </button>
          </div>
        </div>
      )}

      {/* Modal detalhe/histórico do workspace */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{detalhe.workspace?.nome || 'Carteira'}</h3>
              <button onClick={() => setDetalhe(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-wrap gap-3 mb-5">
              {detalhe.saldos.map(s => (
                <div key={s.tipo} className="bg-gray-800/60 rounded-lg px-3 py-2 text-sm">
                  <div className="text-gray-400 text-xs">{s.tipo}</div>
                  <div className="text-white font-semibold">{s.saldo} <span className="text-xs text-gray-500 font-normal">saldo</span></div>
                  {s.cotaGratisMes > 0 && <div className="text-emerald-400 text-xs">{s.cotaGratisRestante}/{s.cotaGratisMes} grátis</div>}
                </div>
              ))}
            </div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Histórico</h4>
            {detalhe.historico.length === 0 ? (
              <div className="text-gray-500 text-sm">Sem movimentações.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-1.5 text-xs">Data</th>
                    <th className="text-left py-1.5 text-xs">Tipo</th>
                    <th className="text-left py-1.5 text-xs">Motivo</th>
                    <th className="text-right py-1.5 text-xs">Qtd.</th>
                    <th className="text-right py-1.5 text-xs">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.historico.map(m => (
                    <tr key={m.id} className="border-t border-gray-800">
                      <td className="py-1.5 text-gray-500 whitespace-nowrap">{fmtDataHora(m.createdAt)}</td>
                      <td className="py-1.5 text-gray-300">{m.tipo}</td>
                      <td className="py-1.5 text-gray-400">{MOTIVO_LABEL[m.motivo] || m.motivo}</td>
                      <td className={`py-1.5 text-right font-semibold ${m.delta < 0 ? 'text-red-400' : m.delta > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</td>
                      <td className="py-1.5 text-right text-gray-500">{m.saldoResultante ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
