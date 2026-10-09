'use client'
'use no memo'
// Lote 3 — itens 31 e 30 no editor: liga a base, o design e o tema à LINHA DO TEMPO global (um Ctrl+Z só,
// igual às setinhas) e pergunta "Salvar as alterações em … antes de continuar?" (Salvar · Não salvar ·
// Cancelar) antes de trocar de trabalho — abrir/novo base, tema ou design — e ao fechar a aba.
import { useEffect } from 'react'
import { create } from 'zustand'
import { Save } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { registrarFonte, alteradoDesde, desfazerGlobal, refazerGlobal, rotulo, useLinha } from '@/lib/mae/editor/linhaDoTempo'
import { useEditor } from './estado'
import { salvarBase, salvarDesign, salvarTema } from './arquivosMae'

// ── fontes do histórico ──────────────────────────────────────────────────────────────────────────
registrarFonte('base', {
  hist: () => { const s = useMaeDoc.getState(); return (s.contexto === 'base' ? s.hist : s.guardados.base?.hist) ?? null },
  desfazer: () => useMaeDoc.getState().desfazer(), refazer: () => useMaeDoc.getState().refazer(),
  ativa: () => useMaeDoc.getState().contexto === 'base',
})
registrarFonte('imagem', {
  hist: () => { const s = useMaeDoc.getState(); return (s.contexto === 'imagem' ? s.hist : s.guardados.imagem?.hist) ?? null },
  desfazer: () => useMaeDoc.getState().desfazer(), refazer: () => useMaeDoc.getState().refazer(),
  ativa: () => useMaeDoc.getState().contexto === 'imagem',
})
registrarFonte('tema', {
  hist: () => useMaeTema.getState().hist,
  desfazer: () => useMaeTema.getState().desfazer(), refazer: () => useMaeTema.getState().refazer(),
  ativa: () => useEditor.getState().modo === 'tema' && !!useMaeTema.getState().hist,
})
export { desfazerGlobal, refazerGlobal }

/** Rótulos das setinhas (reativo: muda a cada passo). */
export function useRotulosHistorico(): { desfazer: string | null; refazer: string | null } {
  useLinha(s => s.feitos.length + s.desfeitos.length * 10000)
  useMaeDoc(s => s.hist); useMaeTema(s => s.hist); useEditor(s => s.modo)
  return { desfazer: rotulo('desfazer'), refazer: rotulo('refazer') }
}

// ── alterações não salvas ────────────────────────────────────────────────────────────────────────
export type Trabalho = 'base' | 'tema' | 'design'
export function alterado(t: Trabalho): boolean {
  const m = useMaeDoc.getState()
  if (t === 'tema') { const s = useMaeTema.getState(); return alteradoDesde(s.hist as never, s.marca) }
  const ctx = t === 'design' ? 'imagem' : 'base'
  if (m.contexto === ctx) return alteradoDesde(m.hist as never, m.marca)
  const g = m.guardados[ctx]
  return g ? alteradoDesde(g.hist as never, g.marca) : false
}
const nomeDe = (t: Trabalho) => {
  const m = useMaeDoc.getState()
  if (t === 'tema') return useMaeTema.getState().hist?.atual.name ?? 'o tema'
  const ctx = t === 'design' ? 'imagem' : 'base'
  return (m.contexto === ctx ? m.hist.atual : m.guardados[ctx]?.hist.atual)?.name ?? (t === 'base' ? 'a base' : 'o design')
}
async function salvar(t: Trabalho): Promise<boolean> {
  const raiz = useBiblioteca.getState().raiz
  if (!raiz || !useBiblioteca.getState().liberada) { alert('Conecte a pasta Biblioteca MAE para salvar.'); return false }
  const m = useMaeDoc.getState()
  if (t === 'tema') { const h = useMaeTema.getState().hist; if (h) await salvarTema(raiz, h.atual); return true }
  const ctx = t === 'design' ? 'imagem' : 'base'
  const d = m.contexto === ctx ? m.hist.atual : m.guardados[ctx]?.hist.atual
  if (!d) return true
  if (t === 'design') await salvarDesign(raiz, d); else await salvarBase(raiz, d)
  return true
}

interface EstadoPergunta { trabalho: Trabalho | null; nome: string; responder: ((r: 'salvar' | 'nao' | 'cancelar') => void) | null }
const usePergunta = create<EstadoPergunta>()(() => ({ trabalho: null, nome: '', responder: null }))

/**
 * Antes de trocar de trabalho: sem alterações → segue; com alterações → pergunta. Devolve false se a
 * usuária cancelou (fica onde está). Várias (ex.: tema + base) perguntam uma de cada vez.
 */
export async function confirmarTroca(...ts: Trabalho[]): Promise<boolean> {
  for (const t of ts) {
    if (!alterado(t)) continue
    const r = await new Promise<'salvar' | 'nao' | 'cancelar'>(res => usePergunta.setState({ trabalho: t, nome: nomeDe(t), responder: res }))
    usePergunta.setState({ trabalho: null, responder: null })
    if (r === 'cancelar') return false
    if (r === 'salvar' && !(await salvar(t))) return false
  }
  return true
}

/** A janelinha da pergunta + o aviso do navegador ao fechar a aba com algo sem salvar. */
export function PerguntaSalvar() {
  const { trabalho, nome, responder } = usePergunta()
  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => { if ((['base', 'tema', 'design'] as const).some(alterado)) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', antes)
    // Lote 4 (item 30): sair do MAE por um link do SOA (menu lateral, logo…) é navegação interna — o aviso do
    // navegador não aparece. Pergunta aqui (Salvar · Não salvar · Cancelar) antes de sair.
    const sair = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      // Lote 5 (item 58): Pedidos (edição em massa) lê a base/tema SALVOS → também pergunta antes
      if (url.origin !== window.location.origin || (url.pathname.startsWith('/estudio/mae') && !url.pathname.startsWith('/estudio/mae/pedidos'))) return
      const pendentes = (['base', 'tema', 'design'] as const).filter(alterado)
      if (!pendentes.length) return
      e.preventDefault(); e.stopPropagation()
      void confirmarTroca(...pendentes).then(ok => { if (ok) window.location.href = url.href })
    }
    document.addEventListener('click', sair, true)
    return () => { window.removeEventListener('beforeunload', antes); document.removeEventListener('click', sair, true) }
  }, [])
  if (!trabalho || !responder) return null
  const b = 'rounded-lg border px-3 py-1.5 text-xs font-medium'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-pergunta-salvar={trabalho}>
      <div className="max-w-sm w-full rounded-xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Save className="w-4 h-4 text-orange-500" /> Salvar as alterações em {nome} antes de continuar?</p>
        <p className="text-xs text-gray-500">Se não salvar, as mudanças feitas desde a última vez que salvou se perdem.</p>
        <div className="flex justify-end gap-1.5">
          <button className={`${b} border-gray-200`} onClick={() => responder('cancelar')} data-resposta-salvar="cancelar">Cancelar</button>
          <button className={`${b} border-gray-200`} onClick={() => responder('nao')} data-resposta-salvar="nao">Não salvar</button>
          <button className={`${b} border-orange-500 bg-orange-500 text-white`} onClick={() => responder('salvar')} autoFocus data-resposta-salvar="salvar">Salvar</button>
        </div>
      </div>
    </div>
  )
}
