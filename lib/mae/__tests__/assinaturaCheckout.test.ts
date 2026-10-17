// Checkout do Método Mãe (Asaas simulado): o corpo enviado (cartão, recorrente, MONTHLY/YEARLY, 1ª cobrança no fim
// do trial de 7 dias, total com juros + maxInstallmentCount, externalReference "MAEA:"), venda fechada e sem
// cobrança dupla (assinatura viva não abre outro checkout).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const chamadas: { caminho: string; corpo?: Record<string, unknown>; metodo?: string }[] = []
let linhaWs: Record<string, unknown> = {}
let linhaAssinatura: Record<string, unknown> | null = null
let respostaAsaas: (caminho: string, metodo?: string) => { ok: boolean; status?: number; dados?: unknown } = () => ({ ok: true, dados: { id: 'chk_1', link: 'https://asaas/checkout/chk_1' } })
vi.mock('@/lib/pagamento/asaas/client', () => ({
  chamarAsaas: vi.fn(async (caminho: string, o?: { corpo?: Record<string, unknown>; metodo?: string }) => { chamadas.push({ caminho, corpo: o?.corpo, metodo: o?.metodo }); return respostaAsaas(caminho, o?.metodo) }),
}))
vi.mock('@/lib/mae/assinatura/emails', () => ({ emailInicioTesteMae: vi.fn(), emailAtrasoMae: vi.fn(), emailCanceladaMae: vi.fn(async () => true) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(async (q: TemplateStringsArray) => (q.join('?').includes('to_jsonb(w)') ? [{ j: linhaWs }] : linhaAssinatura ? [linhaAssinatura] : [])),
    $executeRaw: vi.fn(async () => 1),
  },
}))
vi.mock('@/lib/assinatura/validacaoCartao', () => ({ validarCartaoDoCheckout: vi.fn() }))
// lançamento 16/10: o SOA da conta está ativo? (inativo → assina SÓ o Método Mãe)
let soaAtivo = true
vi.mock('@/lib/assinatura', () => ({ temAcesso: vi.fn(async () => soaAtivo) }))

const ENV = { MAE_LANCAMENTO_EM: '2026-10-01T00:00:00Z', MAE_VENDA_ATIVO: 'on', MAE_ADDON_MENSAL: '39.90', MAE_ADDON_ANUAL: '383', MAE_STANDALONE_MENSAL: '59.90', MAE_STANDALONE_ANUAL: '503' }

