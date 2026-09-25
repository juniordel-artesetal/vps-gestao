'use client'
// SOA Edition — FERRAMENTAS DE IA do editor (camada de imagem selecionada). O resultado entra como
// CAMADA NOVA acima da original, no mesmo lugar (não destrutivo). Cada ação de IA usa 1 imagem da cota
// (o servidor estorna se falhar); recolorir e o plano B do upscale são locais e não custam nada.
import { useState } from 'react'
import { Wand2, Eraser, Expand, ZoomIn, Palette, Loader2 } from 'lucide-react'
import { chamarIA, removerFundoIA, noTamanho, telaExpandir, upscaleLocal, recolorir, CUSTO_IA } from '@/lib/estudio/iaCliente'
import { novoCanvas } from '@/lib/estudio/mockup'

export type ResultadoIA = { canvas: HTMLCanvasElement; nome: string; modo: 'mesmo' | 'expandido' | 'ampliado'; margem?: number }

export default function PainelIA({ fonte, obterSelecao, onResultado, onCota }: {
  /** Pixels da camada (como aparece, sem efeitos). */
  fonte: () => HTMLCanvasElement | null
  /** Seleção atual sobre esta camada (alfa = selecionado), se houver. */
  obterSelecao: () => HTMLCanvasElement | null
  onResultado: (r: ResultadoIA) => void
  onCota?: () => void
}) {
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState<{ erro: boolean; t: string } | null>(null)
  const [cor, setCor] = useState('#f472b6')

  async function rodar(op: 'remover-fundo' | 'apagar' | 'expandir' | 'upscale' | 'recolorir') {
    const src = fonte()
    if (!src) return
    setMsg(null)
    if (op !== 'recolorir' && !confirm(CUSTO_IA)) return
    try {
      if (op === 'recolorir') {
        onResultado({ canvas: recolorir(src, obterSelecao(), cor, 100), nome: 'Recolorido', modo: 'mesmo' }); return
      }
      setOcupado('A IA está trabalhando…')
      if (op === 'remover-fundo') {
        const r = await removerFundoIA(src, false)   // sem aparar: a camada nova cai exatamente sobre a original
        onResultado({ canvas: noTamanho(r.canvas, src.width, src.height), nome: 'Sem fundo', modo: 'mesmo' })
        setMsg({ erro: false, t: r.aviso || 'Pronto — a camada sem fundo entrou acima da original.' })
      } else if (op === 'apagar') {
        const sel = obterSelecao()
        if (!sel) { setMsg({ erro: true, t: 'Selecione primeiro o que apagar (Seleção → retângulo, laço ou varinha) e clique de novo.' }); return }
        const m = novoCanvas(src.width, src.height), g = m.getContext('2d')!
        g.fillStyle = '#000'; g.fillRect(0, 0, m.width, m.height)
        const b = novoCanvas(src.width, src.height), gb = b.getContext('2d')!
        gb.drawImage(sel, 0, 0, b.width, b.height); gb.globalCompositeOperation = 'source-in'; gb.fillStyle = '#fff'; gb.fillRect(0, 0, b.width, b.height)
        g.drawImage(b, 0, 0)
        const r = await chamarIA('apagar', { imagem: src, mascara: m })
        if (!r.ok || !r.imagem) { setMsg({ erro: true, t: r.ok ? 'A IA não devolveu imagem (a imagem da cota voltou).' : r.mensagem }); return }
        onResultado({ canvas: noTamanho(r.imagem, src.width, src.height), nome: 'Objeto apagado', modo: 'mesmo' })
      } else if (op === 'expandir') {
        const margem = 0.15
        const W = Math.round(src.width * (1 + 2 * margem)), H = Math.round(src.height * (1 + 2 * margem))
        const r = await chamarIA('expandir', { imagem: telaExpandir(src, W, H) })
        if (!r.ok || !r.imagem) { setMsg({ erro: true, t: r.ok ? 'A IA não devolveu imagem (a imagem da cota voltou).' : r.mensagem }); return }
        onResultado({ canvas: noTamanho(r.imagem, W, H), nome: 'Expandida', modo: 'expandido', margem })
      } else {
        const r = await chamarIA('upscale', { imagem: src })
        if (r.ok && r.imagem && r.imagem.naturalWidth > src.width) onResultado({ canvas: noTamanho(r.imagem, r.imagem.naturalWidth, r.imagem.naturalHeight), nome: 'Ampliada (IA)', modo: 'ampliado' })
        else {
          onResultado({ canvas: upscaleLocal(src, 2), nome: 'Ampliada 2×', modo: 'ampliado' })
          setMsg({ erro: false, t: r.ok ? 'Ampliei aqui mesmo (2×, sem custo) — a IA não traria ganho real nesta imagem.' : `${r.mensagem} Ampliei aqui mesmo (2×, sem custo).` })
        }
      }
    } catch (e) { setMsg({ erro: true, t: (e as Error).message }) } finally { setOcupado(''); onCota?.() }
  }

  const b = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] hover:border-orange-400 disabled:opacity-50'
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-gray-500 flex items-center gap-1"><Wand2 className="w-3.5 h-3.5" /> IA <span className="text-gray-400 font-normal">(1 imagem da cota por uso)</span></p>
      <div className="flex flex-wrap gap-1">
        <button disabled={!!ocupado} onClick={() => rodar('remover-fundo')} className={b}><Wand2 className="w-3.5 h-3.5" /> Remover fundo</button>
        <button disabled={!!ocupado} onClick={() => rodar('apagar')} className={b} title="Selecione antes o que apagar"><Eraser className="w-3.5 h-3.5" /> Apagar seleção</button>
        <button disabled={!!ocupado} onClick={() => rodar('expandir')} className={b}><Expand className="w-3.5 h-3.5" /> Expandir</button>
        <button disabled={!!ocupado} onClick={() => rodar('upscale')} className={b}><ZoomIn className="w-3.5 h-3.5" /> Aumentar resolução</button>
      </div>
      <div className="flex items-center gap-1">
        <input type="color" value={cor} onChange={e => setCor(e.target.value)} className="w-7 h-6 rounded border border-gray-200" />
        <button disabled={!!ocupado} onClick={() => rodar('recolorir')} className={b} title="Na seleção atual, ou na camada inteira"><Palette className="w-3.5 h-3.5" /> Recolorir (grátis)</button>
      </div>
      {ocupado && <p className="text-[11px] text-gray-500 inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {ocupado}</p>}
      {msg && <p className={`text-[11px] ${msg.erro ? 'text-red-600' : 'text-gray-500'}`}>{msg.t}</p>}
    </div>
  )
}
