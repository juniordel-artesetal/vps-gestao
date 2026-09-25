'use client'
// SOA Edition — EDIÇÃO EM MASSA (produção): só CONSOME um template pronto. Nada de subir molde nem posicionar
// campo aqui — isso é a preparação, feita 1x em "Templates" (criar template / Editor de imagem).
//   1. escolher o template (meu, kit de produtos, ou Template Especial) — no kit, escolher os produtos
//   2. carregar as artes e ver a prévia
//   3. inserir a lista (colar, planilha ou pedido)
//   4. formato + nome dos arquivos + pastas
//   5. gerar tudo (levas de 50, cota autorizada no servidor; do pedido → anexa à produção)
'use no memo'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Check, ClipboardList, FileSpreadsheet, ShoppingBag, Download, Plus, Layers, Box, Sparkles, Lock, ArrowRight } from 'lucide-react'
import { carregarMolde, gerarLote, enviarArquivo, exigirSaldo, Autorizador, SemCota, baixar, type Formato, type Molde } from '@/lib/estudio/cliente'
import { renderizar } from '@/lib/estudio/render'
import { variaveisDo, type ConfigTemplate, type Linha } from '@/lib/estudio/tipos'
import { tabelaDeColar, tabelaDePlanilha, tabelaDePedidos, mapearAuto, montarLinhas, nomesArquivos, levas, LIMITE_LOTE, type PedidoFonte, type Tabela } from '@/lib/estudio/dados'
import { abrirTemaCaixas, carregarMoldeCaixa, custoKit, gerarKitCaixas, listarMoldes, resolverFonteNativa, carregarFontesTema, type MoldeCarregado } from '@/lib/estudio/caixasCliente'
import { carregarImagensTema, renderMoldeTema, pastaDeSaida, type Imagens } from '@/lib/estudio/caixas'
import type { TemaCaixas } from '@/lib/estudio/caixasTipos'
import { FONTES_NATIVAS } from './fontesNativas'
import CotaBarra from './CotaBarra'
import { useBaseEstudio } from './caixas/comum'

type Origem = 'meu' | 'kit' | 'especial'
interface ItemBib { id: string; nome: string; preview: string | null; origem: Origem; bloqueado?: boolean }
type Pagina = { molde: Molde; cfg: ConfigTemplate }
type Carregado =
  | { tipo: 'template'; nome: string; tema: string; paginas: Pagina[]; fontes: ConfigTemplate['fontesUsuario'] }
  | { tipo: 'kit'; nome: string; tema: TemaCaixas; moldes: MoldeCarregado[] }

const AMOSTRA: Linha = { nome: 'Sophia', idade: '4' }
const j = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)
const inp = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800'
const lbl = 'block text-[11px] font-medium text-gray-500 mb-0.5'
const cartao = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4'

