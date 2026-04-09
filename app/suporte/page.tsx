'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Search, ChevronDown, ChevronUp, Send, Headphones, AlertCircle, CheckCircle, X, MessageCircle, BookOpen, Shield, ImageIcon, Paperclip, Lightbulb } from 'lucide-react'

interface Faq {
  id: string
  categoria: string
  pergunta: string
  resposta: string
}

interface Mensagem {
  role: 'user' | 'model'
  content: string
}

interface SuporteMensagem {
  id: string
  remetente: 'USUARIO' | 'SUPORTE'
  texto: string
  createdAt: string
}

interface MeuChamado {
  id: string
  protocolo: string
  status: string
  descricao: string
  respostaIA: string | null
  notaInterna: string | null
  imagem: string | null
  respondidoEm: string | null
  createdAt: string
}

interface MeuFeedback {
  id: string
  tipo: string
  titulo: string
  descricao: string
  status: string
  notaInterna: string | null
  createdAt: string
}

const CATEGORIAS = [
  'Todas',
  'Primeiros Passos',
  'Produção',
  'Precificação',
  'Financeiro',
  'Análise de Gestão',
  'Configurações',
  'Conta e Assinatura',
]

const PERGUNTAS_RAPIDAS = [
  'Como crio um novo pedido?',
  'Como calculo o preço de venda?',
  'Como lanço uma receita?',
  'Como adiciono um novo usuário?',
  'Como vejo o fluxo de caixa?',
  'Como uso a IA de gestão?',
]

// Username do bot de suporte no Telegram
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'vpsgestao_suporte_bot'

