'use client'
// app/stars/page.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Sparkles, Trophy, Gift, MessageSquare, UserPlus, History, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// [FASE 1 rebrand] Feature "VPS Stars" oculta da interface — bloqueia acesso
// direto pela URL. O código original é preservado em StarsPageOriginal abaixo.
export default function StarsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/modulos') }, [router])
  return null
}

interface Saldo {
  pontos: number
  pontosAno: number
  pontosTrimestre: number
  nivel: string
  nivelLabel: string
  proximoNivel: string | null
  progressoPct: number
  pontosParaProximo: number
  posicaoAnual: number
  posicaoTrimestral: number | null
  isTop20: boolean
  historico: any[]
  ranking: any[]
}

const TIPO_MOTIVO: Record<string, string> = {
  LOGIN_DIARIO: '🌅 Login diário',
  PEDIDO_MANUAL: '📝 Pedido manual',
  PEDIDO_IMPORTADO: '📥 Pedidos importados',
  EXPEDICAO: '📦 Expedição',
  LANCAMENTO_RECEITA: '💰 Receita',
  LANCAMENTO_DESPESA: '💸 Despesa',
  IA_GESTAO: '🤖 IA Gestão',
  PRODUTO_CADASTRADO: '🏷️ Produto cadastrado',
  DEPOIMENTO_TEXTO: '💬 Depoimento texto',
  DEPOIMENTO_VIDEO: '🎥 Depoimento vídeo',
  INDICACAO_CONVERTIDA: '👥 Indicação convertida',
  RESGATE: '🎁 Resgate',
  MANUAL_MASTER: '⭐ Bônus VPS',
}

