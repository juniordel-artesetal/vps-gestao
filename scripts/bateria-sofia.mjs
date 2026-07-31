// ─────────────────────────────────────────────────────────────────────────────
// BATERIA DE ACEITAÇÃO DA SOFIA — roteamento da camada de intenção.
// Valida que cada pergunta cai na AÇÃO certa (nunca "não achei"; financeiro de
// análise vai para as tools novas; contas continuam em soma/listar). Cobre as
// novidades (custos fixos, canais, compras, plano de contas, DRE, conselhos).
//
// Rodar: node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//        --env-file=.env scripts/bateria-sofia.mjs
// Guardar versionado e rodar a cada evolução da Sofia (não regredir).
// ─────────────────────────────────────────────────────────────────────────────
import { classificarIntencao } from '../lib/sofia/intencao.ts'

const ctx = { setores: ['Criar Arte', 'Impressão | Corte', 'Montagem | Finalização'], alertasResumo: '2 pedidos atrasados; 1 conta vencida' }

// [pergunta, ação(ões) aceitas]. Várias aceitas quando há sobreposição legítima.
const CASOS = [
  // A/B — pedidos (não-regressão)
  ['quantos pedidos atrasados eu tenho?', ['contar_pedidos']],
  ['quais pedidos da Shopee ainda não saíram?', ['listar_pedidos']],
  ['o pedido da Bruna está em que setor?', ['localizar_pedido']],
  ['quantos pedidos estão em artes?', ['contar_pedidos']],
  ['quantos prontos pra enviar?', ['contar_pedidos']],
  // C/S — contas (soma/listar) NÃO podem virar análise
  ['quanto tenho pra pagar essa semana?', ['soma_financeiro']],
  ['quanto vou receber esse mês?', ['soma_financeiro']],
  ['quais contas estão atrasadas?', ['listar_financeiro']],
  ['tenho conta vencendo hoje?', ['listar_financeiro', 'soma_financeiro']],
  // C/R/S — análise financeira (tools novas)
  ['qual foi meu lucro esse mês?', ['resumo_financeiro', 'dre']],
  ['estou tendo lucro?', ['resumo_financeiro']],
  ['estou no vermelho ou no azul?', ['resumo_financeiro']],
  ['qual meu faturamento do mês?', ['resumo_financeiro']],
  ['qual meu saldo em caixa?', ['resumo_financeiro']],
  ['me dá um resumo financeiro rápido', ['resumo_financeiro']],
  ['melhorei em relação ao mês passado?', ['resumo_financeiro']],
  ['onde eu gasto mais?', ['maiores_despesas']],
  ['com o que mais gastei?', ['maiores_despesas']],
  ['qual minha maior despesa?', ['maiores_despesas']],
  ['bati minha meta do mês?', ['meta']],
  ['quanto falta pra bater a meta?', ['meta']],
  ['como está minha meta?', ['meta']],
  // R — DRE / CMV / lucro real
  ['meu CMV tá alto?', ['dre']],
  ['explica meu DRE', ['dre', 'como_faz']],
  ['qual meu lucro real esse mês?', ['dre', 'resumo_financeiro']],
  ['minha margem de contribuição está boa?', ['dre']],
  // T — conselhos
  ['me dá um conselho financeiro', ['conselho']],
  ['como melhoro meu lucro?', ['conselho']],
  ['vendo mas não sobra dinheiro', ['conselho']],
  ['o que devo priorizar hoje?', ['conselho', 'alertas']],
  ['me ajuda a organizar minhas finanças', ['conselho']],
  // U — novidades: digitação/ambíguas
  ['meu lucro reau', ['resumo_financeiro', 'dre']],
  ['dre', ['dre', 'como_faz']],
  ['custo fixo', ['ambiguo', 'como_faz']],
  // F/L/M/N/O/P/Q — "como faz" das novidades (KB)
  ['como cadastro meus custos fixos?', ['como_faz']],
  ['como funciona o rateio dos custos fixos?', ['como_faz']],
  ['como cadastro meu site como canal?', ['como_faz']],
  ['como lanço a receita de um pedido pago?', ['como_faz']],
  ['como faço um pedido de compra?', ['como_faz']],
  ['como organizo minhas despesas por conta?', ['como_faz']],
  ['como coloco meu produto em 3 lojas de uma vez?', ['como_faz']],
  ['o que é CMV?', ['como_faz', 'dre']],
  // D/E — estoque e clientes (não-regressão)
  ['quais materiais estão acabando?', ['estoque_baixo']],
  ['qual o preço médio do papel offset 240?', ['preco_material']],
  ['acha a cliente Mariana', ['listar_clientes']],
  // H — ambíguas
  ['quais contas?', ['ambiguo']],
  ['quanto eu tenho?', ['ambiguo']],
  // K — conversa/tom
  ['bom dia, Sofia!', ['conversa']],
  ['tô cansada hoje', ['conversa']],
]

let pass = 0, fail = 0
const falhas = []
for (const [q, aceitas] of CASOS) {
  let got = null
  try { const r = await classificarIntencao(q, [], ctx); got = r?.acao ?? 'null' } catch (e) { got = 'ERRO:' + e.message }
  const ok = aceitas.includes(got)
  if (ok) pass++; else { fail++; falhas.push({ q, got, aceitas }) }
  console.log((ok ? '✅' : '❌') + ` "${q}" → ${got}${ok ? '' : ` (aceitas: ${aceitas.join('/')})`}`)
  await new Promise(r => setTimeout(r, 250))
}
console.log(`\n${fail === 0 ? '🟢' : '🔴'} Bateria de intenção: ${pass}/${CASOS.length} · ${fail} falha(s)`)
if (falhas.length) console.log('Falhas:', JSON.stringify(falhas, null, 2))
process.exit(fail ? 1 : 0)
