'use client'
'use no memo'
import { nomeOT } from '@/lib/mae/texto/opentype'
// EDITOR DE IMAGEM UNIFICADO (Sprint 13): as funções do editor do SOA Design dentro do Método MAE, no
// motor do MAE (tela = arquivo). Designs ficam na Biblioteca (pasta Designs/), com "Guardar em Meus
// arquivos" opcional para a nuvem. Aqui: design e páginas, ferramentas (texto, formas, camada de ajuste,
// importar PSD/PDF), propriedades da camada (texto, forma, caixa/girar/espelhar/alinhar, filtros, IA,
// editar pixels) e a exportação (tamanhos de marketplace, JPG/PNG/WebP/PDF).
import { confirmarTroca } from './historicoGlobal'
import { PASTA_DESIGNS, salvarDesign } from './arquivosMae'
import Deslizador from './Deslizador'
import { useEffect, useState } from 'react'
import { getSession } from 'next-auth/react'
import { Plus, FolderOpen, Save, Copy, Trash2, ArrowUp, ArrowDown, Type, SlidersHorizontal, FileUp, Loader2, Download, FlipHorizontal2, FlipVertical2, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Maximize2, Minimize2, Brush, Cloud, Check } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { gravar, ler, listar, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { novoTexto, novaFormaLivre, novoAjuste, novaImagem, novoIdCamada, acharCamada } from '@/lib/mae/editor/camadas'
import { materializar, fontesDosTextos } from '@/lib/mae/editor/materializar'
import { ajustePadrao, Ajuste } from '@/lib/mae/schema/edicao'
import { DocTrabalho, MODOS_MESCLAGEM, type NoCamada, type NoImagem, type NoTexto, type NoFormaLivre, type Prancheta } from '@/lib/mae/schema'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { slugArquivo, pastaExportacao, dataIso, nomeLivre } from '@/lib/mae/exportar/nomes'
import { comPhys } from '@/lib/mae/exportar/png'
import { TAMANHOS_CANAIS } from '@/lib/estudio/tamanhos'
import PainelIA, { type ResultadoIA } from '@/components/estudio/editor/PainelIA'
import { useEditor } from './estado'
import { adicionarCamada, editarCamada, paginaAtual } from './acoesCamadas'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { GOOGLE_FONTS, garantirFontes, registroFontes, useFontes } from './fontesTexto'
import { infoImagem } from './arquivosMae'
import EditorPixels, { type ResultadoPixels } from './EditorPixels'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ico = 'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30'
const inp = 'w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs'
const r2 = (v: number) => Math.round(v * 100) / 100
const MM_POR_PX_300 = 25.4 / 300

// ── design: novo, abrir, salvar, páginas ─────────────────────────────────────────────────────────
const TAMANHOS_NOVO: { id: string; rotulo: string; w: number; h: number }[] = [
  { id: 'A4', rotulo: 'A4 retrato (210 × 297 mm)', w: 210, h: 297 }, { id: 'A4p', rotulo: 'A4 paisagem (297 × 210 mm)', w: 297, h: 210 },
  { id: 'A5', rotulo: 'A5 (148 × 210 mm)', w: 148, h: 210 }, { id: 'A6', rotulo: 'A6 (105 × 148 mm)', w: 105, h: 148 },
  ...TAMANHOS_CANAIS.map(t => ({ id: t.id, rotulo: `${t.canal} · ${t.rotulo} (${t.largura}×${t.altura} px)`, w: r2(t.largura * MM_POR_PX_300), h: r2(t.altura * MM_POR_PX_300) })),
]

export function PainelDesign() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const doc = useMaeDoc(s => s.hist.atual)
  const pagina = useEditor(s => s.pagina)
  const [tam, setTam] = useState('A4')
  const [lista, setLista] = useState<{ nome: string; path: string }[] | null>(null)
  const [antigos, setAntigos] = useState<{ id: string; nome: string }[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const ativa = doc.artboards.find(a => a.id === pagina) ?? doc.artboards[0]
  const aplicar = useMaeDoc.getState().aplicar

  async function novo() {
    if (!(await confirmarTroca('design'))) return
    const t = TAMANHOS_NOVO.find(x => x.id === tam)!
    const d = novoDocumento('A4')
    d.name = 'Design sem nome'
    d.artboards = [{ id: `ab_${Math.random().toString(36).slice(2, 8)}`, widthMm: t.w, heightMm: t.h, name: 'Página 1', layers: [] }]
    useMaeDoc.getState().carregar(d)
    useEditor.getState().set({ pagina: d.artboards[0].id })
    setMsg(null)
  }
  async function salvar() {
    if (!raiz) return
    const d = useMaeDoc.getState().hist.atual
    setMsg(`Salvo em ${await salvarDesign(raiz, d)}`)
  }
  async function abrirLista() {
    if (!raiz) return
    const es = await listar(raiz, PASTA_DESIGNS).catch(() => [])
    setLista(es.filter(e => e.tipo === 'arquivo' && e.nome.endsWith('.mae-design.json')).map(e => ({ nome: e.nome.replace('.mae-design.json', ''), path: `${PASTA_DESIGNS}/${e.nome}` })))
    fetch('/api/estudio/designs').then(r => r.ok ? r.json() : null).then(j => setAntigos((j?.designs ?? []).map((x: { id: string; nome: string }) => ({ id: x.id, nome: x.nome })))).catch(() => setAntigos([]))
  }
  async function abrir(path: string) {
    if (!raiz) return
    if (!(await confirmarTroca('design'))) return
    try {
      const j = JSON.parse(await (await ler(raiz, path)).text())
      const d = DocTrabalho.parse(j.doc ?? j)
      useMaeDoc.getState().carregar(d)
      useEditor.getState().set({ pagina: d.artboards[0]?.id ?? null })
      setLista(null); setMsg(null)
    } catch (e) { setMsg(`Não consegui abrir: ${(e as Error).message}`) }
  }
  // botões da barra do topo (Lote 3, item 36)
  const pedidoTopo = useEditor(s => s.pedidoTopo)
  useEffect(() => {
    if (pedidoTopo !== 'novo-design' && pedidoTopo !== 'abrir-design') return
    useEditor.getState().set({ pedidoTopo: null })
    if (pedidoTopo === 'novo-design') void novo(); else void abrirLista()
  }, [pedidoTopo]) // eslint-disable-line react-hooks/exhaustive-deps
  const novaPagina = (dup: boolean) => {
    const id = `ab_${Math.random().toString(36).slice(2, 8)}`
    aplicar(dup ? 'Duplicar página' : 'Nova página', d => {
      const i = d.artboards.findIndex(a => a.id === ativa.id)
      const base = d.artboards[i]
      const copia = dup ? JSON.parse(JSON.stringify(base)) : { widthMm: base.widthMm, heightMm: base.heightMm, layers: [] }
      if (dup) { const ren = (l: NoCamada[]) => l.forEach(n => { n.id = novoIdCamada(); if (n.type === 'group') ren(n.children) }); ren(copia.layers ?? []) }
      d.artboards.splice(i + 1, 0, { ...copia, id, name: `Página ${d.artboards.length + 1}` })
    })
    useEditor.getState().set({ pagina: id })
  }
  const moverPagina = (dir: 1 | -1) => aplicar('Mover página', d => {
    const i = d.artboards.findIndex(a => a.id === ativa.id), j = i + dir
    if (j < 0 || j >= d.artboards.length) return
    const [p] = d.artboards.splice(i, 1); d.artboards.splice(j, 0, p)
  })
  const excluirPagina = () => {
    if (doc.artboards.length < 2) return
    aplicar('Excluir página', d => { d.artboards = d.artboards.filter(a => a.id !== ativa.id) })
    useEditor.getState().set({ pagina: null })
  }

  return (
    <section className="space-y-2" data-painel-design>
      <div className="flex items-center gap-1">
        <input defaultValue={doc.name} key={doc.id} onBlur={e => { const v = e.target.value.trim().slice(0, 120); if (v && v !== doc.name) aplicar('Nome do design', d => { d.name = v }) }}
          className="flex-1 min-w-0 rounded border border-transparent hover:border-gray-200 bg-transparent px-1 text-sm font-semibold" data-nome-design aria-label="Nome do design" />
        <button className={btn} onClick={salvar} disabled={!liberada} data-salvar-design><Save className="w-3.5 h-3.5" /> Salvar</button>
      </div>
      {/* Lote 2 (item 19): o tamanho/orientação REAL da página aberta; o seletor abaixo é só para um design novo */}
      {ativa && <p className="text-[11px] text-gray-600 dark:text-gray-300" data-pagina-medidas>Página atual: <b>{Math.round(ativa.widthMm * 10) / 10} × {Math.round(ativa.heightMm * 10) / 10} mm</b> · {ativa.widthMm > ativa.heightMm ? 'paisagem' : ativa.widthMm < ativa.heightMm ? 'retrato' : 'quadrada'}</p>}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-gray-500">Novo design:</span>
        <select value={tam} onChange={e => setTam(e.target.value)} className={`${inp} !w-auto max-w-[11rem]`} data-tamanho-novo>
          {TAMANHOS_NOVO.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
        </select>
        <button className={btn} onClick={novo} data-novo-design><Plus className="w-3.5 h-3.5" /> Novo design</button>
        <button className={btn} onClick={abrirLista} disabled={!liberada} data-abrir-design><FolderOpen className="w-3.5 h-3.5" /> Abrir…</button>
      </div>
      {lista && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-xs space-y-1" data-lista-designs>
          {!lista.length && <p className="text-gray-400">Nenhum design em {PASTA_DESIGNS}/ ainda.</p>}
          {lista.map(l => <button key={l.path} className="block underline text-left" onClick={() => abrir(l.path)}>{l.nome}</button>)}
          {!!antigos?.length && (<>
            <p className="pt-1 text-[10px] uppercase text-gray-400">Designs antigos (nuvem, SOA Design)</p>
            {antigos.map(a => <a key={a.id} className="block underline text-left text-gray-600" href={`/estudio/editor/${a.id}`}>{a.nome}</a>)}
          </>)}
        </div>
      )}
      {/* páginas (estilo Canva) */}
      <div className="flex flex-wrap items-center gap-1" data-paginas>
        {doc.artboards.map((a, i) => (
          <button key={a.id} className={`rounded px-2 py-0.5 text-[11px] border ${a.id === ativa.id ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 dark:border-gray-700'}`} onClick={() => useEditor.getState().set({ pagina: a.id })} data-pagina={i + 1}>{a.name || `Página ${i + 1}`}</button>
        ))}
        <button className={ico} onClick={() => novaPagina(false)} title="Nova página" data-nova-pagina><Plus className="w-3.5 h-3.5" /></button>
        <button className={ico} onClick={() => novaPagina(true)} title="Duplicar página" data-duplicar-pagina><Copy className="w-3.5 h-3.5" /></button>
        <button className={ico} onClick={() => moverPagina(-1)} title="Página para a esquerda"><ArrowUp className="w-3.5 h-3.5 -rotate-90" /></button>
        <button className={ico} onClick={() => moverPagina(1)} title="Página para a direita"><ArrowDown className="w-3.5 h-3.5 -rotate-90" /></button>
        <button className={ico} onClick={excluirPagina} disabled={doc.artboards.length < 2} title="Excluir página"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {msg && <p className="text-[11px] text-gray-600" data-msg-design>{msg}</p>}
    </section>
  )
}

// ── ferramentas: texto, formas, camada de ajuste, importar PSD/PDF ──────────────────────────────
const FORMAS: { kind: NoFormaLivre['kind']; rotulo: string; sides?: number }[] = [
  { kind: 'rect', rotulo: 'Retângulo' }, { kind: 'ellipse', rotulo: 'Círculo' }, { kind: 'polygon', rotulo: 'Triângulo', sides: 3 }, { kind: 'polygon', rotulo: 'Hexágono', sides: 6 },
  { kind: 'star', rotulo: 'Estrela', sides: 5 }, { kind: 'heart', rotulo: 'Coração' }, { kind: 'line', rotulo: 'Linha' }, { kind: 'arrow', rotulo: 'Seta' },
]
const MODO_PSD: Record<string, string> = { 'pass through': 'normal', normal: 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color dodge': 'color-dodge', 'color burn': 'color-burn', 'hard light': 'hard-light', 'soft light': 'soft-light', difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity' }

export function FerramentasImagem({ onMsg }: { onMsg: (m: string | null) => void }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const pag = () => paginaAtual()
  const noMeio = (w: number, h: number) => { const p = pag(); return { xMm: r2((p.widthMm - w) / 2), yMm: r2((p.heightMm - h) / 2), wMm: r2(w), hMm: r2(h) } }

  async function guardar(blob: Blob, pasta: string, nome: string): Promise<{ path: string; sha256: string }> {
    const sha = await sha256(blob)
    const path = `${pasta}/${slugArquivo(nome, 50)}-${sha.slice(0, 8)}.png`
    await gravar(raiz!, path, blob)
    await motorDaPagina().enviarBitmap(sha, blob)
    return { path, sha256: sha }
  }

  async function importar() {
    if (!raiz || !liberada) { onMsg('Conecte a pasta Biblioteca MAE primeiro.'); return }
    try {
      const [h] = await window.showOpenFilePicker({ id: 'mae-importar', types: [{ description: 'PSD, PDF ou imagem', accept: { 'application/octet-stream': ['.psd', '.psb'], 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] } }] })
      const f = await h.getFile()
      const nomeArq = f.name.replace(/\.[^.]+$/, '')
      setOcupado(`Lendo ${f.name}…`)
      const p = pag()
      const camadas: NoCamada[] = []
      if (/\.ps[db]$/i.test(f.name)) {
        const { lerPsdLeve } = await import('@/lib/estudio/psdLeve')
        const psd = await lerPsdLeve(await f.arrayBuffer(), undefined, (a, t) => setOcupado(`Lendo camadas do PSD… ${a}/${t}`))
        // px do PSD (já reduzido por `escala`) → mm, a 300 dpi do tamanho original
        const k = MM_POR_PX_300 / psd.escala
        // o PSD inteiro cabe na página (centralizado), mantendo a proporção
        const esc = Math.min(p.widthMm / (psd.width * k), p.heightMm / (psd.height * k))
        const ox = (p.widthMm - psd.width * k * esc) / 2, oy = (p.heightMm - psd.height * k * esc) / 2
        let n = 0
        const conv = async (nos: NonNullable<typeof psd.children>): Promise<NoCamada[]> => {
          const out: NoCamada[] = []
          for (const no of nos) {
            const comum = { visible: !no.hidden, locked: false, opacity: no.opacity ?? 1, fill: 1, blendMode: (MODO_PSD[String(no.blendMode ?? 'normal')] ?? 'normal') as NoCamada['blendMode'], clip: !!no.clipping }
            if (no.children?.length) { out.push({ ...comum, id: novoIdCamada(), type: 'group', name: no.name ?? 'Grupo', passThrough: true, children: await conv(no.children) }); continue }
            if (!no.blob || no.left === undefined) continue
            const ref = await guardar(no.blob, `Elementos/${slugArquivo(nomeArq, 40)}`, no.name ?? `camada-${++n}`)
            out.push({ ...novaImagem({ ...ref, name: no.name ?? 'Camada', xMm: r2(ox + no.left * k * esc), yMm: r2(oy + (no.top ?? 0) * k * esc), wMm: r2(((no.right ?? 0) - no.left) * k * esc), hMm: r2(((no.bottom ?? 0) - (no.top ?? 0)) * k * esc) }), ...comum })
          }
          return out
        }
        camadas.push(...await conv(psd.children ?? []))
      } else if (/\.pdf$/i.test(f.name)) {
        const { analisarPaginaPdf } = await import('@/lib/estudio/pdfObjetos')
        const pg = await analisarPaginaPdf(f, 1)
        const mmPorPx = (pg.pagina.larguraPt * 25.4) / 72 / pg.W
        const esc = Math.min(p.widthMm / (pg.W * mmPorPx), p.heightMm / (pg.H * mmPorPx))
        const k = mmPorPx * esc, ox = (p.widthMm - pg.W * k) / 2, oy = (p.heightMm - pg.H * k) / 2
        const blobDe = (c: HTMLCanvasElement) => new Promise<Blob>(ok => c.toBlob(b => ok(b!), 'image/png'))
        if (pg.vetores) camadas.push(novaImagem({ ...await guardar(await blobDe(pg.vetores), `Elementos/${slugArquivo(nomeArq, 40)}`, 'desenho'), name: 'Desenho (vetores)', xMm: r2(ox), yMm: r2(oy), wMm: r2(pg.W * k), hMm: r2(pg.H * k) }))
        for (const [i, im] of pg.imagens.entries()) camadas.push({ ...novaImagem({ ...await guardar(await blobDe(im.canvas), `Elementos/${slugArquivo(nomeArq, 40)}`, `imagem-${i + 1}`), name: `Imagem ${i + 1}`, xMm: r2(ox + im.x * k), yMm: r2(oy + im.y * k), wMm: r2(im.w * k), hMm: r2(im.h * k) }), rotationDeg: im.rotacao || 0 })
        for (const t of pg.textos) {
          const tt = novoTexto({ xMm: r2(ox + t.x * k), yMm: r2(oy + t.y * k), wMm: r2(Math.max(5, t.w * k * 1.05)), hMm: r2(Math.max(3, t.h * k)), valor: t.texto, tamanhoPt: Math.max(4, (t.tamanho * k) / (25.4 / 72)) })
          camadas.push({ ...tt, rotationDeg: t.rotacao || 0, font: t.fonte?.nome ? { postscriptName: t.fonte.nome.replace(/^[A-Z]{6}\+/, ''), family: t.fonte.nome } : tt.font } as NoTexto)
        }
      } else {
        const ref = await guardar(f, 'Elementos', nomeArq)
        const bmp = await createImageBitmap(f), prop = bmp.height / bmp.width; bmp.close()
        let w = p.widthMm * 0.8, hh = w * prop
        if (hh > p.heightMm * 0.8) { hh = p.heightMm * 0.8; w = hh / prop }
        camadas.push(novaImagem({ ...ref, name: nomeArq, ...noMeio(w, hh) }))
      }
      if (!camadas.length) { onMsg('O arquivo não tinha camadas que eu consiga trazer.'); return }
      useMaeDoc.getState().aplicar(`Importar ${f.name}`, d => {
        const ab = d.artboards.find(a => a.id === p.id)!
        ab.layers = [...(ab.layers ?? []), ...(camadas.length > 1 ? [{ visible: true, locked: false, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false, id: novoIdCamada(), type: 'group' as const, name: nomeArq, passThrough: true, children: camadas }] : camadas)]
      })
      onMsg(`${f.name}: ${camadas.length} camada(s) importada(s).`)
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') onMsg(`Não consegui importar: ${(e as Error).message}`)
    } finally { setOcupado(null) }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5" data-ferramentas-imagem>
        <button className={btn} onClick={() => { const p = pag(); adicionarCamada(novoTexto(noMeio(p.widthMm * 0.8, Math.min(40, p.heightMm * 0.25))), 'Adicionar texto') }} data-add-texto><Type className="w-3.5 h-3.5" /> Texto</button>
        <select value="" onChange={e => { const f = FORMAS[Number(e.target.value)]; if (!f) return; const p = pag(), lado = Math.min(p.widthMm, p.heightMm) * 0.4; adicionarCamada(novaFormaLivre({ kind: f.kind, sides: f.sides, ...noMeio(f.kind === 'line' || f.kind === 'arrow' ? lado * 1.5 : lado, f.kind === 'line' ? 2 : f.kind === 'arrow' ? lado * 0.6 : lado) }), `Forma: ${f.rotulo}`) }} className={`${btn} !py-0.5`} aria-label="Adicionar forma" data-add-forma>
          <option value="">◆ Forma…</option>
          {FORMAS.map((f, i) => <option key={i} value={i}>{f.rotulo}</option>)}
        </select>
        <button className={btn} onClick={() => adicionarCamada(novoAjuste([ajustePadrao('hueSaturation')]), 'Camada de ajuste')} title="Ajusta tudo o que está abaixo dela" data-add-ajuste><SlidersHorizontal className="w-3.5 h-3.5" /> Ajuste</button>
        <button className={btn} onClick={importar} disabled={!!ocupado} title="PSD (com as camadas), PDF (por objetos) ou imagem" data-importar-arquivo>{ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />} Importar PSD/PDF…</button>
      </div>
      {ocupado && <p className="text-[11px] text-gray-500">{ocupado}</p>}
    </div>
  )
}

