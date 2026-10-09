'use client'
'use no memo'
// Lote 4 — textos do Tema pronto e da base:
//  · item 52: REPLICAR NOME/IDADE/HASHTAG entre as páginas ("Colocar em todas as páginas", "+ NOME · + IDADE ·
//    + HASHTAG" na prancheta, Ctrl+C/Ctrl+V, Ctrl+J). Todas as cópias usam a mesma variável e o mesmo estilo;
//    posição, tamanho e giro ficam por caixa.
//  · item 50: NOME SIMPLES × NOME COMPOSTO — cada modo com o seu tamanho, entrelinha, linhas (composto 1 ou 2)
//    e posição, por caixa; prévia com "Isis" e "Ana Júlia".
import { useState } from 'react'
import { Copy, CopyPlus, Plus } from 'lucide-react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import type { DocTema } from '@/lib/mae/schema'
import { adicionarNaPrancheta, colarNaPrancheta, colocarEmTodas, duplicarPosicao, pranchetaDaFace, type PosicaoTexto } from '@/lib/mae/editor/textosReplicar'
import Deslizador from './Deslizador'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { useEditor } from './estado'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium hover:border-orange-400 disabled:opacity-40'
const ativo = ' !border-orange-500 bg-orange-50 text-orange-800'
export const VARIAVEIS_RAPIDAS = ['NOME', 'IDADE', 'HASHTAG', 'NOME_IDADE', 'SUFIXO'] as const

// ── área de transferência das posições de texto (Ctrl+C / Ctrl+V) ──
let copiada: PosicaoTexto | null = null
export function copiarPosicao(): boolean {
  const id = useEditor.getState().slot
  const s = id ? useMaeDoc.getState().hist.atual.textSlots.find(t => t.id === id) : null
  if (!s) return false
  copiada = JSON.parse(JSON.stringify(s))
  return true
}
/** Cola na prancheta selecionada (clique na barra dela); sem prancheta selecionada, na mesma da cópia. */
export function colarPosicao(): boolean {
  if (!copiada) return false
  const d = useMaeDoc.getState().hist.atual
  const ab = useEditor.getState().prancheta ?? pranchetaDaFace(d, copiada.faceId)
  if (!ab) return false
  let id: string | null = null
  useMaeDoc.getState().aplicar(`Colar ${copiada.variable}`, x => { id = colarNaPrancheta(x as never, copiada!, ab) })
  if (id) useEditor.getState().set({ slot: id })
  return !!id
}
export function duplicarPosicaoSel(): boolean {
  const sid = useEditor.getState().slot
  if (!sid || !useMaeDoc.getState().hist.atual.textSlots.some(t => t.id === sid)) return false
  let id: string | null = null
  useMaeDoc.getState().aplicar('Duplicar texto', x => { id = duplicarPosicao(x as never, sid) })
  if (id) useEditor.getState().set({ slot: id })
  return !!id
}
export function adicionarRapido(abId: string, variavel: string) {
  let id: string | null = null
  useMaeDoc.getState().aplicar(`+ ${variavel}`, x => { id = adicionarNaPrancheta(x as never, abId, variavel) })
  if (id) useEditor.getState().set({ slot: id })
}

