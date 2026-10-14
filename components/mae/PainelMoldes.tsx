'use client'
'use no memo'
// Painel "Moldes e faces" (Sprints 3+4): importar, lista de moldes, "Fechar pontilhado" + detectar de
// novo, ferramentas (selecionar, medir, laço, dividir, unir, ímã) e ações da face selecionada.
import { caixaDaPeca } from '@/lib/mae/editor/giroMolde'
import Deslizador from './Deslizador'
import { useEffect, useRef, useState } from 'react'
import { FileUp, MousePointer2, Ruler, Lasso, Scissors, Combine, Magnet, Trash2, RefreshCw, CircleDashed, Square, AlertTriangle, Loader2, Pencil } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { ACEITOS } from '@/lib/mae/importacao/navegador'
import { alternarFuro, excluirFace, vizinhasDe } from '@/lib/mae/faces/ferramentas'
import { facesDaReceita } from '@/lib/mae/editor/moldes'
import { sugerirEquivalentes } from '@/lib/mae/faces/equivalentes'
import { area } from '@/lib/mae/faces/geometria'
import ImportarMoldes from './ImportarMoldes'
import { AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Crosshair as Centro } from 'lucide-react'
import { alinhar, areaUtil, centralizarGrupo, distribuir, type ModoAlinhar } from '@/lib/mae/editor/alinhamento'
import { caixaDoMolde } from '@/lib/mae/exportar/linhas'
import { marcaNaFolha, zonasNaFolha } from '@/lib/mae/exportar/marca'
import { useMarcas, carregarMarcas, marcaDaPrancheta } from './marcasMae'
import { detectarDeNovo, editarFaces, excluirMolde, garantirPreparado, moverMoldes, preparadoDe, useMoldes, type Modo } from './moldesEditor'
import { facesDaMedida } from '@/lib/mae/medidas/pecas'
import { gravar, sha256 } from '@/lib/mae/biblioteca/arquivos'

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

