'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import CreditosNav from '../_Nav'
import { SaldoTipo, Mov, infoTipo, MOTIVO_LABEL, fmtDataHora } from '../_shared'

export default function CreditosHistoricoPage() {
  const { status } = useSession()
  const [saldos, setSaldos] = useState<SaldoTipo[]>([])
  const [historico, setHistorico] = useState<Mov[]>([])
  const [filtroTipo, setFiltroTipo] = useState('')
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

  const lista = filtroTipo ? historico.filter(m => m.tipo === filtroTipo) : historico

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <CreditosNav />

      {/* Filtro por tipo */}
      {saldos.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => setFiltroTipo('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroTipo === '' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            Todos
          </button>
          {saldos.map(s => (
            <button key={s.tipo} onClick={() => setFiltroTipo(s.tipo)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtroTipo === s.tipo ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {infoTipo(s.tipo).label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {carregando ? (
          <div className="p-6 text-sm text-gray-400 text-center">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">Sem movimentações{filtroTipo ? ' para este recurso' : ''}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/40 text-gray-500">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold">Data</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold">Recurso</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold">Motivo</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold">Qtd.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100 dark:border-gray-700/60">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDataHora(m.createdAt)}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200">{infoTipo(m.tipo).label}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{MOTIVO_LABEL[m.motivo] || m.motivo}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${m.delta < 0 ? 'text-red-500' : m.delta > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {m.delta > 0 ? '+' : ''}{m.delta}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{m.saldoResultante ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
