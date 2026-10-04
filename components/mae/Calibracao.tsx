'use client'
// Calibração da tela para o zoom "tamanho real": o navegador não informa o tamanho físico do pixel,
// então a usuária encosta um cartão de crédito (85,6 mm) na tela e ajusta a barra até as larguras
// baterem. O fator (px CSS por mm físico) fica salvo neste computador (localStorage).
import { useState } from 'react'
import { CARTAO_MM, CALIBRACAO_PADRAO } from '@/lib/mae/render'

const CHAVE = 'mae:calibracao'

export function lerCalibracao(): number {
  try { const v = Number(localStorage.getItem(CHAVE)); return v > 0.5 && v < 20 ? v : CALIBRACAO_PADRAO } catch { return CALIBRACAO_PADRAO }
}

export default function Calibracao({ atual, onFechar, onSalvar }: { atual: number; onFechar: () => void; onSalvar: (k: number) => void }) {
  const [k, setK] = useState(atual)
  const salvar = (v: number) => { try { localStorage.setItem(CHAVE, String(v)) } catch { /* sem localStorage: vale só nesta sessão */ } onSalvar(v) }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-4" onClick={e => e.stopPropagation()} data-calibracao>
        <h3 className="font-semibold text-gray-900 dark:text-white">Calibrar a tela (tamanho real)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">Encoste um <b>cartão de crédito</b> na tela, sobre a barra laranja, e ajuste até a barra ficar <b>exatamente</b> da largura do cartão ({CARTAO_MM.toString().replace('.', ',')} mm).</p>
        <div className="h-14 rounded bg-orange-500/90" style={{ width: `${k * CARTAO_MM}px` }} data-barra-cartao />
        <div className="flex items-center gap-2">
          <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setK(v => Math.max(1, +(v - 0.01).toFixed(3)))}>−</button>
          <input type="range" min={2} max={8} step={0.005} value={k} onChange={e => setK(Number(e.target.value))} className="flex-1 accent-orange-500" aria-label="Largura da barra" />
          <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setK(v => Math.min(12, +(v + 0.01).toFixed(3)))}>+</button>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button className="text-xs text-gray-500 mr-auto underline" onClick={() => salvar(CALIBRACAO_PADRAO)}>Voltar ao padrão</button>
          <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={onFechar}>Cancelar</button>
          <button className="rounded-lg bg-orange-500 text-white px-3 py-1.5 text-sm font-semibold" onClick={() => salvar(k)} data-salvar-calibracao>Salvar</button>
        </div>
      </div>
    </div>
  )
}
