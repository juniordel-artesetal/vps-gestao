// Lote 16 (P0, itens 203/204): nome comprido (o nome do arquivo inteiro) derrubava TODO salvamento — o local, o
// rascunho e o servidor validam com o mesmo schema. Agora o nome é cortado; a recusa aparece em português.
import { describe, it, expect } from 'vitest'
import { DocTema, DocBase } from '@/lib/mae/schema'
import { idDaParte, novaParte } from '@/lib/mae/vinculo/partes'
import { colocarPapel, novoTema } from '@/lib/mae/vinculo/tema'
import { explicarRecusa, mensagemDeErro } from '@/lib/mae/erros'

const ARQUIVO_NATY = 'rotulo-NUTELLA_carros-disney-mod-2-todos-personagens_Gabriel-rotulos-nutella-20x3,5-cm'

function temaComNomeComprido() {
  const t = novoTema({ nome: 'Nutella_carros teste', baseId: 'base_tmjyqwqw', baseVersion: 1 })
  for (const p of ['p_fundo_0', 'p_miolo_1']) {
    t.partContent[p] = [{ id: `l_${p}`, type: 'image', anchor: 'paper', path: 'Papéis/x.png', sha256: 'abcd', aspect: 1, name: ARQUIVO_NATY + '-' + ARQUIVO_NATY, transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } } as never]
  }
  return t
}

describe('204 — nome comprido não derruba o salvamento', () => {
  it('o tema da Naty (camada com 180 letras) agora passa, com o nome cortado em 80', () => {
    const t = temaComNomeComprido()
    const r = DocTema.safeParse(t)
    expect(r.success).toBe(true)
    if (r.success) for (const p of ['p_fundo_0', 'p_miolo_1']) {
      const nome = (r.data.partContent[p][0] as { name?: string }).name!
      expect(nome.length).toBeLessThanOrEqual(80)
      expect(nome.startsWith('rotulo-NUTELLA_carros')).toBe(true)
    }
  })
  it('nome do tema, do produto e do grupo também cortam (e o vazio continua recusado)', () => {
    const t = { ...temaComNomeComprido(), name: 'x'.repeat(200), produto: 'p'.repeat(200) }
    const r = DocTema.safeParse(t)
    expect(r.success).toBe(true)
    if (r.success) { expect(r.data.name!.length).toBe(120); expect(r.data.produto!.length).toBe(80) }
    expect(DocTema.safeParse({ ...t, name: '' }).success).toBe(false)
  })
  it('colocarPapel com o nome do arquivo inteiro → camada com até 80 letras', () => {
    const t = novoTema({ nome: 'T', baseId: 'b', baseVersion: 1 })
    colocarPapel(t, 'p_frente', { path: 'Temas/x.jpg', sha256: 'abcd', aspect: 2, nome: ARQUIVO_NATY + ARQUIVO_NATY })
    expect((t.partContent.p_frente[0] as { name?: string }).name!.length).toBe(80)
  })
  it('o id da parte é curto (não carrega o nome do arquivo); o nome fica inteiro como rótulo', () => {
    expect(idDaParte(ARQUIVO_NATY).length).toBeLessThanOrEqual(26)
    expect(idDaParte('FRENTE')).toBe('p_frente')                 // a lista pronta não muda
    expect(idDaParte('LATERAL ESQUERDA')).toBe('p_lateral_esquerda')
    const d = { parts: [] as { id: string; name: string; instances: unknown[] }[] }
    const a = novaParte(d as never, ARQUIVO_NATY.toUpperCase()), b = novaParte(d as never, ARQUIVO_NATY.toUpperCase())
    expect(a).not.toBe(b)
    expect(d.parts[0].name.length).toBe(60)
  })
  it('a base também: nome de molde/parte comprido corta', () => {
    const base = { schemaVersion: 1, type: 'base', id: 'b1', version: 1, name: 'B'.repeat(300), molds: [], artboards: [], parts: [{ id: 'p_x', name: 'P'.repeat(100), instances: [] }], textSlots: [] }
    const r = DocBase.safeParse(base)
    if (r.success) { expect(r.data.name.length).toBe(120); expect(r.data.parts[0].name.length).toBe(60) }
    else expect(r.error.issues.some(i => i.code === 'too_big')).toBe(false)
  })
})

describe('203 — a recusa em português, nunca o JSON cru', () => {
  it('o 400 do servidor (o do log da Naty) vira uma frase', () => {
    const detalhes = [
      { origin: 'string', code: 'too_big', maximum: 80, inclusive: true, path: ['partContent', 'p_fundo_0', 0, 'name'], message: 'Too big' },
      { origin: 'string', code: 'too_big', maximum: 80, inclusive: true, path: ['partContent', 'p_miolo_1', 0, 'name'], message: 'Too big' },
    ]
    expect(explicarRecusa(detalhes)).toBe('o nome de uma camada passa de 80 letras (e mais 1 problema)')
  })
  it('erro do zod no salvar local → mensagem sem "too_big" nem "path"', () => {
    const r = DocTema.safeParse({ type: 'theme' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const m = mensagemDeErro(r.error)
      expect(m).toMatch(/^A receita não pôde ser salva: /)
      expect(m).not.toMatch(/too_big|"path"|\[|\{/)
    }
  })
})
