// Bateria de MEMÓRIA da Sofia — follow-ups multi-turno (histórico sintético).
// A 2ª pergunta tem que herdar o contexto da 1ª (não tratar como assunto novo).
// Rodar: node --experimental-strip-types --import ./scripts/_loader-alias.mjs --env-file=.env scripts/bateria-sofia-memoria.mjs
import { classificarIntencao } from '../lib/sofia/intencao.ts'
const ctx = { setores: ['Criar Arte', 'Impressão | Corte', 'Montagem | Finalização'], alertasResumo: '14 pedidos atrasados; 70 contas vencidas' }
const u = (t) => ({ role: 'user', content: t })
const m = (t) => ({ role: 'model', content: t })

// [historico, pergunta, [ações aceitas]]
const CASOS = [
  [[u('quantos pedidos eu tenho?')], 'e os atrasados?', ['contar_pedidos', 'listar_pedidos']],
  [[u('quanto tenho a receber esse mês?')], 'e a pagar?', ['soma_financeiro']],
  [[u('como cadastro um material?')], 'e a embalagem?', ['como_faz']],
  [[u('quais contas estão atrasadas?'), m('você tem 70 contas vencidas')], 'quais são?', ['listar_financeiro']],
  [[u('me mostra os pedidos'), m('aqui estão seus 14 pedidos')], 'só os da Shopee', ['listar_pedidos']],
  [[u('quantos pedidos a Mariana fez?'), m('a Mariana fez 3 pedidos')], 'e da Ana?', ['contar_pedidos', 'listar_pedidos']],
  [[u('achei o pedido da Bruna #123'), m('o pedido #123 está na Montagem')], 'manda o link dele', ['localizar_pedido']],
  [[u('quantos pedidos em produção?'), m('você tem 5 em produção')], 'e os prontos?', ['contar_pedidos', 'listar_pedidos']],
  [[u('quais minhas maiores despesas?'), m('suas maiores despesas são material e aluguel')], 'qual a maior?', ['maiores_despesas']],
  [[u('qual meu lucro real?'), m('seu lucro real é 24%')], 'por que caiu?', ['resumo_financeiro', 'dre', 'conselho']],
  [[u('quanto sobra na Shopee?'), m('na Shopee sobra cerca de 60%')], 'e no ML?', ['resumo_financeiro', 'como_faz', 'conselho', 'dre']],
  [[u('me mostra os pedidos de hoje'), m('você tem 4 pedidos hoje')], 'e os de amanhã?', ['listar_pedidos', 'contar_pedidos']],
]

let pass = 0, fail = 0; const falhas = []
for (const [hist, q, aceitas] of CASOS) {
  let got = null
  try { const r = await classificarIntencao(q, hist, ctx); got = r?.acao ?? 'null' } catch (e) { got = 'ERRO:' + e.message }
  const ok = aceitas.includes(got)
  if (ok) pass++; else { fail++; falhas.push({ q, got, aceitas }) }
  console.log((ok ? '✅' : '❌') + ` [ctx: "${hist[hist.length - 1].content.slice(0, 30)}…"] "${q}" → ${got}`)
  await new Promise(r => setTimeout(r, 150))
}
console.log(`\n${fail === 0 ? '🟢' : '🔴'} MEMÓRIA: ${pass}/${CASOS.length} · ${fail} falha(s)`)
if (falhas.length) console.log(falhas.map(f => `  "${f.q}" → ${f.got} (esperado: ${f.aceitas.join('/')})`).join('\n'))
