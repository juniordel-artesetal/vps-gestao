'use client'
// components/MasterVpsStars.tsx
import { useEffect, useState } from 'react'
import { Sparkles, Trophy, CheckCircle, Gift, Package, History, Plus, X, Edit2 } from 'lucide-react'

type Sub = 'dashboard'|'ranking'|'validacoes'|'resgates'|'premios'|'historico'|'pontuar'

export default function MasterVpsStars() {
  const [sub, setSub] = useState<Sub>('dashboard')
  const [dashboard, setDashboard] = useState<any>(null)
  const [ranking, setRanking] = useState<any[]>([])
  const [rankingTipo, setRankingTipo] = useState<'anual'|'trimestral'>('anual')
  const [validacoes, setValidacoes] = useState<{depoimentos:any[]; indicacoes:any[]}>({ depoimentos:[], indicacoes:[] })
  const [resgates, setResgates] = useState<any[]>([])
  const [resgatesStatus, setResgatesStatus] = useState<'PENDENTE'|'APROVADO'|'ENTREGUE'|'CANCELADO'>('PENDENTE')
  const [premios, setPremios] = useState<any[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [segmentos, setSegmentos] = useState<any[]>([])
  const [motivosList, setMotivosList] = useState<any[]>([])
  const [filtros, setFiltros] = useState({ nome: '', motivo: '', segmento: '', dataIni: '', dataFim: '', fatMin: '', fatMax: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Modal Prêmio
  const [modalPremio, setModalPremio] = useState<any>(null)
  const [formPremio, setFormPremio] = useState<any>({
    nome: '', descricao: '', tipo: 'FISICO', pontosNecessarios: 1000,
    parceiro: '', quantidade: '', nivelMinimo: '', ativo: true,
  })

  // Modal Pontuar manual
  const [pontuarForm, setPontuarForm] = useState({ workspaceId: '', pontos: 0, descricao: '' })

  useEffect(() => {
    carregar()
  }, [sub, rankingTipo, resgatesStatus, filtros])

  async function carregar() {
    setLoading(true)
    try {
      if (sub === 'dashboard') {
        const r = await fetch('/api/master/stars?secao=dashboard')
        if (r.ok) setDashboard(await r.json())
      }
      if (sub === 'ranking') {
        const r = await fetch(`/api/master/stars?secao=ranking&tipo=${rankingTipo}`)
        if (r.ok) setRanking(await r.json())
      }
      if (sub === 'validacoes') {
        const r = await fetch('/api/master/stars?secao=validacoes')
        if (r.ok) setValidacoes(await r.json())
      }
      if (sub === 'resgates') {
        const r = await fetch(`/api/master/stars?secao=resgates&status=${resgatesStatus}`)
        if (r.ok) setResgates(await r.json())
      }
      if (sub === 'premios') {
        const r = await fetch('/api/master/stars?secao=premios')
        if (r.ok) setPremios(await r.json())
      }
      if (sub === 'historico') {
        const params = new URLSearchParams({ secao: 'historico', ...filtros })
        const r = await fetch(`/api/master/stars?${params.toString()}`)
        if (r.ok) {
          const data = await r.json()
          setHistorico(data.logs || [])
          setSegmentos(data.segmentos || [])
          setMotivosList(data.motivos || [])
        }
      }
    } finally { setLoading(false) }
  }

  function ok(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function acao(acao: string, body: any, recarrega: () => void = carregar) {
    const r = await fetch(`/api/master/stars?acao=${acao}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) { ok('✓ Sucesso'); recarrega() }
    else ok('⚠ Erro')
  }

  function abrirNovoPremio() {
    setFormPremio({ nome: '', descricao: '', tipo: 'FISICO', pontosNecessarios: 1000, parceiro: '', quantidade: '', nivelMinimo: '', ativo: true })
    setModalPremio({})
  }

  function abrirEditarPremio(p: any) {
    setFormPremio({
      nome: p.nome, descricao: p.descricao || '', tipo: p.tipo,
      pontosNecessarios: p.pontosNecessarios,
      parceiro: p.parceiro || '', quantidade: p.quantidade ?? '',
      nivelMinimo: p.nivelMinimo || '', ativo: p.ativo,
    })
    setModalPremio(p)
  }

  async function salvarPremio() {
    if (!formPremio.nome || !formPremio.pontosNecessarios) return
    await acao('salvar-premio', { id: modalPremio.id, ...formPremio }, () => { setModalPremio(null); carregar() })
  }

  async function pontuarManual() {
    if (!pontuarForm.workspaceId || !pontuarForm.pontos) return
    await acao('pontuar-manual', pontuarForm, () => {
      setSub('historico'); setPontuarForm({ workspaceId: '', pontos: 0, descricao: '' })
    })
  }

  const SUBS: { key: Sub; label: string; icon: any }[] = [
    { key: 'dashboard',   label: 'Dashboard',   icon: Sparkles },
    { key: 'ranking',     label: 'Ranking',     icon: Trophy },
    { key: 'validacoes',  label: 'Validações',  icon: CheckCircle },
    { key: 'resgates',    label: 'Resgates',    icon: Package },
    { key: 'premios',     label: 'Catálogo',    icon: Gift },
    { key: 'historico',   label: 'Histórico',   icon: History },
    { key: 'pontuar',     label: 'Pontuar',     icon: Plus },
  ]

  return (
    <div>
      {msg && <div className="bg-green-500/10 border border-green-500/30 text-green-300 rounded-lg p-2 mb-3 text-sm">{msg}</div>}

      <div className="flex gap-2 flex-wrap mb-5 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {SUBS.map(s => {
          const Icon = s.icon
          return (
            <button key={s.key} onClick={() => setSub(s.key)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition ${
                sub === s.key ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}>
              <Icon size={13} /> {s.label}
            </button>
          )
        })}
        <button onClick={() => acao('zerar-trimestre', {})}
          className="ml-auto text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
          Zerar trimestre
        </button>
        <button onClick={() => { if (confirm('Zerar TODO o ciclo anual? Esta ação não pode ser desfeita.')) acao('zerar-ciclo', {}) }}
          className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
          Zerar ciclo anual
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm text-center py-12">Carregando...</p>}

      {/* ── DASHBOARD ── */}
      {sub === 'dashboard' && dashboard && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Participantes</p>
              <p className="text-2xl font-bold text-white">{dashboard.totais?.total_participantes ?? 0}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Pts no ano</p>
              <p className="text-2xl font-bold text-orange-400">{Number(dashboard.totais?.total_pontos_ano ?? 0).toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Pts no trimestre</p>
              <p className="text-2xl font-bold text-pink-400">{Number(dashboard.totais?.total_pontos_trimestre ?? 0).toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Distribuídos este mês</p>
              <p className="text-2xl font-bold text-green-400">{Number(dashboard.distribuidos?.total ?? 0).toLocaleString('pt-BR')}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-bold mb-3">Distribuição por nível</h3>
              {dashboard.porNivel?.map((n: any) => (
                <div key={n.nivel} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-300">{n.nivel}</span>
                  <span className="text-sm font-bold text-white">{n.total} ateliês</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-bold mb-3">Top 5</h3>
              {dashboard.top5?.map((t: any, i: number) => (
                <div key={t.workspaceId} className="flex items-center gap-2 py-2 border-b border-gray-800 last:border-0">
                  <span className="text-yellow-400 font-bold w-6">{['🥇','🥈','🥉','4º','5º'][i]}</span>
                  <span className="text-sm text-gray-300 flex-1 truncate">{t.nome}</span>
                  <span className="text-sm font-bold text-orange-400">{Number(t.pontosAno).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RANKING ── */}
      {sub === 'ranking' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setRankingTipo('anual')}
              className={`px-3 py-1.5 rounded-lg text-xs ${rankingTipo === 'anual' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>Anual (TOP 40)</button>
            <button onClick={() => setRankingTipo('trimestral')}
              className={`px-3 py-1.5 rounded-lg text-xs ${rankingTipo === 'trimestral' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>Trimestral (TOP 20 — 10k+ pts)</button>
          </div>
          <div className="space-y-1">
            {ranking.map((r: any) => (
              <div key={r.workspaceId} className={`flex items-center gap-3 p-2 rounded-lg ${Number(r.posicao) <= 3 ? 'bg-yellow-500/10' : ''}`}>
                <span className="w-10 text-center font-bold text-sm text-orange-400">#{r.posicao}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.nome}</p>
                  
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{r.nivel}</span>
                <span className="text-sm font-bold text-orange-400">
                  {rankingTipo === 'trimestral' ? Number(r.pontosTrimestre).toLocaleString('pt-BR') : Number(r.pontosAno).toLocaleString('pt-BR')} pts
                </span>
              </div>
            ))}
            {ranking.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Sem dados</p>}
          </div>
        </div>
      )}

      {/* ── VALIDAÇÕES ── */}
      {sub === 'validacoes' && (
        <div className="space-y-5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-bold mb-3">💬 Depoimentos pendentes ({validacoes.depoimentos.length})</h3>
            {validacoes.depoimentos.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum pendente</p>
            ) : validacoes.depoimentos.map((d: any) => (
              <div key={d.id} className="border border-gray-800 rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-white">{d.workspaceNome} — {d.tipo === 'VIDEO' ? '🎥 Vídeo (+500 pts)' : '💬 Texto (+100 pts)'}</p>
                  <p className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="text-sm text-gray-300 mb-3 break-words">{d.conteudo}</p>
                <div className="flex gap-2">
                  <button onClick={() => acao('validar-depoimento', { id: d.id, aprovado: true })}
                    className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs hover:bg-green-500/30">✓ Aprovar</button>
                  <button onClick={() => acao('validar-depoimento', { id: d.id, aprovado: false })}
                    className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/30">✕ Rejeitar</button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-bold mb-3">👥 Indicações pendentes ({validacoes.indicacoes.length})</h3>
            {validacoes.indicacoes.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma pendente</p>
            ) : validacoes.indicacoes.map((i: any) => (
              <div key={i.id} className="border border-gray-800 rounded-lg p-3 mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{i.workspaceNome} indicou:</p>
                  <p className="text-sm text-gray-300">{i.nomeIndicada} • {i.contatoIndicada}</p>
                  <p className="text-xs text-gray-500">{new Date(i.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => { if (confirm('Confirmar conversão (+500 pts)?')) acao('converter-indicacao', { id: i.id }) }}
                  className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs hover:bg-green-500/30">
                  ✓ Converter (+500 pts)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESGATES ── */}
      {sub === 'resgates' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex gap-2 mb-4">
            {(['PENDENTE','APROVADO','ENTREGUE','CANCELADO'] as const).map(s => (
              <button key={s} onClick={() => setResgatesStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs ${resgatesStatus === s ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>{s}</button>
            ))}
          </div>
          {resgates.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Nenhum resgate {resgatesStatus.toLowerCase()}</p>
          ) : resgates.map((r: any) => (
            <div key={r.id} className="border border-gray-800 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-white">{r.workspaceNome}</p>
                  
                </div>
                <p className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="bg-gray-800 rounded p-2 mb-2">
                <p className="text-sm text-gray-300">{r.premioNome}</p>
                <p className="text-xs text-orange-400">{Number(r.pontosUsados).toLocaleString('pt-BR')} pts • {r.premioTipo}</p>
              </div>
              {r.observacoes && <p className="text-xs text-gray-400 mb-2">📍 {r.observacoes}</p>}
              <div className="flex gap-2">
                {resgatesStatus === 'PENDENTE' && (
                  <>
                    <button onClick={() => acao('status-resgate', { id: r.id, status: 'APROVADO' })}
                      className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs hover:bg-blue-500/30">Aprovar</button>
                    <button onClick={() => acao('status-resgate', { id: r.id, status: 'CANCELADO' })}
                      className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/30">Cancelar</button>
                  </>
                )}
                {resgatesStatus === 'APROVADO' && (
                  <button onClick={() => acao('status-resgate', { id: r.id, status: 'ENTREGUE' })}
                    className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs hover:bg-green-500/30">Marcar como entregue</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CATÁLOGO DE PRÊMIOS ── */}
      {sub === 'premios' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">Catálogo de prêmios ({premios.length})</h3>
            <button onClick={abrirNovoPremio} className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Plus size={14} /> Novo prêmio
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {premios.map(p => (
              <div key={p.id} className={`border rounded-xl p-3 ${p.ativo ? 'border-gray-700' : 'border-gray-800 opacity-50'}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-bold text-white flex-1">{p.nome}</p>
                  <button onClick={() => abrirEditarPremio(p)} className="text-gray-400 hover:text-white"><Edit2 size={14} /></button>
                </div>
                {p.descricao && <p className="text-xs text-gray-400 mb-2">{p.descricao}</p>}
                <div className="flex items-center gap-1 flex-wrap mb-1">
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{Number(p.pontosNecessarios).toLocaleString('pt-BR')} pts</span>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{p.tipo}</span>
                </div>
                {p.parceiro && <p className="text-xs text-purple-400">Parceiro: {p.parceiro}</p>}
                {p.quantidade !== null && <p className="text-xs text-gray-500">Estoque: {p.quantidade}</p>}
                {p.nivelMinimo && <p className="text-xs text-yellow-400">Mínimo: {p.nivelMinimo}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {sub === 'historico' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input value={filtros.nome} onChange={e => setFiltros(f => ({...f, nome: e.target.value}))}
                placeholder="🔍 Buscar ateliê..." className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
              <select value={filtros.motivo} onChange={e => setFiltros(f => ({...f, motivo: e.target.value}))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                <option value="">Todos os eventos</option>
                {motivosList.map((m: any) => <option key={m.motivo} value={m.motivo}>{m.motivo}</option>)}
              </select>
              <select value={filtros.segmento} onChange={e => setFiltros(f => ({...f, segmento: e.target.value}))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                <option value="">Todos os segmentos</option>
                {segmentos.map((s: any) => <option key={s.segmento} value={s.segmento}>{s.segmento}</option>)}
              </select>
              <input type="date" value={filtros.dataIni} onChange={e => setFiltros(f => ({...f, dataIni: e.target.value}))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
              <input type="date" value={filtros.dataFim} onChange={e => setFiltros(f => ({...f, dataFim: e.target.value}))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
            </div>
            {/* Filtro de faturamento */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              <input type="number" value={filtros.fatMin} onChange={e => setFiltros(f => ({...f, fatMin: e.target.value}))}
                placeholder="💰 Faturamento mín (R$)" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
              <input type="number" value={filtros.fatMax} onChange={e => setFiltros(f => ({...f, fatMax: e.target.value}))}
                placeholder="💰 Faturamento máx (R$)" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white" />
              <button onClick={() => setFiltros(f => ({...f, fatMin: '5000', fatMax: ''}))}
                className="bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg px-3 py-2 text-xs hover:bg-green-500/30">
                ≥ R$ 5.000
              </button>
              <button onClick={() => setFiltros(f => ({...f, fatMin: '10000', fatMax: ''}))}
                className="bg-green-500/30 text-green-300 border border-green-500/40 rounded-lg px-3 py-2 text-xs hover:bg-green-500/40">
                ≥ R$ 10.000
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-500">{historico.length} eventos</p>
              <button onClick={() => setFiltros({ nome: '', motivo: '', segmento: '', dataIni: '', dataFim: '', fatMin: '', fatMax: '' })}
                className="text-xs text-gray-400 hover:text-white">Limpar filtros</button>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950">
                    <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">Data</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">Ateliê</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">Segmento</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">Faturamento mês</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">Evento</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">Detalhes</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h: any) => {
                    const meta = h.metadata || {}
                    let detalhes = ''
                    if (meta.canal) detalhes += `Canal: ${meta.canal}  `
                    if (meta.valor !== undefined && meta.valor !== null) detalhes += `R$ ${Number(meta.valor).toFixed(2)}  `
                    if (meta.quantidade) detalhes += `Qtd: ${meta.quantidade}  `
                    if (meta.tipo) detalhes += `${meta.tipo}  `
                    if (!detalhes && h.descricao) detalhes = h.descricao

                    return (
                      <tr key={h.id} className="border-b border-gray-900 hover:bg-gray-950">
                        <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleDateString('pt-BR')}{' '}
                          <span className="text-gray-600">{new Date(h.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-white">{h.workspaceNome}</td>
                        <td className="px-3 py-2 text-xs text-gray-400">{h.segmento || '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={Number(h.faturamentoMes) >= 5000 ? 'text-green-400 font-bold' : 'text-gray-400'}>
                            R$ {Number(h.faturamentoMes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-orange-400">{h.motivo}</td>
                        <td className="px-3 py-2 text-xs text-gray-300 max-w-xs truncate" title={detalhes}>{detalhes}</td>
                        <td className={`px-3 py-2 text-xs font-bold text-right ${Number(h.pontos) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {Number(h.pontos) >= 0 ? '+' : ''}{h.pontos}
                        </td>
                      </tr>
                    )
                  })}
                  {historico.length === 0 && (
                    <tr><td colSpan={7} className="text-gray-500 text-sm text-center py-8">Sem eventos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PONTUAR MANUAL ── */}
      {sub === 'pontuar' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 max-w-lg">
          <h3 className="text-white font-bold mb-3">⭐ Pontuar manualmente</h3>
          <p className="text-xs text-gray-400 mb-4">Use para creditar pontos extras (sugestão implementada, bônus especial, correções).</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Workspace ID</label>
              <input value={pontuarForm.workspaceId} onChange={e => setPontuarForm(p => ({...p, workspaceId: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                placeholder="ID do workspace" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Pontos (use negativo para remover)</label>
              <input type="number" value={pontuarForm.pontos} onChange={e => setPontuarForm(p => ({...p, pontos: Number(e.target.value)}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Motivo / descrição</label>
              <input value={pontuarForm.descricao} onChange={e => setPontuarForm(p => ({...p, descricao: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                placeholder="Ex: Sugestão implementada — checkbox de seleção em massa" />
            </div>
            <button onClick={pontuarManual}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-semibold">
              Creditar pontos
            </button>
          </div>
        </div>
      )}

      {/* Modal Prêmio */}
      {modalPremio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold">{modalPremio.id ? 'Editar prêmio' : 'Novo prêmio'}</p>
              <button onClick={() => setModalPremio(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Nome do prêmio *" value={formPremio.nome}
                onChange={e => setFormPremio((p: any) => ({...p, nome: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              <textarea placeholder="Descrição" value={formPremio.descricao} rows={2}
                onChange={e => setFormPremio((p: any) => ({...p, descricao: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tipo</label>
                  <select value={formPremio.tipo}
                    onChange={e => setFormPremio((p: any) => ({...p, tipo: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="FISICO">Físico</option>
                    <option value="DIGITAL">Digital</option>
                    <option value="MENSALIDADE">Mensalidade</option>
                    <option value="CUPOM">Cupom</option>
                    <option value="ACESSO">Acesso módulo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Pontos *</label>
                  <input type="number" value={formPremio.pontosNecessarios}
                    onChange={e => setFormPremio((p: any) => ({...p, pontosNecessarios: Number(e.target.value)}))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <input placeholder="Parceiro (opcional)" value={formPremio.parceiro}
                onChange={e => setFormPremio((p: any) => ({...p, parceiro: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Quantidade (vazio = ilimitado)" type="number" value={formPremio.quantidade}
                  onChange={e => setFormPremio((p: any) => ({...p, quantidade: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
                <select value={formPremio.nivelMinimo}
                  onChange={e => setFormPremio((p: any) => ({...p, nivelMinimo: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">Sem nível mínimo</option>
                  <option value="BLOOM">Bloom+</option>
                  <option value="PRODUTORA">Produtora+</option>
                  <option value="EXPERT">Expert+</option>
                  <option value="ELITE">Elite</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={formPremio.ativo}
                  onChange={e => setFormPremio((p: any) => ({...p, ativo: e.target.checked}))} />
                Ativo (visível para artesãs)
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalPremio(null)}
                className="flex-1 border border-gray-700 text-gray-400 rounded-lg py-2 text-sm">Cancelar</button>
              <button onClick={salvarPremio} disabled={!formPremio.nome || !formPremio.pontosNecessarios}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
