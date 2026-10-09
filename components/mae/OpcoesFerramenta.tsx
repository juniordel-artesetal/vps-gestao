'use client'
'use no memo'
// Lote 4 (item 39): as OPÇÕES PRINCIPAIS da ferramenta escolhida numa faixa horizontal acima da arte (padrão
// Photoshop). O painel da função continua com tudo; aqui ficam as mais usadas, do que está selecionado:
//  · Tema — texto (tamanho, cor, alinhamento, caixa), moldurinha (distância, espessura, pesponto, cantos, cor),
//    transição (direção, posição, suavidade), papel/elemento (escala, giro, opacidade, preencher/repetir, vazar,
//    aplique, ocultar);
//  · Base — posição de texto (tamanho, giro, + NOME/IDADE/HASHTAG) e prancheta (girar ↻ ↺, duplicar).
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { useState } from 'react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'
import { ESTILO_PADRAO, type EstiloTexto } from '@/lib/mae/texto/noTexto'
import { NOMES_DIRECAO, type DirecaoTransicao, type Transicao } from '@/lib/mae/vinculo/transicao'
import { escalarPosicao } from '@/lib/mae/editor/posicaoTexto'
import { girarPrancheta, duplicarPrancheta } from '@/lib/mae/editor/pranchetas'
import type { DocTema } from '@/lib/mae/schema'
import { useEditor, type ModoEditor } from './estado'
import { editarCamadaTema, mudarTransicao } from './acoesVinculo'
import { adicionarRapido, VARIAVEIS_RAPIDAS } from './TextosPaginas'

const b = (on = false) => `rounded-md border px-1.5 py-0.5 text-[11px] ${on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 dark:border-gray-700 hover:border-orange-400'}`
const sep = <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

/** Número com unidade: digita e Enter (ou sai do campo); ↑↓ = 1 passo, Shift = 10. */
function Num({ rotulo, v, onMudar, sufixo = '', passo = 1, min = -Infinity, max = Infinity, dado }: { rotulo: string; v: number; onMudar: (n: number) => void; sufixo?: string; passo?: number; min?: number; max?: number; dado: string }) {
  const [txt, setTxt] = useState<string | null>(null)
  const mostrar = (n: number) => (Math.round(n * 100) / 100).toLocaleString('pt-BR')
  const confirmar = (s: string) => { const n = Number(s.replace(',', '.')); setTxt(null); if (Number.isFinite(n)) onMudar(Math.min(max, Math.max(min, n))) }
  return (
    <label className="flex items-center gap-1 text-[11px] text-gray-500">{rotulo}
      <input inputMode="decimal" value={txt ?? mostrar(v)} onChange={e => setTxt(e.target.value)} onBlur={e => txt !== null && confirmar(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar((e.target as HTMLInputElement).value) }
          else if (e.key === 'Escape') setTxt(null)
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const k = (e.shiftKey ? 10 : 1) * passo * (e.key === 'ArrowUp' ? 1 : -1); onMudar(Math.min(max, Math.max(min, v + k))); setTxt(null) }
        }}
        className="w-14 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-right text-gray-800 dark:text-gray-100" data-opcao={dado} />
      {sufixo && <span className="text-gray-400">{sufixo}</span>}
    </label>
  )
}

export default function OpcoesFerramenta({ modo }: { modo: Exclude<ModoEditor, 'imagem'> }) {
  return modo === 'tema' ? <OpcoesTema /> : <OpcoesBase />
}

