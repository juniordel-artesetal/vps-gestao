// PROVA — Sofia "cérebro": ferramentas (setor/financeiro semântico/contagem/localizar)
// + classificador de intenção AO VIVO (Gemini). Roda os casos reais da conversa.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-sofia-intencao.mjs
import { prisma } from '../lib/prisma.ts'
import { buscarPedidos, contarPedidos, buscarFinanceiro, somaFinanceiro, buscarEstoqueBaixo } from '../lib/sofia/ferramentas.ts'
import { classificarIntencao } from '../lib/sofia/intencao.ts'

const marca = Date.now().toString(36)
const WS = `si_${marca}`
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const uid = (t) => `${t}_${marca}`

async function seed() {
  await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","ativo","createdAt","updatedAt") VALUES ($1,$2,$3,true,NOW(),NOW())`, WS, `WS ${marca}`, `ws-${marca}`)
  await prisma.$executeRawUnsafe(`INSERT INTO "SetorConfig" ("id","workspaceId","nome","ordem","ativo","createdAt") VALUES ($1,$2,'Arte',1,true,NOW())`, uid('sArte'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "SetorConfig" ("id","workspaceId","nome","ordem","ativo","createdAt") VALUES ($1,$2,'Impressão | Corte',2,true,NOW())`, uid('sImp'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "Cliente" ("id","workspaceId","nome","documento","ativo","createdAt","updatedAt") VALUES ($1,$2,'Bruna Souza','52998224725',true,NOW(),NOW())`, uid('cli'), WS)
  // pedido da Bruna no setor Arte
  await prisma.$executeRawUnsafe(`INSERT INTO "Order" ("id","workspaceId","numero","destinatario","produto","status","valor","canal","dataEnvio","createdAt","updatedAt") VALUES ($1,$2,'268715P','Bruna Souza','topper','EM_PRODUCAO',120,'Shopee',CURRENT_DATE+2,NOW(),NOW())`, uid('pB'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'EM_ANDAMENTO',NOW(),NOW())`, uid('psB'), WS, uid('pB'), uid('sArte'))
  // pedido em Impressão
  await prisma.$executeRawUnsafe(`INSERT INTO "Order" ("id","workspaceId","numero","destinatario","produto","status","valor","dataEnvio","createdAt","updatedAt") VALUES ($1,$2,'900','Ana','caderno','EM_PRODUCAO',50,CURRENT_DATE+1,NOW(),NOW())`, uid('pI'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "PedidoSetor" ("id","workspaceId","pedidoId","setorId","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'EM_ANDAMENTO',NOW(),NOW())`, uid('psI'), WS, uid('pI'), uid('sImp'))
  // financeiro
  await prisma.$executeRawUnsafe(`INSERT INTO "FinLancamento" ("id","workspaceId","tipo","descricao","valor","data","status","createdAt") VALUES ($1,$2,'DESPESA','Conta de Luz',150,CURRENT_DATE-3,'PENDENTE',NOW())`, uid('fV'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "FinLancamento" ("id","workspaceId","tipo","descricao","valor","data","status","createdAt") VALUES ($1,$2,'DESPESA','Aluguel',800,CURRENT_DATE,'PENDENTE',NOW())`, uid('fH'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "FinLancamento" ("id","workspaceId","tipo","descricao","valor","data","status","createdAt") VALUES ($1,$2,'DESPESA','Internet',100,CURRENT_DATE+5,'PENDENTE',NOW())`, uid('fF'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "FinLancamento" ("id","workspaceId","tipo","descricao","valor","data","status","createdAt") VALUES ($1,$2,'RECEITA','Venda topper',300,CURRENT_DATE+10,'PENDENTE',NOW())`, uid('fR'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "PrecMaterial" ("id","workspaceId","nome","unidade","precoUnidade","ativo","createdAt","updatedAt") VALUES ($1,$2,'Feltro','un',2.5,true,NOW(),NOW())`, uid('mat'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "EstMaterialSaldo" ("id","workspaceId","materialId","saldoAtual","estoqueMinimo","updatedAt") VALUES ($1,$2,$3,2,10,NOW())`, uid('est'), WS, uid('mat'))
}

const setores = ['Arte', 'Impressão | Corte']
async function main() {
  console.log('\n=== PROVA — Sofia intenção + ferramentas ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }
  await seed()
  try {
    console.log('[ferramentas — determinístico]')
    const pArte = await buscarPedidos(WS, { setor: 'arte' })
    checar('filtro por SETOR "arte" acha o pedido da Bruna + traz setor atual', pArte.total === 1 && /Arte/.test(pArte.itens[0].setor || ''), `total=${pArte.total} setor=${pArte.itens[0]?.setor}`)
    const loc = await buscarPedidos(WS, { cliente: 'Bruna' })
    checar('localizar por cliente devolve o setor real (Arte)', loc.itens[0]?.setor === 'Arte' && loc.itens[0].link === `/dashboard/pedidos/${uid('pB')}`)
    const cnt = await contarPedidos(WS, {}, true)
    checar('contagem por setor (Arte + Impressão)', cnt.total >= 2 && cnt.porSetor?.some(s => s.setor === 'Arte') && cnt.porSetor?.some(s => /Impressão/.test(s.setor)))
    const fV = await buscarFinanceiro(WS, { statusFin: 'vencido' })
    checar('financeiro VENCIDO = só a vencida (Luz)', fV.total === 1 && /Luz/.test(fV.itens[0].titulo))
    const fH = await buscarFinanceiro(WS, { statusFin: 'vence_hoje' })
    checar('financeiro VENCE HOJE = só Aluguel', fH.total === 1 && /Aluguel/.test(fH.itens[0].titulo))
    const fF = await buscarFinanceiro(WS, { statusFin: 'a_vencer' })
    checar('financeiro A VENCER = só Internet', fF.total === 1 && /Internet/.test(fF.itens[0].titulo))
    const sPag = await somaFinanceiro(WS, { statusFin: 'a_pagar' })
    checar('soma a_pagar = 150+800+100 = 1050', Math.round(sPag.soma) === 1050, `soma=${sPag.soma}`)
    const est = await buscarEstoqueBaixo(WS)
    checar('estoque baixo acha o Feltro', est.total === 1 && /Feltro/.test(est.itens[0].titulo))

    // ── Classificador ao vivo (Gemini) ──
    if (!process.env.ANTHROPIC_API_KEY_GESTAO) { console.log('\n[classificador] ⚠️ sem ANTHROPIC_API_KEY_GESTAO — pulado'); }
    else {
      console.log('\n[classificador — Gemini ao vivo] (os casos reais da conversa)')
      const ctx = { setores, alertasResumo: 'Você tem 70 contas vencidas 💸; Você tem 14 pedidos atrasados 🕐' }
      const cls = (msg, hist = []) => classificarIntencao(msg, hist, ctx)
      const casos = [
        ['1) "quantos pedidos está em artes?"', 'quantos pedidos está em artes?', [], i => /pedidos/.test(i?.acao) && /arte/i.test(i?.parametros?.setor || '')],
        ['2) "o pedido da cliente Bruna está em que setor?"', 'o pedido da cliente Bruna está em que setor?', [], i => i?.acao === 'localizar_pedido' && /bruna/i.test(i?.parametros?.cliente || '')],
        ['3) "quais contas estão atrasadas?"', 'quais contas estão atrasadas?', [], i => i?.acao === 'listar_financeiro' && i?.parametros?.statusFin === 'vencido'],
        ['4) follow-up "me mostra elas" (após 70 vencidas)', 'me mostra elas', [{ role: 'sofia', content: 'Você tem 70 contas vencidas 💸' }], i => i?.acao === 'listar_financeiro' && i?.parametros?.statusFin === 'vencido'],
        ['5) "quais contas venceram hoje?"', 'quais contas venceram hoje?', [], i => /financeiro/.test(i?.acao) && i?.parametros?.statusFin === 'vence_hoje'],
        ['6) "quantos prontos pra enviar?"', 'quantos prontos pra enviar?', [], i => /pedidos/.test(i?.acao) && i?.parametros?.statusPedido === 'PRONTO'],
        ['7) "quais pedidos da Shopee ainda não saíram?"', 'quais pedidos da Shopee ainda não saíram?', [], i => /pedidos/.test(i?.acao) && /shopee/i.test(i?.parametros?.canal || '') && (i?.parametros?.naoEnviados || i?.parametros?.statusPedido)],
        ['8) typo "quantos pedidu atrazado eu tenho"', 'quantos pedidu atrazado eu tenho', [], i => /pedidos/.test(i?.acao) && i?.parametros?.atrasados === true],
        ['9) "cade meu dinheiro a receber"', 'cade meu dinheiro a receber', [], i => /financeiro/.test(i?.acao) && i?.parametros?.statusFin === 'a_receber'],
        ['10) "quais materiais estão acabando?"', 'quais materiais estão acabando?', [], i => i?.acao === 'estoque_baixo'],
        ['11) ambígua "quais contas?"', 'quais contas?', [], i => i?.acao === 'ambiguo' && !!i?.clarificar],
        ['12) "como faço pra mover um pedido de setor?"', 'como faço pra mover um pedido de setor?', [], i => i?.acao === 'como_faz'],
        ['13) "obrigada, e as vencidas?"', 'obrigada, e as vencidas?', [{ role: 'sofia', content: 'Achei 3 contas a vencer' }], i => /financeiro/.test(i?.acao) && i?.parametros?.statusFin === 'vencido'],
        ['14) "bom dia!"', 'bom dia!', [], i => i?.acao === 'conversa' || i?.acao === 'alertas'],
      ]
      for (const [label, msg, hist, ok] of casos) {
        const i = await cls(msg, hist)
        checar(label, !!i && ok(i), i ? `${i.acao} ${JSON.stringify(i.parametros)}`.slice(0, 90) : 'null')
      }
    }
  } finally {
    console.log('\n[limpeza]')
    for (const t of ['EstMaterialSaldo', 'PrecMaterial', 'FinLancamento', 'PedidoSetor', 'Order', 'Cliente', 'SetorConfig', 'Workspace'])
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "${t === 'Workspace' ? 'id' : 'workspaceId'}"=$1`, WS).catch(() => {})
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ SOFIA INTENÇÃO PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
