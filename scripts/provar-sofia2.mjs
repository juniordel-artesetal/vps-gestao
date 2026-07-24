// PROVA — Sofia 2.0 (busca + alertas + roteador). Determinística: seed real no dev,
// funções reais. Confere: links vêm do BANCO (id real), LGPD (sem CPF/email/telefone
// no payload), alertas refletem o estado real, roteador extrai a intenção certa.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-sofia2.mjs
import { prisma } from '../lib/prisma.ts'
import { buscarPedidos, buscarClientes, buscarProdutosMateriais, buscarFinanceiro } from '../lib/sofia/ferramentas.ts'
import { calcularAlertas } from '../lib/sofia/alertas.ts'
import { detectarBusca, ehPerguntaAlertas } from '../lib/sofia/roteador.ts'

const marca = Date.now().toString(36)
const WS = `sofia2_${marca}`
const CPF = '52998224725'
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const uid = (t) => `${t}_${marca}`

async function seed() {
  await prisma.$executeRawUnsafe(`INSERT INTO "Workspace" ("id","nome","slug","createdAt","updatedAt") VALUES ($1,$2,$3,NOW(),NOW())`, WS, `WS ${marca}`, `ws-${marca}`)
  await prisma.$executeRawUnsafe(`INSERT INTO "Cliente" ("id","workspaceId","nome","documento","email","telefone","ativo","totalPedidos","pedidosEmAberto","createdAt","updatedAt") VALUES ($1,$2,'Ana Beatriz Costa',$3,'ana@exemplo.com','11999998888',true,3,1,NOW(),NOW())`, uid('cli'), WS, CPF)
  // pedido atrasado (EM_PRODUCAO, dataEnvio no passado) da Ana
  await prisma.$executeRawUnsafe(`INSERT INTO "Order" ("id","workspaceId","numero","destinatario","cliente","produto","status","valor","dataEntrada","dataEnvio","createdAt","updatedAt") VALUES ($1,$2,'1001','Ana Beatriz Costa','Ana Beatriz Costa','Colar de miçangas','EM_PRODUCAO',89.90,CURRENT_DATE-10,CURRENT_DATE-2,NOW(),NOW())`, uid('ped'), WS)
  await prisma.$executeRawUnsafe(`INSERT INTO "Order" ("id","workspaceId","numero","destinatario","cliente","produto","status","valor","dataEntrada","dataEnvio","createdAt","updatedAt") VALUES ($1,$2,'1002','Ana Beatriz Costa','Ana Beatriz Costa','Brinco de feltro','PRONTO',30,CURRENT_DATE-5,CURRENT_DATE+3,NOW(),NOW())`, uid('ped2'), WS)
  // conta de luz vencida (DESPESA PENDENTE, data passada)
  await prisma.$executeRawUnsafe(`INSERT INTO "FinLancamento" ("id","workspaceId","tipo","descricao","valor","data","status","createdAt") VALUES ($1,$2,'DESPESA','Conta de Luz',150.00,CURRENT_DATE-3,'PENDENTE',NOW())`, uid('fin'), WS)
  // material com estoque baixo
  await prisma.$executeRawUnsafe(`INSERT INTO "PrecMaterial" ("id","workspaceId","nome","unidade","precoUnidade","ativo","createdAt","updatedAt") VALUES ($1,$2,'Feltro',$3,2.50,true,NOW(),NOW())`, uid('mat'), WS, 'un')
  await prisma.$executeRawUnsafe(`INSERT INTO "EstMaterialSaldo" ("id","workspaceId","materialId","saldoAtual","estoqueMinimo","updatedAt") VALUES ($1,$2,$3,2,10,NOW())`, uid('est'), WS, uid('mat'))
  await prisma.$executeRawUnsafe(`INSERT INTO "PrecProduto" ("id","workspaceId","nome","ativo","createdAt","updatedAt") VALUES ($1,$2,'Colar de miçangas',true,NOW(),NOW())`, uid('prod'), WS)
}