function OpcoesTema() {
  const funcao = useEditor(s => s.funcao), camada = useEditor(s => s.camada), slot = useEditor(s => s.slot)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const doc = useMaeDoc(s => s.hist.atual)
  if (!tema) return null
  // ── texto ──
  if (funcao === 'texto' || (slot && !camada)) {
    const variavel = doc.textSlots.find(t => t.id === slot)?.variable ?? doc.textSlots[0]?.variable ?? 'NOME'
    const estilo: EstiloTexto = tema.textStyles?.[variavel] ?? ESTILO_PADRAO
    const mudar = (label: string, f: (e: EstiloTexto) => void, j?: string) => useMaeTema.getState().aplicar(label, t => {
      const tt = t as DocTema; tt.textStyles ??= {}
      if (!tt.textStyles[variavel]) tt.textStyles[variavel] = JSON.parse(JSON.stringify(ESTILO_PADRAO))
      f(tt.textStyles[variavel])
    }, j ? `op:${variavel}:${j}` : undefined)
    return (
      <span className="flex flex-wrap items-center gap-2" data-opcoes-texto>
        <b className="text-[11px] text-gray-700 dark:text-gray-200">{variavel === 'ARROBA' ? '@' : variavel}</b>
        <Num rotulo="Tamanho" v={(estilo.sizeScale ?? 1) * 100} sufixo="%" min={20} max={400} onMudar={n => mudar('Tamanho do texto (todas)', e => { e.sizeScale = Math.round(n) / 100 }, 'tam')} dado="texto-tam" />
        <label className="flex items-center gap-1 text-[11px] text-gray-500">Cor <input type="color" value={estilo.color} onChange={e => mudar('Cor do texto', x => { x.color = e.target.value }, 'cor')} className="h-5 w-6" data-opcao="texto-cor" /></label>
        {sep}
        {([['left', 'Esq.'], ['center', 'Centro'], ['right', 'Dir.']] as const).map(([v, r]) => <button key={v} className={b(estilo.align === v)} onClick={() => mudar('Alinhamento', e => { e.align = v })} data-opcao-alinhar={v}>{r}</button>)}
        {sep}
        {([['normal', 'Aa'], ['alta', 'AA'], ['baixa', 'aa']] as const).map(([v, r]) => <button key={v} className={b(estilo.caixa === v)} onClick={() => mudar('Caixa do texto', e => { e.caixa = v })} data-opcao-caixa={v}>{r}</button>)}
      </span>
    )
  }
  const achada = camada ? acharCamadaTema(tema, camada) : null
  if (!achada) return <span className="text-gray-400" data-opcoes-vazio>Selecione algo na arte para ver as opções aqui.</span>
  const c = achada.c as DocTema['partContent'][string][number] & { type: string; transition?: Transicao; opacity?: number; bleed?: boolean; applique?: { enabled: boolean }; repeat?: unknown; anchor?: string }
  const mudarC = (label: string, f: (x: typeof c) => void, j?: string) => useMaeTema.getState().aplicar(label, t => { const a = acharCamadaTema(t as DocTema, c.id); if (a) f(a.c as typeof c) }, j ? `op:${c.id}:${j}` : undefined)
  // ── moldurinha ──
  if (c.type === 'frame') {
    const m = c as unknown as { offsetMm: number; widthMm: number; dash: { onMm: number; offMm: number } | null; cornerMm: number; color: string }
    const mm = (p: Partial<typeof m>, label: string, j?: string) => mudarC(label, x => Object.assign(x, p), j)
    return (
      <span className="flex flex-wrap items-center gap-2" data-opcoes-moldura>
        <Num rotulo="Distância" v={m.offsetMm} passo={0.1} sufixo="mm" min={0} max={20} onMudar={n => mm({ offsetMm: n }, 'Distância da moldura', 'off')} dado="moldura-distancia" />
        <Num rotulo="Espessura" v={m.widthMm} passo={0.05} sufixo="mm" min={0.1} max={5} onMudar={n => mm({ widthMm: n }, 'Espessura da moldura', 'w')} dado="moldura-espessura" />
        {sep}
        <button className={b(!m.dash)} onClick={() => mm({ dash: null }, 'Moldura contínua')}>Contínua</button>
        <button className={b(!!m.dash)} onClick={() => mm({ dash: m.dash ?? { onMm: 2, offMm: 1.5 } }, 'Moldura pesponto')} data-opcao-pesponto>Pesponto</button>
        {sep}
        <button className={b(m.cornerMm === 0)} onClick={() => mm({ cornerMm: 0 }, 'Cantos vivos')}>Cantos vivos</button>
        <button className={b(m.cornerMm > 0)} onClick={() => mm({ cornerMm: m.cornerMm > 0 ? m.cornerMm : 3 }, 'Cantos arredondados')}>Arredondados</button>
        <label className="flex items-center gap-1 text-[11px] text-gray-500">Cor <input type="color" value={m.color} onChange={e => mm({ color: e.target.value }, 'Cor da moldura', 'cor')} className="h-5 w-6" /></label>
      </span>
    )
  }
  // ── transição ──
  if (c.transition) {
    const tr = c.transition
    return (
      <span className="flex flex-wrap items-center gap-2" data-opcoes-transicao>
        <label className="flex items-center gap-1 text-[11px] text-gray-500">Direção
          <select value={tr.dir} onChange={e => mudarTransicao(c.id, { dir: e.target.value as DirecaoTransicao })} className="rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-[11px]" data-opcao="transicao-direcao">
            {(Object.keys(NOMES_DIRECAO) as DirecaoTransicao[]).map(d => <option key={d} value={d}>{NOMES_DIRECAO[d]}</option>)}
          </select>
        </label>
        <Num rotulo="Posição" v={tr.pos * 100} sufixo="%" min={0} max={100} onMudar={n => mudarTransicao(c.id, { pos: n / 100 }, `tr:${c.id}:pos`)} dado="transicao-pos" />
        <Num rotulo="Suavidade" v={tr.soft * 100} sufixo="%" min={2} max={100} onMudar={n => mudarTransicao(c.id, { soft: n / 100 }, `tr:${c.id}:soft`)} dado="transicao-suave" />
      </span>
    )
  }
  // ── papel / elemento / forma / cor ──
  const T = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0, ...((c as { transform?: object }).transform ?? {}) } as { scale: number; rotationDeg: number }
  const papel = c.type === 'image' && (c.anchor ?? 'face') === 'paper'
  return (
    <span className="flex flex-wrap items-center gap-2" data-opcoes-camada>
      <Num rotulo="Escala" v={T.scale * 100} sufixo="%" min={2} max={2000} onMudar={n => editarCamadaTema(c.id, { transform: { scale: n / 100 } }, 'Escala')} dado="camada-escala" />
      <Num rotulo="Giro" v={T.rotationDeg} sufixo="°" min={-180} max={180} onMudar={n => editarCamadaTema(c.id, { transform: { rotationDeg: n } }, 'Girar')} dado="camada-giro" />
      <Num rotulo="Opacidade" v={(c.opacity ?? 1) * 100} sufixo="%" min={0} max={100} onMudar={n => mudarC('Opacidade', x => { if (n >= 99.5) delete x.opacity; else x.opacity = Math.round(n) / 100 }, 'op')} dado="camada-opacidade" />
      {papel && <>{sep}
        <button className={b(!c.repeat)} onClick={() => mudarC('Papel: preencher', x => { delete x.repeat })} data-opcao-papel="preencher">Preencher</button>
        <button className={b(!!c.repeat)} onClick={() => mudarC('Papel: repetir', x => { if (!x.repeat) x.repeat = { sizeMm: 40, mirror: false } })} data-opcao-papel="repetir">Repetir (padrão)</button>
      </>}
      {c.type === 'image' && !papel && <>{sep}
        <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" className="accent-orange-500" checked={!!c.bleed} onChange={e => mudarC(e.target.checked ? 'Pode vazar da face' : 'Recortar na face', x => { if (e.target.checked) x.bleed = true; else delete x.bleed })} data-opcao="vazar" /> Pode vazar</label>
        <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" className="accent-orange-500" checked={!!c.applique?.enabled} onChange={e => mudarC(e.target.checked ? 'Marcar como aplique 3D' : 'Tirar aplique 3D', x => { if (e.target.checked) x.applique = { ...(x.applique ?? {}), enabled: true }; else delete x.applique })} data-opcao="aplique" /> Aplique 3D</label>
      </>}
      {sep}
      <button className={b(false)} onClick={() => editarCamadaTema(c.id, { visible: (c as { visible?: boolean }).visible === false }, (c as { visible?: boolean }).visible === false ? 'Mostrar' : 'Ocultar')} data-opcao="ocultar">{(c as { visible?: boolean }).visible === false ? 'Mostrar' : 'Ocultar'}</button>
    </span>
  )
}

