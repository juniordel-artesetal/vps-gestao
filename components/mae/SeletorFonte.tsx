'use client'
'use no memo'
// Lote 5 (item 54): LISTA DE FONTES com prévia no próprio formato — cada fonte escrita nela mesma com o nome de
// exemplo ("Ana Júlia") e o nome técnico pequeno embaixo; passar o mouse (ou ↑↓) mostra na arte, clicar confirma,
// sair sem clicar volta; busca e FAVORITAS (estrela) no topo; só as fontes visíveis carregam (são 500+).
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Star } from 'lucide-react'
import { GOOGLE_FONTS } from './fontesTexto'

export interface OpcaoFonte { valor: string; family: string; ps: string; style?: string; google?: string }
const CHAVE_FAV = 'mae:fontes-favoritas'
const lerFav = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_FAV) ?? '[]') } catch { return [] } }
const carregadasCss = new Set<string>()

/** Prévia da fonte Google no navegador (FontFace) — só quando a linha aparece na lista. */
function useFonteCss(o: OpcaoFonte, visivel: boolean) {
  const [, setV] = useState(0)
  useEffect(() => {
    if (!visivel || !o.google || carregadasCss.has(o.family)) return
    carregadasCss.add(o.family)
    const ff = new FontFace(o.family, `url(${o.google})`)
    ff.load().then(f => { document.fonts.add(f); setV(v => v + 1) }).catch(() => null)
  }, [visivel, o.google, o.family])
}

function Linha({ o, amostra, ativa, fav, onFav, onPassar, onEscolher }: { o: OpcaoFonte; amostra: string; ativa: boolean; fav: boolean; onFav: () => void; onPassar: () => void; onEscolher: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVisivel(true); io.disconnect() } })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useFonteCss(o, visivel)
  useEffect(() => { if (ativa) ref.current?.scrollIntoView({ block: 'nearest' }) }, [ativa])
  return (
    <div ref={ref} role="option" aria-selected={ativa} onMouseEnter={onPassar} onClick={onEscolher}
      className={`flex items-center gap-1 px-2 py-1 cursor-pointer ${ativa ? 'bg-orange-50 dark:bg-orange-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} data-opcao-fonte={o.ps}>
      <div className="flex-1 min-w-0">
        <div className="truncate text-lg leading-tight" style={visivel ? { fontFamily: `"${o.family}", sans-serif` } : undefined}>{amostra}</div>
        <div className="truncate text-[10px] text-gray-400">{o.family}{o.style && !/regular/i.test(o.style) ? ` ${o.style}` : ''}{o.google ? ' · Google' : ''}</div>
      </div>
      <button className={`p-1 ${fav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`} onClick={e => { e.stopPropagation(); onFav() }} aria-label={fav ? 'Tirar das favoritas' : 'Favoritar'} data-favoritar-fonte={o.ps}><Star className={`w-3.5 h-3.5 ${fav ? 'fill-current' : ''}`} /></button>
    </div>
  )
}

export default function SeletorFonte({ atual, locais, amostra, onPrevia, onEscolher }: {
  atual: { valor: string; family: string }
  locais: { ps: string; family: string; style?: string }[]
  amostra: string
  /** Prévia na arte enquanto passa o mouse/setas (null = voltar ao que estava). */
  onPrevia: (valor: string | null) => void
  onEscolher: (valor: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [fav, setFav] = useState<string[]>(() => lerFav())
  const [ativa, setAtiva] = useState(0)
  const [limite, setLimite] = useState(80)
  const opcoes = useMemo<OpcaoFonte[]>(() => [
    ...locais.map(l => ({ valor: `local|${l.ps}`, family: l.family, ps: l.ps, style: l.style })),
    ...GOOGLE_FONTS.map(g => ({ valor: `google|${g.ps}`, family: g.family, ps: g.ps, google: g.url })),
  ], [locais])
  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase()
    const l = b ? opcoes.filter(o => o.family.toLowerCase().includes(b) || o.ps.toLowerCase().includes(b)) : opcoes
    return [...l.filter(o => fav.includes(o.valor)), ...l.filter(o => !fav.includes(o.valor))]
  }, [opcoes, busca, fav])
  const visiveis = filtradas.slice(0, limite)
  const fechar = (confirmou: boolean) => { setAberto(false); if (!confirmou) onPrevia(null) }
  const passar = (i: number) => { setAtiva(i); const o = visiveis[i]; if (o) onPrevia(o.valor) }
  function alternarFav(v: string) { const n = fav.includes(v) ? fav.filter(x => x !== v) : [v, ...fav]; setFav(n); try { localStorage.setItem(CHAVE_FAV, JSON.stringify(n)) } catch { /* sem storage */ } }
  return (
    <div className="relative flex-1 min-w-0" data-seletor-fonte>
      <button className="flex w-full items-center gap-1 rounded border border-gray-200 bg-white dark:bg-gray-900 px-1.5 py-1 text-left text-xs" onClick={() => { setAberto(!aberto); setAtiva(0); setBusca('') }} data-fonte>
        <span className="flex-1 truncate">{atual.family}</span><ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {aberto && (
        <div className="absolute z-40 mt-1 w-[19rem] max-w-[80vw] rounded-lg border border-gray-200 bg-white dark:bg-gray-900 shadow-xl" onMouseLeave={() => onPrevia(null)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); passar(Math.min(visiveis.length - 1, ativa + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); passar(Math.max(0, ativa - 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); const o = visiveis[ativa]; if (o) { onEscolher(o.valor); fechar(true) } }
            else if (e.key === 'Escape') fechar(false)
          }}>
          <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-800 px-2 py-1">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input autoFocus value={busca} onChange={e => { setBusca(e.target.value); setAtiva(0); setLimite(80) }} placeholder="Buscar fonte… (↑↓ mostra na arte, Enter escolhe)" className="flex-1 bg-transparent text-xs outline-none" data-buscar-fonte />
            <button className="text-[10px] text-gray-400" onClick={() => fechar(false)}>fechar</button>
          </div>
          <div role="listbox" className="max-h-80 overflow-y-auto" onScroll={e => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight > el.scrollHeight - 80 && limite < filtradas.length) setLimite(l => l + 80) }}>
            {visiveis.map((o, i) => (
              <Linha key={o.valor} o={o} amostra={amostra || o.family} ativa={i === ativa} fav={fav.includes(o.valor)} onFav={() => alternarFav(o.valor)} onPassar={() => passar(i)} onEscolher={() => { onEscolher(o.valor); fechar(true) }} />
            ))}
            {!filtradas.length && <p className="p-2 text-[11px] text-gray-400">Nenhuma fonte com “{busca}”.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
