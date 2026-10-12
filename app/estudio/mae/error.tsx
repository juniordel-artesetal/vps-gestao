'use client'
// Método MAE — último recurso: um erro que escapou das proteções por ferramenta (ProtecaoErro) cai aqui em vez da
// página branca. Antes de tudo, guarda o rascunho automático do que estava aberto (os documentos continuam na
// memória da página) — ao tentar de novo ou reabrir, o editor oferece "Recuperar trabalho não salvo?".
import { useEffect } from 'react'
import { gravarAgora } from '@/components/mae/rascunhos'

export default function ErroMae({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error('[MAE] erro na página', error)
    gravarAgora()
  }, [error])
  return (
    <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-3" role="alert" data-erro-pagina-mae>
      <h1 className="text-lg font-semibold text-gray-900">O editor encontrou um erro</h1>
      <p className="text-sm text-gray-700">O seu trabalho foi guardado automaticamente. Ao abrir o editor de novo, ele pergunta se você quer recuperar o que não estava salvo.</p>
      <p className="text-[11px] text-gray-500 break-words">{error.message}</p>
      <button className="rounded-lg border border-orange-500 bg-orange-500 px-3 py-1.5 text-sm font-medium text-white" onClick={() => unstable_retry()}>Abrir o editor de novo</button>
    </div>
  )
}
