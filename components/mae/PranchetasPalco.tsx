'use client'
'use no memo'
// PRANCHETAS LIVRES (Lote 1, itens 10–12): cada prancheta tem uma BARRA DE TÍTULO no palco — arrastar move a
// prancheta (com ímã nas outras e guias), clicar seleciona e abre o MENU RÁPIDO (girar, redimensionar,
// duplicar, excluir). A posição fica salva na base. Tudo passa pelo histórico (Ctrl+Z desfaz).
import { useState } from 'react'
import { Group, Layer, Line, Rect, Text } from 'react-konva'
import { RotateCw, Copy, Trash2, Scaling } from 'lucide-react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { medidasFolha } from '@/lib/mae/schema'
import { duplicarPrancheta, excluirPrancheta, fixarPosicoes, girarPrancheta, imaPrancheta, moldesForaDaPrancheta, redimensionarPrancheta, type ModoOrganizar, type Pos } from '@/lib/mae/editor/pranchetas'
import { useEditor } from './estado'

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
            onClick={() => useEditor.getState().set({ prancheta: ativa ? null : a.id })}
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
export function MenuPrancheta({ ps, viewport, edita = true, onOrganizar }: { ps: Pos[]; viewport: { escala: number; x: number; y: number }; edita?: boolean; onOrganizar?: (m: ModoOrganizar) => void }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const sel = useEditor(s => s.prancheta)
  const i = doc.artboards.findIndex(a => a.id === sel)
  if (i < 0) return null
  const a = doc.artboards[i]
  // sobre a prancheta (canto de cima), sem tapar a barra de título — que é por onde se arrasta
  const left = viewport.x + ps[i].xMm * viewport.escala + 6, top = viewport.y + ps[i].yMm * viewport.escala + 6
  // aviso calculado na hora: some sozinho com o Ctrl+Z ou quando os moldes voltam para dentro
  const fora = moldesForaDaPrancheta(doc, a.id)
  const aplicar = (label: string, f: Parameters<ReturnType<typeof useMaeDoc.getState>['aplicar']>[1]) => useMaeDoc.getState().aplicar(label, f)
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
  return (
    <div className="absolute z-10 flex max-w-[30rem] flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-white/95 px-1 py-0.5 shadow-md" style={{ left: Math.max(4, left), top: Math.max(4, top) }} data-menu-prancheta>
      {doc.artboards.length > 1 && onOrganizar && (
        <select value="" onChange={e => { if (e.target.value) onOrganizar(e.target.value as ModoOrganizar) }} className="rounded-md bg-transparent px-1 py-1 text-[11px] text-gray-700" title="Organizar as pranchetas (só a vista — não muda o arquivo exportado)" data-menu-organizar>
          <option value="">Organizar…</option><option value="linha">Em linha</option><option value="coluna">Em coluna</option><option value="grade">Em grade</option>
        </select>
      )}
      {!edita && <span className="px-1 text-[10px] text-gray-500" data-menu-so-vista>As pranchetas vêm da base — girar, tamanho, duplicar e excluir ficam na aba <b>1. Base</b>.</span>}
      {edita && <>
      <button className={ib} onClick={() => aplicar('Girar prancheta', d => girarPrancheta(d, a.id))} title="Girar — retrato ↔ paisagem" data-prancheta-girar><RotateCw className="w-3.5 h-3.5" /> Girar</button>
      <label className={ib} title="Redimensionar — A4, A5, A6 ou personalizado"><Scaling className="w-3.5 h-3.5" />
        <select value="" onChange={e => redimensionar(e.target.value)} className="bg-transparent text-[11px]" data-prancheta-tamanho>
          <option value="">Tamanho…</option><option value="A4">A4</option><option value="A5">A5</option><option value="A6">A6</option><option value="personalizada">Personalizado…</option>
        </select>
      </label>
      <button className={ib} onClick={() => { let id: string | null = null; aplicar('Duplicar prancheta', d => { id = duplicarPrancheta(d, a.id) }); if (id) useEditor.getState().set({ prancheta: id }) }} title="Duplicar — com os moldes (a cópia já sai vinculada às partes)" data-prancheta-duplicar><Copy className="w-3.5 h-3.5" /> Duplicar</button>
      <button className={ib + ' hover:!bg-red-50 text-red-600'} disabled={doc.artboards.length <= 1} title={doc.artboards.length <= 1 ? 'A área de trabalho precisa de pelo menos uma prancheta' : 'Excluir a prancheta e os moldes dela (Ctrl+Z desfaz)'}
        onClick={() => excluirSelecionada()} data-prancheta-excluir><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
      </>}
      {fora.length > 0 && <span className="w-full px-1 text-[10px] text-amber-700" data-aviso-prancheta>Ficaram fora da folha: {fora.join(', ')} — arraste para dentro ou gire de volta (Ctrl+Z).</span>}
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
