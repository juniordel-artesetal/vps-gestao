'use client'
// SOA Edition — TEMA POR FACE (Método Mãe). Coloca o papel/elemento/nome numa FACE (frente, laterais,
// trás, cima) e ele aparece na mesma face de TODAS as caixas do kit. Ajuste fino por caixa (arrastar
// com "só nesta caixa") sem mexer nas outras. Elemento pode ser replicado ou só de uma caixa, e virar
// APLIQUE (sai numa folha à parte). Salva como tema (EstudioTemplate) — o banco de temas do ateliê.
'use no memo'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Trash2, Save, Image as ImageIcon, Type, Layers, Sparkles } from 'lucide-react'
import { FACE_ROLES, type ElementoFace, type FaceMolde, type FaceRole, type TemaCaixas } from '@/lib/estudio/caixasTipos'
import { carregarMoldeCaixa, listarMoldes, listarTemasCaixas, abrirTemaCaixas, carregarFontesTema, resolverFonteNativa, type MoldeCarregado } from '@/lib/estudio/caixasCliente'
import { carregarImagensTema, quadroFace, renderMoldeTema, temaVazio, type Imagens } from '@/lib/estudio/caixas'
import { enviarArquivo } from '@/lib/estudio/cliente'
import { FONTES_NATIVAS } from '@/components/estudio/fontesNativas'
import type { EstiloTexto } from '@/lib/estudio/tipos'
import { CanvasPrevia } from './MapearFaces'
import { useBaseEstudio, inp, lbl, btn, btnP, cartao } from './comum'

const PREVIA = 640
const gid = () => Math.random().toString(36).slice(2, 10)
type Kit = { id: string; nome: string; moldeIds: string[] }

const MODELOS_TEXTO: { rotulo: string; modelo: string; fonte: string }[] = [
  { rotulo: 'Nome', modelo: '{nome}', fonte: 'pacifico' },
  { rotulo: 'Idade', modelo: '{idade}', fonte: 'fredoka' },
  { rotulo: 'Hashtag', modelo: '#{nome|minusculas|semespaco|semacento}faz{idade}', fonte: 'poppins' },
  { rotulo: 'Texto', modelo: 'Texto', fonte: 'fredoka' },
]

