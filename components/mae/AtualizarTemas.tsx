'use client'
// Lote 18 (item 218): "ATUALIZAR TODOS OS TEMAS DESTA BASE" — cada tema passa a apontar para a versão atual da base e
// é salvo. Lote 19 (item 244): o resultado só alarma quando ALGO MUDOU NA ARTE, em linguagem simples:
//  · ajuste de um texto que trocou de id na base (a idade "voltou para a posição da base") → "Recuperar meus ajustes"
//    (o MAE acha na versão antiga do tema onde o texto estava e passa o ajuste para o texto equivalente de agora);
//  · arte numa parte/face que saiu da base → aviso (a arte não aparece mais);
//  · ajuste antigo sem nenhum texto equivalente → informação discreta (nada muda no desenho).
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { conflitosTemaBase } from '@/lib/mae/vinculo/temaDaBase'
import { textoVale } from '@/lib/mae/vinculo/textosDoTema'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { mensagemDeErro } from '@/lib/mae/erros'
import { listarTemas, salvarTema } from './arquivosMae'
import { alterado } from './historicoGlobal'
import { sync } from './sincronia'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium hover:border-orange-400 disabled:opacity-40'
type Recuperavel = { temaId: string; tema: string; de: string; para: string; variavel: string }
type Resultado = { n: number; recuperaveis: Recuperavel[]; arteSumiu: { tema: string; o: string }[]; semPar: number }

