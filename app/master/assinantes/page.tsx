'use client'
// app/master/assinantes/page.tsx
// Gestão de assinantes: lista com busca/filtros/métricas, detalhe (usuários, plano,
// status) e "Acessar como" (impersonation segura e auditada).

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, Search, Users, X, Clock, Shield, RotateCcw, Eye, EyeOff,
  LogIn, RefreshCw, UserCog,
} from 'lucide-react'

interface WsRow {
  id: string; nome: string; slug: string; plano: string | null; ativo: boolean
  segmento: string | null; createdAt: string; totalUsuarios: number
  adminEmail: string | null; ultimoLogin: string | null
}
interface Usuario { id: string; nome: string; email: string; role: string; ativo: boolean; primeiroLogin: boolean; createdAt: string }
interface Metricas { total: number; ativos: number; bloqueados: number; novos30d: number; inativos30d: number }

const PLANOS = ['FREE', 'TRIAL', 'MENSAL', 'ANUAL', 'PRO', 'BUSINESS']
const inp = 'bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500'

function fmtData(d?: string | null) { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
function fmtDataHora(d?: string | null) { if (!d) return 'nunca'; const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }

export default function AssinantesPage() {
  const [lista, setLista] = useState<WsRow[]>([])
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [loading, setLoading] = useState(true)
  const [aviso, setAviso] = useState('')

  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPlano, setFPlano] = useState('')
  const [fAtividade, setFAtividade] = useState('')

  // Detalhe
  const [det, setDet] = useState<{ ws: any; usuarios: Usuario[]; loginHistory: any[] } | null>(null)
  const [loadingDet, setLoadingDet] = useState(false)
  const [reset, setReset] = useState<{ userId: string; nome: string } | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [senhaOk, setSenhaOk] = useState('')

  function flash(m: string) { setAviso(m); setTimeout(() => setAviso(''), 2500) }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q.trim()) qs.set('q', q.trim())
      if (fStatus) qs.set('status', fStatus)
      if (fPlano) qs.set('plano', fPlano)
      if (fAtividade) qs.set('atividade', fAtividade)
      const r = await fetch(`/api/master/workspaces?${qs.toString()}`)
      if (!r.ok) { setLista([]); return }
      const d = await r.json()
      setLista(d.lista || []); setMetricas(d.metricas || null)
    } finally { setLoading(false) }
  }, [q, fStatus, fPlano, fAtividade])

  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t) }, [carregar])

  async function abrir(id: string) {
    setLoadingDet(true); setDet(null)
    try {
      const r = await fetch(`/api/master/workspaces/${id}`)
      if (r.ok) { const d = await r.json(); setDet({ ws: d.workspace, usuarios: d.usuarios || [], loginHistory: d.loginHistory || [] }) }
    } finally { setLoadingDet(false) }
  }

  async function putWs(id: string, body: any) {
    await fetch(`/api/master/workspaces/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setLista(prev => prev.map(w => w.id === id ? { ...w, ...body } : w))
    setDet(prev => prev && prev.ws.id === id ? { ...prev, ws: { ...prev.ws, ...body } } : prev)
  }
  async function toggleAtivo(w: { id: string; ativo: boolean; nome: string }) {
    if (!confirm(`${w.ativo ? 'Bloquear' : 'Reativar'} "${w.nome}"?`)) return
    await putWs(w.id, { ativo: !w.ativo }); flash(w.ativo ? 'Workspace bloqueado' : 'Workspace reativado'); carregar()
  }
  async function mudarPlano(id: string, plano: string) { await putWs(id, { plano }); flash('Plano atualizado') }
  async function patchUser(body: any) {
    if (!det) return
    await fetch(`/api/master/workspaces/${det.ws.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }
  async function alterarRole(userId: string, role: string) {
    await patchUser({ userId, role })
    setDet(prev => prev ? { ...prev, usuarios: prev.usuarios.map(u => u.id === userId ? { ...u, role } : u) } : prev)
    flash('Papel atualizado')
  }
  async function toggleUser(u: Usuario) {
    await patchUser({ userId: u.id, ativo: !u.ativo })
    setDet(prev => prev ? { ...prev, usuarios: prev.usuarios.map(x => x.id === u.id ? { ...x, ativo: !u.ativo } : x) } : prev)
    flash(u.ativo ? 'Usuário desativado' : 'Usuário ativado')
  }
  async function salvarSenha() {
    if (!reset || novaSenha.length < 6) return
    await patchUser({ userId: reset.userId, novaSenha })
    setSenhaOk(novaSenha); setNovaSenha('')
  }

  async function acessarComo(workspaceId: string, userId?: string, nome?: string) {
    if (!confirm(`Acessar como ${nome || 'esta assinante'} em MODO SUPORTE?\n\nVocê entrará na conta dela sem a senha. A ação é auditada e um banner ficará visível até você sair.`)) return
    const r = await fetch('/api/master/impersonar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId, userId }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) window.location.href = d.redirect || '/modulos'
    else alert(d.error || 'Erro ao acessar')
  }

  const temFiltro = q || fStatus || fPlano || fAtividade
  const METRICAS: { label: string; valor: number; cor: string; f?: () => void }[] = metricas ? [
    { label: 'Total', valor: metricas.total, cor: 'text-white', f: () => { setFStatus(''); setFAtividade('') } },
    { label: 'Ativos', valor: metricas.ativos, cor: 'text-green-400', f: () => setFStatus('ativo') },
    { label: 'Bloqueados', valor: metricas.bloqueados, cor: 'text-red-400', f: () => setFStatus('inativo') },
    { label: 'Novos (30d)', valor: metricas.novos30d, cor: 'text-blue-400' },
    { label: 'Inativos (30d)', valor: metricas.inativos30d, cor: 'text-yellow-400', f: () => setFAtividade('inativos') },
  ] : []

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a href="/master" className="text-gray-400 hover:text-white transition"><ArrowLeft size={18} /></a>
          <div>
            <h1 className="text-white font-semibold text-sm flex items-center gap-2"><Users size={15} className="text-teal-400" /> Assinantes</h1>
            <p className="text-gray-500 text-xs">Gestão de workspaces, usuários e acesso de suporte</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {aviso && <span className="text-xs text-green-400 bg-green-900/30 border border-green-800 px-3 py-1 rounded-full">{aviso}</span>}
          <button onClick={carregar} className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"><RefreshCw size={13} /> Atualizar</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {METRICAS.map(m => (
            <button key={m.label} onClick={m.f} disabled={!m.f}
              className={`bg-gray-900 border border-gray-800 rounded-xl p-3 text-center transition ${m.f ? 'hover:border-orange-500/50 cursor-pointer' : ''}`}>
              <p className={`text-2xl font-bold ${m.cor}`}>{m.valor}</p>
              <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, slug ou e-mail..." className={inp + ' w-full pl-9'} />
          </div>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inp}>
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Bloqueados</option>
          </select>
          <select value={fPlano} onChange={e => setFPlano(e.target.value)} className={inp}>
            <option value="">Todos os planos</option>
            {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={fAtividade} onChange={e => setFAtividade(e.target.value)} className={inp}>
            <option value="">Qualquer atividade</option>
            <option value="ativos">Acessou (7d)</option>
            <option value="inativos">Inativo (30d+)</option>
          </select>
          {temFiltro && <button onClick={() => { setQ(''); setFStatus(''); setFPlano(''); setFAtividade('') }} className="text-xs text-orange-400 border border-orange-800 px-3 py-1.5 rounded-xl hover:bg-orange-500/10">Limpar</button>}
        </div>

        {/* Lista */}
        {loading ? <p className="text-gray-500 text-sm text-center py-12">Carregando...</p>
          : lista.length === 0 ? <p className="text-gray-600 text-sm text-center py-12">Nenhum assinante encontrado</p> : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Assinante</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Plano</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Usuários</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Último acesso</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(w => (
                    <tr key={w.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3 cursor-pointer" onClick={() => abrir(w.id)}>
                        <p className="text-sm font-medium text-white">{w.nome}</p>
                        <p className="text-xs text-gray-500">{w.adminEmail || w.slug}</p>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">{w.plano || 'FREE'}</span></td>
                      <td className="px-4 py-3 text-center text-sm text-gray-300">{w.totalUsuarios}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDataHora(w.ultimoLogin)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleAtivo(w)} className={`text-xs px-2.5 py-1 rounded-full border transition ${w.ativo ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                          {w.ativo ? 'Ativo' : 'Bloqueado'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => acessarComo(w.id, undefined, w.nome)} title="Acessar como (modo suporte)"
                            className="text-xs flex items-center gap-1 text-teal-300 border border-teal-500/40 hover:bg-teal-500/10 px-2.5 py-1 rounded-lg transition">
                            <LogIn size={12} /> Acessar
                          </button>
                          <button onClick={() => abrir(w.id)} className="text-gray-400 hover:text-white transition" title="Detalhes"><UserCog size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Detalhe */}
      {(det || loadingDet) && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-8">
            {loadingDet ? <div className="p-12 text-center text-gray-500 text-sm">Carregando...</div> : det && (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                  <div>
                    <h2 className="text-white font-semibold">{det.ws.nome}</h2>
                    <p className="text-xs text-gray-500">{det.ws.slug} · criado {fmtData(det.ws.createdAt)}{det.ws.segmento ? ` · ${det.ws.segmento}` : ''}</p>
                  </div>
                  <button onClick={() => setDet(null)}><X size={18} className="text-gray-400 hover:text-white" /></button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Plano / status / acessar */}
                  <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase">Plano e status</h3>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Plano</label>
                      <select value={det.ws.plano || 'FREE'} onChange={e => mudarPlano(det.ws.id, e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                        {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAtivo(det.ws)}
                        className={`flex-1 text-sm rounded-lg py-2 font-semibold transition border ${det.ws.ativo ? 'border-red-700 text-red-400 hover:bg-red-900/20' : 'border-green-700 text-green-400 hover:bg-green-900/20'}`}>
                        {det.ws.ativo ? 'Bloquear' : 'Reativar'}
                      </button>
                      <button onClick={() => acessarComo(det.ws.id, undefined, det.ws.nome)}
                        className="flex-1 text-sm rounded-lg py-2 font-semibold transition border border-teal-500/50 text-teal-300 hover:bg-teal-500/10 flex items-center justify-center gap-1.5">
                        <LogIn size={14} /> Acessar como
                      </button>
                    </div>
                  </div>

                  {/* Histórico de login */}
                  <div className="bg-gray-800 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-1.5"><Clock size={12} /> Últimos logins</h3>
                    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                      {det.loginHistory.length === 0 && <p className="text-xs text-gray-600">Nenhum login</p>}
                      {det.loginHistory.map((l: any) => (
                        <div key={l.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 truncate">{l.usuarioNome || l.email}</span>
                          <span className="flex items-center gap-2"><span className={l.sucesso ? 'text-green-400' : 'text-red-400'}>{l.sucesso ? '✓' : '✗'}</span><span className="text-gray-600">{fmtDataHora(l.createdAt)}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Usuários */}
                <div className="px-6 pb-6">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-1.5"><Users size={12} /> Usuários ({det.usuarios.length})</h3>
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    {det.usuarios.map(u => (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-700/50 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold flex-shrink-0">{u.nome.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-white font-medium">{u.nome}</p>
                            {u.primeiroLogin && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded">Senha temp.</span>}
                            {!u.ativo && <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">Inativo</span>}
                          </div>
                          <span className="text-xs text-orange-300 font-mono">{u.email}</span>
                        </div>
                        <select value={u.role} onChange={e => alterarRole(u.id, e.target.value)} className="text-xs bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                          <option value="ADMIN">Admin</option>
                          <option value="DELEGADOR">Supervisor</option>
                          <option value="OPERADOR">Operador</option>
                        </select>
                        <button onClick={() => toggleUser(u)} title={u.ativo ? 'Desativar' : 'Ativar'} className="text-gray-500 hover:text-orange-400 transition">{u.ativo ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                        <button onClick={() => { setReset({ userId: u.id, nome: u.nome }); setNovaSenha(''); setSenhaOk('') }} title="Trocar senha" className="text-gray-500 hover:text-yellow-400 transition"><RotateCcw size={13} /></button>
                        <button onClick={() => acessarComo(det.ws.id, u.id, u.nome)} title="Acessar como este usuário" className="text-teal-400 hover:text-teal-300 transition"><LogIn size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reset senha */}
      {reset && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            {senhaOk ? (
              <div className="text-center">
                <Shield size={32} className="text-green-400 mx-auto mb-3" />
                <h2 className="text-white font-semibold mb-1">Senha redefinida!</h2>
                <p className="text-xs text-gray-400 mb-3">Nova senha de <strong className="text-white">{reset.nome}</strong>:</p>
                <p className="text-lg font-mono font-bold text-green-400 tracking-wider bg-gray-800 rounded-lg py-3 mb-4">{senhaOk}</p>
                <button onClick={() => { setReset(null); setSenhaOk('') }} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold">Fechar</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold text-sm">Trocar senha — {reset.nome}</h2>
                  <button onClick={() => setReset(null)}><X size={16} className="text-gray-400 hover:text-white" /></button>
                </div>
                <input type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Nova senha (mín. 6)" className={inp + ' w-full mb-2'} />
                <button type="button" onClick={() => { const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!'; setNovaSenha(Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('')) }} className="text-xs text-orange-400 hover:text-orange-300 mb-4 flex items-center gap-1"><RotateCcw size={11} /> Gerar aleatória</button>
                <div className="flex gap-2">
                  <button onClick={() => setReset(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800">Cancelar</button>
                  <button onClick={salvarSenha} disabled={novaSenha.length < 6} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">Salvar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
