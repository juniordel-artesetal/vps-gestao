'use client'
// app/master/logs/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2, RefreshCw, AlertTriangle, X } from 'lucide-react'

interface ErrorLog {
  id: string
  workspaceId: string | null
  workspaceNome: string | null
  userId: string | null
  rota: string
  metodo: string | null
  erro: string
  payload: string | null
  createdAt: string
}

function fmtData(s: string) {
  const d = new Date(s)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function MasterLogsPage() {
  const router = useRouter()
  const [logs,          setLogs]          = useState<ErrorLog[]>([])
  const [total,         setTotal]         = useState(0)
  const [pagina,        setPagina]        = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [filtroWs,      setFiltroWs]      = useState('')
  const [filtroRota,    setFiltroRota]    = useState('')
  const [detalhe,       setDetalhe]       = useState<ErrorLog | null>(null)
  const [masterToken,   setMasterToken]   = useState('')

  useEffect(() => {
    const t = sessionStorage.getItem('masterToken') || ''
    if (!t) { router.push('/master/login'); return }
    setMasterToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!masterToken) return
    setLoading(true)
    const p = new URLSearchParams({ pagina: String(pagina) })
    if (filtroWs)   p.set('workspaceId', filtroWs)
    if (filtroRota) p.set('rota', filtroRota)
    const res = await fetch(`/api/master/error-logs?${p}`, {
      headers: { 'x-master-token': masterToken }
    })
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }, [masterToken, pagina, filtroWs, filtroRota])

  useEffect(() => { carregar() }, [carregar])

  async function limparAntigos() {
    if (!confirm('Apagar logs com mais de 30 dias?')) return
    await fetch('/api/master/error-logs', {
      method: 'DELETE',
      headers: { 'x-master-token': masterToken }
    })
    carregar()
  }

  const totalPaginas = Math.ceil(total / 50)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle size={20} className="text-orange-400" />
              Logs de Erro
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={carregar} className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">
              <RefreshCw size={14} /> Atualizar
            </button>
            <button onClick={limparAntigos} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded-lg text-sm transition">
              <Trash2 size={14} /> Limpar +30 dias
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={filtroWs}
              onChange={e => { setFiltroWs(e.target.value); setPagina(1) }}
              placeholder="Filtrar por workspace ID..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={filtroRota}
              onChange={e => { setFiltroRota(e.target.value); setPagina(1) }}
              placeholder="Filtrar por rota (ex: /api/producao/pedidos)..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Data</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Workspace</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Rota</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Erro</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">Carregando...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">Nenhum log encontrado</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtData(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-white truncate max-w-[140px]">{log.workspaceNome || '—'}</p>
                    <p className="text-xs text-gray-500 font-mono truncate max-w-[140px]">{log.workspaceId || 'sem workspace'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-gray-800 text-orange-300 px-2 py-0.5 rounded">
                      {log.metodo || 'GET'} {log.rota}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-400 max-w-[300px]">
                    <p className="truncate">{log.erro.split('\n')[0]}</p>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setDetalhe(log)} className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-gray-700">
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
              className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition">
              ← Anterior
            </button>
            <span className="text-sm text-gray-400">{pagina} / {totalPaginas}</span>
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
              className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition">
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h2 className="text-sm font-semibold text-white">Detalhes do erro</h2>
              <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500 mb-1">Data</p>
                  <p className="text-white">{fmtData(detalhe.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Rota</p>
                  <p className="text-orange-300 font-mono">{detalhe.metodo} {detalhe.rota}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Workspace</p>
                  <p className="text-white">{detalhe.workspaceNome || '—'}</p>
                  <p className="text-gray-500 font-mono text-xs">{detalhe.workspaceId}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">User ID</p>
                  <p className="text-white font-mono">{detalhe.userId || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Erro completo</p>
                <pre className="text-xs text-red-300 bg-red-950/30 border border-red-900/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {detalhe.erro}
                </pre>
              </div>
              {detalhe.payload && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Payload</p>
                  <pre className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                    {(() => { try { return JSON.stringify(JSON.parse(detalhe.payload!), null, 2) } catch { return detalhe.payload } })()}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
