// ─────────────────────────────────────────────────────────────────────────────
// PROVA DA MATRIZ DE PREÇOS — o ponto onde errar custa dinheiro todo mês.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//        scripts/provar-precos.mjs
//
// Matriz fechada pelo Júnior:
//   Pix     mensal 29,90/mês  ·  anual 240,40 à vista (NUNCA 287,88)
//   Cartão  mensal 29,90/mês  ·  anual 240,40 à vista OU 12x de 23,99
// ─────────────────────────────────────────────────────────────────────────────
import { PLANOS, PARCELADO_12X, valorCobrado, parcelasDe, permiteParcelar } from '../lib/assinatura/planos.ts'

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const M = PLANOS.mensal, A = PLANOS.anual

console.log('\n=== PROVA — matriz de preços ===\n')

console.log('[1] PIX — nunca parcela, nunca 287,88')
checar('pix mensal = 29,90', valorCobrado(M, 'avista') === 29.90, String(valorCobrado(M, 'avista')))
checar('pix anual = 240,40', valorCobrado(A, 'avista') === 240.40, String(valorCobrado(A, 'avista')))
checar('pix anual NÃO permite parcelar', permiteParcelar(A, 'pix') === false)
checar('pix mensal NÃO permite parcelar', permiteParcelar(M, 'pix') === false)
// A guarda: mesmo pedindo parcelado no Pix, o valor tem de sair 240,40
const formaPix = permiteParcelar(A, 'pix') ? 'parcelado' : 'avista'
checar('pedir parcelado no Pix cobra 240,40 (não 287,88)', valorCobrado(A, formaPix) === 240.40,
  String(valorCobrado(A, formaPix)))

console.log('\n[2] CARTÃO — mensal e anual à vista')
checar('cartão mensal = 29,90', valorCobrado(M, 'avista') === 29.90)
checar('cartão anual à vista = 240,40', valorCobrado(A, 'avista') === 240.40)
checar('à vista = 1 parcela', parcelasDe(A, 'avista') === 1)
checar('mensal não parcela nem no cartão', permiteParcelar(M, 'cartao') === false)

console.log('\n[3] CARTÃO anual 12x — o item precisa ser 287,88')
checar('anual parcelado cobra 287,88', valorCobrado(A, 'parcelado') === 287.88, String(valorCobrado(A, 'parcelado')))
checar('em 12 parcelas', parcelasDe(A, 'parcelado') === 12)
checar('parcela = 23,99', Math.round(valorCobrado(A, 'parcelado') / 12 * 100) / 100 === 23.99,
  String(Math.round(valorCobrado(A, 'parcelado') / 12 * 100) / 100))
checar('cartão anual permite parcelar', permiteParcelar(A, 'cartao') === true)

console.log('\n[4] O erro que custaria R$ 47,48 por assinante')
const errado = Math.round(A.valor / 12 * 100) / 100
checar(`240,40/12 = ${errado} NÃO é o que cobramos`, errado !== PARCELADO_12X.valorParcela,
  `${errado} vs ${PARCELADO_12X.valorParcela}`)
checar('diferença registrada = R$ 47,48',
  Math.round((PARCELADO_12X.total - A.valor) * 100) / 100 === 47.48,
  String(Math.round((PARCELADO_12X.total - A.valor) * 100) / 100))

console.log('\n[5] Coerência interna do parcelamento')
checar('12 × 23,99 = 287,88',
  Math.round(PARCELADO_12X.parcelas * PARCELADO_12X.valorParcela * 100) / 100 === PARCELADO_12X.total)
checar('anual à vista é MAIS BARATO que parcelado', A.valor < PARCELADO_12X.total)
checar('anual à vista compensa contra o mensal', A.valor < M.valor * 12,
  `${A.valor} < ${M.valor * 12}`)
checar('anual 12x ainda compensa contra o mensal', PARCELADO_12X.total < M.valor * 12,
  `${PARCELADO_12X.total} < ${M.valor * 12}`)

console.log(`\n${falhas === 0 ? '✅ MATRIZ DE PREÇOS CONFERE' : `❌ ${falhas} falha(s)`}\n`)
process.exitCode = falhas === 0 ? 0 : 1
