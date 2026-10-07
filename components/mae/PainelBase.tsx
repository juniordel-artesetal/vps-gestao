'use client'
'use no memo'
// ASSISTENTE DA BASE (Sprint 5) — montar a base uma vez, passo a passo (docs/mae-spec.md, fluxo 2):
// 1–3 Moldes/Pranchetas/Faces (painel de moldes) · 4 Partes · 5 Enquadramento · 6 Nome e textos ·
// 7 Identidade · 8 Arte inteligente · 9 Salvar.
import Deslizador from './Deslizador'
import { useLado } from './Funcoes'
import { MarcasPranchetas } from './PainelExportar'
import { useEffect, useState } from 'react'
import { Check, Plus, Trash2, RotateCw, FlipHorizontal2, Save, FolderOpen, Timer, Sparkles, QrCode, ImagePlus, Type, X } from 'lucide-react'
import type { Draft } from 'immer'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { sugerirParaParte, novaParte, excluirParte, garantirPartesPadrao, acharFace } from '@/lib/mae/vinculo/partes'
import type { DocTrabalho } from '@/lib/mae/schema'
import PainelMoldes from './PainelMoldes'
import { PASSOS, useEditor } from './estado'
import { aceitarSugestoes } from './acoesVinculo'
import { escalarPosicao } from '@/lib/mae/editor/posicaoTexto'
import { gerarQr, gravarIdentidade, guardarImagem, infoImagem, lerIdentidade, salvarBase, listarImagens, type Identidade, listarTemas } from './arquivosMae'
import { ReplicarTextos } from './TextosPaginas'

type Doc = DocTrabalho
const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativoCls = ' !border-orange-500 bg-orange-50 text-orange-800'
const aplicar = (label: string, f: (d: Draft<Doc>) => void, juntar?: string) => useMaeDoc.getState().aplicar(label, f, juntar)
const fmt = (n: number, c = 1) => (Math.round(n * 10 ** c) / 10 ** c).toLocaleString('pt-BR')
const num = (s: string) => Number(String(s).replace(',', '.'))
export const COR_PARTE = ['#f97316', '#2563eb', '#16a34a', '#9333ea', '#db2777', '#0891b2', '#ca8a04', '#64748b', '#dc2626', '#4f46e5']

/** Controle deslizante que vira 1 passo de desfazer por arrasto. */
let seq = 0
const unidadeDe = (txt: string) => { const u = txt.replace(/[-−\d.,\s]/g, ''); return u.length <= 2 ? u : null }
function Faixa({ rotulo, valor, min, max, passo, fmtV, onMudar, dado }: { rotulo: string; valor: number; min: number; max: number; passo: number; fmtV?: (v: number) => string; onMudar: (v: number, juntar: string) => void; dado: string }) {
  const [id, setId] = useState(0)
  const u = unidadeDe(fmtV ? fmtV(valor) : fmt(valor, 2)) ?? ''
  return (
    <label className="block text-[11px] text-gray-500">
      <span>{rotulo}</span>{u === '°' && valor !== 0 && <button type="button" className="ml-1 rounded border border-gray-200 px-1 text-[10px] text-gray-500 hover:border-orange-400" onClick={e => { e.preventDefault(); onMudar(0, `${dado}:zero:${Date.now()}`) }} title="Voltar para 0°" data-zero-giro={dado}>0°</button>}
      <Deslizador min={min} max={max} step={passo} value={valor} onPointerDown={() => setId(++seq)} onChange={e => onMudar(Number(e.target.value), `${dado}:${id}`)} unidade={u} fator={u === '%' ? 100 : 1} data-faixa={dado} aria-label={rotulo} />
    </label>
  )
}

