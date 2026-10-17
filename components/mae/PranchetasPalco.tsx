'use client'
'use no memo'
// PRANCHETAS LIVRES (Lote 1, itens 10–12): cada prancheta tem uma BARRA DE TÍTULO no palco — arrastar move a
// prancheta (com ímã nas outras e guias), clicar seleciona e abre o MENU RÁPIDO (girar, redimensionar,
// duplicar, excluir). A posição fica salva na base. Tudo passa pelo histórico (Ctrl+Z desfaz).
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { useState } from 'react'
import { Group, Layer, Line, Rect, Text } from 'react-konva'
import { RotateCw, RotateCcw, Copy, Trash2, Scaling } from 'lucide-react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { medidasFolha } from '@/lib/mae/schema'
import { duplicarPrancheta, excluirPrancheta, fixarPosicoes, girarPrancheta, imaPrancheta, moldesForaDaPrancheta, redimensionarPrancheta, type ModoOrganizar, type Pos } from '@/lib/mae/editor/pranchetas'
import { useEditor } from './estado'
import { desfazerGlobal } from '@/lib/mae/editor/linhaDoTempo'
import { adicionarRapido, VARIAVEIS_RAPIDAS } from './TextosPaginas'

const ALTURA_PX = 18
const nomeDa = (a: { widthMm: number; heightMm: number; name?: string }) => a.name ?? `${Math.round(a.widthMm)} × ${Math.round(a.heightMm)} mm ${a.widthMm > a.heightMm ? '· paisagem' : '· retrato'}`

/** Barras de título (Konva) — dentro do Stage. */
export function TitulosPranchetas({ ps, escala }: { ps: Pos[]; escala: number }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const sel = useEditor(s => s.prancheta)
  const [guias, setGuias] = useState<{ x?: number; y?: number } | null>(null)
  const fino = 1 / escala, alt = ALTURA_PX * fino
  return (
    <Layer data-titulos-pranchetas>
      {doc.artboards.map((a, i) => {
        const outras = doc.artboards.flatMap((b, j) => (j === i ? [] : [{ xMm: ps[j].xMm, yMm: ps[j].yMm, wMm: b.widthMm, hMm: b.heightMm }]))
        const ativa = sel === a.id
        return (
          <Group key={`${a.id}:${ps[i].xMm}:${ps[i].yMm}`} x={ps[i].xMm} y={ps[i].yMm - alt - 2 * fino} draggable
            onPointerDown={ev => { ev.evt.stopPropagation() }}   // não arrasta a vista junto
            onClick={() => useEditor.getState().set({ prancheta: a.id })}
            onDragMove={ev => {
              const p = { xMm: ev.target.x(), yMm: ev.target.y() + alt + 2 * fino }
              const s = imaPrancheta(p, a.widthMm, a.heightMm, outras, 6 * fino)
              ev.target.position({ x: s.xMm, y: s.yMm - alt - 2 * fino })
              setGuias(s.guiaX !== undefined || s.guiaY !== undefined ? { x: s.guiaX, y: s.guiaY } : null)
            }}
            onDragEnd={ev => {
              setGuias(null)
              const x = Math.round(ev.target.x() * 10) / 10, y = Math.round((ev.target.y() + alt + 2 * fino) * 10) / 10
              useMaeDoc.getState().aplicar('Mover prancheta', d => { fixarPosicoes(d); const b = d.artboards.find(z => z.id === a.id); if (b) { b.xMm = x; b.yMm = y } })
              useEditor.getState().set({ prancheta: a.id })
            }} data-titulo-prancheta={i}>
            <Rect width={Math.max(a.widthMm, 60 * fino)} height={alt} fill={ativa ? '#f97316' : '#e2e8f0'} cornerRadius={3 * fino}
              onMouseEnter={ev => { const c = ev.target.getStage()?.container(); if (c) c.style.cursor = 'move' }} onMouseLeave={ev => { const c = ev.target.getStage()?.container(); if (c) c.style.cursor = '' }} />
            <Text x={5 * fino} y={4 * fino} text={`⠿  ${nomeDa(a)}`} fontSize={10 * fino} fill={ativa ? '#ffffff' : '#334155'} />
            {/* fantasma da prancheta durante o arraste */}
            <Rect y={alt + 2 * fino} width={a.widthMm} height={a.heightMm} stroke={ativa ? '#f97316' : 'rgba(0,0,0,0)'} strokeWidth={2} strokeScaleEnabled={false} listening={false} />
            {/* Lote 3 (item 10): a BORDA da prancheta também arrasta (faixa fina, por fora da arte) */}
            <Rect y={alt + 2 * fino} width={a.widthMm} height={a.heightMm} fillEnabled={false} stroke="rgba(0,0,0,0)" strokeWidth={1} hitStrokeWidth={10} strokeScaleEnabled={false}
              onMouseEnter={ev => { const c = ev.target.getStage()?.container(); if (c) c.style.cursor = 'move' }} onMouseLeave={ev => { const c = ev.target.getStage()?.container(); if (c) c.style.cursor = '' }} data-borda-prancheta={i} />
          </Group>
        )
      })}
      {guias?.x !== undefined && <Line points={[guias.x, -100000, guias.x, 100000]} stroke="#ec4899" strokeWidth={1} strokeScaleEnabled={false} dash={[4 * fino, 3 * fino]} listening={false} />}
      {guias?.y !== undefined && <Line points={[-100000, guias.y, 100000, guias.y]} stroke="#ec4899" strokeWidth={1} strokeScaleEnabled={false} dash={[4 * fino, 3 * fino]} listening={false} />}
    </Layer>
  )
}

