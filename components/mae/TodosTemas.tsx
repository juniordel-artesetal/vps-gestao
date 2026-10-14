'use client'
// Lote 13 (item 181): "VER TODOS OS TEMAS" — grade de miniaturas com as ações de gerenciar: abrir, renomear, duplicar,
// arquivar (some da busca; "Mostrar arquivados" para restaurar) e excluir (item 186: lixeira de 30 dias). Vários de
// uma vez com a seleção.
import { useEffect, useMemo, useState } from 'react'
import { X, Pencil, Copy, Archive, ArchiveRestore, Trash2, FolderOpen } from 'lucide-react'
import type { DocTema } from '@/lib/mae/schema'
import { normalizarBusca } from '@/lib/mae/editor/buscaTemas'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { listarTemas, salvarTema, renomearTemaNoDisco } from './arquivosMae'
import { ModalExcluirTemas, LixeiraTemas } from './ExcluirTema'
import { mensagemDeErro } from '@/lib/mae/erros'
import { MiniaturaTema } from './BuscaTemas'

const btn = 'inline-flex items-center gap-1 rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[11px] hover:border-orange-400 disabled:opacity-40'

export default function TodosTemas({ onAbrir, onFechar, baseAtual }: { onAbrir: (t: DocTema) => void; onFechar: () => void; baseAtual?: { id: string; nome?: string } | null }) {
  const raiz = useBiblioteca(s => s.raiz)
  const [temas, setTemas] = useState<{ path: string; doc: DocTema }[] | null>(null)
  const [q, setQ] = useState('')
  const [arquivados, setArquivados] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [excluindo, setExcluindo] = useState<{ id: string; name: string }[] | null>(null)
  const [lixeira, setLixeira] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const carregar = async () => { if (raiz) setTemas(await listarTemas(raiz)) }
  useEffect(() => { let vivo = true; if (raiz) void listarTemas(raiz).then(l => { if (vivo) setTemas(l) }); return () => { vivo = false } }, [raiz])
  const visiveis = useMemo(() => {
    const termos = normalizarBusca(q).split(' ').filter(Boolean)
    return (temas ?? []).filter(t => !!t.doc.arquivado === arquivados && termos.every(p => normalizarBusca(t.doc.name ?? '').includes(p)))
      .sort((a, b) => (a.doc.name ?? '').localeCompare(b.doc.name ?? '', 'pt-BR'))
  }, [temas, q, arquivados])
  async function salvarDoc(doc: DocTema, msgOk: string) {
    if (!raiz) return
    try {
      await salvarTema(raiz, doc)
      // o tema aberto é o mesmo → a tela segue o salvo
      if (useMaeTema.getState().hist?.atual.id === doc.id) useMaeTema.getState().carregar(doc)
      setMsg(msgOk); await carregar()
    } catch (e) { setMsg(mensagemDeErro(e)) }
  }
  async function renomear(t: DocTema) {
    const v = prompt('Novo nome do tema:', t.name ?? '')?.trim().slice(0, 120)
    if (!v || v === t.name || !raiz) return
    await renomearTemaNoDisco(raiz, t, v).catch(() => null)
    await salvarDoc({ ...t, name: v, version: t.version + 1 }, `Renomeado para "${v}".`)
  }
  async function duplicar(t: DocTema) {
    const v = prompt('Nome da cópia:', `${t.name ?? 'Tema'} (cópia)`)?.trim().slice(0, 120)
    if (!v) return
    await salvarDoc({ ...JSON.parse(JSON.stringify(t)), id: `th_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`, version: 1, name: v, arquivado: undefined }, `Cópia "${v}" criada.`)
  }
  const arquivar = (t: DocTema, sim: boolean) => salvarDoc({ ...t, version: t.version + 1, arquivado: sim || undefined }, sim ? `"${t.name}" arquivado — some da busca (Mostrar arquivados para restaurar).` : `"${t.name}" restaurado.`)
  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar} role="dialog" aria-modal="true" data-todos-temas>
      <div className="mt-8 w-full max-w-5xl space-y-3 rounded-2xl bg-white p-4 text-sm shadow-xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <b>Todos os temas</b><span className="text-xs text-gray-400">{visiveis.length}{arquivados ? ' arquivados' : ''}</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar…" className="ml-2 w-48 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs" data-filtro-todos-temas />
          <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" className="accent-orange-500" checked={arquivados} onChange={e => { setArquivados(e.target.checked); setSel([]) }} data-mostrar-arquivados /> Mostrar arquivados</label>
          {sel.length > 0 && <button className={btn + ' !border-red-300 text-red-700'} onClick={() => setExcluindo((temas ?? []).filter(t => sel.includes(t.doc.id)).map(t => ({ id: t.doc.id, name: t.doc.name ?? t.doc.id })))} data-excluir-varios-grade><Trash2 className="h-3 w-3" /> Excluir {sel.length}</button>}
          <button className={btn} onClick={() => setLixeira(v => !v)} data-lixeira-grade><Trash2 className="h-3 w-3" /> Lixeira</button>
          <button className="ml-auto" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        {msg && <p className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{msg}</p>}
        {lixeira && <LixeiraTemas onFechar={() => setLixeira(false)} onRestaurado={m => { setMsg(m); void carregar() }} />}
        {!temas && <p className="text-xs text-gray-400">Carregando os temas…</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-grade-temas>
          {visiveis.map(t => (
            <div key={t.doc.id} className={`space-y-1 rounded-xl border p-2 ${sel.includes(t.doc.id) ? 'border-orange-400 bg-orange-50/50' : 'border-gray-200 dark:border-gray-700'}`} data-cartao-tema={t.doc.name}>
              <div className="flex items-start gap-1.5">
                <input type="checkbox" className="mt-1 accent-orange-500" checked={sel.includes(t.doc.id)} onChange={e => setSel(s => e.target.checked ? [...s, t.doc.id] : s.filter(x => x !== t.doc.id))} aria-label={`Selecionar ${t.doc.name}`} />
                <div className="min-w-0 flex-1">
                  <MiniaturaTema doc={t.doc} grande />
                  <p className="truncate text-xs font-medium" title={t.doc.name}>{t.doc.name}</p>
                  <p className="truncate text-[10px] text-gray-400">v{t.doc.version}{t.path === '(nuvem)' ? ' · só na nuvem' : ''}{baseAtual && t.doc.baseId === baseAtual.id ? ' · desta base' : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <button className={btn} onClick={() => onAbrir(t.doc)} data-abrir-cartao><FolderOpen className="h-3 w-3" /> Abrir</button>
                <button className={btn} onClick={() => void renomear(t.doc)} title="Renomear" data-renomear-cartao><Pencil className="h-3 w-3" /></button>
                <button className={btn} onClick={() => void duplicar(t.doc)} title="Duplicar" data-duplicar-cartao><Copy className="h-3 w-3" /></button>
                {t.doc.arquivado
                  ? <button className={btn} onClick={() => void arquivar(t.doc, false)} title="Restaurar (desarquivar)" data-desarquivar-cartao><ArchiveRestore className="h-3 w-3" /></button>
                  : <button className={btn} onClick={() => void arquivar(t.doc, true)} title="Arquivar (some da busca)" data-arquivar-cartao><Archive className="h-3 w-3" /></button>}
                <button className={btn + ' text-red-600'} onClick={() => setExcluindo([{ id: t.doc.id, name: t.doc.name ?? t.doc.id }])} title="Excluir (lixeira 30 dias)" data-excluir-cartao><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
        {excluindo && <ModalExcluirTemas temas={excluindo} todos={(temas ?? []).map(t => ({ id: t.doc.id, name: t.doc.name ?? t.doc.id }))} onFechar={() => setExcluindo(null)}
          onFeito={m => { setExcluindo(null); setSel([]); setMsg(m); void carregar() }} />}
      </div>
    </div>
  )
}
