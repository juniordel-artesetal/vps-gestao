'use client'
// SOA Design — PAINEL DA FILA de mockups (flutuante, em qualquer página do SOA): total / concluídos / processando /
// pendentes / erros, baixar ZIP ou um por um, tentar de novo, cancelar pendentes, ver o erro. Some quando não há job.
import { useState, useSyncExternalStore } from 'react'
import { Loader2, Download, RotateCcw, XCircle, CheckCircle2, ChevronDown, ChevronUp, X, Ban, Layers } from 'lucide-react'
import { assinar, listarJobs, resumo, baixarZip, baixarItem, cancelarPendentes, tentarDeNovo, removerJob, type JobFila } from '@/lib/estudio/filaMockups'

const semJobs: JobFila[] = []
export default function FilaMockups() {
  const jobs = useSyncExternalStore(assinar, listarJobs, () => semJobs)
  const [aberto, setAberto] = useState(true)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  if (!jobs.length) return null
  const rs = jobs.map(resumo)
  const ativos = rs.reduce((s, r) => s + r.pendente + r.processando, 0)
  const feitos = rs.reduce((s, r) => s + r.concluido, 0), total = rs.reduce((s, r) => s + r.total, 0)
  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl text-sm" data-fila-mockups>
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center gap-2 px-3 py-2">
        {ativos ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : <Layers className="w-4 h-4 text-orange-500" />}
        <span className="flex-1 text-left font-semibold">Fila de mockups <span className="font-normal text-gray-500">{feitos}/{total}{ativos ? ' · gerando…' : ''}</span></span>
        {aberto ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>
      {aberto && (
        <div className="px-3 pb-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {jobs.map((j, k) => {
            const r = rs[k], pct = Math.round(((r.concluido + r.falhou + r.cancelado) / Math.max(1, r.total)) * 100)
            const ver = detalhe === j.id
            return (
              <div key={j.id} className="space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-2 first:border-0 first:pt-0" data-job={j.nome}>
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-medium truncate" title={j.nome}>{j.nome}</p>
                  <button onClick={() => removerJob(j.id)} title="Fechar (cancela o que falta)"><X className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-full bg-orange-500 transition-[width]" style={{ width: `${pct}%` }} /></div>
                <p className="text-[11px] text-gray-500 tabular-nums" data-resumo-job>
                  {r.total} no total · <b className="text-emerald-700">{r.concluido} prontos</b>{r.doCache ? ` (${r.doCache} do cache)` : ''} · {r.processando} gerando · {r.pendente} na fila{r.falhou ? <> · <b className="text-red-600">{r.falhou} com erro</b></> : null}{r.cancelado ? ` · ${r.cancelado} cancelados` : ''}
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {!!r.concluido && <button onClick={() => baixarZip(j.id)} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 text-white px-2 py-1 font-semibold" data-baixar-zip><Download className="w-3.5 h-3.5" /> Baixar ZIP ({r.concluido})</button>}
                  {!!(r.falhou || r.cancelado) && <button onClick={() => tentarDeNovo(j.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1" data-retry><RotateCcw className="w-3.5 h-3.5" /> Tentar de novo ({r.falhou + r.cancelado})</button>}
                  {!!r.pendente && <button onClick={() => cancelarPendentes(j.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1" data-cancelar><Ban className="w-3.5 h-3.5" /> Cancelar pendentes</button>}
                  <button onClick={() => setDetalhe(ver ? null : j.id)} className="text-gray-500 hover:text-orange-600 px-1">{ver ? 'esconder' : 'ver itens'}</button>
                </div>
                {ver && (
                  <div className="space-y-0.5 text-[11px] max-h-52 overflow-y-auto">
                    {j.itens.map(i => (
                      <div key={i.id} className="flex items-center gap-1.5" data-item-job={i.estado}>
                        {i.estado === 'concluido' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : i.estado === 'falhou' ? <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" /> : i.estado === 'processando' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500 shrink-0" /> : <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${i.estado === 'cancelado' ? 'border-gray-300 bg-gray-100' : 'border-gray-300'}`} />}
                        <span className="truncate flex-1" title={i.erro || i.arquivo}>{i.rotulo}{i.erro ? <span className="text-red-600"> — {i.erro}</span> : null}</span>
                        {i.estado === 'concluido' && <button onClick={() => baixarItem(j.id, i.id)} title="Baixar"><Download className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>}
                        {i.estado === 'falhou' && <button onClick={() => tentarDeNovo(j.id, i.id)} title="Tentar de novo"><RotateCcw className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
