'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sparkles, ChevronLeft, ChevronRight, RefreshCw,
  TrendingUp, DollarSign, Target, AlertCircle, Send,
  RotateCcw, MessageSquare, Trash2, Plus, Clock
} from 'lucide-react'

interface Mensagem { role: 'user' | 'assistant'; content: string }
interface Conversa  { id: string; titulo: string; periodo: string | null; updatedAt: string }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const PERGUNTAS_RAPIDAS = [
  { label: '📊 Diagnóstico completo',        msg: 'Faça um diagnóstico completo do meu negócio este mês, incluindo lucro bruto, lucro líquido, margem e diagnóstico automático.' },
  { label: '⚖️ Ponto de equilíbrio',         msg: 'Qual é meu ponto de equilíbrio atual? Estou conseguindo cobri-lo?' },
  { label: '🛍️ Análise dos produtos',        msg: 'Analise a margem de cada produto e me diga quais estão dando lucro real e quais podem estar me prejudicando.' },
  { label: '💡 Sugestões de melhoria',       msg: 'Com base nos meus dados, quais são as 3 ações mais importantes que devo tomar para melhorar minha lucratividade?' },
  { label: '📈 Tendência dos últimos meses', msg: 'Como meu negócio evoluiu nos últimos meses? Estou crescendo ou regredindo?' },
  { label: '💰 Meta de pró-labore',          msg: 'Quanto eu posso me pagar de pró-labore este mês sem comprometer o negócio?' },
]

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Componente Bold para inline
function Bold({ text }: { text: string }) {
  const partes = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {partes.map((p, j) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={j} className="font-semibold text-gray-800">{p.slice(2,-2)}</strong>
          : <span key={j}>{p}</span>
      )}
    </>
  )
}

