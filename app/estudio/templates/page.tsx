'use client'
// SOA Edition — TEMPLATES: a biblioteca que a Edição em massa consome. Preparar é aqui (1x): subir a arte,
// ler as camadas, confirmar os campos {nome}/{idade} com a fonte do arquivo — ou montar no Editor de imagem
// e "Salvar como template". Kits de produtos e Templates Especiais também aparecem.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Palette, Pencil, Trash2, Wand2, Layers, Box, Sparkles, Loader2 } from 'lucide-react'

interface T { id: string; nome: string; temaNome: string | null; preview: string | null; updatedAt: string }

export default function Templates() {
  const [meus, setMeus] = useState<T[] | null>(null)
  const [kits, setKits] = useState<T[]>([])
  const carregar = () => {
    fetch('/api/estudio/templates').then(r => r.json()).then(d => setMeus(d.templates || [])).catch(() => setMeus([]))
    fetch('/api/estudio/templates?tipo=kit-caixas').then(r => r.json()).then(d => setKits(d.templates || [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [])
  async function excluir(t: T) {
    if (!confirm(`Excluir o template "${t.temaNome || t.nome}"? As artes já geradas continuam em Meus arquivos.`)) return
    await fetch(`/api/estudio/templates/${t.id}`, { method: 'DELETE' }); carregar()
  }
  const card = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Templates</h1>
        <p className="text-sm text-gray-500">Prepare uma vez — arte, campos {'{nome}'}/{'{idade}'}, fontes e efeitos. Depois a Edição em massa só pede a lista de nomes.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/estudio/templates/editar" className={`${card} p-4 hover:border-orange-400 flex gap-3`}>
          <Plus className="w-6 h-6 text-orange-500 shrink-0" />
          <div><p className="font-semibold text-sm">Criar template a partir de uma arte</p><p className="text-xs text-gray-500">Suba PSD, PDF, SVG, DXF (ou PNG/JPG): eu leio as camadas e o nome/idade viram campos com a fonte do arquivo.</p></div>
        </Link>
        <Link href="/estudio/editor" className={`${card} p-4 hover:border-orange-400 flex gap-3`}>
          <Palette className="w-6 h-6 text-orange-500 shrink-0" />
          <div><p className="font-semibold text-sm">Montar no Editor de imagem</p><p className="text-xs text-gray-500">Monte a arte em camadas, escreva {'{nome}'} / {'{idade}'} nos textos (ou “Transformar em campo”) e use “Salvar como template”.</p></div>
        </Link>
      </div>

      <section className="space-y-2">
        <p className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4" /> Meus templates</p>
        {meus === null ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : !meus.length ? <p className="text-sm text-gray-400">Nenhum template ainda.</p> : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {meus.map(t => (
              <div key={t.id} className={`${card} overflow-hidden`}>
                <div className="aspect-square bg-gray-50 dark:bg-gray-800 flex items-center justify-center">{t.preview ? <img src={t.preview} alt="" className="max-w-full max-h-full" /> : <Layers className="w-8 h-8 text-gray-300" />}</div>
                <div className="p-2 space-y-1.5">
                  <p className="text-xs font-medium truncate">{t.temaNome || t.nome}{t.temaNome && <span className="ml-1 text-[9px] rounded bg-orange-100 text-orange-700 px-1">tema</span>}</p>
                  <div className="flex gap-1">
                    <Link href={`/estudio/artes?template=${t.id}`} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-semibold py-1"><Wand2 className="w-3.5 h-3.5" /> Usar</Link>
                    <Link href={`/estudio/templates/editar?id=${t.id}`} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1" title="Editar"><Pencil className="w-3.5 h-3.5" /></Link>
                    <button onClick={() => excluir(t)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1" title="Excluir"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold flex items-center gap-2"><Box className="w-4 h-4" /> Kits de produtos <Link href="/estudio/caixas" className="text-xs font-normal text-orange-600 hover:underline">montar kit →</Link></p>
        {!kits.length ? <p className="text-sm text-gray-400">Nenhum kit ainda.</p> : (
          <div className="flex flex-wrap gap-2">{kits.map(k => <Link key={k.id} href={`/estudio/artes?template=${k.id}`} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm hover:border-orange-400">{k.temaNome || k.nome}</Link>)}</div>
        )}
      </section>

      <Link href="/templates-especiais" className={`${card} p-4 hover:border-orange-400 flex items-center gap-3`}>
        <Sparkles className="w-5 h-5 text-orange-500" />
        <div className="flex-1"><p className="font-semibold text-sm">Templates Especiais</p><p className="text-xs text-gray-500">Acervo pronto, atualizado toda semana — aparece também na Edição em massa para quem assina.</p></div>
      </Link>
    </div>
  )
}
