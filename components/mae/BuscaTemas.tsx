'use client'
// Lote 13 (item 181): BUSCA RÁPIDA DE TEMA — um campo "Buscar tema…" com até 8 cartões (miniatura da arte, nome numa
// linha, base e "editado há…"); ↑↓ navega, Enter abre, Esc fecha; vazio = os 5 recentes; "só desta base". O mesmo
// componente em todo lugar que escolhe tema (abrir tema / Ctrl+O, vincular tema e tema do pedido na edição em massa).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, LayoutGrid } from 'lucide-react'
import type { DocTema } from '@/lib/mae/schema'
import { buscarTemas, editadoHa, recentesTemas } from '@/lib/mae/editor/buscaTemas'
import { miniaturaDaParte } from '@/lib/mae/vinculo/resolver'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { motorDaPagina, garantirArquivos } from './motorEditor'
import { sync } from './sincronia'

export interface TemaBusca { id: string; name: string; baseId?: string | null; baseNome?: string | null; arquivado?: boolean; doc?: DocTema; editadoEm?: string | null }

// "editado há…": a data da nuvem (uma leitura por minuto, para todos os campos de busca da tela)
let datas: { em: number; mapa: Map<string, string> } | null = null
async function datasDosTemas(): Promise<Map<string, string>> {
  if (datas && Date.now() - datas.em < 60_000) return datas.mapa
  const l = (await sync.listarTemas()) as unknown as { id: string; atualizado_em?: string }[]
  datas = { em: Date.now(), mapa: new Map(l.filter(t => t.atualizado_em).map(t => [t.id, t.atualizado_em!])) }
  return datas.mapa
}

// miniatura da 1ª caixa com arte (desenhada pelo motor uma vez por versão do tema)
const miniaturas = new Map<string, Promise<string | null>>()
function miniaturaDe(raiz: FileSystemDirectoryHandle | null, t: DocTema): Promise<string | null> {
  const k = `${t.id}:${t.version}`
  let p = miniaturas.get(k)
  if (!p) {
    p = (async () => {
      const parte = Object.entries(t.partContent ?? {}).find(([, l]) => l.length)?.[0]
      if (!parte) return null
      const pr = miniaturaDaParte({ partContent: { [parte]: t.partContent[parte] } } as unknown as DocTema, parte, 1.4, 30)
      await garantirArquivos(pr as never, raiz)
      const r = await motorDaPagina().render(pr as never, 1.6, '#ffffff', 'bitmap')
      if (!r.bitmap) return null
      const c = document.createElement('canvas'); c.width = r.bitmap.width; c.height = r.bitmap.height
      c.getContext('2d')!.drawImage(r.bitmap, 0, 0); r.bitmap.close()
      return c.toDataURL('image/jpeg', 0.8)
    })().catch(() => null)
    miniaturas.set(k, p)
  }
  return p
}
/** A miniatura do tema (a 1ª caixa com arte); sem o arquivo do tema neste computador, a inicial do nome. */
export function MiniaturaTema({ doc, nome, grande }: { doc?: DocTema; nome?: string; grande?: boolean }) {
  const raiz = useBiblioteca(s => s.raiz)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let vivo = true; if (doc) void miniaturaDe(raiz, doc).then(u => { if (vivo) setUrl(u) }); return () => { vivo = false } }, [doc, raiz])
  const tam = grande ? 'h-24 w-full' : 'h-9 w-12 shrink-0'
  // eslint-disable-next-line @next/next/no-img-element -- miniatura gerada no navegador (data URL)
  return url ? <img src={url} alt="" className={`${tam} rounded border border-gray-200 bg-white object-contain`} />
    : <span className={`${tam} flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-bold text-gray-400`}>{(nome ?? doc?.name ?? '?').trim().charAt(0).toUpperCase()}</span>
}

