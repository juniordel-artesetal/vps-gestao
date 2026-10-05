'use client'
'use no memo'
// PEDIDOS E EDIÇÃO EM MASSA do Método MAE — mesma cara da Edição em massa do SOA Design (passos em
// cartões, dentro do menu do SOA): 1 escolher os pedidos (agrupados por tema), 2 conferir nome/idade/
// hashtag/tema na linha, 3 formato e pastas, 4 gerar tudo (fila no computador, barra de progresso, resumo,
// "Juntar num PDF só"). 1 PDF por pedido em Exportações/AAAA-MM-DD/<pedido>_<nome>/; o card de cada
// pedido passa a mostrar "Arte gerada ✓".
import DicasMae from './Dicas'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Download, Square, Check, AlertTriangle, XCircle, Eye, Link2, FileStack, FolderOpen, RefreshCw, Palette, ClipboardList } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { escolherPasta, pastaSalva, permissao, reconectar } from '@/lib/mae/biblioteca/pasta'
import { rodarFila, resumo, pastaDoPedido, alertasDaLinha, statusDoCard, type ResultadoItem } from '@/lib/mae/pedidos/pedidos'
import { pastaExportacao, dataIso } from '@/lib/mae/exportar/nomes'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { apiMae, temasDisponiveis, linhaDoPedido, valoresDaLinha, abrirTemaEBase, opcoesDoPedido, gerarArteDoPedido, type LinhaPedido, type TemaDisponivel } from './pedidosMae'
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
  const [estado, setEstado] = useState<'ver' | 'carregando' | 'ok' | 'erro'>('ver')
  async function desenhar() {
    setEstado('carregando')
    try {
      const { tema, base } = await abrirTemaEBase(raiz, t)
      await garantirFontesDoTema(tema, raiz)
      const ab = base.artboards.find(a => base.molds.some(m => m.artboardId === a.id)) ?? base.artboards[0]
      const p = { ...ab, layers: resolverPrancheta(base, ab.id, { tema, texto: { fontes: registroFontes, valores } }) }
      await garantirArquivos(p, raiz)
      const r = await motorDaPagina().render(p, 0.6, '#ffffff', 'bitmap')
      const c = ref.current
      if (c && r.bitmap) { c.width = r.bitmap.width; c.height = r.bitmap.height; c.getContext('2d')!.drawImage(r.bitmap, 0, 0); r.bitmap.close() }
      setEstado('ok')
    } catch { setEstado('erro') }
  }
  return (
    <div className="w-24">
      <canvas ref={ref} className={estado === 'ok' ? 'w-24 h-auto rounded border border-gray-200 bg-white' : 'hidden'} />
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
  const [saida, setSaida] = useState({ agrupar: 'tudo' as 'tudo' | 'prancheta', sobraMm: 10, linhas: true, juntar: false, apliques: true })
  const [juntado, setJuntado] = useState<string | null>(null)
  const cancelar = useRef(false)

  async function carregar() {
    setCarregando(true); setErro(null)
    try {
      const [ts, vs, ps] = await Promise.all([temasDisponiveis(raiz), apiMae.vinculos().catch(() => []), apiMae.pedidos()])
      if (raiz) {
        await carregarMarcas(raiz).catch(() => null)
        if (!Object.keys(useEditor.getState().identidade).length) useEditor.getState().set({ identidade: await lerIdentidade(raiz).catch(() => ({})) })
      }
      setTemas(ts)
      const ls = ps.map(p => linhaDoPedido(p, ts, vs))
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
    return { ...n, alertas: alertasDaLinha(n.campos, n.tema, n.editadas) }
  }))
  const marcar = (id: string, on: boolean) => setMarcadas(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  const selecionadas = linhas.filter(l => marcadas.has(l.pedido.id))

  async function gerarTodos() {
    if (!raiz) { setErro('Conecte a pasta Biblioteca MAE.'); return }
    const fila = selecionadas.filter(l => l.tema).map(l => ({ id: l.pedido.id, l }))
    if (!fila.length) return
    cancelar.current = false; setResultados(null); setJuntado(null); setErro(null)
    const dia = pastaExportacao(new Date())
    const identidade = useEditor.getState().identidade
    const docs = new Map<string, { tema: DocTema; base: DocTrabalho }>()
    const rs = await rodarFila(fila, async ({ l }) => {
      const t = temaDe(l.tema!.themeId)
      if (!t) throw new Error('tema não encontrado')
      let d = docs.get(t.id)
      if (!d) { d = await abrirTemaEBase(raiz, t); docs.set(t.id, d) }
      const valores = valoresDaLinha(l, d.tema)
      const pasta = pastaDoPedido(dia, l.pedido.numero, valores.NOME)
      const r = await gerarArteDoPedido({ raiz, pedido: l.pedido, tema: d.tema, base: d.base, identidade, marcas,
        opcoes: opcoesDoPedido({ agrupar: saida.agrupar, sobraMm: saida.sobraMm, linhas: saida.linhas, apliques: saida.apliques }, valores, pasta) })
      const avisos = [...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°/.test(a))]
      return { valor: { arquivo: r.arquivos.find(a => a.endsWith('.pdf')) ?? null, pasta, avisos }, avisos }
    }, { aoProgredir: (feitos, total, atual) => setProgresso({ feitos, total, atual: atual ? `Pedido ${atual.l.pedido.numero}` : '' }), cancelado: () => cancelar.current })
    setResultados(rs); setProgresso(null)
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: ps.find(p => p.id === l.pedido.id) ?? l.pedido })))
    if (saida.juntar) await juntarPdfs(rs)
  }

  async function juntarPdfs(rs: ResultadoItem<Resultado>[]) {
    if (!raiz) return
    const { PDFDocument } = await import('pdf-lib')
    const todos = await PDFDocument.create()
    for (const r of rs) {
      if (r.status === 'erro' || !r.valor?.arquivo) continue
      const src = await PDFDocument.load(new Uint8Array(await (await ler(raiz, r.valor.arquivo)).arrayBuffer()))
      for (const pg of await todos.copyPages(src, src.getPageIndices())) todos.addPage(pg)
    }
    const nome = `${pastaExportacao(new Date())}/lote_${rs.filter(r => r.valor?.arquivo).length}-pedidos_${dataIso(new Date())}.pdf`
    await gravar(raiz, nome, new Blob([await todos.save() as BlobPart], { type: 'application/pdf' }))
    setJuntado(nome)
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
                      {temaId ? temaDe(temaId)?.name ?? temaId : 'Tema não encontrado'} <span className="font-normal text-gray-400">({ls.length})</span>
                    </label>
                    <ul className="max-h-48 overflow-auto space-y-0.5">
                      {ls.map(l => (
                        <li key={l.pedido.id} className="flex items-center gap-1.5 text-xs" data-item-pedido={l.pedido.numero}>
                          <input type="checkbox" className="accent-orange-500" checked={marcadas.has(l.pedido.id)} disabled={!l.tema} onChange={e => marcar(l.pedido.id, e.target.checked)} aria-label={`Gerar o pedido ${l.pedido.numero}`} />
                          <b>#{l.pedido.numero}</b><span className="truncate text-gray-600 dark:text-gray-300">{l.editadas.NOME ?? l.campos.NOME ?? '—'}{l.campos.IDADE ? `, ${l.editadas.IDADE ?? l.campos.IDADE}` : ''}</span>
                          {gerada(l) && <span className="text-emerald-700 text-[10px]">✓</span>}
                          {l.alertas.length > 0 && <span className="ml-auto text-[10px] text-amber-700 truncate">{l.alertas.join(' · ')}</span>}
                        </li>
                      ))}
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
              <thead><tr className="text-left text-[10px] uppercase text-gray-400"><th>Pedido</th><th>Tema</th><th>Nome</th><th className="w-14">Idade</th><th>Hashtag</th><th title="Tamanho do nome só neste pedido">Tam. nome</th><th>Prévia</th><th>Alertas</th><th>Arte</th></tr></thead>
              <tbody>
                {selecionadas.map(l => {
                  const t = temaDe(l.tema?.themeId), v = valoresDaLinha(l, t?.doc ?? null)
                  const r = resultados?.find(x => x.id === l.pedido.id)
                  const st = statusDoCard(l.pedido.artes)
                  const item = l.pedido.itens.find(i => i.produtoId)
                  return (
                    <tr key={l.pedido.id} className="border-t border-gray-100 dark:border-gray-800 align-top" data-linha-pedido={l.pedido.numero}>
                      <td className="py-1 pr-2"><b>#{l.pedido.numero}</b><div className="text-[10px] text-gray-500 truncate max-w-[10rem]">{l.pedido.cliente}</div></td>
                      <td className="py-1 pr-2 min-w-[9rem]">
                        <select value={l.tema?.themeId ?? ''} onChange={e => editar(l.pedido.id, x => ({ ...x, tema: e.target.value ? { themeId: e.target.value, origem: 'manual' } : null }))} className={inp} data-tema-linha>
                          <option value="">— escolher —</option>
                          {temas.map(t2 => <option key={t2.id} value={t2.id}>{t2.name}</option>)}
                        </select>
                        <div className="text-[10px] text-gray-400">{l.tema ? ({ variacao: 'pelo produto (variação)', produto: 'pelo produto', campo: 'pelo campo TEMA', manual: 'escolhido aqui' } as const)[l.tema.origem] : l.campos.TEMA ? `"${l.campos.TEMA}" não é um tema` : ''}</div>
                        {l.tema?.origem === 'manual' && item?.produtoId && <button className="text-[10px] underline text-orange-700 flex items-center gap-0.5" onClick={() => apiMae.vincular({ produtoId: item.produtoId!, variacaoId: item.variacaoId, themeId: l.tema!.themeId }).then(() => editar(l.pedido.id, x => ({ ...x, tema: { ...x.tema!, origem: 'variacao' } })))} data-lembrar-vinculo><Link2 className="w-3 h-3" /> sempre usar para {item.nome}</button>}
                      </td>
                      <td className="py-1 pr-2 min-w-[8rem]"><input value={l.editadas.NOME ?? l.campos.NOME ?? ''} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, NOME: e.target.value } }))} className={inp} data-nome-linha /></td>
                      <td className="py-1 pr-2"><input value={l.editadas.IDADE ?? l.campos.IDADE ?? ''} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, IDADE: e.target.value } }))} className={inp} inputMode="numeric" data-idade-linha /></td>
                      <td className="py-1 pr-2 min-w-[8rem]"><input value={l.editadas.HASHTAG ?? v.HASHTAG} onChange={e => editar(l.pedido.id, x => ({ ...x, editadas: { ...x.editadas, HASHTAG: e.target.value } }))} className={inp} data-hashtag-linha /></td>
                      <td className="py-1 pr-2 whitespace-nowrap">
                        <input type="range" min={0.5} max={1.8} step={0.01} value={l.escalas?.NOME ?? 1} className="w-16 accent-orange-500 align-middle" title="Tamanho do nome só neste pedido (o tema não muda)"
                          onChange={e => editar(l.pedido.id, x => ({ ...x, escalas: { ...(x.escalas ?? {}), NOME: Number(e.target.value) } }))}
                          onPointerUp={e => { const val = Number((e.target as HTMLInputElement).value); void apiMae.ajustarPedido(l.pedido.id, { NOME: Math.abs(val - 1) < 0.005 ? null : val }).catch(() => null) }} data-escala-linha />
                        <span className="ml-1 tabular-nums text-[10px] text-gray-500">{Math.round((l.escalas?.NOME ?? 1) * 100)}%</span>
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
          <div><label className={lbl}>Sobra (mm)</label>
            <input className={inp} inputMode="decimal" defaultValue={String(saida.sobraMm).replace('.', ',')} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v >= 0 && v <= 30) setSaida(s => ({ ...s, sobraMm: v })) }} data-sobra-massa />
          </div>
          <div><label className={lbl}>Pastas</label>
            <p className="text-xs text-gray-600 dark:text-gray-300 py-1">Exportações / {dataIso(new Date())} / <i>pedido_nome</i></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={saida.linhas} onChange={e => setSaida(s => ({ ...s, linhas: e.target.checked }))} /> Imprimir as linhas de corte e dobra</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={saida.apliques} onChange={e => setSaida(s => ({ ...s, apliques: e.target.checked }))} /> Folhas de apliques 3D (temas com apliques)</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={saida.juntar} onChange={e => setSaida(s => ({ ...s, juntar: e.target.checked }))} data-juntar /> Juntar num PDF só (para imprimir o lote)</label>
        </div>
      </Passo>

      <Passo n={4} feito={!!res && !res.erro} titulo="Gerar tudo" ativo={nSel > 0}>
        <div className="flex flex-wrap items-center gap-3">
          {progresso
            ? <button className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold" onClick={() => { cancelar.current = true }} data-parar><Square className="w-4 h-4" /> Parar depois deste ({progresso.feitos}/{progresso.total})</button>
            : <button onClick={gerarTodos} disabled={!nSel || carregando || !liberada} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40" data-gerar-todos><Download className="w-4 h-4" /> Gerar {nSel || ''} arte(s)</button>}
          <span className="text-xs text-gray-500">Gerado no seu computador · 1 PDF por pedido · os cards dos pedidos passam a mostrar “Arte gerada ✓”.</span>
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
