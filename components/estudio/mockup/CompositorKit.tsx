'use client'
// SOA Design — COMPOSITOR VISUAL do kit: arrumar as caixas (arrastar, redimensionar, girar, frente/trás, alinhar,
// centralizar, distribuir, ocultar, bloquear) e salvar a disposição como COMPOSIÇÃO (posições NORMALIZADAS por slot) —
// reutilizável por qualquer tema do mesmo kit. Vários modelos por kit (Modelo 01, 02…). Mostra as caixas de um tema de
// exemplo (ou lisas).
'use no memo'
import { useEffect, useRef, useState } from 'react'
import { Save, Copy, ChevronUp, ChevronDown, Eye, EyeOff, Lock, Unlock, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal, Columns3, Loader2 } from 'lucide-react'
import { posicoesPadrao, type MotorKit, type KitTemplate, type Composicao, type PosicaoSlot } from '@/lib/estudio/kitMotor'
import type { BoxInstancia } from '@/lib/estudio/caixaViva'
import { inp, btn, btnP, cartao } from '../caixas/comum'

const PROPORCOES = [{ v: 1, n: 'Quadrada 1:1' }, { v: 0.8, n: 'Retrato 4:5' }, { v: 1.5, n: 'Paisagem 3:2' }, { v: 16 / 9, n: 'Larga 16:9' }, { v: 2 / 3, n: 'Vertical 2:3' }]

