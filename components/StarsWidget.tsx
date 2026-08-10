'use client'
// components/StarsWidget.tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

interface Saldo {
  pontos: number
  pontosAno: number
  nivel: string
  nivelLabel: string
  proximoNivel: string | null
  progressoPct: number
  pontosParaProximo: number
  isTop20: boolean
}

export default function StarsWidget() {
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/stars/saldo')
      .then(r => r.ok ? r.json() : null)
      .then(d => setSaldo(d))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return (
      <div className="bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 rounded-xl p-3 animate-pulse">
        <div className="h-12 bg-orange-500/10 rounded"></div>
      </div>
    )
  }

  if (!saldo) return null

  return (
    <Link href="/stars" className="block group">
      <div className="bg-gradient-to-br from-orange-500/15 via-pink-500/10 to-purple-500/15 border border-orange-500/30 rounded-xl p-3 hover:border-orange-400/50 transition relative overflow-hidden">
        {saldo.isTop20 && (
          <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            🏅 TOP 20
          </div>
        )}
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles size={14} className="text-orange-400" />
          <span className="text-xs font-bold text-orange-300 uppercase tracking-wider">VPS Stars</span>
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-lg font-bold text-white">{saldo.pontos.toLocaleString('pt-BR')}</span>
          <span className="text-xs text-gray-400">pts</span>
        </div>
        <p className="text-xs text-gray-400 mb-2">{saldo.nivelLabel}</p>
        {saldo.proximoNivel && (
          <>
            <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-pink-400 transition-all"
                style={{ width: `${saldo.progressoPct}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {saldo.pontosParaProximo.toLocaleString('pt-BR')} pts para {saldo.proximoNivel}
            </p>
          </>
        )}
      </div>
    </Link>
  )
}
