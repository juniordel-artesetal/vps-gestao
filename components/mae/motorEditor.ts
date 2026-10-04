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
