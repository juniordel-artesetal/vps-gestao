// Lote 22 (16/10/2026) — cliente "só MAE".
import { describe, it, expect } from 'vitest'
import { planoDaTela } from '@/lib/mae/pedidos/planoTela'

describe('257 — os botões do "só MAE" nunca somem', () => {
  it('conta só MAE: "mae" mesmo com a consulta falhando, demorando ou respondendo "soa" por erro', () => {
    expect(planoDaTela(true, null)).toBe('mae')       // consulta falhou / ainda carregando
    expect(planoDaTela(true, undefined)).toBe('mae')
    expect(planoDaTela(true, 'soa')).toBe('mae')      // servidor caiu no catch → "soa"
    expect(planoDaTela(true, 'mae')).toBe('mae')
  })
  it('conta SOA completa: igual a antes (começa em "soa"; só muda se a consulta disser "mae")', () => {
    expect(planoDaTela(false, null)).toBe('soa')
    expect(planoDaTela(false, 'soa')).toBe('soa')
    expect(planoDaTela(false, 'mae')).toBe('mae')     // conta avulsa antiga (não standalone) segue funcionando
  })
})
