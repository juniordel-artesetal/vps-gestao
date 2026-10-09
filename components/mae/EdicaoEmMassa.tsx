'use client'
'use no memo'
// PEDIDOS E EDIÇÃO EM MASSA do Método MAE — mesma cara da Edição em massa do SOA Design (passos em
// cartões, dentro do menu do SOA): 1 escolher os pedidos (agrupados por tema), 2 conferir nome/idade/
// hashtag/tema na linha, 3 formato e pastas, 4 gerar tudo (fila no computador, barra de progresso, resumo,
// "Juntar num PDF só por produto"). Lote 4 (itens 43/44): a linha do pedido abre a edição ali mesmo (NOME,
// IDADE, TEMA; Tab/Enter) e os arquivos vão para Exportações/AAAA-MM-DD/<Produto>/ — um por produto do
// pedido. O card de cada pedido passa a mostrar "Arte gerada ✓".
import Deslizador from './Deslizador'
import DicasMae from './Dicas'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Download, Square, Check, AlertTriangle, XCircle, Eye, Link2, FileStack, FolderOpen, RefreshCw, Palette, ClipboardList } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { escolherPasta, pastaSalva, permissao, reconectar } from '@/lib/mae/biblioteca/pasta'
import { rodarFila, resumo, pastaDoProduto, statusDoCard, chaveProduto, chaveProdutoTema, produtoDoItem, type ResultadoItem, type AlvoPedido } from '@/lib/mae/pedidos/pedidos'
import { pastaExportacao, dataIso } from '@/lib/mae/exportar/nomes'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { lerApelidos, lembrarApelido, ARQ_APELIDOS, type Apelidos } from '@/lib/mae/temasProntos/montar'
import { chaveTema, type Vinculo } from '@/lib/mae/pedidos/pedidos'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { apiMae, temasDisponiveis, linhaDoPedido, comAlvos, alertasLinha, produtoEVariacao, valoresDaLinha, abrirTemaEBase, opcoesDoPedido, gerarArteDoPedido, type LinhaPedido, type TemaDisponivel } from './pedidosMae'
import { useEditor } from './estado'
import { useMarcas, carregarMarcas } from './marcasMae'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { garantirFontesDoTema, registroFontes } from './fontesTexto'
import { lerIdentidade } from './arquivosMae'

