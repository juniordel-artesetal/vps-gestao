'use client'
// SOA Design — MEUS ARQUIVOS estilo Google Drive: pastas e subpastas (árvore + caminho no topo), criar/renomear/mover/
// apagar pasta, arrastar arquivo para a pasta, busca, ordenar, selecionar vários → baixar ZIP / mover / apagar /
// ações em lote (tamanhos de marketplace, marca d'água, ajustes) / mandar pro Google Drive dela.
// Upload por arrastar (vários) direto do navegador para o Vercel Blob — cai na pasta aberta. Molde pesado (PDF do
// Photoshop) sobe como CÓPIA LEVE (~300 dpi); o original pode ir para o Google Drive DELA.
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Upload, Download, Trash2, Loader2, Folder, FolderOpen, FolderPlus, AlertTriangle, FileText, Type, ImagePlus, Package, Pencil,
  HardDrive, Share2, CheckCircle2, Clock, ChevronRight, ChevronDown, Search, X, FolderInput, SlidersHorizontal, Tag,
} from 'lucide-react'
import { enviarArquivo, prepararMolde, enviarProDrive, baixar } from '@/lib/estudio/cliente'
import { normalizarCaminho, paiDe, nomeDe, dentroDe, ancestrais } from '@/lib/estudio/pastas'
import AcoesLote from '@/components/estudio/AcoesLote'

interface Asset {
  id: string; tipo: 'molde' | 'fonte' | 'gerado' | 'mockup' | 'original' | 'imagem'; nome: string; url: string; mime: string | null
  tamanhoBytes: number; pasta: string; tags: string[]; pedidoId: string | null; createdAt: string
  sugeridaGlobal?: boolean; aprovadaGlobal?: boolean
}
interface Drive { configurado: boolean; conectado: boolean; email: string | null }
type Ordem = 'recente' | 'nome' | 'tipo' | 'tamanho'

const TIPO_LABEL: Record<string, string> = { imagem: 'Imagens', molde: 'Moldes', fonte: 'Fontes', gerado: 'Artes geradas', mockup: 'Mockups', original: 'Originais (Drive)' }
const kb = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
const MSG_DRIVE: Record<string, string> = {
  ok: 'Google Drive conectado ✅', recusado: 'Você não autorizou o acesso ao Drive.', state: 'A conexão expirou — tente de novo.',
  erro: 'O Google não confirmou a conexão — tente de novo.', indisponivel: 'A conexão com o Google Drive ainda não está disponível.', sessao: 'Entre de novo e tente conectar.',
}
const ARRASTO = 'application/x-soa-arquivos'

function tipoDoArquivo(f: File): Asset['tipo'] {
  if (/\.(ttf|otf|woff2?)$/i.test(f.name) || f.type.startsWith('font/')) return 'fonte'
  return 'molde'
}

