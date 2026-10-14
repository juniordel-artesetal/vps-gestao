'use client'
'use no memo'
// Lote 13 (item 179): também no TROCAR LETRA (a letra grande, "Só fontes que têm ê", recentes).
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
function useFonteCss(o: OpcaoFonte, visivel: boolean): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!visivel || !o.google || carregadasCss.has(o.family)) return
    carregadasCss.add(o.family)
    const ff = new FontFace(o.family, `url(${o.google})`)
    ff.load().then(f => { document.fonts.add(f); setV(x => x + 1) }).catch(() => null)
  }, [visivel, o.google, o.family])
  return v
}

/**
 * Lote 13 (item 179): a fonte TEM a letra de verdade? — a mesma largura com dois fallbacks diferentes (a fonte é que
 * desenha) E com tinta (fonte DEMO declara o "ê" com o desenho vazio). Uma vez por fonte e letra.
 */
const cacheTem = new Map<string, boolean>()
export async function fonteTemLetra(family: string, letra: string): Promise<boolean> {
  const k = `${family}|${letra}`
  if (cacheTem.has(k)) return cacheTem.get(k)!
  try { await document.fonts.load(`40px "${family}"`, letra) } catch { /* fonte do computador: o navegador acha pelo nome */ }
  const c = new OffscreenCanvas(72, 72), g = c.getContext('2d')!
  const larg = (fb: string) => { g.font = `40px "${family}", ${fb}`; return g.measureText(letra).width }
  const daFonte = Math.abs(larg('monospace') - larg('serif')) < 0.01
  g.font = `40px "${family}", monospace`; g.clearRect(0, 0, 72, 72); g.fillStyle = '#000'; g.fillText(letra, 10, 52)
  const d = g.getImageData(0, 0, 72, 72).data
  let tinta = false
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { tinta = true; break }
  const r = daFonte && tinta
  cacheTem.set(k, r)
  return r
}
const CHAVE_REC = 'mae:fontes-recentes'
const lerRec = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_REC) ?? '[]') } catch { return [] } }
const lembrarRec = (v: string) => { try { localStorage.setItem(CHAVE_REC, JSON.stringify([v, ...lerRec().filter(x => x !== v)].slice(0, 8))) } catch { /* sem storage */ } }

