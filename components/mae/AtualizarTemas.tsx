'use client'
// Lote 18 (item 218): "ATUALIZAR TODOS OS TEMAS DESTA BASE" — cada tema passa a apontar para a versão atual da base e
// é salvo. No fim, o resumo (N atualizados) e UM aviso com os conflitos (arte numa parte que saiu da base, ajuste num
// texto que saiu) — "3 temas tinham ajuste no texto X — ver quais".
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import type { DocTema } from '@/lib/mae/schema'
import { conflitosTemaBase, temConflito } from '@/lib/mae/vinculo/temaDaBase'
import { mensagemDeErro } from '@/lib/mae/erros'
import { listarTemas, salvarTema } from './arquivosMae'
import { alterado } from './historicoGlobal'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium hover:border-orange-400 disabled:opacity-40'

export default function AtualizarTemas() {
  const base = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz)
  const [ocupado, setOcupado] = useState(false)
  const [res, setRes] = useState<{ n: number; conflitos: { tema: string; o: string }[] } | null>(null)
  const [ver, setVer] = useState(false)
  if (!base.molds.length) return null

  async function atualizar() {
    if (!raiz) return
    if (alterado('base')) { setRes(null); alert('Salve a base primeiro (os temas passam a apontar para a versão salva).'); return }
    setOcupado(true); setRes(null)
    try {
      const aberto = useMaeTema.getState().hist?.atual as DocTema | undefined
      const temas = (await listarTemas(raiz)).map(t => t.doc).filter(t => t.baseId === base.id).map(t => (aberto?.id === t.id ? aberto : t))
      let n = 0
      const conflitos: { tema: string; o: string }[] = []
      for (const t of temas) {
        const c = conflitosTemaBase(base, t)
        if (temConflito(c)) {
          const nomeTexto = (id: string) => { const aj = t.textSlotAdjust?.[id]; void aj; return id.replace(/^ts_/, '').replace(/_[a-z0-9]{4,}$/, '').toUpperCase() }
          for (const p of c.partes) conflitos.push({ tema: t.name ?? t.id, o: `arte numa parte que saiu da base (${p})` })
          for (const f of c.faces) conflitos.push({ tema: t.name ?? t.id, o: `arte numa face que saiu da base (${f})` })
          for (const x of c.textos) conflitos.push({ tema: t.name ?? t.id, o: `ajuste no texto ${nomeTexto(x)}, que saiu da base` })
        }
        if (t.baseVersion === base.version) continue
        if (aberto?.id === t.id) {
          useMaeTema.getState().aplicar('Atualizar o tema para a versão atual da base', tt => { tt.baseVersion = base.version; tt.version += 1 })
          await salvarTema(raiz, useMaeTema.getState().hist!.atual)
        } else await salvarTema(raiz, { ...t, baseVersion: base.version, version: t.version + 1 })
        n++
      }
      setRes({ n, conflitos })
    } catch (e) { setRes({ n: 0, conflitos: [{ tema: '—', o: `não deu para atualizar: ${mensagemDeErro(e)}` }] }) } finally { setOcupado(false) }
  }
  // agrupa: "3 temas tinham ajuste no texto NOME…"
  const grupos = res ? [...res.conflitos.reduce((m, c) => m.set(c.o, [...(m.get(c.o) ?? []), c.tema]), new Map<string, string[]>())] : []
  return (
    <div className="space-y-1 text-[11px]" data-atualizar-temas>
      <button className={btn} disabled={ocupado || !raiz} onClick={() => void atualizar()} title="Liga cada tema desta base à versão atual dela e salva" data-atualizar-todos-temas><RefreshCw className={`h-3 w-3 ${ocupado ? 'animate-spin' : ''}`} /> {ocupado ? 'Atualizando…' : 'Atualizar todos os temas desta base'}</button>
      {res && (
        <div className={`rounded-lg px-2 py-1 ${grupos.length ? 'border border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'bg-green-50 text-green-800'}`} data-resumo-atualizar-temas>
          <p>{res.n} tema(s) atualizado(s) para a versão {base.version}.{grupos.length ? ` ${grupos.length} conflito(s):` : ' Nenhum conflito.'}</p>
          {grupos.length > 0 && (
            <>
              {grupos.slice(0, ver ? 99 : 3).map(([o, ts]) => <p key={o}>• {ts.length} tema(s) tinham {o} {ver && <span className="text-gray-500">— {ts.join(', ')}</span>}</p>)}
              <button className="underline" onClick={() => setVer(v => !v)} data-ver-conflitos>{ver ? 'esconder' : 'ver quais'}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
