'use client'
// Pop-up de parabéns por pedido novo da loja (chamado Y20A). 1x por LOTE: fechar grava "popupVisto" no servidor
// (não volta a cada reload); "Ver pedidos" leva à lista, que marca tudo como visto. Mesmo padrão visual do
// NovidadesPopup. Fail-open: qualquer erro = não mostra nada.
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { PartyPopper, X, ChevronRight } from 'lucide-react'

export default function LojaPedidosPopup() {
  const { status, data: session } = useSession()
  const [novos, setNovos] = useState(0)

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role === 'OPERADOR') return
    let vivo = true
    fetch('/api/minha-loja/avisos').then(r => (r.ok ? r.json() : null)).then(d => {
      if (vivo && d?.mostrarPopup && Number(d.novos) > 0) setNovos(Number(d.novos))
    }).catch(() => {})
    return () => { vivo = false }
  }, [status, session?.user?.role])

  function fechar() {
    setNovos(0)
    fetch('/api/minha-loja/avisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'popupVisto' }) }).catch(() => {})
  }

  useEffect(() => {
    if (!novos) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [novos])

  if (!novos) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={fechar}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="loja-popup-titulo" data-loja-pedidos-popup>
        <div className="flex justify-end px-3 pt-3">
          <button onClick={fechar} aria-label="Fechar" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 pb-6 text-center">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30">
            <PartyPopper className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 id="loja-popup-titulo" className="text-lg font-bold text-gray-900 dark:text-white">Parabéns, você tem pedidos novos!</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {novos === 1 ? 'Entrou 1 pedido novo pela sua loja.' : `Entraram ${novos} pedidos novos pela sua loja.`}
            {' '}Eles já estão na sua Produção — confira e aprove para o valor entrar no caixa.
          </p>
          <div className="flex flex-col gap-2 mt-5">
            <a href="/minha-loja/pedidos" className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cor-primaria, #f97316)' }}>
              Ver pedidos <ChevronRight size={14} />
            </a>
            <button onClick={fechar} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1">Depois</button>
          </div>
        </div>
      </div>
    </div>
  )
}
