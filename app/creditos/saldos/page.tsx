'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Gift, ShoppingCart, Package, Clock } from 'lucide-react'
import CreditosNav from '../_Nav'
import { SaldoTipo, infoTipo } from '../_shared'

interface Pacote { id: string; tipo: string; nome: string; quantidade: number; preco: number }

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function CreditosSaldosPage() {
  const { status } = useSession()
  const [saldos, setSaldos] = useState<SaldoTipo[]>([])
  const [pacotes, setPacotes] = useState<Pacote[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [rSaldos, rPacotes] = await Promise.all([
        fetch('/api/creditos'),
        fetch('/api/creditos/pacotes'),
      ])
      if (rSaldos.ok) setSaldos((await rSaldos.json()).saldos || [])
      if (rPacotes.ok) setPacotes(await rPacotes.json())
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { if (status === 'authenticated') carregar() }, [status, carregar])

  // Tipos que aparecem: os com saldo + os que têm pacote à venda
  const tipos = Array.from(new Set([...saldos.map(s => s.tipo), ...pacotes.map(p => p.tipo)]))

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <CreditosNav />

      {carregando ? (
        <div className="text-gray-400 text-sm">Carregando…</div>
      ) : (
        <>
          {/* Saldos por recurso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {saldos.length === 0 && (
              <div className="col-span-full text-sm text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
                Nenhum saldo por enquanto. Assim que os recursos que consomem créditos entrarem, sua franquia grátis mensal aparece aqui.
              </div>
            )}
            {saldos.map((s) => {
              const info = infoTipo(s.tipo)
              const Icone = info.icon
              return (
                <div key={s.tipo} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: info.cor + '1a' }}>
                      <Icone className="w-4 h-4" style={{ color: info.cor }} />
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{info.label}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Saldo pago</div>
                      <div className="text-3xl font-bold" style={{ color: info.cor }}>{s.saldo}</div>
                    </div>
                    {s.cotaGratisMes > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                          <Gift className="w-3 h-3" /> Grátis no mês
                        </div>
                        <div className="text-sm font-semibold text-emerald-600">
                          {s.cotaGratisRestante} <span className="text-gray-400 font-normal">de {s.cotaGratisMes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Catálogo de pacotes (comprar) */}
          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Comprar créditos</h2>

            {pacotes.length === 0 ? (
              <div className="text-sm text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
                Nenhum pacote disponível no momento. Em breve você poderá comprar créditos por aqui.
              </div>
            ) : (
              tipos.filter(t => pacotes.some(p => p.tipo === t)).map((t) => {
                const info = infoTipo(t)
                const doTipo = pacotes.filter(p => p.tipo === t)
                return (
                  <div key={t} className="mb-5">
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                      <Package className="w-4 h-4" style={{ color: info.cor }} /> {info.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {doTipo.map((p) => (
                        <div key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col">
                          <div className="font-semibold text-gray-800 dark:text-gray-100">{p.nome}</div>
                          <div className="text-sm text-gray-500 mt-0.5">{p.quantidade} créditos</div>
                          <div className="mt-3 text-2xl font-bold" style={{ color: info.cor }}>{fmtBRL(p.preco)}</div>
                          {p.quantidade > 0 && p.preco > 0 && (
                            <div className="text-[11px] text-gray-400">{fmtBRL(p.preco / p.quantidade)} por crédito</div>
                          )}
                          <button
                            disabled
                            title="Checkout disponível em breve"
                            className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium rounded-lg py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                          >
                            <Clock className="w-4 h-4" /> Comprar (em breve)
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}

            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" />
              O checkout integrado será liberado em breve. Enquanto isso, a equipe VPS pode creditar pacotes manualmente.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
