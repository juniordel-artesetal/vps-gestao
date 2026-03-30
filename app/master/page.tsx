'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Users, X, ChevronDown, ChevronUp, Download, Send, FileText, RotateCcw } from 'lucide-react'

interface Stats { total_workspaces:number; ativos:number; bloqueados:number; total_usuarios:number; ia_hoje:number; chamados_abertos:number }
interface Workspace { id:string; nome:string; slug:string; plano:string; ativo:boolean; createdAt:string; total_usuarios:number; total_pedidos:number; ultimo_uso_ia:string|null }
interface Usuario { id:string; nome:string; email:string; role:string; ativo:boolean }
interface Chamado { id:string; workspaceNome:string; usuarioNome:string; email:string; descricao:string; respostaIA:string|null; notaInterna:string|null; protocolo:string; status:string; emailEnviado:boolean; respondidoEm:string|null; createdAt:string }
interface HotmartEvento { id:string; evento:string; email:string; workspaceId:string; processado:boolean; erro:string|null; createdAt:string }

const TABS = ['Workspaces','Chamados','Hotmart','Exportar'] as const
type Tab = typeof TABS[number]
const PLANOS = ['FREE','BASIC','PRO','BUSINESS']
const STATUS_FLOW = ['ABERTO','EM_ATENDIMENTO','RESOLVIDO']

