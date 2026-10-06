'use client'
'use no memo'
// ESTILOS DE CAMADA (Sprint 8) — para texto e qualquer camada: lista empilhável, ligar/desligar, ordem,
// editar cada efeito, copiar e colar estilo, e PRESETS (só os efeitos, nunca a fonte): biblioteca
// privada da conta (Neon) e Loja da Naty (prévia em fonte grátis + "Testar com minha fonte").
import Deslizador from './Deslizador'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, ClipboardPaste, Eye, EyeOff, Save, Sparkles, Pencil } from 'lucide-react'
import { Efeito, NOMES_EFEITO, efeitoPadrao, limparEfeitos, type TipoEfeito } from '@/lib/mae/schema/efeitos'
import { PRESETS_NATY, presetDeEfeitos, efeitosDoPreset, type Preset } from '@/lib/mae/efeitos/presets'
import { noDoTexto, ESTILO_PADRAO, type EstiloTexto } from '@/lib/mae/texto/noTexto'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render'
import { criarCanvasOffscreen } from '@/lib/mae/render/protocolo'
import { registroFontes, useFontes, carregarSubstituta } from './fontesTexto'
import { sync } from './sincronia'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ico = 'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30'
type Ef = Efeito

/** Área de transferência de estilo (copiar/colar entre camadas). */
export const useAreaEstilo = create<{ efeitos: Ef[] | null }>()(() => ({ efeitos: null }))

/** Presets: os meus (nuvem; cópia local se offline) + Loja da Naty (embutidos + publicados na nuvem). */
interface EstadoPresets { meus: Preset[]; naty: Preset[]; carregado: boolean }
export const usePresets = create<EstadoPresets>()(() => ({ meus: [], naty: PRESETS_NATY, carregado: false }))
const LS = 'mae:presets'
export async function carregarPresets() {
  try {
    const r = await sync.presets.listar()
    const naty = [...PRESETS_NATY, ...r.naty.filter(p => !PRESETS_NATY.some(x => x.id === p.id))]
    usePresets.setState({ meus: r.meus, naty, carregado: true })
    try { localStorage.setItem(LS, JSON.stringify(r.meus)) } catch { /* */ }
  } catch {
    let meus: Preset[] = []
    try { meus = JSON.parse(localStorage.getItem(LS) || '[]') } catch { /* */ }
    usePresets.setState({ meus, carregado: true })
  }
}
function guardarLocal(meus: Preset[]) { usePresets.setState({ meus }); try { localStorage.setItem(LS, JSON.stringify(meus)) } catch { /* */ } }

/** Prévia de um preset: "Maria" na fonte grátis (ou na fonte da usuária), desenhada pelo MOTOR. */
const cachePrev = new Map<string, string>()
async function previa(efeitos: Ef[], estilo: EstiloTexto | null, texto = 'Maria'): Promise<string> {
  await carregarSubstituta()
  const est = { ...(estilo ?? ESTILO_PADRAO), color: '#475569', effects: efeitos }
  const chave = JSON.stringify([efeitos, est.font.postscriptName, texto])
  const ja = cachePrev.get(chave); if (ja) return ja
  const r = noDoTexto({ slotId: 'prev', variavel: 'NOME', valor: texto, estilo: est as EstiloTexto, fontes: registroFontes, quadro: [60, 0, 0, 22, 0, 0], w: 60, h: 22, caixa: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 }, cfg: { single: { lines: 1, sizePt: 40 }, autoFit: { minScale: 0.4 } } })
  if (!r) return ''
  const p = { id: 'prev', widthMm: 60, heightMm: 22, layers: [r.no] }
  const { w, h } = tamanhoDoCanvas(p, 4)
  const c = criarCanvasOffscreen(w, h) as unknown as OffscreenCanvas
  renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: 4, fundo: '#ffffff', criarCanvas: criarCanvasOffscreen, bitmap: () => undefined })
  const blob = await c.convertToBlob({ type: 'image/png' })
  const url = URL.createObjectURL(blob)
  cachePrev.set(chave, url)
  return url
}
function Previa({ efeitos, estilo }: { efeitos: Ef[]; estilo: EstiloTexto | null }) {
  const [url, setUrl] = useState('')
  const v = useFontes(s => s.versao)
  useEffect(() => { let vivo = true; previa(efeitos, estilo).then(u => { if (vivo) setUrl(u) }); return () => { vivo = false } }, [efeitos, estilo, v])
  // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), desenhada pelo motor
  return url ? <img src={url} alt="" className="h-9 w-auto rounded border border-gray-100 bg-white" /> : <span className="h-9 w-24 rounded bg-gray-100" />
}

