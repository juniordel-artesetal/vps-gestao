'use client'
// MAE — VERSÃO NOVA com a página aberta (Lote 10, item 161). A cada atualização no Vercel, os arquivos da versão
// antiga somem: a próxima parte carregada sob demanda (ex.: a marca de registro) falhava com "Failed to load chunk".
//   • a cada 5 min e ao voltar para a aba: pergunta a versão ao servidor (/api/versao); mudou → aviso no topo;
//   • se uma parte do app não carrega: guarda o rascunho e recarrega UMA vez sozinho (sem erro técnico em inglês);
//   • "Atualizar agora" guarda o rascunho antes de recarregar — nada se perde por causa de atualização.
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { gravarJa } from './rascunhos'

const MINHA = process.env.NEXT_PUBLIC_MAE_VERSAO ?? 'local'
const CHAVE = 'mae:recarga-versao'

/** Erro de "parte do app que não carregou" (versão antiga x nova), em qualquer navegador. */
export function ehErroDeVersao(e: unknown): boolean {
  const x = e as { name?: string; message?: string } | null
  const txt = `${x?.name ?? ''} ${x?.message ?? String(e ?? '')}`
  return /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported|Loading CSS chunk/i.test(txt)
}

/** Guarda o rascunho e recarrega a página. */
export async function recarregarComRascunho(): Promise<void> {
  try { await Promise.race([gravarJa(), new Promise(r => setTimeout(r, 2500))]) } catch { /* recarrega mesmo assim */ }
  try { sessionStorage.setItem(CHAVE, String(Date.now())) } catch { /* sem sessionStorage */ }
  window.location.reload()
}

/** Parte do app não carregou: recarrega sozinho UMA vez (não entra em laço). Devolve false se já tentou há pouco. */
export function recuperarDeVersao(): boolean {
  let ultima = 0
  try { ultima = Number(sessionStorage.getItem(CHAVE)) || 0 } catch { /* sem sessionStorage */ }
  if (Date.now() - ultima < 60_000) return false
  void recarregarComRascunho()
  return true
}

/** O aviso no topo do editor. */
export function AvisoVersaoNova() {
  const [nova, setNova] = useState(false)
  const [falhou, setFalhou] = useState(false)
  useEffect(() => {
    let vivo = true
    const conferir = async () => {
      if (MINHA === 'local' || document.visibilityState === 'hidden') return
      const r = await fetch('/api/versao', { cache: 'no-store' }).then(x => (x.ok ? x.json() : null)).catch(() => null) as { versao?: string } | null
      if (vivo && r?.versao && r.versao !== MINHA) setNova(true)
    }
    const t = setInterval(() => { void conferir() }, 5 * 60_000)
    const voltou = () => { void conferir() }
    const erro = (ev: ErrorEvent | PromiseRejectionEvent) => {
      const e = 'reason' in ev ? ev.reason : ev.error ?? ev.message
      if (!ehErroDeVersao(e)) return
      if ('preventDefault' in ev) ev.preventDefault()
      if (!recuperarDeVersao()) setFalhou(true)
    }
    document.addEventListener('visibilitychange', voltou)
    window.addEventListener('error', erro as EventListener)
    window.addEventListener('unhandledrejection', erro as EventListener)
    return () => {
      vivo = false; clearInterval(t)
      document.removeEventListener('visibilitychange', voltou)
      window.removeEventListener('error', erro as EventListener)
      window.removeEventListener('unhandledrejection', erro as EventListener)
    }
  }, [])
  if (!nova && !falhou) return null
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs shadow-lg" role="status" data-aviso-versao={falhou ? 'falhou' : 'nova'}>
      <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
      <span>{falhou ? 'Esta parte do MAE mudou numa atualização.' : 'Saiu uma versão nova do MAE.'} <b>Seu trabalho está salvo.</b></span>
      <button className="rounded-full bg-sky-600 px-2.5 py-0.5 font-medium text-white" onClick={() => void recarregarComRascunho()} data-atualizar-versao>Atualizar agora</button>
    </div>
  )
}
