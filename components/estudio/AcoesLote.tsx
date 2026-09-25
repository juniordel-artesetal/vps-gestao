'use client'
// SOA Edition — AÇÕES EM LOTE: o mesmo ajuste / recorte / redimensionamento / marca d'água em até
// 50 imagens de uma vez, com PRESETS salvos ("logo no canto + 1080×1080 + brilho +10").
// Roda no aparelho (Web Worker), conta na cota diária e sai num ZIP.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Upload, ImagePlus, Plus, Trash2, ChevronUp, ChevronDown, Loader2, Download, Save, X, Eye } from 'lucide-react'
import CotaBarra from './CotaBarra'
import { AJUSTES_NEUTROS, FILTROS, type Ajustes } from '@/lib/estudio/ajustes'
import { OPERACOES_ROTULO, processarImagem, codificar, type Operacao, type Saida, type Posicao } from '@/lib/estudio/acoes'
import { processarLote, type ItemLote } from '@/lib/estudio/lote'
import { TAMANHOS_CANAIS, rotuloTamanho } from '@/lib/estudio/tamanhos'
import { LIMITE_LOTE } from '@/lib/estudio/dados'
import { reservarCota, fecharCota, SemCota, baixar, enviarArquivo } from '@/lib/estudio/cliente'

const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-800'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-0.5'
interface Preset { id: string; nome: string; operacoes: Operacao[] }
interface Asset { id: string; nome: string; url: string; tipo: string; mime: string | null }

const nova = (op: Operacao['op']): Operacao =>
  op === 'recortar' ? { op, proporcao: '1:1', alinhar: 'centro' }
  : op === 'redimensionar' ? { op, largura: 1080, altura: 1080, modo: 'encaixar', fundo: '#ffffff' }
  : op === 'ajustes' ? { op, ajustes: { ...AJUSTES_NEUTROS, brilho: 10 } }
  : { op, tipo: 'texto', texto: '@meuatelie', cor: '#ffffff', posicao: 'inf-dir', tamanho: 22, opacidade: 80, margem: 3 }

