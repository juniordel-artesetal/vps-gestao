'use client'
// SOA Design — KIT COMPOSER (Fases 4/5): KIT (slots → faca) · COMPOSIÇÕES (compositor visual) · TEMAS (cada slot é uma
// caixa viva; o kit consome as caixas DIRETO — nada é baixado/reenviado; mudou uma caixa → kit e composições que a usam
// atualizam) · LOTE DE KITS (50 temas numa operação) · PRESETS DE EXPORTAÇÃO por marketplace. Versões: o tema guarda o
// snapshot do kit/composições que usou; versão nova é opt-in.
'use no memo'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, ChevronUp, ChevronDown, Loader2, ArrowLeft, Upload, Package } from 'lucide-react'
import { MotorKit, snapKit, versoesNovas, PRESETS_EXPORT_PADRAO, type KitTemplate, type KitSlot, type Composicao, type KitInstancia, type ExportPreset, type PosicaoSlot } from '@/lib/estudio/kitMotor'
import { carregarDadosKit, criarTema, trocarArteDoSlot, type DadosKit } from '@/lib/estudio/kitCriar'
import { CENAS_PRONTAS } from '@/lib/estudio/cenasProntas'
import type { BoxInstancia } from '@/lib/estudio/caixaViva'
import type { ConfigCena } from '@/lib/estudio/mockupTipos'
import CompositorKit from './CompositorKit'
import LoteKits from './LoteKits'
import SaidasKit, { type TemaSaida } from './SaidasKit'
import { useBaseEstudio, inp, lbl, btn, btnP, cartao } from '../caixas/comum'

type Salvo = { id: string; nome: string; valor: ConfigCena }
const idx = () => Math.random().toString(36).slice(2, 9)
const ABAS = [{ id: 'kit', n: 'Kit e slots' }, { id: 'comp', n: 'Composições' }, { id: 'temas', n: 'Temas' }, { id: 'lote', n: 'Lote de kits' }, { id: 'presets', n: 'Presets de exportação' }] as const