describe('criarCheckoutMae', () => {
  beforeEach(() => { soaAtivo = true; chamadas.length = 0; linhaWs = {}; linhaAssinatura = null; Object.assign(process.env, ENV); respostaAsaas = () => ({ ok: true, dados: { id: 'chk_1', link: 'https://asaas/checkout/chk_1' } }) })
  it('add-on anual em 12× (pente-fino 16/10): compra PARCELADA de verdade (DETACHED+INSTALLMENT, installment.maxInstallmentCount), total com juros, sem assinatura recorrente', async () => {
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    const { calcularParcelamentoAnual } = await import('@/lib/assinatura/planos')
    const r = await criarCheckoutMae({ workspaceId: 'ws1', ciclo: 'anual', parcelas: 12, baseUrl: 'https://x' })
    expect(r).toEqual({ ok: true, link: 'https://asaas/checkout/chk_1' })
    const c = chamadas[0]
    expect(c.caminho).toBe('/checkouts')
    expect(c.corpo).toMatchObject({ billingTypes: ['CREDIT_CARD'], chargeTypes: ['DETACHED', 'INSTALLMENT'], externalReference: 'MAEA:ws1', installment: { maxInstallmentCount: 12 } })
    expect(c.corpo!.subscription).toBeUndefined(); expect(c.corpo!.maxInstallmentCount).toBeUndefined()
    expect((c.corpo!.items as { value: number }[])[0].value).toBe(calcularParcelamentoAnual(12, 383).total)
  })
  it('anual À VISTA = Pix ou cartão 1× (compra avulsa, nunca boleto); mensal = só cartão recorrente; nome do item ≤ 30', async () => {
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    await criarCheckoutMae({ workspaceId: 'ws7', ciclo: 'anual', parcelas: 1, baseUrl: 'https://x' })
    expect(chamadas[0].corpo).toMatchObject({ billingTypes: ['CREDIT_CARD', 'PIX'], chargeTypes: ['DETACHED'] })
    expect(chamadas[0].corpo!.subscription).toBeUndefined(); expect(JSON.stringify(chamadas[0].corpo)).not.toContain('BOLETO')
    expect((chamadas[0].corpo!.items as { value: number }[])[0].value).toBe(383)
    for (const it of chamadas.map(c => (c.corpo!.items as { name: string }[])[0])) expect(it.name.length).toBeLessThanOrEqual(30)
  })
  it('lançamento: conta com o SOA INATIVO assina só o Método Mãe (preço do standalone)', async () => {
    soaAtivo = false
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    await criarCheckoutMae({ workspaceId: 'ws9', ciclo: 'mensal', baseUrl: 'https://x' })
    expect((chamadas[0].corpo!.items as { value: number; name: string }[])[0]).toMatchObject({ value: 59.9 })
    expect((chamadas[0].corpo!.items as { name: string }[])[0].name).not.toMatch(/add-on/)
  })
  it('standalone mensal: R$ 59,90, MONTHLY, sem parcelas', async () => {
    linhaWs = { moduloMaePlano: 'standalone' }
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    await criarCheckoutMae({ workspaceId: 'ws2', ciclo: 'mensal', baseUrl: 'https://x' })
    expect((chamadas[0].corpo!.items as { value: number }[])[0].value).toBe(59.9)
    expect(chamadas[0].corpo).toMatchObject({ subscription: { cycle: 'MONTHLY' } })
    expect(chamadas[0].corpo!.maxInstallmentCount).toBeUndefined()
  })
  it('mensal no PIX AUTOMÁTICO (16/10): link de pagamento PIX recorrente MONTHLY com "MAEA:<ws>"; desligado → recusa', async () => {
    respostaAsaas = () => ({ ok: true, dados: { id: 'lnk1', url: 'https://www.asaas.com/c/lnk1' } })
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    const r = await criarCheckoutMae({ workspaceId: 'ws4', ciclo: 'mensal', baseUrl: 'https://x', metodo: 'pix' })
    expect(r).toEqual({ ok: true, link: 'https://www.asaas.com/c/lnk1' })
    expect(chamadas[0].caminho).toBe('/paymentLinks')
    expect(chamadas[0].corpo).toMatchObject({ billingType: 'PIX', chargeType: 'RECURRENT', subscriptionCycle: 'MONTHLY', value: 39.9, externalReference: 'MAEA:ws4' })
    expect(String(chamadas[0].corpo!.name).length).toBeLessThanOrEqual(30)
    // anual nunca vai pelo link (o pix do anual é à vista, no checkout)
    chamadas.length = 0
    await criarCheckoutMae({ workspaceId: 'ws4', ciclo: 'anual', parcelas: 1, baseUrl: 'https://x', metodo: 'pix' })
    expect(chamadas[0].caminho).toBe('/checkouts')
    process.env.PIX_AUTO = 'off'
    try { expect((await criarCheckoutMae({ workspaceId: 'ws4', ciclo: 'mensal', baseUrl: 'https://x', metodo: 'pix' })).ok).toBe(false) }
    finally { delete process.env.PIX_AUTO }
  })
  it('Plano Alunas (16/10): R$ 49,90 mensal e R$ 419 à vista, com o nome do plano no Asaas; link vencido → recusa', async () => {
    soaAtivo = false   // o Plano Alunas é para quem NÃO assina o SOA
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    await criarCheckoutMae({ workspaceId: 'ws5', ciclo: 'mensal', baseUrl: 'https://x', oferta: 'alunas' })
    const it0 = (chamadas[0].corpo!.items as { value: number; name: string; description: string }[])[0]
    expect(it0.value).toBe(49.9); expect(it0.name).toMatch(/Alunas/); expect(it0.description).toMatch(/Plano Alunas/)
    expect((chamadas[0].corpo!.callback as { successUrl: string }).successUrl).toContain('/mae/alunas?pago=1')
    chamadas.length = 0
    await criarCheckoutMae({ workspaceId: 'ws5', ciclo: 'anual', parcelas: 1, baseUrl: 'https://x', oferta: 'alunas' })
    expect((chamadas[0].corpo!.items as { value: number }[])[0].value).toBe(419)
    process.env.MAE_ALUNAS_ATE = '2026-01-01T00:00:00Z'
    try { const r = await criarCheckoutMae({ workspaceId: 'ws5', ciclo: 'mensal', baseUrl: 'https://x', oferta: 'alunas' }); expect(r.ok).toBe(false) }
    finally { delete process.env.MAE_ALUNAS_ATE }
  })
  it('Plano Alunas com assinante do SOA: entra no preço de assinante (R$ 39,90), voltando para a página das alunas', async () => {
    soaAtivo = true
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    await criarCheckoutMae({ workspaceId: 'ws6', ciclo: 'mensal', baseUrl: 'https://x', oferta: 'alunas' })
    const it0 = (chamadas[0].corpo!.items as { value: number; name: string }[])[0]
    expect(it0.value).toBe(39.9); expect(it0.name).not.toMatch(/Alunas/)
    expect((chamadas[0].corpo!.callback as { successUrl: string }).successUrl).toContain('/mae/alunas?pago=1')
  })
  it('PACOTE SOA + MAE (16/10): um item só de R$ 89,80/mês (recorrente) e R$ 753 à vista; o pagamento ativa o SOA e o MAE', async () => {
    const { criarCheckoutCombo, aplicarPagamentoMae } = await import('@/lib/mae/assinatura/servidor')
    const r = await criarCheckoutCombo({ workspaceId: 'ws8', ciclo: 'mensal', baseUrl: 'https://x' })
    expect(r.ok).toBe(true)
    const c = chamadas.find(x => x.caminho === '/checkouts')!
    const it0 = (c.corpo!.items as { value: number; name: string }[])
    expect(it0).toHaveLength(1); expect(it0[0].name).toBe('SOA + Método Mãe · mensal')
    expect(it0[0].value).toBeCloseTo(89.8, 2)
    expect(c.corpo).toMatchObject({ chargeTypes: ['RECURRENT'], billingTypes: ['CREDIT_CARD'], externalReference: 'MAEA:ws8', subscription: { cycle: 'MONTHLY' } })
    chamadas.length = 0
    await criarCheckoutCombo({ workspaceId: 'ws8', ciclo: 'anual', parcelas: 1, baseUrl: 'https://x' })
    expect((chamadas.find(x => x.caminho === '/checkouts')!.corpo!.items as { value: number }[])[0].value).toBe(753)
    // webhook: pagamento do pacote → SOA ATIVA (origem asaas) + acesso do MAE
    linhaAssinatura = { id: 'm8', workspaceId: 'ws8', plano: 'combo', ciclo: 'mensal', status: 'AGUARDANDO_PAGAMENTO', subscriptionId: 'sub_combo', parcelas: 1, valor: 89.8 }
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.$executeRaw as unknown as { mockClear: () => void }).mockClear()
    await aplicarPagamentoMae('PAYMENT_CONFIRMED', { id: 'pay_1', subscription: 'sub_combo', dueDate: '2026-10-17' })
    const sqls = (prisma.$executeRaw as unknown as { mock: { calls: [TemplateStringsArray][] } }).mock.calls.map(x => x[0].join('?'))
    expect(sqls.some(s => s.includes('"assinaturaStatus" = \'ATIVA\'') && s.includes('"assinaturaOrigem" = \'asaas\''))).toBe(true)
    expect(sqls.some(s => s.includes('"moduloMae" = true'))).toBe(true)
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

describe('reassinar e cancelar', () => {
  beforeEach(() => { soaAtivo = true; chamadas.length = 0; linhaWs = {}; linhaAssinatura = null; Object.assign(process.env, ENV); respostaAsaas = () => ({ ok: true, dados: { id: 'chk_1', link: 'https://asaas/checkout/chk_1' } }) })
  it('cancelou com acesso pago até depois de hoje: a nova 1ª cobrança cai no fim desse acesso', async () => {
    linhaWs = { moduloMae: true, moduloMaeOrigem: 'asaas', moduloMaeAte: '2099-01-10' }
    linhaAssinatura = { status: 'CANCELADA', trialUsado: true, valor: 39.9, ciclo: 'mensal', parcelas: 1, plano: 'addon' }
    const { criarCheckoutMae } = await import('@/lib/mae/assinatura/servidor')
    await criarCheckoutMae({ workspaceId: 'ws6', ciclo: 'mensal', baseUrl: 'https://x' })
    expect(chamadas[0].corpo).toMatchObject({ subscription: { nextDueDate: '2099-01-10' } })
  })
  it('cancelar: apaga no Asaas a gravada + as vivas com MAEA:<ws>; o Asaas recusando, nada é marcado', async () => {
    const { cancelarAssinaturaMae } = await import('@/lib/mae/assinatura/servidor')
    const { prisma } = await import('@/lib/prisma')
    linhaAssinatura = { id: 'm1', status: 'ATIVA', subscriptionId: 'sub_a', trialUsado: true, valor: 39.9, ciclo: 'mensal', parcelas: 1, plano: 'addon' }
    respostaAsaas = (c, m) => (m === 'DELETE' ? { ok: true } : { ok: true, dados: { data: [{ id: 'sub_a' }, { id: 'sub_b' }] } })
    const r = await cancelarAssinaturaMae('ws7', 'tela:x')
    expect(r.ok).toBe(true)
    expect(chamadas.filter(c => c.metodo === 'DELETE').map(c => c.caminho).sort()).toEqual(['/subscriptions/sub_a', '/subscriptions/sub_b'])
    expect(chamadas.find(c => c.metodo !== 'DELETE')?.caminho).toContain(encodeURIComponent('MAEA:ws7'))
    const marcou = (prisma.$executeRaw as unknown as { mock: { calls: unknown[][] } }).mock.calls.length
    chamadas.length = 0
    respostaAsaas = (c, m) => (m === 'DELETE' ? { ok: false, status: 500 } : { ok: true, dados: { data: [] } })
    const r2 = await cancelarAssinaturaMae('ws8', 'tela:x')
    expect(r2.ok).toBe(false)
    expect((prisma.$executeRaw as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(marcou)
    linhaAssinatura = { id: 'm2', status: 'CANCELADA', subscriptionId: null, trialUsado: true, valor: 0, ciclo: 'mensal', parcelas: 1, plano: 'addon' }
    expect((await cancelarAssinaturaMae('ws9', 'tela:x')).ok).toBe(false)
  })
})
