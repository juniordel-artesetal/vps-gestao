'use client'
// Painel "Biblioteca MAE": escolher/reconectar a pasta local e o teste de gravar e ler um arquivo.
// Nada sai do computador: o arquivo é gravado e lido na própria pasta da usuária.
import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw, Save, FileText, Check, AlertTriangle } from 'lucide-react'
import { escolherPasta, pastaSalva, permissao, reconectar, type Permissao } from '@/lib/mae/biblioteca/pasta'
import { gravar, ler, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { useMaeDoc } from '@/lib/mae/editor/loja'

const ARQUIVO_TESTE = 'Backups/teste-mae.json'
const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

export default function PainelBiblioteca() {
  const [raiz, setRaiz] = useState<FileSystemDirectoryHandle | null>(null)
  const [perm, setPerm] = useState<Permissao | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [gravado, setGravado] = useState<string | null>(null)
  const [lido, setLido] = useState<{ sha: string; bytes: number; previa: string } | null>(null)

  useEffect(() => {
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
  async function gravarTeste() {
    if (!raiz) return
    try {
      const doc = useMaeDoc.getState().hist.atual
      const conteudo = JSON.stringify({ gravadoEm: new Date().toISOString(), doc }, null, 2)
      await gravar(raiz, ARQUIVO_TESTE, conteudo)
      const h = await sha256(new Blob([conteudo]))
      setGravado(h); setLido(null)
      setMsg({ tipo: 'ok', texto: `Gravado ${ARQUIVO_TESTE} (${new Blob([conteudo]).size} bytes).` })
    } catch (e) { erro(e) }
  }
  async function lerTeste() {
    if (!raiz) return
    try {
      const f = await ler(raiz, ARQUIVO_TESTE)
      const texto = await f.text()
      setLido({ sha: await sha256(f), bytes: f.size, previa: texto.slice(0, 400) })
      setMsg(null)
    } catch (e) {
      if ((e as { name?: string })?.name === 'NotFoundError') setMsg({ tipo: 'erro', texto: `Ainda não existe ${ARQUIVO_TESTE}. Clique em "Gravar teste" primeiro.` })
      else erro(e)
    }
  }

  const liberada = !!raiz && perm === 'granted'
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
        <button className={btn} onClick={gravarTeste} disabled={!liberada}><Save className="w-3.5 h-3.5" /> Gravar teste</button>
        <button className={btn} onClick={lerTeste} disabled={!liberada}><FileText className="w-3.5 h-3.5" /> Ler teste</button>
      </div>
      {msg && <p className={`text-xs flex items-start gap-1 ${msg.tipo === 'ok' ? 'text-emerald-700' : 'text-red-600'}`} data-msg-biblioteca>{msg.tipo === 'ok' ? <Check className="w-3.5 h-3.5 mt-px" /> : <AlertTriangle className="w-3.5 h-3.5 mt-px" />}{msg.texto}</p>}
      {lido && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-[11px] space-y-1" data-lido>
          <p className="text-gray-600 dark:text-gray-300">{lido.bytes} bytes · sha256 <code>{lido.sha.slice(0, 16)}…</code>{' '}
            {gravado && (gravado === lido.sha ? <b className="text-emerald-700" data-igual>✓ igual ao gravado</b> : <b className="text-amber-700">diferente do último gravado nesta sessão</b>)}</p>
          <pre className="whitespace-pre-wrap break-all text-gray-500 max-h-32 overflow-auto">{lido.previa}</pre>
        </div>
      )}
    </section>
  )
}
