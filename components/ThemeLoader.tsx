'use client'

import { useEffect } from 'react'

// Exportada para uso na tela de config/geral após salvar
export function aplicarTema(cor: string) {
  if (!cor) return
  const root = document.documentElement

  // Cor principal
  root.style.setProperty('--cor-primaria', cor)

  // Variantes calculadas via CSS color-mix (funciona em browsers modernos)
  // Fallback: hardcoded para os valores mais usados
  root.style.setProperty('--cor-primaria-hover',  shadeHex(cor, -15))
  root.style.setProperty('--cor-primaria-light',  hexAlpha(cor, 0.10))
  root.style.setProperty('--cor-primaria-medium', hexAlpha(cor, 0.20))
  root.style.setProperty('--cor-primaria-border', hexAlpha(cor, 0.35))
  root.style.setProperty('--cor-primaria-text',   shadeHex(cor, -20))

  // Persiste localmente para carregamento instantâneo no próximo acesso
  try { localStorage.setItem('vps_cor_primaria', cor) } catch {}
}

// Escurece um hex por `amount` pontos (0-255)
function shadeHex(hex: string, amount: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, Math.max(0, (num >> 16) + amount))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  } catch { return hex }
}

// Adiciona transparência a um hex
function hexAlpha(hex: string, alpha: number): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = (num >> 16) & 255
    const g = (num >> 8)  & 255
    const b =  num        & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  } catch { return hex }
}

// ─────────────────────────────────────────────────────────────────
// ThemeLoader — carrega o tema do workspace e aplica CSS variables.
//
// COMO FUNCIONA:
// 1. Lê do localStorage para aplicação instantânea (sem flash)
// 2. Busca /api/config/geral para garantir sincronia com o banco
// 3. Aplica as CSS variables em :root
//
// COMO USAR NOS COMPONENTES:
// Em vez de classes Tailwind como "bg-orange-500", use:
//   style={{ backgroundColor: 'var(--cor-primaria)' }}
//   className="bg-[var(--cor-primaria)]"        ← Tailwind JIT
// ─────────────────────────────────────────────────────────────────
export function ThemeLoader() {
  useEffect(() => {
    // Aplica do localStorage imediatamente (evita flash de cor errada)
    try {
      const cached = localStorage.getItem('vps_cor_primaria')
      if (cached) aplicarTema(cached)
    } catch {}

    // Sincroniza com o banco
    fetch('/api/config/geral')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.corPrimaria) aplicarTema(data.corPrimaria)
      })
      .catch(() => {})
  }, [])

  return null
}
