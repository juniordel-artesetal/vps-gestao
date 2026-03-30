'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Search, ChevronDown, ChevronUp, Send, Headphones, AlertCircle, CheckCircle, X, MessageCircle, BookOpen, Shield } from 'lucide-react'

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
  const [aba, setAba]                           = useState<'faq' | 'chat'>('faq')
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

  useEffect(() => { carregarFaqs() }, [categoria, busca])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [historico])

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
        body: JSON.stringify({ mensagem: msg, historico }),
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
        body: JSON.stringify({ descricao: descricaoChamado, respostaIA: ultimaRespostaIA }),
      })
      const data = await res.json()
      if (!res.ok) { setErroChamado(data.error || 'Erro ao abrir chamado'); return }
      setProtocolo(data.protocolo)
      setDescricaoChamado('')
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Headphones size={20} className="text-orange-500" />
            Central de Suporte
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Tire suas dúvidas ou fale com nossa equipe</p>
        </div>
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
      </div>

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

          <div className="flex gap-2 mb-4">
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
              disabled={enviando || !input.trim()}
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
