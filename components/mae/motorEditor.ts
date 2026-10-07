'use client'
// Ponte editor ↔ motor: um MotorRender por aba, entrega dos arquivos da Biblioteca ao motor (pelo
// sha256) e a PRÉVIA da tela (renderizada no Worker, a mais recente vence).
import { useEffect, useRef, useState } from 'react'
import { MotorRender } from '@/lib/mae/render/motor'
import { ler, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { arquivosDaArvore } from '@/lib/mae/editor/camadas'
import { pxPorMm, DPI_EXPORTACAO } from '@/lib/mae/render'
import type { Prancheta } from '@/lib/mae/schema'

let motor: MotorRender | null = null
export function motorDaPagina(): MotorRender {
  if (!motor) motor = new MotorRender()
  return motor
}

/** Prévia nunca passa da resolução de impressão (300 dpi): acima disso não há o que mostrar. */
export const PX_MM_MAXIMO = pxPorMm(DPI_EXPORTACAO)

/** Resolução da prévia em degraus (√2), para não re-renderizar a cada tique do zoom. */
export function resolucaoDaPrevia(escalaTela: number, dpr: number): number {
  const alvo = Math.min(escalaTela * dpr, PX_MM_MAXIMO)
  const degrau = Math.pow(2, Math.ceil(Math.log2(Math.max(alvo, 0.25)) * 2) / 2)
  return Math.min(degrau, PX_MM_MAXIMO)
}

/**
 * Garante que o motor tem todos os arquivos usados pela prancheta, lendo da Biblioteca pelo caminho
 * e conferindo o sha256. Devolve os que não foram encontrados (ou mudaram).
 */
export async function garantirArquivos(p: Prancheta, raiz: FileSystemDirectoryHandle | null): Promise<string[]> {
  const m = motorDaPagina()
  const faltando: string[] = []
  for (const [sha, caminho] of arquivosDaArvore(p.layers ?? [])) {
    if (m.tem(sha)) continue
    if (!raiz) { faltando.push(sha); continue }
    try {
      const f = await ler(raiz, caminho)
      if ((await sha256(f)) !== sha) { faltando.push(sha); continue }
      await m.enviarBitmap(sha, f)
    } catch { faltando.push(sha) }
  }
  return faltando
}

export interface Previa { bitmap: ImageBitmap; pxPorMm: number; faltando: string[]; ms: number }

/** Prévia de uma prancheta pelo motor. Pedidos durante um render em andamento: vale só o último. */
export function usePrevia(p: Prancheta, pxPorMmPrevia: number, raiz: FileSystemDirectoryHandle | null, versaoArquivos: number): Previa | null {
  const [previa, setPrevia] = useState<Previa | null>(null)
  const ocupado = useRef(false)
  const pendente = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!p.layers?.length) { setPrevia(null); return }
    let cancelado = false
    const rodar = async () => {
      ocupado.current = true
      try {
        await garantirArquivos(p, raiz)
        const r = await motorDaPagina().render(p, pxPorMmPrevia, '#ffffff', 'bitmap')
        if (!cancelado && r.bitmap) setPrevia(old => { old?.bitmap.close(); return { bitmap: r.bitmap!, pxPorMm: pxPorMmPrevia, faltando: r.faltando, ms: r.ms } })
        else r.bitmap?.close()
      } catch (e) { console.error('[MAE] prévia', e) } finally {
        ocupado.current = false
        const prox = pendente.current; pendente.current = null; prox?.()
      }
    }
    if (ocupado.current) pendente.current = rodar
    else void rodar()
    return () => { cancelado = true }
  }, [p, pxPorMmPrevia, raiz, versaoArquivos])

  return previa
}

// ── Sprints 5/6: prévia de TODAS as folhas (base com papel de teste; tema com o vínculo resolvido) ──