/** Lote 5 (item 61): `parte` = só Moldes (importar, lista, posição, excluir) ou só Faces (fechar pontilhado, detectar, ferramentas). */
export default function PainelMoldes({ parte = 'tudo' }: { parte?: 'tudo' | 'moldes' | 'faces' }) {
  const moldes = useMaeDoc(s => s.hist.atual.molds)
  const raiz = useBiblioteca(s => s.raiz)
  const liberada = useBiblioteca(s => s.liberada)
  const { modo, ima, face, ocupado, aviso, medida, sel } = useMoldes()
  const set = useMoldes.getState().set
  const [arquivos, setArquivos] = useState<File[] | null>(null)
  const [moldeSel, setMoldeSel] = useState<string | null>(null)
  const [fechar, setFechar] = useState<Record<string, number>>({})
  const [faltando, setFaltando] = useState<Set<string>>(new Set())
  const [renomear, setRenomear] = useState<string | null>(null)
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
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{parte === 'moldes' ? 'Moldes' : parte === 'faces' ? 'Faces' : 'Moldes e faces'}</h2>
        <span className="text-[11px] text-gray-400">{moldes.length ? `${moldes.length} molde${moldes.length > 1 ? 's' : ''}` : ''}</span>
      </div>
      {parte !== 'faces' && <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={escolher} disabled={!liberada} title="PDF, SVG, DXF, PNG ou JPG — vários de uma vez (ou arraste para a folha)" data-importar-moldes-btn><FileUp className="w-3.5 h-3.5" /> Importar moldes…</button>
        <input ref={inputRef} type="file" multiple accept={ACEITOS} className="hidden" onChange={e => { if (e.target.files?.length) setArquivos(Array.from(e.target.files)); e.target.value = '' }} data-input-moldes />
      </div>}
      {parte === 'faces' && <p className="text-[11px] text-gray-500">Escolha o molde na lista e confira as faces: fechar pontilhado, detectar de novo, laço, dividir e unir.</p>}
      {!liberada && <p className="text-[11px] text-gray-400">Conecte a pasta Biblioteca MAE para importar.</p>}
      {ocupado && <p className="text-xs text-gray-500 flex items-center gap-1" data-ocupado-moldes><Loader2 className="w-3.5 h-3.5 animate-spin" /> {ocupado}</p>}
      {aviso && <p className="text-xs text-red-600 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{aviso}</p>}

      {moldes.length > 0 && parte !== 'faces' && <PosicaoMoldes />}
      {moldes.length > 0 && (
        <ul className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800" data-lista-moldes>
          {moldes.map(m => {
            const faces = m.faces.filter(f => !f.hole), furos = m.faces.length - faces.length
            const dobras = m.faces.reduce((s, f) => s + (f.edges ?? []).filter(e => e.kind === 'fold').length, 0)
            const ativo = mSel?.id === m.id || sel.includes(m.id)
            return (
              <li key={m.id} className={`px-2 py-1.5 text-xs cursor-pointer ${ativo ? 'bg-orange-50 dark:bg-orange-950/30' : ''}`} title="Clique para selecionar; Shift+clique para selecionar vários (alinhar, distribuir)"
                onClick={e => { setMoldeSel(m.id); set({ sel: e.shiftKey ? (sel.includes(m.id) ? sel.filter(x => x !== m.id) : [...sel, m.id]) : [m.id], ...(face?.moldeId !== m.id ? { face: null } : {}) }) }} data-molde={m.name}>
                <div className="flex items-center gap-1">
                  {/* Lote 14 (item 200): renomear o molde (duplo clique) — o nome novo vale nos temas e pedidos */}
                  {renomear === m.id
                    ? <input autoFocus defaultValue={m.name} onFocus={e => e.target.select()} onClick={e => e.stopPropagation()}
                        onBlur={e => { const v = e.target.value.trim().slice(0, 120); if (v && v !== m.name) useMaeDoc.getState().aplicar('Renomear molde', d => { const x = d.molds.find(y => y.id === m.id); if (x) x.name = v }); setRenomear(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenomear(null) }} className="min-w-0 flex-1 rounded border border-orange-300 bg-transparent px-1 font-medium" data-nome-molde />
                    : <span className="font-medium text-gray-800 dark:text-gray-100 truncate" onDoubleClick={e => { e.stopPropagation(); setRenomear(m.id) }} title="Clique duas vezes para renomear">{m.name}</span>}
                  <button className="text-gray-400 hover:text-orange-600" onClick={e => { e.stopPropagation(); setRenomear(m.id) }} title="Renomear" aria-label="Renomear o molde" data-renomear-molde><Pencil className="w-3 h-3" /></button>
                  <span className="ml-auto text-[10px] uppercase text-gray-400">{m.source.kind}</span>
                </div>
                <div className="text-[11px] text-gray-500 tabular-nums" data-resumo-molde>
                  {/* Lote 6 (item 89): a medida da PEÇA (contorno de corte), não o recorte do arquivo com margem */}
                  <span title={`Arquivo recortado: ${fmt(m.source.widthMm)} × ${fmt(m.source.heightMm ?? 0)} mm (com margem)`} data-medida-peca>peça {fmt(caixaDaPeca(m).w)} × {fmt(caixaDaPeca(m).h)} mm</span> · <b data-n-faces>{faces.length}</b> faces · {furos} furos · {dobras} dobras
                </div>
                {faltando.has(m.id) && <div className="text-[11px] text-red-600 space-y-0.5" data-molde-sem-arquivo>
                  <div className="flex gap-1"><AlertTriangle className="w-3 h-3 mt-px shrink-0" /> O molde perdeu o arquivo — {m.source.path.split('.').pop()?.toUpperCase()} não encontrado na Biblioteca ({m.source.path})</div>
                  {/* Lote 14 (item 193): a correção ali mesmo */}
                  <div className="flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                    <label className={btn + ' cursor-pointer !py-0.5 !text-[10px]'} title="Escolha o arquivo do molde de novo (o mesmo desenho)">Corrigir molde<input type="file" className="hidden" accept=".pdf,.svg,.dxf,.png,.jpg,.jpeg" onChange={e => { const a = e.target.files?.[0]; if (a && raiz) void corrigirArquivo(raiz, m.id, a).then(ok => { if (ok) setFaltando(s => { const n = new Set(s); n.delete(m.id); return n }) }); e.target.value = '' }} data-corrigir-molde /></label>
                    <button className={btn + ' !py-0.5 !text-[10px]'} onClick={() => { if (confirm(`Trocar "${m.name}" por uma peça por medida (retângulo de ${fmt(caixaDaPeca(m).w)} × ${fmt(caixaDaPeca(m).h)} mm)? A arte do tema continua na mesma parte.`)) trocarPorMedida(m.id) }} data-trocar-por-medida>Trocar por peça por medida</button>
                  </div>
                </div>}
              </li>
            )
          })}
        </ul>
      )}

      {mSel && parte === 'moldes' && (
        <div className="flex flex-wrap gap-1.5" data-molde-sel>
          <button className={btn} onClick={() => { if (confirm(`Excluir o molde ${mSel.name}? (Ctrl+Z desfaz)`)) excluirMolde(mSel.id) }} data-excluir-molde><Trash2 className="w-3.5 h-3.5" /> Excluir {mSel.name}</button>
        </div>
      )}
      {mSel && parte !== 'moldes' && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-molde-sel>
          <label className="block text-[11px] text-gray-500" data-dica="fechar-pontilhado">
            <span className="flex justify-between"><span>Fechar pontilhado</span><span className="hidden" data-fechar-valor>{fmt(fechar[mSel.id] ?? mSel.detection?.closeMm ?? 0.25, 2)} mm</span></span>
            <Deslizador min={0} max={3} step={0.05} value={fechar[mSel.id] ?? mSel.detection?.closeMm ?? 0.25}
              onChange={e => setFechar(f => ({ ...f, [mSel.id]: Number(e.target.value) }))} unidade="mm" data-fechar />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} disabled={!preparadoDe(mSel.id) || !!ocupado} onClick={() => detectarDeNovo(mSel.id, fechar[mSel.id] ?? mSel.detection?.closeMm ?? 0.25)} title="Refaz as faces deste molde (os ajustes manuais se perdem; Ctrl+Z volta)" data-detectar><RefreshCw className="w-3.5 h-3.5" /> Detectar de novo</button>
            <button className={btn} onClick={() => { if (confirm(`Excluir o molde ${mSel.name}? (Ctrl+Z desfaz)`)) excluirMolde(mSel.id) }} data-excluir-molde><Trash2 className="w-3.5 h-3.5" /> Excluir molde</button>
          </div>
          <p className="text-[10px] text-gray-400">Linha pontilhada ou que não fecha? Aumente o &ldquo;Fechar pontilhado&rdquo; e detecte de novo.</p>
        </div>
      )}

      {moldes.length > 0 && parte !== 'moldes' && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1" data-ferramentas>
            {FERRAMENTAS.map(({ modo: m, rotulo, dica, Icone }) => (
              <button key={m} className={btn + (modo === m ? ' !border-orange-500 bg-orange-50 text-orange-800' : '')} title={dica} data-ferramenta-molde={m} onClick={() => set({ modo: m, pontos: [], moldeDosPontos: null, medida: m === 'medir' ? medida : null })} data-ferramenta={m}>
                <Icone className="w-3.5 h-3.5" /> {rotulo}
              </button>
            ))}
            <button className={btn + (ima ? ' !border-sky-500 bg-sky-50 text-sky-800' : '')} title="Ímã: os cliques grudam no centro da linha do molde" onClick={() => set({ ima: !ima })} data-ima><Magnet className="w-3.5 h-3.5" /> Ímã</button>
          </div>
          <p className="text-[11px] text-gray-500" data-dica-ferramenta>{FERRAMENTAS.find(f => f.modo === modo)?.dica}{modo !== 'selecionar' && ' · Esc cancela'}</p>
          {medida && <p className="text-xs font-semibold text-sky-700" data-medida>Distância: {fmt(medida.mm, 2)} mm</p>}
        </div>
      )}

      {faceObj && face && parte !== 'moldes' && (
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
              <p className="text-[11px] text-gray-500">Parecidas (para marcar a mesma parte):</p>
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

const ALINHAR: { modo: ModoAlinhar; Icone: typeof AlignStartVertical; nome: string }[] = [
  { modo: 'esquerda', Icone: AlignStartVertical, nome: 'Alinhar à esquerda' },
  { modo: 'centro', Icone: AlignCenterVertical, nome: 'Centralizar na horizontal' },
  { modo: 'direita', Icone: AlignEndVertical, nome: 'Alinhar à direita' },
  { modo: 'topo', Icone: AlignStartHorizontal, nome: 'Alinhar em cima' },
  { modo: 'meio', Icone: AlignCenterHorizontal, nome: 'Centralizar na vertical' },
  { modo: 'base', Icone: AlignEndHorizontal, nome: 'Alinhar embaixo' },
]

/**
 * Lote 2 (item 15): POSIÇÃO NA PRANCHETA — centralizar, alinhar (à área útil da prancheta, fora da marca de
 * registro, ou entre os selecionados) e distribuir com espaço igual. Setas: 0,5 mm; Shift + seta: 5 mm.
 */
function PosicaoMoldes() {
  const doc = useMaeDoc(s => s.hist.atual)
  const sel = useMoldes(s => s.sel)
  const marcas = useMarcas(s => s.marcas)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [a, setA] = useState<'prancheta' | 'selecao'>('prancheta')
  useEffect(() => { if (raiz && liberada && !useMarcas.getState().marcas.length) carregarMarcas(raiz).catch(() => null) }, [raiz, liberada])
  const selecionados = doc.molds.filter(m => sel.includes(m.id))
  const area = (abId: string) => {
    const ab = doc.artboards.find(x => x.id === abId)!
    const mc = marcaDaPrancheta(ab, marcas)
    if (!mc) return areaUtil(ab.widthMm, ab.heightMm)
    const e = marcaNaFolha(ab.widthMm, ab.heightMm, mc.wMm, mc.hMm)
    return areaUtil(ab.widthMm, ab.heightMm, zonasNaFolha(mc.zonas, e, mc.hMm), 2)
  }
  /** Aplica por prancheta (cada grupo de selecionados na sua folha). */
  function porPrancheta(label: string, f: (cs: { x: number; y: number; w: number; h: number }[], abId: string) => { dx: number; dy: number }[]) {
    const deltas = new Map<string, { dx: number; dy: number }>()
    for (const abId of new Set(selecionados.map(m => m.artboardId))) {
      const ms = selecionados.filter(m => m.artboardId === abId).map(m => ({ m, c: caixaDoMolde(doc, m.id, 0) })).filter(x => x.c)
      const ds = f(ms.map(x => x.c!), abId)
      ms.forEach((x, i) => deltas.set(x.m.id, ds[i]))
    }
    moverMoldes(label, deltas)
  }
  const multi = selecionados.length > 1
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-2 space-y-1.5" data-posicao-moldes>
      <div className="flex items-center gap-1">
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">Posição na prancheta</p>
        <span className="ml-auto text-[10px] text-gray-400">{selecionados.length ? `${selecionados.length} selecionado(s)` : 'clique num molde (Shift soma)'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button className={btn} disabled={!selecionados.length} onClick={() => porPrancheta('Centralizar moldes', (cs, abId) => { const d = centralizarGrupo(cs, area(abId)); return cs.map(() => d) })} title="Centralizar na área útil da prancheta (fora da marca de registro)" data-centralizar-moldes><Centro className="w-3.5 h-3.5" /> Centralizar</button>
        <span className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-[10px]">
          <button className={`px-1.5 py-1 ${a === 'prancheta' ? 'bg-orange-500 text-white' : ''}`} onClick={() => setA('prancheta')} title="Alinhar à prancheta (área útil, fora da marca)" data-alinhar-a="prancheta">à prancheta</button>
          <button className={`px-1.5 py-1 ${a === 'selecao' ? 'bg-orange-500 text-white' : ''}`} disabled={!multi} onClick={() => setA('selecao')} title="Alinhar os selecionados entre si (2 ou mais)" data-alinhar-a="selecao">entre si</button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {ALINHAR.map(({ modo, Icone, nome }) => (
          <button key={modo} className={btn + ' !px-1.5'} disabled={!selecionados.length} aria-label={nome} title={nome}
            onClick={() => porPrancheta(nome, (cs, abId) => alinhar(cs, modo, a === 'selecao' && multi ? 'selecao' : 'prancheta', area(abId)))} data-alinhar={modo}><Icone className="w-3.5 h-3.5" /></button>
        ))}
        <button className={btn + ' !px-1.5'} disabled={selecionados.length < 3} aria-label="Distribuir na horizontal" title="Distribuir na horizontal (3 ou mais)" onClick={() => porPrancheta('Distribuir moldes', cs => distribuir(cs, 'h'))} data-distribuir="h"><AlignHorizontalSpaceAround className="w-3.5 h-3.5" /></button>
        <button className={btn + ' !px-1.5'} disabled={selecionados.length < 3} aria-label="Distribuir na vertical" title="Distribuir na vertical (3 ou mais)" onClick={() => porPrancheta('Distribuir moldes', cs => distribuir(cs, 'v'))} data-distribuir="v"><AlignVerticalSpaceAround className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[10px] text-gray-400">Setas do teclado: 0,5 mm · Shift + seta: 5 mm.</p>
    </div>
  )
}

/** Lote 14 (item 193): "Corrigir molde" — o arquivo escolhido de novo vai para o mesmo lugar da Biblioteca. */
async function corrigirArquivo(raiz: FileSystemDirectoryHandle, id: string, arq: File): Promise<boolean> {
  const m = useMaeDoc.getState().hist.atual.molds.find(x => x.id === id)
  if (!m) return false
  const bytes = new Uint8Array(await arq.arrayBuffer())
  await gravar(raiz, m.source.path, new Blob([bytes as BlobPart]))
  const sha = await sha256(bytes)
  useMaeDoc.getState().aplicar(`Corrigir o arquivo do molde ${m.name}`, d => { const x = d.molds.find(y => y.id === id); if (x) x.source.sha256 = sha })
  return true
}
/** Lote 14 (item 193): "Trocar por peça por medida" — retângulo do tamanho da peça; as partes passam para a face nova. */
function trocarPorMedida(id: string) {
  useMaeDoc.getState().aplicar('Trocar por peça por medida', d => {
    const m = d.molds.find(x => x.id === id); if (!m) return
    const t = caixaDaPeca(m as never)
    const medida = { forma: 'retangulo' as const, larguraMm: Math.max(2, Math.round(t.w * 10) / 10), alturaMm: Math.max(2, Math.round(t.h * 10) / 10) }
    const antigas = new Set(m.faces.map(f => f.id))
    const novas = facesDaMedida(m.id, medida)
    m.source = { path: `Bases/medidas/${m.id}.medida`, sha256: '0'.repeat(64), widthMm: medida.larguraMm, heightMm: medida.alturaMm, kind: 'medida' } as never
    ;(m as unknown as { medida: unknown }).medida = medida
    m.faces = novas as never
    const nova = novas[0].id
    for (const p of d.parts) {
      const ficou = p.instances.filter(i => !antigas.has(i.faceId)), moveu = p.instances.find(i => antigas.has(i.faceId))
      p.instances = moveu ? [...ficou, { ...moveu, faceId: nova }] : ficou
    }
    for (const s of d.textSlots) if (antigas.has(s.faceId)) s.faceId = nova
  })
}
