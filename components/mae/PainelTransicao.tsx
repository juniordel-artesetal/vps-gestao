'use client'
'use no memo'
// TRANSIÇÃO DE PAPÉIS (Lote 1, item 5): escolher o 2º papel → direção → posição e suavidade, com a prévia
// mudando na hora. Por baixo é uma camada de papel com máscara em degradê (dá para refinar no pincel).
import Deslizador from './Deslizador'
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowRight, ArrowLeft, CircleDot, Blend } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { NOMES_DIRECAO, TRANSICAO_PADRAO, type DirecaoTransicao, type Transicao } from '@/lib/mae/vinculo/transicao'
import { infoImagem, infoEmCache, listarImagens } from './arquivosMae'
import { criarTransicaoNaParte, mudarTransicao } from './acoesVinculo'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativo = ' !border-orange-500 bg-orange-50 text-orange-800'
const ICONES: Record<DirecaoTransicao, typeof ArrowDown> = { baixo: ArrowDown, cima: ArrowUp, direita: ArrowRight, esquerda: ArrowLeft, centro: CircleDot }

/** Direção + posição + suavidade de uma transição (a já criada, ou a que vai ser criada). */
export function ControlesTransicao({ tr, onMudar }: { tr: Transicao; onMudar: (p: Partial<Transicao>, juntar?: string) => void }) {
  return (
    <div className="space-y-1.5" data-controles-transicao>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(NOMES_DIRECAO) as DirecaoTransicao[]).map(d => {
          const I = ICONES[d]
          return <button key={d} className={btn + ' !px-1.5' + (tr.dir === d ? ativo : '')} title={NOMES_DIRECAO[d]} aria-label={NOMES_DIRECAO[d]} onClick={() => onMudar({ dir: d })} data-direcao={d}><I className="w-3.5 h-3.5" /></button>
        })}
      </div>
      <label className="block text-[11px] text-gray-500">
        <span className="flex justify-between"><span>Posição (onde a transição acontece)</span></span>
        <Deslizador min={0} max={1} step={0.01} value={tr.pos} onChange={e => onMudar({ pos: Number(e.target.value) }, 'pos')} unidade="%" fator={100} data-transicao-pos />
      </label>
      <label className="block text-[11px] text-gray-500">
        <span className="flex justify-between"><span>Suavidade</span></span>
        <Deslizador min={0.02} max={1} step={0.01} value={tr.soft} onChange={e => onMudar({ soft: Number(e.target.value) }, 'soft')} unidade="%" fator={100} data-transicao-suave />
      </label>
    </div>
  )
}

/** Painel "Transição" da parte: escolhe o 2º papel e cria (depois os controles editam a camada criada). */
/** Lote 4 (item 45): prévia da transição — o papel de baixo (cinza) e o 2º papel (laranja) sumindo na direção. */
export function PreviaTransicao({ tr }: { tr: Transicao }) {
  const ang: Record<string, number> = { 'cima-baixo': 180, 'baixo-cima': 0, 'esq-dir': 90, 'dir-esq': 270 }
  const a = ang[tr.dir as string] ?? 180
  const ini = Math.max(0, (tr.pos - tr.soft / 2) * 100), fim = Math.min(100, (tr.pos + tr.soft / 2) * 100)
  return <div className="h-10 w-full rounded border border-gray-200" style={{ background: `linear-gradient(${a}deg, #fb923c ${ini}%, #e5e7eb ${fim}%)` }} title="Prévia: laranja = 2º papel, cinza = o de baixo" data-previa-transicao />
}

export default function PainelTransicao({ partId, onCriada, sempreAberto = false }: { partId: string; onCriada?: () => void; sempreAberto?: boolean }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [aberto, setAberto] = useState(sempreAberto)
  const [papeis, setPapeis] = useState<string[]>([])
  const [tr, setTr] = useState<Transicao>(TRANSICAO_PADRAO)
  const [, setV] = useState(0)
  useEffect(() => {
    if (!aberto || !raiz || !liberada) return
    let vivo = true
    listarImagens(raiz, 'Papéis').then(async l => { if (!vivo) return; setPapeis(l); for (const p of l.slice(0, 40)) { await infoImagem(raiz, p).catch(() => null); if (vivo) setV(v => v + 1) } })
    return () => { vivo = false }
  }, [aberto, raiz, liberada])
  async function escolher(path: string) {
    if (!raiz) return
    const i = await infoImagem(raiz, path)
    criarTransicaoNaParte(partId, i, tr)
    setAberto(false); onCriada?.()
  }
  if (!aberto) return <button className={btn} onClick={() => setAberto(true)} disabled={!liberada} title="Transição — o 2º papel aparece por cima e some suavemente, revelando o de baixo" data-abrir-transicao><Blend className="w-3.5 h-3.5" /> Transição</button>
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-2 space-y-1.5" data-painel-transicao>
      <p className="text-xs font-semibold flex items-center gap-1"><Blend className="w-3.5 h-3.5" /> Transição de papéis</p>
      <ControlesTransicao tr={tr} onMudar={p => setTr(t => ({ ...t, ...p }))} />
      <PreviaTransicao tr={tr} />
      <p className="text-[11px] text-gray-500">Escolha o 2º papel (entra por cima do atual):</p>
      <div className="grid grid-cols-5 gap-1 max-h-32 overflow-y-auto">
        {papeis.map(p => {
          const i = infoEmCache(p)
          return (
            <button key={p} className="aspect-square rounded border border-gray-200 bg-white overflow-hidden hover:border-orange-400" title={p.split('/').pop()} onClick={() => escolher(p)} data-papel-transicao={p}>
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
              {i ? <img src={i.url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] text-gray-400">{p.split('/').pop()}</span>}
            </button>
          )
        })}
        {!papeis.length && <p className="col-span-5 text-[11px] text-gray-400">Nenhum papel em Papéis/.</p>}
      </div>
      {!sempreAberto && <button className={btn} onClick={() => setAberto(false)}>Cancelar</button>}
    </div>
  )
}

/** Controles da transição JÁ criada (camada selecionada). */
export function EditarTransicao({ layerId, tr }: { layerId: string; tr: Transicao }) {
  return (
    <div className="rounded-lg border border-orange-200 p-1.5 space-y-1" data-editar-transicao>
      <p className="text-[11px] font-semibold flex items-center gap-1"><Blend className="w-3 h-3" /> Transição</p>
      <ControlesTransicao tr={tr} onMudar={(p, j) => mudarTransicao(layerId, p, j ? `tr:${layerId}:${j}` : undefined)} />
      <PreviaTransicao tr={tr} />
      <p className="text-[10px] text-gray-400">Para refinar, pinte a máscara (Máscara → Pintar).</p>
    </div>
  )
}
