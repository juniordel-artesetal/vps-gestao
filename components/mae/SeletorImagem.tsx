'use client'
'use no memo'
// Lote 5 (item 63): todo seletor de papel/imagem mostra MINIATURAS — nunca o nome do arquivo ("ChatGPT Image 25
// de set. de 2026….png"). Enquanto a miniatura carrega, um quadradinho cinza (o nome fica só no "title").
import { useEffect, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { guardarImagem, infoEmCache, infoImagem, listarImagens } from './arquivosMae'
import type { ArquivoImagem } from '@/lib/mae/vinculo/tema'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

/** Miniatura de UM arquivo da Biblioteca (carrega sob demanda). */
export function MiniaturaArquivo({ path, className = 'h-8 w-8' }: { path: string; className?: string }) {
  const raiz = useBiblioteca(s => s.raiz)
  const [, setV] = useState(0)
  const i = infoEmCache(path)
  useEffect(() => { if (!i && raiz) void infoImagem(raiz, path).then(() => setV(v => v + 1)).catch(() => null) }, [path, raiz, i])
  return (
    <span className={`inline-block overflow-hidden rounded border border-gray-200 bg-gray-100 align-middle ${className}`} title={path.split('/').pop()}>
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
      {i ? <img src={i.url} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  )
}

/** Grade de miniaturas de uma pasta (Papéis, Elementos…) para escolher com um clique. */
export function SeletorImagem({ pastas, atual, onEscolher, alturaMax = 'max-h-40' }: { pastas: string[]; atual?: string | null; onEscolher: (a: ArquivoImagem & { nome?: string }) => void; alturaMax?: string }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [pasta, setPasta] = useState(pastas[0])
  const [carregados, setCarregados] = useState<{ pasta: string; itens: string[] } | null>(null)
  const itens = carregados?.pasta === pasta ? carregados.itens : null
  const setItens = (f: (l: string[] | null) => string[]) => setCarregados(c => ({ pasta, itens: f(c?.pasta === pasta ? c.itens : null) }))
  const [, setV] = useState(0)
  useEffect(() => {
    if (!raiz || !liberada) return
    let vivo = true
    listarImagens(raiz, pasta).then(async l => {
      if (!vivo) return
      setCarregados({ pasta, itens: l })
      for (const p of l) { if (!vivo) return; if (!infoEmCache(p)) { await infoImagem(raiz, p).catch(() => null); setV(v => v + 1) } }
    }).catch(() => { if (vivo) setCarregados({ pasta, itens: [] }) })
    return () => { vivo = false }
  }, [raiz, liberada, pasta])
  async function adicionar() {
    if (!raiz) return
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = 'image/png,image/jpeg,image/webp'
    inp.onchange = async () => { for (const f of Array.from(inp.files ?? [])) { const i = await guardarImagem(raiz, f, pasta); setItens(l => [...new Set([...(l ?? []), i.path])]) } }
    inp.click()
  }
  return (
    <div className="space-y-1" data-seletor-imagem>
      <div className="flex flex-wrap items-center gap-1">
        {pastas.length > 1 && pastas.map(p => <button key={p} className={btn + (pasta === p ? ' !border-orange-500 bg-orange-50 text-orange-800' : '')} onClick={() => setPasta(p)}>{p.split('/').pop()}</button>)}
        <button className={btn + ' ml-auto'} disabled={!liberada} onClick={adicionar}><ImagePlus className="w-3.5 h-3.5" /> Adicionar…</button>
      </div>
      <div className={`grid grid-cols-5 gap-1 overflow-y-auto ${alturaMax}`}>
        {itens === null && <span className="col-span-5 flex items-center gap-1 text-[10px] text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> carregando…</span>}
        {itens?.map(p => {
          const i = infoEmCache(p)
          return (
            <button key={p} title={p.split('/').pop()} disabled={!i} onClick={() => i && onEscolher({ ...i, nome: p.split('/').pop()?.replace(/\.[^.]+$/, '') })}
              className={`aspect-square overflow-hidden rounded border bg-gray-100 hover:border-orange-400 ${atual === p ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-200'}`} data-escolher-imagem={p}>
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
              {i ? <img src={i.url} alt="" className="h-full w-full object-cover" /> : null}
            </button>
          )
        })}
        {itens && !itens.length && <p className="col-span-5 text-[11px] text-gray-400">Nada em {pasta}/ ainda.</p>}
      </div>
    </div>
  )
}