export default function AcoesLote() {
  const { data: session } = useSession()
  const workspaceId = (session?.user as { workspaceId?: string } | undefined)?.workspaceId
  const [itens, setItens] = useState<(ItemLote & { url: string })[]>([])
  const [ops, setOps] = useState<Operacao[]>([nova('redimensionar')])
  const [saida, setSaida] = useState<Saida>({ formato: 'jpg', qualidade: 90 })
  const [presets, setPresets] = useState<Preset[]>([])
  const [biblioteca, setBiblioteca] = useState<Asset[] | null>(null)
  const [escolhendoMarca, setEscolhendoMarca] = useState<number | null>(null)
  const [storage, setStorage] = useState(false)
  const [guardar, setGuardar] = useState(false)
  const [previa, setPrevia] = useState<string | null>(null)
  const [rodando, setRodando] = useState<{ feitos: number; total: number } | null>(null)
  const cancelarRef = useRef(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [faltam, setFaltam] = useState(0)
  const [cotaVersao, setCotaVersao] = useState(0)

  const carregarPresets = () => fetch('/api/estudio/presets?tipo=acao-lote').then(r => r.json()).then(d => setPresets(d.presets || [])).catch(() => {})
  useEffect(() => {
    carregarPresets()
    fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => {})
  }, [])
  useEffect(() => () => itens.forEach(i => URL.revokeObjectURL(i.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  function adicionarArquivos(fs: FileList) {
    const novos = [...fs].filter(f => f.type.startsWith('image/')).map(f => ({ nome: f.name, arquivo: f as Blob, url: URL.createObjectURL(f) }))
    setItens(x => [...x, ...novos].slice(0, LIMITE_LOTE))
    if (itens.length + novos.length > LIMITE_LOTE) setAviso(`Máximo de ${LIMITE_LOTE} imagens por vez — fiquei com as primeiras ${LIMITE_LOTE}.`)
  }
  async function abrirBiblioteca(paraMarca: number | null) {
    setEscolhendoMarca(paraMarca)
    const d = await fetch('/api/estudio/assets').then(r => r.json()).catch(() => ({ assets: [] }))
    setBiblioteca((d.assets || []).filter((a: Asset) => (a.mime || '').startsWith('image/')))
  }
  async function escolherDaBiblioteca(a: Asset) {
    if (escolhendoMarca !== null) {
      setOps(o => o.map((x, i) => i === escolhendoMarca && x.op === 'marcaDagua' ? { ...x, tipo: 'imagem', assetUrl: a.url } : x))
      setBiblioteca(null); return
    }
    try {
      const blob = await fetch(a.url).then(r => r.blob())
      setItens(x => [...x, { nome: a.nome, arquivo: blob, url: URL.createObjectURL(blob) }].slice(0, LIMITE_LOTE))
    } catch { setErro('Não consegui abrir essa imagem.') }
  }
  async function enviarMarca(i: number, f: File) {
    if (storage && workspaceId) {
      try {
        const up = await enviarArquivo(f, f.name, 'imagem', workspaceId, { pasta: "Marca d'água" })
        setOps(o => o.map((x, j) => j === i && x.op === 'marcaDagua' ? { ...x, tipo: 'imagem', assetUrl: up.url } : x)); return
      } catch (e) { setErro((e as Error).message); return }
    }
    // Sem armazenamento: vale só nesta sessão (não dá para guardar no preset).
    setOps(o => o.map((x, j) => j === i && x.op === 'marcaDagua' ? { ...x, tipo: 'imagem', assetUrl: URL.createObjectURL(f) } : x))
  }

  const mudarOp = (i: number, patch: Partial<Operacao>) => setOps(o => o.map((x, j) => (j === i ? ({ ...x, ...patch } as Operacao) : x)))
  const mover = (i: number, d: -1 | 1) => setOps(o => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n })

  async function salvarPreset() {
    const nome = prompt('Nome do preset:', 'Meu preset')
    if (!nome?.trim()) return
    if (ops.some(o => o.op === 'marcaDagua' && o.tipo === 'imagem' && o.assetUrl?.startsWith('blob:'))) { setErro('Guarde a marca d’água em Meus arquivos antes de salvar o preset.'); return }
    const r = await fetch('/api/estudio/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, tipo: 'acao-lote', operacoes: ops }) })
    if (r.ok) { setAviso(`Preset “${nome}” salvo.`); carregarPresets() } else setErro((await r.json()).error || 'Não consegui salvar.')
  }
  async function excluirPreset(p: Preset) {
    if (!confirm(`Excluir o preset “${p.nome}”?`)) return
    await fetch(`/api/estudio/presets/${p.id}`, { method: 'DELETE' }); carregarPresets()
  }

  async function verPrevia() {
    if (!itens[0]) return
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = itens[0].url })
      let marca: HTMLImageElement | null = null
      const m = ops.find(o => o.op === 'marcaDagua' && o.tipo === 'imagem') as Extract<Operacao, { op: 'marcaDagua' }> | undefined
      if (m?.assetUrl) marca = await new Promise(res => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = m.assetUrl! })
      const c = processarImagem(img, ops, marca)
      setPrevia(URL.createObjectURL(await codificar(c, { ...saida, qualidade: 80 })))
    } catch (e) { setErro('Prévia falhou: ' + (e as Error).message) }
  }

  async function rodar() {
    if (!itens.length || !ops.length) return
    setErro(''); setAviso(''); setFaltam(0); cancelarRef.current = false
    let reservaId = ''
    try { reservaId = (await reservarCota(itens.length)).reservaId }
    catch (e) { if (e instanceof SemCota) setFaltam(e.faltam); setErro((e as Error).message); return }
    let feitos = 0
    setRodando({ feitos: 0, total: itens.length })
    try {
      const r = await processarLote(itens, ops, saida, { aoProgredir: (f, t) => setRodando({ feitos: f, total: t }), cancelado: () => cancelarRef.current })
      feitos = r.ok.length
      if (!r.ok.length) throw new Error(r.falhas[0] || 'nenhuma imagem saiu')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const usados = new Map<string, number>()
      for (const a of r.ok) { const q = usados.get(a.nome) || 0; usados.set(a.nome, q + 1); zip.file(q ? a.nome.replace(/(\.[^.]+)$/, `-${q + 1}$1`) : a.nome, a.blob) }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      baixar(blob, 'imagens.zip')
      if (guardar && storage && workspaceId) await enviarArquivo(blob, `Lote ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.zip`, 'gerado', workspaceId, { pasta: 'Ações em lote', meta: { itens: r.ok.length } }).catch(() => {})
      setAviso(`Pronto! ${r.ok.length} imagem(ns) no ZIP.${r.falhas.length ? ` ${r.falhas.length} falharam: ${r.falhas.slice(0, 2).join(' · ')}` : ''}`)
    } catch (e) {
      if ((e as Error).message === 'cancelado') setAviso('Cancelado — o que não foi gerado voltou para a sua cota.')
      else setErro('Falha no lote: ' + (e as Error).message)
    } finally { await fecharCota(reservaId, feitos); setRodando(null); setCotaVersao(v => v + 1) }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ações em lote</h1>
        <p className="text-sm text-gray-500">O mesmo tratamento em até {LIMITE_LOTE} fotos de uma vez — recorte, tamanho do canal, ajustes e marca d’água.</p>
      </div>
      <CotaBarra atualizar={cotaVersao} faltam={faltam} />
      {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex justify-between"><span>{erro}</span><button onClick={() => setErro('')}><X className="w-4 h-4" /></button></div>}
      {aviso && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2 flex justify-between"><span>{aviso}</span><button onClick={() => setAviso('')}><X className="w-4 h-4" /></button></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* imagens */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mr-auto">Imagens <span className="font-normal text-gray-400">({itens.length}/{LIMITE_LOTE})</span></p>
            <label className="text-xs inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 cursor-pointer hover:border-orange-400"><Upload className="w-3.5 h-3.5" /> Do aparelho
              <input type="file" multiple accept="image/*" className="hidden" onChange={e => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = '' }} />
            </label>
            <button onClick={() => abrirBiblioteca(null)} className="text-xs inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 hover:border-orange-400"><ImagePlus className="w-3.5 h-3.5" /> De Meus arquivos</button>
            {!!itens.length && <button onClick={() => { itens.forEach(i => URL.revokeObjectURL(i.url)); setItens([]) }} className="text-xs text-gray-400 hover:text-red-600">limpar</button>}
          </div>
          {!itens.length ? <p className="text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">Escolha as fotos que vão receber o mesmo tratamento.</p> : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {itens.map((it, i) => (
                <div key={i} className="relative group">
                  <img src={it.url} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-100 dark:border-gray-800" />
                  <button onClick={() => { URL.revokeObjectURL(it.url); setItens(x => x.filter((_, j) => j !== i)) }} className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          {previa && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="text-xs text-gray-500 mb-1">Prévia da 1ª imagem</p>
              <img src={previa} alt="Prévia" className="max-h-72 rounded-lg border border-gray-200 dark:border-gray-700" />
            </div>
          )}
        </div>

        {/* operações */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <select className={inp} value="" onChange={e => { const p = presets.find(x => x.id === e.target.value); if (p) setOps(p.operacoes) }}>
              <option value="">📂 Usar preset…</option>
              {presets.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <button onClick={salvarPreset} disabled={!ops.length} className="text-xs inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 whitespace-nowrap disabled:opacity-40"><Save className="w-3.5 h-3.5" /> Salvar</button>
          </div>
          {!!presets.length && <div className="flex flex-wrap gap-1">{presets.map(p => <span key={p.id} className="text-[10px] bg-gray-100 dark:bg-gray-800 rounded-full pl-2 pr-1 py-0.5 inline-flex items-center gap-1">{p.nome}<button onClick={() => excluirPreset(p)} className="text-gray-400 hover:text-red-600"><X className="w-3 h-3" /></button></span>)}</div>}

          {ops.map((o, i) => (
            <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-800 p-2.5 space-y-2">
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mr-auto">{i + 1}. {OPERACOES_ROTULO[o.op]}</p>
                <button onClick={() => mover(i, -1)} className="text-gray-400 hover:text-gray-700"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => mover(i, 1)} className="text-gray-400 hover:text-gray-700"><ChevronDown className="w-4 h-4" /></button>
                <button onClick={() => setOps(x => x.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {o.op === 'recortar' && (
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Proporção</label>
                    <select className={inp} value={o.proporcao} onChange={e => mudarOp(i, { proporcao: e.target.value })}>
                      {['1:1', '4:5', '3:4', '2:3', '9:16', '16:9'].map(p => <option key={p}>{p}</option>)}
                    </select></div>
                  <div><label className={lbl}>Manter</label>
                    <select className={inp} value={o.alinhar} onChange={e => mudarOp(i, { alinhar: e.target.value as 'centro' })}>
                      <option value="centro">Centro</option><option value="topo">Topo</option><option value="base">Base</option>
                    </select></div>
                </div>
              )}
              {o.op === 'redimensionar' && (
                <div className="space-y-2">
                  <select className={inp} value="" onChange={e => { const t = TAMANHOS_CANAIS.find(x => x.id === e.target.value); if (t) mudarOp(i, { largura: t.largura, altura: t.altura }) }}>
                    <option value="">Tamanho de canal…</option>
                    {TAMANHOS_CANAIS.map(t => <option key={t.id} value={t.id}>{rotuloTamanho(t)}</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className={lbl}>Largura</label><input className={inp} inputMode="numeric" value={o.largura} onChange={e => mudarOp(i, { largura: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></div>
                    <div><label className={lbl}>Altura</label><input className={inp} inputMode="numeric" value={o.altura} onChange={e => mudarOp(i, { altura: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></div>
                    <div><label className={lbl}>Modo</label>
                      <select className={inp} value={o.modo} onChange={e => mudarOp(i, { modo: e.target.value as 'encaixar' })}>
                        <option value="encaixar">Encaixar</option><option value="preencher">Preencher</option><option value="esticar">Esticar</option>
                      </select></div>
                  </div>
                  {o.modo === 'encaixar' && <label className="flex items-center gap-2 text-[11px] text-gray-500">Fundo <input type="color" value={o.fundo || '#ffffff'} onChange={e => mudarOp(i, { fundo: e.target.value })} className="w-7 h-6 rounded border border-gray-200" />
                    <button onClick={() => mudarOp(i, { fundo: null })} className="underline">transparente</button></label>}
                </div>
              )}
              {o.op === 'ajustes' && <AjustesCompactos a={o.ajustes} onMudar={a => mudarOp(i, { ajustes: a })} />}
              {o.op === 'marcaDagua' && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {(['texto', 'imagem'] as const).map(t => <button key={t} onClick={() => mudarOp(i, { tipo: t })} className={`text-[11px] rounded-lg px-2 py-1 border ${o.tipo === t ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'}`}>{t === 'texto' ? 'Texto' : 'Logo (imagem)'}</button>)}
                  </div>
                  {o.tipo === 'texto' ? (
                    <div className="flex gap-2"><input className={inp} value={o.texto || ''} onChange={e => mudarOp(i, { texto: e.target.value })} /><input type="color" value={o.cor || '#ffffff'} onChange={e => mudarOp(i, { cor: e.target.value })} className="w-8 h-7 rounded border border-gray-200" /></div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {o.assetUrl ? <img src={o.assetUrl} alt="" className="h-10 rounded border border-gray-200 bg-gray-50" /> : <span className="text-[11px] text-gray-400">sem logo</span>}
                      <label className="text-[11px] underline cursor-pointer">enviar<input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) enviarMarca(i, f); e.target.value = '' }} /></label>
                      <button onClick={() => abrirBiblioteca(i)} className="text-[11px] underline">de Meus arquivos</button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>Posição</label>
                      <select className={inp} value={o.posicao} onChange={e => mudarOp(i, { posicao: e.target.value as Posicao })}>
                        <option value="inf-dir">Canto inferior direito</option><option value="inf-esq">Canto inferior esquerdo</option>
                        <option value="sup-dir">Canto superior direito</option><option value="sup-esq">Canto superior esquerdo</option><option value="centro">Centro</option>
                      </select></div>
                    <label className="text-[10px] text-gray-500">Tamanho {o.tamanho}%<input type="range" min={5} max={60} value={o.tamanho} onChange={e => mudarOp(i, { tamanho: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
                    <label className="text-[10px] text-gray-500">Opacidade {o.opacidade}%<input type="range" min={10} max={100} value={o.opacidade} onChange={e => mudarOp(i, { opacidade: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
                    <label className="text-[10px] text-gray-500">Margem {o.margem}%<input type="range" min={0} max={15} value={o.margem} onChange={e => mudarOp(i, { margem: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            {(['recortar', 'redimensionar', 'ajustes', 'marcaDagua'] as const).map(op => (
              <button key={op} onClick={() => setOps(o => [...o, nova(op)])} disabled={ops.length >= 20} className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-2 py-1 hover:border-orange-400"><Plus className="w-3 h-3" /> {OPERACOES_ROTULO[op]}</button>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              Formato
              <select className={inp + ' !w-auto'} value={saida.formato} onChange={e => setSaida(s => ({ ...s, formato: e.target.value as Saida['formato'] }))}>
                <option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option>
              </select>
              {saida.formato !== 'png' && <>Qualidade <input type="range" min={60} max={100} value={saida.qualidade} onChange={e => setSaida(s => ({ ...s, qualidade: Number(e.target.value) }))} className="w-20 accent-orange-500" /></>}
            </div>
            {storage && <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" className="accent-orange-500" checked={guardar} onChange={e => setGuardar(e.target.checked)} /> Guardar o ZIP em Meus arquivos</label>}
            <div className="flex gap-2">
              <button onClick={verPrevia} disabled={!itens.length || !!rodando} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs disabled:opacity-40"><Eye className="w-3.5 h-3.5" /> Prévia</button>
              {!rodando ? (
                <button onClick={rodar} disabled={!itens.length || !ops.length} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 disabled:opacity-40">
                  <Download className="w-4 h-4" /> Aplicar em {itens.length || ''} imagem(ns)
                </button>
              ) : (
                <button onClick={() => { cancelarRef.current = true }} className="flex-1 rounded-lg border border-gray-300 text-sm py-2 inline-flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {rodando.feitos}/{rodando.total} · Cancelar</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {biblioteca && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setBiblioteca(null)}>
          <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3"><h3 className="font-semibold text-gray-900 dark:text-white">{escolhendoMarca !== null ? 'Escolha o logo' : 'Imagens de Meus arquivos'}</h3><button onClick={() => setBiblioteca(null)}><X className="w-4 h-4" /></button></div>
            {!biblioteca.length && <p className="text-sm text-gray-400">Nenhuma imagem guardada ainda.</p>}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {biblioteca.map(a => (
                <button key={a.id} onClick={() => escolherDaBiblioteca(a)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1 hover:border-orange-400 text-left">
                  <img src={a.url} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" loading="lazy" />
                  <span className="block text-[10px] truncate mt-1 text-gray-600 dark:text-gray-300">{a.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AjustesCompactos({ a, onMudar }: { a: Ajustes; onMudar: (a: Ajustes) => void }) {
  const f = (rot: string, k: 'brilho' | 'contraste' | 'saturacao' | 'temperatura', min = -100, max = 100) => (
    <label className="text-[10px] text-gray-500">{rot} {a[k] > 0 ? `+${a[k]}` : a[k]}
      <input type="range" min={min} max={max} value={a[k]} onChange={e => onMudar({ ...a, [k]: Number(e.target.value) })} className="w-full accent-orange-500" />
    </label>
  )
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">{FILTROS.map(x => <button key={x.id} onClick={() => onMudar({ ...a, filtro: x.id })} className={`text-[10px] rounded-full px-2 py-0.5 border ${a.filtro === x.id ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'}`}>{x.rotulo}</button>)}</div>
      <div className="grid grid-cols-2 gap-x-2">{f('Brilho', 'brilho')}{f('Contraste', 'contraste')}{f('Saturação', 'saturacao')}{f('Temperatura', 'temperatura')}</div>
    </div>
  )
}