export default function EditorTemaCaixas() {
  const { workspaceId, storage } = useBaseEstudio()
  const [temas, setTemas] = useState<{ id: string; nome: string; temaNome: string | null }[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [temaId, setTemaId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [tema, setTema] = useState<TemaCaixas | null>(null)
  const [moldes, setMoldes] = useState<MoldeCarregado[]>([])
  const [papel, setPapel] = useState<FaceRole>('frente')
  const [selId, setSelId] = useState<string | null>(null)
  const [soNaCaixa, setSoNaCaixa] = useState<string | null>(null)
  const [exemplo, setExemplo] = useState({ nome: 'Sophia', idade: '4' })
  const [previas, setPrevias] = useState<Record<string, HTMLCanvasElement>>({})
  const [estilos, setEstilos] = useState<{ id: string; nome: string; operacoes: unknown }[]>([])
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const imgs = useRef<Imagens>(new Map())
  const bases = useRef<Record<string, HTMLCanvasElement>>({})
  const arrasto = useRef<{ molde: string; face: FaceMolde; u0: number; v0: number; pos0: ElementoFace['pos']; t0: { x: number; y: number } | null } | null>(null)

  const recarregarListas = () => {
    listarTemasCaixas().then(setTemas)
    fetch('/api/estudio/kits-caixas').then(r => r.json()).then(d => setKits((d.itens || []).map((k: Record<string, unknown>) => ({ id: String(k.id), nome: String(k.nome), moldeIds: (typeof k.moldeIds === 'string' ? JSON.parse(k.moldeIds) : k.moldeIds) as string[] })))).catch(() => {})
    fetch('/api/estudio/presets?tipo=estilo-texto').then(r => r.json()).then(d => setEstilos(d.presets || [])).catch(() => {})
  }
  useEffect(recarregarListas, [])

  async function carregarMoldesDo(t: TemaCaixas) {
    const todos = await listarMoldes()
    const lista = t.moldeIds.map(id => todos.find(m => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
    const cs = await Promise.all(lista.map(carregarMoldeCaixa))
    for (const mc of cs) if (!bases.current[mc.molde.id]) {
      const k = PREVIA / Math.max(mc.W, mc.H), c = document.createElement('canvas')
      c.width = Math.round(mc.W * k); c.height = Math.round(mc.H * k); c.getContext('2d')!.drawImage(mc.dieLine, 0, 0, c.width, c.height)
      bases.current[mc.molde.id] = c
    }
    setMoldes(cs)
  }

  async function abrir(id: string) {
    setOcupado('Abrindo o tema…'); setErro('')
    try { const t = await abrirTemaCaixas(id); setTemaId(id); setNome(t.temaNome || t.nome); setTema(t.tema); await carregarMoldesDo(t.tema) }
    catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function novo(kit: Kit) {
    const t = temaVazio(kit.moldeIds)
    setTemaId(null); setNome(''); setTema(t); setSelId(null); setOcupado('Abrindo as caixas…')
    try { await carregarMoldesDo(t) } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  // redesenha as prévias quando o tema/exemplo muda
  useEffect(() => {
    if (!tema || !moldes.length) return
    let vivo = true
    ;(async () => {
      await carregarImagensTema(tema, imgs.current); await carregarFontesTema(tema)
      if (!vivo) return
      const out: Record<string, HTMLCanvasElement> = {}
      for (const mc of moldes) {
        const b = bases.current[mc.molde.id]
        out[mc.molde.id] = renderMoldeTema({ molde: mc.molde, dieLine: b, W: b.width, H: b.height, tema, linha: exemplo, fonte: resolverFonteNativa, imgs: imgs.current })
      }
      setPrevias(out)
    })()
    return () => { vivo = false }
  }, [tema, moldes, exemplo])

  const mudarTema = (p: Partial<TemaCaixas>) => setTema(t => (t ? { ...t, ...p } : t))
  const mudarEl = (id: string, p: Partial<ElementoFace>) => setTema(t => (t ? { ...t, elementos: t.elementos.map(e => (e.id === id ? { ...e, ...p } : e)) } : t))
  const sel = tema?.elementos.find(e => e.id === selId) || null

  async function subir(tipo: 'papel' | 'imagem', f: File) {
    if (!tema) return
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível neste ambiente.'); return }
    setOcupado('Enviando a imagem…'); setErro('')
    try {
      const up = await enviarArquivo(f, f.name, 'imagem', workspaceId, { pasta: `Temas/${(nome || 'Sem nome').slice(0, 40)}` })
      const el: ElementoFace = { id: gid(), tipo, url: up.url, assetId: up.id, role: papel, escopo: 'replicado', pos: { cx: 0.5, cy: tipo === 'papel' ? 0.5 : 0.42, escala: tipo === 'papel' ? 1 : 0.6, rot: 0 } }
      setTema({ ...tema, elementos: [...tema.elementos, el] }); setSelId(el.id)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  function addTexto(m: (typeof MODELOS_TEXTO)[number]) {
    if (!tema) return
    const t = { modelo: m.modelo, x: 0.08, y: 0.62, w: 0.84, h: 0.26, fonte: m.fonte, tamanho: 0.2, tamanhoMin: 0.07, cor: '#db2777', negrito: m.fonte !== 'pacifico', contorno: { cor: '#ffffff', largura: 18 }, sombra: null, curvatura: 0, estilo: null }
    const el: ElementoFace = { id: gid(), tipo: 'texto', role: papel, escopo: 'replicado', pos: { cx: t.x + t.w / 2, cy: t.y + t.h / 2, escala: 1, rot: 0 }, texto: t }
    setTema({ ...tema, elementos: [...tema.elementos, el] }); setSelId(el.id)
  }
  const mudarTexto = (p: Partial<NonNullable<ElementoFace['texto']>>) => {
    if (!sel?.texto) return
    const t = { ...sel.texto, ...p }
    mudarEl(sel.id, { texto: t, pos: { ...sel.pos, cx: t.x + t.w / 2, cy: t.y + t.h / 2 } })
  }
  const mudarEstilo = (p: Partial<EstiloTexto>) => sel?.texto && mudarTexto({ estilo: { ...(sel.texto.estilo || {}), ...p } })

  // ── arrastar na prévia ──
  const uvDe = (mc: MoldeCarregado, f: FaceMolde, e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), b = bases.current[mc.molde.id]
    const X = ((e.clientX - r.left) / r.width) * b.width, Y = ((e.clientY - r.top) / r.height) * b.height
    const q = quadroFace(f, b.width, b.height), a = (f.rot * Math.PI) / 180
    const px = X - q.cx, py = Y - q.cy
    return { u: (px * Math.cos(a) - py * Math.sin(a) + q.uw / 2) / q.uw, v: (px * Math.sin(a) + py * Math.cos(a) + q.uh / 2) / q.uh }
  }
  function baixar(mc: MoldeCarregado, e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    const f = mc.molde.faces.find(ff => x >= ff.x && x <= ff.x + ff.w && y >= ff.y && y <= ff.y + ff.h)
    if (!f) return
    if (f.role !== papel) { setPapel(f.role); setSelId(null); return }
    if (!sel || sel.role !== f.role) return
    const { u, v } = uvDe(mc, f, e)
    const pos0 = soNaCaixa === mc.molde.id ? { ...sel.pos, ...(sel.ajustes?.[mc.molde.id] || {}) } : sel.pos
    arrasto.current = { molde: mc.molde.id, face: f, u0: u, v0: v, pos0, t0: sel.texto ? { x: sel.texto.x, y: sel.texto.y } : null }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function mover(mc: MoldeCarregado, e: React.PointerEvent<HTMLCanvasElement>) {
    const a = arrasto.current
    if (!a || a.molde !== mc.molde.id || !sel) return
    const { u, v } = uvDe(mc, a.face, e)
    const du = u - a.u0, dv = v - a.v0
    const cx = a.pos0.cx + du, cy = a.pos0.cy + dv
    if (soNaCaixa === mc.molde.id) mudarEl(sel.id, { ajustes: { ...(sel.ajustes || {}), [mc.molde.id]: { ...(sel.ajustes?.[mc.molde.id] || {}), cx, cy } } })
    else if (sel.texto && a.t0) mudarEl(sel.id, { pos: { ...sel.pos, cx, cy }, texto: { ...sel.texto, x: a.t0.x + du, y: a.t0.y + dv } })
    else mudarEl(sel.id, { pos: { ...sel.pos, cx, cy } })
  }
  const soltar = () => { arrasto.current = null }

  async function salvar() {
    if (!tema) return
    const n = nome.trim()
    if (!n) { setErro('Dê um nome ao tema (ex.: Astronauta).'); return }
    setOcupado('Salvando…'); setErro('')
    try {
      const primeira = moldes[0] && previas[moldes[0].molde.id]
      let preview: string | null = null
      if (primeira) { const k = 320 / Math.max(primeira.width, primeira.height), c = document.createElement('canvas'); c.width = Math.round(primeira.width * k); c.height = Math.round(primeira.height * k); c.getContext('2d')!.drawImage(primeira, 0, 0, c.width, c.height); preview = c.toDataURL('image/jpeg', 0.7) }
      const corpo = JSON.stringify({ nome: n, temaNome: n, config: tema, preview })
      const r = temaId
        ? await fetch(`/api/estudio/templates/${temaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corpo })
        : await fetch('/api/estudio/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      if (!temaId && j.id) setTemaId(j.id)
      setAviso(`Tema "${n}" salvo. Nos pedidos com Tema = "${n}", as caixas saem sozinhas.`); recarregarListas()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function salvarEstilo() {
    if (!sel?.texto) return
    const n = prompt('Nome do estilo (ex.: Bordinha branca + chanfro):')?.trim()
    if (!n) return
    const t = sel.texto
    await fetch('/api/estudio/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: n, tipo: 'estilo-texto', operacoes: [{ cor: t.cor, contorno: t.contorno, sombra: t.sombra, estilo: t.estilo || null, fonte: t.fonte, negrito: t.negrito }] }) })
    recarregarListas(); setAviso(`Estilo "${n}" salvo.`)
  }
  function aplicarEstilo(id: string) {
    const p = estilos.find(x => x.id === id); if (!p || !sel?.texto) return
    const ops = (typeof p.operacoes === 'string' ? JSON.parse(p.operacoes) : p.operacoes) as Record<string, unknown>[]
    const o = ops?.[0] || {}
    mudarTexto({ cor: (o.cor as string) || sel.texto.cor, contorno: (o.contorno as never) ?? null, sombra: (o.sombra as never) ?? null, estilo: (o.estilo as never) ?? null, fonte: (o.fonte as string) || sel.texto.fonte, negrito: !!o.negrito })
  }
  /** Aplica o estilo do texto selecionado a TODOS os textos do tema (nome/idade/hashtag iguais no lote). */
  function estiloEmTodos() {
    if (!sel?.texto || !tema) return
    const s = sel.texto
    setTema({ ...tema, elementos: tema.elementos.map(e => (e.texto ? { ...e, texto: { ...e.texto, contorno: s.contorno, sombra: s.sombra, estilo: s.estilo, cor: s.cor } } : e)) })
  }

  // ── tela ──
  if (!tema) return (
    <div className="space-y-4">
      <div className={cartao}>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Temas salvos (banco de temas)</p>
        {!temas.length ? <p className="text-xs text-gray-400">Nenhum tema ainda.</p> : (
          <div className="flex flex-wrap gap-2">{temas.map(t => <button key={t.id} onClick={() => abrir(t.id)} className={btn}><Layers className="w-4 h-4" /> {t.temaNome || t.nome}</button>)}</div>
        )}
      </div>
      <div className={cartao}>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Criar tema novo</p>
        <p className="text-xs text-gray-500 mb-2">Escolha o kit de caixas (monte kits na aba “Moldes e kits”).</p>
        {!kits.length ? <p className="text-xs text-gray-400">Nenhum kit ainda.</p> : (
          <div className="flex flex-wrap gap-2">{kits.map(k => <button key={k.id} onClick={() => novo(k)} className={btn}><Plus className="w-4 h-4" /> {k.nome} ({k.moldeIds.length})</button>)}</div>
        )}
      </div>
      {ocupado && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {ocupado}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  )

  const daFace = tema.elementos.filter(e => e.role === papel)
  const t = sel?.texto
  const fonteSel = t ? FONTES_NATIVAS.find(f => f.id === t.fonte) : null

  return (
    <div className="space-y-3">
      <div className={`${cartao} flex flex-wrap items-end gap-3`}>
        <div className="min-w-[180px] flex-1"><label className={lbl}>Nome do tema (igual ao “Tema” do pedido)</label><input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Astronauta" /></div>
        <div><label className={lbl}>Categoria</label>
          <select className={inp} value={tema.categoria} onChange={e => mudarTema({ categoria: e.target.value })}><option value="temas-novos">Temas novos</option><option value="temas-editados">Temas editados</option></select>
        </div>
        <div><label className={lbl}>Fundo das faces</label><input type="color" value={tema.fundo} onChange={e => mudarTema({ fundo: e.target.value })} className="w-10 h-8 rounded border border-gray-200" /></div>
        <label className="text-xs flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={tema.linhas} onChange={e => mudarTema({ linhas: e.target.checked })} /> Linhas de corte</label>
        <div className="min-w-[180px]"><label className={lbl}>Nome do arquivo</label><input className={inp} value={tema.regraNome} onChange={e => mudarTema({ regraNome: e.target.value })} /></div>
        <button onClick={salvar} disabled={!!ocupado} className={btnP}>{ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar tema</button>
        <button onClick={() => { setTema(null); setMoldes([]); setPrevias({}) }} className={btn}>Voltar</button>
      </div>
      {(erro || aviso || ocupado) && <p className={`text-sm ${erro ? 'text-red-600' : 'text-gray-600'}`}>{ocupado ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{ocupado}</span> : erro || aviso}</p>}

      <div className="grid gap-3 lg:grid-cols-[260px_1fr_300px]">
        {/* esquerda: faces e elementos */}
        <div className={`${cartao} space-y-3`}>
          <div className="flex flex-wrap gap-1">
            {FACE_ROLES.map(r => <button key={r.id} onClick={() => { setPapel(r.id); setSelId(null) }} className={`rounded-lg px-2 py-1 text-[11px] font-medium border ${papel === r.id ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>{r.nome}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <label className={`${btn} justify-center cursor-pointer text-xs`}><Layers className="w-3.5 h-3.5" /> Papel digital<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir('papel', f); e.target.value = '' }} /></label>
            <label className={`${btn} justify-center cursor-pointer text-xs`}><ImageIcon className="w-3.5 h-3.5" /> Elemento<input type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir('imagem', f); e.target.value = '' }} /></label>
            {MODELOS_TEXTO.map(m => <button key={m.rotulo} onClick={() => addTexto(m)} className={`${btn} justify-center text-xs`}><Type className="w-3.5 h-3.5" /> {m.rotulo}</button>)}
          </div>
          <div className="space-y-1">
            {!daFace.length && <p className="text-[11px] text-gray-400">Nada nesta face ainda. O que você puser aqui vai para a {FACE_ROLES.find(r => r.id === papel)?.nome.toLowerCase()} de todas as caixas.</p>}
            {daFace.map(e => (
              <div key={e.id} onClick={() => setSelId(e.id)} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer ${selId === e.id ? 'bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                {e.tipo === 'texto' ? <Type className="w-3.5 h-3.5" /> : e.tipo === 'papel' ? <Layers className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                <span className="flex-1 truncate">{e.tipo === 'texto' ? e.texto?.modelo : e.tipo === 'papel' ? 'Papel digital' : 'Elemento'}</span>
                {e.escopo === 'caixa' && <span className="text-[9px] rounded bg-sky-100 text-sky-700 px-1">1 caixa</span>}
                {e.aplique && <span className="text-[9px] rounded bg-violet-100 text-violet-700 px-1">aplique</span>}
                <button onClick={ev => { ev.stopPropagation(); setTema({ ...tema, elementos: tema.elementos.filter(x => x.id !== e.id) }); if (selId === e.id) setSelId(null) }}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div><label className={lbl}>Nome (prévia)</label><input className={inp} value={exemplo.nome} onChange={e => setExemplo(x => ({ ...x, nome: e.target.value }))} /></div>
            <div><label className={lbl}>Idade</label><input className={inp} value={exemplo.idade} onChange={e => setExemplo(x => ({ ...x, idade: e.target.value }))} /></div>
          </div>
        </div>

        {/* centro: as caixas do kit */}
        <div className="grid gap-3 sm:grid-cols-2 content-start">
          {moldes.map(mc => {
            const p = previas[mc.molde.id]
            const ajustando = soNaCaixa === mc.molde.id
            return (
              <div key={mc.molde.id} className={`${cartao} !p-2 space-y-1.5 ${ajustando ? 'ring-2 ring-sky-400' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{mc.molde.nome}</span>
                  {sel && sel.tipo !== 'papel' && sel.escopo === 'replicado' && (
                    <button onClick={() => setSoNaCaixa(ajustando ? null : mc.molde.id)} className={`text-[10px] rounded px-1.5 py-0.5 border ${ajustando ? 'bg-sky-500 text-white border-sky-500' : 'border-gray-200 dark:border-gray-700'}`}>{ajustando ? 'Ajustando só esta' : 'Ajustar só nesta caixa'}</button>
                  )}
                </div>
                <div className="relative">
                  {p ? <CanvasPrevia fonte={p} onPointerDown={e => baixar(mc, e)} onPointerMove={e => mover(mc, e)} onPointerUp={soltar} className="w-full h-auto rounded-lg border border-gray-100 dark:border-gray-800 touch-none cursor-move" />
                    : <div className="aspect-[3/4] flex items-center justify-center text-gray-300"><Loader2 className="w-5 h-5 animate-spin" /></div>}
                  {mc.molde.faces.filter(f => f.role === papel).map(f => (
                    <div key={f.id} className="absolute pointer-events-none border-2 border-dashed border-orange-400 rounded-sm" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }} />
                  ))}
                </div>
                {!mc.molde.faces.length && <p className="text-[10px] text-amber-600">Este molde ainda não tem faces mapeadas.</p>}
              </div>
            )
          })}
        </div>

        {/* direita: propriedades do elemento */}
        <div className={`${cartao} space-y-3 text-xs`}>
          {!sel ? <p className="text-gray-400">Selecione um elemento da face (lista à esquerda) para ajustar. Arraste na caixa para mover.</p> : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => mudarEl(sel.id, { escopo: 'replicado', moldeId: null })} className={`rounded-lg px-2 py-1 border ${sel.escopo === 'replicado' ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>Em todas as caixas</button>
                <select className="rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" value={sel.escopo === 'caixa' ? sel.moldeId || '' : ''} onChange={e => e.target.value && mudarEl(sel.id, { escopo: 'caixa', moldeId: e.target.value })}>
                  <option value="">Só numa caixa…</option>{moldes.map(m => <option key={m.molde.id} value={m.molde.id}>{m.molde.nome}</option>)}
                </select>
              </div>
              {sel.tipo !== 'papel' && <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-violet-500" checked={!!sel.aplique} onChange={e => mudarEl(sel.id, { aplique: e.target.checked })} /> Aplique 3D (não imprime na caixa — sai na folha de apliques)</label>}
              {(() => {
                const ajuste = soNaCaixa ? sel.ajustes?.[soNaCaixa] || {} : null
                const pos = { ...sel.pos, ...(ajuste || {}) }
                const set = (k: keyof ElementoFace['pos'], v: number) => {
                  if (soNaCaixa) mudarEl(sel.id, { ajustes: { ...(sel.ajustes || {}), [soNaCaixa]: { ...(sel.ajustes?.[soNaCaixa] || {}), [k]: v } } })
                  else mudarEl(sel.id, { pos: { ...sel.pos, [k]: v } })
                }
                return (
                  <div className="space-y-1.5">
                    {soNaCaixa && <p className="text-sky-700">Ajustando só em “{moldes.find(m => m.molde.id === soNaCaixa)?.molde.nome}”. <button className="underline" onClick={() => mudarEl(sel.id, { ajustes: Object.fromEntries(Object.entries(sel.ajustes || {}).filter(([k]) => k !== soNaCaixa)) })}>desfazer ajuste</button></p>}
                    <label className="block">Tamanho {Math.round(pos.escala * 100)}%<input type="range" min={10} max={300} value={Math.round(pos.escala * 100)} onChange={e => set('escala', Number(e.target.value) / 100)} className="w-full accent-orange-500" /></label>
                    <label className="block">Giro {pos.rot}°<input type="range" min={-180} max={180} value={pos.rot} onChange={e => set('rot', Number(e.target.value))} className="w-full accent-orange-500" /></label>
                    {sel.tipo !== 'texto' && <>
                      <label className="block">Horizontal<input type="range" min={-50} max={150} value={Math.round(pos.cx * 100)} onChange={e => set('cx', Number(e.target.value) / 100)} className="w-full accent-orange-500" /></label>
                      <label className="block">Vertical<input type="range" min={-50} max={150} value={Math.round(pos.cy * 100)} onChange={e => set('cy', Number(e.target.value) / 100)} className="w-full accent-orange-500" /></label>
                    </>}
                  </div>
                )
              })()}
              {t && (
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div><label className={lbl}>Texto do campo</label><input className={`${inp} font-mono text-xs`} value={t.modelo} onChange={e => mudarTexto({ modelo: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select className={inp} value={t.fonte} onChange={e => mudarTexto({ fonte: e.target.value })} style={{ fontFamily: fonteSel?.familia }}>
                      {FONTES_NATIVAS.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                    </select>
                    <div className="flex items-center gap-1.5"><input type="color" value={t.cor} onChange={e => mudarTexto({ cor: e.target.value })} className="w-8 h-7 rounded border" /><label className="flex items-center gap-1"><input type="checkbox" checked={t.negrito} onChange={e => mudarTexto({ negrito: e.target.checked })} /> Negrito</label></div>
                  </div>
                  <p className="text-gray-500">Limite de espaço (a caixa tracejada): o texto encolhe/quebra entre o mínimo e o máximo.</p>
                  <label className="block">Tamanho máx. {Math.round(t.tamanho * 100)}% da face<input type="range" min={3} max={60} value={Math.round(t.tamanho * 100)} onChange={e => mudarTexto({ tamanho: Number(e.target.value) / 100 })} className="w-full accent-orange-500" /></label>
                  <label className="block">Tamanho mín. {Math.round(t.tamanhoMin * 100)}%<input type="range" min={2} max={40} value={Math.round(t.tamanhoMin * 100)} onChange={e => mudarTexto({ tamanhoMin: Number(e.target.value) / 100 })} className="w-full accent-orange-500" /></label>
                  <div className="grid grid-cols-2 gap-x-2">
                    <label className="block">Largura {Math.round(t.w * 100)}%<input type="range" min={10} max={100} value={Math.round(t.w * 100)} onChange={e => { const w = Number(e.target.value) / 100; mudarTexto({ w, x: t.x + (t.w - w) / 2 }) }} className="w-full accent-orange-500" /></label>
                    <label className="block">Altura {Math.round(t.h * 100)}%<input type="range" min={5} max={100} value={Math.round(t.h * 100)} onChange={e => { const h = Number(e.target.value) / 100; mudarTexto({ h, y: t.y + (t.h - h) / 2 }) }} className="w-full accent-orange-500" /></label>
                  </div>
                  <label className="block">Curvatura {t.curvatura}°<input type="range" min={-180} max={180} value={t.curvatura} onChange={e => mudarTexto({ curvatura: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
                  <p className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Estilo de camada</p>
                  <Linha rotulo="Bordinha" ativo={!!t.contorno} onAtivo={v => mudarTexto({ contorno: v ? { cor: '#ffffff', largura: 18 } : null })}>
                    {t.contorno && <><input type="color" value={t.contorno.cor} onChange={e => mudarTexto({ contorno: { ...t.contorno!, cor: e.target.value } })} className="w-7 h-6 rounded border" /><input type="range" min={2} max={80} value={t.contorno.largura} onChange={e => mudarTexto({ contorno: { ...t.contorno!, largura: Number(e.target.value) } })} className="flex-1 accent-orange-500" /></>}
                  </Linha>
                  <Linha rotulo="Chanfro" ativo={!!t.estilo?.chanfro} onAtivo={v => mudarEstilo({ chanfro: v ? { tamanho: 6, luz: '#ffffff', sombra: '#000000', intensidade: 55 } : null })}>
                    {t.estilo?.chanfro && <><input type="range" min={1} max={20} value={t.estilo.chanfro.tamanho} onChange={e => mudarEstilo({ chanfro: { ...t.estilo!.chanfro!, tamanho: Number(e.target.value) } })} className="flex-1 accent-orange-500" title="profundidade" /><input type="range" min={5} max={100} value={t.estilo.chanfro.intensidade} onChange={e => mudarEstilo({ chanfro: { ...t.estilo!.chanfro!, intensidade: Number(e.target.value) } })} className="flex-1 accent-orange-500" title="intensidade" /></>}
                  </Linha>
                  <Linha rotulo="Degradê" ativo={!!t.estilo?.gradiente} onAtivo={v => mudarEstilo({ gradiente: v ? { de: t.cor, para: '#7c3aed', angulo: 90 } : null })}>
                    {t.estilo?.gradiente && <><input type="color" value={t.estilo.gradiente.de} onChange={e => mudarEstilo({ gradiente: { ...t.estilo!.gradiente!, de: e.target.value } })} className="w-7 h-6 rounded border" /><input type="color" value={t.estilo.gradiente.para} onChange={e => mudarEstilo({ gradiente: { ...t.estilo!.gradiente!, para: e.target.value } })} className="w-7 h-6 rounded border" /><input type="range" min={0} max={360} value={t.estilo.gradiente.angulo} onChange={e => mudarEstilo({ gradiente: { ...t.estilo!.gradiente!, angulo: Number(e.target.value) } })} className="flex-1 accent-orange-500" /></>}
                  </Linha>
                  <Linha rotulo="Sombra" ativo={!!t.sombra} onAtivo={v => mudarTexto({ sombra: v ? { cor: 'rgba(0,0,0,0.45)', blur: 14, dx: 6, dy: 8 } : null })}>
                    {t.sombra && <input type="range" min={0} max={60} value={t.sombra.blur} onChange={e => mudarTexto({ sombra: { ...t.sombra!, blur: Number(e.target.value), dx: Math.round(Number(e.target.value) * 0.4), dy: Math.round(Number(e.target.value) * 0.55) } })} className="flex-1 accent-orange-500" />}
                  </Linha>
                  <Linha rotulo="Brilho" ativo={!!t.estilo?.brilho} onAtivo={v => mudarEstilo({ brilho: v ? { cor: '#fde047', blur: 24 } : null })}>
                    {t.estilo?.brilho && <><input type="color" value={t.estilo.brilho.cor} onChange={e => mudarEstilo({ brilho: { ...t.estilo!.brilho!, cor: e.target.value } })} className="w-7 h-6 rounded border" /><input type="range" min={2} max={80} value={t.estilo.brilho.blur} onChange={e => mudarEstilo({ brilho: { ...t.estilo!.brilho!, blur: Number(e.target.value) } })} className="flex-1 accent-orange-500" /></>}
                  </Linha>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button onClick={salvarEstilo} className={`${btn} text-xs`}>Salvar estilo</button>
                    <button onClick={estiloEmTodos} className={`${btn} text-xs`}>Usar em todos os textos</button>
                    {!!estilos.length && <select className="rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" value="" onChange={e => aplicarEstilo(e.target.value)}><option value="">Aplicar estilo salvo…</option>{estilos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Linha({ rotulo, ativo, onAtivo, children }: { rotulo: string; ativo: boolean; onAtivo: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="flex items-center gap-1 w-20 shrink-0"><input type="checkbox" className="accent-orange-500" checked={ativo} onChange={e => onAtivo(e.target.checked)} /> {rotulo}</label>
      {children}
    </div>
  )
}
