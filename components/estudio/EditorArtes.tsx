'use client'
// SOA Edition — Edição em massa de artes (Fase 1).
// Fluxo: molde → caixas de campo sobre o molde → dados (colar / planilha / pedido) →
// variações → prévia → gerar o lote (PNG/JPG/PDF individual, PDF único, ZIP).
//
// Fabric cuida SÓ da interação (arrastar/redimensionar caixas). O desenho do texto é do
// renderizador único (lib/estudio/render) — o mesmo que gera o lote, então a prévia é fiel.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Canvas, Rect, FabricImage } from 'fabric'
import {
  Upload, Plus, Trash2, Save, Type, ImagePlus, Loader2, X,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, CaseUpper, AlertTriangle, HardDrive,
  ScanText, RotateCw, RotateCcw,
} from 'lucide-react'
import RevisaoArte, { type ModoCobertura } from './RevisaoArte'
import { ArquivoSoPrevia, importarArte, camposDoOcr, caixasDosCampos, camadasDosCampos, refinarCores, acharFonte, type ArteImportada, type CampoDetectado } from '@/lib/estudio/importarArte'
import { NOMES_FILTROS, type PaginaTemplate } from '@/lib/estudio/tipos'
import { FONTES_NATIVAS, CLASSES_PRECARGA } from './fontesNativas'
import { novaCaixa, type Caixa, type ConfigTemplate, type Linha } from '@/lib/estudio/tipos'
import { renderizar, carregarFontes } from '@/lib/estudio/render'
import { chaveRascunho, guardarRascunho, lerRascunho, marcarSincronizado, apagarRascunho, recuo, ehErroDeRede } from '@/lib/estudio/rascunho'
import {
  carregarMolde, copiaDoCanvas, enviarArquivo, enviarProDrive,
  type Molde,
} from '@/lib/estudio/cliente'
import { registrarFonte, analisarFonte, familiaDoArquivo, nomeDaFonte, EXTENSOES_FONTE } from '@/lib/estudio/fontes'

const AMOSTRA: Linha = { nome: 'Maria Eduarda', idade: '5', turma: 'Jardim II', data: '12/10', tema: 'Jardim encantado' }
const CAMPOS_PRONTOS = ['{nome}', '{idade}', '{turma}', '{data}', '{foto}']

const cfgVazia = (): ConfigTemplate => ({ versao: 1, largura: 1000, altura: 1000, caixas: [], fontesUsuario: [], pagina: { larguraPt: 240, alturaPt: 240 } })

const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-1'

