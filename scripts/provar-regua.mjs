// ─────────────────────────────────────────────────────────────────────────────
// PROVA da Etapa 5 — a régua, sem banco e sem e-mail.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//        --env-file=.env --env-file=.env.local scripts/provar-regua.mjs
//
// decidir() é pura: dá para forjar datas e exercitar TODOS os dias da régua,
// inclusive as bordas (dia 20 x dia 21 x dia 22), que é onde corte errado mora.
// ─────────────────────────────────────────────────────────────────────────────
import { decidir } from '../lib/assinatura/regua.ts'
import { PONTOS, LISTA_PONTOS } from '../lib/assinatura/avisos.ts'

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }

const HOJE = new Date('2026-07-27T12:00:00Z')
const dia = (n) => { const d = new Date(HOJE); d.setDate(d.getDate() + n); return d }
const base = (o = {}) => ({
  workspaceId: 'w1', assinaturaOrigem: 'asaas', assinaturaStatus: 'TRIAL',
  liberacaoManual: false, ativo: true, trialAte: null, assinaturaExpira: null,
  proximoVencimento: null, ciclo: null, parcelaFalhou: false, ...o,
})
const avisosDe = (o) => decidir(base(o), HOJE).avisos
const corta = (o) => decidir(base(o), HOJE).cortar

console.log('\n=== PROVA — régua da assinatura ===\n')

console.log('[1] Guardas — quem a régua NUNCA toca')
checar('liberacaoManual → sem aviso, sem corte',
  avisosDe({ liberacaoManual: true, trialAte: dia(-30) }).length === 0 && !corta({ liberacaoManual: true, trialAte: dia(-30) }))
checar('origem hotmart → intocada',
  avisosDe({ assinaturaOrigem: 'hotmart', trialAte: dia(-30) }).length === 0)
checar('origem null → intocada',
  avisosDe({ assinaturaOrigem: null, trialAte: dia(-30) }).length === 0)
checar('já CORTADA → não avisa de novo',
  avisosDe({ assinaturaStatus: 'CORTADA', trialAte: dia(-30) }).length === 0)
checar('CANCELADA → não avisa', avisosDe({ assinaturaStatus: 'CANCELADA' }).length === 0)

console.log('\n[2] Trial — os 5 pontos de contato')
checar('D-3', avisosDe({ trialAte: dia(3) }).includes('TRIAL_D3'))
checar('D-1', avisosDe({ trialAte: dia(1) }).includes('TRIAL_D1'))
checar('fim (D+0)', avisosDe({ trialAte: dia(0) }).includes('TRIAL_FIM'))
checar('D+3', avisosDe({ trialAte: dia(-3) }).includes('TRIAL_POS_D3'))
checar('D+6 (véspera)', avisosDe({ trialAte: dia(-6) }).includes('TRIAL_POS_D6'))
checar('D-2 não avisa (só os dias da régua)', avisosDe({ trialAte: dia(2) }).length === 0)

console.log('\n[3] Trial — a BORDA do corte (dia 21)')
checar('vencido há 6 dias → NÃO corta', !corta({ trialAte: dia(-6) }))
checar('vencido há 7 dias (último dia) → NÃO corta', !corta({ trialAte: dia(-7) }))
checar('vencido há 8 dias → CORTA', corta({ trialAte: dia(-8) }))
checar('ao cortar, manda o aviso CORTE', avisosDe({ trialAte: dia(-8) }).includes('CORTE'))

console.log('\n[4] Inadimplência')
const inad = (d) => ({ assinaturaStatus: 'INADIMPLENTE', assinaturaExpira: dia(d) })
checar('venceu hoje → INAD_D0', avisosDe(inad(0)).includes('INAD_D0'))
checar('D+3', avisosDe(inad(-3)).includes('INAD_D3'))
checar('D+6 (véspera)', avisosDe(inad(-6)).includes('INAD_D6'))
checar('D+7 ainda NÃO corta', !corta(inad(-7)))
checar('D+8 corta', corta(inad(-8)))
checar('sem vencimento gravado → não corta',
  !corta({ assinaturaStatus: 'INADIMPLENTE', assinaturaExpira: null }))

