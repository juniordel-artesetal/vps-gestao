'use client'
// Extrato de UMA conta bancária: operações (entradas/saídas + transferências) com
// saldo corrente, filtros (data/tipo/categoria/status/busca) e conciliação.
import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Check, Loader2 } from 'lucide-react'

function fmtR(n: number | null | undefined) {
  if (n == null) return '—'
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function brDate(s: string) {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

interface Movimento {
  id: string; kind: 'lancamento' | 'transferencia'
  data: string; descricao: string; entrada: boolean; valor: number
  conciliado?: boolean; status: string | null
  categoriaId: string | null; categoriaNome: string | null; categoriaIcone: string | null
  saldo: number | null
}
interface Conta { id: string; nome: string; saldoInicial: number; saldo: number; aConciliar: number }

const inp = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function ExtratoContaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [conta, setConta] = useState<Conta | null>(null)
  const [movs, setMovs] = useState<Movimento[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  // Filtros
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [fTipo, setFTipo] = useState('')       // '', 'entrada', 'saida'
  const [fStatus, setFStatus] = useState('')   // '', 'PAGO', 'PENDENTE'
  const [fCategoria, setFCategoria] = useState('')
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true); setErro(false)
    try {
      const r = await fetch(`/api/financeiro/contas/${id}/extrato`)
      if (!r.ok) { setErro(true); return }
      const d = await r.json()
      setConta(d.conta); setMovs(d.movimentos || [])
    } catch { setErro(true) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { carregar() }, [carregar])

  async function toggleConciliado(m: Movimento) {
    if (m.kind !== 'lancamento') return
    const novo = !m.conciliado
    setMovs(ms => ms.map(x => x.id === m.id ? { ...x, conciliado: novo } : x))
    await fetch(`/api/financeiro/lancamentos/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conciliado: novo }) })
    carregar()
  }

  // Categorias presentes no extrato (para o filtro).
  const catsExtrato = Array.from(new Map(movs.filter(m => m.categoriaId).map(m => [m.categoriaId, { id: m.categoriaId!, nome: m.categoriaNome, icone: m.categoriaIcone }])).values())

  const filtrados = movs.filter(m =>
    (!de || m.data >= de) &&
    (!ate || m.data <= ate) &&
    (!fTipo || (fTipo === 'entrada' ? m.entrada : !m.entrada)) &&
    (!fStatus || (m.kind === 'lancamento' && m.status === fStatus)) &&
    (!fCategoria || m.categoriaId === fCategoria) &&
    (!busca || m.descricao.toLowerCase().includes(busca.toLowerCase()) || (m.categoriaNome || '').toLowerCase().includes(busca.toLowerCase()))
  )
  const somaEntradas = filtrados.filter(m => m.entrada).reduce((s, m) => s + m.valor, 0)
  const somaSaidas = filtrados.filter(m => !m.entrada).reduce((s, m) => s + m.valor, 0)
  const temFiltro = de || ate || fTipo || fStatus || fCategoria || busca

  return (
    <div className="p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/financeiro/contas')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Extrato — {conta?.nome || '...'}</h1>
          <p className="text-sm text-gray-500">Entradas e saídas desta conta, com saldo corrente</p>
        </div>
      </div>

      {conta && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-[11px] text-gray-500">Saldo inicial</p>
            <p className="text-lg font-bold text-gray-700">{fmtR(conta.saldoInicial)}</p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-[11px] text-indigo-500">Saldo atual</p>
            <p className={`text-lg font-bold ${conta.saldo >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{fmtR(conta.saldo)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-[11px] text-gray-500">A conciliar</p>
            <p className={`text-lg font-bold ${conta.aConciliar > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{conta.aConciliar}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-[11px] text-gray-500">No filtro</p>
            <p className="text-sm font-semibold text-gray-700"><span className="text-green-600">+{fmtR(somaEntradas)}</span> · <span className="text-red-600">−{fmtR(somaSaidas)}</span></p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs text-gray-500 flex items-center gap-1">de <input type="date" value={de} onChange={e => setDe(e.target.value)} className={inp + ' py-1'} /></label>
        <label className="text-xs text-gray-500 flex items-center gap-1">até <input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inp + ' py-1'} /></label>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={inp}>
          <option value="">Entradas e saídas</option>
          <option value="entrada">Só entradas</option>
          <option value="saida">Só saídas</option>
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inp}>
          <option value="">Todos os status</option>
          <option value="PAGO">Pago</option>
          <option value="PENDENTE">Pendente</option>
        </select>
        {catsExtrato.length > 0 && (
          <select value={fCategoria} onChange={e => setFCategoria(e.target.value)} className={inp}>
            <option value="">Todas as categorias</option>
            {catsExtrato.map(c => <option key={c.id} value={c.id}>{(c.icone ? c.icone + ' ' : '') + c.nome}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar descrição..." className={inp + ' w-full pl-8'} />
        </div>
        {temFiltro && <button onClick={() => { setDe(''); setAte(''); setFTipo(''); setFStatus(''); setFCategoria(''); setBusca('') }} className="text-xs text-orange-500 hover:underline">Limpar</button>}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 w-10 text-center text-xs font-semibold text-gray-500" title="Conciliado">✓</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>}
              {erro && !loading && <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Não consegui carregar o extrato.</td></tr>}
              {!loading && !erro && filtrados.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Nenhum movimento {temFiltro ? 'com esses filtros' : 'nesta conta'}.</td></tr>}
              {!loading && filtrados.map(m => (
                <tr key={m.id} className={`border-t border-gray-50 ${m.conciliado ? 'bg-emerald-50/40' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-3 py-3 text-center">
                    {m.kind === 'lancamento' && m.status === 'PAGO'
                      ? <input type="checkbox" checked={!!m.conciliado} onChange={() => toggleConciliado(m)} className="accent-emerald-500 cursor-pointer" title="Conciliar" />
                      : <span className="text-gray-300 text-xs" title={m.kind === 'transferencia' ? 'Transferência' : 'Pendente'}>{m.kind === 'transferencia' ? '⇄' : '·'}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{brDate(m.data)}</td>
                  <td className="px-4 py-3 text-gray-800">{m.descricao}{m.kind === 'transferencia' && <span className="text-[10px] text-gray-400 ml-1">(transf.)</span>}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.categoriaNome ? `${m.categoriaIcone || ''} ${m.categoriaNome}` : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {m.kind === 'lancamento'
                      ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === 'PAGO' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{m.status === 'PAGO' ? 'Pago' : 'Pendente'}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${m.entrada ? 'text-green-600' : 'text-red-600'}`}>{m.entrada ? '+' : '−'}{fmtR(m.valor)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{m.saldo == null ? '—' : fmtR(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
