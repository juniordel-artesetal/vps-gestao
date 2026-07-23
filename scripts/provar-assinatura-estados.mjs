// ─────────────────────────────────────────────────────────────────────────────
// PROVA da Etapa 1 — máquina de estados + revalidação da sessão.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//        --env-file=.env --env-file=.env.local scripts/provar-assinatura-estados.mjs
//
// Parte A: avaliar() — função PURA, sem banco. Cobre os dois caminhos.
// Parte B: estadoDaAssinatura() contra workspaces de teste no banco DEV.
// Parte C: a flag. Com ela OFF, nada muda para ninguém.
//
// ⚠️ Cria e apaga workspaces de teste com prefixo "wsteste_". Aborta em produção.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma.ts'
import { avaliar, estadoDaAssinatura, revalidacaoLigada, DIAS_CARENCIA } from '../lib/assinatura/index.ts'

let falhas = 0
function checar(nome, ok, det = '') {
  if (!ok) falhas++
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${det ? ` — ${det}` : ''}`)
}

const hojeMais = (d) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + d); return x }
const base = (over = {}) => ({
  id: 'ws1', ativo: true, assinaturaStatus: 'TRIAL', assinaturaOrigem: 'asaas',
  assinaturaExpira: null, trialAte: null, liberacaoManual: false, ...over,
})

const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
if (host.includes('ep-lively-firefly')) { console.error('\n❌ PRODUÇÃO — abortando\n'); process.exit(1) }

console.log(`\n=== PROVA — Etapa 1 (banco: ${host}) ===`)

// ── A. Função pura ───────────────────────────────────────────────────────────
console.log('\n[A] avaliar() — regras, sem banco\n')

console.log('  A1. Trava do Master vence tudo')
checar('liberacaoManual libera CORTADA',
  avaliar(base({ assinaturaStatus: 'CORTADA', liberacaoManual: true })).temAcesso === true)
checar('liberacaoManual libera workspace inativa',
  avaliar(base({ ativo: false, liberacaoManual: true })).temAcesso === true)

console.log('\n  A2. Caminho ATUAL (hotmart / null) não entra na máquina nova')
checar('origem hotmart + status CORTADA → tem acesso (segue "ativo")',
  avaliar(base({ assinaturaOrigem: 'hotmart', assinaturaStatus: 'CORTADA' })).temAcesso === true)
checar('origem null + trial vencido → tem acesso',
  avaliar(base({ assinaturaOrigem: null, trialAte: hojeMais(-90) })).temAcesso === true)
checar('origem hotmart + ativo=false → SEM acesso (corte da Hotmart passa a valer)',
  avaliar(base({ assinaturaOrigem: 'hotmart', ativo: false })).temAcesso === false)

console.log('\n  A3. Caminho ASAAS — trial')
checar('trial com 5 dias pela frente → acesso',
  avaliar(base({ trialAte: hojeMais(5) })).temAcesso === true)
checar('trial vencido ontem → acesso (carência)',
  avaliar(base({ trialAte: hojeMais(-1) })).temAcesso === true)
checar(`trial vencido há ${DIAS_CARENCIA} dias → acesso (último dia)`,
  avaliar(base({ trialAte: hojeMais(-DIAS_CARENCIA) })).temAcesso === true)
checar(`trial vencido há ${DIAS_CARENCIA + 1} dias → SEM acesso (dia 21)`,
  avaliar(base({ trialAte: hojeMais(-DIAS_CARENCIA - 1) })).temAcesso === false)
checar('conta asaas sem trialAte (legado) → acesso',
  avaliar(base({ trialAte: null })).temAcesso === true)

console.log('\n  A4. Caminho ASAAS — assinatura')
checar('ATIVA → acesso', avaliar(base({ assinaturaStatus: 'ATIVA' })).temAcesso === true)
checar('CANCELADA → sem acesso', avaliar(base({ assinaturaStatus: 'CANCELADA' })).temAcesso === false)
checar('CORTADA → sem acesso', avaliar(base({ assinaturaStatus: 'CORTADA' })).temAcesso === false)
checar('INADIMPLENTE vencida ontem → acesso (carência)',
  avaliar(base({ assinaturaStatus: 'INADIMPLENTE', assinaturaExpira: hojeMais(-1) })).temAcesso === true)
checar(`INADIMPLENTE vencida há ${DIAS_CARENCIA + 1} dias → sem acesso`,
  avaliar(base({ assinaturaStatus: 'INADIMPLENTE', assinaturaExpira: hojeMais(-DIAS_CARENCIA - 1) })).temAcesso === false)
checar('INADIMPLENTE sem vencimento gravado → acesso (não inventa data)',
  avaliar(base({ assinaturaStatus: 'INADIMPLENTE', assinaturaExpira: null })).temAcesso === true)

console.log('\n  A5. Mensagem de motivo é sempre preenchida')
checar('motivo presente em todos os casos',
  ['TRIAL', 'ATIVA', 'INADIMPLENTE', 'CORTADA', 'CANCELADA']
    .every(s => (avaliar(base({ assinaturaStatus: s })).motivo || '').length > 3))

// ── B. Contra o banco ────────────────────────────────────────────────────────
console.log('\n[B] estadoDaAssinatura() — workspaces de teste no banco DEV\n')

const marca = Date.now().toString(36)
const casos = [
  ['wsteste_hot_' + marca, { origem: 'hotmart', ativo: true, status: 'CORTADA', esperado: true, nome: 'hotmart CORTADA' }],
  ['wsteste_hotoff_' + marca, { origem: 'hotmart', ativo: false, status: 'ATIVA', esperado: false, nome: 'hotmart inativa' }],
  ['wsteste_asa_' + marca, { origem: 'asaas', ativo: true, status: 'ATIVA', esperado: true, nome: 'asaas ATIVA' }],
  ['wsteste_asacut_' + marca, { origem: 'asaas', ativo: true, status: 'CORTADA', esperado: false, nome: 'asaas CORTADA' }],
  ['wsteste_lib_' + marca, { origem: 'asaas', ativo: true, status: 'CORTADA', liberacao: true, esperado: true, nome: 'asaas CORTADA + liberacaoManual' }],
]

try {
  for (const [id, c] of casos) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem","liberacaoManual")
       VALUES ($1,$2,$3,'TRIAL',$4,$5,$6,$7)`,
      id, 'Teste ' + c.nome, id, c.ativo, c.status, c.origem, !!c.liberacao,
    )
  }
  for (const [id, c] of casos) {
    const e = await estadoDaAssinatura(id)
    checar(c.nome, e?.temAcesso === c.esperado, `temAcesso=${e?.temAcesso} · ${e?.motivo}`)
  }
  const inexistente = await estadoDaAssinatura('wsteste_naoexiste')
  checar('workspace inexistente → null', inexistente === null)
} finally {
  await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id" LIKE 'wsteste_%'`)
  console.log('\n  🧹 workspaces de teste removidas')
}

