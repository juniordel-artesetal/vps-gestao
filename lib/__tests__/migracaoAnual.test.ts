// Troca do SOA mensal → anual (16/10/2026): quem pode, o checkout (1ª cobrança no vencimento da mensal, sem cobrança
// dupla) e a conclusão (a mensal é apagada no Asaas com a cobrança pendente; o fim dela não cancela a conta).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const chamadas: { caminho: string; metodo?: string; corpo?: Record<string, unknown> }[] = []
const sqls: string[] = []
let respostas: (caminho: string, metodo?: string) => { ok: boolean; status?: number; dados?: unknown; erro?: string } = () => ({ ok: true, dados: {} })
let linhas: (sql: string) => unknown[] = () => []
vi.mock('@/lib/pagamento/asaas/client', () => ({
  chamarAsaas: vi.fn(async (caminho: string, o?: { metodo?: string; corpo?: Record<string, unknown> }) => { chamadas.push({ caminho, metodo: o?.metodo, corpo: o?.corpo }); return respostas(caminho, o?.metodo) }),
}))
vi.mock('@/lib/parceiras/split', () => ({ resolverSplitParceira: vi.fn(async () => ({ split: [] })) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(async (q: TemplateStringsArray) => { const s = q.join('?'); sqls.push(s); return linhas(s) }),
    $executeRaw: vi.fn(async (q: TemplateStringsArray) => { sqls.push(q.join('?')); return 1 }),
  },
}))

import { avaliarElegibilidade, criarCheckoutMigracao, concluirMigracaoAnual, ehMensalMigrada } from '@/lib/assinatura/migracaoAnual'
import { calcularParcelamentoAnual, anualAvistaVigente } from '@/lib/assinatura/planos'

const HOJE = '2026-10-16'
const base = { origem: 'asaas', status: 'ATIVA', migracaoConcluida: false, assinatura: { ciclo: 'MONTHLY', status: 'ACTIVE' }, asaas: { status: 'ACTIVE', cycle: 'MONTHLY', nextDueDate: '2026-11-05' }, hoje: HOJE }

describe('quem pode trocar para o anual', () => {
  it('assinante Asaas ATIVA com a mensal viva e em dia', () => expect(avaliarElegibilidade(base)).toEqual({ ok: true }))
  it('Hotmart, teste, já anual, mensal atrasada, sem mensal, já trocou → não (com o motivo)', () => {
    expect(avaliarElegibilidade({ ...base, origem: null })).toEqual({ ok: false, motivo: 'hotmart' })
    expect(avaliarElegibilidade({ ...base, status: 'TRIAL' })).toEqual({ ok: false, motivo: 'nao-ativa' })
    expect(avaliarElegibilidade({ ...base, asaas: { ...base.asaas, cycle: 'YEARLY' } })).toEqual({ ok: false, motivo: 'ja-anual' })
    expect(avaliarElegibilidade({ ...base, asaas: { ...base.asaas, nextDueDate: '2026-10-10' } })).toEqual({ ok: false, motivo: 'mensal-atrasada' })
    expect(avaliarElegibilidade({ ...base, assinatura: null })).toEqual({ ok: false, motivo: 'sem-mensal' })
    expect(avaliarElegibilidade({ ...base, migracaoConcluida: true })).toEqual({ ok: false, motivo: 'ja-trocou' })
  })
})

