'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bug, Lightbulb, Sparkles, X, Check, Loader2,
  RefreshCw, ArrowLeft, ImageIcon, MessageSquare,
} from 'lucide-react'
import Link from 'next/link'

// ── Tipos ──────────────────────────────────────────────────────────────────
type Feedback = {
  id:            string
  workspaceId:   string
  workspaceNome: string
  userId:        string
  userNome:      string
  tipo:          string
  titulo:        string
  descricao:     string
  temImagem:     boolean
  status:        string
  notaInterna:   string | null
  createdAt:     string
}

type FeedbackDetalhe = Feedback & { imagemBase64: string | null }

// ── Config visuais ─────────────────────────────────────────────────────────
const TIPO_CFG: Record<string, { label: string; icon: any; cls: string; iconCls: string }> = {
  BUG:      { label: 'Bug',      icon: Bug,       cls: 'bg-red-50 text-red-700 border-red-100',    iconCls: 'text-red-500'    },
  MELHORIA: { label: 'Melhoria', icon: Sparkles,  cls: 'bg-blue-50 text-blue-700 border-blue-100', iconCls: 'text-blue-500'   },
  SUGESTAO: { label: 'Sugestão', icon: Lightbulb, cls: 'bg-yellow-50 text-yellow-700 border-yellow-100', iconCls: 'text-yellow-500' },
}

const STATUS_CFG: Record<string, { label: string; cls: string; btn: string }> = {
  ABERTO:     { label: 'Aberto',     cls: 'bg-orange-50 text-orange-700',  btn: 'border-orange-400 bg-orange-500 text-white'   },
  EM_ANALISE: { label: 'Em análise', cls: 'bg-blue-50 text-blue-700',      btn: 'border-blue-400 bg-blue-500 text-white'       },
  CONCLUIDO:  { label: 'Concluído',  cls: 'bg-green-50 text-green-700',    btn: 'border-green-400 bg-green-500 text-white'     },
  DESCARTADO: { label: 'Descartado', cls: 'bg-gray-100 text-gray-500',     btn: 'border-gray-400 bg-gray-500 text-white'       },
}

