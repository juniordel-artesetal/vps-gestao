'use client'
// Painel "Biblioteca MAE": escolher/reconectar a pasta local. Nada sai do computador.
// Lote 4 (item 40): sem as ferramentas de teste (gravar/ler arquivo). No painel da direita só aparece quando
// a pasta precisa ser escolhida ou reconectada (`modo="aviso"`); trocar a pasta fica em Configurações.
import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw, Check, AlertTriangle } from 'lucide-react'
import { escolherPasta, pastaSalva, permissao, reconectar, type Permissao } from '@/lib/mae/biblioteca/pasta'
import { useBiblioteca } from '@/lib/mae/editor/loja'

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

export default function PainelBiblioteca({ modo = 'completo' }: { modo?: 'aviso' | 'completo' }) {
  const raiz = useBiblioteca(s => s.raiz)
  const [perm, setPermLocal] = useState<Permissao | null>(() => { const st = useBiblioteca.getState(); return st.raiz ? (st.liberada ? 'granted' : 'prompt') : null })
  const setRaiz = (r: FileSystemDirectoryHandle | null) => useBiblioteca.getState().setRaiz(r, false)
  const setPerm = (p: Permissao) => { setPermLocal(p); useBiblioteca.getState().setRaiz(useBiblioteca.getState().raiz, p === 'granted') }
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    // Lote 4 (item 40): este painel aparece em dois lugares (aviso e Configurações) — se a pasta já está
    // conectada, não reconecta de novo (antes isso marcava a pasta como "precisa reconectar" por um instante)
    if (useBiblioteca.getState().raiz) return
    let vivo = true
    ;(async () => { const r = await pastaSalva(); if (!vivo || !r) return; setRaiz(r); setPerm(await permissao(r).catch(() => 'prompt' as Permissao)) })()
    return () => { vivo = false }
  }, [])

  const erro = (e: unknown) => {
    if ((e as { name?: string })?.name === 'AbortError') return
    setMsg({ tipo: 'erro', texto: (e as Error)?.message || 'Não consegui acessar a pasta.' })
  }
  async function escolher() {
    setMsg(null)
    try { const r = await escolherPasta(); setRaiz(r); setPerm('granted'); setMsg({ tipo: 'ok', texto: `Pasta "${r.name}" pronta — estrutura da Biblioteca criada.` }) } catch (e) { erro(e) }
  }
  async function reconfirmar() {
    if (!raiz) return
    try { const p = await reconectar(raiz); setPerm(p); setMsg(p === 'granted' ? { tipo: 'ok', texto: 'Acesso à pasta liberado.' } : { tipo: 'erro', texto: 'O acesso à pasta não foi liberado.' }) } catch (e) { erro(e) }
  }
  const liberadaStore = useBiblioteca(s => s.liberada)
  const liberada = !!raiz && (perm === 'granted' || liberadaStore)
  if (modo === 'aviso' && liberada && msg?.tipo !== 'erro') return null
  return (
    <section className="space-y-2" data-painel-biblioteca>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Biblioteca MAE</h2>
      <p className="text-xs text-gray-500" data-estado-pasta>
        {!raiz ? 'Nenhuma pasta escolhida. Sugestão: crie "Biblioteca MAE" dentro do OneDrive, Drive ou Dropbox (vira backup automático).'
          : liberada ? <>Pasta: <b>{raiz.name}</b> · acesso liberado</>
          : <>Pasta: <b>{raiz.name}</b> · precisa reconectar (1 clique)</>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={escolher}><FolderOpen className="w-3.5 h-3.5" /> {raiz ? 'Trocar pasta' : 'Escolher pasta'}</button>
        {raiz && !liberada && <button className={btn + ' !border-orange-400 text-orange-700'} onClick={reconfirmar}><RefreshCw className="w-3.5 h-3.5" /> Reconectar</button>}
      </div>
      {msg && <p className={`text-xs flex items-start gap-1 ${msg.tipo === 'ok' ? 'text-emerald-700' : 'text-red-600'}`} data-msg-biblioteca>{msg.tipo === 'ok' ? <Check className="w-3.5 h-3.5 mt-px" /> : <AlertTriangle className="w-3.5 h-3.5 mt-px" />}{msg.texto}</p>}
    </section>
  )
}