/** Papel quadriculado de teste (Sprint 5): grade de 10 × 10, seta "TOPO" e o nome da parte. */
export async function garantirGrade(nome: string, aspect: number): Promise<{ path: string; sha256: string; aspect: number }> {
  const sha = `grade:${nome}:${aspect.toFixed(3)}`
  const m = motorDaPagina()
  if (!m.tem(sha)) {
    const H = 600, W = Math.max(60, Math.min(2400, Math.round(H * aspect)))
    const c = new OffscreenCanvas(W, H)
    const g = c.getContext('2d')!
    g.fillStyle = '#fefce8'; g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(37,99,235,0.35)'; g.lineWidth = 2
    for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo((W * i) / 10, 0); g.lineTo((W * i) / 10, H); g.moveTo(0, (H * i) / 10); g.lineTo(W, (H * i) / 10); g.stroke() }
    g.strokeStyle = 'rgba(220,38,38,0.6)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4)
    g.fillStyle = 'rgba(30,41,59,0.75)'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = `bold ${Math.round(H * 0.09)}px sans-serif`; g.fillText(nome, W / 2, H / 2)
    g.font = `bold ${Math.round(H * 0.07)}px sans-serif`; g.fillText('▲ TOPO', W / 2, H * 0.1)
    g.font = `${Math.round(H * 0.05)}px sans-serif`; g.fillText('esq.', W * 0.08, H / 2); g.fillText('dir.', W * 0.92, H / 2)
    await m.enviarBitmap(sha, await c.convertToBlob({ type: 'image/png' }))
  }
  return { path: `grade/${nome}`, sha256: sha, aspect }
}

export interface PrancheteComCamadas { id: string; widthMm: number; heightMm: number; layers: NoCamadaMin[] }
type NoCamadaMin = Prancheta['layers'] extends (infer T)[] | undefined ? T : never

/**
 * Prévia de várias folhas (latest-wins): cada mudança redesenha todas no Worker e mede quanto levou
 * — é o "papel arrastado na FRENTE atualiza todas as frentes em < 0,3 s" da Sprint 6.
 */
export function usePrevias(folhas: PrancheteComCamadas[], pxPorMmPrevia: number, raiz: FileSystemDirectoryHandle | null, versaoArquivos: number,
  aoTerminar?: (r: { ms: number; folhas: number; faltando: string[] }) => void, fundo: string | null = '#ffffff'): Map<string, Previa> {
  const [previas, setPrevias] = useState<Map<string, Previa>>(() => new Map())
  const ocupado = useRef(false)
  const pendente = useRef<(() => void) | null>(null)
  useEffect(() => {
    let cancelado = false
    const rodar = async () => {
      ocupado.current = true
      const t0 = performance.now()
      try {
        const novas = new Map<string, Previa>()
        const faltando = new Set<string>()
        for (const f of folhas) {
          if (!f.layers.length) continue
          const p = f as unknown as Prancheta
          for (const s of await garantirArquivos(p, raiz)) faltando.add(s)
          const r = await motorDaPagina().render(p, pxPorMmPrevia, fundo, 'bitmap')
          if (r.bitmap) novas.set(f.id, { bitmap: r.bitmap, pxPorMm: pxPorMmPrevia, faltando: r.faltando, ms: r.ms })
          r.faltando.forEach(s => faltando.add(s))
        }
        if (cancelado) { novas.forEach(v => v.bitmap.close()); return }
        setPrevias(old => { old.forEach(v => v.bitmap.close()); return novas })
        aoTerminar?.({ ms: performance.now() - t0, folhas: novas.size, faltando: [...faltando] })
      } catch (e) { console.error('[MAE] prévias', e) } finally {
        ocupado.current = false
        const prox = pendente.current; pendente.current = null; prox?.()
      }
    }
    if (ocupado.current) pendente.current = rodar
    else void rodar()
    return () => { cancelado = true }
  }, [folhas, pxPorMmPrevia, raiz, versaoArquivos, aoTerminar, fundo])
  return previas
}
