'use client'
// SOA Design — CAIXAS VIVAS (Fase 3): FACA (BoxTemplate: regiões semânticas em polígono) e CAIXA COM ARTE
// (BoxInstance viva: arte planificada + faces + apliques + saídas por referência). Mudou algo na caixa → todas as
// saídas que a usam atualizam na hora (nada é reexportado/reimportado).
'use no memo'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Plus, Trash2, Save, Upload, Wand2, Box, Layers, Loader2, ChevronUp, ChevronDown, Copy, Eye, EyeOff, Download } from 'lucide-react'
import { snapCaixa, type SnapCaixa } from '@/lib/estudio/kitMotor'
import { prepararSalvo } from '@/lib/estudio/mockupCliente'
import { TIPOS_FACE, nomeFace, facesDoTemplate, renderInstancia, vincularFaces, extrairFace, quadroDoAplique, type BoxTemplate, type BoxInstancia, type RegiaoFaca, type TipoFace, type ApliqueNaCaixa, type SaidaCaixa, type ApliquePronto } from '@/lib/estudio/caixaViva'
import { paineisDaFaca, facesDaFaca, montarMockup } from '@/lib/estudio/mockupMolde'
import { rasterizarMolde } from '@/lib/estudio/mascaraMolde'
import { chamarIA, CUSTO_IA } from '@/lib/estudio/iaCliente'
import { contornoDaArea, uvParaFoto, REALISMO_PADRAO, TRANSFORM_PADRAO, type Pt } from '@/lib/estudio/mockupFoto'
import { gerarAplique } from '@/lib/estudio/aplique'
import { renderSaida } from '@/lib/estudio/saidaMockup'
import { CENAS_PRONTAS, cenaPronta } from '@/lib/estudio/cenasProntas'
import { TAMANHOS_CANAIS } from '@/lib/estudio/tamanhos'
import { carregarMolde, enviarArquivo, exigirSaldo, Autorizador, SemCota } from '@/lib/estudio/cliente'
import { blobDe, carregarImagem, nomeArquivo, novoCanvas } from '@/lib/estudio/mockup'
import { criarJob } from '@/lib/estudio/filaMockups'
import { hashTexto } from '@/lib/estudio/matcher'
import type { MockupPronto } from '@/lib/estudio/mockupCliente'
import AlcasArte from './AlcasArte'
import { listarApliques, type ApliqueSalvo } from './EditorAplique'
import { useBaseEstudio, inp, lbl, btn, btnP, cartao } from '../caixas/comum'

const idx = () => Math.random().toString(36).slice(2, 10)
const json = <T,>(v: unknown, d: T): T => { if (v == null) return d; if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return d } } return v as T }
const reduzir = (src: HTMLCanvasElement, lado: number) => { const k = Math.min(1, lado / Math.max(src.width, src.height)), c = novoCanvas(src.width * k, src.height * k); c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c }
async function abrirComoCanvas(f: File, lado = 2400): Promise<HTMLCanvasElement> {
  if (/\.(dxf|svg)$/i.test(f.name)) return reduzir((await rasterizarMolde(f)).cv, lado)
  const m = await carregarMolde(f), c = novoCanvas(m.largura, m.altura); c.getContext('2d')!.drawImage(m.fonte as CanvasImageSource, 0, 0); return reduzir(c, lado)
}
async function canvasDaUrl(u: string, lado = 2400) { const im = await carregarImagem(u), c = novoCanvas(im.naturalWidth, im.naturalHeight); c.getContext('2d')!.drawImage(im, 0, 0); return reduzir(c, lado) }
const dentro = (p: Pt, pol: Pt[]) => { let d = false; for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) { const a = pol[i], b = pol[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) d = !d } return d }

export const tplDaLinha = (l: Record<string, unknown>): BoxTemplate => ({ id: String(l.id), nome: String(l.nome), versao: Number(l.versao) || 1, modelo: (l.modelo as string) || null, facaUrl: (l.facaUrl as string) || null, largura: Number(l.largura) || 0, altura: Number(l.altura) || 0, regioes: json(l.regioes, []), config: json(l.config, {}) })
export const instDaLinha = (l: Record<string, unknown>): BoxInstancia => ({ id: String(l.id), nome: String(l.nome), boxTemplateId: String(l.boxTemplateId), mockupId: (l.mockupId as string) || null, artworkUrl: (l.artworkUrl as string) || null, faces: json(l.faces, {}), apliques: json(l.apliques, []), saidas: json(l.saidas, []), config: json(l.config, {}) })

