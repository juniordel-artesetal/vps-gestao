'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Users, X, ChevronDown, ChevronUp, Download, Send, FileText, RotateCcw, Eye, EyeOff, Shield, Clock } from 'lucide-react'

interface Stats { total_workspaces:number; ativos:number; bloqueados:number; total_usuarios:number; ia_hoje:number; chamados_abertos:number; logins_hoje:number }
interface Workspace { id:string; nome:string; slug:string; plano:string; ativo:boolean; createdAt:string; total_usuarios:number; total_pedidos:number; ultimo_uso_ia:string|null; ultimo_login:string|null }
interface Usuario { id:string; nome:string; email:string; role:string; ativo:boolean; primeiroLogin:boolean; createdAt:string }
interface LoginEntry { id:string; email:string; usuarioNome:string; sucesso:boolean; ip:string; createdAt:string }
interface Chamado { id:string; workspaceNome:string; usuarioNome:string; email:string; descricao:string; respostaIA:string|null; notaInterna:string|null; protocolo:string; status:string; emailEnviado:boolean; respondidoEm:string|null; createdAt:string }
interface HotmartEvento { id:string; evento:string; email:string; workspaceId:string; processado:boolean; erro:string|null; createdAt:string }

const TABS = ['Workspaces','Chamados','Hotmart','Exportar'] as const
type Tab = typeof TABS[number]
const PLANOS = ['FREE','TRIAL','MENSAL','ANUAL','PRO','BUSINESS']

function fmtData(d:string|null|undefined) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'})
}
function fmtDataHora(d:string|null|undefined) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
}

