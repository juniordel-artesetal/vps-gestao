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
import { useSession } from 'next-auth/react'
import { planoDaTela, type PlanoTela } from '@/lib/mae/pedidos/planoTela'
import Link from 'next/link'
import { Loader2, Download, Square, Check, AlertTriangle, XCircle, Eye, FolderOpen, RefreshCw, Palette, MessageSquare, Boxes, SlidersHorizontal, RotateCcw, X, Printer, Plus, Upload } from 'lucide-react'
import FiltrosPedidos from './FiltrosPedidos'
import ModalGerar, { escolhasGuardadas } from './ModalGerar'
import type { EscolhasGerar } from '@/lib/mae/exportar/planejar'
import PedidoManual from './PedidoManual'
import ImportarPlanilha from './ImportarPlanilha'
import { gerarLotesImpressao, type ItemLote } from './loteImpressao'
import { filtrar, ordenarPorUrgencia, opcoesDosFiltros, situacaoPrazo, hojeLocal, lerFiltrosSalvos, guardarFiltro, ARQ_FILTROS, type Filtros, type Filtravel, type FiltroSalvo, contarPorDia } from '@/lib/mae/pedidos/filtros'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { escolherPasta, pastaSalva, permissao, reconectar } from '@/lib/mae/biblioteca/pasta'
import { rodarFila, resumo, statusDoCard, produtoDoItem, type ResultadoItem, type AlvoPedido, type ItemPedido } from '@/lib/mae/pedidos/pedidos'
import { parteArquivo, pastaExportacao, quantidadesPadrao, sufixoQuantidade, nomeTemaPronto } from '@/lib/mae/exportar/nomes'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { lerApelidos, lembrarApelido, ARQ_APELIDOS, type Apelidos } from '@/lib/mae/temasProntos/montar'
import { chaveTema, type Vinculo } from '@/lib/mae/pedidos/pedidos'
import { docDoGrupo, grupoDoItem, type Grupo } from '@/lib/mae/editor/grupos'
import { ehBaseMedida, grupoDoKit } from '@/lib/mae/editor/kitBase'
import { docDoLote, docDoKit, distribuirKit, folhasDoKit, distribuirLote, ordemDeLeitura, lugaresDasVagas, contagemDoKit, ehComposicaoPorUnidade, unidadesDoPedido, type Folha, type Contagem } from '@/lib/mae/editor/folhaMontada'
import { unidadesPorFolha, vagasDasUnidades } from '@/lib/mae/medidas/pecas'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { camposDoDoc, camposFaltando, chaveCampo, valorDoCampo } from '@/lib/mae/pedidos/camposDaBase'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Identidade } from './arquivosMae'
import { apiMae, temasDisponiveis, linhasDoPedido, artesDaLinha, idDoPedido, sugereDivisao, comAlvos, alertasLinha, produtoEVariacao, valoresDaLinha, abrirTemaEBase, opcoesDoPedido, gerarArteDoPedido, type LinhaPedido, type TemaDisponivel, type EtapaImpressao, type ResumoStatus, type PedidoApi, type DivisaoPedido } from './pedidosMae'
import { useEditor } from './estado'
import { useMarcas, carregarMarcas } from './marcasMae'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { garantirFontesDoTema, garantirFontesDosValores, registroFontes, useFontes } from './fontesTexto'
import { lerIdentidade } from './arquivosMae'
import { mensagemDeErro } from '@/lib/mae/erros'
import { papelDoItem, tipoDeProduto } from '@/lib/mae/pedidos/ordemLote'
import { alternarNomesNoDoc, valoresDoNome2, sugereDoisNomes, type DoisNomes, type ModoDoisNomes } from '@/lib/mae/pedidos/doisNomes'
import { PREFIXO_AVISO_MR } from '@/lib/mae/exportar/marca'
import BuscaTemas from './BuscaTemas'
import { letrasFaltandoNoPedido, garantirFontesDosTemas } from './letrasFaltando'
import { aguardandoDados } from '@/lib/mae/pedidos/pedidos'

