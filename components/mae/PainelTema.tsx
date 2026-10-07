'use client'
'use no memo'
// CRIAR TEMA (Sprint 6 — Vínculo MAE): novo/abrir/salvar, biblioteca de papéis e elementos (arrastar
// para uma PARTE ou para uma face do palco), painel de Partes com miniatura, camadas da parte e o
// "Só nesta caixa" (ajuste local por propriedade, Voltar ao padrão, Desvincular).
import Deslizador from './Deslizador'
import { useEffect, useRef, useState } from 'react'
import { Plus, Save, FolderOpen, X, Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Link2Off, Undo2, ImagePlus, Pin, Layers, Frame, Blend } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { novoTema, desvincular, voltarAoPadrao, removerCamadaTema, moverCamadaTema, propriedadesAjustadas, acharCamadaTema, type ArquivoImagem } from '@/lib/mae/vinculo/tema'
import { miniaturaDaParte, efetiva, ajustesDaFace, type CamadaImagemTema } from '@/lib/mae/vinculo/resolver'
import { acharFace, parteDaFace } from '@/lib/mae/vinculo/partes'
import type { DocTema } from '@/lib/mae/schema'
import { useEditor } from './estado'
import { editarCamadaTema, soltarNaParte, alternarMascaraDeCorte } from './acoesVinculo'
import { guardarImagem, infoImagem, listarBases, listarTemas, listarImagens, salvarBase, salvarTema, infoEmCache } from './arquivosMae'
import { motorDaPagina, garantirArquivos } from './motorEditor'
import { COR_PARTE } from './PainelBase'
import PainelTexto from './PainelTexto'
import EditorEfeitos from './EditorEfeitos'
import { limparEfeitos } from '@/lib/mae/schema/efeitos'
import PainelEdicao, { ModoDoPapel } from './PainelEdicao'
import EditorCaneta from './EditorCaneta'
import PainelTransicao, { EditarTransicao } from './PainelTransicao'
import { EditarMoldura, PainelMolduras } from './PainelMoldura'
import PainelCor from './PainelCor'
import { Secao, useLado } from './Funcoes'
import { confirmarTroca } from './historicoGlobal'
import { opacidadeNasPartes, copiarEstilosParaPartes } from './acoesVinculo'
import { facesSemPapel } from '@/lib/mae/vinculo/partes'
import { TextoSoNestaCaixa as TextoSoNestaCaixaProps } from './PainelTexto'

const FORMAS: { kind: 'rect' | 'ellipse' | 'polygon' | 'star' | 'heart' | 'line'; rotulo: string; aspect: number }[] = [
  { kind: 'rect', rotulo: 'Retângulo', aspect: 1.5 }, { kind: 'ellipse', rotulo: 'Elipse', aspect: 1 }, { kind: 'polygon', rotulo: 'Polígono', aspect: 1 },
  { kind: 'star', rotulo: 'Estrela', aspect: 1 }, { kind: 'heart', rotulo: 'Coração', aspect: 1 }, { kind: 'line', rotulo: 'Linha', aspect: 6 },
]

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativoCls = ' !border-orange-500 bg-orange-50 text-orange-800'
const fmt = (n: number, c = 2) => (Math.round(n * 10 ** c) / 10 ** c).toLocaleString('pt-BR')
const aplicarTema = (label: string, f: (t: DocTema) => void) => useMaeTema.getState().aplicar(label, t => f(t as DocTema))
export const TIPO_ARRASTE = 'text/mae-arquivo'

// temas abertos por último (a lista "Abrir tema" mostra eles primeiro)
const CHAVE_RECENTES = 'mae:temas-recentes'
const recentes = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? '[]') } catch { return [] } }
const lembrarRecente = (id: string) => { try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify([id, ...recentes().filter(x => x !== id)].slice(0, 12))) } catch { /* sem storage */ } }

/** Miniatura de uma parte, desenhada pelo motor (mesma resolução do vínculo). */
function Miniatura({ tema, partId, A, versao }: { tema: DocTema; partId: string; A: number; versao: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raiz = useBiblioteca(s => s.raiz)
  const conteudo = tema.partContent[partId]
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const p = miniaturaDaParte(tema, partId, A, 30)
      await garantirArquivos(p as never, raiz)
      const r = await motorDaPagina().render(p as never, 2.5, '#ffffff', 'bitmap')
      const c = ref.current
      if (!vivo || !c || !r.bitmap) { r.bitmap?.close(); return }
      c.width = r.bitmap.width; c.height = r.bitmap.height
      c.getContext('2d')!.drawImage(r.bitmap, 0, 0); r.bitmap.close()
    })().catch(() => {})
    return () => { vivo = false }
  }, [tema, conteudo, partId, A, raiz, versao])
  return <canvas ref={ref} className="h-14 w-auto max-w-full rounded border border-gray-200 bg-white" />
}