async function main() {
  console.log('\n=== PROVA — Sofia 2.0 ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }
  await seed()
  try {
    // [ROTEADOR] extração de intenção
    console.log('[roteador] interpreta a intenção')
    const b1 = detectarBusca('Sofia, encontra o pedido da cliente Ana')
    checar('“pedido da cliente Ana” → pedidos, cliente=Ana', b1?.tipo === 'pedidos' && /ana/i.test(b1?.filtros.cliente || ''), JSON.stringify(b1))
    const b2 = detectarBusca('acha o pedido 1001')
    checar('“pedido 1001” → pedidos, numero=1001', b2?.tipo === 'pedidos' && b2?.filtros.numero === '1001')
    const b3 = detectarBusca('me mostra os pedidos em produção')
    checar('“em produção” → pedidos, status SÓ (sem cliente espúrio)', b3?.tipo === 'pedidos' && b3?.filtros.status === 'EM_PRODUCAO' && !b3?.filtros.cliente, JSON.stringify(b3))
    const b4 = detectarBusca('busca a cliente Ana')
    checar('“cliente Ana” → clientes', b4?.tipo === 'clientes' && /ana/i.test(b4?.filtros.termo || ''))
    const b5 = detectarBusca('procura o material feltro')
    checar('“material feltro” → produtos', b5?.tipo === 'produtos' && /feltro/i.test(b5?.filtros.termo || ''))
    const b6 = detectarBusca('encontra a conta de luz')
    checar('“conta de luz” → financeiro', b6?.tipo === 'financeiro' && /luz/i.test(b6?.filtros.termo || ''))
    checar('“o que preciso resolver hoje?” → alertas', ehPerguntaAlertas('o que eu preciso resolver hoje?'))
    checar('conversa comum não vira busca', detectarBusca('oi sofia, tudo bem?') === null)

    // [BUSCA] pedidos com LINK real do banco
    console.log('\n[busca] pedidos — id/link REAIS do banco')
    const rp = await buscarPedidos(WS, { cliente: 'Ana' })
    checar('acha pedidos da Ana (≥2)', rp.total >= 2 && rp.itens.length >= 2, `total=${rp.total}`)
    const linkOk = rp.itens.every(i => i.link === `/dashboard/pedidos/${i.id}`)
    checar('todo link é /dashboard/pedidos/{id} com id do banco', linkOk)
    const existe = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int n FROM "Order" WHERE "id"=$1 AND "workspaceId"=$2`, rp.itens[0].id, WS)
    checar('o id do 1º resultado EXISTE no banco (não inventado)', existe[0].n === 1)
    const rnum = await buscarPedidos(WS, { numero: '1001' })
    checar('busca por número acha o pedido certo', rnum.total === 1 && rnum.itens[0].titulo.includes('1001'))
    const rprod = await buscarPedidos(WS, { produto: 'miçangas' })
    checar('busca por produto acha', rprod.total >= 1)
    const rvazio = await buscarPedidos(WS, { cliente: 'ZzxNaoExiste' })
    checar('busca sem resultado → total 0 (sem inventar)', rvazio.total === 0 && rvazio.itens.length === 0)

    // [BUSCA] clientes — LGPD
    console.log('\n[busca] clientes — LGPD (sem CPF/email/telefone no payload)')
    const rc = await buscarClientes(WS, 'Ana')
    checar('acha a cliente com link /clientes/{id} real', rc.total >= 1 && rc.itens[0].link === `/clientes/${rc.itens[0].id}`)
    const bruto = JSON.stringify(rc)
    checar('🔒 LGPD: payload NÃO contém CPF/email/telefone/@', !bruto.includes(CPF) && !bruto.includes('@') && !bruto.includes('11999998888') && !/documento/i.test(bruto))

    // [BUSCA] produtos/materiais e financeiro
    console.log('\n[busca] produtos/materiais + financeiro')
    const rpm = await buscarProdutosMateriais(WS, 'feltro')
    checar('acha material feltro', rpm.itens.some(i => /feltro/i.test(i.titulo) && i.link === '/precificacao/materiais'))
    const rf = await buscarFinanceiro(WS, { termo: 'luz' })
    checar('acha a conta de luz com link financeiro', rf.total >= 1 && rf.itens[0].link === '/financeiro/lancamentos')

    // [ALERTAS] grounded no real
    console.log('\n[alertas] refletem o estado REAL')
    const al = await calcularAlertas(WS)
    const porTipo = Object.fromEntries(al.map(a => [a.tipo, a]))
    checar('pedido atrasado detectado (n≥1) com link de atrasados', porTipo.pedidos_atrasados?.n >= 1 && porTipo.pedidos_atrasados.link === '/dashboard/pedidos?atrasados=1')
    checar('conta vencida detectada (n≥1)', porTipo.contas_vencidas?.n >= 1 && porTipo.contas_vencidas.link === '/financeiro/lancamentos')
    checar('estoque baixo detectado (n≥1)', porTipo.estoque_baixo?.n >= 1 && porTipo.estoque_baixo.link === '/precificacao/estoque-materiais')
    checar('prioridade: contas vencidas vêm antes de estoque', al.findIndex(a => a.tipo === 'contas_vencidas') < al.findIndex(a => a.tipo === 'estoque_baixo'))
    // workspace sem nada → nenhum alerta (não inventa)
    const vazio = await calcularAlertas(`nada_${marca}`)
    checar('workspace vazio → nenhum alerta (nada genérico)', vazio.length === 0)

  } finally {
    console.log('\n[limpeza]')
    for (const t of ['EstMaterialSaldo', 'PrecMaterial', 'PrecProduto', 'FinLancamento', 'Order', 'Cliente'])
      await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`, WS).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`, WS).catch(() => {})
    console.log('  🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ SOFIA 2.0 PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