function OpcoesBase() {
  const funcao = useEditor(s => s.funcao), slot = useEditor(s => s.slot), prancheta = useEditor(s => s.prancheta)
  const doc = useMaeDoc(s => s.hist.atual)
  const s = doc.textSlots.find(t => t.id === slot)
  if (funcao === 'passo-6' && s) {
    const mudar = (label: string, f: (t: NonNullable<typeof s>) => void) => useMaeDoc.getState().aplicar(label, d => { const t = d.textSlots.find(x => x.id === s.id); if (t) f(t as NonNullable<typeof s>) })
    return (
      <span className="flex flex-wrap items-center gap-2" data-opcoes-posicao-texto>
        <b className="text-[11px] text-gray-700 dark:text-gray-200">{s.variable}</b>
        <Num rotulo="Tamanho" v={s.single?.sizePt ?? 28} sufixo="pt" min={4} max={200} passo={0.5} onMudar={n => mudar('Tamanho do texto', t => { const k = n / (t.single?.sizePt ?? 28); if (k > 0) escalarPosicao(t, k) })} dado="slot-tamanho" />
        <Num rotulo="Giro" v={s.rotationDeg ?? 0} sufixo="°" min={-180} max={180} onMudar={n => mudar('Girar texto', t => { t.rotationDeg = n })} dado="slot-giro" />
        {prancheta && <>{sep}{VARIAVEIS_RAPIDAS.map(v => <button key={v} className={b()} onClick={() => adicionarRapido(prancheta, v)}>+ {rotuloVariavel(v)}</button>)}</>}
      </span>
    )
  }
  const ab = doc.artboards.find(a => a.id === prancheta)
  if (ab) {
    const aplicar = (label: string, f: Parameters<ReturnType<typeof useMaeDoc.getState>['aplicar']>[1]) => useMaeDoc.getState().aplicar(label, f)
    return (
      <span className="flex flex-wrap items-center gap-2" data-opcoes-prancheta>
        <b className="text-[11px] text-gray-700 dark:text-gray-200">{ab.name ?? `${Math.round(ab.widthMm)} × ${Math.round(ab.heightMm)} mm`}</b>
        <button className={b()} onClick={() => aplicar('Girar prancheta', d => girarPrancheta(d, ab.id, { comMoldes: true, sentido: 1 }))} data-opcao="girar">Girar ↻</button>
        <button className={b()} onClick={() => aplicar('Girar prancheta', d => girarPrancheta(d, ab.id, { comMoldes: true, sentido: -1 }))}>Girar ↺</button>
        <button className={b()} onClick={() => { let id: string | null = null; aplicar('Duplicar prancheta', d => { id = duplicarPrancheta(d, ab.id) }); if (id) useEditor.getState().set({ prancheta: id }) }}>Duplicar</button>
      </span>
    )
  }
  return <span className="text-gray-400" data-opcoes-vazio>Selecione uma prancheta ou um texto para ver as opções aqui.</span>
}
