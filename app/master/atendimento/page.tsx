'use client'
// app/master/atendimento/page.tsx
// Central de Atendimento unificada (estilo Zendesk): chamados + feedbacks de todos
// os workspaces numa caixa só, com filtros/busca, detalhe e thread de conversa.

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Search, Send, Tag, User, Clock, MessageSquare, Lightbulb,
  RefreshCw, X, ImageIcon, AlertTriangle,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────
interface Item {
  id: string; tipo: 'CHAMADO' | 'FEEDBACK'; subtipo: string | null
  protocolo: string | null; assunto: string; assinanteNome: string | null
  email: string | null; workspaceId: string | null; workspaceNome: string | null
  status: string; prioridade: string; responsavelNome: string | null
  etiquetas: string | null; whatsapp: string | null
  createdAt: string; respondidoEm: string | null; ultimaAtualizacao: string
}
interface Msg { id: string; remetente: string; texto: string; imagem: string | null; createdAt: string }

// ─── Constantes ───────────────────────────────────────────────
// Status normalizado (3 estados) mapeado ao vocabulário real de cada tabela.
const STATUS_VAL: Record<'CHAMADO' | 'FEEDBACK', Record<'aberto' | 'atendendo' | 'resolvido', string>> = {
  CHAMADO:  { aberto: 'ABERTO', atendendo: 'EM_ATENDIMENTO', resolvido: 'RESOLVIDO' },
  FEEDBACK: { aberto: 'ABERTO', atendendo: 'EM_ANALISE',     resolvido: 'CONCLUIDO' },
}
function statusNorm(tipo: 'CHAMADO' | 'FEEDBACK', status: string): 'aberto' | 'atendendo' | 'resolvido' {
  const m = STATUS_VAL[tipo]
  if (status === m.resolvido) return 'resolvido'
  if (status === m.atendendo) return 'atendendo'
  return 'aberto'
}
const STATUS_LABEL = { aberto: 'Aberto', atendendo: 'Atendendo', resolvido: 'Resolvido' }
const STATUS_COR: Record<string, string> = {
  aberto: 'bg-red-500/15 text-red-400 border-red-500/30',
  atendendo: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  resolvido: 'bg-green-500/15 text-green-400 border-green-500/30',
}
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente']
const PRIO_COR: Record<string, string> = {
  baixa: 'text-gray-400 border-gray-600', normal: 'text-blue-400 border-blue-600',
  alta: 'text-orange-400 border-orange-600', urgente: 'text-red-400 border-red-600',
}
const SUBTIPO_LABEL: Record<string, string> = { BUG: 'Bug', MELHORIA: 'Melhoria', SUGESTAO: 'Sugestão' }