// ── propriedades da camada selecionada ───────────────────────────────────────────────────────────
type Caixa = Extract<NoCamada, { type: 'image' | 'solid' | 'text' | 'vshape' }>
const temCaixa = (n: NoCamada): n is Caixa => (n.type === 'image' && !n.matrix) || n.type === 'solid' || n.type === 'text' || n.type === 'vshape'
const FILTROS: { id: string; rotulo: string; ajustes: Record<string, unknown>[] }[] = [
  { id: 'nenhum', rotulo: 'Original', ajustes: [] },
  { id: 'vivo', rotulo: 'Vivo', ajustes: [{ type: 'vibrance', vibrance: 45, saturation: 10 }, { type: 'brightnessContrast', brightness: 4, contrast: 12 }] },
  { id: 'suave', rotulo: 'Suave', ajustes: [{ type: 'brightnessContrast', brightness: 10, contrast: -18 }, { type: 'hueSaturation', saturation: -15 }] },
  { id: 'quente', rotulo: 'Quente', ajustes: [{ type: 'colorBalance', midtones: [18, 4, -18] }] },
  { id: 'frio', rotulo: 'Frio', ajustes: [{ type: 'colorBalance', midtones: [-15, 0, 18] }] },
  { id: 'pb', rotulo: 'P&B', ajustes: [{ type: 'blackWhite' }] },
  { id: 'sepia', rotulo: 'Sépia', ajustes: [{ type: 'blackWhite', tint: '#b08a5a' }] },
  { id: 'vintage', rotulo: 'Vintage', ajustes: [{ type: 'curves', points: [[0, 30], [128, 125], [255, 230]] }, { type: 'hueSaturation', saturation: -25 }, { type: 'colorBalance', midtones: [10, 4, -10] }] },
]

