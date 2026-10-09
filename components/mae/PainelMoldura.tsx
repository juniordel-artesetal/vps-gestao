'use client'
'use no memo'
// MOLDURINHA (Lote 1, item 6): bordinha interna da face — distância da borda, espessura, contínua ou
// pesponto (traço/espaço), cantos vivos ou arredondados, cor (degradê, traçado, sombras, brilhos e chanfro
// pelos Estilos da camada). Várias = moldura dupla. Presets ficam na Biblioteca (Presets/Molduras/*.json).
import Deslizador from './Deslizador'
import { useEffect, useState } from 'react'
import { Frame, Save } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { gravar, ler, listar } from '@/lib/mae/biblioteca/arquivos'
import { MOLDURA_PADRAO, PESPONTO_PADRAO, type ParamsMoldura } from '@/lib/mae/vinculo/moldura'
import type { DocTema } from '@/lib/mae/schema'
import { criarMolduraNaParte, useRotuloAlvo } from './acoesVinculo'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativo = ' !border-orange-500 bg-orange-50 text-orange-800'
const PASTA = 'Presets/Molduras'

export interface PresetMoldura { nome: string; params: ParamsMoldura }

export async function listarPresetsMoldura(raiz: FileSystemDirectoryHandle): Promise<PresetMoldura[]> {
  const out: PresetMoldura[] = []
  try {
    for (const e of await listar(raiz, PASTA)) {
      if (e.tipo !== 'arquivo' || !e.nome.endsWith('.json')) continue
      try { const j = JSON.parse(await (await ler(raiz, `${PASTA}/${e.nome}`)).text()); if (j?.params) out.push({ nome: String(j.nome ?? e.nome.replace(/\.json$/, '')), params: { ...MOLDURA_PADRAO, ...j.params } }) } catch { /* arquivo inválido */ }
    }
  } catch { /* pasta ainda não existe */ }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function Medida({ rotulo, v, min, max, passo, sufixo, onChange, attr }: { rotulo: string; v: number; min: number; max: number; passo: number; sufixo: string; onChange: (n: number) => void; attr: string }) {
  return (
    <label className="block text-[11px] text-gray-500">
      <span>{rotulo}</span>
      <Deslizador min={min} max={max} step={passo} value={v} onChange={e => onChange(Number(e.target.value))} unidade={sufixo.trim()} data-moldura={attr} aria-label={rotulo} />
    </label>
  )
}

/** Miniatura de uma moldura (SVG): a face em branco com a linha na distância, espessura, traço e cantos. */
export function MiniaturaMoldura({ p }: { p: ParamsMoldura }) {
  const W = 56, H = 40, k = 1.6
  const off = Math.min(12, p.offsetMm * k), w = Math.max(0.6, p.widthMm * k), r = Math.min(10, p.cornerMm * k)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="rounded border border-gray-200 bg-white" aria-hidden>
      <rect x={off + w / 2} y={off + w / 2} width={Math.max(2, W - 2 * off - w)} height={Math.max(2, H - 2 * off - w)} rx={r} fill="none" stroke={p.color} strokeWidth={w}
        strokeDasharray={p.dash ? `${p.dash.onMm * k} ${p.dash.offMm * k}` : undefined} />
    </svg>
  )
}

/**
 * Lote 4 (item 45): o painel da MOLDURINHA (antes o ícone abria o de Camadas): criar, molduras salvas com
 * miniatura, e o editor (distância, espessura, contínua/pesponto, cantos, cor) da moldura da parte.
 */