function fmtDataHora(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function parseEtiquetas(s: string | null): string[] {
  return String(s || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean)
}

const inp = 'bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500'

export default function AtendimentoPage() {
  const [itens, setItens] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  // Filtros
  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fSubtipo, setFSubtipo] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPrioridade, setFPrioridade] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  // Detalhe
  const [sel, setSel] = useState<Item | null>(null)
  const [detalhe, setDetalhe] = useState<any>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loadingDet, setLoadingDet] = useState(false)
  const [texto, setTexto] = useState('')
  const [imagem, setImagem] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  function aviso(m: string) { setFeedbackMsg(m); setTimeout(() => setFeedbackMsg(''), 2500) }

  // Pré-filtro vindo por URL (ex.: redirect da rota antiga /master/feedback → ?tipo=FEEDBACK)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tipo')
    if (t === 'FEEDBACK' || t === 'CHAMADO') setFTipo(t)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (q.trim()) qs.set('q', q.trim())
      if (fTipo) qs.set('tipo', fTipo)
      if (fSubtipo) qs.set('subtipo', fSubtipo)
      if (fStatus) qs.set('status', fStatus)
      if (fPrioridade) qs.set('prioridade', fPrioridade)
      if (de) qs.set('de', de)
      if (ate) qs.set('ate', ate)
      qs.set('limit', '60')
      const r = await fetch(`/api/master/atendimento?${qs.toString()}`)
      if (!r.ok) { setItens([]); return }
      const d = await r.json()
      setItens(d.itens || []); setTotal(d.total || 0)
    } finally { setLoading(false) }
  }, [q, fTipo, fSubtipo, fStatus, fPrioridade, de, ate])

  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t) }, [carregar])

  async function abrir(it: Item) {
    setSel(it); setDetalhe(null); setMsgs([]); setTexto(''); setImagem(null); setLoadingDet(true)
    try {
      const [rd, rm] = await Promise.all([
        fetch(`/api/master/atendimento/${it.id}?tipo=${it.tipo}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/master/mensagens?referenciaId=${it.id}`).then(r => r.ok ? r.json() : []),
      ])
      setDetalhe(rd)
      setMsgs(Array.isArray(rm) ? rm : [])
    } finally { setLoadingDet(false) }
  }

  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight }, [msgs])

  // Endpoint de ação por tipo (chamados/[id] ou feedback/[id])
  function acaoUrl(it: Item) { return `/api/master/${it.tipo === 'CHAMADO' ? 'chamados' : 'feedback'}/${it.id}` }

  async function patch(campo: string, valor: any) {
    if (!sel) return
    await fetch(acaoUrl(sel), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }) })
    // Reflete localmente
    setItens(prev => prev.map(x => x.id === sel.id ? { ...x, [campo]: valor } as Item : x))
    setSel(prev => prev ? { ...prev, [campo]: valor } as Item : prev)
    setDetalhe((prev: any) => prev ? { ...prev, [campo]: valor } : prev)
    aviso('Atualizado')
  }

  async function mudarStatus(estado: 'aberto' | 'atendendo' | 'resolvido') {
    if (!sel) return
    const valor = STATUS_VAL[sel.tipo][estado]
    await patch('status', valor)
  }

  async function responder() {
    if (!sel || (!texto.trim() && !imagem)) return
    setEnviando(true)
    try {
      const r = await fetch('/api/master/mensagens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenciaId: sel.id, tipo: sel.tipo, texto: texto.trim() || '📎 Print enviado', emailUsuaria: sel.email, imagem }),
      })
      if (r.ok) {
        setMsgs(prev => [...prev, { id: Math.random().toString(36).slice(2), remetente: 'SUPORTE', texto: texto.trim() || '📎 Print enviado', imagem, createdAt: new Date().toISOString() }])
        setTexto(''); setImagem(null)
        // status vai para "atendendo" se estava aberto
        const norm = statusNorm(sel.tipo, sel.status)
        if (norm === 'aberto') { const v = STATUS_VAL[sel.tipo].atendendo; setSel(p => p ? { ...p, status: v } : p); setItens(prev => prev.map(x => x.id === sel.id ? { ...x, status: v } : x)) }
        aviso('Resposta enviada à assinante')
      }
    } finally { setEnviando(false) }
  }

  function onImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Imagem máx. 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => setImagem(reader.result as string)
    reader.readAsDataURL(file); e.target.value = ''
  }

  const temFiltro = q || fTipo || fSubtipo || fStatus || fPrioridade || de || ate

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a href="/master" className="text-gray-400 hover:text-white transition"><ArrowLeft size={18} /></a>
          <div>
            <h1 className="text-white font-semibold text-sm flex items-center gap-2"><MessageSquare size={15} className="text-orange-400" /> Central de Atendimento</h1>
            <p className="text-gray-500 text-xs">Chamados e feedbacks de todos os workspaces</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {feedbackMsg && <span className="text-xs text-green-400 bg-green-900/30 border border-green-800 px-3 py-1 rounded-full">{feedbackMsg}</span>}
          <button onClick={carregar} className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"><RefreshCw size={13} /> Atualizar</button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        {/* ─── COLUNA ESQUERDA: caixa ─── */}
        <div>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar protocolo, e-mail, assinante ou workspace..." className={inp + ' w-full pl-9'} />
            </div>
            <select value={fTipo} onChange={e => { setFTipo(e.target.value); if (e.target.value === 'CHAMADO') setFSubtipo('') }} className={inp}>
              <option value="">Todos os tipos</option>
              <option value="CHAMADO">Chamados</option>
              <option value="FEEDBACK">Feedbacks</option>
            </select>
            <select value={fSubtipo} onChange={e => setFSubtipo(e.target.value)} className={inp} title="Tipo de feedback">
              <option value="">Feedback: todos</option>
              <option value="BUG">Bug</option>
              <option value="MELHORIA">Melhoria</option>
              <option value="SUGESTAO">Sugestão</option>
            </select>
            <select value={fPrioridade} onChange={e => setFPrioridade(e.target.value)} className={inp}>
              <option value="">Prioridade</option>
              {PRIORIDADES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
              {(['', 'aberto', 'atendendo', 'resolvido'] as const).map(s => (
                <button key={s || 'todos'} onClick={() => setFStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition ${fStatus === s ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                  {s === '' ? 'Todos' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <label className="text-xs text-gray-500 flex items-center gap-1">de <input type="date" value={de} onChange={e => setDe(e.target.value)} className={inp + ' py-1'} /></label>
            <label className="text-xs text-gray-500 flex items-center gap-1">até <input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inp + ' py-1'} /></label>
            <span className="text-xs text-gray-500 ml-auto">{total} item{total !== 1 ? 's' : ''}</span>
            {temFiltro && <button onClick={() => { setQ(''); setFTipo(''); setFSubtipo(''); setFStatus(''); setFPrioridade(''); setDe(''); setAte('') }} className="text-xs text-orange-400 border border-orange-800 px-2.5 py-1 rounded-lg hover:bg-orange-500/10">Limpar</button>}
          </div>

          {/* Lista */}
          {loading ? <p className="text-gray-500 text-sm text-center py-12">Carregando...</p>
            : itens.length === 0 ? <p className="text-gray-600 text-sm text-center py-12">Nenhum item encontrado</p> : (
              <div className="space-y-2">
                {itens.map(it => {
                  const norm = statusNorm(it.tipo, it.status)
                  const ativo = sel?.id === it.id
                  return (
                    <button key={it.id} onClick={() => abrir(it)}
                      className={`w-full text-left bg-gray-900 border rounded-xl p-3 transition ${ativo ? 'border-orange-500' : 'border-gray-800 hover:border-gray-600'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${it.tipo === 'CHAMADO' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-purple-500/15 text-purple-300 border-purple-500/30'}`}>
                          {it.tipo === 'CHAMADO' ? 'Chamado' : (SUBTIPO_LABEL[it.subtipo || ''] || 'Feedback')}
                        </span>
                        {it.protocolo && <span className="text-[10px] font-mono text-orange-400">{it.protocolo}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ml-auto ${STATUS_COR[norm]}`}>{STATUS_LABEL[norm]}</span>
                        {it.prioridade && it.prioridade !== 'normal' && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIO_COR[it.prioridade] || ''}`}>{it.prioridade}</span>}
                      </div>
                      <p className="text-sm text-gray-200 line-clamp-1">{it.assunto || <span className="italic text-gray-600">sem assunto</span>}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap">
                        <span className="text-gray-400">{it.assinanteNome || '—'}</span>
                        <span>· {it.workspaceNome || 'sem workspace'}</span>
                        <span className="ml-auto flex items-center gap-1"><Clock size={10} /> {fmtDataHora(it.ultimaAtualizacao)}</span>
                      </div>
                      {(it.responsavelNome || parseEtiquetas(it.etiquetas).length > 0) && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {it.responsavelNome && <span className="text-[10px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1"><User size={9} />{it.responsavelNome}</span>}
                          {parseEtiquetas(it.etiquetas).map(e => <span key={e} className="text-[10px] text-gray-300 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded-full">{e}</span>)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
        </div>

        {/* ─── COLUNA DIREITA: detalhe + thread ─── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {!sel ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-600 text-sm">
              <MessageSquare size={32} className="mx-auto mb-3 text-gray-700" />
              Selecione um item para ver a conversa
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
              {/* Cabeçalho do item */}
              <div className="px-5 py-4 border-b border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${sel.tipo === 'CHAMADO' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-purple-500/15 text-purple-300 border-purple-500/30'}`}>
                        {sel.tipo === 'CHAMADO' ? 'Chamado' : (SUBTIPO_LABEL[sel.subtipo || ''] || 'Feedback')}
                      </span>
                      {sel.protocolo && <span className="text-[11px] font-mono text-orange-400">{sel.protocolo}</span>}
                    </div>
                    <p className="text-sm font-medium text-white truncate">{sel.assunto}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sel.assinanteNome} · {sel.email || 'sem e-mail'} · {sel.workspaceNome || 'sem workspace'}
                      {sel.whatsapp ? ` · 📱 ${sel.whatsapp}` : ''}
                    </p>
                  </div>
                  <button onClick={() => setSel(null)} className="text-gray-500 hover:text-white flex-shrink-0"><X size={16} /></button>
                </div>

                {/* Ações: status / prioridade / responsável / etiquetas */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {(['aberto', 'atendendo', 'resolvido'] as const).map(s => {
                    const on = statusNorm(sel.tipo, sel.status) === s
                    return <button key={s} onClick={() => mudarStatus(s)} className={`text-xs px-2.5 py-1 rounded-full border transition ${on ? STATUS_COR[s] : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500'}`}>{STATUS_LABEL[s]}</button>
                  })}
                  <select value={sel.prioridade || 'normal'} onChange={e => patch('prioridade', e.target.value)} className="text-xs bg-gray-800 border border-gray-700 rounded-full px-2 py-1 text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500">
                    {PRIORIDADES.map(p => <option key={p} value={p}>Prioridade: {p}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 flex-1 min-w-40">
                    <User size={12} className="text-gray-500" />
                    <input defaultValue={sel.responsavelNome || ''} onBlur={e => { if ((e.target.value || '') !== (sel.responsavelNome || '')) patch('responsavelNome', e.target.value.trim()) }}
                      placeholder="Responsável..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-40">
                    <Tag size={12} className="text-gray-500" />
                    <input defaultValue={sel.etiquetas || ''} onBlur={e => { if ((e.target.value || '') !== (sel.etiquetas || '')) patch('etiquetas', e.target.value.trim()) }}
                      placeholder="Etiquetas (separadas por vírgula)" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                </div>
              </div>

              {/* Corpo: descrição original + thread */}
              <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingDet ? <p className="text-gray-500 text-sm text-center py-8">Carregando...</p> : (
                  <>
                    {/* Descrição original */}
                    {detalhe && (
                      <div className="bg-gray-800 rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-gray-500 mb-1">Solicitação original</p>
                        {detalhe.titulo && <p className="text-sm font-medium text-gray-200">{detalhe.titulo}</p>}
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{detalhe.descricao}</p>
                        {detalhe.imagem && <img src={detalhe.imagem} alt="Anexo" className="mt-2 max-h-56 rounded-lg border border-gray-700 object-contain bg-gray-900" />}
                        <p className="text-[10px] text-gray-600 mt-2">{fmtDataHora(detalhe.createdAt)}</p>
                      </div>
                    )}
                    {detalhe?.notaInterna && (
                      <div className="bg-yellow-900/15 border border-yellow-800/30 rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-yellow-500 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> Nota interna</p>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{detalhe.notaInterna}</p>
                      </div>
                    )}

                    {/* Thread */}
                    {msgs.length === 0 ? <p className="text-xs text-gray-600 italic text-center py-2">Sem mensagens na conversa ainda.</p> : msgs.map(m => (
                      <div key={m.id} className={`flex ${m.remetente === 'SUPORTE' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] text-sm px-3 py-2 rounded-2xl ${m.remetente === 'SUPORTE' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-100'}`}>
                          <p className={`text-[10px] mb-0.5 ${m.remetente === 'SUPORTE' ? 'text-orange-100' : 'text-gray-400'}`}>{m.remetente === 'SUPORTE' ? 'Equipe SOA' : 'Assinante'} · {fmtDataHora(m.createdAt)}</p>
                          {m.imagem && <img src={m.imagem} alt="Print" className="max-h-44 w-full object-contain rounded-lg mb-1 bg-gray-900" />}
                          <span className="whitespace-pre-wrap">{m.texto}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Responder */}
              <div className="border-t border-gray-800 px-4 py-3">
                {imagem && (
                  <div className="relative inline-block mb-2">
                    <img src={imagem} alt="Print" className="max-h-20 rounded-lg border border-gray-700 object-contain bg-gray-800" />
                    <button onClick={() => setImagem(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">✕</button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <label className="flex-shrink-0 cursor-pointer p-2 bg-gray-800 border border-gray-700 rounded-xl hover:border-orange-500 transition" title="Anexar print">
                    <ImageIcon size={15} className="text-gray-400" />
                    <input type="file" accept="image/*" className="hidden" onChange={onImg} />
                  </label>
                  <textarea value={texto} onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); responder() } }}
                    rows={1} placeholder="Responder à assinante (Enter envia, Shift+Enter quebra linha)..."
                    className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <button onClick={responder} disabled={enviando || (!texto.trim() && !imagem)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl transition disabled:opacity-40 flex items-center gap-1 text-sm">
                    <Send size={15} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1"><Lightbulb size={10} /> A resposta vai para a conversa da assinante no Suporte e por e-mail.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