describe('checkout e conclusão', () => {
  beforeEach(() => { chamadas.length = 0; sqls.length = 0 })

  it('checkout do anual: cartão, YEARLY, 1ª cobrança NO VENCIMENTO da mensal, À VISTA (pente-fino 16/10: recorrente não parcela)', async () => {
    linhas = s => s.includes('FROM "Workspace"') ? [{ origem: 'asaas', status: 'ATIVA' }]
      : s.includes('FROM "AsaasAssinatura"') ? [{ subscriptionId: 'sub_mensal', ciclo: 'MONTHLY', status: 'ACTIVE', valor: 49.9 }] : []
    respostas = (c) => c.startsWith('/subscriptions/') ? { ok: true, dados: { status: 'ACTIVE', cycle: 'MONTHLY', nextDueDate: '2099-11-05' } } : { ok: true, dados: { id: 'chk_anual', link: 'https://asaas/chk_anual' } }
    const r = await criarCheckoutMigracao({ workspaceId: 'ws1', parcelas: 12, baseUrl: 'https://x' })
    expect(r).toEqual({ ok: true, link: 'https://asaas/chk_anual' })
    const c = chamadas.find(x => x.caminho === '/checkouts')!
    expect(c.corpo).toMatchObject({ billingTypes: ['CREDIT_CARD'], chargeTypes: ['RECURRENT'], externalReference: 'ws1', subscription: { cycle: 'YEARLY', nextDueDate: '2099-11-05' } })
    expect(c.corpo!.maxInstallmentCount).toBeUndefined()
    expect((c.corpo!.items as { value: number }[])[0].value).toBe(calcularParcelamentoAnual(1, anualAvistaVigente()).total)
    // o checkout da troca NÃO mexe no Workspace antes de pago (a mensal continua casando normalmente)
    expect(sqls.some(s => s.includes('UPDATE "Workspace"'))).toBe(false)
  })

  it('CHECKOUT_PAID: aponta o Workspace para o anual, tira a mensal da conta e apaga no Asaas (com a cobrança pendente)', async () => {
    linhas = s => s.includes('UPDATE "SoaMigracaoAnual"') ? [{ id: 'm1', workspaceId: 'ws1', subMensal: 'sub_mensal', parcelas: 12 }] : []
    respostas = (c, m) => c.includes('/payments?status=PENDING') ? { ok: true, dados: { data: [{ id: 'pay_pend', status: 'PENDING' }] } } : m === 'DELETE' && c === '/payments/pay_pend' ? { ok: false, status: 404 } : { ok: true, dados: {} }
    expect(await concluirMigracaoAnual('chk_anual')).toBe(true)
    expect(chamadas.some(x => x.caminho === '/subscriptions/sub_mensal' && x.metodo === 'DELETE')).toBe(true)
    expect(chamadas.some(x => x.caminho === '/payments/pay_pend' && x.metodo === 'DELETE')).toBe(true)
    expect(sqls.some(s => s.includes('UPDATE "Workspace" SET "checkoutId"'))).toBe(true)
    expect(sqls.some(s => s.includes('"canceladaPor" = \'migracao-anual\''))).toBe(true)
    expect(sqls.some(s => s.includes('"mensalCanceladaEm" = NOW()'))).toBe(true)
  })

  it('o Asaas recusou apagar a mensal → fica pendente para o cron (não marca como apagada)', async () => {
    linhas = s => s.includes('UPDATE "SoaMigracaoAnual" SET "status"') ? [{ id: 'm1', workspaceId: 'ws1', subMensal: 'sub_mensal', parcelas: 1 }] : []
    respostas = (c, m) => m === 'DELETE' ? { ok: false, status: 500, erro: 'falha' } : { ok: true, dados: { data: [] } }
    expect(await concluirMigracaoAnual('chk_anual')).toBe(true)
    expect(sqls.some(s => s.includes('"mensalCanceladaEm" = NOW()'))).toBe(false)
    expect(sqls.some(s => s.includes('SET "erro"'))).toBe(true)
  })

  it('checkout que não é de troca → false (segue o fluxo normal do SOA)', async () => {
    linhas = () => []
    expect(await concluirMigracaoAnual('chk_outro')).toBe(false)
  })

  it('SUBSCRIPTION_DELETED da mensal de uma troca → é dela (a conta NÃO vira CANCELADA)', async () => {
    linhas = s => s.includes('FROM "SoaMigracaoAnual"') ? [{ id: 'm1' }] : []
    expect(await ehMensalMigrada('sub_mensal')).toBe(true)
    expect(sqls.some(s => s.includes('"Workspace"'))).toBe(false)
    linhas = () => []
    expect(await ehMensalMigrada('sub_qualquer')).toBe(false)
  })
})
