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
import { Loader2, Download, Square, Check, AlertTriangle, XCircle, Eye, Link2, FolderOpen, RefreshCw, Palette, MessageSquare, Boxes, SlidersHorizontal, RotateCcw, X } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { escolherPasta, pastaSalva, permissao, reconectar } from '@/lib/mae/biblioteca/pasta'
import { rodarFila, resumo, pastaDoProduto, statusDoCard, chaveProduto, chaveProdutoTema, produtoDoItem, type ResultadoItem, type AlvoPedido, type ItemPedido } from '@/lib/mae/pedidos/pedidos'
import { parteArquivo, pastaExportacao, quantidadesPadrao, sufixoQuantidade } from '@/lib/mae/exportar/nomes'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { lerApelidos, lembrarApelido, ARQ_APELIDOS, type Apelidos } from '@/lib/mae/temasProntos/montar'
import { chaveTema, type Vinculo } from '@/lib/mae/pedidos/pedidos'
import { docDoGrupo, grupoDoItem, type Grupo } from '@/lib/mae/editor/grupos'
import { docDaFolha, docDoLote, distribuirLote, type Folha } from '@/lib/mae/editor/folhaMontada'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Identidade } from './arquivosMae'
import { apiMae, temasDisponiveis, linhaDoPedido, comAlvos, alertasLinha, produtoEVariacao, valoresDaLinha, abrirTemaEBase, opcoesDoPedido, gerarArteDoPedido, type LinhaPedido, type TemaDisponivel } from './pedidosMae'
import { useEditor } from './estado'
import { useMarcas, carregarMarcas } from './marcasMae'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { garantirFontesDoTema, registroFontes } from './fontesTexto'
import { lerIdentidade } from './arquivosMae'