export default function MasterPage() {
  const router = useRouter()
  const [tab,setTab]               = useState<Tab>('Workspaces')
  const [stats,setStats]           = useState<Stats|null>(null)
  const [workspaces,setWorkspaces] = useState<Workspace[]>([])
  const [chamados,setChamados]     = useState<Chamado[]>([])
  const [eventos,setEventos]       = useState<HotmartEvento[]>([])
  const [loading,setLoading]       = useState(true)
  const [busca,setBusca]           = useState('')
  const [feedback,setFeedback]     = useState('')

  // Modal detalhe workspace
  const [detalheWs, setDetalheWs]         = useState<{ws:Workspace; usuarios:Usuario[]; loginHistory:LoginEntry[]}|null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [editNome, setEditNome]           = useState('')
  const [editPlano, setEditPlano]         = useState('')
  const [salvandoWs, setSalvandoWs]       = useState(false)

  // Modal reset senha
  const [resetModal, setResetModal]   = useState<{userId:string; nome:string}|null>(null)
  const [novaSenha, setNovaSenha]     = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [senhaGerada, setSenhaGerada] = useState('')

  // Modal confirmar exclusão
  const [confirmDel, setConfirmDel] = useState<string|null>(null)

  // Chamados
  const [expandedChamado, setExpandedChamado] = useState<string|null>(null)
  const [notaForm, setNotaForm]               = useState<{id:string;texto:string}|null>(null)
  const [replyForm, setReplyForm]             = useState<{id:string;email:string;protocolo:string;texto:string}|null>(null)
  const [enviandoReply, setEnviandoReply]     = useState(false)

  const carregar = useCallback(async (secao:string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/master/dashboard?secao=${secao}`)
      if (res.status===401) { router.push('/master/login'); return }
      if (!res.ok) return
      const text = await res.text()
      if (!text) return
      const data = JSON.parse(text)
      if (secao==='workspaces') setWorkspaces(data.workspaces||[])
      if (secao==='chamados')   setChamados(data.chamados||[])
      if (secao==='hotmart')    setEventos(data.eventos||[])
      if (secao==='stats')      setStats(data.stats||null)
    } catch(err) {
      console.error('[master]', err)
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { carregar('stats'); carregar('workspaces') },[carregar])
  useEffect(() => {
    if (tab==='Chamados' && chamados.length===0) carregar('chamados')
    if (tab==='Hotmart'  && eventos.length===0)  carregar('hotmart')
  },[tab,carregar,chamados.length,eventos.length])

  function mostrarFeedback(msg:string) { setFeedback(msg); setTimeout(()=>setFeedback(''),3000) }

  async function abrirDetalhe(ws:Workspace) {
    setLoadingDetalhe(true)
    setEditNome(ws.nome)
    setEditPlano(ws.plano||'FREE')
    try {
      const res  = await fetch(`/api/master/workspaces/${ws.id}`)
      if (!res.ok) { mostrarFeedback(`Erro ${res.status}`); return }
      const data = await res.json()
      setDetalheWs({ ws, usuarios: data.usuarios||[], loginHistory: data.loginHistory||[] })
    } catch(e) {
      mostrarFeedback('Erro ao carregar detalhes')
    } finally { setLoadingDetalhe(false) }
  }

  async function salvarWs() {
    if (!detalheWs) return
    setSalvandoWs(true)
    await fetch(`/api/master/workspaces/${detalheWs.ws.id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nome:editNome, plano:editPlano}),
    })
    setWorkspaces(prev=>prev.map(w=>w.id===detalheWs.ws.id?{...w,nome:editNome,plano:editPlano}:w))
    setDetalheWs(prev=>prev?{...prev,ws:{...prev.ws,nome:editNome,plano:editPlano}}:null)
    setSalvandoWs(false)
    mostrarFeedback('Workspace salvo!')
  }

  async function toggleWsAtivo(id:string, ativo:boolean) {
    await fetch(`/api/master/workspaces/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ativo:!ativo})})
    setWorkspaces(prev=>prev.map(w=>w.id===id?{...w,ativo:!ativo}:w))
    if (detalheWs?.ws.id===id) setDetalheWs(prev=>prev?{...prev,ws:{...prev.ws,ativo:!ativo}}:null)
    mostrarFeedback(ativo?'Workspace bloqueado':'Workspace ativado')
  }

  async function excluirWorkspace(id:string) {
    await fetch(`/api/master/workspaces/${id}`,{method:'DELETE'})
    setWorkspaces(prev=>prev.filter(w=>w.id!==id))
    setConfirmDel(null)
    setDetalheWs(null)
    mostrarFeedback('Workspace excluído')
    carregar('stats')
  }

  async function salvarResetSenha() {
    if (!resetModal || !novaSenha) return
    await fetch(`/api/master/workspaces/${detalheWs?.ws.id}`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId:resetModal.userId, novaSenha}),
    })
    setSenhaGerada(novaSenha)
    setNovaSenha('')
  }

  async function toggleUsuarioAtivo(userId:string, ativo:boolean) {
    await fetch(`/api/master/workspaces/${detalheWs?.ws.id}`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId, ativo:!ativo}),
    })
    setDetalheWs(prev=>prev?{...prev,usuarios:prev.usuarios.map(u=>u.id===userId?{...u,ativo:!ativo}:u)}:null)
    mostrarFeedback(ativo?'Usuário desativado':'Usuário ativado')
  }

  async function alterarRole(userId:string, role:string) {
    await fetch(`/api/master/workspaces/${detalheWs?.ws.id}`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId, role}),
    })
    setDetalheWs(prev=>prev?{...prev,usuarios:prev.usuarios.map(u=>u.id===userId?{...u,role}:u)}:null)
    mostrarFeedback('Role atualizado!')
  }

  // Chamados
  async function atualizarStatus(id:string,status:string) {
    await fetch(`/api/master/chamados/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    setChamados(prev=>prev.map(c=>c.id===id?{...c,status}:c))
    mostrarFeedback('Status atualizado!')
  }
  async function salvarNota(id:string,nota:string) {
    await fetch(`/api/master/chamados/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({notaInterna:nota})})
    setChamados(prev=>prev.map(c=>c.id===id?{...c,notaInterna:nota}:c))
    setNotaForm(null)
    mostrarFeedback('Nota salva!')
  }
  async function enviarResposta() {
    if (!replyForm?.texto.trim()) return
    setEnviandoReply(true)
    const res = await fetch(`/api/master/chamados/${replyForm.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mensagem:replyForm.texto})})
    if (res.ok) { setChamados(prev=>prev.map(c=>c.id===replyForm.id?{...c,status:'EM_ATENDIMENTO',respondidoEm:new Date().toISOString()}:c)); setReplyForm(null); mostrarFeedback('Resposta enviada!') }
    setEnviandoReply(false)
  }

  function exportar(tipo:string) { window.open(`/api/master/export?tipo=${tipo}`) }
  async function logout() { await fetch('/api/master/auth',{method:'DELETE'}); router.push('/master/login') }

  const wsFiltrados = workspaces.filter(w=>!busca||w.nome.toLowerCase().includes(busca.toLowerCase()))
  const STATUS_FLOW = ['ABERTO','EM_ATENDIMENTO','RESOLVIDO']

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">Master Admin</h1>
            <p className="text-gray-500 text-xs">VPS Gestão</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {feedback && <span className="text-xs text-green-400 bg-green-900/30 border border-green-800 px-3 py-1 rounded-full">{feedback}</span>}
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 px-3 py-1.5 rounded-lg transition">Sair</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              {label:'Workspaces', value:stats.total_workspaces, color:'text-white'},
              {label:'Ativos',     value:stats.ativos,           color:'text-green-400'},
              {label:'Bloqueados', value:stats.bloqueados,       color:'text-red-400'},
              {label:'Usuários',   value:stats.total_usuarios,   color:'text-blue-400'},
              {label:'IA hoje',    value:stats.ia_hoje,          color:'text-purple-400'},
              {label:'Chamados',   value:stats.chamados_abertos, color:'text-orange-400'},
              {label:'Logins hoje',value:stats.logins_hoje,      color:'text-teal-400'},
            ].map(s=>(
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-5">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition ${tab===t?'bg-orange-500 text-white':'text-gray-400 hover:text-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-500 text-sm text-center py-12">Carregando...</p>}

        {/* ── WORKSPACES ── */}
        {!loading && tab==='Workspaces' && (
          <div>
            <input type="text" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar workspace..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"/>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Workspace</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Plano</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Usuários</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Pedidos</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Último login</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Criado</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {wsFiltrados.map(w=>(
                    <tr key={w.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition cursor-pointer" onClick={()=>abrirDetalhe(w)}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{w.nome}</p>
                        <p className="text-xs text-gray-500">{w.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">{w.plano||'FREE'}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-300">{w.total_usuarios}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-300">{w.total_pedidos}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDataHora(w.ultimo_login)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtData(w.createdAt)}</td>
                      <td className="px-4 py-3 text-center" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>toggleWsAtivo(w.id,w.ativo)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${w.ativo?'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30':'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30'}`}>
                          {w.ativo?'Ativo':'Bloqueado'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setConfirmDel(w.id)} className="text-gray-500 hover:text-red-400 transition"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {wsFiltrados.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-600">Nenhum workspace</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CHAMADOS ── */}
        {!loading && tab==='Chamados' && (
          <div className="flex flex-col gap-3">
            {chamados.map(c=>(
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-start gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-orange-400">{c.protocolo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDataHora(c.createdAt)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{c.usuarioNome}</p>
                    <p className="text-xs text-gray-500">{c.email} · {c.workspaceNome}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{c.descricao}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {STATUS_FLOW.map(s=>(
                      <button key={s} onClick={()=>atualizarStatus(c.id,s)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition ${c.status===s?'bg-orange-500 text-white border-orange-500':'bg-gray-800 text-gray-500 border-gray-700 hover:border-orange-500/50'}`}>
                        {s==='ABERTO'?'Aberto':s==='EM_ATENDIMENTO'?'Atendendo':'Resolvido'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={()=>setReplyForm({id:c.id,email:c.email,protocolo:c.protocolo,texto:''})} className="text-gray-500 hover:text-blue-400 transition"><Send size={14}/></button>
                    <button onClick={()=>setNotaForm({id:c.id,texto:c.notaInterna||''})} className="text-gray-500 hover:text-yellow-400 transition"><FileText size={14}/></button>
                    <button onClick={()=>setExpandedChamado(expandedChamado===c.id?null:c.id)} className="text-gray-500 hover:text-white transition">
                      {expandedChamado===c.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                    </button>
                  </div>
                </div>
                {expandedChamado===c.id && (
                  <div className="border-t border-gray-800 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">Descrição</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800 rounded-lg p-3">{c.descricao}</p>
                    </div>
                    {c.respostaIA && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">Última resposta da IA</p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800 rounded-lg p-3 max-h-40 overflow-y-auto">{c.respostaIA}</p>
                      </div>
                    )}
                    {c.notaInterna && (
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold text-yellow-500 mb-2">Nota interna</p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-3">{c.notaInterna}</p>
                      </div>
                    )}
                    {c.respondidoEm && <p className="text-xs text-green-400 md:col-span-2">✓ Respondido em {fmtDataHora(c.respondidoEm)}</p>}
                  </div>
                )}
              </div>
            ))}
            {chamados.length===0 && <p className="text-center text-gray-600 text-sm py-12">Nenhum chamado</p>}
          </div>
        )}

        {/* ── HOTMART ── */}
        {!loading && tab==='Hotmart' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-gray-800">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Evento</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">E-mail</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">OK</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Erro</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Data</th>
              </tr></thead>
              <tbody>
                {eventos.map(e=>(
                  <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${e.evento.includes('APPROVED')||e.evento.includes('REACTIVATED')?'bg-green-500/10 text-green-400 border-green-500/30':e.evento.includes('CANCEL')||e.evento.includes('REFUND')?'bg-red-500/10 text-red-400 border-red-500/30':'bg-gray-700 text-gray-400 border-gray-600'}`}>{e.evento}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">{e.email||'—'}</td>
                    <td className="px-4 py-3 text-center">{e.processado?<span className="text-green-400">✓</span>:<span className="text-red-400">✗</span>}</td>
                    <td className="px-4 py-3 text-xs text-red-400 max-w-xs truncate">{e.erro||'—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtData(e.createdAt)}</td>
                  </tr>
                ))}
                {eventos.length===0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-600">Nenhum evento</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── EXPORTAR ── */}
        {tab==='Exportar' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {tipo:'workspaces',label:'Workspaces',desc:'ID, nome, plano, status, usuários'},
              {tipo:'usuarios',  label:'Usuários',  desc:'Nome, email, role, workspace'},
              {tipo:'chamados',  label:'Chamados',  desc:'Protocolo, status, descrição'},
              {tipo:'hotmart',   label:'Hotmart',   desc:'Eventos, status, datas'},
            ].map(item=>(
              <div key={item.tipo} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <button onClick={()=>exportar(item.tipo)} className="flex items-center gap-2 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition">
                  <Download size={13}/> CSV
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL DETALHE WORKSPACE ── */}
      {(detalheWs || loadingDetalhe) && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-8">
            {loadingDetalhe ? (
              <div className="p-12 text-center text-gray-500 text-sm">Carregando...</div>
            ) : detalheWs && (
              <>
                {/* Header modal */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                  <div>
                    <h2 className="text-white font-semibold">{detalheWs.ws.nome}</h2>
                    <p className="text-xs text-gray-500">{detalheWs.ws.slug} · Criado em {fmtData(detalheWs.ws.createdAt)}</p>
                  </div>
                  <button onClick={()=>setDetalheWs(null)}><X size={18} className="text-gray-400 hover:text-white"/></button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Editar workspace */}
                  <div className="bg-gray-800 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Dados do workspace</h3>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Nome</label>
                        <input value={editNome} onChange={e=>setEditNome(e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Plano</label>
                        <select value={editPlano} onChange={e=>setEditPlano(e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                          {PLANOS.map(p=><option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={salvarWs} disabled={salvandoWs}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50">
                          {salvandoWs?'Salvando...':'Salvar'}
                        </button>
                        <button onClick={()=>toggleWsAtivo(detalheWs.ws.id, detalheWs.ws.ativo)}
                          className={`flex-1 text-sm rounded-lg py-2 font-semibold transition border ${detalheWs.ws.ativo?'border-red-700 text-red-400 hover:bg-red-900/20':'border-green-700 text-green-400 hover:bg-green-900/20'}`}>
                          {detalheWs.ws.ativo?'Bloquear':'Ativar'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Histórico de login */}
                  <div className="bg-gray-800 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-1.5"><Clock size={12}/> Histórico de login</h3>
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                      {detalheWs.loginHistory.length===0 && <p className="text-xs text-gray-600">Nenhum login registrado</p>}
                      {detalheWs.loginHistory.map(l=>(
                        <div key={l.id} className="flex items-center justify-between text-xs">
                          <div>
                            <span className="text-gray-300">{l.usuarioNome || l.email}</span>
                            {l.ip && <span className="text-gray-600 ml-1">· {l.ip}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={l.sucesso?'text-green-400':'text-red-400'}>{l.sucesso?'✓':'✗'}</span>
                            <span className="text-gray-600">{fmtDataHora(l.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Usuários */}
                <div className="px-6 pb-6">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3 flex items-center gap-1.5"><Users size={12}/> Usuários ({detalheWs.usuarios.length})</h3>
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    {detalheWs.usuarios.length===0 && <p className="text-xs text-gray-600 p-4">Nenhum usuário</p>}
                    {detalheWs.usuarios.map(u=>(
                      <div key={u.id} className="border-b border-gray-700/50 last:border-0">
                        {/* Linha principal do usuário */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold flex-shrink-0">
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-white font-medium">{u.nome}</p>
                              {u.primeiroLogin && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded">Senha temporária</span>}
                              {!u.ativo && <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">Inativo</span>}
                            </div>
                            {/* Login destacado */}
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-gray-600">Login:</span>
                              <span className="text-xs text-orange-300 font-mono">{u.email}</span>
                              <span className="text-xs text-gray-700">·</span>
                              <span className="text-xs text-gray-600">desde {fmtData(u.createdAt)}</span>
                            </div>
                          </div>
                          {/* Role selector */}
                          <select value={u.role} onChange={e=>alterarRole(u.id,e.target.value)}
                            className="text-xs bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                            <option value="ADMIN">Admin</option>
                            <option value="DELEGADOR">Supervisor</option>
                            <option value="OPERADOR">Operador</option>
                          </select>
                          {/* Ativar/Desativar */}
                          <button onClick={()=>toggleUsuarioAtivo(u.id,u.ativo)} title={u.ativo?'Desativar':'Ativar'} className="text-gray-500 hover:text-orange-400 transition">
                            {u.ativo?<Eye size={14}/>:<EyeOff size={14}/>}
                          </button>
                          {/* Toggle painel de senha */}
                          <button onClick={()=>{setResetModal({userId:u.id,nome:u.nome});setNovaSenha('');setSenhaGerada('')}}
                            title="Trocar senha" className="flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 border border-gray-600 hover:border-yellow-600 px-2 py-1 rounded-lg transition">
                            <RotateCcw size={11}/> Senha
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Danger zone */}
                <div className="px-6 pb-6">
                  <div className="border border-red-800/50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-red-400">Zona de perigo</p>
                      <p className="text-xs text-gray-600">Exclui o workspace e todos os dados permanentemente</p>
                    </div>
                    <button onClick={()=>setConfirmDel(detalheWs.ws.id)} className="text-xs bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg transition">
                      Excluir workspace
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal reset senha */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            {senhaGerada ? (
              <div className="text-center">
                <Shield size={32} className="text-green-400 mx-auto mb-3"/>
                <h2 className="text-white font-semibold mb-1">Senha redefinida!</h2>
                <p className="text-xs text-gray-400 mb-4">Credenciais de acesso de <strong className="text-white">{resetModal.nome}</strong>:</p>
                <div className="bg-gray-800 rounded-xl p-4 mb-4 text-left space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Login (e-mail)</p>
                    <p className="text-sm font-mono text-orange-300">
                      {detalheWs?.usuarios.find(u=>u.id===resetModal.userId)?.email ?? '—'}
                    </p>
                  </div>
                  <div className="border-t border-gray-700 pt-2">
                    <p className="text-xs text-gray-500 mb-0.5">Nova senha</p>
                    <p className="text-lg font-mono font-bold text-green-400 tracking-wider">{senhaGerada}</p>
                  </div>
                </div>
                <p className="text-xs text-yellow-600 bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-2 mb-4">
                  ⚠️ O usuário deverá trocar a senha no próximo login.
                </p>
                <button onClick={()=>{setResetModal(null);setSenhaGerada('')}} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition">Fechar</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-semibold text-sm">Trocar senha</h2>
                    <p className="text-xs text-gray-500">{resetModal.nome}</p>
                  </div>
                  <button onClick={()=>setResetModal(null)}><X size={16} className="text-gray-400 hover:text-white"/></button>
                </div>

                {/* Login do usuário */}
                <div className="bg-gray-800 rounded-lg px-3 py-2.5 mb-4">
                  <p className="text-xs text-gray-500 mb-0.5">Login (e-mail de acesso)</p>
                  <p className="text-sm font-mono text-orange-300">
                    {detalheWs?.usuarios.find(u=>u.id===resetModal.userId)?.email ?? '—'}
                  </p>
                </div>

                {/* Campo nova senha */}
                <div className="mb-2">
                  <label className="text-xs text-gray-400 block mb-1">Nova senha</label>
                  <div className="relative">
                    <input type={mostrarSenha?'text':'password'} value={novaSenha} onChange={e=>setNovaSenha(e.target.value)}
                      placeholder="Digite a nova senha (mín. 6 chars)"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white pr-10 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                    <button type="button" onClick={()=>setMostrarSenha(!mostrarSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {mostrarSenha?<EyeOff size={14}/>:<Eye size={14}/>}
                    </button>
                  </div>
                </div>

                {/* Gerar senha automática */}
                <button type="button" onClick={()=>{
                  const chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!'
                  const senha=Array.from({length:10},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
                  setNovaSenha(senha); setMostrarSenha(true)
                }} className="text-xs text-orange-400 hover:text-orange-300 mb-4 flex items-center gap-1">
                  <RotateCcw size={11}/> Gerar senha aleatória
                </button>

                <div className="flex gap-2">
                  <button onClick={()=>setResetModal(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800 transition">Cancelar</button>
                  <button onClick={salvarResetSenha} disabled={novaSenha.length<6}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50">
                    Salvar senha
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmar delete */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3"/>
            <h2 className="text-white font-semibold mb-1">Excluir workspace?</h2>
            <p className="text-sm text-gray-400 mb-5">Todos os dados serão apagados permanentemente.</p>
            <div className="flex gap-2">
              <button onClick={()=>setConfirmDel(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2.5 text-sm hover:bg-gray-800 transition">Cancelar</button>
              <button onClick={()=>excluirWorkspace(confirmDel)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-semibold transition">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nota interna */}
      {notaForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Nota interna</h2>
              <button onClick={()=>setNotaForm(null)}><X size={16} className="text-gray-400"/></button>
            </div>
            <textarea value={notaForm.texto} onChange={e=>setNotaForm(p=>p?{...p,texto:e.target.value}:null)}
              rows={5} placeholder="Anotações internas..."
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4"/>
            <div className="flex gap-2">
              <button onClick={()=>setNotaForm(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800 transition">Cancelar</button>
              <button onClick={()=>salvarNota(notaForm.id,notaForm.texto)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg py-2 text-sm font-semibold transition">Salvar nota</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal responder chamado */}
      {replyForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold">Responder por e-mail</h2>
              <button onClick={()=>setReplyForm(null)}><X size={16} className="text-gray-400"/></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Para: <span className="text-gray-300">{replyForm.email}</span> · {replyForm.protocolo}</p>
            <textarea value={replyForm.texto} onChange={e=>setReplyForm(p=>p?{...p,texto:e.target.value}:null)}
              rows={6} placeholder="Digite a resposta..."
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"/>
            <div className="flex gap-2">
              <button onClick={()=>setReplyForm(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800 transition">Cancelar</button>
              <button onClick={enviarResposta} disabled={enviandoReply||!replyForm.texto.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50">
                {enviandoReply?'Enviando...':'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
