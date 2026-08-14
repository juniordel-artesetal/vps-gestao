'use client'
// Painel-resumo da home /pessoal: KPIs + Finanças + Tarefas + Notas numa chamada (/api/pessoal/resumo-geral).
// Cada bloco é atalho pro módulo completo. Estados vazios elegantes. Escopo por userId (server).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ListChecks, StickyNote, Paperclip, Pin, ChevronRight, CalendarDays } from 'lucide-react'

const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const brDia = (s?: string) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}` }
const PRIO: Record<string, string> = { ALTA: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400', MEDIA: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', BAIXA: 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400' }

interface Dados {
  kpis: { saldoTotal: number; receitasMes: number; despesasMes: number; guardadoCaixinhas: number; tarefasPendentes: number; tarefasAtrasadas: number }
  financas: {
    saldoPorConta: { id: string; nome: string; cor?: string; saldo: number }[]
    catDespesa: { nome: string; cor: string; icone: string; total: number }[]
    caixinhas: { id: string; nome: string; cor?: string; meta: number | null; saldo: number }[]
    ultimos: { id: string; tipo: string; descricao: string; valor: number; data: string; status: string; temComprovante: boolean; categoriaNome?: string; categoriaIcone?: string }[]
  }
  tarefas: { contadores: { hoje: number; pendentes: number; atrasadas: number; concluidasMes: number }; lista: { id: string; titulo: string; prazo?: string; prioridade: string; status: string; atrasada: boolean }[] }
  notas: { id: string; titulo?: string; trecho?: string; cor?: string; fixada: boolean; temImagem: boolean }[]
}

function Pizza({ dados }: { dados: { nome: string; cor: string; icone: string; total: number }[] }) {
  const total = dados.reduce((s, d) => s + d.total, 0)
  if (total <= 0) return null
  let acc = 0
  const stops = dados.map(d => { const ini = (acc / total) * 100; acc += d.total; return `${d.cor} ${ini}% ${(acc / total) * 100}%` }).join(', ')
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 h-20 rounded-full flex-shrink-0" style={{ background: `conic-gradient(${stops})` }} />
      <div className="flex-1 space-y-0.5 min-w-0">
        {dados.slice(0, 4).map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.cor }} /><span className="truncate text-gray-600 dark:text-neutral-300">{d.icone} {d.nome}</span><span className="ml-auto tabular-nums text-gray-400">{fmt(d.total)}</span></div>
        ))}
      </div>
    </div>
  )
}

const card = 'block rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:shadow-md hover:border-orange-200 dark:hover:border-orange-800 transition'
const CabecBloco = ({ icon: Icon, titulo, cor }: { icon: any; titulo: string; cor: string }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2"><span className={`w-7 h-7 rounded-lg flex items-center justify-center ${cor}`}><Icon size={15} /></span><h3 className="font-semibold text-gray-800 dark:text-neutral-100 text-sm">{titulo}</h3></div>
    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition" />
  </div>
)

export default function ResumoGeral() {
  const [d, setD] = useState<Dados | null>(null); const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/pessoal/resumo-geral').then(r => r.ok ? r.json() : null).then(setD).finally(() => setLoading(false)) }, [])

  if (loading) return <p className="text-gray-400 text-sm text-center py-6">Carregando seu resumo…</p>
  if (!d) return null

  const k = d.kpis
  const KPIS = [
    { l: 'Saldo total', v: fmt(k.saldoTotal), cls: k.saldoTotal >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-red-600', ico: Wallet, ic: 'text-indigo-500' },
    { l: 'Receitas do mês', v: fmt(k.receitasMes), cls: 'text-green-700 dark:text-green-400', ico: TrendingUp, ic: 'text-green-500' },
    { l: 'Despesas do mês', v: fmt(k.despesasMes), cls: 'text-red-700 dark:text-red-400', ico: TrendingDown, ic: 'text-red-500' },
    { l: 'Nas caixinhas', v: fmt(k.guardadoCaixinhas), cls: 'text-purple-700 dark:text-purple-300', ico: PiggyBank, ic: 'text-purple-500' },
    { l: 'Tarefas pendentes', v: String(k.tarefasPendentes), cls: 'text-gray-800 dark:text-neutral-100', ico: ListChecks, ic: 'text-sky-500', extra: k.tarefasAtrasadas > 0 ? `${k.tarefasAtrasadas} atrasada${k.tarefasAtrasadas > 1 ? 's' : ''}` : '' },
  ]

  const fin = d.financas
  const semFinancas = fin.saldoPorConta.length === 0 && fin.ultimos.length === 0 && fin.caixinhas.length === 0
  const tc = d.tarefas.contadores

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">Seu resumo</h2><div className="flex-1 h-px bg-gray-100 dark:bg-neutral-800" /></div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {KPIS.map((x, i) => {
          const Icon = x.ico
          return (
            <div key={i} className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
              <div className={`flex items-center gap-1.5 text-[11px] font-medium ${x.ic}`}><Icon className="w-3.5 h-3.5" /> {x.l}</div>
              <p className={`text-lg font-bold mt-1 tabular-nums ${x.cls}`}>{x.v}</p>
              {x.extra && <p className="text-[10px] text-red-500 font-medium">{x.extra}</p>}
            </div>
          )
        })}
      </div>

      {/* FINANÇAS */}
      <Link href="/pessoal/financeiro" className={card + ' group'}>
        <CabecBloco icon={Wallet} titulo="Finanças" cor="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" />
        {semFinancas ? (
          <p className="text-sm text-gray-400 py-4 text-center">Comece lançando seu primeiro gasto ou receita. 💸</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {fin.catDespesa.length > 0 && (<div><p className="text-[11px] text-gray-400 mb-1.5">Gastos por categoria (mês)</p><Pizza dados={fin.catDespesa} /></div>)}
              {fin.saldoPorConta.length > 0 && (
                <div><p className="text-[11px] text-gray-400 mb-1.5">Saldo por conta</p>
                  <div className="space-y-1">{fin.saldoPorConta.slice(0, 4).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.cor || '#6366f1' }} /><span className="truncate text-gray-600 dark:text-neutral-300">{c.nome}</span><span className={`ml-auto tabular-nums font-medium ${c.saldo >= 0 ? 'text-gray-700 dark:text-neutral-200' : 'text-red-600'}`}>{fmt(c.saldo)}</span></div>
                  ))}</div>
                </div>
              )}
              {fin.caixinhas.length > 0 && (
                <div><p className="text-[11px] text-gray-400 mb-1.5">Caixinhas</p>
                  <div className="space-y-1.5">{fin.caixinhas.slice(0, 3).map(c => {
                    const pct = c.meta && c.meta > 0 ? Math.min(100, Math.round((c.saldo / c.meta) * 100)) : 0
                    return (
                      <div key={c.id}>
                        <div className="flex items-center gap-2 text-xs"><PiggyBank className="w-3 h-3" style={{ color: c.cor || '#8b5cf6' }} /><span className="truncate text-gray-600 dark:text-neutral-300">{c.nome}</span><span className="ml-auto tabular-nums text-gray-500">{fmt(c.saldo)}</span></div>
                        {c.meta && c.meta > 0 ? <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden mt-0.5"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.cor || '#8b5cf6' }} /></div> : null}
                      </div>
                    )
                  })}</div>
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-1.5">Últimos lançamentos</p>
              {fin.ultimos.length === 0 ? <p className="text-xs text-gray-400 py-2">Nada ainda.</p> : (
                <div className="divide-y divide-gray-50 dark:divide-neutral-800">
                  {fin.ultimos.map(l => (
                    <div key={l.id} className="flex items-center gap-2 py-1.5 text-xs">
                      <span className="text-gray-400 w-8">{brDia(l.data)}</span>
                      <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-neutral-200">{l.categoriaIcone || ''} {l.descricao}</span>
                      {l.temComprovante && <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                      <span className={`tabular-nums font-medium ${l.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{l.tipo === 'RECEITA' ? '+' : '−'}{fmt(l.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TAREFAS */}
        <Link href="/pessoal/tarefas" className={card + ' group'}>
          <CabecBloco icon={ListChecks} titulo="Tarefas" cor="bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400" />
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            {[['Hoje', tc.hoje, 'text-sky-600'], ['Pendentes', tc.pendentes, 'text-gray-700 dark:text-neutral-200'], ['Atrasadas', tc.atrasadas, tc.atrasadas > 0 ? 'text-red-600' : 'text-gray-400'], ['Feitas/mês', tc.concluidasMes, 'text-emerald-600']].map(([l, v, cls], i) => (
              <div key={i} className="rounded-lg bg-gray-50 dark:bg-neutral-800/50 py-1.5"><p className={`text-base font-bold ${cls as string}`}>{v as number}</p><p className="text-[9px] text-gray-400">{l as string}</p></div>
            ))}
          </div>
          {d.tarefas.lista.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">Sem tarefas pra hoje 🎉</p>
          ) : (
            <div className="space-y-1.5">
              {d.tarefas.lista.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status === 'EM_ANDAMENTO' ? 'bg-blue-400' : 'bg-gray-300'}`} />
                  <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-neutral-200">{t.titulo}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${PRIO[t.prioridade] || PRIO.BAIXA}`}>{t.prioridade === 'ALTA' ? 'Alta' : t.prioridade === 'MEDIA' ? 'Média' : 'Baixa'}</span>
                  {t.prazo && <span className={`text-[10px] flex items-center gap-0.5 ${t.atrasada ? 'text-red-500 font-medium' : 'text-gray-400'}`}><CalendarDays className="w-2.5 h-2.5" />{brDia(t.prazo)}</span>}
                </div>
              ))}
            </div>
          )}
        </Link>

        {/* NOTAS */}
        <Link href="/pessoal/notas" className={card + ' group'}>
          <CabecBloco icon={StickyNote} titulo="Notas" cor="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" />
          {d.notas.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">Nenhuma nota ainda. Anote sua primeira ideia. 📝</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {d.notas.slice(0, 4).map(n => (
                <div key={n.id} className="rounded-xl border border-gray-100 dark:border-neutral-800 p-2.5 min-h-[64px]" style={{ background: n.cor && n.cor !== '#ffffff' ? n.cor + '55' : undefined }}>
                  <div className="flex items-center gap-1">{n.fixada && <Pin className="w-3 h-3 text-orange-500 flex-shrink-0" fill="currentColor" />}<p className="text-xs font-semibold text-gray-800 dark:text-neutral-100 truncate">{n.titulo || 'Sem título'}</p></div>
                  {n.trecho && <p className="text-[11px] text-gray-500 dark:text-neutral-400 line-clamp-2 mt-0.5">{n.trecho}</p>}
                </div>
              ))}
            </div>
          )}
        </Link>
      </div>
    </div>
  )
}
