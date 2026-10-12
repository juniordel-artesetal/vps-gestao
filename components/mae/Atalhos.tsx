'use client'
// Lote 9 (item 148): LISTA DE ATALHOS do Método MAE (tecla "?" ou o botão do teclado no topo), pesquisável. Lê a
// mesma tabela que o teclado usa (lib/mae/editor/atalhos.ts) — o que aparece aqui é o que funciona.
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ATALHOS, GESTOS } from '@/lib/mae/editor/atalhos'
import { useEditor } from './estado'

const GRUPOS = ['Geral', 'Editar', 'Camadas', 'Vista'] as const
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ListaAtalhos() {
  const aberto = useEditor(s => s.atalhos)
  const [busca, setBusca] = useState('')
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') useEditor.getState().set({ atalhos: false }) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto])
  const linhas = useMemo(() => {
    const todas = [...ATALHOS.map(a => ({ teclas: a.teclas, rotulo: a.rotulo, grupo: a.grupo })), ...GESTOS]
    const q = semAcento(busca.trim())
    return q ? todas.filter(l => semAcento(`${l.teclas} ${l.rotulo}`).includes(q)) : todas
  }, [busca])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" onClick={() => useEditor.getState().set({ atalhos: false })} data-lista-atalhos>
      <div className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          <h2 className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">Atalhos de teclado</h2>
          <button className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={() => useEditor.getState().set({ atalhos: false })} aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 pt-3">
          <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar (ex.: duplicar, espelhar, zoom)" className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-1.5 text-sm" data-busca-atalho />
        </div>
        <div className="overflow-y-auto px-4 py-3 space-y-3">
          {GRUPOS.map(g => {
            const ls = linhas.filter(l => l.grupo === g)
            if (!ls.length) return null
            return (
              <section key={g}>
                <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{g}</h3>
                <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                  {ls.map(l => (
                    <li key={l.teclas + l.rotulo} className="flex items-center justify-between gap-3 py-1 text-xs" data-atalho={l.teclas}>
                      <span className="text-gray-700 dark:text-gray-200">{l.rotulo}</span>
                      <kbd className="shrink-0 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:text-gray-300">{l.teclas}</kbd>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {!linhas.length && <p className="text-xs text-gray-400">Nenhum atalho com “{busca}”.</p>}
        </div>
        <p className="border-t border-gray-100 dark:border-gray-800 px-4 py-2 text-[10px] text-gray-400">Os atalhos não funcionam enquanto você digita num campo de texto.</p>
      </div>
    </div>
  )
}
