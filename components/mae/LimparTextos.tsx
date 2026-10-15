'use client'
// Lote 18 (item 215) / Lote 19 (itens 232/243): TEXTOS NO MESMO LUGAR — dois textos iguais um em cima do outro (o 2º
// "Nome + idade" do rótulo Nutella). Só avisa quando estão no mesmo lugar (±2 mm); o mesmo nome em faces diferentes é
// intencional. A janela tem DUAS COLUNAS claras — "Tirar o 2º" (todos, por padrão) e "Manter 2" (só os escolhidos, ex.:
// Ursinhos) —, resumo antes de aplicar e "Desfazer" por 30 dias (a cópia de segurança fica em Lixeira/Backups).
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, RotateCcw } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { textosRepetidos, repetidoVisivelEm, limparTextosRepetidos, chaveDoPar } from '@/lib/mae/vinculo/textosDoTema'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { gravar, ler, listar } from '@/lib/mae/biblioteca/arquivos'
import { listarTemas, salvarBase, salvarTema } from './arquivosMae'
import { mensagemDeErro } from '@/lib/mae/erros'
import { avisar } from './estado'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium hover:border-orange-400 disabled:opacity-40'
const PASTA = 'Lixeira/Backups'
const TRINTA_DIAS = 30 * 86400_000