type RascunhoTpl = { cfg: ConfigTemplate; templateNome: string; temaNome: string; ehTema: boolean; pagina: number }

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
  const [leitura, setLeitura] = useState<{ nome: string; mb: number; feitas: number; total: number } | null>(null)
  const [originalPendente, setOriginalPendente] = useState<string | null>(null)
  const [drive, setDrive] = useState<{ configurado: boolean; conectado: boolean; email: string | null } | null>(null)
  const [progDrive, setProgDrive] = useState<number | null>(null)
  const [biblioteca, setBiblioteca] = useState<{ id: string; nome: string; url: string; familia: string | null; acervo: boolean }[]>([])
  const [salvando, setSalvando] = useState(false)
  // AUTO-SALVAMENTO (template já salvo uma vez): 2 s depois de cada mudança; rascunho local no IndexedDB
  const [auto, setAuto] = useState<'salvo' | 'pendente' | 'salvando' | 'offline' | 'erro' | null>(null)
  const [autoEm, setAutoEm] = useState<Date | null>(null)
  const autoRef = useRef(auto); autoRef.current = auto
  const baseRef = useRef('')                 // assinatura do último estado salvo/aberto
  const abriuRef = useRef(false)             // acabou de abrir → a próxima assinatura é a base, não "mudança"
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tentativaRef = useRef(0)
  const [recuperarTpl, setRecuperarTpl] = useState<{ em: number; dados: RascunhoTpl } | null>(null)
  const [selId, setSelId] = useState<string | null>(null)
  const sel = cfg.caixas.find(c => c.id === selId) || null

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
    if (!(await registrarFonte(f.familia, f.url))) { setErro('Não consegui carregar essa fonte.'); return }
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

  // ── prévia no editor = o template com um nome de exemplo (a lista fica na Edição em massa)
  const fundoVar: string | null = null
  const amostra: Linha = AMOSTRA

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
    setLeitura({ nome: f.name, mb: f.size / 1048576, feitas: 0, total: 0 })
    let arte: ArteImportada
    try { arte = await importarArte(f, 1, (feitas, total) => setLeitura(l => l && { ...l, feitas, total })) }
    catch (e) {
      setAnalisando(false); setLeitura(null)
      if (e instanceof ArquivoSoPrevia) { setSoPrevia({ url: e.miniatura ? URL.createObjectURL(e.miniatura) : null, msg: e.message, passos: e.passos }); return }
      setErro((e as Error).message || 'Não consegui abrir esse arquivo.'); return
    }
    setAnalisando(false); setLeitura(null)
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
          await registrarFonte(lib0.familia, lib0.url)
          if (!cfg.fontesUsuario.some(x => x.id === lib0.id) && !novasFontes.some(x => x.id === lib0.id)) novasFontes.push({ id: lib0.id, familia: lib0.familia, url: lib0.url })
          saida.push({ ...c, fonteId: `u:${lib0.id}` }); continue
        }
      }
      if (fe?.dados?.length) {
        const familia = `PDF_${fe.nome.replace(/[^\w]/g, '').slice(0, 24)}_${fe.dados.length}`
        let f = novasFontes.find(x => x.familia === familia) || cfg.fontesUsuario.find(x => x.familia === familia)
        if (!f) {
          try {
            if (!(await registrarFonte(familia, fe.dados as ArrayBufferView))) throw new Error('fonte embutida ilegível')
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
        await registrarFonte(lib.familia, lib.url)
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
        await registrarFonte(f.familia, f.url)
      }
      const m = await carregarMolde(t.moldeUrl, t.moldeMime)
      moldeUrlRef.current = t.moldeUrl
      const extras = await Promise.all((conf.paginas || []).map(async pg => ({ ...pg, molde: pg.moldeUrl ? await carregarMolde(pg.moldeUrl) : null })))
      paginasRef.current = extras.length ? [{ molde: m, moldeAssetId: t.moldeAssetId, moldeUrl: t.moldeUrl, largura: m.largura, altura: m.altura, pagina: conf.pagina, caixas: conf.caixas, moldeComTexto: conf.moldeComTexto }, ...extras] : []
      setNPaginas(Math.max(1, paginasRef.current.length)); setPaginaIdx(0)
      setMolde(m); setMoldeNome(t.nome); setMoldeAssetId(t.moldeAssetId); setTemplateId(t.id); setTemplateNome(t.nome)
      setEhTema(!!t.temaNome); setTemaNome(t.temaNome || '')
      abriuRef.current = true; setAuto('salvo'); setAutoEm(t.updatedAt ? new Date(t.updatedAt) : null)
      setCfg({ ...conf, largura: m.largura, altura: m.altura }); setSelId(null)
      const uid = (session?.user as { id?: string } | undefined)?.id
      if (uid) {
        const r = await lerRascunho<RascunhoTpl>(chaveRascunho(uid, 'template', t.id))
        if (r && !r.sincronizado && r.dados.pagina === 0 && r.em > (t.updatedAt ? new Date(t.updatedAt).getTime() : 0)) setRecuperarTpl({ em: r.em, dados: r.dados })
      }
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
    const q = new URLSearchParams(window.location.search)
    if (q.get('especial')) abrirEspecial(q.get('especial')!)
    else if (q.get('id')) abrirTemplate(q.get('id')!)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarTemplate(silencioso = false) {
    if (!moldeAssetId && !especialId) { if (!silencioso) setErro(storage ? 'Aguarde o molde terminar de enviar.' : 'Para salvar templates, o armazenamento precisa estar configurado.'); return }
    if (!templateNome.trim()) { if (!silencioso) setErro('Dê um nome ao template.'); return }
    if (ehTema && !temaNome.trim()) { if (!silencioso) setErro('Dê um nome ao tema (ex.: Astronauta).'); return }
    const assinaturaAgora = assinatura, inicio = Date.now()
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null }
    if (silencioso) setAuto('salvando'); else { setSalvando(true); setErro('') }
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
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { const e = new Error(j.error || 'Falha ao salvar') as Error & { status?: number }; e.status = r.status; throw e }
      if (!templateId) setTemplateId(j.id)
      baseRef.current = assinaturaAgora; tentativaRef.current = 0
      setAuto('salvo'); setAutoEm(new Date())
      const uid = (session?.user as { id?: string } | undefined)?.id
      if (uid && (templateId || j.id)) void marcarSincronizado(chaveRascunho(uid, 'template', templateId || j.id), inicio)
      if (!silencioso) {
        setAviso('Template salvo ✅')
        fetch('/api/estudio/templates').then(x => x.json()).then(d => setTemplates(d.templates || []))
      }
    } catch (e) {
      const st = (e as { status?: number }).status
      if (silencioso && ((!st && ehErroDeRede(e)) || (st && st >= 500))) {
        setAuto(!st ? 'offline' : 'erro')
        const t = tentativaRef.current++
        autoTimer.current = setTimeout(() => salvarRef.current(true), recuo(t))
      } else { setAuto(templateId ? 'erro' : null); setErro((e as Error).message) }
    } finally { if (!silencioso) setSalvando(false) }
  }
  const salvarRef = useRef(salvarTemplate); salvarRef.current = salvarTemplate

  // ── AUTO-SALVAMENTO ──
  const assinatura = JSON.stringify({ cfg, templateNome, temaNome, ehTema })
  useEffect(() => {
    if (!templateId || !molde) return
    if (abriuRef.current) { abriuRef.current = false; baseRef.current = assinatura; return }
    if (assinatura === baseRef.current) return
    setAuto('pendente')
    const uid = (session?.user as { id?: string } | undefined)?.id
    if (uid) void guardarRascunho<RascunhoTpl>(chaveRascunho(uid, 'template', templateId), { cfg, templateNome, temaNome, ehTema, pagina: paginaIdx })
    if (autoTimer.current) clearTimeout(autoTimer.current)
    autoTimer.current = setTimeout(() => salvarRef.current(true), 2000)
  }, [assinatura]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sair = (e: BeforeUnloadEvent) => { if (autoRef.current && autoRef.current !== 'salvo') { void salvarRef.current(true); e.preventDefault() } }
    const voltou = () => { if (autoRef.current === 'offline' || autoRef.current === 'erro') { tentativaRef.current = 0; void salvarRef.current(true) } }
    window.addEventListener('beforeunload', sair); window.addEventListener('online', voltou)
    return () => { window.removeEventListener('beforeunload', sair); window.removeEventListener('online', voltou) }
  }, [])
  function restaurarTpl() {
    const r = recuperarTpl; if (!r) return
    setRecuperarTpl(null)
    setTemplateNome(r.dados.templateNome); setTemaNome(r.dados.temaNome); setEhTema(r.dados.ehTema)
    setCfg(c => ({ ...r.dados.cfg, largura: c.largura, altura: c.altura }))
    setAviso('Alterações recuperadas — já estão sendo salvas.')
  }
  const autoTxt = auto === 'salvo' ? (autoEm ? `Salvo às ${autoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Salvo')
    : auto === 'pendente' ? 'Alterações não salvas…' : auto === 'salvando' ? 'Salvando…' : auto === 'offline' ? 'Sem conexão — salvo neste aparelho' : auto === 'erro' ? 'Erro ao salvar — tentando de novo' : ''

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
    if (!EXTENSOES_FONTE.test(f.name)) { setErro('Use um arquivo de fonte: .ttf, .otf ou .woff.'); return }
    let aceito = false
    try { aceito = localStorage.getItem('soa:fonte-licenca') === '1' } catch { /* sem storage */ }
    if (!aceito) {
      if (!confirm('Use apenas fontes que você tem licença para usar.\n\nA fonte fica só no seu ateliê — não é compartilhada com ninguém.')) return
      try { localStorage.setItem('soa:fonte-licenca', '1') } catch { /* segue */ }
    }
    try {
      const buf = await f.arrayBuffer()
      const info = await analisarFonte(buf).catch(e => { setErro((e as Error).message); return null })
      if (!info) return
      const familia = familiaDoArquivo(info), nome = nomeDaFonte(info, f.name)
      const ja = biblioteca.find(b => b.familia === familia)
      if (!(await registrarFonte(familia, ja?.url || buf))) throw new Error('fonte')
      let url = ja?.url || ''
      let assetId: string | null = ja?.id || null
      if (!ja && storage && workspaceId) { const up = await enviarArquivo(f, `${nome}.${f.name.split('.').pop()!.toLowerCase()}`, 'fonte', workspaceId, { pasta: 'Fontes', meta: { familia, nomeFonte: nome, hash: info.hash, formato: info.formato } }); url = up.url; assetId = up.id; carregarBiblioteca() }
      const id = assetId || Math.random().toString(36).slice(2, 10)
      setCfg(c => ({ ...c, fontesUsuario: [...c.fontesUsuario, { id, familia, url }] }))
      if (selId) atualizar({ fonte: `u:${id}` })
      if (!url) setAviso('Fonte carregada só nesta sessão — com o armazenamento configurado ela fica salva no template.')
    } catch { setErro('Não consegui ler essa fonte. Use arquivo .ttf ou .otf.') }
  }

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
          <a href="/estudio/templates" className="text-sm text-gray-500 hover:text-orange-600">← Templates</a>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{templateId ? 'Editar template' : 'Criar template'}</h1>
          <p className="text-sm text-gray-500">Suba a arte (em camadas, de preferência) → confirme os campos {'{nome}'}/{'{idade}'} com a fonte do arquivo → salve. Depois é só usar na Edição em massa.</p>
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
          {autoTxt && <span data-status={auto} className={`text-xs ${auto === 'salvo' ? 'text-emerald-600' : auto === 'offline' ? 'text-amber-600' : auto === 'erro' ? 'text-red-600' : 'text-gray-400'}`}>{autoTxt}</span>}
          <button onClick={() => salvarTemplate()} disabled={!molde || salvando || enviandoMolde}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {templateId ? 'Atualizar' : 'Salvar'} template
          </button>
        </div>
      </div>


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
      {recuperarTpl && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm px-3 py-2 flex flex-wrap items-center gap-2" role="alert">
          <span className="flex-1">Recuperamos alterações <b>não salvas</b> deste template, feitas neste aparelho em {new Date(recuperarTpl.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Restaurar?</span>
          <button onClick={restaurarTpl} className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 text-xs font-semibold">Restaurar</button>
          <button onClick={() => { const uid = (session?.user as { id?: string } | undefined)?.id; if (uid && templateId) void apagarRascunho(chaveRascunho(uid, 'template', templateId)); setRecuperarTpl(null) }} className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs">Descartar</button>
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
      {analisando && (
        <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-200 text-sm px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="truncate">
              {!leitura?.total ? `Lendo o arquivo${leitura ? ` “${leitura.nome}” (${leitura.mb >= 1 ? `${leitura.mb.toFixed(0)} MB` : 'menos de 1 MB'})` : ''}…`
                : leitura.feitas < leitura.total ? `Separando as camadas… ${leitura.feitas}/${leitura.total}` : 'Montando a arte…'}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-orange-200/70 dark:bg-orange-900/60 overflow-hidden">
            <div className={`h-full bg-orange-500 transition-[width] duration-300 ${leitura?.total ? '' : 'w-1/4 animate-pulse'}`} style={leitura?.total ? { width: `${Math.max(3, (leitura.feitas / leitura.total) * 100)}%` } : undefined} />
          </div>
          {leitura && leitura.mb > 150 && <p className="text-[11px] opacity-80">Arquivo grande: pode levar alguns minutos. Ele é lido aqui no seu aparelho — não sobe inteiro para o servidor.</p>}
        </div>
      )}
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

      {/* ── pronto: a produção é na Edição em massa (este editor só PREPARA o template) */}
      <div className="rounded-2xl border border-orange-200 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/20 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{templateId ? 'Template salvo — pronto para produzir' : 'Salve o template para usar na Edição em massa'}</p>
          <p className="text-xs text-gray-500">Aqui você prepara uma vez (arte, campos, fontes, efeitos). A lista de nomes e a exportação ficam na Edição em massa.</p>
        </div>
        {templateId
          ? <a href={`/estudio/artes?template=${templateId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold">Usar na Edição em massa →</a>
          : <button onClick={() => salvarTemplate()} disabled={!molde || salvando || enviandoMolde} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Salvar template</button>}
      </div>
    </div>
  )
}
