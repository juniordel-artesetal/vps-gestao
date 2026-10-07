'use client'
'use no memo'
// FERRAMENTAS DE EDIÇÃO da camada selecionada do tema (Sprint 10): transformar (altura, inclinar,
// espelhar), MÁSCARA (ativa, inverter, suavizar, degradê vetorial; pintar no editor de pixels), os 8
// AJUSTES não destrutivos, DEFORMAR, PINTURA em camada nova e, nas FORMAS, preenchimento e traçado.
import Deslizador from './Deslizador'
import { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Brush, Move, FlipHorizontal2, FlipVertical2 } from 'lucide-react'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { Ajuste, NOMES_AJUSTE, ajustePadrao, type TipoAjuste } from '@/lib/mae/schema/edicao'
import type { DocTema } from '@/lib/mae/schema'
import { editarCamadaTema } from './acoesVinculo'
import { EditorPixelsTema } from './EditorPixels'

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
      <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={!!a.tint} onChange={e => on({ tint: e.target.checked ? '#c8a165' : undefined } as never)} /> Tonalizar {a.tint && <input type="color" value={a.tint} onChange={e => on({ tint: e.target.value } as never)} className="h-5 w-6" />}</label></>
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
  const achada = tema ? acharCamadaTema(tema, camadaId) : null
  if (!achada) return null
  const c = achada.c as CamadaTema
  if (c.type !== 'image' || (c.anchor ?? 'face') !== 'paper') return null
  return (
    <div className="space-y-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-xs" data-preencher-repetir>
          <span className="inline-flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 text-[11px]">
            <button className={`px-2 py-0.5 ${!c.repeat ? 'bg-orange-500 text-white' : ''}`} onClick={() => mudar(c.id, 'Papel: preencher', cc => { if (cc.type === 'image') delete cc.repeat })} title="O papel cobre a face inteira (como antes)" data-modo-papel="preencher">Preencher</button>
            <button className={`px-2 py-0.5 ${c.repeat ? 'bg-orange-500 text-white' : ''}`} onClick={() => mudar(c.id, 'Papel: repetir', cc => { if (cc.type === 'image' && !cc.repeat) cc.repeat = { sizeMm: 40, mirror: false } })} title="O papel vira um padrão lado a lado (azulejo) — a estampa não fica gigante nem deformada" data-modo-papel="repetir">Repetir (padrão)</button>
          </span>
          {c.repeat && (<>
            <Controle rotulo="Tamanho do padrão (igual em todas as caixas da parte)" v={c.repeat.sizeMm} min={5} max={200} passo={1} sufixo=" mm" onChange={v => mudar(c.id, 'Tamanho do padrão', cc => { if (cc.type === 'image' && cc.repeat) cc.repeat.sizeMm = v }, `rep:${c.id}`)} />
            <label className="flex items-center gap-1.5" title="Espelha os azulejos vizinhos para disfarçar a emenda de papéis que não foram feitos para repetir"><input type="checkbox" checked={!!c.repeat.mirror} onChange={e => mudar(c.id, e.target.checked ? 'Espelhar repetição' : 'Repetição sem espelho', cc => { if (cc.type === 'image' && cc.repeat) cc.repeat.mirror = e.target.checked })} data-espelhar-repeticao /> Espelhar repetição</label>
            <Controle rotulo="Mover o padrão ↔" v={c.repeat.offsetXMm ?? 0} min={-c.repeat.sizeMm} max={c.repeat.sizeMm} passo={0.5} sufixo=" mm" onChange={v => mudar(c.id, 'Mover o padrão', cc => { if (cc.type === 'image' && cc.repeat) cc.repeat.offsetXMm = v }, `repx:${c.id}`)} />
            <Controle rotulo="Mover o padrão ↕" v={c.repeat.offsetYMm ?? 0} min={-c.repeat.sizeMm} max={c.repeat.sizeMm} passo={0.5} sufixo=" mm" onChange={v => mudar(c.id, 'Mover o padrão', cc => { if (cc.type === 'image' && cc.repeat) cc.repeat.offsetYMm = v }, `repy:${c.id}`)} />
          </>)}
        </div>
  )
}

