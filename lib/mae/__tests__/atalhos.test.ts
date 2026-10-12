// Lote 9 (item 148) — a tabela de atalhos (fonte única do teclado, dos menus e do "?").
import { describe, it, expect } from 'vitest'
import { ATALHOS, atalhoDoEvento, teclasDe } from '@/lib/mae/editor/atalhos'

const ev = (x: (typeof ATALHOS)[number]['ex']) => ({ key: x.key, code: x.code, ctrlKey: !!x.ctrl, shiftKey: !!x.shift, altKey: !!x.alt })

describe('148 — atalhos no padrão Photoshop', () => {
  it('cada atalho da tabela dispara a ação dele', () => {
    for (const a of ATALHOS) expect(atalhoDoEvento(ev(a.ex)), a.teclas).toBe(a.acao)
  })
  it('nenhuma ação repetida e nenhum exemplo de tecla repetido', () => {
    expect(new Set(ATALHOS.map(a => a.acao)).size).toBe(ATALHOS.length)
    expect(new Set(ATALHOS.map(a => JSON.stringify(a.ex))).size).toBe(ATALHOS.length)
  })
  it('variações reais do teclado', () => {
    expect(atalhoDoEvento({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('refazer')
    expect(atalhoDoEvento({ key: 'z', metaKey: true })).toBe('desfazer')                       // Mac
    expect(atalhoDoEvento({ key: 'ç', code: 'KeyC', ctrlKey: true, altKey: true })).toBe('copiarEstilo')   // AltGr troca a letra
    expect(atalhoDoEvento({ key: '+', ctrlKey: true, shiftKey: true })).toBe(null)
    expect(atalhoDoEvento({ key: 'Backspace' })).toBe('excluir')
    expect(atalhoDoEvento({ key: 'h', ctrlKey: true })).toBe(null)                               // Ctrl+H não espelha
    expect(atalhoDoEvento({ key: 'h' })).toBe(null)                                              // H sozinho não espelha
    expect(atalhoDoEvento({ key: 'a' })).toBe(null)
  })
  it('menus e dicas mostram a mesma tecla que o teclado usa', () => {
    expect(teclasDe('duplicar')).toMatch(/Ctrl\+J/)
    expect(teclasDe('mascaraCorte')).toBe('Ctrl+Alt+G')
    expect(teclasDe('espelharH')).toBe('Shift+H')
  })
})
