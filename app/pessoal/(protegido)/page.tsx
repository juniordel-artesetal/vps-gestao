// Home do módulo Pessoal (atrás do gate). Placeholder do Passo 1 — as telas
// (finanças/tarefas/notas) vêm nos próximos passos. Só chega aqui quem tem assinatura ATIVA.
export default function PessoalHome() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Meu Pessoal</h1>
      <p className="text-sm text-gray-500 dark:text-neutral-400">
        Sua assinatura está <b className="text-orange-600">ativa</b>. As telas de finanças pessoais,
        tarefas e notas chegam nos próximos passos.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Finanças', 'Tarefas', 'Notas'].map(m => (
          <div key={m} className="rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <p className="font-semibold text-gray-700 dark:text-neutral-200">{m}</p>
            <p className="text-xs text-gray-400 mt-1">Em breve</p>
          </div>
        ))}
      </div>
    </div>
  )
}
