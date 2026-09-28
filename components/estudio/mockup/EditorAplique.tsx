'use client'
// SOA Design — APLIQUES: ela sobe SÓ o PNG do personagem; o SOA gera as camadas de baixo (papel, laminado metálico,
// textura) expandidas em mm, alinhadas, com profundidade. Editor de camadas, presets ("Dourado 2 camadas"), exportar
// para imprimir (camadas separadas a 300 dpi + silhuetas em SVG = linha de corte) e LOTE (N PNGs + 1 preset → fila).
'use no memo'
import { useEffect, useRef, useState } from 'react'
import { Upload, Plus, Trash2, Copy, ChevronUp, ChevronDown, Eye, EyeOff, Save, Download, Layers, Loader2, Sparkles } from 'lucide-react'
import { gerarAplique, novaCamada, configDoPreset, svgDasSilhuetas, PRESETS_PADRAO, type ConfigAplique, type CamadaAplique, type ResultadoAplique, type TipoCamada } from '@/lib/estudio/aplique'
import { enviarArquivo, baixar, exigirSaldo, Autorizador, SemCota } from '@/lib/estudio/cliente'
import { blobDe, carregarImagem, nomeArquivo, novoCanvas } from '@/lib/estudio/mockup'
import { criarJob } from '@/lib/estudio/filaMockups'
import { hashArquivo, hashTexto } from '@/lib/estudio/matcher'
import { LIMITE_LOTE } from '@/lib/estudio/dados'
import { useBaseEstudio, inp, lbl, btn, btnP, cartao } from '../caixas/comum'

export interface ApliqueSalvo { id: string; nome: string; pngUrl: string | null; config: ConfigAplique; previewUrl?: string | null }
type Preset = { id: string; nome: string; cfg: ConfigAplique; fabrica?: boolean }
const json = <T,>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T
const TIPOS: { id: TipoCamada; nome: string }[] = [{ id: 'IMAGE', nome: 'Personagem (PNG)' }, { id: 'SOLID_COLOR', nome: 'Papel / cor lisa' }, { id: 'METALLIC', nome: 'Laminado metálico' }, { id: 'CUSTOM_TEXTURE', nome: 'Textura (imagem)' }]
const CFG_INICIAL = (): ConfigAplique => configDoPreset(PRESETS_PADRAO[0].cfg)

export async function listarApliques(): Promise<ApliqueSalvo[]> {
  const r = await fetch('/api/estudio/apliques').then(x => x.json()).catch(() => ({}))
  return (r.itens || []).map((l: Record<string, unknown>) => ({ id: String(l.id), nome: String(l.nome), pngUrl: (l.pngUrl as string) || null, config: json<ConfigAplique>(l.config), previewUrl: (l.previewUrl as string) || null }))
}
/** Abre as texturas usadas pelas camadas. */
async function texturasDe(cfg: ConfigAplique, cache: Map<string, HTMLImageElement>) {
  for (const c of cfg.camadas) if (c.tipo === 'CUSTOM_TEXTURE' && c.texturaUrl && !cache.has(c.texturaUrl)) { const im = await carregarImagem(c.texturaUrl).catch(() => null); if (im) cache.set(c.texturaUrl, im) }
  return cache as Map<string, CanvasImageSource>
}
const zipDoAplique = async (res: ResultadoAplique, nome: string) => [
  { nome: `${nome}_aplique_300dpi.png`, blob: await blobDe(res.composto, 'image/png') },
  ...(await Promise.all(res.camadas.map(async (c, i) => ({ nome: `camadas/${i + 1}_${nomeArquivo(c.nome)}.png`, blob: await blobDe(c.canvas, 'image/png') })))),
  { nome: `${nome}_silhuetas_corte.svg`, blob: new Blob([svgDasSilhuetas(res, nome)], { type: 'image/svg+xml' }) },
]

