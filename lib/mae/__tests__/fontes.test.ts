import { describe, expect, it } from 'vitest'
import { listarFontes, agruparPorFamilia, arquivoDaFonte } from '@/lib/mae/fontes/fontesLocais'
import { suportaMae } from '@/lib/mae/fontes/suporte'

const FONTES = [
  { family: 'Pacifico', fullName: 'Pacifico Regular', postscriptName: 'Pacifico-Regular', style: 'Regular' },
  { family: 'Amarillo', fullName: 'Amarillo', postscriptName: 'Amarillo', style: 'Regular' },
  { family: 'DM Serif Display', fullName: 'DM Serif Display Italic', postscriptName: 'DMSerifDisplay-Italic', style: 'Italic' },
  { family: 'DM Serif Display', fullName: 'DM Serif Display', postscriptName: 'DMSerifDisplay-Regular', style: 'Regular' },
  { family: 'Amarillo', fullName: 'Amarillo', postscriptName: 'Amarillo', style: 'Regular' },   // .otf e .ttf da mesma fonte
]

describe('fontes locais (Local Font Access)', () => {
  it('agrupa por família em ordem alfabética, sem repetir estilos', () => {
    const f = agruparPorFamilia(FONTES)
    expect(f.map(x => x.family)).toEqual(['Amarillo', 'DM Serif Display', 'Pacifico'])
    expect(f[0].estilos).toHaveLength(1)
    expect(f[1].estilos.map(e => e.style).sort()).toEqual(['Italic', 'Regular'])
  })
  it('lista pela API do navegador (simulada)', async () => {
    const r = await listarFontes(async () => FONTES)
    expect(r).toMatchObject({ ok: true, total: 5 })
    if (r.ok) expect(r.familias).toHaveLength(3)
  })
  it('permissão negada vira mensagem clara; navegador sem suporte também', async () => {
    const negada = await listarFontes(async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }) })
    expect(negada).toMatchObject({ ok: false, motivo: 'negada' })
    expect(await listarFontes(null)).toMatchObject({ ok: false, motivo: 'sem-suporte' })
  })
  it('lê o arquivo da fonte pelo postscriptName (Sprint 7 usa)', async () => {
    const blob = new Blob(['fonte'])
    const b = await arquivoDaFonte('Pacifico-Regular', async () => [{ ...FONTES[0], blob: async () => blob }])
    expect(b).toBe(blob)
    expect(await arquivoDaFonte('Inexistente', async () => FONTES)).toBeNull()
  })
  it('suporte: Chrome/Edge têm as duas APIs; Firefox não', () => {
    expect(suportaMae({ showDirectoryPicker: () => {}, queryLocalFonts: () => {} })).toEqual({ ok: true, faltando: [] })
    expect(suportaMae({}).ok).toBe(false)
    expect(suportaMae({}).faltando).toHaveLength(2)
  })
})
