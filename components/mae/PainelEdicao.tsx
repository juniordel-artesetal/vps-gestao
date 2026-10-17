'use client'
'use no memo'
// FERRAMENTAS DE EDIÇÃO da camada selecionada do tema (Sprint 10): transformar (altura, inclinar,
// espelhar), MÁSCARA (ativa, inverter, suavizar, degradê vetorial; pintar no editor de pixels), os 8
// AJUSTES não destrutivos, DEFORMAR, PINTURA em camada nova e, nas FORMAS, preenchimento e traçado.
import Deslizador from './Deslizador'
import { mascaraDaFace } from './acoesVinculo'
import { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Brush, Move } from 'lucide-react'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { efetiva, ajustesDaFace, type AjusteLocal } from '@/lib/mae/vinculo/resolver'
import { useEditor } from './estado'
import { Ajuste, NOMES_AJUSTE, ajustePadrao, type TipoAjuste } from '@/lib/mae/schema/edicao'
import type { DocTema } from '@/lib/mae/schema'
import { MODOS_MESCLAGEM, NOMES_MESCLAGEM, type ModoMesclagem } from '@/lib/mae/schema'
import { SeletorImagem } from './SeletorImagem'
import { editarCamadaTema } from './acoesVinculo'
import { EditorPixelsTema } from './EditorPixels'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { acharFace } from '@/lib/mae/vinculo/partes'
import { arteDaFace } from '@/lib/mae/vinculo/cenario'
import CorComPaleta from './CorComPaleta'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
type CamadaTema = DocTema['partContent'][string][number]
type Mascara = NonNullable<CamadaTema['mask']>

function mudar(id: string, label: string, f: (c: CamadaTema) => void, juntar?: string) {
  useMaeTema.getState().aplicar(label, t => { const a = acharCamadaTema(t as DocTema, id); if (a) f(a.c as CamadaTema) }, juntar)
}

function Controle({ rotulo, v, min, max, passo = 1, onChange, sufixo = '' }: { rotulo: string; v: number; min: number; max: number; passo?: number; onChange: (n: number) => void; sufixo?: string }) {
  return (
    <label className="block text-[11px] text-gray-500">
      <span>{rotulo}</span>
      <Deslizador min={min} max={max} step={passo} value={v} onChange={e => onChange(Number(e.target.value))} unidade={sufixo.trim() || (max <= 1 && min >= -1 ? '%' : '')} fator={!sufixo.trim() && max <= 1 && min >= -1 ? 100 : 1} aria-label={rotulo} />
    </label>
  )
}

/** Controles de UM ajuste (por tipo). */
function ControlesAjuste({ a, on }: { a: Ajuste; on: (p: Partial<Ajuste>) => void }) {
  const D = (rotulo: string, k: string, min: number, max: number, passo = 1) => <Controle key={k} rotulo={rotulo} v={(a as unknown as Record<string, number>)[k]} min={min} max={max} passo={passo} onChange={n => on({ [k]: n } as never)} />
  switch (a.type) {
    case 'brightnessContrast': return <>{D('Brilho', 'brightness', -150, 150)}{D('Contraste', 'contrast', -100, 100)}</>
    case 'hueSaturation': return <>{D('Matiz', 'hue', -180, 180)}{D('Saturação', 'saturation', -100, 100)}{D('Luminosidade', 'lightness', -100, 100)}
      <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={a.colorize} onChange={e => on({ colorize: e.target.checked } as never)} /> Colorizar</label></>
    case 'levels': return <>{D('Preto de entrada', 'inBlack', 0, 253)}{D('Meio-tom (gama)', 'gamma', 0.1, 3, 0.01)}{D('Branco de entrada', 'inWhite', 2, 255)}{D('Preto de saída', 'outBlack', 0, 255)}{D('Branco de saída', 'outWhite', 0, 255)}</>
    case 'curves': {
      const y = (x: number) => a.points.find(p => p[0] === x)?.[1] ?? x
      const set = (x: number, v: number) => on({ points: [[0, y(0)], [64, x === 64 ? v : y(64)], [128, x === 128 ? v : y(128)], [192, x === 192 ? v : y(192)], [255, y(255)]] } as never)
      return <>{[64, 128, 192].map(x => <Controle key={x} rotulo={x === 64 ? 'Sombras' : x === 128 ? 'Meios-tons' : 'Realces'} v={y(x)} min={0} max={255} onChange={v => set(x, v)} />)}</>
    }
    case 'colorBalance': {
      const tons = [['shadows', 'Sombras'], ['midtones', 'Meios-tons'], ['highlights', 'Realces']] as const
      return <>{tons.map(([k, r]) => (
        <div key={k} className="space-y-0.5"><p className="text-[10px] font-medium text-gray-600">{r}</p>
          {(['Ciano ↔ Vermelho', 'Magenta ↔ Verde', 'Amarelo ↔ Azul'] as const).map((rot, i) => <Controle key={i} rotulo={rot} v={a[k][i]} min={-100} max={100} onChange={v => { const t = [...a[k]] as [number, number, number]; t[i] = v; on({ [k]: t } as never) }} />)}
        </div>))}</>
    }
    case 'vibrance': return <>{D('Vibração', 'vibrance', -100, 100)}{D('Saturação', 'saturation', -100, 100)}</>
    case 'blackWhite': return <>{(['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'] as const).map((k, i) => D(['Vermelhos', 'Amarelos', 'Verdes', 'Cianos', 'Azuis', 'Magentas'][i], k, -200, 300))}
      <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={!!a.tint} onChange={e => on({ tint: e.target.checked ? '#c8a165' : undefined } as never)} /> Tonalizar {a.tint && <CorComPaleta value={a.tint} onChange={cor => on({ tint: cor } as never)} className="h-5 w-6" />}</label></>
    case 'gradientMap': return (
      <div className="flex items-center gap-1 text-[11px]">Escuros <input type="color" value={a.stops[0].color} onChange={e => on({ stops: [{ pos: 0, color: e.target.value }, a.stops[a.stops.length - 1]] } as never)} className="h-5 w-6" />
        Claros <input type="color" value={a.stops[a.stops.length - 1].color} onChange={e => on({ stops: [a.stops[0], { pos: 1, color: e.target.value }] } as never)} className="h-5 w-6" /></div>
    )
  }
}