export default function BuscaTemas({ temas, onEscolher, baseAtual, valor, placeholder = 'Buscar tema…', autoFocus, aberto: abertoInicial, onVerTodos, prioridade, compacto, onFechar, dataAttr = 'busca-temas' }: {
  temas: TemaBusca[]; onEscolher: (id: string) => void
  /** A base aberta: o botão "só desta base" começa ligado. */
  baseAtual?: { id: string; nome?: string } | null
  /** O tema escolhido agora (aparece no campo fechado). */
  valor?: string | null
  placeholder?: string; autoFocus?: boolean; aberto?: boolean
  onVerTodos?: () => void
  /** Temas que vão primeiro (ex.: os do produto do pedido). */
  prioridade?: string[]
  compacto?: boolean
  onFechar?: () => void
  dataAttr?: string
}) {
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(!!abertoInicial)
  const [i, setI] = useState(0)
  const [soBase, setSoBase] = useState(!!baseAtual)
  const [datasMapa, setDatasMapa] = useState<Map<string, string> | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const temBaseNaLista = !!baseAtual && temas.some(t => t.baseId === baseAtual.id)
  const resultado = useMemo(() => buscarTemas(temas, q, { recentes: recentesTemas(), baseId: baseAtual?.id, soDaBase: soBase && temBaseNaLista, prioridade }), [temas, q, baseAtual?.id, soBase, temBaseNaLista, prioridade])
  useEffect(() => { if (aberto && !datasMapa) void datasDosTemas().then(setDatasMapa).catch(() => null) }, [aberto, datasMapa])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) { setAberto(false); onFechar?.() } }
    document.addEventListener('mousedown', fora); return () => document.removeEventListener('mousedown', fora)
  }, [aberto, onFechar])
  const escolher = (id: string) => { setAberto(false); setQ(''); onEscolher(id) }
  const atual = valor ? temas.find(t => t.id === valor) : null
  return (
    <div ref={caixa} className={`relative ${compacto ? 'min-w-[12rem]' : 'w-full'}`} data-busca={dataAttr}>
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1.5 py-1 focus-within:border-orange-400 dark:border-gray-700 dark:bg-gray-800">
        <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input value={q} autoFocus={autoFocus} placeholder={atual && !aberto ? atual.name : placeholder} title={atual?.name}
          onFocus={() => setAberto(true)} onChange={e => { setQ(e.target.value); setI(0); setAberto(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(resultado.length - 1, x + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); const t = resultado[i]; if (t) escolher(t.id) }
            else if (e.key === 'Escape') { setAberto(false); setQ(''); onFechar?.(); (e.target as HTMLInputElement).blur() }
          }}
          className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${atual && !aberto ? 'placeholder:text-gray-800 dark:placeholder:text-gray-100' : ''}`} aria-label={placeholder} data-campo-busca-tema />
        {temBaseNaLista && <button type="button" className={`shrink-0 rounded px-1 text-[10px] ${soBase ? 'bg-orange-100 text-orange-800' : 'text-gray-400'}`} title={`Só os temas da base ${baseAtual?.nome ?? ''}`} onClick={() => setSoBase(v => !v)} data-so-desta-base>só desta base</button>}
      </div>
      {aberto && (
        <div className="absolute left-0 right-0 z-[60] mt-1 min-w-[18rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900" data-sugestoes-temas>
          {!q.trim() && <p className="px-2 pt-1.5 text-[10px] uppercase tracking-wide text-gray-400">Recentes</p>}
          {resultado.map((t, k) => (
            <button key={t.id} type="button" onMouseDown={e => e.preventDefault()} onMouseEnter={() => setI(k)} onClick={() => escolher(t.id)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${k === i ? 'bg-orange-50 dark:bg-orange-950/40' : ''}`} data-resultado-tema={t.name}>
              <MiniaturaTema doc={t.doc} nome={t.name} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-xs font-medium ${t.id === valor ? 'text-orange-700' : 'text-gray-900 dark:text-gray-100'}`} title={t.name}>{t.name}</span>
                <span className="block truncate text-[10px] text-gray-400">{[t.baseNome ? `base ${t.baseNome}` : '', editadoHa(datasMapa?.get(t.id) ?? t.editadoEm)].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
          {!resultado.length && <p className="px-2 py-2 text-xs text-gray-400">Nenhum tema com &ldquo;{q}&rdquo;{soBase && temBaseNaLista ? ' nesta base (desligue "só desta base")' : ''}.</p>}
          {onVerTodos && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setAberto(false); onVerTodos() }} className="flex w-full items-center gap-1 border-t border-gray-100 px-2 py-1.5 text-[11px] text-orange-700 hover:bg-orange-50 dark:border-gray-800" data-ver-todos-temas-grade><LayoutGrid className="h-3 w-3" /> Ver todos os temas</button>}
        </div>
      )}
    </div>
  )
}