const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800'
const pilula = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`
const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
/** Variáveis que não viram coluna de "campo" (têm o seu lugar ou são calculadas). */
const NAO_CAMPO = new Set(['NOME', 'IDADE', 'HASHTAG', 'ARROBA', 'SUFIXO', 'NOME_IDADE'])

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
function Miniatura({ raiz, t, valores, item, id }: { raiz: FileSystemDirectoryHandle | null; t: TemaDisponivel; valores: Record<string, string>; item?: ItemPedido; id: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const grandeRef = useRef<HTMLCanvasElement>(null)
  const [estado, setEstado] = useState<'ver' | 'carregando' | 'ok' | 'erro'>('ver')
  const [grande, setGrande] = useState(false)
  async function folhas(escala: number): Promise<ImageBitmap[]> {
    const { tema, base } = await abrirTemaEBase(raiz, t)
    await garantirFontesDoTema(tema, raiz)
    const { doc } = baseDoAlvo(base, tema, item)
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

interface Resultado { arquivo: string | null; pasta: string; avisos: string[] }
/** Lote 5 (item 76): pedidos que vão juntos nas mesmas folhas (mesmo tema + mesma folha montada). */
interface Lote { t: TemaDisponivel; folha: Folha; grupo: Grupo | null; itens: { id: string; l: LinhaPedido; alvo: AlvoPedido }[] }
type Aba = 'pendentes' | 'gerados'
const SIM = /^(s|sim|ok|aprovad[oa]|true|1|x)$/i

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
  const [saida, setSaida] = useState({ agrupar: 'tudo' as 'tudo' | 'prancheta', linhas: false, apliques: true, quantidade: 'pedido' as 'pedido' | 'um', aproveitar: false })
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [apelidos, setApelidos] = useState<Apelidos>({})
  const [pergunta, setPergunta] = useState<{ id: string; themeId: string; produto: string; produtoId: string | null } | null>(null)
  const [obs, setObs] = useState<string | null>(null)
  const [qtd, setQtd] = useState<string | null>(null)
  const [mais, setMais] = useState<string | null>(null)
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
      setLinhas(ps.map(p => linhaDoPedido(p, ts, vs, ap)))
      setMarcadas(new Set())
    } catch (e) { setErro((e as { status?: number }).status === 403 ? 'O add-on "Edição em massa" não está liberado nesta conta.' : `Não consegui carregar os pedidos: ${(e as Error).message}`) } finally { setCarregando(false) }
  }
  useEffect(() => { if (liberada || !raiz) void carregar() }, [raiz, liberada]) // eslint-disable-line react-hooks/exhaustive-deps

  const gerada = (l: LinhaPedido) => statusDoCard(l.pedido.artes).status === 'gerada'
  const geradaEm = (l: LinhaPedido) => { const u = statusDoCard(l.pedido.artes).ultima; return u?.criadoEm ? new Date(u.criadoEm as unknown as string) : null }
  /** "Aprovado" no SOA: já em produção, ou um campo de aprovação marcado ("Aprovado", "Arte aprovada" = sim). */
  const aprovado = (l: LinhaPedido) => (l.pedido.status && l.pedido.status !== 'ABERTO') || Object.entries(l.pedido.campos).some(([k, v]) => /aprova/i.test(k) && SIM.test(String(v).trim()))
  // as geradas NESTA rodada continuam em Pendentes até recarregar (com o "Arte gerada ✓")
  const visiveis = useMemo(() => linhas.filter(l => aba === 'gerados' ? gerada(l) : (!gerada(l) || !!resultados?.some(r => r.id.split('#')[0] === l.pedido.id))), [linhas, aba, resultados])
  const temaDe = (id: string | undefined) => temas.find(t => t.id === id)
  const editar = (id: string, f: (l: LinhaPedido) => LinhaPedido) => setLinhas(ls => ls.map(l => { if (l.pedido.id !== id) return l; const n = f(l); return { ...n, alertas: alertasLinha(n) } }))
  const recalcularTodas = (vs: Vinculo[], ap: Apelidos) => setLinhas(ls => ls.map(x => comAlvos(x, temas, vs, ap)))
  async function guardarApelidos(novo: Apelidos) { setApelidos(novo); if (raiz) await gravar(raiz, ARQ_APELIDOS, JSON.stringify(novo, null, 1)).catch(() => null) }
  /** Escolha à mão do tema (Lote 4, item 43): vale para os próximos pedidos com o mesmo PRODUTO + TEMA. */
  async function escolherTema(l: LinhaPedido, themeId: string) {
    if (!themeId) { editar(l.pedido.id, x => ({ ...x, tema: null, alvos: x.alvos.map(a => ({ ...a, tema: null })) })); return }
    const alvo = l.alvos[0], produto = alvo?.produto ?? '', campo = l.campos.TEMA?.trim()
    let novo = apelidos
    if (campo) novo = produto ? { ...novo, [chaveProdutoTema(produto, campo)]: themeId } : lembrarApelido(novo, campo, themeId)
    await guardarApelidos(novo)
    setLinhas(ls => ls.map(x => {
      const y = comAlvos(x, temas, vinculos, novo)
      if (x.pedido.id !== l.pedido.id || y.tema?.themeId === themeId) return y
      const alvos = y.alvos.map((a, i) => i === 0 ? { ...a, tema: { themeId, origem: 'manual' as const } } : a)
      return { ...y, alvos, tema: { themeId, origem: 'manual' }, alertas: alertasLinha({ ...y, alvos, tema: { themeId, origem: 'manual' } }) }
    }))
    if (produto) setPergunta({ id: l.pedido.id, themeId, produto, produtoId: alvo?.itens.find(i => i.produtoId)?.produtoId ?? null })
  }
  async function usarParaOProduto() {
    if (!pergunta) return
    const { themeId, produto, produtoId } = pergunta
    setPergunta(null)
    if (produtoId) {
      await apiMae.vincular({ produtoId, variacaoId: null, themeId }).catch(() => null)
      const vs = [...vinculos.filter(v => !(v.produtoId === produtoId && !v.variacaoId)), { produtoId, variacaoId: null, themeId }]
      setVinculos(vs); recalcularTodas(vs, apelidos)
    } else { const novo = { ...apelidos, [chaveProduto(produto)]: themeId }; await guardarApelidos(novo); recalcularTodas(vinculos, novo) }
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
    const dist = distribuirLote(cap, ns, { tipo: f.tipo, completar: f.completarUltima })
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
        pedido: l0.pedido.numero, valoresPorSlot: lote.valoresPorSlot, svg: true, dxf: true,
        ...(juntos ? { nomeArquivo, rotulos: lote.rotulos } : { sufixoArquivo: sufixoQuantidade(lt.grupo?.nome || lt.itens[0].alvo.produto || f.nome, ns[0]) }) } })
    const pdf = r.arquivos.find(a => a.endsWith('.pdf')) ?? null
    if (juntos) await gravar(raiz!, `${pasta}/${nomeArquivo}_separacao.txt`, [`${f.nome} — ${lt.itens.length} pedidos em ${dist.length} folha(s)`, `Tema: ${lote.tema.name ?? ''}`, '', ...lote.resumo, ''].join('\r\n'))
    const avisos = [...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a))]
    for (const [k, { l }] of lt.itens.entries())
      await apiMae.registrarArte({ orderId: l.pedido.id, themeId: lote.tema.id, themeVersion: lote.tema.version, variaveis: pedidos[k].valores, status: r.revisar ? 'revisar' : 'gerada', arquivo: pdf }).catch(e => console.warn('[MAE] registrar arte', e))
    return lt.itens.map(it => ({ id: it.id, status: avisos.length ? 'aviso' as const : 'gerada' as const, valor: { arquivo: pdf, pasta, avisos }, avisos }))
  }

  /** Gera os pedidos dados: um arquivo por pedido e PRODUTO (grupo da base), na quantidade do pedido. */
  async function gerar(lista: LinhaPedido[]) {
    if (!raiz) { setErro('Conecte a pasta Biblioteca MAE.'); return }
    const fila = lista.filter(l => l.tema).flatMap(l => l.alvos.filter(a => a.tema).map((a, i) => ({ id: i ? `${l.pedido.id}#${i + 1}` : l.pedido.id, l, alvo: a as AlvoPedido })))
    if (!fila.length) return
    cancelar.current = false; setResultados(null); setErro(null)
    const dia = pastaExportacao(new Date())
    const identidade = useEditor.getState().identidade
    const docs = new Map<string, { tema: DocTema; base: DocTrabalho }>()
    const abrir = async (t: TemaDisponivel) => { let d = docs.get(t.id); if (!d) { d = await abrirTemaEBase(raiz, t); docs.set(t.id, d) } return d }
    // Lote 5 (item 76): folha montada AVULSA, ou "Aproveitar folhas" ligado → LOTE (pedidos juntos nas folhas)
    const lotes = new Map<string, Lote>()
    const normais: typeof fila = []
    for (const it of fila) {
      const t = temaDe(it.alvo.tema!.themeId)
      const d = t ? await abrir(t).catch(() => null) : null
      const grupo = d ? baseDoAlvo(d.base, d.tema, it.alvo.itens[0]).grupo : null
      const folha = d && grupo?.folhaId ? (d.base.folhas ?? []).find(x => x.id === grupo.folhaId) : undefined
      if (!t || !folha || !(saida.aproveitar || folha.tipo === 'avulso')) { normais.push(it); continue }
      const chave = saida.aproveitar ? `${t.id}|${folha.id}` : it.id
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
    const rs = await rodarFila(normais, async ({ l, alvo }) => {
      const t = temaDe(alvo.tema!.themeId)
      if (!t) throw new Error('tema não encontrado')
      const d = await abrir(t)
      const avisos: string[] = []
      // Lote 5 (item 72): o grupo do produto na base de portfólio (Kit Festa, Sacola P…); sem grupo, a base inteira
      const { doc: docGrupo, grupo } = baseDoAlvo(d.base, d.tema, alvo.itens[0])
      // Lote 5 (item 76): produto de peças pequenas → a FOLHA MONTADA (prancheta virtual), 1 kit = 1 folha
      const folha = grupo?.folhaId ? (d.base.folhas ?? []).find(x => x.id === grupo.folhaId) : undefined
      const vf = folha ? docDaFolha(d.base, d.tema, folha) : null
      const doc = vf?.doc ?? docGrupo, temaArte = vf?.tema ?? d.tema
      if (d.base.grupos?.length && !grupo) avisos.push(`"${alvo.produto || 'produto'}" não tem grupo ligado na base — saiu a base inteira`)
      const valores = valoresDaLinha(l, d.tema)
      const pasta = pastaDoProduto(dia, grupo?.nome || d.tema.produto || alvo.produto || produtoDoItem(alvo.itens[0] ?? {}))
      // Lote 5 (item 79): cada caixa na quantidade dela (a salva no pedido, ou a do kit dividida pelas caixas)
      const total = pecasDoAlvo(alvo), caixas = caixasDe(doc).map(c => c.id)
      // folha montada: quantos KITS (cada kit = uma folha); caixas: a quantidade de cada caixa
      const kits = vf ? Math.max(1, alvo.itens.reduce((s, i) => s + (Number((i as { qtdVendida?: number }).qtdVendida) || 0), 0) || 1) : 0
      const copias = saida.quantidade !== 'pedido' ? undefined
        : vf ? { [vf.artboardId]: kits }
        : (l.quantidades?.[chaveDoAlvo(alvo)] ?? (total ? quantidadesPadrao(total, caixas).porCaixa : undefined))
      const r = await gerarArteDoPedido({ raiz, pedido: l.pedido, tema: temaArte, base: doc, identidade, marcas,
        opcoes: { ...opcoesDoPedido({ agrupar: saida.agrupar, linhas: saida.linhas, apliques: saida.apliques }, valores, pasta), pedido: l.pedido.numero, copias,
          ...(vf ? { svg: true, dxf: true } : {}), sufixoArquivo: vf ? sufixoQuantidade(grupo?.nome || alvo.produto || 'Folha', kits) : total ? sufixoQuantidade(grupo?.nome || alvo.produto || 'Kit', total) : undefined } })
      avisos.push(...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°|MARCA foi girada/.test(a)))
      return { valor: { arquivo: r.arquivos.find(a => a.endsWith('.pdf')) ?? null, pasta, avisos }, avisos }
    }, { aoProgredir: (feitos, _t, atual) => setProgresso({ feitos: feitosLote + feitos, total: fila.length, atual: atual ? `Pedido ${atual.l.pedido.numero}${atual.l.alvos.length > 1 ? ` · ${atual.alvo.produto.slice(0, 30)}` : ''}` : '' }), cancelado: () => cancelar.current })
    setResultados([...rsLote, ...rs]); setProgresso(null)
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: ps.find(p => p.id === l.pedido.id) ?? l.pedido })))
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

      {/* abas + seleção + saída */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAba('pendentes')} className={pilula(aba === 'pendentes')} data-aba-massa="pendentes">Pendentes <b>{pendentes}</b></button>
        <button onClick={() => setAba('gerados')} className={pilula(aba === 'gerados')} data-aba-massa="gerados">Já gerados <b>{jaGerados}</b></button>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <button className={btn} onClick={() => setMarcadas(new Set(visiveis.filter(l => l.tema && aprovado(l)).map(l => l.pedido.id)))} title="Os que já estão em produção, ou com o campo de aprovação marcado" data-selecionar-aprovados>Selecionar aprovados</button>
        <button className={btn} onClick={() => setMarcadas(new Set(visiveis.filter(l => l.tema).map(l => l.pedido.id)))}>Selecionar todos</button>
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
          <span className="text-xs text-gray-500">Arquivos em Exportações / hoje / <i>Produto</i> / <i>Nome_Idadeanos_Tema_Quantidade</i>.pdf{saida.aproveitar ? <> · folhas juntas: <i>LOTE_Peça_dia-mês</i>.pdf + <i>_separacao.txt</i></> : null}</span>
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
                  const item = l.alvos[0]?.itens.find(i => i.produtoId)
                  const quando = geradaEm(l)
                  const campo = (k: string, valor: string, ph: string, w = 'min-w-[7rem]') => (
                    <input value={l.editadas[k] ?? valor} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, [k]: e.target.value } }))} onBlur={() => void gravarCampo(linhas.find(x => x.pedido.id === l.pedido.id)!, k)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={`${inp} ${w}`} placeholder={ph} aria-label={ph} data-campo-linha={k} />
                  )
                  return (
                    <tr key={l.pedido.id} className={`border-t border-gray-100 dark:border-gray-800 align-top ${marcadas.has(l.pedido.id) ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`} data-linha-pedido={l.pedido.numero}>
                      <td className="p-2"><input type="checkbox" className="accent-orange-500" checked={marcadas.has(l.pedido.id)} disabled={!l.tema} onChange={e => marcar(l.pedido.id, e.target.checked)} aria-label={`Selecionar o pedido ${l.pedido.numero}`} /></td>
                      <td className="p-2">{t ? <Miniatura raiz={raiz} t={t} valores={v} item={l.alvos[0]?.itens[0]} id={l.pedido.id} /> : <span className="text-[10px] text-gray-400">—</span>}</td>
                      <td className="p-2 min-w-[12rem] max-w-[16rem]">
                        <div className="flex items-center gap-1"><b>#{l.pedido.numero}</b>{aprovado(l) && <span className="rounded bg-emerald-50 px-1 text-[9px] font-semibold text-emerald-700" title="Aprovado / em produção">aprovado</span>}</div>
                        <div className="text-[10px] text-gray-500 truncate">{l.pedido.cliente}</div>
                        {(pv.produto || pv.variacao) && <div className="text-[10px] text-gray-400 truncate" title={`${pv.produto}${pv.variacao ? ` · ${pv.variacao}` : ''}`} data-produto-linha>{pv.produto}{pv.variacao ? <> · <span className="text-gray-500">{pv.variacao}</span></> : null}</div>}
                        <select value={l.tema?.themeId ?? ''} onChange={e => void escolherTema(l, e.target.value)} className={inp + ' mt-1'} title="Tema da arte (fica lembrado para o mesmo produto + TEMA)" data-tema-linha>
                          <option value="">— escolher o tema —</option>
                          {temas.map(t2 => <option key={t2.id} value={t2.id}>{t2.name}{t2.produto ? ` · ${t2.produto}` : ''}</option>)}
                        </select>
                        {!l.tema && l.campos.TEMA && <div className="text-[10px] text-amber-700" data-tema-nao-encontrado>TEMA &ldquo;{l.campos.TEMA}&rdquo; não encontrado</div>}
                        {l.alvos.length > 1 && <div className="text-[10px] text-gray-500" data-varios-produtos>{l.alvos.length} produtos → {l.alvos.length} arquivos</div>}
                        {pergunta?.id === l.pedido.id && (
                          <div className="mt-1 rounded border border-orange-200 bg-white dark:bg-gray-900 p-1.5 text-[11px] space-y-1" data-pergunta-produto>
                            <p>Usar <b>{temaDe(pergunta.themeId)?.name}</b> para <b>todos</b> os pedidos de <b>{pergunta.produto.slice(0, 60)}</b>?</p>
                            <div className="flex gap-1">
                              <button type="button" className={btn + ' bg-orange-500 text-white !border-orange-500'} onClick={() => void usarParaOProduto()} data-produto-sim>Sim, para todos</button>
                              <button type="button" className={btn} onClick={() => setPergunta(null)} data-produto-nao>Só com este TEMA</button>
                            </div>
                          </div>
                        )}
                        {l.tema?.origem === 'manual' && item?.produtoId && <button className="text-[10px] underline text-orange-700 flex items-center gap-0.5" onClick={() => apiMae.vincular({ produtoId: item.produtoId!, variacaoId: item.variacaoId ?? null, themeId: l.tema!.themeId }).then(() => editar(l.pedido.id, x => ({ ...x, tema: { ...x.tema!, origem: 'variacao' } })))} data-lembrar-vinculo><Link2 className="w-3 h-3" /> sempre usar para {item.produto ?? item.nome}</button>}
                      </td>
                      <td className="p-2">
                        {l.campos.revisarNomeIdade && <p className="mb-0.5 text-[10px] text-amber-800 bg-amber-50 rounded px-1" data-revisar-nome-idade>Veio: “{l.campos.revisarNomeIdade}”</p>}
                        {campo('NOME', l.campos.NOME ?? '', 'NOME')}
                      </td>
                      <td className="p-2">{campo('IDADE', l.campos.IDADE ?? '', 'IDADE', 'w-14')}</td>
                      <td className="p-2 min-w-[9rem] space-y-1">
                        {extras.map(k => <div key={k}><span className="text-[9px] uppercase text-gray-400">{rotuloVariavel(k)}</span>{campo(k, l.campos.extras[k] ?? t?.doc?.sample?.[k] ?? '', rotuloVariavel(k))}</div>)}
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
                          <a className={btn + (Object.keys(l.posicoes ?? {}).length ? ' !border-orange-400 text-orange-700' : '')} href={`/estudio/mae?pedido=${encodeURIComponent(l.pedido.id)}&ajustar=1`} target="_blank" rel="noreferrer" title="Abre a arte deste pedido: mover/tamanho/girar/linhas dos textos só neste pedido (o tema fica travado)" data-ajustar-linha><SlidersHorizontal className="w-3.5 h-3.5" /> Ajustar{Object.keys(l.posicoes ?? {}).length ? ' ✎' : ''}</a>
                          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={!l.tema || !!progresso || !liberada} onClick={() => void gerar([l])} data-gerar-linha>{gerada(l) ? <RotateCcw className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} {gerada(l) ? 'Gerar de novo' : 'Gerar'}</button>
                        </div>
                      </td>
                      <td className="p-2 text-[10px] min-w-[7rem]" data-status-arte={r?.status ?? st.status}>
                        {r ? (r.status === 'erro' ? <span className="text-red-600">erro: {r.mensagem}</span> : <span className={r.status === 'aviso' ? 'text-amber-700' : 'text-emerald-700'}>{r.status === 'aviso' ? 'gerada c/ aviso' : 'Arte gerada ✓'}<div className="text-gray-400 break-all">{r.valor?.pasta.split('/').slice(-1)[0]}</div></span>)
                          : st.status === 'gerada' ? <span className="text-emerald-700">Arte gerada ✓{quando && <div className="text-gray-400">{quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>}</span> : st.status === 'revisar' ? <span className="text-amber-700">revisar</span> : <span className="text-gray-400">não gerada</span>}
                        {[...l.alertas, ...(r?.avisos ?? [])].map((a, i) => <div key={i} className="text-amber-700">{a}</div>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      {qtd && (() => { const l = linhas.find(x => x.pedido.id === qtd); return l ? <ModalQuantidades raiz={raiz} l={l} t={temaDe} onFechar={() => setQtd(null)} onSalvo={q => editar(l.pedido.id, x => ({ ...x, quantidades: q }))} /> : null })()}
    </div>
  )
}
