// Checkout do Método Mãe (Asaas simulado): o corpo enviado (cartão, recorrente, MONTHLY/YEARLY, 1ª cobrança no fim
// do trial de 7 dias, total com juros + maxInstallmentCount, externalReference "MAEA:"), venda fechada e sem
// cobrança dupla (assinatura viva não abre outro checkout).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const chamadas: { caminho: string; corpo?: Record<string, unknown> }[] = []
let linhaWs: Record<string, unknown> = {}
let linhaAssinatura: Record<string, unknown> | null = null
vi.mock('@/lib/pagamento/asaas/client', () => ({
  chamarAsaas: vi.fn(async (caminho: string, o?: { corpo?: Record<string, unknown> }) => { chamadas.push({ caminho, corpo: o?.corpo }); return { ok: true, dados: { id: 'chk_1', link: 'https://asaas/checkout/chk_1' } } }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(async (q: TemplateStringsArray) => (q.join('?').includes('to_jsonb(w)') ? [{ j: linhaWs }] : linhaAssinatura ? [linhaAssinatura] : [])),
    $executeRaw: vi.fn(async () => 1),
  },
}))
vi.mock('@/lib/assinatura/validacaoCartao', () => ({ validarCartaoDoCheckout: vi.fn() }))

const ENV = { MAE_VENDA_ATIVO: 'on', MAE_ADDON_MENSAL: '39.90', MAE_ADDON_ANUAL: '383', MAE_STANDALONE_MENSAL: '59.90', MAE_STANDALONE_ANUAL: '503' }

describe('criarCheckoutMae', () => {
  beforeEach(() => { chamadas.length = 0; linhaWs = {}; linhaAssinatura = null; Object.assign(process.env, ENV) })
  it('add-on anual em 12×: total com juros, YEARLY, trial de 7 dias, ref MAEA', async () => {
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    const { somarDias, hojeSP } = await import('@/lib/mae/assinatura/precos')
    const { calcularParcelamentoAnual } = await import('@/lib/assinatura/planos')
    const r = await criarCheckoutMae({ workspaceId: 'ws1', ciclo: 'anual', parcelas: 12, baseUrl: 'https://x' })
    expect(r).toEqual({ ok: true, link: 'https://asaas/checkout/chk_1' })
    const c = chamadas[0]
    expect(c.caminho).toBe('/checkouts')
    expect(c.corpo).toMatchObject({ billingTypes: ['CREDIT_CARD'], chargeTypes: ['RECURRENT'], externalReference: 'MAEA:ws1', maxInstallmentCount: 12,
      subscription: { cycle: 'YEARLY', nextDueDate: somarDias(hojeSP(), 7) } })
    expect((c.corpo!.items as { value: number }[])[0].value).toBe(calcularParcelamentoAnual(12, 383).total)
  })
  it('standalone mensal: R$ 59,90, MONTHLY, sem parcelas', async () => {
    linhaWs = { moduloMaePlano: 'standalone' }
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    await criarCheckoutMae({ workspaceId: 'ws2', ciclo: 'mensal', baseUrl: 'https://x' })
    expect((chamadas[0].corpo!.items as { value: number }[])[0].value).toBe(59.9)
    expect(chamadas[0].corpo).toMatchObject({ subscription: { cycle: 'MONTHLY' } })
    expect(chamadas[0].corpo!.maxInstallmentCount).toBeUndefined()
  })
  it('quem já testou começa pagando hoje (sem 2º trial)', async () => {
    linhaAssinatura = { status: 'CANCELADA', trialUsado: true, valor: 0, ciclo: 'mensal', parcelas: 1, plano: 'addon' }
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    const { hojeSP } = await import('@/lib/mae/assinatura/precos')
    await criarCheckoutMae({ workspaceId: 'ws3', ciclo: 'mensal', baseUrl: 'https://x' })
    expect(chamadas[0].corpo).toMatchObject({ subscription: { nextDueDate: hojeSP() } })
  })
  it('sem cobrança dupla: trial/ativa não abre checkout; venda fechada também não', async () => {
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    linhaAssinatura = { status: 'ATIVA', trialUsado: true, valor: 39.9, ciclo: 'mensal', parcelas: 1, plano: 'addon' }
    expect(await criarCheckoutMae({ workspaceId: 'ws4', ciclo: 'mensal', baseUrl: 'https://x' })).toMatchObject({ ok: false })
    linhaAssinatura = null; process.env.MAE_VENDA_ATIVO = ''
    expect(await criarCheckoutMae({ workspaceId: 'ws5', ciclo: 'mensal', baseUrl: 'https://x' })).toMatchObject({ ok: false })
    expect(chamadas.length).toBe(0)
  })
})