export default function CaixasVivas({ mockups, onMockupsMudaram }: { mockups: MockupPronto[]; onMockupsMudaram: () => void }) {
  const [tpls, setTpls] = useState<BoxTemplate[] | null>(null)
  const [insts, setInsts] = useState<BoxInstancia[]>([])
  const [apliques, setApliques] = useState<ApliqueSalvo[]>([])
  const [tela, setTela] = useState<{ t: 'lista' } | { t: 'faca'; tpl: BoxTemplate | null } | { t: 'caixa'; inst: BoxInstancia | null; tplId?: string }>({ t: 'lista' })
  const carregar = async () => {
    const [a, b] = await Promise.all([fetch('/api/estudio/box-templates').then(r => r.json()).catch(() => ({})), fetch('/api/estudio/box-instancias').then(r => r.json()).catch(() => ({}))])
    setTpls((a.itens || []).map(tplDaLinha)); setInsts((b.itens || []).map(instDaLinha)); setApliques(await listarApliques())
  }
  useEffect(() => { Promise.resolve().then(carregar) }, [])
  const smart = mockups.filter(m => m.smart)

  if (tela.t === 'faca') return <EditorFaca tpl={tela.tpl} onVoltar={() => setTela({ t: 'lista' })} onSalvo={async t => { await carregar(); setTela({ t: 'faca', tpl: t }) }} onMockup={onMockupsMudaram} />
  if (tela.t === 'caixa') return <EditorCaixa inst={tela.inst} tplId={tela.tplId} tpls={tpls || []} mockups={smart} apliques={apliques} onVoltar={() => setTela({ t: 'lista' })} onSalvo={async i => { await carregar(); setTela({ t: 'caixa', inst: i }) }} />
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className={`${cartao} space-y-2`}>
        <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">Facas <span className="font-normal text-xs text-gray-500">— a planificação com as regiões (frente, laterais, alça…) definidas uma vez</span></p>
          <button onClick={() => setTela({ t: 'faca', tpl: null })} className={btnP + ' !text-xs'} data-nova-faca><Plus className="w-3.5 h-3.5" /> Nova faca</button></div>
        {tpls === null ? <p className="text-xs text-gray-400"><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> carregando…</p> : !tpls.length ? <p className="text-xs text-gray-400">Nenhuma faca ainda.</p> : tpls.map(t => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs" data-faca={t.nome}>
            <Box className="w-4 h-4 text-orange-500" /><span className="flex-1 truncate"><b>{t.nome}</b>{t.modelo ? ` · ${t.modelo}` : ''} · {t.regioes.filter(r => r.enabled).length} regiões{t.config.mockupId ? ' · mockup 3D ✓' : ''}</span>
            <button onClick={() => setTela({ t: 'caixa', inst: null, tplId: t.id })} className="text-orange-600 hover:underline">+ caixa com arte</button>
            <button onClick={() => setTela({ t: 'faca', tpl: t })} className="text-gray-500 hover:text-orange-600">editar</button>
            <button onClick={async () => { if (confirm(`Excluir a faca “${t.nome}”?`)) { await fetch(`/api/estudio/box-templates/${t.id}`, { method: 'DELETE' }); carregar() } }}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
          </div>
        ))}
      </div>
      <div className={`${cartao} space-y-2`}>
        <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">Caixas vivas <span className="font-normal text-xs text-gray-500">— arte + apliques numa faca; as saídas se atualizam sozinhas</span></p>
          <button onClick={() => setTela({ t: 'caixa', inst: null })} disabled={!tpls?.length} className={btn + ' !text-xs'} data-nova-caixa><Plus className="w-3.5 h-3.5" /> Nova caixa</button></div>
        {!insts.length ? <p className="text-xs text-gray-400">Nenhuma caixa viva ainda — crie uma faca e depois “+ caixa com arte”.</p> : insts.map(i => (
          <div key={i.id} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs" data-caixa-viva={i.nome}>
            <Layers className="w-4 h-4 text-orange-500" /><span className="flex-1 truncate"><b>{i.nome}</b> · {tpls?.find(t => t.id === i.boxTemplateId)?.nome || 'faca?'} · {i.apliques.length} aplique(s) · {i.saidas.length} saída(s)</span>
            <button onClick={() => setTela({ t: 'caixa', inst: i })} className="text-orange-600 hover:underline">abrir</button>
            <button onClick={async () => { if (confirm(`Excluir “${i.nome}”?`)) { await fetch(`/api/estudio/box-instancias/${i.id}`, { method: 'DELETE' }); carregar() } }}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── EDITOR DE FACA ─────────────────────────────────────────────────────────────────────────────────────────────
function EditorFaca({ tpl, onVoltar, onSalvo, onMockup }: { tpl: BoxTemplate | null; onVoltar: () => void; onSalvo: (t: BoxTemplate) => void; onMockup: () => void }) {
  const { workspaceId, storage } = useBaseEstudio()
  const [faca, setFaca] = useState<HTMLCanvasElement | null>(null)
  const [facaUrl, setFacaUrl] = useState<string | null>(tpl?.facaUrl || null)
  const [nome, setNome] = useState(tpl?.nome || ''); const [modelo, setModelo] = useState(tpl?.modelo || '')
  const [regioes, setRegioes] = useState<RegiaoFaca[]>(tpl?.regioes || [])
  const [medidas, setMedidas] = useState(tpl?.config.medidas ? { l: String(tpl.config.medidas.l), p: String(tpl.config.medidas.p), a: String(tpl.config.medidas.a) } : { l: '', p: '', a: '' })
  const [mockupId, setMockupId] = useState<string | null>(tpl?.config.mockupId || null)
  const [sel, setSel] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [rasc, setRasc] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [id, setId] = useState<string | null>(tpl?.id || null)
  const palco = useRef<HTMLDivElement>(null)
  const acao = useRef<{ t: 'ponto'; rid: string; i: number } | { t: 'criar'; x0: number; y0: number } | null>(null)
  useEffect(() => { if (tpl?.facaUrl) canvasDaUrl(tpl.facaUrl).then(setFaca).catch(e => setErro((e as Error).message)) }, [tpl?.facaUrl])
  const rSel = regioes.find(r => r.id === sel) || null
  const mudar = (rid: string, p: Partial<RegiaoFaca>) => setRegioes(x => x.map(r => (r.id === rid ? { ...r, ...p } : r)))
  const fr = (e: { clientX: number; clientY: number }): Pt => { const b = palco.current!.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)) } }

  async function abrir(f: File) {
    setOcupado('Lendo a faca…'); setErro('')
    try { const c = await abrirComoCanvas(f); setFaca(c); setFacaUrl(null); if (!nome) setNome(f.name.replace(/\.[^.]+$/, '')); setAviso('Faca aberta. “Detectar painéis” acha as regiões sozinho — ou desenhe com “Nova região”.') } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  function detectar() {
    if (!faca) return
    const R0 = Math.max(2, Math.round(Math.max(faca.width, faca.height) / 220))
    let melhor: ReturnType<typeof facesDaFaca> | null = null
    for (const k of [1, 1.8, 3]) { try { const r = facesDaFaca(paineisDaFaca(faca, Math.round(R0 * k)), faca.width / faca.height); if (!melhor || r.faces.length > melhor.faces.length) melhor = r; if (r.faces.some(x => x.role.startsWith('lateral'))) break } catch { /* tenta de novo */ } }
    if (!melhor) { setErro('Não achei painéis fechados — desenhe as regiões à mão.'); return }
    const tipo: Record<string, TipoFace> = { frente: 'frente', tras: 'verso', lateral_esquerda: 'lateral_esquerda', lateral_direita: 'lateral_direita', cima: 'tampa', fundo: 'fundo' }
    setRegioes(melhor.faces.map(f => ({ id: idx(), name: nomeFace(tipo[f.role]), faceType: tipo[f.role], polygonPoints: [{ x: f.x, y: f.y }, { x: f.x + f.w, y: f.y }, { x: f.x + f.w, y: f.y + f.h }, { x: f.x, y: f.y + f.h }], rotation: 0, renderable: true, enabled: true })))
    const k = 30 / Math.max(melhor.dims.l, melhor.dims.a)   // sugere medidas proporcionais (cm) — ela corrige
    if (!medidas.l) setMedidas({ l: (melhor.dims.l * k).toFixed(1), p: (melhor.dims.p * k).toFixed(1), a: (melhor.dims.a * k).toFixed(1) })
    setAviso(`${melhor.faces.length} regiões detectadas (${melhor.faces.map(f => nomeFace(tipo[f.role])).join(', ')}). Confira os nomes/tipos e ajuste os pontos. ${melhor.avisos.join(' ')}`)
  }
  function baixo(e: React.PointerEvent) {
    if (e.button !== 0 || !faca) return
    const p = fr(e)
    if (criando) { acao.current = { t: 'criar', x0: p.x, y0: p.y }; setRasc({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); return }
    const r = [...regioes].reverse().find(x => dentro(p, x.polygonPoints))
    setSel(r?.id || null)
  }
  function mover(e: React.PointerEvent) {
    const a = acao.current; if (!a) return
    const p = fr(e)
    if (a.t === 'criar') setRasc({ x0: a.x0, y0: a.y0, x1: p.x, y1: p.y })
    else mudar(a.rid, { polygonPoints: regioes.find(r => r.id === a.rid)!.polygonPoints.map((q, i) => (i === a.i ? p : q)) })
  }
  function soltar() {
    const a = acao.current; acao.current = null
    if (a?.t === 'criar' && rasc) {
      setRasc(null); setCriando(false)
      const x0 = Math.min(rasc.x0, rasc.x1), x1 = Math.max(rasc.x0, rasc.x1), y0 = Math.min(rasc.y0, rasc.y1), y1 = Math.max(rasc.y0, rasc.y1)
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return
      const r: RegiaoFaca = { id: idx(), name: 'Frente', faceType: 'frente', polygonPoints: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], rotation: 0, renderable: true, enabled: true }
      setRegioes(x => [...x, r]); setSel(r.id)
    }
  }
  /** IA como ASSISTENTE: propõe as regiões (e o tipo de caixa); ela confirma/corrige → template determinístico. */
  async function sugerirIA() {
    if (!faca || !confirm(`A IA vai propor as regiões desta faca — você confirma cada uma. ${CUSTO_IA}`)) return
    setOcupado('A IA está lendo a faca…'); setErro('')
    try {
      const r = await chamarIA('regioes-faca', { imagem: faca })
      if (!r.ok) { setErro(`${r.mensagem} Use “Detectar painéis” ou desenhe à mão.`); return }
      const tipos = TIPOS_FACE.map(t => t.id) as string[]
      const novas: RegiaoFaca[] = (r.regioes || []).map(x => { const t = (tipos.includes(x.faceType) ? x.faceType : 'outro') as TipoFace; return { id: idx(), name: nomeFace(t), faceType: t, polygonPoints: x.pontos.map(([px, py]) => ({ x: px, y: py })), rotation: 0, renderable: t !== 'aba', enabled: true, origem: 'ia_sugerido', confianca: x.confianca } })
      if (!novas.length) { setErro('A IA não reconheceu os painéis — use “Detectar painéis”.'); return }
      setRegioes(novas); if (!modelo && r.tipoCaixa) setModelo(r.tipoCaixa)
      setAviso(`Detectamos: ${novas.map(n => n.name).join(', ')}${r.tipoCaixa ? ` (${r.tipoCaixa})` : ''} — confirme ou ajuste cada uma.`)
    } finally { setOcupado('') }
  }
  const confirmarTodas = () => setRegioes(x => x.map(r => (r.origem === 'ia_sugerido' ? { ...r, origem: 'confirmado' } : r)))
  const sugeridas = regioes.filter(r => r.origem === 'ia_sugerido').length
  const inserir = (rid: string, i: number) => mudar(rid, { polygonPoints: (() => { const p = regioes.find(r => r.id === rid)!.polygonPoints, a = p[i], b = p[(i + 1) % p.length], n = [...p]; n.splice(i + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); return n })() })

  const numero = (s: string) => Number(String(s).replace(',', '.'))
  const dims = () => { const l = numero(medidas.l), p = numero(medidas.p), a = numero(medidas.a); return l > 0 && a > 0 ? { l, p: p > 0 ? p : Math.min(l, a) * 0.05, a } : null }
  async function salvar(extra: Partial<BoxTemplate['config']> = {}): Promise<BoxTemplate | null> {
    if (!faca) { setErro('Suba a faca primeiro.'); return null }
    if (!nome.trim()) { setErro('Dê um nome à faca (ex.: Caixa Milk).'); return null }
    if (!regioes.length) { setErro('Marque pelo menos uma região.'); return null }
    if (sugeridas && !confirm(`${sugeridas} região(ões) foram sugeridas pela IA. Salvar = confirmá-las (viram template fixo, sem IA).`)) return null
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível.'); return null }
    setOcupado('Salvando a faca…'); setErro('')
    try {
      let url = facaUrl
      if (!url) url = (await enviarArquivo(await blobDe(faca, 'image/png'), `${nomeArquivo(nome)}-faca.png`, 'molde', workspaceId, { pasta: 'Facas' })).url
      const config = { medidas: dims() || undefined, mockupId: extra.mockupId ?? mockupId }
      const regioesOk = regioes.map(r => (r.origem === 'ia_sugerido' ? { ...r, origem: 'confirmado' as const } : r)); setRegioes(regioesOk)
      const versao = id ? (tpl?.versao || 1) + (JSON.stringify(regioes) !== JSON.stringify(tpl?.regioes || []) ? 1 : 0) : 1
      const corpo = { nome: nome.trim(), modelo: modelo.trim() || null, facaUrl: url, largura: faca.width, altura: faca.height, regioes: regioesOk, config, versao }
      const r = await fetch(id ? `/api/estudio/box-templates/${id}` : '/api/estudio/box-templates', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      const novoId = id || j.id
      setId(novoId); setFacaUrl(url)
      const t: BoxTemplate = { id: novoId, ...corpo, config }
      setAviso(`Faca “${corpo.nome}” salva com ${regioes.length} regiões — reutilizável em qualquer arte.`)
      return t
    } catch (e) { setErro((e as Error).message); return null } finally { setOcupado('') }
  }
  async function gerarMockup3D() {
    const d = dims()
    if (!d) { setErro('Informe as medidas da caixa montada (largura, profundidade e altura em cm).'); return }
    const faces = facesDoTemplate({ regioes })
    if (!faces.length) { setErro('Nenhuma região de frente/lateral/verso/tampa marcada.'); return }
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível.'); return }
    setOcupado('Montando a caixa 3D…')
    try {
      const { base, areas } = montarMockup(faces, d)
      const up = await enviarArquivo(await blobDe(base, 'image/png'), `${nomeArquivo(nome || 'caixa')}-mockup.png`, 'mockup', workspaceId, { pasta: 'Mockups' })
      const mini = reduzir(base, 320)
      const r = await fetch('/api/estudio/mockups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: `${nome || 'Caixa'} (3D)`, tipo: 'foto', fotoUrl: up.url, fotoAssetId: up.id, areaAplicacao: { versao: 2, areas }, config: { realismo: REALISMO_PADRAO, origem: 'faca', faca: true }, previewUrl: mini.toDataURL('image/png') }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui criar o mockup.')
      setMockupId(j.id); await salvar({ mockupId: j.id }); onMockup()
      setAviso(`Mockup 3D criado com as faces ${areas.map(a => `“${a.nome}”`).join(', ')} — já ligado a esta faca.`)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  return (
    <div className="space-y-3">
      <button onClick={onVoltar} className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Facas e caixas</button>
      <div className={`${cartao} space-y-2`}>
        <p className="text-sm"><b>Editor de faca</b> — suba a planificação (imagem, PDF, SVG ou DXF) e marque cada região: frente, laterais, alça… em polígono. Abas de colagem ficam “não aparece no mockup”. Coordenadas normalizadas: vale em qualquer resolução.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={btnP + ' cursor-pointer'}><Upload className="w-4 h-4" /> {faca ? 'Trocar a faca' : 'Subir a faca'}<input type="file" accept="image/*,.pdf,.svg,.dxf" className="hidden" data-subir-faca onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void abrir(f) }} /></label>
          {faca && <button onClick={detectar} className={btn} data-detectar><Wand2 className="w-4 h-4 text-violet-600" /> Detectar painéis</button>}
          {faca && <button onClick={sugerirIA} disabled={!!ocupado} className={btn} data-sugerir-faca-ia title="A IA só sugere — você confirma"><Wand2 className="w-4 h-4 text-fuchsia-600" /> Sugerir com IA</button>}
          {!!sugeridas && <button onClick={confirmarTodas} className={btn + ' !border-emerald-400 text-emerald-700'} data-confirmar-ia>Confirmar as {sugeridas} sugestões</button>}
          {faca && <button onClick={() => setCriando(true)} className={`${btn} ${criando ? '!border-orange-500 text-orange-700' : ''}`}><Plus className="w-4 h-4" /> Nova região</button>}
        </div>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {aviso && <p className="text-sm text-emerald-700 dark:text-emerald-300" data-aviso-faca>{aviso}</p>}
      {faca && (
        <div className="grid lg:grid-cols-[1fr_330px] gap-4">
          <div className={cartao}>
            <div ref={palco} className="relative select-none bg-white rounded-lg" style={{ touchAction: 'none', cursor: criando ? 'crosshair' : 'default' }} onPointerDown={baixo} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar} data-palco-faca>
              <img src={faca.toDataURL('image/png')} alt="" className="w-full h-auto pointer-events-none" />
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                {regioes.map(r => <polygon key={r.id} points={r.polygonPoints.map(p => `${p.x},${p.y}`).join(' ')} fill={!r.renderable ? 'rgba(148,163,184,0.18)' : r.id === sel ? 'rgba(249,115,22,0.18)' : 'rgba(14,165,233,0.12)'} stroke={r.id === sel ? '#f97316' : r.renderable ? '#0ea5e9' : '#94a3b8'} strokeWidth={r.id === sel ? 2 : 1.2} strokeDasharray={r.enabled ? undefined : '4 3'} vectorEffect="non-scaling-stroke" />)}
                {rasc && <rect x={Math.min(rasc.x0, rasc.x1)} y={Math.min(rasc.y0, rasc.y1)} width={Math.abs(rasc.x1 - rasc.x0)} height={Math.abs(rasc.y1 - rasc.y0)} fill="rgba(249,115,22,0.12)" stroke="#f97316" vectorEffect="non-scaling-stroke" />}
              </svg>
              {regioes.map(r => { const xs = r.polygonPoints.map(p => p.x), ys = r.polygonPoints.map(p => p.y); return <span key={r.id} className={`absolute -translate-x-1/2 -translate-y-1/2 text-[10px] px-1 rounded pointer-events-none ${r.id === sel ? 'bg-orange-500 text-white' : 'bg-white/85 text-gray-700'}`} style={{ left: `${((Math.min(...xs) + Math.max(...xs)) / 2) * 100}%`, top: `${((Math.min(...ys) + Math.max(...ys)) / 2) * 100}%` }}>{r.name}{r.rotation ? ` ↻${r.rotation}°` : ''}</span> })}
              {rSel && rSel.polygonPoints.map((p, i) => <span key={i} data-vertice={i} className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-orange-500 cursor-grab" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                onPointerDown={e => { if (e.button !== 0) return; e.stopPropagation(); acao.current = { t: 'ponto', rid: rSel.id, i } }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); if (rSel.polygonPoints.length > 3) mudar(rSel.id, { polygonPoints: rSel.polygonPoints.filter((_, k) => k !== i) }) }} />)}
              {rSel && rSel.polygonPoints.map((p, i) => { const q = rSel.polygonPoints[(i + 1) % rSel.polygonPoints.length]; return <button key={`m${i}`} title="Adicionar ponto" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); inserir(rSel.id, i) }} className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/80 text-white text-[11px] leading-4" style={{ left: `${((p.x + q.x) / 2) * 100}%`, top: `${((p.y + q.y) / 2) * 100}%` }}>+</button> })}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{criando ? 'Arraste para desenhar a região.' : 'Clique numa região para editar; arraste os pontos, “+” adiciona ponto, botão direito num ponto remove.'}</p>
          </div>
          <div className="space-y-3">
            <div className={`${cartao} space-y-1.5`} data-regioes>
              <p className="text-xs font-semibold">Regiões ({regioes.length})</p>
              {regioes.map(r => (
                <div key={r.id} className={`rounded-lg border px-2 py-1.5 text-xs space-y-1 ${r.id === sel ? 'border-orange-400' : 'border-gray-200 dark:border-gray-700'}`} onClick={() => setSel(r.id)} data-regiao={r.name}>
                  <div className="flex items-center gap-1.5">
                    <input className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value={r.name} onChange={e => mudar(r.id, { name: e.target.value, origem: r.origem === 'ia_sugerido' ? 'confirmado' : r.origem })} />
                    {r.origem === 'ia_sugerido' && <button onClick={e => { e.stopPropagation(); mudar(r.id, { origem: 'confirmado' }) }} className="text-[10px] rounded bg-fuchsia-100 text-fuchsia-800 px-1" title="Sugerida pela IA — clique para confirmar" data-regiao-ia>IA {Math.round((r.confianca || 0) * 100)}% ✓</button>}
                    <select className="border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value={r.faceType} onChange={e => { const t = e.target.value as TipoFace; mudar(r.id, { faceType: t, renderable: t !== 'aba', ...(TIPOS_FACE.some(x => x.nome === r.name) ? { name: nomeFace(t) } : {}) }) }} data-tipo-face>{TIPOS_FACE.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
                    <button onClick={e => { e.stopPropagation(); setRegioes(x => x.filter(y => y.id !== r.id)) }}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    <label className="inline-flex items-center gap-1">em pé <select className="border border-gray-200 dark:border-gray-700 rounded px-0.5 bg-white dark:bg-gray-800" value={r.rotation} onChange={e => mudar(r.id, { rotation: Number(e.target.value) as RegiaoFaca['rotation'] })}>{[0, 90, 180, 270].map(g => <option key={g} value={g}>{g}°</option>)}</select></label>
                    <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={r.renderable} onChange={e => mudar(r.id, { renderable: e.target.checked })} /> aparece</label>
                    <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={r.enabled} onChange={e => mudar(r.id, { enabled: e.target.checked })} /> ativa</label>
                  </div>
                </div>
              ))}
            </div>
            <div className={`${cartao} space-y-2`}>
              <div className="grid grid-cols-2 gap-2">
                <label className={lbl}>Nome<input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Caixa Milk" /></label>
                <label className={lbl}>Modelo<input className={inp} value={modelo} onChange={e => setModelo(e.target.value)} placeholder="milk, cubo…" /></label>
              </div>
              <p className="text-[11px] text-gray-500">Caixa montada (cm) — para o mockup 3D:</p>
              <div className="grid grid-cols-3 gap-1.5">{(['l', 'p', 'a'] as const).map(k => <label key={k} className="text-[10px] text-gray-500">{k === 'l' ? 'Largura' : k === 'p' ? 'Profund.' : 'Altura'}<input className={inp + ' !text-xs'} inputMode="decimal" value={medidas[k]} onChange={e => setMedidas(m => ({ ...m, [k]: e.target.value }))} data-medida={k} /></label>)}</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => salvar().then(t => t && onSalvo(t))} disabled={!!ocupado} className={btnP + ' justify-center'} data-salvar-faca><Save className="w-4 h-4" /> Salvar faca</button>
                <button onClick={gerarMockup3D} disabled={!!ocupado} className={btn + ' justify-center'} data-mockup-3d><Box className="w-4 h-4" /> {mockupId ? 'Refazer mockup 3D' : 'Gerar mockup 3D'}</button>
              </div>
              {ocupado && <p className="text-xs text-gray-500"><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> {ocupado}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── EDITOR DA CAIXA VIVA (BoxInstance) ───────────────────────────────────────────────────────────────────────
function EditorCaixa({ inst, tplId, tpls, mockups, apliques, onVoltar, onSalvo }: { inst: BoxInstancia | null; tplId?: string; tpls: BoxTemplate[]; mockups: MockupPronto[]; apliques: ApliqueSalvo[]; onVoltar: () => void; onSalvo: (i: BoxInstancia) => void }) {
  const { workspaceId, storage } = useBaseEstudio()
  const tpl0 = tpls.find(t => t.id === (inst?.boxTemplateId || tplId)) || tpls[0]
  const [c, setC] = useState<BoxInstancia>(() => inst || { id: '', nome: '', boxTemplateId: tpl0?.id || '', mockupId: tpl0?.config.mockupId || mockups[0]?.id || null, artworkUrl: null, faces: {}, apliques: [], saidas: [{ id: idx(), nome: 'Foto principal', cenaId: 'nenhuma', canal: 'original', formato: 'jpg' }, { id: idx(), nome: 'Com cena (festa)', cenaId: 'fx-festa-rosa', canal: 'shopee', formato: 'jpg' }], config: {} })
  const [plan, setPlan] = useState<HTMLCanvasElement | null>(null)
  const [planArq, setPlanArq] = useState<File | null>(null)
  const [prontos, setProntos] = useState<Map<string, ApliquePronto>>(new Map())
  const [selAp, setSelAp] = useState<string | null>(null)
  const [selFace, setSelFace] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [miniSaidas, setMiniSaidas] = useState<Record<string, string>>({})
  const [versao, setVersao] = useState(0)
  const palco = useRef<HTMLDivElement>(null), previa = useRef<HTMLCanvasElement>(null)
  const faceCache = useRef(new Map<string, HTMLCanvasElement>())
  const tplVivo = tpls.find(t => t.id === c.boxTemplateId) || null
  const mkVivo = mockups.find(m => m.id === c.mockupId) || null
  // VERSÃO: a caixa renderiza com a faca/mockup NA VERSÃO em que foi feita (snapshot); atualizar é opt-in
  const snap = (c.config as { snap?: SnapCaixa }).snap
  const tpl = tplVivo && snap?.tpl && tplVivo.id === c.boxTemplateId ? { ...tplVivo, regioes: snap.tpl.regioes, largura: snap.tpl.largura, altura: snap.tpl.altura } : tplVivo
  const [mkSnap, setMkSnap] = useState<MockupPronto | null>(null)
  useEffect(() => { let vivo = true; if (snap?.mockup && snap.mockup.id === c.mockupId) prepararSalvo(snap.mockup).then(m => { if (vivo) setMkSnap(m) }).catch(() => {}); else setMkSnap(null); return () => { vivo = false } }, [JSON.stringify(snap?.mockup || null), c.mockupId]) // eslint-disable-line react-hooks/exhaustive-deps
  const mk = mkSnap || mkVivo
  const novidades: string[] = []
  if (snap?.tpl && tplVivo && (tplVivo.versao || 1) > snap.tpl.versao) novidades.push(`faca v${snap.tpl.versao} → v${tplVivo.versao}`)
  if (snap?.mockup && mkVivo && (Number(mkVivo.linha?.versao) || 1) > (snap.mockup.versao || 1)) novidades.push(`mockup v${snap.mockup.versao || 1} → v${mkVivo.linha?.versao}`)
  const atualizarVersoes = () => { if (tplVivo) { faceCache.current.clear(); setC(x => ({ ...x, config: { ...x.config, snap: snapCaixa(tplVivo, mkVivo?.linha || null) } })); setAviso('Caixa atualizada para as versões novas — salve para manter.') } }
  const baseRef = useRef<{ foto: HTMLCanvasElement | null; prev: HTMLCanvasElement | null }>({ foto: null, prev: null })
  if (mk?.smart && baseRef.current.foto !== mk.smart.foto) baseRef.current = { foto: mk.smart.foto, prev: reduzir(mk.smart.foto, 1000) }

  useEffect(() => { if (inst?.artworkUrl) canvasDaUrl(inst.artworkUrl, 3000).then(p => { faceCache.current.clear(); setPlan(p) }).catch(() => {}) }, [inst?.artworkUrl])
  // apliques usados: gerados na resolução da prévia
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const m = new Map(prontos)
      for (const a of c.apliques) {
        if (m.has(a.apliqueId)) continue
        const s = apliques.find(x => x.id === a.apliqueId); if (!s?.pngUrl) continue
        const im = await carregarImagem(s.pngUrl).catch(() => null); if (!im) continue
        const r = await gerarAplique(im, s.config, { maxLado: 700 }).catch(() => null); if (r) m.set(a.apliqueId, { composto: r.composto })
      }
      if (vivo && m.size !== prontos.size) setProntos(m)
    })()
    return () => { vivo = false }
  }, [c.apliques.map(a => a.apliqueId).join(','), apliques]) // eslint-disable-line react-hooks/exhaustive-deps

  // RENDER REATIVO: qualquer mudança na caixa → prévia + TODAS as saídas que a referenciam
  useEffect(() => {
    const cv = previa.current
    if (!cv || !tpl || !mk?.smart || !baseRef.current.prev) return
    const t = setTimeout(() => {
      const out = renderInstancia({ inst: c, tpl, plan, mockup: mk.smart!, apliques: prontos, base: baseRef.current.prev!, faceCache: faceCache.current })
      cv.width = out.width; cv.height = out.height; const g = cv.getContext('2d')!; g.clearRect(0, 0, out.width, out.height); g.drawImage(out, 0, 0)
      const minis: Record<string, string> = {}
      for (const s of c.saidas) { const o = renderSaida(mk.smart!.cfg, out, s.cenaId === 'transparente' ? null : s.cenaId === 'nenhuma' ? 'nenhuma' : cenaPronta(s.cenaId)?.cena || 'nenhuma', s.canal); const k = 150 / Math.max(o.width, o.height), m = novoCanvas(o.width * k, o.height * k); m.getContext('2d')!.drawImage(o, 0, 0, m.width, m.height); minis[s.id] = m.toDataURL('image/jpeg', 0.8) }
      setMiniSaidas(minis); setVersao(v => v + 1)
    }, 60)
    return () => clearTimeout(t)
  }, [JSON.stringify(c), plan, prontos, tpl, mk]) // eslint-disable-line react-hooks/exhaustive-deps

  const areas = mk?.smart?.cfg.areas.filter(a => !a.oclusao && !a.oculta) || []
  const manual: Record<string, string | null> = {}
  for (const [rid, f] of Object.entries(c.faces)) if (f.area) manual[f.area] = rid
  const vinc = tpl ? vincularFaces(areas, tpl.regioes, manual) : {}
  const mudarAp = (id: string, p: Partial<ApliqueNaCaixa>) => setC(x => ({ ...x, apliques: x.apliques.map(a => (a.id === id ? { ...a, ...p } : a)) }))
  const apSel = c.apliques.find(a => a.id === selAp) || null
  const areaDoAp = (a: ApliqueNaCaixa) => areas.find(x => x.nome === a.anchorFace) || areas[0]

  // arrastar o aplique na prévia (no plano da face âncora) + rodinha = tamanho
  function baixo(e: React.PointerEvent) {
    if (e.button !== 0 || !mk?.smart || !baseRef.current.prev) return
    const b = palco.current!.getBoundingClientRect(), W = baseRef.current.prev.width, H = baseRef.current.prev.height
    const px = { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H }
    const hit = [...c.apliques].sort((x, y) => y.z - x.z).find(a => { const pr = prontos.get(a.apliqueId), ar = areaDoAp(a); return pr && ar && dentro(px, quadroDoAplique(ar.area, W, H, a, pr.composto.height / pr.composto.width)) })
    setSelAp(hit?.id || null)
    if (!hit) { const f = areas.find(a => dentro({ x: px.x / W, y: px.y / H }, contornoDaArea(a.area, 1, 1))); setSelFace(f?.id || null); return }
    setSelFace(null)
    const ar = areaDoAp(hit)!, o = uvParaFoto(ar.area, 0.5, 0.5), eu = uvParaFoto(ar.area, 1, 0.5), ev = uvParaFoto(ar.area, 0.5, 1)
    const ux = (eu.x - o.x) * 2 * b.width, uy = (eu.y - o.y) * 2 * b.height, vx = (ev.x - o.x) * 2 * b.width, vy = (ev.y - o.y) * 2 * b.height, det = ux * vy - uy * vx || 1
    const x0 = e.clientX, y0 = e.clientY, u0 = hit.u, v0 = hit.v
    const mov = (ev2: PointerEvent) => { const dx = ev2.clientX - x0, dy = ev2.clientY - y0; mudarAp(hit.id, { u: u0 + (dx * vy - dy * vx) / det, v: v0 + (ux * dy - uy * dx) / det }) }
    const sol = () => { window.removeEventListener('pointermove', mov); window.removeEventListener('pointerup', sol) }
    window.addEventListener('pointermove', mov); window.addEventListener('pointerup', sol)
  }
  useEffect(() => {
    const el = palco.current; if (!el) return
    const roda = (e: WheelEvent) => { if (!selAp) return; e.preventDefault(); setC(x => ({ ...x, apliques: x.apliques.map(a => (a.id === selAp ? { ...a, escala: Math.max(0.05, Math.min(3, a.escala * (e.deltaY < 0 ? 1.08 : 1 / 1.08))) } : a)) })) }
    el.addEventListener('wheel', roda, { passive: false }); return () => el.removeEventListener('wheel', roda)
  }, [selAp])

  async function subirArte(f: File) {
    setOcupado('Abrindo a arte planificada…')
    try {
      const p = await abrirComoCanvas(f, 3000); faceCache.current.clear(); setPlan(p); setPlanArq(f); setC(x => ({ ...x, artworkUrl: null, nome: x.nome || f.name.replace(/\.[^.]+$/, '') }))
      if (tpl?.largura && Math.abs(p.width / p.height - tpl.largura / tpl.altura) > 0.03) setAviso('Atenção: a proporção da arte é diferente da faca — confira se é a planificação deste modelo.')
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function salvar() {
    if (!c.nome.trim()) { setErro('Dê um nome (ex.: Milk Sereia).'); return }
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível.'); return }
    setOcupado('Salvando a caixa…'); setErro('')
    try {
      let url = c.artworkUrl
      if (!url && planArq) url = (await enviarArquivo(planArq, planArq.name, 'imagem', workspaceId, { pasta: 'Caixas vivas' })).url
      // caixa nova: guarda o snapshot das versões usadas (editar a faca/mockup depois não muda esta caixa)
      const config = (c.config as { snap?: SnapCaixa }).snap || !tplVivo ? c.config : { ...c.config, snap: snapCaixa(tplVivo, mkVivo?.linha || null) }
      const corpo = { nome: c.nome.trim(), boxTemplateId: c.boxTemplateId, mockupId: c.mockupId, artworkUrl: url, faces: c.faces, apliques: c.apliques, saidas: c.saidas, config }
      const r = await fetch(c.id ? `/api/estudio/box-instancias/${c.id}` : '/api/estudio/box-instancias', { method: c.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      const novo = { ...c, id: c.id || j.id, artworkUrl: url, config }
      setC(novo); setPlanArq(null); setAviso(`“${novo.nome}” salva — as ${novo.saidas.length} saídas usam esta caixa por referência.`); onSalvo(novo)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  async function exportar() {
    if (!tpl || !mk?.smart || !c.saidas.length) return
    try { await exigirSaldo(c.saidas.length) } catch (e) { setErro((e as Error).message); return }
    // alta resolução: apliques em 300 dpi limitado ao tamanho da foto
    const altas = new Map<string, ApliquePronto>()
    for (const a of c.apliques) { if (altas.has(a.apliqueId)) continue; const s = apliques.find(x => x.id === a.apliqueId); if (!s?.pngUrl) continue; const im = await carregarImagem(s.pngUrl); altas.set(a.apliqueId, { composto: (await gerarAplique(im, s.config, { maxLado: 1800 })).composto }) }
    const snap = structuredClone(c), smart = mk.smart, planSnap = plan
    const imgs = new Map<string, HTMLImageElement>()
    criarJob({
      nome: `${c.nome || 'Caixa'} · ${c.saidas.length} saída(s)`, nomeZip: `${nomeArquivo(c.nome || 'caixa')}.zip`,
      itens: c.saidas.map(s => ({ id: s.id, rotulo: s.nome, arquivo: `${nomeArquivo(c.nome || 'caixa')}_${nomeArquivo(s.nome)}.${s.cenaId === 'transparente' ? 'png' : s.formato}`, chave: hashTexto(JSON.stringify([snap, s, c.artworkUrl || planArq?.name, mk.id, 'caixa-v1'])) })),
      autorizar: n => { const a = new Autorizador(n); return { lote: a.lote, garantir: i => a.garantir(i) } },
      ehSemCota: e => e instanceof SemCota,
      render: async it => {
        const s = snap.saidas.find(x => x.id === it.id)!
        const out = renderInstancia({ inst: snap, tpl, plan: planSnap, mockup: smart, apliques: altas })
        const o = renderSaida(smart.cfg, out, s.cenaId === 'transparente' ? null : s.cenaId === 'nenhuma' ? 'nenhuma' : cenaPronta(s.cenaId)?.cena || 'nenhuma', s.canal, imgs)
        return blobDe(o, s.cenaId === 'transparente' || s.formato === 'png' ? 'image/png' : 'image/jpeg', 0.93)
      },
    })
    setAviso(`${c.saidas.length} saída(s) na fila (canto inferior esquerdo).`)
  }

  if (!tpl) return <div className={cartao}><button onClick={onVoltar} className="text-sm text-gray-500"><ArrowLeft className="inline w-4 h-4" /> voltar</button><p className="text-sm mt-2">Crie uma faca primeiro.</p></div>
  const faceSel = areas.find(a => a.id === selFace) || null
  const ridSel = faceSel ? vinc[faceSel.id] : null
  const arteFaceSel = ridSel && plan ? (faceCache.current.get(ridSel) || extrairFace(plan, tpl.regioes.find(r => r.id === ridSel)!)) : null
  return (
    <div className="space-y-3">
      <button onClick={onVoltar} className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Facas e caixas</button>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {aviso && <p className="text-sm text-emerald-700 dark:text-emerald-300" data-aviso-caixa>{aviso}</p>}
      {!!novidades.length && <p className="text-sm text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/30 rounded-lg px-3 py-2" data-versao-nova>Há versão nova ({novidades.join(', ')}). Esta caixa continua na versão em que foi feita. <button onClick={atualizarVersoes} className="underline font-semibold">Atualizar esta caixa</button></p>}
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className={`${cartao} space-y-2`}>
          <div className="flex flex-wrap items-center gap-2">
            <input className={inp + ' !w-56'} value={c.nome} onChange={e => setC(x => ({ ...x, nome: e.target.value }))} placeholder="Nome (ex.: Milk Sereia)" data-nome-caixa />
            <select className={inp + ' !w-auto'} value={c.boxTemplateId} onChange={e => { faceCache.current.clear(); const t = tpls.find(x => x.id === e.target.value); setC(x => ({ ...x, boxTemplateId: e.target.value, mockupId: t?.config.mockupId || x.mockupId })) }}>{tpls.map(t => <option key={t.id} value={t.id}>Faca: {t.nome}</option>)}</select>
            <select className={inp + ' !w-auto'} value={c.mockupId || ''} onChange={e => setC(x => ({ ...x, mockupId: e.target.value || null }))} data-mockup-caixa><option value="">escolha o mockup…</option>{mockups.map(m => <option key={m.id} value={m.id}>Mockup: {m.nome}</option>)}</select>
            <label className={btnP + ' cursor-pointer !text-xs'}><Upload className="w-3.5 h-3.5" /> {plan ? 'Trocar a arte' : 'Subir a arte planificada'}<input type="file" accept="image/*,.pdf,.svg" className="hidden" data-arte-planificada onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subirArte(f) }} /></label>
          </div>
          {!mk?.smart ? <p className="text-sm text-gray-500">Escolha um mockup (ou gere o “mockup 3D” na faca).</p> : (
            <div ref={palco} className="relative select-none" style={{ touchAction: 'none' }} onPointerDown={baixo} data-palco-caixa>
              <canvas ref={previa} className="w-full h-auto rounded-lg bg-gray-100 dark:bg-gray-800" data-previa-caixa data-versao={versao} />
              {faceSel && arteFaceSel && ridSel && <AlcasArte area={faceSel.area} W={mk.smart.foto.width} H={mk.smart.foto.height} arte={{ w: arteFaceSel.width, h: arteFaceSel.height }} ajuste="esticar" t={c.faces[ridSel]?.transform || TRANSFORM_PADRAO} palco={palco} onMudar={t => setC(x => ({ ...x, faces: { ...x.faces, [ridSel]: { ...x.faces[ridSel], transform: t } } }))} />}
            </div>
          )}
          <p className="text-[11px] text-gray-500">Clique num aplique para mover (arraste) e redimensionar (rodinha) — ele pode passar da borda da face. Clique numa face para ajustar a arte dela.</p>
        </div>
        <div className="space-y-3">
          <div className={`${cartao} space-y-1.5`} data-faces-caixa>
            <p className="text-xs font-semibold">Faces <span className="font-normal text-gray-400">(faca → mockup, pelo nome)</span></p>
            {areas.map(a => {
              const rid = vinc[a.id]
              return (
                <div key={a.id} className="flex items-center gap-1.5 text-xs" data-face-caixa={a.nome}>
                  <span className="w-28 truncate">{a.nome}</span>
                  <select className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value={rid || ''} onChange={e => { const v = e.target.value; setC(x => { const f = { ...x.faces }; for (const k of Object.keys(f)) if (f[k].area === a.id) f[k] = { ...f[k], area: null }; if (v) f[v] = { ...f[v], area: a.id }; return { ...x, faces: f } }) }}>
                    <option value="">(lisa)</option>{tpl.regioes.filter(r => r.enabled).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {rid && <button onClick={() => setC(x => ({ ...x, faces: { ...x.faces, [rid]: { ...x.faces[rid], oculta: !x.faces[rid]?.oculta } } }))} title="Mostrar/ocultar">{c.faces[rid]?.oculta ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}</button>}
                </div>
              )
            })}
          </div>
          <div className={`${cartao} space-y-1.5`} data-apliques-caixa>
            <div className="flex items-center gap-2"><p className="text-xs font-semibold flex-1">Apliques</p>
              <select className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value="" onChange={e => { const id = e.target.value; if (!id) return; const n: ApliqueNaCaixa = { id: idx(), apliqueId: id, anchorFace: areas[0]?.nome || null, u: 0.5, v: 0.45, escala: 0.55, rot: 0, z: Math.max(0, ...c.apliques.map(a => a.z)) + 1 }; setC(x => ({ ...x, apliques: [...x.apliques, n] })); setSelAp(n.id) }} data-add-aplique>
                <option value="">+ aplique da biblioteca…</option>{apliques.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select></div>
            {!apliques.length && <p className="text-[11px] text-gray-400">Crie apliques na aba “Apliques”.</p>}
            {c.apliques.map(a => (
              <div key={a.id} className={`rounded-lg border px-2 py-1 text-xs space-y-1 ${a.id === selAp ? 'border-orange-400' : 'border-gray-200 dark:border-gray-700'}`} onClick={() => setSelAp(a.id)} data-aplique-na-caixa={apliques.find(x => x.id === a.apliqueId)?.nome}>
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 truncate">{apliques.find(x => x.id === a.apliqueId)?.nome || 'aplique'} <span className="text-gray-400">z{a.z}</span></span>
                  <select className="border border-gray-200 dark:border-gray-700 rounded px-0.5 bg-white dark:bg-gray-800" value={a.anchorFace || ''} onChange={e => mudarAp(a.id, { anchorFace: e.target.value })} title="Face âncora">{areas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}</select>
                  <button onClick={e => { e.stopPropagation(); mudarAp(a.id, { z: a.z + 1 }) }} title="Para frente"><ChevronUp className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={e => { e.stopPropagation(); mudarAp(a.id, { z: a.z - 1 }) }} title="Para trás"><ChevronDown className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={e => { e.stopPropagation(); setC(x => ({ ...x, apliques: [...x.apliques, { ...a, id: idx(), u: a.u + 0.08, v: a.v + 0.05, z: a.z + 1 }] })) }} title="Duplicar"><Copy className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button onClick={e => { e.stopPropagation(); setC(x => ({ ...x, apliques: x.apliques.filter(y => y.id !== a.id) })) }} title="Excluir"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                </div>
                {a.id === selAp && <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                  <label>Tamanho {Math.round(a.escala * 100)}%<input type="range" min={5} max={250} value={Math.round(a.escala * 100)} onChange={e => mudarAp(a.id, { escala: Number(e.target.value) / 100 })} className="w-full accent-orange-500" data-escala-aplique /></label>
                  <label>Giro {a.rot}°<input type="range" min={-180} max={180} value={a.rot} onChange={e => mudarAp(a.id, { rot: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
                </div>}
              </div>
            ))}
          </div>
          <div className={`${cartao} space-y-1.5`} data-saidas-caixa>
            <div className="flex items-center gap-2"><p className="text-xs font-semibold flex-1">Saídas <span className="font-normal text-gray-400">— usam ESTA caixa (atualizam sozinhas)</span></p>
              <button onClick={() => setC(x => ({ ...x, saidas: [...x.saidas, { id: idx(), nome: `Saída ${x.saidas.length + 1}`, cenaId: 'fx-estudio-branco', canal: 'shopee', formato: 'jpg' }] }))} className="text-[11px] text-orange-600">+ saída</button></div>
            {c.saidas.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 text-[11px]" data-saida={s.nome}>
                {miniSaidas[s.id] ? <img src={miniSaidas[s.id]} alt="" className="w-12 h-12 object-contain rounded border bg-white" data-mini-saida={s.nome} /> : <div className="w-12 h-12 rounded border bg-gray-50" />}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded px-1 bg-white dark:bg-gray-800" value={s.nome} onChange={e => setC(x => ({ ...x, saidas: x.saidas.map(y => (y.id === s.id ? { ...y, nome: e.target.value } : y)) }))} />
                  <div className="flex gap-1">
                    <select className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800" value={s.cenaId} onChange={e => setC(x => ({ ...x, saidas: x.saidas.map(y => (y.id === s.id ? { ...y, cenaId: e.target.value } : y)) }))}><option value="nenhuma">sem cena</option><option value="transparente">PNG transparente</option>{CENAS_PRONTAS.map(cn => <option key={cn.id} value={cn.id}>{cn.nome}</option>)}</select>
                    <select className="w-20 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800" value={s.canal} onChange={e => setC(x => ({ ...x, saidas: x.saidas.map(y => (y.id === s.id ? { ...y, canal: e.target.value } : y)) }))}><option value="original">original</option>{TAMANHOS_CANAIS.map(t => <option key={t.id} value={t.id}>{t.canal} {t.rotulo}</option>)}</select>
                  </div>
                </div>
                <button onClick={() => setC(x => ({ ...x, saidas: x.saidas.filter(y => y.id !== s.id) }))}><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={salvar} disabled={!!ocupado} className={btnP + ' justify-center'} data-salvar-caixa><Save className="w-4 h-4" /> Salvar caixa</button>
            <button onClick={exportar} disabled={!!ocupado || !c.saidas.length} className={btn + ' justify-center'} data-exportar-caixa><Download className="w-4 h-4" /> Gerar as saídas</button>
          </div>
          {ocupado && <p className="text-xs text-gray-500"><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> {ocupado}</p>}
        </div>
      </div>
    </div>
  )
}
