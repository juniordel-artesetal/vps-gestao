'use client'
// components/MapeamentoColunas.tsx — passo de de-para (proposta da IA + edição manual).
import { Sparkles, AlertTriangle } from 'lucide-react'
import type { CampoImport } from '@/lib/mapeamentoImport'

export default function MapeamentoColunas({
  campos, headers, valor, onChange, iaUsada,
}: {
  campos: CampoImport[]
  headers: string[]
  valor: Record<string, string>
  onChange: (v: Record<string, string>) => void
  iaUsada: boolean
}) {
  const set = (campo: string, col: string) => onChange({ ...valor, [campo]: col })
  const faltaObrig = campos.some(c => c.obrig && !valor[c.campo])

  return (
    <div className="space-y-3">
      <div className={`rounded-xl px-4 py-3 border ${iaUsada ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800' : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-800'}`}>
        <p className={`text-xs flex items-start gap-2 ${iaUsada ? 'text-purple-700 dark:text-purple-300' : 'text-yellow-700 dark:text-yellow-400'}`}>
          {iaUsada
            ? <><Sparkles size={14} className="flex-shrink-0 mt-0.5" /><span>A IA sugeriu o mapeamento abaixo a partir do cabeçalho e de uma amostra. Confira e ajuste o que precisar antes de importar.</span></>
            : <><AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /><span>Não foi possível usar a IA agora — indique manualmente qual coluna da planilha corresponde a cada campo.</span></>}
        </p>
      </div>

      <div className="space-y-2">
        {campos.map(c => (
          <div key={c.campo} className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2">
            <div className="w-[45%] min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{c.campo}{c.obrig && <span className="text-red-500 ml-1">*</span>}</p>
              <p className="text-[11px] text-gray-400 truncate">{c.desc}</p>
            </div>
            <span className="text-gray-300 flex-shrink-0">←</span>
            <select value={valor[c.campo] || ''} onChange={e => set(c.campo, e.target.value)}
              className={`flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ${c.obrig && !valor[c.campo] ? 'border-red-300' : 'border-gray-200 dark:border-gray-700'}`}>
              <option value="">— ignorar —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>

      {faltaObrig && (
        <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> Mapeie os campos obrigatórios (*) para continuar.</p>
      )}
    </div>
  )
}
