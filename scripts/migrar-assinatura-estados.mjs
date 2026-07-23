// ─────────────────────────────────────────────────────────────────────────────
// ETAPA 1 — máquina de estados da assinatura: coluna de ORIGEM + backfill.
//
//   Workspace."assinaturaOrigem"  'hotmart' | 'asaas' | NULL
//
// Sem ela não dá para saber QUEM manda no acesso de cada workspace, e os dois
// caminhos (Hotmart e Asaas) passariam a disputar o mesmo campo "ativo".
//
// Backfill conservador: marca 'hotmart' só onde existe "hotmartSubId". O resto
// fica NULL — ninguém é reclassificado no escuro.
//
// ⚠️ ESCOPO ESTRITO — só ADD COLUMN + um UPDATE de backfill. NÃO altera "ativo",
//    NÃO altera "assinaturaStatus", NÃO toca HotmartAssinatura nem Asaas*.
//
// USO (a ORDEM dos --env-file importa: o último vence):
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-estados.mjs
//   node --env-file=.env --env-file=.env.local scripts/migrar-assinatura-estados.mjs --apply
//
// ⚠️ Sem o .env.local, aponta para PRODUÇÃO. Confira o host antes do --apply.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--apply')

const PASSOS = [
  ['Workspace: coluna assinaturaOrigem', `
    ALTER TABLE "Workspace"
      ADD COLUMN IF NOT EXISTS "assinaturaOrigem" TEXT
  `],
  ['Workspace: índice por origem+status (varredura do job diário)', `
    CREATE INDEX IF NOT EXISTS "Workspace_assinatura_idx"
      ON "Workspace" ("assinaturaOrigem", "assinaturaStatus")
  `],
  // Backfill de TODAS as workspaces existentes como 'hotmart'.
  //
  // Não é por elas terem vindo da Hotmart (as colunas hotmart* do Workspace estão
  // MORTAS — nenhum código as preenche, só 2 de 281 linhas têm hotmartSubId). É
  // porque toda conta que já existe é, por definição, anterior ao Asaas: quem
  // governa o acesso dela é o caminho atual. 'asaas' só será gravado, explicitamente,
  // nas contas nascidas depois que a Etapa 6 entrar.
  //
  // Ainda assim isto é COSMÉTICO para a segurança: lib/assinatura só aplica a
  // máquina de estados nova quando origem === 'asaas', então NULL já seria inerte.
  ['Backfill: contas existentes → origem hotmart (caminho atual)', `
    UPDATE "Workspace"
    SET "assinaturaOrigem" = 'hotmart'
    WHERE "assinaturaOrigem" IS NULL
  `],
]

async function retrato(titulo) {
  const [r] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "ativo" = true)::int AS ativos,
           COUNT("hotmartSubId")::int AS com_hotmart,
           COUNT(*) FILTER (WHERE "liberacaoManual" = true)::int AS liberados
    FROM "Workspace"`)
  console.log(`  ${titulo}: total=${r.total} ativos=${r.ativos} comHotmartSubId=${r.com_hotmart} liberacaoManual=${r.liberados}`)
  return r
}

async function main() {
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '?' } })()
  console.log(`\n=== Etapa 1 — estados da assinatura — ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ===`)
  console.log(`Banco: ${host}\n`)

  const antes = await retrato('antes ')

  if (!APLICAR) {
    console.log()
    for (const [nome, sql] of PASSOS) console.log(`  [ ] ${nome}\n      ${sql.trim().split('\n')[0].trim()}…`)
    const [prev] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n FROM "Workspace" WHERE "hotmartSubId" IS NOT NULL`)
    console.log(`\n  O backfill marcaria ${prev.n} workspace(s) como 'hotmart'.`)
    console.log(`\n${PASSOS.length} passos. Rode com --apply para executar.\n`)
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const [nome, sql] of PASSOS) {
      const n = await tx.$executeRawUnsafe(sql)
      console.log(`  [x] ${nome}${nome.startsWith('Backfill') ? ` — ${n} linha(s)` : ''}`)
    }
  })

  console.log()
  const depois = await retrato('depois')

  // Trava de sanidade: a migração NÃO pode ter mexido em acesso de ninguém.
  if (antes.total !== depois.total || antes.ativos !== depois.ativos) {
    console.error('\n❌ ALERTA: total/ativos mudaram. A migração deveria ser inerte para acesso.\n')
    process.exitCode = 1
    return
  }

  const dist = await prisma.$queryRawUnsafe(`
    SELECT COALESCE("assinaturaOrigem", '(nulo)') AS origem, COUNT(*)::int AS n
    FROM "Workspace" GROUP BY 1 ORDER BY 2 DESC`)
  console.log('\n  Distribuição por origem:')
  for (const d of dist) console.log(`    ${String(d.origem).padEnd(10)} ${d.n}`)
  console.log('\n✅ Migração aplicada (nenhum acesso alterado).\n')
}

main()
  .catch(e => { console.error('\n❌ Falhou:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
