'use client'

// A PAGAR E A RECEBER (contas a pagar / contas a receber) — as PREVISÕES.
// Antes não existia essa tela: a artesã abria o Caixa Diário só para ver a previsão, que é
// justamente o que o Caixa não deve ser. Aqui fica tudo o que ainda não entrou nem saiu, vindo
// de compras, de pedidos e de lançamentos avulsos.
import { useState, useEffect, useCallback } from 'react'
import { CalendarClock, AlertTriangle, Search, Check, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

const brl = (n: any) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtD = (s: string | null) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—'

interface Item {
  id: string; tipo: 'RECEITA' | 'DESPESA'; descricao: string
  valor: number; valorRealizado: number; saldo: number
  vencimento: string; vencida: boolean; diasAtraso: number
  status: string; canal: string | null; referencia: string | null
  parcela: number | null; totalParcelas: number | null
  categoriaNome: string | null; categoriaCor: string | null
}

export default function PrevistosPage() {
  const [itens, setItens] = useState<Item[]>([])
  const [totais, setTotais] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState<'' | 'RECEITA' | 'DESPESA'>('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  const [soVencidas, setSoVencidas] = useState(false)
  const [baixando, setBaixando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (tipo) q.set('tipo', tipo)
      if (de) q.set('de', de)
      if (ate) q.set('ate', ate)
      if (busca.trim()) q.set('busca', busca.trim())
      if (soVencidas) q.set('vencidas', '1')
      const d = await fetch(`/api/financeiro/previstos?${q}`).then(r => r.json())
      setItens(d.itens || []); setTotais(d.totais || null)
    } finally { setLoading(false) }
  }, [tipo, de, ate, busca, soVencidas])

  useEffect(() => { carregar() }, [carregar])

  // Quitar = pagar o saldo restante. O endpoint acumula e recalcula o status sem drift de centavos.
  async function quitar(it: Item) {
    const verbo = it.tipo === 'RECEITA' ? 'recebido' : 'pago'
    if (!confirm(`Marcar como ${verbo} ${brl(it.saldo)} de "${it.descricao}"?`)) return
    setBaixando(it.id)
    try {
      const r = await fetch(`/api/financeiro/lancamentos/${it.id}/pagar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: it.saldo }),
      })
      if (!r.ok) { alert((await r.json()).error || 'Não foi possível dar baixa'); return }
      carregar()
    } catch { alert('Erro de conexão') }
    finally { setBaixando(null) }
  }

  const t = totais || {}

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-orange-500" /> A pagar e a receber
          </h1>
          <p className="text-sm text-gray-500">
            O que ainda <strong>não entrou nem saiu</strong> — suas contas a pagar e a receber.
            O que já foi pago/recebido aparece no <a href="/financeiro/fluxo" className="text-orange-500 hover:underline">Caixa Diário</a>.
          </p>
        </div>

        {/* Totais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><ArrowDownCircle size={13} className="text-green-500" /> A receber <span className="text-gray-400">(contas a receber)</span></p>
            <p className="text-2xl font-bold text-green-600 tabular-nums mt-1">{brl(t.aReceber)}</p>
            {Number(t.aReceberVencido) > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {brl(t.aReceberVencido)} já venceu</p>
            )}
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1.5"><ArrowUpCircle size={13} className="text-red-500" /> A pagar <span className="text-gray-400">(contas a pagar)</span></p>
            <p className="text-2xl font-bold text-red-600 tabular-nums mt-1">{brl(t.aPagar)}</p>
            {Number(t.aPagarVencido) > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> {brl(t.aPagarVencido)} já venceu</p>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 mb-4 flex flex-wrap items-end gap-3">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {([['', 'Tudo'], ['DESPESA', 'A pagar'], ['RECEITA', 'A receber']] as const).map(([v, lab]) => (
              <button key={v} onClick={() => setTipo(v as any)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${tipo === v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {lab}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vence de</label>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">até</label>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 block mb-1">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="descrição ou referência"
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white" />
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 pb-1.5">
            <input type="checkbox" checked={soVencidas} onChange={e => setSoVencidas(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            só vencidas
          </label>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">Nada em aberto neste filtro. 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {itens.map(it => (
              <div key={it.id} className={`bg-white dark:bg-gray-900 border rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${it.vencida ? 'border-amber-200 dark:border-amber-900/50' : 'border-gray-100 dark:border-gray-800'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${it.tipo === 'RECEITA' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                      {it.tipo === 'RECEITA' ? 'a receber' : 'a pagar'}
                    </span>
                    <p className="text-sm text-gray-800 dark:text-gray-100 truncate">{it.descricao}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    vence {fmtD(it.vencimento)}
                    {it.vencida && <span className="text-amber-600 font-medium"> · venceu há {it.diasAtraso} dia(s)</span>}
                    {it.categoriaNome ? ` · ${it.categoriaNome}` : ''}
                    {it.totalParcelas && it.totalParcelas > 1 ? ` · parcela ${it.parcela}/${it.totalParcelas}` : ''}
                    {it.status === 'PARCIAL' && ` · já ${it.tipo === 'RECEITA' ? 'recebido' : 'pago'} ${brl(it.valorRealizado)} de ${brl(it.valor)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-sm font-semibold tabular-nums ${it.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{brl(it.saldo)}</span>
                  <button onClick={() => quitar(it)} disabled={baixando === it.id}
                    className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg px-2.5 py-1 text-gray-600 dark:text-gray-300 transition disabled:opacity-50">
                    <Check size={12} /> {baixando === it.id ? '...' : (it.tipo === 'RECEITA' ? 'Recebi' : 'Paguei')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