export default function PainelEdicao({ camadaId }: { camadaId: string }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const [pixels, setPixels] = useState<null | 'mascara' | 'pintura' | 'deformar'>(null)
  const [aberto, setAberto] = useState<number | null>(null)
  const achada = tema ? acharCamadaTema(tema, camadaId) : null
  if (!achada) return null
  const c = achada.c as CamadaTema
  const t = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0, ...(c.transform ?? {}) }
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
      {c.type === 'image' && (
        <div className="space-y-1 text-xs" data-aplique-camada>
          <p className="text-[10px] text-gray-400">Selecione o elemento na arte e marque &quot;É aplique 3D&quot; aqui (ou com o botão direito sobre ele).</p>
          <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={!!c.applique?.enabled} onChange={e => mudar(c.id, e.target.checked ? 'Marcar como aplique 3D' : 'Tirar aplique 3D', cc => { if (cc.type !== 'image') return; if (e.target.checked) cc.applique = { ...(cc.applique ?? {}), enabled: true }; else delete cc.applique })} data-e-aplique /> É aplique 3D</label>
          {c.applique?.enabled && (<>
            <p className="text-[10px] text-gray-400">Sai na folha de impressos (com bordinha e o nome do molde) e na de silhuetas, um por molde. {tema?.appliques?.enabled ? '' : 'Ligue "Apliques 3D" no tema (painel Exportar).'}</p>
            <Controle rotulo="Bordinha só deste" v={c.applique.borderMm ?? tema?.appliques?.borderMm ?? 1} min={0} max={5} passo={0.5} onChange={v => mudar(c.id, 'Bordinha do aplique', cc => { if (cc.type === 'image' && cc.applique) cc.applique.borderMm = v }, `aplb:${c.id}`)} sufixo=" mm" />
            <Controle rotulo="Deslocamento da silhueta só deste" v={c.applique.silhouetteMm ?? tema?.appliques?.silhouetteMm ?? 3} min={0} max={15} passo={0.5} onChange={v => mudar(c.id, 'Silhueta do aplique', cc => { if (cc.type === 'image' && cc.applique) cc.applique.silhouetteMm = v }, `apls:${c.id}`)} sufixo=" mm" />
          </>)}
        </div>
      )}
      {(c.anchor ?? 'face') !== 'paper' && (c.type === 'image' || c.type === 'shape') && (
        <label className="flex items-center gap-1.5 text-xs" title="Desligado: o elemento fica recortado dentro do contorno da face na impressão (só o papel vaza)">
          <input type="checkbox" checked={!!(c as { bleed?: boolean }).bleed} onChange={e => mudar(c.id, e.target.checked ? 'Pode vazar da face' : 'Recortar na face', cc => { if (e.target.checked) (cc as { bleed?: boolean }).bleed = true; else delete (cc as { bleed?: boolean }).bleed })} data-pode-vazar /> Pode vazar da face
        </label>
      )}
      {/* Lote 3 (item 27/34): opacidade da camada */}
      <Controle rotulo="Opacidade" v={(c as { opacity?: number }).opacity ?? 1} min={0} max={1} passo={0.01} onChange={v => mudar(c.id, 'Opacidade', cc => { if (v >= 0.995) delete (cc as { opacity?: number }).opacity; else (cc as { opacity?: number }).opacity = Math.round(v * 100) / 100 }, `op:${c.id}`)} />
      {/* transformar */}
      <details className="text-xs" data-transformar>
        <summary className="cursor-pointer font-semibold flex items-center gap-1"><Move className="inline w-3.5 h-3.5" /> Transformar</summary>
        <Controle rotulo="Altura (independente)" v={t.scaleY ?? 1} min={0.1} max={3} passo={0.01} onChange={v => editarCamadaTema(c.id, { transform: { scaleY: v } }, 'Altura', `alt:${c.id}`)} sufixo="×" />
        <Controle rotulo="Inclinar" v={t.skewXDeg ?? 0} min={-60} max={60} onChange={v => editarCamadaTema(c.id, { transform: { skewXDeg: v } }, 'Inclinar', `skw:${c.id}`)} sufixo="°" />
        <div className="flex gap-1 pt-1">
          <button className={btn + (t.flipX ? ' !border-orange-500' : '')} onClick={() => editarCamadaTema(c.id, { transform: { flipX: !t.flipX } }, 'Espelhar ↔')} data-espelhar="x"><FlipHorizontal2 className="w-3.5 h-3.5" /> Espelhar ↔</button>
          <button className={btn + (t.flipY ? ' !border-orange-500' : '')} onClick={() => editarCamadaTema(c.id, { transform: { flipY: !t.flipY } }, 'Espelhar ↕')} data-espelhar="y"><FlipVertical2 className="w-3.5 h-3.5" /> Espelhar ↕</button>
        </div>
        {c.type === 'image' && (
          <div className="flex gap-1 pt-1">
            <button className={btn} onClick={() => setPixels('deformar')} data-abrir-deformar>Distorcer / perspectiva / malha…</button>
            {c.warp && <button className={btn} onClick={() => mudar(c.id, 'Tirar deformação', cc => { if (cc.type === 'image') delete cc.warp })}>Tirar</button>}
          </div>
        )}
      </details>

      {/* forma */}
      {c.type === 'shape' && (
        <div className="space-y-1 text-xs" data-forma-sel>
          <p className="font-semibold">Forma</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1"><input type="checkbox" checked={c.fill !== null} onChange={e => mudar(c.id, 'Preenchimento', cc => { if (cc.type === 'shape') cc.fill = e.target.checked ? '#f472b6' : null })} /> Preencher</label>
            {c.fill && <input type="color" value={c.fill} onChange={e => mudar(c.id, 'Cor da forma', cc => { if (cc.type === 'shape') cc.fill = e.target.value }, `fill:${c.id}`)} className="h-5 w-6" data-cor-forma />}
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!c.stroke} onChange={e => mudar(c.id, 'Traçado', cc => { if (cc.type === 'shape') cc.stroke = e.target.checked ? { color: '#1f2937', widthMm: 0.8 } : null })} data-traco-forma /> Traçado</label>
            {c.stroke && <><input type="color" value={c.stroke.color} onChange={e => mudar(c.id, 'Cor do traçado', cc => { if (cc.type === 'shape' && cc.stroke) cc.stroke.color = e.target.value }, `stc:${c.id}`)} className="h-5 w-6" />
              <input inputMode="decimal" defaultValue={String(c.stroke.widthMm).replace('.', ',')} key={c.stroke.widthMm} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0 && v <= 20) mudar(c.id, 'Espessura do traçado', cc => { if (cc.type === 'shape' && cc.stroke) cc.stroke.widthMm = v }) }} className="w-10 rounded border border-gray-200 bg-transparent px-1" aria-label="Espessura do traçado em mm" /> mm</>}
          </div>
          {c.kind === 'rect' && <Controle rotulo="Cantos arredondados" v={c.params.radius} min={0} max={0.5} passo={0.01} onChange={v => mudar(c.id, 'Cantos', cc => { if (cc.type === 'shape') cc.params.radius = v }, `rad:${c.id}`)} />}
          {(c.kind === 'polygon' || c.kind === 'star') && <Controle rotulo={c.kind === 'star' ? 'Pontas' : 'Lados'} v={c.params.sides} min={3} max={24} onChange={v => mudar(c.id, 'Lados', cc => { if (cc.type === 'shape') cc.params.sides = v }, `lad:${c.id}`)} />}
          {c.kind === 'star' && <Controle rotulo="Raio interno" v={c.params.inner} min={0.1} max={0.95} passo={0.01} onChange={v => mudar(c.id, 'Raio interno', cc => { if (cc.type === 'shape') cc.params.inner = v }, `inn:${c.id}`)} />}
          <Controle rotulo="Proporção (largura ÷ altura)" v={c.aspect} min={0.1} max={10} passo={0.05} onChange={v => mudar(c.id, 'Proporção', cc => { if (cc.type === 'shape') cc.aspect = v }, `asp:${c.id}`)} />
        </div>
      )}

      {/* máscara */}
      <div className="space-y-1 text-xs" data-mascara>
        <p className="font-semibold flex items-center gap-1">Máscara {m && <span className={`text-[10px] font-normal ${m.enabled === false ? 'text-gray-400' : 'text-emerald-700'}`}>{m.enabled === false ? 'desativada' : 'ativa'}</span>}</p>
        {!m ? (
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => setMascara({ gradient: { type: 'linear', x0: 0.3, y0: 0.5, x1: 0.7, y1: 0.5, stops: [{ pos: 0, alpha: 0 }, { pos: 1, alpha: 1 }] } }, 'Máscara em degradê')} data-mascara-degrade><Plus className="w-3 h-3" /> Degradê</button>
            {c.type === 'image' && <button className={btn} onClick={() => setPixels('mascara')} data-pintar-mascara><Brush className="w-3 h-3" /> Pintar / selecionar…</button>}
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
            <button className={btn} onClick={() => setMascara(null, 'Excluir máscara')} data-excluir-mascara><Trash2 className="w-3 h-3" /></button>
          </div>
        </>)}
      </div>

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