// ── campos ───────────────────────────────────────────────────────────────────────────────────────
let seq = 0
function Num({ rotulo, valor, min, max, passo, sufixo = '', escala = 1, onMudar }: { rotulo: string; valor: number; min: number; max: number; passo: number; sufixo?: string; escala?: number; onMudar: (v: number, juntar: string) => void }) {
  const id = useRef(0)
  return (
    <label className="block text-[10px] text-gray-500">
      <span>{rotulo}</span>
      <Deslizador min={min} max={max} step={passo} value={valor} onPointerDown={() => { id.current = ++seq }} onChange={e => onMudar(Number(e.target.value), `n${id.current}`)} unidade={sufixo.trim()} fator={escala} className="h-3 accent-orange-500" aria-label={rotulo} />
    </label>
  )
}
const CorIn = ({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) => <input type="color" value={valor} onChange={e => onMudar(e.target.value)} className="w-7 h-6 rounded border border-gray-200" />

function CamposEfeito({ e, mudar }: { e: Ef; mudar: (p: Partial<Ef>, juntar?: string) => void }) {
  const op = <Num rotulo="Opacidade" valor={e.opacity} min={0} max={1} passo={0.01} escala={100} sufixo="%" onMudar={(v, j) => mudar({ opacity: v } as Partial<Ef>, j)} />
  switch (e.type) {
    case 'stroke': return (<div className="grid grid-cols-2 gap-x-2 gap-y-1">
      <Num rotulo="Tamanho" valor={e.sizeMm} min={0.05} max={5} passo={0.05} sufixo=" mm" onMudar={(v, j) => mudar({ sizeMm: v }, j)} />
      <label className="text-[10px] text-gray-500 flex items-center gap-1">Cor <CorIn valor={e.color} onMudar={v => mudar({ color: v })} />
        <select value={e.position} onChange={x => mudar({ position: x.target.value as 'outside' })} className="rounded border border-gray-200 bg-transparent text-[10px]"><option value="outside">fora</option><option value="center">centro</option><option value="inside">dentro</option></select></label>
      {op}</div>)
    case 'dropShadow': case 'innerShadow': return (<div className="grid grid-cols-2 gap-x-2 gap-y-1">
      <label className="text-[10px] text-gray-500 flex items-center gap-1">Cor <CorIn valor={e.color} onMudar={v => mudar({ color: v })} /></label>{op}
      <Num rotulo="Ângulo" valor={e.angleDeg} min={0} max={360} passo={1} sufixo="°" onMudar={(v, j) => mudar({ angleDeg: v }, j)} />
      <Num rotulo="Distância" valor={e.distanceMm} min={0} max={8} passo={0.05} sufixo=" mm" onMudar={(v, j) => mudar({ distanceMm: v }, j)} />
      <Num rotulo="Tamanho" valor={e.sizeMm} min={0} max={8} passo={0.05} sufixo=" mm" onMudar={(v, j) => mudar({ sizeMm: v }, j)} />
      <Num rotulo="Espalhar" valor={e.spread} min={0} max={1} passo={0.01} escala={100} sufixo="%" onMudar={(v, j) => mudar({ spread: v }, j)} /></div>)
    case 'outerGlow': return (<div className="grid grid-cols-2 gap-x-2 gap-y-1">
      <label className="text-[10px] text-gray-500 flex items-center gap-1">Cor <CorIn valor={e.color} onMudar={v => mudar({ color: v })} /></label>{op}
      <Num rotulo="Tamanho" valor={e.sizeMm} min={0} max={10} passo={0.05} sufixo=" mm" onMudar={(v, j) => mudar({ sizeMm: v }, j)} />
      <Num rotulo="Espalhar" valor={e.spread} min={0} max={1} passo={0.01} escala={100} sufixo="%" onMudar={(v, j) => mudar({ spread: v }, j)} /></div>)
    case 'innerGlow': return (<div className="grid grid-cols-2 gap-x-2 gap-y-1">
      <label className="text-[10px] text-gray-500 flex items-center gap-1">Cor <CorIn valor={e.color} onMudar={v => mudar({ color: v })} />
        <select value={e.source} onChange={x => mudar({ source: x.target.value as 'edge' })} className="rounded border border-gray-200 bg-transparent text-[10px]"><option value="edge">borda</option><option value="center">centro</option></select></label>{op}
      <Num rotulo="Tamanho" valor={e.sizeMm} min={0} max={8} passo={0.05} sufixo=" mm" onMudar={(v, j) => mudar({ sizeMm: v }, j)} /></div>)
    case 'bevel': return (<div className="grid grid-cols-2 gap-x-2 gap-y-1">
      <Num rotulo="Tamanho" valor={e.sizeMm} min={0.05} max={5} passo={0.05} sufixo=" mm" onMudar={(v, j) => mudar({ sizeMm: v }, j)} />
      <Num rotulo="Profundidade" valor={e.depth} min={0.1} max={3} passo={0.05} onMudar={(v, j) => mudar({ depth: v }, j)} />
      <Num rotulo="Ângulo da luz" valor={e.angleDeg} min={0} max={360} passo={1} sufixo="°" onMudar={(v, j) => mudar({ angleDeg: v }, j)} />
      <label className="text-[10px] text-gray-500 flex items-center gap-1">Realce <CorIn valor={e.highlightColor} onMudar={v => mudar({ highlightColor: v })} /> Sombra <CorIn valor={e.shadowColor} onMudar={v => mudar({ shadowColor: v })} /></label>
      <select value={e.style} onChange={x => mudar({ style: x.target.value as 'inner' })} className="rounded border border-gray-200 bg-transparent text-[10px]"><option value="inner">chanfro interno</option><option value="emboss">entalhe</option></select>{op}</div>)
    case 'colorOverlay': return (<div className="grid grid-cols-2 gap-x-2 gap-y-1"><label className="text-[10px] text-gray-500 flex items-center gap-1">Cor <CorIn valor={e.color} onMudar={v => mudar({ color: v })} /></label>{op}</div>)
    case 'gradientOverlay': return (<div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] text-gray-500">Cores {e.stops.map((s, i) => <CorIn key={i} valor={s.color} onMudar={v => mudar({ stops: e.stops.map((x, k) => (k === i ? { ...x, color: v } : x)) })} />)}
        <button className={ico} onClick={() => mudar({ stops: [...e.stops, { pos: 1, color: e.stops[e.stops.length - 1].color }].map((s, i, a) => ({ ...s, pos: i / (a.length - 1) })) })} title="Mais uma cor"><Plus className="w-3 h-3" /></button>
        {e.stops.length > 2 && <button className={ico} onClick={() => mudar({ stops: e.stops.slice(0, -1).map((s, i, a) => ({ ...s, pos: i / (a.length - 1) })) })} title="Uma cor a menos"><Trash2 className="w-3 h-3" /></button>}
        <select value={e.style} onChange={x => mudar({ style: x.target.value as 'linear' })} className="rounded border border-gray-200 bg-transparent text-[10px]"><option value="linear">linear</option><option value="radial">radial</option></select></div>
      <div className="grid grid-cols-2 gap-x-2"><Num rotulo="Ângulo" valor={e.angleDeg} min={0} max={360} passo={1} sufixo="°" onMudar={(v, j) => mudar({ angleDeg: v }, j)} />{op}</div></div>)
    case 'patternOverlay': return (<div className="grid grid-cols-2 gap-x-2 gap-y-1"><p className="col-span-2 text-[10px] text-gray-400 break-all">Padrão: {e.src.path}</p>
      <Num rotulo="Escala" valor={e.scale} min={0.1} max={5} passo={0.05} escala={100} sufixo="%" onMudar={(v, j) => mudar({ scale: v }, j)} />{op}</div>)
  }
}

