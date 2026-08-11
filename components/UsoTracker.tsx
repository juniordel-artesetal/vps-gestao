'use client'
// Beacon LEVE de uso por módulo. A cada troca de rota, avisa o servidor qual módulo
// foi acessado — com throttle por módulo/hora (sessionStorage) pra não gerar uma
// requisição por clique. Fire-and-forget: nunca bloqueia a navegação.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Espelha lib/usoLog.moduloDaRota (só pra decidir se vale enviar/throttlar no client).
function moduloDaRota(pathname: string): string | null {
  const segs = (pathname || '').replace(/^\/+/, '').split('/').filter(Boolean)
  if (!segs.length) return null
  if (segs[0] === 'dashboard' && segs[1] === 'orcamentos') return 'orcamentos'
  const conhecidos = new Set([
    'dashboard', 'precificacao', 'financeiro', 'gestao', 'compras', 'clientes',
    'tarefas', 'demandas', 'minha-loja', 'loja', 'pesquisa-preco', 'promocoes',
    'creditos', 'integracoes', 'suporte', 'config', 'stars', 'parceiro',
  ])
  return conhecidos.has(segs[0]) ? segs[0] : null
}

export default function UsoTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    const modulo = moduloDaRota(pathname)
    if (!modulo) return

    // Throttle: no máximo 1 registro por módulo por hora (por aba/sessão).
    const hora = Math.floor(Date.now() / 3_600_000)
    const chave = `uso:${modulo}:${hora}`
    try {
      if (sessionStorage.getItem(chave)) return
      sessionStorage.setItem(chave, '1')
    } catch { /* sessionStorage indisponível — segue e envia mesmo assim */ }

    fetch('/api/uso/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