export default function CompositorKit({ kit, comp, caixas, motor, onSalvo }: { kit: KitTemplate; comp: Composicao | null; caixas: Record<string, BoxInstancia | undefined>; motor: MotorKit; onSalvo: (c: Composicao) => void }) {
  const [nome, setNome] = useState(comp?.nome || `Modelo ${String(1).padStart(2, '0')}`)
  const [pos, setPos] = useState<Record<string, PosicaoSlot>>(() => ({ ...posicoesPadrao(kit.slots, Object.fromEntries(kit.slots.map(s => [s.id, motor.tpls.get(s.boxTemplateId)?.config.medidas?.a || 0]))), ...(comp?.posicoes || {}) }))
  const [prop, setProp] = useState(comp?.config.proporcao || 1)
  const [sel, setSel] = useState<string | null>(null)
  const [imgs, setImgs] = useState<Record<string, { url: string; width: number; height: number }>>({})
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const palco = useRef<HTMLDivElement>(null)
  // caixas do tema de exemplo (prévia, do cache do motor)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const out: Record<string, { url: string; width: number; height: number }> = {}
      for (const s of kit.slots) { const i = caixas[s.id]; if (!i) continue; const c = await motor.caixa(i, 'previa').catch(() => null); if (c) out[s.id] = { url: c.toDataURL('image/png'), width: c.width, height: c.height } }
      if (vivo) setImgs(out)
    })()
    return () => { vivo = false }
  }, [kit, caixas, motor])
  const mudar = (id: string, p: Partial<PosicaoSlot>) => setPos(x => ({ ...x, [id]: { ...x[id], ...p } }))
  const aspecto = (id: string) => (imgs[id] ? imgs[id].width / imgs[id].height : 0.8)
  const caixaTela = (id: string) => { const p = pos[id], h = p.escala, w = h * aspecto(id) / prop; return { x0: p.x - w / 2, y0: p.y - h / 2, w, h } }

  function arrastar(e: React.PointerEvent, id: string, tipo: 'mover' | 'escala' | 'giro') {
    if (e.button !== 0) return
    e.stopPropagation(); setSel(id)
    if (pos[id].bloqueado) return
    const b = palco.current!.getBoundingClientRect(), p0 = { ...pos[id] }, x0 = e.clientX, y0 = e.clientY
    const cx = b.left + p0.x * b.width, cy = b.top + p0.y * b.height, d0 = Math.hypot(x0 - cx, y0 - cy) || 1, a0 = Math.atan2(y0 - cy, x0 - cx)
    const mov = (ev: PointerEvent) => {
      if (tipo === 'mover') mudar(id, { x: Math.max(0, Math.min(1, p0.x + (ev.clientX - x0) / b.width)), y: Math.max(0, Math.min(1, p0.y + (ev.clientY - y0) / b.height)) })
      else if (tipo === 'escala') mudar(id, { escala: Math.max(0.05, Math.min(1.5, p0.escala * (Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0))) })
      else { let r = p0.rot + ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180) / Math.PI; r = ((r + 540) % 360) - 180; if (ev.shiftKey) r = Math.round(r / 15) * 15; mudar(id, { rot: Math.round(r) }) }
    }
    const sol = () => { window.removeEventListener('pointermove', mov); window.removeEventListener('pointerup', sol) }
    window.addEventListener('pointermove', mov); window.addEventListener('pointerup', sol)
  }
  const visiveis = kit.slots.filter(s => pos[s.id] && !pos[s.id].oculto)
  function alinhar(como: 'esq' | 'dir' | 'topo' | 'base' | 'centroH' | 'centroV') {
    if (!sel) return
    const c = caixaTela(sel)
    if (como === 'esq') mudar(sel, { x: c.w / 2 + 0.02 }); else if (como === 'dir') mudar(sel, { x: 1 - c.w / 2 - 0.02 })
    else if (como === 'topo') mudar(sel, { y: c.h / 2 + 0.02 }); else if (como === 'base') mudar(sel, { y: 1 - c.h / 2 - 0.02 })
    else if (como === 'centroH') mudar(sel, { x: 0.5 }); else mudar(sel, { y: 0.5 })
  }
  /** Bases alinhadas (todas as caixas no mesmo "chão"). */
  const alinharBases = () => { const base = Math.max(...visiveis.map(s => caixaTela(s.id).y0 + caixaTela(s.id).h)); setPos(x => { const y = { ...x }; for (const s of visiveis) if (!y[s.id].bloqueado) y[s.id] = { ...y[s.id], y: base - y[s.id].escala / 2 }; return y }) }
  /** Distribui na horizontal com espaço igual entre as caixas. */
  const distribuir = () => {
    const vs = visiveis.filter(s => !pos[s.id].bloqueado).sort((a, b) => pos[a.id].x - pos[b.id].x)
    if (vs.length < 3) return
    const ws = vs.map(s => caixaTela(s.id).w), total = ws.reduce((a, b) => a + b, 0), x0 = caixaTela(vs[0].id).x0, x1 = caixaTela(vs[vs.length - 1].id).x0 + ws[ws.length - 1]
    const gap = (x1 - x0 - total) / (vs.length - 1)
    let x = x0
    setPos(p => { const y = { ...p }; vs.forEach((s, i) => { y[s.id] = { ...y[s.id], x: x + ws[i] / 2 }; x += ws[i] + gap }); return y })
  }
  const zMax = Math.max(0, ...Object.values(pos).map(p => p.z)), zMin = Math.min(0, ...Object.values(pos).map(p => p.z))

  async function salvar(comoNovo: boolean) {
    setOcupado('Salvando a composição…'); setErro('')
    try {
      const novo = comoNovo || !comp
      const corpo = { nome: comoNovo ? `${nome} (cópia)` : nome, kitTemplateId: kit.id, posicoes: pos, config: { proporcao: prop }, versao: novo ? 1 : (comp!.versao || 1) + 1 }
      const r = await fetch(novo ? '/api/estudio/composicoes' : `/api/estudio/composicoes/${comp!.id}`, { method: novo ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      const c: Composicao = { id: novo ? j.id : comp!.id, ...corpo }
      setAviso(`Composição “${c.nome}” salva${novo ? '' : ` (v${c.versao} — temas antigos seguem na versão deles)`}. Serve para qualquer tema deste kit.`)
      onSalvo(c)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  const pSel = sel ? pos[sel] : null
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      <div className={`${cartao} space-y-2`}>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button onClick={() => alinhar('esq')} title="Alinhar à esquerda" className={btn + ' !px-2 !py-1'} disabled={!sel}><AlignStartVertical className="w-3.5 h-3.5" /></button>
          <button onClick={() => alinhar('centroH')} title="Centralizar na horizontal" className={btn + ' !px-2 !py-1'} disabled={!sel} data-centralizar><AlignHorizontalJustifyCenter className="w-3.5 h-3.5" /></button>
          <button onClick={() => alinhar('dir')} title="Alinhar à direita" className={btn + ' !px-2 !py-1'} disabled={!sel}><AlignEndVertical className="w-3.5 h-3.5" /></button>
          <button onClick={() => alinhar('topo')} title="Alinhar ao topo" className={btn + ' !px-2 !py-1'} disabled={!sel}><AlignStartHorizontal className="w-3.5 h-3.5" /></button>
          <button onClick={() => alinhar('centroV')} title="Centralizar na vertical" className={btn + ' !px-2 !py-1'} disabled={!sel}><AlignVerticalJustifyCenter className="w-3.5 h-3.5" /></button>
          <button onClick={() => alinhar('base')} title="Alinhar à base" className={btn + ' !px-2 !py-1'} disabled={!sel}><AlignEndHorizontal className="w-3.5 h-3.5" /></button>
          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
          <button onClick={alinharBases} className={btn + ' !px-2 !py-1 !text-xs'} data-alinhar-bases>Bases no mesmo chão</button>
          <button onClick={distribuir} className={btn + ' !px-2 !py-1 !text-xs'} data-distribuir><Columns3 className="w-3.5 h-3.5" /> Distribuir</button>
          {sel && <>
            <span className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
            <button onClick={() => mudar(sel, { z: zMax + 1 })} title="Trazer para frente" className={btn + ' !px-2 !py-1'} data-frente><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => mudar(sel, { z: zMin - 1 })} title="Enviar para trás" className={btn + ' !px-2 !py-1'}><ChevronDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => mudar(sel, { oculto: !pos[sel].oculto })} title="Ocultar" className={btn + ' !px-2 !py-1'}>{pos[sel].oculto ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
            <button onClick={() => mudar(sel, { bloqueado: !pos[sel].bloqueado })} title="Bloquear" className={btn + ' !px-2 !py-1'} data-bloquear>{pos[sel].bloqueado ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</button>
          </>}
        </div>
        <div ref={palco} className="relative w-full rounded-lg overflow-hidden select-none" style={{ aspectRatio: String(prop), background: 'repeating-conic-gradient(#f3f4f6 0% 25%, #ffffff 0% 50%) 50% / 20px 20px', touchAction: 'none' }} onPointerDown={() => setSel(null)} data-palco-kit>
          {[...kit.slots].sort((a, b) => (pos[a.id]?.z || 0) - (pos[b.id]?.z || 0)).map(s => {
            const p = pos[s.id]; if (!p || p.oculto) return null
            const c = caixaTela(s.id)
            return (
              <div key={s.id} data-slot-kit={s.name} onPointerDown={e => arrastar(e, s.id, 'mover')} className={`absolute ${sel === s.id ? 'outline outline-2 outline-orange-500' : 'hover:outline hover:outline-1 hover:outline-orange-300'} ${p.bloqueado ? 'cursor-not-allowed' : 'cursor-move'}`}
                style={{ left: `${c.x0 * 100}%`, top: `${c.y0 * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, transform: `rotate(${p.rot}deg)` }}>
                {imgs[s.id] ? <img src={imgs[s.id].url} alt={s.name} className="w-full h-full object-contain pointer-events-none" /> : <div className="w-full h-full rounded bg-gray-200/70 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-500">{caixas[s.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : s.name}</div>}
                <span className="absolute -top-4 left-0 text-[9px] bg-white/85 text-gray-700 px-1 rounded pointer-events-none">{s.name}{p.bloqueado ? ' 🔒' : ''}</span>
                {sel === s.id && !p.bloqueado && <>
                  <span onPointerDown={e => arrastar(e, s.id, 'escala')} className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize" data-escala-kit />
                  <span onPointerDown={e => arrastar(e, s.id, 'giro')} className="absolute left-1/2 -top-6 -translate-x-1/2 w-3.5 h-3.5 bg-orange-500 border-2 border-white rounded-full cursor-grab" data-giro-kit />
                </>}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-500">Arraste as caixas; canto = tamanho, bolinha = giro (Shift: de 15 em 15°). Posições salvas em proporção — valem para qualquer tamanho de saída.</p>
      </div>
      <div className="space-y-3">
        <div className={`${cartao} space-y-2`}>
          <input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Modelo 01" data-nome-comp />
          <select className={inp} value={prop} onChange={e => setProp(Number(e.target.value))} data-proporcao>{PROPORCOES.map(p => <option key={p.n} value={p.v}>{p.n}</option>)}</select>
          {pSel && sel && <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
            <label>Tamanho {Math.round(pSel.escala * 100)}%<input type="range" min={5} max={120} value={Math.round(pSel.escala * 100)} onChange={e => mudar(sel, { escala: Number(e.target.value) / 100 })} className="w-full accent-orange-500" /></label>
            <label>Giro {pSel.rot}°<input type="range" min={-180} max={180} value={pSel.rot} onChange={e => mudar(sel, { rot: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
          </div>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => salvar(false)} disabled={!!ocupado} className={btnP + ' justify-center'} data-salvar-comp><Save className="w-4 h-4" /> {comp ? 'Salvar' : 'Salvar modelo'}</button>
            <button onClick={() => salvar(true)} disabled={!!ocupado || !comp} className={btn + ' justify-center'} data-duplicar-comp><Copy className="w-4 h-4" /> Novo modelo</button>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          {aviso && <p className="text-xs text-emerald-700" data-aviso-comp>{aviso}</p>}
        </div>
        <div className={`${cartao} space-y-1 text-xs`}>
          <p className="font-semibold">Caixas</p>
          {kit.slots.map(s => <button key={s.id} onClick={() => setSel(s.id)} className={`w-full flex items-center gap-1.5 rounded px-1.5 py-1 text-left ${sel === s.id ? 'bg-orange-50 dark:bg-orange-950/30' : ''}`}><span className="flex-1 truncate">{s.name}</span>{pos[s.id]?.oculto && <EyeOff className="w-3 h-3 text-gray-400" />}{pos[s.id]?.bloqueado && <Lock className="w-3 h-3 text-gray-400" />}<span className="text-gray-400">z{pos[s.id]?.z}</span></button>)}
        </div>
      </div>
    </div>
  )
}