// ── C. A flag ────────────────────────────────────────────────────────────────
console.log('\n[C] Feature flag\n')
const ligadaAgora = revalidacaoLigada()
checar(`ASSINATURA_REVALIDACAO no ambiente atual: ${ligadaAgora ? 'ON' : 'OFF'}`, true)
delete process.env.ASSINATURA_REVALIDACAO
checar('sem a env → desligada', revalidacaoLigada() === false)
process.env.ASSINATURA_REVALIDACAO = 'off'
checar('"off" → desligada', revalidacaoLigada() === false)
process.env.ASSINATURA_REVALIDACAO = 'true'
checar('"true" (valor errado) → desligada (só "on" liga)', revalidacaoLigada() === false)
process.env.ASSINATURA_REVALIDACAO = 'ON'
checar('"ON" → ligada (case-insensitive)', revalidacaoLigada() === true)

// ── D. Contagem de produção intocada ─────────────────────────────────────────
console.log('\n[D] Estado do banco DEV após as provas\n')
const dist = await prisma.$queryRawUnsafe(
  `SELECT COALESCE("assinaturaOrigem",'(nulo)') AS origem, COUNT(*)::int AS n
   FROM "Workspace" GROUP BY 1 ORDER BY 2 DESC`)
for (const d of dist) console.log(`  ${String(d.origem).padEnd(10)} ${d.n}`)
const [{ n: sobrou }] = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*)::int AS n FROM "Workspace" WHERE "id" LIKE 'wsteste_%'`)
checar('nenhuma workspace de teste sobrou', sobrou === 0, `sobraram: ${sobrou}`)

console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
process.exitCode = falhas === 0 ? 0 : 1
await prisma.$disconnect()
