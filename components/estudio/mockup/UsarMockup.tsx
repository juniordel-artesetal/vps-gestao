'use client'
// SOA Design — USAR MOCKUP (o dia a dia; a ÚNICA porta de gerar). Em massa (Fase 2):
//  1) IMPORTAR: vários arquivos ou a PASTA inteira (arrastar) → lê (miniatura) → analisa (hash do conteúdo + produto);
//  2) PRODUTO: 1 mockup escolhido → tudo vai nele; vários → o matcher decide pelo nome/apelido/pasta/histórico (confiança);
//  3) FACE: cada arte cai na face certa pelo nome (vinculação semântica) — 1 foto por tema;
//  4) CONFERÊNCIA só das exceções (produto não reconhecido/empate, face sem arte…): corrigir, ignorar, gerar parcial;
//  5) FILA em segundo plano (dá para usar o SOA enquanto gera) + CACHE (o que não mudou não re-renderiza nem cobra).
// As artes ficam como ARQUIVO (não imagem aberta) — 300 artes cabem na memória; cada uma é aberta só na hora de desenhar.
'use no memo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Upload, Check, Trash2, AlertTriangle, ChevronDown, ChevronRight, Move, FolderOpen, Layers } from 'lucide-react'
import { blobDe, nomeArquivo, novoCanvas, carregarImagem, comporMockup } from '@/lib/estudio/mockup'
import { Autorizador, SemCota, carregarMolde, exigirSaldo, enviarArquivo } from '@/lib/estudio/cliente'
import { TAMANHOS_CANAIS } from '@/lib/estudio/tamanhos'
import type { ConfigCena } from '@/lib/estudio/mockupTipos'
import { comporAreas, contornoDaArea, proporcaoDaArea, TRANSFORM_PADRAO, type AreaDeArte, type TransformArte } from '@/lib/estudio/mockupFoto'
import { agruparArtes, type GrupoVinculo } from '@/lib/estudio/vinculo'
import { casarProduto, hashArquivo, hashTexto, lembrarCorrecao, lerHistorico, palavrasDoProduto, type ProdutoMatch } from '@/lib/estudio/matcher'
import { CENAS_PRONTAS, CATEGORIAS_CENA, cenaPronta } from '@/lib/estudio/cenasProntas'
import { criarJob, custo, assinar, versaoFila } from '@/lib/estudio/filaMockups'
import type { MockupPronto } from '@/lib/estudio/mockupCliente'
import AlcasArte from './AlcasArte'
import { sugerirCasamentosIA } from '@/lib/estudio/iaCliente'
import { renderSaida } from '@/lib/estudio/saidaMockup'
import CotaBarra from '../CotaBarra'
import { inp, lbl, btn, btnP, cartao, useBaseEstudio } from '../caixas/comum'

type Arte = { id: string; nome: string; caminho: string; pasta: string; file: File; hash: string; mini: string; w: number; h: number }
type Salvo = { id: string; nome: string; valor: ConfigCena }
type Escolha = string | 'lisa'
const LADO_PREVIA = 1000, LADO_ARTE = 2400, VISIVEIS = 60
const ACEITOS = /\.(png|jpe?g|webp|gif|bmp|svg|pdf|psd)$/i
const reduzir = (src: HTMLCanvasElement, lado: number) => { const k = Math.min(1, lado / Math.max(src.width, src.height)), c = novoCanvas(src.width * k, src.height * k); c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c }
const json = (v: unknown) => (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return null } })() : v) as Record<string, unknown> | null
export const apelidosDe = (m: MockupPronto) => ((json(m.linha?.config)?.aliases as string[] | undefined) || [])
const semExt = (n: string) => n.replace(/\.[^.]+$/, '')
const previas = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
const basePrevia = (foto: HTMLCanvasElement) => { let c = previas.get(foto); if (!c) { c = reduzir(foto, LADO_PREVIA); previas.set(foto, c) } return c }

// artes abertas sob demanda (poucas por vez)
const abertas = new Map<string, Promise<HTMLCanvasElement>>()
function abrirArte(a: Arte): Promise<HTMLCanvasElement> {
  let p = abertas.get(a.id)
  if (!p) {
    p = carregarMolde(a.file).then(m => { const k = Math.min(1, LADO_ARTE / Math.max(m.largura, m.altura)), c = novoCanvas(m.largura * k, m.altura * k); c.getContext('2d')!.drawImage(m.fonte as CanvasImageSource, 0, 0, c.width, c.height); return c })
    abertas.set(a.id, p)
    while (abertas.size > 10) abertas.delete(abertas.keys().next().value as string)
  }
  return p
}
/** Pasta arrastada: percorre as subpastas (webkitGetAsEntry). */
async function arquivosDoArraste(dt: DataTransfer): Promise<{ file: File; caminho: string }[]> {
  const out: { file: File; caminho: string }[] = []
  const entradas = [...dt.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[]
  if (!entradas.length) return [...dt.files].map(f => ({ file: f, caminho: f.name }))
  const andar = async (e: FileSystemEntry, pre: string): Promise<void> => {
    if (e.isFile) { const f = await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej)); out.push({ file: f, caminho: pre + f.name }); return }
    const leitor = (e as FileSystemDirectoryEntry).createReader()
    for (;;) {
      const lote = await new Promise<FileSystemEntry[]>((res, rej) => leitor.readEntries(res, rej))
      if (!lote.length) break
      for (const x of lote) await andar(x, `${pre}${e.name}/`)
    }
  }
  for (const e of entradas) await andar(e, '')
  return out
}

