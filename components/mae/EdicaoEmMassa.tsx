'use client'
'use no memo'
// PEDIDOS E EDIÇÃO EM MASSA do Método MAE. Lote 5 (item 78): UMA LINHA POR PEDIDO, como no concorrente —
// miniatura · #pedido · cliente · produto/variação; NOME, IDADE, frase e campos extras editáveis ali mesmo; a
// OBSERVAÇÃO do pedido (💬); QUANTIDADES por caixa (item 79); Ver · Ajustar (item 59) · Gerar na própria linha;
// abas Pendentes × Já gerados (com data/hora e "Gerar de novo"); "Selecionar aprovados" e "Gerar selecionados".
// Base de portfólio (item 72): cada produto do pedido acha o GRUPO dele na base → "Tema · Grupo", um PDF por
// produto, com a quantidade no nome (item 60: `Kit Festa/Naty_5anos_Sereia_KitFesta12.pdf`).
import DicasMae from './Dicas'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Download, Square, Check, AlertTriangle, XCircle, Eye, FolderOpen, RefreshCw, Palette, MessageSquare, Boxes, SlidersHorizontal, RotateCcw, X, Layers3, Printer, Plus, Upload } from 'lucide-react'
import FiltrosPedidos from './FiltrosPedidos'
import ModalLote, { escolhasGuardadas, type EscolhasLote } from './ModalLote'
import PedidoManual from './PedidoManual'
import ImportarPlanilha from './ImportarPlanilha'
import { gerarLotesImpressao, type ItemLote } from './loteImpressao'
import { filtrar, ordenarPorUrgencia, opcoesDosFiltros, situacaoPrazo, hojeLocal, lerFiltrosSalvos, guardarFiltro, ARQ_FILTROS, type Filtros, type Filtravel, type FiltroSalvo } from '@/lib/mae/pedidos/filtros'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { escolherPasta, pastaSalva, permissao, reconectar } from '@/lib/mae/biblioteca/pasta'
import { rodarFila, resumo, pastaDoProduto, statusDoCard, produtoDoItem, type ResultadoItem, type AlvoPedido, type ItemPedido } from '@/lib/mae/pedidos/pedidos'
import { parteArquivo, pastaExportacao, quantidadesPadrao, sufixoQuantidade } from '@/lib/mae/exportar/nomes'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { lerApelidos, lembrarApelido, ARQ_APELIDOS, type Apelidos } from '@/lib/mae/temasProntos/montar'
import { chaveTema, type Vinculo } from '@/lib/mae/pedidos/pedidos'
import { docDoGrupo, grupoDoItem, type Grupo } from '@/lib/mae/editor/grupos'
import { docDaFolha, docDoLote, distribuirLote, ordemDeLeitura, lugaresDasVagas, type Folha } from '@/lib/mae/editor/folhaMontada'
import { unidadesPorFolha, vagasDasUnidades } from '@/lib/mae/medidas/pecas'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Identidade } from './arquivosMae'
import { apiMae, temasDisponiveis, linhaDoPedido, comAlvos, alertasLinha, produtoEVariacao, valoresDaLinha, abrirTemaEBase, opcoesDoPedido, gerarArteDoPedido, type LinhaPedido, type TemaDisponivel, type EtapaImpressao, type ResumoStatus } from './pedidosMae'
import { useEditor } from './estado'
import { useMarcas, carregarMarcas } from './marcasMae'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { garantirFontesDoTema, registroFontes } from './fontesTexto'
import { lerIdentidade } from './arquivosMae'

