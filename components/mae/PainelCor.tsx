'use client'
'use no memo'
// COR SÓLIDA como preenchimento da parte (Lote 1, item 7): seletor visual (tom e saturação do Chrome),
// conta-gotas (pega a cor de qualquer papel ou elemento na tela), hexa e a PALETA DO TEMA (cores usadas).
// Funciona como um papel: na FRENTE, preenche todas as frentes — ou só a caixa, com "Só nesta caixa".
import { useState } from 'react'
import { Pipette, PaintBucket } from 'lucide-react'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { aplicarCorNaParte } from './acoesVinculo'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const HEXA = /^#?([0-9a-fA-F]{6})$/

/** "#F7A8C8", "f7a8c8" → "#f7a8c8"; inválido → null. */
export function normalizarHexa(v: string): string | null {
  const m = v.trim().match(HEXA)
  return m ? `#${m[1].toLowerCase()}` : null
}

type ConstrutorConta = new () => { open: () => Promise<{ sRGBHex: string }> }

export default function PainelCor({ partId, nomeParte }: { partId: string; nomeParte: string }) {
  const paleta = useMaeTema(s => s.hist?.atual.palette ?? [])
  const [cor, setCor] = useState('#f7a8c8')
  const [texto, setTexto] = useState('#f7a8c8')
  const [msg, setMsg] = useState<string | null>(null)
  const conta = typeof window !== 'undefined' ? (window as unknown as { EyeDropper?: ConstrutorConta }).EyeDropper : undefined
  const escolher = (c: string) => { setCor(c); setTexto(c); setMsg(null) }
  async function contaGotas() {
    if (!conta) return
    try { const r = await new conta().open(); const h = normalizarHexa(r.sRGBHex); if (h) escolher(h) } catch { /* cancelou */ }
  }
  return (
    <div className="space-y-1.5" data-painel-cor>
      <div className="flex items-center gap-1.5">
        <input type="color" value={cor} onChange={e => escolher(e.target.value)} className="h-9 w-12 cursor-pointer" title="Escolher a cor (tom e saturação)" data-cor-seletor />
        <input value={texto} onChange={e => { setTexto(e.target.value); const h = normalizarHexa(e.target.value); if (h) { setCor(h); setMsg(null) } else setMsg('Hexa tem 6 dígitos, ex.: #F7A8C8') }} className="w-24 rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs font-mono" aria-label="Cor em hexa" data-cor-hexa />
        <button className={btn} onClick={contaGotas} disabled={!conta} title={conta ? 'Conta-gotas — clique em qualquer cor da arte' : 'Conta-gotas: use o Chrome ou o Edge atualizados'} data-conta-gotas><Pipette className="w-3.5 h-3.5" /></button>
      </div>
      {paleta.length > 0 && (
        <div className="flex flex-wrap gap-1" data-paleta-tema>
          {paleta.map(k => <button key={k} className="h-5 w-5 rounded border border-gray-300" style={{ background: k }} title={`Cor do tema ${k}`} onClick={() => escolher(k)} onDoubleClick={() => aplicarCorNaParte(partId, k)} data-cor-paleta={k} />)}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <button className={btn + ' !border-orange-400 bg-orange-50 text-orange-800'} onClick={() => aplicarCorNaParte(partId, cor)} title={`Preencher ${nomeParte} com a cor (troca o papel de fundo)`} data-aplicar-cor><PaintBucket className="w-3.5 h-3.5" /> Preencher {nomeParte}</button>
        <button className={btn} onClick={() => aplicarCorNaParte(partId, cor, true)} title="A cor entra por cima dos papéis (para transição ou máscara)" data-aplicar-cor-cima>Por cima</button>
      </div>
      {msg && <p className="text-[10px] text-red-600">{msg}</p>}
      <p className="text-[10px] text-gray-400">Clique numa caixa e escolha “Só nesta caixa” para colorir só ela. Duplo clique numa cor da paleta preenche direto.</p>
    </div>
  )
}