const ib = 'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-orange-50 disabled:opacity-40'

/** Menu rápido (HTML por cima do palco) da prancheta selecionada. */
export function MenuPrancheta({ ps, viewport, edita = true, onOrganizar, area }: { ps: Pos[]; viewport: { escala: number; x: number; y: number }; edita?: boolean; onOrganizar?: (m: ModoOrganizar) => void; area?: { w: number; h: number } }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const sel = useEditor(s => s.prancheta)
  // Lote 6 (item 109): no Tema o menu não fica por cima da arte — vira um botãozinho na barra de título e abre ao clicar
  const [aberto, setAberto] = useState<string | null>(null)
  // Lote 23 (item 266): barra recolhida (só o ⋯) e o menu que abre para cima
  const [recolhida, setRecolhida] = useState(() => { try { return localStorage.getItem('mae:barra-prancheta') === 'recolhida' } catch { return false } })
  const [pop, setPop] = useState<'textos' | 'tudo' | null>(null)
  const i = doc.artboards.findIndex(a => a.id === sel)
  if (i < 0) return null
  const a = doc.artboards[i]
  if (!edita && aberto !== a.id) {
    const bx = viewport.x + (ps[i].xMm + Math.max(a.widthMm, 60 / viewport.escala)) * viewport.escala - 26, by = viewport.y + ps[i].yMm * viewport.escala - ALTURA_PX - 2
    if (doc.artboards.length <= 1) return null
    return <button className="absolute z-10 rounded bg-white/90 px-1.5 text-[11px] leading-[16px] text-gray-700 shadow hover:bg-orange-50" style={{ left: Math.max(4, area ? Math.min(bx, area.w - 30) : bx), top: Math.max(4, by) }} onClick={() => setAberto(a.id)} title="Organizar as pranchetas" data-menu-prancheta-abrir>⋯</button>
  }
  // Lote 23 (item 266): a barra NUNCA fica por cima da arte nem do molde — mora DENTRO da faixa laranja do título
  // (acima da prancheta), alinhada à direita, numa linha só. Textos rápidos e "Organizar" ficam num menu que abre PARA
  // CIMA (por fora da prancheta); faixa estreita ou "recolher" → só o "⋯", que abre tudo.
  // a faixa do título (TitulosPranchetas): ALTURA_PX de altura, 2 px acima da prancheta, no mínimo 60 px de largura
  const xL = viewport.x + ps[i].xMm * viewport.escala, larguraPx = Math.max(a.widthMm * viewport.escala, 60)
  const yFaixa = viewport.y + ps[i].yMm * viewport.escala - ALTURA_PX - 2
  const nomeLarg = Math.min(larguraPx * 0.35, nomeDa(a).length * 6 + 14)
  const livre = larguraPx - nomeLarg
  // aviso calculado na hora: some sozinho com o Ctrl+Z ou quando os moldes voltam para dentro
  const fora = moldesForaDaPrancheta(doc, a.id)
  const aplicar = (label: string, f: Parameters<ReturnType<typeof useMaeDoc.getState>['aplicar']>[1]) => useMaeDoc.getState().aplicar(label, f)
  function girar(sentido: 1 | -1) {
    const temMoldes = doc.molds.some(m => m.artboardId === a.id)
    aplicar('Girar prancheta', d => girarPrancheta(d, a.id, { comMoldes: true, sentido }))
    // girados junto e mesmo assim fora da folha (já estavam fora antes): oferece "Só a folha"
    if (temMoldes && moldesForaDaPrancheta(useMaeDoc.getState().hist.atual, a.id).length && confirm('Os moldes não couberam girados junto. Girar só a folha (os moldes ficam como estavam)?')) {
      desfazerGlobal()   // Lote 8 (item 122): pela linha do tempo (o desfazer direto deixava uma entrada órfã)
      aplicar('Girar prancheta (só a folha)', d => girarPrancheta(d, a.id, { comMoldes: false }))
    }
  }
  function redimensionar(v: string) {
    if (!v) return
    const paisagem = a.widthMm > a.heightMm
    let w: number, h: number
    if (v === 'personalizada') {
      const r = prompt('Largura × altura em mm (ex.: 200 x 300)', `${a.widthMm} x ${a.heightMm}`)
      const m = r?.replace(',', '.').match(/([\d.]+)\s*[x×]\s*([\d.]+)/i)
      if (!m) return
      w = Number(m[1]); h = Number(m[2])
      if (!(w > 0 && h > 0 && w <= 2000 && h <= 2000)) { alert('Informe largura e altura em mm (até 2000 mm).'); return }
    } else ({ widthMm: w, heightMm: h } = medidasFolha(v as 'A4' | 'A5' | 'A6', paisagem ? 'paisagem' : 'retrato'))
    aplicar(`Redimensionar prancheta (${v})`, d => redimensionarPrancheta(d, a.id, w, h))
  }
  const compacta = recolhida || livre < 150
  const paraCima = yFaixa > 150
  const estiloPop = paraCima ? { bottom: '100%', marginBottom: 2 } : { top: '100%', marginTop: 2 }
  const ic = ib + ' !px-1 !py-0 h-[16px]'
  const organizar = doc.artboards.length > 1 && onOrganizar ? (
    <select value="" onChange={e => { if (e.target.value) { onOrganizar(e.target.value as ModoOrganizar); setPop(null); if (!edita) setAberto(null) } }} className="rounded-md bg-white px-1 py-0.5 text-[11px] text-gray-700" title="Organizar as pranchetas (só a vista)" data-organizar-pranchetas>
      <option value="">Organizar…</option><option value="linha">Em linha</option><option value="coluna">Em coluna</option><option value="grade">Em grade</option>
    </select>
  ) : null
  const botoes = edita ? (<>
    {/* Lote 4 (item 41): os moldes giram 90° junto e se recentralizam; girar de novo sempre volta (↻ e ↺) */}
    <button className={ic} onClick={() => girar(1)} title="Girar 90° no sentido horário — retrato ↔ paisagem, com os moldes" aria-label="Girar" data-prancheta-girar><RotateCw className="w-3 h-3" /></button>
    <button className={ic} onClick={() => girar(-1)} title="Girar 90° no sentido anti-horário, com os moldes" aria-label="Girar no sentido anti-horário" data-prancheta-girar-anti><RotateCcw className="w-3 h-3" /></button>
    <label className={ic} title="Redimensionar — A4, A5, A6 ou personalizado"><Scaling className="w-3 h-3" />
      <select value="" onChange={e => redimensionar(e.target.value)} className="w-[14px] bg-transparent text-[11px]" aria-label="Tamanho da prancheta" data-prancheta-tamanho>
        <option value="">Tamanho…</option><option value="A4">A4</option><option value="A5">A5</option><option value="A6">A6</option><option value="personalizada">Personalizado…</option>
      </select>
    </label>
    <button className={ic} onClick={() => { let id: string | null = null; aplicar('Duplicar prancheta', d => { id = duplicarPrancheta(d, a.id) }); if (id) useEditor.getState().set({ prancheta: id }) }} title="Duplicar — com os moldes" aria-label="Duplicar" data-prancheta-duplicar><Copy className="w-3 h-3" /></button>
    <button className={ic + ' hover:!bg-red-50 text-red-600'} disabled={doc.artboards.length <= 1} title={doc.artboards.length <= 1 ? 'A área de trabalho precisa de pelo menos uma prancheta' : 'Excluir a prancheta e os moldes dela (Ctrl+Z desfaz)'}
      onClick={() => excluirSelecionada()} aria-label="Excluir" data-prancheta-excluir><Trash2 className="w-3 h-3" /></button>
  </>) : null
  // Lote 4 (item 52): textos rápidos nesta prancheta (mesma posição das outras páginas, se já houver)
  const textos = edita && doc.molds.some(m => m.artboardId === a.id && m.faces.length) ? (
    <span className="flex flex-wrap items-center gap-0.5" data-textos-rapidos>
      {VARIAVEIS_RAPIDAS.map(v => <button key={v} className={ib} onClick={() => { adicionarRapido(a.id, v); setPop(null) }} title={`Pôr ${v} nesta prancheta`} data-prancheta-mais={v}>+ {rotuloVariavel(v)}</button>)}
    </span>
  ) : null
  const guardarRecolhida = (v: boolean) => { setRecolhida(v); setPop(null); try { localStorage.setItem('mae:barra-prancheta', v ? 'recolhida' : 'aberta') } catch { /* ok */ } }
  return (
    <div className="absolute z-10 flex items-center justify-end gap-0.5" style={{ left: Math.max(2, xL + nomeLarg), width: Math.max(24, livre), top: Math.max(2, yFaixa), height: ALTURA_PX }} data-menu-prancheta>
      {fora.length > 0 && <span className="truncate rounded bg-amber-100 px-1 text-[10px] text-amber-800" title={`Ficaram fora da folha: ${fora.join(', ')} — arraste para dentro ou gire de volta (Ctrl+Z).`} data-aviso-prancheta>⚠ fora da folha</span>}
      {!edita && <span className="px-1 text-[10px] text-white" title="Girar, tamanho, duplicar e excluir ficam na aba 1. Base." data-menu-so-vista>ⓘ</span>}
      {compacta
        ? <button className={ic + ' bg-white/90'} onClick={() => setPop(pop === 'tudo' ? null : 'tudo')} title="Opções da prancheta" aria-label="Opções da prancheta" data-prancheta-mais-opcoes>⋯</button>
        : <span className="flex items-center gap-0.5 rounded bg-white/90 px-0.5 shadow-sm" data-barra-prancheta>
            {botoes}
            {(textos || organizar) && <button className={ic} onClick={() => setPop(pop === 'textos' ? null : 'textos')} title="Textos rápidos e organizar" data-prancheta-textos-abrir>{textos ? '+ Texto ▾' : 'Organizar ▾'}</button>}
            {edita && <button className={ic + ' text-gray-400'} onClick={() => guardarRecolhida(true)} title="Recolher a barra (fica só o ⋯)" aria-label="Recolher a barra" data-prancheta-recolher>‹</button>}
            {!edita && <button className={ic} onClick={() => setAberto(null)} aria-label="Fechar" data-menu-prancheta-fechar>✕</button>}
          </span>}
      {pop && (
        <div className="absolute right-0 z-20 flex max-w-[26rem] flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1 py-1 shadow-md" style={estiloPop} data-pop-prancheta>
          {pop === 'tudo' && botoes}
          {textos}
          {organizar}
          {pop === 'tudo' && recolhida && <button className={ib} onClick={() => guardarRecolhida(false)} data-prancheta-expandir>Mostrar a barra</button>}
          {pop === 'tudo' && !edita && <button className={ib} onClick={() => { setPop(null); setAberto(null) }} aria-label="Fechar">✕</button>}
        </div>
      )}
    </div>
  )
}

/** Exclui a prancheta selecionada (com a confirmação da Naty; Ctrl+Z traz de volta). Botão do menu e tecla Delete. */
export function excluirSelecionada(): boolean {
  const sel = useEditor.getState().prancheta
  const doc = useMaeDoc.getState().hist.atual
  if (!sel || doc.artboards.length <= 1 || !doc.artboards.some(a => a.id === sel)) return false
  if (!confirm('Excluir a prancheta e os moldes dela?')) return true
  useMaeDoc.getState().aplicar('Excluir prancheta', d => { excluirPrancheta(d, sel) })
  useEditor.getState().set({ prancheta: null })
  return true
}
