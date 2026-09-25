'use client'
// SOA Edition — Meus arquivos: moldes, fontes e artes geradas, em pastas e com etiquetas.
// Upload por arrastar (vários de uma vez) direto do navegador para o Vercel Blob.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Upload, Download, Trash2, Loader2, Folder, AlertTriangle, FileText, Type, ImagePlus, Package, Pencil } from 'lucide-react'
import { enviarArquivo } from '@/lib/estudio/cliente'

interface Asset {
  id: string; tipo: 'molde' | 'fonte' | 'gerado' | 'mockup'; nome: string; url: string; mime: string | null
  tamanhoBytes: number; pasta: string; tags: string[]; pedidoId: string | null; createdAt: string
}

const TIPO_LABEL: Record<string, string> = { molde: 'Moldes', fonte: 'Fontes', gerado: 'Artes geradas', mockup: 'Mockups' }
const kb = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

function tipoDoArquivo(f: File): Asset['tipo'] {
  if (/\.(ttf|otf)$/i.test(f.name) || f.type.startsWith('font/')) return 'fonte'
  return 'molde'
}

export default function Arquivos() {
  const { data: session } = useSession()
  const workspaceId = (session?.user as any)?.workspaceId as string | undefined
  const [storage, setStorage] = useState<boolean | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tipo, setTipo] = useState<string>('')
  const [pasta, setPasta] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [enviando, setEnviando] = useState<{ feitos: number; total: number } | null>(null)
  const [erro, setErro] = useState('')
  const [arrastando, setArrastando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const d = await fetch('/api/estudio/assets').then(r => r.json())
      setAssets((d.assets || []).map((a: any) => ({ ...a, tags: Array.isArray(a.tags) ? a.tags : [] })))
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => {
    fetch('/api/estudio/status').then(r => r.json()).then(d => setStorage(!!d.storage)).catch(() => setStorage(false))
    carregar()
  }, [carregar])

  const pastas = useMemo(() => [...new Set(assets.map(a => a.pasta).filter(Boolean))].sort(), [assets])
  const visiveis = assets.filter(a =>
    (!tipo || a.tipo === tipo) && (!pasta || a.pasta === pasta) &&
    (!busca || a.nome.toLowerCase().includes(busca.toLowerCase()) || a.tags.some(t => t.toLowerCase().includes(busca.toLowerCase()))))

  async function enviar(files: FileList | File[]) {
    if (!workspaceId || !storage) return
    const lista = [...files]
    setErro(''); setEnviando({ feitos: 0, total: lista.length })
    const falhas: string[] = []
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i]
      try { await enviarArquivo(f, f.name, tipoDoArquivo(f), workspaceId, { pasta: pasta || (tipoDoArquivo(f) === 'fonte' ? 'Fontes' : 'Moldes') }) }
      catch (e) { falhas.push(`${f.name}: ${(e as Error).message}`) }
      setEnviando({ feitos: i + 1, total: lista.length })
    }
    setEnviando(null)
    if (falhas.length) setErro(`Não consegui enviar ${falhas.length} arquivo(s). ${falhas.slice(0, 2).join(' · ')}`)
    carregar()
  }

  async function excluir(a: Asset) {
    if (!confirm(`Excluir "${a.nome}"? Não dá para desfazer.`)) return
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

  const Icone = ({ t }: { t: Asset['tipo'] }) => t === 'fonte' ? <Type className="w-5 h-5" /> : t === 'gerado' ? <Package className="w-5 h-5" /> : t === 'mockup' ? <ImagePlus className="w-5 h-5" /> : <FileText className="w-5 h-5" />
  const ehImagem = (a: Asset) => (a.mime || '').startsWith('image/')

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meus arquivos</h1>
        <p className="text-sm text-gray-500">Moldes, fontes e artes geradas — organizados em pastas.</p>
      </div>

      {storage === false && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> O armazenamento de arquivos ainda não está configurado — por enquanto não dá para guardar arquivos aqui.
        </div>
      )}
      {erro && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{erro}</div>}

      {storage && (
        <label
          onDragOver={e => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
          onDrop={e => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) enviar(e.dataTransfer.files) }}
          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-6 text-sm cursor-pointer transition ${arrastando ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-300 dark:border-gray-700 hover:border-orange-400'}`}>
          {enviando
            ? <><Loader2 className="w-6 h-6 animate-spin text-orange-500" /><span>Enviando {enviando.feitos} de {enviando.total}…</span></>
            : <><Upload className="w-6 h-6 text-orange-500" /><span className="font-medium text-gray-700 dark:text-gray-200">Arraste arquivos aqui ou clique para escolher</span>
              <span className="text-xs text-gray-500">Moldes (PNG, JPG, SVG, PDF) e fontes (TTF, OTF){pasta ? ` → pasta "${pasta}"` : ''}</span></>}
          <input type="file" multiple className="hidden" accept=".png,.jpg,.jpeg,.svg,.pdf,.ttf,.otf" onChange={e => { if (e.target.files?.length) enviar(e.target.files); e.target.value = '' }} />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['', 'molde', 'fonte', 'gerado'] as const).map(t => (
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
                {!!a.tags.length && <div className="flex flex-wrap gap-1">{a.tags.map(t => <span key={t} className="text-[10px] bg-gray-100 dark:bg-gray-800 rounded px-1.5">{t}</span>)}</div>}
                <div className="flex items-center gap-2 pt-1 mt-auto">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" download className="text-gray-500 hover:text-orange-600" title="Baixar"><Download className="w-4 h-4" /></a>
                  <button onClick={() => editar(a)} className="text-gray-500 hover:text-orange-600" title="Pasta e etiquetas"><Pencil className="w-4 h-4" /></button>
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
