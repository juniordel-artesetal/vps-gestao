// Régua das mensalidades (16/10/2026, pedido do Júnior): lembrete 5/3/1 dia antes e no dia, cobrança em atraso,
// bloqueio depois de 3 dias, cobrança o mês todo e depois semanal — para SOA, Método Mãe, Pessoal e Marketplaces.
import { describe, it, expect } from 'vitest'
import { etapaDaCobranca, montarEmailMensal, tokenFatura, tokenFaturaValido, TOLERANCIA_ATRASO_DIAS, deveConvidarPixAuto, LINK_PIX_AUTO, type ItemEmail } from '@/lib/cobranca/reguaMensal'
import { DIAS_CARENCIA } from '@/lib/assinatura'
import { CARENCIA_DIAS_MAE } from '@/lib/mae/assinatura/precos'
import { CARENCIA_DIAS } from '@/lib/pessoal/assinatura'

describe('o calendário', () => {
  it('Pix/boleto: lembrete 5, 3, 1 dia antes e no dia; cartão (cobra sozinho): só 5 dias antes e no dia', () => {
    expect([6, 5, 4, 3, 2, 1, 0].map(d => etapaDaCobranca(d, false))).toEqual([null, 'LEMBRETE', null, 'LEMBRETE', null, 'LEMBRETE', 'LEMBRETE'])
    expect([5, 3, 1, 0].map(d => etapaDaCobranca(d, true))).toEqual(['LEMBRETE', null, null, 'LEMBRETE'])
  })
  it('atraso: D+1, último dia D+3, bloqueio D+4, cobrança a cada 3 dias até o D+28 e depois semanal', () => {
    const e = (a: number) => etapaDaCobranca(-a, true)
    expect([1, 2, 3, 4, 5, 6].map(e)).toEqual(['ATRASO', null, 'ULTIMO_DIA', 'BLOQUEIO', null, null])
    expect([7, 10, 13, 16, 19, 22, 25, 28].every(a => e(a) === 'COBRANCA')).toBe(true)
    expect([8, 9, 29, 30, 31, 34].map(e).every(x => x === null)).toBe(true)
    expect([35, 42, 49].every(a => e(a) === 'COBRANCA')).toBe(true)
  })
  it('a tolerância é a mesma nos 4 produtos: 3 dias', () => {
    expect([TOLERANCIA_ATRASO_DIAS, DIAS_CARENCIA, CARENCIA_DIAS_MAE, CARENCIA_DIAS]).toEqual([3, 3, 3, 3])
  })
})

describe('o e-mail', () => {
  const item = (x: Partial<ItemEmail>): ItemEmail => ({ produto: 'MAE', etapa: 'LEMBRETE', valor: 39.9, vencimento: '2026-10-21', diasParaVencer: 5, noCartao: false, bloqueado: false, paymentId: 'pay_abc123', ...x })
  const limpa = (h: string) => h.replace(/ /g, ' ')
  it('lembrete: produto, valor, data e o link de pagar no domínio do SOA (assinado)', () => {
    const r = montarEmailMensal('Maria Silva', [item({})]), h = limpa(r.html)
    expect(r.assunto).toBe('Lembrete: sua mensalidade do Método Mãe vence em 21/10')
    expect(h).toContain('Oi, Maria!'); expect(h).toContain('R$ 39,90'); expect(h).toContain('daqui a 5 dias')
    expect(h).toContain(`https://www.usesoa.com.br/api/cobranca/fatura?p=pay_abc123&t=${tokenFatura('pay_abc123')}`)
    expect([...h.matchAll(/href="([^"]+)"/g)].every(m => m[1].startsWith('https://www.usesoa.com.br/'))).toBe(true)
  })
  it('cartão: avisa que é automático (nada a fazer)', () => {
    expect(montarEmailMensal(null, [item({ noCartao: true, diasParaVencer: 0, vencimento: '2026-10-16' })]).html).toContain('automática no cartão')
  })
  it('vários produtos no mesmo dia = 1 e-mail; o assunto é o do item mais grave', () => {
    const r = montarEmailMensal(null, [item({}), item({ produto: 'SOA', etapa: 'BLOQUEIO', diasParaVencer: -4, vencimento: '2026-10-12', bloqueado: true, paymentId: 'pay_x' })])
    expect(r.assunto).toMatch(/foi pausado/)
    expect(r.html).toContain('Método Mãe'); expect(r.html).toContain('SOA')
    expect(r.html).toContain('Minha assinatura')
  })
  it('bloqueio só diz "pausado" se o acesso caiu de fato', () => {
    expect(montarEmailMensal(null, [item({ etapa: 'BLOQUEIO', diasParaVencer: -4, bloqueado: false })]).assunto).toMatch(/continua em aberto/)
    expect(montarEmailMensal(null, [item({ etapa: 'ULTIMO_DIA', diasParaVencer: -3 })]).assunto).toMatch(/Último dia/)
  })
  it('o link de pagar não abre com assinatura errada', () => {
    expect(tokenFaturaValido('pay_abc123', tokenFatura('pay_abc123'))).toBe(true)
    expect(tokenFaturaValido('pay_abc124', tokenFatura('pay_abc123'))).toBe(false)
  })
})

describe('convite para o Pix Automático (véspera do Pix avulso do SOA)', () => {
  it('só SOA, só D-1, só Pix avulso (nem cartão, nem quem já está no Pix Automático)', () => {
    expect(deveConvidarPixAuto('SOA', 1, 'PIX', null)).toBe(true)
    expect(deveConvidarPixAuto('SOA', 1, 'UNDEFINED', null)).toBe(true)
    expect(deveConvidarPixAuto('SOA', 3, 'PIX', null)).toBe(false)
    expect(deveConvidarPixAuto('SOA', 1, 'CREDIT_CARD', null)).toBe(false)
    expect(deveConvidarPixAuto('SOA', 1, 'PIX', 'lnk1')).toBe(false)
    expect(deveConvidarPixAuto('PESSOAL', 1, 'PIX', null)).toBe(false)
  })
  it('o e-mail convida, com o MESMO valor, o aviso de não pagar os dois e o Pix de amanhã como alternativa', () => {
    const r = montarEmailMensal('Ana', [{ produto: 'SOA', etapa: 'LEMBRETE', valor: 29.9, vencimento: '2026-10-17', diasParaVencer: 1, noCartao: false, bloqueado: false, paymentId: 'pay_1', convitePixAuto: true }])
    const h = r.html.replace(/ /g, ' ')
    expect(r.assunto).toMatch(/Pix Automático|nunca mais precisar lembrar/)
    expect(h).toContain(LINK_PIX_AUTO); expect(LINK_PIX_AUTO).toBe('https://www.usesoa.com.br/assinatura/pix-automatico')
    expect(h).toContain('R$ 29,90/mês'); expect(h).toContain('não pague os dois')
    expect(h).toContain(tokenFatura('pay_1'))
  })
})

