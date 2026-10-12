'use client'
// MAE — proteção contra perda (12/10/2026), a parte de TELA:
//   <RascunhoAutomatico/>  liga o rascunho automático (components/mae/rascunhos.ts)
//   <IndicadorSalvamento/> "Salvo há X s" / "Salvando…" / "Sem conexão — salvo neste computador"
//   <RecuperarRascunhos/>  ao abrir: "Recuperar trabalho não salvo?"
//   <ProtecaoErro>         erro numa ferramenta não derruba a página: guarda o rascunho e mostra o aviso só nela
import { Component, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CloudOff, Check, Loader2, RotateCcw } from 'lucide-react'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { useEditor } from './estado'
import { listarBases } from './arquivosMae'
import { sync } from './sincronia'
import { alterado } from './historicoGlobal'
import { iniciarRascunhoAutomatico, useSalvamento, listarRascunhos, descartarRascunho, gravarAgora, NAO_SALVO, type Rascunho } from './rascunhos'

export function RascunhoAutomatico() {
  useEffect(() => iniciarRascunhoAutomatico(), [])
  return null
}

const haQuanto = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`
}

export function IndicadorSalvamento() {
  const { estado, em, pendente } = useSalvamento()
  useMaeTema(s => s.hist); useMaeDoc(s => s.hist)
  // "há X s" anda sozinho (o relógio é lido no intervalo, nunca durante o desenho)
  const [agora, setAgora] = useState(0)
  useEffect(() => { const ler = () => setAgora(Date.now()); ler(); const t = setInterval(ler, 5000); return () => clearInterval(t) }, [em])
  const sujo = alterado('tema') || alterado('base')
  const cls = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]'
  if (estado === 'salvando') return <span className={`${cls} text-gray-500`} data-salvamento="salvando"><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</span>
  if (estado === 'offline') return <span className={`${cls} bg-amber-50 text-amber-800`} title="O servidor não respondeu. O trabalho está guardado neste computador e vai para a nuvem quando a conexão voltar." data-salvamento="offline"><CloudOff className="w-3 h-3" /> Sem conexão — salvo neste computador</span>
  if (em) return <span className={`${cls} text-gray-500`} title={sujo ? 'Rascunho automático guardado. Use Salvar para criar a versão do arquivo.' : 'Tudo salvo.'} data-salvamento="salvo"><Check className="w-3 h-3 text-emerald-600" /> Salvo há {haQuanto(Math.max(0, agora - em))}{sujo && pendente ? '…' : ''}</span>
  return sujo ? <span className={`${cls} text-gray-400`} data-salvamento="pendente">Alterações ainda não salvas</span> : null
}

const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Ao abrir o editor: rascunhos de trabalho não salvo (deste computador ou da nuvem) → recuperar ou descartar. */
export function RecuperarRascunhos() {
  const [lista, setLista] = useState<Rascunho[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void listarRascunhos().then(rs => {
      if (!vivo) return
      // o que já está aberto com alterações (a usuária já está trabalhando nele) não pergunta
      const abertos = new Set<string>()
      const t = useMaeTema.getState().hist?.atual; if (t && alterado('tema')) abertos.add(`tema:${t.id}`)
      const m = useMaeDoc.getState(), b = m.contexto === 'base' ? m.hist.atual : m.guardados.base?.hist.atual
      if (b && alterado('base')) abertos.add(`base:${b.id}`)
      setLista(rs.filter(r => !abertos.has(r.chave)))
    })
    return () => { vivo = false }
  }, [])
  if (!lista?.length) return null

  async function recuperar(r: Rascunho) {
    setMsg(null)
    if (r.tipo === 'base') {
      const m = useMaeDoc.getState(); if (m.contexto !== 'base') m.trocarContexto('base')
      useMaeDoc.getState().carregar(r.doc as DocTrabalho)
      useMaeDoc.setState({ marca: NAO_SALVO as never })
      useEditor.getState().set({ modo: 'base', face: null, camada: null })
    } else {
      const t = r.doc as DocTema
      // a base do tema: a que está aberta, o rascunho dela, a da Biblioteca ou a da nuvem
      const m = useMaeDoc.getState()
      const aberta = m.contexto === 'base' ? m.hist.atual : m.guardados.base?.hist.atual
      if (aberta?.id !== t.baseId) {
        const rb = lista?.find(x => x.tipo === 'base' && x.id === t.baseId)?.doc as DocTrabalho | undefined
        const raiz = useBiblioteca.getState().raiz
        const daPasta = !rb && raiz ? (await listarBases(raiz).catch(() => [])).filter(x => x.doc.id === t.baseId).sort((a, b) => (b.doc.version ?? 0) - (a.doc.version ?? 0))[0]?.doc : undefined
        const b = rb ?? daPasta ?? await sync.abrirBase(t.baseId).catch(() => null)
        if (!b) { setMsg(`A base deste tema não foi encontrada (nem na Biblioteca nem na nuvem). Abra a base "${t.baseId}" e tente de novo.`); return }
        if (m.contexto !== 'base') m.trocarContexto('base')
        useMaeDoc.getState().carregar(b)
        if (rb) useMaeDoc.setState({ marca: NAO_SALVO as never })
      }
      useMaeTema.getState().carregar(t)
      useMaeTema.setState({ marca: NAO_SALVO as never })
      useEditor.getState().set({ modo: 'tema', face: null, camada: null, slot: null })
    }
    setLista(l => (l ?? []).filter(x => x.chave !== r.chave && !(r.tipo === 'tema' && x.tipo === 'base' && x.id === (r.doc as DocTema).baseId)))
  }
  async function descartar(r: Rascunho) {
    if (!confirm(`Descartar o trabalho não salvo de "${r.nome}"? Não dá para desfazer.`)) return
    await descartarRascunho(r.tipo, r.id)
    setLista(l => (l ?? []).filter(x => x.chave !== r.chave))
  }
  const b = 'rounded-lg border px-2.5 py-1 text-xs font-medium'
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-recuperar-rascunhos>
      <div className="max-w-md w-full rounded-xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl">
        <p className="text-sm font-semibold flex items-center gap-1.5"><RotateCcw className="w-4 h-4 text-orange-500" /> Recuperar trabalho não salvo?</p>
        <p className="text-xs text-gray-500">Encontramos alterações que não chegaram a ser salvas (a página fechou ou deu erro). O salvamento automático guardou tudo.</p>
        <ul className="space-y-2">
          {lista.map(r => (
            <li key={r.chave} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2" data-rascunho={r.chave}>
              <p className="text-sm font-medium">{r.tipo === 'tema' ? 'Tema' : 'Base'}: {r.nome} <span className="text-[11px] font-normal text-gray-400">v{r.versao}</span></p>
              <p className="text-[11px] text-gray-500">Alterado em {quando(r.editadoEm)} · {r.onde === 'nuvem' ? 'guardado na nuvem' : 'guardado neste computador'}</p>
              <div className="mt-1.5 flex justify-end gap-1.5">
                <button className={`${b} border-gray-200`} onClick={() => descartar(r)} data-descartar-rascunho>Descartar</button>
                <button className={`${b} border-orange-500 bg-orange-500 text-white`} onClick={() => recuperar(r)} data-recuperar-rascunho>Recuperar</button>
              </div>
            </li>
          ))}
        </ul>
        {msg && <p className="text-xs text-red-600">{msg}</p>}
        <div className="flex justify-end"><button className={`${b} border-gray-200`} onClick={() => setLista([])} data-fechar-recuperar>Decidir depois</button></div>
        <p className="text-[10px] text-gray-400">Depois de recuperar, use Salvar para criar a versão do arquivo.</p>
      </div>
    </div>
  )
}

/** Erro numa ferramenta: guarda o rascunho na hora e mostra o aviso SÓ no lugar dela (o resto do editor segue). */
export class ProtecaoErro extends Component<{ nome: string; children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null }
  static getDerivedStateFromError(erro: Error) { return { erro } }
  componentDidCatch(erro: Error) {
    console.error(`[MAE] erro em "${this.props.nome}"`, erro)
    gravarAgora()
  }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="m-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1.5" role="alert" data-protecao-erro={this.props.nome}>
        <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {this.props.nome}: esta ferramenta deu um erro.</p>
        <p>O seu trabalho continua aberto e foi guardado agora (salvamento automático). O resto do editor segue funcionando.</p>
        <p className="text-[10px] text-amber-700 break-words">{this.state.erro.message}</p>
        <button className="rounded border border-amber-300 bg-white px-2 py-0.5 font-medium" onClick={() => this.setState({ erro: null })} data-tentar-de-novo>Tentar de novo</button>
      </div>
    )
  }
}
