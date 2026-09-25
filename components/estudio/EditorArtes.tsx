'use client'
// SOA Edition — Edição em massa de artes (Fase 1).
// Fluxo: molde → caixas de campo sobre o molde → dados (colar / planilha / pedido) →
// variações → prévia → gerar o lote (PNG/JPG/PDF individual, PDF único, ZIP).
//
// Fabric cuida SÓ da interação (arrastar/redimensionar caixas). O desenho do texto é do
// renderizador único (lib/estudio/render) — o mesmo que gera o lote, então a prévia é fiel.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Canvas, Rect, FabricImage } from 'fabric'
import {
  Upload, Plus, Trash2, Save, Type, ImagePlus, Loader2, Download, X,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, CaseUpper, AlertTriangle, WandSparkles, FileSpreadsheet, ClipboardList, ShoppingBag, HardDrive,
  ScanText, RotateCw, RotateCcw,
} from 'lucide-react'
import CotaBarra from './CotaBarra'
import RevisaoArte, { type ModoCobertura } from './RevisaoArte'
import { ArquivoSoPrevia, importarArte, camposDoOcr, caixasDosCampos, camadasDosCampos, refinarCores, acharFonte, type ArteImportada, type CampoDetectado } from '@/lib/estudio/importarArte'
import { NOMES_FILTROS, type PaginaTemplate } from '@/lib/estudio/tipos'
import { FONTES_NATIVAS, CLASSES_PRECARGA } from './fontesNativas'
import { novaCaixa, variaveisDo, type Caixa, type ConfigTemplate, type Linha } from '@/lib/estudio/tipos'
import { renderizar, carregarFontes } from '@/lib/estudio/render'
import {
  carregarMolde, copiaDoCanvas, enviarArquivo, enviarProDrive, gerarLote, baixar, exigirSaldo, Autorizador, SemCota,
  type Molde, type Formato,
} from '@/lib/estudio/cliente'
import { temaDoPedido, type TemaPronto } from '@/lib/estudio/tema'
import {
  tabelaDeColar, tabelaDePlanilha, tabelaDePedidos, mapearAuto, montarLinhas, nomesArquivos, levas, LIMITE_LOTE, LIMITE_LISTA,
  type Tabela, type Variacao, type PedidoFonte,
} from '@/lib/estudio/dados'

const AMOSTRA: Linha = { nome: 'Maria Eduarda', idade: '5', turma: 'Jardim II', data: '12/10', tema: 'Jardim encantado' }
const CAMPOS_PRONTOS = ['{nome}', '{idade}', '{turma}', '{data}', '{foto}']

const cfgVazia = (): ConfigTemplate => ({ versao: 1, largura: 1000, altura: 1000, caixas: [], fontesUsuario: [], pagina: { larguraPt: 240, alturaPt: 240 } })

const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-1'