const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-0.5'
const cartao = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4'
const pilula = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`
const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

function Passo({ n, feito, titulo, children, ativo }: { n: number; feito: boolean; titulo: string; children: React.ReactNode; ativo: boolean }) {
  return (
    <section className={`${cartao} space-y-3 ${ativo ? '' : 'opacity-60'}`} data-passo-massa={n}>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${feito ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>{feito ? <Check className="w-3.5 h-3.5" /> : n}</span> {titulo}</p>
      {children}
    </section>
  )
}

/** Miniatura da 1ª folha do tema com as variáveis da linha (desenhada pelo motor, sob demanda). */
function Miniatura({ raiz, t, valores }: { raiz: FileSystemDirectoryHandle | null; t: TemaDisponivel; valores: Record<string, string> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const grandeRef = useRef<HTMLCanvasElement>(null)
  const [estado, setEstado] = useState<'ver' | 'carregando' | 'ok' | 'erro'>('ver')
  const [grande, setGrande] = useState(false)
  /** Lote 2 (item 26): clicar na miniatura abre a prévia ampliada (todas as folhas, em melhor resolução). */
  async function ampliar() {
    setGrande(true)
    try {
      const { tema, base } = await abrirTemaEBase(raiz, t)
      const abs = base.artboards.filter(a => base.molds.some(m => m.artboardId === a.id))
      const bmps: ImageBitmap[] = []
      for (const ab of abs) {
        const p = { ...ab, layers: resolverPrancheta(base, ab.id, { tema, texto: { fontes: registroFontes, valores } }) }
        await garantirArquivos(p, raiz)
        const r = await motorDaPagina().render(p, 2.4, '#ffffff', 'bitmap')
        if (r.bitmap) bmps.push(r.bitmap)
      }
      const c = grandeRef.current
      if (!c || !bmps.length) return
      const gap = 16
      c.width = bmps.reduce((s, b) => s + b.width, 0) + gap * (bmps.length - 1); c.height = Math.max(...bmps.map(b => b.height))
      const g = c.getContext('2d')!
      g.fillStyle = '#f1f5f9'; g.fillRect(0, 0, c.width, c.height)
      let x = 0
      for (const b of bmps) { g.drawImage(b, x, 0); x += b.width + gap; b.close() }
    } catch { /* fica a miniatura */ }
  }
  async function desenhar() {
    setEstado('carregando')
    try {
      const { tema, base } = await abrirTemaEBase(raiz, t)
      await garantirFontesDoTema(tema, raiz)
      // Lote 5 (item 58): todas as folhas lado a lado (antes só a 1ª)
      const abs = base.artboards.filter(a => base.molds.some(m => m.artboardId === a.id))
      const bmps: ImageBitmap[] = []
      for (const ab of abs.length ? abs : base.artboards.slice(0, 1)) {
        const p = { ...ab, layers: resolverPrancheta(base, ab.id, { tema, texto: { fontes: registroFontes, valores } }) }
        await garantirArquivos(p, raiz)
        const r = await motorDaPagina().render(p, 0.6, '#ffffff', 'bitmap')
        if (r.bitmap) bmps.push(r.bitmap)
      }
      const c = ref.current
      if (c && bmps.length) {
        const gap = 6
        c.width = bmps.reduce((s, b) => s + b.width, 0) + gap * (bmps.length - 1); c.height = Math.max(...bmps.map(b => b.height))
        const g = c.getContext('2d')!
        g.fillStyle = '#f1f5f9'; g.fillRect(0, 0, c.width, c.height)
        let x = 0
        for (const b of bmps) { g.drawImage(b, x, 0); x += b.width + gap; b.close() }
      }
      setEstado('ok')
    } catch { setEstado('erro') }
  }
  return (
    <div className="w-40">
      <canvas ref={ref} className={estado === 'ok' ? 'w-40 h-auto rounded border border-gray-200 bg-white cursor-zoom-in' : 'hidden'} onClick={() => void ampliar()} title="Clique para ampliar" data-miniatura />
      {grande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setGrande(false)} role="dialog" aria-modal="true" data-previa-ampliada>
          <canvas ref={grandeRef} className="max-w-full max-h-full rounded bg-white shadow-xl" />
        </div>
      )}
      {estado === 'ver' && <button className={btn} onClick={desenhar} data-ver-miniatura><Eye className="w-3 h-3" /> ver</button>}
      {estado === 'carregando' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      {estado === 'erro' && <span className="text-[10px] text-red-600">sem prévia</span>}
    </div>
  )
}

/** Barra da Biblioteca MAE: a geração lê e grava na pasta do computador. */
function BarraBiblioteca() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  useEffect(() => {
    if (useBiblioteca.getState().raiz) return
    ;(async () => { const r = await pastaSalva(); if (!r) return; useBiblioteca.getState().setRaiz(r, (await permissao(r).catch(() => 'prompt')) === 'granted') })()
  }, [])
  if (liberada) return null
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/70 dark:bg-orange-950/30 px-3 py-2 text-sm flex flex-wrap items-center gap-2" data-barra-biblioteca>
      <FolderOpen className="w-4 h-4 text-orange-600" />
      <span className="flex-1">As artes são geradas no seu computador, a partir da pasta <b>Biblioteca MAE</b>{raiz ? <> (<b>{raiz.name}</b> — precisa reconectar)</> : ''}.</span>
      {raiz
        ? <button className={btn + ' !border-orange-400 text-orange-700'} onClick={async () => useBiblioteca.getState().setRaiz(raiz, (await reconectar(raiz)) === 'granted')}><RefreshCw className="w-3.5 h-3.5" /> Reconectar</button>
        : <button className={btn} onClick={async () => { try { useBiblioteca.getState().setRaiz(await escolherPasta(), true) } catch { /* cancelou */ } }}><FolderOpen className="w-3.5 h-3.5" /> Escolher pasta</button>}
    </div>
  )
}

interface Resultado { arquivo: string | null; pasta: string; avisos: string[] }
type Filtro = 'pendentes' | 'gerados' | 'todos'

export default function EdicaoEmMassa() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const marcas = useMarcas(s => s.marcas)
  const [temas, setTemas] = useState<TemaDisponivel[]>([])
  const [linhas, setLinhas] = useState<LinhaPedido[]>([])
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<{ feitos: number; total: number; atual: string } | null>(null)
  const [resultados, setResultados] = useState<ResultadoItem<Resultado>[] | null>(null)
  const [saida, setSaida] = useState({ agrupar: 'tudo' as 'tudo' | 'prancheta', linhas: false, juntar: false, apliques: true })
  const [juntado, setJuntado] = useState<string | null>(null)
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [apelidos, setApelidos] = useState<Apelidos>({})
  // Lote 4 (item 43): linha aberta para editar na própria lista + pergunta "usar para todo o produto?"
  const [aberta, setAberta] = useState<string | null>(null)
  const [pergunta, setPergunta] = useState<{ id: string; themeId: string; produto: string; produtoId: string | null } | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const cancelar = useRef(false)

  async function carregar() {
    setCarregando(true); setErro(null)
    try {
      const [ts, vs, ps] = await Promise.all([temasDisponiveis(raiz), apiMae.vinculos().catch(() => []), apiMae.pedidos()])
      if (raiz) {
        await carregarMarcas(raiz).catch(() => null)
        if (!Object.keys(useEditor.getState().identidade).length) useEditor.getState().set({ identidade: await lerIdentidade(raiz).catch(() => ({})) })
      }
      setTemas(ts); setVinculos(vs)
      const ap = raiz ? lerApelidos(await ler(raiz, ARQ_APELIDOS).then(f => f.text()).catch(() => null)) : {}
      setApelidos(ap)
      const ls = ps.map(p => linhaDoPedido(p, ts, vs, ap))
      setLinhas(ls)
      setMarcadas(new Set(ls.filter(l => statusDoCard(l.pedido.artes).status !== 'gerada' && l.tema && !l.alertas.some(a => a.startsWith('faltam'))).map(l => l.pedido.id)))
    } catch (e) { setErro((e as { status?: number }).status === 403 ? 'O add-on "Edição em massa" não está liberado nesta conta.' : `Não consegui carregar os pedidos: ${(e as Error).message}`) } finally { setCarregando(false) }
  }
  useEffect(() => { if (liberada || !raiz) void carregar() }, [raiz, liberada]) // eslint-disable-line react-hooks/exhaustive-deps

  const gerada = (l: LinhaPedido) => statusDoCard(l.pedido.artes).status === 'gerada'
  // as geradas NESTA rodada continuam na tela (com o "Arte gerada ✓")
  const visiveis = linhas.filter(l => filtro === 'todos' || (filtro === 'gerados' ? gerada(l) : !gerada(l) || !!resultados?.some(r => r.id === l.pedido.id)))
  const grupos = useMemo(() => {
    const g = new Map<string, LinhaPedido[]>()
    for (const l of visiveis) { const k = l.tema?.themeId ?? ''; g.set(k, [...(g.get(k) ?? []), l]) }
    return [...g.entries()].sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1))
  }, [visiveis])
  const temaDe = (id: string | undefined) => temas.find(t => t.id === id)
  const editar = (id: string, f: (l: LinhaPedido) => LinhaPedido) => setLinhas(ls => ls.map(l => {
    if (l.pedido.id !== id) return l
    const n = f(l)
    return { ...n, alertas: alertasLinha(n) }
  }))
  /** TEMA editado na linha: procura de novo, produto a produto (vínculo → nome do tema → apelido). */
  const editarTema = (id: string, valor: string) => editar(id, x => comAlvos({ ...x, campos: { ...x.campos, TEMA: valor } }, temas, vinculos, apelidos))
  /** Recalcula todas as linhas com os vínculos/apelidos novos (o tema escolhido vale para os parecidos). */
  const recalcularTodas = (vs: Vinculo[], ap: Apelidos) => setLinhas(ls => ls.map(x => comAlvos(x, temas, vs, ap)))
  async function guardarApelidos(novo: Apelidos) {
    setApelidos(novo)
    if (raiz) await gravar(raiz, ARQ_APELIDOS, JSON.stringify(novo, null, 1)).catch(() => null)
  }
  /**
   * Escolha à mão (Lote 4, item 43): vale para esta linha e fica guardada para os próximos pedidos com o mesmo
   * PRODUTO + TEMA (Temas/apelidos.json). Depois pergunta se vale para TODOS os pedidos deste produto.
   */
  async function escolherTema(l: LinhaPedido, themeId: string) {
    if (!themeId) { editar(l.pedido.id, x => ({ ...x, tema: null, alvos: x.alvos.map(a => ({ ...a, tema: null })) })); return }
    const alvo = l.alvos[0]
    const produto = alvo?.produto ?? ''
    const campo = l.campos.TEMA?.trim()
    let novo = apelidos
    if (campo) novo = produto ? { ...novo, [chaveProdutoTema(produto, campo)]: themeId } : lembrarApelido(novo, campo, themeId)
    await guardarApelidos(novo)
    // a própria linha fica com o tema mesmo sem campo TEMA
    setLinhas(ls => ls.map(x => {
      const y = comAlvos(x, temas, vinculos, novo)
      if (x.pedido.id !== l.pedido.id || y.tema?.themeId === themeId) return y
      const alvos = y.alvos.map((a, i) => i === 0 ? { ...a, tema: { themeId, origem: 'manual' as const } } : a)
      return { ...y, alvos, tema: { themeId, origem: 'manual' }, alertas: alertasLinha({ ...y, alvos, tema: { themeId, origem: 'manual' } }) }
    }))
    if (produto) setPergunta({ id: l.pedido.id, themeId, produto, produtoId: alvo?.itens.find(i => i.produtoId)?.produtoId ?? null })
  }
  /** "Sim": todos os pedidos deste produto usam este tema (vínculo na Precificação, ou apelido do produto). */
  async function usarParaOProduto() {
    if (!pergunta) return
    const { themeId, produto, produtoId } = pergunta
    setPergunta(null)
    if (produtoId) {
      await apiMae.vincular({ produtoId, variacaoId: null, themeId }).catch(() => null)
      const vs = [...vinculos.filter(v => !(v.produtoId === produtoId && !v.variacaoId)), { produtoId, variacaoId: null, themeId }]
      setVinculos(vs); recalcularTodas(vs, apelidos)
    } else {
      const novo = { ...apelidos, [chaveProduto(produto)]: themeId }
      await guardarApelidos(novo); recalcularTodas(vinculos, novo)
    }
  }
  /** Ordem das linhas na tela (para o Enter ir ao próximo pedido). */
  const ordemVisivel = () => grupos.flatMap(([, ls]) => ls.map(l => l.pedido.id))
  /** Enter: grava NOME/IDADE/TEMA no pedido e abre o próximo. */
  async function salvarLinha(l: LinhaPedido, irProProximo = true) {
    const campos: Partial<Record<'NOME' | 'IDADE' | 'TEMA', string>> = {}
    if (l.editadas.NOME !== undefined && l.editadas.NOME !== (l.campos.NOME ?? '')) campos.NOME = l.editadas.NOME
    if (l.editadas.IDADE !== undefined && l.editadas.IDADE !== (l.campos.IDADE ?? '')) campos.IDADE = l.editadas.IDADE
    const original = camposOriginaisTema.current.get(l.pedido.id)
    if ((l.campos.TEMA ?? '') !== (original ?? l.campos.TEMA ?? '')) campos.TEMA = l.campos.TEMA ?? ''
    if (Object.keys(campos).length) {
      setSalvando(l.pedido.id)
      try {
        await apiMae.salvarCampos(l.pedido.id, campos)
        camposOriginaisTema.current.set(l.pedido.id, l.campos.TEMA ?? '')
        editar(l.pedido.id, x => {
          const { NOME: _n, IDADE: _i, ...resto } = x.editadas
          void _n; void _i
          return { ...x, campos: { ...x.campos, ...(campos.NOME !== undefined ? { NOME: campos.NOME } : {}), ...(campos.IDADE !== undefined ? { IDADE: campos.IDADE } : {}), revisarNomeIdade: campos.NOME ? undefined : x.campos.revisarNomeIdade }, editadas: resto }
        })
      } catch (e) { setErro(`Não consegui salvar o pedido #${l.pedido.numero}: ${(e as Error).message}`); return } finally { setSalvando(null) }
    }
    // preenchido e com tema: já fica marcado para gerar
    const nome = (campos.NOME ?? l.editadas.NOME ?? l.campos.NOME ?? '').trim(), idade = (campos.IDADE ?? l.editadas.IDADE ?? l.campos.IDADE ?? '').trim()
    if (l.tema && nome && idade) marcar(l.pedido.id, true)
    if (!irProProximo) { setAberta(null); return }
    const ordem = ordemVisivel()
    setAberta(ordem[ordem.indexOf(l.pedido.id) + 1] ?? null)
  }
  const camposOriginaisTema = useRef(new Map<string, string>())
  const marcar = (id: string, on: boolean) => setMarcadas(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  const selecionadas = linhas.filter(l => marcadas.has(l.pedido.id))

  async function gerarTodos() {
    if (!raiz) { setErro('Conecte a pasta Biblioteca MAE.'); return }
    // Lote 4 (item 44): um arquivo por PRODUTO do pedido (Kit Festa + Sacola P = 2 arquivos)
    const fila = selecionadas.filter(l => l.tema).flatMap(l => l.alvos.filter(a => a.tema).map((a, i) => ({ id: i ? `${l.pedido.id}#${i + 1}` : l.pedido.id, l, alvo: a as AlvoPedido })))
    if (!fila.length) return
    cancelar.current = false; setResultados(null); setJuntado(null); setErro(null)
    const dia = pastaExportacao(new Date())
    const identidade = useEditor.getState().identidade
    const docs = new Map<string, { tema: DocTema; base: DocTrabalho }>()
    const rs = await rodarFila(fila, async ({ l, alvo }) => {
      const t = temaDe(alvo.tema!.themeId)
      if (!t) throw new Error('tema não encontrado')
      let d = docs.get(t.id)
      if (!d) { d = await abrirTemaEBase(raiz, t); docs.set(t.id, d) }
      const valores = valoresDaLinha(l, d.tema)
      // Exportações/AAAA-MM-DD/<Produto>/ — o produto do tema (Kit Festa, Sacola P) ou o do pedido
      const pasta = pastaDoProduto(dia, d.tema.produto || alvo.produto || produtoDoItem(alvo.itens[0] ?? {}))
      const r = await gerarArteDoPedido({ raiz, pedido: l.pedido, tema: d.tema, base: d.base, identidade, marcas,
        opcoes: { ...opcoesDoPedido({ agrupar: saida.agrupar, linhas: saida.linhas, apliques: saida.apliques }, valores, pasta), pedido: l.pedido.numero } })
      const avisos = [...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a))]
      return { valor: { arquivo: r.arquivos.find(a => a.endsWith('.pdf')) ?? null, pasta, avisos }, avisos }
    }, { aoProgredir: (feitos, total, atual) => setProgresso({ feitos, total, atual: atual ? `Pedido ${atual.l.pedido.numero}${atual.l.alvos.length > 1 ? ` · ${atual.alvo.produto.slice(0, 30)}` : ''}` : '' }), cancelado: () => cancelar.current })
    setResultados(rs); setProgresso(null)
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: ps.find(p => p.id === l.pedido.id) ?? l.pedido })))
    if (saida.juntar) await juntarPdfs(rs)
  }

  /** Lote 4 (item 44): "Juntar num PDF só POR PRODUTO" — um PDF com todas as Sacolas P do lote, outro com os Kits… */
  async function juntarPdfs(rs: ResultadoItem<Resultado>[]) {
    if (!raiz) return
    const { PDFDocument } = await import('pdf-lib')
    const porPasta = new Map<string, string[]>()
    for (const r of rs) if (r.status !== 'erro' && r.valor?.arquivo) porPasta.set(r.valor.pasta, [...(porPasta.get(r.valor.pasta) ?? []), r.valor.arquivo])
    const feitos: string[] = []
    for (const [pasta, arqs] of porPasta) {
      const todos = await PDFDocument.create()
      for (const a of arqs) {
        const src = await PDFDocument.load(new Uint8Array(await (await ler(raiz, a)).arrayBuffer()))
        for (const pg of await todos.copyPages(src, src.getPageIndices())) todos.addPage(pg)
      }
      const produto = pasta.split('/').pop() ?? 'lote'
      const nome = `${pasta}/LOTE_${produto.replace(/\s+/g, '-')}_${arqs.length}-pedidos_${dataIso(new Date())}.pdf`
      await gravar(raiz, nome, new Blob([await todos.save() as BlobPart], { type: 'application/pdf' }))
      feitos.push(nome)
    }
    setJuntado(feitos.map(f => f.split('/').slice(-2).join('/')).join(' · ') || null)
  }

  const res = resultados ? resumo(resultados) : null
  const nSel = selecionadas.filter(l => l.tema).length
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4" data-edicao-massa data-mae-raiz>
      <DicasMae />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pedidos e edição em massa</h1>
          <p className="text-sm text-gray-500">Os pedidos com TEMA, NOME e IDADE → confira → gere a arte de todos de uma vez.</p>
        </div>
        <Link href="/estudio/mae/tema" className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 text-orange-700 dark:text-orange-300 px-3 py-1.5 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30"><Palette className="w-4 h-4" /> Abrir o editor de temas</Link>
      </div>
      <BarraBiblioteca />
      {erro && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" data-erro-massa>{erro}</p>}

      <Passo n={1} feito={nSel > 0} titulo="Escolha os pedidos" ativo>
        <div className="flex flex-wrap items-center gap-1.5">
          {([['pendentes', 'Pendentes de arte'], ['gerados', 'Já gerados'], ['todos', 'Todos']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setFiltro(k)} className={pilula(filtro === k)} data-filtro-massa={k}><ClipboardList className="w-3.5 h-3.5" /> {t}</button>
          ))}
          <span className="text-xs text-gray-500 ml-2">{linhas.length} pedido(s) em aberto · {nSel} marcado(s)</span>
        </div>
        {carregando ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando os pedidos…</p>
          : !visiveis.length ? <p className="text-sm text-gray-500">Nenhum pedido aqui. Os pedidos precisam dos campos <b>TEMA</b>, <b>NOME</b> e <b>IDADE</b> (Configurações → Campos do pedido).</p>
          : (
            <div className="grid gap-3 md:grid-cols-2">
              {grupos.map(([temaId, ls]) => {
                const marcaveis = ls.filter(l => l.tema)
                return (
                  <div key={temaId || 'sem'} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2" data-grupo-tema={temaDe(temaId)?.name ?? 'sem tema'}>
                    <label className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                      <input type="checkbox" className="accent-orange-500" disabled={!marcaveis.length} checked={!!marcaveis.length && marcaveis.every(l => marcadas.has(l.pedido.id))} onChange={e => marcaveis.forEach(l => marcar(l.pedido.id, e.target.checked))} />
                      {temaId ? <>{temaDe(temaId)?.name ?? temaId}{temaDe(temaId)?.produto ? <span className="font-normal text-gray-500"> · {temaDe(temaId)!.produto}</span> : null}</> : 'Tema não encontrado'} <span className="font-normal text-gray-400">({ls.length})</span>
                    </label>
                    <ul className="max-h-[28rem] overflow-auto space-y-0.5">
                      {ls.map(l => {
                        const pv = produtoEVariacao(l)
                        const aberto = aberta === l.pedido.id
                        return (
                          <li key={l.pedido.id} className={`text-xs rounded-lg ${aberto ? 'bg-orange-50/70 dark:bg-orange-950/20 ring-1 ring-orange-300 p-1.5' : ''}`} data-item-pedido={l.pedido.numero}>
                            <div className="flex items-center gap-1.5">
                              <input type="checkbox" className="accent-orange-500" checked={marcadas.has(l.pedido.id)} disabled={!l.tema} onChange={e => marcar(l.pedido.id, e.target.checked)} aria-label={`Gerar o pedido ${l.pedido.numero}`} />
                              {/* Lote 4 (item 43): a linha abre a edição ali mesmo (também as que "faltam dados") */}
                              <button type="button" className="flex-1 min-w-0 flex items-center gap-1.5 text-left hover:text-orange-700" onClick={() => setAberta(aberto ? null : l.pedido.id)} title="Clique para preencher NOME, IDADE e TEMA" data-abrir-linha={l.pedido.numero}>
                                <b>#{l.pedido.numero}</b><span className="truncate text-gray-600 dark:text-gray-300">{l.editadas.NOME ?? l.campos.NOME ?? '—'}{(l.editadas.IDADE ?? l.campos.IDADE) ? `, ${l.editadas.IDADE ?? l.campos.IDADE}` : ''}</span>
                                {gerada(l) && <span className="text-emerald-700 text-[10px]">✓</span>}
                                {l.alertas.length > 0 && <span className="ml-auto text-[10px] text-amber-700 truncate">{l.alertas.join(' · ')}</span>}
                              </button>
                            </div>
                            {(pv.produto || pv.variacao) && <p className="pl-5 text-[10px] text-gray-400 truncate" title={`${pv.produto}${pv.variacao ? ` · ${pv.variacao}` : ''}`} data-produto-linha>{pv.produto}{pv.variacao ? <> · <span className="text-gray-500">{pv.variacao}</span></> : null}</p>}
                            {aberto && (
                              <div className="pl-5 pt-1 grid grid-cols-[1fr_4rem] gap-1" data-edicao-linha
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void salvarLinha(l) } else if (e.key === 'Escape') setAberta(null) }}>
                                {l.campos.revisarNomeIdade && <p className="col-span-2 text-[10px] text-amber-800 bg-amber-50 rounded px-1.5 py-0.5" data-revisar-nome-idade>Veio assim: “{l.campos.revisarNomeIdade}” — confira o nome e a idade.</p>}
                                <input autoFocus value={l.editadas.NOME ?? l.campos.NOME ?? ''} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, NOME: e.target.value } }))} className={inp} placeholder="NOME" aria-label="Nome" data-nome-rapido />
                                <input value={l.editadas.IDADE ?? l.campos.IDADE ?? ''} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, IDADE: e.target.value } }))} className={inp} placeholder="IDADE" inputMode="numeric" aria-label="Idade" data-idade-rapida />
                                <input value={l.campos.TEMA ?? ''} onFocus={() => { if (!camposOriginaisTema.current.has(l.pedido.id)) camposOriginaisTema.current.set(l.pedido.id, l.campos.TEMA ?? '') }} onChange={e => editarTema(l.pedido.id, e.target.value)} className={inp} placeholder="TEMA do pedido" aria-label="Tema do pedido" data-tema-rapido />
                                <select value={l.tema?.themeId ?? ''} onChange={e => void escolherTema(l, e.target.value)} className={inp + ' col-span-2'} aria-label="Tema da arte" data-tema-escolha-rapida>
                                  <option value="">— escolher o tema da arte —</option>
                                  {temas.map(t2 => <option key={t2.id} value={t2.id}>{t2.name}{t2.produto ? ` · ${t2.produto}` : ''}</option>)}
                                </select>
                                {pergunta?.id === l.pedido.id && (
                                  <div className="col-span-2 rounded border border-orange-200 bg-white dark:bg-gray-900 p-1.5 text-[11px] space-y-1" data-pergunta-produto>
                                    <p>Usar <b>{temaDe(pergunta.themeId)?.name}</b> para <b>todos</b> os pedidos de <b>{pergunta.produto.slice(0, 60)}</b>?</p>
                                    <div className="flex gap-1">
                                      <button type="button" className={btn + ' bg-orange-500 text-white !border-orange-500'} onClick={() => void usarParaOProduto()} data-produto-sim>Sim, para todos</button>
                                      <button type="button" className={btn} onClick={() => setPergunta(null)} data-produto-nao>Só com este TEMA</button>
                                    </div>
                                  </div>
                                )}
                                <div className="col-span-2 flex items-center gap-1.5">
                                  <button type="button" className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={salvando === l.pedido.id} onClick={() => void salvarLinha(l)} data-salvar-linha>{salvando === l.pedido.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Salvar e próximo</button>
                                  <span className="text-[10px] text-gray-400">Tab pula de campo · Enter salva e vai para o próximo · Esc fecha</span>
                                </div>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
      </Passo>

      <Passo n={2} feito={!!res} titulo="Confira nomes, idades e temas" ativo={nSel > 0}>
        {!selecionadas.length ? <p className="text-xs text-gray-400">Marque os pedidos acima.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase text-gray-400"><th>Pedido</th><th>Tema</th><th>Nome</th><th className="w-14">Idade</th><th>Hashtag</th><th title="Tamanho do nome só neste pedido">Tam. nome</th><th title="Nome composto em 1 ou 2 linhas só neste pedido">Linhas</th><th>Prévia</th><th>Alertas</th><th>Arte</th></tr></thead>
              <tbody>
                {selecionadas.map(l => {
                  const t = temaDe(l.tema?.themeId), v = valoresDaLinha(l, t?.doc ?? null)
                  const r = resultados?.find(x => x.id === l.pedido.id || x.id.startsWith(`${l.pedido.id}#`))
                  const st = statusDoCard(l.pedido.artes)
                  const item = l.alvos[0]?.itens.find(i => i.produtoId)
                  return (
                    <tr key={l.pedido.id} className="border-t border-gray-100 dark:border-gray-800 align-top" data-linha-pedido={l.pedido.numero}>
                      <td className="py-1 pr-2"><b>#{l.pedido.numero}</b><div className="text-[10px] text-gray-500 truncate max-w-[10rem]">{l.pedido.cliente}</div></td>
                      <td className="py-1 pr-2 min-w-[9rem]">
                        <input value={l.campos.TEMA ?? ''} onChange={e => editarTema(l.pedido.id, e.target.value)} className={inp + ' mb-0.5'} placeholder="TEMA do pedido" title="O TEMA do pedido — corrija aqui se veio diferente do nome do tema" data-campo-tema-linha />
                        <select value={l.tema?.themeId ?? ''} onChange={e => void escolherTema(l, e.target.value)} className={inp} title="Escolha à mão: fica guardada para os próximos pedidos com este mesmo TEMA" data-tema-linha>
                          <option value="">— escolher —</option>
                          {temas.map(t2 => <option key={t2.id} value={t2.id}>{t2.name}{t2.produto ? ` · ${t2.produto}` : ''}</option>)}
                        </select>
                        {l.alvos.length > 1 && <div className="text-[10px] text-gray-500" data-varios-produtos>{l.alvos.length} produtos → {l.alvos.length} arquivos</div>}
                        <div className="text-[10px] text-gray-400">{l.tema ? ({ variacao: 'pelo produto (variação)', produto: 'pelo produto', campo: 'pelo campo TEMA', manual: l.campos.TEMA ? `escolhido à mão (lembrado para "${l.campos.TEMA}")` : 'escolhido aqui' })[l.tema.origem] : l.campos.TEMA ? <span className="text-amber-700" data-tema-nao-encontrado>tema não encontrado — escolha acima</span> : ''}</div>
                        {l.tema?.origem === 'manual' && item?.produtoId && <button className="text-[10px] underline text-orange-700 flex items-center gap-0.5" onClick={() => apiMae.vincular({ produtoId: item.produtoId!, variacaoId: item.variacaoId ?? null, themeId: l.tema!.themeId }).then(() => editar(l.pedido.id, x => ({ ...x, tema: { ...x.tema!, origem: 'variacao' } })))} data-lembrar-vinculo><Link2 className="w-3 h-3" /> sempre usar para {item.produto ?? item.nome}</button>}
                      </td>
                      <td className="py-1 pr-2 min-w-[8rem]"><input value={l.editadas.NOME ?? l.campos.NOME ?? ''} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, NOME: e.target.value } }))} className={inp} data-nome-linha /></td>
                      <td className="py-1 pr-2"><input value={l.editadas.IDADE ?? l.campos.IDADE ?? ''} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, IDADE: e.target.value } }))} className={inp} inputMode="numeric" data-idade-linha /></td>
                      <td className="py-1 pr-2 min-w-[8rem]"><input value={l.editadas.HASHTAG ?? v.HASHTAG} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, HASHTAG: e.target.value } }))} className={inp} data-hashtag-linha /></td>
                      <td className="py-1 pr-2 whitespace-nowrap">
                        <Deslizador min={0.5} max={1.8} step={0.01} value={l.escalas?.NOME ?? 1} unidade="%" fator={100} classeCaixa="w-36" title="Tamanho do nome só neste pedido (o tema não muda)"
                          onChange={e => { editar(l.pedido.id, x => ({ ...x, escalas: { ...(x.escalas ?? {}), NOME: Number(e.target.value) } })); if (!('nativeEvent' in e)) { const val = Number(e.target.value); void apiMae.ajustarPedido(l.pedido.id, { NOME: Math.abs(val - 1) < 0.005 ? null : val }).catch(() => null) } }}
                          onPointerUp={e => { const val = Number((e.target as HTMLInputElement).value); void apiMae.ajustarPedido(l.pedido.id, { NOME: Math.abs(val - 1) < 0.005 ? null : val }).catch(() => null) }} data-escala-linha />
                      </td>
                      <td className="py-1 pr-2">
                        <select value={l.linhas?.NOME ?? ''} title="Nome composto: 1 ou 2 linhas só neste pedido" className={inp + ' w-20'} data-linhas-linha
                          onChange={e => { const val = e.target.value as '' | '1' | '2'; editar(l.pedido.id, x => { const ls = { ...(x.linhas ?? {}) }; if (val) ls.NOME = val; else delete ls.NOME; return { ...x, linhas: ls } }); void apiMae.linhasPedido(l.pedido.id, { NOME: val || null }).catch(() => null) }}>
                          <option value="">auto</option><option value="1">1 linha</option><option value="2">2 linhas</option>
                        </select>
                      </td>
                      <td className="py-1 pr-2">{t && <Miniatura raiz={raiz} t={t} valores={v} />}</td>
                      <td className="py-1 pr-2 text-[10px] text-amber-700">{[...l.alertas, ...(r?.avisos ?? [])].map((a, i) => <div key={i}>{a}</div>)}{r?.mensagem && <div className="text-red-600">{r.mensagem}</div>}</td>
                      <td className="py-1 text-[10px]" data-status-arte={r?.status ?? st.status}>
                        {r ? (r.status === 'erro' ? <span className="text-red-600">erro</span> : <span className={r.status === 'aviso' ? 'text-amber-700' : 'text-emerald-700'}>{r.status === 'aviso' ? 'gerada c/ aviso' : 'Arte gerada ✓'}<div className="text-gray-400 break-all">{r.valor?.pasta.split('/').slice(-1)[0]}</div></span>)
                          : st.status === 'gerada' ? <span className="text-emerald-700">Arte gerada ✓</span> : st.status === 'revisar' ? <span className="text-amber-700">revisar</span> : <span className="text-gray-400">não gerada</span>}
                        {(r?.status === 'aviso' || (!r && st.status === 'revisar')) && <a className="block underline text-orange-700" href={`/estudio/mae?pedido=${encodeURIComponent(l.pedido.id)}`} target="_blank" rel="noreferrer" data-revisar>Revisar</a>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Passo>

      <Passo n={3} feito={!!res} titulo="Formato e pastas" ativo={nSel > 0}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={lbl}>Formato</label>
            <select className={inp} value={saida.agrupar} onChange={e => setSaida(s => ({ ...s, agrupar: e.target.value as 'tudo' | 'prancheta' }))} data-formato-massa>
              <option value="tudo">1 PDF por pedido (todas as folhas)</option>
              <option value="prancheta">1 PDF por folha de cada pedido</option>
            </select>
          </div>
          <div><label className={lbl}>Sobra</label>
            <p className="text-xs text-gray-600 dark:text-gray-300 py-1" data-sobra-massa>A de cada Base (Arte inteligente)</p>
          </div>
          <div><label className={lbl}>Pastas</label>
            <p className="text-xs text-gray-600 dark:text-gray-300 py-1">Exportações / {dataIso(new Date())} / <i>Produto</i> / <i>Nome_Idadeanos_Tema</i>.pdf</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={saida.linhas} onChange={e => setSaida(s => ({ ...s, linhas: e.target.checked }))} /> Imprimir as linhas de corte e dobra</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={saida.apliques} onChange={e => setSaida(s => ({ ...s, apliques: e.target.checked }))} /> Folhas de apliques 3D (temas com apliques)</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={saida.juntar} onChange={e => setSaida(s => ({ ...s, juntar: e.target.checked }))} data-juntar /> Juntar num PDF só por produto (para mandar à impressora de uma vez)</label>
        </div>
      </Passo>

      <Passo n={4} feito={!!res && !res.erro} titulo="Gerar selecionados" ativo={nSel > 0}>
        <div className="flex flex-wrap items-center gap-3">
          {progresso
            ? <button className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold" onClick={() => { cancelar.current = true }} data-parar><Square className="w-4 h-4" /> Parar depois deste ({progresso.feitos}/{progresso.total})</button>
            : <button onClick={gerarTodos} disabled={!nSel || carregando || !liberada} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40" data-gerar-todos><Download className="w-4 h-4" /> Gerar {nSel || ''} selecionado(s)</button>}
          <span className="text-xs text-gray-500">Gerado no seu computador · 1 PDF por pedido e produto, na pasta do produto · os cards dos pedidos passam a mostrar “Arte gerada ✓”.</span>
        </div>
        {progresso && (
          <div data-progresso>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-full bg-orange-500 transition-all" style={{ width: `${(progresso.feitos / Math.max(1, progresso.total)) * 100}%` }} /></div>
            <p className="text-[11px] text-gray-500 mt-1 tabular-nums">{progresso.feitos} de {progresso.total} · {progresso.atual}</p>
          </div>
        )}
        {res && (
          <div className="flex flex-wrap items-center gap-3 text-sm" data-resumo-massa>
            <span className="text-emerald-700 font-semibold flex items-center gap-1" data-resumo="gerada"><Check className="w-4 h-4" /> {res.gerada} gerada(s)</span>
            <span className="text-amber-700 font-semibold flex items-center gap-1" data-resumo="aviso"><AlertTriangle className="w-4 h-4" /> {res.aviso} com aviso</span>
            <span className="text-red-600 font-semibold flex items-center gap-1" data-resumo="erro"><XCircle className="w-4 h-4" /> {res.erro} com erro</span>
            {juntado && <span className="text-gray-600 flex items-center gap-1 text-xs" data-juntado><FileStack className="w-4 h-4" /> {juntado.split('/').pop()}</span>}
            {res.aviso > 0 && <span className="text-xs text-gray-500">As com aviso têm o botão “Revisar” na linha (abre no editor).</span>}
          </div>
        )}
      </Passo>
    </div>
  )
}
