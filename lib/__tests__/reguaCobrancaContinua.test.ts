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
  // sem a régua das mensalidades (REGUA_MENSAL=off) ou no ANUAL, os avisos de atraso saem daqui — carência de 3 dias (16/10)
  it('inadimplente (régua antiga): D0/D1/D3; o e-mail de pausa sai UMA vez (D4); depois, o lembrete semanal', () => {
    expect(decidir(linha({ assinaturaExpira: diasAtras(1) }), HOJE, false).avisos).toEqual(['INAD_D3'])
    expect(decidir(linha({ assinaturaExpira: diasAtras(3) }), HOJE, false).avisos).toEqual(['INAD_D6'])
    const d4 = decidir(linha({ assinaturaExpira: diasAtras(4) }), HOJE, false)
    expect(d4.avisos).toEqual(['CORTE']); expect(d4.cortar).toBe(true)
    expect(decidir(linha({ assinaturaExpira: diasAtras(5) }), HOJE, false).avisos).toEqual([])      // não repete o "pausado" todo dia
    expect(decidir(linha({ assinaturaExpira: diasAtras(13) }), HOJE, false).avisos).toEqual(['COBRANCA_SEMANAL'])
  })
  it('MENSAL com a régua das mensalidades: nenhum e-mail daqui (não chega em dobro), mas o corte segue no D4', () => {
    expect(decidir(linha({ assinaturaExpira: diasAtras(1) }), HOJE, true).avisos).toEqual([])
    const d4 = decidir(linha({ assinaturaExpira: diasAtras(4) }), HOJE, true)
    expect(d4.avisos).toEqual([]); expect(d4.cortar).toBe(true)
    expect(decidir(linha({ assinaturaExpira: diasAtras(3) }), HOJE, true).cortar).toBe(false)
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(20) }), HOJE, true).avisos).toEqual([])
  })
  it('já CORTADA com a assinatura viva: lembrete a cada 7 dias; cancelada (ou sem assinatura viva): para', () => {
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(20) }), HOJE, false).avisos).toEqual(['COBRANCA_SEMANAL'])
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(21) }), HOJE, false).avisos).toEqual([])
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(20), assinaturaViva: false }), HOJE, false).avisos).toEqual([])
    expect(decidir(linha({ assinaturaStatus: 'CANCELADA', assinaturaExpira: diasAtras(20) }), HOJE, false).avisos).toEqual([])
    expect(decidir(linha({ assinaturaStatus: 'CORTADA', assinaturaExpira: diasAtras(20), liberacaoManual: true }), HOJE, false).avisos).toEqual([])
  })
  it('anual (corte vetado) continua recebendo o lembrete semanal, mesmo com a régua das mensalidades', () => {
    expect(decidir(linha({ assinaturaExpira: diasAtras(13), planoEscolhido: 'anual' }), HOJE, true).avisos).toEqual(['COBRANCA_SEMANAL'])
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

describe('parcela do anual que não entrou (16/10: saía todo dia)', () => {
  const anual = (x: Partial<LinhaRegua>) => linha({ assinaturaStatus: 'ATIVA', ciclo: 'YEARLY', parcelaFalhou: true, assinaturaExpira: diasAtras(-200), ...x })
  it('ativa com parcela falhada: 1ª vez e depois só a cada 7 dias', () => {
    expect(decidir(anual({}), HOJE).avisos).toEqual(['PARCELA_FALHOU'])
    expect(decidir(anual({ ultimoAvisoParcela: diasAtras(1) }), HOJE).avisos).toEqual([])
    expect(decidir(anual({ ultimoAvisoParcela: diasAtras(6) }), HOJE).avisos).toEqual([])
    expect(decidir(anual({ ultimoAvisoParcela: diasAtras(7) }), HOJE).avisos).toEqual(['PARCELA_FALHOU'])
  })
  it('inadimplente (caso Edclaudia): só os avisos de atraso, nada de "parcela" todo dia', () => {
    const l = anual({ assinaturaStatus: 'INADIMPLENTE', assinaturaExpira: diasAtras(5), planoEscolhido: 'anual' })
    expect(decidir(l, HOJE).avisos).not.toContain('PARCELA_FALHOU')
    expect(decidir({ ...l, assinaturaExpira: diasAtras(6) }, HOJE).avisos).not.toContain('PARCELA_FALHOU')
  })
})
