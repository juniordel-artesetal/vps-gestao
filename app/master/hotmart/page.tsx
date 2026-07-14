'use client'
// app/master/hotmart/page.tsx
// Gestão de Assinantes (leitura da API Hotmart): plano/status/valor/próxima cobrança,
// cruzado por e-mail com a usuária do SOA. Destaque da coorte a migrar p/ R$29,90.
// A troca de plano em si é feita no painel da Hotmart — aqui é o radar.
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Search, AlertTriangle, DollarSign, CheckCircle, XCircle, Link2Off, Download } from 'lucide-react'

interface Row {
  codigo: string; email: string | null; nomeAssinante: string | null
  planoId: string | null; planoNome: string | null; status: string | null
  valor: number | null; moeda: string | null; adesao: string | null; proximaCobranca: string | null
  atualizadoEm: string | null
  soaWorkspaceId: string | null; soaNome: string | null; soaAtivo: boolean | null; soaLiberacao: boolean | null
  bucket: 'ATIVO' | 'ATRASO' | 'CANCELADO' | 'OUTRO'; em4990: boolean; matched: boolean; migrar: boolean
}
interface Totais { total: number; ativas: number; atraso: number; canceladas: number; em4990: number; semMatch: number; migrar: number }

const inp = 'bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500'
function fmtData(d?: string | null) { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
function fmtValor(v: number | null, m?: string | null) { if (v == null) return '—'; return `${m === 'BRL' || !m ? 'R$' : m + ' '}${v.toFixed(2).replace('.', ',')}` }
const BADGE: Record<string, string> = {
  ATIVO: 'bg-green-500/10 text-green-400 border-green-500/30',
  ATRASO: 'bg-red-500/10 text-red-400 border-red-500/30',
  CANCELADO: 'bg-gray-600/20 text-gray-400 border-gray-600/40',
  OUTRO: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
}

export default function HotmartPage() {
  const [lista, setLista] = useState<Row[]>([])
  const [totais, setTotais] = useState<Totais | null>(null)
  const [status, setStatus] = useState<{ configurado: boolean; total: number; ultimoSync: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [aviso, setAviso] = useState('')

  const [q, setQ] = useState('')
  const [fBucket, setFBucket] = useState('')
  const [fPlano, setFPlano] = useState('')
  const [so4990, setSo4990] = useState(false)
  const [soMigrar, setSoMigrar] = useState(false)

  function flash(m: string) { setAviso(m); setTimeout(() => setAviso(''), 3500) }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [st, as] = await Promise.all([
        fetch('/api/master/hotmart/sync').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/master/hotmart/assinaturas').then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      setStatus(st)
      setLista(as?.lista || [])
      setTotais(as?.totais || null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function sincronizar() {
    setSincronizando(true); setAviso('')
    try {
      const r = await fetch('/api/master/hotmart/sync', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) flash(`✅ Sincronizado: ${d.total} assinaturas (${d.paginas} páginas)`)
      else flash(`⚠️ ${d.error || 'Falha na sincronização'}${d.gravadas ? ` (${d.gravadas} gravadas)` : ''}`)
      await carregar()
    } finally { setSincronizando(false) }
  }

  const planos = Array.from(new Set(lista.map(r => r.planoNome).filter(Boolean))) as string[]
  const filtrada = lista.filter(r => {
    if (fBucket && r.bucket !== fBucket) return false
    if (fPlano && r.planoNome !== fPlano) return false
    if (so4990 && !r.em4990) return false
    if (soMigrar && !r.migrar) return false
    if (q) {
      const t = q.toLowerCase()
      if (!(`${r.nomeAssinante ?? ''} ${r.email ?? ''} ${r.codigo}`.toLowerCase().includes(t))) return false
    }
    return true
  })

  const CARDS: { label: string; valor: number; cor: string; on?: () => void }[] = totais ? [
    { label: 'Total', valor: totais.total, cor: 'text-white', on: () => { setFBucket(''); setSo4990(false); setSoMigrar(false) } },
    { label: 'Ativas', valor: totais.ativas, cor: 'text-green-400', on: () => setFBucket('ATIVO') },
    { label: 'Em atraso', valor: totais.atraso, cor: 'text-red-400', on: () => setFBucket('ATRASO') },
    { label: 'Em R$49,90', valor: totais.em4990, cor: 'text-orange-400', on: () => { setSo4990(true); setFBucket('') } },
    { label: 'Canceladas', valor: totais.canceladas, cor: 'text-gray-400', on: () => setFBucket('CANCELADO') },
    { label: 'Sem match SOA', valor: totais.semMatch, cor: 'text-yellow-400' },
  ] : []

  function exportarMigrar() {
    const alvo = lista.filter(r => r.migrar)
    const linhas = [['codigo', 'nome', 'email', 'plano', 'valor', 'status', 'proximaCobranca'].join(';')]
      .concat(alvo.map(r => [r.codigo, r.nomeAssinante ?? '', r.email ?? '', r.planoNome ?? '', r.valor ?? '', r.status ?? '', r.proximaCobranca ? fmtData(r.proximaCobranca) : ''].join(';')))
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'migrar-2990.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a href="/master" className="text-gray-400 hover:text-white transition"><ArrowLeft size={18} /></a>
          <div>
            <h1 className="text-white font-semibold text-sm flex items-center gap-2"><DollarSign size={15} className="text-orange-400" /> Gestão de Assinantes — Hotmart</h1>
            <p className="text-gray-500 text-xs">
              {status?.ultimoSync ? `Último sync: ${new Date(status.ultimoSync).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}
              {status && !status.configurado && <span className="text-red-400"> · credenciais não configuradas no servidor</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {aviso && <span className="text-xs text-gray-200 bg-gray-800 border border-gray-700 px-3 py-1 rounded-full max-w-md truncate">{aviso}</span>}
          <button onClick={sincronizar} disabled={sincronizando || (status ? !status.configurado : false)}
            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition flex items-center gap-1.5">
            <RefreshCw size={13} className={sincronizando ? 'animate-spin' : ''} /> {sincronizando ? 'Sincronizando…' : 'Sincronizar Hotmart'}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {status && !status.configurado && (
          <div className="mb-5 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm">
            <p className="font-semibold text-amber-300 mb-1">Credenciais da Hotmart não configuradas</p>
            <p className="text-amber-200/80 text-xs mb-2">Gere as credenciais de API na Hotmart e defina no servidor (Vercel → Environment Variables) + redeploy:</p>
            <pre className="text-xs bg-black/40 rounded p-3 overflow-x-auto text-amber-100">HOTMART_CLIENT_ID=…
HOTMART_CLIENT_SECRET=…
# opcional (se a Hotmart te der o token Basic pronto):
HOTMART_BASIC=…</pre>
          </div>
        )}

        {/* Totais */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          {CARDS.map(c => (
            <button key={c.label} onClick={c.on} disabled={!c.on}
              className={`bg-gray-900 border border-gray-800 rounded-xl p-3 text-center transition ${c.on ? 'hover:border-orange-500/50 cursor-pointer' : ''}`}>
              <p className={`text-2xl font-bold ${c.cor}`}>{c.valor}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{c.label}</p>
            </button>
          ))}
        </div>

        {/* Destaque migrar */}
        {totais && totais.migrar > 0 && (
          <div className="mb-4 rounded-xl border border-orange-600/40 bg-orange-950/30 p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-orange-400" />
              <span className="text-orange-200"><b>{totais.migrar}</b> assinante(s) em R$49,90 e/ou atraso — coorte para migrar ao plano de R$29,90 (troca manual no painel Hotmart).</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSoMigrar(!soMigrar); setFBucket(''); setSo4990(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${soMigrar ? 'bg-orange-500 text-white border-orange-500' : 'border-orange-500/50 text-orange-300 hover:bg-orange-500/10'}`}>
                {soMigrar ? 'Mostrando só a migrar' : 'Filtrar a migrar'}
              </button>
              <button onClick={exportarMigrar} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 flex items-center gap-1.5"><Download size={12} /> CSV</button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou código..." className={inp + ' w-full pl-9'} />
          </div>
          <select value={fBucket} onChange={e => setFBucket(e.target.value)} className={inp}>
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativas</option>
            <option value="ATRASO">Em atraso</option>
            <option value="CANCELADO">Canceladas</option>
            <option value="OUTRO">Outros</option>
          </select>
          <select value={fPlano} onChange={e => setFPlano(e.target.value)} className={inp}>
            <option value="">Todos os planos</option>
            {planos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={() => setSo4990(!so4990)} className={`text-xs px-3 py-2 rounded-xl border transition ${so4990 ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}>R$49,90</button>
          {(q || fBucket || fPlano || so4990 || soMigrar) && <button onClick={() => { setQ(''); setFBucket(''); setFPlano(''); setSo4990(false); setSoMigrar(false) }} className="text-xs text-orange-400 border border-orange-800 px-3 py-2 rounded-xl hover:bg-orange-500/10">Limpar</button>}
        </div>

        {/* Lista */}
        {loading ? <p className="text-gray-500 text-sm text-center py-12">Carregando...</p>
          : lista.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              <p className="mb-2">Nenhuma assinatura no cache ainda.</p>
              {status?.configurado ? <p>Clique em <b className="text-orange-400">Sincronizar Hotmart</b> para puxar as assinaturas.</p> : <p>Configure as credenciais no servidor para sincronizar.</p>}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Assinante', 'Plano', 'Valor', 'Status', 'Adesão', 'Próx. cobrança', 'SOA'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrada.map(r => (
                    <tr key={r.codigo} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition ${r.migrar ? 'bg-orange-950/10' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{r.nomeAssinante || '—'}</p>
                        <p className="text-xs text-gray-500">{r.email || <span className="text-yellow-500/70">sem e-mail</span>} · <span className="font-mono text-gray-600">{r.codigo}</span></p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">{r.planoNome || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm ${r.em4990 ? 'text-orange-400 font-semibold' : 'text-gray-300'}`}>{fmtValor(r.valor, r.moeda)}</span>
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${BADGE[r.bucket]}`}>{r.status || r.bucket}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtData(r.adesao)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtData(r.proximaCobranca)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!r.matched ? (
                          <span className="text-xs text-yellow-500/80 flex items-center gap-1"><Link2Off size={12} /> sem match</span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            {r.soaAtivo ? <CheckCircle size={13} className="text-green-400" /> : <XCircle size={13} className="text-red-400" />}
                            <span className={`text-xs ${r.soaAtivo ? 'text-green-400' : 'text-red-400'}`}>{r.soaAtivo ? 'acesso' : 'cortado'}</span>
                            {r.soaLiberacao && <span className="text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full" title="Liberação manual ativa">lib.manual</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {!loading && lista.length > 0 && <p className="text-xs text-gray-600 mt-3">{filtrada.length} de {lista.length} assinaturas</p>}
      </div>
    </div>
  )
}