const NIVEIS_INFO = [
  { nome: 'SEMENTINHA', label: '🌱 Sementinha', min: 0,     desc: 'Início da jornada' },
  { nome: 'BLOOM',      label: '🌸 Bloom',      min: 1400,  desc: 'Florescendo' },
  { nome: 'PRODUTORA',  label: '🔶 Produtora',  min: 5500,  desc: 'Em produção constante' },
  { nome: 'EXPERT',     label: '🌟 Expert',     min: 14000, desc: 'Domínio do sistema' },
  { nome: 'ELITE',      label: '👑 Elite',      min: 42000, desc: 'O topo do programa' },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StarsPageOriginal() {
  const { status } = useSession()
  const router = useRouter()
  const [aba, setAba] = useState<'painel'|'ranking'|'premios'|'depoimentos'|'indicacoes'>('painel')
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [premios, setPremios] = useState<any[]>([])
  const [meusResgates, setMeusResgates] = useState<any[]>([])
  const [depoimentos, setDepoimentos] = useState<any[]>([])
  const [indicacoes, setIndicacoes] = useState<any[]>([])
  const [modalDepoimento, setModalDepoimento] = useState<'TEXTO'|'VIDEO'|null>(null)
  const [conteudoDep, setConteudoDep] = useState('')
  const [modalIndicacao, setModalIndicacao] = useState(false)
  const [formInd, setFormInd] = useState({ nomeIndicada: '', contatoIndicada: '' })
  const [modalResgate, setModalResgate] = useState<any>(null)
  const [endereco, setEndereco] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') carregar()
  }, [status])

  async function carregar() {
    setCarregando(true)
    try {
      const r = await fetch('/api/stars/saldo?ranking=1')
      if (r.ok) setSaldo(await r.json())
    } finally { setCarregando(false) }
  }

  async function carregarPremios() {
    const [premiosRes, resgatesRes] = await Promise.all([
      fetch('/api/stars/resgatar').then(r => r.json()),
      fetch('/api/stars/resgatar?tipo=meus').then(r => r.json()),
    ])
    setPremios(Array.isArray(premiosRes) ? premiosRes : [])
    setMeusResgates(Array.isArray(resgatesRes) ? resgatesRes : [])
  }

  async function carregarDepoimentos() {
    const r = await fetch('/api/stars/depoimentos')
    if (r.ok) setDepoimentos(await r.json())
  }

  async function carregarIndicacoes() {
    const r = await fetch('/api/stars/indicacoes')
    if (r.ok) setIndicacoes(await r.json())
  }

  useEffect(() => {
    if (aba === 'premios') carregarPremios()
    if (aba === 'depoimentos') carregarDepoimentos()
    if (aba === 'indicacoes') carregarIndicacoes()
  }, [aba])

  function ok(msg: string) { setSucesso(msg); setTimeout(() => setSucesso(''), 3000) }
  function fail(msg: string) { setErro(msg); setTimeout(() => setErro(''), 4000) }

  async function enviarDepoimento() {
    if (!conteudoDep.trim()) return
    const r = await fetch('/api/stars/depoimentos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: modalDepoimento, conteudo: conteudoDep }),
    })
    const data = await r.json()
    if (r.ok) {
      ok('Depoimento enviado! Após aprovação você ganhará os pontos.')
      setModalDepoimento(null); setConteudoDep('')
      carregarDepoimentos()
    } else fail(data.error || 'Erro')
  }

  async function enviarIndicacao() {
    if (!formInd.nomeIndicada.trim() || !formInd.contatoIndicada.trim()) return
    const r = await fetch('/api/stars/indicacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formInd),
    })
    const data = await r.json()
    if (r.ok) {
      ok('Indicação registrada! Você ganha 500 pts quando ela assinar.')
      setModalIndicacao(false); setFormInd({ nomeIndicada: '', contatoIndicada: '' })
      carregarIndicacoes()
    } else fail(data.error || 'Erro')
  }

  async function resgatar() {
    if (!modalResgate) return
    const r = await fetch('/api/stars/resgatar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ premioId: modalResgate.id, endereco }),
    })
    const data = await r.json()
    if (r.ok) {
      ok('Resgate solicitado! Aguarde o contato da equipe VPS.')
      setModalResgate(null); setEndereco('')
      carregar(); carregarPremios()
    } else fail(data.error || 'Erro')
  }

  if (carregando || !saldo) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Botão voltar */}
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 mb-4 transition">
          <ArrowLeft size={16} /> Voltar para o sistema
        </Link>

        {sucesso && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-sm text-green-700">✓ {sucesso}</div>}
        {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">⚠ {erro}</div>}

        {/* Header com saldo */}
        <div className="bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} className="text-yellow-200" />
                <p className="text-sm font-bold uppercase tracking-wider">VPS Stars</p>
              </div>
              <p className="text-4xl font-bold mb-1">{saldo.pontos.toLocaleString('pt-BR')} <span className="text-xl font-normal opacity-80">pts</span></p>
              <p className="text-white/90">{saldo.nivelLabel}</p>
            </div>
            {saldo.isTop20 && (
              <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1.5 rounded-full">🏅 TOP 20 do trimestre</div>
            )}
          </div>
          {saldo.proximoNivel && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/80">Próximo nível: {saldo.proximoNivel}</p>
                <p className="text-xs font-bold">{saldo.progressoPct}%</p>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${saldo.progressoPct}%` }} />
              </div>
              <p className="text-xs text-white/80 mt-1">Faltam {saldo.pontosParaProximo.toLocaleString('pt-BR')} pts</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/20">
            <div>
              <p className="text-xs text-white/70">Posição anual</p>
              <p className="text-lg font-bold">#{saldo.posicaoAnual}</p>
            </div>
            <div>
              <p className="text-xs text-white/70">Pts trimestre</p>
              <p className="text-lg font-bold">{saldo.pontosTrimestre.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-white/70">Pts ano</p>
              <p className="text-lg font-bold">{saldo.pontosAno.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {[
            { key: 'painel',      label: 'Meu painel',  Icon: Sparkles },
            { key: 'ranking',     label: 'Ranking',     Icon: Trophy },
            { key: 'premios',     label: 'Prêmios',     Icon: Gift },
            { key: 'depoimentos', label: 'Depoimentos', Icon: MessageSquare },
            { key: 'indicacoes',  label: 'Indicações',  Icon: UserPlus },
          ].map(t => (
            <button key={t.key} onClick={() => setAba(t.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                aba === t.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-orange-50'
              }`}>
              <t.Icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* ── ABA: Painel ── */}
        {aba === 'painel' && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Níveis */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-white mb-3">Níveis do programa</h2>
              <div className="space-y-2">
                {NIVEIS_INFO.map(n => (
                  <div key={n.nome} className={`flex items-center justify-between p-2.5 rounded-lg ${saldo.nivel === n.nome ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-300' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.label}</p>
                      <p className="text-xs text-gray-500">{n.desc}</p>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">{n.min.toLocaleString('pt-BR')}+ pts</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Histórico recente */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-orange-500" />
                <h2 className="font-bold text-gray-900 dark:text-white">Histórico recente</h2>
              </div>
              {saldo.historico.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhuma atividade ainda</p>
              ) : (
                <div className="space-y-1.5">
                  {saldo.historico.map((h: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 dark:text-gray-300 truncate">{TIPO_MOTIVO[h.motivo] || h.motivo}</p>
                        {h.descricao && <p className="text-gray-400 truncate">{h.descricao}</p>}
                      </div>
                      <span className={`font-bold ml-2 ${Number(h.pontos) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {Number(h.pontos) >= 0 ? '+' : ''}{h.pontos} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ABA: Ranking ── */}
        {aba === 'ranking' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-white mb-3">🏆 Ranking anual — Top 50</h2>
            {saldo.ranking.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sem participantes ainda</p>
            ) : (
              <div className="space-y-1">
                {saldo.ranking.map((r: any) => (
                  <div key={r.workspaceId} className={`flex items-center gap-3 p-2.5 rounded-lg ${Number(r.posicao) <= 3 ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <div className={`w-8 text-center font-bold text-sm ${Number(r.posicao) === 1 ? 'text-yellow-500' : Number(r.posicao) === 2 ? 'text-gray-400' : Number(r.posicao) === 3 ? 'text-orange-700' : 'text-gray-500'}`}>
                      {Number(r.posicao) === 1 ? '🥇' : Number(r.posicao) === 2 ? '🥈' : Number(r.posicao) === 3 ? '🥉' : `#${r.posicao}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.workspaceNome}</p>
                      <p className="text-xs text-gray-500">{r.nivel}</p>
                    </div>
                    <p className="text-sm font-bold text-orange-600">{Number(r.pontosAno).toLocaleString('pt-BR')} pts</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA: Prêmios ── */}
        {aba === 'premios' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-white mb-3">🎁 Catálogo de prêmios</h2>
              {premios.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum prêmio disponível no momento</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {premios.map(p => {
                    const podeResgatar = saldo.pontos >= Number(p.pontosNecessarios)
                    return (
                      <div key={p.id} className={`border rounded-xl p-4 ${podeResgatar ? 'border-orange-300 hover:shadow-md' : 'border-gray-200 opacity-60'} transition`}>
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white flex-1">{p.nome}</p>
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold whitespace-nowrap ml-2">{Number(p.pontosNecessarios).toLocaleString('pt-BR')} pts</span>
                        </div>
                        {p.descricao && <p className="text-xs text-gray-500 mb-3">{p.descricao}</p>}
                        {p.parceiro && <p className="text-xs text-purple-600 mb-2">Parceiro: {p.parceiro}</p>}
                        <button
                          onClick={() => setModalResgate(p)}
                          disabled={!podeResgatar}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                          {podeResgatar ? 'Resgatar' : `Faltam ${(Number(p.pontosNecessarios) - saldo.pontos).toLocaleString('pt-BR')} pts`}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {meusResgates.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">Meus resgates</h3>
                <div className="space-y-2">
                  {meusResgates.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{r.premioNome}</p>
                        <p className="text-xs text-gray-500">{Number(r.pontosUsados).toLocaleString('pt-BR')} pts • {new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        r.status === 'ENTREGUE' ? 'bg-green-100 text-green-700' :
                        r.status === 'APROVADO' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA: Depoimentos ── */}
        {aba === 'depoimentos' && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={() => setModalDepoimento('TEXTO')}
                className="bg-white dark:bg-gray-900 hover:border-orange-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 transition text-left">
                <MessageSquare size={24} className="text-orange-500 mb-2" />
                <p className="font-bold text-gray-900 dark:text-white mb-1">Enviar depoimento em texto</p>
                <p className="text-xs text-gray-500">+100 pts após aprovação</p>
              </button>
              <button onClick={() => setModalDepoimento('VIDEO')}
                className="bg-white dark:bg-gray-900 hover:border-pink-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 transition text-left">
                <MessageSquare size={24} className="text-pink-500 mb-2" />
                <p className="font-bold text-gray-900 dark:text-white mb-1">Enviar depoimento em vídeo</p>
                <p className="text-xs text-gray-500">+500 pts após aprovação</p>
              </button>
            </div>

            {depoimentos.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">Meus depoimentos</h3>
                <div className="space-y-2">
                  {depoimentos.map(d => (
                    <div key={d.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-gray-600">{d.tipo === 'VIDEO' ? '🎥 Vídeo' : '💬 Texto'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          d.status === 'APROVADO' ? 'bg-green-100 text-green-700' :
                          d.status === 'REJEITADO' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{d.status}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{d.conteudo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA: Indicações ── */}
        {aba === 'indicacoes' && (
          <div className="space-y-4">
            <button onClick={() => setModalIndicacao(true)}
              className="w-full bg-white dark:bg-gray-900 hover:border-orange-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 transition text-left">
              <UserPlus size={24} className="text-orange-500 mb-2" />
              <p className="font-bold text-gray-900 dark:text-white mb-1">Indicar uma amiga</p>
              <p className="text-xs text-gray-500">+500 pts quando ela assinar</p>
            </button>

            {indicacoes.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">Minhas indicações</h3>
                <div className="space-y-2">
                  {indicacoes.map(i => (
                    <div key={i.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{i.nomeIndicada}</p>
                        <p className="text-xs text-gray-500">{i.contatoIndicada}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        i.status === 'CONVERTIDA' ? 'bg-green-100 text-green-700' :
                        i.status === 'NAO_CONVERTIDA' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{i.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Depoimento */}
      {modalDepoimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 dark:text-white">
                {modalDepoimento === 'VIDEO' ? '🎥 Depoimento em vídeo' : '💬 Depoimento em texto'}
              </p>
              <button onClick={() => { setModalDepoimento(null); setConteudoDep('') }}><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {modalDepoimento === 'VIDEO' ? 'Cole o link do seu vídeo (YouTube, Instagram, Drive...). Após aprovação você ganhará +500 pts.' : 'Conte como o VPS Gestão ajudou seu ateliê. Após aprovação você ganhará +100 pts.'}
            </p>
            <textarea value={conteudoDep} onChange={e => setConteudoDep(e.target.value)}
              rows={modalDepoimento === 'VIDEO' ? 2 : 5}
              placeholder={modalDepoimento === 'VIDEO' ? 'https://...' : 'Conte sua experiência...'}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setModalDepoimento(null); setConteudoDep('') }}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl py-2.5 text-sm">Cancelar</button>
              <button onClick={enviarDepoimento} disabled={!conteudoDep.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Indicação */}
      {modalIndicacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 dark:text-white">👥 Indicar uma amiga</p>
              <button onClick={() => setModalIndicacao(false)}><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Você ganha +500 pts quando sua indicada virar assinante!</p>
            <div className="space-y-3">
              <input type="text" placeholder="Nome da amiga" value={formInd.nomeIndicada}
                onChange={e => setFormInd(p => ({...p, nomeIndicada: e.target.value}))}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
              <input type="text" placeholder="WhatsApp ou email" value={formInd.contatoIndicada}
                onChange={e => setFormInd(p => ({...p, contatoIndicada: e.target.value}))}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalIndicacao(false)}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl py-2.5 text-sm">Cancelar</button>
              <button onClick={enviarIndicacao} disabled={!formInd.nomeIndicada.trim() || !formInd.contatoIndicada.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">Indicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resgate */}
      {modalResgate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 dark:text-white">🎁 Resgatar prêmio</p>
              <button onClick={() => { setModalResgate(null); setEndereco('') }}><X size={18} /></button>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-xl p-3 mb-4">
              <p className="font-semibold text-gray-900 dark:text-white">{modalResgate.nome}</p>
              {modalResgate.descricao && <p className="text-xs text-gray-500 mt-1">{modalResgate.descricao}</p>}
              <p className="text-xs text-orange-600 font-bold mt-1">{Number(modalResgate.pontosNecessarios).toLocaleString('pt-BR')} pts</p>
            </div>
            {modalResgate.tipo === 'FISICO' && (
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Endereço para envio</label>
                <textarea value={endereco} onChange={e => setEndereco(e.target.value)} rows={2}
                  placeholder="Rua, número, complemento, bairro, cidade, CEP..."
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:text-white" />
              </div>
            )}
            <p className="text-xs text-gray-500 mb-4">Após confirmar, os pontos serão debitados e a equipe VPS entrará em contato.</p>
            <div className="flex gap-2">
              <button onClick={() => { setModalResgate(null); setEndereco('') }}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl py-2.5 text-sm">Cancelar</button>
              <button onClick={resgatar} disabled={modalResgate.tipo === 'FISICO' && !endereco.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">Confirmar resgate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
