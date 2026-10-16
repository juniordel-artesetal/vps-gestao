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
import { criarTransicaoNaParte, criarTransicaoCorNaParte, criarTransicaoElementoNaParte, mudarTransicao } from './acoesVinculo'

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
  // o 2º papel (laranja) começa no lado de onde a transição vem e some suavemente na direção dela
  const ang: Record<DirecaoTransicao, number> = { baixo: 180, cima: 0, direita: 90, esquerda: 270, centro: 0 }
  const ini = Math.max(0, (tr.pos - tr.soft / 2) * 100), fim = Math.min(100, (tr.pos + tr.soft / 2) * 100)
  const fundo = tr.dir === 'centro' ? `radial-gradient(circle, #fb923c ${ini}%, #e5e7eb ${fim}%)` : `linear-gradient(${ang[tr.dir]}deg, #fb923c ${ini}%, #e5e7eb ${fim}%)`
  return <div className="h-10 w-full rounded border border-gray-200" style={{ background: fundo }} title="Prévia: laranja = 2º papel, cinza = o de baixo" data-previa-transicao />
}

export default function PainelTransicao({ partId, onCriada, sempreAberto = false }: { partId: string; onCriada?: () => void; sempreAberto?: boolean }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [aberto, setAberto] = useState(sempreAberto)
  const [papeis, setPapeis] = useState<string[]>([])
  const [elementos, setElementos] = useState<string[]>([])
  const [tr, setTr] = useState<Transicao>(TRANSICAO_PADRAO)
  // Lote 21 (item 250): o 2º item da transição — papel, cor (ou cor para cor) ou elemento
  const [tipo, setTipo] = useState<'papel' | 'cor' | 'elemento'>('papel')
  const [cor, setCor] = useState('#1e3a8a')
  const [corParaCor, setCorParaCor] = useState(false)
  const [corBaixo, setCorBaixo] = useState('#bfdbfe')
  const [, setV] = useState(0)
  useEffect(() => {
    if (!aberto || !raiz || !liberada) return
    let vivo = true
    const pasta = tipo === 'elemento' ? 'Elementos' : 'Papéis'
    if (tipo === 'cor') return
    listarImagens(raiz, pasta).then(async l => { if (!vivo) return; (tipo === 'elemento' ? setElementos : setPapeis)(l); for (const p of l.slice(0, 40)) { await infoImagem(raiz, p).catch(() => null); if (vivo) setV(v => v + 1) } })
    return () => { vivo = false }
  }, [aberto, raiz, liberada, tipo])
  async function escolher(path: string) {
    if (!raiz) return
    const i = await infoImagem(raiz, path)
    if (tipo === 'elemento') criarTransicaoElementoNaParte(partId, i, tr)
    else criarTransicaoNaParte(partId, i, tr)
    setAberto(false); onCriada?.()
  }
  function aplicarCor() {
    criarTransicaoCorNaParte(partId, cor, tr, corParaCor ? corBaixo : undefined)
    setAberto(false); onCriada?.()
  }
  const lista = tipo === 'elemento' ? elementos : papeis
  if (!aberto) return <button className={btn} onClick={() => setAberto(true)} disabled={!liberada} title="Transição — o 2º papel aparece por cima e some suavemente, revelando o de baixo" data-abrir-transicao><Blend className="w-3.5 h-3.5" /> Transição</button>
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-2 space-y-1.5" data-painel-transicao>
      <p className="text-xs font-semibold flex items-center gap-1"><Blend className="w-3.5 h-3.5" /> Transição de papéis</p>
      <ControlesTransicao tr={tr} onMudar={p => setTr(t => ({ ...t, ...p }))} />
      <PreviaTransicao tr={tr} />
      {/* Lote 21 (item 250): o que entra por cima — papel, cor (ou cor para cor) ou elemento */}
      <div className="flex gap-0.5 rounded-lg bg-white/70 p-0.5" role="tablist" data-tipo-transicao>
        {([['papel', 'Papel'], ['cor', 'Cor'], ['elemento', 'Elemento']] as const).map(([v, r]) => (
          <button key={v} role="tab" aria-selected={tipo === v} onClick={() => setTipo(v)} className={`flex-1 rounded-md px-1 py-0.5 text-[11px] font-semibold ${tipo === v ? 'bg-orange-500 text-white' : 'text-gray-600 hover:text-gray-900'}`} data-tipo-transicao-opcao={v}>{r}</button>
        ))}
      </div>
      {tipo === 'cor' ? (
        <div className="space-y-1.5" data-transicao-cor>
          <label className="flex items-center gap-2 text-[11px] text-gray-600">Cor que entra por cima <input type="color" value={cor} onChange={e => setCor(e.target.value)} className="h-6 w-8 rounded border border-gray-200" data-cor-transicao /></label>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600"><input type="checkbox" checked={corParaCor} onChange={e => setCorParaCor(e.target.checked)} className="accent-orange-500" data-cor-para-cor /> Cor para cor (sem papel embaixo)</label>
          {corParaCor && <label className="flex items-center gap-2 text-[11px] text-gray-600">Cor de baixo <input type="color" value={corBaixo} onChange={e => setCorBaixo(e.target.value)} className="h-6 w-8 rounded border border-gray-200" data-cor-baixo-transicao /></label>}
          <button className={btn + ' !border-orange-500 bg-orange-500 text-white'} onClick={aplicarCor} data-aplicar-transicao-cor>Aplicar a transição de cor</button>
        </div>
      ) : <>
      <p className="text-[11px] text-gray-500">{tipo === 'elemento' ? 'Escolha o elemento (ondas, nuvens, grama, flores…) — ele entra preso ao lado de onde a transição vem, com a borda suave:' : 'Escolha o 2º papel (entra por cima do atual):'}</p>
      <div className="grid grid-cols-5 gap-1 max-h-32 overflow-y-auto">
        {lista.map(p => {
          const i = infoEmCache(p)
          return (
            <button key={p} className="aspect-square rounded border border-gray-200 bg-white overflow-hidden hover:border-orange-400" title={p.split('/').pop()} onClick={() => escolher(p)} data-papel-transicao={p} data-item-transicao={tipo}>
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
              {i ? <img src={i.url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] text-gray-400">{p.split('/').pop()}</span>}
            </button>
          )
        })}
        {!lista.length && <p className="col-span-5 text-[11px] text-gray-400">{tipo === 'elemento' ? 'Nenhum elemento em Elementos/.' : 'Nenhum papel em Papéis/.'}</p>}
      </div>
      </>}
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
