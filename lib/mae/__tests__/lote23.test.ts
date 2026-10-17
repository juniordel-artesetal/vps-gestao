// Lote 23 (17/10/2026) — 267: tema pronto com vários PNG, "+ Adicionar página", trocar arquivo, dpi e folha.
import { describe, it, expect } from 'vitest'
import { montarTemaPronto, adicionarPaginasNaBase, papelDasPaginasNovas, trocarArquivoNaBase, ordemDosArquivos, folhaParecida, type PaginaPronta } from '@/lib/mae/temasProntos/montar'
import { dpiDaImagem, comPhys } from '@/lib/mae/exportar/png'

const pg = (n: string, i: number): PaginaPronta => ({ nome: n, wMm: 210, hMm: 297, imagem: { path: `Temas/${n}.png`, sha256: `sha${i}`, aspect: 210 / 297, nome: n }, fonte: { path: `Temas/${n}.png`, sha256: `sha${i}`, kind: 'png' } })

describe('267 — vários PNG, um por página', () => {
  it('3 PNG = 3 pranchetas, na ordem, cada molde apontando para o SEU arquivo', () => {
    const { base, tema } = montarTemaPronto({ nome: 'Dourado', arquivo: { path: 'Temas/a.png', sha256: 'sha0', kind: 'png' }, paginas: [pg('CAIXA 1', 1), pg('CAIXA 2', 2), pg('CAIXA 3', 3)] })
    expect(base.artboards.map(a => a.name)).toEqual(['CAIXA 1', 'CAIXA 2', 'CAIXA 3'])
    expect(base.molds.map(m => m.source.path)).toEqual(['Temas/CAIXA 1.png', 'Temas/CAIXA 2.png', 'Temas/CAIXA 3.png'])
    expect(Object.keys(tema.partContent)).toHaveLength(3)
  })
  it('"+ Adicionar página": a 4ª entra NA MESMA base (mesmo id), com o papel no tema; trocar o arquivo de uma página', () => {
    const { base, tema } = montarTemaPronto({ nome: 'Dourado', arquivo: { path: 'Temas/a.png', sha256: 'sha0', kind: 'png' }, paginas: [pg('CAIXA 1', 1), pg('CAIXA 2', 2), pg('CAIXA 3', 3)] })
    const id = base.id
    const novas = [pg('CAIXA 4', 4)]
    const partes = adicionarPaginasNaBase(base, novas)
    papelDasPaginasNovas(tema, partes, novas)
    expect(base.id).toBe(id); expect(base.artboards).toHaveLength(4); expect(base.artboards[3].name).toBe('CAIXA 4')
    expect(base.molds[3].source.path).toBe('Temas/CAIXA 4.png')
    expect((tema.partContent[partes[0]] as { path?: string }[])[0].path).toBe('Temas/CAIXA 4.png')
    const ab2 = base.artboards[1].id
    const parte = trocarArquivoNaBase(base, ab2, { fonte: { path: 'Temas/novo.png', sha256: 'shaN', kind: 'png' } })
    expect(parte).toBeTruthy(); expect(base.molds.find(m => m.artboardId === ab2)!.source.path).toBe('Temas/novo.png')
  })
  it('ordem dos arquivos pelo nome, "humana" (2 antes de 10)', () => {
    expect(ordemDosArquivos(['Temas/pagina-10.png', 'Temas/pagina-2.png', 'Temas/pagina-1.png'])).toEqual(['Temas/pagina-1.png', 'Temas/pagina-2.png', 'Temas/pagina-10.png'])
  })
  it('tamanho real pelos dpi do PNG; sem dpi → null (o MAE usa 300)', () => {
    // PNG mínimo (assinatura + IHDR + IEND) e o mesmo com pHYs de 150 dpi
    const ihdr = [0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0, 0, 0, 0]
    const iend = [0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0]
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...ihdr, ...iend])
    expect(dpiDaImagem(png)).toBeNull()
    expect(dpiDaImagem(comPhys(png, 150))).toBe(150)
    expect(dpiDaImagem(comPhys(png, 300))).toBe(300)
  })
  it('folha: A4 salvo a 72 dpi (mesma proporção) ou 206 × 292 → sugere A4; A4 exato → nada', () => {
    expect(folhaParecida(793.8, 1122.5)?.nome).toMatch(/A3|A4/)
    expect(folhaParecida(206, 292)).toMatchObject({ nome: 'A4 retrato', wMm: 210, hMm: 297 })
    expect(folhaParecida(297.3, 209.8)).toBeNull()
    expect(folhaParecida(100, 300)).toBeNull()
  })
})