/** Botões do item 52 para a posição selecionada (ou a 1ª da variável). */
export function ReplicarTextos({ variavel }: { variavel?: string }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const slotSel = useEditor(s => s.slot)
  const prancheta = useEditor(s => s.prancheta)
  const [msg, setMsg] = useState<string | null>(null)
  const sel = doc.textSlots.find(t => t.id === slotSel && (!variavel || t.variable === variavel)) ?? (variavel ? doc.textSlots.find(t => t.variable === variavel) : null)
  const abSel = prancheta ?? (sel ? pranchetaDaFace(doc, sel.faceId) : null)
  const abNome = abSel ? doc.artboards.find(a => a.id === abSel)?.name ?? 'prancheta' : null
  function todas() {
    if (!sel) return
    let n = 0
    useMaeDoc.getState().aplicar(`${sel.variable} em todas as páginas`, x => { n = colocarEmTodas(x as never, sel.id) })
    setMsg(n ? `${sel.variable} colocado em mais ${n} página(s), na mesma posição.` : `Todas as páginas já têm ${sel.variable}.`)
  }
  return (
    <div className="space-y-1" data-replicar-textos>
      {doc.artboards.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button className={btn} disabled={!sel} onClick={todas} title="Cria este texto em todas as outras páginas, na mesma posição (mesmo estilo; posição e tamanho ajustáveis por caixa)" data-colocar-todas><CopyPlus className="w-3.5 h-3.5" /> Colocar em todas as páginas</button>
          <button className={btn} disabled={!sel} onClick={() => duplicarPosicaoSel()} title="Duplicar nesta caixa (Ctrl+J). Alt + arrastar também duplica." data-duplicar-texto><Copy className="w-3.5 h-3.5" /> Duplicar</button>
        </div>
      )}
      {abSel && (
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500" data-mais-rapido>
          <span className="truncate max-w-[8rem]" title={abNome ?? ''}>Em {abNome}:</span>
          {VARIAVEIS_RAPIDAS.map(v => <button key={v} className={btn} onClick={() => adicionarRapido(abSel, v)} data-mais-var={v}><Plus className="w-3 h-3" />{rotuloVariavel(v)}</button>)}
        </div>
      )}
      <p className="text-[10px] text-gray-400">Ctrl+C e Ctrl+V: copia o texto e cola na prancheta escolhida (clique na barra dela), na mesma posição. Arrastar a caixa até outra página também leva o texto.</p>
      {msg && <p className="text-[10px] text-emerald-700" data-msg-replicar>{msg}</p>}
    </div>
  )
}

