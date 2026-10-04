import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { gravar, ler, listar, normalizarCaminho, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { criarEstrutura, PASTAS_BIBLIOTECA } from '@/lib/mae/biblioteca/estrutura'
import { PastaFalsa, comoHandle } from './fsFalso'

describe('Biblioteca MAE (pasta local)', () => {
  it('cria as 10 pastas e é idempotente', async () => {
    const raiz = new PastaFalsa()
    await criarEstrutura(comoHandle(raiz))
    await gravar(comoHandle(raiz), 'Backups/manter.txt', 'não apagar')
    await criarEstrutura(comoHandle(raiz))
    const l = await listar(comoHandle(raiz))
    expect(l.map(e => e.nome).sort()).toEqual([...PASTAS_BIBLIOTECA].sort())
    expect(l.every(e => e.tipo === 'pasta')).toBe(true)
    expect(await (await ler(comoHandle(raiz), 'Backups/manter.txt')).text()).toBe('não apagar')
  })
  it('grava e lê (texto e binário), criando subpastas com acento', async () => {
    const raiz = comoHandle(new PastaFalsa())
    const json = JSON.stringify({ teste: 'Método MAE ✓' })
    await gravar(raiz, 'Backups/teste-mae.json', json)
    expect(await (await ler(raiz, 'Backups/teste-mae.json')).text()).toBe(json)
    const bin = new Uint8Array([0, 1, 2, 250, 255])
    await gravar(raiz, 'Papéis/stitch/praia.bin', new Blob([bin]))
    expect(new Uint8Array(await (await ler(raiz, 'Papéis/stitch/praia.bin')).arrayBuffer())).toEqual(bin)
    expect(await listar(raiz, 'Papéis/stitch')).toEqual([{ nome: 'praia.bin', tipo: 'arquivo' }])
  })
  it('regravar substitui o conteúdo', async () => {
    const raiz = comoHandle(new PastaFalsa())
    await gravar(raiz, 'Temas/a.json', 'velho')
    await gravar(raiz, 'Temas/a.json', 'novo')
    expect(await (await ler(raiz, 'Temas/a.json')).text()).toBe('novo')
  })
  it('ler arquivo que não existe dá NotFoundError', async () => {
    await expect(ler(comoHandle(new PastaFalsa()), 'Bases/nada.json')).rejects.toMatchObject({ name: 'NotFoundError' })
  })
  it('recusa caminhos perigosos ou inválidos no Windows', () => {
    for (const c of ['../x', 'Temas/../../x', '/abs', 'C:\\x', 'a/./b', 'Temas/ruim?.png', 'Temas/con.png', 'Temas/pasta./x', ''])
      expect(() => normalizarCaminho(c), c).toThrow()
    expect(normalizarCaminho('Papéis\\stitch\\praia.png')).toEqual(['Papéis', 'stitch', 'praia.png'])
  })
  it('sha256 de um molde REAL (docs/mae-exemplos) bate com o do Node', async () => {
    const arq = path.resolve('docs/mae-exemplos/moldes/MILK.pdf')
    const buf = readFileSync(arq)
    expect(await sha256(new Blob([buf]))).toBe(createHash('sha256').update(buf).digest('hex'))
    // e continua igual depois de gravar e ler na Biblioteca
    const raiz = comoHandle(new PastaFalsa())
    await gravar(raiz, 'Bases/moldes/MILK.pdf', new Blob([buf]))
    expect(await sha256(await ler(raiz, 'Bases/moldes/MILK.pdf'))).toBe(createHash('sha256').update(buf).digest('hex'))
  })
})