function CampoNum({ rotulo, valor, onSalvar, sufixo }: { rotulo: string; valor: number; onSalvar: (v: number) => void; sufixo?: string }) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-7 shrink-0">{rotulo}</span>
      <input inputMode="decimal" defaultValue={String(r2(valor)).replace('.', ',')} key={valor} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (Number.isFinite(v)) onSalvar(v) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="w-full min-w-0 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs" data-campo-caixa={rotulo} />{sufixo}</label>
  )
}

/** Caixa (posição, tamanho, rotação), espelhar, alinhar à página, preencher/ajustar. */
export function PropsCaixa({ no }: { no: NoCamada }) {
  if (!temCaixa(no)) return null
  const p = paginaAtual()
  const ed = (label: string, f: (n: Caixa) => void, j?: string) => editarCamada(no.id, label, n => { if (temCaixa(n as NoCamada)) f(n as Caixa) }, j)
  const rot = no.type === 'solid' ? 0 : no.rotationDeg
  const alinhar = (h: 'l' | 'c' | 'r' | null, v: 't' | 'm' | 'b' | null) => ed('Alinhar à página', n => {
    if (h) n.xMm = r2(h === 'l' ? 0 : h === 'c' ? (p.widthMm - n.wMm) / 2 : p.widthMm - n.wMm)
    if (v) n.yMm = r2(v === 't' ? 0 : v === 'm' ? (p.heightMm - n.hMm) / 2 : p.heightMm - n.hMm)
  })
  const encaixar = (preencher: boolean) => ed(preencher ? 'Preencher a página' : 'Ajustar à página', n => {
    const k = (preencher ? Math.max : Math.min)(p.widthMm / n.wMm, p.heightMm / n.hMm)
    n.wMm = r2(n.wMm * k); n.hMm = r2(n.hMm * k); n.xMm = r2((p.widthMm - n.wMm) / 2); n.yMm = r2((p.heightMm - n.hMm) / 2)
    if (n.type !== 'solid') n.rotationDeg = 0
  })
  return (
    <div className="space-y-1.5" data-props-caixa>
      <div className="grid grid-cols-2 gap-1.5">
        <CampoNum rotulo="X" valor={no.xMm} onSalvar={v => ed('Mover', n => { n.xMm = v })} />
        <CampoNum rotulo="Y" valor={no.yMm} onSalvar={v => ed('Mover', n => { n.yMm = v })} />
        <CampoNum rotulo="L" valor={no.wMm} onSalvar={v => v > 0 && ed('Largura', n => { n.wMm = v })} />
        <CampoNum rotulo="A" valor={no.hMm} onSalvar={v => v > 0 && ed('Altura', n => { n.hMm = v })} />
        {no.type !== 'solid' && <CampoNum rotulo="Giro" valor={rot} onSalvar={v => ed('Girar', n => { if (n.type !== 'solid') n.rotationDeg = ((v % 360) + 540) % 360 - 180 })} sufixo="°" />}
      </div>
      <div className="flex flex-wrap items-center gap-0.5">
        <button className={ico} title="Alinhar à esquerda da página" onClick={() => alinhar('l', null)} data-alinhar="l"><AlignStartVertical className="w-3.5 h-3.5" /></button>
        <button className={ico} title="Centralizar na horizontal" onClick={() => alinhar('c', null)} data-alinhar="c"><AlignCenterVertical className="w-3.5 h-3.5" /></button>
        <button className={ico} title="Alinhar à direita" onClick={() => alinhar('r', null)}><AlignEndVertical className="w-3.5 h-3.5" /></button>
        <button className={ico} title="Alinhar ao topo" onClick={() => alinhar(null, 't')}><AlignStartHorizontal className="w-3.5 h-3.5" /></button>
        <button className={ico} title="Centralizar na vertical" onClick={() => alinhar(null, 'm')} data-alinhar="m"><AlignCenterHorizontal className="w-3.5 h-3.5" /></button>
        <button className={ico} title="Alinhar à base" onClick={() => alinhar(null, 'b')}><AlignEndHorizontal className="w-3.5 h-3.5" /></button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button className={ico} title="Preencher a página (cobre tudo)" onClick={() => encaixar(true)} data-preencher><Maximize2 className="w-3.5 h-3.5" /></button>
        <button className={ico} title="Ajustar à página (cabe inteira)" onClick={() => encaixar(false)}><Minimize2 className="w-3.5 h-3.5" /></button>
        {no.type === 'image' && (<>
          <button className={ico + (no.flipX ? ' text-orange-600' : '')} title="Espelhar ↔" onClick={() => editarCamada(no.id, 'Espelhar ↔', n => { if (n.type === 'image') n.flipX = !n.flipX })} data-espelhar-imagem="x"><FlipHorizontal2 className="w-3.5 h-3.5" /></button>
          <button className={ico + (no.flipY ? ' text-orange-600' : '')} title="Espelhar ↕" onClick={() => editarCamada(no.id, 'Espelhar ↕', n => { if (n.type === 'image') n.flipY = !n.flipY })}><FlipVertical2 className="w-3.5 h-3.5" /></button>
        </>)}
      </div>
    </div>
  )
}