const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800'
const pilula = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`
const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
/** Variáveis que não viram coluna de "campo" (têm o seu lugar ou são calculadas). */
const NAO_CAMPO = new Set(['NOME', 'IDADE', 'HASHTAG', 'ARROBA', 'SUFIXO', 'NOME_IDADE', 'SOBRENOME', 'TEMA'])
/** Lote 8 (item 128): colunas de campo escondidas pela usuária (preferência deste navegador). */
const ARQ_COLUNAS = 'mae:massa:colunasOcultas'
const lerOcultas = (): string[] => { try { const v = JSON.parse(localStorage.getItem(ARQ_COLUNAS) ?? '[]'); return Array.isArray(v) ? v.map(String) : [] } catch { return [] } }
const gravarOcultas = (v: string[]) => { try { localStorage.setItem(ARQ_COLUNAS, JSON.stringify(v)) } catch { /* sem armazenamento local */ } }

/** Base do produto: o GRUPO do item na base de portfólio (item 72) — ou a base inteira, sem grupos. */
function baseDoAlvo(base: DocTrabalho, tema: DocTema, item: ItemPedido | undefined): { doc: DocTrabalho; grupo: Grupo | null; semLigacao?: boolean } {
  const g = item ? grupoDoItem(base, item, tema) : null
  if (g) return { doc: docDoGrupo(base, g.id), grupo: g }
  // Lote 18 (item 220): base de folhas com UM kit só (g_kit) que o pedido não achou pelo produto → usa esse kit (a
  // contagem e as peças por unidade salvas) com a QTD do pedido; sem produto ligado, a linha avisa (laranja)
  const kitUnico = ehBaseMedida(base) && (base.grupos?.length ?? 0) <= 1 ? grupoDoKit(base) : null
  if (kitUnico) return { doc: base, grupo: kitUnico, semLigacao: !kitUnico.produtoId && !kitUnico.produtoNome }
  return { doc: base, grupo: null }
}
const avisoSemProduto = (base: DocTrabalho) => `A base "${base.name}" não está ligada a nenhum produto do SOA — usei a QTD do pedido. Ligue em Base → Produto do SOA.`
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
    await garantirFontesDosValores(valores, raiz)   // Lote 12 (item 171): a letra trocada no pedido aparece na miniatura
    const { doc, grupo, semLigacao } = baseDoAlvo(base, tema, item)
    // Lote 6 (item 97) / Lote 14 (item 189): produto de folhas → "96 un. · 4 folhas" — e a prévia mostra as FOLHAS
    const kit = ehComposicaoPorUnidade(grupo) ? [] : folhasDoKit(base, grupo)
    let docV = doc, temaV = tema, porSlot: Record<string, Record<string, string>> | undefined
    if (kit.length) {
      const cont = contagemDoKit(grupo, kit)
      const conta = cont === 'composicao' ? { kits: Math.max(1, unidades || 1), pecas: 0 } : { kits: 1, pecas: Math.max(1, unidades || kit[0].folha.pecas.length) }
      const kd = docDoKit(base, tema, distribuirKit(kit, [conta], cont, false, grupo?.composicao), [{ rotulo: '', valores }])
      docV = kd.doc; temaV = kd.tema; porSlot = kd.valoresPorSlot
      setLegenda(`${cont === 'composicao' ? `${conta.kits} un. · ` : cont === 'pecas' ? `${conta.pecas} un. · ` : ''}${kd.artboardIds.length} folha${kd.artboardIds.length > 1 ? 's' : ''}${semLigacao ? ' · base sem produto do SOA (usei a QTD)' : ''}`)
    }
    const abs = docV.artboards.filter(a => docV.molds.some(m => m.artboardId === a.id)).slice(0, 6)
    const bmps: ImageBitmap[] = []
    for (const ab of abs.length ? abs : docV.artboards.slice(0, 1)) {
      const p = { ...ab, layers: resolverPrancheta(docV, ab.id, { tema: temaV, texto: { fontes: registroFontes, valores, valoresPorSlot: porSlot } }) }
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
    })().catch(e => { if (vivo) setErro(mensagemDeErro(e)) })
    return () => { vivo = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function salvar() {
    if (!porAlvo) return
    setSalvando(true)
    const q = Object.fromEntries(porAlvo.map(a => [a.chave, a.q]))
    try { await apiMae.quantidades(l.pedido.id, q); onSalvo(q); onFechar() } catch (e) { setErro(mensagemDeErro(e)) } finally { setSalvando(false) }
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
/**
 * Lote 18 (item 224): DIVIDIR o pedido — 2 (ou mais) partes, cada uma com nome, idade, tema e QTD (12 → 6 + 6,
 * editável). Soma maior que o pedido pede confirmação.
 */
function ModalDividir({ l, temas, onFechar, onSalvar }: { l: LinhaPedido; temas: TemaDisponivel[]; onFechar: () => void; onSalvar: (d: DivisaoPedido[]) => void }) {
  const total = l.pedido.itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)
  const montar = (n: number): DivisaoPedido[] => Array.from({ length: n }, (_, i) => ({ sufixo: 'ABCDEF'[i], NOME: i === 0 ? l.campos.NOME ?? '' : '', IDADE: i === 0 ? l.campos.IDADE ?? '' : '', temaId: l.tema?.themeId ?? null, qtd: total ? Math.floor(total / n) + (i < total % n ? 1 : 0) : 0 }))
  const [partes, setPartes] = useState<DivisaoPedido[]>(() => montar(2))
  const soma = partes.reduce((s, p) => s + (p.qtd ?? 0), 0)
  const mudar = (i: number, x: Partial<DivisaoPedido>) => setPartes(ps => ps.map((p, j) => (j === i ? { ...p, ...x } : p)))
  const salvar = () => {
    if (total && soma > total && !confirm(`A soma das partes (${soma}) passa do pedido (${total}). Dividir assim mesmo?`)) return
    onSalvar(partes.map(p => ({ ...p, NOME: p.NOME?.trim() || undefined, IDADE: p.IDADE?.trim() || undefined })))
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onFechar} data-modal-dividir>
      <div className="w-full max-w-lg space-y-2 rounded-xl bg-white p-4 text-xs shadow-xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold">Dividir o pedido #{l.pedido.numero}</p>
        {l.pedido.observacoes && <p className="rounded bg-amber-50 p-1.5 text-[11px] whitespace-pre-wrap dark:bg-amber-950/30">💬 {l.pedido.observacoes}</p>}
        <label className="flex items-center gap-1">Partes
          <select value={partes.length} onChange={e => setPartes(montar(Number(e.target.value)))} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" data-n-partes>{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select>
          {total > 0 && <span className="text-gray-500">· QTD do pedido: {total}{soma !== total ? <b className={soma > total ? ' text-red-600' : ' text-amber-700'}> (partes somam {soma})</b> : ''}</span>}
        </label>
        <div className="space-y-1">
          {partes.map((p, i) => (
            <div key={p.sufixo} className="grid grid-cols-[2rem_1fr_4rem_1fr_3.5rem] items-center gap-1" data-parte={p.sufixo}>
              <b>-{p.sufixo}</b>
              <input value={p.NOME ?? ''} onChange={e => mudar(i, { NOME: e.target.value })} placeholder="Nome" className={inp} data-nome-parte />
              <input value={p.IDADE ?? ''} onChange={e => mudar(i, { IDADE: e.target.value })} placeholder="Idade" className={inp} data-idade-parte />
              <select value={p.temaId ?? ''} onChange={e => mudar(i, { temaId: e.target.value || null })} className={inp} data-tema-parte>
                <option value="">(o do pedido)</option>
                {temas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="text" inputMode="numeric" value={String(p.qtd ?? 0)} onChange={e => mudar(i, { qtd: Math.max(0, Math.min(9999, Math.round(Number(e.target.value.replace(/\D/g, '')) || 0))) })} className={inp} title="QTD desta parte" data-qtd-parte />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500">As partes saem com o mesmo número do pedido (…-A, …-B) e juntas no lote. O pedido só vira impresso quando todas as partes forem impressas.</p>
        <div className="flex justify-end gap-1">
          <button className={btn} onClick={onFechar}>Cancelar</button>
          <button className={btn + ' !border-orange-500 bg-orange-500 text-white'} onClick={salvar} data-confirmar-dividir>Dividir</button>
        </div>
      </div>
    </div>
  )
}

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
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [apelidos, setApelidos] = useState<Apelidos>({})
  const [pergunta, setPergunta] = useState<{ id: string; themeId: string; produto: string; produtoId: string | null } | null>(null)
  const [obs, setObs] = useState<string | null>(null)
  const [qtd, setQtd] = useState<string | null>(null)
  const [dividir, setDividir] = useState<string | null>(null)   // Lote 18 (item 224)
  const [editandoDois, setEditandoDois] = useState<string | null>(null)   // Lote 19 (item 237)
  const [rascunhoDois, setRascunhoDois] = useState<DoisNomes | null>(null)
  const [mais, setMais] = useState<string | null>(null)
  // Lote 8 (item 128): tema + base de cada tema em uso (os CAMPOS da linha vêm do grupo do produto na base) e as colunas
  // escondidas
  const [docsTema, setDocsTema] = useState<Record<string, { tema: DocTema; base: DocTrabalho }>>({})
  const [ocultas, setOcultas] = useState<string[]>([])
  const [verColunas, setVerColunas] = useState(false)
  const cancelar = useRef(false)
  // Lote 7 (item 116): busca, filtros em chips e filtros salvos (Biblioteca: Pedidos/filtros.json)
  const [filtros, setFiltros] = useState<Filtros>({})
  const [salvos, setSalvos] = useState<FiltroSalvo[]>([])
  const [perguntaMassa, setPerguntaMassa] = useState<{ themeId: string; temas: string[] } | null>(null)
  // Lote 7 (itens 119/120): plano (SOA completo × só MAE), etapa de Impressão do fluxo e o "iniciar impressão"
  // Lote 22 (item 257): a conta "só MAE" vem marcada no login — os botões dela nunca dependem da consulta
  const { data: sessao } = useSession()
  const [planoConsulta, setPlanoConsulta] = useState<PlanoTela | null>(null)
  const plano = planoDaTela((sessao?.user as { soMae?: boolean } | undefined)?.soMae === true, planoConsulta)
  const [etapa, setEtapa] = useState<EtapaImpressao | null | undefined>(undefined)
  const [semEtapaDispensado, setSemEtapaDispensado] = useState(false)
  const [msgStatus, setMsgStatus] = useState<string | null>(null)
  // Lote 14 (item 201): a tela única "Gerar" (substitui a barra de opções e o modal do lote)
  const [modalGerar, setModalGerar] = useState(false)
  const [manual, setManual] = useState(false)
  const [importar, setImportar] = useState(false)
  // Lote 6 (item 100): voltou do Ajustar — a linha do pedido fica destacada (e "Salvar e gerar" já gera)
  const [destaque] = useState<{ id: string | null; gerar: boolean }>(() => { try { const q = new URLSearchParams(window.location.search); return { id: q.get('destaque'), gerar: q.get('gerar') === '1' } } catch { return { id: null, gerar: false } } })
  const destaqueFeito = useRef(false)

  async function carregar() {
    setCarregando(true); setErro(null)
    try {
      const [ts, vs, ps, et] = await Promise.all([temasDisponiveis(raiz), apiMae.vinculos().catch(() => []), apiMae.pedidos(), apiMae.etapaImpressao().catch(() => null)])
      if (et) { setPlanoConsulta(et.plano); setEtapa(et.etapa) }
      if (raiz) setSalvos(lerFiltrosSalvos(await ler(raiz, ARQ_FILTROS).then(f => f.text()).catch(() => null)))
      if (raiz) {
        await carregarMarcas(raiz).catch(() => null)
        if (!Object.keys(useEditor.getState().identidade).length) useEditor.getState().set({ identidade: await lerIdentidade(raiz).catch(() => ({})) })
      }
      setTemas(ts); setVinculos(vs)
      const ap = raiz ? lerApelidos(await ler(raiz, ARQ_APELIDOS).then(f => f.text()).catch(() => null)) : {}
      setApelidos(ap)
      setLinhas(ps.flatMap(p => linhasDoPedido(p, ts, vs, ap)))   // Lote 18 (item 224): dividido → sublinhas
      setMarcadas(new Set())
    } catch (e) { setErro((e as { status?: number }).status === 403 ? 'O add-on "Edição em massa" não está liberado nesta conta.' : `Não consegui carregar os pedidos: ${mensagemDeErro(e)}`) } finally { setCarregando(false) }
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

  /** Lote 18 (item 224): o pedido relido do servidor, mantendo o id/número/itens da sublinha (parte A, B…). */
  const pedidoAtualizado = (ps: PedidoApi[], l: LinhaPedido): PedidoApi => { const p = ps.find(x => x.id === idDoPedido(l.pedido.id)); return !p ? l.pedido : l.divisao ? { ...p, id: l.pedido.id, numero: l.pedido.numero, itens: l.pedido.itens } : p }
  const gerada = (l: LinhaPedido) => statusDoCard(artesDaLinha(l)).status === 'gerada'
  // Lote 18 (item 223): impresso = marcado na arte (ou o avulso com status impresso)
  const impressa = (id: string) => { const l = linhas.find(x => x.pedido.id === id); return !!l && (statusDoCard(artesDaLinha(l)).impresso || (!l.divisao && l.pedido.statusMae === 'impresso')) }
  const [soNaoImpressos, setSoNaoImpressos] = useState(false)
  const geradaEm = (l: LinhaPedido) => { const u = statusDoCard(artesDaLinha(l)).ultima; return u?.criadoEm ? new Date(u.criadoEm as unknown as string) : null }
  /** "Aprovado" no SOA: já em produção, ou um campo de aprovação marcado ("Aprovado", "Arte aprovada" = sim). */
  // Lote 13 (item 183): a loja ainda espera os dados da cliente (não é tema, não é "sem nome", fica fora do lote)
  // Lote 19 (item 245): pedido com o tema SEM NOME escolhido é pedido completo — não cobra NOME/IDADE nem fica aguardando
  const temaSemNome = (l: LinhaPedido) => !!l.tema && (temas.some(t2 => t2.doc?.semNome === l.tema!.themeId) || /sem\s*nome/i.test(temas.find(t2 => t2.id === l.tema!.themeId)?.name ?? ''))
  const aguardando = (l: LinhaPedido) => !temaSemNome(l) && aguardandoDados([l.campos.TEMA, l.editadas.NOME ?? l.campos.NOME, l.pedido.observacoes])
  const semNomeL = (l: LinhaPedido) => !aguardando(l) && !(l.editadas.NOME ?? l.campos.NOME ?? '').trim()
  const aprovado = (l: LinhaPedido) => (l.pedido.status && l.pedido.status !== 'ABERTO') || Object.entries(l.pedido.campos).some(([k, v]) => /aprova/i.test(k) && SIM.test(String(v).trim()))
  // as geradas NESTA rodada continuam em Pendentes até recarregar (com o "Arte gerada ✓")
  const temaDe = (id: string | undefined) => temas.find(t => t.id === id)
  // Lote 13 (item 180): a fonte do NOME/HASHTAG dos temas em uso (para o aviso de letra faltando)
  const versaoFontes = useFontes(f => f.versao)
  const temaDoc = (l: LinhaPedido) => temas.find(t2 => t2.id === l.tema?.themeId)?.doc
  useEffect(() => { void garantirFontesDosTemas(temas.map(t2 => t2.doc), raiz) }, [temas, raiz])
  /** Lote 7 (item 116): o status mostrado (e filtrável): MAE avulso = o do MAE; SOA = aprovado / status em palavras. */
  const statusDaLinha = (l: LinhaPedido) => l.pedido.statusMae ? ROTULO_MAE[l.pedido.statusMae] : aprovado(l) ? 'aprovado' : rotuloStatus(l.pedido.status)
  const filtravel = (l: LinhaPedido): Filtravel => ({
    numero: l.pedido.numero, cliente: l.pedido.cliente ?? '', nome: (l.editadas.NOME ?? l.campos.NOME ?? ''), temaSoa: l.campos.TEMA ?? '', temaMae: temaDe(l.tema?.themeId)?.name ?? '',
    produto: produtoEVariacao(l).produto, status: statusDaLinha(l), canal: l.pedido.canal ?? '', loja: l.pedido.loja ?? '', dataEnvio: l.pedido.dataEnvio ?? '',
    temTema: !!l.tema, comObs: !!l.pedido.observacoes,
    // depende da versão das fontes (a fonte chega depois; o React Compiler só recalcula o que muda)
    semNome: semNomeL(l), aguardando: aguardando(l),
    letraFaltando: versaoFontes >= 0 && letrasFaltandoNoPedido(temaDoc(l), valoresDaLinha(l, temaDoc(l))).length > 0,
    ajustado: Object.keys(l.posicoes ?? {}).length > 0 || Object.keys(l.escalas ?? {}).length > 0 || Object.keys(l.trocas ?? {}).length > 0 || Object.keys(l.quantidades ?? {}).length > 0,
  })
  const hoje = hojeLocal()
  // Lote 19 (item 238): marcado como impresso sai de Pendentes mesmo "gerada c/ aviso" (a etiqueta "revisar" avisa)
  const jaFoi = (l: LinhaPedido) => gerada(l) || impressa(l.pedido.id)
  const daAba = useMemo(() => linhas.filter(l => aba === 'gerados' ? jaFoi(l) && (!soNaoImpressos || !impressa(l.pedido.id)) : (!jaFoi(l) || (!impressa(l.pedido.id) && !!resultados?.some(r => r.id.split('#')[0] === l.pedido.id)))), [linhas, aba, resultados, soNaoImpressos])   // eslint-disable-line react-hooks/exhaustive-deps
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
    await apiMae.temaPedido(l.pedido.id, novo).catch(e => setErro(`Não consegui guardar o tema do pedido #${l.pedido.numero}: ${mensagemDeErro(e)}`))
    const campo = l.campos.TEMA?.trim()
    // Lote 13 (item 183): "AGUARDANDO DADOS" no campo TEMA não é tema — não pergunta nem lembra para os outros pedidos
    if (novo && campo && !aguardandoDados([campo])) setPergunta({ id: l.pedido.id, themeId: novo, produto: campo, produtoId: null })
  }
  /** Lote 13 (item 183): troca o tema SÓ DESTE pedido (versão sem nome / voltar), sem perguntar nem lembrar. */
  async function temaSoNeste(l: LinhaPedido, themeId: string | null) {
    editar(l.pedido.id, x => comAlvos({ ...x, temaPedido: themeId }, temas, vinculos, apelidos))
    await apiMae.temaPedido(l.pedido.id, themeId).catch(e => setErro(`Não consegui guardar o tema do pedido #${l.pedido.numero}: ${mensagemDeErro(e)}`))
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
    } catch (e) { setErro(`Não consegui vincular o tema: ${mensagemDeErro(e)}`) }
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
      // Lote 18 (item 224): parte de pedido dividido — o pedido do SOA só vai para impresso com TODAS as partes impressas
      const idsApi = [...new Set(ids.map(id => {
        const l = linhas.find(x => x.pedido.id === id)
        if (!l?.divisao) return id
        const irmas = linhas.filter(x => x.divisao?.pai === l.divisao!.pai)
        return acao !== 'impresso' || irmas.every(x => ids.includes(x.pedido.id) || impressa(x.pedido.id)) ? l.divisao.pai : null
      }).filter((x): x is string => !!x))]
      const r = idsApi.length && (comImpressao || acao !== 'impresso') ? await apiMae.status(idsApi, acao) : {}
      // Lote 18 (item 223): "Marcar como impresso" também registra na arte (até pedido nunca gerado aqui) → Já gerados
      if (acao === 'impresso') await marcarArte(ids, 'impresso')
      setMsgStatus(resumoStatus({ ...r, impresso: acao === 'impresso' ? ids.length : r.impresso }, acao === 'impresso'))
      const ps = await apiMae.pedidos().catch(() => null)
      if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: pedidoAtualizado(ps, l) })))
    } catch (e) { setErro(`Não consegui atualizar a produção: ${mensagemDeErro(e)}`) }
  }
  /** Lote 18 (item 223): registra 'impresso' / 'desmarcado' na arte de cada pedido (o histórico fica). */
  async function marcarArte(ids: string[], status: 'impresso' | 'desmarcado') {
    for (const id of ids) {
      const l = linhas.find(x => x.pedido.id === id); if (!l) continue
      const u = statusDoCard(artesDaLinha(l)).ultima
      await apiMae.registrarArte({ orderId: id, themeId: u?.themeId ?? l.tema?.themeId ?? 'sem_tema', themeVersion: u?.themeVersion ?? 1, variaveis: l.divisao ? { _PARTE: l.divisao.sufixo } : {}, status, arquivo: null }).catch(er => console.warn('[MAE] marcar arte', er))
    }
  }
  async function desmarcarImpresso(ids: string[]) {
    if (!ids.length) return
    await marcarArte(ids, 'desmarcado')
    setMsgStatus(`${ids.length} pedido(s) de volta em Pendentes.`)
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: pedidoAtualizado(ps, l) })))
  }
  /** Lote 19 (item 237): abre o editor dos 2 nomes (com a sugestão, ou o que já está salvo). Gêmeas: a idade 2 = a 1. */
  function abrirDoisNomes(l: LinhaPedido, s: [string, string] | null) {
    const idade = (l.editadas.IDADE ?? l.campos.IDADE ?? '').trim()
    setRascunhoDois(l.doisNomes ?? { nome1: s?.[0] ?? (l.editadas.NOME ?? l.campos.NOME ?? '').trim(), idade1: idade, nome2: s?.[1] ?? '', idade2: idade, modo: 'faces', hashtag: 'face' })
    setEditandoDois(l.pedido.id)
  }
  async function salvarDoisNomes(l: LinhaPedido, d: DoisNomes | null) {
    try {
      // "metade das peças com cada nome" = o Dividir (224) com o mesmo tema: -A com o Nome 1, -B com o Nome 2
      if (d?.modo === 'metade') {
        const total = l.pedido.itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)
        setEditandoDois(null)
        await salvarDivisoes(l.pedido.id, [{ sufixo: 'A', NOME: d.nome1, IDADE: d.idade1, temaId: l.tema?.themeId ?? null, qtd: Math.ceil(total / 2) }, { sufixo: 'B', NOME: d.nome2, IDADE: d.idade2 ?? d.idade1, temaId: l.tema?.themeId ?? null, qtd: Math.floor(total / 2) }])
        return
      }
      await apiMae.doisNomes(l.pedido.id, d)
      editar(l.pedido.id, x => ({ ...x, doisNomes: d }))
      setEditandoDois(null)
      setMsgStatus(d ? `Pedido #${l.pedido.numero}: 2 nomes (${d.nome1} e ${d.nome2}).` : `Pedido #${l.pedido.numero}: volta a um nome só.`)
    } catch (e) { setErro(`Não consegui salvar os 2 nomes: ${mensagemDeErro(e)}`) }
  }
  /** Lote 18 (item 224): grava a divisão (null desfaz) e troca as linhas do pedido pelas sublinhas (ou pela linha). */
  async function salvarDivisoes(pai: string, divs: DivisaoPedido[] | null) {
    try {
      await apiMae.divisoes(pai, divs)
      const p = await apiMae.pedido(pai)
      if (!p) return
      setLinhas(ls => { const i = ls.findIndex(x => idDoPedido(x.pedido.id) === pai); if (i < 0) return ls; const novas = linhasDoPedido(p, temas, vinculos, apelidos); return [...ls.slice(0, i), ...novas, ...ls.slice(i).filter(x => idDoPedido(x.pedido.id) !== pai)] })
      setMsgStatus(divs ? `Pedido #${p.numero} dividido em ${divs.length} partes (${divs.map(d => `-${d.sufixo}`).join(', ')}).` : `Divisão do pedido #${p.numero} desfeita.`)
    } catch (e) { setErro(`Não consegui dividir o pedido: ${mensagemDeErro(e)}`) }
  }
  async function criarEtapa() {
    try { const r = await apiMae.criarEtapaImpressao(); setEtapa(r.etapa); setMsgStatus(r.criada ? 'Etapa "Impressão" criada antes da Expedição — mude a posição em Configurações → Produção, se quiser.' : null) }
    catch (e) { setErro(`Não consegui criar a etapa: ${mensagemDeErro(e)}`) }
  }
  /** Grava no pedido o que mudou na linha (NOME, IDADE e os campos), ao sair do campo. */
  async function gravarCampo(l: LinhaPedido, k: string) {
    const v = l.editadas[k]
    const atual = k === 'NOME' ? l.campos.NOME : k === 'IDADE' ? l.campos.IDADE : k === 'TEMA' ? l.campos.TEMA : l.campos.extras[k]
    if (v === undefined || v === (atual ?? '')) return
    // Lote 18 (item 224): nome/idade da PARTE (sublinha) ficam na divisão do pedido
    if (l.divisao && (k === 'NOME' || k === 'IDADE')) {
      const divs = (l.pedido.ajustes?.divisoes ?? []).map(d => (d.sufixo === l.divisao!.sufixo ? { ...d, [k]: v } : d))
      await salvarDivisoes(l.divisao.pai, divs)
      return
    }
    try {
      await apiMae.salvarCampos(l.pedido.id, { [k]: v })
      // Lote 8 (item 127): TEMA editado na linha grava no campo tema do pedido no SOA e RE-ACHA o tema MAE (ligação
      // pelo nome do tema, item 97)
      setLinhas(ls => ls.map(x => {
        if (x.pedido.id !== l.pedido.id) return x
        const { [k]: _, ...resto } = x.editadas
        void _
        const campos = k === 'NOME' || k === 'IDADE' || k === 'TEMA' ? { ...x.campos, [k]: v, ...(k === 'TEMA' ? {} : { revisarNomeIdade: undefined }) } : { ...x.campos, extras: { ...x.campos.extras, [k]: v } }
        return comAlvos({ ...x, campos, editadas: resto }, temas, vinculos, apelidos)
      }))
    } catch (e) { setErro(`Não consegui salvar o pedido #${l.pedido.numero}: ${mensagemDeErro(e)}`) }
  }
  useEffect(() => { setOcultas(lerOcultas()) }, [])
  const temasEmUso = [...new Set(linhas.map(l => l.tema?.themeId).filter((x): x is string => !!x))].sort().join('|')
  useEffect(() => {
    let vivo = true
    const faltam = temasEmUso.split('|').filter(id => id && !docsTema[id])
    if (!faltam.length) return
    void (async () => {
      const novos: Record<string, { tema: DocTema; base: DocTrabalho }> = {}
      for (const id of faltam) {
        const t = temas.find(x => x.id === id)
        if (t) try { novos[id] = await abrirTemaEBase(raiz, t) } catch { /* tema sem base: fica com os campos do exemplo */ }
      }
      if (vivo && Object.keys(novos).length) setDocsTema(d => ({ ...d, ...novos }))
    })()
    return () => { vivo = false }
  }, [temasEmUso, temas, raiz, docsTema])
  /** Os campos da linha = os textos do GRUPO do produto (de cada produto do pedido) na base; sem base aberta → exemplo do tema. */
  const camposDaLinha = (l: LinhaPedido): string[] => {
    const d = l.tema ? docsTema[l.tema.themeId] : undefined
    if (!d) return Object.keys(temaDe(l.tema?.themeId)?.doc?.sample ?? {}).filter(k => !NAO_CAMPO.has(k))
    const vistos = new Map<string, string>()
    for (const a of l.alvos.length ? l.alvos : [undefined]) for (const c of camposDoDoc(baseDoAlvo(d.base, d.tema, a?.itens[0]).doc)) if (!vistos.has(chaveCampo(c))) vistos.set(chaveCampo(c), c)
    return [...vistos.values()]
  }
  const todosCampos = [...new Map(linhas.flatMap(camposDaLinha).map(c => [chaveCampo(c), c])).values()]
  const alternarColuna = (c: string) => setOcultas(o => { const k = chaveCampo(c), n = o.includes(k) ? o.filter(x => x !== k) : [...o, k]; gravarOcultas(n); return n })
  const marcar = (id: string, on: boolean) => setMarcadas(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  // Lote 13 (item 183): aguardando dados da cliente não gera (nem em lote) até os dados chegarem
  // Lote 19 (item 245): "Gerar mesmo assim" inclui os selecionados que estavam aguardando dados
  const [forcarIds, setForcarIds] = useState<Set<string>>(new Set())
  const selecionadas = linhas.filter(l => marcadas.has(l.pedido.id) && (!aguardando(l) || forcarIds.has(l.pedido.id)))
  const foraDoLote = linhas.filter(l => marcadas.has(l.pedido.id) && !selecionadas.some(x => x.pedido.id === l.pedido.id && x.tema))

  /** Kits (unidades vendidas) e peças (a quantidade: 96 tags) do produto no pedido. */
  const contaDoAlvo = (alvo: AlvoPedido) => ({ kits: alvo.itens.reduce((s, i) => s + (Number((i as { qtdVendida?: number }).qtdVendida) || 0), 0) || 1, pecas: pecasDoAlvo(alvo) })
  const primeiroNome = (l: LinhaPedido) => (l.editadas.NOME ?? l.campos.NOME ?? '').trim().split(/\s+/)[0] ?? ''
  const rotuloDoPedido = (l: LinhaPedido) => { const n = primeiroNome(l); return `#${l.pedido.numero}${n ? ` · ${n}` : ''}` }
  /**
   * Lote 14 (itens 187/189): o produto sai no KIT DE FOLHAS (tags, etiquetas) — nunca peça por peça. null = caixas.
   * O produto com COMPOSIÇÃO (Nutella = corpo + tampa) segue o lote de folha por unidade (gerarLote).
   */
  function kitDoAlvo(d: { tema: DocTema; base: DocTrabalho }, alvo: AlvoPedido) {
    const { grupo, semLigacao } = baseDoAlvo(d.base, d.tema, alvo.itens[0])
    if (ehComposicaoPorUnidade(grupo)) return null
    const kit = folhasDoKit(d.base, grupo)
    if (!kit.length) return null
    // padrão: kit de UMA folha conta pelas peças do pedido (96 tags = 4 folhas); kit de várias folhas, por kit;
    // Lote 16 (item 206): ou o KIT DE N PEÇAS (10 corpos + 10 tampas)
    return { kit, grupo, contagem: contagemDoKit(grupo, kit) as Contagem, semLigacao: !!semLigacao }
  }
  type KitAlvo = NonNullable<ReturnType<typeof kitDoAlvo>>
  /** "1 de cada (prova)": uma folha de cada, uma impressão. */
  const kitDaProva = (k: KitAlvo, e: EscolhasGerar) => (e.quantidade === 'um' ? k.kit.map(x => ({ ...x, impressoes: 1 })) : k.kit)
  const contaKit = (alvo: AlvoPedido, k: KitAlvo, e: EscolhasGerar) => (e.quantidade === 'um' ? { kits: 1, pecas: Math.max(1, k.kit[0].folha.pecas.length) }
    : k.contagem === 'composicao' ? { kits: unidadesDoPedido(alvo), pecas: pecasDoAlvo(alvo) } : contaDoAlvo(alvo))
  /**
   * Lote 19 (item 237): DOIS NOMES "um em cada face" — no kit de folhas (tags, rótulos) as peças se dividem entre os dois
   * nomes (cada um com a sua idade); nas caixas, as faces de nome alternam (valoresPorSlot).
   */
  const pedidosDoKit = (l: LinhaPedido, valores: Record<string, string>, conta: { kits: number; pecas: number }) => {
    const dn = l.doisNomes
    if (dn?.modo !== 'faces') return { peds: [{ rotulo: rotuloDoPedido(l), valores }], contas: [conta], juntar: false }
    const k1 = Math.ceil(conta.kits / 2), p1 = Math.ceil(conta.pecas / 2)
    return { peds: [{ rotulo: rotuloDoPedido(l), valores }, { rotulo: rotuloDoPedido(l), valores: valoresDoNome2(valores, dn) }], contas: [{ kits: k1, pecas: p1 }, { kits: Math.max(1, conta.kits - k1), pecas: Math.max(0, conta.pecas - p1) }], juntar: true }
  }
  const vpsDasFaces = (l: LinhaPedido, doc: DocTrabalho, valores: Record<string, string>) => (l.doisNomes?.modo === 'faces' ? alternarNomesNoDoc(doc, valores, l.doisNomes) : undefined)
  const nomeDoProduto = (d: { tema: DocTema }, grupo: Grupo | null | undefined, alvo: AlvoPedido) => grupo?.nome || d.tema.produto || alvo.produto || produtoDoItem(alvo.itens[0] ?? {})

  /**
   * Lote 6 (item 94): produto com COMPOSIÇÃO (Nutella = corpo + tampa) — a folha comporta N unidades completas, cada
   * unidade ocupa as suas vagas de cada peça. Um arquivo por pedido (ou, no lote com "Aproveitar folhas", os pedidos
   * juntos: `LOTE_<peça>_<dd-mm>.pdf` com o "#123 · Naty" fora da linha de corte).
   */
  async function gerarLote(lt: Lote, dia: string, identidade: Identidade, d: { tema: DocTema; base: DocTrabalho }, e: EscolhasGerar): Promise<ResultadoItem<Resultado>[]> {
    const f = lt.folha
    const comp = lt.grupo?.composicao ?? []
    const capU = unidadesPorFolha(f.pecas, comp)
    if (capU < 1) throw new Error(`A folha "${f.nome}" não tem vagas para 1 unidade completa (${comp.map(c => `${c.qtd}× ${d.base.molds.find(m => m.id === c.moldeId)?.name ?? 'peça'}`).join(' + ')}).`)
    const nsU = lt.itens.map(({ alvo }) => { const u = alvo.itens.reduce((s, i) => s + (Number((i as { qtdVendida?: number }).qtdVendida) || 0), 0) || pecasDoAlvo(alvo) || 1; return e.quantidade === 'pedido' ? u : 1 })
    const ordem = ordemDeLeitura(f), vagasLeitura = ordem.map(i => ({ indice: i, moldeId: f.pecas[i].moldeId }))
    const dist = distribuirLote(capU, nsU, { tipo: f.tipo, completar: f.completarUltima }).map(us => lugaresDasVagas(f, vagasDasUnidades(vagasLeitura, comp, us)))
    const pedidos = lt.itens.map(({ l }) => ({ rotulo: rotuloDoPedido(l), valores: valoresDaLinha(l, d.tema) }))
    const lote = docDoLote(d.base, d.tema, f, dist, pedidos)
    const juntos = lt.itens.length > 1, l0 = lt.itens[0].l
    const pasta = juntos ? `${dia}/LOTES` : `${dia}/Pedidos`
    const hoje = new Date(), dm = `${String(hoje.getDate()).padStart(2, '0')}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const nomeArquivo = `LOTE_${parteArquivo(lt.grupo?.nome || f.nome, 30)}_${dm}`
    const r = await gerarArteDoPedido({ raiz: raiz!, pedido: l0.pedido, tema: lote.tema, base: lote.doc, identidade, marcas, registrar: false,
      opcoes: { ...opcoesDoPedido({ agrupar: 'tudo', linhas: e.linhas, apliques: e.apliques, fundoMarca: e.fundoMarca, folgaMarcaMm: e.folgaMarcaMm }, juntos ? { _PEDIDO: '1' } : pedidos[0].valores, pasta),
        pedido: l0.pedido.numero, valoresPorSlot: lote.valoresPorSlot, svg: e.cortePorPedido, dxf: e.cortePorPedido,
        ...(juntos ? { nomeArquivo, rotulos: lote.rotulos } : { sufixoArquivo: sufixoQuantidade(lt.grupo?.nome || f.nome, nsU[0]) }) } })
    const pdf = r.arquivos.find(a => a.endsWith('.pdf')) ?? null
    const avisos = [...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a))]
    for (const [k, { l }] of lt.itens.entries())
      await apiMae.registrarArte({ orderId: l.pedido.id, themeId: lote.tema.id, themeVersion: lote.tema.version, variaveis: pedidos[k].valores, status: r.revisar ? 'revisar' : 'gerada', arquivo: pdf }).catch(er => console.warn('[MAE] registrar arte', er))
    return lt.itens.map(it => ({ id: it.id, status: avisos.length ? 'aviso' as const : 'gerada' as const, valor: { arquivo: pdf, pasta, avisos, ...(juntos ? { separacao: lote.resumo } : {}) }, avisos }))
  }

  /** O que vai para a arte de um produto de CAIXAS: a base do produto (grupo), o tema e as cópias de cada caixa. */
  function montarItem(d: { tema: DocTema; base: DocTrabalho }, l: LinhaPedido, alvo: AlvoPedido, e: EscolhasGerar) {
    const avisos: string[] = []
    // Lote 5 (item 72): o grupo do produto na base de portfólio (Kit Festa, Sacola P…); sem grupo, a base inteira
    const { doc, grupo } = baseDoAlvo(d.base, d.tema, alvo.itens[0])
    if (d.base.grupos?.length && !grupo) avisos.push(`"${alvo.produto || 'produto'}" não tem grupo ligado na base — saiu a base inteira`)
    const valores = valoresDaLinha(l, d.tema)
    const produto = nomeDoProduto(d, grupo, alvo)
    // Lote 5 (item 79): cada caixa na quantidade dela (a salva no pedido, ou a do kit dividida pelas caixas)
    const total = pecasDoAlvo(alvo), caixas = caixasDe(doc).map(c => c.id)
    const copias = e.quantidade !== 'pedido' ? undefined : (l.quantidades?.[chaveDoAlvo(alvo)] ?? (total ? quantidadesPadrao(total, caixas).porCaixa : undefined))
    return { avisos, doc, temaArte: d.tema, valores, produto, total, grupo, copias }
  }
  /** Lote 7 (item 119): depois de gerar, "Iniciar a etapa Impressão" nos pedidos do SOA que saíram. */
  async function depoisDeGerar(rs: ResultadoItem<Resultado>[], iniciar: boolean) {
    const ok = [...new Set(rs.filter(r => r.status !== 'erro').map(r => r.id.split('#')[0]))]
    if (iniciar && plano === 'soa' && etapa && ok.length) await aplicarStatus(ok, 'iniciar_impressao')
  }

  /** Gera com as escolhas lembradas, um PDF por pedido (o "Gerar" da linha e o "Salvar e gerar" do Ajustar). */
  const gerar = (lista: LinhaPedido[]) => gerarComEscolhas(lista, { ...escolhasGuardadas(), modo: 'pedido' })

  /**
   * Lote 14 (itens 199/201): GERAR — um caminho só para as duas formas de arquivo:
   *  • um PDF por pedido (pasta Pedidos; o nome do cliente, nunca "LOTE");
   *  • juntar num lote (pasta LOTES): caixas E kits de folha no mesmo fluxo (antes a tag saía por fora, num arquivo
   *    dela — e o "Separar por papel" desligado não fazia efeito); "um PDF por tipo de produto" separa por produto.
   */
  async function gerarComEscolhas(lista: LinhaPedido[], e: EscolhasGerar) {
    setModalGerar(false)
    if (!raiz) { setErro('Conecte a pasta Biblioteca MAE.'); return }
    if (!lista.some(l => l.tema)) return
    cancelar.current = false; setResultados(null); setErro(null); setMsgStatus(null)
    const r0 = raiz
    const fila = lista.filter(l => l.tema).flatMap(l => l.alvos.filter(a => a.tema).map((a, i) => ({ id: i ? `${l.pedido.id}#${i + 1}` : l.pedido.id, l, alvo: a as AlvoPedido })))
    const dia = pastaExportacao(new Date())
    const identidade = useEditor.getState().identidade
    const docs = new Map<string, { tema: DocTema; base: DocTrabalho }>()
    const abrir = async (t: TemaDisponivel) => { let d = docs.get(t.id); if (!d) { d = await abrirTemaEBase(r0, t); docs.set(t.id, d) } return d }
    const opc = { agrupar: (e.modo === 'pedido' && e.folhaSeparada ? 'prancheta' : 'tudo') as 'tudo' | 'prancheta', linhas: e.linhas, apliques: e.apliques, fundoMarca: e.fundoMarca, folgaMarcaMm: e.folgaMarcaMm }
    const rs: ResultadoItem<Resultado>[] = []
    let feitos = 0
    // 1) produtos com COMPOSIÇÃO por unidade (Nutella…) — o lote de folha por unidade
    const porUnidade = new Map<string, Lote>(), resto: typeof fila = []
    for (const it of fila) {
      const t = temaDe(it.alvo.tema!.themeId)
      const d = t ? await abrir(t).catch(() => null) : null
      const grupo = d ? baseDoAlvo(d.base, d.tema, it.alvo.itens[0]).grupo : null
      const folha = d && ehComposicaoPorUnidade(grupo) ? folhasDoKit(d.base, grupo)[0]?.folha : undefined
      if (!t || !folha) { resto.push(it); continue }
      const chave = e.modo === 'lote' && e.aproveitar ? `${t.id}|${folha.id}` : it.id
      const lt = porUnidade.get(chave) ?? { t, folha, grupo, itens: [] }
      lt.itens.push(it); porUnidade.set(chave, lt)
    }
    for (const lt of porUnidade.values()) {
      if (cancelar.current) break
      setProgresso({ feitos, total: fila.length, atual: `${lt.folha.nome} · ${lt.itens.length} pedido(s)` })
      try { rs.push(...await gerarLote(lt, dia, identidade, await abrir(lt.t), e)) } catch (er) { rs.push(...lt.itens.map(it => ({ id: it.id, status: 'erro' as const, mensagem: mensagemDeErro(er) }))) }
      feitos += lt.itens.length
    }

    if (e.modo === 'pedido') {
      // 2a) UM PDF POR PEDIDO (e produto): caixas na quantidade de cada caixa; kit de folhas sempre em folhas
      const pasta = `${dia}/Pedidos`
      rs.push(...await rodarFila(resto, async ({ l, alvo }) => {
        const t = temaDe(alvo.tema!.themeId)
        if (!t) throw new Error('tema não encontrado')
        const d = await abrir(t)
        const avisos: string[] = []
        const k = kitDoAlvo(d, alvo)
        let r: Awaited<ReturnType<typeof gerarArteDoPedido>>
        if (k) {
          if (k.semLigacao) avisos.push(avisoSemProduto(d.base))
          const valores = valoresDaLinha(l, d.tema), conta = contaKit(alvo, k, e)
          const pk = pedidosDoKit(l, valores, conta)
          const kd = docDoKit(d.base, d.tema, distribuirKit(kitDaProva(k, e), pk.contas, k.contagem, pk.juntar, k.grupo?.composicao), pk.peds)
          r = await gerarArteDoPedido({ raiz: r0, pedido: l.pedido, tema: kd.tema, base: kd.doc, identidade, marcas,
            opcoes: { ...opcoesDoPedido({ ...opc, agrupar: e.folhaSeparada ? 'prancheta' : 'tudo' }, valores, pasta), pedido: l.pedido.numero, valoresPorSlot: kd.valoresPorSlot,
              svg: e.cortePorPedido, dxf: e.cortePorPedido, sufixoArquivo: sufixoQuantidade(k.grupo?.nome ?? '', k.contagem === 'pecas' ? (conta.pecas || conta.kits) : conta.kits) } })
        } else {
          const m = montarItem(d, l, alvo, e)
          avisos.push(...m.avisos)
          r = await gerarArteDoPedido({ raiz: r0, pedido: l.pedido, tema: m.temaArte, base: m.doc, identidade, marcas,
            opcoes: { ...opcoesDoPedido(opc, m.valores, pasta), pedido: l.pedido.numero, copias: m.copias, sufixoArquivo: m.total ? sufixoQuantidade(m.grupo?.nome ?? '', m.total) : undefined, valoresPorSlot: vpsDasFaces(l, m.doc, m.valores) } })
        }
        avisos.push(...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a)))
        return { valor: { arquivo: r.arquivos.find(a => a.endsWith('.pdf')) ?? null, pasta, avisos }, avisos }
      }, { aoProgredir: (f, _t, atual) => setProgresso({ feitos: feitos + f, total: fila.length, atual: atual ? `Pedido ${atual.l.pedido.numero}${atual.l.alvos.length > 1 ? ` · ${atual.alvo.produto.slice(0, 30)}` : ''}` : '' }), cancelado: () => cancelar.current }))
    } else {
      // 2b) LOTE: caixas e kits de folha no mesmo fluxo; "Aproveitar folhas" junta os pedidos do mesmo kit e tema
      const pastaDosLotes = `${dia}/LOTES`
      type Ped = { id: string; l: LinhaPedido; valores: Record<string, string> }
      const itens: (ItemLote & { peds: Ped[]; avisos: string[]; temaId: string; temaVersao: number; separacao?: string[] })[] = []
      const juntos = new Map<string, { t: TemaDisponivel; d: { tema: DocTema; base: DocTrabalho }; k: KitAlvo; its: typeof fila; temas: DocTema[] }>()
      for (const it of resto) {
        const { id, l, alvo } = it
        const t = temaDe(alvo.tema!.themeId)
        if (!t) { rs.push({ id, status: 'erro', mensagem: 'tema não encontrado' }); continue }
        try {
          const d = await abrir(t)
          const k = kitDoAlvo(d, alvo)
          if (k && e.aproveitar) {
            // Lote 16 (item 206): junta o MESMO PRODUTO (mesma base e folhas) mesmo com temas diferentes — cada
            // rótulo leva a arte e o nome do seu pedido (docDoKit com o tema de cada pedido)
            const chave = `${d.base.id}|${k.kit.map(x => x.folha.id).join(',')}|${k.contagem}`
            const g = juntos.get(chave) ?? { t, d, k, its: [], temas: [] }
            g.its.push(it); g.temas.push(d.tema); juntos.set(chave, g); continue
          }
          if (k) {
            const valores = valoresDaLinha(l, d.tema), produto = nomeDoProduto(d, k.grupo, alvo)
            const pk = pedidosDoKit(l, valores, contaKit(alvo, k, e))
            const kd = docDoKit(d.base, d.tema, distribuirKit(kitDaProva(k, e), pk.contas, k.contagem, pk.juntar, k.grupo?.composicao), pk.peds)
            itens.push({ id, pedidoId: l.pedido.id, numero: l.pedido.numero, nome: primeiroNome(l), temaNome: d.tema.name ?? t.name, tema: kd.tema, doc: kd.doc, valores, valoresPorSlot: kd.valoresPorSlot,
              rotulos: e.identificacao ? kd.rotulos : {}, produto, papel: papelDoItem(tipoDeProduto(d.base.name, k.grupo?.nome)), peds: [{ id, l, valores }], avisos: k.semLigacao ? [avisoSemProduto(d.base)] : [], temaId: kd.tema.id, temaVersao: kd.tema.version })
            continue
          }
          const m = montarItem(d, l, alvo, e)
          itens.push({ id, pedidoId: l.pedido.id, numero: l.pedido.numero, nome: primeiroNome(l), temaNome: m.temaArte.name ?? t.name, tema: m.temaArte, doc: m.doc, valores: m.valores, copias: m.copias, valoresPorSlot: vpsDasFaces(l, m.doc, m.valores),
            produto: m.produto, papel: papelDoItem(tipoDeProduto(d.base.name, m.grupo?.nome)), peds: [{ id, l, valores: m.valores }], avisos: m.avisos, temaId: m.temaArte.id, temaVersao: m.temaArte.version })
        } catch (er) { rs.push({ id, status: 'erro', mensagem: mensagemDeErro(er) }) }
      }
      for (const g of juntos.values()) {
        const peds = g.its.map(({ l }, i) => ({ rotulo: rotuloDoPedido(l), valores: valoresDaLinha(l, g.temas[i] ?? g.d.tema) }))
        // Lote 19 (item 237): pedido com 2 nomes "um em cada face" entra como duas entradas (o mesmo tema)
        const exp = g.its.map((x, i) => ({ i, pk: pedidosDoKit(x.l, peds[i].valores, contaKit(x.alvo, g.k, e)) }))
        try {
          const kd = docDoKit(g.d.base, g.d.tema, distribuirKit(kitDaProva(g.k, e), exp.flatMap(x => x.pk.contas), g.k.contagem, true, g.k.grupo?.composicao), exp.flatMap(x => x.pk.peds), exp.flatMap(x => x.pk.peds.map(() => g.temas[x.i])))
          const p0 = g.its[0], produto = nomeDoProduto(g.d, g.k.grupo, p0.alvo)
          itens.push({ id: p0.id, pedidoId: p0.l.pedido.id, numero: p0.l.pedido.numero, nome: primeiroNome(p0.l), temaNome: g.d.tema.name ?? g.t.name, tema: kd.tema, doc: kd.doc, valores: { _PEDIDO: '1' },
            valoresPorSlot: kd.valoresPorSlot, rotulos: e.identificacao ? kd.rotulos : {}, produto, papel: papelDoItem(tipoDeProduto(g.d.base.name, g.k.grupo?.nome)), nPedidos: g.its.length,
            peds: g.its.map((x, i) => ({ id: x.id, l: x.l, valores: peds[i].valores })), avisos: g.k.semLigacao ? [avisoSemProduto(g.d.base)] : [], temaId: kd.tema.id, temaVersao: kd.tema.version, separacao: kd.resumo })
        } catch (er) { rs.push(...g.its.map(x => ({ id: x.id, status: 'erro' as const, mensagem: mensagemDeErro(er) }))) }
      }
      const rl = await gerarLotesImpressao({ raiz: r0, identidade, marcas }, itens, {
        ordem: e.ordem, intercalar: e.intercalar, identificacao: e.identificacao, maxPedidos: e.maxPedidos, separarPorProduto: e.porProduto,
        linhas: e.linhas, apliques: e.apliques, fundoMarca: e.fundoMarca, folgaMarcaMm: e.folgaMarcaMm, pasta: pastaDosLotes,
      }, { aoProgredir: (f, _t, atual) => setProgresso({ feitos: feitos + f, total: fila.length, atual }), cancelado: () => cancelar.current })
      for (const r of rl) {
        const it = itens.find(x => x.id === r.id)
        if (!it) continue
        for (const p of it.peds) {
          if (r.erro) { rs.push({ id: p.id, status: 'erro', mensagem: r.erro }); continue }
          const avisos = [...it.avisos, ...(r.revisar ? ['revisar o texto'] : []), ...r.alertas]
          await apiMae.registrarArte({ orderId: p.l.pedido.id, themeId: it.temaId, themeVersion: it.temaVersao, variaveis: { ...p.valores, _lote: r.lote ?? '' }, status: r.revisar ? 'revisar' : 'gerada', arquivo: r.arquivo }).catch(er => console.warn('[MAE] registrar arte', er))
          rs.push({ id: p.id, status: avisos.length ? 'aviso' : 'gerada', valor: { arquivo: r.arquivo, pasta: pastaDosLotes, avisos, lote: r.lote ?? undefined, ...(it.separacao ? { separacao: it.separacao } : {}) }, avisos })
        }
      }
    }
    setResultados(rs); setProgresso(null)
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: pedidoAtualizado(ps, l) })))
    await depoisDeGerar(rs, e.iniciarImpressao)
  }

  const res = resultados ? resumo(resultados) : null
  // Lote 17 (item 212): o nome do PRÓXIMO arquivo (o 1º pedido selecionado), nunca o de outra cliente
  const exemploArquivo = (() => {
    const l = selecionadas.find(x => x.tema) ?? null, a = l?.alvos.find(x => x.tema)
    if (!l || !a) return 'Nome_idade_Tema_quantidade.pdf'
    const v = { NOME: l.editadas.NOME ?? l.campos.NOME, IDADE: l.editadas.IDADE ?? l.campos.IDADE }, t = temaDe(a.tema!.themeId)
    const q = pecasDoAlvo(a) || unidadesDoPedido(a)
    return nomeTemaPronto({ nome: v.NOME, idade: v.IDADE, tema: t?.name ?? 'Tema', data: new Date(), extensao: 'pdf', sufixo: q ? sufixoQuantidade(a.produto ?? '', q) : undefined })
  })()
  const temasBusca = temas.map(t2 => ({ id: t2.id, name: t2.name, baseId: t2.baseId ?? null, baseNome: t2.baseNome ?? null, doc: t2.doc, arquivado: !!t2.doc?.arquivado }))
  const nSel = selecionadas.filter(l => l.tema).length
  const pendentes = linhas.filter(l => !jaFoi(l)).length, jaGerados = linhas.length - pendentes
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
      <FiltrosPedidos hoje={hoje} contagemDia={contarPorDia(daAba.map(filtravel))} filtros={filtros} setFiltros={setFiltros} opcoes={opcoesFiltro} salvos={salvos} total={visiveis.length} selecionados={marcadas.size}
        onSalvar={nome => void guardarSalvos(guardarFiltro(salvos, nome, filtros))} onExcluirSalvo={nome => void guardarSalvos(salvos.filter(s => s.nome !== nome))} />
      {/* Lote 7 (item 116): AÇÕES EM MASSA nos selecionados */}
      {marcadas.size > 0 && (
        <div className="sticky top-0 z-10 rounded-xl border border-orange-300 bg-orange-50/95 dark:bg-orange-950/80 px-3 py-2 flex flex-wrap items-center gap-2 text-xs shadow-sm" data-barra-massa>
          <b>{marcadas.size} selecionado{marcadas.size === 1 ? '' : 's'}</b>
          {/* Lote 13 (item 181): a mesma busca rápida de tema */}
          <BuscaTemas temas={temasBusca} placeholder="Vincular tema…" compacto onEscolher={id => void vincularEmMassa(id)} dataAttr="vincular-massa" />
          <button className={btn + ' !border-orange-500 bg-orange-500 text-white'} disabled={!nSel || !!progresso || !liberada} onClick={() => setModalGerar(true)} data-gerar-massa><Download className="w-3.5 h-3.5" /> Gerar ({nSel})</button>
          {/* Lote 19 (item 245): o botão nunca fica "Gerar (0)" sem dizer por quê */}
          {foraDoLote.length > 0 && (
            <span className="text-[11px] text-amber-800" data-fora-do-lote>
              {foraDoLote.length} selecionado{foraDoLote.length === 1 ? '' : 's'} não {foraDoLote.length === 1 ? 'entra' : 'entram'} no lote: {[...new Set(foraDoLote.map(l => !l.tema ? 'sem tema' : 'faltam dados (NOME, IDADE)'))].join(' · ')}.{' '}
              {foraDoLote.some(l => l.tema) && <button className="font-semibold underline" onClick={() => setForcarIds(new Set([...forcarIds, ...foraDoLote.filter(l => l.tema).map(l => l.pedido.id)]))} data-gerar-mesmo-assim>Gerar mesmo assim</button>}{' '}
              <button className="underline" onClick={() => setMarcadas(new Set(foraDoLote.map(l => l.pedido.id)))} data-ver-fora-do-lote>Ver quais</button>
            </span>
          )}
          <button className={btn} disabled={!!progresso} onClick={() => void aplicarStatus([...marcadas], 'impresso')} data-marcar-impresso-massa><Printer className="w-3.5 h-3.5" /> Marcar como impresso</button>
          {/* Lote 18 (item 223): desfaz — volta para Pendentes */}
          {[...marcadas].some(id => impressa(id)) && <button className={btn} disabled={!!progresso} onClick={() => void desmarcarImpresso([...marcadas].filter(impressa))} data-desmarcar-impresso-massa>Desmarcar impresso</button>}
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
        {aba === 'gerados' && <label className="flex items-center gap-1 text-xs" data-filtro-nao-impressos><input type="checkbox" checked={soNaoImpressos} onChange={e => setSoNaoImpressos(e.target.checked)} /> Gerados, não impressos</label>}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <button className={btn} onClick={() => setMarcadas(new Set(visiveis.filter(l => l.tema && aprovado(l) && !aguardando(l)).map(l => l.pedido.id)))} title="Os que já estão em produção, ou com o campo de aprovação marcado" data-selecionar-aprovados>Selecionar aprovados</button>
        <button className={btn} onClick={() => setMarcadas(new Set(visiveis.map(l => l.pedido.id)))} title="Todos os pedidos que aparecem (com os filtros)" data-selecionar-todos>Selecionar todos</button>
        {marcadas.size > 0 && <button className={btn} onClick={() => setMarcadas(new Set())}>Limpar</button>}
        {/* Lote 8 (item 128): esconder colunas de campo (preferência deste navegador; o padrão é mostrar tudo) */}
        {todosCampos.length > 0 && (
          <span className="relative">
            <button className={btn} onClick={() => setVerColunas(v => !v)} title="Mostrar ou esconder campos na tabela" data-colunas>Colunas{ocultas.length ? ` (${ocultas.length} ocultas)` : ''}</button>
            {verColunas && (
              <span className="absolute left-0 top-full z-20 mt-1 block w-48 rounded-lg border border-gray-200 bg-white p-2 text-xs shadow dark:border-gray-700 dark:bg-gray-900" data-colunas-lista>
                {todosCampos.map(c => <label key={c} className="flex items-center gap-1.5 py-0.5"><input type="checkbox" className="accent-orange-500" checked={!ocultas.includes(chaveCampo(c))} onChange={() => alternarColuna(c)} data-coluna={c} />{rotuloVariavel(c)}</label>)}
              </span>
            )}
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          {progresso
            ? <button className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold" onClick={() => { cancelar.current = true }} data-parar><Square className="w-4 h-4" /> Parar ({progresso.feitos}/{progresso.total})</button>
            : <button onClick={() => setModalGerar(true)} disabled={!nSel || carregando || !liberada} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40" data-gerar-todos><Download className="w-4 h-4" /> Gerar ({nSel})</button>}
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
          <span className="text-xs text-gray-500">Arquivos em Exportações / hoje / <i>Pedidos</i> (ou <i>LOTES</i>) / <i data-exemplo-arquivo>{exemploArquivo}</i></span>
        </div>
      )}

      {carregando ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando os pedidos…</p>
        : !visiveis.length ? <p className="text-sm text-gray-500">{aba === 'gerados' ? 'Nenhum pedido gerado ainda.' : <>Nenhum pedido pendente. Os pedidos precisam dos campos <b>TEMA</b>, <b>NOME</b> e <b>IDADE</b> (Configurações → Campos do pedido).</>}</p>
        : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="p-2 w-6" /><th className="p-2">Prévia</th><th className="p-2">Pedido</th><th className="p-2">Nome</th><th className="p-2 w-16">Idade</th><th className="p-2">Campos</th><th className="p-2 text-center">💬</th><th className="p-2" title="A quantidade do pedido é o total que a cliente recebe (kit de 10 → QTD 10)" data-dica-coluna-qtd>Qtd.<div className="text-[9px] font-normal text-gray-400">QTD = total de peças (kit 10 × 1 = 10)</div></th><th className="p-2">Ações</th><th className="p-2">Arte</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map(l => {
                  const t = temaDe(l.tema?.themeId), v = valoresDaLinha(l, t?.doc ?? null)
                  const pv = produtoEVariacao(l)
                  const r = resultados?.find(x => x.id === l.pedido.id || x.id.startsWith(`${l.pedido.id}#`))
                  const st = statusDoCard(artesDaLinha(l))
                  // Lote 8 (item 128): só os campos do grupo do produto; o nome casa sem acento ("Série" = SÉRIE); o exemplo
                  // do tema é só o placeholder (não preenche o pedido)
                  const daArte = camposDaLinha(l)
                  const extras = daArte.filter(k => !ocultas.includes(chaveCampo(k)))
                  const chaveNoPedido = (k: string) => Object.keys(l.campos.extras).find(x => chaveCampo(x) === chaveCampo(k)) ?? k
                  const faltam = camposFaltando(daArte, { ...l.campos.extras, ...Object.fromEntries(Object.entries(l.editadas).filter(([x]) => !['NOME', 'IDADE', 'TEMA'].includes(x))) })
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
                        {/* Lote 8 (item 127): o TEMA do pedido (campo do SOA) editável aqui — a cliente comprou Bosque e quer Jardim */}
                        <label className="mt-1 block"><span className="text-[9px] uppercase text-gray-400">Tema do pedido</span>{campo('TEMA', l.campos.TEMA ?? '', 'TEMA do pedido', 'min-w-[9rem]')}</label>
                        {/* Lote 13 (item 181): busca rápida (os temas deste produto primeiro) */}
                        <div className="mt-1" data-tema-linha>
                          <BuscaTemas temas={temasBusca} valor={l.tema?.themeId ?? null} placeholder="— escolher o tema —" compacto prioridade={temas.filter(t2 => servePara(t2, pv.produto)).map(t2 => t2.id)}
                            onEscolher={id => void escolherTema(l, id)} dataAttr="tema-linha" />
                        </div>
                        {/* Lote 13 (item 183): aguardando dados × sem nome (versão sem nome do tema) */}
                        {aguardando(l)
                          ? <div className="mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800" data-aguardando-dados>Aguardando dados da cliente</div>
                          : !l.tema && l.campos.TEMA && <div className="text-[10px] text-amber-700" data-tema-nao-encontrado><b>{l.campos.TEMA}</b> ainda sem arte → escolha o tema acima (fica lembrado)</div>}
                        {(() => {
                          if (aguardando(l) || !l.tema) return null
                          const atual = temas.find(t2 => t2.id === l.tema!.themeId)
                          const comNome = temas.find(t2 => t2.doc?.semNome === l.tema!.themeId)   // estamos na versão sem nome de algum tema
                          const sem = atual?.doc?.semNome ? temas.find(t2 => t2.id === atual.doc!.semNome) : undefined
                          if (comNome) return <button className="mt-1 block text-[10px] text-orange-700 underline" onClick={() => void temaSoNeste(l, null)} data-voltar-com-nome>← voltar ao tema com nome ({comNome.name})</button>
                          if (!sem) return null
                          return semNomeL(l)
                            ? <div className="mt-1 rounded bg-amber-50 px-1.5 py-1 text-[10px] text-amber-900" data-sugestao-sem-nome>Este pedido veio sem nome. Usar <b>{sem.name}</b>? <button className="font-semibold underline" onClick={() => void temaSoNeste(l, sem.id)} data-usar-sem-nome>Usar</button></div>
                            : <button className="mt-1 block text-[10px] text-gray-500 underline" onClick={() => void temaSoNeste(l, sem.id)} data-pedido-sem-nome>Pedido sem nome</button>
                        })()}
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
                        {/* Lote 19 (item 237): DOIS NOMES no mesmo pedido — só SUGERE (nunca aplica sozinho) */}
                        {!l.divisao && !l.doisNomes && editandoDois !== l.pedido.id && (() => {
                          const s = sugereDoisNomes(l.editadas.NOME ?? l.campos.NOME)
                          return s
                            ? <div className="mt-0.5 rounded bg-violet-50 px-1 py-0.5 text-[10px] text-violet-900" data-sugestao-dois-nomes>Parece ter 2 nomes: <b>{s[0]}</b> | <b>{s[1]}</b>. <button className="font-semibold underline" onClick={() => abrirDoisNomes(l, s)} data-usar-dois-nomes>Usar 2 nomes?</button></div>
                            : <button className="mt-0.5 block text-[10px] text-gray-400 underline" onClick={() => abrirDoisNomes(l, null)} data-mais-um-nome>+ 2º nome</button>
                        })()}
                        {l.doisNomes && editandoDois !== l.pedido.id && <button className="mt-0.5 block rounded bg-violet-50 px-1 text-left text-[10px] text-violet-900" onClick={() => abrirDoisNomes(l, null)} data-dois-nomes-ativo>2 nomes: <b>{l.doisNomes.nome1}</b> + <b>{l.doisNomes.nome2}</b> · {l.doisNomes.modo === 'faces' ? 'um em cada face' : l.doisNomes.modo === 'juntos' ? 'juntos' : 'metade das peças'} ✎</button>}
                        {editandoDois === l.pedido.id && rascunhoDois && (
                          <div className="mt-1 w-64 space-y-1 rounded-lg border border-violet-200 bg-white p-1.5 text-[11px] dark:bg-gray-900" data-editor-dois-nomes>
                            {([1, 2] as const).map(n => (
                              <div key={n} className="flex gap-1">
                                <input value={n === 1 ? rascunhoDois.nome1 : rascunhoDois.nome2} onChange={e => setRascunhoDois({ ...rascunhoDois, [n === 1 ? 'nome1' : 'nome2']: e.target.value })} className={inp} placeholder={`Nome ${n}`} data-dois-nome={n} />
                                <input value={(n === 1 ? rascunhoDois.idade1 : rascunhoDois.idade2) ?? ''} onChange={e => setRascunhoDois({ ...rascunhoDois, [n === 1 ? 'idade1' : 'idade2']: e.target.value })} className={inp + ' w-14'} placeholder="Idade" data-dois-idade={n} />
                              </div>
                            ))}
                            <select value={rascunhoDois.modo} onChange={e => setRascunhoDois({ ...rascunhoDois, modo: e.target.value as ModoDoisNomes })} className={inp} data-dois-modo>
                              <option value="faces">Um nome em cada face (alterna)</option>
                              <option value="metade">Metade das peças com cada nome</option>
                              <option value="juntos">Os dois juntos na mesma face</option>
                            </select>
                            {rascunhoDois.modo === 'juntos' && <label className="flex items-center gap-1">Entre os nomes <select value={rascunhoDois.conector ?? '&'} onChange={e => setRascunhoDois({ ...rascunhoDois, conector: e.target.value })} className={inp + ' w-16'} data-dois-conector>{['&', 'e', '♥'].map(c => <option key={c}>{c}</option>)}</select></label>}
                            <label className="flex items-center gap-1"><input type="checkbox" checked={rascunhoDois.hashtag === 'ambos'} onChange={e => setRascunhoDois({ ...rascunhoDois, hashtag: e.target.checked ? 'ambos' : 'face' })} /> Hashtag com os 2 nomes</label>
                            <div className="flex gap-1">
                              <button className={btn + ' !border-violet-500 bg-violet-500 text-white'} disabled={!rascunhoDois.nome1.trim() || !rascunhoDois.nome2.trim()} onClick={() => void salvarDoisNomes(l, rascunhoDois)} data-salvar-dois-nomes>Salvar</button>
                              {l.doisNomes && <button className={btn} onClick={() => void salvarDoisNomes(l, null)} data-tirar-dois-nomes>Tirar</button>}
                              <button className={btn} onClick={() => setEditandoDois(null)}>Cancelar</button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-2">{campo('IDADE', l.campos.IDADE ?? '', 'IDADE', 'w-14')}</td>
                      <td className="p-2 min-w-[9rem] space-y-1">
                        {extras.map(k => { const kp = chaveNoPedido(k), ex = t?.doc?.sample?.[k]; return <div key={k}><span className="text-[9px] uppercase text-gray-400">{rotuloVariavel(k)}</span>{campo(kp, valorDoCampo(l.campos.extras, k) ?? '', ex ? `ex.: ${ex}` : rotuloVariavel(k))}</div> })}
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
                          {/* Lote 18 (item 224): duas crianças no mesmo pedido → Dividir (sublinhas -A, -B) */}
                          {!l.divisao && <button className={btn + (sugereDivisao(l.pedido.observacoes) ? ' !border-orange-400 text-orange-700' : '')} onClick={() => setDividir(l.pedido.id)} title={sugereDivisao(l.pedido.observacoes) ? 'Parece ter 2 crianças. Dividir?' : 'Dividir o pedido em partes (nome, idade, tema e QTD de cada uma)'} data-dividir-linha>Dividir{sugereDivisao(l.pedido.observacoes) ? '?' : ''}</button>}
                          {l.divisao?.sufixo === 'A' && <button className={btn} onClick={() => { if (confirm(`Desfazer a divisão do pedido #${l.pedido.numero.replace(/-A$/, '')}?`)) void salvarDivisoes(l.divisao!.pai, null) }} data-desfazer-divisao>Desfazer divisão</button>}
                          <a className={btn + (Object.keys(l.posicoes ?? {}).length ? ' !border-orange-400 text-orange-700' : '')} href={`/estudio/mae?pedido=${encodeURIComponent(idDoPedido(l.pedido.id))}&ajustar=1${l.tema ? `&tema=${encodeURIComponent(l.tema.themeId)}` : ''}`} title="Abre a arte deste pedido: mover/tamanho/girar/linhas dos textos só neste pedido (o tema fica travado)" data-ajustar-linha><SlidersHorizontal className="w-3.5 h-3.5" /> Ajustar{Object.keys(l.posicoes ?? {}).length || Object.keys(l.trocas ?? {}).length ? ' ✎' : ''}</a>
                          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={!l.tema || !!progresso || !liberada} onClick={() => void gerar([l])} data-gerar-linha>{gerada(l) ? <RotateCcw className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} {gerada(l) ? 'Gerar de novo' : 'Gerar'}</button>
                        </div>
                      </td>
                      <td className="p-2 text-[10px] min-w-[7rem]" data-status-arte={r?.status ?? st.status}>
                        {r ? (r.status === 'erro' ? <span className="text-red-600">erro: {r.mensagem}</span> : <span className={r.status === 'aviso' ? 'text-amber-700' : 'text-emerald-700'}>{r.status === 'aviso' ? 'gerada c/ aviso' : 'Arte gerada ✓'}<div className="text-gray-400 break-all">{r.valor?.pasta.split('/').slice(-1)[0]}</div></span>)
                          : st.status === 'gerada' ? <span className="text-emerald-700">Arte gerada ✓{quando && <div className="text-gray-400">{quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>}</span> : st.status === 'revisar' ? <span className="text-amber-700">revisar</span> : <span className="text-gray-400">não gerada</span>}
                        {/* Lote 7 (item 117): veio de um lote de impressão */}
                        {(r?.valor?.lote || st.ultima?.variaveis?._lote) && <div className="mt-0.5 inline-block rounded bg-orange-50 px-1 text-[9px] text-orange-800 break-all" title="Lote de impressão" data-lote-linha>{r?.valor?.lote || st.ultima?.variaveis?._lote}</div>}
                        {/* Lote 7 (item 119): gerar não é imprimir — marca depois */}
                        {/* Lote 18 (item 223): etiqueta verde "impresso" + marcar (até nunca gerado aqui) / desmarcar */}
                        {impressa(l.pedido.id) && <div className="mt-0.5 inline-block rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-800" data-selo-impresso>impresso</div>}
                        {impressa(l.pedido.id) && st.status === 'revisar' && <div className="ml-1 mt-0.5 inline-block rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800" data-selo-revisar>revisar</div>}
                        {!impressa(l.pedido.id) && <button className="mt-1 block text-[10px] text-sky-700 underline" onClick={() => void aplicarStatus([l.pedido.id], 'impresso')} data-marcar-impresso>Marcar como impresso</button>}
                        {impressa(l.pedido.id) && <button className="mt-1 block text-[10px] text-gray-500 underline" onClick={() => void desmarcarImpresso([l.pedido.id])} data-desmarcar-impresso>Desmarcar impresso</button>}
                        {/* Lote 13 (item 180): letra que a fonte do tema não tem — antes de gerar, com "Resolver" */}
                        {versaoFontes >= 0 && letrasFaltandoNoPedido(temaDoc(l), valoresDaLinha(l, temaDoc(l))).map(f2 => (
                          <div key={f2.variavel} className="text-red-700" data-letra-faltando={f2.letras.join('')}>
                            A fonte {f2.fonte} não tem <b>{f2.letras.join(' ')}</b> — {f2.texto}{' '}
                            <a className="underline font-semibold" href={`/estudio/mae?pedido=${encodeURIComponent(idDoPedido(l.pedido.id))}&ajustar=1${l.tema ? `&tema=${encodeURIComponent(l.tema.themeId)}` : ''}&letra=${encodeURIComponent(f2.letras[0])}`} data-resolver-letra>Resolver</a>
                          </div>
                        ))}
                        {/* Lote 12 (item 171): a letra trocada SÓ NESTE pedido aparece na linha (antes não dava para saber que estava lá) */}
                        {Object.entries(l.trocas ?? {}).flatMap(([v, ts]) => ts.filter(t => t.fonte).map(t => <div key={`${v}:${t.letra}`} className="text-violet-700" data-troca-linha={t.letra}>{t.letra} em {t.fonte!.family || t.fonte!.postscriptName}{v !== 'NOME' ? ` (${rotuloVariavel(v)})` : ''}</div>))}
                        {/* Lote 19 (item 245): tema sem nome = pedido completo (o "PEDI O NOME" sai com um clique) */}
                        {temaSemNome(l) && (l.editadas.NOME ?? l.campos.NOME ?? '').trim() && <button className="block text-[10px] text-sky-700 underline" onClick={() => { editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, NOME: '', IDADE: '' } })); void apiMae.salvarCampos(l.pedido.id, { NOME: '', IDADE: '' }).catch(() => null) }} data-vai-sem-nome>Este pedido vai sem nome (limpar o nome)</button>}
                        {[...(temaSemNome(l) ? l.alertas.filter(a => !/faltam dados|revisar nome|revisar idade|nome longo/.test(a)) : l.alertas), ...(faltam.length && !temaSemNome(l) ? [`faltam dados (${faltam.map(rotuloVariavel).join(', ')})`] : []), ...(r?.avisos ?? [])].map((a, i) => a.startsWith(PREFIXO_AVISO_MR)
                          ? <details key={i} className="text-amber-700" data-alerta-linha data-aviso-mr><summary className="cursor-pointer">{a.split(' — ')[0]} · ver detalhes</summary>{a.split(' — ').slice(1).join(' — ')}</details>
                          : <div key={i} className={/ilegível/.test(a) ? 'rounded bg-orange-100 px-1 font-semibold text-orange-800' : 'text-amber-700'} data-alerta-linha>{a}</div>)}
                        {/* Lote 18 (item 220): a base deste tema não está ligada a um produto do SOA → aviso laranja (usa a QTD) */}
                        {(() => { const x = l.tema && docsTema[l.tema.themeId]; return x && baseDoAlvo(x.base, x.tema, l.alvos[0]?.itens[0]).semLigacao
                          ? <div className="mt-0.5 rounded bg-orange-50 px-1 text-orange-800" data-base-sem-produto>A base “{x.base.name}” não está ligada a nenhum produto do SOA — uso a QTD do pedido. <Link className="font-semibold underline" href="/estudio/mae" data-ligar-produto>Ligar agora</Link></div> : null })()}
                        {r?.valor?.separacao && <details className="text-gray-600" data-separacao><summary className="cursor-pointer">separação das folhas</summary>{r.valor.separacao.map((x, i) => <div key={i}>{x}</div>)}</details>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      {dividir && (() => { const l = linhas.find(x => x.pedido.id === dividir); return l ? <ModalDividir l={l} temas={temas} onFechar={() => setDividir(null)} onSalvar={divs => { setDividir(null); void salvarDivisoes(l.pedido.id, divs) }} /> : null })()}
      {qtd && (() => { const l = linhas.find(x => x.pedido.id === qtd); return l ? <ModalQuantidades raiz={raiz} l={l} t={temaDe} onFechar={() => setQtd(null)} onSalvo={q => editar(l.pedido.id, x => ({ ...x, quantidades: q }))} /> : null })()}
      {modalGerar && <ModalGerar itens={selecionadas.filter(l => l.tema).flatMap(l => l.alvos.filter(a => a.tema).map(a => { const t2 = temaDe(a.tema!.themeId), d2 = t2 ? docsTema[t2.id] : undefined; return { pedido: l.pedido.id, produto: d2 ? tipoDeProduto(d2.base.name, baseDoAlvo(d2.base, d2.tema, a.itens[0]).grupo?.nome) : t2?.baseNome ? tipoDeProduto(t2.baseNome) : (t2?.doc?.produto || a.produto || produtoDoItem(a.itens[0] ?? {}) || 'Produto') } }))}
        exemploPedido={exemploArquivo}
        comSoa={plano === 'soa'} nomeEtapa={etapa?.nome ?? null} onFechar={() => setModalGerar(false)} onGerar={e => void gerarComEscolhas(selecionadas, e)} />}
      {manual && <PedidoManual produtos={[...new Set(temas.map(t2 => t2.produto).filter((p): p is string => !!p))]} onFechar={() => setManual(false)} onCriado={() => void carregar()} />}
      {importar && <ImportarPlanilha raiz={raiz} onFechar={() => setImportar(false)} onImportado={() => void carregar()} />}
    </div>
  )
}
