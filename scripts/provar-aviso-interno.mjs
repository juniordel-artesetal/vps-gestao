// ─────────────────────────────────────────────────────────────────────────────
// PROVA do aviso interno — o e-mail que a EQUIPE recebe quando alguém entra ou
// converte. Puro: monta a copy sem tocar em banco nem no Resend.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//        scripts/provar-aviso-interno.mjs
//   node ... scripts/provar-aviso-interno.mjs --ver   # imprime os dois e-mails
// ─────────────────────────────────────────────────────────────────────────────
import { montarAviso } from '../lib/assinatura/notificaInterna.ts'

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const VER = process.argv.includes('--ver')
const QUANDO = '22/07/2026 14:30:00'

const LEAD = {
  workspaceId: 'ws_teste123',
  workspace: 'Ateliê da Maria',
  pessoa: 'Maria Silva',
  email: 'maria@exemplo.com',
  segmento: 'croche_trico',
  planoEscolhido: 'mensal',
  metodoEscolhido: 'pix',
  formaEscolhida: 'avista',
}

console.log('\n=== PROVA — aviso interno (para a equipe) ===\n')

console.log('[1] Trial — Pix à vista')
{
  const { assunto, html } = montarAviso(LEAD, 'INTERNO_NOVO_TRIAL', QUANDO)
  checar('assunto marca trial', assunto.includes('Novo trial') && assunto.includes('Maria Silva'), assunto)
  checar('segmento traduzido (não o slug cru)', html.includes('Crochê') && !html.includes('croche_trico'))
  checar('método Pix aparece', html.includes('Pix'))
  checar('rótulo é "Trial iniciado em"', html.includes('Trial iniciado em') && html.includes(QUANDO))
  checar('workspaceId no rodapé (pra achar no banco)', html.includes('ws_teste123'))
  if (VER) console.log('\n  ASSUNTO:', assunto, '\n', html, '\n')
}

console.log('\n[2] Pagante — Cartão 12x')
{
  const pagante = { ...LEAD, metodoEscolhido: 'cartao', planoEscolhido: 'anual', formaEscolhida: 'parcelado' }
  const { assunto, html } = montarAviso(pagante, 'INTERNO_NOVO_PAGANTE', QUANDO)
  checar('assunto marca pagante', assunto.includes('assinante pagante'), assunto)
  checar('sem plano/forma no assunto do pagante', !assunto.includes('12x'))
  checar('rótulo vira "Pagamento confirmado em"', html.includes('Pagamento confirmado em'))
  checar('Cartão · 12x no corpo', html.includes('Cartão') && html.includes('12x'))
  if (VER) console.log('\n  ASSUNTO:', assunto, '\n', html, '\n')
}

console.log('\n[3] Robustez de dados faltando')
{
  const magro = { workspaceId: 'ws_x', workspace: null, pessoa: null, email: null,
    segmento: null, planoEscolhido: null, metodoEscolhido: null, formaEscolhida: null }
  const { assunto, html } = montarAviso(magro, 'INTERNO_NOVO_TRIAL', QUANDO)
  checar('não quebra sem pessoa/plano', typeof assunto === 'string' && html.includes('não informado'))
  checar('HTML escapa < > (sem injeção)', !montarAviso({ ...magro, pessoa: '<script>' }, 'INTERNO_NOVO_TRIAL', QUANDO).html.includes('<script>'))
}

console.log(`\n${falhas === 0 ? '✅ AVISO INTERNO PASSOU' : `❌ ${falhas} falha(s)`}\n`)
process.exitCode = falhas === 0 ? 0 : 1