export default function EditorEfeitos({ efeitos, onMudar, estiloTexto = null, onPreset, titulo = 'Estilos de camada' }: {
  efeitos: Ef[]; onMudar: (efs: Ef[], label: string, juntar?: string) => void; estiloTexto?: EstiloTexto | null; onPreset?: (id: string | undefined) => void; titulo?: string
}) {
  const [aberto, setAberto] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const [nomePreset, setNomePreset] = useState('')
  const [minhaFonte, setMinhaFonte] = useState(false)
  const [renomear, setRenomear] = useState<string | null>(null)
  const { meus, naty, carregado } = usePresets()
  const copiado = useAreaEstilo(s => s.efeitos)
  useEffect(() => { if (!carregado) void carregarPresets() }, [carregado])
  const efs = limparEfeitos(efeitos)
  const set = (novos: Ef[], label: string, juntar?: string) => { onMudar(novos, label, juntar); onPreset?.(undefined) }
  const mudarUm = (i: number, p: Partial<Ef>, juntar?: string) => set(efs.map((e, k) => (k === i ? Efeito.parse({ ...e, ...p }) : e)), `Efeito: ${NOMES_EFEITO[efs[i].type]}`, juntar ? `ef${i}:${juntar}` : undefined)

  async function salvarPreset() {
    const p = presetDeEfeitos(nomePreset || 'Meu estilo', efs)
    guardarLocal([...meus.filter(x => x.id !== p.id), p])
    await sync.presets.salvar(p)
    setNomePreset('')
  }
  const aplicarPreset = (p: Preset) => { onMudar(efeitosDoPreset(p), `Preset: ${p.name}`); onPreset?.(p.id) }

  return (
    <div className="space-y-1.5" data-editor-efeitos>
      <div className="flex items-center gap-1">
        <h4 className="text-xs font-semibold flex-1">{titulo}</h4>
        <button className={ico} title="Copiar estilo" onClick={() => useAreaEstilo.setState({ efeitos: JSON.parse(JSON.stringify(efs)) })} data-copiar-estilo><Copy className="w-3.5 h-3.5" /></button>
        <button className={ico} title="Colar estilo" disabled={!copiado} onClick={() => copiado && set(limparEfeitos(copiado), 'Colar estilo')} data-colar-estilo><ClipboardPaste className="w-3.5 h-3.5" /></button>
        <div className="relative">
          <button className={btn} onClick={() => setMenu(!menu)} data-add-efeito><Plus className="w-3.5 h-3.5" /> Efeito</button>
          {menu && (
            <ul className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white dark:bg-gray-900 shadow-lg p-1">
              {(Object.keys(NOMES_EFEITO) as TipoEfeito[]).map(t => <li key={t}><button className="w-full text-left text-xs px-2 py-1 rounded hover:bg-orange-50" onClick={() => { set([...efs, efeitoPadrao(t)], `+ ${NOMES_EFEITO[t]}`); setAberto(efs.length); setMenu(false) }} data-tipo-efeito={t}>{NOMES_EFEITO[t]}</button></li>)}
            </ul>
          )}
        </div>
      </div>
      <ul className="space-y-1" data-lista-efeitos>
        {efs.map((e, i) => (
          <li key={i} className="rounded border border-gray-200 dark:border-gray-700" data-efeito={e.type}>
            <div className="flex items-center gap-1 px-1 py-0.5 text-xs">
              <button className={ico} onClick={() => mudarUm(i, { enabled: !e.enabled })}>{e.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}</button>
              <button className="flex-1 text-left truncate" onClick={() => setAberto(aberto === i ? null : i)}>{NOMES_EFEITO[e.type]}{e.type === 'stroke' ? ` ${e.sizeMm.toLocaleString('pt-BR')} mm` : ''}</button>
              <button className={ico} disabled={i === 0} onClick={() => { const n = [...efs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n, 'Ordem dos efeitos') }}><ArrowUp className="w-3 h-3" /></button>
              <button className={ico} disabled={i === efs.length - 1} onClick={() => { const n = [...efs]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n, 'Ordem dos efeitos') }}><ArrowDown className="w-3 h-3" /></button>
              <button className={ico} onClick={() => set(efs.filter((_, k) => k !== i), `- ${NOMES_EFEITO[e.type]}`)}><Trash2 className="w-3 h-3" /></button>
            </div>
            {aberto === i && <div className="px-1.5 pb-1.5"><CamposEfeito e={e} mudar={(p, j) => mudarUm(i, p, j)} /></div>}
          </li>
        ))}
        {!efs.length && <li className="text-[11px] text-gray-400">Sem efeitos. Use “+ Efeito” ou um preset.</li>}
      </ul>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1" data-presets>
        <div className="flex gap-1">
          <input value={nomePreset} onChange={e => setNomePreset(e.target.value)} placeholder="nome do preset" className="flex-1 min-w-0 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs" data-nome-preset />
          <button className={btn} disabled={!efs.length} onClick={salvarPreset} title="Guarda SÓ os efeitos (não a fonte)" data-salvar-preset><Save className="w-3.5 h-3.5" /> Salvar preset</button>
        </div>
        {meus.length > 0 && <p className="text-[10px] font-semibold text-gray-500 pt-0.5">Meus presets</p>}
        <ul className="space-y-0.5" data-meus-presets>
          {meus.map(p => (
            <li key={p.id} className="flex items-center gap-1 text-xs">
              <button onClick={() => aplicarPreset(p)} title="Aplicar" className="shrink-0" data-aplicar-preset><Previa efeitos={p.effects} estilo={estiloTexto} /></button>
              {renomear === p.id
                ? <input autoFocus defaultValue={p.name} className="flex-1 min-w-0 rounded border border-orange-300 px-1 text-xs" onBlur={async e => { const n = { ...p, name: e.target.value.trim() || p.name }; guardarLocal(meus.map(x => (x.id === p.id ? n : x))); setRenomear(null); await sync.presets.salvar(n) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                : <button className="flex-1 truncate text-left" onClick={() => aplicarPreset(p)} data-preset-meu={p.name}>{p.name}</button>}
              <button className={ico} onClick={() => setRenomear(p.id)} title="Renomear"><Pencil className="w-3 h-3" /></button>
              <button className={ico} onClick={async () => { guardarLocal(meus.filter(x => x.id !== p.id)); await sync.presets.excluir(p.id).catch(() => {}) }} title="Excluir"><Trash2 className="w-3 h-3" /></button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1 pt-0.5">
          <p className="text-[10px] font-semibold text-gray-500 flex items-center gap-1 flex-1"><Sparkles className="w-3 h-3" /> Loja da Naty</p>
          {estiloTexto && <label className="text-[10px] text-gray-500 flex items-center gap-1"><input type="checkbox" checked={minhaFonte} onChange={() => setMinhaFonte(!minhaFonte)} className="accent-orange-500" data-testar-minha-fonte /> Testar com minha fonte</label>}
        </div>
        <ul className="grid grid-cols-1 gap-0.5" data-loja-naty>
          {naty.map(p => (
            <li key={p.id} className="flex items-center gap-1 text-xs">
              <button onClick={() => p.free && aplicarPreset(p)} disabled={!p.free} className="shrink-0" title={p.free ? 'Aplicar' : 'Pago — compra na Sprint 12'} data-aplicar-preset><Previa efeitos={p.effects} estilo={minhaFonte ? estiloTexto : null} /></button>
              <button className="flex-1 truncate text-left disabled:opacity-50" disabled={!p.free} onClick={() => aplicarPreset(p)} data-preset-naty={p.name}>{p.name}</button>
              <span className={`text-[9px] rounded px-1 ${p.free ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{p.free ? 'grátis' : `R$ ${((p.priceCents ?? 0) / 100).toFixed(2).replace('.', ',')}`}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
