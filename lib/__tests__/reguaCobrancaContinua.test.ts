// Cobrança contínua (15/10/2026, decisão do Júnior): em atraso, o lembrete segue a cada 7 dias — com o acesso já
// pausado e também na Hotmart — até ela pagar ou CANCELAR a assinatura. E-mails sempre com o domínio do SOA.
import { describe, it, expect } from 'vitest'
import { decidir, decidirHotmart, diaDeLembrete, type LinhaRegua } from '@/lib/assinatura/regua'
import { PONTOS, montarEmail } from '@/lib/assinatura/avisos'
import { marcacoesPendentes } from '@/lib/assinatura/template'
import { URL_SOA } from '@/lib/baseUrl'

const HOJE = new Date('2026-10-15T12:00:00-03:00')
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86_400_000)
const linha = (x: Partial<LinhaRegua>): LinhaRegua => ({ workspaceId: 'w', assinaturaOrigem: 'asaas', assinaturaStatus: 'INADIMPLENTE', liberacaoManual: false, ativo: true, trialAte: null, assinaturaExpira: null, assinaturaViva: true, ...x })

describe('cobrança contínua — Asaas', () => {
  it('o lembrete cai no D13, D20, D27… (a cada 7 dias depois do D6)', () => {
    expect([6, 7, 12, 13, 14, 20, 27, 34].map(diaDeLembrete)).toEqual([false, false, false, true, false, true, true, true])
  })
  it('inadimplente: D0/D3/D6 como antes; o e-mail de pausa sai UMA vez (D8); depois, o lembrete semanal', () => {
    expect(decidir(linha({ assinaturaExpira: diasAtras(3) }), HOJE).avisos).toEqual(['INAD_D3'])
    const d8 = decidir(linha({ assinaturaExpira: diasAtras(8) }), HOJE)
    expect(d8.avisos).toEqual(['CORTE']); expect(d8.cortar).toBe(true)
    expect(decidir(linha({ assinaturaExpira: diasAtras(9) }), HOJE).avisos).toEqual([])      // não repete o "pausado" todo dia
    expect(decidir(linha({ assinaturaExpira: diasAtras(13) }), HOJE).avisos).toEqual(['COBRANCA_SEMANAL'])
  })
  it('já CORTADA com a assinatura viva: lembrete a cada 7 dias; cancelada (ou sem assinatura viva): para', () => {
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(20) }), HOJE).avisos).toEqual(['COBRANCA_SEMANAL'])
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(21) }), HOJE).avisos).toEqual([])
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(20), assinaturaViva: false }), HOJE).avisos).toEqual([])
    expect(decidir(linha({ assinaturaStatus: 'CANCELADA', assinaturaExpira: diasAtras(20) }), HOJE).avisos).toEqual([])
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(20), liberacaoManual: true }), HOJE).avisos).toEqual([])
  })
  it('anual (corte vetado) continua recebendo o lembrete semanal', () => {
    expect(decidir(linha({ assinaturaExpira: diasAtras(13), planoEscolhido: 'anual' }), HOJE).avisos).toEqual(['COBRANCA_SEMANAL'])
  })
})

describe('cobrança contínua — Hotmart', () => {
  it('o 1º lembrete na hora; depois a cada 7 dias a partir do último enviado; liberação manual não recebe', () => {
    expect(decidirHotmart({ workspaceId: 'w', ultimoAviso: null }, HOJE).avisos).toEqual(['HOTMART_ATRASO'])
    const toca = (n: number) => decidirHotmart({ workspaceId: 'w', ultimoAviso: diasAtras(n) }, HOJE).avisos.length > 0
    expect([1, 3, 6, 7, 8].map(toca)).toEqual([false, false, false, true, true])
    expect(decidirHotmart({ workspaceId: 'w', ultimoAviso: null, liberacaoManual: true }, HOJE).avisos).toEqual([])
  })
})

describe('os e-mails — domínio do SOA e sem buraco', () => {
  const comuns = { nome: 'Ester', workspaceNome: 'Ateliê da Ester', linkAssinatura: `${URL_SOA}/assinatura`, linkHotmart: 'https://consumer.hotmart.com', valor: '29,90' }
  it('o link é www.usesoa.com.br (nunca o domínio antigo)', () => {
    expect(URL_SOA).toBe('https://www.usesoa.com.br')
    for (const t of ['COBRANCA_SEMANAL', 'INAD_D6', 'CORTE'] as const) {
      const e = montarEmail(PONTOS[t], comuns)
      expect(e.texto).toContain('https://www.usesoa.com.br/assinatura')
      expect(e.texto + e.html).not.toContain('vps-gestao')
    }
  })
  it('lembrete semanal e Hotmart: todas as variáveis preenchidas; Hotmart manda pagar NA Hotmart', () => {
    const s = montarEmail(PONTOS.COBRANCA_SEMANAL, comuns)
    expect(marcacoesPendentes(s.texto + s.assunto)).toEqual([])
    expect(s.texto).toMatch(/cancelar a assinatura/)
    const h = montarEmail(PONTOS.HOTMART_ATRASO, comuns)
    expect(marcacoesPendentes(h.texto + h.assunto)).toEqual([])
    expect(h.texto).toContain('https://consumer.hotmart.com')
    expect(h.texto).not.toContain('/assinatura')
  })
})