export default function EditorAplique() {
  const { workspaceId, storage } = useBaseEstudio()
  const [lista, setLista] = useState<ApliqueSalvo[] | null>(null)
  const [presets, setPresets] = useState<Preset[]>(PRESETS_PADRAO.map((p, i) => ({ id: `f${i}`, nome: p.nome, cfg: p.cfg, fabrica: true })))
  const [png, setPng] = useState<HTMLImageElement | null>(null)
  const [pngArq, setPngArq] = useState<File | null>(null)
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cfg, setCfg] = useState<ConfigAplique>(CFG_INICIAL)
  const [sel, setSel] = useState<string | null>(null)
  const [fundo, setFundo] = useState('#fdf2f8')
  const [res, setRes] = useState<ResultadoAplique | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [lote, setLote] = useState<File[]>([]); const [presetLote, setPresetLote] = useState('atual'); const [salvarLote, setSalvarLote] = useState(false)
  const texturas = useRef(new Map<string, HTMLImageElement>())
  const previa = useRef<HTMLCanvasElement>(null)

  const carregar = async () => {
    setLista(await listarApliques())
    const r = await fetch('/api/estudio/presets-aplique').then(x => x.json()).catch(() => ({}))
    setPresets([...PRESETS_PADRAO.map((p, i) => ({ id: `f${i}`, nome: p.nome, cfg: p.cfg, fabrica: true })), ...(r.itens || []).map((l: Record<string, unknown>) => ({ id: String(l.id), nome: String(l.nome), cfg: json<ConfigAplique>(l.config) }))])
  }
  useEffect(() => { Promise.resolve().then(carregar) }, [])
  // prévia ao vivo (resolução de tela; a exportação sai em 300 dpi)
  useEffect(() => {
    if (!png) return
    let vivo = true
    const t = setTimeout(async () => {
      setGerando(true)
      try { const r = await gerarAplique(png, cfg, { maxLado: 900, texturas: await texturasDe(cfg, texturas.current) }); if (vivo) { setRes(r); setErro('') } } catch (e) { if (vivo) setErro((e as Error).message) } finally { if (vivo) setGerando(false) }
    }, 120)
    return () => { vivo = false; clearTimeout(t) }
  }, [png, JSON.stringify(cfg)]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const cv = previa.current
    if (!cv || !res) return
    cv.width = res.composto.width; cv.height = res.composto.height
    const g = cv.getContext('2d')!; g.fillStyle = fundo; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(res.composto, 0, 0)
  }, [res, fundo])

  async function abrirPng(f: File) {
    const u = URL.createObjectURL(f), im = await carregarImagem(u)
    setPng(im); setPngArq(f); setPngUrl(null); setEditId(null); setNome(f.name.replace(/\.[^.]+$/, '')); setAviso('')
  }
  async function abrirSalvo(a: ApliqueSalvo) {
    if (!a.pngUrl) return
    setPng(await carregarImagem(a.pngUrl)); setPngArq(null); setPngUrl(a.pngUrl); setEditId(a.id); setNome(a.nome); setCfg(a.config); setSel(null)
  }
  const mudarCamada = (id: string, p: Partial<CamadaAplique>) => setCfg(c => ({ ...c, camadas: c.camadas.map(x => (x.id === id ? { ...x, ...p } : x)) }))
  const mover = (id: string, d: -1 | 1) => setCfg(c => { const a = [...c.camadas], i = a.findIndex(x => x.id === id), j = i + d; if (j < 0 || j >= a.length) return c; [a[i], a[j]] = [a[j], a[i]]; return { ...c, camadas: a } })
  const camadaSel = cfg.camadas.find(c => c.id === sel) || null

  async function salvar() {
    if (!png) return
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível.'); return }
    setGerando(true); setErro('')
    try {
      let url = pngUrl, assetId: string | null = null
      if (!url && pngArq) { const up = await enviarArquivo(pngArq, pngArq.name, 'imagem', workspaceId, { pasta: 'Apliques' }); url = up.url; assetId = up.id }
      const alta = await gerarAplique(png, cfg, { texturas: await texturasDe(cfg, texturas.current) })   // 300 dpi: silhuetas precisas
      const k = 240 / Math.max(alta.composto.width, alta.composto.height), mini = novoCanvas(alta.composto.width * k, alta.composto.height * k)
      const gm = mini.getContext('2d')!; gm.fillStyle = '#ffffff'; gm.fillRect(0, 0, mini.width, mini.height); gm.drawImage(alta.composto, 0, 0, mini.width, mini.height)
      const corpo = { nome: nome.trim() || 'Aplique', pngUrl: url, pngAssetId: assetId, config: cfg, silhuetas: alta.camadas.map(c => ({ id: c.id, nome: c.nome, raioMm: c.raioMm, contornos: c.silhueta })), previewUrl: mini.toDataURL('image/jpeg', 0.8) }
      const r = await fetch(editId ? `/api/estudio/apliques/${editId}` : '/api/estudio/apliques', { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      if (!editId && j.id) setEditId(j.id)
      setPngUrl(url); setAviso(`Aplique “${corpo.nome}” salvo na sua biblioteca (com a geometria das ${alta.camadas.length} silhuetas em mm). Já dá para colocá-lo numa caixa viva.`)
      await carregar()
    } catch (e) { setErro((e as Error).message) } finally { setGerando(false) }
  }
  async function exportar() {
    if (!png) return
    setErro('')
    try {
      await exigirSaldo(1)
      const aut = new Autorizador(1); await aut.garantir(0)
      setGerando(true)
      const alta = await gerarAplique(png, cfg, { texturas: await texturasDe(cfg, texturas.current) })
      const n = nomeArquivo(nome || 'aplique'), JSZip = (await import('jszip')).default, z = new JSZip()
      for (const a of await zipDoAplique(alta, n)) z.file(a.nome, a.blob)
      baixar(await z.generateAsync({ type: 'blob', compression: 'STORE' }), `${n}_aplique.zip`)
      setAviso(`Pronto: aplique em 300 dpi (${alta.larguraMm.toFixed(0)}×${alta.alturaMm.toFixed(0)} mm), ${alta.camadas.length} camadas separadas para imprimir e as silhuetas em SVG (linha de corte).`)
    } catch (e) { setErro(e instanceof SemCota ? e.message : (e as Error).message) } finally { setGerando(false) }
  }
  async function salvarPreset() {
    const n = prompt('Nome do preset (ex.: Dourado 2 camadas):', '')?.trim()
    if (!n) return
    const r = await fetch('/api/estudio/presets-aplique', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: n, config: cfg }) })
    if (!r.ok) { setErro('Não consegui salvar o preset.'); return }
    setAviso(`Preset “${n}” salvo — use em outro personagem com 1 clique, ou no lote.`); carregar()
  }
  async function gerarLote() {
    if (!lote.length) return
    if (lote.length > LIMITE_LOTE * 4) { setErro(`Máximo de ${LIMITE_LOTE * 4} PNGs por lote.`); return }
    const base = presetLote === 'atual' ? cfg : presets.find(p => p.id === presetLote)?.cfg || cfg
    try { await exigirSaldo(lote.length) } catch (e) { setErro((e as Error).message); return }
    const ws = workspaceId, salvarNaBib = salvarLote && storage && ws
    const itens = await Promise.all(lote.map(async (f, i) => ({ id: `ap${i}_${f.name}`, rotulo: f.name.replace(/\.[^.]+$/, ''), arquivo: nomeArquivo(f.name.replace(/\.[^.]+$/, '')), chave: hashTexto(JSON.stringify([await hashArquivo(f), base.camadas.map(({ id: _i, ...c }) => c), base.larguraMm, base.preencherVaos, base.sombraNoProduto, 'aplique-v1'])), f })))
    const porId = new Map(itens.map(i => [i.id, i.f]))
    criarJob({
      nome: `Apliques · ${itens.length} PNG(s)`, nomeZip: `apliques-${new Date().toISOString().slice(0, 10)}.zip`,
      itens: itens.map(({ f: _f, ...i }) => i),
      autorizar: n => { const a = new Autorizador(n); return { lote: a.lote, garantir: i => a.garantir(i) } },
      ehSemCota: e => e instanceof SemCota,
      render: async it => {
        const f = porId.get(it.id)!, u = URL.createObjectURL(f)
        try {
          const im = await carregarImagem(u), c = configDoPreset(base)
          const r = await gerarAplique(im, c, { texturas: await texturasDe(c, texturas.current) })
          if (salvarNaBib) {
            const up = await enviarArquivo(f, f.name, 'imagem', ws!, { pasta: 'Apliques' })
            await fetch('/api/estudio/apliques', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: it.rotulo, pngUrl: up.url, pngAssetId: up.id, config: c, silhuetas: r.camadas.map(x => ({ id: x.id, nome: x.nome, raioMm: x.raioMm, contornos: x.silhueta })) }) })
          }
          return zipDoAplique(r, it.arquivo)
        } finally { URL.revokeObjectURL(u) }
      },
    })
    setAviso(`${itens.length} aplique(s) na fila — o painel da fila (canto inferior esquerdo) mostra o progresso e o ZIP (uma pasta por personagem: aplique, camadas e silhuetas).`)
    setLote([])
  }

  return (
    <div className="space-y-4">
      <div className={`${cartao} space-y-2`}>
        <p className="text-sm text-gray-700 dark:text-gray-200"><b>Apliques em camadas.</b> Suba <b>só o PNG</b> do personagem (fundo transparente) — o SOA gera as camadas de baixo (papel, laminado dourado/prata/rosé/holográfico, textura), já alinhadas e com profundidade. Sai pronto para imprimir cada camada e cortar.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={btnP + ' cursor-pointer'}><Upload className="w-4 h-4" /> Subir PNG do personagem<input type="file" accept="image/png,image/webp" className="hidden" data-png-aplique onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void abrirPng(f) }} /></label>
          {!!lista?.length && <select className={inp + ' !w-auto'} value="" onChange={e => { const a = lista.find(x => x.id === e.target.value); if (a) void abrirSalvo(a) }}><option value="">Abrir um aplique meu…</option>{lista.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select>}
        </div>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {aviso && <p className="text-sm text-emerald-700 dark:text-emerald-300" data-aviso-aplique>{aviso}</p>}

      {png && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          <div className={`${cartao} space-y-2`}>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex-1">{res ? `${res.larguraMm.toFixed(0)} × ${res.alturaMm.toFixed(0)} mm (com as camadas)` : ''}{gerando && <Loader2 className="inline w-3.5 h-3.5 ml-2 animate-spin" />}</span>
              fundo da prévia {['#fdf2f8', '#ffffff', '#1f2937', '#c7a27c'].map(c => <button key={c} onClick={() => setFundo(c)} className={`w-5 h-5 rounded border ${fundo === c ? 'ring-2 ring-orange-400' : ''}`} style={{ background: c }} />)}
            </div>
            <canvas ref={previa} className="max-w-full max-h-[70vh] w-auto h-auto mx-auto block rounded-lg" data-previa-aplique />
          </div>
          <div className="space-y-3">
            <div className={`${cartao} space-y-2`}>
              <div className="flex items-center gap-2"><p className="text-xs font-semibold flex-1">Camadas <span className="font-normal text-gray-400">(de cima para baixo)</span></p>
                <select className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value="" onChange={e => { const t = e.target.value as TipoCamada; if (t) { const n = novaCamada(t); setCfg(c => ({ ...c, camadas: [...c.camadas, n] })); setSel(n.id) } }} data-add-camada>
                  <option value="">+ camada…</option>{TIPOS.filter(t => t.id !== 'IMAGE').map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1" data-camadas>
                {cfg.camadas.map((c, i) => (
                  <div key={c.id} data-camada={c.nome} onClick={() => setSel(c.id)} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs cursor-pointer ${sel === c.id ? 'border-orange-400 bg-orange-50/60 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-700'} ${c.ativa ? '' : 'opacity-50'}`}>
                    <span className="w-4 h-4 rounded border shrink-0" style={{ background: c.tipo === 'IMAGE' ? 'linear-gradient(135deg,#fcd34d,#a0692f)' : c.tipo === 'METALLIC' ? ({ ouro: 'linear-gradient(135deg,#7a5a17,#f6e27a,#b8892b)', prata: 'linear-gradient(135deg,#6b6f75,#f4f6f8,#9aa0a6)', rose: 'linear-gradient(135deg,#8a5a4f,#f6d5c8,#b77f70)', holografico: 'linear-gradient(135deg,#f9a8d4,#a5f3fc,#c4b5fd)' }[c.metal || 'ouro']) : c.cor }} />
                    <span className="flex-1 truncate">{c.nome}{c.tipo !== 'IMAGE' ? <span className="text-gray-400"> · +{c.expansaoMm} mm</span> : null}</span>
                    <button onClick={e => { e.stopPropagation(); mover(c.id, -1) }} disabled={i === 0} title="Subir"><ChevronUp className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={e => { e.stopPropagation(); mover(c.id, 1) }} disabled={i === cfg.camadas.length - 1} title="Descer"><ChevronDown className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={e => { e.stopPropagation(); const d = { ...c, id: Math.random().toString(36).slice(2, 9), nome: `${c.nome} (cópia)`, sombra: { ...c.sombra } }; setCfg(x => { const a = [...x.camadas]; a.splice(i + 1, 0, d); return { ...x, camadas: a } }) }} title="Duplicar"><Copy className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={e => { e.stopPropagation(); mudarCamada(c.id, { ativa: !c.ativa }) }} title={c.ativa ? 'Desativar' : 'Ativar'}>{c.ativa ? <Eye className="w-3.5 h-3.5 text-gray-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}</button>
                    <button onClick={e => { e.stopPropagation(); setCfg(x => ({ ...x, camadas: x.camadas.filter(y => y.id !== c.id) })) }} title="Remover"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                  </div>
                ))}
              </div>
              {camadaSel && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-2 text-[11px]" data-props-camada>
                  <label className="col-span-2">Nome<input className={inp + ' !text-xs'} value={camadaSel.nome} onChange={e => mudarCamada(camadaSel.id, { nome: e.target.value })} /></label>
                  <label>Tipo<select className={inp + ' !text-xs'} value={camadaSel.tipo} onChange={e => mudarCamada(camadaSel.id, { tipo: e.target.value as TipoCamada })}>{TIPOS.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
                  {camadaSel.tipo === 'SOLID_COLOR' && <label>Cor<input type="color" className="w-full h-8 rounded border" value={camadaSel.cor} onChange={e => mudarCamada(camadaSel.id, { cor: e.target.value })} data-cor-camada /></label>}
                  {camadaSel.tipo === 'METALLIC' && <label>Metal<select className={inp + ' !text-xs'} value={camadaSel.metal || 'ouro'} onChange={e => mudarCamada(camadaSel.id, { metal: e.target.value as CamadaAplique['metal'] })}><option value="ouro">Dourado</option><option value="prata">Prata</option><option value="rose">Rosé</option><option value="holografico">Holográfico</option></select></label>}
                  {camadaSel.tipo === 'CUSTOM_TEXTURE' && <label className="cursor-pointer">Textura<span className={btn + ' !text-xs !py-1 w-full justify-center'}><Upload className="w-3 h-3" /> imagem<input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; let u = URL.createObjectURL(f); if (storage && workspaceId) { try { u = (await enviarArquivo(f, f.name, 'imagem', workspaceId, { pasta: 'Apliques/Texturas' })).url } catch { /* fica local */ } } mudarCamada(camadaSel.id, { texturaUrl: u }) }} /></span></label>}
                  {camadaSel.tipo !== 'IMAGE' && <label>Expansão {camadaSel.expansaoMm} mm<input type="range" min={0.5} max={10} step={0.5} value={camadaSel.expansaoMm} onChange={e => mudarCamada(camadaSel.id, { expansaoMm: Number(e.target.value) })} className="w-full accent-orange-500" data-expansao /></label>}
                  <label>Profundidade {camadaSel.profundidadeMm} mm<input type="range" min={0} max={5} step={0.5} value={camadaSel.profundidadeMm} onChange={e => mudarCamada(camadaSel.id, { profundidadeMm: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
                  <label>Sombra {camadaSel.sombra.distanciaMm} mm<input type="range" min={0} max={4} step={0.2} value={camadaSel.sombra.distanciaMm} onChange={e => mudarCamada(camadaSel.id, { sombra: { ...camadaSel.sombra, distanciaMm: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
                  <label>Desfoque {camadaSel.sombra.desfoqueMm} mm<input type="range" min={0} max={5} step={0.2} value={camadaSel.sombra.desfoqueMm} onChange={e => mudarCamada(camadaSel.id, { sombra: { ...camadaSel.sombra, desfoqueMm: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
                  <label>Opacidade {camadaSel.sombra.opacidade}%<input type="range" min={0} max={90} value={camadaSel.sombra.opacidade} onChange={e => mudarCamada(camadaSel.id, { sombra: { ...camadaSel.sombra, opacidade: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
                  <label>Ângulo {camadaSel.sombra.angulo}°<input type="range" min={0} max={359} value={camadaSel.sombra.angulo} onChange={e => mudarCamada(camadaSel.id, { sombra: { ...camadaSel.sombra, angulo: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 border-t border-gray-100 dark:border-gray-800 pt-2 text-[11px]">
                <label>Largura do personagem (mm)<input className={inp + ' !text-xs'} type="text" inputMode="decimal" value={cfg.larguraMm} onChange={e => { const n = Number(e.target.value.replace(',', '.')); if (n > 0 && n < 1000) setCfg(c => ({ ...c, larguraMm: n })) }} data-largura-mm /></label>
                <div className="space-y-1 pt-3">
                  <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={cfg.preencherVaos} onChange={e => setCfg(c => ({ ...c, preencherVaos: e.target.checked }))} /> fechar vãos</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={cfg.sombraNoProduto} onChange={e => setCfg(c => ({ ...c, sombraNoProduto: e.target.checked }))} /> sombra no produto</label>
                </div>
              </div>
            </div>
            <div className={`${cartao} space-y-2`}>
              <p className="text-xs font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-orange-500" /> Presets</p>
              <div className="flex flex-wrap gap-1.5">{presets.map(p => <button key={p.id} onClick={() => { setCfg(configDoPreset(p.cfg)); setSel(null) }} className="text-[11px] rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 hover:border-orange-400" data-preset={p.nome}>{p.nome}</button>)}</div>
              <button onClick={salvarPreset} className="text-[11px] text-gray-500 hover:text-orange-600">+ salvar estas camadas como preset</button>
            </div>
            <div className={`${cartao} space-y-2`}>
              <input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do aplique (ex.: Urso marinheiro)" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={salvar} disabled={gerando} className={btn + ' justify-center'} data-salvar-aplique><Save className="w-4 h-4" /> {editId ? 'Atualizar' : 'Salvar'}</button>
                <button onClick={exportar} disabled={gerando} className={btnP + ' justify-center'} data-exportar-aplique><Download className="w-4 h-4" /> Imprimir/cortar</button>
              </div>
              <p className="text-[10px] text-gray-400">Exportar = 1 imagem da cota: aplique e cada camada em 300 dpi + silhuetas em SVG (mm reais, linha de corte).</p>
            </div>
          </div>
        </div>
      )}

      <div className={`${cartao} space-y-2`}>
        <p className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-orange-500" /> Lote de apliques <span className="font-normal text-xs text-gray-500">— vários PNGs + 1 preset → todos em camadas, pela fila</span></p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className={btn + ' cursor-pointer !text-xs'}><Upload className="w-3.5 h-3.5" /> Escolher PNGs<input type="file" multiple accept="image/png,image/webp" className="hidden" data-lote-apliques onChange={e => { setLote([...(e.target.files || [])]); e.target.value = '' }} /></label>
          <span className="text-gray-500">{lote.length ? `${lote.length} PNG(s)` : 'nenhum escolhido'}</span>
          <label className={lbl + ' !mb-0'}>Preset</label>
          <select className="border border-gray-200 dark:border-gray-700 rounded px-1 py-1 bg-white dark:bg-gray-800" value={presetLote} onChange={e => setPresetLote(e.target.value)} data-preset-lote>
            <option value="atual">as camadas atuais</option>{presets.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={salvarLote} onChange={e => setSalvarLote(e.target.checked)} disabled={!storage} /> guardar na biblioteca de apliques</label>
          <button onClick={gerarLote} disabled={!lote.length} className={btnP + ' !text-xs'} data-gerar-lote-apliques><Layers className="w-3.5 h-3.5" /> Gerar {lote.length || ''} aplique(s)</button>
        </div>
        <p className="text-[10px] text-gray-400">Cada aplique conta 1 imagem da cota; a fila divide em lotes de {LIMITE_LOTE} e roda em segundo plano.</p>
      </div>

      {!!lista?.length && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Meus apliques</p>
          <div className="grid gap-2 grid-cols-3 sm:grid-cols-6 lg:grid-cols-8" data-meus-apliques>
            {lista.map(a => <button key={a.id} onClick={() => abrirSalvo(a)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 text-left hover:border-orange-400">{a.previewUrl ? <img src={a.previewUrl} alt="" className="w-full aspect-square object-contain bg-white rounded-lg" /> : <div className="w-full aspect-square bg-gray-50 rounded-lg" />}<p className="text-[10px] truncate mt-1">{a.nome}</p></button>)}
          </div>
        </div>
      )}
      {!png && !lista?.length && <p className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Comece subindo o PNG de um personagem.</p>}
    </div>
  )
}