function Arquivos() {
  const { data: session } = useSession()
  const workspaceId = (session?.user as { workspaceId?: string } | undefined)?.workspaceId
  const q = useSearchParams()
  const [storage, setStorage] = useState<boolean | null>(null)
  const [drive, setDrive] = useState<Drive | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [pastasCriadas, setPastasCriadas] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atual, setAtual] = useState('')                 // pasta aberta ("" = Meus arquivos)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [tipo, setTipo] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('recente')
  const [sel, setSel] = useState<Set<string>>(new Set())
  // fila de envio: 3 ao mesmo tempo, cada um com a sua barra (otimizando → enviando % → pronto/erro)
  const [fila, setFila] = useState<{ id: number; nome: string; etapa: 'na fila' | 'otimizando' | 'enviando' | 'pronto' | 'erro'; pct: number; mb: number; erro?: string }[]>([])
  const [originaisNoDrive, setOriginaisNoDrive] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(MSG_DRIVE[q.get('drive') || ''] || '')
  const [arrastando, setArrastando] = useState(false)
  const [alvoArrasto, setAlvoArrasto] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState('')
  const [lote, setLote] = useState<{ nome: string; url: string }[] | null>(null)
  const [moverPara, setMoverPara] = useState<string[] | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [d, p] = await Promise.all([fetch('/api/estudio/assets').then(r => r.json()), fetch('/api/estudio/pastas').then(r => r.json()).catch(() => ({ pastas: [] }))])
      setAssets((d.assets || []).map((a: Asset) => ({ ...a, pasta: a.pasta || '', tags: Array.isArray(a.tags) ? a.tags : [] })))
      setPastasCriadas(p.pastas || [])
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => {
    fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => setStorage(false))
    fetch('/api/estudio/drive').then(r => r.json()).then(setDrive).catch(() => {})
    carregar()
  }, [carregar])

  // todas as pastas: as criadas + as que têm arquivo + as mães de cada uma
  const pastas = useMemo(() => {
    const t = new Set<string>()
    for (const c of [...pastasCriadas, ...assets.map(a => a.pasta)]) if (c) ancestrais(c).forEach(x => t.add(x))
    return [...t].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [assets, pastasCriadas])
  const filhas = (c: string) => pastas.filter(p => paiDe(p) === c)
  const qtdEm = (c: string) => assets.filter(a => dentroDe(a.pasta, c)).length
  const buscando = busca.trim().length > 0
  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase()
    const l = assets.filter(a => (!tipo || a.tipo === tipo) && (buscando
      ? a.nome.toLowerCase().includes(b) || a.tags.some(t => t.toLowerCase().includes(b)) || a.pasta.toLowerCase().includes(b)
      : a.pasta === atual))
    const cmp: Record<Ordem, (x: Asset, y: Asset) => number> = {
      recente: (x, y) => String(y.createdAt).localeCompare(String(x.createdAt)),
      nome: (x, y) => x.nome.localeCompare(y.nome, 'pt-BR', { numeric: true }),
      tipo: (x, y) => x.tipo.localeCompare(y.tipo) || x.nome.localeCompare(y.nome, 'pt-BR'),
      tamanho: (x, y) => Number(y.tamanhoBytes) - Number(x.tamanhoBytes),
    }
    return l.sort(cmp[ordem])
  }, [assets, tipo, busca, buscando, atual, ordem])
  const subpastas = buscando ? [] : filhas(atual)
  const selecionados = assets.filter(a => sel.has(a.id))
  const abrir = (c: string) => { setAtual(c); setSel(new Set()); setBusca(''); setAbertas(s => new Set([...s, ...ancestrais(c)])) }

  // ── upload (cai na pasta aberta) ──
  async function enviar(files: FileList | File[]) {
    if (!workspaceId || !storage) return
    const lista = [...files]
    if (lista.some(f => tipoDoArquivo(f) === 'fonte') &&
      !confirm('Use apenas fontes que você tem licença para usar.\n\nAs fontes que você sobe ficam só no seu ateliê — não são compartilhadas com ninguém.')) return
    setErro(''); setAviso('')
    const pasta = atual
    const base = Date.now()
    const itens = lista.map((f, i) => ({ id: base + i, nome: f.name, etapa: 'na fila' as const, pct: 0, mb: f.size / 1048576 }))
    setFila(itens)
    const mudar = (id: number, p: Partial<(typeof fila)[number]>) => setFila(x => x.map(y => (y.id === id ? { ...y, ...p } : y)))
    let comprimidos = 0, noDrive = 0, falhas = 0
    const originais: { f: File; copiaAssetId: string }[] = []
    const um = async (f: File, id: number) => {
      const t = tipoDoArquivo(f)
      try {
        if (t === 'fonte') {
          if (f.size > 10 * 1024 * 1024) throw new Error('fonte acima de 10 MB')
          mudar(id, { etapa: 'enviando' })
          const familia = `SOA_${Math.random().toString(36).slice(2, 8)}`
          await enviarArquivo(f, f.name, 'fonte', workspaceId, { pasta: pasta || 'Fontes', meta: { familia }, aoProgresso: p => mudar(id, { pct: p.pct }) })
        } else {
          mudar(id, { etapa: 'otimizando' })
          const prep = await prepararMolde(f)          // cópia de trabalho (~300 dpi) — imagem pesada no Web Worker
          mudar(id, { etapa: 'enviando', mb: prep.copia.size / 1048576 })
          const m = prep.molde
          const up = await enviarArquivo(prep.copia, prep.nomeCopia, 'molde', workspaceId, {
            pasta: pasta || 'Moldes', aoProgresso: p => mudar(id, { pct: p.pct }),
            meta: { largura: m.largura, altura: m.altura, pagina: m.pagina, dpi: prep.dpi, ...(prep.comprimido ? { original: { nome: f.name, tamanhoBytes: f.size } } : {}) },
          })
          if (prep.comprimido) { comprimidos++; if (originaisNoDrive && drive?.conectado) originais.push({ f, copiaAssetId: up.id }) }
        }
        mudar(id, { etapa: 'pronto', pct: 100 })
      } catch (e) { falhas++; mudar(id, { etapa: 'erro', erro: (e as Error).message }) }
    }
    let proximo = 0
    await Promise.all(Array.from({ length: Math.min(3, lista.length) }, async () => { while (proximo < lista.length) { const k = proximo++; await um(lista[k], itens[k].id) } }))
    carregar()
    // original pesado → Drive DELA em segundo plano (não segura a tela nem a lista)
    for (const o of originais) { try { await enviarProDrive(o.f, o.f.name, { registrar: true, pasta: 'Originais (Drive)', copiaAssetId: o.copiaAssetId }); noDrive++ } catch { /* segue */ } }
    if (originais.length) carregar()
    if (comprimidos) setAviso(`${comprimidos} arquivo(s) pesado(s) guardado(s) como cópia leve (~300 dpi)${noDrive ? `; ${noDrive} original(is) no seu Google Drive` : ''}.`)
    else if (!falhas) setAviso(`${lista.length} arquivo(s) em “${pasta || (lista.every(f => tipoDoArquivo(f) === 'fonte') ? 'Fontes' : 'Moldes')}”.`)
    if (falhas) setErro(`${falhas} arquivo(s) não subiram — veja o motivo na lista acima.`)
    setTimeout(() => setFila(x => (x.every(y => y.etapa === 'pronto') ? [] : x)), 4000)
  }

  // ── pastas ──
  async function novaPasta() {
    const nome = prompt(atual ? `Nova pasta dentro de “${atual}”:` : 'Nome da nova pasta:')
    const c = normalizarCaminho(nome ? (atual ? `${atual}/${nome}` : nome) : '')
    if (!c) return
    const r = await fetch('/api/estudio/pastas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caminho: c }) })
    if (!r.ok) { setErro((await r.json().catch(() => ({}))).error || 'Não consegui criar a pasta.'); return }
    setPastasCriadas(p => [...new Set([...p, ...ancestrais(c)])]); abrir(c)
  }
  async function moverPasta(de: string, para: string) {
    const r = await fetch('/api/estudio/pastas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ de, para }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErro(j.error || 'Não consegui mover a pasta.'); return false }
    await carregar(); if (dentroDe(atual, de)) abrir(para + atual.slice(de.length)); return true
  }
  async function renomearPasta(c: string) {
    const nome = prompt('Novo nome da pasta:', nomeDe(c))
    const n = normalizarCaminho(nome || '')
    if (!n || n.includes('/')) { if (nome) setErro('O nome da pasta não pode ter “/”.'); return }
    const para = paiDe(c) ? `${paiDe(c)}/${n}` : n
    if (para !== c && await moverPasta(c, para)) setAviso(`Pasta renomeada para “${n}”.`)
  }
  async function apagarPasta(c: string) {
    if (!confirm(`Apagar a pasta “${nomeDe(c)}”${filhas(c).length ? ' e as subpastas (vazias)' : ''}?`)) return
    const r = await fetch(`/api/estudio/pastas?caminho=${encodeURIComponent(c)}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErro(j.error || 'Não consegui apagar.'); return }
    setPastasCriadas(p => p.filter(x => !dentroDe(x, c))); if (dentroDe(atual, c)) abrir(paiDe(c)); setAviso('Pasta apagada.')
  }

  // ── arquivos ──
  async function moverArquivos(ids: string[], pasta: string) {
    const r = await fetch('/api/estudio/assets/lote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'mover', ids, pasta }) })
    if (!r.ok) { setErro((await r.json().catch(() => ({}))).error || 'Não consegui mover.'); return }
    setAssets(x => x.map(a => (ids.includes(a.id) ? { ...a, pasta } : a))); setSel(new Set())
    setAviso(`${ids.length} arquivo(s) movido(s) para “${pasta || 'Meus arquivos'}”.`)
  }
  async function excluirVarios(ids: string[]) {
    const nomes = assets.filter(a => ids.includes(a.id))
    if (!confirm(ids.length === 1 ? (nomes[0]?.tipo === 'original' ? `Tirar "${nomes[0].nome}" da lista? O arquivo continua no seu Google Drive.` : `Excluir "${nomes[0]?.nome}"? Não dá para desfazer.`) : `Excluir ${ids.length} arquivos? Não dá para desfazer.`)) return
    setOcupado('Excluindo…')
    try {
      const r = await fetch('/api/estudio/assets/lote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'excluir', ids }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'falha')
      setAssets(x => x.filter(a => !ids.includes(a.id))); setSel(new Set())
    } catch (e) { setErro('Não consegui excluir: ' + (e as Error).message) } finally { setOcupado('') }
  }
  async function renomearArquivo(a: Asset) {
    const nome = prompt('Novo nome:', a.nome)?.trim()
    if (!nome || nome === a.nome) return
    await fetch(`/api/estudio/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) })
    setAssets(x => x.map(y => (y.id === a.id ? { ...y, nome } : y)))
  }
  async function etiquetas(a: Asset) {
    const novasTags = prompt('Etiquetas (separadas por vírgula):', a.tags.join(', '))
    if (novasTags === null) return
    const tags = novasTags.split(',').map(s => s.trim()).filter(Boolean)
    await fetch(`/api/estudio/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) })
    setAssets(x => x.map(y => (y.id === a.id ? { ...y, tags } : y)))
  }
  async function baixarZip(lista: Asset[]) {
    const baixaveis = lista.filter(a => a.tipo !== 'original')
    if (!baixaveis.length) return
    if (baixaveis.length === 1) { window.open(baixaveis[0].url, '_blank'); return }
    setOcupado(`Juntando ${baixaveis.length} arquivos no ZIP…`)
    try {
      const JSZip = (await import('jszip')).default, zip = new JSZip(), usados = new Set<string>()
      for (let i = 0; i < baixaveis.length; i++) {
        const a = baixaveis[i]
        setOcupado(`Juntando no ZIP… ${i + 1}/${baixaveis.length}`)
        const blob = await fetch(a.url).then(r => { if (!r.ok) throw new Error(a.nome); return r.blob() })
        let nome = `${a.pasta ? a.pasta + '/' : ''}${a.nome}`
        for (let k = 2; usados.has(nome); k++) nome = nome.replace(/(\.[^.]+)?$/, `-${k}$1`)
        usados.add(nome); zip.file(nome, blob)
      }
      baixar(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${nomeDe(atual) || 'meus-arquivos'}.zip`)
    } catch (e) { setErro('Não consegui montar o ZIP: ' + (e as Error).message) } finally { setOcupado('') }
  }
  async function mandarProDrive(lista: Asset[]) {
    setErro('')
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i]
      setOcupado(`Enviando ao seu Google Drive… ${i + 1}/${lista.length}`)
      try { const blob = await fetch(a.url).then(r => { if (!r.ok) throw new Error('não consegui baixar o arquivo'); return r.blob() }); await enviarProDrive(blob, a.nome) }
      catch (e) { setErro(`Envio ao Drive falhou (${a.nome}): ${(e as Error).message}`); break }
    }
    setOcupado(''); setAviso(`${lista.length} arquivo(s) no seu Google Drive (pasta SOA Design). ✅`)
  }
  async function sugerirAcervo(a: Asset) {
    const licenca = prompt('Sugerir esta fonte para o acervo de TODOS os ateliês?\n\nSó entram fontes de licença aberta (ex.: SIL Open Font License), e só depois de aprovação da equipe SOA.\n\nQual é a licença da fonte?', 'SIL Open Font License')
    if (!licenca?.trim()) return
    const r = await fetch(`/api/estudio/fontes/${a.id}/sugerir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenca }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErro(j.error || 'Não consegui sugerir.'); return }
    setAssets(x => x.map(y => (y.id === a.id ? { ...y, sugeridaGlobal: true } : y)))
    setAviso('Sugestão enviada — a fonte continua só sua até a equipe SOA aprovar.')
  }
  async function desconectarDrive() {
    if (!confirm('Desconectar seu Google Drive? Os arquivos que já estão lá continuam lá.')) return
    await fetch('/api/estudio/drive', { method: 'DELETE' })
    setDrive(d => d && { ...d, conectado: false, email: null })
  }

  // ── arrastar arquivos (da grade) para uma pasta ──
  const arrastarArquivo = (e: React.DragEvent, a: Asset) => {
    const ids = sel.has(a.id) ? [...sel] : [a.id]
    e.dataTransfer.setData(ARRASTO, JSON.stringify(ids)); e.dataTransfer.effectAllowed = 'move'
  }
  const soltarNaPasta = (e: React.DragEvent, c: string) => {
    e.preventDefault(); e.stopPropagation(); setAlvoArrasto(null)
    const dado = e.dataTransfer.getData(ARRASTO)
    if (dado) { void moverArquivos(JSON.parse(dado) as string[], c); return }
    if (e.dataTransfer.files.length) { setAtual(c); void (async () => { await new Promise(r => setTimeout(r, 0)); enviar(e.dataTransfer.files) })() }
  }
  const alvo = (c: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setAlvoArrasto(c) },
    onDragLeave: () => setAlvoArrasto(x => (x === c ? null : x)),
    onDrop: (e: React.DragEvent) => soltarNaPasta(e, c),
  })

  const Icone = ({ t }: { t: Asset['tipo'] }) => t === 'fonte' ? <Type className="w-5 h-5" /> : t === 'gerado' ? <Package className="w-5 h-5" /> : t === 'mockup' ? <ImagePlus className="w-5 h-5" /> : t === 'original' ? <HardDrive className="w-5 h-5" /> : <FileText className="w-5 h-5" />
  const ehImagem = (a: Asset) => a.tipo !== 'original' && (a.mime || '').startsWith('image/')

  function Arvore({ c, nivel }: { c: string; nivel: number }) {
    const fs = filhas(c), aberta = abertas.has(c)
    return (
      <>
        {fs.map(p => {
          const tem = filhas(p).length > 0, ab = abertas.has(p)
          return (
            <div key={p}>
              <div {...alvo(p)} className={`flex items-center gap-1 rounded-lg pr-1 text-sm cursor-pointer ${atual === p ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${alvoArrasto === p ? 'ring-2 ring-orange-400' : ''}`} style={{ paddingLeft: 4 + nivel * 14 }} data-pasta={p}>
                <button onClick={() => setAbertas(s => { const n = new Set(s); if (ab) n.delete(p); else n.add(p); return n })} className={`w-4 text-gray-400 ${tem ? '' : 'invisible'}`}>{ab ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</button>
                <span onClick={() => abrir(p)} className="flex items-center gap-1.5 flex-1 min-w-0 py-1">
                  {atual === p ? <FolderOpen className="w-4 h-4 shrink-0 text-orange-500" /> : <Folder className="w-4 h-4 shrink-0 text-gray-400" />}
                  <span className="truncate">{nomeDe(p)}</span>
                  <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{qtdEm(p) || ''}</span>
                </span>
              </div>
              {ab && <Arvore c={p} nivel={nivel + 1} />}
            </div>
          )
        })}
        {!fs.length && nivel === 0 && !aberta && null}
      </>
    )
  }

  const ordemAtual = ancestrais(atual || '').filter(Boolean)
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Design</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meus arquivos</h1>
          <p className="text-sm text-gray-500">Moldes, fontes, artes geradas, mockups — em pastas, como no seu Drive. Arraste arquivos para uma pasta para mover.</p>
        </div>
        {drive?.configurado && (drive.conectado ? (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-1.5">
            <HardDrive className="w-4 h-4 text-sky-600" /> Drive: <b>{drive.email || 'conectado'}</b>
            <button onClick={desconectarDrive} className="text-gray-400 hover:text-red-600">desconectar</button>
          </div>
        ) : (
          <a href="/api/estudio/drive/conectar" className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-3 py-1.5"><HardDrive className="w-4 h-4" /> Conectar meu Google Drive</a>
        ))}
      </div>

      {storage === false && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> O armazenamento de arquivos ainda não está configurado — por enquanto não dá para guardar arquivos aqui.
        </div>
      )}
      {aviso && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2 flex justify-between gap-2"><span>{aviso}</span><button onClick={() => setAviso('')}><X className="w-4 h-4" /></button></div>}
      {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex justify-between gap-2"><span>{erro}</span><button onClick={() => setErro('')}><X className="w-4 h-4" /></button></div>}

      <div className="grid gap-4 md:grid-cols-[230px_1fr]">
        {/* árvore de pastas */}
        <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 space-y-1 h-fit md:sticky md:top-4">
          <div {...alvo('')} onClick={() => abrir('')} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${atual === '' && !buscando ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} ${alvoArrasto === '' ? 'ring-2 ring-orange-400' : ''}`} data-pasta="">
            <HardDrive className="w-4 h-4 text-orange-500" /> Meus arquivos <span className="ml-auto text-[10px] text-gray-400">{assets.length}</span>
          </div>
          <Arvore c="" nivel={0} />
          <button onClick={novaPasta} className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"><FolderPlus className="w-4 h-4" /> Nova pasta</button>
        </aside>

        <section className="space-y-3 min-w-0">
          {/* caminho + ações */}
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 flex-wrap" aria-label="Caminho">
              <button onClick={() => abrir('')} className="text-gray-600 dark:text-gray-300 hover:text-orange-600">Meus arquivos</button>
              {buscando ? <><ChevronRight className="w-3.5 h-3.5 text-gray-300" /><span className="text-gray-500">Busca: “{busca}”</span></>
                : ordemAtual.map(c => <span key={c} className="inline-flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5 text-gray-300" /><button {...alvo(c)} onClick={() => abrir(c)} className={c === atual ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-orange-600'}>{nomeDe(c)}</button></span>)}
              {atual && !buscando && <span className="inline-flex gap-1 ml-1">
                <button onClick={() => renomearPasta(atual)} className="text-gray-400 hover:text-orange-600" title="Renomear pasta"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => setMoverPara(['__pasta__', atual])} className="text-gray-400 hover:text-orange-600" title="Mover pasta"><FolderInput className="w-3.5 h-3.5" /></button>
                <button onClick={() => apagarPasta(atual)} className="text-gray-400 hover:text-red-600" title="Apagar pasta"><Trash2 className="w-3.5 h-3.5" /></button>
              </span>}
            </nav>
            <button onClick={novaPasta} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs hover:border-orange-400"><FolderPlus className="w-3.5 h-3.5" /> Nova pasta</button>
            {storage && <label className="inline-flex items-center gap-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 text-xs font-semibold cursor-pointer"><Upload className="w-3.5 h-3.5" /> Enviar arquivos
              <input type="file" multiple className="hidden" accept=".png,.jpg,.jpeg,.svg,.webp,.pdf,.psd,.psb,.ttf,.otf,.woff,.woff2" onChange={e => { if (e.target.files?.length) enviar(e.target.files); e.target.value = '' }} /></label>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input value={busca} onChange={e => { setBusca(e.target.value); setSel(new Set()) }} placeholder="Buscar em todas as pastas (nome, etiqueta, pasta)" className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg pl-7 pr-2 py-1.5 bg-white dark:bg-gray-800" />
            </div>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800">
              <option value="">Todos os tipos</option>{['molde', 'imagem', 'fonte', 'gerado', 'mockup', 'original'].map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
            <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800" title="Ordenar">
              <option value="recente">Mais recentes</option><option value="nome">Nome</option><option value="tipo">Tipo</option><option value="tamanho">Tamanho</option>
            </select>
          </div>

          {/* barra de seleção (ações em lote) */}
          {!!sel.size && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-900 text-white px-3 py-2 text-xs" data-barra-selecao>
              <b>{sel.size} selecionado(s)</b>
              <button onClick={() => baixarZip(selecionados)} className="inline-flex items-center gap-1 rounded-lg border border-white/30 px-2 py-1"><Download className="w-3.5 h-3.5" /> Baixar {sel.size > 1 ? 'ZIP' : ''}</button>
              <button onClick={() => setMoverPara([...sel])} className="inline-flex items-center gap-1 rounded-lg border border-white/30 px-2 py-1"><FolderInput className="w-3.5 h-3.5" /> Mover para…</button>
              <button disabled={!selecionados.some(ehImagem)} onClick={() => setLote(selecionados.filter(ehImagem).map(a => ({ nome: a.nome, url: a.url })))} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2 py-1 font-semibold disabled:opacity-40" title="Tamanhos de marketplace, marca d’água, recorte, ajustes"><SlidersHorizontal className="w-3.5 h-3.5" /> Ações em lote</button>
              {drive?.conectado && <button onClick={() => mandarProDrive(selecionados.filter(a => a.tipo !== 'original'))} className="inline-flex items-center gap-1 rounded-lg border border-white/30 px-2 py-1"><HardDrive className="w-3.5 h-3.5" /> Pro meu Drive</button>}
              <button onClick={() => excluirVarios([...sel])} className="inline-flex items-center gap-1 rounded-lg border border-red-300/60 text-red-200 px-2 py-1"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
              <button onClick={() => setSel(new Set())} className="ml-auto text-white/70 hover:text-white">limpar</button>
            </div>
          )}

          {/* área: soltar arquivos do computador envia para a pasta aberta */}
          <div
            onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastando(true) } }} onDragLeave={() => setArrastando(false)}
            onDrop={e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setArrastando(false); enviar(e.dataTransfer.files) }}
            className={`rounded-2xl min-h-[240px] p-2 transition ${arrastando ? 'ring-2 ring-orange-400 bg-orange-50/60 dark:bg-orange-950/20' : ''}`}>
            {!!fila.length && (() => {
              const total = fila.reduce((n, f) => n + f.mb, 0), feito = fila.reduce((n, f) => n + f.mb * (f.etapa === 'pronto' ? 1 : f.etapa === 'enviando' ? f.pct / 100 : 0), 0)
              return (
                <div className="mb-3 rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/20 p-3 space-y-1.5" data-fila-envio>
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-800 dark:text-orange-200">
                    {fila.some(f => f.etapa !== 'pronto' && f.etapa !== 'erro') && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Enviando {fila.filter(f => f.etapa === 'pronto').length}/{fila.length} · {Math.round((feito / Math.max(0.001, total)) * 100)}%
                    <button onClick={() => setFila([])} className="ml-auto text-gray-400 font-normal">fechar</button>
                  </div>
                  <div className="h-1.5 rounded-full bg-orange-100 dark:bg-orange-900/40 overflow-hidden"><div className="h-full bg-orange-500 transition-[width]" style={{ width: `${Math.round((feito / Math.max(0.001, total)) * 100)}%` }} /></div>
                  {fila.map(f => (
                    <div key={f.id} className="grid grid-cols-[1fr_auto] gap-x-2 items-center text-[11px]" data-envio={f.nome}>
                      <span className="truncate text-gray-700 dark:text-gray-200">{f.nome} <span className="text-gray-400">· {f.mb.toFixed(1)} MB</span></span>
                      <span className={f.etapa === 'erro' ? 'text-red-600' : f.etapa === 'pronto' ? 'text-emerald-600' : 'text-gray-500'}>{f.etapa === 'enviando' ? `enviando ${Math.round(f.pct)}%` : f.etapa === 'erro' ? 'erro' : f.etapa}</span>
                      {f.etapa === 'erro' ? <span className="col-span-2 text-[10px] text-red-600">{f.erro}</span>
                        : <div className="col-span-2 h-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden"><div className={`h-full ${f.etapa === 'pronto' ? 'bg-emerald-500' : 'bg-orange-400'} transition-[width]`} style={{ width: `${f.etapa === 'pronto' ? 100 : f.etapa === 'enviando' ? f.pct : f.etapa === 'otimizando' ? 8 : 2}%` }} /></div>}
                    </div>
                  ))}
                </div>
              )
            })()}
            {carregando ? <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p> : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {subpastas.map(p => (
                  <div key={p} {...alvo(p)} onDoubleClick={() => abrir(p)} onClick={() => abrir(p)} data-pasta-card={p}
                    className={`rounded-xl border bg-white dark:bg-gray-900 p-3 flex items-center gap-2 cursor-pointer hover:border-orange-400 ${alvoArrasto === p ? 'border-orange-400 ring-2 ring-orange-300' : 'border-gray-200 dark:border-gray-800'}`}>
                    <Folder className="w-6 h-6 text-orange-400 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{nomeDe(p)}</p><p className="text-[11px] text-gray-400">{qtdEm(p)} arquivo(s)</p></div>
                  </div>
                ))}
                {visiveis.map(a => {
                  const marcado = sel.has(a.id)
                  return (
                    <div key={a.id} draggable onDragStart={e => arrastarArquivo(e, a)} data-arquivo={a.nome}
                      className={`group rounded-xl border bg-white dark:bg-gray-900 overflow-hidden flex flex-col ${marcado ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-200 dark:border-gray-800'}`}>
                      <div className="relative aspect-[4/3] bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400" onClick={() => setSel(s => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n })}>
                        {ehImagem(a) ? <img src={a.url} alt={a.nome} className="w-full h-full object-contain" loading="lazy" draggable={false} /> : <Icone t={a.tipo} />}
                        <input type="checkbox" checked={marcado} readOnly className={`absolute top-1.5 left-1.5 accent-orange-500 w-4 h-4 ${marcado ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label={`Selecionar ${a.nome}`} />
                      </div>
                      <div className="p-2 space-y-0.5 flex-1 flex flex-col">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate" title={a.nome}>{a.nome}</p>
                        <p className="text-[10px] text-gray-400">{TIPO_LABEL[a.tipo]} · {kb(Number(a.tamanhoBytes) || 0)}{a.pedidoId ? ' · 🔗 pedido' : ''}</p>
                        {buscando && a.pasta && <button onClick={() => abrir(a.pasta)} className="text-[10px] text-gray-500 inline-flex items-center gap-1 hover:text-orange-600"><Folder className="w-3 h-3" /> {a.pasta}</button>}
                        {a.tipo === 'fonte' && (a.aprovadaGlobal
                          ? <p className="text-[10px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> no acervo SOA</p>
                          : a.sugeridaGlobal ? <p className="text-[10px] text-amber-700 dark:text-amber-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> sugerida — aguardando aprovação</p>
                          : <p className="text-[10px] text-gray-400">privada (só seu ateliê)</p>)}
                        {!!a.tags.length && <div className="flex flex-wrap gap-1">{a.tags.map(t => <span key={t} className="text-[10px] bg-gray-100 dark:bg-gray-800 rounded px-1.5">{t}</span>)}</div>}
                        <div className="flex items-center gap-2 pt-1 mt-auto text-gray-500">
                          <a href={a.url} target="_blank" rel="noopener noreferrer" download className="hover:text-orange-600" title={a.tipo === 'original' ? 'Abrir no Google Drive' : 'Baixar'}><Download className="w-3.5 h-3.5" /></a>
                          <button onClick={() => renomearArquivo(a)} className="hover:text-orange-600" title="Renomear"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setMoverPara([a.id])} className="hover:text-orange-600" title="Mover para…"><FolderInput className="w-3.5 h-3.5" /></button>
                          <button onClick={() => etiquetas(a)} className="hover:text-orange-600" title="Etiquetas"><Tag className="w-3.5 h-3.5" /></button>
                          {a.tipo === 'fonte' && !a.sugeridaGlobal && !a.aprovadaGlobal && <button onClick={() => sugerirAcervo(a)} className="hover:text-orange-600" title="Sugerir para o acervo SOA"><Share2 className="w-3.5 h-3.5" /></button>}
                          <button onClick={() => excluirVarios([a.id])} className="hover:text-red-600 ml-auto" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!subpastas.length && !visiveis.length && (
                  <p className="col-span-full text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
                    {buscando ? 'Nada encontrado.' : storage ? 'Pasta vazia — arraste arquivos do computador para cá, ou use “Enviar arquivos”.' : 'Nada por aqui ainda.'}
                  </p>
                )}
              </div>
            )}
          </div>
          {drive?.conectado && storage && (
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={originaisNoDrive} onChange={e => setOriginaisNoDrive(e.target.checked)} className="accent-orange-500" />
              Guardar o ORIGINAL dos moldes pesados no meu Google Drive (aqui fica só a cópia leve)
            </label>
          )}
          {!!visiveis.length && <button onClick={() => setSel(new Set(visiveis.map(a => a.id)))} className="text-xs text-gray-500 hover:text-orange-600">Selecionar todos desta {buscando ? 'busca' : 'pasta'} ({visiveis.length})</button>}
        </section>
      </div>

      {/* mover para… (arquivos ou uma pasta) */}
      {moverPara && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setMoverPara(null)}>
          <div className="w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-2" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-sm">{moverPara[0] === '__pasta__' ? `Mover a pasta “${nomeDe(moverPara[1])}” para…` : `Mover ${moverPara.length} arquivo(s) para…`}</p>
            {['', ...pastas].filter(p => moverPara[0] !== '__pasta__' || !dentroDe(p, moverPara[1])).map(p => (
              <button key={p || 'raiz'} data-destino={p} onClick={async () => {
                const m = moverPara; setMoverPara(null)
                if (m[0] === '__pasta__') { const para = p ? `${p}/${nomeDe(m[1])}` : nomeDe(m[1]); if (para !== m[1] && await moverPasta(m[1], para)) setAviso(`Pasta movida para “${p || 'Meus arquivos'}”.`) }
                else await moverArquivos(m, p)
              }} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-orange-50 dark:hover:bg-orange-950/30 text-left" style={{ paddingLeft: 8 + (p ? p.split('/').length : 0) * 14 }}>
                {p ? <Folder className="w-4 h-4 text-gray-400" /> : <HardDrive className="w-4 h-4 text-orange-500" />} {p ? nomeDe(p) : 'Meus arquivos (raiz)'}
              </button>
            ))}
            <button onClick={() => setMoverPara(null)} className="text-xs text-gray-400">cancelar</button>
          </div>
        </div>
      )}
      {/* ações em lote nos selecionados */}
      {lote && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setLote(null)}>
          <div className="w-full max-w-6xl rounded-2xl bg-white dark:bg-gray-950 p-4 space-y-2 my-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="font-semibold">Ações em lote — {lote.length} imagem(ns)</p><button onClick={() => setLote(null)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <AcoesLote iniciais={lote} embutido />
          </div>
        </div>
      )}
      {ocupado && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg flex items-center gap-2" role="status"><Loader2 className="w-4 h-4 animate-spin" /> {ocupado}</div>}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={null}><Arquivos /></Suspense>
}
