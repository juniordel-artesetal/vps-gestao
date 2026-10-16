'use client'
// Método Mãe — POP-UP DE LANÇAMENTO (16/10 → 26/10/2026): 1× por dia para a ADMIN que ainda não tem o Método Mãe.
// Quem decide se aparece é o servidor (/api/mae/assinatura → `popup`: venda aberta, dentro da janela, ADMIN, sem o
// MAE); o "1× por dia" fica no navegador (dia de Brasília, vindo do servidor). Ao assinar, some sozinho (sem acesso
// liberado não há popup). Nada de cobrança aqui — o botão leva à tela da assinatura.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, Sparkles, Check } from 'lucide-react'

const CHAVE = 'mae_lancamento_popup_dia'

export default function MaeLancamentoPopup() {
  const pathname = usePathname()
  const [oferta, setOferta] = useState<{ mensal: number | null; standalone: boolean; dia: string } | null>(null)
  const [mostrar, setMostrar] = useState(false)
  // na própria tela de assinatura / dentro do MAE não faz sentido abrir
  const foraDeLugar = !!pathname && (pathname.startsWith('/mae/') || pathname.startsWith('/estudio/mae') || pathname.startsWith('/assinatura'))

  useEffect(() => {
    if (foraDeLugar) return
    let vivo = true
    fetch('/api/mae/assinatura').then(r => (r.ok ? r.json() : null)).then(j => {
      if (!vivo || !j?.popup || !j.hoje) return
      try { if (localStorage.getItem(CHAVE) === j.hoje) return } catch { /* sem localStorage: mostra mesmo assim */ }
      setOferta({ mensal: j.precos?.mensal ?? null, standalone: j.plano === 'standalone', dia: j.hoje })
      setTimeout(() => vivo && setMostrar(true), 1800)   // um respiro depois de abrir a tela
    }).catch(() => {})
    return () => { vivo = false }
  }, [foraDeLugar])

  function fechar() {
    if (oferta) { try { localStorage.setItem(CHAVE, oferta.dia) } catch { /* ok */ } }
    setMostrar(false)
  }
  if (!oferta || !mostrar || foraDeLugar) return null
  const preco = oferta.mensal ? oferta.mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="mae-popup-titulo" data-mae-popup>
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <button onClick={fechar} className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" aria-label="Fechar"><X className="h-5 w-5" /></button>
        <div className="bg-gradient-to-br from-pink-500 to-orange-400 px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Novidade no SOA</p>
          <h2 id="mae-popup-titulo" className="mt-1 flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6" /> Chegou o Método Mãe</h2>
          <p className="mt-1 text-sm opacity-95">A arte de cada pedido pronta para imprimir — com o nome, a idade e o tema da cliente.</p>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm text-gray-700 dark:text-gray-200">
          <ul className="space-y-1.5">
            {[
              'Puxa os pedidos do SOA e monta a arte de cada um sozinho',
              'Edição em massa: dezenas de pedidos de uma vez',
              'Lote de impressão já organizado, com as marcas de corte',
              'Seus temas e bases salvos no seu computador',
            ].map(t => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t}</li>)}
          </ul>
          {preco && (
            <p className="rounded-xl bg-orange-50 px-3 py-2 text-gray-800 dark:bg-orange-950/30 dark:text-gray-100">
              {oferta.standalone ? <>Só o Método Mãe por <b>{preco}/mês</b></> : <><b>SOA + Método Mãe</b>: + <b>{preco}/mês</b> no seu SOA</>} — mensal ou anual em até 12×.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button onClick={fechar} className="rounded-xl px-4 py-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" data-mae-popup-depois>Agora não</button>
            <a href="/mae/assinatura" onClick={fechar} className="rounded-xl bg-orange-500 px-5 py-2.5 text-center font-semibold text-white hover:bg-orange-600" data-mae-popup-quero>Quero o Método Mãe</a>
          </div>
        </div>
      </div>
    </div>
  )
}