function Biblioteca({ onUsar, parte }: { onUsar: (a: ArquivoImagem, empilhar: boolean) => void; parte?: { id: string; name: string } }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [pasta, setPasta] = useState<'Papéis' | 'Elementos' | 'Cor'>(() => ({ elementos: 'Elementos', cor: 'Cor' } as const)[useEditor.getState().funcao as 'cor'] ?? 'Papéis')
  const funcao = useEditor(s => s.funcao), lado = useLado()
  // a aba da Biblioteca segue o ícone aberto (Papéis/Elementos/Cor) — ajuste no render, sem efeito
  const [funcaoVista, setFuncaoVista] = useState(funcao)
  if (funcao !== funcaoVista) {
    setFuncaoVista(funcao)
    const p = lado !== 'tudo' && funcao ? ({ papeis: 'Papéis', elementos: 'Elementos', cor: 'Cor' } as const)[funcao as 'papeis'] : undefined
    if (p) setPasta(p)
  }
  const [itens, setItens] = useState<string[]>([])
  const [, setV] = useState(0)
  useEffect(() => {
    if (!raiz || !liberada || pasta === 'Cor') return
    let vivo = true
    listarImagens(raiz, pasta).then(async l => { if (!vivo) return; setItens(l); for (const p of l.slice(0, 60)) { await infoImagem(raiz, p).catch(() => null); if (vivo) setV(v => v + 1) } })
    return () => { vivo = false }
  }, [raiz, liberada, pasta])
  async function adicionar() {
    if (!raiz || pasta === 'Cor') return
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = 'image/png,image/jpeg,image/webp'
    inp.onchange = async () => { for (const f of Array.from(inp.files ?? [])) { const i = await guardarImagem(raiz, f, pasta); setItens(l => [...new Set([...l, i.path])]) } }
    inp.click()
  }
  return (
    <div className="space-y-1.5" data-biblioteca-tema>
      <div className="flex items-center gap-1">
        {(['Papéis', 'Elementos', 'Cor'] as const).map(p => <button key={p} className={btn + (pasta === p ? ativoCls : '')} onClick={() => setPasta(p)} data-pasta={p}>{p}</button>)}
        {pasta !== 'Cor' && <button className={btn + ' ml-auto'} disabled={!liberada} onClick={adicionar} data-adicionar-arquivo><ImagePlus className="w-3.5 h-3.5" /> Adicionar…</button>}
      </div>
      {pasta === 'Cor' ? (parte ? <PainelCor partId={parte.id} nomeParte={parte.name} /> : <p className="text-[11px] text-gray-400">Escolha uma parte abaixo.</p>) : (<>
      <p className="text-[10px] text-gray-400">Arraste para uma parte (abaixo) ou para uma face na folha. Com <b>Alt</b> na face = só naquela caixa.</p>
      <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto" data-miniaturas>
        {itens.map(p => {
          const i = infoEmCache(p)
          return (
            <button key={p} draggable title={p} className="aspect-square rounded border border-gray-200 bg-white overflow-hidden hover:border-orange-400"
              onDragStart={e => { e.dataTransfer.setData(TIPO_ARRASTE, p); e.dataTransfer.effectAllowed = 'copy' }}
              onDoubleClick={e => i && onUsar(i, e.shiftKey)} data-arquivo={p}>
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
              {i ? <img src={i.url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] text-gray-400">{p.split('/').pop()}</span>}
            </button>
          )
        })}
        {!itens.length && <p className="col-span-4 text-[11px] text-gray-400">Nada em {pasta}/ ainda.</p>}
      </div>
      </>)}
    </div>
  )
}

export default function PainelTema() {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const { parteAtiva, face, camada, escopo } = useEditor()
  const ladoTema = useLado(), funcaoTema = useEditor(s => s.funcao)
  const partesSel = useEditor(s => s.partesSel)
  const juntarOp = useRef('')
  const [opPartes, setOpPartes] = useState(1)
  const set = useEditor.getState().set
  const [nome, setNome] = useState('')
  const [lista, setLista] = useState<{ bases?: { path: string; doc: typeof doc }[]; temas?: { path: string; doc: DocTema }[] } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [versaoMini, setVersaoMini] = useState(0)
  const [caneta, setCaneta] = useState(false)

  async function criar() {
    if (!raiz) return
    if (!doc.molds.length || !doc.parts.some(p => p.instances.length)) { setMsg('Monte a base primeiro (moldes e partes) ou abra uma base salva.'); return }
    // o tema aponta para uma versão SALVA da base
    useMaeDoc.getState().aplicar('Salvar base', d => { d.version = (d.version ?? 0) + 1 })
    const b = useMaeDoc.getState().hist.atual
    await salvarBase(raiz, b)
    useMaeTema.getState().carregar(novoTema({ nome: nome.trim() || 'Novo tema', baseId: b.id, baseVersion: b.version }))
    set({ parteAtiva: doc.parts.find(p => p.instances.length)?.id ?? null, camada: null, face: null })
    setMsg(null)
  }
  async function abrirTema(t: DocTema) {
    if (!raiz) return
    const bases = await listarBases(raiz)
    const b = bases.find(x => x.doc.id === t.baseId)
    if (!b) { setMsg('A base deste tema não está em Bases/ nesta Biblioteca.'); return }
    const trocaBase = b.doc.id !== doc.id || b.doc.version > doc.version
    if (!(await confirmarTroca('tema', ...(trocaBase ? ['base' as const] : [])))) return
    // mesma base já aberta (mesma versão ou mais nova): fica a aberta — não perde marcas/ajustes não salvos
    if (b.doc.id !== doc.id || b.doc.version > doc.version) useMaeDoc.getState().carregar(b.doc)
    useMaeTema.getState().carregar(t)
    lembrarRecente(t.id)
    setMsg(b.doc.version !== t.baseVersion ? `A base mudou (v${t.baseVersion} → v${b.doc.version}); confira as faces.` : null)
    setLista(null); set({ parteAtiva: b.doc.parts.find(p => p.instances.length)?.id ?? null, camada: null, face: null })
  }
  async function abrirLista() {
    if (!raiz) return
    const ts = await listarTemas(raiz)
    const rec = recentes()
    setLista({ temas: [...ts].sort((a, b) => { const ia = rec.indexOf(a.doc.id), ib = rec.indexOf(b.doc.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || (a.doc.name ?? '').localeCompare(b.doc.name ?? '') }) })
  }
  // botões da barra do topo (Lote 3, item 36): "Abrir tema" abre a lista aqui
  const pedidoTopo = useEditor(s => s.pedidoTopo)
  useEffect(() => {
    if (pedidoTopo !== 'abrir-tema' || ladoTema === 'funcoes') return
    useEditor.getState().set({ pedidoTopo: null })
    void abrirLista()
  }, [pedidoTopo]) // eslint-disable-line react-hooks/exhaustive-deps
  async function salvar() {
    if (!raiz || !tema) return
    useMaeTema.getState().aplicar('Salvar tema', t => { t.version += 1 })
    const path = await salvarTema(raiz, useMaeTema.getState().hist!.atual)
    setMsg(`Tema salvo em ${path} (versão ${useMaeTema.getState().hist!.atual.version})`)
  }

  if (!tema && ladoTema === 'funcoes' && ['pronto', 'loja'].includes(funcaoTema ?? '')) return null
  if (!tema && ladoTema === 'funcoes') return <p className="text-xs text-gray-500" data-sem-tema-funcao>Abra ou crie um tema no painel da direita para usar esta função.</p>
  if (!tema) {
    return (
      <section className="space-y-2" data-painel-tema>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tema</h2>
        <p className="text-[11px] text-gray-500">Um tema veste a base: papéis e elementos por PARTE, que se replicam em todas as faces dela.</p>
        <label className="block text-xs">Nome do novo tema
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="ex.: Stitch Angel" className="mt-0.5 w-full rounded border border-gray-200 bg-transparent px-1.5 py-1" data-nome-tema />
        </label>
        <p className="text-[11px] text-gray-500">Base: <b>{doc.name}</b> ({doc.molds.length} moldes, {doc.parts.filter(p => p.instances.length).length} partes)</p>
        <div className="flex flex-wrap gap-1.5">
          <button className={btn + ' !border-orange-400 bg-orange-50 text-orange-800'} disabled={!liberada} onClick={criar} data-novo-tema><Plus className="w-3.5 h-3.5" /> Novo tema nesta base</button>
          <button className={btn} disabled={!liberada} onClick={async () => setLista({ bases: raiz ? await listarBases(raiz) : [] })}><FolderOpen className="w-3.5 h-3.5" /> Outra base…</button>
          <button className={btn} disabled={!liberada} onClick={() => void abrirLista()} data-abrir-tema><FolderOpen className="w-3.5 h-3.5" /> Abrir tema…</button>
        </div>
        {lista?.bases && <ul className="text-xs space-y-0.5">{lista.bases.map(b => <li key={b.path}><button className="underline" onClick={async () => { if (!(await confirmarTroca('base'))) return; useMaeDoc.getState().carregar(b.doc); setLista(null) }}>{b.doc.name} (v{b.doc.version})</button></li>)}{!lista.bases.length && <li className="text-gray-400">Nenhuma base em Bases/.</li>}</ul>}
        {lista?.temas && <ul className="text-xs space-y-0.5" data-lista-temas>{lista.temas.map(t => <li key={t.path}><button className="underline" onClick={() => abrirTema(t.doc)}>{t.doc.name} (v{t.doc.version})</button></li>)}{!lista.temas.length && <li className="text-gray-400">Nenhum tema em Temas/.</li>}</ul>}
        {msg && <p className="text-[11px] text-red-600">{msg}</p>}
      </section>
    )
  }

  const partes = doc.parts.filter(p => p.instances.length)
  const parte = partes.find(p => p.id === parteAtiva) ?? partes[0]
  const faceDaParte = face && parte && parteDaFace(doc, face)?.id === parte.id ? face : null
  const camadas = (parte ? tema.partContent[parte.id] ?? [] : []) as CamadaImagemTema[]
  const exclusivas = (face ? tema.faceContent?.[face] ?? [] : []) as CamadaImagemTema[]
  const achada = camada ? acharCamadaTema(tema, camada) : null
  const sel = achada?.c ?? null
  const aj = faceDaParte && sel && !achada?.faceId ? ajustesDaFace(tema, faceDaParte)[sel.id] : undefined
  const ef = sel ? efetiva(sel, aj) : null
  const ajustadas = faceDaParte && sel && !achada?.faceId ? propriedadesAjustadas(tema, faceDaParte, sel.id) : []
  const t = ef?.transform ?? { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 }
  const rotuloFace = (f: string) => { const a = acharFace(doc, f); return a ? `${a.molde.name} · ${f.split('_').pop()}` : f }
  const semPapel = facesSemPapel(doc, tema).map(rotuloFace)
  const linhaCamada = (c: CamadaImagemTema, exclusiva: boolean) => {
    const local = faceDaParte && !exclusiva && propriedadesAjustadas(tema, faceDaParte, c.id).length > 0
    return (
      <li key={c.id} className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs cursor-pointer ${camada === c.id ? 'bg-orange-50 ring-1 ring-orange-300' : 'hover:bg-gray-50'} ${(c as { recortada?: boolean }).recortada ? 'ml-4' : ''}`}
        onClick={e => { if (e.altKey) { alternarMascaraDeCorte(c.id); return } set({ camada: c.id }) }}
        title="Alt + clique: máscara de corte (aparece só dentro da camada de baixo)" data-camada-tema={c.name} data-recortada={(c as { recortada?: boolean }).recortada ? 1 : undefined}>
        {(c as { recortada?: boolean }).recortada && <span className="text-orange-500 -ml-3 w-3" title="Máscara de corte: aparece só dentro da camada de baixo">↳</span>}
        <button className="p-0.5" data-olho-tema onClick={e => { e.stopPropagation(); editarCamadaTema(c.id, { visible: c.visible === false }, c.visible === false ? 'Mostrar' : 'Ocultar') }}>{c.visible === false ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5" />}</button>
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
        {infoEmCache(c.path) && <img src={infoEmCache(c.path)!.url} alt="" className="w-5 h-5 rounded object-cover border border-gray-200" />}
        {(c as { type: string }).type === 'solid' && <span className="w-5 h-5 rounded border border-gray-200" style={{ background: (c as unknown as { color: string }).color }} />}
        {(c as { type: string }).type === 'frame' && <span className="w-5 h-5 rounded border-2 border-dashed border-gray-400" />}
        <span className="flex-1 truncate">{c.name}</span>
        {c.type === 'image' && c.anchor !== 'paper' && (
          <button className={`rounded px-0.5 text-[9px] font-bold ${c.applique?.enabled ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-orange-500'}`} title={c.applique?.enabled ? 'É aplique 3D — clique para tirar' : 'Marcar como aplique 3D'}
            onClick={e => { e.stopPropagation(); aplicarTema(c.applique?.enabled ? 'Tirar aplique 3D' : 'Marcar como aplique 3D', tt => { const a = acharCamadaTema(tt, c.id); if (!a || a.c.type !== 'image') return; if (a.c.applique?.enabled) delete a.c.applique; else a.c.applique = { ...(a.c.applique ?? {}), enabled: true } }) }}
            data-aplique-lista={c.name}>3D</button>
        )}
        <span className="text-[9px] uppercase text-gray-400">{c.anchor === 'paper' ? 'papel' : 'face'}</span>
        {local && <span title="Tem ajuste só nesta caixa" data-icone-local><Pin className="w-3 h-3 text-orange-500" /></span>}
        {exclusiva && <span title="Só desta caixa"><Link2Off className="w-3 h-3 text-gray-500" /></span>}
      </li>
    )
  }

  return (
    <section className="space-y-2" data-painel-tema data-tema-aberto>
      {ladoTema !== 'funcoes' && <>
      <div className="flex items-center gap-1">
        <input defaultValue={tema.name} key={tema.id} onBlur={e => { const v = e.target.value.trim().slice(0, 120); if (v && v !== tema.name) aplicarTema('Nome do tema', tt => { tt.name = v }) }} className="flex-1 min-w-0 rounded border border-transparent hover:border-gray-200 bg-transparent px-1 text-sm font-semibold" data-nome-tema-aberto />
        <button className={btn} onClick={salvar} disabled={!liberada} data-salvar-tema><Save className="w-3.5 h-3.5" /> Salvar</button>
        <button className={btn} onClick={async () => { if (!(await confirmarTroca('tema'))) return; useMaeTema.getState().carregar(null); set({ camada: null, face: null }) }} title="Fechar o tema" data-fechar-tema><X className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[10px] text-gray-400">Base: {doc.name} v{tema.baseVersion}</p>
      {msg && <p className="text-[11px] text-emerald-700" data-msg-tema>{msg}</p>}
      {semPapel.length > 0 && <p className="text-[11px] text-amber-700" title={semPapel.join(', ')} data-faces-sem-papel={semPapel.length}>⚠️ {semPapel.length === 1 ? '1 face nova sem papel' : `${semPapel.length} faces sem papel`}: {semPapel.slice(0, 4).join(', ')}{semPapel.length > 4 ? '…' : ''}</p>}
      </>}

      <Secao ids={['papeis', 'elementos', 'cor']}><Biblioteca onUsar={(a, empilhar) => parte && soltarNaParte(parte.id, a, empilhar)} parte={parte ? { id: parte.id, name: parte.name } : undefined} /></Secao>

      <Secao ids={['partes', 'papeis', 'elementos', 'cor', 'moldurinha', 'transicao', 'formas']}>
      {partesSel.length > 1 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50/70 dark:bg-orange-950/30 p-2 space-y-1.5 text-xs" data-partes-selecionadas={partesSel.length}>
          <p className="font-semibold">{partesSel.length} partes selecionadas <span className="font-normal text-gray-500">({partesSel.map(id => doc.parts.find(x => x.id === id)?.name).join(', ')})</span></p>
          <p className="text-[10px] text-gray-500">Papel, elemento, cor, moldurinha (e preset) e transição escolhidos agora vão para todas. Depois, cada parte continua editável sozinha.</p>
          <label className="block text-[11px] text-gray-500">Opacidade de todas as camadas
            <Deslizador min={0} max={1} step={0.01} value={opPartes} unidade="%" fator={100} onPointerDown={() => { juntarOp.current = `opn:${Date.now()}` }} onChange={e => { const v = Number(e.target.value); setOpPartes(v); opacidadeNasPartes(partesSel, v, juntarOp.current) }} data-opacidade-partes />
          </label>
          <div className="flex flex-wrap gap-1">
            {sel && <button className={btn} onClick={() => { const n = copiarEstilosParaPartes(sel.id, partesSel); setMsg(n ? `Estilos copiados para ${n} camada(s).` : 'Nenhuma camada do mesmo tipo nas outras partes.') }} title="Os estilos (traçado, sombra, brilho…) da camada selecionada vão para as camadas do mesmo tipo das outras partes" data-copiar-estilos>Copiar estilos da camada</button>}
            <button className={btn} onClick={() => set({ partesSel: [] })} data-limpar-partes>Só uma parte</button>
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold flex items-center gap-1 mb-1"><Layers className="w-3.5 h-3.5" /> Partes</h3>
        <div className="grid grid-cols-2 gap-1.5" data-partes-tema>
          {partes.map(p => (
            <div key={p.id} className={`rounded-lg border p-1 cursor-pointer ${parte?.id === p.id || partesSel.includes(p.id) ? 'border-orange-400 bg-orange-50/60' : 'border-gray-200 hover:border-orange-300'} ${partesSel.includes(p.id) ? 'ring-2 ring-orange-300' : ''}`}
              title="Clique para escolher; Ctrl + clique para selecionar várias partes"
              onClick={e => {
                // Lote 3 (item 34): Ctrl/⌘ + clique soma ou tira a parte da seleção
                if (e.ctrlKey || e.metaKey) {
                  const atual = partesSel.length ? partesSel : parte ? [parte.id] : []
                  const nova = atual.includes(p.id) ? atual.filter(x => x !== p.id) : [...atual, p.id]
                  set({ partesSel: nova.length > 1 ? nova : [], parteAtiva: nova.includes(p.id) ? p.id : nova[0] ?? p.id, camada: null })
                } else set({ parteAtiva: p.id, camada: null, partesSel: [] })
              }}
              onDragOver={e => { if (e.dataTransfer.types.includes(TIPO_ARRASTE)) e.preventDefault() }}
              onDrop={async e => { const path = e.dataTransfer.getData(TIPO_ARRASTE); if (!path || !raiz) return; e.preventDefault(); const i = await infoImagem(raiz, path); soltarNaParte(p.id, i, e.shiftKey); set({ parteAtiva: p.id }); setVersaoMini(v => v + 1) }}
              data-parte-tema={p.name}>
              <Miniatura tema={tema} partId={p.id} A={p.referenceAspect ?? 1} versao={versaoMini} />
              <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ background: COR_PARTE[doc.parts.indexOf(p) % COR_PARTE.length] }} />
                <b className="truncate">{p.name}</b><span className="ml-auto text-gray-400">{p.instances.length} faces · {(tema.partContent[p.id] ?? []).length} cam.</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </Secao>

      {parte && (
        <>
        {/* Lote 4 (item 45): cada ícone abre o painel da SUA função (antes Moldurinha e Transição abriam o de Camadas) */}
        <Secao ids={['moldurinha']}>
          <div className="space-y-1" data-secao-moldurinha>
            <h3 className="text-xs font-semibold flex items-center gap-1"><Frame className="w-3.5 h-3.5" /> Moldurinha em {parte.name}</h3>
            <PainelMolduras partId={parte.id} camadaSel={camada} onSelecionar={id => set({ camada: id })} />
            <p className="text-[10px] text-gray-500">Só numa caixa: clique na caixa na folha e escolha “Só nesta caixa” no painel da direita.</p>
          </div>
        </Secao>
        <Secao ids={['transicao']}>
          <div className="space-y-1" data-secao-transicao>
            <h3 className="text-xs font-semibold flex items-center gap-1"><Blend className="w-3.5 h-3.5" /> Transição em {parte.name}</h3>
            {camadas.length > 0
              ? <PainelTransicao key={parte.id} partId={parte.id} sempreAberto onCriada={() => setVersaoMini(v => v + 1)} />
              : <p className="text-[11px] text-gray-400">A transição precisa de um papel na parte — arraste um papel para a miniatura de {parte.name} primeiro.</p>}
            {camadas.filter(c => (c as { transition?: unknown }).transition).map(c => <button key={c.id} className={btn} onClick={() => set({ camada: c.id })} data-transicao-da-parte>{(c as { name?: string }).name ?? 'Transição'} — editar</button>)}
          </div>
        </Secao>
        <Secao ids={['partes']}>
        <div className="space-y-1" data-camadas-parte>
          <h3 className="text-xs font-semibold">Camadas de {parte.name} <span className="font-normal text-gray-400">(todas as {parte.instances.length} faces)</span></h3>
          <ul className="space-y-0.5">{[...camadas].reverse().map(c => linhaCamada(c, false))}</ul>
          {!camadas.length && <p className="text-[11px] text-gray-400">Arraste um papel para a miniatura de {parte.name}.</p>}
          {camadas.length > 0 && <p className="text-[10px] text-gray-400">Shift + arrastar um papel: entra POR CIMA (para a transição com máscara em degradê).</p>}
          {face && exclusivas.length > 0 && (<>
            <h3 className="text-xs font-semibold pt-1">Só nesta caixa: {rotuloFace(face)}</h3>
            <ul className="space-y-0.5">{[...exclusivas].reverse().map(c => linhaCamada(c, true))}</ul>
          </>)}
        </div>
        </Secao>
        <Secao ids={['formas']}>
        <div className="space-y-1">
          <h3 className="text-xs font-semibold">Formas em {parte.name}</h3>
          <div className="flex flex-wrap items-center gap-1 pt-0.5" data-formas>
            <span className="text-[10px] text-gray-400">+ Forma:</span>
            {FORMAS.map(f => (
              <button key={f.kind} className={btn + ' !px-1.5 !py-0.5 !text-[10px]'} onClick={() => aplicarTema(`Forma: ${f.rotulo}`, tt => {
                const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
                ;(tt.partContent[parte.id] ??= []).push({ id, type: 'shape', name: f.rotulo, kind: f.kind, params: { radius: f.kind === 'rect' ? 0.15 : 0, sides: f.kind === 'star' ? 5 : 6, inner: 0.45 }, fill: f.kind === 'line' ? null : '#f472b6', stroke: f.kind === 'line' ? { color: '#1f2937', widthMm: 0.8 } : null, aspect: f.aspect, anchor: 'face', transform: { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 } } as never)
                set({ camada: id })
              })} data-nova-forma={f.kind}>{f.rotulo}</button>
            ))}
            <button className={btn + ' !px-1.5 !py-0.5 !text-[10px]'} onClick={() => setCaneta(true)} data-abrir-caneta>Caneta</button>
          </div>
          {caneta && <EditorCaneta partId={parte.id} A={parte.referenceAspect ?? 1} onFechar={() => setCaneta(false)} />}
        </div>
        </Secao>
        </>
      )}

      {sel && ef && (
        <Secao props>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-camada-sel>
          {/* Lote 4 (item 29): papel → "Preencher · Repetir (padrão)" logo no topo */}
          <ModoDoPapel camadaId={sel.id} />
          {faceDaParte && !achada?.faceId && (
            <div className="flex flex-wrap items-center gap-1 text-[11px]" data-escopo>
              <span className="text-gray-500">Editar em:</span>
              <button className={btn + (escopo === 'parte' ? ativoCls : '')} onClick={() => set({ escopo: 'parte' })} data-escopo-btn="parte">Todas as {parte?.name}</button>
              <button className={btn + (escopo === 'face' ? ativoCls : '')} onClick={() => set({ escopo: 'face' })} data-escopo-btn="face">Só nesta caixa</button>
              <span className="w-full text-gray-400">caixa: {rotuloFace(faceDaParte)}</span>
            </div>
          )}
          {(['x', 'y'] as const).map(k => (
            <label key={k} className="block text-[11px] text-gray-500">
              <span className="flex justify-between"><span>{k === 'x' ? 'Posição ↔' : 'Posição ↕'} {ajustadas.includes(`transform.${k}`) && <Pin className="inline w-3 h-3 text-orange-500" />}</span></span>
              <Deslizador min={-0.5} max={1.5} step={0.005} value={t[k]} onChange={e => editarCamadaTema(sel.id, { transform: { [k]: Number(e.target.value) } }, 'Mover', `mv:${sel.id}:${k}`)} unidade="%" fator={100} casas={1} data-transf={k} />
            </label>
          ))}
          <label className="block text-[11px] text-gray-500">
            <span className="flex justify-between"><span>Escala {ajustadas.includes('transform.scale') && <Pin className="inline w-3 h-3 text-orange-500" />}</span></span>
            <Deslizador min={0.05} max={3} step={0.01} value={t.scale} onChange={e => editarCamadaTema(sel.id, { transform: { scale: Number(e.target.value) } }, 'Escala', `esc:${sel.id}`)} unidade="%" fator={100} data-transf="scale" />
          </label>
          <label className="block text-[11px] text-gray-500">
            <span className="flex justify-between"><span>Rotação {ajustadas.includes('transform.rotationDeg') && <Pin className="inline w-3 h-3 text-orange-500" />}</span></span>
            <Deslizador min={-180} max={180} step={1} value={t.rotationDeg} onChange={e => editarCamadaTema(sel.id, { transform: { rotationDeg: Number(e.target.value) } }, 'Girar', `rot:${sel.id}`)} unidade="°" data-transf="rot" />
          </label>
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => editarCamadaTema(sel.id, { visible: ef.visible === false }, ef.visible === false ? 'Mostrar' : 'Ocultar')} data-visivel>{ef.visible === false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} {ef.visible === false ? 'Mostrar' : 'Ocultar'}</button>
            <button className={btn} data-subir-camada-tema onClick={() => aplicarTema('Subir camada', tt => moverCamadaTema(tt, sel.id, 1))}><ArrowUp className="w-3.5 h-3.5" /></button>
            <button className={btn} data-descer-camada-tema onClick={() => aplicarTema('Descer camada', tt => moverCamadaTema(tt, sel.id, -1))}><ArrowDown className="w-3.5 h-3.5" /></button>
            <button className={btn} onClick={() => { aplicarTema('Excluir camada', tt => removerCamadaTema(tt, sel.id)); set({ camada: null }) }} data-excluir-camada-tema><Trash2 className="w-3.5 h-3.5" /></button>
            {faceDaParte && !achada?.faceId && <button className={btn} onClick={() => aplicarTema('Desvincular (só nesta caixa)', tt => { const id = desvincular(tt, faceDaParte, sel.id, ef); set({ camada: id }) })} title="A camada vira exclusiva desta caixa" data-desvincular><Link2Off className="w-3.5 h-3.5" /> Desvincular</button>}
          </div>
          {ajustadas.length > 0 && faceDaParte && (
            <div className="rounded border border-orange-200 p-1.5 space-y-1" data-ajustes-locais>
              <p className="text-[11px] text-orange-800 flex items-center gap-1"><Pin className="w-3 h-3" /> Ajustado só nesta caixa:</p>
              <ul className="flex flex-wrap gap-1">
                {ajustadas.map(p => <li key={p}><button className="rounded border border-orange-200 bg-white px-1.5 py-0.5 text-[11px]" onClick={() => aplicarTema(`Voltar ao padrão: ${p}`, tt => voltarAoPadrao(tt, faceDaParte, sel.id, p))} data-voltar={p}><Undo2 className="inline w-3 h-3" /> {ROTULO_PROP[p] ?? p}</button></li>)}
                <li><button className="rounded border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-[11px]" onClick={() => aplicarTema('Voltar ao padrão (tudo)', tt => voltarAoPadrao(tt, faceDaParte, sel.id))} data-voltar-tudo>Voltar tudo ao padrão</button></li>
              </ul>
            </div>
          )}
          <p className="text-[10px] text-gray-400">Âncora: {sel.anchor === 'paper' ? 'papel (acompanha o papel)' : 'face (posição em % da face)'} · {fmt(ef.aspect ?? 1)} de proporção</p>
          {sel.transition && <EditarTransicao layerId={sel.id} tr={sel.transition} />}
          {(sel as { type: string }).type === 'frame' && <EditarMoldura layerId={sel.id} />}
          <EditorEfeitos efeitos={limparEfeitos(sel.effects)} titulo="Estilos da camada (todas as caixas)"
            onMudar={(efs, label, j) => useMaeTema.getState().aplicar(label, tt => { const a = acharCamadaTema(tt as DocTema, sel.id); if (a) a.c.effects = efs as never }, j ? `efc:${sel.id}:${j}` : undefined)} />
          <PainelEdicao camadaId={sel.id} />
        </div>
        </Secao>
      )}
      <Secao ids={['texto']}><PainelTexto /></Secao>
      <Secao props><TextoSoNestaCaixaProps /></Secao>
      <Secao ids={['partes']}><p className="text-[10px] text-gray-400">Dica: clique numa caixa na folha para editar “só nesta caixa”; clique fora para editar todas.</p></Secao>
      {!sel && <Secao props><p className="text-[11px] text-gray-400" data-sem-selecao>Clique numa camada (na lista ou na folha) para ver as propriedades dela aqui.</p></Secao>}
    </section>
  )
}

const ROTULO_PROP: Record<string, string> = { 'transform.x': 'posição ↔', 'transform.y': 'posição ↕', 'transform.scale': 'escala', 'transform.rotationDeg': 'rotação', visible: 'visível', path: 'imagem' }