// ── Renderizador markdown
function FormatarResposta({ texto }: { texto: string }) {
  const linhas = texto.split('\n')
  return (
    <div className="space-y-1.5 text-sm text-gray-700 leading-relaxed">
      {linhas.map((linha, i) => {
        if (!linha.trim()) return <div key={i} className="h-1" />
        if (linha.startsWith('# '))   return <h2 key={i} className="text-base font-bold text-gray-800 mt-3"><Bold text={linha.slice(2)} /></h2>
        if (linha.startsWith('## '))  return <h3 key={i} className="text-sm font-bold text-gray-800 mt-2"><Bold text={linha.slice(3)} /></h3>
        if (linha.startsWith('### ') || linha.startsWith('━')) return <h4 key={i} className="text-sm font-semibold text-gray-700 mt-2"><Bold text={linha.replace(/^###\s*/, '').replace(/━+/g,'')} /></h4>
        if (linha.startsWith('---') || linha.startsWith('━━')) return <hr key={i} className="border-gray-200 my-3" />
        if (linha.startsWith('🟢') || linha.startsWith('🟡') || linha.startsWith('🔴')) {
          const cor = linha.startsWith('🟢') ? 'bg-green-50 border-green-200 text-green-800'
                    : linha.startsWith('🟡') ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-red-50 border-red-200 text-red-800'
          return <div key={i} className={`px-3 py-2 rounded-lg border font-semibold ${cor}`}><Bold text={linha} /></div>
        }
        if (linha.startsWith('✅') || linha.startsWith('✔️') || linha.startsWith('👉') || linha.startsWith('⚠️') || linha.startsWith('❌') || linha.startsWith('•')) {
          return <p key={i} className="pl-2"><Bold text={linha} /></p>
        }
        if (linha.startsWith('- ') || linha.startsWith('* ')) {
          return <p key={i} className="pl-4 before:content-[\'·\'] before:mr-2 before:text-orange-400"><Bold text={linha.slice(2)} /></p>
        }
        if (/^\d+\.\s/.test(linha)) return <p key={i} className="pl-4"><Bold text={linha} /></p>
        return <p key={i}><Bold text={linha} /></p>
      })}
    </div>
  )
}

export default function GestaoPage() {
  const hoje = new Date()
  const [ano, setAno]           = useState(hoje.getFullYear())
  const [mes, setMes]           = useState(hoje.getMonth() + 1)
  const [contexto, setContexto] = useState<any>(null)
  const [loadingCtx, setLoadingCtx] = useState(true)
  const [msgs, setMsgs]         = useState<Mensagem[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [usage, setUsage]       = useState({ calls: 0, limite: 150 })
  const [erro, setErro]         = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Histórico de conversas
  const [conversas, setConversas]       = useState<Conversa[]>([])
  const [conversaId, setConversaId]     = useState<string | null>(null)
  const [showHistorico, setShowHistorico] = useState(false)
  const [loadingConversas, setLoadingConversas] = useState(false)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)

  const navMes = (dir: number) => {
    let nm = mes + dir, na = ano
    if (nm < 1)  { nm = 12; na-- }
    if (nm > 12) { nm = 1;  na++ }
    setMes(nm); setAno(na)
  }

  const fetchContexto = useCallback(async () => {
    setLoadingCtx(true); setErro('')
    try {
      const res = await fetch(`/api/gestao/contexto?ano=${ano}&mes=${mes}`)
      setContexto(await res.json())
    } catch { setErro('Erro ao carregar dados financeiros.') }
    finally { setLoadingCtx(false) }
  }, [ano, mes])

  const fetchUsage = async () => {
    try { setUsage(await fetch('/api/gestao/chat').then(r => r.json())) } catch {}
  }

  const fetchConversas = async () => {
    setLoadingConversas(true)
    try {
      const data = await fetch('/api/gestao/conversas').then(r => r.json())
      setConversas(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoadingConversas(false) }
  }

  useEffect(() => { fetchContexto(); fetchUsage(); fetchConversas() }, [fetchContexto])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => { setMsgs([]); setHistorico([]); setConversaId(null); setErro('') }, [ano, mes])

  // ── Salvar/atualizar conversa no banco
  const salvarConversa = async (msgs: Mensagem[], historico: any[], id: string | null, titulo?: string) => {
    try {
      if (!id) {
        // Criar nova conversa
        const { id: novoId } = await fetch('/api/gestao/conversas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: titulo || 'Nova conversa',
            periodo: `${MESES[mes-1]} ${ano}`,
            mensagens: historico,
          })
        }).then(r => r.json())
        setConversaId(novoId)
        fetchConversas()
        return novoId
      } else {
        // Atualizar existente
        await fetch(`/api/gestao/conversas/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo, mensagens: historico })
        })
        if (titulo) fetchConversas()
        return id
      }
    } catch { return id }
  }

  // ── Carregar conversa antiga
  const carregarConversa = async (cv: Conversa) => {
    try {
      const data = await fetch(`/api/gestao/conversas/${cv.id}`).then(r => r.json())
      const mensagens: Mensagem[] = (data.mensagens || []).filter((m: any) =>
        m.role === 'user' || m.role === 'assistant'
      )
      setMsgs(mensagens)
      setHistorico(data.mensagens || [])
      setConversaId(cv.id)
      setShowHistorico(false)
      setErro('')
    } catch { setErro('Erro ao carregar conversa.') }
  }

  // ── Deletar conversa
  const deletarConversa = async (id: string) => {
    try {
      await fetch(`/api/gestao/conversas/${id}`, { method: 'DELETE' })
      setConversas(prev => prev.filter(c => c.id !== id))
      if (conversaId === id) { setMsgs([]); setHistorico([]); setConversaId(null) }
      setConfirmDelId(null)
    } catch { setErro('Erro ao deletar.') }
  }

  // ── Enviar mensagem
  const enviar = async (texto: string) => {
    if (!texto.trim() || loading || usage.calls >= usage.limite) return
    const msgUser: Mensagem = { role: 'user', content: texto }
    const novasMsgs = [...msgs, msgUser]
    setMsgs(novasMsgs)
    setInput('')
    setLoading(true)
    setErro('')

    try {
      const res = await fetch('/api/gestao/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexto, mensagem: texto, historico, ano, mes }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.limitAtingido) setErro(`Limite de ${usage.limite} análises diárias atingido. Volte amanhã!`)
        else setErro(data.error || 'Erro ao gerar análise.')
        setMsgs(prev => prev.slice(0, -1))
        return
      }

      const msgAI: Mensagem = { role: 'assistant', content: data.content }
      const msgsFinal = [...novasMsgs, msgAI]
      setMsgs(msgsFinal)
      setHistorico(data.historico || [])
      setUsage(prev => ({ ...prev, calls: prev.calls + 1 }))

      // Salvar no banco — título gerado pela IA na 1ª resposta
      const ehPrimeira = novasMsgs.length === 1
      const titulo = ehPrimeira
        ? await fetch('/api/gestao/chat/titulo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensagem: texto })
          }).then(r => r.json()).then(d => d.titulo).catch(() => texto.slice(0, 40))
        : undefined

      await salvarConversa(msgsFinal, data.historico || [], conversaId, titulo)

    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setMsgs(prev => prev.slice(0, -1))
    } finally { setLoading(false) }
  }

  const resetar = () => { setMsgs([]); setHistorico([]); setConversaId(null); setErro('') }

  const fin = contexto?.financeiro
  const restantes = Math.max(0, usage.limite - usage.calls)

  return (
    <div className="flex h-screen bg-gray-50">

      {/* ── Sidebar de histórico */}
      <div className={`flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-200 ${showHistorico ? 'w-72' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Histórico
            </h2>
            <span className="text-xs text-gray-400">{conversas.length} conversa{conversas.length !== 1 ? 's' : ''}</span>
          </div>
          <button onClick={resetar}
            className="w-full flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Nova conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConversas && (
            <p className="text-xs text-gray-400 text-center py-4">Carregando...</p>
          )}
          {!loadingConversas && conversas.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">Nenhuma conversa ainda</p>
          )}
          {conversas.map(cv => (
            <div key={cv.id}
              className={`group relative rounded-lg p-2.5 cursor-pointer transition-colors ${
                conversaId === cv.id ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'
              }`}
              onClick={() => carregarConversa(cv)}>
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{cv.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{cv.periodo && `${cv.periodo} · `}{fmtData(cv.updatedAt)}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelId(cv.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 text-gray-300 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {confirmDelId === cv.id && (
                <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => deletarConversa(cv.id)}
                    className="flex-1 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Excluir</button>
                  <button onClick={() => setConfirmDelId(null)}
                    className="flex-1 py-1 text-xs border border-gray-200 text-gray-500 rounded hover:bg-gray-50">Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Área principal */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Cabeçalho */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowHistorico(!showHistorico)}
                className={`p-2 rounded-lg border transition-colors ${showHistorico ? 'bg-orange-50 border-orange-300 text-orange-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                <MessageSquare className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Análise de Gestão</h1>
                <p className="text-xs text-gray-500">Assistente financeiro com dados reais do negócio</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-200">
                <button onClick={() => navMes(-1)} className="p-0.5 hover:bg-gray-200 rounded">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <span className="text-sm font-semibold text-gray-700 min-w-[130px] text-center">
                  {MESES[mes-1]} {ano}
                </span>
                <button onClick={() => navMes(1)} className="p-0.5 hover:bg-gray-200 rounded">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                restantes === 0 ? 'bg-red-50 border-red-200 text-red-600'
                : restantes <= 10 ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                {restantes}/{usage.limite} análises hoje
              </div>
              {msgs.length > 0 && (
                <button onClick={resetar}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <RotateCcw className="w-3.5 h-3.5" /> Novo chat
                </button>
              )}
            </div>
          </div>
          {!loadingCtx && fin && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Receita', value: fmtR(fin.totalReceita), icon: TrendingUp, cor: 'text-green-600 bg-green-50 border-green-100' },
                { label: 'Despesa', value: fmtR(fin.totalDespesa), icon: DollarSign, cor: 'text-red-600 bg-red-50 border-red-100' },
                { label: 'Resultado', value: fmtR(fin.resultado), icon: Target, cor: fin.resultado >= 0 ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-red-600 bg-red-50 border-red-100' },
                { label: 'Margem', value: `${fin.margem}%`, icon: AlertCircle, cor: fin.margem >= 15 ? 'text-green-600 bg-green-50 border-green-100' : fin.margem >= 10 ? 'text-yellow-600 bg-yellow-50 border-yellow-100' : 'text-red-600 bg-red-50 border-red-100' },
              ].map(c => (
                <div key={c.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${c.cor}`}>
                  <c.icon className={`w-4 h-4 flex-shrink-0 ${c.cor.split(' ')[0]}`} />
                  <div><p className="text-xs opacity-70">{c.label}</p><p className="text-sm font-bold">{c.value}</p></div>
                </div>
              ))}
            </div>
          )}
          {loadingCtx && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" /> Carregando dados financeiros...
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {msgs.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Olá! Sou sua analista financeira 💛</h2>
                <p className="text-sm text-gray-500 max-w-md">
                  Tenho acesso aos seus dados reais de {MESES[mes-1]} {ano}.
                  Escolha uma análise rápida ou me faça qualquer pergunta sobre seu negócio.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                {PERGUNTAS_RAPIDAS.map(q => (
                  <button key={q.label} onClick={() => enviar(q.msg)}
                    disabled={restantes === 0 || loadingCtx}
                    className="text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all text-sm text-gray-700 hover:text-orange-600 disabled:opacity-40">
                    {q.label}
                  </button>
                ))}
              </div>
              {restantes === 0 && <p className="text-sm text-red-500 font-medium">Limite diário atingido. Volte amanhã!</p>}
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-2xl rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-orange-500 text-white text-sm rounded-tr-sm'
                  : 'bg-white border border-gray-100 shadow-sm rounded-tl-sm'
              }`}>
                {m.role === 'user' ? <p className="text-sm">{m.content}</p> : <FormatarResposta texto={m.content} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-orange-400" /> Analisando seus dados...
                </div>
              </div>
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {erro}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-100 px-6 py-4 flex-shrink-0">
          {msgs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {PERGUNTAS_RAPIDAS.slice(0, 3).map(q => (
                <button key={q.label} onClick={() => enviar(q.msg)} disabled={loading || restantes === 0}
                  className="text-xs px-3 py-1.5 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-full text-gray-600 hover:text-orange-600 transition-colors disabled:opacity-40">
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar(input)}
              placeholder={restantes === 0 ? 'Limite diário atingido...' : 'Pergunte sobre seu negócio...'}
              disabled={loading || restantes === 0 || loadingCtx}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400" />
            <button onClick={() => enviar(input)} disabled={!input.trim() || loading || restantes === 0 || loadingCtx}
              className="px-4 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Dados de {MESES[mes-1]} {ano} · {restantes} análise{restantes !== 1 ? 's' : ''} restante{restantes !== 1 ? 's' : ''} hoje · Powered by Gemini Flash
          </p>
        </div>
      </div>
    </div>
  )
}
