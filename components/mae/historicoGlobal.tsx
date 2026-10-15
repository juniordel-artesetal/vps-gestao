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
import { useAjustePedido, usePedidoAberto, desfazerAjustePedido, refazerAjustePedido } from './pedidosMae'
import { salvarBase, salvarDesign, salvarTema, nuvemDoTema } from './arquivosMae'
import { EXEMPLO_CAMPO } from '@/lib/mae/texto/variaveis'
import type { DocTema } from '@/lib/mae/schema'
import { descartarRascunho, gravarJa } from './rascunhos'
import { mensagemDeErro } from '@/lib/mae/erros'

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
// Lote 6 (item 85): o ajuste do pedido (Ajustar da edição em massa) no MESMO Ctrl+Z das setinhas
registrarFonte('pedido', {
  hist: () => useAjustePedido.getState().hist as never,
  desfazer: () => desfazerAjustePedido(), refazer: () => refazerAjustePedido(),
  ativa: () => !!usePedidoAberto.getState().pedido && !!usePedidoAberto.getState().ajustar,
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
/**
 * Lote 18 (item 216): UM Salvar do tema — o botão, o Ctrl+S e o "Salvar antes de continuar" fazem o MESMO:
 *  · a base aberta (deste tema) mudou → salva a base numa versão NOVA (nunca por cima da mesma versão);
 *  · o tema sobe de versão e passa a apontar para a versão da base em que foi editado;
 *  · espera a nuvem (até 8 s): "Salvo (versão N)" só quando gravou; nuvem fora → "salvo neste computador · nuvem
 *    pendente". Antes o Ctrl+S e a janela gravavam sem subir a versão e a cópia velha da nuvem voltava.
 * Falha ao gravar → nada muda (a versão volta) e o motivo aparece. Lança o erro (quem chama mostra).
 */
export async function salvarTemaAberto(): Promise<{ path: string; versao: number; nuvem: 'ok' | 'pendente'; baseVersao: number | null }> {
  const raiz = useBiblioteca.getState().raiz
  if (!raiz || !useBiblioteca.getState().liberada) throw new Error('Conecte a pasta Biblioteca MAE para salvar.')
  const h0 = useMaeTema.getState().hist
  if (!h0) throw new Error('Nenhum tema aberto.')
  const m = useMaeDoc.getState()
  let baseVersao: number | null = null
  if (alterado('base') && m.contexto === 'base' && m.hist.atual.id === h0.atual.baseId) {
    m.aplicar('Salvar base', d => { d.version = (d.version ?? 0) + 1 })
    try { await salvarBase(raiz, useMaeDoc.getState().hist.atual) } catch (e) { useMaeDoc.getState().desfazer(); throw new Error(`a base não salvou — ${mensagemDeErro(e)}`) }
    baseVersao = useMaeDoc.getState().hist.atual.version
  }
  const b = useMaeDoc.getState().contexto === 'base' ? useMaeDoc.getState().hist.atual : null
  useMaeTema.getState().aplicar('Salvar tema', t => {
    t.version += 1
    if (b && b.id === t.baseId && b.version > 0) t.baseVersion = b.version
    // Lote 6 (item 93): campos da base sem exemplo no tema (SOBRENOME, SÉRIE, TURNO…) → ganham um (e viram coluna)
    const fixos = new Set(['NOME', 'IDADE', 'HASHTAG', 'SUFIXO', 'NOME_IDADE', 'ARROBA'])
    if (b) for (const v of new Set(b.textSlots.filter(s => !s.tema || s.tema === t.id).map(s => s.variable))) if (!fixos.has(v) && (t as DocTema).sample?.[v] === undefined) (t as DocTema).sample = { ...(t as DocTema).sample, [v]: EXEMPLO_CAMPO[v] ?? v }
  })
  const atual = useMaeTema.getState().hist!.atual
  let path: string
  try { path = await salvarTema(raiz, atual) } catch (e) { useMaeTema.getState().desfazer(); throw e }
  const envio = nuvemDoTema.get(atual.id)
  const foi = envio ? await Promise.race([envio, new Promise<boolean>(r => setTimeout(() => r(false), 8000))]) : false
  return { path, versao: atual.version, nuvem: foi ? 'ok' : 'pendente', baseVersao }
}
export const textoDoSalvo = (r: { versao: number; nuvem: 'ok' | 'pendente'; baseVersao: number | null }) =>
  `Salvo (versão ${r.versao})${r.baseVersao ? ` · base salva (versão ${r.baseVersao})` : ''}${r.nuvem === 'pendente' ? ' · salvo neste computador; a nuvem envia quando voltar a conexão' : ''}`

export async function salvar(t: Trabalho): Promise<boolean> {
  const raiz = useBiblioteca.getState().raiz
  if (!raiz || !useBiblioteca.getState().liberada) { alert('Conecte a pasta Biblioteca MAE para salvar.'); return false }
  const m = useMaeDoc.getState()
  if (t === 'tema') { if (useMaeTema.getState().hist) await salvarTemaAberto(); return true }
  const ctx = t === 'design' ? 'imagem' : 'base'
  const d = m.contexto === ctx ? m.hist.atual : m.guardados[ctx]?.hist.atual
  if (!d) return true
  if (t === 'design') await salvarDesign(raiz, d); else await salvarBase(raiz, d)
  return true
}

type Resposta = 'salvar' | 'nao' | 'cancelar' | 'continuar'
interface EstadoPergunta { trabalho: Trabalho | null; nome: string; responder: ((r: Resposta) => void) | null; erro: string | null }
const usePergunta = create<EstadoPergunta>()(() => ({ trabalho: null, nome: '', responder: null, erro: null }))

/**
 * Antes de trocar de trabalho: sem alterações → segue; com alterações → pergunta. Devolve false se a
 * usuária cancelou (fica onde está). Várias (ex.: tema + base) perguntam uma de cada vez.
 */
export async function confirmarTroca(...ts: Trabalho[]): Promise<boolean> {
  for (const t of ts) {
    if (!alterado(t)) continue
    // Lote 16 (item 203): Salvar que FALHA não fecha a janela calada (era o ciclo sem saída) — ela volta com o
    // motivo e a saída "Continuar com o salvo neste computador" (o rascunho automático guarda; sincroniza depois)
    let erro: string | null = null, r: Resposta
    for (;;) {
      r = await new Promise<Resposta>(res => usePergunta.setState({ trabalho: t, nome: nomeDe(t), responder: res, erro }))
      usePergunta.setState({ trabalho: null, responder: null, erro: null })
      if (r !== 'salvar') break
      try { if (!(await salvar(t))) return false; break } catch (e) { console.error('[MAE] salvar', e); erro = mensagemDeErro(e) }
    }
    if (r === 'cancelar') return false
    if (r === 'continuar') { await gravarJa().catch(() => null); continue }
    // "Não salvar": a usuária desistiu das alterações → o rascunho automático delas sai junto (não pergunta de novo)
    if (r === 'nao' && t !== 'design') {
      const m = useMaeDoc.getState()
      const id = t === 'tema' ? useMaeTema.getState().hist?.atual.id : (m.contexto === 'base' ? m.hist.atual : m.guardados.base?.hist.atual)?.id
      if (id) void descartarRascunho(t, id)
    }
  }
  return true
}

/** A janelinha da pergunta + o aviso do navegador ao fechar a aba com algo sem salvar. */
export function PerguntaSalvar() {
  const { trabalho, nome, responder, erro } = usePergunta()
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
        {erro ? (
          <p className="text-xs text-red-700 rounded-lg bg-red-50 px-2 py-1.5" data-erro-salvar>Não deu para salvar: {erro} O trabalho continua guardado neste computador.</p>
        ) : <p className="text-xs text-gray-500">Se não salvar, as mudanças feitas desde a última vez que salvou se perdem.</p>}
        <div className="flex flex-wrap justify-end gap-1.5">
          <button className={`${b} border-gray-200`} onClick={() => responder('cancelar')} data-resposta-salvar="cancelar">Cancelar</button>
          {erro
            ? <button className={`${b} border-gray-200`} onClick={() => responder('continuar')} data-resposta-salvar="continuar">Continuar com o salvo neste computador</button>
            : <button className={`${b} border-gray-200`} onClick={() => responder('nao')} data-resposta-salvar="nao">Não salvar</button>}
          <button className={`${b} border-orange-500 bg-orange-500 text-white`} onClick={() => responder('salvar')} autoFocus data-resposta-salvar="salvar">{erro ? 'Tentar de novo' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