/** Item 50: nome simples × nome composto, cada um com a sua configuração por caixa. */
export function ModoDoNome({ variavel, modo, setModo }: { variavel: string; modo: 'simples' | 'composto'; setModo: (m: 'simples' | 'composto') => void }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const slotSel = useEditor(s => s.slot)
  const amostra = String(tema?.sample?.[variavel] ?? '')
  const sel = doc.textSlots.find(t => t.id === slotSel && t.variable === variavel)
  const alvos = sel ? [sel] : doc.textSlots.filter(t => t.variable === variavel)
  if (!alvos.length) return null
  const base = alvos[0]
  const cfg = modo === 'simples' ? base.single ?? { lines: 1 as const, sizePt: 28 } : base.compound ?? { lines: 2 as const, sizePt: 22, lineHeight: 0.9 }
  const chave = modo === 'simples' ? 'single' : 'compound'
  const mudar = (label: string, f: (c: NonNullable<PosicaoTexto['single']>) => void, juntar?: string) => useMaeDoc.getState().aplicar(`${label} (${modo === 'simples' ? 'nome simples' : 'nome composto'})`, d => {
    for (const a of alvos) {
      const t = d.textSlots.find(x => x.id === a.id); if (!t) continue
      t[chave] ??= modo === 'simples' ? { lines: 1, sizePt: 28 } : { lines: 2, sizePt: 22, lineHeight: 0.9 }
      f(t[chave]!)
    }
  }, juntar)
  function trocar(m: 'simples' | 'composto') {
    setModo(m)
    // prévia com um nome de exemplo do modo (o tema mostra como fica)
    const ex = m === 'simples' ? 'Isis' : 'Ana Júlia'
    if (tema && (amostra.trim().split(/\s+/).length >= 2) !== (m === 'composto')) useMaeTema.getState().aplicar('Prévia do nome', t => { (t as DocTema).sample = { ...(t as DocTema).sample, [variavel]: ex } })
  }
  const pronto = !!doc.pronto
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-modo-nome>
      <div className="flex items-center gap-1">
        <button className={btn + (modo === 'simples' ? ativo : '')} onClick={() => trocar('simples')} title="1 palavra (ex.: Isis)" data-nome-simples>Nome simples</button>
        <button className={btn + (modo === 'composto' ? ativo : '')} onClick={() => trocar('composto')} title="2 palavras ou mais (ex.: Ana Júlia)" data-nome-composto>Nome composto</button>
        <span className="ml-auto text-[10px] text-gray-400">{sel ? 'nesta caixa' : 'em todas as caixas'}</span>
      </div>
      <p className="text-[10px] text-gray-500">Na edição em massa, nome de 1 palavra usa o <b>simples</b>; de 2 ou mais, o <b>composto</b>.{!pronto && ' Vale para a base (todos os temas dela).'}</p>
      {modo === 'composto' && (
        <div className="flex gap-1" data-composto-linhas-painel>
          {([1, 2] as const).map(n => <button key={n} className={btn + (cfg.lines === n ? ativo : '')} onClick={() => mudar('Linhas', c => { c.lines = n })} data-composto-n={n}>{n} linha{n > 1 ? 's' : ''}</button>)}
        </div>
      )}
      <label className="block text-[10px] text-gray-500">Tamanho
        <Deslizador min={6} max={120} step={0.5} value={cfg.sizePt} unidade="pt" onChange={e => mudar('Tamanho', c => { c.sizePt = Number(e.target.value) }, `modo:${modo}:tam`)} className="w-full h-3 accent-orange-500" data-modo-tam />
      </label>
      {modo === 'composto' && (
        <label className="block text-[10px] text-gray-500">Entrelinha
          <Deslizador min={0.5} max={2} step={0.01} value={cfg.lineHeight ?? 0.9} unidade="%" fator={100} onChange={e => mudar('Entrelinha', c => { c.lineHeight = Number(e.target.value) }, `modo:${modo}:lh`)} className="w-full h-3 accent-orange-500" data-modo-entrelinha />
        </label>
      )}
      {modo === 'composto' && tema && (
        <label className="flex items-center gap-1.5 text-[11px]" title="Ligado: os Estilos (traçado, sombra…) abaixo valem só para o nome composto; o simples continua com os dele" data-efeitos-composto>
          <input type="checkbox" className="accent-orange-500" checked={!!(tema.textStyles?.[variavel] as { efeitosComposto?: unknown[] } | undefined)?.efeitosComposto}
            onChange={e => useMaeTema.getState().aplicar(e.target.checked ? 'Efeitos próprios do nome composto' : 'Composto com os efeitos do simples', t => {
              const st = (t as DocTema).textStyles?.[variavel] as ({ effects?: unknown[]; efeitosComposto?: unknown[] } | undefined)
              if (!st) return
              if (e.target.checked) st.efeitosComposto = JSON.parse(JSON.stringify(st.effects ?? []))
              else delete st.efeitosComposto
            })} />
          Efeitos próprios do nome composto
        </label>
      )}
      <div className="grid grid-cols-2 gap-1">
        <label className="block text-[10px] text-gray-500">Posição ↔
          <Deslizador min={-0.5} max={0.5} step={0.005} value={cfg.dx ?? 0} unidade="%" fator={100} onChange={e => mudar('Posição', c => { c.dx = Number(e.target.value) }, `modo:${modo}:dx`)} className="w-full h-3 accent-orange-500" data-modo-dx />
        </label>
        <label className="block text-[10px] text-gray-500">Posição ↕
          <Deslizador min={-0.5} max={0.5} step={0.005} value={cfg.dy ?? 0} unidade="%" fator={100} onChange={e => mudar('Posição', c => { c.dy = Number(e.target.value) }, `modo:${modo}:dy`)} className="w-full h-3 accent-orange-500" data-modo-dy />
        </label>
      </div>
    </div>
  )
}