console.log('\n[5] Renovação anual e parcela do 12x')
checar('anual D-7 avisa',
  avisosDe({ assinaturaStatus: 'ATIVA', ciclo: 'YEARLY', proximoVencimento: dia(7) }).includes('RENOV_ANUAL_D7'))
checar('mensal D-7 NÃO avisa (só anual)',
  !avisosDe({ assinaturaStatus: 'ATIVA', ciclo: 'MONTHLY', proximoVencimento: dia(7) }).includes('RENOV_ANUAL_D7'))
checar('anual D-6 não avisa (só no dia certo)',
  avisosDe({ assinaturaStatus: 'ATIVA', ciclo: 'YEARLY', proximoVencimento: dia(6) }).length === 0)
checar('parcela falhou avisa',
  avisosDe({ assinaturaStatus: 'ATIVA', parcelaFalhou: true }).includes('PARCELA_FALHOU'))
checar('parcela falhou NÃO corta sozinha',
  !corta({ assinaturaStatus: 'ATIVA', parcelaFalhou: true }))

console.log('\n[6] Checkout abandonado — em HORAS, não em dias')
const hAtras = (h) => new Date(HOJE.getTime() - h * 3600_000)
const abandono = (h) => avisosDe({ assinaturaStatus: 'AGUARDANDO_PAGAMENTO', checkoutCriadoEm: hAtras(h) })
checar('+0h ainda não avisa', abandono(0.5).length === 0)
checar('+1h avisa', abandono(1.2).includes('CHECKOUT_ABANDONADO_1H'))
checar('+5h não repete', abandono(5).length === 0)
checar('+23h avisa a expiração', abandono(23.3).includes('CHECKOUT_ABANDONADO_23H'))
checar('+30h já não avisa', abandono(30).length === 0)
checar('abandono NUNCA corta', !corta({ assinaturaStatus: 'AGUARDANDO_PAGAMENTO', checkoutCriadoEm: hAtras(100) }))

console.log('\n[7] Papel dos avisos muda por método')
checar('CARTÃO: fim do trial NÃO manda TRIAL_FIM (cobrança é automática)',
  !avisosDe({ trialAte: dia(0), metodoEscolhido: 'cartao' }).includes('TRIAL_FIM'))
checar('PIX: fim do trial manda TRIAL_FIM (ela precisa pagar)',
  avisosDe({ trialAte: dia(0), metodoEscolhido: 'pix' }).includes('TRIAL_FIM'))
checar('CARTÃO: D-3 continua saindo (é o aviso de cobrança)',
  avisosDe({ trialAte: dia(3), metodoEscolhido: 'cartao' }).includes('TRIAL_D3'))

console.log('\n[8] Cobertura — todo ponto declarado é alcançável')
const alcancados = new Set([
  ...abandono(1.2), ...abandono(23.3),
  ...avisosDe({ trialAte: dia(3) }), ...avisosDe({ trialAte: dia(1) }), ...avisosDe({ trialAte: dia(0) }),
  ...avisosDe({ trialAte: dia(-3) }), ...avisosDe({ trialAte: dia(-6) }), ...avisosDe({ trialAte: dia(-8) }),
  ...avisosDe(inad(0)), ...avisosDe(inad(-3)), ...avisosDe(inad(-6)),
  ...avisosDe({ assinaturaStatus: 'ATIVA', ciclo: 'YEARLY', proximoVencimento: dia(7) }),
  ...avisosDe({ assinaturaStatus: 'ATIVA', parcelaFalhou: true }),
])
for (const p of LISTA_PONTOS) checar(`${p.tipo} alcançável`, alcancados.has(p.tipo))
checar('nenhum aviso emitido sem ponto declarado',
  [...alcancados].every(a => !!PONTOS[a]))

console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
process.exitCode = falhas === 0 ? 0 : 1
