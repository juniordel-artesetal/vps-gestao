// Urgente pós-Lote 9 — CACHE DE EFEITOS da tela: depois de várias edições, o render com o cache aquecido tem que dar
// EXATAMENTE os pixels de um render do zero (nada de arte velha presa no cache). Usa o kit de 9 pranchetas.
//   MAE_REF_KIT=<kit.json> npx vitest run cache-efeitos
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, loadImage, Path2D as P2D, type Image } from '@napi-rs/canvas'
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render/renderizar'
import { CacheCamadas } from '@/lib/mae/render/cache'
import type { EfeitosMontados } from '@/lib/mae/render/efeitos'
import { abrirFonte } from '@/lib/mae/texto/fonte'

describe.runIf(!!process.env.MAE_REF_KIT)('cache de efeitos da tela', () => {
  it('render com cache aquecido = render do zero, depois de mover, mudar efeito e "só nesta caixa"', async () => {
    const kit = JSON.parse(readFileSync(process.env.MAE_REF_KIT!, 'utf8'))
    const TEMA_DIR = join(process.cwd(), 'docs/mae-exemplos/tema-exemplo')
    const camadas = Object.values(kit.tema.partContent).flat() as { path?: string; sha256?: string }[]
    const imagens = new Map<string, Image>()
    for (const a of kit.arquivos as string[]) { const sha = camadas.find(c => c.path === a)?.sha256; if (sha) imagens.set(sha, await loadImage(readFileSync(join(TEMA_DIR, a.split('/').pop()!)))) }
    const fonte = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike
    const k = 3
    const abs = (kit.base.artboards as { id: string }[]).slice(0, 3)
    const render = (tema: unknown, cache: CacheCamadas<EfeitosMontados>) => abs.map(ab => {
      const layers = resolverPrancheta(kit.base, ab.id, { tema: tema as never, texto: { fontes: { obter: () => undefined, substituta: fonte }, valores: kit.tema.sample } })
      const p = { ...(ab as object), layers } as never
      const { w, h } = tamanhoDoCanvas(p, k)
      const c = createCanvas(w, h)
      renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap: s => imagens.get(s) as never, cacheEfeitos: cache, rapido: true })
      return Buffer.from(c.getContext('2d').getImageData(0, 0, w, h).data)
    })
    const quente = new CacheCamadas<EfeitosMontados>(512 * 1024 * 1024)
    let tema = JSON.parse(JSON.stringify(kit.tema))
    render(tema, quente)                                                            // aquece
    // edições: mover elemento, mudar efeito do NOME, "só nesta caixa", efeito novo num elemento
    tema = JSON.parse(JSON.stringify(tema))
    const el = tema.partContent.p_frente.find((c: { type: string; anchor?: string }) => c.type === 'image' && c.anchor !== 'paper')
    el.transform.x += 0.08
    const nome = tema.textStyles.NOME; if (nome?.effects?.[0]) nome.effects[0].sizeMm = (nome.effects[0].sizeMm ?? 0.5) + 0.4
    const face = kit.base.parts.find((p: { id: string }) => p.id === 'p_frente').instances[0].faceId
    tema.localOverrides = { ...(tema.localOverrides ?? {}), [face]: { [el.id]: { transform: { x: 0.7 } } } }
    el.effects = [{ type: 'dropShadow', color: '#000000', opacity: 0.5, angleDeg: 120, distanceMm: 1, sizeMm: 1.5, spread: 0, enabled: true }]
    const comCache = render(tema, quente)
    const doZero = render(tema, new CacheCamadas<EfeitosMontados>(512 * 1024 * 1024))
    expect(quente.acertos).toBeGreaterThan(0)                                      // o cache foi usado de verdade
    comCache.forEach((b, i) => expect(Buffer.compare(b, doZero[i]), `prancheta ${i + 1}`).toBe(0))
    console.log(`cache: ${quente.acertos} acertos · ${quente.faltas} faltas · ${quente.tamanho} itens · ${(quente.bytes / 1048576).toFixed(1)} MB`)
  })
})
