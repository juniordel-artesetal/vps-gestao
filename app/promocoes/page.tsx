'use client'
import { useEffect, useState, useCallback } from 'react'
import { Tag, Copy, ExternalLink, Store, Ticket } from 'lucide-react'

interface Promo { id: string; parceiroNome: string; titulo: string; descricao: string | null; cupom: string | null; linkCompra: string | null; temImagem: boolean; dataFim: string | null }

export default function PromocoesPage() {
  const [promocoes, setPromocoes] = useState<Promo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/promocoes/listar')
      if (res.ok) setPromocoes((await res.json()).promocoes || [])
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function copiar(cupom: string, id: string) {
    navigator.clipboard?.writeText(cupom); setCopiado(id); setTimeout(() => setCopiado(''), 1500)
  }

  // Agrupa por parceiro (loja) pra ficar mais navegável
  const porParceiro = promocoes.reduce<Record<string, Promo[]>>((acc, p) => {
    (acc[p.parceiroNome] ||= []).push(p); return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Tag className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Ofertas &amp; Cupons</h1>
          <p className="text-sm text-gray-500">Descontos e cupons dos nossos parceiros de insumos.</p>
        </div>
      </div>

      {carregando ? (
        <div className="text-gray-400 text-sm mt-8">Carregando…</div>
      ) : promocoes.length === 0 ? (
        <div className="mt-8 text-sm text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
          Nenhuma oferta disponível no momento. Volte em breve — novidades dos parceiros aparecem aqui. 🧡
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(porParceiro).map(([parceiro, lista]) => (
            <div key={parceiro}>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                <Store className="w-4 h-4 text-gray-400" /> {parceiro}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lista.map((p) => (
                  <div key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col">
                    <div className="font-semibold text-gray-800 dark:text-gray-100">{p.titulo}</div>
                    {p.descricao && <p className="text-sm text-gray-500 mt-0.5 flex-1">{p.descricao}</p>}
                    {p.dataFim && <p className="text-[11px] text-gray-400 mt-1">Válido até {p.dataFim}</p>}

                    <div className="flex items-center gap-2 mt-3">
                      {p.cupom && (
                        <button onClick={() => copiar(p.cupom!, p.id)}
                          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-dashed border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
                          <Ticket className="w-3.5 h-3.5" />
                          <span className="font-bold tracking-wide">{p.cupom}</span>
                          <Copy className="w-3 h-3" /> {copiado === p.id ? 'Copiado!' : ''}
                        </button>
                      )}
                      {p.linkCompra && (
                        <a href={`/api/promocoes/clique?id=${p.id}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white ml-auto">
                          Ver oferta <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