export default function KitComposer({ cenasDela }: { cenasDela: Salvo[] }) {
  const { workspaceId, storage } = useBaseEstudio()
  const [d, setD] = useState<DadosKit | null>(null)
  const [kitId, setKitId] = useState<string | null>(null)
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('kit')
  const [compSel, setCompSel] = useState<string | 'nova' | null>(null)
  const [compChave, setCompChave] = useState('')   // monta o compositor 1x por abertura (salvar não remonta)
  const [temaSel, setTemaSel] = useState<string | null>(null)
  const [erro, setErro] = useState(''); const [avisoTopo, setAvisoTopo] = useState('')
  const [recarga, setRecarga] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [motor] = useState(() => new MotorKit())   // um motor (e seus caches) por tela
  const carregar = async () => {
    const x = await carregarDadosKit()
    motor.definir({ tpls: x.tpls, mockups: x.mockups, apliques: x.apliques })
    setD(x); setKitId(k => k || x.kits[0]?.id || null)
  }
  useEffect(() => { Promise.resolve().then(carregar) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="text-sm text-gray-500"><Loader2 className="inline w-4 h-4 animate-spin" /> Carregando kits…</p>
  const kit = d.kits.find(k => k.id === kitId) || null
  const comps = (kit ? d.comps.filter(c => c.kitTemplateId === kit.id) : []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
  const temas = kit ? d.temas.filter(t => t.kitTemplateId === kit.id) : []
  const caixasPorId = new Map(d.caixas.map(c => [c.id, c]))
  const tplsMap = new Map(d.tpls.map(t => [t.id, t]))
  const mockupsMap = new Map(d.mockups.map(m => [String(m.id), m]))
  const caixasDoTema = (t: KitInstancia): Record<string, BoxInstancia | undefined> => Object.fromEntries(Object.entries(t.slots).map(([s, id]) => [s, caixasPorId.get(id)]))
  /** composições que valem para o tema: as do snapshot (versão usada) */
  const compsDoTema = (t: KitInstancia): Composicao[] => { const s = t.config.snap; return (s ? Object.entries(s.comps).map(([id, c]) => ({ id, kitTemplateId: t.kitTemplateId, nome: c.nome, posicoes: c.posicoes, versao: c.versao, config: c.config })) : [...comps]).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })) }
  const temaAmostra = temas[0]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Package className="w-5 h-5 text-orange-500" />
        <select className={inp + ' !w-auto'} value={kitId || ''} onChange={e => { setKitId(e.target.value || null); setCompSel(null); setTemaSel(null) }} data-kit-sel>
          {!d.kits.length && <option value="">nenhum kit ainda</option>}
          {d.kits.map(k => <option key={k.id} value={k.id}>{k.nome} ({k.slots.length} caixas)</option>)}
        </select>
        <button onClick={() => { setKitId(null); setAba('kit') }} className={btn + ' !text-xs'} data-novo-kit><Plus className="w-3.5 h-3.5" /> Novo kit</button>
        <div className="flex flex-wrap gap-1 ml-auto">{ABAS.map(a => <button key={a.id} disabled={!kit && a.id !== 'kit' && a.id !== 'presets'} onClick={() => { setAba(a.id); setTemaSel(null); setCompSel(null); setAvisoTopo('') }} className={`text-xs px-2.5 py-1 rounded-full border disabled:opacity-40 ${aba === a.id ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200' : 'border-gray-200 dark:border-gray-700'}`} data-aba-kit={a.n}>{a.n}</button>)}</div>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {avisoTopo && <p className="text-sm text-emerald-700" data-aviso-kit>{avisoTopo}</p>}
      {!d.tpls.some(t => t.config.mockupId) && <p className="text-xs text-amber-700">Dica: o kit usa as FACAS com “mockup 3D” (Caixas vivas → faca → Gerar mockup 3D).</p>}

      {aba === 'kit' && <EditorKit key={kit?.id || 'novo'} kit={kit} tpls={d.tpls} onSalvo={async (k, msg) => { await carregar(); setKitId(k); setAvisoTopo(msg) }} />}

      {aba === 'comp' && kit && (compSel ? (
        <div className="space-y-2">
          <button onClick={() => setCompSel(null)} className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Composições</button>
          <CompositorKit key={compChave} kit={kit} comp={comps.find(c => c.id === compSel) || null} caixas={temaAmostra ? caixasDoTema(temaAmostra) : lisas(kit, tplsMap)} motor={motor} onSalvo={async c => { await carregar(); setCompSel(c.id) }} />
          {!temaAmostra && <p className="text-[11px] text-gray-500">Mostrando as caixas lisas — crie um tema para ver com arte.</p>}
        </div>
      ) : (
        <div className={`${cartao} space-y-2`}>
          <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">Composições de “{kit.nome}” <span className="font-normal text-xs text-gray-500">— a disposição das caixas, reutilizável por qualquer tema</span></p><button onClick={() => { setCompSel('nova'); setCompChave(`n${Date.now()}`) }} className={btnP + ' !text-xs'} data-nova-comp><Plus className="w-3.5 h-3.5" /> Nova composição</button></div>
          {!comps.length && <p className="text-xs text-gray-400">Nenhuma ainda — crie o “Modelo 01”.</p>}
          {comps.map(c => <div key={c.id} className="flex items-center gap-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5" data-comp={c.nome}><span className="flex-1"><b>{c.nome}</b> · v{c.versao}</span><button onClick={() => { setCompSel(c.id); setCompChave(`${c.id}${Date.now()}`) }} className="text-orange-600 hover:underline">abrir</button><button onClick={async () => { if (confirm(`Excluir “${c.nome}”?`)) { await fetch(`/api/estudio/composicoes/${c.id}`, { method: 'DELETE' }); carregar() } }}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button></div>)}
        </div>
      ))}

      {aba === 'temas' && kit && (temaSel ? (
        <ProjetoTema key={temaSel} kit={kit} tema={temas.find(t => t.id === temaSel)!} comps={comps} compsDoTema={compsDoTema} caixasDoTema={caixasDoTema} presets={d.presets} cenasDela={cenasDela} motor={motor} onVoltar={() => setTemaSel(null)} onMudou={carregar} />
      ) : (
        <ListaTemas kit={kit} temas={temas} comps={comps} caixasDoTema={caixasDoTema} motor={motor} podeSalvar={!!storage && !!workspaceId} onAbrir={setTemaSel} onCriar={async (tema, arquivos) => { try { await criarTema({ tema, kit, comps, tpls: tplsMap, mockups: mockupsMap, arquivos, workspaceId: workspaceId! }); await carregar() } catch (e) { setErro((e as Error).message) } }} onExcluir={async t => { await fetch(`/api/estudio/kit-instancias/${t.id}`, { method: 'DELETE' }); carregar() }} />
      ))}

      {aba === 'lote' && kit && (comps.length ? <LoteKits kit={kit} comps={comps} tpls={tplsMap} mockups={mockupsMap} presets={d.presets} cenasDela={cenasDela} motor={motor} onCriados={() => { if (recarga) clearTimeout(recarga); setRecarga(setTimeout(() => { void carregar() }, 2500)) }} /> : <p className="text-sm text-gray-500">Crie primeiro uma composição (aba “Composições”) — o lote monta os kits com ela.</p>)}

      {aba === 'presets' && <PresetsExport presets={d.presets} onMudou={carregar} />}
    </div>
  )
}

