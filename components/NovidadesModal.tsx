'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'
import { VERSAO_ATUAL, CHANGELOG } from '@/lib/versao'

export function NovidadesModal() {
  const [aberto, setAberto] = useState(false)
  const [release, setRelease] = useState(CHANGELOG[0])

  useEffect(() => {
    // Verifica se o usuário já viu esta versão
    const versaoVista = localStorage.getItem('vps-versao-vista')
    if (versaoVista !== VERSAO_ATUAL) {
      setAberto(true)
      // Registra que viu a versão atual
      localStorage.setItem('vps-versao-vista', VERSAO_ATUAL)
      // Notifica o servidor (opcional, para analytics)
      fetch('/api/sistema/versao-vista', { method: 'POST' }).catch(() => {})
    }
  }, [])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl overflow-hidden relative">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-orange-100"/>
            <span className="text-orange-100 text-xs font-semibold uppercase tracking-wider">
              O que há de novo
            </span>
          </div>
          <h2 className="text-white text-lg font-bold">VPS Gestão v{release.versao}</h2>
          <p className="text-orange-100 text-sm mt-0.5">{release.destaque}</p>
          <button
            onClick={() => setAberto(false)}
            className="absolute top-4 right-4 text-orange-200 hover:text-white transition"
          >
            <X size={18}/>
          </button>
        </div>

        {/* Novidades */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {release.novidades.map((n, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{n.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.titulo}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-400">{release.data}</span>
          <button
            onClick={() => setAberto(false)}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-xl transition"
          >
            Entendido! 🎉
          </button>
        </div>
      </div>
    </div>
  )
}