/**
 * Lote 3 (item 29) → Lote 4: PAPEL esticado (Preencher) ou em padrão repetido (Repetir). Fica no TOPO do painel
 * da camada (antes vinha no fim, depois de posição, estilos e opacidade, e a Naty não achava).
 */
export function ModoDoPapel({ camadaId }: { camadaId: string }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const face = useEditor(s => s.face), escopo = useEditor(s => s.escopo)
  const achada = tema ? acharCamadaTema(tema, camadaId) : null
  if (!achada) return null
  // Lote 5 (item 70): com "Só nesta caixa", mostra e muda a repetição DESTA caixa (ajuste local)
  const local = !achada.faceId && escopo === 'face' && face ? ((tema!.localOverrides ?? {})[face] ?? {})[camadaId] as AjusteLocal | undefined : undefined
  const c = (local ? efetiva(achada.c as CamadaTema, local) : achada.c) as CamadaTema
  const rep = (r: AjusteLocal['repeat'], label: string, juntar?: string) => editarCamadaTema(camadaId, { repeat: r }, label, juntar)
  if (c.type !== 'image' || (c.anchor ?? 'face') !== 'paper') return null
  return (
    <div className="space-y-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-xs" data-preencher-repetir>
          <span className="inline-flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 text-[11px]">
            <button className={`px-2 py-0.5 ${!c.repeat ? 'bg-orange-500 text-white' : ''}`} onClick={() => rep(null, 'Papel: preencher')} title="O papel cobre a face inteira (como antes)" data-modo-papel="preencher">Preencher</button>
            <button className={`px-2 py-0.5 ${c.repeat ? 'bg-orange-500 text-white' : ''}`} onClick={() => { if (!c.repeat) rep({ sizeMm: 40, mirror: false }, 'Papel: repetir') }} title="O papel vira um padrão lado a lado (azulejo) — a estampa não fica gigante nem deformada" data-modo-papel="repetir">Repetir (padrão)</button>
          </span>
          {c.repeat && (<>
            <Controle rotulo={local ? 'Tamanho do padrão (só nesta caixa)' : 'Tamanho do padrão'} v={c.repeat.sizeMm} min={5} max={200} passo={1} sufixo=" mm" onChange={v => rep({ ...c.repeat!, sizeMm: v }, 'Tamanho do padrão', `rep:${c.id}`)} />
            <label className="flex items-center gap-1.5" title="Espelha os azulejos vizinhos para disfarçar a emenda de papéis que não foram feitos para repetir"><input type="checkbox" checked={!!c.repeat.mirror} onChange={e => rep({ ...c.repeat!, mirror: e.target.checked }, e.target.checked ? 'Espelhar repetição' : 'Repetição sem espelho')} data-espelhar-repeticao /> Espelhar repetição</label>
            <Controle rotulo="Mover o padrão ↔" v={c.repeat.offsetXMm ?? 0} min={-c.repeat.sizeMm} max={c.repeat.sizeMm} passo={0.5} sufixo=" mm" onChange={v => rep({ ...c.repeat!, offsetXMm: v }, 'Mover o padrão', `repx:${c.id}`)} />
            <Controle rotulo="Mover o padrão ↕" v={c.repeat.offsetYMm ?? 0} min={-c.repeat.sizeMm} max={c.repeat.sizeMm} passo={0.5} sufixo=" mm" onChange={v => rep({ ...c.repeat!, offsetYMm: v }, 'Mover o padrão', `repy:${c.id}`)} />
          </>)}
        </div>
  )
}