export default function EditorArtes() {
  const { data: session } = useSession()
  const workspaceId = (session?.user as any)?.workspaceId as string | undefined

  // ── ambiente
  const [storage, setStorage] = useState<boolean | null>(null)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')

  // ── molde + template
  const [molde, setMolde] = useState<Molde | null>(null)
  const [moldeNome, setMoldeNome] = useState('')
  const [moldeAssetId, setMoldeAssetId] = useState<string | null>(null)
  const [enviandoMolde, setEnviandoMolde] = useState(false)
  const [cfg, setCfg] = useState<ConfigTemplate>(cfgVazia)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [templateNome, setTemplateNome] = useState('')
  const [templates, setTemplates] = useState<{ id: string; nome: string; temaNome?: string | null }[]>([])
  const [ehTema, setEhTema] = useState(false)
  const [temaNome, setTemaNome] = useState('')
  const [temas, setTemas] = useState<TemaPronto[]>([])
  const originalRef = useRef<File | null>(null)
  // roteador de arte + revisão dos campos detectados
  const arteRef = useRef<ArteImportada | null>(null)
  const arquivoArteRef = useRef<File | null>(null)
  // Template Especial (acervo): a cópia dela guarda só a referência — o molde cru não vai para os arquivos dela
  const [especialId, setEspecialId] = useState<string | null>(null)
  // ── MULTIPÁGINA: cada página = molde + campos. O estado "ao vivo" (molde/cfg) é a página atual.
  type PaginaViva = PaginaTemplate & { molde: Molde | null }
  const paginasRef = useRef<PaginaViva[]>([])
  const [paginaIdx, setPaginaIdx] = useState(0)
  const [nPaginas, setNPaginas] = useState(1)
  const moldeUrlRef = useRef<string | null>(null)
  // arquivo aceito sem leitura (Silhouette .studio): mostra a prévia embutida + como exportar
  const [soPrevia, setSoPrevia] = useState<{ url: string | null; msg: string; passos: string[] } | null>(null)
  const [revisao, setRevisao] = useState<{ arte: ArteImportada; campos: CampoDetectado[]; fase: 'perguntar' | 'confirmar' } | null>(null)
  const [cobertura, setCobertura] = useState<ModoCobertura>('entorno')
  const [lendo, setLendo] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [originalPendente, setOriginalPendente] = useState<string | null>(null)
  const [drive, setDrive] = useState<{ configurado: boolean; conectado: boolean; email: string | null } | null>(null)
  const [enviarDrive, setEnviarDrive] = useState(false)
  const [progDrive, setProgDrive] = useState<number | null>(null)
  const [biblioteca, setBiblioteca] = useState<{ id: string; nome: string; url: string; familia: string | null; acervo: boolean }[]>([])
  const [cotaVersao, setCotaVersao] = useState(0)
  const [faltam, setFaltam] = useState(0)
  const [leva, setLeva] = useState(0)
  const [autoGerando, setAutoGerando] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  const sel = cfg.caixas.find(c => c.id === selId) || null

  // ── dados
  const [origem, setOrigem] = useState<'colar' | 'xlsx' | 'pedido'>('colar')
  const [textoColado, setTextoColado] = useState('')
  const [cabecalho, setCabecalho] = useState(false)
  const [tabPlanilha, setTabPlanilha] = useState<Tabela | null>(null)
  const [pedidos, setPedidos] = useState<PedidoFonte[]>([])
  const [buscaPedido, setBuscaPedido] = useState('')
  const [pedidosSel, setPedidosSel] = useState<string[]>([])
  const [expandir, setExpandir] = useState('')
  const [mapa, setMapa] = useState<Record<string, string>>({})
  const [variacoes, setVariacoes] = useState<Variacao[]>([])

  // ── geração
  const [formato, setFormato] = useState<Formato>('png')
  const [regra, setRegra] = useState('{nome}')
  const [guardar, setGuardar] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 })
  const cancelarRef = useRef(false)
  const [previas, setPrevias] = useState<string[]>([])

  // ── fabric
  const hostRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<HTMLCanvasElement>(null)
  const fabRef = useRef<Canvas | null>(null)
  const rectsRef = useRef<Map<string, Rect>>(new Map())
  const [escala, setEscala] = useState(1)
  const previewCv = useRef<HTMLCanvasElement | null>(null)

  const resolverFonte = useCallback((id: string) => {
    if (id.startsWith('u:')) return cfg.fontesUsuario.find(f => `u:${f.id}` === id)?.familia ? `"${cfg.fontesUsuario.find(f => `u:${f.id}` === id)!.familia}"` : 'sans-serif'
    return FONTES_NATIVAS.find(f => f.id === id)?.familia || 'sans-serif'
  }, [cfg.fontesUsuario])

  // ── ambiente + templates
  useEffect(() => {
    fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => setStorage(false))
    fetch('/api/estudio/templates').then(r => r.json()).then(d => setTemplates(d.templates || [])).catch(() => {})
    fetch('/api/estudio/temas').then(r => r.json()).then(d => setTemas(d.temas || [])).catch(() => {})
    fetch('/api/estudio/drive').then(r => r.json()).then(setDrive).catch(() => {})
    carregarBiblioteca()
  }, [])

  function carregarBiblioteca() {
    fetch('/api/estudio/fontes').then(r => r.json()).then(d => setBiblioteca([
      ...(d.minhas || []).map((f: any) => ({ ...f, acervo: false })),
      ...(d.acervo || []).map((f: any) => ({ ...f, acervo: true })),
    ].filter(f => f.url && f.familia))).catch(() => {})
  }

  /** Fonte da biblioteca (minha ou do acervo curado) → entra no template e é carregada no navegador. */
  async function usarFonteBiblioteca(assetId: string) {
    const f = biblioteca.find(x => x.id === assetId)
    if (!f?.familia) return
    try { const ff = new FontFace(f.familia, `url(${f.url})`); await ff.load(); document.fonts.add(ff) } catch { setErro('Não consegui carregar essa fonte.'); return }
    setCfg(c => c.fontesUsuario.some(x => x.id === f.id) ? c : { ...c, fontesUsuario: [...c.fontesUsuario, { id: f.id, familia: f.familia!, url: f.url }] })
    atualizar({ fonte: `u:${f.id}` })
  }

  // ── Fabric: cria uma vez
  useEffect(() => {
    if (!elRef.current) return
    const c = new Canvas(elRef.current, { selection: false, preserveObjectStacking: true })
    fabRef.current = c
    const sync = (e: any) => {
      const r = e?.target as Rect | undefined
      if (!r) return
      const id = [...rectsRef.current.entries()].find(([, v]) => v === r)?.[0]
      if (!id) return
      const w = r.width * (r.scaleX || 1), h = r.height * (r.scaleY || 1)
      r.set({ width: w, height: h, scaleX: 1, scaleY: 1 })
      const ctr = r.getCenterPoint()
      const giro = Math.round((((r.angle || 0) + 540) % 360) - 180)
      setCfg(prev => {
        const k = prev.largura / (c.getWidth() || 1)
        const W = Math.max(10, Math.round(w * k)), H = Math.max(10, Math.round(h * k))
        return { ...prev, caixas: prev.caixas.map(cx => cx.id === id ? { ...cx, x: Math.round(ctr.x * k - W / 2), y: Math.round(ctr.y * k - H / 2), w: W, h: H, rotacao: giro } : cx) }
      })
    }
    const escolher = (e: any) => {
      const r = (e?.selected?.[0] || e?.target) as Rect | undefined
      const id = r ? [...rectsRef.current.entries()].find(([, v]) => v === r)?.[0] : null
      setSelId(id || null)
    }
    c.on('object:modified', sync)
    c.on('selection:created', escolher)
    c.on('selection:updated', escolher)
    c.on('selection:cleared', () => setSelId(null))
    return () => { rectsRef.current.clear(); fabRef.current = null; void c.dispose() }
  }, [])

  // ── tamanho da área do editor
  const ajustarTamanho = useCallback(() => {
    const c = fabRef.current, host = hostRef.current
    if (!c || !host) return
    const maxW = host.clientWidth
    const maxH = Math.max(320, window.innerHeight * 0.68)
    const k = Math.min(maxW / cfg.largura, maxH / cfg.altura, 1)
    c.setDimensions({ width: Math.round(cfg.largura * k), height: Math.round(cfg.altura * k) })
    setEscala(k)
  }, [cfg.largura, cfg.altura])
  useEffect(() => { ajustarTamanho(); window.addEventListener('resize', ajustarTamanho); return () => window.removeEventListener('resize', ajustarTamanho) }, [ajustarTamanho])

  // ── retângulos acompanham as caixas (estado é a fonte da verdade)
  useEffect(() => {
    const c = fabRef.current
    if (!c) return
    const vivos = new Set(cfg.caixas.map(x => x.id))
    for (const [id, r] of rectsRef.current) if (!vivos.has(id)) { c.remove(r); rectsRef.current.delete(id) }
    for (const cx of cfg.caixas) {
      let r = rectsRef.current.get(cx.id)
      // caixa pelo CENTRO, com giro (campos em pé, deitados, inclinados…)
      const geo = { left: (cx.x + cx.w / 2) * escala, top: (cx.y + cx.h / 2) * escala, width: cx.w * escala, height: cx.h * escala, angle: cx.rotacao || 0, originX: 'center' as const, originY: 'center' as const }
      if (!r) {
        r = new Rect({
          ...geo, fill: 'rgba(249,115,22,0.07)', stroke: '#f97316', strokeWidth: 1.5, strokeDashArray: [6, 4],
          strokeUniform: true, transparentCorners: false, cornerColor: '#f97316', cornerSize: 9,
        })
        rectsRef.current.set(cx.id, r)
        c.add(r)
      } else r.set(geo)
      r.setCoords()
    }
    c.requestRenderAll()
  }, [cfg.caixas, escala])

  // ── amostra para a prévia do editor = 1ª linha dos dados (ou exemplo)
  const tabela: Tabela | null = useMemo(() => {
    if (origem === 'colar') return textoColado.trim() ? tabelaDeColar(textoColado, cabecalho) : null
    if (origem === 'xlsx') return tabPlanilha
    const escolhidos = pedidos.filter(p => pedidosSel.includes(p.id))
    return escolhidos.length ? tabelaDePedidos(escolhidos, expandir || null) : null
  }, [origem, textoColado, cabecalho, tabPlanilha, pedidos, pedidosSel, expandir])

  const variaveis = useMemo(() => variaveisDo(cfg.caixas), [cfg.caixas])
  useEffect(() => { if (tabela) setMapa(m => ({ ...mapearAuto(variaveis, tabela.cabecalhos), ...Object.fromEntries(Object.entries(m).filter(([, v]) => tabela.cabecalhos.includes(v))) })) }, [tabela, variaveis])

  const { linhas, cortado } = useMemo(() => tabela || variacoes.length
    ? montarLinhas(tabela || { cabecalhos: [], linhas: [] }, mapa, variacoes)
    : { linhas: [] as Linha[], cortado: false }, [tabela, mapa, variacoes])
  const fundoVar = variacoes.find(v => v.variavel === 'fundo') ? 'fundo' : null
  const partes = levas(linhas.length)
  const levaAtual = partes[Math.min(leva, Math.max(0, partes.length - 1))] || { inicio: 0, fim: 0 }
  const linhasDaLeva = linhas.slice(levaAtual.inicio, levaAtual.fim)
  useEffect(() => { setLeva(0) }, [linhas.length])
  const amostra: Linha = linhas[0] ? { ...AMOSTRA, ...linhas[0] } : AMOSTRA

  // ── prévia no editor (debounce): molde + textos com a amostra, como fundo do Fabric
  useEffect(() => {
    if (!molde || !fabRef.current) return
    let vivo = true
    const t = setTimeout(async () => {
      await carregarFontes(cfg, resolverFonte)
      if (!vivo || !fabRef.current) return
      const cv = previewCv.current || (previewCv.current = document.createElement('canvas'))
      renderizar(cv, molde.fonte, cfg, amostra, resolverFonte, { fundo: fundoVar ? amostra[fundoVar] : null })
      const img = new FabricImage(cv, { scaleX: escala, scaleY: escala, selectable: false, evented: false })
      fabRef.current.backgroundImage = img
      fabRef.current.requestRenderAll()
    }, 120)
    return () => { vivo = false; clearTimeout(t) }
  }, [molde, cfg, amostra, escala, resolverFonte, fundoVar])

  // fontes nativas terminaram de carregar → redesenha
  useEffect(() => { document.fonts?.ready.then(() => setCfg(c => ({ ...c }))) }, [])

  // ── ações de molde
  /**
   * Importar arte (roteador): PSD/SVG/PDF com texto → camadas lidas, fundo limpo, campos mapeados;
   * JPEG/PNG/PDF achatado → fundo = arte, campos pela leitura assistida (com cobertura). Se já há
   * campos (ex.: "Trocar molde" pela versão limpa), os campos ficam.
   */
  /** Todas as páginas com a página atual atualizada do estado ao vivo. */
  function todasAsPaginas(): PaginaViva[] {
    const viva: PaginaViva = { molde, moldeAssetId, moldeUrl: moldeUrlRef.current, largura: cfg.largura, altura: cfg.altura, pagina: cfg.pagina, caixas: cfg.caixas, moldeComTexto: cfg.moldeComTexto }
    if (paginasRef.current.length <= 1) return [viva]
    return paginasRef.current.map((p, i) => (i === paginaIdx ? viva : p))
  }
  function irPagina(j: number) {
    const todas = todasAsPaginas()
    if (j === paginaIdx || j < 0 || j >= todas.length) return
    paginasRef.current = todas
    const p = todas[j]
    setMolde(p.molde); setMoldeAssetId(p.moldeAssetId); moldeUrlRef.current = p.moldeUrl
    setCfg(c => ({ ...c, largura: p.largura, altura: p.altura, pagina: p.pagina, caixas: p.caixas, moldeComTexto: p.moldeComTexto }))
    setSelId(null); setPaginaIdx(j)
  }
  /** Páginas 2…N de um PDF: cada uma vira página do template (camadas lidas; molde guardado). */
  async function abrirPaginasExtras(f: File, total: number) {
    const extras: PaginaViva[] = []
    for (let n = 2; n <= Math.min(total, 30); n++) {
      setAviso(`Abrindo a página ${n} de ${total}…`)
      const a = await importarArte(f, n)
      const fundo = a.recompor ? await a.recompor(camadasDosCampos(a.campos)) : a.fundo
      let moldeAssetIdN: string | null = null, url: string | null = null
      if (storage && workspaceId) {
        try { const cp = await copiaDoCanvas(fundo, `${f.name}-p${n}`); const r = await enviarArquivo(cp.blob, cp.nome, 'molde', workspaceId, { pasta: 'Moldes', meta: { largura: fundo.width, altura: fundo.height, pagina: a.pagina, origem: a.formato, paginaDoPdf: n } }); moldeAssetIdN = r.id; url = r.url } catch { /* só na sessão */ }
      }
      extras.push({ molde: { fonte: fundo, largura: fundo.width, altura: fundo.height, pagina: a.pagina }, moldeAssetId: moldeAssetIdN, moldeUrl: url, largura: fundo.width, altura: fundo.height, pagina: a.pagina, caixas: caixasDosCampos(a.campos, a.caminho === 'achatado'), moldeComTexto: a.caminho === 'achatado' })
    }
    paginasRef.current = [todasAsPaginas()[0], ...extras]
    setNPaginas(paginasRef.current.length)
    setAviso(`${paginasRef.current.length} páginas no template (uma por página do PDF). Confira os campos de cada página — clique na página embaixo da arte.`)
  }

  async function escolherMolde(f: File) {
    setErro(''); setAviso('')
    const jaTemCampos = cfg.caixas.length > 0
    setAnalisando(true)
    let arte: ArteImportada
    try { arte = await importarArte(f) }
    catch (e) {
      setAnalisando(false)
      if (e instanceof ArquivoSoPrevia) { setSoPrevia({ url: e.miniatura ? URL.createObjectURL(e.miniatura) : null, msg: e.message, passos: e.passos }); return }
      setErro((e as Error).message || 'Não consegui abrir esse arquivo.'); return
    }
    setAnalisando(false)
    arteRef.current = arte
    setEspecialId(null)
    const m: Molde = { fonte: arte.fundo, largura: arte.fundo.width, altura: arte.fundo.height, pagina: arte.pagina }
    setMolde(m); setMoldeNome(f.name); setMoldeAssetId(null); moldeUrlRef.current = null
    if (paginasRef.current.length <= 1) setTemplateId(null)
    // molde achatado ainda tem o texto antigo desenhado; "Trocar molde" com campos = versão limpa
    setCfg(c => ({ ...c, largura: m.largura, altura: m.altura, pagina: m.pagina, moldeComTexto: arte.caminho === 'achatado' && !jaTemCampos }))
    if ((arte.totalPaginas || 1) > 1 && paginasRef.current.length <= 1 && !jaTemCampos
      && confirm(`Este PDF tem ${arte.totalPaginas} páginas. Abrir TODAS como páginas do template? (cada nome sai com todas as páginas)`)) {
      setTimeout(() => { abrirPaginasExtras(f, arte.totalPaginas!).catch(e => setErro('Não consegui abrir as outras páginas: ' + (e as Error).message)) }, 50)
    }
    if (!templateNome) setTemplateNome(f.name.replace(/\.[^.]+$/, ''))
    if (jaTemCampos) {
      setAviso(arte.caminho === 'camadas' || !cfg.caixas.some(c => c.cobertura)
        ? 'Molde trocado — os campos foram mantidos.'
        : 'Molde trocado — os campos foram mantidos. Se esta é a versão LIMPA (sem o nome), tire a cobertura dos campos (painel do campo).')
    } else if (arte.caminho === 'camadas') {
      setRevisao({ arte, campos: arte.campos, fase: 'confirmar' })
    } else {
      setRevisao({ arte, campos: [], fase: 'perguntar' })
    }
    arquivoArteRef.current = f
    // camadas: o molde só é guardado depois da revisão (o fundo depende de quais textos viram campo)
    if (!(arte.caminho === 'camadas' && !jaTemCampos)) await guardarMolde(arte.fundo)
  }

  /** Guarda o MOLDE (fundo limpo quando veio de camadas) na biblioteca. */
  async function guardarMolde(cv: HTMLCanvasElement) {
    const f = arquivoArteRef.current, arte = arteRef.current
    if (!f || !arte || !storage || !workspaceId) return
    setEnviandoMolde(true)
    try {
      const cp = await copiaDoCanvas(cv, f.name)
      const r = await enviarArquivo(cp.blob, cp.nome, 'molde', workspaceId, {
        pasta: 'Moldes', meta: { largura: cv.width, altura: cv.height, pagina: arte.pagina, origem: arte.formato, caminho: arte.caminho, original: { nome: f.name, tamanhoBytes: f.size } },
      })
      setMoldeAssetId(r.id); moldeUrlRef.current = r.url
      if (f.size > 8 * 1024 * 1024) { originalRef.current = f; setOriginalPendente(r.id) }
    } catch (e) { setAviso('O molde abriu, mas não consegui guardá-lo na biblioteca: ' + (e as Error).message) }
    finally { setEnviandoMolde(false) }
  }
  /** Camadas: devolve ao fundo os textos que ficam fixos e guarda o molde final. */
  async function fecharCamadas(campos: CampoDetectado[]): Promise<CampoDetectado[]> {
    const arte = arteRef.current
    if (!arte || arte.caminho !== 'camadas' || !arte.recompor) return []
    // o fundo final esconde SÓ as camadas que viraram campo; o resto (título fixo etc.) continua desenhado
    const ocultar = camadasDosCampos(campos)
    const fundo = await arte.recompor(ocultar)
    // PDF: o texto some "tudo ou nada" → texto fixo volta como campo literal
    const literais = arte.textoTudoOuNada && [...ocultar].some(id => id.startsWith('t'))
      ? campos.filter(c => !c.incluir && c.camadaId?.startsWith('t')).map(c => ({ ...c, incluir: true, papel: 'outro' as const, modelo: c.textoOriginal }))
      : []
    if (fundo !== arte.fundo) setMolde(m => (m ? { ...m, fonte: fundo } : m))
    await guardarMolde(fundo)
    return literais
  }

  /** OCR assistente: procura os textos da arte e sugere os campos (a artesã confirma). */
  async function procurarTextos() {
    const arte = arteRef.current
    const fonte = arte?.original || (molde?.fonte as HTMLCanvasElement | undefined)
    if (!fonte || !molde) return
    setLendo(true); setErro('')
    try {
      const W = molde.largura, H = molde.altura
      const k = Math.min(1, 1600 / Math.max(W, H))
      const p = document.createElement('canvas'); p.width = Math.round(W * k); p.height = Math.round(H * k)
      p.getContext('2d')!.drawImage(fonte, 0, 0, p.width, p.height)
      const r = await fetch('/api/estudio/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagem: p.toDataURL('image/jpeg', 0.88) }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não consegui ler os textos.')
      const base = document.createElement('canvas'); base.width = W; base.height = H
      base.getContext('2d')!.drawImage(fonte, 0, 0, W, H)
      const campos = refinarCores(camposDoOcr(j.textos || [], W, H), base)
      const a = arte || { formato: 'imagem', caminho: 'achatado', fundo: base, original: base, pagina: cfg.pagina, camadas: { total: 1, texto: 0, nomes: [] }, campos: [], avisos: [], lista: [] } as ArteImportada
      // arquivo em camadas: o OCR SOMA aos campos das camadas (não substitui)
      setRevisao(r => ({ arte: a, campos: [...(r && r.arte === a ? r.campos.filter(c => c.origem === 'camada') : []), ...campos], fase: 'confirmar' }))
    } catch (e) { setErro((e as Error).message) } finally { setLendo(false) }
  }
  /**
   * A MESMA fonte do arquivo: embutida no PDF (vira fonte do ateliê), nativa com o mesmo nome, ou uma
   * fonte do ateliê com o mesmo nome. Sem nenhuma → avisa pelo nome (nunca troca calada por outra).
   */
  async function fontesDosCampos(campos: CampoDetectado[]): Promise<{ campos: CampoDetectado[]; faltando: string[]; subconjunto: string[] }> {
    const faltando = new Set<string>(), subconjunto = new Set<string>()
    const novasFontes: { id: string; familia: string; url: string }[] = []
    const nativas = FONTES_NATIVAS.map(f => ({ id: f.id, nome: f.rotulo }))
    const saida: CampoDetectado[] = []
    for (const c of campos) {
      if (!c.incluir || c.fonteId) { saida.push(c); continue }
      const fe = c.fonteEmbutida
      // subconjunto (só as letras do arquivo): a MESMA fonte completa (nativa ou do ateliê) tem prioridade
      if (fe?.subconjunto) {
        const nat0 = acharFonte(fe.nome, nativas)
        if (nat0) { saida.push({ ...c, fonteId: nat0 }); continue }
        const lib0 = biblioteca.find(b => b.familia && acharFonte(fe.nome, [{ id: b.id, nome: b.nome }]))
        if (lib0?.familia) {
          try { const ff = new FontFace(lib0.familia, `url(${lib0.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue */ }
          if (!cfg.fontesUsuario.some(x => x.id === lib0.id) && !novasFontes.some(x => x.id === lib0.id)) novasFontes.push({ id: lib0.id, familia: lib0.familia, url: lib0.url })
          saida.push({ ...c, fonteId: `u:${lib0.id}` }); continue
        }
      }
      if (fe?.dados?.length) {
        const familia = `PDF_${fe.nome.replace(/[^\w]/g, '').slice(0, 24)}_${fe.dados.length}`
        let f = novasFontes.find(x => x.familia === familia) || cfg.fontesUsuario.find(x => x.familia === familia)
        if (!f) {
          try {
            const ff = new FontFace(familia, fe.dados as BufferSource); await ff.load(); document.fonts.add(ff)
            let url = '', id = familia
            if (storage && workspaceId) { const up = await enviarArquivo(new Blob([fe.dados as BlobPart], { type: 'font/otf' }), `${fe.nome}.otf`, 'fonte', workspaceId, { pasta: 'Fontes', meta: { familia, embutidaDoPdf: true, subconjunto: fe.subconjunto } }); url = up.url; id = up.id }
            f = { id, familia, url }; novasFontes.push(f)
          } catch { f = undefined }
        }
        if (f) { if (fe.subconjunto) subconjunto.add(fe.nome); saida.push({ ...c, fonteId: `u:${f.id}` }); continue }
      }
      const nome = c.fonteArquivo || fe?.nome || null
      const nat = acharFonte(nome, nativas)
      if (nat) { saida.push({ ...c, fonteId: nat }); continue }
      const lib = nome ? biblioteca.find(b => b.familia && acharFonte(nome, [{ id: b.id, nome: b.nome }])) : null
      if (lib?.familia) {
        try { const ff = new FontFace(lib.familia, `url(${lib.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue */ }
        if (!cfg.fontesUsuario.some(x => x.id === lib.id) && !novasFontes.some(x => x.id === lib.id)) novasFontes.push({ id: lib.id, familia: lib.familia, url: lib.url })
        saida.push({ ...c, fonteId: `u:${lib.id}` }); continue
      }
      if (nome && c.origem === 'camada') faltando.add(nome)
      saida.push(c)
    }
    if (novasFontes.length) setCfg(c => ({ ...c, fontesUsuario: [...c.fontesUsuario, ...novasFontes.filter(n => !c.fontesUsuario.some(x => x.id === n.id))] }))
    return { campos: saida, faltando: [...faltando], subconjunto: [...subconjunto] }
  }

  async function confirmarCampos() {
    if (!revisao) return
    const achatado = revisao.arte.caminho === 'achatado'
    const literais = achatado ? [] : await fecharCamadas(revisao.campos)
    const { campos, faltando, subconjunto } = await fontesDosCampos([...revisao.campos, ...literais])
    // arte achatada: o texto antigo continua no molde → cobertura SEMPRE (nunca dois textos juntos)
    const novas = caixasDosCampos(campos, true).map(c => ({
      ...c, cobertura: c.cobertura ? { ...c.cobertura, modo: cobertura === 'cor' ? 'cor' as const : 'entorno' as const, cor: '#ffffff' } : null,
    }))
    setCfg(c => ({ ...c, caixas: [...c.caixas, ...novas] }))
    setRevisao(null)
    const partes = [`${novas.length} campo(s) criado(s)${achatado ? '' : ' no lugar das camadas originais (que saíram do fundo), com a fonte e o acabamento do arquivo'}.`]
    if (faltando.length) partes.push(`Fonte(s) do arquivo não encontrada(s): ${faltando.join(', ')} — suba o .ttf/.otf em “Fonte” no campo para o nome sair IGUAL ao design.`)
    if (subconjunto.length) partes.push(`A fonte embutida (${subconjunto.join(', ')}) tem só as letras usadas no arquivo — suba a fonte completa para nomes com outras letras.`)
    if (achatado) partes.push('Arte achatada: não dá para manter a fonte original — escolha/suba a fonte no campo. Melhor ainda: importe o arquivo em camadas (PSD/SVG/DXF).')
    setAviso(partes.join(' '))
  }
  async function marcarNaMao() {
    const r = revisao
    setRevisao(null)
    if (r && r.arte.caminho === 'camadas') {
      // sem campos: todo texto volta ao fundo (a arte fica como veio)
      const literais = await fecharCamadas(r.campos.map(c => ({ ...c, incluir: false })))
      if (literais.length) setCfg(c => ({ ...c, caixas: [...c.caixas, ...caixasDosCampos(literais, false)] }))
    }
    if (!cfg.caixas.length && molde) setCfg(c => ({ ...c, caixas: [novaCaixa(Math.round(molde.largura * 0.2), Math.round(molde.altura * 0.42), Math.round(molde.largura * 0.6), Math.round(molde.altura * 0.14))] }))
  }

  async function abrirTemplate(id: string) {
    if (!id) return
    setErro('')
    try {
      const d = await fetch(`/api/estudio/templates/${id}`).then(r => r.json())
      const t = d.template
      if (!t?.moldeUrl) { setErro(d.error || 'Este template está sem molde.'); return }
      const esp = (typeof t.config === 'string' ? JSON.parse(t.config) : t.config)?.especialId
      setEspecialId(typeof esp === 'string' ? esp : null)
      const conf: ConfigTemplate = { ...cfgVazia(), ...t.config }
      for (const f of conf.fontesUsuario || []) {
        try { const ff = new FontFace(f.familia, `url(${f.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue com fallback */ }
      }
      const m = await carregarMolde(t.moldeUrl, t.moldeMime)
      moldeUrlRef.current = t.moldeUrl
      const extras = await Promise.all((conf.paginas || []).map(async pg => ({ ...pg, molde: pg.moldeUrl ? await carregarMolde(pg.moldeUrl) : null })))
      paginasRef.current = extras.length ? [{ molde: m, moldeAssetId: t.moldeAssetId, moldeUrl: t.moldeUrl, largura: m.largura, altura: m.altura, pagina: conf.pagina, caixas: conf.caixas, moldeComTexto: conf.moldeComTexto }, ...extras] : []
      setNPaginas(Math.max(1, paginasRef.current.length)); setPaginaIdx(0)
      setMolde(m); setMoldeNome(t.nome); setMoldeAssetId(t.moldeAssetId); setTemplateId(t.id); setTemplateNome(t.nome)
      setEhTema(!!t.temaNome); setTemaNome(t.temaNome || '')
      setCfg({ ...conf, largura: m.largura, altura: m.altura }); setSelId(null)
    } catch (e) { setErro('Não consegui abrir o template: ' + (e as Error).message) }
  }

  /** Abre um TEMPLATE ESPECIAL (acervo curado) para personalizar e gerar — sem baixar o arquivo cru. */
  async function abrirEspecial(id: string) {
    setErro('')
    try {
      const r = await fetch(`/api/estudio/especiais/${id}`)
      const d = await r.json()
      if (!r.ok || !d.template?.moldeUrl) { setErro(d.error || 'Não consegui abrir o Template Especial.'); return }
      const t = d.template
      const conf: ConfigTemplate = { ...cfgVazia(), ...(typeof t.config === 'string' ? JSON.parse(t.config) : t.config) }
      const m = await carregarMolde(t.moldeUrl)
      setMolde(m); setMoldeNome(t.nome); setMoldeAssetId(null); setTemplateId(null); setTemplateNome(t.nome)
      setEhTema(false); setTemaNome(t.temaNome || t.nome); setEspecialId(t.id)
      setCfg({ ...conf, largura: m.largura, altura: m.altura }); setSelId(null)
      setAviso(`Template Especial “${t.nome}” aberto — personalize e gere. Salvar cria a sua versão (abre enquanto a assinatura estiver ativa).`)
    } catch (e) { setErro('Não consegui abrir o Template Especial: ' + (e as Error).message) }
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('especial')
    if (id) abrirEspecial(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarTemplate() {
    if (!moldeAssetId && !especialId) { setErro(storage ? 'Aguarde o molde terminar de enviar.' : 'Para salvar templates, o armazenamento precisa estar configurado.'); return }
    if (!templateNome.trim()) { setErro('Dê um nome ao template.'); return }
    if (ehTema && !temaNome.trim()) { setErro('Dê um nome ao tema (ex.: Astronauta).'); return }
    setSalvando(true); setErro('')
    try {
      let preview: string | undefined
      if (previewCv.current) {
        const p = document.createElement('canvas'); const k = 360 / Math.max(cfg.largura, cfg.altura)
        p.width = Math.round(cfg.largura * k); p.height = Math.round(cfg.altura * k)
        p.getContext('2d')!.drawImage(previewCv.current, 0, 0, p.width, p.height); preview = p.toDataURL('image/jpeg', 0.7)
      }
      const todas = todasAsPaginas()
      if (todas.length > 1 && todas.some(p => !p.moldeUrl && !p.moldeAssetId)) throw new Error('Alguma página ainda está sem o molde guardado — aguarde e tente de novo.')
      const p0 = todas[0]
      const base = todas.length > 1
        ? { ...cfg, largura: p0.largura, altura: p0.altura, pagina: p0.pagina, caixas: p0.caixas, moldeComTexto: p0.moldeComTexto,
            paginas: todas.slice(1).map(({ molde: _m, ...r }) => r) }
        : { ...cfg, paginas: undefined }
      const body = JSON.stringify({ nome: templateNome.trim(), moldeAssetId: especialId ? null : (todas.length > 1 ? p0.moldeAssetId : moldeAssetId), config: especialId ? { ...base, especialId } : base, preview, temaNome: ehTema ? temaNome.trim() : null })
      const r = templateId
        ? await fetch(`/api/estudio/templates/${templateId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })
        : await fetch('/api/estudio/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao salvar')
      if (!templateId) setTemplateId(j.id)
      setAviso('Template salvo ✅')
      fetch('/api/estudio/templates').then(x => x.json()).then(d => setTemplates(d.templates || []))
      fetch('/api/estudio/temas').then(x => x.json()).then(d => setTemas(d.temas || []))
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  // ── caixas
  const atualizar = (patch: Partial<Caixa>) => selId && setCfg(c => ({ ...c, caixas: c.caixas.map(x => x.id === selId ? { ...x, ...patch, tipo: (patch.texto ?? x.texto).trim() === '{foto}' ? 'imagem' : 'texto' } : x) }))
  function adicionarCampo(texto: string) {
    const cx = novaCaixa(Math.round(cfg.largura * 0.2), Math.round(cfg.altura * (0.2 + 0.1 * (cfg.caixas.length % 6))), Math.round(cfg.largura * 0.6), Math.round(cfg.altura * 0.12), texto)
    setCfg(c => ({ ...c, caixas: [...c.caixas, cx] }))
    setTimeout(() => { const r = rectsRef.current.get(cx.id); if (r && fabRef.current) { fabRef.current.setActiveObject(r); fabRef.current.requestRenderAll(); setSelId(cx.id) } }, 30)
  }
  function removerCampo() {
    if (!selId) return
    setCfg(c => ({ ...c, caixas: c.caixas.filter(x => x.id !== selId) })); setSelId(null)
  }

  async function enviarFonte(f: File) {
    setErro('')
    if (f.size > 10 * 1024 * 1024) { setErro('Fonte acima de 10 MB — confira se é mesmo um .ttf/.otf.'); return }
    if (!confirm('Use apenas fontes que você tem licença para usar.\n\nA fonte fica só no seu ateliê — não é compartilhada com ninguém.')) return
    try {
      const familia = `SOA_${Math.random().toString(36).slice(2, 8)}`
      const ff = new FontFace(familia, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff)
      let url = ''
      let assetId: string | null = null
      if (storage && workspaceId) { const up = await enviarArquivo(f, f.name, 'fonte', workspaceId, { pasta: 'Fontes', meta: { familia } }); url = up.url; assetId = up.id; carregarBiblioteca() }
      const id = assetId || Math.random().toString(36).slice(2, 10)
      setCfg(c => ({ ...c, fontesUsuario: [...c.fontesUsuario, { id, familia, url }] }))
      if (selId) atualizar({ fonte: `u:${id}` })
      if (!url) setAviso('Fonte carregada só nesta sessão — com o armazenamento configurado ela fica salva no template.')
    } catch { setErro('Não consegui ler essa fonte. Use arquivo .ttf ou .otf.') }
  }

  // ── dados
  async function lerPlanilha(f: File) {
    setErro('')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false }) as unknown[][]
      setTabPlanilha(tabelaDePlanilha(aoa))
    } catch { setErro('Não consegui ler essa planilha.') }
  }
  const buscarPedidos = useCallback(async () => {
    const d = await fetch(`/api/estudio/pedidos?busca=${encodeURIComponent(buscaPedido)}`).then(r => r.json()).catch(() => ({}))
    setPedidos(d.pedidos || [])
  }, [buscaPedido])
  useEffect(() => { if (origem === 'pedido' && !pedidos.length) buscarPedidos() }, [origem, pedidos.length, buscarPedidos])
  useEffect(() => { if (origem === 'pedido') setRegra(r => (r === '{nome}' ? '{pedido}_{nome}' : r)) }, [origem])

  // ── prévia de N itens
  async function gerarPrevias() {
    if (!molde) return
    await carregarFontes(cfg, resolverFonte)
    const cv = document.createElement('canvas')
    const out: string[] = []
    for (const l of linhas.slice(0, 6)) {
      renderizar(cv, molde.fonte, cfg, l, resolverFonte, { fundo: fundoVar ? l[fundoVar] : null })
      const t = document.createElement('canvas'); const k = 260 / Math.max(cfg.largura, cfg.altura)
      t.width = Math.round(cfg.largura * k); t.height = Math.round(cfg.altura * k)
      t.getContext('2d')!.drawImage(cv, 0, 0, t.width, t.height); out.push(t.toDataURL('image/jpeg', 0.8))
    }
    setPrevias(out)
  }

  // ── gerar lote
  async function gerar() {
    if (!molde || !linhasDaLeva.length) return
    setErro(''); setAviso(''); setFaltam(0); cancelarRef.current = false
    const lote = linhasDaLeva
    const todas = todasAsPaginas()
    // NUNCA dois textos: molde com o texto antigo desenhado exige cobertura em todo campo de texto
    const semCobertura = todas.findIndex(p => p.moldeComTexto && p.caixas.some(c => c.tipo === 'texto' && !c.cobertura))
    if (semCobertura >= 0) { setErro(`O texto antigo ainda está desenhado no molde${todas.length > 1 ? ` (página ${semCobertura + 1})` : ''} e há campo sem cobertura — sairiam os DOIS textos. Ligue a cobertura no campo, ou use “Trocar molde” com a versão limpa (ou o arquivo em camadas).`); return }
    if (todas.some(p => !p.molde)) { setErro('Alguma página está sem o molde carregado.'); return }
    const nPag = todas.length
    // Saldo ANTES de gerar: sem saldo, nem começa (e abre a compra de pacote). Depois, cada leva
    // de artes só é desenhada com autorização (e débito) do servidor.
    try { await exigirSaldo(lote.length * nPag) }
    catch (e) {
      if (e instanceof SemCota) { setFaltam(e.faltam); setErro(e.message) } else setErro((e as Error).message)
      return
    }
    setGerando(true)
    setProgresso({ feitos: 0, total: lote.length * nPag })
    const aut = new Autorizador(lote.length * nPag)
    const ext = formato === 'png' ? 'png' : formato === 'jpg' ? 'jpg' : 'pdf'
    const idsPedido = origem === 'pedido' ? [...new Set(pedidosSel)] : []
    const linhasComPedido = origem === 'pedido' && tabela ? lote.map(l => ({ ...l, pedido: l.Pedido || '' })) : lote
    try {
      const p0 = todas[0]
      const r = await gerarLote({
        molde: p0.molde!, cfg: { ...cfg, largura: p0.largura, altura: p0.altura, pagina: p0.pagina, caixas: p0.caixas },
        paginasExtras: todas.slice(1).map(pg => ({ molde: pg.molde!, cfg: { ...cfg, largura: pg.largura, altura: pg.altura, pagina: pg.pagina, caixas: pg.caixas } })),
        linhas: linhasComPedido, nomes: nomesArquivos(regra, linhasComPedido, ext), formato, resolverFonte, fundoVariavel: fundoVar,
        aoProgredir: (f, total) => setProgresso({ feitos: f, total }), cancelado: () => cancelarRef.current,
        autorizar: i => aut.garantir(i),
      })
      baixar(r.arquivo, r.nome)
      let zipUrl: string | null = null
      if (guardar && storage && workspaceId) {
        try {
          const up = await enviarArquivo(r.arquivo, `${templateNome || 'artes'} - ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.${r.nome.split('.').pop()}`, 'gerado', workspaceId,
            { pasta: 'Artes geradas', pedidoId: idsPedido.length === 1 ? idsPedido[0] : null, meta: { itens: lote.length, formato }, lote: aut.lote })
          zipUrl = up.url
        } catch (e) { setAviso('Artes baixadas, mas não consegui guardar na biblioteca: ' + (e as Error).message) }
      }
      await fetch('/api/estudio/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote: aut.lote, templateId, origem, totalItens: lote.length, formato: r.nome.endsWith('.zip') ? 'zip' : formato, regraNome: regra, status: 'concluido', zipUrl, pedidoId: idsPedido.length === 1 ? idsPedido[0] : null }),
      }).catch(() => {})
      let noDrive = ''
      if (enviarDrive && drive?.conectado) {
        try {
          setProgDrive(0)
          await enviarProDrive(r.arquivo, `${templateNome || 'artes'} - ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')} - ${r.nome}`, { aoProgredir: setProgDrive })
          noDrive = ' e enviada(s) ao seu Google Drive'
        } catch (e) { setAviso('As artes foram geradas, mas o envio ao Drive falhou: ' + (e as Error).message) }
        finally { setProgDrive(null) }
      }
      const resto = partes.length > 1 && leva < partes.length - 1 ? ` Próxima leva: ${partes[leva + 1].inicio + 1}–${partes[leva + 1].fim}.` : ''
      if (!zipUrl) setAviso(a => a || `Pronto! ${lote.length} arte(s) gerada(s) e baixada(s)${noDrive}. ✅${resto}`)
      else setAviso(`Pronto! ${lote.length} arte(s) gerada(s), baixada(s) e guardada(s) em Meus arquivos${noDrive}. ✅${resto}`)
      if (resto) setLeva(l => l + 1)
    } catch (e) {
      if (e instanceof SemCota) { setFaltam(e.faltam); setErro(e.message) }
      else if ((e as Error).message !== 'cancelado') setErro('Falha ao gerar: ' + (e as Error).message)
      else setAviso(`Geração cancelada — ${aut.autorizados} de ${lote.length} já tinham sido liberadas e contaram na cota.`)
    } finally {
      setGerando(false); setCotaVersao(v => v + 1)
    }
  }

  /** Pedido com tema pronto → arte automática (sem configurar caixas). */
  async function gerarAutomatico(p: PedidoFonte, tema: TemaPronto) {
    if (!workspaceId) return
    setErro(''); setAviso(''); setFaltam(0); setAutoGerando(p.id)
    try {
      const { gerarArtesDoTema } = await import('@/lib/estudio/automatico')
      const r = await gerarArtesDoTema({ pedido: p, tema, workspaceId, guardar: !!storage })
      baixar(r.arquivo, r.nome)
      setAviso(`Pedido ${p.numero || ''}: ${r.itens} arte(s) do tema “${tema.temaNome}” pronta(s)${r.url ? ' e anexada(s) ao pedido' : ''}. ✅`)
    } catch (e) {
      if (e instanceof SemCota) { setFaltam(e.faltam); setErro(e.message) } else setErro((e as Error).message)
    } finally { setAutoGerando(null); setCotaVersao(v => v + 1) }
  }

  /** Guarda o ORIGINAL pesado no Google Drive dela (só o link fica no SOA). */
  async function arquivarOriginal() {
    const f = originalRef.current
    if (!f) return
    try {
      setProgDrive(0)
      await enviarProDrive(f, f.name, { registrar: true, pasta: 'Originais (Drive)', copiaAssetId: originalPendente, aoProgredir: setProgDrive })
      setAviso(`Original “${f.name}” guardado no seu Google Drive (pasta SOA Edition). ✅`)
      originalRef.current = null; setOriginalPendente(null)
    } catch (e) { setErro('Não consegui enviar o original ao Drive: ' + (e as Error).message) }
    finally { setProgDrive(null) }
  }

  // ─────────────────────────────────────────────────────────── UI
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      {/* força o navegador a carregar as fontes nativas */}
      <div aria-hidden className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        {CLASSES_PRECARGA.map(c => <span key={c} className={c}>Aa<b>Aa</b><i>Aa</i></span>)}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edição em massa de artes</h1>
          <p className="text-sm text-gray-500">Molde → campos → lista → gerar tudo de uma vez.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={inp + ' w-auto'} value="" onChange={e => abrirTemplate(e.target.value)} title="Abrir template salvo">
            <option value="">📂 Abrir template…</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <input className={inp + ' w-48'} placeholder="Nome do template" value={templateNome} onChange={e => setTemplateNome(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300" title="Tema pronto: aparece no pedido e a arte sai automática">
            <input type="checkbox" checked={ehTema} onChange={e => { setEhTema(e.target.checked); if (e.target.checked && !temaNome) setTemaNome(templateNome) }} className="accent-orange-500" /> Tema pronto
          </label>
          {ehTema && <input className={inp + ' w-40'} placeholder="Nome do tema (ex.: Astronauta)" value={temaNome} onChange={e => setTemaNome(e.target.value)} />}
          <button onClick={salvarTemplate} disabled={!molde || salvando || enviandoMolde}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {templateId ? 'Atualizar' : 'Salvar'} template
          </button>
        </div>
      </div>

      <CotaBarra atualizar={cotaVersao} faltam={faltam} />

      {originalPendente && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 px-3 py-2 text-xs text-sky-900 dark:text-sky-100">
          <HardDrive className="w-4 h-4" />
          <span className="flex-1">Quer guardar o arquivo ORIGINAL (pesado) no seu Google Drive? Aqui fica só a cópia leve de trabalho.</span>
          {drive?.conectado
            ? <button onClick={arquivarOriginal} disabled={progDrive !== null} className="rounded-lg bg-sky-600 text-white px-2.5 py-1 font-semibold disabled:opacity-50">{progDrive !== null ? `Enviando ${Math.round(progDrive * 100)}%` : 'Guardar no meu Drive'}</button>
            : drive?.configurado ? <a href="/api/estudio/drive/conectar" className="rounded-lg bg-sky-600 text-white px-2.5 py-1 font-semibold">Conectar meu Google Drive</a> : null}
          <button onClick={() => { originalRef.current = null; setOriginalPendente(null) }} className="text-sky-700 hover:underline">não precisa</button>
        </div>
      )}

      {storage === false && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>O armazenamento de arquivos ainda não está configurado: dá para montar e gerar as artes normalmente (elas baixam no seu aparelho), mas moldes, fontes e templates não ficam salvos.</span>
        </div>
      )}
      {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex justify-between gap-2"><span>{erro}</span><button onClick={() => setErro('')}><X className="w-4 h-4" /></button></div>}
      {soPrevia && (
        <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-3 flex gap-3 text-sm text-sky-900 dark:text-sky-100">
          {soPrevia.url && <img src={soPrevia.url} alt="Prévia do arquivo" className="w-28 h-28 object-contain rounded-lg bg-white border border-sky-100" />}
          <div className="flex-1 space-y-1">
            <p>{soPrevia.msg}</p>
            <ol className="list-decimal ml-4 text-xs space-y-0.5">{soPrevia.passos.map(p2 => <li key={p2}>{p2}</li>)}</ol>
          </div>
          <button onClick={() => setSoPrevia(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {analisando && <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-200 text-sm px-3 py-2 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lendo a arte (camadas, textos, formato)…</div>}
      {revisao && (
        <RevisaoArte arte={revisao.arte} campos={revisao.campos} fase={revisao.fase} ocupado={lendo} cobertura={cobertura} onCobertura={setCobertura}
          onCampos={cs => setRevisao(r => (r ? { ...r, campos: cs } : r))} onProcurar={procurarTextos} onConfirmar={confirmarCampos} onManual={marcarNaMao} />
      )}
      {aviso && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 flex justify-between gap-2"><span>{aviso}</span><button onClick={() => setAviso('')}><X className="w-4 h-4" /></button></div>}

      {/* ── 1+2: molde e campos */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 p-3 min-h-[360px]">
          <div ref={hostRef} className="w-full flex justify-center">
            <div className={molde ? '' : 'hidden'}><canvas ref={elRef} /></div>
            {!molde && (
              <label className="w-full min-h-[340px] flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:border-orange-400 text-gray-500 text-sm text-center p-6">
                <Upload className="w-8 h-8 text-orange-400" />
                <span className="font-semibold text-gray-700 dark:text-gray-200">Suba o molde da arte</span>
                <span className="text-xs">PSD, PDF, SVG, DXF, AI, PNG ou JPG — com camadas eu leio as camadas; arte achatada eu procuro os textos. (.studio da Silhouette: exporte SVG/PDF/DXF)</span>
                <input type="file" accept=".psd,.psb,.ai,.eps,.cdr,.dxf,.studio,.studio3,.png,.jpg,.jpeg,.webp,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf,image/vnd.adobe.photoshop" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) escolherMolde(f); e.target.value = '' }} />
              </label>
            )}
          </div>
          {nPaginas > 1 && (
            <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1">
              {Array.from({ length: nPaginas }, (_, i) => (
                <button key={i} onClick={() => irPagina(i)} className={`shrink-0 rounded-lg border-2 px-3 py-1.5 text-xs font-medium ${i === paginaIdx ? 'border-orange-500 text-orange-600 bg-white dark:bg-gray-900' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>Página {i + 1}</button>
              ))}
            </div>
          )}
          {molde && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-gray-500">
              <span className="truncate">📄 {moldeNome} · {cfg.largura}×{cfg.altura}px {enviandoMolde && <span className="text-orange-600">· guardando…</span>}</span>
              <label className="cursor-pointer text-orange-600 hover:underline">Trocar molde
                <input type="file" accept=".psd,.psb,.ai,.eps,.cdr,.dxf,.studio,.studio3,.png,.jpg,.jpeg,.webp,.svg,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) escolherMolde(f); e.target.value = '' }} />
              </label>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4 lg:max-h-[78vh] lg:overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Campos</p>
              <button disabled={!molde || lendo} onClick={procurarTextos} className="text-[11px] inline-flex items-center gap-1 text-orange-600 hover:underline disabled:opacity-40" title="Encontra os textos da arte e sugere os campos">
                {lendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />} Procurar textos
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CAMPOS_PRONTOS.map(c => (
                <button key={c} disabled={!molde} onClick={() => adicionarCampo(c)}
                  className="text-xs inline-flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-40">
                  {c === '{foto}' ? <ImagePlus className="w-3 h-3" /> : <Plus className="w-3 h-3" />} {c}
                </button>
              ))}
              <button disabled={!molde} onClick={() => adicionarCampo('{campo}')}
                className="text-xs inline-flex items-center gap-1 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 hover:border-orange-400 disabled:opacity-40">
                <Type className="w-3 h-3" /> outro
              </button>
            </div>
            {!!cfg.caixas.length && (
              <div className="mt-2 space-y-1">
                {cfg.caixas.map(c => (
                  <button key={c.id} onClick={() => { const r = rectsRef.current.get(c.id); if (r && fabRef.current) { fabRef.current.setActiveObject(r); fabRef.current.requestRenderAll() } setSelId(c.id) }}
                    className={`w-full text-left text-xs rounded-lg px-2 py-1 truncate ${selId === c.id ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    {c.tipo === 'imagem' ? '🖼️' : '🔤'} {c.texto}
                  </button>
                ))}
              </div>
            )}
          </div>

          {sel ? (
            <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
              <div>
                <label className={lbl}>Texto da caixa <span className="text-gray-400">(use {'{variáveis}'})</span></label>
                <input className={inp} value={sel.texto} onChange={e => atualizar({ texto: e.target.value })} />
                <p className="text-[10px] text-gray-400 mt-0.5">Filtros: {'{nome|'}{NOMES_FILTROS.join('|')}{'}'} — ex.: {'#{nome|minusculas|semespaco}faz{idade}'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={lbl + ' !mb-0'}>Giro {sel.rotacao || 0}°</span>
                <button onClick={() => atualizar({ rotacao: ((((sel.rotacao || 0) - 90) + 540) % 360) - 180 })} className="p-1 rounded border border-gray-200 dark:border-gray-700" title="Girar −90°"><RotateCcw className="w-3.5 h-3.5" /></button>
                <button onClick={() => atualizar({ rotacao: ((((sel.rotacao || 0) + 90) + 540) % 360) - 180 })} className="p-1 rounded border border-gray-200 dark:border-gray-700" title="Girar +90°"><RotateCw className="w-3.5 h-3.5" /></button>
                <input type="range" min={-180} max={180} value={sel.rotacao || 0} onChange={e => atualizar({ rotacao: Number(e.target.value) })} className="flex-1 accent-orange-500" />
              </div>
              <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-1.5">
                <label className={lbl}>Cobertura do texto antigo <span className="text-gray-400">(só se o molde não for limpo)</span></label>
                <select className={inp} value={sel.cobertura?.modo || ''} onChange={e => atualizar({ cobertura: e.target.value ? { modo: e.target.value as 'entorno', cor: sel.cobertura?.cor || '#ffffff', dx: sel.cobertura?.dx || 0, dy: sel.cobertura?.dy || Math.round(sel.h * 1.2), folga: sel.cobertura?.folga ?? 10 } : null })}>
                  <option value="">Nenhuma (molde limpo)</option><option value="entorno">Cores do entorno</option><option value="cor">Cor sólida</option><option value="remendo">Remendo (copiar um pedaço do lado)</option>
                </select>
                {sel.cobertura && (
                  <div className="grid grid-cols-2 gap-x-2">
                    <label className="text-[10px] text-gray-500">Folga {sel.cobertura.folga}%
                      <input type="range" min={0} max={40} value={sel.cobertura.folga} onChange={e => atualizar({ cobertura: { ...sel.cobertura!, folga: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
                    {sel.cobertura.modo === 'cor' && <label className="text-[10px] text-gray-500">Cor <input type="color" value={sel.cobertura.cor} onChange={e => atualizar({ cobertura: { ...sel.cobertura!, cor: e.target.value } })} className="w-8 h-6 rounded border border-gray-200 align-middle" /></label>}
                    {sel.cobertura.modo === 'remendo' && <>
                      <label className="text-[10px] text-gray-500">Pegar de ↔ {sel.cobertura.dx}px
                        <input type="range" min={-Math.round(cfg.largura / 3)} max={Math.round(cfg.largura / 3)} value={sel.cobertura.dx} onChange={e => atualizar({ cobertura: { ...sel.cobertura!, dx: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
                      <label className="text-[10px] text-gray-500">Pegar de ↕ {sel.cobertura.dy}px
                        <input type="range" min={-Math.round(cfg.altura / 3)} max={Math.round(cfg.altura / 3)} value={sel.cobertura.dy} onChange={e => atualizar({ cobertura: { ...sel.cobertura!, dy: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
                    </>}
                  </div>
                )}
              </div>
              {sel.tipo === 'texto' && (
                <>
                  <div className="grid grid-cols-[1fr_72px] gap-2">
                    <div>
                      <label className={lbl}>Fonte</label>
                      <select className={inp} value={sel.fonte} onChange={e => atualizar({ fonte: e.target.value })}>
                        {FONTES_NATIVAS.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                        {!!cfg.fontesUsuario.length && <optgroup label="Neste template">
                          {cfg.fontesUsuario.map((f, i) => <option key={f.id} value={`u:${f.id}`}>{biblioteca.find(b => b.id === f.id)?.nome.replace(/\.(ttf|otf)$/i, '') || `Minha fonte ${i + 1}`}</option>)}
                        </optgroup>}
                      </select>
                      {biblioteca.some(b => !cfg.fontesUsuario.some(f => f.id === b.id)) && (
                        <select className={inp + ' mt-1 !text-xs'} value="" onChange={e => { if (e.target.value) usarFonteBiblioteca(e.target.value) }}>
                          <option value="">+ da minha biblioteca…</option>
                          {biblioteca.filter(b => !b.acervo && !cfg.fontesUsuario.some(f => f.id === b.id)).map(b => <option key={b.id} value={b.id}>{b.nome.replace(/\.(ttf|otf)$/i, '')}</option>)}
                          {biblioteca.some(b => b.acervo) && <optgroup label="Acervo SOA (licença aberta)">
                            {biblioteca.filter(b => b.acervo && !cfg.fontesUsuario.some(f => f.id === b.id)).map(b => <option key={b.id} value={b.id}>{b.nome.replace(/\.(ttf|otf)$/i, '')}</option>)}
                          </optgroup>}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className={lbl}>Tamanho</label>
                      <input className={inp} type="text" inputMode="numeric" value={sel.tamanho} onChange={e => atualizar({ tamanho: Math.max(4, Number(e.target.value.replace(/\D/g, '')) || 4) })} />
                    </div>
                  </div>
                  <label className="text-xs text-orange-600 hover:underline cursor-pointer inline-block">+ enviar fonte (.ttf / .otf)
                    <input type="file" accept=".ttf,.otf,font/ttf,font/otf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) enviarFonte(f); e.target.value = '' }} />
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={sel.cor} onChange={e => atualizar({ cor: e.target.value })} className="w-9 h-8 rounded border border-gray-200 cursor-pointer" title="Cor" />
                    {(['left', 'center', 'right'] as const).map(a => {
                      const I = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                      return <button key={a} onClick={() => atualizar({ alinhamento: a })} className={`p-1.5 rounded border ${sel.alinhamento === a ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'}`}><I className="w-4 h-4" /></button>
                    })}
                    <button onClick={() => atualizar({ negrito: !sel.negrito })} className={`p-1.5 rounded border ${sel.negrito ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'}`} title="Negrito"><Bold className="w-4 h-4" /></button>
                    <button onClick={() => atualizar({ italico: !sel.italico })} className={`p-1.5 rounded border ${sel.italico ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'}`} title="Itálico"><Italic className="w-4 h-4" /></button>
                    <button onClick={() => atualizar({ maiusculas: !sel.maiusculas })} className={`p-1.5 rounded border ${sel.maiusculas ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-200 dark:border-gray-700'}`} title="MAIÚSCULAS"><CaseUpper className="w-4 h-4" /></button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={sel.autoAjuste} onChange={e => atualizar({ autoAjuste: e.target.checked })} className="accent-orange-500" />
                    Auto-ajuste (nome longo encolhe e quebra para caber)
                  </label>
                  <div>
                    <label className={lbl}>Curvatura: {sel.curvatura}° {sel.curvatura === 0 ? '(reto)' : sel.curvatura > 0 ? '(arco p/ cima)' : '(arco p/ baixo)'}</label>
                    <input type="range" min={-270} max={270} step={5} value={sel.curvatura} onChange={e => atualizar({ curvatura: Number(e.target.value) })} className="w-full accent-orange-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <input type="checkbox" checked={!!sel.contorno} onChange={e => atualizar({ contorno: e.target.checked ? { cor: '#ffffff', largura: Math.max(2, Math.round(sel.tamanho * 0.06)) } : null })} className="accent-orange-500" /> Contorno
                      </label>
                      {sel.contorno && (
                        <div className="flex items-center gap-1">
                          <input type="color" value={sel.contorno.cor} onChange={e => atualizar({ contorno: { ...sel.contorno!, cor: e.target.value } })} className="w-8 h-7 rounded border border-gray-200" />
                          <input className={inp + ' !py-1'} inputMode="numeric" value={sel.contorno.largura} onChange={e => atualizar({ contorno: { ...sel.contorno!, largura: Number(e.target.value.replace(/\D/g, '')) || 0 } })} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <input type="checkbox" checked={!!sel.sombra} onChange={e => atualizar({ sombra: e.target.checked ? { cor: 'rgba(0,0,0,0.45)', blur: 8, dx: 3, dy: 3 } : null })} className="accent-orange-500" /> Sombra
                      </label>
                      {sel.sombra && (
                        <div className="flex items-center gap-1">
                          <input type="color" value={sel.sombra.cor.startsWith('#') ? sel.sombra.cor : '#000000'} onChange={e => atualizar({ sombra: { ...sel.sombra!, cor: e.target.value } })} className="w-8 h-7 rounded border border-gray-200" />
                          <input className={inp + ' !py-1'} inputMode="numeric" title="Desfoque" value={sel.sombra.blur} onChange={e => atualizar({ sombra: { ...sel.sombra!, blur: Number(e.target.value.replace(/\D/g, '')) || 0 } })} />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {sel.tipo === 'imagem' && <p className="text-xs text-gray-500">Caixa de foto: a coluna ligada a <b>{'{foto}'}</b> deve trazer o link da imagem.</p>}
              <button onClick={removerCampo} className="text-xs text-red-600 inline-flex items-center gap-1 hover:underline"><Trash2 className="w-3.5 h-3.5" /> Remover campo</button>
            </div>
          ) : molde && <p className="text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">Clique numa caixa para editar fonte, cor, curvatura…</p>}
        </div>
      </div>

      {/* ── 3: dados */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">De onde vem a lista?</p>
          <div className="flex gap-1">
            {([['colar', 'Colar lista', ClipboardList], ['xlsx', 'Planilha', FileSpreadsheet], ['pedido', 'De um pedido', ShoppingBag]] as const).map(([k, t, I]) => (
              <button key={k} onClick={() => setOrigem(k)} className={`text-xs inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 border ${origem === k ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                <I className="w-3.5 h-3.5" /> {t}
              </button>
            ))}
          </div>
        </div>

        {origem === 'colar' && (
          <div className="space-y-2">
            <textarea className={inp + ' min-h-[110px] font-mono text-xs'} value={textoColado} onChange={e => setTextoColado(e.target.value)}
              placeholder={'Um por linha. Pode colar colunas do Excel também:\nMaria Eduarda\t5\nJoão Pedro\t7'} />
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={cabecalho} onChange={e => setCabecalho(e.target.checked)} className="accent-orange-500" /> A primeira linha é o cabeçalho</label>
          </div>
        )}
        {origem === 'xlsx' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl px-3 py-3 cursor-pointer hover:border-orange-400">
            <FileSpreadsheet className="w-5 h-5 text-orange-500" />
            {tabPlanilha ? `${tabPlanilha.linhas.length} linha(s) · colunas: ${tabPlanilha.cabecalhos.join(', ')}` : 'Escolher planilha (.xlsx ou .csv) — a 1ª linha deve ter os nomes das colunas'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) lerPlanilha(f); e.target.value = '' }} />
          </label>
        )}
        {origem === 'pedido' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className={inp} placeholder="Buscar pedido por número, cliente ou produto" value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') buscarPedidos() }} />
              <button onClick={buscarPedidos} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3">Buscar</button>
            </div>
            <div className="max-h-52 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
              {!pedidos.length && <p className="text-xs text-gray-400 p-3">Nenhum pedido encontrado.</p>}
              {pedidos.map(p => (
                <label key={p.id} className="flex items-start gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input type="checkbox" className="mt-0.5 accent-orange-500" checked={pedidosSel.includes(p.id)} onChange={e => setPedidosSel(s => e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id))} />
                  <span className="min-w-0">
                    <b className="text-gray-800 dark:text-gray-100">{p.numero || 's/ nº'}</b> · {p.destinatario} · <span className="text-gray-500">{p.produto}</span>
                    {!!Object.keys(p.campos).length && <span className="block text-gray-400 truncate">{Object.entries(p.campos).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>}
                  </span>
                  {(() => {
                    const t = temaDoPedido(p.campos, temas)
                    if (!t) return p.campos.Tema ? <span className="ml-auto text-[10px] text-amber-600 whitespace-nowrap" title="Tema sem modelo pronto">sem modelo</span> : null
                    return (
                      <button onClick={e => { e.preventDefault(); gerarAutomatico(p, t) }} disabled={!!autoGerando}
                        className="ml-auto flex-shrink-0 inline-flex items-center gap-1 rounded-lg bg-orange-500 text-white px-2 py-1 text-[11px] font-semibold disabled:opacity-50" title={`Tema pronto: ${t.temaNome}`}>
                        {autoGerando === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <WandSparkles className="w-3 h-3" />} {t.temaNome}
                      </button>
                    )
                  })()}
                </label>
              ))}
            </div>
            {tabela && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                Uma arte para cada item do campo
                <select className={inp + ' w-auto !py-1'} value={expandir} onChange={e => setExpandir(e.target.value)}>
                  <option value="">— uma por pedido —</option>
                  {tabela.cabecalhos.slice(5).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-gray-400">(para quando o pedido traz vários nomes, um por linha ou separados por ";")</span>
              </div>
            )}
          </div>
        )}

        {/* mapeamento */}
        {tabela && !!variaveis.length && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            {variaveis.map(v => (
              <div key={v}>
                <label className={lbl}>{'{' + v + '}'} vem da coluna</label>
                <select className={inp} value={mapa[v] || ''} onChange={e => setMapa(m => ({ ...m, [v]: e.target.value }))}>
                  <option value="">— nenhuma —</option>
                  {tabela.cabecalhos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* variações */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Variações <span className="font-normal text-gray-400">— combina cada item com cada valor (ex.: nome × cor)</span></p>
            <button onClick={() => setVariacoes(v => [...v, { variavel: variaveis.find(x => !v.some(y => y.variavel === x)) || 'fundo', valores: [] }])} className="text-xs text-orange-600 hover:underline">+ variação</button>
          </div>
          {variacoes.map((va, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className={inp + ' w-auto'} value={va.variavel} onChange={e => setVariacoes(vs => vs.map((x, j) => j === i ? { ...x, variavel: e.target.value } : x))}>
                {variaveis.map(v => <option key={v} value={v}>{'{' + v + '}'}</option>)}
                <option value="fundo">cor de fundo</option>
              </select>
              <input className={inp + ' flex-1 min-w-[200px]'} placeholder={va.variavel === 'fundo' ? 'Ex.: #fce7f3, #dbeafe, #fef9c3' : 'Valores separados por vírgula'}
                defaultValue={va.valores.join(', ')} onBlur={e => setVariacoes(vs => vs.map((x, j) => j === i ? { ...x, valores: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x))} />
              <button onClick={() => setVariacoes(vs => vs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
          <span className="text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-2">
            <span><b>{linhas.length}</b> arte(s) na lista{cortado && <span className="text-amber-600"> · lista limitada a {LIMITE_LISTA}</span>}</span>
            {partes.length > 1 && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                · máximo de {LIMITE_LOTE} por vez — gere em levas:
                <select className={inp + ' w-auto !py-0.5 !text-xs'} value={leva} onChange={e => setLeva(Number(e.target.value))}>
                  {partes.map((p, i) => <option key={i} value={i}>{p.inicio + 1}–{p.fim}</option>)}
                </select>
              </span>
            )}
          </span>
          <button onClick={gerarPrevias} disabled={!molde || !linhas.length} className="text-xs inline-flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 disabled:opacity-40"><WandSparkles className="w-3.5 h-3.5" /> Ver prévia</button>
        </div>
        {!!previas.length && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {previas.map((src, i) => <img key={i} src={src} alt={`Prévia ${i + 1}`} className="h-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white" />)}
          </div>
        )}
      </div>

      {/* ── 4: gerar */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] items-end">
          <div>
            <label className={lbl}>Formato</label>
            <select className={inp} value={formato} onChange={e => setFormato(e.target.value as Formato)}>
              <option value="png">PNG (um por arte)</option>
              <option value="jpg">JPG (um por arte)</option>
              <option value="pdf-individual">PDF (um por arte)</option>
              <option value="pdf-unico">PDF único (para imprimir)</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Nome dos arquivos <span className="text-gray-400">— ex.: {'{pedido}_{nome}'} · {'{n}'} = número</span></label>
            <input className={inp} value={regra} onChange={e => setRegra(e.target.value)} disabled={formato === 'pdf-unico'} />
          </div>
          {!gerando ? (
            <button onClick={gerar} disabled={!molde || !linhasDaLeva.length}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
              <Download className="w-4 h-4" /> Gerar {linhasDaLeva.length || ''} arte(s)
            </button>
          ) : (
            <button onClick={() => { cancelarRef.current = true }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2 text-sm">Cancelar</button>
          )}
        </div>
        {storage && (
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={guardar} onChange={e => setGuardar(e.target.checked)} className="accent-orange-500" />
            Guardar também em Meus arquivos {origem === 'pedido' && pedidosSel.length === 1 && '(e anexar ao pedido)'}
          </label>
        )}
        {drive?.conectado ? (
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={enviarDrive} onChange={e => setEnviarDrive(e.target.checked)} className="accent-orange-500" />
            Enviar também para o meu Google Drive <span className="text-gray-400">({drive.email || 'conectado'})</span>
            {progDrive !== null && <span className="text-sky-600">· enviando {Math.round(progDrive * 100)}%</span>}
          </label>
        ) : drive?.configurado ? (
          <a href="/api/estudio/drive/conectar" className="text-xs text-sky-700 dark:text-sky-300 hover:underline inline-flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> Conectar meu Google Drive</a>
        ) : null}
        {gerando && (
          <div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div className="h-full bg-orange-500 transition-all" style={{ width: `${progresso.total ? (progresso.feitos / progresso.total) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{progresso.feitos} de {progresso.total} · gerando no seu aparelho — pode continuar usando a tela</p>
          </div>
        )}
      </div>
    </div>
  )
}
