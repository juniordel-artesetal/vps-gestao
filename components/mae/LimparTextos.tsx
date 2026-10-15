'use client'
// Lote 18 (item 215): LIMPAR TEXTOS REPETIDOS da base — o 2º "Nome + idade" do rótulo Nutella nasceu de um
// "Duplicar" num tema e foi parar nos 47 temas da base. Mostra antes a lista dos temas onde o repetido aparece (caixa
// de marcar, desmarcadas); os marcados ficam com ele como TEXTO DO TEMA (posição e ajuste preservados); dos outros ele
// sai. A base sobe de versão e salva; os temas mexidos também (computador + nuvem).
import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import type { DocTema } from '@/lib/mae/schema'
import { textosRepetidos, repetidoVisivelEm, limparTextosRepetidos } from '@/lib/mae/vinculo/textosDoTema'
import { rotuloVariavel } from '@/lib/mae/texto/variaveis'
import { gravar } from '@/lib/mae/biblioteca/arquivos'
import { listarTemas, salvarBase, salvarTema } from './arquivosMae'
import { mensagemDeErro } from '@/lib/mae/erros'
import { avisar } from './estado'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium hover:border-orange-400 disabled:opacity-40'

export default function LimparTextos() {
  const base = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz)
  const reps = useMemo(() => textosRepetidos(base), [base])
  const [lista, setLista] = useState<{ temas: DocTema[]; marcados: Record<string, string[]> } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!reps.length && !msg) return null
  const nomeFace = (faceId: string) => base.molds.find(m => m.faces.some(f => f.id === faceId))?.name ?? 'peça'

  async function abrirLista() {
    if (!raiz) { avisar('Conecte a pasta Biblioteca MAE para limpar.'); return }
    setOcupado(true)
    try {
      const aberto = useMaeTema.getState().hist?.atual as DocTema | undefined
      const temas = (await listarTemas(raiz)).map(t => t.doc).filter(t => t.baseId === base.id).map(t => aberto?.id === t.id ? aberto : t)
      if (aberto && aberto.baseId === base.id && !temas.some(t => t.id === aberto.id)) temas.push(aberto)
      setLista({ temas, marcados: {} })
    } catch (e) { setMsg(`Não deu para listar os temas: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }
  async function limpar() {
    if (!raiz || !lista) return
    setOcupado(true)
    try {
      const atual = useMaeDoc.getState().hist.atual
      // cópia de segurança (a base e os temas como estavam) antes de mexer
      const carimbo = new Date().toISOString().replace(/[:.]/g, '-')
      await gravar(raiz, `Lixeira/Backups/${atual.id}-v${atual.version}-${carimbo}.json`, JSON.stringify({ base: atual, temas: lista.temas }, null, 1))
      const d = JSON.parse(JSON.stringify({ textSlots: atual.textSlots })) as { textSlots: typeof atual.textSlots }
      const ids = reps.flatMap(r => r.repetidos.map(s => s.id))
      const mudados = limparTextosRepetidos(d, lista.temas, ids, lista.marcados)
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
      const ficaram = new Set(Object.values(lista.marcados).flat()).size
      setMsg(`Pronto: ${ids.length} texto(s) repetido(s) saíram da base (agora na versão ${nova.version}).${ficaram ? ` ${ficaram} tema(s) ficaram com o texto como texto só deles.` : ''} ${mudados.length} tema(s) salvos.`)
      setLista(null)
    } catch (e) { setMsg(`Não deu para limpar: ${mensagemDeErro(e)}. A cópia de segurança está em Lixeira/Backups.`) } finally { setOcupado(false) }
  }

  if (msg && !reps.length) return <p className="rounded-lg bg-green-50 px-2 py-1.5 text-[11px] text-green-800" data-limpar-textos-ok>{msg} <button className="text-gray-400" onClick={() => setMsg(null)} aria-label="Fechar">×</button></p>
  return (
    <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] dark:bg-amber-950/30" data-aviso-textos-repetidos>
      {reps.map(r => (
        <p key={r.manter.id} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          <span>A base tem {r.repetidos.length + 1} <b>{rotuloVariavel(r.manter.variable)}</b> no {nomeFace(r.manter.faceId)} — o de baixo aparece em todos os temas que não o ocultaram.</span></p>
      ))}
      {msg && <p className="text-red-700">{msg}</p>}
      {!lista && <button className={btn + ' !border-amber-500'} disabled={ocupado} onClick={() => void abrirLista()} data-limpar-textos>{ocupado ? 'Lendo os temas…' : 'Limpar textos repetidos'}</button>}
      {lista && reps.map(r => r.repetidos.map(s => {
        const onde = lista.temas.filter(t => repetidoVisivelEm(t, s.id))
        const marc = lista.marcados[s.id] ?? []
        return (
          <div key={s.id} className="space-y-0.5 rounded border border-amber-200 bg-white p-1.5 dark:bg-gray-900" data-lista-repetido={s.id}>
            <p>O 2º <b>{rotuloVariavel(s.variable)}</b> aparece em <b>{onde.length}</b> tema(s). <b>Ele vai SAIR de todos.</b> Marque só os temas que devem <b>CONTINUAR com dois</b> (ex.: Ursinhos, que tem 2 nomes de propósito).</p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {onde.map(t => (
                <label key={t.id} className="flex items-center gap-1.5" data-tema-repetido={t.name ?? t.id}>
                  <input type="checkbox" checked={marc.includes(t.id)} onChange={e => setLista(l => l && ({ ...l, marcados: { ...l.marcados, [s.id]: e.target.checked ? [...marc, t.id] : marc.filter(x => x !== t.id) } }))} />
                  {t.name ?? t.id}{marc.includes(t.id) && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">fica com 2</span>}
                </label>
              ))}
              {!onde.length && <p className="text-gray-500">Nenhum tema mostra este texto — ele só sai da base.</p>}
            </div>
          </div>
        )
      }))}
      {lista && (
        <div className="flex gap-1">
          <button className={btn + ' !border-amber-500 bg-amber-100'} disabled={ocupado} onClick={() => {
            // Lote 18 (pós-uso real): marcar = MANTER — a Naty marcou todos achando que era limpar; agora confirma com a conta
            const ficam = new Set(Object.values(lista.marcados).flat()).size, total = new Set(reps.flatMap(r => r.repetidos.flatMap(s => lista.temas.filter(t => repetidoVisivelEm(t, s.id)).map(t => t.id)))).size
            if (!confirm(`${total - ficam} tema(s) vão ficar com UM texto e ${ficam} vão CONTINUAR com dois.${ficam > 3 ? '\n\nAtenção: marcar = MANTER os dois. É isso mesmo?' : ''}`)) return
            void limpar()
          }} data-confirmar-limpar>{ocupado ? 'Limpando…' : 'Limpar e salvar'}</button>
          <button className={btn} disabled={ocupado} onClick={() => setLista(null)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
