'use client'
'use no memo'
// ABRIR BASE (Lote 3, item 35): a lista das bases salvas — miniatura, nome, nº de moldes, data da última
// edição e quantos temas usam — com Abrir, Duplicar e Excluir (com confirmação). Abrir pergunta antes se a
// base aberta tem alterações (item 30). Excluir só quando nenhum tema usa a base (os temas e os pedidos
// dependem dela); apaga da Biblioteca e da nuvem.
import { useEffect, useRef, useState } from 'react'
import { paraFolha } from '@/lib/mae/editor/giroMolde'
import { X, FolderOpen, Copy, Trash2, Loader2 } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { ler, remover } from '@/lib/mae/biblioteca/arquivos'
import type { DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'
import { listarBases, listarTemas, salvarBase, caminhoBase } from './arquivosMae'
import { sync } from './sincronia'
import { confirmarTroca } from './historicoGlobal'
import { useEditor } from './estado'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
interface Item { path: string; doc: DocTrabalho; quando: number | null; temas: number }

/** Miniatura: as linhas das faces de cada prancheta (sem motor; rápido). */
function Miniatura({ doc }: { doc: DocTrabalho }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const abs = doc.artboards.filter(a => doc.molds.some(m => m.artboardId === a.id))
    const lista = abs.length ? abs : doc.artboards.slice(0, 1)
    const gap = 6, W = lista.reduce((s, a) => s + a.widthMm, 0) + gap * (lista.length - 1), H = Math.max(...lista.map(a => a.heightMm))
    const k = Math.min(120 / W, 80 / H)
    c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k))
    const g = c.getContext('2d')!
    let x0 = 0
    for (const a of lista) {
      g.fillStyle = '#ffffff'; g.fillRect(x0 * k, 0, a.widthMm * k, a.heightMm * k)
      g.strokeStyle = '#cbd5e1'; g.strokeRect(x0 * k + 0.5, 0.5, a.widthMm * k - 1, a.heightMm * k - 1)
      g.strokeStyle = '#ef4444'; g.lineWidth = 1
      for (const m of doc.molds.filter(mm => mm.artboardId === a.id)) for (const f of m.faces) {
        if (f.hole) continue
        g.beginPath()
        ;(f.polygonMm as Pt[]).forEach((p, i) => { const [fx, fy] = paraFolha(m, p); const px = (x0 + fx) * k, py = fy * k; if (i) g.lineTo(px, py); else g.moveTo(px, py) })
        g.closePath(); g.stroke()
      }
      x0 += a.widthMm + gap
    }
  }, [doc])
  return <canvas ref={ref} className="h-20 w-[120px] rounded border border-gray-200 bg-slate-50 object-contain" />
}

export default function AbrirBase() {
  const aberto = useEditor(s => s.pedidoTopo === 'abrir-base')
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const atual = useMaeDoc(s => s.hist.atual.id)
  const [itens, setItens] = useState<Item[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const fechar = () => { useEditor.getState().set({ pedidoTopo: null }); setItens(null); setMsg(null) }

  async function carregar() { if (raiz) setItens(await lerItens(raiz)) }
  async function lerItens(raiz: FileSystemDirectoryHandle): Promise<Item[]> {
    const [bs, ts] = await Promise.all([listarBases(raiz), listarTemas(raiz).catch(() => [])])
    const out: Item[] = []
    for (const b of bs) {
      const quando = b.path === '(nuvem)' ? null : await ler(raiz, b.path).then(f => f.lastModified).catch(() => null)
      out.push({ ...b, quando, temas: new Set(ts.filter(t => t.doc.baseId === b.doc.id).map(t => t.doc.id)).size })
    }
    return out.sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0) || a.doc.name.localeCompare(b.doc.name))
  }
  useEffect(() => { if (aberto && raiz && liberada) void lerItens(raiz).then(setItens) }, [aberto, raiz, liberada])
  if (!aberto) return null

  async function abrir(it: Item) {
    if (!(await confirmarTroca('base'))) return
    useMaeDoc.getState().carregar(it.doc)
    useEditor.getState().set({ modo: 'base', face: null, camada: null, slot: null, prancheta: null })
    fechar()
  }
  async function duplicar(it: Item) {
    if (!raiz) return
    const d: DocTrabalho = { ...JSON.parse(JSON.stringify(it.doc)), id: `base_${Math.random().toString(36).slice(2, 10)}`, version: 1, name: `${it.doc.name} (cópia)`.slice(0, 120) }
    await salvarBase(raiz, d)
    setMsg(`Cópia criada: ${d.name}`); await carregar()
  }
  async function excluir(it: Item) {
    if (!raiz) return
    if (it.temas > 0) { setMsg(`"${it.doc.name}" é usada em ${it.temas} tema(s) — exclua ou troque a base desses temas antes.`); return }
    if (!confirm(`Excluir a base "${it.doc.name}"? Ela sai da Biblioteca e da nuvem.`)) return
    const r = await sync.excluirBase(it.doc.id)
    if (!r.ok) { setMsg(`Não consegui excluir da nuvem: ${r.erro}. Nada foi apagado.`); return }
    if (it.path !== '(nuvem)') await remover(raiz, it.path).catch(() => null)
    await remover(raiz, caminhoBase(it.doc)).catch(() => null)
    setMsg(`Base "${it.doc.name}" excluída.`); await carregar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={fechar} data-abrir-base-janela>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><FolderOpen className="w-4 h-4 text-orange-500" /> Abrir base</p>
          <button className="ml-auto p-1 text-gray-500 hover:text-gray-900" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {!liberada && <p className="text-xs text-gray-500">Conecte a pasta Biblioteca MAE para ver as bases.</p>}
        {msg && <p className="text-xs text-amber-700" data-msg-abrir-base>{msg}</p>}
        {liberada && !itens && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo as bases…</p>}
        {itens && !itens.length && <p className="text-xs text-gray-400">Nenhuma base salva ainda. Monte uma na aba 1. Base e salve (passo Salvar).</p>}
        {itens && itens.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800" data-lista-bases-salvas>
            {itens.map(it => (
              <li key={`${it.doc.id}:${it.path}`} className="flex items-center gap-3 py-2" data-base-salva={it.doc.name}>
                <Miniatura doc={it.doc} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.doc.name} <span className="text-[11px] font-normal text-gray-400">v{it.doc.version}</span>{it.doc.id === atual && <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] text-orange-700">aberta</span>}</p>
                  <p className="text-[11px] text-gray-500">{it.doc.molds.length} molde(s) · {it.quando ? `editada em ${new Date(it.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'na nuvem'}{it.temas ? ` · usada em ${it.temas} tema(s)` : ''}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className={`${btn} !border-orange-400 bg-orange-50 text-orange-800`} onClick={() => void abrir(it)} title="Abrir para editar (moldes, faces, partes, textos, identidade, marca)" data-abrir-esta-base><FolderOpen className="w-3.5 h-3.5" /> Abrir</button>
                  <button className={btn} onClick={() => void duplicar(it)} title="Fazer uma cópia com outro nome" data-duplicar-base><Copy className="w-3.5 h-3.5" /> Duplicar</button>
                  <button className={`${btn} text-red-600 hover:!bg-red-50`} onClick={() => void excluir(it)} title={it.temas ? `Usada em ${it.temas} tema(s) — não dá para excluir` : 'Excluir a base (pede confirmação)'} data-excluir-base><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
