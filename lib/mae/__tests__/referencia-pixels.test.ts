// Lote 9 (item 135) — REFERÊNCIA DE PIXELS do motor: renderiza as pranchetas de um kit (JSON de
// scripts/mae-gerar-kit-perf.mts) com o resolver + o motor reais e grava o RGBA de cada uma; ou compara duas
// pastas. Rodar antes e depois de mexer no motor: a exportação precisa continuar idêntica (≤ 1 nível por canal).
//   MAE_REF_KIT=<kit.json> MAE_REF_SAIDA=<pasta> [MAE_REF_K=4] [MAE_REF_CENARIO=1] npx vitest run referencia-pixels
//   MAE_REF_A=<pasta> MAE_REF_B=<pasta> npx vitest run referencia-pixels
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas, loadImage, Path2D as P2D, type Image } from '@napi-rs/canvas'
;(globalThis as { Path2D?: unknown }).Path2D ??= P2D
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { renderizarPrancheta, tamanhoDoCanvas, type CanvasLike } from '@/lib/mae/render/renderizar'
import { abrirFonte } from '@/lib/mae/texto/fonte'

describe.runIf(!!process.env.MAE_REF_KIT)('referência de pixels: gravar', () => {
  it('renderiza o kit', async () => {
    const kit = JSON.parse(readFileSync(process.env.MAE_REF_KIT!, 'utf8'))
    const saida = process.env.MAE_REF_SAIDA!, k = Number(process.env.MAE_REF_K ?? 4)
    if (process.env.MAE_REF_CENARIO === '1') for (const p of kit.base.parts) if (p.id !== 'p_frente') p.cenario = true
    const TEMA_DIR = join(process.cwd(), 'docs/mae-exemplos/tema-exemplo')
    const camadas = Object.values(kit.tema.partContent).flat() as { path?: string; sha256?: string }[]
    const imagens = new Map<string, Image>()
    for (const a of kit.arquivos as string[]) { const sha = camadas.find(c => c.path === a)?.sha256; if (sha) imagens.set(sha, await loadImage(readFileSync(join(TEMA_DIR, a.split('/').pop()!)))) }
    const fonte = await abrirFonte(readFileSync(join(process.cwd(), 'public/mae/fontes/Sniglet-Regular.ttf')))
    mkdirSync(saida, { recursive: true })
    const criar = (w: number, h: number) => createCanvas(w, h) as unknown as CanvasLike
    let ms = 0
    for (const ab of kit.base.artboards) {
      const layers = resolverPrancheta(kit.base, ab.id, { tema: kit.tema, texto: { fontes: { obter: () => undefined, substituta: fonte }, valores: kit.tema.sample } })
      const p = { ...ab, layers }
      const { w, h } = tamanhoDoCanvas(p, k)
      const c = createCanvas(w, h)
      const t0 = performance.now()
      renderizarPrancheta(c as unknown as CanvasLike, p, { pxPorMm: k, fundo: '#ffffff', criarCanvas: criar, bitmap: s => imagens.get(s) as unknown as CanvasImageSource, criarCaminho: s => new P2D(s) as unknown as Path2D })
      ms += performance.now() - t0
      writeFileSync(join(saida, `${ab.id}.rgba`), Buffer.from(c.getContext('2d').getImageData(0, 0, w, h).data))
    }
    console.log(`ok: ${kit.base.artboards.length} pranchetas a ${k} px/mm em ${Math.round(ms)} ms de motor`)
  }, 900_000)
})

describe.runIf(!!process.env.MAE_REF_A)('referência de pixels: comparar', () => {
  it('pixels iguais (≤ 1 nível por canal)', () => {
    const a = process.env.MAE_REF_A!, b = process.env.MAE_REF_B!
    let pior = 0, difs = 0, total = 0
    for (const f of readdirSync(a).filter(x => x.endsWith('.rgba'))) {
      const A = readFileSync(join(a, f)), B = readFileSync(join(b, f))
      expect(B.length, f).toBe(A.length)
      let n = 0, m = 0
      for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); if (d) { n++; if (d > m) m = d } }
      total += A.length; difs += n; pior = Math.max(pior, m)
      if (n) console.log(`${f}: ${n} valores diferentes (maior diferença ${m})`)
    }
    console.log(`TOTAL: ${difs} de ${total} valores diferentes · maior diferença ${pior}`)
    expect(pior).toBeLessThanOrEqual(1)
  })
})
