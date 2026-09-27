'use client'
// SOA Design — opções do campo HASHTAG como controles (nunca como texto visível): # na frente, minúsculas, sem espaço,
// sem acento, só o 1º nome, com a idade + conector. Mostra a amostra ("#sophiafaz4") e o exemplo longo.
import { aplicar, modeloHashtag, type OpcoesHashtag } from '@/lib/estudio/tipos'

export default function PainelHashtag({ opcoes, onMudar }: { opcoes: OpcoesHashtag; onMudar: (o: OpcoesHashtag) => void }) {
  const set = (p: Partial<OpcoesHashtag>) => onMudar({ ...opcoes, ...p })
  const caixa = (k: keyof OpcoesHashtag, rot: string) => (
    <label className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
      <input type="checkbox" className="accent-orange-500" checked={!!opcoes[k]} onChange={e => set({ [k]: e.target.checked, ...(k === 'minusculas' && e.target.checked ? { maiusculas: false } : k === 'maiusculas' && e.target.checked ? { minusculas: false } : {}) })} /> {rot}
    </label>
  )
  const modelo = modeloHashtag(opcoes)
  return (
    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 p-2 space-y-1.5" data-painel-hashtag>
      <p className="text-[11px] font-semibold text-orange-800 dark:text-orange-200"># Campo hashtag</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {caixa('prefixo', '# na frente')}{caixa('minusculas', 'minúsculas')}{caixa('maiusculas', 'MAIÚSCULAS')}{caixa('semEspaco', 'sem espaço')}{caixa('semAcento', 'sem acento')}{caixa('primeiroNome', 'só o 1º nome')}{caixa('idade', 'com a idade')}
      </div>
      {opcoes.idade && (
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">entre o nome e a idade
          <input value={opcoes.conector} onChange={e => set({ conector: e.target.value.replace(/[{}|]/g, '').slice(0, 12) })} className="w-16 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-[11px] bg-white dark:bg-gray-800" />
        </label>
      )}
      <p className="text-[10px] text-gray-500">Sai assim: <b className="text-gray-800 dark:text-gray-100">{aplicar(modelo, { nome: 'Sophia', idade: '4' })}</b> · <b className="text-gray-800 dark:text-gray-100">{aplicar(modelo, { nome: 'Maria Eduarda', idade: '5' })}</b> — encolhe sozinho para caber na caixa.</p>
    </div>
  )
}
