'use client'
// components/StarsPopup.tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'

interface Saldo {
  pontos: number
  pontosAno: number
  pontosTrimestre: number
  nivel: string
  nivelLabel: string
  proximoNivel: string | null
  progressoPct: number
  pontosParaProximo: number
  posicaoAnual: number
  posicaoTrimestral: number | null
  isTop20: boolean
}

export default function StarsPopup() {
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    // Mostrar 1x por sessão
    const ja = sessionStorage.getItem('stars_popup_visto')
    if (ja) return

    fetch('/api/stars/saldo')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setSaldo(d)
          setVisivel(true)
          sessionStorage.setItem('stars_popup_visto', '1')
        }
      })
      .catch(() => {})
  }, [])

  if (!visivel || !saldo) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header gradiente */}
        <div className="bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 px-6 py-5 relative">
          <button
            onClick={() => setVisivel(false)}
            className="absolute top-3 right-3 text-white/70 hover:text-white"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-yellow-200" />
            <p className="text-white font-bold text-sm uppercase tracking-wider">VPS Stars</p>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {saldo.pontos.toLocaleString('pt-BR')} <span className="text-lg font-normal text-white/80">pontos</span>
          </p>
          <p className="text-white/90 text-sm">{saldo.nivelLabel}</p>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {saldo.isTop20 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 rounded-xl p-4">
              <p className="text-yellow-700 dark:text-yellow-300 font-bold text-sm mb-1">
                🏅 Parabéns! Você está no TOP 20 do trimestre!
              </p>
              <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                Você está concorrendo aos prêmios trimestrais 🎉
              </p>
            </div>
          )}

          {saldo.proximoNivel && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Progresso para {saldo.proximoNivel}
                </p>
                <p className="text-xs text-orange-600 font-bold">{saldo.progressoPct}%</p>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-pink-400 transition-all"
                  style={{ width: `${saldo.progressoPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Faltam <strong className="text-orange-500">{saldo.pontosParaProximo.toLocaleString('pt-BR')}</strong> pts
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Ranking anual</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">#{saldo.posicaoAnual}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Pts no trimestre</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">{saldo.pontosTrimestre.toLocaleString('pt-BR')}</p>
            </div>
          </div>

          <Link
            href="/stars"
            onClick={() => setVisivel(false)}
            className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition mt-2"
          >
            Ver meu programa →
          </Link>
        </div>
      </div>
    </div>
  )
}