export default function UsarMockup({ mockups, cenas, inicial, cenaInicial }: { mockups: MockupPronto[]; cenas: Salvo[]; inicial?: string | null; cenaInicial?: string | null }) {
  const { workspaceId, storage } = useBaseEstudio()
  const [artes, setArtes] = useState<Arte[]>([])
  const [importando, setImportando] = useState<{ fase: string; feitos: number; total: number } | null>(null)
  const [ignoradosArq, setIgnoradosArq] = useState(0)
  const idInicial = inicial?.split('#')[0] || null
  const [sel, setSel] = useState<string[]>(idInicial ? [idInicial] : mockups.length === 1 ? [mockups[0].id] : [])
  const [modoMulti, setModoMulti] = useState<'separar' | 'todos'>('separar')
  const [produtoEscolha, setProdutoEscolha] = useState<Record<string, string>>({})
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({})
  const [conferidos, setConferidos] = useState<Record<string, boolean>>({})
  const [ignorados, setIgnorados] = useState<Record<string, boolean>>({})
  const [ajustes, setAjustes] = useState<Record<string, TransformArte>>({})
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [verOk, setVerOk] = useState(false); const [verTodasArtes, setVerTodasArtes] = useState(false)
  const [previa, setPrevia] = useState<{ mid: string; gid: string } | null>(null)
  const [areaSel, setAreaSel] = useState<string | null>(null)
  const [cenaId, setCenaId] = useState(cenaInicial || 'nenhuma')
  const [formato, setFormato] = useState<'jpg' | 'png'>('jpg')
  const [canal, setCanal] = useState('original')
  const [regraNome, setRegraNome] = useState('{tema}_{mockup}')
  const [guardar, setGuardar] = useState(false)
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [cotaTick, setCotaTick] = useState(0); const [faltam, setFaltam] = useState(0)
  const [, setVersao] = useState(0)
  const [sugestoesIA, setSugestoesIA] = useState<Record<string, { alvo: string; confianca: number }>>({})
  const [iaOcupada, setIaOcupada] = useState(false)
  const palcoRef = useRef<HTMLDivElement>(null)
  const previaRef = useRef<HTMLCanvasElement>(null)
  const finalRef = useRef<HTMLCanvasElement>(null)
  const [arrastando, setArrastando] = useState(false)

  useEffect(() => assinar(() => setVersao(versaoFila())), [])   // o custo (cache) muda quando a fila termina
  useEffect(() => { if (cenaInicial) Promise.resolve().then(() => setCenaId(cenaInicial)) }, [cenaInicial])
  // "Usar este mockup" (Criar/Biblioteca): passa a usar só ele
  useEffect(() => { if (idInicial) Promise.resolve().then(() => setSel([idInicial])) }, [inicial]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1) IMPORTAR ──
  async function importar(lista: { file: File; caminho: string }[]) {
    setErro(''); setAviso('')
    const bons = lista.filter(x => ACEITOS.test(x.file.name) && !x.file.name.startsWith('.'))
    setIgnoradosArq(n => n + (lista.length - bons.length))
    if (!bons.length) { setErro('Nenhuma imagem nesses arquivos (aceito PNG, JPG, WEBP, SVG, PDF e PSD).'); return }
    const novas: Arte[] = []
    setImportando({ fase: 'Lendo as artes', feitos: 0, total: bons.length })
    for (let i = 0; i < bons.length; i++) {
      const { file, caminho } = bons[i]
      try {
        let w = 0, h = 0, mini = ''
        const c = novoCanvas(1, 1)
        if (/^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type)) {
          const bm = await createImageBitmap(file); w = bm.width; h = bm.height
          const k = 96 / Math.max(w, h); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); c.getContext('2d')!.drawImage(bm, 0, 0, c.width, c.height); bm.close()
        } else {
          const m = await carregarMolde(file); w = m.largura; h = m.altura
          const k = 96 / Math.max(w, h); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); c.getContext('2d')!.drawImage(m.fonte as CanvasImageSource, 0, 0, c.width, c.height)
        }
        mini = c.toDataURL('image/png')
        const partes = caminho.split('/'); partes.pop()
        novas.push({ id: Math.random().toString(36).slice(2) + Date.now().toString(36) + i, nome: semExt(file.name), caminho: semExt(caminho), pasta: partes.join('/'), file, hash: '', mini, w, h })
      } catch { setErro(e => `${e ? e + ' ' : ''}Não abri “${file.name}”.`) }
      if (i % 4 === 3 || i === bons.length - 1) { setImportando({ fase: 'Lendo as artes', feitos: i + 1, total: bons.length }); await new Promise(r => setTimeout(r, 0)) }
    }
    setImportando({ fase: 'Analisando (conteúdo + produto)', feitos: 0, total: novas.length })
    for (let i = 0; i < novas.length; i++) {
      novas[i].hash = await hashArquivo(novas[i].file)
      if (i % 10 === 9 || i === novas.length - 1) { setImportando({ fase: 'Analisando (conteúdo + produto)', feitos: i + 1, total: novas.length }); await new Promise(r => setTimeout(r, 0)) }
    }
    setArtes(a => [...a, ...novas]); setImportando(null)
  }

  // ── 2) PRODUTO de cada arte ──
  const escolhidos = mockups.filter(m => sel.includes(m.id))
  // (cálculos baratos — 300 nomes casam em poucos ms; sem memorização manual por causa do React Compiler)
  const produtos: ProdutoMatch[] = escolhidos.map(m => ({ id: m.id, nome: m.nome, apelidos: apelidosDe(m), proporcao: m.smart ? proporcaoDaArea(m.smart.cfg.areas[0].area, m.smart.foto.width, m.smart.foto.height) : null }))
  const historico = lerHistorico()
  const produtoDe = (() => {
    const out = new Map<string, { mockupId: string | null; confianca: number; motivo: string; empate?: string[] }>()
    for (const a of artes) out.set(a.id, escolhidos.length > 1 && modoMulti === 'todos' ? { mockupId: null, confianca: 1, motivo: 'todas' } : casarProduto(`${a.pasta ? a.pasta + '/' : ''}${a.nome}`, produtos, { historico, proporcaoArte: a.w / Math.max(1, a.h) }))
    return out
  })()
  const destinoDe = (a: Arte): string | 'ignorar' | null => {
    const o = produtoEscolha[a.id]; if (o) return o
    const r = produtoDe.get(a.id)
    return r && r.mockupId && r.confianca >= 0.7 && !r.empate ? r.mockupId : null
  }
  const excecoesProduto = escolhidos.length > 1 && modoMulti === 'separar' ? artes.filter(a => destinoDe(a) === null) : []

  // ── 3) FACES: grupos (1 foto cada) por mockup ──
  const porId = new Map(artes.map(a => [a.id, a]))
  const grupos = (() => {
    const out = new Map<string, GrupoVinculo[]>()
    for (const m of escolhidos) {
      const doMockup = escolhidos.length > 1 && modoMulti === 'todos' ? artes : artes.filter(a => destinoDe(a) === m.id)
      const vs = doMockup.map(a => ({ id: a.id, nome: a.nome, pasta: a.pasta }))
      const pal = `${palavrasDoProduto({ id: m.id, nome: m.nome, apelidos: apelidosDe(m) })} cx`
      out.set(m.id, m.smart ? agruparArtes(vs, m.smart.cfg.areas, pal) : doMockup.map(a => ({ id: `g_${a.id}`, tema: a.nome, porArea: {}, principal: a.id, avisos: [], confianca: 1 })))
    }
    return out
  })()
  const chave = (mid: string, gid: string, aid?: string) => `${mid}|${gid}${aid ? `|${aid}` : ''}`
  const arteDe = (m: MockupPronto, g: GrupoVinculo, a: AreaDeArte): Arte | null => {
    const e = escolhas[chave(m.id, g.id, a.id)]
    if (e === 'lisa') return null
    const id = e || g.porArea[a.id] || g.principal
    return (id && porId.get(id)) || null
  }
  const pendente = (m: MockupPronto, g: GrupoVinculo) => g.avisos.length > 0 && !conferidos[chave(m.id, g.id)]
  const todosItens = escolhidos.flatMap(m => (grupos.get(m.id) || []).filter(g => !ignorados[chave(m.id, g.id)]).map(g => ({ m, g })))
  const pendentes = todosItens.filter(({ m, g }) => pendente(m, g))
  const casados = todosItens.filter(({ m, g }) => !pendente(m, g))

  // ── cena / saída ──
  const cfgCena = (): ConfigCena | null | 'nenhuma' => cenaId === 'nenhuma' ? 'nenhuma' : cenaId === 'transparente' ? null : cenaPronta(cenaId)?.cena || cenas.find(c => c.id === cenaId)?.valor || null
  const saida = (m: MockupPronto, composto: HTMLCanvasElement, cf: ConfigCena | null | 'nenhuma', imgs: Map<string, HTMLImageElement>) => (m.smart ? renderSaida(m.smart.cfg, composto, cf, canal, imgs) : renderSaida(null, composto, cf, canal, imgs))
  async function compor(m: MockupPronto, artesPorArea: Record<string, Arte | null>, principal: Arte | null, transforms: Record<string, TransformArte | undefined>, base?: HTMLCanvasElement): Promise<HTMLCanvasElement | null> {
    if (m.smart) {
      const cvs = new Map<string, HTMLCanvasElement>()
      for (const a of Object.values(artesPorArea)) if (a && !cvs.has(a.id)) cvs.set(a.id, await abrirArte(a))
      return comporAreas(base || m.smart.foto, m.smart.cfg, a => { const x = artesPorArea[a.id]; return x ? cvs.get(x.id) || null : null }, a => transforms[a.id])
    }
    if (!principal) return null
    const cv = await abrirArte(principal)
    return m.compor ? m.compor(cv) : comporMockup(m.produto, cv, m.cfg)
  }
  const planoDe = (m: MockupPronto, g: GrupoVinculo) => {
    const areas = m.smart?.cfg.areas.filter(a => !a.oculta) || []
    const artesPorArea = Object.fromEntries(areas.map(a => [a.id, arteDe(m, g, a)]))
    const transforms = Object.fromEntries(areas.map(a => [a.id, ajustes[chave(m.id, g.id, a.id)]]))
    const principal = g.principal ? porId.get(g.principal) || null : null
    return { artesPorArea, transforms, principal }
  }
  /** Chave de cache = hash de TODAS as dependências do item. */
  const chaveCache = (m: MockupPronto, g: GrupoVinculo) => {
    const p = planoDe(m, g)
    const assin = m.smart ? hashTexto(JSON.stringify([m.smart.cfg.areas.map(a => [a.id, a.area, a.transform, a.oculta]), m.smart.cfg.real, m.smart.cfg.fundo, m.smart.cfg.mascara])) : ''
    return hashTexto(JSON.stringify([m.id, String(m.linha?.fotoUrl || m.linha?.recorteUrl || ''), assin, Object.entries(p.artesPorArea).map(([k, a]) => [k, a?.hash || null]), p.transforms, p.principal?.hash || null, cenaId, cenaId.startsWith('liso') || cenaPronta(cenaId) ? '' : JSON.stringify(cenas.find(c => c.id === cenaId)?.valor || ''), formato, canal]))
  }

  // ── prévia (baixa resolução; a exportação sai em alta) ──
  const alvo = previa && escolhidos.find(m => m.id === previa.mid)
  const gAlvo = alvo ? (grupos.get(alvo.id) || []).find(g => g.id === previa!.gid) || null : null
  const basePrev = alvo?.smart ? basePrevia(alvo.smart.foto) : null
  useEffect(() => {
    let vivo = true
    const cv = previaRef.current, fin = finalRef.current
    if (!cv || !alvo || !gAlvo) return
    const p = planoDe(alvo, gAlvo)
    compor(alvo, p.artesPorArea, p.principal, p.transforms, basePrev || undefined).then(r => {
      if (!vivo) return
      const img = r || (alvo.smart ? basePrev : alvo.produto)
      if (!img) return
      cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d')!; g.clearRect(0, 0, img.width, img.height); g.drawImage(img, 0, 0)
      if (fin && r) { const cf = cfgCena(); const o = saida(alvo, r, cf, new Map()); const k = 240 / Math.max(o.width, o.height); fin.width = Math.round(o.width * k); fin.height = Math.round(o.height * k); fin.getContext('2d')!.drawImage(o, 0, 0, fin.width, fin.height) }
    }).catch(() => {})
    return () => { vivo = false }
  }, [alvo, gAlvo, basePrev, JSON.stringify(ajustes), JSON.stringify(escolhas), artes, cenaId, canal]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (previa && todosItens.some(i => i.m.id === previa.mid && i.g.id === previa.gid)) return
    const i = todosItens[0]
    Promise.resolve().then(() => { setPrevia(i ? { mid: i.m.id, gid: i.g.id } : null); setAreaSel(null) })
  }, [todosItens.map(i => i.m.id + i.g.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5) GERAR → fila ──
  function nomeSaida(tema: string, m: MockupPronto, n: number, usados: Set<string>, ext: string) {
    const hoje = new Date().toISOString().slice(0, 10)
    const base = nomeArquivo(regraNome.replace(/\{tema\}/g, tema || 'arte').replace(/\{mockup\}/g, m.nome).replace(/\{n\}/g, String(n).padStart(3, '0')).replace(/\{data\}/g, hoje)) || `mockup_${n}`
    let nome = `${base}.${ext}`, k = 2
    while (usados.has(nome)) nome = `${base}_${k++}.${ext}`
    usados.add(nome); return nome
  }
  const extSaida = () => (cenaId === 'transparente' ? 'png' : formato)
  const itensParaGerar = (incluirPendentes: boolean) => (incluirPendentes ? todosItens : casados)
  const chavesDe = (lista: typeof todosItens) => lista.map(({ m, g }) => chaveCache(m, g))

  async function gerar(incluirPendentes: boolean) {
    setErro(''); setAviso('')
    const lista = itensParaGerar(incluirPendentes)
    if (!lista.length) { setErro('Nada para gerar: escolha o mockup e suba as artes.'); return }
    if (pendentes.length && !incluirPendentes && !casados.length) { setErro('Todas as fotos estão com pendência — confira acima.'); return }
    const chaves = chavesDe(lista), cobrar = custo(chaves)
    try { await exigirSaldo(cobrar) } catch (e) { if (e instanceof SemCota) { setErro(e.message); setFaltam(e.faltam) } else setErro((e as Error).message); return }
    const cf = cfgCena()
    const imgs = new Map<string, HTMLImageElement>()
    if (cf && cf !== 'nenhuma' && cf.fundo.tipo === 'foto') { const im = await carregarImagem(cf.fundo.url).catch(() => null); if (im) imgs.set(cf.fundo.url, im) }
    // o job leva uma FOTO do estado atual (mexer na tela depois não muda o que já está na fila)
    const usados = new Set<string>(), ext = extSaida(), hoje = new Date().toISOString().slice(0, 10)
    const planos = new Map<string, { m: MockupPronto; plano: ReturnType<typeof planoDe> }>()
    const itens = lista.map(({ m, g }, n) => {
      const id = chave(m.id, g.id)
      planos.set(id, { m, plano: planoDe(m, g) })
      return { id, rotulo: `${g.tema}${escolhidos.length > 1 ? ` · ${m.nome}` : ''}`, arquivo: nomeSaida(g.tema, m, n + 1, usados, ext), chave: chaves[n] }
    })
    const ws = workspaceId, guardarNoBlob = guardar && storage && ws
    criarJob({
      nome: `${escolhidos.length === 1 ? escolhidos[0].nome : `${escolhidos.length} mockups`} · ${itens.length} foto(s)`,
      nomeZip: `${nomeArquivo(escolhidos.length === 1 ? escolhidos[0].nome : 'mockups')}-${hoje}.zip`,
      itens,
      autorizar: n => { const a = new Autorizador(n); return { lote: a.lote, garantir: i => a.garantir(i) } },
      ehSemCota: e => e instanceof SemCota,
      render: async (it, { lote }) => {
        const pl = planos.get(it.id)!
        const r = await compor(pl.m, pl.plano.artesPorArea, pl.plano.principal, pl.plano.transforms)
        if (!r) throw new Error('nenhuma arte para este item')
        const out = saida(pl.m, r, cf, imgs)
        const b = await blobDe(out, ext === 'png' ? 'image/png' : 'image/jpeg', 0.93)
        if (guardarNoBlob) await enviarArquivo(b, it.arquivo, 'gerado', ws!, { pasta: `Mockups/${hoje}`, lote })
        return b
      },
    })
    setCotaTick(x => x + 1)
    setAviso(`${itens.length} foto(s) na fila${cobrar < itens.length ? ` (${itens.length - cobrar} já estavam prontas — não cobram de novo)` : ''}. Pode continuar usando o SOA: o painel da fila (canto inferior esquerdo) mostra o progresso e o ZIP no fim.`)
  }

  const aplicarEnquadramentoEmTodos = (m: MockupPronto, aid: string, t: TransformArte) => setAjustes(x => { const y = { ...x }; for (const g of grupos.get(m.id) || []) y[chave(m.id, g.id, aid)] = t; return y })
  const areaAlvo = alvo?.smart?.cfg.areas.find(a => a.id === areaSel) || null
  const arteAlvo = alvo && gAlvo && areaAlvo ? arteDe(alvo, gAlvo, areaAlvo) : null
  const chavesTodos = chavesDe(todosItens), cobrarTodos = custo(chavesTodos)
  const cobrarCasados = custo(chavesDe(casados))

  const linhaGrupo = (m: MockupPronto, g: GrupoVinculo) => {
    const k = chave(m.id, g.id), pend = pendente(m, g), aberto = abertos[k] ?? pend
    const ativo = previa?.mid === m.id && previa.gid === g.id
    const areasM = m.smart?.cfg.areas.filter(a => !a.oculta) || []
    return (
      <div key={k} data-grupo={g.tema} data-pendente={pend ? '1' : '0'} className={`rounded-lg border text-xs ${pend ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/20' : ativo ? 'border-orange-300' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button onClick={() => setAbertos(x => ({ ...x, [k]: !aberto }))}>{aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</button>
          {pend ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
          <button onClick={() => { setPrevia({ mid: m.id, gid: g.id }); setAreaSel(null) }} className="flex-1 text-left font-medium truncate">{g.tema}{escolhidos.length > 1 ? <span className="font-normal text-gray-400"> · {m.nome}</span> : null}</button>
          {m.smart && <span className="text-gray-400">{areasM.filter(a => arteDe(m, g, a)).length}/{areasM.length} faces</span>}
          <button onClick={() => { setPrevia({ mid: m.id, gid: g.id }); setAreaSel(null) }} className="text-gray-400 hover:text-orange-600" title="Ver e ajustar"><Move className="w-3.5 h-3.5" /></button>
          <button onClick={() => setIgnorados(x => ({ ...x, [k]: true }))} className="text-gray-400 hover:text-red-600" title="Ignorar esta foto" data-ignorar><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
        {aberto && (
          <div className="px-2 pb-2 space-y-1.5">
            {g.avisos.map((a, i) => <p key={i} className="text-amber-700 dark:text-amber-300">{a}</p>)}
            {m.smart && <div className="grid sm:grid-cols-2 gap-1.5">
              {areasM.map(a => (
                <label key={a.id} className="flex items-center gap-1.5"><span className="w-24 truncate text-gray-600 dark:text-gray-300">{a.nome}</span>
                  <select data-escolha={`${g.tema}:${a.nome}`} className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value={escolhas[chave(m.id, g.id, a.id)] || g.porArea[a.id] || g.principal || 'lisa'}
                    onChange={e => setEscolhas(x => ({ ...x, [chave(m.id, g.id, a.id)]: e.target.value }))}>
                    <option value="lisa">(lisa — sem arte)</option>
                    {artes.map(ar => <option key={ar.id} value={ar.id}>{ar.nome}</option>)}
                  </select>
                </label>
              ))}
            </div>}
            {pend && <button onClick={() => setConferidos(x => ({ ...x, [k]: true }))} className="rounded-md bg-emerald-600 text-white px-2 py-0.5 font-semibold" data-conferido>Conferido ✓</button>}
          </div>
        )}
      </div>
    )
  }

  if (!mockups.length) return <div className={cartao}><p className="text-sm text-gray-600 dark:text-gray-300">Você ainda não tem mockup salvo. Crie o primeiro em <b>Criar mockup</b> (foto do produto, acervo ou faca DXF) — é feito uma vez só.</p></div>

  return (
    <div className="space-y-4">
      <CotaBarra atualizar={cotaTick} faltam={faltam} />
      <div className={`${cartao} space-y-2`}>
        <p className="text-sm font-semibold">1. Mockup {!!sel.length && <span className="font-normal text-xs text-gray-500">({sel.length} escolhido{sel.length > 1 ? 's' : ''})</span>}</p>
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-5 lg:grid-cols-8">
          {mockups.map(m => {
            const on = sel.includes(m.id)
            return (
              <button key={m.id} data-mockup={m.nome} onClick={() => setSel(s => (on ? s.filter(x => x !== m.id) : [...s, m.id]))} className={`relative rounded-xl border p-1.5 text-left ${on ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`}>
                <Miniatura m={m} />
                <p className="text-[10px] truncate mt-1">{m.nome}</p>
                <span className="text-[9px] text-gray-400 line-clamp-1">{m.smart ? m.smart.cfg.areas.map(a => a.nome).join(', ') : 'mockup antigo'}</span>
                {on && <Check className="absolute top-1 right-1 w-4 h-4 text-orange-500" />}
              </button>
            )
          })}
        </div>
        {sel.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 text-xs" data-modo-multi>
            <label className="inline-flex items-center gap-1.5"><input type="radio" checked={modoMulti === 'separar'} onChange={() => setModoMulti('separar')} className="accent-orange-500" /> Separar por produto pelo nome do arquivo (<code>sacola_p_*</code>, <code>cx_milk_*</code>, pasta “Sacola P”…)</label>
            <label className="inline-flex items-center gap-1.5"><input type="radio" checked={modoMulti === 'todos'} onChange={() => setModoMulti('todos')} className="accent-orange-500" /> Todas as artes em todos os mockups</label>
          </div>
        )}
      </div>

      <div className={`${cartao} space-y-2 ${arrastando ? 'ring-2 ring-orange-400' : ''}`}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastando(true) } }} onDragLeave={() => setArrastando(false)}
        onDrop={async e => { e.preventDefault(); setArrastando(false); await importar(await arquivosDoArraste(e.dataTransfer)) }} data-soltar-artes>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">2. Artes <span className="font-normal text-xs text-gray-500">{artes.length ? `— ${artes.length} arte(s)${ignoradosArq ? ` · ${ignoradosArq} arquivo(s) que não são imagem ignorados` : ''}` : '— arraste a PASTA inteira aqui, ou escolha os arquivos'}</span></p>
          <div className="flex gap-2">
            {!!artes.length && <button onClick={() => { setArtes([]); setEscolhas({}); setConferidos({}); setAjustes({}); setIgnorados({}); setProdutoEscolha({}); setIgnoradosArq(0) }} className={`${btn} text-xs`}>Limpar</button>}
            <label className={`${btn} cursor-pointer text-xs`}><FolderOpen className="w-3.5 h-3.5" /> Escolher pasta<input type="file" multiple className="hidden" data-pasta-usar {...{ webkitdirectory: '' }} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; void importar(fs.map(f => ({ file: f, caminho: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }))) }} /></label>
            <label className={`${btn} cursor-pointer text-xs`}><Upload className="w-3.5 h-3.5" /> Escolher arquivos<input type="file" multiple data-artes-usar accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.psd" className="hidden" onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; void importar(fs.map(f => ({ file: f, caminho: f.name }))) }} /></label>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">Dê a face no nome do arquivo: <code>sereia_frente.png</code>, <code>sereia_lateral.png</code>, <code>sereia_alca.png</code> (sem face = a arte vai em todas). Com vários mockups, o produto também vem do nome ou da pasta.</p>
        {importando && (
          <div className="space-y-1" data-importando>
            <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {importando.fase}… {importando.feitos}/{importando.total}</p>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-full bg-orange-500 transition-[width]" style={{ width: `${Math.round((importando.feitos / Math.max(1, importando.total)) * 100)}%` }} /></div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(verTodasArtes ? artes : artes.slice(0, VISIVEIS)).map(a => (
            <div key={a.id} className="relative w-14" title={a.caminho}><img src={a.mini} alt={a.nome} className="w-14 h-14 object-contain rounded-lg border border-gray-200 bg-white" /><p className="text-[9px] truncate">{a.nome}</p>
              <button onClick={() => setArtes(x => x.filter(y => y.id !== a.id))} className="absolute -top-1 -right-1 bg-white rounded-full shadow"><Trash2 className="w-3 h-3 text-red-500" /></button></div>
          ))}
          {artes.length > VISIVEIS && <button onClick={() => setVerTodasArtes(v => !v)} className="text-[11px] text-gray-500 hover:text-orange-600 self-center">{verTodasArtes ? 'mostrar menos' : `+ ${artes.length - VISIVEIS} arte(s)`}</button>}
        </div>
      </div>

      {!!excecoesProduto.length && (
        <div className={`${cartao} space-y-2 border-amber-300`} data-excecoes-produto>
          <div className="flex items-center gap-2"><p className="text-sm font-semibold flex items-center gap-2 flex-1"><AlertTriangle className="w-4 h-4 text-amber-600" /> {excecoesProduto.length} arte(s) sem produto certo <span className="font-normal text-xs text-gray-500">— as outras {artes.length - excecoesProduto.length} foram reconhecidas pelo nome</span></p>
            <button disabled={iaOcupada} onClick={async () => { setIaOcupada(true); try { const s = await sugerirCasamentosIA(excecoesProduto.map(a => `${a.pasta ? a.pasta + '/' : ''}${a.nome}`), escolhidos.map(m => `${m.id}: ${m.nome}${apelidosDe(m).length ? ` (${apelidosDe(m).join(', ')})` : ''}`)); if (!s.ok) { setErro(s.mensagem); return } const o: Record<string, { alvo: string; confianca: number }> = {}; s.casamentos.forEach(c => { const a = excecoesProduto[c.indice]; if (a) o[a.id] = { alvo: c.alvo, confianca: c.confianca } }); setSugestoesIA(o) } finally { setIaOcupada(false) } }} className={`${btn} !text-xs`} title="A IA só SUGERE — você aceita cada uma" data-sugerir-produto-ia>{iaOcupada ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Sugerir com IA</button></div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {excecoesProduto.map(a => {
              const r = produtoDe.get(a.id)
              return (
                <div key={a.id} className="flex items-center gap-2 text-xs" data-excecao-produto={a.nome}>
                  <img src={a.mini} alt="" className="w-8 h-8 object-contain rounded border bg-white" />
                  <span className="flex-1 truncate" title={a.caminho}>{a.caminho} <span className="text-amber-700">— {r?.empate ? `pode ser ${r.empate.map(id => mockups.find(m => m.id === id)?.nome).join(' ou ')}` : r?.motivo}</span>{sugestoesIA[a.id] && <span className="text-violet-700"> · IA sugere: {mockups.find(m => m.id === sugestoesIA[a.id].alvo)?.nome} ({Math.round(sugestoesIA[a.id].confianca * 100)}%) <button onClick={() => { setProdutoEscolha(x => ({ ...x, [a.id]: sugestoesIA[a.id].alvo })); lembrarCorrecao(`${a.pasta ? a.pasta + '/' : ''}${a.nome}`, sugestoesIA[a.id].alvo) }} className="underline font-semibold" data-aceitar-ia-produto>aceitar</button></span>}</span>
                  <select className="border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value="" onChange={e => { const v = e.target.value; if (!v) return; setProdutoEscolha(x => ({ ...x, [a.id]: v })); if (v !== 'ignorar') lembrarCorrecao(`${a.pasta ? a.pasta + '/' : ''}${a.nome}`, v) }}>
                    <option value="">escolher o mockup…</option>
                    {escolhidos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    <option value="ignorar">ignorar esta arte</option>
                  </select>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400">O SOA lembra das suas correções (arquivos com o mesmo começo vão sozinhos da próxima vez). Dica: cadastre apelidos em Biblioteca → Apelidos.</p>
        </div>
      )}

      {!!todosItens.length && (
        <div className="grid lg:grid-cols-[1fr_420px] gap-4">
          <div className={`${cartao} space-y-2`}>
            <p className="text-sm font-semibold">3. Conferência <span className="font-normal text-xs text-gray-500" data-resumo-conferencia>— {casados.length} de {todosItens.length} foto(s) casaram sozinhas{pendentes.length ? `; ${pendentes.length} pedem atenção` : ' ✓'}</span></p>
            {pendentes.map(({ m, g }) => linhaGrupo(m, g))}
            {pendentes.length > 1 && <button onClick={() => setConferidos(x => { const y = { ...x }; pendentes.forEach(({ m, g }) => { y[chave(m.id, g.id)] = true }); return y })} className="text-[11px] text-gray-500 hover:text-emerald-700">Marcar todas como conferidas (faces sem arte ficam lisas)</button>}
            {!!casados.length && (
              <div className="space-y-1">
                <button onClick={() => setVerOk(v => !v)} className="text-xs text-emerald-700 inline-flex items-center gap-1" data-ver-ok>{verOk ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} {casados.length} casaram ✓ {verOk ? '' : '(ver lista)'}</button>
                {verOk && casados.slice(0, 200).map(({ m, g }) => linhaGrupo(m, g))}
                {verOk && casados.length > 200 && <p className="text-[11px] text-gray-400">… e mais {casados.length - 200}.</p>}
              </div>
            )}
            {Object.keys(ignorados).length > 0 && <button onClick={() => setIgnorados({})} className="text-[11px] text-gray-500 hover:text-orange-600">desfazer “ignorar” ({Object.keys(ignorados).length})</button>}
          </div>

          <div className="space-y-3">
            <div className={`${cartao} space-y-2`}>
              <p className="text-sm font-semibold">Prévia {gAlvo && <span className="font-normal text-xs text-gray-500">— {gAlvo.tema}{escolhidos.length > 1 && alvo ? ` · ${alvo.nome}` : ''}</span>}</p>
              <div ref={palcoRef} className="relative select-none" style={{ touchAction: 'none' }} data-palco-usar>
                <canvas ref={previaRef} className="w-full h-auto rounded-lg bg-gray-100 dark:bg-gray-800" />
                {alvo?.smart && (
                  <>
                    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                      {alvo.smart.cfg.areas.filter(a => !a.oculta).map(a => (
                        <polygon key={a.id} data-face={a.nome} points={contornoDaArea(a.area, 1, 1).map(p => `${p.x},${p.y}`).join(' ')} fill="transparent" stroke={a.id === areaSel ? '#f97316' : 'rgba(148,163,184,0.7)'} strokeWidth={a.id === areaSel ? 2 : 1} strokeDasharray={a.id === areaSel ? undefined : '5 4'} vectorEffect="non-scaling-stroke"
                          style={{ cursor: 'pointer', pointerEvents: a.id === areaSel ? 'none' : 'all' }} onClick={() => setAreaSel(a.id)} />
                      ))}
                    </svg>
                    {areaAlvo && arteAlvo && gAlvo && (
                      <AlcasArte area={areaAlvo.area} W={alvo.smart.foto.width} H={alvo.smart.foto.height} arte={{ w: arteAlvo.w, h: arteAlvo.h }} ajuste={alvo.smart.cfg.real.ajuste}
                        t={ajustes[chave(alvo.id, gAlvo.id, areaAlvo.id)] || areaAlvo.transform} palco={palcoRef}
                        onMudar={t => setAjustes(x => ({ ...x, [chave(alvo.id, gAlvo.id, areaAlvo.id)]: t }))} />
                    )}
                  </>
                )}
              </div>
              {alvo?.smart ? (
                areaAlvo && gAlvo ? (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-gray-600 dark:text-gray-300">Enquadrando <b>{areaAlvo.nome}</b>: arraste, cantos = zoom, bolinha = giro, rodinha = zoom.</span>
                    <button onClick={() => setAjustes(x => { const y = { ...x }; delete y[chave(alvo.id, gAlvo.id, areaAlvo.id)]; return y })} className="text-gray-500 hover:text-orange-600">voltar ao padrão do mockup</button>
                    <button onClick={() => aplicarEnquadramentoEmTodos(alvo, areaAlvo.id, ajustes[chave(alvo.id, gAlvo.id, areaAlvo.id)] || TRANSFORM_PADRAO)} className="text-gray-500 hover:text-orange-600">usar este enquadramento em todos os temas</button>
                    <button onClick={() => setAreaSel(null)} className="rounded-md bg-emerald-600 text-white px-2 py-0.5 font-semibold">OK</button>
                  </div>
                ) : <p className="text-[11px] text-gray-500">Clique numa face para enquadrar a arte dela (opcional — o padrão é o do mockup).</p>
              ) : <p className="text-[11px] text-gray-500">Mockup antigo: a arte ocupa a área de arte definida.</p>}
              <div className="flex items-center gap-2"><canvas ref={finalRef} className="w-24 h-auto rounded border border-gray-200 bg-white" data-previa-final /><p className="text-[10px] text-gray-400">Como sai (com a cena e o tamanho escolhidos).</p></div>
            </div>

            <div className={`${cartao} space-y-2`}>
              <p className="text-sm font-semibold">4. Saída</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><label className={lbl}>Cena (fundo)</label>
                  <select className={inp} value={cenaId} onChange={e => setCenaId(e.target.value)} data-cena>
                    <option value="nenhuma">Sem cena (o mockup como está)</option>
                    <option value="transparente">PNG transparente (só o produto)</option>
                    {CATEGORIAS_CENA.map(cat => <optgroup key={cat} label={cat}>{CENAS_PRONTAS.filter(c => c.categoria === cat).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</optgroup>)}
                    {!!cenas.length && <optgroup label="Minhas cenas">{cenas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</optgroup>}
                  </select>
                  {cenaId !== 'nenhuma' && alvo?.smart && !alvo.smart.cfg.transparente && !alvo.smart.cfg.mascara?.length && <p className="text-[10px] text-amber-700 mt-0.5">Este mockup é uma foto sem recorte: a cena entra em volta da foto. Para o produto “entrar” na cena, use “Achar a área de arte com IA” no Criar (ela recorta o produto).</p>}
                </div>
                <div><label className={lbl}>Formato</label>
                  <select className={inp} value={formato} onChange={e => setFormato(e.target.value as 'jpg' | 'png')} disabled={cenaId === 'transparente'} data-formato><option value="jpg">JPG</option><option value="png">PNG</option></select>
                </div>
                <div><label className={lbl}>Tamanho</label>
                  <select className={inp} value={canal} onChange={e => setCanal(e.target.value)} disabled={cenaId === 'transparente'} data-tamanho>
                    <option value="original">Tamanho do mockup</option>{TAMANHOS_CANAIS.map(t => <option key={t.id} value={t.id}>{t.canal} · {t.rotulo}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><label className={lbl}>Nome dos arquivos <span className="font-normal text-gray-400">— {'{tema}'} {'{mockup}'} {'{n}'} {'{data}'}</span></label>
                  <input className={inp} value={regraNome} onChange={e => setRegraNome(e.target.value)} data-regra-nome />
                </div>
                <label className="col-span-2 text-[11px] text-gray-600 dark:text-gray-300 inline-flex items-center gap-1.5"><input type="checkbox" checked={guardar} onChange={e => setGuardar(e.target.checked)} className="accent-orange-500" disabled={!storage} /> Guardar também em Meus arquivos (pasta Mockups/data)</label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => gerar(false)} disabled={!!importando || !casados.length} className={btnP} data-gerar><Layers className="w-4 h-4" /> {pendentes.length ? `Gerar as ${casados.length} que casaram` : `Gerar ${casados.length} foto(s)`}</button>
                {!!pendentes.length && <button onClick={() => gerar(true)} className="text-[11px] text-amber-700 hover:underline" data-gerar-tudo>gerar todas as {todosItens.length} (faces sem arte ficam lisas)</button>}
              </div>
              <p className="text-[11px] text-gray-500" data-custo>Usa {pendentes.length ? cobrarCasados : cobrarTodos} imagem(ns) da cota{(pendentes.length ? casados.length - cobrarCasados : todosItens.length - cobrarTodos) > 0 ? ` — ${pendentes.length ? casados.length - cobrarCasados : todosItens.length - cobrarTodos} já prontas (cache), não cobram de novo` : ''}. A fila divide em lotes de 50 e roda em segundo plano.</p>
              {erro && <p className="text-xs text-red-600">{erro}</p>}
              {aviso && <p className="text-xs text-emerald-700" data-aviso-usar>{aviso}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Miniatura({ m }: { m: MockupPronto }) {
  const url = useMemo(() => {
    const src = m.smart?.foto || m.produto
    const k = 110 / Math.max(src.width, src.height), c = novoCanvas(src.width * k, src.height * k)
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  }, [m])
  return url ? <img src={url} alt="" className="w-full aspect-square object-contain bg-gray-50 rounded-lg" /> : <div className="w-full aspect-square bg-gray-50 rounded-lg" />
}
