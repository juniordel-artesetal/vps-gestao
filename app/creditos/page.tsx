'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Gift, TrendingDown, Wallet, ArrowRight } from 'lucide-react'
import CreditosNav from './_Nav'
import { SaldoTipo, Mov, infoTipo, MOTIVO_LABEL, fmtDataHora, consumoDoMes } from './_shared'

export default function CreditosVisaoGeralPage() {
  const { status } = useSession()
  const [saldos, setSaldos] = useState<SaldoTipo[]>([])
  const [historico, setHistorico] = useState<Mov[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/creditos')
      if (res.ok) {
        const data = await res.json()
        setSaldos(data.saldos || [])
        setHistorico(data.historico || [])
      }
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { if (status === 'authenticated') carregar() }, [status, carregar])

  const mesLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <CreditosNav />

      {carregando ? (
        <div className="text-gray-400 text-sm">Carregando…</div>
      ) : saldos.length === 0 ? (
        <div className="text-sm text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
          Você ainda não tem créditos. As franquias grátis aparecem aqui assim que você usar os recursos que consomem créditos (ex.: fotos que vendem, notas fiscais).
        </div>
      ) : (
        <>
          {/* Resumo por recurso: saldo, franquia do mês e consumo do mês */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {saldos.map((s) => {
              const info = infoTipo(s.tipo)
              const Icone = info.icon
              const consumido = consumoDoMes(s.tipo, saldos, historico)
              return (
                <div key={s.tipo} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: info.cor + '1a' }}>
                      <Icone className="w-4 h-4" style={{ color: info.cor }} />
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{info.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1 justify-center"><Wallet className="w-3 h-3" /> Saldo</div>
                      <div className="text-xl font-bold" style={{ color: info.cor }}>{s.saldo}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1 justify-center"><Gift className="w-3 h-3" /> Grátis</div>
                      <div className="text-xl font-bold text-emerald-600">
                        {s.cotaGratisMes > 0 ? s.cotaGratisRestante : '—'}
                        {s.cotaGratisMes > 0 && <span className="text-xs text-gray-400 font-normal">/{s.cotaGratisMes}</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1 justify-center"><TrendingDown className="w-3 h-3" /> Mês</div>
                      <div className="text-xl font-bold text-gray-700 dark:text-gray-200">{consumido}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400 mt-2">Franquia grátis e consumo referentes a <span className="capitalize">{mesLabel}</span>. A franquia reseta todo mês.</p>

          {/* Últimas movimentações */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Últimas movimentações</h2>
              <Link href="/creditos/historico" className="text-xs text-orange-600 hover:text-orange-500 flex items-center gap-1">
                Ver histórico <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              {historico.length === 0 ? (
                <div className="p-6 text-sm text-gray-500 text-center">Sem movimentações ainda.</div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {historico.slice(0, 5).map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="text-gray-700 dark:text-gray-200 truncate">{MOTIVO_LABEL[m.motivo] || m.motivo} · {infoTipo(m.tipo).label}</div>
                        <div className="text-xs text-gray-400">{fmtDataHora(m.createdAt)}</div>
                      </div>
                      <span className={`font-semibold ${m.delta < 0 ? 'text-red-500' : m.delta > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {m.delta > 0 ? '+' : ''}{m.delta}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