/** Caixas lisas (sem arte) para compor antes de existir tema. */
function lisas(kit: KitTemplate, tpls: Map<string, DadosKit['tpls'][number]>): Record<string, BoxInstancia | undefined> {
  return Object.fromEntries(kit.slots.map(s => { const t = tpls.get(s.boxTemplateId); return [s.id, t ? { id: `lisa:${s.id}`, nome: s.name, boxTemplateId: t.id, mockupId: t.config.mockupId || null, artworkUrl: null, faces: {}, apliques: [], saidas: [], config: {} } : undefined] }))
}

function EditorKit({ kit, tpls, onSalvo }: { kit: KitTemplate | null; tpls: DadosKit['tpls']; onSalvo: (id: string, msg: string) => void }) {
  const [nome, setNome] = useState(kit?.nome || '')
  const [slots, setSlots] = useState<KitSlot[]>(kit?.slots || [])
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState(''); const [ocupado, setOcupado] = useState(false)
  const mudar = (id: string, p: Partial<KitSlot>) => setSlots(x => x.map(s => (s.id === id ? { ...s, ...p } : s)))
  const mover = (i: number, d: -1 | 1) => setSlots(x => { const a = [...x], j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return a.map((s, k) => ({ ...s, order: k })) })
  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome ao kit (ex.: Kit Festa 6 caixas).'); return }
    if (!slots.length || slots.some(s => !s.name.trim() || !s.boxTemplateId)) { setErro('Cada caixa precisa de nome e de uma faca.'); return }
    setOcupado(true); setErro('')
    try {
      const mudouSlots = JSON.stringify(slots) !== JSON.stringify(kit?.slots || [])
      const corpo = { nome: nome.trim(), slots: slots.map((s, i) => ({ ...s, order: i })), versao: kit ? (kit.versao || 1) + (mudouSlots ? 1 : 0) : 1, config: kit?.config || {} }
      const r = await fetch(kit ? `/api/estudio/kit-templates/${kit.id}` : '/api/estudio/kit-templates', { method: kit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      setAviso(`Kit “${corpo.nome}” salvo (v${corpo.versao}).`); onSalvo(kit?.id || j.id, `Kit “${corpo.nome}” salvo (v${corpo.versao}). Agora monte a composição (aba “Composições”).`)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }
  return (
    <div className={`${cartao} space-y-2`}>
      <label className={lbl}>Nome do kit<input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Kit Festa 6 caixas" data-nome-kit /></label>
      <p className="text-xs font-semibold">Caixas do kit (slots)</p>
      {slots.map((s, i) => (
        <div key={s.id} className="grid grid-cols-[1fr_1fr_auto_1.3fr_auto] gap-1.5 items-center text-xs" data-slot={s.name}>
          <input className={inp + ' !text-xs'} value={s.name} onChange={e => mudar(s.id, { name: e.target.value })} placeholder="Milk" />
          <select className={inp + ' !text-xs'} value={s.boxTemplateId} onChange={e => mudar(s.id, { boxTemplateId: e.target.value })}><option value="">faca…</option>{tpls.map(t => <option key={t.id} value={t.id}>{t.nome}{t.config.mockupId ? '' : ' (sem mockup 3D)'}</option>)}</select>
          <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={s.required} onChange={e => mudar(s.id, { required: e.target.checked })} /> obrigatória</label>
          <input className={inp + ' !text-xs'} value={s.aliases.join(', ')} onChange={e => mudar(s.id, { aliases: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="apelidos: cx_milk, caixa_milk" title="Nomes que aparecem nos arquivos" />
          <span className="flex gap-0.5"><button onClick={() => mover(i, -1)}><ChevronUp className="w-3.5 h-3.5 text-gray-400" /></button><button onClick={() => mover(i, 1)}><ChevronDown className="w-3.5 h-3.5 text-gray-400" /></button><button onClick={() => setSlots(x => x.filter(y => y.id !== s.id))}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button></span>
        </div>
      ))}
      <button onClick={() => setSlots(x => [...x, { id: idx(), name: '', boxTemplateId: tpls[0]?.id || '', required: true, aliases: [], order: x.length }])} className={btn + ' !text-xs'} data-add-slot><Plus className="w-3.5 h-3.5" /> caixa</button>
      <div className="flex items-center gap-2"><button onClick={salvar} disabled={ocupado} className={btnP} data-salvar-kit><Save className="w-4 h-4" /> Salvar kit</button>{kit && <span className="text-[11px] text-gray-500">v{kit.versao} — mudar as caixas cria uma versão nova; temas antigos seguem na deles.</span>}</div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {aviso && <p className="text-xs text-emerald-700">{aviso}</p>}
    </div>
  )
}

function ListaTemas({ kit, temas, comps, caixasDoTema, motor, podeSalvar, onAbrir, onCriar, onExcluir }: { kit: KitTemplate; temas: KitInstancia[]; comps: Composicao[]; caixasDoTema: (t: KitInstancia) => Record<string, BoxInstancia | undefined>; motor: MotorKit; podeSalvar: boolean; onAbrir: (id: string) => void; onCriar: (tema: string, arquivos: Record<string, File>) => Promise<void>; onExcluir: (t: KitInstancia) => void }) {
  const [novo, setNovo] = useState(false); const [tema, setTema] = useState(''); const [arqs, setArqs] = useState<Record<string, File>>({}); const [ocupado, setOcupado] = useState(false)
  const [minis, setMinis] = useState<Record<string, string>>({})
  useEffect(() => {
    let vivo = true
    ;(async () => { const o: Record<string, string> = {}; for (const t of temas.slice(0, 24)) { const c = comps[0]; if (!c) break; const s = t.config.snap?.comps[c.id]; const k = await motor.kit(s ? { posicoes: s.posicoes, config: s.config } : c, t.composicoes.find(x => x.composicaoId === c.id)?.ajustes, caixasDoTema(t), 'previa').catch(() => null); if (k) { const m = document.createElement('canvas'), q = 180 / Math.max(k.width, k.height); m.width = k.width * q; m.height = k.height * q; m.getContext('2d')!.drawImage(k, 0, 0, m.width, m.height); o[t.id] = m.toDataURL('image/png') } } if (vivo) setMinis(o) })()
    return () => { vivo = false }
  }, [temas, comps]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      <div className={`${cartao} space-y-2`}>
        <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">Temas de “{kit.nome}”</p><button onClick={() => setNovo(v => !v)} disabled={!podeSalvar} className={btnP + ' !text-xs'} data-novo-tema><Plus className="w-3.5 h-3.5" /> Novo tema</button></div>
        {novo && (
          <div className="rounded-lg border border-orange-200 p-2 space-y-1.5 text-xs">
            <input className={inp} value={tema} onChange={e => setTema(e.target.value)} placeholder="Tema (ex.: Sereia)" data-nome-tema />
            {kit.slots.map(s => <label key={s.id} className="flex items-center gap-2"><span className="w-28 truncate">{s.name}{s.required ? ' *' : ''}</span><span className={btn + ' !text-xs !py-0.5 cursor-pointer'}><Upload className="w-3 h-3" /> {arqs[s.id]?.name || 'arte planificada'}<input type="file" accept="image/*,.pdf,.svg" className="hidden" data-arte-slot={s.name} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setArqs(a => ({ ...a, [s.id]: f })) }} /></span></label>)}
            <button disabled={ocupado || !tema.trim() || kit.slots.some(s => s.required && !arqs[s.id])} onClick={async () => { setOcupado(true); await onCriar(tema.trim(), arqs); setOcupado(false); setNovo(false); setTema(''); setArqs({}) }} className={btnP + ' !text-xs'} data-criar-tema>{ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Criar tema (vira caixas vivas)</button>
          </div>
        )}
        {!temas.length && !novo && <p className="text-xs text-gray-400">Nenhum tema — crie um aqui ou use o “Lote de kits”.</p>}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
          {temas.map(t => (
            <div key={t.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 space-y-1" data-tema={t.tema}>
              <button onClick={() => onAbrir(t.id)} className="w-full">{minis[t.id] ? <img src={minis[t.id]} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" /> : <div className="w-full aspect-square rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>}</button>
              <div className="flex items-center gap-1 text-xs"><span className="flex-1 truncate font-medium">{t.tema}</span><button onClick={() => { if (confirm(`Excluir o tema “${t.tema}”? (as caixas vivas continuam)`)) onExcluir(t) }}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProjetoTema({ kit, tema, comps, compsDoTema, caixasDoTema, presets, cenasDela, motor, onVoltar, onMudou }: { kit: KitTemplate; tema: KitInstancia; comps: Composicao[]; compsDoTema: (t: KitInstancia) => Composicao[]; caixasDoTema: (t: KitInstancia) => Record<string, BoxInstancia | undefined>; presets: ExportPreset[]; cenasDela: Salvo[]; motor: MotorKit; onVoltar: () => void; onMudou: () => Promise<void> }) {
  const { workspaceId } = useBaseEstudio()
  const [caixas, setCaixas] = useState(() => caixasDoTema(tema))
  const [ki, setKi] = useState(tema)
  const [minis, setMinis] = useState<Record<string, string>>({})
  const [kits, setKits] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(''); const [aviso, setAviso] = useState('')
  const compsT = compsDoTema(ki)
  const novidades = versoesNovas(ki, kit, comps)
  // REATIVO: qualquer mudança numa caixa → só ela e os kits que a usam re-renderizam (o resto vem do cache)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const m: Record<string, string> = {}
      for (const s of kit.slots) { const i = caixas[s.id]; if (!i) continue; const c = await motor.caixa(i, 'previa').catch(() => null); if (c) m[s.id] = c.toDataURL('image/png') }
      const k: Record<string, string> = {}
      for (const c of compsT) { const cv = await motor.kit(c, ki.composicoes.find(x => x.composicaoId === c.id)?.ajustes, caixas, 'previa').catch(() => null); if (cv) k[c.id] = cv.toDataURL('image/png') }
      if (vivo) { setMinis(m); setKits(k) }
    })()
    return () => { vivo = false }
  }, [caixas, JSON.stringify(compsT)]) // eslint-disable-line react-hooks/exhaustive-deps
  async function trocar(slotId: string, f: File) {
    const c = caixas[slotId]; if (!c || !workspaceId) return
    setOcupado(`Trocando a arte de ${kit.slots.find(s => s.id === slotId)?.name}…`)
    try { const nova = await trocarArteDoSlot(c, f, workspaceId); setCaixas(x => ({ ...x, [slotId]: nova })); setAviso('Arte trocada — o kit e todas as composições que usam esta caixa já estão atualizados (as outras caixas vieram do cache).'); void onMudou() } finally { setOcupado('') }
  }
  async function atualizarVersao() {
    const snap = snapKit(kit, comps)
    await fetch(`/api/estudio/kit-instancias/${ki.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: { ...ki.config, snap }, composicoes: comps.map(c => ({ composicaoId: c.id, ajustes: ki.composicoes.find(x => x.composicaoId === c.id)?.ajustes })) }) })
    setKi(x => ({ ...x, config: { ...x.config, snap } })); setAviso('Tema atualizado para as versões novas do kit/composições.'); void onMudou()
  }
  const temaSaida: TemaSaida = { chave: ki.id, tema: ki.tema, projetoId: ki.id, caixas, comps: compsT, ajustes: Object.fromEntries(ki.composicoes.map(c => [c.composicaoId, c.ajustes || {}])) as Record<string, Record<string, Partial<PosicaoSlot>>> }
  return (
    <div className="space-y-3">
      <button onClick={onVoltar} className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Temas</button>
      {!!novidades.length && <p className="text-sm text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/30 rounded-lg px-3 py-2" data-versao-nova-kit>Há versão nova ({novidades.join(', ')}). Este tema segue na versão em que foi feito. <button onClick={atualizarVersao} className="underline font-semibold">Atualizar este tema</button></p>}
      {aviso && <p className="text-sm text-emerald-700" data-aviso-tema>{aviso}</p>}
      <div className={`${cartao} space-y-2`}>
        <p className="text-sm font-semibold">{ki.tema} <span className="font-normal text-xs text-gray-500">— cada caixa é uma caixa viva (edite em “Caixas vivas”: arte, apliques, faces)</span></p>
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-6" data-caixas-tema>
          {kit.slots.map(s => (
            <div key={s.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-1 space-y-1 text-[11px]" data-caixa-tema={s.name}>
              {minis[s.id] ? <img src={minis[s.id]} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded" data-mini-caixa={s.name} /> : <div className="w-full aspect-square rounded bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300">{caixas[s.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : '—'}</div>}
              <p className="truncate font-medium">{s.name}</p>
              {caixas[s.id] && <label className="cursor-pointer text-orange-600 hover:underline">trocar arte<input type="file" accept="image/*,.pdf,.svg" className="hidden" data-trocar-arte={s.name} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void trocar(s.id, f) }} /></label>}
            </div>
          ))}
        </div>
        {ocupado && <p className="text-xs text-gray-500"><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> {ocupado}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2" data-kits-tema>
        {compsT.map(c => <div key={c.id} className={`${cartao} space-y-1`}><p className="text-xs font-semibold">{c.nome} <span className="font-normal text-gray-400">v{c.versao}</span></p>{kits[c.id] ? <img src={kits[c.id]} alt="" className="w-full rounded-lg bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] [background-size:20px_20px]" data-kit-previa={c.nome} /> : <div className="aspect-video rounded-lg bg-gray-50 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>}</div>)}
      </div>
      <SaidasKit kit={kit} temas={[temaSaida]} comps={compsT} presets={presets} cenasDela={cenasDela} motor={motor} />
    </div>
  )
}

function PresetsExport({ presets, onMudou }: { presets: ExportPreset[]; onMudou: () => Promise<void> }) {
  const [ed, setEd] = useState<ExportPreset | null>(null)
  const [erro, setErro] = useState('')
  async function salvar() {
    if (!ed) return
    if (!ed.nome.trim() || !ed.tamanhos.length || ed.tamanhos.some(t => !(t.largura > 0 && t.altura > 0))) { setErro('Nome e pelo menos um tamanho válido.'); return }
    const corpo = { nome: ed.nome.trim(), tamanhos: ed.tamanhos, qualidade: ed.qualidade, formato: ed.formato, outputsIncluidos: ed.outputsIncluidos, cenaDefault: ed.cenaDefault }
    const novo = !ed.id || ed.fabrica
    const r = await fetch(novo ? '/api/estudio/export-presets' : `/api/estudio/export-presets/${ed.id}`, { method: novo ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    if (!r.ok) { setErro('Não consegui salvar.'); return }
    setEd(null); setErro(''); await onMudou()
  }
  const todos = [...PRESETS_EXPORT_PADRAO, ...presets]
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className={`${cartao} space-y-1.5`}>
        <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">Presets de exportação</p><button onClick={() => setEd({ id: '', nome: '', tamanhos: [{ rotulo: 'quadrada', largura: 1000, altura: 1000 }], qualidade: 92, formato: 'jpg', outputsIncluidos: ['kit', 'individual'], cenaDefault: 'liso-branco' })} className={btnP + ' !text-xs'} data-novo-preset-export><Plus className="w-3.5 h-3.5" /> Novo</button></div>
        {todos.map(p => <div key={p.id} className="flex items-center gap-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5" data-preset-export={p.nome}><span className="flex-1"><b>{p.nome}</b>{p.fabrica ? <span className="text-gray-400"> (SOA)</span> : null} · {p.tamanhos.map(t => `${t.largura}×${t.altura}`).join(', ')} · {p.formato.toUpperCase()} {p.qualidade}% · {p.outputsIncluidos.join('+')}</span><button onClick={() => setEd({ ...p, nome: p.fabrica ? `${p.nome} (meu)` : p.nome, tamanhos: p.tamanhos.map(t => ({ ...t })) })} className="text-orange-600 hover:underline">{p.fabrica ? 'copiar' : 'editar'}</button>{!p.fabrica && <button onClick={async () => { await fetch(`/api/estudio/export-presets/${p.id}`, { method: 'DELETE' }); onMudou() }}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>}</div>)}
      </div>
      {ed && (
        <div className={`${cartao} space-y-2 text-xs`} data-editor-preset>
          <input className={inp} value={ed.nome} onChange={e => setEd({ ...ed, nome: e.target.value })} placeholder="Nome (ex.: Shopee kit)" data-nome-preset />
          {ed.tamanhos.map((t, i) => <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] gap-1.5 items-center"><input className={inp + ' !text-xs'} value={t.rotulo} onChange={e => setEd({ ...ed, tamanhos: ed.tamanhos.map((x, k) => (k === i ? { ...x, rotulo: e.target.value } : x)) })} /><input className={inp + ' !text-xs'} inputMode="numeric" value={t.largura} onChange={e => setEd({ ...ed, tamanhos: ed.tamanhos.map((x, k) => (k === i ? { ...x, largura: Number(e.target.value) || 0 } : x)) })} /><input className={inp + ' !text-xs'} inputMode="numeric" value={t.altura} onChange={e => setEd({ ...ed, tamanhos: ed.tamanhos.map((x, k) => (k === i ? { ...x, altura: Number(e.target.value) || 0 } : x)) })} /><button onClick={() => setEd({ ...ed, tamanhos: ed.tamanhos.filter((_, k) => k !== i) })}><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button></div>)}
          <button onClick={() => setEd({ ...ed, tamanhos: [...ed.tamanhos, { rotulo: 'novo', largura: 1080, altura: 1080 }] })} className="text-orange-600">+ tamanho</button>
          <div className="grid grid-cols-3 gap-2">
            <label>Formato<select className={inp + ' !text-xs'} value={ed.formato} onChange={e => setEd({ ...ed, formato: e.target.value as 'jpg' | 'png' })}><option value="jpg">JPG</option><option value="png">PNG</option></select></label>
            <label>Qualidade {ed.qualidade}%<input type="range" min={60} max={100} value={ed.qualidade} onChange={e => setEd({ ...ed, qualidade: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
            <label>Cena padrão<select className={inp + ' !text-xs'} value={ed.cenaDefault || ''} onChange={e => setEd({ ...ed, cenaDefault: e.target.value || null })}><option value="branco">Fundo branco</option><option value="transparente">PNG transparente</option>{CENAS_PRONTAS.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          </div>
          <div className="flex gap-3">{(['kit', 'composicao', 'individual'] as const).map(o => <label key={o} className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={ed.outputsIncluidos.includes(o)} onChange={e => setEd({ ...ed, outputsIncluidos: e.target.checked ? [...ed.outputsIncluidos, o] : ed.outputsIncluidos.filter(x => x !== o) })} /> {o === 'kit' ? 'kit completo' : o === 'composicao' ? 'outras composições' : 'caixas individuais'}</label>)}</div>
          <div className="flex gap-2"><button onClick={salvar} className={btnP + ' !text-xs'} data-salvar-preset-export><Save className="w-3.5 h-3.5" /> Salvar preset</button><button onClick={() => setEd(null)} className={btn + ' !text-xs'}>Cancelar</button></div>
          {erro && <p className="text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  )
}
