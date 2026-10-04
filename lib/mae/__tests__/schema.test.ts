import { describe, expect, it } from 'vitest'
import { DocBase, DocTema, novoDocumento, CaminhoRelativo, medidasFolha } from '@/lib/mae/schema'

// Exemplos copiados da spec (docs/mae-spec.md → Modelo de dados).
const BASE_DA_SPEC = {
  schemaVersion: 1, type: 'base', id: 'base_kitfesta6', version: 3,
  name: 'Kit 6 caixas', units: 'mm',
  smartArt: { overflowMm: 10 },
  artboards: [
    { id: 'ab_1', widthMm: 210, heightMm: 297, registrationPresetId: 'reg_a4' },
    { id: 'ab_apl_print', widthMm: 210, heightMm: 297, role: 'appliques_print' },
    { id: 'ab_apl_cut', widthMm: 210, heightMm: 297, role: 'appliques_silhouette' },
  ],
  molds: [
    { id: 'm_milk', name: 'MILK', artboardId: 'ab_1',
      source: { path: 'Bases/moldes/milk.svg', sha256: '9f2c…', widthMm: 182 },
      transform: { xMm: 12, yMm: 10, rotationDeg: 0 },
      faces: [
        { id: 'f_milk_frente', partId: 'p_frente',
          polygonMm: [[40.1, 62.0], [95.3, 62.0], [95.3, 140.2], [40.1, 140.2]],
          edges: [{ from: 0, to: 1, kind: 'fold' }, { from: 3, to: 0, kind: 'cut' }] },
      ],
      identity: { logo: { xMm: 70, yMm: 160, wMm: 12 }, qr: { xMm: 88, yMm: 158, wMm: 14 } } },
  ],
  parts: [
    { id: 'p_frente', name: 'FRENTE', referenceAspect: 0.706,
      instances: [
        { faceId: 'f_milk_frente', fit: { mode: 'cover', scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0 } },
        { faceId: 'f_piramide_frente', fit: { mode: 'cover', scale: 1.15, offsetY: -0.08 } },
      ] },
  ],
  textSlots: [
    { id: 'ts_nome_milk', variable: 'NOME', faceId: 'f_milk_frente',
      box: { x: 0.1, y: 0.62, w: 0.8, h: 0.18 },
      single: { lines: 1, sizePt: 28 },
      compound: { lines: 2, sizePt: 22, lineHeight: 0.9 },
      autoFit: { minScale: 0.7 } },
  ],
}

const TEMA_DA_SPEC = {
  schemaVersion: 1, type: 'theme', id: 'th_stitch_angel', version: 5,
  baseId: 'base_kitfesta6', baseVersion: 3,
  overflowFill: { path: 'Papéis/stitch/hibisco_rosa.png' },
  partContent: {
    p_frente: [
      { id: 'l_papel', type: 'image', path: 'Papéis/stitch/praia.png', sha256: 'a81b…', anchor: 'paper' },
      { id: 'l_angel', type: 'image', path: 'Elementos/stitch/angel_1.png', anchor: 'face',
        transform: { x: 0.5, y: 0.45, scale: 0.6 },
        effects: [{ type: 'dropShadow', color: '#00000055', distanceMm: 0.8, sizeMm: 1.2 }],
        applique: { enabled: true, borderMm: 1.0, borderColor: '#FFFFFF', silhouetteMm: 3.0 } },
      { id: 'l_nome', type: 'text', slot: 'NOME',
        font: { postscriptName: 'MagicSparkles-Regular', features: { liga: 1, swsh: 1 } },
        effectPresetId: 'ep_rosa_glitter' },
    ],
  },
  localOverrides: { f_cone_frente: { l_angel: { transform: { y: 0.32, scale: 0.48 } } } },
  hashtag: { middle: 'faz' },
}

describe('mae-schema', () => {
  it('aceita o exemplo de BASE da spec', () => {
    const r = DocBase.safeParse(BASE_DA_SPEC)
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true)
  })
  it('aceita o exemplo de TEMA da spec (com efeitos e ajuste local)', () => {
    const r = DocTema.safeParse(TEMA_DA_SPEC)
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true)
  })
  it('recusa caminho fora da Biblioteca, absoluto ou com barra invertida', () => {
    for (const p of ['../segredo.png', 'Papéis/../../x.png', '/etc/passwd', 'C:/Windows/x.png', 'Papéis\\x.png', './x.png'])
      expect(CaminhoRelativo.safeParse(p).success, p).toBe(false)
    expect(CaminhoRelativo.safeParse('Papéis/stitch/praia.png').success).toBe(true)
  })
  it('recusa mm negativo, prancheta zerada e schemaVersion errado', () => {
    expect(DocBase.safeParse({ ...BASE_DA_SPEC, artboards: [{ id: 'a', widthMm: -210, heightMm: 297 }] }).success).toBe(false)
    expect(DocBase.safeParse({ ...BASE_DA_SPEC, artboards: [{ id: 'a', widthMm: 0, heightMm: 297 }] }).success).toBe(false)
    expect(DocBase.safeParse({ ...BASE_DA_SPEC, schemaVersion: 2 }).success).toBe(false)
    expect(DocBase.safeParse({ ...BASE_DA_SPEC, units: 'px' }).success).toBe(false)
  })
  it('documento novo = uma A4 vazia válida; folhas e orientação', () => {
    const d = novoDocumento()
    expect(DocBase.safeParse(d).success).toBe(true)
    expect(d.artboards).toHaveLength(1)
    expect(d.artboards[0]).toMatchObject({ widthMm: 210, heightMm: 297 })
    expect(medidasFolha('A4', 'paisagem')).toEqual({ widthMm: 297, heightMm: 210 })
    expect(medidasFolha('A6')).toEqual({ widthMm: 105, heightMm: 148 })
  })
})