export default function LimparTextos() {
  const base = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz)
  const reps = useMemo(() => textosRepetidos(base as never), [base])
  // por repetido: os temas onde ele aparece e os que MANTÊM os dois
  const [lista, setLista] = useState<{ temas: DocTema[]; manter: Record<string, string[]> } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [backup, setBackup] = useState<{ arquivo: string; em: number } | null>(null)
  useEffect(() => {
    if (!raiz) return
    let vivo = true
    void listar(raiz, PASTA).then(es => {
      const meus = es.filter(e => e.tipo === 'arquivo' && e.nome.startsWith(`${base.id}-`)).map(e => ({ arquivo: `${PASTA}/${e.nome}`, em: Date.parse(e.nome.slice(-29, -5).replace(/-(\d\d)-(\d\d)-(\d{3})Z$/, ':$1:$2.$3Z').replace(/T(\d\d)-/, 'T$1:')) }))
        .filter(x => Number.isFinite(x.em) && Date.now() - x.em < TRINTA_DIAS).sort((a, b) => b.em - a.em)
      if (vivo) setBackup(meus[0] ?? null)
    }).catch(() => null)
    return () => { vivo = false }
  }, [raiz, base.id, msg])
  if (!reps.length && !msg && !backup) return null
  const nomeFace = (faceId: string) => base.molds.find(m => m.faces.some(f => f.id === faceId))?.name ?? 'peça'

  async function abrirLista() {
    if (!raiz) { avisar('Conecte a pasta Biblioteca MAE para limpar.'); return }
    setOcupado(true)
    try {
      const aberto = useMaeTema.getState().hist?.atual as DocTema | undefined
      const temas = (await listarTemas(raiz)).map(t => t.doc).filter(t => t.baseId === base.id).map(t => (aberto?.id === t.id ? aberto : t))
      if (aberto && aberto.baseId === base.id && !temas.some(t => t.id === aberto.id)) temas.push(aberto)
      setLista({ temas, manter: {} })
    } catch (e) { setMsg(`Não deu para listar os temas: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }
  function naoAvisar() {
    useMaeDoc.getState().aplicar('Textos no mesmo lugar: está certo assim', d => {
      const x = d as DocTrabalho & { textosRepetidosOk?: string[] }
      x.textosRepetidosOk = [...new Set([...(x.textosRepetidosOk ?? []), ...reps.flatMap(r => r.repetidos.map(s => chaveDoPar(r.manter, s)))])]
    })
    setMsg('Combinado — não aviso mais sobre esses textos nesta base (salve a base).')
  }
  async function limpar() {
    if (!raiz || !lista) return
    const ids = reps.flatMap(r => r.repetidos.map(s => s.id))
    const todos = new Set(ids.flatMap(rid => lista.temas.filter(t => repetidoVisivelEm(t, rid)).map(t => t.id)))
    const ficam = new Set(Object.values(lista.manter).flat())
    const nomes = lista.temas.filter(t => ficam.has(t.id)).map(t => t.name ?? t.id)
    if (!confirm(`Vou tirar o 2º texto de ${todos.size - ficam.size} tema(s)${ficam.size ? ` e manter os dois em ${ficam.size} (${nomes.slice(0, 4).join(', ')}${nomes.length > 4 ? '…' : ''})` : ''}. Confirmar?\n\nDá para desfazer por 30 dias.`)) return
    setOcupado(true)
    try {
      const atual = useMaeDoc.getState().hist.atual
      // cópia de segurança (a base e os temas como estavam) — é o "Desfazer" por 30 dias
      const carimbo = new Date().toISOString().replace(/[:.]/g, '-')
      await gravar(raiz, `${PASTA}/${atual.id}-v${atual.version}-${carimbo}.json`, JSON.stringify({ base: atual, temas: lista.temas }, null, 1))
      const d = JSON.parse(JSON.stringify({ textSlots: atual.textSlots })) as { textSlots: typeof atual.textSlots }
      const mudados = limparTextosRepetidos(d, lista.temas, ids, lista.manter)
      useMaeDoc.getState().aplicar('Limpar textos repetidos', x => { x.textSlots = d.textSlots as never; x.version = (x.version ?? 0) + 1 })
      const nova = useMaeDoc.getState().hist.atual
      await salvarBase(raiz, nova)
      const aberto = useMaeTema.getState().hist?.atual
      for (const t of mudados) {
        if (aberto?.id === t.id) {
          useMaeTema.getState().aplicar('Limpar textos repetidos', tt => { tt.textSlotAdjust = t.textSlotAdjust as never; tt.version += 1; tt.baseVersion = nova.version })
          await salvarTema(raiz, useMaeTema.getState().hist!.atual)
        } else await salvarTema(raiz, { ...t, version: t.version + 1, baseVersion: nova.version })
      }
      setMsg(`Pronto: o 2º texto saiu de ${todos.size - ficam.size} tema(s)${ficam.size ? ` e ficou em ${ficam.size}` : ''} (base na versão ${nova.version}). Dá para desfazer por 30 dias.`)
      setLista(null)
    } catch (e) { setMsg(`Não deu para limpar: ${mensagemDeErro(e)}. A cópia de segurança está em ${PASTA}.`) } finally { setOcupado(false) }
  }
  async function desfazer() {
    if (!raiz || !backup) return
    if (!confirm('Voltar a base e os temas para como estavam antes da última limpeza de textos?')) return
    setOcupado(true)
    try {
      const b = JSON.parse(await (await ler(raiz, backup.arquivo)).text()) as { base: DocTrabalho; temas: DocTema[] }
      const atual = useMaeDoc.getState().hist.atual
      useMaeDoc.getState().aplicar('Desfazer a limpeza de textos', x => { x.textSlots = b.base.textSlots as never; x.version = (x.version ?? 0) + 1 })
      const nova = useMaeDoc.getState().hist.atual
      await salvarBase(raiz, nova)
      const agora = new Map((await listarTemas(raiz)).map(t => [t.doc.id, t.doc]))
      const aberto = useMaeTema.getState().hist?.atual
      for (const t of b.temas) {
        const v = Math.max(t.version, agora.get(t.id)?.version ?? 0) + 1
        if (aberto?.id === t.id) {
          useMaeTema.getState().aplicar('Desfazer a limpeza de textos', tt => { tt.textSlotAdjust = t.textSlotAdjust as never; tt.version = v; tt.baseVersion = nova.version })
          await salvarTema(raiz, useMaeTema.getState().hist!.atual)
        } else await salvarTema(raiz, { ...t, version: v, baseVersion: nova.version })
      }
      await gravar(raiz, backup.arquivo.replace(/\.json$/, '.desfeito.json'), await (await ler(raiz, backup.arquivo)).text())
      const { remover } = await import('@/lib/mae/biblioteca/arquivos'); await remover(raiz, backup.arquivo).catch(() => null)
      setMsg(`Desfeito: a base e ${b.temas.length} tema(s) voltaram como estavam (base na versão ${nova.version}).`); void atual
    } catch (e) { setMsg(`Não deu para desfazer: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }

  const desfazerBotao = backup && <button className={btn} disabled={ocupado} onClick={() => void desfazer()} data-desfazer-limpeza><RotateCcw className="h-3 w-3" /> Desfazer a última limpeza ({new Date(backup.em).toLocaleDateString('pt-BR')})</button>
  if (!reps.length) return (
    <div className="space-y-1 text-[11px]" data-limpar-textos-ok>
      {msg && <p className="rounded-lg bg-green-50 px-2 py-1.5 text-green-800">{msg} <button className="text-gray-400" onClick={() => setMsg(null)} aria-label="Fechar">×</button></p>}
      {desfazerBotao}
    </div>
  )
  return (
    <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] dark:bg-amber-950/30" data-aviso-textos-repetidos>
      {reps.map(r => (
        <p key={r.manter.id} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          <span>Encontrei {r.repetidos.length + 1} <b>{rotuloVariavel(r.manter.variable)}</b> no mesmo lugar no <b>{nomeFace(r.manter.faceId)}</b>, um em cima do outro. Quer tirar o de baixo?</span></p>
      ))}
      {msg && <p className="text-red-700">{msg}</p>}
      {!lista && (
        <div className="flex flex-wrap gap-1">
          <button className={btn + ' !border-amber-500'} disabled={ocupado} onClick={() => void abrirLista()} data-limpar-textos>{ocupado ? 'Lendo os temas…' : 'Tirar o texto repetido…'}</button>
          <button className={btn} onClick={naoAvisar} data-nao-avisar-repetido>Está certo assim, não avisar mais nesta base</button>
          {desfazerBotao}
        </div>
      )}
      {lista && reps.map(r => r.repetidos.map(s => {
        const onde = lista.temas.filter(t => repetidoVisivelEm(t, s.id))
        const manter = lista.manter[s.id] ?? []
        const mover = (id: string, paraManter: boolean) => setLista(l => l && ({ ...l, manter: { ...l.manter, [s.id]: paraManter ? [...manter, id] : manter.filter(x => x !== id) } }))
        const tirar = onde.filter(t => !manter.includes(t.id)), ficam = onde.filter(t => manter.includes(t.id))
        const coluna = (titulo: string, temas: DocTema[], paraManter: boolean, attr: string) => (
          <div className="min-w-0 flex-1 rounded border border-amber-200 bg-white p-1.5 dark:bg-gray-900" data-coluna={attr}>
            <p className="mb-0.5 font-semibold">{titulo} <span className="font-normal text-gray-500">({temas.length})</span></p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {temas.map(t => <button key={t.id} className="flex w-full items-center gap-1 rounded px-1 text-left hover:bg-amber-50" onClick={() => mover(t.id, paraManter)} title={paraManter ? 'Passar para "Manter 2"' : 'Passar para "Tirar o 2º"'} data-tema-repetido={t.name ?? t.id}><ArrowLeftRight className="h-3 w-3 shrink-0 text-gray-400" /><span className="truncate">{t.name ?? t.id}</span></button>)}
              {!temas.length && <p className="text-gray-400">—</p>}
            </div>
          </div>
        )
        return (
          <div key={s.id} className="space-y-1" data-lista-repetido={s.id}>
            <p>O 2º <b>{rotuloVariavel(s.variable)}</b> aparece em <b>{onde.length}</b> tema(s). Clique num tema para passar de uma coluna para a outra.</p>
            <div className="flex gap-1.5">
              {coluna(`Tirar o 2º ${rotuloVariavel(s.variable)}`, tirar, true, 'tirar')}
              {coluna('Manter 2', ficam, false, 'manter')}
            </div>
            <div className="flex gap-2 text-[10px]">
              <button className="underline" onClick={() => setLista(l => l && ({ ...l, manter: { ...l.manter, [s.id]: onde.map(t => t.id) } }))} data-manter-todos>Manter em todos</button>
              <button className="underline" onClick={() => setLista(l => l && ({ ...l, manter: { ...l.manter, [s.id]: [] } }))} data-manter-nenhum>Tirar de todos</button>
            </div>
          </div>
        )
      }))}
      {lista && (
        <div className="flex gap-1">
          <button className={btn + ' !border-amber-500 bg-amber-100'} disabled={ocupado} onClick={() => void limpar()} data-confirmar-limpar>{ocupado ? 'Aplicando…' : 'Aplicar'}</button>
          <button className={btn} disabled={ocupado} onClick={() => setLista(null)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
