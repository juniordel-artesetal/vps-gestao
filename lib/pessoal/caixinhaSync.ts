// Sincroniza o movimento de caixinha vinculado a um lançamento (envelope de gastos).
// DESPESA+caixinha → RETIRADA (consome o envelope); RECEITA+caixinha → DEPOSITO.
// Fonte única de consistência: editar/excluir sempre passa por aqui (limpar → aplicar).
// Escopo por userId; nunca cross-user. O saldo denormalizado da caixinha é mantido alinhado.
import { prisma } from '@/lib/prisma'

function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

/** Remove o movimento de caixinha E o lançamento-espelho (RESGATE/RESERVA) vinculados ao lançamento, revertendo o saldo. */
export async function limparMovCaixinhaDoLancamento(userId: string, lancamentoId: string) {
  const movs = await prisma.$queryRaw`
    SELECT "id","caixinhaId","tipo","valor"::float AS valor
    FROM "PessoalCaixinhaMov" WHERE "lancamentoId" = ${lancamentoId} AND "userId" = ${userId}
  ` as { id: string; caixinhaId: string; tipo: string; valor: number }[]
  for (const m of movs) {
    const reverter = m.tipo === 'DEPOSITO' ? -m.valor : m.valor // desfaz o efeito no saldo
    await prisma.$executeRaw`UPDATE "PessoalCaixinha" SET "saldo" = "saldo" + ${reverter} WHERE "id" = ${m.caixinhaId} AND "userId" = ${userId}`
  }
  if (movs.length) await prisma.$executeRaw`DELETE FROM "PessoalCaixinhaMov" WHERE "lancamentoId" = ${lancamentoId} AND "userId" = ${userId}`
  // Lançamento-espelho no caixa (referencia = id do lançamento-pai): some junto.
  await prisma.$executeRaw`
    DELETE FROM "PessoalLancamento"
    WHERE "userId" = ${userId} AND "origem" = 'CAIXINHA' AND "tipo" IN ('RESERVA','RESGATE') AND "referencia" = ${lancamentoId}
  `
}

/** Cria o movimento conforme o lançamento (se aponta pra uma caixinha do próprio usuário) +
 *  o lançamento-espelho no CAIXA, pra o gasto/receita-da-caixinha fechar certo:
 *   DESPESA paga da caixinha → RETIRADA na caixinha + RESGATE no caixa (crédito) → caixa líquido 0, caixinha −X.
 *   RECEITA guardada na caixinha → DEPOSITO na caixinha + RESERVA no caixa (débito) → caixa líquido 0, caixinha +X.
 *  Sem o espelho, o gasto reduzia caixa E caixinha (contava dobrado). */
export interface MovCaixinhaResult { caixinhaNome: string; pedido: number; movimentado: number; saldoAntes: number; saldoDepois: number; movTipo: 'DEPOSITO' | 'RETIRADA' }

export async function aplicarMovCaixinhaDoLancamento(userId: string, lancamentoId: string, r: {
  tipo: string; valor: number; caixinhaId: string | null; contaId: string | null; data: string; descricao: string
}): Promise<MovCaixinhaResult | null> {
  if (!r.caixinhaId || r.valor <= 0) return null
  // Saldo pela SOMA DOS MOVIMENTOS (fonte da verdade) — pra clampar retirada e reportar.
  const [cx] = await prisma.$queryRaw`
    SELECT c."id", c."nome",
      COALESCE(SUM(CASE WHEN m."tipo"='DEPOSITO' THEN m."valor" WHEN m."tipo"='RETIRADA' THEN -m."valor" ELSE 0 END),0)::float AS saldo
    FROM "PessoalCaixinha" c LEFT JOIN "PessoalCaixinhaMov" m ON m."caixinhaId"=c."id" AND m."userId"=c."userId"
    WHERE c."id" = ${r.caixinhaId} AND c."userId" = ${userId} GROUP BY c."id", c."nome" LIMIT 1
  ` as { id: string; nome: string; saldo: number }[]
  if (!cx) return null // caixinha inválida/de outro usuário — ignora silenciosamente
  const movTipo: 'DEPOSITO' | 'RETIRADA' = r.tipo === 'RECEITA' ? 'DEPOSITO' : 'RETIRADA'
  const saldoAntes = Number(cx.saldo)
  // Retirada nunca deixa a caixinha negativa: tira só o disponível.
  const efetivo = movTipo === 'RETIRADA' ? Math.max(0, Math.min(r.valor, saldoAntes)) : r.valor
  const base: MovCaixinhaResult = { caixinhaNome: cx.nome, pedido: r.valor, movimentado: efetivo, saldoAntes, saldoDepois: saldoAntes + (movTipo === 'DEPOSITO' ? efetivo : -efetivo), movTipo }
  if (efetivo <= 0) return base // nada a resgatar (caixinha vazia) — não cria mov/espelho

  const delta = movTipo === 'DEPOSITO' ? efetivo : -efetivo
  await prisma.$executeRaw`
    INSERT INTO "PessoalCaixinhaMov" ("id","caixinhaId","userId","tipo","valor","data","contaId","obs","lancamentoId","createdAt")
    VALUES (${gid()}, ${r.caixinhaId}, ${userId}, ${movTipo}, ${efetivo}, ${r.data}::date, ${r.contaId}, ${r.descricao ? r.descricao.slice(0, 120) : null}, ${lancamentoId}, NOW())
  `
  await prisma.$executeRaw`UPDATE "PessoalCaixinha" SET "saldo" = "saldo" + ${delta} WHERE "id" = ${r.caixinhaId} AND "userId" = ${userId}`

  // Conta do espelho: a do lançamento, senão a conta de onde a caixinha foi abastecida (p/ RETIRADA).
  let contaEspelho = r.contaId || null
  if (!contaEspelho && movTipo === 'RETIRADA') {
    const [orig] = await prisma.$queryRaw`
      SELECT "contaId" FROM "PessoalCaixinhaMov"
      WHERE "caixinhaId" = ${r.caixinhaId} AND "userId" = ${userId} AND "tipo" = 'DEPOSITO' AND "contaId" IS NOT NULL
      ORDER BY "data" DESC, "createdAt" DESC LIMIT 1
    ` as { contaId: string }[]
    contaEspelho = orig?.contaId || null
  }
  const espelhoTipo = r.tipo === 'DESPESA' ? 'RESGATE' : 'RESERVA'
  const espelhoDesc = (r.tipo === 'DESPESA' ? `🐷 Resgate p/ ${r.descricao || 'gasto'}` : `🐷 Reserva de ${r.descricao || 'receita'}`).slice(0, 120)
  await prisma.$executeRaw`
    INSERT INTO "PessoalLancamento" ("id","userId","tipo","descricao","valor","data","status","contaId","origem","referencia","createdAt")
    VALUES (${gid()}, ${userId}, ${espelhoTipo}, ${espelhoDesc}, ${efetivo}, ${r.data}::date, 'PAGO', ${contaEspelho}, 'CAIXINHA', ${lancamentoId}, NOW())
  `
  return base
}

/** Reconcilia (usado ao editar): limpa o movimento antigo e recria conforme o estado novo. */
export async function reconciliarMovCaixinha(userId: string, lancamentoId: string, r: {
  tipo: string; valor: number; caixinhaId: string | null; contaId: string | null; data: string; descricao: string
}) {
  await limparMovCaixinhaDoLancamento(userId, lancamentoId)
  await aplicarMovCaixinhaDoLancamento(userId, lancamentoId, r)
}