// ── 4. Partes ────────────────────────────────────────────────────────────────────────────────────
function PassoPartes() {
  const doc = useMaeDoc(s => s.hist.atual)
  const ativa = useEditor(s => s.parteAtiva)
  const set = useEditor.getState().set
  const [nova, setNova] = useState('')
  const [renomear, setRenomear] = useState<string | null>(null)
  useEffect(() => { if (!doc.parts.length) aplicar('Partes prontas', d => garantirPartesPadrao(d as Doc)) }, [doc.parts.length])
  useEffect(() => { if (!ativa && doc.parts[0]) set({ parteAtiva: doc.parts[0].id }) }, [ativa, doc.parts, set])
  const sug = ativa ? sugerirParaParte(doc, ativa) : []
  const nomeMolde = (faceId: string) => acharFace(doc, faceId)?.molde.name ?? ''
  const semParte = doc.molds.reduce((s, m) => s + m.faces.filter(f => !f.hole && !doc.parts.some(p => p.instances.some(i => i.faceId === f.id))).length, 0)
  return (
    <div className="space-y-2" data-passo-partes>
      <p className="text-[11px] text-gray-500">Escolha uma parte e clique nas faces dela em <b>todos</b> os moldes. Clicar de novo tira. Faces sem parte viram <b>abas</b> (recebem o papel das abas).</p>
      <ul className="space-y-0.5" data-lista-partes>
        {doc.parts.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-xs cursor-pointer ${ativa === p.id ? 'bg-orange-50 ring-1 ring-orange-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={() => set({ parteAtiva: p.id })} data-parte={p.name}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COR_PARTE[i % COR_PARTE.length] }} />
            {renomear === p.id ? (
              <input autoFocus defaultValue={p.name} className="flex-1 min-w-0 rounded border border-orange-300 bg-transparent px-1" onClick={e => e.stopPropagation()}
                onBlur={e => { const v = e.target.value.trim().toUpperCase().slice(0, 60); if (v) aplicar('Renomear parte', d => { const pp = d.parts.find(x => x.id === p.id); if (pp) pp.name = v }); setRenomear(null) }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenomear(null) }} data-renomear-parte />
            ) : <span className="flex-1 truncate font-medium" onDoubleClick={() => setRenomear(p.id)} title="Duplo clique para renomear">{p.name}</span>}
            <span className="tabular-nums text-gray-500" data-n-faces-parte>{p.instances.length}</span>
            <button className="p-0.5 rounded hover:bg-gray-100 opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); aplicar('Excluir parte', d => excluirParte(d as Doc, p.id)) }} title="Excluir parte"><X className="w-3 h-3" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <input value={nova} onChange={e => setNova(e.target.value)} placeholder="nova parte (ex.: ETIQUETA)" className="flex-1 min-w-0 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs" data-nova-parte />
        <button className={btn} disabled={!nova.trim()} onClick={() => { aplicar('Nova parte', d => { novaParte(d as Doc, nova.trim().toUpperCase()) }); setNova('') }}><Plus className="w-3.5 h-3.5" /></button>
      </div>
      {ativa && sug.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1" data-sugestoes>
          <p className="text-[11px] text-amber-800 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Parecidas nos outros moldes (destacadas em amarelo):</p>
          <ul className="flex flex-wrap gap-1">
            {sug.map(s => <li key={s.faceId}><button className="rounded bg-white border border-amber-300 px-1.5 py-0.5 text-[11px] text-amber-900" onClick={() => aceitarSugestoes(ativa, [s.faceId])}>{nomeMolde(s.faceId)} · {s.faceId.split('_').pop()} <b>{Math.round(s.nota * 100)}%</b></button></li>)}
          </ul>
          <button className={btn + ' bg-white'} onClick={() => aceitarSugestoes(ativa, sug.map(s => s.faceId))} data-aceitar-sugestoes><Check className="w-3.5 h-3.5" /> Aceitar todas ({sug.length})</button>
        </div>
      )}
      <p className="text-[11px] text-gray-400" data-sem-parte>{semParte} faces sem parte (abas)</p>
    </div>
  )
}

