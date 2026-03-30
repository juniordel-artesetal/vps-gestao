'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, AlertTriangle, Clock, TrendingUp, Package } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface Notificacao {
  id: string
  tipo: 'PAGAR' | 'VENCIDA' | 'RECEBER' | 'ATRASADO' | 'URGENTE'
  urgente: boolean
  titulo: string
  desc: string
  valor: number | null
  data: string
  href: string
}

const TIPO_CONFIG = {
  VENCIDA:  { cor: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/30',    icon: AlertTriangle },
  ATRASADO: { cor: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/30',    icon: Package       },
  PAGAR:    { cor: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30', icon: Clock      },
  URGENTE:  { cor: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30', icon: Package    },
  RECEBER:  { cor: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-950/30',   icon: TrendingUp },
}

function fmtR(n: number) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function NotificationBell() {
  const [aberto, setAberto]                 = useState(false)
  const [notificacoes, setNotificacoes]     = useState<Notificacao[]>([])
  const [urgentes, setUrgentes]             = useState(0)
  const [loading, setLoading]               = useState(false)
  const [lidas, setLidas]                   = useState<string[]>([])
  const ref                                 = useRef<HTMLDivElement>(null)
  const pathname                            = usePathname()

  // Fechar ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Buscar notificações ao montar e a cada 5 minutos
  useEffect(() => {
    buscar()
    const interval = setInterval(buscar, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Recarregar ao mudar de página
  useEffect(() => { buscar() }, [pathname])

  async function buscar() {
    setLoading(true)
    try {
      const res  = await fetch('/api/notificacoes')
      if (!res.ok) return
      const data = await res.json()
      setNotificacoes(data.notificacoes || [])
      setUrgentes(data.urgentes || 0)
    } catch {}
    finally { setLoading(false) }
  }

  const naoLidas = notificacoes.filter(n => !lidas.includes(n.id))

  function marcarTodasLidas() {
    setLidas(notificacoes.map(n => n.id))
  }

  return (
    <div ref={ref} className="relative">
      {/* Botão sino */}
      <button
        onClick={() => { setAberto(!aberto); if (!aberto) buscar() }}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        title="Notificações"
      >
        <Bell size={16} className={urgentes > 0 ? 'text-orange-500' : ''} />
        {naoLidas.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {naoLidas.length > 9 ? '9+' : naoLidas.length}
          </span>
        )}
      </button>

      {/* Painel de notificações */}
      {aberto && (
        <div className="fixed left-64 top-4 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Notificações</p>
              {naoLidas.length > 0 && (
                <p className="text-xs text-gray-500">{naoLidas.length} não lida{naoLidas.length > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {naoLidas.length > 0 && (
                <button onClick={marcarTodasLidas} className="text-xs text-orange-500 hover:text-orange-600">
                  Marcar todas
                </button>
              )}
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14}/>
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8 text-gray-400 text-xs gap-2">
                <Bell size={14} className="animate-pulse"/> Verificando...
              </div>
            )}

            {!loading && notificacoes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell size={28} className="text-gray-200 mb-2"/>
                <p className="text-sm text-gray-500 font-medium">Tudo em dia! 🎉</p>
                <p className="text-xs text-gray-400 mt-1">Nenhuma pendência no momento</p>
              </div>
            )}

            {!loading && notificacoes.map(n => {
              const cfg  = TIPO_CONFIG[n.tipo]
              const Icon = cfg.icon
              const lida = lidas.includes(n.id)

              return (
                <a
                  key={n.id}
                  href={n.href}
                  onClick={() => { setLidas(prev => [...prev, n.id]); setAberto(false) }}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${lida ? 'opacity-60' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon size={14} className={cfg.cor}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold ${cfg.cor} leading-tight`}>{n.titulo}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{fmtData(n.data)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">{n.desc}</p>
                    {n.valor !== null && (
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{fmtR(n.valor)}</p>
                    )}
                  </div>
                  {!lida && n.urgente && (
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5"/>
                  )}
                </a>
              )
            })}
          </div>

          {notificacoes.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-center">
              <a href="/financeiro/lancamentos" className="text-xs text-orange-500 hover:text-orange-600">
                Ver todos no Financeiro →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
