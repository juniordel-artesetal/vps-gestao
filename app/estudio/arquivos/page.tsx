'use client'
// SOA Edition — Meus arquivos: moldes, fontes e artes geradas, em pastas e com etiquetas.
// Upload por arrastar (vários de uma vez) direto do navegador para o Vercel Blob. Molde pesado
// (PDF do Photoshop) sobe como CÓPIA LEVE (~300 dpi); o original pode ir para o Google Drive DELA.
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Upload, Download, Trash2, Loader2, Folder, AlertTriangle, FileText, Type, ImagePlus, Package, Pencil,
  HardDrive, Share2, CheckCircle2, Clock,
} from 'lucide-react'
import { enviarArquivo, prepararMolde, enviarProDrive } from '@/lib/estudio/cliente'

interface Asset {
  id: string; tipo: 'molde' | 'fonte' | 'gerado' | 'mockup' | 'original'; nome: string; url: string; mime: string | null
  tamanhoBytes: number; pasta: string; tags: string[]; pedidoId: string | null; createdAt: string
  sugeridaGlobal?: boolean; aprovadaGlobal?: boolean
}
interface Drive { configurado: boolean; conectado: boolean; email: string | null }

const TIPO_LABEL: Record<string, string> = { molde: 'Moldes', fonte: 'Fontes', gerado: 'Artes geradas', mockup: 'Mockups', original: 'Originais (Drive)' }
const kb = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
const MSG_DRIVE: Record<string, string> = {
  ok: 'Google Drive conectado ✅', recusado: 'Você não autorizou o acesso ao Drive.', state: 'A conexão expirou — tente de novo.',
  erro: 'O Google não confirmou a conexão — tente de novo.', indisponivel: 'A conexão com o Google Drive ainda não está disponível.', sessao: 'Entre de novo e tente conectar.',
}

function tipoDoArquivo(f: File): Asset['tipo'] {
  if (/\.(ttf|otf)$/i.test(f.name) || f.type.startsWith('font/')) return 'fonte'
  return 'molde'
}