export default function AtualizarTemas() {
  const base = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz)
  const [ocupado, setOcupado] = useState(false)
  const [res, setRes] = useState<Resultado | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ver, setVer] = useState(false)
  if (!base.molds.length) return null

  async function atualizar() {
    if (!raiz) return
    if (alterado('base')) { setRes(null); alert('Salve a base primeiro (os temas passam a apontar para a versão salva).'); return }
    setOcupado(true); setRes(null); setMsg(null)
    try {
      const aberto = useMaeTema.getState().hist?.atual as DocTema | undefined
      const temas = (await listarTemas(raiz)).map(t => t.doc).filter(t => t.baseId === base.id).map(t => (aberto?.id === t.id ? aberto : t))
      const antigas = new Map<number, DocTrabalho | null>()
      const versao = async (v: number) => { if (!antigas.has(v)) antigas.set(v, await sync.abrirBase(base.id, v).catch(() => null)); return antigas.get(v) ?? null }
      let n = 0, semPar = 0
      const recuperaveis: Recuperavel[] = [], arteSumiu: { tema: string; o: string }[] = []
      for (const t of temas) {
        const c = conflitosTemaBase(base, t)
        for (const p of c.partes) arteSumiu.push({ tema: t.name ?? t.id, o: `a arte da parte ${p} não aparece mais (a parte saiu da base)` })
        if (c.faces.length) arteSumiu.push({ tema: t.name ?? t.id, o: `a arte "só nesta caixa" de ${c.faces.length} face(s) que saíram da base não aparece mais` })
        if (c.textos.length) {
          const velha = t.baseVersion !== base.version ? await versao(t.baseVersion) : null
          for (const k of c.textos) {
            const antes = velha?.textSlots.find(s => s.id === k)
            const pares = antes ? base.textSlots.filter(s => textoVale(s, t.id) && s.variable === antes.variable && s.faceId === antes.faceId && !t.textSlotAdjust?.[s.id]) : []
            if (antes && pares.length === 1) recuperaveis.push({ temaId: t.id, tema: t.name ?? t.id, de: k, para: pares[0].id, variavel: antes.variable })
            else semPar++
          }
        }
        if (t.baseVersion === base.version) continue
        if (aberto?.id === t.id) {
          useMaeTema.getState().aplicar('Atualizar o tema para a versão atual da base', tt => { tt.baseVersion = base.version; tt.version += 1 })
          await salvarTema(raiz, useMaeTema.getState().hist!.atual)
        } else await salvarTema(raiz, { ...t, baseVersion: base.version, version: t.version + 1 })
        n++
      }
      setRes({ n, recuperaveis, arteSumiu, semPar })
    } catch (e) { setMsg(`Não deu para atualizar: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }
  async function recuperar() {
    if (!raiz || !res) return
    setOcupado(true)
    try {
      const porTema = new Map<string, Recuperavel[]>()
      for (const r of res.recuperaveis) porTema.set(r.temaId, [...(porTema.get(r.temaId) ?? []), r])
      const atuais = new Map((await listarTemas(raiz)).map(t => [t.doc.id, t.doc]))
      const aberto = useMaeTema.getState().hist?.atual
      for (const [id, rs] of porTema) {
        const passar = (tt: DocTema) => { for (const r of rs) { const a = tt.textSlotAdjust?.[r.de]; if (!a) continue; (tt.textSlotAdjust ??= {})[r.para] = a; delete tt.textSlotAdjust[r.de] } }
        if (aberto?.id === id) { useMaeTema.getState().aplicar('Recuperar meus ajustes', tt => { passar(tt as DocTema); tt.version += 1 }); await salvarTema(raiz, useMaeTema.getState().hist!.atual); continue }
        const t = atuais.get(id); if (!t) continue
        const c = JSON.parse(JSON.stringify(t)) as DocTema; passar(c); c.version += 1
        await salvarTema(raiz, c)
      }
      setMsg(`Ajustes recuperados em ${porTema.size} tema(s).`)
      setRes(r => r && { ...r, recuperaveis: [] })
    } catch (e) { setMsg(`Não deu para recuperar: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }

  const temasRec = res ? [...new Set(res.recuperaveis.map(r => r.tema))] : []
  const vars = res ? [...new Set(res.recuperaveis.map(r => rotuloVariavel(r.variavel).toLowerCase()))] : []
  const alarme = !!res && (res.recuperaveis.length > 0 || res.arteSumiu.length > 0)
  return (
    <div className="space-y-1 text-[11px]" data-atualizar-temas>
      <button className={btn} disabled={ocupado || !raiz} onClick={() => void atualizar()} title="Liga cada tema desta base à versão atual dela e salva" data-atualizar-todos-temas><RefreshCw className={`h-3 w-3 ${ocupado ? 'animate-spin' : ''}`} /> {ocupado ? 'Atualizando…' : 'Atualizar todos os temas desta base'}</button>
      {msg && <p className={msg.startsWith('Não deu') ? 'text-red-600' : 'text-emerald-700'} data-msg-atualizar-temas>{msg}</p>}
      {res && (
        <div className={`space-y-1 rounded-lg px-2 py-1 ${alarme ? 'border border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'bg-green-50 text-green-800'}`} data-resumo-atualizar-temas>
          <p>{res.n ? `${res.n} tema(s) passaram para a versão ${base.version}.` : `Todos os temas desta base já estão na versão ${base.version}.`}</p>
          {temasRec.length > 0 && (
            <div data-recuperar-ajustes>
              <p>No{temasRec.length > 1 ? 's' : ''} tema{temasRec.length > 1 ? 's' : ''} <b>{temasRec.slice(0, 3).join(', ')}{temasRec.length > 3 ? ` e mais ${temasRec.length - 3}` : ''}</b>, {vars.join(' e ')} voltou para a posição da base. Recuperar o seu ajuste?</p>
              <button className={btn + ' mt-0.5 !border-amber-500 bg-amber-100'} disabled={ocupado} onClick={() => void recuperar()} data-confirmar-recuperar>Recuperar meus ajustes</button>
            </div>
          )}
          {res.arteSumiu.slice(0, ver ? 99 : 3).map((a, i) => <p key={i}>No tema <b>{a.tema}</b>, {a.o}.</p>)}
          {res.arteSumiu.length > 3 && <button className="underline" onClick={() => setVer(v => !v)}>{ver ? 'esconder' : `ver os outros ${res.arteSumiu.length - 3}`}</button>}
          {res.semPar > 0 && <p className="text-[10px] text-gray-500" data-ajustes-sem-par>{res.semPar} ajuste(s) antigo(s) de textos que não existem mais na base (nada muda na arte).</p>}
        </div>
      )}
    </div>
  )
}
