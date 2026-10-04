'use client'
'use no memo'
// EDIÇÃO EM MASSA (add-on, Sprint 12): todos os pedidos pendentes de arte, de vários temas, agrupados por
// tema. Cada linha: pedido, tema detectado (trocável, e dá para lembrar no produto), NOME/IDADE/HASHTAG
// editáveis, miniatura e alertas. "Gerar todos" = fila no computador, 1 PDF por pedido em
// Exportações/AAAA-MM-DD/<pedido>_<nome>/, resumo (geradas/aviso/erro), "Juntar num PDF só".
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, Play, Square, Check, AlertTriangle, XCircle, Eye, Link2, FileStack } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
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

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const inp = 'w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-xs'

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

interface Resultado { arquivo: string | null; pasta: string; avisos: string[] }

export default function EdicaoEmMassa({ onFechar }: { onFechar: () => void }) {
  const raiz = useBiblioteca(s => s.raiz)
  const marcas = useMarcas(s => s.marcas)
  const [temas, setTemas] = useState<TemaDisponivel[]>([])
  const [linhas, setLinhas] = useState<LinhaPedido[]>([])
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [mostrarGeradas, setMostrarGeradas] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<{ feitos: number; total: number; atual: string } | null>(null)
  const [resultados, setResultados] = useState<ResultadoItem<Resultado>[] | null>(null)
  const [juntar, setJuntar] = useState(false)
  const [juntado, setJuntado] = useState<string | null>(null)
  const cancelar = useRef(false)

  async function carregar() {
    setCarregando(true); setErro(null)
    try {
      const [ts, vs, ps] = await Promise.all([temasDisponiveis(raiz), apiMae.vinculos().catch(() => []), apiMae.pedidos()])
      if (raiz) await carregarMarcas(raiz).catch(() => null)
      setTemas(ts)
      const ls = ps.map(p => linhaDoPedido(p, ts, vs))
      setLinhas(ls)
      setMarcadas(new Set(ls.filter(l => statusDoCard(l.pedido.artes).status !== 'gerada' && l.tema && !l.alertas.some(a => a.startsWith('faltam'))).map(l => l.pedido.id)))
    } catch (e) { setErro((e as { status?: number }).status === 403 ? 'O add-on "Edição em massa" não está liberado nesta conta.' : `Não consegui carregar os pedidos: ${(e as Error).message}`) } finally { setCarregando(false) }
  }
  useEffect(() => { void carregar() }, [raiz]) // eslint-disable-line react-hooks/exhaustive-deps

  // as geradas NESTA rodada continuam na tela (com o "Arte gerada ✓"); as de antes só com o filtro
  const visiveis = linhas.filter(l => mostrarGeradas || statusDoCard(l.pedido.artes).status !== 'gerada' || !!resultados?.some(r => r.id === l.pedido.id))
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

  async function gerarTodos() {
    if (!raiz) { setErro('Conecte a pasta Biblioteca MAE.'); return }
    const fila = linhas.filter(l => marcadas.has(l.pedido.id) && l.tema).map(l => ({ id: l.pedido.id, l }))
    if (!fila.length) return
    cancelar.current = false; setResultados(null); setJuntado(null)
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
      const r = await gerarArteDoPedido({ raiz, pedido: l.pedido, tema: d.tema, base: d.base, identidade, marcas, opcoes: opcoesDoPedido({}, valores, pasta) })
      const avisos = [...(r.revisar ? ['revisar o texto'] : []), ...r.alertas.filter(a => !/girada 90°/.test(a))]
      return { valor: { arquivo: r.arquivos.find(a => a.endsWith('.pdf')) ?? null, pasta, avisos }, avisos }
    }, { aoProgredir: (feitos, total, atual) => setProgresso({ feitos, total, atual: atual ? `Pedido ${atual.l.pedido.numero}` : '' }), cancelado: () => cancelar.current })
    setResultados(rs); setProgresso(null)
    // os cards passam a mostrar "Arte gerada ✓": recarrega o status
    const ps = await apiMae.pedidos().catch(() => null)
    if (ps) setLinhas(ls => ls.map(l => ({ ...l, pedido: ps.find(p => p.id === l.pedido.id) ?? l.pedido })))
    if (juntar) await juntarPdfs(rs)
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

  const sel = linhas.filter(l => marcadas.has(l.pedido.id)).length
  const res = resultados ? resumo(resultados) : null
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900" role="dialog" aria-modal="true" aria-label="Edição em massa" data-edicao-massa>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-800 px-4 py-2">
        <b className="text-sm">Edição em massa</b>
        <span className="text-xs text-gray-500">{linhas.length} pedido(s) em aberto · {sel} marcado(s)</span>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={mostrarGeradas} onChange={e => setMostrarGeradas(e.target.checked)} /> Mostrar os já gerados</label>
        <span className="flex-1" />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={juntar} onChange={e => setJuntar(e.target.checked)} data-juntar /> Juntar num PDF só</label>
        {progresso
          ? <button className={btn} onClick={() => { cancelar.current = true }} data-parar><Square className="w-3.5 h-3.5" /> Parar depois deste</button>
          : <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={!sel || carregando || !raiz} onClick={gerarTodos} data-gerar-todos><Play className="w-3.5 h-3.5" /> Gerar todos ({sel})</button>}
        <button className={btn} onClick={onFechar} disabled={!!progresso}><X className="w-3.5 h-3.5" /> Fechar</button>
      </div>
      {progresso && (
        <div className="px-4 py-2 border-b border-gray-100" data-progresso>
          <div className="h-2 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-orange-500 transition-all" style={{ width: `${(progresso.feitos / Math.max(1, progresso.total)) * 100}%` }} /></div>
          <p className="text-[11px] text-gray-500 mt-1 tabular-nums">{progresso.feitos} de {progresso.total} · {progresso.atual}</p>
        </div>
      )}
      {res && (
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-3 text-xs" data-resumo-massa>
          <span className="text-emerald-700 font-semibold flex items-center gap-1" data-resumo="gerada"><Check className="w-3.5 h-3.5" /> {res.gerada} gerada(s)</span>
          <span className="text-amber-700 font-semibold flex items-center gap-1" data-resumo="aviso"><AlertTriangle className="w-3.5 h-3.5" /> {res.aviso} com aviso</span>
          <span className="text-red-600 font-semibold flex items-center gap-1" data-resumo="erro"><XCircle className="w-3.5 h-3.5" /> {res.erro} com erro</span>
          {juntado && <span className="text-gray-600 flex items-center gap-1" data-juntado><FileStack className="w-3.5 h-3.5" /> {juntado.split('/').pop()}</span>}
          {res.aviso > 0 && <span className="text-gray-500">As com aviso abrem no editor para revisão (botão Revisar na linha).</span>}
        </div>
      )}
      {erro && <p className="px-4 py-2 text-xs text-red-600" data-erro-massa>{erro}</p>}
      <div className="flex-1 overflow-auto px-4 py-2">
        {carregando && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando os pedidos…</p>}
        {!carregando && !visiveis.length && <p className="text-xs text-gray-500">Nenhum pedido pendente de arte. Os pedidos precisam dos campos TEMA, NOME e IDADE (Configurações → Campos do pedido).</p>}
        {grupos.map(([temaId, ls]) => (
          <section key={temaId || 'sem'} className="mb-4" data-grupo-tema={temaDe(temaId)?.name ?? 'sem tema'}>
            <h3 className="text-xs font-semibold mb-1">{temaId ? temaDe(temaId)?.name ?? temaId : 'Tema não encontrado'} <span className="font-normal text-gray-400">({ls.length})</span></h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[10px] uppercase text-gray-400"><th className="w-6" /><th>Pedido</th><th>Tema</th><th>Nome</th><th className="w-14">Idade</th><th>Hashtag</th><th>Prévia</th><th>Alertas</th><th>Arte</th></tr></thead>
                <tbody>
                  {ls.map(l => {
                    const t = temaDe(l.tema?.themeId), v = valoresDaLinha(l, t?.doc ?? null)
                    const r = resultados?.find(x => x.id === l.pedido.id)
                    const st = statusDoCard(l.pedido.artes)
                    const item = l.pedido.itens.find(i => i.produtoId)
                    return (
                      <tr key={l.pedido.id} className="border-t border-gray-100 align-top" data-linha-pedido={l.pedido.numero}>
                        <td className="py-1"><input type="checkbox" checked={marcadas.has(l.pedido.id)} disabled={!l.tema} onChange={e => setMarcadas(s => { const n = new Set(s); if (e.target.checked) n.add(l.pedido.id); else n.delete(l.pedido.id); return n })} aria-label={`Gerar o pedido ${l.pedido.numero}`} /></td>
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
          </section>
        ))}
      </div>
    </div>
  )
}