export default function SuportePage() {
  const { data: session } = useSession()

  // FAQ
  const [faqs, setFaqs]               = useState<Faq[]>([])
  const [busca, setBusca]             = useState('')
  const [categoria, setCategoria]     = useState('Todas')
  const [abertas, setAbertas]         = useState<Set<string>>(new Set())
  const [loadingFaqs, setLoadingFaqs] = useState(true)

  // Chat IA
  const [aba, setAba]                           = useState<'faq' | 'chat' | 'historico'>('faq')
  const [historico, setHistorico]               = useState<Mensagem[]>([])
  const [input, setInput]                       = useState('')
  const [enviando, setEnviando]                 = useState(false)
  const [ultimaRespostaIA, setUltimaRespostaIA] = useState('')
  const chatRef                                 = useRef<HTMLDivElement>(null)

  // Chamado
  const [modalChamado, setModalChamado]             = useState(false)
  const [descricaoChamado, setDescricaoChamado]     = useState('')
  const [enviandoChamado, setEnviandoChamado]       = useState(false)
  const [protocolo, setProtocolo]                   = useState('')
  const [erroChamado, setErroChamado]               = useState('')
  const [imagemChamado, setImagemChamado]           = useState<string | null>(null)
  const [imagemChamadoNome, setImagemChamadoNome]   = useState('')

  function handleImagemChamado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setErroChamado('Imagem muito grande. Máximo 3MB.'); return }
    setErroChamado('')
    setImagemChamadoNome(file.name)
    const reader = new FileReader()
    reader.onload = () => setImagemChamado(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Imagem no chat
  const [imagemChat,     setImagemChat]     = useState<string | null>(null)
  const [imagemChatNome, setImagemChatNome] = useState('')
  // Modal Feedback
  const [modalFeedback,     setModalFeedback]     = useState(false)
  const [feedbackTipo,      setFeedbackTipo]      = useState('BUG')
  const [feedbackTitulo,    setFeedbackTitulo]    = useState('')
  const [feedbackDesc,      setFeedbackDesc]      = useState('')
  const [feedbackImagem,    setFeedbackImagem]    = useState<string | null>(null)
  const [feedbackImagemNome,setFeedbackImagemNome]= useState('')
  const [enviandoFeedback,  setEnviandoFeedback]  = useState(false)
  const [feedbackEnviado,   setFeedbackEnviado]   = useState(false)
  const [erroFeedback,      setErroFeedback]      = useState('')

  function handleImagemChat(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande. Máximo 2MB.'); return }
    setImagemChatNome(file.name)
    const reader = new FileReader()
    reader.onload = () => setImagemChat(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Meus chamados e feedbacks
  const [meusChamados,  setMeusChamados]  = useState<MeuChamado[]>([])
  const [meusFeedbacks, setMeusFeedbacks] = useState<MeuFeedback[]>([])
  const [loadingHist,   setLoadingHist]   = useState(false)
  const [chamadoAberto, setChamadoAberto] = useState<string | null>(null)
  const [feedbackAberto, setFeedbackAberto] = useState<string | null>(null)

  // Mensagens por item
  const [mensagens,     setMensagens]     = useState<Record<string, SuporteMensagem[]>>({})
  const [novaMensagem,  setNovaMensagem]  = useState<Record<string, string>>({})
  const [enviandoMsg,   setEnviandoMsg]   = useState<string | null>(null)

  useEffect(() => { carregarFaqs() }, [categoria, busca])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [historico])
  useEffect(() => {
    if (aba === 'historico') carregarHistorico()
  }, [aba])

  async function carregarHistorico() {
    setLoadingHist(true)
    try {
      const [chamados, feedbacks] = await Promise.all([
        fetch('/api/suporte/chamado').then(r => r.json()).catch(() => []),
        fetch('/api/suporte/feedback').then(r => r.json()).catch(() => []),
      ])
      setMeusChamados(Array.isArray(chamados) ? chamados : [])
      setMeusFeedbacks(Array.isArray(feedbacks) ? feedbacks : [])
    } finally {
      setLoadingHist(false)
    }
  }

  async function carregarMensagens(referenciaId: string) {
    try {
      const res = await fetch(`/api/suporte/mensagens?referenciaId=${referenciaId}`)
      const data = await res.json()
      setMensagens(prev => ({ ...prev, [referenciaId]: Array.isArray(data) ? data : [] }))
    } catch {}
  }

  async function enviarMensagemUsuaria(referenciaId: string, tipo: 'CHAMADO' | 'FEEDBACK') {
    const texto = novaMensagem[referenciaId]?.trim()
    if (!texto) return
    setEnviandoMsg(referenciaId)
    try {
      const res = await fetch('/api/suporte/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenciaId, tipo, texto }),
      })
      if (res.ok) {
        const nova: SuporteMensagem = {
          id: Math.random().toString(36).slice(2),
          remetente: 'USUARIO',
          texto,
          createdAt: new Date().toISOString(),
        }
        setMensagens(prev => ({ ...prev, [referenciaId]: [...(prev[referenciaId] || []), nova] }))
        setNovaMensagem(prev => ({ ...prev, [referenciaId]: '' }))
        // Reabrir se estava concluído
        if (tipo === 'CHAMADO') {
          setMeusChamados(prev => prev.map(c => c.id === referenciaId && c.status === 'RESOLVIDO' ? { ...c, status: 'ABERTO' } : c))
        } else {
          setMeusFeedbacks(prev => prev.map(f => f.id === referenciaId && f.status === 'CONCLUIDO' ? { ...f, status: 'ABERTO' } : f))
        }
      }
    } catch {}
    setEnviandoMsg(null)
  }

  async function carregarFaqs() {
    setLoadingFaqs(true)
    try {
      const params = new URLSearchParams()
      if (categoria !== 'Todas') params.set('categoria', categoria)
      if (busca.trim())          params.set('busca', busca.trim())
      const res  = await fetch(`/api/suporte/faq?${params}`)
      const data = await res.json()
      setFaqs(data.faqs || [])
    } catch {
      setFaqs([])
    } finally {
      setLoadingFaqs(false)
    }
  }

  function toggleFaq(id: string) {
    setAbertas(prev => {
      const novo = new Set(prev)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  async function enviarFeedback() {
    if (!feedbackTitulo.trim() || !feedbackDesc.trim()) { setErroFeedback('Preencha título e descrição'); return }
    setEnviandoFeedback(true); setErroFeedback('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: feedbackTipo, titulo: feedbackTitulo, descricao: feedbackDesc, imagemBase64: feedbackImagem }),
      })
      if (!res.ok) throw new Error('Erro ao enviar')
      setFeedbackEnviado(true)
      setFeedbackTitulo(''); setFeedbackDesc(''); setFeedbackImagem(null); setFeedbackImagemNome('')
    } catch { setErroFeedback('Erro ao enviar feedback. Tente novamente.') }
    finally { setEnviandoFeedback(false) }
  }

  async function enviarMensagem(texto?: string) {
    const msg = (texto ?? input).trim()
    if (!msg || enviando) return
    setHistorico(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setEnviando(true)
    try {
      const res  = await fetch('/api/suporte/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: msg, historico, imagemBase64: imagemChat }),
      })
      const data = await res.json()
      if (!res.ok) {
        setHistorico(prev => [...prev, { role: 'model', content: data.error || 'Erro ao consultar IA' }])
        return
      }
      setHistorico(prev => [...prev, { role: 'model', content: data.resposta }])
      setUltimaRespostaIA(data.resposta)
    } catch {
      setHistorico(prev => [...prev, {
        role: 'model',
        content: 'Não consegui conectar. Verifique sua conexão ou tente novamente.',
      }])
    } finally {
      setEnviando(false)
    }
  }

  async function abrirChamado() {
    if (!descricaoChamado.trim()) { setErroChamado('Descreva o problema'); return }
    setEnviandoChamado(true)
    setErroChamado('')
    try {
      const res  = await fetch('/api/suporte/chamado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: descricaoChamado,
          respostaIA: ultimaRespostaIA,
          imagem: imagemChamado,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErroChamado(data.error || 'Erro ao abrir chamado'); return }
      setProtocolo(data.protocolo)
      setDescricaoChamado('')
      setImagemChamado(null)
      setImagemChamadoNome('')
    } catch {
      setErroChamado('Erro de conexão. Tente novamente.')
    } finally {
      setEnviandoChamado(false)
    }
  }

  const faqsAgrupadas = faqs.reduce((acc: Record<string, Faq[]>, faq) => {
    if (!acc[faq.categoria]) acc[faq.categoria] = []
    acc[faq.categoria].push(faq)
    return acc
  }, {})

  const isAdmin = session?.user?.role === 'ADMIN'

  return (
    <div className="max-w-4xl mx-auto p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Headphones size={20} className="text-orange-500" />
            Central de Suporte
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Tire suas dúvidas ou fale com nossa equipe</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setModalChamado(true) }}
            className="flex items-center gap-1.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition"
          >
            <MessageCircle size={14} />
            Abrir Chamado
          </button>
          <button
            onClick={() => { setModalFeedback(true); setFeedbackEnviado(false) }}
            className="flex items-center gap-1.5 text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition"
          >
            <Lightbulb size={14} />
            Feedback
          </button>
          {isAdmin && (
            <a
              href="/suporte/admin/faq"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-500 border border-gray-200 rounded-lg px-3 py-2 transition"
            >
              <Shield size={13} />
              Gerenciar FAQ
            </a>
          )}
        </div>
      </div>

      {/* Banner Telegram */}
      <a
        href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-[#229ED9]/10 border border-[#229ED9]/30 rounded-xl px-4 py-3 mb-5 hover:bg-[#229ED9]/15 transition group"
      >
        {/* Ícone Telegram SVG */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#229ED9" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 13.6l-2.955-.924c-.64-.203-.653-.64.136-.954l11.57-4.461c.537-.194 1.006.131.883.96z"/>
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-[#1a7fa8]">Falar direto no Telegram</p>
          <p className="text-xs text-[#229ED9]/70">Atendimento humano • Resposta em até 24h úteis</p>
        </div>
        <span className="text-xs text-[#229ED9] font-medium group-hover:underline">Abrir →</span>
      </a>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setAba('faq')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition ${
            aba === 'faq' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={15} />
          Perguntas Frequentes
        </button>
        <button
          onClick={() => setAba('chat')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition ${
            aba === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageCircle size={15} />
          Falar com IA
        </button>
        <button
          onClick={() => setAba('historico')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition ${
            aba === 'historico' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle size={15} />
          Meus Chamados
        </button>
      </div>

      {/* ── ABA MEUS CHAMADOS ── */}
      {aba === 'historico' && (
        <div className="space-y-6">
          {loadingHist ? (
            <div className="text-center text-gray-400 py-12 text-sm">Carregando...</div>
          ) : (
            <>
              {/* Chamados */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <AlertCircle size={15} className="text-orange-500" />
                  Chamados de suporte ({meusChamados.length})
                </h2>
                {meusChamados.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
                    Nenhum chamado aberto ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {meusChamados.map(c => (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <div
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                          const novoAberto = chamadoAberto === c.id ? null : c.id
                          setChamadoAberto(novoAberto)
                          if (novoAberto && !mensagens[novoAberto]) carregarMensagens(novoAberto)
                        }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 flex-shrink-0">
                              {c.protocolo}
                            </span>
                            <p className="text-sm text-gray-700 truncate">{c.descricao}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              c.status === 'RESOLVIDO'     ? 'bg-green-50 text-green-700' :
                              c.status === 'EM_ATENDIMENTO'? 'bg-blue-50 text-blue-700' :
                              'bg-orange-50 text-orange-700'
                            }`}>
                              {c.status === 'ABERTO' ? 'Aberto' : c.status === 'EM_ATENDIMENTO' ? 'Em atendimento' : 'Resolvido'}
                            </span>
                            {chamadoAberto === c.id ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                          </div>
                        </div>
                        {chamadoAberto === c.id && (
                          <div className="border-t border-gray-50 px-4 py-4 space-y-3 bg-gray-50/50">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">Sua descrição</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-100">{c.descricao}</p>
                            </div>
                            {c.notaInterna && (
                              <div>
                                <p className="text-xs font-semibold text-orange-600 mb-1">💬 Resposta da equipe VPS</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-orange-50 border border-orange-100 rounded-lg p-3">{c.notaInterna}</p>
                              </div>
                            )}
                            {c.imagem && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Print anexado</p>
                                <img src={c.imagem} alt="Print do chamado" className="max-h-48 rounded-lg border border-gray-200 object-contain bg-gray-50" />
                              </div>
                            )}
                            {c.respondidoEm && (
                              <p className="text-xs text-green-600">✓ Respondido em {new Date(c.respondidoEm).toLocaleString('pt-BR')}</p>
                            )}
                            <p className="text-xs text-gray-400">Aberto em {new Date(c.createdAt).toLocaleString('pt-BR')}</p>

                            {/* Mini chat */}
                            <div className="border-t border-gray-100 pt-3 mt-1">
                              <p className="text-xs font-semibold text-gray-500 mb-2">💬 Mensagens</p>
                              {(mensagens[c.id] || []).length > 0 && (
                                <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                                  {(mensagens[c.id] || []).map(m => (
                                    <div key={m.id} className={`flex ${m.remetente === 'USUARIO' ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[80%] text-xs px-3 py-2 rounded-xl ${m.remetente === 'USUARIO' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                        <p className={`text-[10px] mb-0.5 ${m.remetente === 'USUARIO' ? 'text-orange-100' : 'text-gray-400'}`}>
                                          {m.remetente === 'USUARIO' ? 'Você' : '⚡ Equipe VPS'}
                                        </p>
                                        {m.texto}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={novaMensagem[c.id] || ''}
                                  onChange={e => setNovaMensagem(prev => ({ ...prev, [c.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') enviarMensagemUsuaria(c.id, 'CHAMADO') }}
                                  placeholder={c.status === 'RESOLVIDO' ? 'Reabrir com nova mensagem...' : 'Enviar mensagem...'}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                                <button
                                  onClick={() => enviarMensagemUsuaria(c.id, 'CHAMADO')}
                                  disabled={enviandoMsg === c.id || !novaMensagem[c.id]?.trim()}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 rounded-lg transition disabled:opacity-40 text-xs"
                                >
                                  <Send size={12} />
                                </button>
                              </div>
                              {c.status === 'RESOLVIDO' && (
                                <p className="text-xs text-gray-400 mt-1">💡 Enviar mensagem reabre o chamado automaticamente.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feedbacks */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MessageCircle size={15} className="text-blue-500" />
                  Feedbacks enviados ({meusFeedbacks.length})
                </h2>
                {meusFeedbacks.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
                    Nenhum feedback enviado ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {meusFeedbacks.map(f => (
                      <div key={f.id} className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              f.tipo === 'BUG'      ? 'bg-red-50 text-red-700 border-red-100' :
                              f.tipo === 'MELHORIA' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              'bg-yellow-50 text-yellow-700 border-yellow-100'
                            }`}>
                              {f.tipo === 'BUG' ? '🐛 Bug' : f.tipo === 'MELHORIA' ? '✨ Melhoria' : '💡 Sugestão'}
                            </span>
                            <p className="text-sm font-medium text-gray-800">{f.titulo}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            f.status === 'CONCLUIDO'  ? 'bg-green-50 text-green-700' :
                            f.status === 'EM_ANALISE' ? 'bg-blue-50 text-blue-700' :
                            f.status === 'DESCARTADO' ? 'bg-gray-100 text-gray-500' :
                            'bg-orange-50 text-orange-700'
                          }`}>
                            {f.status === 'ABERTO' ? 'Aberto' : f.status === 'EM_ANALISE' ? 'Em análise' : f.status === 'CONCLUIDO' ? 'Concluído ✓' : 'Descartado'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{f.descricao}</p>
                        {f.notaInterna && (
                          <div className="mt-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-orange-600 mb-0.5">💬 Retorno da equipe VPS</p>
                            <p className="text-xs text-gray-700">{f.notaInterna}</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">{new Date(f.createdAt).toLocaleDateString('pt-BR')}</p>

                        {/* Mini chat feedback */}
                        <div className="border-t border-gray-100 pt-3 mt-2">
                          <button
                            className="text-xs text-orange-500 font-medium mb-2"
                            onClick={() => {
                              const novoAberto = feedbackAberto === f.id ? null : f.id
                              setFeedbackAberto(novoAberto)
                              if (novoAberto && !mensagens[novoAberto]) carregarMensagens(novoAberto)
                            }}
                          >
                            {feedbackAberto === f.id ? '▲ Fechar mensagens' : '💬 Ver / Enviar mensagem'}
                          </button>
                          {feedbackAberto === f.id && (
                            <div>
                              {(mensagens[f.id] || []).length > 0 && (
                                <div className="space-y-2 mb-2 max-h-32 overflow-y-auto">
                                  {(mensagens[f.id] || []).map(m => (
                                    <div key={m.id} className={`flex ${m.remetente === 'USUARIO' ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[80%] text-xs px-3 py-2 rounded-xl ${m.remetente === 'USUARIO' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                        <p className={`text-[10px] mb-0.5 ${m.remetente === 'USUARIO' ? 'text-orange-100' : 'text-gray-400'}`}>
                                          {m.remetente === 'USUARIO' ? 'Você' : '⚡ Equipe VPS'}
                                        </p>
                                        {m.texto}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={novaMensagem[f.id] || ''}
                                  onChange={e => setNovaMensagem(prev => ({ ...prev, [f.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') enviarMensagemUsuaria(f.id, 'FEEDBACK') }}
                                  placeholder={f.status === 'CONCLUIDO' ? 'Reabrir com nova mensagem...' : 'Enviar mensagem...'}
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                                <button
                                  onClick={() => enviarMensagemUsuaria(f.id, 'FEEDBACK')}
                                  disabled={enviandoMsg === f.id || !novaMensagem[f.id]?.trim()}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 rounded-lg transition disabled:opacity-40"
                                >
                                  <Send size={12} />
                                </button>
                              </div>
                              {f.status === 'CONCLUIDO' && (
                                <p className="text-xs text-gray-400 mt-1">💡 Enviar mensagem reabre o feedback automaticamente.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ABA FAQ ── */}
      {aba === 'faq' && (
        <div>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar dúvidas..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            {CATEGORIAS.map(cat => (
              <button
                key={cat}
                onClick={() => { setCategoria(cat); setBusca('') }}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  categoria === cat
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'border-gray-200 text-gray-600 hover:border-orange-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loadingFaqs ? (
            <p className="text-center text-sm text-gray-400 py-12">Carregando...</p>
          ) : faqs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">Nenhuma dúvida encontrada</p>
              <button
                onClick={() => { setAba('chat'); setInput(busca) }}
                className="mt-3 text-orange-500 text-sm hover:underline"
              >
                Perguntar para a IA →
              </button>
            </div>
          ) : (
            Object.entries(faqsAgrupadas).map(([cat, items]) => (
              <div key={cat} className="mb-6">
                {categoria === 'Todas' && (
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{cat}</h2>
                )}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                  {items.map(faq => (
                    <div key={faq.id}>
                      <button
                        onClick={() => toggleFaq(faq.id)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition"
                      >
                        <span className="text-sm font-medium text-gray-800 pr-4">{faq.pergunta}</span>
                        {abertas.has(faq.id)
                          ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" />
                          : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                        }
                      </button>
                      {abertas.has(faq.id) && (
                        <div className="px-4 pb-4 bg-orange-50/30 border-t border-orange-100">
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line pt-3">{faq.resposta}</p>
                          <button
                            onClick={() => { setAba('chat'); setInput(`Preciso de mais ajuda: ${faq.pergunta}`) }}
                            className="mt-3 text-xs text-orange-500 hover:underline"
                          >
                            Ainda com dúvida? Perguntar para a IA →
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Rodapé FAQ */}
          <div className="mt-8 bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-sm text-orange-800 font-medium mb-1">Não encontrou o que precisava?</p>
            <p className="text-xs text-orange-600 mb-3">Use a IA para resolver na hora ou fale com nossa equipe</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => setAba('chat')}
                className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition font-medium"
              >
                Falar com a IA
              </button>
              <a
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm border border-[#229ED9] text-[#229ED9] hover:bg-[#229ED9]/10 px-4 py-2 rounded-lg transition"
              >
                Telegram
              </a>
              <button
                onClick={() => setModalChamado(true)}
                className="text-sm border border-orange-300 text-orange-700 hover:bg-orange-100 px-4 py-2 rounded-lg transition"
              >
                Abrir Chamado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA CHAT IA ── */}
      {aba === 'chat' && (
        <div>
          <div ref={chatRef} className="bg-white rounded-xl border border-gray-100 h-[420px] overflow-y-auto p-4 flex flex-col gap-3 mb-3">
            {historico.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Headphones size={22} className="text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Olá! Sou a assistente do VPS Gestão 👋</p>
                  <p className="text-xs text-gray-400 mt-1">Posso te ajudar a usar qualquer parte do sistema, passo a passo.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {PERGUNTAS_RAPIDAS.map(pq => (
                    <button
                      key={pq}
                      onClick={() => enviarMensagem(pq)}
                      className="text-xs text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-orange-300 hover:bg-orange-50 transition text-gray-600"
                    >
                      {pq}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {historico.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {(msg as any).imagem && (
                    <img src={(msg as any).imagem} alt="imagem enviada"
                      className="max-h-32 rounded-lg mb-1 object-contain" />
                  )}
                  {msg.content}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-sm">
                  Digitando...
                </div>
              </div>
            )}
          </div>

          {/* Preview imagem antes de enviar */}
          {imagemChat && (
            <div className="relative inline-flex mb-2">
              <img src={imagemChat} alt="preview" className="h-16 rounded-lg border border-gray-200 object-contain" />
              <button onClick={() => { setImagemChat(null); setImagemChatNome('') }}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                <X size={10} />
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <label className="flex items-center justify-center w-10 h-10 border border-gray-200 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition flex-shrink-0" title="Enviar imagem">
              <Paperclip size={16} className="text-gray-400" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImagemChat} />
            </label>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviarMensagem())}
              placeholder="Digite sua dúvida..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              disabled={enviando}
            />
            <button
              onClick={() => enviarMensagem()}
              disabled={enviando || (!input.trim() && !imagemChat)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 rounded-xl transition disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>

          {/* Opções de escalonamento */}
          {historico.length >= 2 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">A IA não resolveu? Fale com nossa equipe:</p>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs border border-[#229ED9] text-[#229ED9] hover:bg-[#229ED9]/10 px-3 py-1.5 rounded-lg transition"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#229ED9"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 13.6l-2.955-.924c-.64-.203-.653-.64.136-.954l11.57-4.461c.537-.194 1.006.131.883.96z"/></svg>
                  Telegram
                </a>
                <button
                  onClick={() => setModalChamado(true)}
                  className="text-xs bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded-lg transition"
                >
                  Abrir Chamado por E-mail
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL CHAMADO ── */}
      {/* ── MODAL FEEDBACK ── */}
      {modalFeedback && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-md p-6">
            {feedbackEnviado ? (
              <div className="text-center py-4">
                <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                <h2 className="text-base font-semibold text-gray-900 mb-1">Feedback enviado!</h2>
                <p className="text-xs text-gray-500 mb-4">Obrigada! Nossa equipe vai analisar sua sugestão.</p>
                <button onClick={() => { setModalFeedback(false); setFeedbackEnviado(false) }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-medium transition">
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <Lightbulb size={16} className="text-orange-500" /> Enviar Feedback
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Bug, melhoria ou sugestão para o sistema</p>
                  </div>
                  <button onClick={() => setModalFeedback(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
                </div>

                {/* Tipo */}
                <div className="flex gap-2 mb-4">
                  {[['BUG','🐛','Bug'],['MELHORIA','✨','Melhoria'],['SUGESTAO','💡','Sugestão']].map(([val, emoji, label]) => (
                    <button key={val} onClick={() => setFeedbackTipo(val)}
                      className={`flex-1 text-xs py-2 rounded-lg border transition font-medium ${feedbackTipo===val ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                      {emoji} {label}
                    </button>
                  ))}
                </div>

                {/* Título */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Título</label>
                  <input value={feedbackTitulo} onChange={e => setFeedbackTitulo(e.target.value)}
                    placeholder="Ex: Botão de salvar não funciona na tela de produtos"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>

                {/* Descrição */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Descrição</label>
                  <textarea value={feedbackDesc} onChange={e => setFeedbackDesc(e.target.value)} rows={4}
                    placeholder="Descreva com detalhes o que aconteceu ou o que você gostaria..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                </div>

                {/* Imagem */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">
                    Print de tela <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  {feedbackImagem ? (
                    <div className="relative border border-gray-200 rounded-xl overflow-hidden">
                      <img src={feedbackImagem} alt="Print" className="max-h-32 w-full object-contain bg-gray-50" />
                      <button type="button" onClick={() => { setFeedbackImagem(null); setFeedbackImagemNome('') }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                        <X size={12} />
                      </button>
                      <p className="text-xs text-gray-400 px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center gap-1">
                        <ImageIcon size={11} /> {feedbackImagemNome}
                      </p>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition">
                      <ImageIcon size={18} className="text-gray-300 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Clique para anexar um print</p>
                        <p className="text-xs text-gray-400">PNG, JPG ou WEBP · máx. 3MB</p>
                      </div>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]; if (!file) return
                          if (file.size > 3*1024*1024) { alert('Máximo 3MB'); return }
                          const reader = new FileReader()
                          reader.onload = () => { setFeedbackImagem(reader.result as string); setFeedbackImagemNome(file.name) }
                          reader.readAsDataURL(file)
                          e.target.value = ''
                        }} />
                    </label>
                  )}
                </div>

                {erroFeedback && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{erroFeedback}</p>}

                <div className="flex gap-2">
                  <button onClick={() => setModalFeedback(false)}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition">
                    Cancelar
                  </button>
                  <button onClick={enviarFeedback} disabled={enviandoFeedback || !feedbackTitulo.trim() || !feedbackDesc.trim()}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50">
                    {enviandoFeedback ? 'Enviando...' : 'Enviar Feedback'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {modalChamado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-md p-6">
            {protocolo ? (
              <div className="text-center py-4">
                <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                <h2 className="text-base font-semibold text-gray-900 mb-1">Chamado aberto!</h2>
                <p className="text-xs text-gray-500 mb-3">Nossa equipe vai responder pelo seu e-mail</p>
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-1">Protocolo</p>
                  <p className="text-lg font-bold text-orange-500 font-mono">{protocolo}</p>
                </div>
                <button
                  onClick={() => { setModalChamado(false); setProtocolo('') }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-medium transition"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Abrir Chamado</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Respondemos em até 24h úteis no seu e-mail</p>
                  </div>
                  <button onClick={() => { setModalChamado(false); setErroChamado('') }}>
                    <X size={18} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Descreva o problema</label>
                  <textarea
                    value={descricaoChamado}
                    onChange={e => setDescricaoChamado(e.target.value)}
                    rows={5}
                    placeholder="Ex: Não consigo cadastrar um produto. Quando clico em Salvar, nada acontece..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>

                {/* Upload de print */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">
                    Print de tela <span className="text-gray-400 font-normal">(opcional — ajuda muito na análise)</span>
                  </label>
                  {imagemChamado ? (
                    <div className="relative border border-gray-200 rounded-xl overflow-hidden">
                      <img src={imagemChamado} alt="Print" className="max-h-40 w-full object-contain bg-gray-50" />
                      <button
                        type="button"
                        onClick={() => { setImagemChamado(null); setImagemChamadoNome('') }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                      <p className="text-xs text-gray-400 px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center gap-1">
                        <ImageIcon size={11} /> {imagemChamadoNome}
                      </p>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition">
                      <ImageIcon size={18} className="text-gray-300 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Clique para anexar um print</p>
                        <p className="text-xs text-gray-400">PNG, JPG ou WEBP · máx. 3MB</p>
                      </div>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImagemChamado} />
                    </label>
                  )}
                </div>

                {ultimaRespostaIA && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-4 flex gap-2">
                    <AlertCircle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-700">A última resposta da IA será enviada junto para ajudar nossa equipe.</p>
                  </div>
                )}

                {erroChamado && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{erroChamado}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalChamado(false); setErroChamado('') }}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={abrirChamado}
                    disabled={enviandoChamado}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50"
                  >
                    {enviandoChamado ? 'Enviando...' : 'Enviar Chamado'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
