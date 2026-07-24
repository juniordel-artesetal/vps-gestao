'use client'
// Master — fila de aprovação de parceiras + aprovadas com contadores.
import { useState, useEffect } from 'react'

export default function MasterParceiros() {
  const [dados, setDados] = useState<{ pendentes: any[]; aprovadas: any[] }>({ pendentes: [], aprovadas: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  async function carregar() {
    setLoading(true)
    const r = await fetch('/api/master/parceiros')
    if (r.ok) setDados(await r.json())
    setLoading(false)
  }
  useEffect(() => { carregar() }, [])

  async function agir(id: string, acao: 'aprovar' | 'recusar', codigo?: string) {
    setBusy(id)
    const r = await fetch(`/api/master/parceiros/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao, codigo }) })
    const d = await r.json().catch(() => ({}))
    setBusy('')
    if (!r.ok) { alert(d.error || 'Erro'); return }
    carregar()
  }

  if (loading) return <div className="p-6 text-gray-400">Carregando…</div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto text-white">
      <h1 className="text-xl font-bold mb-4">Parceiras</h1>

      <h2 className="text-sm font-semibold text-amber-400 mb-2">Pendentes ({dados.pendentes.length})</h2>
      {dados.pendentes.length === 0 && <p className="text-gray-500 text-sm mb-6">Nenhuma candidatura aguardando.</p>}
      <div className="space-y-3 mb-8">
        {dados.pendentes.map(p => <PendenteCard key={p.id} p={p} busy={busy === p.id} agir={agir} />)}
      </div>

      <h2 className="text-sm font-semibold text-gray-300 mb-2">Aprovadas / recusadas ({dados.aprovadas.length})</h2>
      <div className="space-y-2">
        {dados.aprovadas.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium">{p.nome}</span>
            <span className={p.status === 'aprovada' ? 'text-emerald-400' : 'text-red-400'}>{p.status}</span>
            <span className="text-gray-400">cupom <b className="text-white">{p.cupom}</b></span>
            <span className="text-gray-500">{p.percMensal}%/{p.percAnual}% · {p.temWallet ? 'wallet ok' : '⚠️ sem wallet'}</span>
            <span className="text-gray-500 ml-auto">👥 {p.indicacoes} · ✅ {p.ativas} · 🔗 {p.cliques}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PendenteCard({ p, busy, agir }: { p: any; busy: boolean; agir: (id: string, a: 'aprovar' | 'recusar', c?: string) => void }) {
  const [codigo, setCodigo] = useState(p.cupom || '')
  const completou = p.temSenha && p.temCodigo
  return (
    <div className="bg-gray-900 border border-amber-800/40 rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{p.nome}</span>
        {p.instagram && <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">@{p.instagram}</a>}
        {p.whatsapp && <span className="text-emerald-400">📱 {p.whatsapp}</span>}
        <span className="text-gray-400">{p.email}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1.5">
        <span className={p.temSenha ? 'text-emerald-400' : 'text-gray-500'}>{p.temSenha ? '✓ senha' : '○ sem senha'}</span>
        <span className={p.temCodigo ? 'text-emerald-400' : 'text-gray-500'}>{p.temCodigo ? '✓ código' : '○ sem código'}</span>
        <span className={p.temWallet ? 'text-emerald-400' : 'text-amber-400'}>{p.temWallet ? '✓ wallet' : '○ sem wallet (opcional)'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <label className="text-xs text-gray-400">cupom/link:</label>
        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="(definido por ela)" className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm w-36" />
        <button disabled={busy || !completou} title={completou ? '' : 'Aguardando a parceira definir senha e código'} onClick={() => agir(p.id, 'aprovar', codigo)} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-3 py-1 text-sm font-medium">Aprovar</button>
        <button disabled={busy} onClick={() => agir(p.id, 'recusar')} className="bg-gray-700 hover:bg-red-800 disabled:opacity-50 text-white rounded px-3 py-1 text-sm">Recusar</button>
        {!completou && <span className="text-[11px] text-gray-500">aguardando ela completar o cadastro</span>}
      </div>
    </div>
  )
}