/** Texto livre: conteúdo, fonte, tamanho, cor, alinhamento, caixa, espaçamento, contorno, recursos. */
export function PropsTexto({ no }: { no: NoTexto }) {
  const locais = useFontes(s => s.locais)
  const ed = (label: string, f: (n: NoTexto) => void, j?: string) => editarCamada(no.id, label, n => { if (n.type === 'text') f(n as NoTexto) }, j)
  type ItemFonte = { ps: string; family: string; source: 'local' | 'google' }
  const fontes: { grupo: string; itens: ItemFonte[] }[] = [{ grupo: 'Fontes do Google (festa)', itens: GOOGLE_FONTS.map(g => ({ ps: g.ps, family: g.family, source: 'google' })) },
    ...(locais.length ? [{ grupo: 'Deste computador', itens: locais.map((l): ItemFonte => ({ ps: l.ps, family: `${l.family}${l.style && l.style !== 'Regular' ? ` ${l.style}` : ''}`, source: 'local' })) }] : [])]
  return (
    <div className="space-y-1.5 text-xs" data-props-texto>
      <textarea value={no.valor} onChange={e => ed('Texto', n => { n.valor = e.target.value }, `txt:${no.id}`)} rows={3} className={inp} data-texto-valor aria-label="Texto" />
      <select value={no.font.postscriptName} onChange={e => { const f = fontes.flatMap(g => g.itens).find(x => x.ps === e.target.value); if (f) ed('Fonte', n => { n.font = { postscriptName: f.ps, family: f.family, source: f.source } }) }} className={inp} data-fonte-texto>
        {!fontes.some(g => g.itens.some(i => i.ps === no.font.postscriptName)) && <option value={no.font.postscriptName}>{no.font.family ?? no.font.postscriptName}</option>}
        {fontes.map(g => <optgroup key={g.grupo} label={g.grupo}>{g.itens.map(i => <option key={i.ps} value={i.ps}>{i.family}</option>)}</optgroup>)}
      </select>
      <div className="grid grid-cols-2 gap-1.5">
        <CampoNum rotulo="Pt" valor={no.tamanhoPt} onSalvar={v => v > 0 && ed('Tamanho do texto', n => { n.tamanhoPt = v })} />
        <label className="flex items-center gap-1 text-[11px] text-gray-500">Cor <input type="color" value={no.color} onChange={e => ed('Cor do texto', n => { n.color = e.target.value }, `cor:${no.id}`)} className="h-6 w-8" data-cor-texto /></label>
        <CampoNum rotulo="Esp." valor={no.tracking} onSalvar={v => ed('Espaçamento', n => { n.tracking = Math.max(-300, Math.min(1000, v)) })} />
        <CampoNum rotulo="Entr." valor={no.lineHeight} onSalvar={v => v > 0 && ed('Entrelinha', n => { n.lineHeight = Math.min(3, v) })} />
      </div>
      <div className="flex flex-wrap gap-1">
        {(['left', 'center', 'right'] as const).map(a => <button key={a} className={btn + (no.align === a ? ' !border-orange-500' : '')} onClick={() => ed('Alinhamento', n => { n.align = a })}>{a === 'left' ? 'Esq.' : a === 'center' ? 'Centro' : 'Dir.'}</button>)}
        {(['normal', 'alta', 'baixa', 'titulo'] as const).map(c => <button key={c} className={btn + (no.caixa === c ? ' !border-orange-500' : '')} onClick={() => ed('Maiúsculas/minúsculas', n => { n.caixa = c })} data-caixa-texto={c}>{c === 'normal' ? 'Aa' : c === 'alta' ? 'AA' : c === 'baixa' ? 'aa' : 'Título'}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1"><input type="checkbox" checked={!!no.stroke} onChange={e => ed('Contorno do texto', n => { if (e.target.checked) n.stroke = { color: '#ffffff', widthMm: 0.6 }; else delete n.stroke })} /> Contorno</label>
        {no.stroke && <><input type="color" value={no.stroke.color} onChange={e => ed('Cor do contorno', n => { if (n.stroke) n.stroke.color = e.target.value }, `stc:${no.id}`)} className="h-5 w-6" /><CampoNum rotulo="mm" valor={no.stroke.widthMm} onSalvar={v => v > 0 && ed('Contorno', n => { if (n.stroke) n.stroke.widthMm = v })} /></>}
        {(['swsh', 'salt', 'ss01'] as const).map(f => <label key={f} className="flex items-center gap-1" title={nomeOT(f)}><input type="checkbox" checked={no.features.includes(f)} onChange={e => ed(nomeOT(f), n => { n.features = e.target.checked ? [...n.features, f] : n.features.filter(x => x !== f) })} /> {nomeOT(f)}</label>)}
      </div>
    </div>
  )
}

/** Forma livre: preenchimento, contorno, cantos, lados/pontas. */
export function PropsForma({ no }: { no: NoFormaLivre }) {
  const ed = (label: string, f: (n: NoFormaLivre) => void, j?: string) => editarCamada(no.id, label, n => { if (n.type === 'vshape') f(n as NoFormaLivre) }, j)
  return (
    <div className="space-y-1.5 text-xs" data-props-forma>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1"><input type="checkbox" checked={no.color !== null} onChange={e => ed('Preenchimento', n => { n.color = e.target.checked ? '#f472b6' : null })} /> Preencher</label>
        {no.color && <input type="color" value={no.color} onChange={e => ed('Cor da forma', n => { n.color = e.target.value }, `cf:${no.id}`)} className="h-5 w-7" data-cor-forma-livre />}
        <label className="flex items-center gap-1"><input type="checkbox" checked={!!no.stroke} onChange={e => ed('Contorno', n => { n.stroke = e.target.checked ? { color: '#1f2937', widthMm: 0.8 } : null })} /> Contorno</label>
        {no.stroke && <><input type="color" value={no.stroke.color} onChange={e => ed('Cor do contorno', n => { if (n.stroke) n.stroke.color = e.target.value }, `cs:${no.id}`)} className="h-5 w-7" /><CampoNum rotulo="mm" valor={no.stroke.widthMm} onSalvar={v => v > 0 && ed('Espessura', n => { if (n.stroke) n.stroke.widthMm = v })} /></>}
      </div>
      {no.kind === 'rect' && <label className="block text-[11px] text-gray-500">Cantos arredondados<Deslizador min={0} max={0.5} step={0.01} value={no.params.radius} onChange={e => ed('Cantos', n => { n.params.radius = Number(e.target.value) }, `rad:${no.id}`)} unidade="%" fator={100} /></label>}
      {(no.kind === 'polygon' || no.kind === 'star') && <label className="block text-[11px] text-gray-500">{no.kind === 'star' ? 'Pontas' : 'Lados'} ({no.params.sides})<Deslizador min={3} max={24} step={1} value={no.params.sides} onChange={e => ed('Lados', n => { n.params.sides = Number(e.target.value) }, `lad:${no.id}`)} className="w-full accent-orange-500" /></label>}
      {no.kind === 'star' && <label className="block text-[11px] text-gray-500">Raio interno<Deslizador min={0.1} max={0.95} step={0.01} value={no.params.inner} onChange={e => ed('Raio interno', n => { n.params.inner = Number(e.target.value) }, `inn:${no.id}`)} unidade="%" fator={100} /></label>}
    </div>
  )
}

/** Imagem: filtros prontos, IA (remover fundo, apagar, expandir, aumentar resolução, recolorir) e editar pixels. */
export function PropsImagem({ no }: { no: NoImagem }) {
  const raiz = useBiblioteca(s => s.raiz)
  const [pixels, setPixels] = useState<null | 'mascara' | 'pintura' | 'deformar'>(null)
  const filtroAtual = FILTROS.find(f => JSON.stringify((no.adjustments ?? []).map(a => a.type)) === JSON.stringify(f.ajustes.map(a => a.type)))?.id ?? (no.adjustments?.length ? '' : 'nenhum')
  const aspecto = no.matrix ? undefined : no.wMm / no.hMm
  async function fonteCanvas(): Promise<HTMLCanvasElement | null> {
    if (!raiz) return null
    const i = await infoImagem(raiz, no.src.path)
    if (!i.bitmap) return null
    const c = document.createElement('canvas'); c.width = i.bitmap.width; c.height = i.bitmap.height
    c.getContext('2d')!.drawImage(i.bitmap, 0, 0)
    return c
  }
  const [fonteIA, setFonteIA] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => { let vivo = true; void fonteCanvas().then(c => { if (vivo) setFonteIA(c) }); return () => { vivo = false } }, [no.src.sha256, raiz]) // eslint-disable-line react-hooks/exhaustive-deps

  async function resultadoIA(r: ResultadoIA) {
    if (!raiz) return
    const blob = await new Promise<Blob>(ok => r.canvas.toBlob(b => ok(b!), 'image/png'))
    const sha = await sha256(blob)
    const path = `Elementos/ia/${slugArquivo(`${no.name}-${r.nome}`, 50)}-${sha.slice(0, 8)}.png`
    await gravar(raiz, path, blob)
    await motorDaPagina().enviarBitmap(sha, blob)
    const m = r.modo === 'expandido' ? (r.margem ?? 0) : 0
    const nova = novaImagem({ path, sha256: sha, name: `${no.name} · ${r.nome}`, xMm: r2(no.xMm - no.wMm * m), yMm: r2(no.yMm - no.hMm * m), wMm: r2(no.wMm * (1 + 2 * m)), hMm: r2(no.hMm * (1 + 2 * m)) })
    adicionarCamada({ ...nova, rotationDeg: no.rotationDeg, flipX: no.flipX, flipY: no.flipY } as NoImagem, `IA: ${r.nome}`)
  }

  async function aplicarPixels(r: ResultadoPixels) {
    if (r.modo === 'deformar') { editarCamada(no.id, 'Deformar', n => { if (n.type === 'image') { if (r.warp) n.warp = r.warp; else delete n.warp } }); return }
    if (r.mask) {
      const m = r.mask
      editarCamada(no.id, 'Editar máscara', n => {
        n.mask = { enabled: true, invert: m.invert, featherMm: n.mask?.featherMm ?? 0, ...(m.gradient ? { gradient: { ...m.gradient, matrix: [1, 0, 0, 1, 0, 0] } } : {}), ...(m.raster ? { raster: { src: m.raster, matrix: [1, 0, 0, 1, 0, 0] } } : {}) }
      })
    }
    if (r.pintura) adicionarCamada({ ...novaImagem({ path: r.pintura.path, sha256: r.pintura.sha256, name: 'Pintura', xMm: no.xMm, yMm: no.yMm, wMm: no.wMm, hMm: no.hMm }), rotationDeg: no.rotationDeg, flipX: no.flipX, flipY: no.flipY } as NoImagem, 'Pintura')
  }

  return (
    <div className="space-y-2 text-xs" data-props-imagem>
      <div>
        <p className="text-[11px] font-medium text-gray-500 mb-0.5">Filtros</p>
        <div className="flex flex-wrap gap-1">
          {FILTROS.map(f => <button key={f.id} className={btn + (filtroAtual === f.id ? ' !border-orange-500' : '')} onClick={() => editarCamada(no.id, `Filtro: ${f.rotulo}`, n => { n.adjustments = f.ajustes.map(a => Ajuste.parse(a)) })} data-filtro={f.id}>{f.rotulo}</button>)}
        </div>
      </div>
      {!no.matrix && (
        <div className="flex flex-wrap gap-1">
          <button className={btn} onClick={() => setPixels('mascara')} data-pixels-imagem="mascara"><Brush className="w-3 h-3" /> Máscara / seleção…</button>
          <button className={btn} onClick={() => setPixels('pintura')} data-pixels-imagem="pintura"><Brush className="w-3 h-3" /> Pintar…</button>
          <button className={btn} onClick={() => setPixels('deformar')} data-pixels-imagem="deformar">Distorcer / perspectiva / malha…</button>
        </div>
      )}
      {fonteIA && <PainelIA fonte={() => fonteIA} obterSelecao={() => null} onResultado={r => { void resultadoIA(r) }} />}
      {pixels && <EditorPixels modoInicial={pixels} onFechar={() => setPixels(null)} onAplicar={aplicarPixels}
        fonte={{ path: no.src.path, aspect: aspecto, name: no.name, warp: no.warp ?? null,
          mask: no.mask ? { invert: no.mask.invert, featherMm: no.mask.featherMm, gradient: no.mask.gradient ? { ...no.mask.gradient } : null, ...(no.mask.raster ? { raster: no.mask.raster.src } : {}) } : null }} />}
    </div>
  )
}

// ── exportar (editor de imagem) ─────────────────────────────────────────────────────────────────
type Formato = 'png' | 'jpg' | 'webp' | 'pdf'
export function ExportarImagem() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const doc = useMaeDoc(s => s.hist.atual)
  const [paginas, setPaginas] = useState<'atual' | 'todas'>('todas')
  const [tamanho, setTamanho] = useState('original')
  const [modoTam, setModoTam] = useState<'encaixar' | 'preencher'>('encaixar')
  const [fundo, setFundo] = useState('#ffffff')
  const [formato, setFormato] = useState<Formato>('png')
  const [nuvem, setNuvem] = useState(false)
  const [rodando, setRodando] = useState<string | null>(null)
  const [res, setRes] = useState<{ arquivos: string[]; nuvem: number; erro?: string } | null>(null)

  async function renderPagina(ab: Prancheta): Promise<HTMLCanvasElement> {
    await garantirFontes(fontesDosTextos(ab.layers ?? []), raiz)
    const layers = materializar(ab.layers ?? [], registroFontes)
    const p: Prancheta = { ...ab, layers }
    await garantirArquivos(p, raiz)
    const alvo = tamanho === 'original' ? null : TAMANHOS_CANAIS.find(t => t.id === tamanho)!
    // original: 300 dpi; marketplace: o tamanho em px do canal, encaixado ou preenchido
    const k = alvo ? (modoTam === 'preencher' ? Math.max : Math.min)(alvo.largura / ab.widthMm, alvo.altura / ab.heightMm) : 300 / 25.4
    const r = await motorDaPagina().render(p, k, formato === 'png' || formato === 'webp' ? null : '#ffffff', 'png')
    const bmp = await createImageBitmap(r.png!)
    const W = alvo?.largura ?? bmp.width, H = alvo?.altura ?? bmp.height
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d')!
    if (alvo && (formato === 'jpg' || formato === 'pdf' || modoTam === 'encaixar')) { g.fillStyle = fundo; g.fillRect(0, 0, W, H) }
    g.drawImage(bmp, Math.round((W - bmp.width) / 2), Math.round((H - bmp.height) / 2)); bmp.close()
    return c
  }

  async function exportar() {
    if (!raiz) return
    setRes(null)
    try {
      const abs = paginas === 'atual' ? [paginaAtual()] : doc.artboards
      const pasta = pastaExportacao(new Date())
      const existentes = new Set((await listar(raiz, pasta).catch(() => [])).map(e => e.nome))
      const base = slugArquivo(doc.name || 'design', 50)
      const nomeDe = (suf: string, ext: string) => { const n = nomeLivre(`${base}${suf}_${dataIso(new Date())}.${ext}`, existentes); existentes.add(n); return n }
      const saidas: { nome: string; blob: Blob }[] = []
      if (formato === 'pdf') {
        const { PDFDocument } = await import('pdf-lib')
        const pdf = await PDFDocument.create()
        for (const [i, ab] of abs.entries()) {
          setRodando(`Página ${i + 1} de ${abs.length}…`)
          const c = await renderPagina(ab)
          const jpg = new Uint8Array(await (await new Promise<Blob>(ok => c.toBlob(b => ok(b!), 'image/jpeg', 0.95))).arrayBuffer())
          const img = await pdf.embedJpg(jpg)
          // página no tamanho real (mm) do design
          const pg = pdf.addPage([ab.widthMm * 72 / 25.4, ab.heightMm * 72 / 25.4])
          pg.drawImage(img, { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() })
        }
        saidas.push({ nome: nomeDe('', 'pdf'), blob: new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' }) })
      } else {
        for (const [i, ab] of abs.entries()) {
          setRodando(`Página ${i + 1} de ${abs.length}…`)
          const c = await renderPagina(ab)
          const mime = formato === 'jpg' ? 'image/jpeg' : formato === 'webp' ? 'image/webp' : 'image/png'
          let blob = await new Promise<Blob>(ok => c.toBlob(b => ok(b!), mime, 0.92))
          if (formato === 'png' && tamanho === 'original') blob = new Blob([comPhys(new Uint8Array(await blob.arrayBuffer()), 300) as BlobPart], { type: 'image/png' })
          saidas.push({ nome: nomeDe(abs.length > 1 ? `_p${doc.artboards.indexOf(ab) + 1}` : '', formato === 'jpg' ? 'jpg' : formato), blob })
        }
      }
      const arquivos: string[] = []
      for (const s of saidas) { await gravar(raiz, `${pasta}/${s.nome}`, s.blob); arquivos.push(`${pasta}/${s.nome}`) }
      let nNuvem = 0
      if (nuvem) {
        setRodando('Guardando em Meus arquivos…')
        const ss = await getSession()
        const ws = ss?.user?.workspaceId
        if (!ws) throw new Error('Sem sessão para guardar em Meus arquivos.')
        const { enviarArquivo } = await import('@/lib/estudio/cliente')
        for (const s of saidas) { await enviarArquivo(new File([s.blob], s.nome, { type: s.blob.type }), s.nome, 'imagem', ws, { pasta: 'Editor de imagem (MAE)' }); nNuvem++ }
      }
      setRes({ arquivos, nuvem: nNuvem })
    } catch (e) { setRes({ arquivos: [], nuvem: 0, erro: (e as Error).message }) } finally { setRodando(null) }
  }

  return (
    <section className="space-y-2" data-exportar-imagem>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Exportar</h2>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <select value={paginas} onChange={e => setPaginas(e.target.value as 'atual' | 'todas')} className={inp}><option value="todas">Todas as páginas</option><option value="atual">Só a página atual</option></select>
        <select value={formato} onChange={e => setFormato(e.target.value as Formato)} className={inp} data-formato-imagem><option value="png">PNG (transparente)</option><option value="jpg">JPG</option><option value="webp">WebP</option><option value="pdf">PDF (páginas juntas, tamanho real)</option></select>
        <select value={tamanho} onChange={e => setTamanho(e.target.value)} className={`${inp} col-span-2`} data-tamanho-exportar>
          <option value="original">Tamanho original (300 dpi)</option>
          {TAMANHOS_CANAIS.map(t => <option key={t.id} value={t.id}>{t.canal} · {t.rotulo} ({t.largura}×{t.altura})</option>)}
        </select>
        {tamanho !== 'original' && (<>
          <select value={modoTam} onChange={e => setModoTam(e.target.value as 'encaixar' | 'preencher')} className={inp}><option value="encaixar">Encaixar (com fundo)</option><option value="preencher">Preencher (corta)</option></select>
          <label className="flex items-center gap-1 text-[11px]">Fundo <input type="color" value={fundo} onChange={e => setFundo(e.target.value)} className="h-6 w-8" /></label>
        </>)}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" className="accent-orange-500" checked={nuvem} onChange={e => setNuvem(e.target.checked)} data-guardar-nuvem /><Cloud className="w-3.5 h-3.5" /> Guardar também em Meus arquivos (nuvem)</label>
      <button className={btn + ' w-full justify-center !py-1.5 bg-orange-500 text-white !border-orange-500'} disabled={!liberada || !!rodando} onClick={exportar} data-exportar-design>
        {rodando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} {rodando ?? 'Exportar'}
      </button>
      {res && (res.erro
        ? <p className="text-xs text-red-600" data-erro-exportar-imagem>{res.erro}</p>
        : <div className="text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5" data-resultado-exportar-imagem>
            <p className="text-emerald-700 font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {res.arquivos.length} arquivo(s) na Biblioteca{res.nuvem ? ` · ${res.nuvem} em Meus arquivos` : ''}</p>
            {res.arquivos.map(a => <p key={a} className="break-all" data-arquivo-imagem>{a.split('/').pop()}</p>)}
          </div>)}
    </section>
  )
}

export { temCaixa, acharCamada, MODOS_MESCLAGEM }