export default function EdicaoEmMassa() {
  const { workspaceId, storage } = useBaseEstudio()
  const [bib, setBib] = useState<ItemBib[] | null>(null)
  const [aba, setAba] = useState<Origem>('meu')
  const [sel, setSel] = useState<ItemBib | null>(null)
  const [kitMoldes, setKitMoldes] = useState<{ id: string; nome: string }[]>([])
  const [produtos, setProdutos] = useState<string[]>([])
  const [carregado, setCarregado] = useState<Carregado | null>(null)
  const [previas, setPrevias] = useState<string[]>([])
  const [carregando, setCarregando] = useState('')
  // lista
  const [origemLista, setOrigemLista] = useState<'colar' | 'xlsx' | 'pedido'>('colar')
  const [texto, setTexto] = useState('')
  const [cabecalho, setCabecalho] = useState(false)
  const [tabPlanilha, setTabPlanilha] = useState<Tabela | null>(null)
  const [pedidos, setPedidos] = useState<PedidoFonte[] | null>(null)
  const [pedidosSel, setPedidosSel] = useState<string[]>([])
  const [expandir, setExpandir] = useState('Nome')
  const [mapa, setMapa] = useState<Record<string, string>>({})
  // saída
  const [formato, setFormato] = useState<Formato | 'zip'>('pdf-unico')
  const [regra, setRegra] = useState('{tema}_{nome}_{idade}')
  const [pasta, setPasta] = useState<'data' | 'categoria' | 'nenhuma'>('data')
  const [guardar, setGuardar] = useState(true)
  const [leva, setLeva] = useState(0)
  const [gerando, setGerando] = useState<{ feitos: number; total: number } | null>(null)
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [cotaV, setCotaV] = useState(0); const [faltam, setFaltam] = useState(0)

  // ── biblioteca de templates (meus + kits + especiais)
  useEffect(() => {
    Promise.all([
      fetch('/api/estudio/templates').then(r => r.json()).catch(() => ({})),
      fetch('/api/estudio/templates?tipo=kit-caixas').then(r => r.json()).catch(() => ({})),
      fetch('/api/estudio/especiais').then(r => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<{ itens?: Record<string, unknown>[]; ativo?: boolean; termo?: { aceito?: boolean } }>,
    ]).then(([a, b, c]) => {
      const itens: ItemBib[] = [
        ...(a.templates || []).map((t: Record<string, unknown>) => ({ id: String(t.id), nome: String(t.temaNome || t.nome), preview: (t.preview as string) || null, origem: 'meu' as const })),
        ...(b.templates || []).map((t: Record<string, unknown>) => ({ id: String(t.id), nome: String(t.temaNome || t.nome), preview: (t.preview as string) || null, origem: 'kit' as const })),
        ...(c.itens || []).map((t: Record<string, unknown>) => ({ id: String(t.id), nome: String(t.nome), preview: (t.preview as string) || null, origem: 'especial' as const, bloqueado: !c.ativo || !c.termo?.aceito })),
      ]
      setBib(itens)
      const q = new URLSearchParams(window.location.search)
      const pre = q.get('template') ? itens.find(i => i.id === q.get('template') && i.origem !== 'especial') : q.get('especial') ? itens.find(i => i.id === q.get('especial') && i.origem === 'especial') : null
      if (pre) { setAba(pre.origem); escolher(pre) }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── passo 1 → 2: escolher e carregar
  async function escolher(it: ItemBib) {
    if (it.bloqueado) { window.location.href = '/templates-especiais'; return }
    setSel(it); setCarregado(null); setPrevias([]); setErro(''); setLeva(0)
    if (it.origem === 'kit') {
      setCarregando('Abrindo o kit…')
      try {
        const t = await abrirTemaCaixas(it.id)
        const todos = await listarMoldes()
        const ms = t.tema.moldeIds.map(id => todos.find(m => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
        setKitMoldes(ms.map(m => ({ id: m.id, nome: m.nome }))); setProdutos(ms.map(m => m.id))
        await carregarKit(it, t.tema, ms.map(m => m.id), t.temaNome || t.nome)
      } catch (e) { setErro((e as Error).message) } finally { setCarregando('') }
      return
    }
    setCarregando('Carregando as artes do template…')
    try {
      const r = await fetch(it.origem === 'especial' ? `/api/estudio/especiais/${it.id}` : `/api/estudio/templates/${it.id}`)
      const d = await r.json()
      const t = d.template
      if (!r.ok || !t?.moldeUrl) throw new Error(d.error || 'Este template está sem a arte-base.')
      const cfg = { ...(j(t.config) as ConfigTemplate) }
      for (const f of cfg.fontesUsuario || []) { try { const ff = new FontFace(f.familia, `url(${f.url})`); await ff.load(); document.fonts.add(ff) } catch { /* fallback */ } }
      const m0 = await carregarMolde(t.moldeUrl, t.moldeMime)
      const paginas: Pagina[] = [{ molde: m0, cfg: { ...cfg, largura: m0.largura, altura: m0.altura, paginas: undefined } }]
      for (const pg of cfg.paginas || []) {
        if (!pg.moldeUrl) continue
        const m = await carregarMolde(pg.moldeUrl)
        paginas.push({ molde: m, cfg: { ...cfg, largura: m.largura, altura: m.altura, pagina: pg.pagina, caixas: pg.caixas, paginas: undefined } })
      }
      const c: Carregado = { tipo: 'template', nome: t.nome, tema: t.temaNome || t.nome, paginas, fontes: cfg.fontesUsuario || [] }
      setCarregado(c); desenharPrevias(c, AMOSTRA)
    } catch (e) { setErro((e as Error).message) } finally { setCarregando('') }
  }
  async function carregarKit(it: ItemBib, tema: TemaCaixas, ids: string[], nomeTema: string) {
    const todos = await listarMoldes()
    const moldes = await Promise.all(ids.map(id => todos.find(m => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m).map(carregarMoldeCaixa))
    const c: Carregado = { tipo: 'kit', nome: nomeTema || it.nome, tema, moldes }
    setCarregado(c); desenharPrevias(c, AMOSTRA)
  }
  function trocarProdutos(ids: string[]) {
    setProdutos(ids)
    if (sel && carregado?.tipo === 'kit') { setCarregando('Atualizando…'); carregarKit(sel, carregado.tema, ids, carregado.nome).finally(() => setCarregando('')) }
  }

  const resolverFonte = useMemo(() => (id: string) => {
    if (id.startsWith('u:') && carregado?.tipo === 'template') { const u = carregado.fontes.find(f => `u:${f.id}` === id); return u ? `"${u.familia}"` : 'sans-serif' }
    return FONTES_NATIVAS.find(f => f.id === id)?.familia || 'sans-serif'
  }, [carregado])

  async function desenharPrevias(c: Carregado, l: Linha) {
    const out: string[] = []
    const mini = (cv: HTMLCanvasElement) => { const k = 260 / Math.max(cv.width, cv.height), m = document.createElement('canvas'); m.width = Math.round(cv.width * k); m.height = Math.round(cv.height * k); const g = m.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, m.width, m.height); g.drawImage(cv, 0, 0, m.width, m.height); return m.toDataURL('image/jpeg', 0.8) }
    if (c.tipo === 'template') {
      await document.fonts?.ready
      for (const p of c.paginas) { const cv = document.createElement('canvas'); renderizar(cv, p.molde.fonte, p.cfg, l, resolverFonte, {}); out.push(mini(cv)) }
    } else {
      const imgs: Imagens = new Map(); await carregarImagensTema(c.tema, imgs); await carregarFontesTema(c.tema)
      for (const mc of c.moldes) {
        const k = 900 / Math.max(mc.W, mc.H), b = document.createElement('canvas'); b.width = Math.round(mc.W * k); b.height = Math.round(mc.H * k); b.getContext('2d')!.drawImage(mc.dieLine, 0, 0, b.width, b.height)
        out.push(mini(renderMoldeTema({ molde: mc.molde, dieLine: b, W: b.width, H: b.height, tema: c.tema, linha: l, fonte: resolverFonteNativa, imgs })))
      }
    }
    setPrevias(out)
  }

  // ── passo 3: lista
  const variaveis = useMemo(() => {
    if (!carregado) return []
    if (carregado.tipo === 'template') return variaveisDo(carregado.paginas.flatMap(p => p.cfg.caixas))
    return variaveisDo(carregado.tema.elementos.filter(e => e.texto).map(e => ({ texto: e.texto!.modelo } as never)))
  }, [carregado])
  useEffect(() => { if (origemLista === 'pedido' && !pedidos) fetch('/api/estudio/pedidos').then(r => r.json()).then(d => setPedidos(d.pedidos || [])).catch(() => setPedidos([])) }, [origemLista, pedidos])
  const tabela: (Tabela & { pedidoIds?: string[] }) | null = useMemo(() => {
    if (origemLista === 'colar') {
      if (!texto.trim()) return null
      // sem cabeçalho: "Nome;Idade" por linha → colunas com o nome das variáveis
      const t = tabelaDeColar(texto, cabecalho)
      return cabecalho ? t : { ...t, cabecalhos: t.cabecalhos.map((c, i) => variaveis[i] || c) }
    }
    if (origemLista === 'xlsx') return tabPlanilha
    const esc = (pedidos || []).filter(p => pedidosSel.includes(p.id))
    return esc.length ? tabelaDePedidos(esc, expandir || null) : null
  }, [origemLista, texto, cabecalho, tabPlanilha, pedidos, pedidosSel, expandir, variaveis])
  useEffect(() => { if (tabela) setMapa(m => ({ ...mapearAuto(variaveis, tabela.cabecalhos), ...Object.fromEntries(Object.entries(m).filter(([, v]) => tabela.cabecalhos.includes(v))) })) }, [tabela, variaveis])
  const linhas: Linha[] = useMemo(() => {
    if (!tabela) return []
    const r = montarLinhas(tabela, mapa, [])
    return r.linhas.map((l, i) => ({ ...l, __pedido: tabela.pedidoIds?.[i] || '' }))
  }, [tabela, mapa])
  const partes = levas(linhas.length)
  const atual = partes[Math.min(leva, Math.max(0, partes.length - 1))] || { inicio: 0, fim: 0 }
  const linhasLeva = linhas.slice(atual.inicio, atual.fim)
  useEffect(() => { if (carregado && linhas[0]) desenharPrevias(carregado, { ...AMOSTRA, ...linhas[0] }) }, [linhas[0]?.nome, linhas[0]?.idade, carregado]) // eslint-disable-line react-hooks/exhaustive-deps

  async function lerPlanilha(f: File) {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer())
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false }) as unknown[][]
      setTabPlanilha(tabelaDePlanilha(aoa))
    } catch { setErro('Não consegui ler a planilha (.xlsx ou .csv).') }
  }

  // ── passo 5: gerar
  const nPag = carregado?.tipo === 'template' ? carregado.paginas.length : 1
  const custo = carregado?.tipo === 'kit' ? custoKit(carregado.tema, carregado.moldes.length, linhasLeva.length) : linhasLeva.length * nPag
  async function gerar() {
    if (!carregado || !linhasLeva.length) return
    setErro(''); setAviso(''); setFaltam(0)
    try { await exigirSaldo(custo) } catch (e) { if (e instanceof SemCota) setFaltam(e.faltam); setErro((e as Error).message); return }
    const tema = carregado.tipo === 'template' ? carregado.tema : carregado.nome
    const dir = pastaDeSaida(pasta, carregado.tipo === 'kit' ? carregado.tema : { categoria: 'temas-editados' } as TemaCaixas)
    // do pedido: um arquivo por pedido (cada um anexado à produção do seu pedido)
    const grupos = new Map<string, Linha[]>()
    for (const l of linhasLeva) { const k = l.__pedido || ''; grupos.set(k, [...(grupos.get(k) || []), { ...l, tema }]) }
    let feitos = 0
    setGerando({ feitos: 0, total: custo })
    try {
      for (const [pedidoId, ls] of grupos) {
        const n = carregado.tipo === 'kit' ? custoKit(carregado.tema, carregado.moldes.length, ls.length) : ls.length * nPag
        const aut = new Autorizador(n)
        let arquivo: Blob, nome: string
        if (carregado.tipo === 'kit') {
          const r = await gerarKitCaixas({
            tema: { ...carregado.tema, regraNome: regra }, temaNome: tema, moldes: carregado.moldes, linhas: ls,
            formato: formato === 'pdf-unico' ? 'pdf-unico' : formato === 'pdf-individual' ? 'pdf-por-nome' : 'png', pasta: dir,
            autorizar: i => aut.garantir(i), aoProgredir: f => setGerando({ feitos: feitos + f, total: custo }),
          })
          arquivo = r.arquivo; nome = r.nome
        } else {
          const fmt: Formato = formato === 'zip' ? 'png' : formato
          const ext = fmt === 'png' ? 'png' : fmt === 'jpg' ? 'jpg' : 'pdf'
          const nomes = nomesArquivos(regra, ls, ext).map(x => (dir ? `${dir}/${x}` : x))
          const [p0, ...extras] = carregado.paginas
          const r = await gerarLote({
            molde: p0.molde, cfg: p0.cfg, paginasExtras: extras, linhas: ls, nomes, formato: fmt, resolverFonte,
            aoProgredir: f => setGerando({ feitos: feitos + f, total: custo }), cancelado: () => false, autorizar: i => aut.garantir(i),
          })
          arquivo = r.arquivo; nome = r.nome.includes('/') ? r.nome.split('/').pop()! : r.nome
          if (formato === 'zip' && !nome.endsWith('.zip')) {
            const JSZip = (await import('jszip')).default
            const z = new JSZip(); z.file(nomes[0], arquivo); arquivo = await z.generateAsync({ type: 'blob', compression: 'STORE' }); nome = `${tema}.zip`
          }
          if (nome === 'artes.zip' || nome === 'artes.pdf') nome = `${tema}${pedidoId ? ` - pedido` : ''}.${nome.split('.').pop()}`
        }
        feitos += n
        baixar(arquivo, nome)
        if (guardar && storage && workspaceId) {
          await enviarArquivo(arquivo, nome, 'gerado', workspaceId, { pasta: dir ? `Artes geradas/${dir}` : 'Artes geradas', pedidoId: pedidoId || null, meta: { itens: ls.length, formato, tema }, lote: aut.lote }).catch(() => {})
        }
        await fetch('/api/estudio/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lote: aut.lote, templateId: sel?.origem === 'meu' || sel?.origem === 'kit' ? sel.id : null, origem: origemLista === 'pedido' ? 'pedido' : origemLista, totalItens: ls.length, formato: nome.endsWith('.zip') ? 'zip' : formato === 'zip' ? 'zip' : formato, regraNome: regra, status: 'concluido', pedidoId: pedidoId || null }) }).catch(() => {})
      }
      const resto = partes.length > 1 && leva < partes.length - 1 ? ` Próxima leva: ${partes[leva + 1].inicio + 1}–${partes[leva + 1].fim}.` : ''
      setAviso(`Pronto! ${linhasLeva.length} arte(s) gerada(s) — ${custo} imagem(ns) da cota.${origemLista === 'pedido' && guardar ? ' Anexadas à produção dos pedidos.' : ''}${resto}`)
      if (resto) setLeva(l => l + 1)
    } catch (e) { if (e instanceof SemCota) setFaltam(e.faltam); setErro((e as Error).message) }
    finally { setGerando(null); setCotaV(v => v + 1) }
  }

  const passo = !carregado ? 1 : !linhas.length ? 3 : 4
  const lista = (bib || []).filter(i => i.origem === aba)

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edição em massa de artes</h1>
          <p className="text-sm text-gray-500">Escolha um template pronto → dê a lista de nomes → exporte tudo.</p>
        </div>
        <Link href="/estudio/templates" className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 text-orange-700 dark:text-orange-300 px-3 py-1.5 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30"><Plus className="w-4 h-4" /> Criar novo template</Link>
      </div>
      <CotaBarra atualizar={cotaV} faltam={faltam} />
      {erro && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{erro}</p>}
      {aviso && <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2">{aviso}</p>}

      <Passo passo={passo} n={1} titulo="Escolha o template" ativo>
        <div className="flex flex-wrap gap-1.5">
          {([['meu', 'Meus templates', Layers], ['kit', 'Kits de produtos', Box], ['especial', 'Templates Especiais', Sparkles]] as const).map(([k, t, I]) => (
            <button key={k} onClick={() => setAba(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs border ${aba === k ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}><I className="w-3.5 h-3.5" /> {t}</button>
          ))}
        </div>
        {bib === null ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : !lista.length ? (
          <p className="text-sm text-gray-500">{aba === 'meu' ? 'Nenhum template ainda.' : aba === 'kit' ? 'Nenhum kit de produtos ainda.' : 'Os Templates Especiais aparecem aqui para quem assina.'} <Link href={aba === 'kit' ? '/estudio/caixas' : aba === 'especial' ? '/templates-especiais' : '/estudio/templates'} className="text-orange-600 hover:underline inline-flex items-center gap-1">{aba === 'especial' ? 'Conhecer' : 'Criar'} <ArrowRight className="w-3.5 h-3.5" /></Link></p>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            {lista.map(i => (
              <button key={i.origem + i.id} onClick={() => escolher(i)} className={`relative rounded-xl border-2 p-1.5 text-left ${sel?.id === i.id ? 'border-orange-500' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'}`}>
                <div className="aspect-square bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">{i.preview ? <img src={i.preview} alt="" className="max-w-full max-h-full" /> : <Layers className="w-6 h-6 text-gray-300" />}</div>
                <p className="text-[11px] font-medium truncate mt-1">{i.nome}</p>
                {i.bloqueado && <Lock className="absolute top-2 right-2 w-4 h-4 text-gray-500" />}
              </button>
            ))}
          </div>
        )}
        {sel?.origem === 'kit' && !!kitMoldes.length && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">Produtos:</span>
            <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={produtos.length === kitMoldes.length} onChange={e => trocarProdutos(e.target.checked ? kitMoldes.map(m => m.id) : [])} /> Todos</label>
            {kitMoldes.map(m => <label key={m.id} className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1"><input type="checkbox" className="accent-orange-500" checked={produtos.includes(m.id)} onChange={e => trocarProdutos(e.target.checked ? [...produtos, m.id] : produtos.filter(x => x !== m.id))} /> {m.nome}</label>)}
          </div>
        )}
      </Passo>

      <Passo passo={passo} n={2} titulo="Artes do template (prévia)" ativo={!!carregado}>
        {carregando ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {carregando}</p> : !carregado ? <p className="text-xs text-gray-400">Escolha um template acima.</p> : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {previas.map((u, i) => <div key={i} className="shrink-0 text-center"><img src={u} alt="" className="h-40 rounded-lg border border-gray-200 dark:border-gray-700" /><p className="text-[10px] text-gray-400">{carregado.tipo === 'kit' ? carregado.moldes[i]?.molde.nome : `Página ${i + 1}`}</p></div>)}
          </div>
        )}
        {carregado && <p className="text-[11px] text-gray-500">Campos deste template: {variaveis.map(v => `{${v}}`).join(', ') || '—'}. A prévia usa o 1º nome da lista.</p>}
      </Passo>

      <Passo passo={passo} n={3} titulo="Lista de nomes" ativo={!!carregado}>
        <div className="flex flex-wrap gap-1.5">
          {([['colar', 'Colar lista', ClipboardList], ['xlsx', 'Planilha', FileSpreadsheet], ['pedido', 'De pedidos', ShoppingBag]] as const).map(([k, t, I]) => (
            <button key={k} onClick={() => setOrigemLista(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs border ${origemLista === k ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}><I className="w-3.5 h-3.5" /> {t}</button>
          ))}
        </div>
        {origemLista === 'colar' && <>
          <textarea className={`${inp} font-mono text-xs h-32`} placeholder={`Um por linha, na ordem: ${variaveis.join(';') || 'nome;idade'}\nSophia;4\nMaria Eduarda;5`} value={texto} onChange={e => setTexto(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-gray-500"><input type="checkbox" className="accent-orange-500" checked={cabecalho} onChange={e => setCabecalho(e.target.checked)} /> A 1ª linha é o cabeçalho (nomes das colunas)</label>
        </>}
        {origemLista === 'xlsx' && (
          <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2 text-xs cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" /> {tabPlanilha ? `${tabPlanilha.linhas.length} linha(s) · colunas: ${tabPlanilha.cabecalhos.join(', ')}` : 'Escolher planilha (.xlsx ou .csv) — a 1ª linha com os nomes das colunas'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) lerPlanilha(f); e.target.value = '' }} />
          </label>
        )}
        {origemLista === 'pedido' && (
          <div className="space-y-2">
            <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {pedidos === null ? <p className="p-2 text-xs text-gray-400">Carregando…</p> : !pedidos.length ? <p className="p-2 text-xs text-gray-400">Nenhum pedido em aberto.</p> : pedidos.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-2 text-xs">
                  <input type="checkbox" className="accent-orange-500" checked={pedidosSel.includes(p.id)} onChange={e => setPedidosSel(s => (e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id)))} />
                  <span className="flex-1 truncate">#{p.numero} · {p.destinatario} — {p.campos.Nome || 'sem nome'}{p.campos.Idade ? `, ${p.campos.Idade}` : ''}{p.campos.Tema ? ` · tema ${p.campos.Tema}` : ''}</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500">Vários nomes no mesmo pedido (um por linha) no campo:
              <input className={`${inp} !w-32`} value={expandir} onChange={e => setExpandir(e.target.value)} /></label>
          </div>
        )}
        {tabela && !!variaveis.length && (
          <div className="flex flex-wrap gap-2 text-xs">
            {variaveis.map(v => (
              <label key={v} className="flex items-center gap-1">{`{${v}}`} ←
                <select className="border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 bg-white dark:bg-gray-800" value={mapa[v] || ''} onChange={e => setMapa(m => ({ ...m, [v]: e.target.value }))}>
                  <option value="">—</option>{tabela.cabecalhos.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
        {!!linhas.length && <p className="text-xs text-gray-600 dark:text-gray-300">{linhas.length} arte(s): {linhas.slice(0, 4).map(l => [l.nome, l.idade].filter(Boolean).join(', ')).join(' · ')}{linhas.length > 4 ? ' …' : ''}</p>}
      </Passo>

      <Passo passo={passo} n={4} titulo="Formato e nomes dos arquivos" ativo={!!linhas.length}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={lbl}>Formato</label>
            <select className={inp} value={formato} onChange={e => setFormato(e.target.value as Formato | 'zip')}>
              <option value="pdf-unico">PDF único (para imprimir)</option>
              <option value="pdf-individual">PDF individual (um por nome)</option>
              <option value="png">PNG (um por arte)</option>
              <option value="jpg">JPG (um por arte)</option>
              <option value="zip">ZIP com PNGs</option>
            </select>
          </div>
          <div><label className={lbl}>Nome dos arquivos</label><input className={`${inp} font-mono text-xs`} value={regra} onChange={e => setRegra(e.target.value)} /></div>
          <div><label className={lbl}>Pastas</label>
            <select className={inp} value={pasta} onChange={e => setPasta(e.target.value as typeof pasta)}>
              <option value="data">Pela data de hoje</option><option value="categoria">Pela categoria</option><option value="nenhuma">Sem pasta</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" className="accent-orange-500" checked={guardar} onChange={e => setGuardar(e.target.checked)} /> Guardar em Meus arquivos{origemLista === 'pedido' ? ' e anexar à produção de cada pedido' : ''}</label>
      </Passo>

      <Passo passo={passo} n={5} titulo="Gerar tudo" ativo={!!linhas.length}>
        {partes.length > 1 && (
          <p className="text-xs text-gray-500">Máximo de {LIMITE_LOTE} por vez — leva:
            <select className="ml-1 border border-gray-200 dark:border-gray-700 rounded px-1 bg-white dark:bg-gray-800" value={leva} onChange={e => setLeva(Number(e.target.value))}>{partes.map((p, i) => <option key={i} value={i}>{p.inicio + 1}–{p.fim}</option>)}</select>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={gerar} disabled={!carregado || !linhasLeva.length || !!gerando} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
            {gerando ? <><Loader2 className="w-4 h-4 animate-spin" /> {gerando.feitos}/{gerando.total}</> : <><Download className="w-4 h-4" /> Gerar {linhasLeva.length || ''} arte(s)</>}
          </button>
          {!!linhasLeva.length && <span className="text-xs text-gray-500">Usa {custo} imagem(ns) da sua cota{nPag > 1 ? ` (${nPag} páginas por nome)` : ''}.</span>}
        </div>
        {gerando && <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-full bg-orange-500 transition-all" style={{ width: `${gerando.total ? (gerando.feitos / gerando.total) * 100 : 0}%` }} /></div>}
      </Passo>
    </div>
  )
}

/** Um passo do assistente (fora do componente: senão os campos perderiam o foco a cada tecla). */
function Passo({ n, passo, titulo, children, ativo }: { n: number; passo: number; titulo: string; children: React.ReactNode; ativo: boolean }) {
  return (
    <section className={`${cartao} space-y-3 ${ativo ? '' : 'opacity-60'}`}>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${passo > n ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>{passo > n ? <Check className="w-3.5 h-3.5" /> : n}</span> {titulo}</p>
      {children}
    </section>
  )
}
