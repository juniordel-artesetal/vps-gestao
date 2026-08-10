'use client'
// Banner discreto de PROMOÇÃO de parceiro (distribuidor). Puxa 1 promoção elegível
// (/api/promocoes/servir — teto 2x/dia + rotação por prioridade). Clique conta métrica
// e abre o link direto. Fecha ao X (some até o próximo load). Não aparece se nada elegível.
import { useEffect, useState } from 'react'
import { X, Tag } from 'lucide-react'

interface Promo { id: string; titulo: string; descricao: string | null; cupom: string | null; linkCompra: string | null; parceiroNome: string }

export default function PromoPopup() {
  const [promo, setPromo] = useState<Promo | null>(null)
  const [fechado, setFechado] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/promocoes/servir')
      .then(r => r.ok ? r.json() : { promocao: null })
      .then(d => { if (vivo) setPromo(d.promocao || null) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  if (!promo || fechado) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-start gap-2 p-3">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          <Tag className="w-4 h-4 text-orange-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-400">Oferta · {promo.parceiroNome}</span>
            <button onClick={() => setFechado(true)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug">{promo.titulo}</p>
          {promo.descricao && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{promo.descricao}</p>}
          {promo.cupom && <p className="text-xs mt-1">Cupom: <span className="font-bold text-orange-600">{promo.cupom}</span></p>}
          <div className="mt-2 flex items-center gap-3">
            {promo.linkCompra && (
              <a href={`/api/promocoes/clique?id=${promo.id}`} target="_blank" rel="noopener noreferrer"
                className="inline-block text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600">
                Ver oferta
              </a>
            )}
            <a href="/promocoes" className="text-xs text-gray-500 hover:text-orange-500 underline">Ver todas</a>
          </div>
        </div>
      </div>
    </div>
  )
}