export default function PainelEdicao({ camadaId, soAplique = false, faceAlvo = null }: { camadaId: string; soAplique?: boolean; faceAlvo?: string | null }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const [pixels, setPixels] = useState<null | 'mascara' | 'pintura' | 'deformar'>(null)
  const [aberto, setAberto] = useState<number | null>(null)
  const [papelNaForma, setPapelNaForma] = useState(false)
  const achada = tema ? acharCamadaTema(tema, camadaId) : null
  if (!achada) return null
  const c = achada.c as CamadaTema
  // Lote 9 (item 139): os controles mostram o valor EFETIVO (com o "só nesta caixa") e gravam no mesmo escopo — antes
  // "Altura" e "Inclinar" gravavam na caixa e mostravam o valor do conjunto (a bolinha não andava)
  const localDaFace = faceAlvo && !achada.faceId ? ((tema!.localOverrides ?? {})[faceAlvo] ?? {})[c.id] as AjusteLocal | undefined : undefined
  const escopoDireita = faceAlvo && !achada.faceId ? 'face' as const : 'parte' as const
  const t = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0, ...((localDaFace ? efetiva(c, localDaFace) : c).transform ?? {}) }
  const m = c.mask
  const ajustes = c.adjustments ?? []
  const setMascara = (p: Partial<Mascara> | null, label: string, j?: string) => mudar(c.id, label, cc => { if (p === null) delete cc.mask; else cc.mask = { enabled: true, invert: false, featherMm: 0, ...(cc.mask ?? {}), ...p } as Mascara }, j)
  const setAjuste = (i: number, p: Partial<Ajuste> | null, label: string, j?: string) => mudar(c.id, label, cc => {
    const l = [...(cc.adjustments ?? [])]
    if (p === null) l.splice(i, 1); else l[i] = { ...l[i], ...p } as Ajuste
    cc.adjustments = l
  }, j)

  return (
    <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2" data-painel-edicao>
      {/* Lote 2 (itens 16/21): no TOPO — antes ficava no fim do painel e a Naty não achava */}
      {(c.type === 'image' || c.type === 'shape') && (c.anchor ?? 'face') !== 'paper' && (
        <div className="space-y-1 text-xs" data-aplique-camada>
          <p className="text-[10px] text-gray-400">Selecione o elemento na arte e marque &quot;É aplique 3D&quot; aqui (ou com o botão direito sobre ele).</p>
          <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={!!c.applique?.enabled} onChange={e => mudar(c.id, e.target.checked ? 'Marcar como aplique 3D' : 'Tirar aplique 3D', cc => { if (cc.type !== 'image' && cc.type !== 'shape') return; if (e.target.checked) cc.applique = { ...(cc.applique ?? {}), enabled: true }; else delete cc.applique })} data-e-aplique /> É aplique 3D</label>
          {/* Lote 6 (item 105): bordinha e silhueta só no painel Apliques 3D (esquerda); aqui, posição, tamanho, giro e ordem */}
          {c.applique?.enabled && (
            <p className="text-[10px] text-gray-500" data-aplique-ver-painel>Bordinha e silhueta deste aplique: painel <button className="underline text-orange-700" onClick={() => useEditor.getState().set({ funcao: 'apliques' })} data-abrir-apliques>Apliques 3D</button> (esquerda).</p>
          )}
        </div>
      )}
      {/* Lote 10 (item 155): máscara também no APLIQUE 3D (antes sumia junto com o resto do painel) */}
      {/* máscara */}
      <div className="space-y-1 text-xs" data-mascara>
        <p className="font-semibold flex items-center gap-1">Recortar / máscara {m?.forma && <span className="text-[10px] font-normal text-violet-700">forma da face</span>} {m && <span className={`text-[10px] font-normal ${m.enabled === false ? 'text-gray-400' : 'text-emerald-700'}`}>{m.enabled === false ? 'desativada' : 'ativa'}</span>}</p>
        {!m ? (
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => setMascara({ gradient: { type: 'linear', x0: 0.3, y0: 0.5, x1: 0.7, y1: 0.5, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }] } }, 'Máscara em degradê')} data-mascara-degrade><Plus className="w-3 h-3" /> Degradê</button>
            {c.type === 'image' && <button className={btn} onClick={() => setPixels('mascara')} data-pintar-mascara><Brush className="w-3 h-3" /> Recortar / selecionar…</button>}
            {/* Lote 10 (item 155): a camada só aparece dentro da face (também no aplique 3D) */}
            <button className={btn} onClick={() => mascaraDaFace(c.id)} title="A camada só aparece dentro do contorno desta caixa — no aplique 3D, a impressão e a silhueta seguem o recorte" data-mascara-face>Usar a forma da face</button>
          </div>
        ) : (<>
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1"><input type="checkbox" checked={m.enabled !== false} onChange={e => setMascara({ enabled: e.target.checked }, e.target.checked ? 'Ativar máscara' : 'Desativar máscara')} data-mascara-ativa /> Ativa</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!m.invert} onChange={e => setMascara({ invert: e.target.checked }, 'Inverter máscara')} data-mascara-inverter /> Inverter</label>
            <select value={m.gradient?.type ?? ''} onChange={e => setMascara(e.target.value ? { gradient: { ...(m.gradient ?? { x0: 0.3, y0: 0.5, x1: 0.7, y1: 0.5, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }] }), type: e.target.value as 'linear' } } : { gradient: undefined }, 'Degradê da máscara')} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" data-tipo-degrade-mascara>
              <option value="">Sem degradê</option><option value="linear">Degradê linear</option><option value="radial">Radial</option><option value="angular">Angular</option><option value="reflected">Refletido</option>
            </select>
          </div>
          <Controle rotulo="Suavizar borda" v={m.featherMm ?? 0} min={0} max={30} passo={0.5} onChange={v => setMascara({ featherMm: v }, 'Suavizar máscara', `fth:${c.id}`)} sufixo=" mm" />
          <div className="flex flex-wrap gap-1">
            {c.type === 'image' && <button className={btn} onClick={() => setPixels('mascara')} data-editar-mascara><Brush className="w-3 h-3" /> Editar (pincel, seleção, degradê)…</button>}
            {!m.forma && <button className={btn} onClick={() => mascaraDaFace(c.id)} data-mascara-face>Usar a forma da face</button>}
            <button className={btn} onClick={() => setMascara(null, 'Remover máscara')} title="Remover a máscara — volta ao original (nada se perde)" data-excluir-mascara><Trash2 className="w-3 h-3" /> Remover máscara</button>
          </div>
        </>)}
      </div>

      {soAplique ? null : <>
      {(c.anchor ?? 'face') !== 'paper' && (c.type === 'image' || c.type === 'shape') && (
        <label className="flex items-center gap-1.5 text-xs" title="Desligado: o elemento fica recortado dentro do contorno da face na impressão (só o papel vaza)">
          <input type="checkbox" checked={!!(c as { bleed?: boolean }).bleed} onChange={e => mudar(c.id, e.target.checked ? 'Pode vazar da face' : 'Recortar na face', cc => { if (e.target.checked) (cc as { bleed?: boolean }).bleed = true; else delete (cc as { bleed?: boolean }).bleed })} data-pode-vazar /> Pode vazar da face
        </label>
      )}
      {/* Lote 3 (item 27/34): opacidade da camada */}
      {/* Lote 8 (item 131): mostra a opacidade EFETIVA (com o ajuste "só nesta caixa"); a da camada vale para o grupo inteiro
          (a forma e o papel dentro dela) — o preenchimento tem a sua, separada (como no Photoshop) */}
      <Controle rotulo={faceAlvo && !achada.faceId ? 'Opacidade (só nesta caixa)' : 'Opacidade'} v={(efetiva(c, faceAlvo && !achada.faceId ? ((tema!.localOverrides ?? {})[faceAlvo] ?? {})[c.id] as AjusteLocal | undefined : undefined) as { opacity?: number }).opacity ?? 1} min={0} max={1} passo={0.01}
        onChange={v => editarCamadaTema(c.id, { opacity: v >= 0.995 ? 1 : Math.round(v * 100) / 100 }, 'Opacidade', `op:${c.id}`, faceAlvo ? 'face' : 'parte')} />
      {(c.type === 'shape' || c.type === 'image') && <Controle rotulo="Opacidade do preenchimento" v={(c as { fillOpacity?: number }).fillOpacity ?? 1} min={0} max={1} passo={0.01}
        onChange={v => mudar(c.id, 'Opacidade do preenchimento', cc => { if (v >= 0.995) delete (cc as { fillOpacity?: number }).fillOpacity; else (cc as { fillOpacity?: number }).fillOpacity = Math.round(v * 100) / 100 }, `fop:${c.id}`)} />}
      {/* Lote 6 (item 112): modo de mesclagem, como em qualquer camada */}
      <label className="block text-[11px] text-gray-500">Modo de mesclagem
        <select value={(c as { blendMode?: string }).blendMode ?? 'normal'} onChange={e => mudar(c.id, 'Modo de mesclagem', cc => { const v = e.target.value as ModoMesclagem; if (v === 'normal') delete (cc as { blendMode?: string }).blendMode; else (cc as { blendMode?: string }).blendMode = v })}
          className="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs" data-mesclagem-tema>
          {MODOS_MESCLAGEM.map(m => <option key={m} value={m}>{NOMES_MESCLAGEM[m]}</option>)}
        </select>
      </label>
      {/* transformar */}
      <details className="text-xs" data-transformar>
        <summary className="cursor-pointer font-semibold flex items-center gap-1"><Move className="inline w-3.5 h-3.5" /> Transformar</summary>
        <Controle rotulo="Altura (independente)" v={t.scaleY ?? 1} min={0.1} max={3} passo={0.01} onChange={v => editarCamadaTema(c.id, { transform: { scaleY: v } }, 'Altura', `alt:${c.id}`, escopoDireita)} sufixo="×" />
        <Controle rotulo="Inclinar" v={t.skewXDeg ?? 0} min={-60} max={60} onChange={v => editarCamadaTema(c.id, { transform: { skewXDeg: v } }, 'Inclinar', `skw:${c.id}`, escopoDireita)} sufixo="°" />
        {c.type === 'image' && (
          <div className="flex gap-1 pt-1">
            <button className={btn} onClick={() => setPixels('deformar')} data-abrir-deformar>Distorcer / perspectiva / malha…</button>
            {c.warp && <button className={btn} onClick={() => mudar(c.id, 'Tirar deformação', cc => { if (cc.type === 'image') delete cc.warp })}>Tirar</button>}
          </div>
        )}
      </details>

      {/* Lote 10 (item 156): "preencher com papel" também num PNG (o papel fica preso à transparência dele) */}
      {c.type === 'image' && (c.anchor ?? 'face') !== 'paper' && (
        <div className="space-y-1 text-xs" data-papel-no-png>
          <button className={btn} onClick={() => setPapelNaForma(v => !v)} data-papel-na-forma>Preencher com papel…</button>
          {papelNaForma && <SeletorImagem pastas={['Papéis', 'Elementos']} onEscolher={a => {
            const id = idDoPapel(c.id)
            useMaeTema.getState().aplicar('Papel dentro do elemento', t => {
              const x = acharCamadaTema(t as DocTema, c.id); if (!x) return
              x.lista.splice(x.i + 1, 0, { id, type: 'image', name: `${a.path.split('/').pop()!.replace(/\.[^.]+$/, '')} (no elemento)`, path: a.path, sha256: a.sha256, aspect: a.aspect,
                anchor: 'face', transform: { ...(c.transform ?? { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 }), scale: (c.transform?.scale ?? 0.4) * Math.max(1, (c.aspect ?? 1) / (a.aspect || 1)) * 1.05 }, recortada: true } as never)
            })
            setPapelNaForma(false); useEditor.getState().set({ camada: id })
          }} />}
        </div>
      )}
      {/* forma */}
      {c.type === 'shape' && (
        <div className="space-y-1 text-xs" data-forma-sel>
          <p className="font-semibold">Forma</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1"><input type="checkbox" checked={c.fill !== null} onChange={e => mudar(c.id, 'Preenchimento', cc => { if (cc.type === 'shape') cc.fill = e.target.checked ? '#f472b6' : null })} /> Preencher</label>
            {c.fill && <CorComPaleta value={c.fill} onChange={cor => mudar(c.id, 'Cor da forma', cc => { if (cc.type === 'shape') cc.fill = cor }, `fill:${c.id}`)} className="h-5 w-6" data-cor-forma />}
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!c.stroke} onChange={e => mudar(c.id, 'Traçado', cc => { if (cc.type === 'shape') cc.stroke = e.target.checked ? { color: '#1f2937', widthMm: 0.8 } : null })} data-traco-forma /> Traçado</label>
            {c.stroke && <><CorComPaleta value={c.stroke.color} onChange={cor => mudar(c.id, 'Cor do traçado', cc => { if (cc.type === 'shape' && cc.stroke) cc.stroke.color = cor }, `stc:${c.id}`)} className="h-5 w-6" />
              <input inputMode="decimal" defaultValue={String(c.stroke.widthMm).replace('.', ',')} key={c.stroke.widthMm} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0 && v <= 20) mudar(c.id, 'Espessura do traçado', cc => { if (cc.type === 'shape' && cc.stroke) cc.stroke.widthMm = v }) }} className="w-10 rounded border border-gray-200 bg-transparent px-1" aria-label="Espessura do traçado em mm" /> mm</>}
          </div>
          {c.kind === 'rect' && <Controle rotulo="Cantos arredondados" v={c.params.radius} min={0} max={0.5} passo={0.01} onChange={v => mudar(c.id, 'Cantos', cc => { if (cc.type === 'shape') cc.params.radius = v }, `rad:${c.id}`)} />}
          {(c.kind === 'polygon' || c.kind === 'star') && <Controle rotulo={c.kind === 'star' ? 'Pontas' : 'Lados'} v={c.params.sides} min={3} max={24} onChange={v => mudar(c.id, 'Lados', cc => { if (cc.type === 'shape') cc.params.sides = v }, `lad:${c.id}`)} />}
          {c.kind === 'star' && <Controle rotulo="Raio interno" v={c.params.inner} min={0.1} max={0.95} passo={0.01} onChange={v => mudar(c.id, 'Raio interno', cc => { if (cc.type === 'shape') cc.params.inner = v }, `inn:${c.id}`)} />}
          {/* Lote 14 (item 198): LARGURA × ALTURA na medida real (mm, cm ou px — a unidade das configurações), no lugar da
              "Proporção (largura ÷ altura)", que obrigava a fazer conta */}
          <MedidaDaForma camadaId={c.id} faceAlvo={faceAlvo ?? null} escopo={escopoDireita} />
          {/* Lote 6 (item 112): papel DENTRO da forma — o papel entra logo acima, com máscara de corte na forma */}
          <button className={btn} onClick={() => setPapelNaForma(v => !v)} data-papel-na-forma>Preencher com papel…</button>
          {papelNaForma && <SeletorImagem pastas={['Papéis', 'Elementos']} onEscolher={a => {
            const id = idDoPapel(c.id)
            useMaeTema.getState().aplicar('Papel dentro da forma', t => {
              const x = acharCamadaTema(t as DocTema, c.id); if (!x) return
              x.lista.splice(x.i + 1, 0, { id, type: 'image', name: `${a.path.split('/').pop()!.replace(/\.[^.]+$/, '')} (na forma)`, path: a.path, sha256: a.sha256, aspect: a.aspect,
                anchor: 'face', transform: { ...(c.transform ?? { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 }), scale: (c.transform?.scale ?? 0.4) * Math.max(1, c.aspect / (a.aspect || 1)) * 1.05 }, recortada: true } as never)
            })
            setPapelNaForma(false); useEditor.getState().set({ camada: id })
          }} />}
        </div>
      )}

      {/* ajustes */}
      <div className="space-y-1 text-xs" data-ajustes>
        <div className="flex items-center gap-1">
          <p className="font-semibold flex-1">Ajustes</p>
          <select value="" onChange={e => { const tp = e.target.value as TipoAjuste; if (!tp) return; mudar(c.id, `Ajuste: ${NOMES_AJUSTE[tp]}`, cc => { cc.adjustments = [...(cc.adjustments ?? []), ajustePadrao(tp)] }); setAberto(ajustes.length) }} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" data-adicionar-ajuste>
            <option value="">+ Ajuste…</option>
            {(Object.keys(NOMES_AJUSTE) as TipoAjuste[]).map(k => <option key={k} value={k}>{NOMES_AJUSTE[k]}</option>)}
          </select>
        </div>
        {ajustes.map((a, i) => (
          <div key={i} className="rounded border border-gray-200 dark:border-gray-700 p-1.5" data-ajuste={a.type}>
            <div className="flex items-center gap-1">
              <button onClick={() => setAjuste(i, { enabled: a.enabled === false }, a.enabled === false ? 'Ligar ajuste' : 'Desligar ajuste')} aria-label={a.enabled === false ? 'Ligar ajuste' : 'Desligar ajuste'}>{a.enabled === false ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5" />}</button>
              <button className="flex-1 text-left font-medium" onClick={() => setAberto(aberto === i ? null : i)}>{NOMES_AJUSTE[a.type]}</button>
              <button onClick={() => setAjuste(i, null, 'Excluir ajuste')} aria-label="Excluir ajuste"><Trash2 className="w-3.5 h-3.5 opacity-60 hover:opacity-100" /></button>
            </div>
            {aberto === i && (
              <div className="pt-1 space-y-0.5">
                <ControlesAjuste a={a} on={p => setAjuste(i, p, NOMES_AJUSTE[a.type], `aj:${c.id}:${i}`)} />
                <Controle rotulo="Opacidade do ajuste" v={a.opacity} min={0} max={1} passo={0.01} onChange={v => setAjuste(i, { opacity: v }, 'Opacidade do ajuste', `ajo:${c.id}:${i}`)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {c.type === 'image' && <button className={btn} onClick={() => setPixels('pintura')} data-pintar-camada><Brush className="w-3 h-3" /> Pintar numa camada nova…</button>}
      {pixels && <EditorPixelsTema camadaId={c.id} modoInicial={pixels} onFechar={() => setPixels(null)} />}
      </>}
    </div>
  )
}

/**
 * Modo Imagem (arte única): os mesmos AJUSTES e a MÁSCARA EM DEGRADÊ direto na camada do motor. O degradê
 * fica no quadrado da camada (matriz da caixa), então acompanha a camada se ela mudar de lugar.
 */
type NoEditavel = import('@/lib/mae/schema').NoCamada
export function EdicaoDoNo({ no, onMudar }: { no: NoEditavel; onMudar: (label: string, f: (n: NoEditavel) => void, juntar?: string) => void }) {
  const [aberto, setAberto] = useState<number | null>(null)
  const matriz = (n: NoEditavel): [number, number, number, number, number, number] =>
    n.type === 'image' && n.matrix ? n.matrix
      : n.type === 'path' ? [n.bboxMm[2], 0, 0, n.bboxMm[3], n.bboxMm[0], n.bboxMm[1]]
        : 'wMm' in n ? [n.wMm, 0, 0, n.hMm, n.xMm, n.yMm] : [1, 0, 0, 1, 0, 0]
  const m = no.mask
  const ajustes = no.adjustments ?? []
  const DIRECOES = { 'esq-dir': [0.3, 0.5, 0.7, 0.5], 'cima-baixo': [0.5, 0.3, 0.5, 0.7], 'centro': [0.5, 0.5, 1, 0.5] } as const
  return (
    <div className="space-y-1.5 text-xs border-t border-gray-200 dark:border-gray-700 pt-2" data-edicao-no>
      <div className="flex items-center gap-1">
        <p className="font-semibold flex-1">Máscara em degradê</p>
        <select value={m?.gradient?.type ?? ''} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" data-mascara-no
          onChange={e => onMudar('Máscara', n => {
            const tp = e.target.value as 'linear' | 'radial' | 'angular' | 'reflected' | ''
            if (!tp) { delete n.mask; return }
            const [x0, y0, x1, y1] = tp === 'radial' || tp === 'angular' ? DIRECOES.centro : DIRECOES['esq-dir']
            n.mask = { enabled: true, invert: n.mask?.invert ?? false, featherMm: n.mask?.featherMm ?? 0, gradient: { type: tp, x0, y0, x1, y1, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }], matrix: matriz(n) } }
          })}>
          <option value="">Sem máscara</option><option value="linear">Linear</option><option value="radial">Radial</option><option value="angular">Angular</option><option value="reflected">Refletido</option>
        </select>
      </div>
      {m?.gradient && (
        <div className="flex flex-wrap items-center gap-1.5">
          {m.gradient.type !== 'radial' && m.gradient.type !== 'angular' && (
            <select defaultValue="" onChange={e => { const d = DIRECOES[e.target.value as keyof typeof DIRECOES]; if (d) onMudar('Direção do degradê', n => { if (n.mask?.gradient) Object.assign(n.mask.gradient, { x0: d[0], y0: d[1], x1: d[2], y1: d[3], matrix: matriz(n) }) }) }} className="rounded border border-gray-200 bg-transparent px-1 py-0.5">
              <option value="">Direção…</option><option value="esq-dir">Esquerda → direita</option><option value="cima-baixo">Cima → baixo</option>
            </select>
          )}
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!m.invert} onChange={e => onMudar('Inverter máscara', n => { if (n.mask) n.mask.invert = e.target.checked })} /> Inverter</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={m.enabled !== false} onChange={e => onMudar('Ativar máscara', n => { if (n.mask) n.mask.enabled = e.target.checked })} /> Ativa</label>
        </div>
      )}
      <div className="flex items-center gap-1">
        <p className="font-semibold flex-1">Ajustes</p>
        <select value="" onChange={e => { const tp = e.target.value as TipoAjuste; if (!tp) return; onMudar(`Ajuste: ${NOMES_AJUSTE[tp]}`, n => { n.adjustments = [...(n.adjustments ?? []), ajustePadrao(tp)] }); setAberto(ajustes.length) }} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" data-adicionar-ajuste-no>
          <option value="">+ Ajuste…</option>
          {(Object.keys(NOMES_AJUSTE) as TipoAjuste[]).map(k => <option key={k} value={k}>{NOMES_AJUSTE[k]}</option>)}
        </select>
      </div>
      {ajustes.map((a, i) => (
        <div key={i} className="rounded border border-gray-200 dark:border-gray-700 p-1.5">
          <div className="flex items-center gap-1">
            <button className="flex-1 text-left font-medium" onClick={() => setAberto(aberto === i ? null : i)}>{NOMES_AJUSTE[a.type]}</button>
            <button onClick={() => onMudar('Excluir ajuste', n => { n.adjustments = (n.adjustments ?? []).filter((_, k) => k !== i) })} aria-label="Excluir ajuste"><Trash2 className="w-3.5 h-3.5 opacity-60" /></button>
          </div>
          {aberto === i && <ControlesAjuste a={a} on={p => onMudar(NOMES_AJUSTE[a.type], n => { const l = [...(n.adjustments ?? [])]; l[i] = { ...l[i], ...p } as Ajuste; n.adjustments = l }, `ajn:${no.id}:${i}`)} />}
        </div>
      ))}
    </div>
  )
}

/** Id da camada de papel posta dentro de uma forma (Lote 6, item 112). */
function idDoPapel(formaId: string): string {
  return `${formaId}_p${Math.random().toString(36).slice(2, 6)}`
}

/** Lote 14 (item 198): largura × altura da forma em mm (o Deslizador mostra na unidade escolhida e aceita "6,5cm"). */
function MedidaDaForma({ camadaId, faceAlvo, escopo }: { camadaId: string; faceAlvo: string | null; escopo?: 'face' | 'parte' }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null) as DocTema | null
  if (!tema) return null
  const a = acharCamadaTema(tema, camadaId)
  if (!a) return null
  const face = a.faceId ?? faceAlvo ?? doc.parts.find(p => p.id === a.partId)?.instances[0]?.faceId
  const af = face ? acharFace(doc, face) : null
  const arte = af && face ? arteDaFace(doc, tema, af.molde, face) : null
  if (!arte || !(arte.quadro.w > 0)) return <p className="text-[10px] text-gray-400">Clique numa caixa da arte para ver a largura × altura da forma.</p>
  const c = (a.faceId || !faceAlvo ? a.c : efetiva(a.c, ajustesDaFace(tema, faceAlvo)[camadaId])) as { aspect?: number; transform?: { scale?: number; scaleY?: number } }
  const sc = c.transform?.scale ?? 1, sy = c.transform?.scaleY ?? 1, asp = c.aspect || 1
  const W = sc * arte.quadro.w, H = (W / asp) * sy
  const r3 = (v: number) => Math.round(v * 1000) / 1000
  return (
    <div className="grid grid-cols-2 gap-1" data-medida-forma>
      <label className="block text-[11px] text-gray-500">Largura<Deslizador min={1} max={Math.max(50, Math.round(arte.quadro.w * 2))} step={0.5} unidade="mm" value={Math.round(W * 10) / 10}
        onChange={e => { const w = Number(e.target.value); if (w > 0) editarCamadaTema(camadaId, { transform: { scale: r3(w / arte.quadro.w), scaleY: r3(sy * sc / (w / arte.quadro.w)) } }, 'Largura da forma', `fw:${camadaId}`, escopo) }} data-largura-forma /></label>
      <label className="block text-[11px] text-gray-500">Altura<Deslizador min={1} max={Math.max(50, Math.round(arte.quadro.h * 2))} step={0.5} unidade="mm" value={Math.round(H * 10) / 10}
        onChange={e => { const h = Number(e.target.value); if (h > 0) editarCamadaTema(camadaId, { transform: { scaleY: r3((h * asp) / W) } }, 'Altura da forma', `fh:${camadaId}`, escopo) }} data-altura-forma /></label>
    </div>
  )
}
