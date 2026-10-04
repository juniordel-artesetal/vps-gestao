'use client'
'use no memo'
// Painel "Moldes e faces" (Sprints 3+4): importar, lista de moldes, "Fechar pontilhado" + detectar de
// novo, ferramentas (selecionar, medir, laço, dividir, unir, ímã) e ações da face selecionada.
import { useEffect, useRef, useState } from 'react'
import { FileUp, MousePointer2, Ruler, Lasso, Scissors, Combine, Magnet, Trash2, RefreshCw, CircleDashed, Square, AlertTriangle, Loader2 } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { ACEITOS } from '@/lib/mae/importacao/navegador'
import { alternarFuro, excluirFace, vizinhasDe } from '@/lib/mae/faces/ferramentas'
import { facesDaReceita } from '@/lib/mae/editor/moldes'
import { sugerirEquivalentes } from '@/lib/mae/faces/equivalentes'
import { area } from '@/lib/mae/faces/geometria'
import ImportarMoldes from './ImportarMoldes'
import { detectarDeNovo, editarFaces, excluirMolde, garantirPreparado, preparadoDe, useMoldes, type Modo } from './moldesEditor'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const fmt = (n: number, c = 1) => (Math.round(n * 10 ** c) / 10 ** c).toLocaleString('pt-BR')

const FERRAMENTAS: { modo: Modo; rotulo: string; dica: string; Icone: typeof Ruler }[] = [
  { modo: 'selecionar', rotulo: 'Selecionar', dica: 'Clique numa face', Icone: MousePointer2 },
  { modo: 'medir', rotulo: 'Medir', dica: 'Clique em 2 pontos: mostra a distância em mm', Icone: Ruler },
  { modo: 'laco', rotulo: 'Laço', dica: 'Clique nos cantos da face; Enter fecha (substitui as faces que cobrir)', Icone: Lasso },
  { modo: 'dividir', rotulo: 'Dividir', dica: 'Clique em 2 pontos atravessando a face', Icone: Scissors },
  { modo: 'unir', rotulo: 'Unir', dica: 'Selecione uma face e clique na vizinha', Icone: Combine },
]

/** Lista de equivalentes da face selecionada (todas as faces de todos os moldes). */
export function equivalentesDaSelecao(): { moldeId: string; faceId: string; nota: number }[] {
  const sel = useMoldes.getState().face
  if (!sel) return []
  const doc = useMaeDoc.getState().hist.atual
  const lista = doc.molds.flatMap(m => {
    const fe = facesDaReceita(m.faces)
    return fe.map((f, i) => ({ moldeId: m.id, faceId: f.id!, poligono: f.poligono, furo: f.furo, vizinhas: vizinhasDe(fe, i).filter(v => !fe[v].furo).length }))
  })
  return sugerirEquivalentes(lista, sel)
}