export function PainelMolduras({ partId, camadaSel, onSelecionar }: { partId: string; camadaSel: string | null; onSelecionar: (id: string) => void }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const [presets, setPresets] = useState<PresetMoldura[]>([])
  useEffect(() => { if (raiz && liberada) listarPresetsMoldura(raiz).then(setPresets) }, [raiz, liberada])
  const alvo = useRotuloAlvo(partId)
  const molduras = ((tema?.partContent[partId] ?? []) as { id: string; type: string; name?: string }[]).filter(c => c.type === 'frame')
  const atual = molduras.find(m => m.id === camadaSel) ?? molduras.at(-1)
  return (
    <div className="space-y-2" data-painel-molduras>
      <button className={btn} onClick={() => criarMolduraNaParte(partId, MOLDURA_PADRAO)} title="Bordinha interna na face (contínua ou pesponto); clique de novo para moldura dupla" data-criar-moldura><Frame className="w-3.5 h-3.5" /> Nova moldurinha {alvo}</button>
      {presets.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold">Molduras salvas</p>
          <div className="grid grid-cols-3 gap-1.5" data-lista-presets-moldura>
            {presets.map(p => (
              <button key={p.nome} className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 p-1 text-[10px] hover:border-orange-400" title={`Aplicar "${p.nome}"`} onClick={() => criarMolduraNaParte(partId, p.params, p.nome)} data-preset-moldura={p.nome}>
                <MiniaturaMoldura p={p.params} /><span className="truncate w-full text-center">{p.nome}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {molduras.length > 1 && (
        <div className="flex flex-wrap gap-1">{molduras.map((m, i) => <button key={m.id} className={btn + (atual?.id === m.id ? ativo : '')} onClick={() => onSelecionar(m.id)} data-moldura-da-parte={i}>{m.name ?? `Moldura ${i + 1}`}</button>)}</div>
      )}
      {atual ? <EditarMoldura layerId={atual.id} /> : <p className="text-[11px] text-gray-400">Esta parte ainda não tem moldurinha.</p>}
    </div>
  )
}

/** Botão "Moldurinha" da parte (cria com o padrão ou com um preset). */
export default function NovaMoldura({ partId }: { partId: string }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [presets, setPresets] = useState<PresetMoldura[]>([])
  useEffect(() => { if (raiz && liberada) listarPresetsMoldura(raiz).then(setPresets) }, [raiz, liberada])
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-nova-moldura>
      <button className={btn} onClick={() => criarMolduraNaParte(partId, MOLDURA_PADRAO)} title="Moldurinha — bordinha interna na face (contínua ou pesponto); clique de novo para moldura dupla" data-criar-moldura><Frame className="w-3.5 h-3.5" /> Moldurinha</button>
      {presets.length > 0 && (
        <select className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px]" value="" onChange={e => { const p = presets.find(x => x.nome === e.target.value); if (p) criarMolduraNaParte(partId, p.params, p.nome) }} title="Aplicar uma moldura salva" data-preset-moldura>
          <option value="">Molduras salvas…</option>
          {presets.map(p => <option key={p.nome} value={p.nome}>{p.nome}</option>)}
        </select>
      )}
    </span>
  )
}

/** Controles da moldura selecionada (tudo ao vivo; deslizar junta num passo só de desfazer). */
export function EditarMoldura({ layerId }: { layerId: string }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const raiz = useBiblioteca(s => s.raiz)
  const [nomePreset, setNomePreset] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const a = tema ? acharCamadaTema(tema, layerId) : null
  const c = a?.c as unknown as (ParamsMoldura & { type: string; name?: string }) | undefined
  if (!c || c.type !== 'frame') return null
  const mudar = (p: Partial<ParamsMoldura>, label: string, j?: string) => useMaeTema.getState().aplicar(label, t => {
    const x = acharCamadaTema(t as DocTema, layerId)?.c as unknown as ParamsMoldura | undefined
    if (x) Object.assign(x, p)
  }, j ? `mold:${layerId}:${j}` : undefined)
  async function salvarPreset() {
    const nome = nomePreset.trim().slice(0, 60)
    if (!raiz || !nome || !c) return
    const params: ParamsMoldura = { offsetMm: c.offsetMm, widthMm: c.widthMm, dash: c.dash, cornerMm: c.cornerMm, color: c.color }
    await gravar(raiz, `${PASTA}/${nome.replace(/[\\/:*?"<>|]/g, '-')}.json`, JSON.stringify({ nome, params }, null, 2))
    setMsg(`Moldura "${nome}" salva — aparece em "Molduras salvas…" em qualquer tema.`); setNomePreset('')
  }
  return (
    <div className="rounded-lg border border-orange-200 p-1.5 space-y-1" data-editar-moldura>
      <p className="text-[11px] font-semibold flex items-center gap-1"><Frame className="w-3 h-3" /> Moldurinha</p>
      <Medida rotulo="Distância da borda" v={c.offsetMm} min={0} max={20} passo={0.1} sufixo="mm" attr="distancia" onChange={v => mudar({ offsetMm: v }, 'Distância da moldura', 'off')} />
      <Medida rotulo="Espessura" v={c.widthMm} min={0.1} max={5} passo={0.05} sufixo="mm" attr="espessura" onChange={v => mudar({ widthMm: v }, 'Espessura da moldura', 'w')} />
      <div className="flex gap-1">
        <button className={btn + (!c.dash ? ativo : '')} onClick={() => mudar({ dash: null }, 'Moldura contínua')} data-moldura-linha="continua">Contínua</button>
        <button className={btn + (c.dash ? ativo : '')} onClick={() => mudar({ dash: c.dash ?? PESPONTO_PADRAO }, 'Moldura pesponto')} data-moldura-linha="pesponto">Pesponto</button>
      </div>
      {c.dash && (<>
        <Medida rotulo="Tamanho do traço" v={c.dash.onMm} min={0.2} max={8} passo={0.1} sufixo="mm" attr="traco" onChange={v => mudar({ dash: { ...c.dash!, onMm: v } }, 'Traço do pesponto', 'on')} />
        <Medida rotulo="Espaço entre traços" v={c.dash.offMm} min={0.2} max={8} passo={0.1} sufixo="mm" attr="espaco" onChange={v => mudar({ dash: { ...c.dash!, offMm: v } }, 'Espaço do pesponto', 'offd')} />
      </>)}
      <div className="flex gap-1">
        <button className={btn + (c.cornerMm === 0 ? ativo : '')} onClick={() => mudar({ cornerMm: 0 }, 'Cantos vivos')} data-moldura-cantos="vivos">Cantos vivos</button>
        <button className={btn + (c.cornerMm > 0 ? ativo : '')} onClick={() => mudar({ cornerMm: c.cornerMm > 0 ? c.cornerMm : 3 }, 'Cantos arredondados')} data-moldura-cantos="redondos">Arredondados</button>
      </div>
      {c.cornerMm > 0 && <Medida rotulo="Arredondamento" v={c.cornerMm} min={0.5} max={20} passo={0.5} sufixo="mm" attr="raio" onChange={v => mudar({ cornerMm: v }, 'Arredondamento', 'r')} />}
      <label className="flex items-center gap-1 text-[11px] text-gray-500">Cor <input type="color" value={c.color} onChange={e => mudar({ color: e.target.value }, 'Cor da moldura', 'cor')} className="h-5 w-7" data-moldura="cor" /></label>
      <p className="text-[10px] text-gray-400">Degradê, traçado, sombras, brilhos e chanfro: em “Estilos da camada”, logo abaixo.</p>
      <div className="flex items-center gap-1">
        <input value={nomePreset} onChange={e => setNomePreset(e.target.value)} placeholder="Nome do preset" className="flex-1 min-w-0 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px]" data-nome-preset-moldura />
        <button className={btn} disabled={!nomePreset.trim() || !raiz} onClick={salvarPreset} title="Salvar esta moldura para reaplicar em outros temas" data-salvar-preset-moldura><Save className="w-3 h-3" /> Salvar</button>
      </div>
      {msg && <p className="text-[10px] text-emerald-700" data-msg-moldura>{msg}</p>}
    </div>
  )
}