function TipoBadge({ tipo }: { tipo: string }) {
  const cfg = TIPO_CFG[tipo]
  if (!cfg) return <span className="text-xs text-gray-400">{tipo}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <Icon className={`w-3 h-3 ${cfg.iconCls}`} />
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status]
  if (!cfg) return <span className="text-xs text-gray-400">{status}</span>
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function fmtData(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Componente principal ───────────────────────────────────────────────────
export default function MasterFeedbackPage() {
  const router = useRouter()

  const [masterToken, setMasterToken] = useState('')
  const [feedbacks,   setFeedbacks]   = useState<Feedback[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filtroTipo,  setFiltroTipo]  = useState('')
  const [filtroStatus,setFiltroStatus]= useState('')

  // Detalhe / modal
  const [detalhe,       setDetalhe]       = useState<FeedbackDetalhe | null>(null)
  const [loadDetalhe,   setLoadDetalhe]   = useState(false)
  const [novaStatus,    setNovaStatus]    = useState('')
  const [notaInterna,   setNotaInterna]   = useState('')
  const [salvando,      setSalvando]      = useState(false)
  const [msgSalvo,      setMsgSalvo]      = useState('')

  // Pega token da sessionStorage (mesmo padrão do /master principal)
  useEffect(() => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('masterToken') : null
    if (!t) {
      router.push('/master')
      return
    }
    setMasterToken(t)
  }, [router])

  const loadFeedbacks = useCallback(async (t: string, tipo: string, status: string) => {
    if (!t) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tipo)   params.set('tipo',   tipo)
      if (status) params.set('status', status)
      const res  = await fetch(`/api/feedback?${params}`, {
        headers: { 'x-master-token': t },
      })
      const data = await res.json()
      setFeedbacks(Array.isArray(data) ? data : [])
    } catch {
      setFeedbacks([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (masterToken) loadFeedbacks(masterToken, '', '')
  }, [masterToken, loadFeedbacks])

  function aplicarFiltro(tipo: string, status: string) {
    setFiltroTipo(tipo)
    setFiltroStatus(status)
    loadFeedbacks(masterToken, tipo, status)
  }

  async function abrirDetalhe(fb: Feedback) {
    setDetalhe({ ...fb, imagemBase64: null })
    setNovaStatus(fb.status)
    setNotaInterna(fb.notaInterna || '')
    setMsgSalvo('')
    setLoadDetalhe(true)
    try {
      const res  = await fetch(`/api/feedback/${fb.id}`, {
        headers: { 'x-master-token': masterToken },
      })
      const data = await res.json()
      setDetalhe(data)
      setNovaStatus(data.status)
      setNotaInterna(data.notaInterna || '')
    } catch {}
    setLoadDetalhe(false)
  }

  async function salvar() {
    if (!detalhe) return
    setSalvando(true)
    setMsgSalvo('')
    try {
      await fetch(`/api/feedback/${detalhe.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-master-token': masterToken,
        },
        body: JSON.stringify({ status: novaStatus, notaInterna }),
      })
      setDetalhe(prev => prev ? { ...prev, status: novaStatus, notaInterna } : prev)
      setFeedbacks(prev =>
        prev.map(f => f.id === detalhe.id ? { ...f, status: novaStatus, notaInterna } : f)
      )
      setMsgSalvo('Salvo!')
      setTimeout(() => setMsgSalvo(''), 2500)
    } catch {
      setMsgSalvo('Erro ao salvar.')
    }
    setSalvando(false)
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const total   = feedbacks.length
  const abertos = feedbacks.filter(f => f.status === 'ABERTO').length
  const bugs     = feedbacks.filter(f => f.tipo === 'BUG').length
  const melhorias= feedbacks.filter(f => f.tipo === 'MELHORIA').length
  const sugestoes= feedbacks.filter(f => f.tipo === 'SUGESTAO').length

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/master" className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Feedbacks dos Usuários</h1>
            <p className="text-sm text-gray-500">{total} feedback{total !== 1 ? 's' : ''} recebido{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => loadFeedbacks(masterToken, filtroTipo, filtroStatus)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Cards de stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total',       valor: total,    cls: 'text-gray-800' },
            { label: '🔴 Abertos',  valor: abertos,  cls: 'text-orange-600' },
            { label: '🐛 Bugs',     valor: bugs,     cls: 'text-red-600'  },
            { label: '✨ Melhorias',valor: melhorias, cls: 'text-blue-600' },
            { label: '💡 Sugestões',valor: sugestoes, cls: 'text-yellow-600'},
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.valor}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
          <select
            value={filtroTipo}
            onChange={e => aplicarFiltro(e.target.value, filtroStatus)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Todos os tipos</option>
            <option value="BUG">🐛 Bug</option>
            <option value="MELHORIA">✨ Melhoria</option>
            <option value="SUGESTAO">💡 Sugestão</option>
          </select>

          <select
            value={filtroStatus}
            onChange={e => aplicarFiltro(filtroTipo, e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Todos os status</option>
            <option value="ABERTO">Aberto</option>
            <option value="EM_ANALISE">Em análise</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="DESCARTADO">Descartado</option>
          </select>

          {(filtroTipo || filtroStatus) && (
            <button
              onClick={() => aplicarFiltro('', '')}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">
            {feedbacks.length} resultado{feedbacks.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <MessageSquare className="w-10 h-10" />
              <p className="text-sm">Nenhum feedback encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Título</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">Workspace</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">Data</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {feedbacks.map(fb => (
                    <tr key={fb.id} className="hover:bg-orange-50/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TipoBadge tipo={fb.tipo} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 max-w-xs truncate">{fb.titulo}</div>
                        {fb.temImagem && (
                          <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <ImageIcon className="w-3 h-3" /> tem print
                          </span>
                        )}
                        {fb.notaInterna && (
                          <span className="text-xs text-blue-400 flex items-center gap-1 mt-0.5">
                            💬 tem nota interna
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 text-xs font-medium">{fb.workspaceNome || fb.workspaceId}</div>
                        <div className="text-gray-400 text-xs">{fb.userNome}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={fb.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {fmtData(fb.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => abrirDetalhe(fb)}
                          className="text-orange-500 hover:text-orange-700 text-xs font-medium whitespace-nowrap"
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de detalhe ─────────────────────────────────────────────── */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">

            {/* Header modal */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <TipoBadge tipo={detalhe.tipo} />
                <StatusBadge status={detalhe.status} />
                {detalhe.temImagem && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> print
                  </span>
                )}
              </div>
              <button
                onClick={() => setDetalhe(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Dados gerais */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">{detalhe.titulo}</h2>
                <p className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500">{detalhe.workspaceNome || detalhe.workspaceId}</span>
                  {' · '}{detalhe.userNome}
                  {' · '}{fmtData(detalhe.createdAt)}
                </p>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Descrição
                </label>
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {detalhe.descricao}
                </div>
              </div>

              {/* Imagem */}
              {loadDetalhe ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : detalhe.imagemBase64 ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Print anexado
                  </label>
                  <img
                    src={detalhe.imagemBase64}
                    alt="Print do feedback"
                    className="rounded-xl max-h-80 w-full object-contain bg-gray-50 border border-gray-200"
                  />
                </div>
              ) : null}

              {/* Gestão de status */}
              <div className="border-t border-gray-100 pt-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Atualizar status
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(['ABERTO', 'EM_ANALISE', 'CONCLUIDO', 'DESCARTADO'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNovaStatus(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                        novaStatus === s
                          ? STATUS_CFG[s].btn
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {STATUS_CFG[s].label}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Nota interna
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[90px] resize-y"
                  placeholder="Anotação interna sobre este feedback (não visível ao usuário)..."
                  value={notaInterna}
                  onChange={e => setNotaInterna(e.target.value)}
                />

                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={salvar}
                    disabled={salvando}
                    className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold
                               hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2 transition-colors"
                  >
                    {salvando
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                      : <><Check className="w-4 h-4" /> Salvar alterações</>
                    }
                  </button>
                  {msgSalvo && (
                    <span className={`text-sm font-medium ${msgSalvo === 'Salvo!' ? 'text-green-600' : 'text-red-500'}`}>
                      {msgSalvo}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
