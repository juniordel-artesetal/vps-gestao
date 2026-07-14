'use client'
// Motor de tour da Sofia: spotlight (driver.js) + narração no tom dela, avançando com
// "Próximo". Muda de página quando o passo declara `pagina`. RESILIENTE: se o elemento
// (data-tour) não existir, mostra um balão centralizado (não quebra). Estado em sessionStorage
// pra sobreviver à navegação. Ao terminar, marca o tour como concluído.
import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { getTour } from '@/lib/sofia/tours'

const CHAVE = 'sofia_tour'
type Estado = { tourId: string; idx: number }

function ler(): Estado | null { try { return JSON.parse(sessionStorage.getItem(CHAVE) || 'null') } catch { return null } }
function salvar(e: Estado | null) { try { e ? sessionStorage.setItem(CHAVE, JSON.stringify(e)) : sessionStorage.removeItem(CHAVE) } catch {} }

// Uma página "casa" com a rota se for igual ou (para rotas dinâmicas) o prefixo bater.
function rotaCasa(pagina: string | undefined, atual: string): boolean {
  if (!pagina) return true
  if (pagina === atual) return true
  return atual.startsWith(pagina.replace(/\[.*?\]/g, '')) // ex.: /dashboard/pedidos/ casa com /.../[id]
}

export function useSofiaTour() {
  const router = useRouter()
  const pathname = usePathname()
  const drvRef = useRef<any>(null)

  const limpar = useCallback(() => { drvRef.current?.destroy(); drvRef.current = null }, [])

  const finalizar = useCallback(async (tourId: string) => {
    limpar(); salvar(null)
    try { await fetch('/api/sofia/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tourConcluido: tourId }) }) } catch {}
  }, [limpar])

  const rodar = useCallback(() => {
    const est = ler(); if (!est) return
    const tour = getTour(est.tourId); if (!tour) { salvar(null); return }
    const passo = tour.passos[est.idx]
    if (!passo) { finalizar(est.tourId); return }

    // Se o passo é de outra página, navega e espera o próximo mount resumir.
    if (passo.pagina && !rotaCasa(passo.pagina, pathname)) { router.push(passo.pagina); return }

    limpar()
    const ultimo = est.idx >= tour.passos.length - 1
    const el = passo.seletor ? document.querySelector(passo.seletor) : null

    const avancar = () => {
      const prox = est.idx + 1
      if (prox >= tour.passos.length) { finalizar(est.tourId); return }
      salvar({ tourId: est.tourId, idx: prox })
      const pProx = tour.passos[prox]
      if (pProx.pagina && !rotaCasa(pProx.pagina, pathname)) { limpar(); router.push(pProx.pagina) }
      else rodar()
    }

    const d = driver({
      showProgress: true, progressText: '{{current}} de {{total}}',
      nextBtnText: ultimo ? 'Fechar 🎉' : 'Próximo', prevBtnText: 'Voltar', doneBtnText: 'Fechar 🎉',
      showButtons: ['next', 'close'], allowClose: true, overlayColor: 'rgba(17,24,39,0.6)',
      onNextClick: () => avancar(),
      onCloseClick: () => finalizar(est.tourId),
      onDestroyed: () => {},
      steps: [{
        element: el || undefined,
        popover: { title: `Sofia · ${passo.titulo || tour.nome}`, description: passo.texto, side: 'bottom', align: 'start' },
      }],
    })
    drvRef.current = d
    d.drive()
  }, [pathname, router, limpar, finalizar])

  // Inicia um tour do zero.
  const iniciar = useCallback((tourId: string) => {
    const tour = getTour(tourId); if (!tour) return
    salvar({ tourId, idx: 0 })
    const p0 = tour.passos[0]
    if (p0.pagina && !rotaCasa(p0.pagina, pathname)) router.push(p0.pagina)
    else setTimeout(rodar, 60)
  }, [pathname, router, rodar])

  // Resume o tour ao trocar de rota (após navegação de um passo).
  useEffect(() => {
    const est = ler(); if (!est) return
    const t = setTimeout(rodar, 350) // espera a página montar/ancorar
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => () => limpar(), [limpar])

  return { iniciar }
}