function fmtData(d:string) { return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) }
function fmtDataHora(d:string) { return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) }

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

  // Modais workspace
  const [editWs,setEditWs]           = useState<Workspace|null>(null)
  const [editForm,setEditForm]       = useState({nome:'',plano:''})
  const [confirmDel,setConfirmDel]   = useState<string|null>(null)
  const [usersWs,setUsersWs]         = useState<{ws:Workspace,lista:Usuario[]}|null>(null)
  const [senhaReset,setSenhaReset]   = useState<{nome:string,senha:string}|null>(null)

  // Modais chamado
  const [expandedChamado,setExpandedChamado] = useState<string|null>(null)
  const [notaForm,setNotaForm]               = useState<{id:string,texto:string}|null>(null)
  const [replyForm,setReplyForm]             = useState<{id:string,email:string,protocolo:string,texto:string}|null>(null)
  const [enviandoReply,setEnviandoReply]     = useState(false)

  const carregar = useCallback(async (secao:string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/master/dashboard?secao=${secao}`)
      if (res.status===401) { router.push('/master/login'); return }
      if (!res.ok) { console.error(`[master] erro ${res.status} secao=${secao}`); return }
      const text = await res.text()
      if (!text) return
      const data = JSON.parse(text)
      if (secao==='workspaces') setWorkspaces(data.workspaces||[])
      if (secao==='chamados')   setChamados(data.chamados||[])
      if (secao==='hotmart')    setEventos(data.eventos||[])
      if (secao==='stats')      setStats(data.stats||null)
    } catch(err) {
      console.error('[master carregar]', err)
    } finally { setLoading(false) }
  },[router])

  useEffect(() => { carregar('stats'); carregar('workspaces') },[carregar])
  useEffect(() => {
    if (tab==='Chamados' && chamados.length===0) carregar('chamados')
    if (tab==='Hotmart'  && eventos.length===0)  carregar('hotmart')
  },[tab,carregar,chamados.length,eventos.length])

  function mostrarFeedback(msg:string) { setFeedback(msg); setTimeout(()=>setFeedback(''),3000) }

  // ── Workspace actions ──
  async function salvarEdicaoWs() {
    if (!editWs) return
    await fetch(`/api/master/workspaces/${editWs.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(editForm)})
    setWorkspaces(prev=>prev.map(w=>w.id===editWs.id?{...w,...editForm}:w))
    setEditWs(null)
    mostrarFeedback('Workspace atualizado!')
  }

  async function toggleAtivo(id:string,ativo:boolean) {
    await fetch(`/api/master/workspaces/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ativo:!ativo})})
    setWorkspaces(prev=>prev.map(w=>w.id===id?{...w,ativo:!ativo}:w))
    mostrarFeedback(ativo?'Workspace bloqueado':'Workspace ativado')
  }

  async function excluirWorkspace(id:string) {
    await fetch(`/api/master/workspaces/${id}`,{method:'DELETE'})
    setWorkspaces(prev=>prev.filter(w=>w.id!==id))
    setConfirmDel(null)
    mostrarFeedback('Workspace excluído')
    carregar('stats')
  }

  async function carregarUsuarios(ws:Workspace) {
    mostrarFeedback('Carregando usuários...')
    try {
      const res  = await fetch(`/api/master/workspaces/${ws.id}`)
      if (!res.ok) { mostrarFeedback('Erro ' + res.status + ' — substitua o arquivo da rota pelo v2'); return }
      const data = await res.json()
      setUsersWs({ws,lista:data.usuarios||[]})
    } catch(err) {
      mostrarFeedback('Erro ao carregar — cheque o console')
      console.error('[carregarUsuarios]', err)
    }
  }

  async function resetarSenha(wsId:string,userId:string,nome:string) {
    const res  = await fetch(`/api/master/workspaces/${wsId}/usuarios/${userId}`,{method:'PUT'})
    const data = await res.json()
    if (data.novaSenha) setSenhaReset({nome,senha:data.novaSenha})
  }

  // ── Chamado actions ──
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
    if (res.ok) {
      setChamados(prev=>prev.map(c=>c.id===replyForm.id?{...c,status:'EM_ATENDIMENTO',respondidoEm:new Date().toISOString()}:c))
      setReplyForm(null)
      mostrarFeedback('Resposta enviada por e-mail!')
    }
    setEnviandoReply(false)
  }

  // ── Export ──
  function exportar(tipo:string) {
    window.open(`/api/master/export?tipo=${tipo}`)
  }

  async function logout() { await fetch('/api/master/auth',{method:'DELETE'}); router.push('/master/login') }

  const wsFiltrados = workspaces.filter(w=>!busca||w.nome.toLowerCase().includes(busca.toLowerCase()))

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              {label:'Workspaces', value:stats.total_workspaces, color:'text-white'},
              {label:'Ativos',     value:stats.ativos,           color:'text-green-400'},
              {label:'Bloqueados', value:stats.bloqueados,       color:'text-red-400'},
              {label:'Usuários',   value:stats.total_usuarios,   color:'text-blue-400'},
              {label:'IA hoje',    value:stats.ia_hoje,          color:'text-purple-400'},
              {label:'Chamados',   value:stats.chamados_abertos, color:'text-orange-400'},
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
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Último uso IA</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Criado</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {wsFiltrados.map(w=>(
                    <tr key={w.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{w.nome}</p>
                        <p className="text-xs text-gray-500">{w.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">{w.plano||'FREE'}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-300">{w.total_usuarios}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-300">{w.total_pedidos}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{w.ultimo_uso_ia?fmtData(w.ultimo_uso_ia):'—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtData(w.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={()=>toggleAtivo(w.id,w.ativo)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${w.ativo?'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30':'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30'}`}>
                          {w.ativo?'Ativo':'Bloqueado'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={()=>carregarUsuarios(w)} title="Ver usuários"
                            className="text-gray-500 hover:text-blue-400 transition"><Users size={14}/></button>
                          <button onClick={()=>{setEditWs(w);setEditForm({nome:w.nome,plano:w.plano||'FREE'})}} title="Editar"
                            className="text-gray-500 hover:text-orange-400 transition"><Pencil size={14}/></button>
                          <button onClick={()=>setConfirmDel(w.id)} title="Excluir"
                            className="text-gray-500 hover:text-red-400 transition"><Trash2 size={14}/></button>
                        </div>
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
                  {/* Protocolo */}
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-orange-400">{c.protocolo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDataHora(c.createdAt)}</p>
                  </div>
                  {/* Usuária */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{c.usuarioNome}</p>
                    <p className="text-xs text-gray-500">{c.email} · {c.workspaceNome}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{c.descricao}</p>
                  </div>
                  {/* Status pipeline */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {STATUS_FLOW.map((s,i)=>(
                      <button key={s} onClick={()=>atualizarStatus(c.id,s)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition ${c.status===s?'bg-orange-500 text-white border-orange-500':'bg-gray-800 text-gray-500 border-gray-700 hover:border-orange-500/50'}`}>
                        {s==='ABERTO'?'Aberto':s==='EM_ATENDIMENTO'?'Atendendo':'Resolvido'}
                      </button>
                    ))}
                  </div>
                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={()=>setReplyForm({id:c.id,email:c.email,protocolo:c.protocolo,texto:''})} title="Responder por e-mail"
                      className="text-gray-500 hover:text-blue-400 transition"><Send size={14}/></button>
                    <button onClick={()=>setNotaForm({id:c.id,texto:c.notaInterna||''})} title="Nota interna"
                      className="text-gray-500 hover:text-yellow-400 transition"><FileText size={14}/></button>
                    <button onClick={()=>setExpandedChamado(expandedChamado===c.id?null:c.id)} title="Ver detalhes"
                      className="text-gray-500 hover:text-white transition">
                      {expandedChamado===c.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                    </button>
                  </div>
                </div>

                {/* Expandido */}
                {expandedChamado===c.id && (
                  <div className="border-t border-gray-800 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">Descrição completa</p>
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
                    {c.respondidoEm && (
                      <p className="text-xs text-green-400 md:col-span-2">✓ Respondido por e-mail em {fmtDataHora(c.respondidoEm)}</p>
                    )}
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
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Evento</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">E-mail</th>
                  <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">OK</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Erro</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map(e=>(
                  <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${e.evento.includes('APPROVED')||e.evento.includes('REACTIVATED')?'bg-green-500/10 text-green-400 border-green-500/30':e.evento.includes('CANCEL')||e.evento.includes('REFUND')||e.evento.includes('CHARGEBACK')?'bg-red-500/10 text-red-400 border-red-500/30':'bg-gray-700 text-gray-400 border-gray-600'}`}>
                        {e.evento}
                      </span>
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
              {tipo:'workspaces', label:'Workspaces', desc:'ID, nome, plano, status, usuários, criado'},
              {tipo:'usuarios',   label:'Usuários',   desc:'ID, nome, email, role, status, workspace'},
              {tipo:'chamados',   label:'Chamados',   desc:'Protocolo, usuária, problema, status, resposta'},
              {tipo:'hotmart',    label:'Eventos Hotmart', desc:'Evento, email, status, data'},
            ].map(item=>(
              <div key={item.tipo} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <button onClick={()=>exportar(item.tipo)}
                  className="flex items-center gap-2 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition">
                  <Download size={13}/> CSV
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL EDITAR WORKSPACE ── */}
      {editWs && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Editar Workspace</h2>
              <button onClick={()=>setEditWs(null)}><X size={16} className="text-gray-500"/></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome</label>
                <input value={editForm.nome} onChange={e=>setEditForm(p=>({...p,nome:e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Plano</label>
                <select value={editForm.plano} onChange={e=>setEditForm(p=>({...p,plano:e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {PLANOS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={()=>setEditWs(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800 transition">Cancelar</button>
                <button onClick={salvarEdicaoWs} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL USUÁRIOS DO WORKSPACE ── */}
      {usersWs && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold">Usuários — {usersWs.ws.nome}</h2>
                <p className="text-xs text-gray-500">{usersWs.lista.length} usuário(s)</p>
              </div>
              <button onClick={()=>setUsersWs(null)}><X size={16} className="text-gray-500"/></button>
            </div>
            <div className="flex flex-col gap-2">
              {usersWs.lista.map(u=>(
                <div key={u.id} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold flex-shrink-0">
                    {u.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{u.nome}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${u.role==='ADMIN'?'bg-purple-500/20 text-purple-400 border-purple-500/30':u.role==='DELEGADOR'?'bg-blue-500/20 text-blue-400 border-blue-500/30':'bg-gray-700 text-gray-400 border-gray-600'}`}>
                    {u.role}
                  </span>
                  <button onClick={()=>resetarSenha(usersWs.ws.id,u.id,u.nome)}
                    title="Resetar senha"
                    className="text-gray-500 hover:text-orange-400 transition flex-shrink-0">
                    <RotateCcw size={13}/>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={()=>setUsersWs(null)} className="w-full mt-4 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800 transition">Fechar</button>
          </div>
        </div>
      )}

      {/* ── MODAL SENHA RESETADA ── */}
      {senhaReset && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <RotateCcw size={20} className="text-green-400"/>
            </div>
            <h2 className="text-white font-semibold mb-1">Senha resetada!</h2>
            <p className="text-xs text-gray-400 mb-4">Nova senha de <strong className="text-white">{senhaReset.nome}</strong>:</p>
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-3 mb-4">
              <p className="text-xl font-mono font-bold text-orange-400 tracking-widest">{senhaReset.senha}</p>
            </div>
            <p className="text-xs text-gray-500 mb-4">Copie e envie para o usuário. Esta senha não será exibida novamente.</p>
            <button onClick={()=>setSenhaReset(null)} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition">Fechar</button>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR EXCLUSÃO ── */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3"/>
            <h2 className="text-white font-semibold mb-1">Excluir workspace?</h2>
            <p className="text-sm text-gray-400 mb-5">Todos os dados serão apagados permanentemente. Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={()=>setConfirmDel(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2.5 text-sm hover:bg-gray-800 transition">Cancelar</button>
              <button onClick={()=>excluirWorkspace(confirmDel)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-semibold transition">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NOTA INTERNA ── */}
      {notaForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Nota interna</h2>
              <button onClick={()=>setNotaForm(null)}><X size={16} className="text-gray-500"/></button>
            </div>
            <textarea value={notaForm.texto} onChange={e=>setNotaForm(p=>p?{...p,texto:e.target.value}:null)}
              rows={5} placeholder="Anotações internas sobre este chamado..."
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none mb-4"/>
            <div className="flex gap-2">
              <button onClick={()=>setNotaForm(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800 transition">Cancelar</button>
              <button onClick={()=>salvarNota(notaForm.id,notaForm.texto)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg py-2 text-sm font-semibold transition">Salvar nota</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RESPONDER POR E-MAIL ── */}
      {replyForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold">Responder por e-mail</h2>
              <button onClick={()=>setReplyForm(null)}><X size={16} className="text-gray-500"/></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Para: <span className="text-gray-300">{replyForm.email}</span> · {replyForm.protocolo}</p>
            <textarea value={replyForm.texto} onChange={e=>setReplyForm(p=>p?{...p,texto:e.target.value}:null)}
              rows={6} placeholder="Digite a resposta para a usuária..."
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"/>
            <div className="flex gap-2">
              <button onClick={()=>setReplyForm(null)} className="flex-1 border border-gray-600 text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-800 transition">Cancelar</button>
              <button onClick={enviarResposta} disabled={enviandoReply||!replyForm.texto.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50">
                {enviandoReply?'Enviando...':'Enviar resposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