export default function PainelMoldes() {
  const moldes = useMaeDoc(s => s.hist.atual.molds)
  const raiz = useBiblioteca(s => s.raiz)
  const liberada = useBiblioteca(s => s.liberada)
  const { modo, ima, face, ocupado, aviso, medida } = useMoldes()
  const set = useMoldes.getState().set
  const [arquivos, setArquivos] = useState<File[] | null>(null)
  const [moldeSel, setMoldeSel] = useState<string | null>(null)
  const [fechar, setFechar] = useState<Record<string, number>>({})
  const [faltando, setFaltando] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  // recarrega máscara/prévia dos moldes que vieram de uma receita (abrir teste, recarregar)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const falta = new Set<string>()
      for (const m of moldes) {
        if (preparadoDe(m.id)) continue
        const p = await garantirPreparado(m, liberada ? raiz : null).catch(() => null)
        if (!p) falta.add(m.id)
      }
      if (vivo) setFaltando(falta)
    })()
    return () => { vivo = false }
  }, [moldes, raiz, liberada])

  // arrastar arquivos para o palco também abre o diálogo
  useEffect(() => {
    const abrir = (e: Event) => setArquivos((e as CustomEvent<File[]>).detail)
    window.addEventListener('mae:importar-moldes', abrir)
    return () => window.removeEventListener('mae:importar-moldes', abrir)
  }, [])

  async function escolher() {
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const hs = await window.showOpenFilePicker({ id: 'mae-moldes', multiple: true, types: [{ description: 'Moldes', accept: { 'application/pdf': ['.pdf'], 'image/svg+xml': ['.svg'], 'application/dxf': ['.dxf'], 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] } }] })
        setArquivos(await Promise.all(hs.map(h => h.getFile())))
      } catch (e) { if ((e as { name?: string })?.name !== 'AbortError') inputRef.current?.click() }
    } else inputRef.current?.click()
  }

  const mSel = moldes.find(m => m.id === (face?.moldeId ?? moldeSel)) ?? null
  const faceObj = face ? mSel?.faces.find(f => f.id === face.faceId) ?? null : null
  const eqs = face ? equivalentesDaSelecao() : []
  const nomeMolde = (id: string) => moldes.find(m => m.id === id)?.name ?? id
  const rotuloFace = (mId: string, fId: string) => `${nomeMolde(mId)} · ${fId.split('_').pop()}`

  function acaoFace(label: string, f: (faces: ReturnType<typeof facesDaReceita>, i: number) => ReturnType<typeof facesDaReceita> | null) {
    if (!face) return
    editarFaces(face.moldeId, label, faces => { const i = faces.findIndex(x => x.id === face.faceId); return i < 0 ? null : f(faces, i) })
    set({ face: null })
  }

  return (
    <section className="space-y-2" data-painel-moldes>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Moldes e faces</h2>
        <span className="text-[11px] text-gray-400">{moldes.length ? `${moldes.length} molde${moldes.length > 1 ? 's' : ''}` : ''}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={escolher} disabled={!liberada} title="PDF, SVG, DXF, PNG ou JPG — vários de uma vez (ou arraste para a folha)" data-importar-moldes-btn><FileUp className="w-3.5 h-3.5" /> Importar moldes…</button>
        <input ref={inputRef} type="file" multiple accept={ACEITOS} className="hidden" onChange={e => { if (e.target.files?.length) setArquivos(Array.from(e.target.files)); e.target.value = '' }} data-input-moldes />
      </div>
      {!liberada && <p className="text-[11px] text-gray-400">Conecte a pasta Biblioteca MAE para importar.</p>}
      {ocupado && <p className="text-xs text-gray-500 flex items-center gap-1" data-ocupado-moldes><Loader2 className="w-3.5 h-3.5 animate-spin" /> {ocupado}</p>}
      {aviso && <p className="text-xs text-red-600 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{aviso}</p>}

      {moldes.length > 0 && (
        <ul className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800" data-lista-moldes>
          {moldes.map(m => {
            const faces = m.faces.filter(f => !f.hole), furos = m.faces.length - faces.length
            const dobras = m.faces.reduce((s, f) => s + (f.edges ?? []).filter(e => e.kind === 'fold').length, 0)
            const ativo = mSel?.id === m.id
            return (
              <li key={m.id} className={`px-2 py-1.5 text-xs cursor-pointer ${ativo ? 'bg-orange-50 dark:bg-orange-950/30' : ''}`} onClick={() => { setMoldeSel(m.id); if (face?.moldeId !== m.id) set({ face: null }) }} data-molde={m.name}>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{m.name}</span>
                  <span className="ml-auto text-[10px] uppercase text-gray-400">{m.source.kind}</span>
                </div>
                <div className="text-[11px] text-gray-500 tabular-nums" data-resumo-molde>
                  {fmt(m.source.widthMm)} × {fmt(m.source.heightMm ?? 0)} mm · <b data-n-faces>{faces.length}</b> faces · {furos} furos · {dobras} dobras
                </div>
                {faltando.has(m.id) && <div className="text-[11px] text-red-600 flex gap-1"><AlertTriangle className="w-3 h-3 mt-px" /> arquivo não encontrado na Biblioteca ({m.source.path})</div>}
              </li>
            )
          })}
        </ul>
      )}

      {mSel && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-molde-sel>
          <label className="block text-[11px] text-gray-500">
            <span className="flex justify-between"><span>Fechar pontilhado</span><span className="tabular-nums" data-fechar-valor>{fmt(fechar[mSel.id] ?? mSel.detection?.closeMm ?? 0.25, 2)} mm</span></span>
            <input type="range" min={0} max={3} step={0.05} value={fechar[mSel.id] ?? mSel.detection?.closeMm ?? 0.25}
              onChange={e => setFechar(f => ({ ...f, [mSel.id]: Number(e.target.value) }))} className="w-full accent-orange-500" data-fechar />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} disabled={!preparadoDe(mSel.id) || !!ocupado} onClick={() => detectarDeNovo(mSel.id, fechar[mSel.id] ?? mSel.detection?.closeMm ?? 0.25)} title="Refaz as faces deste molde (os ajustes manuais se perdem; Ctrl+Z volta)" data-detectar><RefreshCw className="w-3.5 h-3.5" /> Detectar de novo</button>
            <button className={btn} onClick={() => { if (confirm(`Excluir o molde ${mSel.name}? (Ctrl+Z desfaz)`)) excluirMolde(mSel.id) }} data-excluir-molde><Trash2 className="w-3.5 h-3.5" /> Excluir molde</button>
          </div>
          <p className="text-[10px] text-gray-400">Linha pontilhada ou que não fecha? Aumente o &ldquo;Fechar pontilhado&rdquo; e detecte de novo.</p>
        </div>
      )}

      {moldes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1" data-ferramentas>
            {FERRAMENTAS.map(({ modo: m, rotulo, dica, Icone }) => (
              <button key={m} className={btn + (modo === m ? ' !border-orange-500 bg-orange-50 text-orange-800' : '')} title={dica} onClick={() => set({ modo: m, pontos: [], moldeDosPontos: null, medida: m === 'medir' ? medida : null })} data-ferramenta={m}>
                <Icone className="w-3.5 h-3.5" /> {rotulo}
              </button>
            ))}
            <button className={btn + (ima ? ' !border-sky-500 bg-sky-50 text-sky-800' : '')} title="Ímã: os cliques grudam no centro da linha do molde" onClick={() => set({ ima: !ima })} data-ima><Magnet className="w-3.5 h-3.5" /> Ímã</button>
          </div>
          <p className="text-[11px] text-gray-500" data-dica-ferramenta>{FERRAMENTAS.find(f => f.modo === modo)?.dica}{modo !== 'selecionar' && ' · Esc cancela'}</p>
          {medida && <p className="text-xs font-semibold text-sky-700" data-medida>Distância: {fmt(medida.mm, 2)} mm</p>}
        </div>
      )}

      {faceObj && face && (
        <div className="rounded-lg border border-orange-200 dark:border-orange-900 p-2 space-y-1.5 text-xs" data-face-sel>
          <div className="flex items-center gap-1">
            <b>{rotuloFace(face.moldeId, face.faceId)}</b>
            <span className="text-gray-500">{faceObj.hole ? '· furo' : ''} · {fmt(area(faceObj.polygonMm as [number, number][]) / 100, 1)} cm²</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} onClick={() => acaoFace(faceObj.hole ? 'Furo → face' : 'Face → furo', (f, i) => alternarFuro(f, i))} data-alternar-furo>
              {faceObj.hole ? <Square className="w-3.5 h-3.5" /> : <CircleDashed className="w-3.5 h-3.5" />} {faceObj.hole ? 'É face' : 'É furo'}
            </button>
            <button className={btn} onClick={() => acaoFace('Excluir face', (f, i) => excluirFace(f, i))} data-excluir-face><Trash2 className="w-3.5 h-3.5" /> Excluir face</button>
          </div>
          {!faceObj.hole && (
            <div data-equivalentes>
              <p className="text-[11px] text-gray-500">Parecidas (sugestão para a Sprint 5 — partes):</p>
              {eqs.length ? (
                <ul className="flex flex-wrap gap-1 mt-1">
                  {eqs.slice(0, 8).map(e => (
                    <li key={e.moldeId + e.faceId}>
                      <button className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[11px] text-amber-800 hover:border-amber-400" onClick={() => set({ face: { moldeId: e.moldeId, faceId: e.faceId } })} data-equivalente={e.faceId}>
                        {rotuloFace(e.moldeId, e.faceId)} <b>{Math.round(e.nota * 100)}%</b>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[11px] text-gray-400">Nenhuma parecida.</p>}
            </div>
          )}
        </div>
      )}
      {arquivos && <ImportarMoldes arquivos={arquivos} onFechar={() => setArquivos(null)} />}
    </section>
  )
}
