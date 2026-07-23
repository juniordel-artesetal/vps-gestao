// Prova do mascaramento LGPD do webhook do Asaas. Não toca banco nem rede.
//   node --experimental-strip-types scripts/testar-mascaramento-asaas.mts
import { mascararPayload } from '../lib/pagamento/asaas/mascarar.ts'

let falhas = 0
function checar(nome: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado)
  if (!ok) falhas++
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${ok ? '' : `\n       esperado: ${JSON.stringify(esperado)}\n       obtido:   ${JSON.stringify(real)}`}`)
}

// Payload PAYMENT_RECEIVED no formato documentado pelo Asaas (campos abreviados,
// mas com a mesma ESTRUTURA: customer só como id, creditCard aninhado, split array).
const payload = {
  id: 'evt_05b708f061b9b1c4f2f5c1cc5b1b1b1b',
  event: 'PAYMENT_RECEIVED',
  dateCreated: '2026-07-22 10:15:00',
  account: { id: 'acc_000001', ownerId: 'own_000001' },
  payment: {
    object: 'payment',
    id: 'pay_9558487472817',
    customer: 'cus_000005219613',          // ← só o id, sem PII
    subscription: 'sub_VXJBYgP2u0eO',
    value: 89.9,
    netValue: 87.42,
    status: 'RECEIVED',
    billingType: 'CREDIT_CARD',
    dueDate: '2026-07-25',
    externalReference: 'ws_abc123',
    creditCard: {
      creditCardNumber: '4444',            // ← deve sumir
      creditCardBrand: 'MASTERCARD',
      creditCardToken: 'a75a1d98-c52d-4a6b-a413-71e00b193c99', // ← deve sumir
    },
    split: [{ walletId: '0000c712-0a0b-a0b0-0000-031e7ac51a2', fixedValue: 26.97 }],
  },
}

console.log('\n=== Mascaramento do payload do webhook (LGPD) ===\n')
const m = mascararPayload(payload) as typeof payload

console.log('[1] Evento PAYMENT_* — o que é preservado (necessário para processar):')
checar('id do evento (idempotência)', m.id, payload.id)
checar('tipo do evento', m.event, 'PAYMENT_RECEIVED')
checar('id da cobrança', m.payment.id, 'pay_9558487472817')
checar('id da assinatura', m.payment.subscription, 'sub_VXJBYgP2u0eO')
checar('customer (só id, não é PII)', m.payment.customer, 'cus_000005219613')
checar('valor bruto', m.payment.value, 89.9)
checar('valor líquido', m.payment.netValue, 87.42)
checar('walletId do split', m.payment.split[0].walletId, payload.payment.split[0].walletId)

console.log('\n[2] Dado de cartão — removido mesmo estando aninhado:')
checar('creditCardNumber', m.payment.creditCard.creditCardNumber, '[REMOVIDO]')
checar('creditCardToken', m.payment.creditCard.creditCardToken, '[REMOVIDO]')
checar('bandeira preservada (não é PII)', m.payment.creditCard.creditCardBrand, 'MASTERCARD')

// Outros tipos de evento (transferência, Pix, nota fiscal) PODEM trazer PII
// expandida. Como a URL é a mesma, o mascaramento precisa pegá-los sem que
// tenhamos previsto o formato.
console.log('\n[3] Evento hipotético com PII expandida (defesa contra formato não previsto):')
const comPii = mascararPayload({
  id: 'evt_x', event: 'TRANSFER_CREATED',
  transfer: {
    value: 500,
    bankAccount: {
      name: 'Maria da Silva',
      cpfCnpj: '123.456.789-09',
      email: 'maria.silva@gmail.com',
      mobilePhone: '(11) 98765-4321',
    },
  },
}) as any

checar('cpfCnpj mascarado', comPii.transfer.bankAccount.cpfCnpj, '***09')
checar('email mascarado', comPii.transfer.bankAccount.email, 'm***@gmail.com')
checar('telefone mascarado', comPii.transfer.bankAccount.mobilePhone, '***4321')
checar('nome preservado (auditoria de suporte)', comPii.transfer.bankAccount.name, 'Maria da Silva')
checar('valor preservado', comPii.transfer.value, 500)

console.log('\n[4] Robustez — mascarar NUNCA pode derrubar o webhook:')
checar('null', mascararPayload(null), null)
checar('undefined', mascararPayload(undefined), undefined)
checar('array na raiz', mascararPayload([{ cpf: '11122233396' }]), [{ cpf: '***96' }])
checar('cpfCnpj vazio', mascararPayload({ cpfCnpj: '' }), { cpfCnpj: '***' })
checar('cpfCnpj nulo não vira string', mascararPayload({ cpfCnpj: null }), { cpfCnpj: null })

console.log(`\n${falhas === 0 ? '✅ TODAS as checagens passaram' : `❌ ${falhas} checagem(ns) falharam`}\n`)
process.exitCode = falhas === 0 ? 0 : 1