const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800'
const pilula = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`
const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
/** Variáveis que não viram coluna de "campo" (têm o seu lugar ou são calculadas). */
const NAO_CAMPO = new Set(['NOME', 'IDADE', 'HASHTAG', 'ARROBA', 'SUFIXO', 'NOME_IDADE', 'SOBRENOME'])

/** Base do produto: o GRUPO do item na base de portfólio (item 72) — ou a base inteira, sem grupos. */
function baseDoAlvo(base: DocTrabalho, tema: DocTema, item: ItemPedido | undefined): { doc: DocTrabalho; grupo: Grupo | null } {
  const g = item ? grupoDoItem(base, item, tema) : null
  return { doc: g ? docDoGrupo(base, g.id) : base, grupo: g }
}
/** Caixas (folhas com molde) e o nome de cada uma. */
const caixasDe = (d: DocTrabalho) => d.artboards.filter(a => d.molds.some(m => m.artboardId === a.id && m.faces.length))
  .map((a, i) => ({ id: a.id, nome: a.name || d.molds.filter(m => m.artboardId === a.id).map(m => m.name).join(' + ') || `Folha ${i + 1}` }))
/** Peças do produto no pedido (quantidade do kit): soma das linhas; sem quantidade → 0. */
const pecasDoAlvo = (a: AlvoPedido) => a.itens.reduce((s, i) => s + (Number((i as { quantidade?: number }).quantidade) || 0), 0)
const chaveDoAlvo = (a: AlvoPedido) => chaveTema(a.produto) || '_'

/** Miniatura das folhas do tema com as variáveis da linha (desenhada pelo motor, sob demanda). */
function Miniatura({ raiz, t, valores, item, id, unidades = 0 }: { raiz: FileSystemDirectoryHandle | null; t: TemaDisponivel; valores: Record<string, string>; item?: ItemPedido; id: string; unidades?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const grandeRef = useRef<HTMLCanvasElement>(null)
  const [estado, setEstado] = useState<'ver' | 'carregando' | 'ok' | 'erro'>('ver')
  const [grande, setGrande] = useState(false)
  const [legenda, setLegenda] = useState<string | null>(null)
  async function folhas(escala: number): Promise<ImageBitmap[]> {
    const { tema, base } = await abrirTemaEBase(raiz, t)
    await garantirFontesDoTema(tema, raiz)
    const { doc, grupo } = baseDoAlvo(base, tema, item)
    // Lote 6 (item 97): produto de folha montada → "1 tag · 10 un. · 1 folha"
    const folha = grupo?.folhaId ? (base.folhas ?? []).find(f => f.id === grupo.folhaId) : undefined
    if (folha) {
      const n = Math.max(1, unidades || folha.pecas.length), cap = Math.max(1, folha.pecas.length)
      const peca = base.molds.find(m => m.id === folha.pecas[0]?.moldeId)?.name?.toLowerCase() ?? 'peça'
      setLegenda(`1 ${peca} · ${n} un. · ${Math.ceil(n / cap)} folha${Math.ceil(n / cap) > 1 ? 's' : ''}`)
    }
    const abs = doc.artboards.filter(a => doc.molds.some(m => m.artboardId === a.id))
    const bmps: ImageBitmap[] = []
    for (const ab of abs.length ? abs : doc.artboards.slice(0, 1)) {
      const p = { ...ab, layers: resolverPrancheta(doc, ab.id, { tema, texto: { fontes: registroFontes, valores } }) }
      await garantirArquivos(p, raiz)
      const r = await motorDaPagina().render(p, escala, '#ffffff', 'bitmap')
      if (r.bitmap) bmps.push(r.bitmap)
    }
    return bmps
  }
  const lado = (c: HTMLCanvasElement, bmps: ImageBitmap[], gap: number) => {
    c.width = bmps.reduce((s, b) => s + b.width, 0) + gap * (bmps.length - 1); c.height = Math.max(...bmps.map(b => b.height))
    const g = c.getContext('2d')!
    g.fillStyle = '#f1f5f9'; g.fillRect(0, 0, c.width, c.height)
    let x = 0
    for (const b of bmps) { g.drawImage(b, x, 0); x += b.width + gap; b.close() }
  }
  /** Lote 2 (item 26): a prévia ampliada (todas as folhas, em melhor resolução). Também o botão "Ver" da linha. */
  async function ampliar() {
    setGrande(true)
    try { const b = await folhas(2.4); if (grandeRef.current && b.length) lado(grandeRef.current, b, 16) } catch { /* fica a miniatura */ }
  }
  async function desenhar() {
    setEstado('carregando')
    try { const b = await folhas(0.6); if (ref.current && b.length) lado(ref.current, b, 6); setEstado('ok') } catch { setEstado('erro') }
  }
  // "Ver" na linha (outra coluna) abre a prévia grande desta miniatura
  useEffect(() => {
    const f = (e: Event) => { if ((e as CustomEvent<string>).detail === id) void ampliar() }
    window.addEventListener('mae:ver-linha', f)
    return () => window.removeEventListener('mae:ver-linha', f)
  })
  return (
    <div className="w-28">
      <canvas ref={ref} className={estado === 'ok' ? 'w-28 h-auto rounded border border-gray-200 bg-white cursor-zoom-in' : 'hidden'} onClick={() => void ampliar()} title="Clique para ampliar" data-miniatura />
      {grande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setGrande(false)} role="dialog" aria-modal="true" data-previa-ampliada>
          <canvas ref={grandeRef} className="max-w-full max-h-full rounded bg-white shadow-xl" />
        </div>
      )}
      {legenda && <p className="text-[9px] text-gray-500 mt-0.5" data-legenda-folha>{legenda}</p>}
      {estado === 'ver' && <button className={btn} onClick={desenhar} data-ver-miniatura><Eye className="w-3 h-3" /> miniatura</button>}
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

/**
 * Item 79: QUANTIDADES — as caixas do produto com um número em cada, já preenchidas pela quantidade do kit
 * (kit 12 / 6 caixas = 2 de cada; o que não divide certinho vem marcado ⚠️). A observação fica ao lado.
 * Contador "12 de 12 ✓" ou "10 de 12 ⚠️" (aviso, não trava). Salva no pedido.
 */
function ModalQuantidades({ raiz, l, t, onFechar, onSalvo }: { raiz: FileSystemDirectoryHandle | null; l: LinhaPedido; t: (id: string | undefined) => TemaDisponivel | undefined; onFechar: () => void; onSalvo: (q: Record<string, Record<string, number>>) => void }) {
  const [porAlvo, setPorAlvo] = useState<{ chave: string; produto: string; grupo: string | null; total: number; caixas: { id: string; nome: string }[]; q: Record<string, number>; exato: boolean }[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const out: NonNullable<typeof porAlvo> = []
      for (const a of l.alvos) {
        const td = a.tema ? t(a.tema.themeId) : undefined
        if (!td) continue
        const { tema, base } = await abrirTemaEBase(raiz, td)
        const { doc, grupo } = baseDoAlvo(base, tema, a.itens[0])
        const caixas = caixasDe(doc), total = pecasDoAlvo(a), chave = chaveDoAlvo(a)
        const padrao = quantidadesPadrao(total, caixas.map(c => c.id))
        const salvo = l.quantidades?.[chave]
        out.push({ chave, produto: a.produto || 'Produto', grupo: grupo?.nome ?? null, total, caixas, q: salvo ? Object.fromEntries(caixas.map(c => [c.id, salvo[c.id] ?? 0])) : padrao.porCaixa, exato: padrao.exato })
      }
      if (vivo) setPorAlvo(out)
    })().catch(e => { if (vivo) setErro((e as Error).message) })
    return () => { vivo = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function salvar() {
    if (!porAlvo) return
    setSalvando(true)
    const q = Object.fromEntries(porAlvo.map(a => [a.chave, a.q]))
    try { await apiMae.quantidades(l.pedido.id, q); onSalvo(q); onFechar() } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar} role="dialog" aria-modal="true" data-modal-quantidades>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2"><Boxes className="w-4 h-4 text-orange-500" /><b className="text-sm">Quantidades — pedido #{l.pedido.numero}</b><button className="ml-auto" onClick={onFechar} aria-label="Fechar"><X className="w-4 h-4" /></button></div>
        <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
          <div className="space-y-3">
            {!porAlvo && !erro && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Abrindo as caixas…</p>}
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            {porAlvo?.map((a, ai) => {
              const soma = Object.values(a.q).reduce((s, n) => s + n, 0)
              const bate = !a.total || soma === a.total
              return (
                <div key={a.chave} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-qtd-produto={a.produto}>
                  <div className="flex items-center gap-2 text-xs"><b>{a.grupo ?? a.produto}</b>
                    <span className={`ml-auto rounded px-1.5 py-0.5 font-semibold ${bate ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`} data-contador-qtd>{a.total ? `${soma} de ${a.total} ${bate ? '✓' : '⚠️'}` : `${soma} no total`}</span>
                  </div>
                  {!a.exato && <p className="text-[10px] text-amber-700">⚠️ O kit não divide certinho pelas {a.caixas.length} caixas — confira.</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {a.caixas.map(c => (
                      <label key={c.id} className="flex items-center gap-1.5 rounded-lg border border-gray-100 dark:border-gray-800 px-2 py-1 text-xs">
                        <span className="flex-1 truncate" title={c.nome}>{c.nome}</span>
                        <input type="text" inputMode="numeric" value={String(a.q[c.id] ?? 0)} onChange={e => { const n = Math.max(0, Math.min(999, parseInt(e.target.value.replace(/\D/g, '') || '0'))); setPorAlvo(p => p!.map((x, k) => k === ai ? { ...x, q: { ...x.q, [c.id]: n } } : x)) }}
                          className="w-12 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-right tabular-nums" aria-label={`Quantidade de ${c.nome}`} data-qtd-caixa={c.nome} />
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 p-2 text-xs" data-obs-quantidades>
            <p className="font-semibold flex items-center gap-1 mb-1"><MessageSquare className="w-3.5 h-3.5" /> Observação do pedido</p>
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{l.pedido.observacoes || 'Sem observação.'}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onFechar}>Cancelar</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={!porAlvo || salvando} onClick={() => void salvar()} data-salvar-quantidades>{salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Salvar no pedido</button>
        </div>
      </div>
    </div>
  )
}

interface Resultado { arquivo: string | null; pasta: string; avisos: string[]; /** Lote 6 (item 95): Folha 1 → #123 · Naty (6)… */ separacao?: string[]; /** Lote 7 (item 117): o lote de impressão. */ lote?: string }
/** Lote 5 (item 76): pedidos que vão juntos nas mesmas folhas (mesmo tema + mesma folha montada). */
interface Lote { t: TemaDisponivel; folha: Folha; grupo: Grupo | null; itens: { id: string; l: LinhaPedido; alvo: AlvoPedido }[] }
type Aba = 'pendentes' | 'gerados'
const SIM = /^(s|sim|ok|aprovad[oa]|true|1|x)$/i
/** Lote 6 (item 97): o tema serve para o produto do pedido? (produto do tema × produto da linha, sem acento/caixa) */
function servePara(t: TemaDisponivel, produto: string): boolean {
  const a = chaveTema(t.produto ?? ''), b = chaveTema(produto ?? '')
  return !!a && !!b && (a.includes(b) || b.includes(a))
}
/** Lote 6 (item 101): status do SOA em palavras ("EM_PRODUCAO" → "em produção"; "ABERTO" → "aguardando aprovação"). */
const ROTULOS_STATUS: Record<string, string> = { ABERTO: 'aguardando aprovação', EM_PRODUCAO: 'em produção', PRODUCAO: 'em produção', AGUARDANDO_APROVACAO: 'aguardando aprovação', APROVADO: 'aprovado', PAUSADO: 'pausado' }
const rotuloStatus = (s: string) => ROTULOS_STATUS[s.toUpperCase()] ?? s.toLowerCase().replace(/_/g, ' ')
/** Lote 7 (item 120): MAE avulso — o status é o do MAE (pendente / gerado / impresso). */
const ROTULO_MAE: Record<string, string> = { pendente: 'pendente', gerado: 'gerado', impresso: 'impresso' }
/** Lote 7 (item 116): "11/10 · hoje" — o prazo de envio com a urgência. */
const PRAZO_TXT: Record<string, string> = { atrasado: 'atrasado', hoje: 'despacha hoje', amanha: 'até amanhã', depois: '', sem: '' }
const fmtDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
/** Lote 7 (itens 119/120): resumo do status em palavras ("3 na Impressão · 1 já estava adiante"). */
function resumoStatus(r: ResumoStatus, impresso: boolean): string {
  const p: string[] = []
  if (r.movido) p.push(`${r.movido} ${impresso ? 'marcado(s)' : 'na etapa Impressão'}`)
  if (r.impresso) p.push(`${r.impresso} marcado(s) como impresso(s)`)
  if (r.ja_adiante) p.push(`${r.ja_adiante} já estava(m) adiante (não voltou de etapa)`)
  if (r.finalizado) p.push(`${r.finalizado} já pronto(s)/enviado(s)`)
  if (r.sem_etapa) p.push(`${r.sem_etapa} sem etapa de Impressão no fluxo`)
  return p.join(' · ') || 'nada mudou'
}

export default function EdicaoEmMassa() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const marcas = useMarcas(s => s.marcas)
  const [temas, setTemas] = useState<TemaDisponivel[]>([])
  const [linhas, setLinhas] = useState<LinhaPedido[]>([])
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [aba, setAba] = useState<Aba>('pendentes')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<{ feitos: number; total: number; atual: string } | null>(null)
  const [resultados, setResultados] = useState<ResultadoItem<Resultado>[] | null>(null)
  // Lote 5 (itens 60/79): 1 arquivo por pedido e produto; "Já sair na quantidade do pedido" (padrão) ou "1 de cada"
  // Lote 5 (item 76): "Aproveitar folhas" junta os pedidos de peças pequenas nas mesmas folhas (desligado)
  const [saida, setSaida] = useState({ agrupar: 'tudo' as 'tudo' | 'prancheta', linhas: false, apliques: true, quantidade: 'pedido' as 'pedido' | 'um', aproveitar: false, cortePorPedido: false })
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [apelidos, setApelidos] = useState<Apelidos>({})
  const [pergunta, setPergunta] = useState<{ id: string; themeId: string; produto: string; produtoId: string | null } | null>(null)
  const [obs, setObs] = useState<string | null>(null)
  const [qtd, setQtd] = useState<string | null>(null)
  const [mais, setMais] = useState<string | null>(null)
  const cancelar = useRef(false)
  // Lote 7 (item 116): busca, filtros em chips e filtros salvos (Biblioteca: Pedidos/filtros.json)
  const [filtros, setFiltros] = useState<Filtros>({})
  const [salvos, setSalvos] = useState<FiltroSalvo[]>([])
  const [perguntaMassa, setPerguntaMassa] = useState<{ themeId: string; temas: string[] } | null>(null)
  // Lote 7 (itens 119/120): plano (SOA completo × só MAE), etapa de Impressão do fluxo e o "iniciar impressão"
  const [plano, setPlano] = useState<'soa' | 'mae'>('soa')
  const [etapa, setEtapa] = useState<EtapaImpressao | null | undefined>(undefined)
  const [semEtapaDispensado, setSemEtapaDispensado] = useState(false)
  const [iniciarImp, setIniciarImp] = useState(() => escolhasGuardadas().iniciarImpressao)
  const [msgStatus, setMsgStatus] = useState<string | null>(null)
  const [modalLote, setModalLote] = useState(false)
  const [manual, setManual] = useState(false)
  const [importar, setImportar] = useState(false)
  // Lote 6 (item 100): voltou do Ajustar — a linha do pedido fica destacada (e "Salvar e gerar" já gera)
  const [destaque] = useState<{ id: string | null; gerar: boolean }>(() => { try { const q = new URLSearchParams(window.location.search); return { id: q.get('destaque'), gerar: q.get('gerar') === '1' } } catch { return { id: null, gerar: false } } })
  const destaqueFeito = useRef(false)

  async function carregar() {
    setCarregando(true); setErro(null)
    try {
      const [ts, vs, ps, et] = await Promise.all([temasDisponiveis(raiz), apiMae.vinculos().catch(() => []), apiMae.pedidos(), apiMae.etapaImpressao().catch(() => null)])
      if (et) { setPlano(et.plano); setEtapa(et.etapa) }
      if (raiz) setSalvos(lerFiltrosSalvos(await ler(raiz, ARQ_FILTROS).then(f => f.text()).catch(() => null)))
      if (raiz) {
        await carregarMarcas(raiz).catch(() => null)
        if (!Object.keys(useEditor.getState().identidade).length) useEditor.getState().set({ identidade: await lerIdentidade(raiz).catch(() => ({})) })
      }
      setTemas(ts); setVinculos(vs)
      const ap = raiz ? lerApelidos(await ler(raiz, ARQ_APELIDOS).then(f => f.text()).catch(() => null)) : {}
      setApelidos(ap)
      setLinhas(ps.map(p => linhaDoPedido(p, ts, vs, ap)))
      setMarcadas(new Set())
    } catch (e) { setErro((e as { status?: number }).status === 403 ? 'O add-on "Edição em massa" não está liberado nesta conta.' : `Não consegui carregar os pedidos: ${(e as Error).message}`) } finally { setCarregando(false) }
  }
  useEffect(() => { if (liberada || !raiz) void carregar() }, [raiz, liberada]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (destaqueFeito.current || !destaque.id || carregando || !linhas.length) return
    const l = linhas.find(x => x.pedido.id === destaque.id)
    if (!l) return
    destaqueFeito.current = true
    requestAnimationFrame(() => document.querySelector(`[data-linha-pedido="${CSS.escape(l.pedido.numero)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    if (destaque.gerar && l.tema && liberada) void gerar([l]).then(() => setAba('gerados'))
  }, [linhas, carregando, liberada]) // eslint-disable-line react-hooks/exhaustive-deps

  const gerada = (l: LinhaPedido) => statusDoCard(l.pedido.artes).status === 'gerada'
  const geradaEm = (l: LinhaPedido) => { const u = statusDoCard(l.pedido.artes).ultima; return u?.criadoEm ? new Date(u.criadoEm as unknown as string) : null }
  /** "Aprovado" no SOA: já em produção, ou um campo de aprovação marcado ("Aprovado", "Arte aprovada" = sim). */
  const aprovado = (l: LinhaPedido) => (l.pedido.status && l.pedido.status !== 'ABERTO') || Object.entries(l.pedido.campos).some(([k, v]) => /aprova/i.test(k) && SIM.test(String(v).trim()))
  // as geradas NESTA rodada continuam em Pendentes até recarregar (com o "Arte gerada ✓")
  const temaDe = (id: string | undefined) => temas.find(t => t.id === id)
  /** Lote 7 (item 116): o status mostrado (e filtrável): MAE avulso = o do MAE; SOA = aprovado / status em palavras. */
  const statusDaLinha = (l: LinhaPedido) => l.pedido.statusMae ? ROTULO_MAE[l.pedido.statusMae] : aprovado(l) ? 'aprovado' : rotuloStatus(l.pedido.status)
  const filtravel = (l: LinhaPedido): Filtravel => ({
    numero: l.pedido.numero, cliente: l.pedido.cliente ?? '', nome: (l.editadas.NOME ?? l.campos.NOME ?? ''), temaSoa: l.campos.TEMA ?? '', temaMae: temaDe(l.tema?.themeId)?.name ?? '',
    produto: produtoEVariacao(l).produto, status: statusDaLinha(l), canal: l.pedido.canal ?? '', loja: l.pedido.loja ?? '', dataEnvio: l.pedido.dataEnvio ?? '',
    temTema: !!l.tema, comObs: !!l.pedido.observacoes,
    ajustado: Object.keys(l.posicoes ?? {}).length > 0 || Object.keys(l.escalas ?? {}).length > 0 || Object.keys(l.trocas ?? {}).length > 0 || Object.keys(l.quantidades ?? {}).length > 0,
  })
  const hoje = hojeLocal()
  const daAba = useMemo(() => linhas.filter(l => aba === 'gerados' ? gerada(l) : (!gerada(l) || !!resultados?.some(r => r.id.split('#')[0] === l.pedido.id))), [linhas, aba, resultados])
  const visiveis = ordenarPorUrgencia(filtrar(daAba, filtros, filtravel, hoje), filtravel)
  const opcoesFiltro = opcoesDosFiltros(daAba.map(filtravel))
  async function guardarSalvos(novos: FiltroSalvo[]) { setSalvos(novos); if (raiz) await gravar(raiz, ARQ_FILTROS, JSON.stringify(novos, null, 1)).catch(() => null) }
  /** Lote 7 (item 119): impressão pela etapa do SOA (quando o fluxo tem) ou pelo status do MAE avulso. */
  const comImpressao = plano === 'mae' || !!etapa
  const editar = (id: string, f: (l: LinhaPedido) => LinhaPedido) => setLinhas(ls => ls.map(l => { if (l.pedido.id !== id) return l; const n = f(l); return { ...n, alertas: alertasLinha(n) } }))
  const recalcularTodas = (vs: Vinculo[], ap: Apelidos) => setLinhas(ls => ls.map(x => comAlvos(x, temas, vs, ap)))
  async function guardarApelidos(novo: Apelidos) { setApelidos(novo); if (raiz) await gravar(raiz, ARQ_APELIDOS, JSON.stringify(novo, null, 1)).catch(() => null) }
  /**
   * Lote 6 (itens 88/97): o tema escolhido na linha fica guardado NESTE pedido (escolher noutro pedido não desfaz).
   * Depois pergunta se vale para TODOS os pedidos com o mesmo tema do SOA ("Ursinha Princesa") — a ligação é pelo
   * NOME DO TEMA, nunca pelo produto (um produto tem vários temas).
   */
  async function escolherTema(l: LinhaPedido, themeId: string) {
    const novo = themeId || null
    editar(l.pedido.id, x => comAlvos({ ...x, temaPedido: novo }, temas, vinculos, apelidos))
    await apiMae.temaPedido(l.pedido.id, novo).catch(e => setErro(`Não consegui guardar o tema do pedido #${l.pedido.numero}: ${(e as Error).message}`))
    const campo = l.campos.TEMA?.trim()
    if (novo && campo) setPergunta({ id: l.pedido.id, themeId: novo, produto: campo, produtoId: null })
  }
  /** "Sim, para todos": todos os pedidos com este TEMA do SOA usam o tema MAE escolhido (os que já têm o seu ficam). */
  async function usarParaOTema() {
    if (!pergunta) return
    const { themeId, produto: campo } = pergunta
    setPergunta(null)
    const novo = lembrarApelido(apelidos, campo, themeId)
    await guardarApelidos(novo)
    recalcularTodas(vinculos, novo)
  }
  /**
   * Lote 7 (item 116): VINCULAR TEMA EM MASSA — o mesmo tema MAE nos pedidos selecionados (cada um guarda o seu,
   * como no item 88); depois pergunta se vale para os PRÓXIMOS pedidos com o mesmo TEMA do SOA (item 97).
   */
  async function vincularEmMassa(themeId: string) {
    const sel = linhas.filter(l => marcadas.has(l.pedido.id))
    if (!sel.length || !themeId) return
    try {
      await apiMae.temaEmMassa(sel.map(l => l.pedido.id), themeId)
      setLinhas(ls => ls.map(l => (marcadas.has(l.pedido.id) ? comAlvos({ ...l, temaPedido: themeId }, temas, vinculos, apelidos) : l)))
      const temasSoa = [...new Set(sel.map(l => l.campos.TEMA?.trim()).filter((t): t is string => !!t))]
      if (temasSoa.length) setPerguntaMassa({ themeId, temas: temasSoa })
    } catch (e) { setErro(`Não consegui vincular o tema: ${(e as Error).message}`) }
  }
  async function lembrarParaOsProximos() {
    if (!perguntaMassa) return
    let novo = apelidos
    for (const t of perguntaMassa.temas) novo = lembrarApelido(novo, t, perguntaMassa.themeId)
    setPerguntaMassa(null)
    await guardarApelidos(novo)
    recalcularTodas(vinculos, novo)
  }
  /** Lote 7 (itens 119/120): "Iniciar a etapa Impressão" (depois de gerar) ou "Marcar como impresso". */
  async function aplicarStatus(ids: string[], acao: 'iniciar_impressao' | 'impresso') {
    if (!ids.length) return
    try {
      const r = await apiMae.status(ids, acao)
      setMsgStatus(resumoStatus(r, acao === 'impresso'))
      const ps = await apiMae.pedidos().catch(() => null)
      if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: ps.find(p => p.id === l.pedido.id) ?? l.pedido })))
    } catch (e) { setErro(`Não consegui atualizar a produção: ${(e as Error).message}`) }
  }
  async function criarEtapa() {
    try { const r = await apiMae.criarEtapaImpressao(); setEtapa(r.etapa); setMsgStatus(r.criada ? 'Etapa "Impressão" criada antes da Expedição — mude a posição em Configurações → Produção, se quiser.' : null) }
    catch (e) { setErro(`Não consegui criar a etapa: ${(e as Error).message}`) }
  }
  /** Grava no pedido o que mudou na linha (NOME, IDADE e os campos), ao sair do campo. */
  async function gravarCampo(l: LinhaPedido, k: string) {
    const v = l.editadas[k]
    const atual = k === 'NOME' ? l.campos.NOME : k === 'IDADE' ? l.campos.IDADE : l.campos.extras[k]
    if (v === undefined || v === (atual ?? '')) return
    try {
      await apiMae.salvarCampos(l.pedido.id, { [k]: v })
      editar(l.pedido.id, x => {
        const { [k]: _, ...resto } = x.editadas
        void _
        const campos = k === 'NOME' || k === 'IDADE' ? { ...x.campos, [k]: v, revisarNomeIdade: undefined } : { ...x.campos, extras: { ...x.campos.extras, [k]: v } }
        return { ...x, campos, editadas: resto }
      })
    } catch (e) { setErro(`Não consegui salvar o pedido #${l.pedido.numero}: ${(e as Error).message}`) }
  }
  const marcar = (id: string, on: boolean) => setMarcadas(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  const selecionadas = linhas.filter(l => marcadas.has(l.pedido.id))

  /**
   * Lote 5 (item 76): gera um LOTE de folha montada — as peças de cada pedido juntas, na ordem de leitura; kit
   * nunca dividido entre folhas; avulso preenche os buracos. Vários pedidos → `LOTE_<peça>_<dd-mm>.pdf` com o
   * "#123 · Naty" fora da linha de corte + `…_separacao.txt` (Folha 1 → pedidos). Registra a arte em cada pedido.
   */
  async function gerarLote(lt: Lote, dia: string, identidade: Identidade, d: { tema: DocTema; base: DocTrabalho }): Promise<ResultadoItem<Resultado>[]> {
    const f = lt.folha, cap = f.pecas.length
    const ns = lt.itens.map(({ alvo }) => {
      const kits = alvo.itens.reduce((s, i) => s + (Number((i as { qtdVendida?: number }).qtdVendida) || 0), 0) || 1
      const n = pecasDoAlvo(alvo) || kits * cap
      return saida.quantidade === 'pedido' ? n : Math.min(n, cap)
    })
    // Lote 6 (item 94): produto com COMPOSIÇÃO (Nutella = corpo + tampa): a folha comporta N UNIDADES completas; cada
    // unidade ocupa as suas vagas de cada peça (nunca sai um corpo sem a tampa)
    const comp = lt.grupo?.composicao ?? []
    let dist: number[][]
    if (comp.length) {
      const capU = unidadesPorFolha(f.pecas, comp)
      if (capU < 1) throw new Error(`A folha "${f.nome}" não tem vagas para 1 unidade completa (${comp.map(c => `${c.qtd}× ${d.base.molds.find(m => m.id === c.moldeId)?.name ?? 'peça'}`).join(' + ')}).`)
      const nsU = lt.itens.map(({ alvo }) => { const u = alvo.itens.reduce((s, i) => s + (Number((i as { qtdVendida?: number }).qtdVendida) || 0), 0) || pecasDoAlvo(alvo) || 1; return saida.quantidade === 'pedido' ? u : 1 })
      const ordem = ordemDeLeitura(f), vagasLeitura = ordem.map(i => ({ indice: i, moldeId: f.pecas[i].moldeId }))
      dist = distribuirLote(capU, nsU, { tipo: f.tipo, completar: f.completarUltima }).map(us => lugaresDasVagas(f, vagasDasUnidades(vagasLeitura, comp, us)))
    } else dist = distribuirLote(cap, ns, { tipo: f.tipo, completar: f.completarUltima })
    const pedidos = lt.itens.map(({ l }) => {
      const nome = (l.editadas.NOME ?? l.campos.NOME ?? '').trim().split(/\s+/)[0]
      return { rotulo: `#${l.pedido.numero}${nome ? ` · ${nome}` : ''}`, valores: valoresDaLinha(l, d.tema) }
    })
    const lote = docDoLote(d.base, d.tema, f, dist, pedidos)
    const juntos = lt.itens.length > 1, l0 = lt.itens[0].l
    const pasta = pastaDoProduto(dia, lt.grupo?.nome || f.nome)
    const hoje = new Date(), dm = `${String(hoje.getDate()).padStart(2, '0')}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const nomeArquivo = `LOTE_${parteArquivo(lt.grupo?.nome || f.nome, 30)}_${dm}`
    const r = await gerarArteDoPedido({ raiz: raiz!, pedido: l0.pedido, tema: lote.tema, base: lote.doc, identidade, marcas, registrar: false,
      opcoes: { ...opcoesDoPedido({ agrupar: saida.agrupar, linhas: saida.linhas, apliques: saida.apliques }, juntos ? { _PEDIDO: '1' } : pedidos[0].valores, pasta),
        // Lote 6 (item 95): o arquivo de corte do gabarito é gerado UMA vez (Base → Folhas); por pedido só se pedir
        pedido: l0.pedido.numero, valoresPorSlot: lote.valoresPorSlot, svg: saida.cortePorPedido, dxf: saida.cortePorPedido,
        ...(juntos ? { nomeArquivo, rotulos: lote.rotulos } : { sufixoArquivo: sufixoQuantidade(lt.grupo?.nome || lt.itens[0].alvo.produto || f.nome, ns[0]) }) } })
    const pdf = r.arquivos.find(a => a.endsWith('.pdf')) ?? null
    // Lote 6 (item 95): a separação NÃO vira arquivo (nem página): aparece aqui na tela; o "#nº · Nome" na folha resolve
    const avisos = [...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a))]
    for (const [k, { l }] of lt.itens.entries())
      await apiMae.registrarArte({ orderId: l.pedido.id, themeId: lote.tema.id, themeVersion: lote.tema.version, variaveis: pedidos[k].valores, status: r.revisar ? 'revisar' : 'gerada', arquivo: pdf }).catch(e => console.warn('[MAE] registrar arte', e))
    return lt.itens.map(it => ({ id: it.id, status: avisos.length ? 'aviso' as const : 'gerada' as const, valor: { arquivo: pdf, pasta, avisos, ...(juntos ? { separacao: lote.resumo } : {}) }, avisos }))
  }

  /**
   * Prepara a geração: a fila (um item por pedido e PRODUTO com tema) e quem vai para a FOLHA MONTADA (lote de
   * folha: avulsa, com composição, ou "Aproveitar folhas" ligado) — e já gera esses lotes de folha.
   */
  async function prepararEGerarFolhas(lista: LinhaPedido[], aproveitar: boolean) {
    const r0 = raiz!
    const fila = lista.filter(l => l.tema).flatMap(l => l.alvos.filter(a => a.tema).map((a, i) => ({ id: i ? `${l.pedido.id}#${i + 1}` : l.pedido.id, l, alvo: a as AlvoPedido })))
    const dia = pastaExportacao(new Date())
    const identidade = useEditor.getState().identidade
    const docs = new Map<string, { tema: DocTema; base: DocTrabalho }>()
    const abrir = async (t: TemaDisponivel) => { let d = docs.get(t.id); if (!d) { d = await abrirTemaEBase(r0, t); docs.set(t.id, d) } return d }
    // Lote 5 (item 76): folha montada AVULSA, ou "Aproveitar folhas" ligado → LOTE (pedidos juntos nas folhas)
    const lotes = new Map<string, Lote>()
    const normais: typeof fila = []
    for (const it of fila) {
      const t = temaDe(it.alvo.tema!.themeId)
      const d = t ? await abrir(t).catch(() => null) : null
      const grupo = d ? baseDoAlvo(d.base, d.tema, it.alvo.itens[0]).grupo : null
      const folha = d && grupo?.folhaId ? (d.base.folhas ?? []).find(x => x.id === grupo.folhaId) : undefined
      if (!t || !folha || !(aproveitar || folha.tipo === 'avulso' || grupo?.composicao?.length)) { normais.push(it); continue }
      const chave = aproveitar ? `${t.id}|${folha.id}` : it.id
      const lt = lotes.get(chave) ?? { t, folha, grupo, itens: [] }
      lt.itens.push(it); lotes.set(chave, lt)
    }
    const rsLote: ResultadoItem<Resultado>[] = []
    let feitosLote = 0
    for (const lt of lotes.values()) {
      if (cancelar.current) break
      setProgresso({ feitos: feitosLote, total: fila.length, atual: `${lt.folha.nome} · ${lt.itens.length} pedido(s)` })
      try { rsLote.push(...await gerarLote(lt, dia, identidade, await abrir(lt.t))) } catch (e) { rsLote.push(...lt.itens.map(it => ({ id: it.id, status: 'erro' as const, mensagem: (e as Error).message }))) }
      feitosLote += lt.itens.length
    }
    return { fila, normais, rsLote, feitosLote, dia, identidade, abrir }
  }
  /** O que vai para a arte de um item normal: a base do produto (grupo/folha), o tema, as cópias e a pasta. */
  function montarItem(d: { tema: DocTema; base: DocTrabalho }, l: LinhaPedido, alvo: AlvoPedido, dia: string) {
    const avisos: string[] = []
    // Lote 5 (item 72): o grupo do produto na base de portfólio (Kit Festa, Sacola P…); sem grupo, a base inteira
    const { doc: docGrupo, grupo } = baseDoAlvo(d.base, d.tema, alvo.itens[0])
    // Lote 5 (item 76): produto de peças pequenas → a FOLHA MONTADA (prancheta virtual), 1 kit = 1 folha
    const folha = grupo?.folhaId ? (d.base.folhas ?? []).find(x => x.id === grupo.folhaId) : undefined
    const vf = folha ? docDaFolha(d.base, d.tema, folha) : null
    const doc = vf?.doc ?? docGrupo, temaArte = vf?.tema ?? d.tema
    if (d.base.grupos?.length && !grupo) avisos.push(`"${alvo.produto || 'produto'}" não tem grupo ligado na base — saiu a base inteira`)
    const valores = valoresDaLinha(l, d.tema)
    const produto = grupo?.nome || d.tema.produto || alvo.produto || produtoDoItem(alvo.itens[0] ?? {})
    const pasta = pastaDoProduto(dia, produto)
    // Lote 5 (item 79): cada caixa na quantidade dela (a salva no pedido, ou a do kit dividida pelas caixas)
    const total = pecasDoAlvo(alvo), caixas = caixasDe(doc).map(c => c.id)
    // folha montada: quantos KITS (cada kit = uma folha); caixas: a quantidade de cada caixa
    const kits = vf ? Math.max(1, alvo.itens.reduce((s, i) => s + (Number((i as { qtdVendida?: number }).qtdVendida) || 0), 0) || 1) : 0
    const copias = saida.quantidade !== 'pedido' ? undefined
      : vf ? { [vf.artboardId]: kits }
      : (l.quantidades?.[chaveDoAlvo(alvo)] ?? (total ? quantidadesPadrao(total, caixas).porCaixa : undefined))
    return { avisos, doc, temaArte, valores, produto, pasta, total, kits, vf, grupo, copias }
  }
  /** Lote 7 (item 119): depois de gerar, "Iniciar a etapa Impressão" nos pedidos do SOA que saíram. */
  async function depoisDeGerar(rs: ResultadoItem<Resultado>[], iniciar: boolean) {
    const ok = [...new Set(rs.filter(r => r.status !== 'erro').map(r => r.id.split('#')[0]))]
    if (iniciar && plano === 'soa' && etapa && ok.length) await aplicarStatus(ok, 'iniciar_impressao')
  }

  /** Gera os pedidos dados: um arquivo por pedido e PRODUTO (grupo da base), na quantidade do pedido. */
  async function gerar(lista: LinhaPedido[]) {
    if (!raiz) { setErro('Conecte a pasta Biblioteca MAE.'); return }
    if (!lista.some(l => l.tema)) return
    cancelar.current = false; setResultados(null); setErro(null); setMsgStatus(null)
    const { fila, normais, rsLote, feitosLote, dia, identidade, abrir } = await prepararEGerarFolhas(lista, saida.aproveitar)
    const rs = await rodarFila(normais, async ({ l, alvo }) => {
      const t = temaDe(alvo.tema!.themeId)
      if (!t) throw new Error('tema não encontrado')
      const d = await abrir(t)
      const { avisos, doc, temaArte, valores, pasta, total, kits, vf, grupo, copias } = montarItem(d, l, alvo, dia)
      const r = await gerarArteDoPedido({ raiz, pedido: l.pedido, tema: temaArte, base: doc, identidade, marcas,
        opcoes: { ...opcoesDoPedido({ agrupar: saida.agrupar, linhas: saida.linhas, apliques: saida.apliques }, valores, pasta), pedido: l.pedido.numero, copias,
          ...(vf ? { svg: saida.cortePorPedido, dxf: saida.cortePorPedido } : {}), sufixoArquivo: vf ? sufixoQuantidade(grupo?.nome || alvo.produto || 'Folha', kits) : total ? sufixoQuantidade(grupo?.nome || alvo.produto || 'Kit', total) : undefined } })
      avisos.push(...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a)))
      return { valor: { arquivo: r.arquivos.find(a => a.endsWith('.pdf')) ?? null, pasta, avisos }, avisos }
    }, { aoProgredir: (feitos, _t, atual) => setProgresso({ feitos: feitosLote + feitos, total: fila.length, atual: atual ? `Pedido ${atual.l.pedido.numero}${atual.l.alvos.length > 1 ? ` · ${atual.alvo.produto.slice(0, 30)}` : ''}` : '' }), cancelado: () => cancelar.current })
    setResultados([...rsLote, ...rs]); setProgresso(null)
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: ps.find(p => p.id === l.pedido.id) ?? l.pedido })))
    await depoisDeGerar([...rsLote, ...rs], iniciarImp)
  }

  /**
   * Lote 7 (itens 117/118): GERAR EM LOTE — vários pedidos num PDF só, nas quantidades, na ordem escolhida e com o
   * "#nº · Nome" na margem. Folha montada (tags, etiquetas) segue o gabarito e o "Aproveitar folhas".
   */
  async function gerarEmLote(lista: LinhaPedido[], e: EscolhasLote) {
    setModalLote(false)
    if (!raiz) { setErro('Conecte a pasta Biblioteca MAE.'); return }
    if (!lista.some(l => l.tema)) return
    cancelar.current = false; setResultados(null); setErro(null); setMsgStatus(null)
    const { fila, normais, rsLote, feitosLote, dia, identidade, abrir } = await prepararEGerarFolhas(lista, true)
    const itens: (ItemLote & { l: LinhaPedido; avisos: string[]; pasta: string; temaId: string; temaVersao: number })[] = []
    const rsErro: ResultadoItem<Resultado>[] = []
    for (const { id, l, alvo } of normais) {
      const t = temaDe(alvo.tema!.themeId)
      if (!t) { rsErro.push({ id, status: 'erro', mensagem: 'tema não encontrado' }); continue }
      try {
        const d = await abrir(t)
        const m = montarItem(d, l, alvo, dia)
        itens.push({ id, pedidoId: l.pedido.id, numero: l.pedido.numero, nome: (l.editadas.NOME ?? l.campos.NOME ?? '').trim().split(/\s+/)[0] ?? '', temaNome: m.temaArte.name ?? t.name,
          tema: m.temaArte, doc: m.doc, valores: m.valores, copias: m.copias, produto: m.produto, l, avisos: m.avisos, pasta: m.pasta, temaId: m.temaArte.id, temaVersao: m.temaArte.version })
      } catch (er) { rsErro.push({ id, status: 'erro', mensagem: (er as Error).message }) }
    }
    const rl = await gerarLotesImpressao({ raiz, identidade, marcas }, itens, {
      ordem: e.ordem, intercalar: e.intercalar, identificacao: e.identificacao, maxPedidos: e.maxPedidos, separarPorProduto: e.separarPorProduto,
      linhas: saida.linhas, apliques: saida.apliques, pasta: produto => pastaDoProduto(dia, produto),
    }, { aoProgredir: (f, _t, atual) => setProgresso({ feitos: feitosLote + f, total: fila.length, atual }), cancelado: () => cancelar.current })
    const rs: ResultadoItem<Resultado>[] = []
    for (const r of rl) {
      const it = itens.find(x => x.id === r.id)!
      if (r.erro) { rs.push({ id: r.id, status: 'erro', mensagem: r.erro }); continue }
      const avisos = [...it.avisos, ...(r.revisar ? ['revisar o texto'] : []), ...r.alertas]
      await apiMae.registrarArte({ orderId: it.pedidoId, themeId: it.temaId, themeVersion: it.temaVersao, variaveis: { ...it.valores, _lote: r.lote ?? '' }, status: r.revisar ? 'revisar' : 'gerada', arquivo: r.arquivo }).catch(er => console.warn('[MAE] registrar arte', er))
      rs.push({ id: r.id, status: avisos.length ? 'aviso' : 'gerada', valor: { arquivo: r.arquivo, pasta: it.pasta, avisos, lote: r.lote ?? undefined }, avisos })
    }
    const todos = [...rsLote, ...rsErro, ...rs]
    setResultados(todos); setProgresso(null)
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: ps.find(p => p.id === l.pedido.id) ?? l.pedido })))
    await depoisDeGerar(todos, e.iniciarImpressao)
  }

  const res = resultados ? resumo(resultados) : null
  const nSel = selecionadas.filter(l => l.tema).length
  const pendentes = linhas.filter(l => !gerada(l)).length, jaGerados = linhas.length - pendentes
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4" data-edicao-massa data-mae-raiz>
      <DicasMae />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pedidos e edição em massa</h1>
          <p className="text-sm text-gray-500">Confira cada pedido na linha dele e gere um por um, ou vários de uma vez.</p>
        </div>
        <Link href="/estudio/mae/tema" className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 text-orange-700 dark:text-orange-300 px-3 py-1.5 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30"><Palette className="w-4 h-4" /> Abrir o editor de temas</Link>
      </div>
      <BarraBiblioteca />
      {erro && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" data-erro-massa>{erro}</p>}
      {/* Lote 7 (item 120): MAE avulso — os pedidos vêm da planilha da Shopee ou do cadastro manual */}
      {plano === 'mae' && (
        <div className="flex flex-wrap items-center gap-2" data-pedidos-avulso>
          <button className={btn} onClick={() => setImportar(true)} data-abrir-importar><Upload className="w-3.5 h-3.5" /> Importar pedidos (planilha da Shopee)</button>
          <button className={btn} onClick={() => setManual(true)} data-abrir-manual><Plus className="w-3.5 h-3.5" /> Novo pedido</button>
        </div>
      )}
      {/* Lote 7 (item 119): sem etapa de Impressão no fluxo de produção do SOA */}
      {plano === 'soa' && etapa === null && !semEtapaDispensado && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm flex flex-wrap items-center gap-2" data-sem-etapa-impressao>
          <Printer className="w-4 h-4 text-amber-700" />
          <span className="flex-1">Seu fluxo de produção não tem etapa de <b>Impressão</b>. Criar agora? <span className="text-xs text-gray-600">(Ela entra antes da Expedição; a posição se muda em Configurações → Produção.)</span></span>
          <button className={btn + ' !border-amber-500'} onClick={() => void criarEtapa()} data-criar-etapa-impressao>Criar agora</button>
          <button className={btn} onClick={() => setSemEtapaDispensado(true)}>Agora não</button>
        </div>
      )}
      {msgStatus && <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 flex items-center gap-2" data-msg-status><Check className="w-4 h-4" /> {msgStatus}<button className="ml-auto" onClick={() => setMsgStatus(null)} aria-label="Fechar"><X className="w-3.5 h-3.5" /></button></p>}
      <FiltrosPedidos filtros={filtros} setFiltros={setFiltros} opcoes={opcoesFiltro} salvos={salvos} total={visiveis.length} selecionados={marcadas.size}
        onSalvar={nome => void guardarSalvos(guardarFiltro(salvos, nome, filtros))} onExcluirSalvo={nome => void guardarSalvos(salvos.filter(s => s.nome !== nome))} />
      {/* Lote 7 (item 116): AÇÕES EM MASSA nos selecionados */}
      {marcadas.size > 0 && (
        <div className="sticky top-0 z-10 rounded-xl border border-orange-300 bg-orange-50/95 dark:bg-orange-950/80 px-3 py-2 flex flex-wrap items-center gap-2 text-xs shadow-sm" data-barra-massa>
          <b>{marcadas.size} selecionado{marcadas.size === 1 ? '' : 's'}</b>
          <select value="" onChange={e => void vincularEmMassa(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1" aria-label="Vincular tema aos selecionados" data-vincular-massa>
            <option value="">Vincular tema…</option>
            {temas.map(t2 => <option key={t2.id} value={t2.id}>{t2.name}{t2.baseNome ? ` · base ${t2.baseNome}` : ''}</option>)}
          </select>
          <button className={btn} disabled={!nSel || !!progresso || !liberada} onClick={() => void gerar(selecionadas)} data-gerar-massa><Download className="w-3.5 h-3.5" /> Gerar ({nSel})</button>
          <button className={btn + ' !border-orange-500 text-orange-800'} disabled={!nSel || !!progresso || !liberada} onClick={() => setModalLote(true)} title="Um PDF só para imprimir de uma vez, nas quantidades" data-gerar-em-lote><Layers3 className="w-3.5 h-3.5" /> Gerar em lote ({nSel})</button>
          {comImpressao && <button className={btn} disabled={!!progresso} onClick={() => void aplicarStatus([...marcadas], 'impresso')} data-marcar-impresso-massa><Printer className="w-3.5 h-3.5" /> Marcar como impresso</button>}
          <button className="ml-auto text-gray-500 underline" onClick={() => setMarcadas(new Set())}>Limpar seleção</button>
        </div>
      )}
      {perguntaMassa && (
        <div className="rounded-xl border border-orange-200 bg-white dark:bg-gray-900 px-3 py-2 text-sm flex flex-wrap items-center gap-2" data-pergunta-massa>
          <span className="flex-1">Lembrar <b>{temaDe(perguntaMassa.themeId)?.name}</b> para os próximos pedidos com o tema <b>{perguntaMassa.temas.join(', ').slice(0, 120)}</b>?</span>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} onClick={() => void lembrarParaOsProximos()} data-lembrar-sim>Sim, lembrar</button>
          <button className={btn} onClick={() => setPerguntaMassa(null)} data-lembrar-nao>Só nestes pedidos</button>
        </div>
      )}

      {/* abas + seleção + saída */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAba('pendentes')} className={pilula(aba === 'pendentes')} data-aba-massa="pendentes">Pendentes <b>{pendentes}</b></button>
        <button onClick={() => setAba('gerados')} className={pilula(aba === 'gerados')} data-aba-massa="gerados">Já gerados <b>{jaGerados}</b></button>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <button className={btn} onClick={() => setMarcadas(new Set(visiveis.filter(l => l.tema && aprovado(l)).map(l => l.pedido.id)))} title="Os que já estão em produção, ou com o campo de aprovação marcado" data-selecionar-aprovados>Selecionar aprovados</button>
        <button className={btn} onClick={() => setMarcadas(new Set(visiveis.map(l => l.pedido.id)))} title="Todos os pedidos que aparecem (com os filtros)" data-selecionar-todos>Selecionar todos</button>
        {marcadas.size > 0 && <button className={btn} onClick={() => setMarcadas(new Set())}>Limpar</button>}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <select className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1" value={saida.quantidade} onChange={e => setSaida(s => ({ ...s, quantidade: e.target.value as 'pedido' }))} title="O PDF já sai com cada caixa repetida na quantidade do pedido" data-saida-quantidade>
            <option value="pedido">Já sair na quantidade do pedido</option><option value="um">1 de cada (aprovação/teste)</option>
          </select>
          <select className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1" value={saida.agrupar} onChange={e => setSaida(s => ({ ...s, agrupar: e.target.value as 'tudo' }))} data-formato-massa>
            <option value="tudo">1 PDF por pedido e produto</option><option value="prancheta">1 PDF por folha</option>
          </select>
          <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={saida.linhas} onChange={e => setSaida(s => ({ ...s, linhas: e.target.checked }))} /> Linhas de corte</label>
          <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={saida.apliques} onChange={e => setSaida(s => ({ ...s, apliques: e.target.checked }))} /> Folhas de aplique</label>
          <label className="flex items-center gap-1" title="Folha montada: o arquivo de corte é o do gabarito (Base → Folhas de impressão). Marque só se cortar sem marca de registro."><input type="checkbox" className="accent-orange-500" checked={saida.cortePorPedido} onChange={e => setSaida(s => ({ ...s, cortePorPedido: e.target.checked }))} data-corte-por-pedido /> Corte por pedido</label>
          {plano === 'soa' && etapa && <label className="flex items-center gap-1" title={`Ao gerar, os pedidos passam para a etapa ${etapa.nome} da produção (gerar de novo não volta de etapa)`}><input type="checkbox" className="accent-orange-500" checked={iniciarImp} onChange={e => setIniciarImp(e.target.checked)} data-iniciar-impressao /> Iniciar a etapa {etapa.nome}</label>}
          <label className="flex items-center gap-1" title="Peças pequenas (folha montada na Base): junta vários pedidos nas mesmas folhas — as peças de cada pedido ficam juntas, com o #número fora da linha de corte; o kit nunca se divide entre folhas. Sai 1 PDF LOTE + o resumo da separação."><input type="checkbox" className="accent-orange-500" checked={saida.aproveitar} onChange={e => setSaida(s => ({ ...s, aproveitar: e.target.checked }))} data-aproveitar-folhas /> Aproveitar folhas (juntar pedidos)</label>
          {progresso
            ? <button className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold" onClick={() => { cancelar.current = true }} data-parar><Square className="w-4 h-4" /> Parar ({progresso.feitos}/{progresso.total})</button>
            : <button onClick={() => void gerar(selecionadas)} disabled={!nSel || carregando || !liberada} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40" data-gerar-todos><Download className="w-4 h-4" /> Gerar selecionados ({nSel})</button>}
        </span>
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
          <span className="text-xs text-gray-500">Arquivos em Exportações / hoje / <i>Produto</i> / <i>Nome_Idadeanos_Tema_Quantidade</i>.pdf{saida.aproveitar ? <> · folhas juntas: <i>LOTE_Peça_dia-mês</i>.pdf (a separação aparece na linha do pedido)</> : null}</span>
        </div>
      )}

      {carregando ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando os pedidos…</p>
        : !visiveis.length ? <p className="text-sm text-gray-500">{aba === 'gerados' ? 'Nenhum pedido gerado ainda.' : <>Nenhum pedido pendente. Os pedidos precisam dos campos <b>TEMA</b>, <b>NOME</b> e <b>IDADE</b> (Configurações → Campos do pedido).</>}</p>
        : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="p-2 w-6" /><th className="p-2">Prévia</th><th className="p-2">Pedido</th><th className="p-2">Nome</th><th className="p-2 w-16">Idade</th><th className="p-2">Campos</th><th className="p-2 text-center">💬</th><th className="p-2">Qtd.</th><th className="p-2">Ações</th><th className="p-2">Arte</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map(l => {
                  const t = temaDe(l.tema?.themeId), v = valoresDaLinha(l, t?.doc ?? null)
                  const pv = produtoEVariacao(l)
                  const r = resultados?.find(x => x.id === l.pedido.id || x.id.startsWith(`${l.pedido.id}#`))
                  const st = statusDoCard(l.pedido.artes)
                  const extras = Object.keys(t?.doc?.sample ?? {}).filter(k => !NAO_CAMPO.has(k))
                  const totalPecas = l.alvos.reduce((s, a) => s + pecasDoAlvo(a), 0)
                  const qtdSalva = Object.keys(l.quantidades ?? {}).length > 0
                  const quando = geradaEm(l)
                  const campo = (k: string, valor: string, ph: string, w = 'min-w-[7rem]') => (
                    <input value={l.editadas[k] ?? valor} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, [k]: e.target.value } }))} onBlur={() => void gravarCampo(linhas.find(x => x.pedido.id === l.pedido.id)!, k)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={`${inp} ${w}`} placeholder={ph} aria-label={ph} data-campo-linha={k} />
                  )
                  return (
                    <tr key={l.pedido.id} className={`border-t border-gray-100 dark:border-gray-800 align-top ${destaque.id === l.pedido.id ? 'ring-2 ring-inset ring-orange-400 bg-orange-50/60 dark:bg-orange-950/20' : marcadas.has(l.pedido.id) ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`} data-linha-pedido={l.pedido.numero} data-destaque={destaque.id === l.pedido.id ? 1 : undefined}>
                      <td className="p-2"><input type="checkbox" className="accent-orange-500" checked={marcadas.has(l.pedido.id)} onChange={e => marcar(l.pedido.id, e.target.checked)} aria-label={`Selecionar o pedido ${l.pedido.numero}`} data-selecionar-linha /></td>
                      <td className="p-2">{t ? <Miniatura raiz={raiz} t={t} valores={v} item={l.alvos[0]?.itens[0]} id={l.pedido.id} unidades={totalPecas} /> : <span className="text-[10px] text-gray-400">—</span>}</td>
                      <td className="p-2 min-w-[12rem] max-w-[16rem]">
                        <div className="flex items-center gap-1"><b>#{l.pedido.numero}</b>{aprovado(l) && <span className="rounded bg-emerald-50 px-1 text-[9px] font-semibold text-emerald-700" title="Aprovado / em produção">aprovado</span>}
                          {/* Lote 6 (item 101): o status do pedido no SOA (fora do "Selecionar aprovados" quando não é aprovado) */}
                          {l.pedido.statusMae
                            ? <span className={`rounded px-1 text-[9px] font-medium ${l.pedido.statusMae === 'impresso' ? 'bg-sky-50 text-sky-700' : 'bg-gray-50 text-gray-500'}`} title="Status do pedido no MAE" data-selo-status={l.pedido.statusMae}>{ROTULO_MAE[l.pedido.statusMae]}</span>
                            : l.pedido.status && <span className={`rounded px-1 text-[9px] font-medium ${aprovado(l) ? 'bg-gray-50 text-gray-500' : 'bg-amber-50 text-amber-800'}`} title="Status do pedido no SOA" data-selo-status={l.pedido.status}>{rotuloStatus(l.pedido.status)}</span>}</div>
                        <div className="text-[10px] text-gray-500 truncate">{l.pedido.cliente}{l.pedido.canal ? <span className="text-gray-400"> · {l.pedido.canal}{l.pedido.loja ? ` · ${l.pedido.loja}` : ''}</span> : null}</div>
                        {/* Lote 7 (item 116): prazo de envio, com a urgência */}
                        {l.pedido.dataEnvio && (() => { const s = situacaoPrazo(l.pedido.dataEnvio, hoje); return <div className={`text-[10px] ${s === 'atrasado' ? 'text-red-600 font-semibold' : s === 'hoje' ? 'text-orange-700 font-semibold' : s === 'amanha' ? 'text-amber-700' : 'text-gray-400'}`} data-prazo-linha={s}>envio {fmtDia(l.pedido.dataEnvio)}{PRAZO_TXT[s] ? ` · ${PRAZO_TXT[s]}` : ''}</div> })()}
                        {/* Lote 7 (item 119): a etapa atual na produção do SOA */}
                        {l.pedido.etapa && <div className={`text-[10px] ${l.pedido.etapa.tipo === 'impressao' || (etapa && l.pedido.etapa.nome === etapa.nome) ? 'text-sky-700 font-semibold' : 'text-gray-500'}`} data-etapa-linha>etapa: {l.pedido.etapa.nome}</div>}
                        {(pv.produto || pv.variacao) && <div className="text-[10px] text-gray-400 truncate" title={`${pv.produto}${pv.variacao ? ` · ${pv.variacao}` : ''}`} data-produto-linha>{pv.produto}{pv.variacao ? <> · <span className="text-gray-500">{pv.variacao}</span></> : null}</div>}
                        <select value={l.tema?.themeId ?? ''} onChange={e => void escolherTema(l, e.target.value)} className={inp + ' mt-1'} title="Tema da arte (fica lembrado para o mesmo produto + TEMA)" data-tema-linha>
                          <option value="">— escolher o tema —</option>
                          {/* Lote 6 (item 97): "Tema · base" e primeiro os temas deste produto */}
                          {(() => {
                            const doProduto = temas.filter(t2 => servePara(t2, pv.produto))
                            const op = (t2: TemaDisponivel) => <option key={t2.id} value={t2.id}>{t2.name}{t2.baseNome ? ` · base ${t2.baseNome}` : t2.produto ? ` · ${t2.produto}` : ''}</option>
                            return doProduto.length && doProduto.length < temas.length
                              ? <><optgroup label={`Para ${pv.produto.slice(0, 40)}`}>{doProduto.map(op)}</optgroup><optgroup label="Outros temas">{temas.filter(t2 => !doProduto.includes(t2)).map(op)}</optgroup></>
                              : temas.map(op)
                          })()}
                        </select>
                        {!l.tema && l.campos.TEMA && <div className="text-[10px] text-amber-700" data-tema-nao-encontrado>TEMA &ldquo;{l.campos.TEMA}&rdquo; não encontrado</div>}
                        {l.alvos.length > 1 && <div className="text-[10px] text-gray-500" data-varios-produtos>{l.alvos.length} produtos → {l.alvos.length} arquivos</div>}
                        {pergunta?.id === l.pedido.id && (
                          <div className="mt-1 rounded border border-orange-200 bg-white dark:bg-gray-900 p-1.5 text-[11px] space-y-1" data-pergunta-produto>
                            <p>Usar <b>{temaDe(pergunta.themeId)?.name}</b> para <b>todos</b> os pedidos com o tema <b>{pergunta.produto.slice(0, 60)}</b>?</p>
                            <div className="flex gap-1">
                              <button type="button" className={btn + ' bg-orange-500 text-white !border-orange-500'} onClick={() => void usarParaOTema()} data-produto-sim>Sim, para todos</button>
                              <button type="button" className={btn} onClick={() => setPergunta(null)} data-produto-nao>Só neste pedido</button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        {l.campos.revisarNomeIdade && <p className="mb-0.5 text-[10px] text-amber-800 bg-amber-50 rounded px-1" data-revisar-nome-idade>Veio: “{l.campos.revisarNomeIdade}”</p>}
                        {campo('NOME', l.campos.NOME ?? '', 'NOME')}
                      </td>
                      <td className="p-2">{campo('IDADE', l.campos.IDADE ?? '', 'IDADE', 'w-14')}</td>
                      <td className="p-2 min-w-[9rem] space-y-1">
                        {extras.map(k => <div key={k}><span className="text-[9px] uppercase text-gray-400">{rotuloVariavel(k)}</span>{campo(k, l.campos.extras[k] ?? t?.doc?.sample?.[k] ?? '', rotuloVariavel(k))}</div>)}
                        {/* Lote 6 (item 93): nome completo dividido em NOME + SOBRENOME (o ponto da divisão, ou sem sobrenome) */}
                        {t?.doc?.sample?.SOBRENOME !== undefined && (() => {
                          const palavras = (l.editadas.NOME ?? l.campos.NOME ?? '').trim().split(/\s+/).filter(Boolean)
                          if (palavras.length < 2) return null
                          const atual = l.divisaoNome ?? 1
                          return (
                            <select value={String(atual)} onChange={e => { const n = Number(e.target.value); editar(l.pedido.id, x => ({ ...x, divisaoNome: n })); void apiMae.divisaoNome(l.pedido.id, n === 1 ? null : n).catch(() => null) }} className={inp} title="Onde termina o NOME (o resto é o SOBRENOME)" data-divisao-nome>
                              {palavras.slice(0, -1).map((_, i) => <option key={i} value={i + 1}>NOME: {palavras.slice(0, i + 1).join(' ')} · SOBRENOME: {palavras.slice(i + 1).join(' ')}</option>)}
                              <option value="0">sem sobrenome ({palavras.join(' ')})</option>
                            </select>
                          )
                        })()}
                        {/* Lote 5 (item 62): formato da idade só neste pedido */}
                        <select value={l.formatoIdade ?? ''} onChange={e => { const f = (e.target.value || null) as LinhaPedido['formatoIdade']; editar(l.pedido.id, x => ({ ...x, formatoIdade: f })); void apiMae.formatoIdade(l.pedido.id, f ?? null).catch(() => null) }} className={inp} title="Formato da idade só neste pedido (padrão: o do tema)" data-formato-idade-linha>
                          <option value="">idade: padrão do tema</option><option value="anos">anos</option><option value="aninhos">aninhos</option><option value="numero">só o número</option>
                        </select>
                        <button className="text-[10px] text-gray-500 underline" onClick={() => setMais(mais === l.pedido.id ? null : l.pedido.id)}>{mais === l.pedido.id ? 'menos' : 'hashtag, tamanho, linhas…'}</button>
                        {mais === l.pedido.id && (
                          <div className="space-y-1" data-mais-linha>
                            <input value={l.editadas.HASHTAG ?? v.HASHTAG} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, HASHTAG: e.target.value } }))} className={inp} aria-label="Hashtag" data-hashtag-linha />
                            <label className="flex items-center gap-1 text-[10px] text-gray-500">Tam. do nome
                              <input type="text" inputMode="decimal" defaultValue={String(Math.round((l.escalas?.NOME ?? 1) * 100))} onBlur={e => { const n = Number(e.target.value.replace(',', '.')) / 100; if (n >= 0.5 && n <= 1.8) { editar(l.pedido.id, x => ({ ...x, escalas: { ...(x.escalas ?? {}), NOME: n } })); void apiMae.ajustarPedido(l.pedido.id, { NOME: Math.abs(n - 1) < 0.005 ? null : n }).catch(() => null) } }} className="w-12 rounded border border-gray-200 bg-transparent px-1" data-escala-linha />%</label>
                            <select value={l.linhas?.NOME ?? ''} className={inp} data-linhas-linha onChange={e => { const val = e.target.value as '' | '1' | '2'; editar(l.pedido.id, x => { const ls = { ...(x.linhas ?? {}) }; if (val) ls.NOME = val; else delete ls.NOME; return { ...x, linhas: ls } }); void apiMae.linhasPedido(l.pedido.id, { NOME: val || null }).catch(() => null) }}>
                              <option value="">nome: linhas automáticas</option><option value="1">nome em 1 linha</option><option value="2">nome em 2 linhas</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button className={`rounded-full p-1 ${l.pedido.observacoes ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-gray-300 cursor-default'}`} disabled={!l.pedido.observacoes} onClick={() => setObs(obs === l.pedido.id ? null : l.pedido.id)} title={l.pedido.observacoes ? 'Ver a observação do pedido' : 'Sem observação'} data-obs-linha={l.pedido.observacoes ? 'sim' : 'nao'}><MessageSquare className="w-4 h-4" /></button>
                        {obs === l.pedido.id && <div className="mt-1 w-56 rounded-lg border border-orange-200 bg-white dark:bg-gray-900 p-2 text-left text-[11px] whitespace-pre-wrap shadow" data-obs-texto>{l.pedido.observacoes}</div>}
                      </td>
                      <td className="p-2">
                        <button className={btn + (qtdSalva ? ' !border-orange-400 text-orange-700' : '')} disabled={!l.tema} onClick={() => setQtd(l.pedido.id)} title="Quantas de cada caixa (vem do kit; ajuste conforme a observação)" data-quantidades-linha><Boxes className="w-3.5 h-3.5" /> {totalPecas || '—'}{qtdSalva ? ' ✎' : ''}</button>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          <button className={btn} disabled={!t} onClick={() => window.dispatchEvent(new CustomEvent('mae:ver-linha', { detail: l.pedido.id }))} data-ver-linha><Eye className="w-3.5 h-3.5" /> Ver</button>
                          <a className={btn + (Object.keys(l.posicoes ?? {}).length ? ' !border-orange-400 text-orange-700' : '')} href={`/estudio/mae?pedido=${encodeURIComponent(l.pedido.id)}&ajustar=1${l.tema ? `&tema=${encodeURIComponent(l.tema.themeId)}` : ''}`} title="Abre a arte deste pedido: mover/tamanho/girar/linhas dos textos só neste pedido (o tema fica travado)" data-ajustar-linha><SlidersHorizontal className="w-3.5 h-3.5" /> Ajustar{Object.keys(l.posicoes ?? {}).length ? ' ✎' : ''}</a>
                          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={!l.tema || !!progresso || !liberada} onClick={() => void gerar([l])} data-gerar-linha>{gerada(l) ? <RotateCcw className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} {gerada(l) ? 'Gerar de novo' : 'Gerar'}</button>
                        </div>
                      </td>
                      <td className="p-2 text-[10px] min-w-[7rem]" data-status-arte={r?.status ?? st.status}>
                        {r ? (r.status === 'erro' ? <span className="text-red-600">erro: {r.mensagem}</span> : <span className={r.status === 'aviso' ? 'text-amber-700' : 'text-emerald-700'}>{r.status === 'aviso' ? 'gerada c/ aviso' : 'Arte gerada ✓'}<div className="text-gray-400 break-all">{r.valor?.pasta.split('/').slice(-1)[0]}</div></span>)
                          : st.status === 'gerada' ? <span className="text-emerald-700">Arte gerada ✓{quando && <div className="text-gray-400">{quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>}</span> : st.status === 'revisar' ? <span className="text-amber-700">revisar</span> : <span className="text-gray-400">não gerada</span>}
                        {/* Lote 7 (item 117): veio de um lote de impressão */}
                        {(r?.valor?.lote || st.ultima?.variaveis?._lote) && <div className="mt-0.5 inline-block rounded bg-orange-50 px-1 text-[9px] text-orange-800 break-all" title="Lote de impressão" data-lote-linha>{r?.valor?.lote || st.ultima?.variaveis?._lote}</div>}
                        {/* Lote 7 (item 119): gerar não é imprimir — marca depois */}
                        {comImpressao && gerada(l) && l.pedido.statusMae !== 'impresso' && <button className="mt-1 block text-[10px] text-sky-700 underline" onClick={() => void aplicarStatus([l.pedido.id], 'impresso')} data-marcar-impresso>Marcar como impresso</button>}
                        {[...l.alertas, ...(r?.avisos ?? [])].map((a, i) => <div key={i} className="text-amber-700">{a}</div>)}
                        {r?.valor?.separacao && <details className="text-gray-600" data-separacao><summary className="cursor-pointer">separação das folhas</summary>{r.valor.separacao.map((x, i) => <div key={i}>{x}</div>)}</details>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      {qtd && (() => { const l = linhas.find(x => x.pedido.id === qtd); return l ? <ModalQuantidades raiz={raiz} l={l} t={temaDe} onFechar={() => setQtd(null)} onSalvo={q => editar(l.pedido.id, x => ({ ...x, quantidades: q }))} /> : null })()}
      {modalLote && <ModalLote pedidos={nSel} comSoa={plano === 'soa'} temEtapa={!!etapa} folhaMontada={0} onFechar={() => setModalLote(false)} onGerar={e => void gerarEmLote(selecionadas, e)} />}
      {manual && <PedidoManual produtos={[...new Set(temas.map(t2 => t2.produto).filter((p): p is string => !!p))]} onFechar={() => setManual(false)} onCriado={() => void carregar()} />}
      {importar && <ImportarPlanilha raiz={raiz} onFechar={() => setImportar(false)} onImportado={() => void carregar()} />}
    </div>
  )
}