function Arquivos() {
  const { data: session } = useSession()
  const workspaceId = (session?.user as any)?.workspaceId as string | undefined
  const q = useSearchParams()
  const [storage, setStorage] = useState<boolean | null>(null)
  const [drive, setDrive] = useState<Drive | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tipo, setTipo] = useState<string>('')
  const [pasta, setPasta] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [enviando, setEnviando] = useState<{ feitos: number; total: number; etapa: string } | null>(null)
  const [originaisNoDrive, setOriginaisNoDrive] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(MSG_DRIVE[q.get('drive') || ''] || '')
  const [arrastando, setArrastando] = useState(false)
  const [driveBusy, setDriveBusy] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const d = await fetch('/api/estudio/assets').then(r => r.json())
      setAssets((d.assets || []).map((a: any) => ({ ...a, tags: Array.isArray(a.tags) ? a.tags : [] })))
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => {
    fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => setStorage(false))
    fetch('/api/estudio/drive').then(r => r.json()).then(setDrive).catch(() => {})
    carregar()
  }, [carregar])

  const pastas = useMemo(() => [...new Set(assets.map(a => a.pasta).filter(Boolean))].sort(), [assets])
  const visiveis = assets.filter(a =>
    (!tipo || a.tipo === tipo) && (!pasta || a.pasta === pasta) &&
    (!busca || a.nome.toLowerCase().includes(busca.toLowerCase()) || a.tags.some(t => t.toLowerCase().includes(busca.toLowerCase()))))

  async function enviar(files: FileList | File[]) {
    if (!workspaceId || !storage) return
    const lista = [...files]
    if (lista.some(f => tipoDoArquivo(f) === 'fonte') &&
      !confirm('Use apenas fontes que você tem licença para usar.\n\nAs fontes que você sobe ficam só no seu ateliê — não são compartilhadas com ninguém.')) return
    setErro(''); setAviso('')
    const falhas: string[] = []
    let comprimidos = 0, noDrive = 0
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i]
      const t = tipoDoArquivo(f)
      try {
        if (t === 'fonte') {
          setEnviando({ feitos: i, total: lista.length, etapa: f.name })
          if (f.size > 10 * 1024 * 1024) throw new Error('fonte acima de 10 MB')
          const familia = `SOA_${Math.random().toString(36).slice(2, 8)}`
          await enviarArquivo(f, f.name, 'fonte', workspaceId, { pasta: pasta || 'Fontes', meta: { familia } })
        } else {
          setEnviando({ feitos: i, total: lista.length, etapa: `preparando ${f.name}` })
          const prep = await prepararMolde(f)
          setEnviando({ feitos: i, total: lista.length, etapa: `enviando ${f.name}` })
          const m = prep.molde
          const up = await enviarArquivo(prep.copia, prep.nomeCopia, 'molde', workspaceId, {
            pasta: pasta || 'Moldes',
            meta: { largura: m.largura, altura: m.altura, pagina: m.pagina, dpi: prep.dpi, ...(prep.comprimido ? { original: { nome: f.name, tamanhoBytes: f.size } } : {}) },
          })
          if (prep.comprimido) {
            comprimidos++
            if (originaisNoDrive && drive?.conectado) {
              setEnviando({ feitos: i, total: lista.length, etapa: `original de ${f.name} → seu Drive` })
              await enviarProDrive(f, f.name, { registrar: true, pasta: 'Originais (Drive)', copiaAssetId: up.id })
              noDrive++
            }
          }
        }
      } catch (e) { falhas.push(`${f.name}: ${(e as Error).message}`) }
    }
    setEnviando(null)
    if (comprimidos) setAviso(`${comprimidos} molde(s) pesado(s) guardado(s) como cópia leve (~300 dpi)${noDrive ? `; ${noDrive} original(is) no seu Google Drive` : ''}.`)
    if (falhas.length) setErro(`Não consegui enviar ${falhas.length} arquivo(s). ${falhas.slice(0, 2).join(' · ')}`)
    carregar()
  }

  async function excluir(a: Asset) {
    const msg = a.tipo === 'original' ? `Tirar "${a.nome}" da lista? O arquivo continua no seu Google Drive.` : `Excluir "${a.nome}"? Não dá para desfazer.`
    if (!confirm(msg)) return
    await fetch(`/api/estudio/assets/${a.id}`, { method: 'DELETE' })
    setAssets(x => x.filter(y => y.id !== a.id))
  }

  async function editar(a: Asset) {
    const novaPasta = prompt('Pasta:', a.pasta)
    if (novaPasta === null) return
    const novasTags = prompt('Etiquetas (separadas por vírgula):', a.tags.join(', '))
    if (novasTags === null) return
    const tags = novasTags.split(',').map(s => s.trim()).filter(Boolean)
    await fetch(`/api/estudio/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pasta: novaPasta.trim(), tags }) })
    setAssets(x => x.map(y => y.id === a.id ? { ...y, pasta: novaPasta.trim(), tags } : y))
  }

  async function mandarProDrive(a: Asset) {
    setDriveBusy(a.id); setErro('')
    try {
      const blob = await fetch(a.url).then(r => { if (!r.ok) throw new Error('não consegui baixar o arquivo'); return r.blob() })
      await enviarProDrive(blob, a.nome)
      setAviso(`“${a.nome}” enviado ao seu Google Drive (pasta SOA Edition). ✅`)
    } catch (e) { setErro('Envio ao Drive falhou: ' + (e as Error).message) } finally { setDriveBusy(null) }
  }

  async function sugerirAcervo(a: Asset) {
    const licenca = prompt(
      'Sugerir esta fonte para o acervo de TODOS os ateliês?\n\nSó entram fontes de licença aberta (ex.: SIL Open Font License), e só depois de aprovação da equipe SOA.\n\nQual é a licença da fonte?',
      'SIL Open Font License')
    if (!licenca?.trim()) return
    const r = await fetch(`/api/estudio/fontes/${a.id}/sugerir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenca }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErro(j.error || 'Não consegui sugerir.'); return }
    setAssets(x => x.map(y => y.id === a.id ? { ...y, sugeridaGlobal: true } : y))
    setAviso('Sugestão enviada — a fonte continua só sua até a equipe SOA aprovar.')
  }

  async function desconectarDrive() {
    if (!confirm('Desconectar seu Google Drive? Os arquivos que já estão lá continuam lá.')) return
    await fetch('/api/estudio/drive', { method: 'DELETE' })
    setDrive(d => d && { ...d, conectado: false, email: null })
  }

  const Icone = ({ t }: { t: Asset['tipo'] }) => t === 'fonte' ? <Type className="w-5 h-5" /> : t === 'gerado' ? <Package className="w-5 h-5" /> : t === 'mockup' ? <ImagePlus className="w-5 h-5" /> : t === 'original' ? <HardDrive className="w-5 h-5" /> : <FileText className="w-5 h-5" />
  const ehImagem = (a: Asset) => a.tipo !== 'original' && (a.mime || '').startsWith('image/')

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meus arquivos</h1>
          <p className="text-sm text-gray-500">Moldes, fontes e artes geradas — organizados em pastas.</p>
        </div>
        {drive?.configurado && (
          drive.conectado ? (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-1.5">
              <HardDrive className="w-4 h-4 text-sky-600" /> Drive: <b>{drive.email || 'conectado'}</b>
              <button onClick={desconectarDrive} className="text-gray-400 hover:text-red-600">desconectar</button>
            </div>
          ) : (
            <a href="/api/estudio/drive/conectar" className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-3 py-1.5">
              <HardDrive className="w-4 h-4" /> Conectar meu Google Drive
            </a>
          )
        )}
      </div>

      {storage === false && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> O armazenamento de arquivos ainda não está configurado — por enquanto não dá para guardar arquivos aqui.
        </div>
      )}
      {aviso && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2">{aviso}</div>}
      {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{erro}</div>}

      {storage && (
        <>
          <label
            onDragOver={e => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
            onDrop={e => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) enviar(e.dataTransfer.files) }}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-6 text-sm cursor-pointer transition ${arrastando ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-300 dark:border-gray-700 hover:border-orange-400'}`}>
            {enviando
              ? <><Loader2 className="w-6 h-6 animate-spin text-orange-500" /><span>{enviando.feitos + 1} de {enviando.total} · {enviando.etapa}…</span></>
              : <><Upload className="w-6 h-6 text-orange-500" /><span className="font-medium text-gray-700 dark:text-gray-200">Arraste arquivos aqui ou clique para escolher</span>
                <span className="text-xs text-gray-500 text-center">Moldes (PNG, JPG, SVG, PDF — os pesados viram cópia leve a ~300 dpi) e fontes (TTF, OTF){pasta ? ` → pasta "${pasta}"` : ''}</span></>}
            <input type="file" multiple className="hidden" accept=".png,.jpg,.jpeg,.svg,.webp,.pdf,.ttf,.otf" onChange={e => { if (e.target.files?.length) enviar(e.target.files); e.target.value = '' }} />
          </label>
          {drive?.conectado && (
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={originaisNoDrive} onChange={e => setOriginaisNoDrive(e.target.checked)} className="accent-orange-500" />
              Guardar o ORIGINAL dos moldes pesados no meu Google Drive (aqui fica só a cópia leve)
            </label>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['', 'molde', 'fonte', 'gerado', 'original'] as const).map(t => (
          <button key={t || 'todos'} onClick={() => setTipo(t)} className={`text-xs rounded-full px-3 py-1 border ${tipo === t ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
            {t ? TIPO_LABEL[t] : 'Todos'}
          </button>
        ))}
        {!!pastas.length && (
          <select value={pasta} onChange={e => setPasta(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800">
            <option value="">Todas as pastas</option>
            {pastas.map(p => <option key={p} value={p}>📁 {p}</option>)}
          </select>
        )}
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou etiqueta" className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1 bg-white dark:bg-gray-800 flex-1 min-w-[160px]" />
      </div>

      {carregando ? (
        <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
      ) : !visiveis.length ? (
        <p className="text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">Nada por aqui ainda.</p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {visiveis.map(a => (
            <div key={a.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                {ehImagem(a) ? <img src={a.url} alt={a.nome} className="w-full h-full object-contain" loading="lazy" /> : <Icone t={a.tipo} />}
              </div>
              <div className="p-2.5 space-y-1 flex-1 flex flex-col">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate" title={a.nome}>{a.nome}</p>
                <p className="text-[11px] text-gray-400">{TIPO_LABEL[a.tipo]} · {kb(Number(a.tamanhoBytes) || 0)}{a.pedidoId ? ' · 🔗 pedido' : ''}</p>
                {a.pasta && <p className="text-[11px] text-gray-500 inline-flex items-center gap-1"><Folder className="w-3 h-3" /> {a.pasta}</p>}
                {a.tipo === 'fonte' && (a.aprovadaGlobal
                  ? <p className="text-[10px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> no acervo SOA</p>
                  : a.sugeridaGlobal ? <p className="text-[10px] text-amber-700 dark:text-amber-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> sugerida — aguardando aprovação</p>
                  : <p className="text-[10px] text-gray-400">privada (só seu ateliê)</p>)}
                {!!a.tags.length && <div className="flex flex-wrap gap-1">{a.tags.map(t => <span key={t} className="text-[10px] bg-gray-100 dark:bg-gray-800 rounded px-1.5">{t}</span>)}</div>}
                <div className="flex items-center gap-2 pt-1 mt-auto">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" download className="text-gray-500 hover:text-orange-600" title={a.tipo === 'original' ? 'Abrir no Google Drive' : 'Baixar'}><Download className="w-4 h-4" /></a>
                  <button onClick={() => editar(a)} className="text-gray-500 hover:text-orange-600" title="Pasta e etiquetas"><Pencil className="w-4 h-4" /></button>
                  {drive?.conectado && a.tipo !== 'original' && (
                    <button onClick={() => mandarProDrive(a)} disabled={!!driveBusy} className="text-gray-500 hover:text-sky-600 disabled:opacity-40" title="Enviar para o meu Google Drive">
                      {driveBusy === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                    </button>
                  )}
                  {a.tipo === 'fonte' && !a.sugeridaGlobal && !a.aprovadaGlobal && (
                    <button onClick={() => sugerirAcervo(a)} className="text-gray-500 hover:text-orange-600" title="Sugerir para o acervo SOA"><Share2 className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => excluir(a)} className="text-gray-500 hover:text-red-600 ml-auto" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={null}><Arquivos /></Suspense>
}
