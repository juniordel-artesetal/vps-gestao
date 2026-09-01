'use client'
// Master — Gestão de Influenciadoras (READ-ONLY): ranking (indicações/conversões/uso real)
// + comissão + contrapartida (uso do sistema). Ações de cortesia/comissão ficam em /master/parceiros.
import { useState, useEffect, useMemo } from 'react'

type Influ = {
  parceiroId: string; nome: string; instagram: string | null; cupom: string | null; workspaceId: string
  cortesia: 'aguardando' | 'ativa' | 'encerrada'
  indicacoes: number; emTrial: number; conversoes: number; cancelaram: number; taxaConversao: number
  comissaoRecebida: number; comissaoPendente: number; comissaoAcumulada: number; recorrenteEstMes: number
  percMensal: number; percAnual: number
  ultimoLogin: string | null; diasSemLogin: number | null; diasAtivos30d: number; pedidos30d: number
  pedidosTotal: number; produtos: number; uso: 'operando' | 'baixo' | 'inativa'
}
type Resumo = { total: number; cortesiaAtiva: number; operando: number; inativas: number; indicacoes: number; conversoes: number; comissaoAcumulada: number }

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const usoInfo = (u: Influ['uso']) => u === 'operando' ? { t: 'Operando', c: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', e: '✅' }
  : u === 'baixo' ? { t: 'Uso baixo', c: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', e: '⚠️' }
  : { t: 'Inativa', c: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', e: '❌' }
const cortesiaInfo = (c: Influ['cortesia']) => c === 'ativa' ? { t: 'Cortesia ativa', c: 'text-emerald-600 dark:text-emerald-400' }
  : c === 'encerrada' ? { t: 'Encerrada', c: 'text-gray-400' } : { t: 'Aguardando', c: 'text-amber-600 dark:text-amber-400' }

export default function MasterInfluenciadoras() {
  const [lista, setLista] = useState<Influ[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [ordem, setOrdem] = useState<'conversoes' | 'indicacoes' | 'comissao' | 'uso'>('conversoes')
  const [soCortesiaAtiva, setSoCortesiaAtiva] = useState(false)

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/master/influenciadoras')
      if (r.status === 404) { setIndisponivel(true); setLoading(false); return }
      if (r.ok) { const d = await r.json(); setLista(d.influenciadoras || []); setResumo(d.resumo || null) }
      setLoading(false)
    })()
  }, [])

  const usoRank = (i: Influ) => (i.uso === 'operando' ? 1000 : i.uso === 'baixo' ? 100 : 0) + i.pedidos30d * 3 + i.diasAtivos30d
  const ordenada = useMemo(() => {
    let l = [...lista]
    if (soCortesiaAtiva) l = l.filter(i => i.cortesia === 'ativa')
    const cmp: Record<string, (a: Influ, b: Influ) => number> = {
      conversoes: (a, b) => b.conversoes - a.conversoes || b.indicacoes - a.indicacoes,
      indicacoes: (a, b) => b.indicacoes - a.indicacoes,
      comissao: (a, b) => b.comissaoAcumulada - a.comissaoAcumulada,
      uso: (a, b) => usoRank(b) - usoRank(a),
    }
    return l.sort(cmp[ordem])
  }, [lista, ordem, soCortesiaAtiva])

  const top = (fn: (a: Influ, b: Influ) => number) => [...lista].sort(fn).slice(0, 3)
  const topIndic = top((a, b) => b.indicacoes - a.indicacoes)
  const topConv = top((a, b) => b.conversoes - a.conversoes)
  const topUso = top((a, b) => usoRank(b) - usoRank(a))

  const arroba = (ig: string | null) => ig ? '@' + String(ig).replace(/^@+/, '') : '—'
  const igLink = (ig: string | null) => ig ? `https://instagram.com/${String(ig).replace(/^@+/, '')}` : null

  if (loading) return <div className="p-6 text-gray-400">Carregando…</div>
  if (indisponivel) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-4xl mb-3">✨</p>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Gestão de Influenciadoras</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Recurso indisponível — ligue <code>INFLUENCIADORAS_DASH_ATIVO=on</code> na Vercel e faça o redeploy.</p>
        <a href="/master" className="inline-block mt-4 text-sm text-orange-600 dark:text-orange-400 underline">← Voltar ao Master</a>
      </div>
    </div>
  )

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) =>
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 ${className}`}>{children}</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <a href="/master" className="text-xs text-gray-400 hover:text-gray-600">← Master</a>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">✨ Gestão de Influenciadoras</h1>
          </div>
        </div>

        {/* Resumo */}
        {resumo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            {[
              { l: 'Influenciadoras', v: resumo.total, s: `${resumo.cortesiaAtiva} c/ cortesia ativa` },
              { l: 'Operando ✅', v: resumo.operando, s: `${resumo.inativas} inativas` },
              { l: 'Conversões', v: resumo.conversoes, s: `de ${resumo.indicacoes} indicações` },
              { l: 'Comissão acumulada', v: brl(resumo.comissaoAcumulada), s: 'recebida + pendente' },
            ].map((k, i) => (
              <Card key={i} className="px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">{k.l}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{k.v}</p>
                <p className="text-[11px] text-gray-400">{k.s}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Rankings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {[
            { t: '🏆 Top indicações', l: topIndic, val: (i: Influ) => `${i.indicacoes} indic.` },
            { t: '💸 Top conversões', l: topConv, val: (i: Influ) => `${i.conversoes} ativas` },
            { t: '🔥 Top uso do sistema', l: topUso, val: (i: Influ) => `${i.pedidos30d} ped/30d` },
          ].map((r, i) => (
            <Card key={i} className="p-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{r.t}</p>
              {r.l.length === 0 ? <p className="text-xs text-gray-400">—</p> : r.l.map((inf, j) => (
                <div key={inf.parceiroId} className="flex items-center justify-between py-1 text-sm">
                  <span className="truncate text-gray-700 dark:text-gray-200"><span className="text-gray-400">{j + 1}.</span> {inf.nome}</span>
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex-shrink-0 ml-2">{r.val(inf)}</span>
                </div>
              ))}
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={soCortesiaAtiva} onChange={e => setSoCortesiaAtiva(e.target.checked)} className="accent-orange-500" />
            Só cortesia ativa
          </label>
          <span className="text-xs text-gray-400 ml-auto">Ordenar:</span>
          {(['conversoes', 'indicacoes', 'comissao', 'uso'] as const).map(o => (
            <button key={o} onClick={() => setOrdem(o)}
              className={`text-xs px-2.5 py-1 rounded-lg border ${ordem === o ? 'bg-orange-500 text-white border-orange-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300'}`}>
              {o === 'conversoes' ? 'Conversões' : o === 'indicacoes' ? 'Indicações' : o === 'comissao' ? 'Comissão' : 'Uso'}
            </button>
          ))}
        </div>

        {/* Tabela / cards */}
        <div className="space-y-2">
          {ordenada.length === 0 && <Card className="p-6 text-center text-sm text-gray-400">Nenhuma influenciadora ainda.</Card>}
          {ordenada.map(inf => {
            const u = usoInfo(inf.uso); const co = cortesiaInfo(inf.cortesia)
            return (
              <Card key={inf.parceiroId} className="p-3">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  {/* Identidade */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">{inf.nome}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${u.c}`}>{u.e} {u.t}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap gap-x-3">
                      {igLink(inf.instagram)
                        ? <a href={igLink(inf.instagram)!} target="_blank" rel="noopener" className="text-pink-600 dark:text-pink-400 hover:underline">{arroba(inf.instagram)}</a>
                        : <span>{arroba(inf.instagram)}</span>}
                      {inf.cupom && <span>cupom <b className="text-gray-600 dark:text-gray-300">{inf.cupom}</b></span>}
                      <span className={co.c}>{co.t}</span>
                    </div>
                  </div>
                  {/* Métricas de indicação */}
                  <div className="flex gap-4 text-center">
                    <div><p className="text-sm font-bold text-gray-900 dark:text-white">{inf.indicacoes}</p><p className="text-[10px] text-gray-400">indic.</p></div>
                    <div><p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{inf.conversoes}</p><p className="text-[10px] text-gray-400">ativas</p></div>
                    <div><p className="text-sm font-bold text-gray-900 dark:text-white">{inf.taxaConversao}%</p><p className="text-[10px] text-gray-400">conv.</p></div>
                  </div>
                  {/* Comissão */}
                  <div className="text-right min-w-[7rem]">
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{brl(inf.comissaoAcumulada)}</p>
                    <p className="text-[10px] text-gray-400">acumulada · ~{brl(inf.recorrenteEstMes)}/mês</p>
                  </div>
                </div>
                {/* Uso real (contrapartida) */}
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>Último login: <b className="text-gray-700 dark:text-gray-200">{inf.diasSemLogin == null ? 'nunca' : inf.diasSemLogin === 0 ? 'hoje' : `${inf.diasSemLogin}d atrás`}</b></span>
                  <span>Dias ativos (30d): <b className="text-gray-700 dark:text-gray-200">{inf.diasAtivos30d}</b></span>
                  <span>Pedidos (30d): <b className="text-gray-700 dark:text-gray-200">{inf.pedidos30d}</b> · total {inf.pedidosTotal}</span>
                  <span>Produtos: <b className="text-gray-700 dark:text-gray-200">{inf.produtos}</b></span>
                </div>
              </Card>
            )
          })}
        </div>

        <p className="text-[11px] text-gray-400 mt-4">Read-only. Ações de cortesia/comissão em <a href="/master/parceiros" className="underline">Parceiros</a>. Uso real = do workspace da própria influenciadora (contrapartida).</p>
      </div>
    </div>
  )
}