// ── 5. Enquadramento ─────────────────────────────────────────────────────────────────────────────
const MODOS = [['cover', 'Preencher'], ['contain', 'Caber'], ['stretch', 'Esticar'], ['manual', 'Manual']] as const
function PassoEnquadramento() {
  const doc = useMaeDoc(s => s.hist.atual)
  const { parteAtiva, face, grade } = useEditor()
  const set = useEditor.getState().set
  const parte = doc.parts.find(p => p.id === parteAtiva) ?? doc.parts.find(p => p.instances.length)
  const inst = parte?.instances.find(i => i.faceId === face) ?? null
  const mudar = (label: string, f: (fit: Draft<NonNullable<typeof inst>['fit']>) => void, juntar?: string) => aplicar(label, d => {
    const i = d.parts.find(p => p.id === parte?.id)?.instances.find(x => x.faceId === face)
    if (i) f(i.fit)
  }, juntar)
  return (
    <div className="space-y-2" data-passo-enquadramento>
      <p className="text-[11px] text-gray-500">O papel quadriculado de teste mostra como a arte da parte cai em cada face. Clique numa face para ajustar.</p>
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={grade} onChange={() => set({ grade: !grade })} className="accent-orange-500" /> Papel de teste</label>
      <div className="flex flex-wrap gap-1">
        {doc.parts.filter(p => p.instances.length).map(p => <button key={p.id} className={btn + (parte?.id === p.id ? ativoCls : '')} onClick={() => set({ parteAtiva: p.id, face: null })} data-parte-enq={p.name}>{p.name} ({p.instances.length})</button>)}
      </div>
      {parte && (
        <ul className="flex flex-wrap gap-1" data-faces-da-parte>
          {parte.instances.map(i => <li key={i.faceId}><button className={btn + (face === i.faceId ? ativoCls : '')} onClick={() => set({ face: i.faceId })} data-instancia={i.faceId}>{acharFace(doc, i.faceId)?.molde.name} · {i.faceId.split('_').pop()}</button></li>)}
        </ul>
      )}
      {inst && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-enquadrar>
          <div className="flex flex-wrap gap-1">
            {MODOS.map(([m, r]) => <button key={m} className={btn + (inst.fit.mode === m ? ativoCls : '')} onClick={() => mudar(`Enquadramento: ${r}`, f => { f.mode = m })} data-modo={m}>{r}</button>)}
          </div>
          <Faixa rotulo="Escala" valor={inst.fit.scale ?? 1} min={0.3} max={3} passo={0.01} fmtV={v => `${Math.round(v * 100)}%`} dado="escala" onMudar={(v, j) => mudar('Escala do papel', f => { f.scale = v }, `${face}:${j}`)} />
          <Faixa rotulo="Deslocar ↔" valor={inst.fit.offsetX ?? 0} min={-0.5} max={0.5} passo={0.005} fmtV={v => `${Math.round(v * 100)}%`} dado="dx" onMudar={(v, j) => mudar('Deslocar papel', f => { f.offsetX = v }, `${face}:${j}`)} />
          <Faixa rotulo="Deslocar ↕" valor={inst.fit.offsetY ?? 0} min={-0.5} max={0.5} passo={0.005} fmtV={v => `${Math.round(v * 100)}%`} dado="dy" onMudar={(v, j) => mudar('Deslocar papel', f => { f.offsetY = v }, `${face}:${j}`)} />
          <Faixa rotulo="Rotação" valor={inst.fit.rotationDeg ?? 0} min={-180} max={180} passo={1} fmtV={v => `${Math.round(v)}°`} dado="rot" onMudar={(v, j) => mudar('Girar papel', f => { f.rotationDeg = v }, `${face}:${j}`)} />
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => mudar('Girar 180°', f => { f.rotationDeg = (((f.rotationDeg ?? 0) + 360) % 360) === 180 ? 0 : 180 })} data-girar-180><RotateCw className="w-3.5 h-3.5" /> Girar 180°</button>
            <button className={btn + (inst.fit.mirror ? ativoCls : '')} onClick={() => mudar('Espelhar', f => { f.mirror = !f.mirror })} data-espelhar><FlipHorizontal2 className="w-3.5 h-3.5" /> Espelhar</button>
            <button className={btn} onClick={() => aplicar(`Enquadramento igual em todas (${parte!.name})`, d => { const p = d.parts.find(x => x.id === parte!.id)!; for (const i of p.instances) if (i.faceId !== face) i.fit = { ...inst.fit } })} title="Copia este enquadramento para as outras faces da parte">Igual em todas</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 6. Nome e textos ─────────────────────────────────────────────────────────────────────────────
const VARIAVEIS = ['NOME', 'IDADE', 'HASHTAG', 'ARROBA'] as const
const rotuloVar = (v: string) => (v === 'ARROBA' ? '@ do ateliê' : v)
function PassoTextos() {
  const doc = useMaeDoc(s => s.hist.atual)
  const { posicionar, slot } = useEditor()
  const set = useEditor.getState().set
  const s = doc.textSlots.find(x => x.id === slot) ?? null
  const mudar = (label: string, f: (t: Draft<Doc['textSlots'][number]>) => void, juntar?: string) => aplicar(label, d => { const t = d.textSlots.find(x => x.id === slot); if (t) f(t) }, juntar)
  return (
    <div className="space-y-2" data-passo-textos>
      <p className="text-[11px] text-gray-500">Escolha a variável e clique na face onde ela fica (em cada molde). O texto de verdade (fonte, glifos, efeitos) entra na Sprint 7; aqui é só a posição.</p>
      <div className="flex gap-1">
        {VARIAVEIS.map(v => <button key={v} className={btn + (posicionar?.tipo === 'texto' && posicionar.variavel === v ? ativoCls : '')} onClick={() => set({ posicionar: posicionar?.tipo === 'texto' && posicionar.variavel === v ? null : { tipo: 'texto', variavel: v } })} data-posicionar-var={v}><Type className="w-3.5 h-3.5" /> {rotuloVar(v)}</button>)}
      </div>
      <ul className="space-y-0.5 max-h-40 overflow-y-auto" data-lista-slots>
        {doc.textSlots.map(t => (
          <li key={t.id} className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 cursor-pointer ${slot === t.id ? 'bg-orange-50 ring-1 ring-orange-300' : 'hover:bg-gray-50'}`} onClick={() => set({ slot: t.id, face: t.faceId })} data-slot={t.variable}>
            <b>{rotuloVar(t.variable)}</b> <span className="text-gray-500 truncate">{acharFace(doc, t.faceId)?.molde.name}</span>
            <button className="ml-auto p-0.5 opacity-50 hover:opacity-100" data-excluir-slot onClick={e => { e.stopPropagation(); aplicar('Excluir posição de texto', d => { d.textSlots = d.textSlots.filter(x => x.id !== t.id) }); set({ slot: null }) }}><Trash2 className="w-3 h-3" /></button>
          </li>
        ))}
      </ul>
      <ReplicarTextos />
      {s && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-slot-sel>
          <p className="text-[10px] text-gray-400">Na folha: arraste a caixa para mover, os cantos para o tamanho e a alça de cima para girar (Shift = 15°). Setas do teclado: ajuste fino.</p>
          <Faixa rotulo="Tamanho" valor={s.single?.sizePt ?? 28} min={4} max={120} passo={0.5} fmtV={v => `${Math.round(v * 10) / 10} pt`} dado="stam" onMudar={(v, j) => mudar('Tamanho do texto', t => { const k = v / (t.single?.sizePt ?? 28); if (k > 0) escalarPosicao(t, k) }, `${slot}:${j}`)} />
          <div className="flex items-end gap-1.5">
            <div className="flex-1"><Faixa rotulo="Girar" valor={s.rotationDeg ?? 0} min={-180} max={180} passo={1} fmtV={v => `${Math.round(v)}°`} dado="sgiro" onMudar={(v, j) => mudar('Girar texto', t => { t.rotationDeg = v }, `${slot}:${j}`)} /></div>
            <input inputMode="decimal" defaultValue={String(s.rotationDeg ?? 0)} key={`g${s.id}${s.rotationDeg ?? 0}`} onBlur={e => { const v = num(e.target.value); if (Number.isFinite(v) && Math.abs(v) <= 360) mudar('Girar texto', t => { t.rotationDeg = v }) }} className="w-12 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px]" aria-label="Ângulo em graus" data-giro-num />
          </div>
          <Faixa rotulo="Posição ↔" valor={s.box.x} min={0} max={1} passo={0.005} fmtV={v => `${Math.round(v * 100)}%`} dado="sx" onMudar={(v, j) => mudar('Mover texto', t => { t.box.x = v }, `${slot}:${j}`)} />
          <Faixa rotulo="Posição ↕" valor={s.box.y} min={0} max={1} passo={0.005} fmtV={v => `${Math.round(v * 100)}%`} dado="sy" onMudar={(v, j) => mudar('Mover texto', t => { t.box.y = v }, `${slot}:${j}`)} />
          <Faixa rotulo="Largura" valor={s.box.w} min={0.05} max={1} passo={0.005} fmtV={v => `${Math.round(v * 100)}%`} dado="sw" onMudar={(v, j) => mudar('Largura do texto', t => { t.box.w = v }, `${slot}:${j}`)} />
          <Faixa rotulo="Altura" valor={s.box.h} min={0.03} max={0.8} passo={0.005} fmtV={v => `${Math.round(v * 100)}%`} dado="sh" onMudar={(v, j) => mudar('Altura do texto', t => { t.box.h = v }, `${slot}:${j}`)} />
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <label className="space-y-0.5">Nome simples (pt)
              <input inputMode="decimal" defaultValue={s.single?.sizePt ?? 28} key={`s${s.id}`} onBlur={e => num(e.target.value) > 0 && mudar('Tamanho (simples)', t => { t.single = { lines: 1, sizePt: num(e.target.value) } })} className="w-full rounded border border-gray-200 bg-transparent px-1 py-0.5" data-simples-pt />
            </label>
            <label className="space-y-0.5">Composto
              <select value={s.compound?.lines ?? 2} onChange={e => mudar('Nome composto: linhas', t => { t.compound = { lines: Number(e.target.value) as 1 | 2, sizePt: t.compound?.sizePt ?? 22, lineHeight: t.compound?.lineHeight ?? 0.9 } })} className="w-full rounded border border-gray-200 bg-transparent px-1 py-0.5" data-composto-linhas>
                <option value={1}>1 linha</option><option value={2}>2 linhas</option>
              </select>
            </label>
            <label className="space-y-0.5 col-span-2">Composto (pt)
              <input inputMode="decimal" defaultValue={s.compound?.sizePt ?? 22} key={`c${s.id}`} onBlur={e => num(e.target.value) > 0 && mudar('Tamanho (composto)', t => { t.compound = { lines: t.compound?.lines ?? 2, sizePt: num(e.target.value), lineHeight: t.compound?.lineHeight ?? 0.9 } })} className="w-full rounded border border-gray-200 bg-transparent px-1 py-0.5" />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 7. Identidade ────────────────────────────────────────────────────────────────────────────────
function PassoIdentidade({ identidade, setIdentidade }: { identidade: Identidade; setIdentidade: (i: Identidade) => void }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const { posicionar } = useEditor()
  const set = useEditor.getState().set
  const [link, setLink] = useState(identidade.qr?.link ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  async function escolherLogo() {
    if (!raiz) return
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp'
    inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; const i = await guardarImagem(raiz, f, 'Identidade'); const novo = { ...identidade, logo: { path: i.path, sha256: i.sha256, aspect: i.aspect } }; await gravarIdentidade(raiz, novo); setIdentidade(novo) }
    inp.click()
  }
  async function qr() {
    if (!raiz || !link.trim()) return
    try { const q = await gerarQr(raiz, link.trim()); const novo = { ...identidade, qr: q }; await gravarIdentidade(raiz, novo); setIdentidade(novo); setMsg('QR Code gerado em Identidade/qr.png') } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <div className="space-y-2" data-passo-identidade>
      <p className="text-[11px] text-gray-500">Cadastro único do ateliê (fica em <b>Identidade/</b> na Biblioteca). Depois posicione logo e QR em cada molde — ficam <b>travados</b> nos temas.</p>
      <div className="flex flex-wrap gap-1.5 items-center">
        <button className={btn} disabled={!liberada} onClick={escolherLogo} data-escolher-logo><ImagePlus className="w-3.5 h-3.5" /> {identidade.logo ? 'Trocar logo' : 'Escolher logo'}</button>
        {identidade.logo && <span className="text-[11px] text-emerald-700">logo ✓</span>}
      </div>
      <div className="flex gap-1">
        <input value={link} onChange={e => setLink(e.target.value)} placeholder="link do WhatsApp ou Instagram" className="flex-1 min-w-0 rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs" data-link-qr />
        <button className={btn} disabled={!liberada || !link.trim()} onClick={qr} data-gerar-qr><QrCode className="w-3.5 h-3.5" /> Gerar QR</button>
      </div>
      <input defaultValue={identidade.arroba ?? ''} placeholder="@ do ateliê" onBlur={async e => { if (!raiz) return; const novo = { ...identidade, arroba: e.target.value.trim() }; await gravarIdentidade(raiz, novo); setIdentidade(novo) }} className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs" />
      {msg && <p className="text-[11px] text-gray-500">{msg}</p>}
      <div className="flex gap-1">
        <button className={btn + (posicionar?.tipo === 'logo' ? ativoCls : '')} disabled={!identidade.logo} onClick={() => set({ posicionar: posicionar?.tipo === 'logo' ? null : { tipo: 'logo' } })} data-posicionar-logo>Posicionar logo</button>
        <button className={btn + (posicionar?.tipo === 'qr' ? ativoCls : '')} disabled={!identidade.qr} onClick={() => set({ posicionar: posicionar?.tipo === 'qr' ? null : { tipo: 'qr' } })} data-posicionar-qr>Posicionar QR</button>
      </div>
      {posicionar && posicionar.tipo !== 'texto' && <p className="text-[11px] text-orange-700">Clique no molde onde o {posicionar.tipo === 'logo' ? 'logo' : 'QR'} fica.</p>}
      <ul className="space-y-1 text-xs" data-identidade-moldes>
        {doc.molds.map(m => (
          <li key={m.id} className="flex flex-wrap items-center gap-1.5">
            <span className="flex-1 truncate">{m.name}</span>
            {(['logo', 'qr'] as const).map(k => m.identity?.[k] ? (
              <div key={k} className="w-full space-y-0.5 rounded border border-gray-100 p-1 text-[11px]" data-ident-controles={k}>
                <div className="flex items-center gap-1"><b>{k === 'logo' ? 'Logo' : 'QR'}</b><span className="text-gray-400">· {m.name}</span>
                  <button className="ml-auto opacity-50 hover:opacity-100" title="Tirar do molde" onClick={() => aplicar('Tirar identidade', d => { const mm = d.molds.find(x => x.id === m.id); if (mm?.identity) delete mm.identity[k] })}><X className="w-3 h-3" /></button></div>
                <Faixa rotulo="Tamanho" valor={m.identity[k]!.wMm} min={4} max={80} passo={0.5} fmtV={v => `${fmt(v)} mm`} dado={`ident-tam-${k}`} onMudar={(v, j) => aplicar('Tamanho da identidade', d => { const p = d.molds.find(x => x.id === m.id)?.identity?.[k]; if (!p) return; const asp = identidade[k]?.aspect || 1, cx = p.xMm + p.wMm / 2, cy = p.yMm + p.wMm / asp / 2; p.wMm = v; p.xMm = Math.round((cx - v / 2) * 100) / 100; p.yMm = Math.round((cy - v / asp / 2) * 100) / 100 }, `ident:${m.id}:${k}:${j}`)} />
                <Faixa rotulo="Girar" valor={m.identity[k]!.rotationDeg ?? 0} min={-180} max={180} passo={1} fmtV={v => `${Math.round(v)}°`} dado={`ident-giro-${k}`} onMudar={(v, j) => aplicar('Girar identidade', d => { const p = d.molds.find(x => x.id === m.id)?.identity?.[k]; if (p) p.rotationDeg = v }, `identg:${m.id}:${k}:${j}`)} />
              </div>
            ) : null)}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── 8. Arte inteligente ──────────────────────────────────────────────────────────────────────────
function PassoArteInteligente() {
  const doc = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [papeis, setPapeis] = useState<string[]>([])
  useEffect(() => { if (raiz && liberada) listarImagens(raiz, 'Papéis').then(setPapeis) }, [raiz, liberada])
  const sobra = doc.smartArt?.overflowMm ?? 10
  async function usar(path: string) {
    if (!raiz) return
    const i = await infoImagem(raiz, path)
    aplicar('Papel das abas', d => { d.smartArt = { overflowMm: d.smartArt?.overflowMm ?? 10, flapFill: { path: i.path, sha256: i.sha256, aspect: i.aspect } } })
  }
  async function adicionar() {
    if (!raiz) return
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp'
    inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; const i = await guardarImagem(raiz, f, 'Papéis'); setPapeis(p => [...new Set([...p, i.path])]); await usar(i.path) }
    inp.click()
  }
  return (
    <div className="space-y-2" data-passo-arte>
      <label className="flex items-center gap-2 text-xs">Sobra (mm)
        <input inputMode="decimal" defaultValue={fmt(sobra)} key={sobra} onBlur={e => { const v = num(e.target.value); if (v >= 0 && v <= 30) aplicar('Sobra da arte inteligente', d => { d.smartArt = { ...(d.smartArt ?? {}), overflowMm: v } }) }} className="w-16 rounded border border-gray-200 bg-transparent px-1.5 py-1" data-sobra />
      </label>
      <p className="text-[11px] text-gray-400">A arte vaza esta sobra além do corte na “Arte pra impressão” (Sprint 9).</p>
      <p className="text-xs font-medium">Papel das abas {doc.smartArt?.flapFill && <span className="text-emerald-700 font-normal">✓ {doc.smartArt.flapFill.path.split('/').pop()}</span>}</p>
      <div className="flex flex-wrap gap-1">
        {papeis.slice(0, 12).map(p => <button key={p} className={btn + (doc.smartArt?.flapFill?.path === p ? ativoCls : '')} onClick={() => usar(p)} data-papel-aba={p}>{p.split('/').pop()}</button>)}
        <button className={btn} disabled={!liberada} onClick={adicionar} data-papel-abas-pc><ImagePlus className="w-3.5 h-3.5" /> Do computador…</button>
        {doc.smartArt?.flapFill && <button className={btn} onClick={() => aplicar('Sem papel das abas', d => { if (d.smartArt) delete d.smartArt.flapFill })}>Tirar</button>}
      </div>
    </div>
  )
}

// ── 9. Salvar ────────────────────────────────────────────────────────────────────────────────────
function PassoSalvar({ inicio }: { inicio: number | null }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [msg, setMsg] = useState<string | null>(null)
  const comParte = doc.parts.filter(p => p.instances.length)
  const identOk = doc.molds.filter(m => m.identity?.logo || m.identity?.qr).length
  const moldesComNome = new Set(doc.textSlots.filter(t => t.variable === 'NOME').map(t => acharFace(doc, t.faceId)?.molde.id)).size
  async function salvar() {
    if (!raiz) return
    aplicar('Salvar base', d => { d.version = (d.version ?? 0) + 1 })
    const path = await salvarBase(raiz, useMaeDoc.getState().hist.atual)
    const seg = inicio ? Math.round((Date.now() - inicio) / 1000) : null
    // Lote 3 (item 35): os temas desta base passam a usar a versão nova
    const usos = new Set((await listarTemas(raiz).catch(() => [])).filter(t => t.doc.baseId === doc.id).map(t => t.doc.id)).size
    setMsg(`Salva em ${path} (versão ${useMaeDoc.getState().hist.atual.version})${seg !== null ? ` · montada em ${Math.floor(seg / 60)} min ${seg % 60} s` : ''}${usos ? ` · Esta base é usada em ${usos} tema(s). As mudanças vão valer para eles (os pedidos já gerados não mudam).` : ''}`)
  }
  return (
    <div className="space-y-2" data-passo-salvar>
      <label className="block text-xs">Nome da base
        <input defaultValue={doc.name} key={doc.id} onBlur={e => { const v = e.target.value.trim().slice(0, 120); if (v && v !== doc.name) aplicar('Nome da base', d => { d.name = v }) }} className="mt-0.5 w-full rounded border border-gray-200 bg-transparent px-1.5 py-1" data-nome-base />
      </label>
      <ul className="text-[11px] space-y-0.5 text-gray-600" data-resumo-base>
        <li>{doc.molds.length} moldes em {doc.artboards.length} folhas</li>
        <li>{comParte.length} partes com faces: {comParte.map(p => `${p.name} (${p.instances.length})`).join(', ') || '—'}</li>
        <li>NOME posicionado em {moldesComNome} de {doc.molds.length} moldes · {doc.textSlots.length} posições de texto</li>
        <li>Identidade em {identOk} de {doc.molds.length} moldes · sobra {fmt(doc.smartArt?.overflowMm ?? 10)} mm{doc.smartArt?.flapFill ? ' · papel das abas ✓' : ''}</li>
      </ul>
      <div className="flex gap-1.5">
        <button className={btn + ' !border-orange-400 bg-orange-50 text-orange-800'} disabled={!liberada || !doc.molds.length} onClick={salvar} data-salvar-base><Save className="w-3.5 h-3.5" /> Salvar base</button>
        <button className={btn} disabled={!liberada} onClick={() => useEditor.getState().set({ pedidoTopo: 'abrir-base' })} data-abrir-base><FolderOpen className="w-3.5 h-3.5" /> Abrir base…</button>
      </div>
      {msg && <p className="text-[11px] text-emerald-700" data-msg-salvar>{msg}</p>}
    </div>
  )
}

export default function PainelBase() {
  const passo = useEditor(s => s.passo)
  const set = useEditor.getState().set
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const temMoldes = useMaeDoc(s => s.hist.atual.molds.length > 0)
  const docId = useMaeDoc(s => s.hist.atual.id)
  const identidade = useEditor(s => s.identidade)
  const setIdentidade = (i: Identidade) => useEditor.getState().set({ identidade: i })
  const [inicio, setInicio] = useState<number | null>(null)
  const [agora, setAgora] = useState(0)
  useEffect(() => { if (raiz && liberada) lerIdentidade(raiz).then(async i => { for (const k of ['logo', 'qr'] as const) if (i[k]) await infoImagem(raiz, i[k]!.path).catch(() => null); useEditor.getState().set({ identidade: i }) }) }, [raiz, liberada])
  // cronômetro da montagem (critério da Sprint 5: base de 6 moldes em < 20 min)
  useEffect(() => {
    if (!temMoldes) return
    let ini: number | null = null
    try { ini = Number(localStorage.getItem(`mae:inicio:${docId}`)) || null } catch { /* */ }
    if (!ini) { ini = Date.now(); try { localStorage.setItem(`mae:inicio:${docId}`, String(ini)) } catch { /* */ } }
    setInicio(ini)
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [temMoldes, docId])
  const seg = inicio && agora ? Math.max(0, Math.round((agora - inicio) / 1000)) : 0
  const lado = useLado(), funcao = useEditor(s => s.funcao)
  return (
    <section className="space-y-2" data-painel-base>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Montar a base</h2>
        {inicio && <span className="text-[11px] tabular-nums text-gray-500 flex items-center gap-1" title="Tempo desde o 1º molde" data-cronometro><Timer className="w-3 h-3" /> {Math.floor(seg / 60)}:{String(seg % 60).padStart(2, '0')}</span>}
      </div>
      {lado === 'tudo' && <ol className="flex flex-wrap gap-1" data-passos>
        {PASSOS.map((p, i) => (
          <li key={p}><button className={`rounded-full border px-2 py-0.5 text-[11px] ${passo === i + 1 ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`} onClick={() => set({ passo: i + 1, posicionar: null })} data-passo={i + 1}>{i + 1}. {p}</button></li>
        ))}
      </ol>}
      {lado !== 'tudo' && funcao === 'marcas' ? <MarcasPranchetas /> : <>
      {passo <= 3 && <PainelMoldes />}
      {passo === 4 && <PassoPartes />}
      {passo === 5 && <PassoEnquadramento />}
      {passo === 6 && <PassoTextos />}
      {passo === 7 && <PassoIdentidade identidade={identidade} setIdentidade={setIdentidade} />}
      {passo === 8 && <PassoArteInteligente />}
      {passo === 9 && <PassoSalvar inicio={inicio} />}
      </>}
      <div className="flex justify-between pt-1">
        <button className={btn} disabled={passo <= 1} onClick={() => set({ passo: passo - 1, posicionar: null })}>← Voltar</button>
        <button className={btn} disabled={passo >= PASSOS.length} onClick={() => set({ passo: passo + 1, posicionar: null })} data-proximo>Próximo →</button>
      </div>
    </section>
  )
}
