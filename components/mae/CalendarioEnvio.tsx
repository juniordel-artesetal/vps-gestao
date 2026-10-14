'use client'
// Lote 13 (item 182): "+ DATA DE ENVIO" — calendário da data limite de postagem (SOA/Shopee): um dia ou um período
// (clica no início e no fim), com a QUANTIDADE de pedidos em cada dia (ver os picos e planejar a semana). Os atalhos
// (Despacha hoje, Até amanhã, Atrasados, Esta semana, Próximos 7 dias) marcam o período. O filtro guarda a data RELATIVA.
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react'
import { diasEntre, periodoEnvio, presetEnvio, type Filtros } from '@/lib/mae/pedidos/filtros'

type Envio = NonNullable<Filtros['envio']>
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

export function rotuloEnvio(e: Envio, hoje: string): string {
  if (e.rotulo) return e.rotulo
  const { de, ate } = periodoEnvio(e, hoje)
  return de === ate ? `Envio ${dm(de)}` : `Envio ${dm(de)} a ${dm(ate)}`
}

export default function CalendarioEnvio({ valor, hoje, contagem, onMudar }: { valor: Envio | null | undefined; hoje: string; contagem: Record<string, number>; onMudar: (e: Envio | null) => void }) {
  const [aberto, setAberto] = useState(false)
  const [mes, setMes] = useState(() => { const [y, m] = hoje.split('-').map(Number); return { y, m: m - 1 } })
  const [inicio, setInicio] = useState<string | null>(null)
  // fecha ao clicar fora ou no Esc (não cobre a lista)
  const caixa = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])
  const sel = valor ? periodoEnvio(valor, hoje) : null
  const primeiro = new Date(mes.y, mes.m, 1).getDay()
  const dias = new Date(mes.y, mes.m + 1, 0).getDate()
  const maxCont = Math.max(1, ...Object.values(contagem))
  const clicar = (d: string) => {
    if (!inicio) { setInicio(d); onMudar({ de: diasEntre(hoje, d), ate: diasEntre(hoje, d) }); return }
    const [a, b] = d < inicio ? [d, inicio] : [inicio, d]
    onMudar({ de: diasEntre(hoje, a), ate: diasEntre(hoje, b) }); setInicio(null)
  }
  const preset = (q: Parameters<typeof presetEnvio>[0]) => { onMudar(presetEnvio(q, hoje)); setInicio(null) }
  const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]'
  return (
    <span ref={caixa} className="relative inline-flex items-center gap-1" data-calendario-envio>
      {valor
        ? <button className={`${chip} border-orange-500 bg-orange-500 text-white`} onClick={() => setAberto(a => !a)} data-chip-envio-ativo>{rotuloEnvio(valor, hoje)}<X className="h-3 w-3" onClick={e => { e.stopPropagation(); onMudar(null); setAberto(false) }} /></button>
        : <button className={`${chip} border-dashed border-gray-300 text-gray-600 hover:border-orange-400 dark:border-gray-600`} onClick={() => setAberto(a => !a)} data-chip-data-envio><CalendarDays className="h-3 w-3" /> + Data de envio</button>}
      {aberto && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 space-y-2 rounded-xl border border-gray-200 bg-white p-2 text-xs shadow-xl dark:border-gray-700 dark:bg-gray-900" data-popover-envio>
          <div className="flex flex-wrap gap-1">
            {([['hoje', 'Despacha hoje'], ['amanha', 'Até amanhã'], ['atrasados', 'Atrasados'], ['semana', 'Esta semana'], ['7dias', 'Próximos 7 dias']] as const).map(([q, r]) => (
              <button key={q} className={`${chip} border-gray-200 hover:border-orange-400 dark:border-gray-700`} onClick={() => preset(q)} data-preset-envio={q}>{r}</button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => setMes(m => (m.m === 0 ? { y: m.y - 1, m: 11 } : { y: m.y, m: m.m - 1 }))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
            <b className="capitalize">{MESES[mes.m]} {mes.y}</b>
            <button onClick={() => setMes(m => (m.m === 11 ? { y: m.y + 1, m: 0 } : { y: m.y, m: m.m + 1 }))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-400">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: primeiro }, (_, i) => <span key={`v${i}`} />)}
            {Array.from({ length: dias }, (_, i) => {
              const d = iso(mes.y, mes.m, i + 1), n = contagem[d] ?? 0
              const noPeriodo = !!sel && d >= sel.de && d <= sel.ate
              const ehHoje = d === hoje
              return (
                <button key={d} onClick={() => clicar(d)} title={`${dm(d)}: ${n} pedido${n === 1 ? '' : 's'}`}
                  className={`flex h-9 flex-col items-center justify-center rounded ${noPeriodo ? 'bg-orange-500 text-white' : d < hoje ? 'text-gray-400' : 'hover:bg-orange-50'} ${ehHoje && !noPeriodo ? 'ring-1 ring-orange-400' : ''} ${inicio === d ? 'ring-2 ring-orange-600' : ''}`} data-dia-envio={d}>
                  <span className="leading-none">{i + 1}</span>
                  {n > 0 && <span className={`mt-0.5 rounded px-1 text-[9px] leading-tight ${noPeriodo ? 'bg-white/25' : n >= maxCont * 0.6 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`} data-contagem-dia>{n}</span>}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-500">{inicio ? `Início ${dm(inicio)} — clique no último dia (ou no mesmo, para um dia só).` : 'Clique num dia, ou no primeiro e no último do período. "Salvar filtro" guarda o período a partir de hoje (não vence).'}</p>
          <div className="flex justify-between"><button className="text-[11px] text-gray-500 underline" onClick={() => { onMudar(null); setInicio(null) }}>Limpar data</button><button className="text-[11px] text-orange-700" onClick={() => setAberto(false)}>Fechar</button></div>
        </div>
      )}
    </span>
  )
}
