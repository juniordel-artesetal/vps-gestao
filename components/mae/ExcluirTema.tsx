'use client'
// Lote 13 (item 186): EXCLUIR TEMA — some da lista e de TODOS os seletores (pasta + nuvem), vai para a LIXEIRA por 30
// dias (Restaurar). Se pedidos/produtos usam o tema, a tela pede outro tema para eles antes de excluir. Vários de uma vez.
import { useEffect, useState } from 'react'
import { Trash2, RotateCcw, X, Loader2 } from 'lucide-react'
import { sync } from './sincronia'
import { moverTemaParaLixeira, restaurarTemaLocal } from './arquivosMae'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { mensagemDeErro } from '@/lib/mae/erros'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
interface TemaItem { id: string; name: string }

export function ModalExcluirTemas({ temas, todos, onFechar, onFeito }: { temas: TemaItem[]; todos: TemaItem[]; onFechar: () => void; onFeito: (msg: string) => void }) {
  const raiz = useBiblioteca(s => s.raiz)
  const [uso, setUso] = useState<Record<string, { pedidos: number; produtos: number }> | null>(null)
  const [sub, setSub] = useState('')
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void Promise.all(temas.map(t => sync.usoDoTema(t.id).then(u => [t.id, u] as const).catch(() => [t.id, { pedidos: 0, produtos: 0 }] as const)))
      .then(l => { if (vivo) setUso(Object.fromEntries(l)) })
    return () => { vivo = false }
  }, [temas])
  const ids = new Set(temas.map(t => t.id))
  const pedidos = Object.values(uso ?? {}).reduce((s, u) => s + u.pedidos, 0), produtos = Object.values(uso ?? {}).reduce((s, u) => s + u.produtos, 0)
  const emUso = pedidos + produtos > 0
  const nome = temas.length === 1 ? `"${temas[0].name}"` : `${temas.length} temas`
  async function excluir() {
    setIndo(true); setErro(null)
    try {
      for (const t of temas) {
        await sync.excluirTema(t.id, emUso ? sub : undefined)
        if (raiz) await moverTemaParaLixeira(raiz, t.id).catch(() => 0)
      }
      // o tema aberto foi excluído → fecha
      const aberto = useMaeTema.getState().hist?.atual
      if (aberto && ids.has(aberto.id)) useMaeTema.getState().carregar(null)
      onFeito(`${temas.length === 1 ? `Tema ${nome} excluído` : `${temas.length} temas excluídos`} — fica na Lixeira por 30 dias.`)
    } catch (e) { setErro(mensagemDeErro(e)) } finally { setIndo(false) }
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onFechar} role="dialog" aria-modal="true" data-modal-excluir-tema>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-4 text-sm shadow-xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2"><Trash2 className="h-4 w-4 text-red-600" /><b>Excluir {nome}?</b><button className="ml-auto" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></button></div>
        {temas.length > 1 && <ul className="max-h-28 overflow-y-auto text-xs text-gray-600">{temas.map(t => <li key={t.id} className="truncate" title={t.name}>• {t.name}</li>)}</ul>}
        <p className="text-xs text-gray-600">{temas.length === 1 ? 'Ele some' : 'Eles somem'} da lista e dos seletores (inclusive da edição em massa e de outros computadores). Você pode restaurar em até 30 dias na Lixeira.</p>
        {!uso && <p className="flex items-center gap-1 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Conferindo se algum pedido usa…</p>}
        {uso && emUso && (
          <div className="space-y-1 rounded bg-amber-50 p-2 text-xs text-amber-900" data-tema-em-uso>
            <p><b>{pedidos} pedido{pedidos === 1 ? '' : 's'}</b>{produtos ? <> e <b>{produtos} produto{produtos === 1 ? '' : 's'}</b> vinculado{produtos === 1 ? '' : 's'}</> : null} {pedidos + produtos === 1 ? 'usa' : 'usam'} {temas.length === 1 ? 'este tema' : 'estes temas'}. Escolha o tema que fica no lugar:</p>
            <select value={sub} onChange={e => setSub(e.target.value)} className="w-full rounded border border-amber-300 bg-white px-1 py-0.5" data-substituto-tema>
              <option value="">— escolha —</option>
              {todos.filter(t => !ids.has(t.id)).sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        {erro && <p className="text-xs text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onFechar}>Cancelar</button>
          <button className={btn + ' !border-red-500 bg-red-600 text-white'} disabled={!uso || indo || (emUso && !sub)} onClick={() => void excluir()} data-confirmar-excluir-tema>
            {indo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

/** A LIXEIRA dos temas (30 dias): restaurar volta para a lista, a nuvem e a pasta. */
export function LixeiraTemas({ onFechar, onRestaurado }: { onFechar: () => void; onRestaurado: (msg: string) => void }) {
  const raiz = useBiblioteca(s => s.raiz)
  const [lista, setLista] = useState<{ id: string; nome: string; em: string }[] | null>(null)
  const [indo, setIndo] = useState<string | null>(null)
  useEffect(() => { void sync.lixeiraTemas().then(setLista).catch(() => setLista([])) }, [])
  const dias = (em: string) => Math.max(0, 30 - Math.floor((Date.now() - new Date(em).getTime()) / 86_400_000))
  async function restaurar(t: { id: string; nome: string }) {
    setIndo(t.id)
    try {
      await sync.restaurarTema(t.id)
      if (raiz) await restaurarTemaLocal(raiz, t.id).catch(() => 0)
      setLista(l => (l ?? []).filter(x => x.id !== t.id)); onRestaurado(`Tema "${t.nome}" restaurado.`)
    } finally { setIndo(null) }
  }
  return (
    <div className="space-y-1 rounded-lg border border-gray-200 p-1.5 dark:border-gray-700" data-lixeira-temas>
      <div className="flex items-center gap-1 text-[11px] text-gray-500"><Trash2 className="h-3 w-3" /><span className="flex-1">Lixeira de temas (30 dias)</span><button onClick={onFechar} aria-label="Fechar a lixeira">×</button></div>
      {!lista && <p className="text-[11px] text-gray-400">Carregando…</p>}
      {lista?.length === 0 && <p className="text-[11px] text-gray-400">A lixeira está vazia.</p>}
      <ul className="space-y-0.5 text-xs">{(lista ?? []).map(t => (
        <li key={t.id} className="flex items-center gap-1" data-tema-lixeira={t.nome}>
          <span className="min-w-0 flex-1 truncate text-left" title={t.nome}>{t.nome}</span>
          <span className="text-[10px] text-gray-400">{dias(t.em)}d</span>
          <button className={btn} disabled={indo === t.id} onClick={() => void restaurar(t)} data-restaurar-tema><RotateCcw className="h-3 w-3" /> Restaurar</button>
        </li>
      ))}</ul>
    </div>
  )
}