function Linha({ o, amostra, sub, letra, soComLetra, ativa, fav, onFav, onPassar, onEscolher }: { o: OpcaoFonte; amostra: string; sub?: string; letra?: string; soComLetra?: boolean; ativa: boolean; fav: boolean; onFav: () => void; onPassar: () => void; onEscolher: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVisivel(true); io.disconnect() } })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const pronta = useFonteCss(o, visivel)
  useEffect(() => { if (ativa) ref.current?.scrollIntoView({ block: 'nearest' }) }, [ativa])
  // Lote 13 (item 179): "Só fontes que têm ê" — a linha some quando a fonte não tem a letra
  const [tem, setTem] = useState<boolean | null>(null)
  useEffect(() => { let vivo = true; if (visivel && letra && (!o.google || pronta)) void fonteTemLetra(o.family, letra).then(r => { if (vivo) setTem(r) }); return () => { vivo = false } }, [visivel, letra, o.family, o.google, pronta])
  if (soComLetra && tem === false) return null
  return (
    <div ref={ref} role="option" aria-selected={ativa} onMouseEnter={onPassar} onClick={onEscolher}
      className={`flex items-center gap-1 px-2 py-1 cursor-pointer ${ativa ? 'bg-orange-50 dark:bg-orange-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} data-opcao-fonte={o.ps}>
      {/* Lote 13 (item 179): no Trocar letra, a própria letra grande e o nome do pedido pequeno ao lado */}
      {letra && <div className="w-9 shrink-0 text-center text-3xl leading-none" style={visivel ? { fontFamily: `"${o.family}", sans-serif` } : undefined} data-letra-fonte>{letra}</div>}
      <div className="flex-1 min-w-0">
        <div className={`truncate leading-tight ${letra ? 'text-sm' : 'text-lg'}`} style={visivel ? { fontFamily: `"${o.family}", sans-serif` } : undefined}>{amostra}</div>
        <div className="truncate text-[10px] text-gray-400">{o.family}{o.style && !/regular/i.test(o.style) ? ` ${o.style}` : ''}{o.google ? ' · Google' : ''}{sub ? ` · ${sub}` : ''}{letra && tem === false ? ' · sem esta letra' : ''}</div>
      </div>
      <button className={`p-1 ${fav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`} onClick={e => { e.stopPropagation(); onFav() }} aria-label={fav ? 'Tirar das favoritas' : 'Favoritar'} data-favoritar-fonte={o.ps}><Star className={`w-3.5 h-3.5 ${fav ? 'fill-current' : ''}`} /></button>
    </div>
  )
}

export default function SeletorFonte({ atual, locais, amostra, onPrevia, onEscolher, letra, extras, placeholder }: {
  atual: { valor: string; family: string }
  locais: { ps: string; family: string; style?: string }[]
  amostra: string
  /** Lote 13 (item 179): Trocar letra — a letra grande em cada fonte e "Só fontes que têm ê" (ligado). */
  letra?: string
  /** Opções fixas no topo (ex.: "— voltar à do tema —"). */
  extras?: { valor: string; rotulo: string }[]
  placeholder?: string
  /** Prévia na arte enquanto passa o mouse/setas (null = voltar ao que estava). */
  onPrevia: (valor: string | null) => void
  onEscolher: (valor: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [fav, setFav] = useState<string[]>(() => lerFav())
  const [ativa, setAtiva] = useState(0)
  const [limite, setLimite] = useState(80)
  const [soComLetra, setSoComLetra] = useState(true)
  const rec = useMemo(() => (aberto ? lerRec() : []), [aberto])
  const opcoes = useMemo<OpcaoFonte[]>(() => [
    ...locais.map(l => ({ valor: `local|${l.ps}`, family: l.family, ps: l.ps, style: l.style })),
    ...GOOGLE_FONTS.map(g => ({ valor: `google|${g.ps}`, family: g.family, ps: g.ps, google: g.url })),
  ], [locais])
  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase()
    const l = b ? opcoes.filter(o => o.family.toLowerCase().includes(b) || o.ps.toLowerCase().includes(b)) : opcoes
    // favoritas, depois as RECENTES (Lote 13, item 179), depois o resto
    const pos = (o: OpcaoFonte) => (fav.includes(o.valor) ? 0 : rec.includes(o.valor) ? 1 + rec.indexOf(o.valor) / 10 : 2)
    return [...l].sort((a, b) => pos(a) - pos(b))
  }, [opcoes, busca, fav, rec])
  const visiveis = filtradas.slice(0, limite)
  const fechar = (confirmou: boolean) => { setAberto(false); if (!confirmou) onPrevia(null) }
  const passar = (i: number) => { setAtiva(i); const o = visiveis[i]; if (o) onPrevia(o.valor) }
  function alternarFav(v: string) { const n = fav.includes(v) ? fav.filter(x => x !== v) : [v, ...fav]; setFav(n); try { localStorage.setItem(CHAVE_FAV, JSON.stringify(n)) } catch { /* sem storage */ } }
  return (
    <div className="relative flex-1 min-w-0" data-seletor-fonte>
      <button className="flex w-full items-center gap-1 rounded border border-gray-200 bg-white dark:bg-gray-900 px-1.5 py-1 text-left text-xs" onClick={() => { setAberto(!aberto); setAtiva(0); setBusca('') }} data-fonte>
        <span className={`flex-1 truncate ${atual.family ? '' : 'text-gray-400'}`}>{atual.family || placeholder || 'Escolher a fonte…'}</span><ChevronDown className="w-3 h-3 text-gray-400" />
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
          {letra && <label className="flex items-center gap-1 border-b border-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:border-gray-800" data-so-com-letra><input type="checkbox" className="accent-orange-500" checked={soComLetra} onChange={e => setSoComLetra(e.target.checked)} /> Só fontes que têm &ldquo;{letra}&rdquo;</label>}
          {extras?.map(x => <button key={x.valor} className="block w-full border-b border-gray-100 px-2 py-1 text-left text-[11px] text-gray-600 hover:bg-gray-50 dark:border-gray-800" onClick={() => { onEscolher(x.valor); fechar(true) }} data-extra-fonte={x.valor}>{x.rotulo}</button>)}
          <div role="listbox" className="max-h-80 overflow-y-auto" onScroll={e => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight > el.scrollHeight - 80 && limite < filtradas.length) setLimite(l => l + 80) }}>
            {visiveis.map((o, i) => (
              <Linha key={o.valor} o={o} amostra={amostra || o.family} letra={letra} soComLetra={!!letra && soComLetra} sub={rec.includes(o.valor) && !fav.includes(o.valor) ? 'recente' : undefined} ativa={i === ativa} fav={fav.includes(o.valor)} onFav={() => alternarFav(o.valor)} onPassar={() => passar(i)} onEscolher={() => { lembrarRec(o.valor); onEscolher(o.valor); fechar(true) }} />
            ))}
            {!filtradas.length && <p className="p-2 text-[11px] text-gray-400">Nenhuma fonte com “{busca}”.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
