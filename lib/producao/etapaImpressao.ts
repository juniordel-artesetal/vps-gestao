// ETAPA DE IMPRESSÃO da produção (MAE Lote 7, item 119). O MAE se liga pelo TIPO da etapa ("SetorConfig"."tipo" =
// 'impressao'), não pelo nome — "Imprimir" ou "Impressão" funcionam igual. Enquanto o ateliê não marcou nenhuma
// etapa com o tipo, vale o nome (/impress|imprim/), como a Expedição faz com "expedi".
//
// Mesmo SQL do fluxo (app/api/producao/workflow/route.ts), com duas travas:
//  • INICIAR: só ANDA PARA A FRENTE — pedido que já está na Impressão ou adiante não volta ("Gerar de novo");
//  • MARCAR IMPRESSO: conclui a Impressão e ativa a próxima; se a próxima é a Expedição o pedido fica PRONTO.
//    NUNCA conclui a Expedição → nenhum efeito de ENVIADO (receita, estoque, TikTok) dispara por aqui.
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ehSetorExpedicao } from '@/lib/statusPedido'

type Db = Prisma.TransactionClient
export interface SetorFluxo { id: string; nome: string; ordem: number; ehExpedicao: boolean | null; tipo: string | null }

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const FINALIZADOS = ['CANCELADO', 'ENVIADO', 'PRONTO', 'CONCLUIDO', 'ENTREGUE']

/** A etapa de Impressão da lista (ordenada): pelo tipo; sem nenhuma marcada, pelo nome. Puro. */
export function acharEtapaImpressao(setores: SetorFluxo[]): SetorFluxo | null {
  const temExp = setores.some(s => s.ehExpedicao === true)
  const marcadas = setores.filter(s => s.tipo === 'impressao')
  if (marcadas.length) return marcadas[0]
  return setores.find(s => /impress|imprim/i.test(s.nome) && !ehSetorExpedicao(s, temExp)) ?? null
}

async function setoresAtivos(db: Db, ws: string): Promise<SetorFluxo[]> {
  return db.$queryRaw<SetorFluxo[]>`SELECT "id", "nome", "ordem", "ehExpedicao", "tipo" FROM "SetorConfig" WHERE "workspaceId" = ${ws} AND "ativo" = true ORDER BY "ordem" ASC`
}

export async function etapaImpressaoDo(ws: string): Promise<SetorFluxo | null> {
  return acharEtapaImpressao(await setoresAtivos(prisma, ws))
}

/** Cria a etapa "Impressão" (tipo impressao) ANTES da Expedição (decisão do Júnior); sem Expedição, no fim. */
export async function garantirEtapaImpressao(ws: string, tx?: Db): Promise<{ criada: boolean; etapa: SetorFluxo }> {
  const rodar = <T,>(f: (db: Db) => Promise<T>) => (tx ? f(tx) : prisma.$transaction(f))
  return rodar(async db => {
    const setores = await setoresAtivos(db, ws)
    const ja = acharEtapaImpressao(setores)
    if (ja) return { criada: false, etapa: ja }
    const temExp = setores.some(s => s.ehExpedicao === true)
    const exp = setores.find(s => ehSetorExpedicao(s, temExp))
    let ordem: number
    if (exp) {
      ordem = Number(exp.ordem)
      await db.$executeRaw`UPDATE "SetorConfig" SET "ordem" = "ordem" + 1 WHERE "workspaceId" = ${ws} AND "ordem" >= ${ordem}`
    } else {
      const [m] = await db.$queryRaw<{ maxordem: number | null }[]>`SELECT MAX("ordem") AS maxordem FROM "SetorConfig" WHERE "workspaceId" = ${ws}`
      ordem = (m?.maxordem ?? -1) + 1
    }
    const id = gerarId()
    await db.$executeRaw`INSERT INTO "SetorConfig" ("id", "workspaceId", "nome", "ordem", "ativo", "tipo") VALUES (${id}, ${ws}, 'Impressão', ${ordem}, true, 'impressao')`
    return { criada: true, etapa: { id, nome: 'Impressão', ordem, ehExpedicao: false, tipo: 'impressao' } }
  })
}

export type ResultadoEtapa = 'movido' | 'ja_adiante' | 'finalizado' | 'sem_etapa' | 'nao_encontrado' | 'impresso'

async function atual(db: Db, ws: string, pedidoId: string) {
  const [r] = await db.$queryRaw<{ setorId: string; nome: string }[]>`
    SELECT ps."setorId", sc."nome" FROM "PedidoSetor" ps JOIN "SetorConfig" sc ON sc."id" = ps."setorId"
    WHERE ps."pedidoId" = ${pedidoId} AND ps."workspaceId" = ${ws} AND ps."status" = 'EM_ANDAMENTO'
    ORDER BY ps."iniciadoEm" DESC NULLS LAST LIMIT 1`
  return r ?? null
}
// "PedidoSetorAtual" é uma VIEW (a 1ª etapa não concluída de "PedidoSetor"): anda sozinha com os status acima —
// não se grava nela (a rota do fluxo tenta e o erro é engolido; aqui, dentro da transação, derrubaria tudo).
async function historico(db: Db, ws: string, pedidoId: string, tipo: string, descricao: string, usuario: string) {
  await db.$executeRaw`INSERT INTO "PedidoHistorico" ("id", "pedidoId", "workspaceId", "tipo", "descricao", "usuarioNome") VALUES (${gerarId()}, ${pedidoId}, ${ws}, ${tipo}, ${descricao}, ${usuario})`
}

/** Leva o pedido para a etapa de Impressão (iniciada). Só para a frente. */
async function iniciarEm(db: Db, ws: string, pedidoId: string, usuario: string): Promise<ResultadoEtapa> {
  const [o] = await db.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Order" WHERE "id" = ${pedidoId} AND "workspaceId" = ${ws}`
  if (!o) return 'nao_encontrado'
  if (FINALIZADOS.includes(o.status)) return 'finalizado'
  const setores = await setoresAtivos(db, ws)
  const imp = acharEtapaImpressao(setores)
  if (!imp) return 'sem_etapa'
  const idxImp = setores.findIndex(s => s.id === imp.id)
  const at = o.status === 'ABERTO' ? null : await atual(db, ws, pedidoId)
  const idxAt = at ? setores.findIndex(s => s.id === at.setorId) : -1
  if (idxAt >= idxImp) return 'ja_adiante'
  // antes da Impressão → CONCLUIDO (preserva datas); Impressão → EM_ANDAMENTO iniciada; depois → PENDENTE
  for (let i = 0; i < setores.length; i++) {
    const s = setores[i]
    const [ex] = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PedidoSetor" WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${s.id} AND "workspaceId" = ${ws} LIMIT 1`
    if (i < idxImp) {
      if (ex) await db.$executeRaw`UPDATE "PedidoSetor" SET "status" = 'CONCLUIDO', "iniciadoEm" = COALESCE("iniciadoEm", NOW()), "concluidoEm" = COALESCE("concluidoEm", NOW()), "updatedAt" = NOW() WHERE "id" = ${ex.id}`
      else await db.$executeRaw`INSERT INTO "PedidoSetor" ("id", "workspaceId", "pedidoId", "setorId", "status", "iniciadoEm", "concluidoEm") VALUES (${gerarId()}, ${ws}, ${pedidoId}, ${s.id}, 'CONCLUIDO', NOW(), NOW())`
    } else if (i === idxImp) {
      if (ex) await db.$executeRaw`UPDATE "PedidoSetor" SET "status" = 'EM_ANDAMENTO', "iniciadoEm" = NOW(), "concluidoEm" = NULL, "updatedAt" = NOW() WHERE "id" = ${ex.id}`
      else await db.$executeRaw`INSERT INTO "PedidoSetor" ("id", "workspaceId", "pedidoId", "setorId", "status", "iniciadoEm") VALUES (${gerarId()}, ${ws}, ${pedidoId}, ${s.id}, 'EM_ANDAMENTO', NOW())`
    } else {
      if (ex) await db.$executeRaw`UPDATE "PedidoSetor" SET "status" = 'PENDENTE', "iniciadoEm" = NULL, "concluidoEm" = NULL, "updatedAt" = NOW() WHERE "id" = ${ex.id}`
      else await db.$executeRaw`INSERT INTO "PedidoSetor" ("id", "workspaceId", "pedidoId", "setorId", "status") VALUES (${gerarId()}, ${ws}, ${pedidoId}, ${s.id}, 'PENDENTE')`
    }
  }
  await db.$executeRaw`UPDATE "Order" SET "status" = 'EM_PRODUCAO', "updatedAt" = NOW() WHERE "id" = ${pedidoId} AND "workspaceId" = ${ws}`
  await historico(db, ws, pedidoId, o.status === 'ABERTO' ? 'STATUS' : 'AVANCO', `${at?.nome ?? 'Aguardando'} → ${imp.nome} (arte gerada no MAE)`, usuario)
  return 'movido'
}

/** Conclui a Impressão e ativa a próxima etapa (Expedição → pedido PRONTO). Nunca conclui a Expedição. */
async function concluirImpressao(db: Db, ws: string, pedidoId: string, usuario: string): Promise<ResultadoEtapa> {
  const r = await iniciarEm(db, ws, pedidoId, usuario)
  if (r !== 'movido' && r !== 'ja_adiante') return r
  const setores = await setoresAtivos(db, ws)
  const imp = acharEtapaImpressao(setores)!
  const at = await atual(db, ws, pedidoId)
  if (!at || at.setorId !== imp.id) return 'ja_adiante'   // já passou da Impressão
  const idxImp = setores.findIndex(s => s.id === imp.id)
  const prox = setores[idxImp + 1]
  await db.$executeRaw`UPDATE "PedidoSetor" SET "status" = 'CONCLUIDO', "iniciadoEm" = COALESCE("iniciadoEm", NOW()), "concluidoEm" = NOW(), "updatedAt" = NOW()
    WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${imp.id} AND "workspaceId" = ${ws}`
  const temExp = setores.some(s => s.ehExpedicao === true)
  if (!prox) {
    // Impressão era a última etapa (e não é Expedição) → produção concluída
    await db.$executeRaw`UPDATE "Order" SET "status" = 'PRONTO', "updatedAt" = NOW() WHERE "id" = ${pedidoId} AND "workspaceId" = ${ws}`
    await historico(db, ws, pedidoId, 'AVANCO', `${imp.nome} concluída (impresso no MAE)`, usuario)
    return 'impresso'
  }
  const [ex] = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PedidoSetor" WHERE "pedidoId" = ${pedidoId} AND "setorId" = ${prox.id} AND "workspaceId" = ${ws} LIMIT 1`
  if (ex) await db.$executeRaw`UPDATE "PedidoSetor" SET "status" = 'EM_ANDAMENTO', "iniciadoEm" = NULL, "concluidoEm" = NULL, "updatedAt" = NOW() WHERE "id" = ${ex.id}`
  else await db.$executeRaw`INSERT INTO "PedidoSetor" ("id", "workspaceId", "pedidoId", "setorId", "status") VALUES (${gerarId()}, ${ws}, ${pedidoId}, ${prox.id}, 'EM_ANDAMENTO')`
  await db.$executeRaw`UPDATE "Order" SET "status" = ${ehSetorExpedicao(prox, temExp) ? 'PRONTO' : 'EM_PRODUCAO'}, "updatedAt" = NOW() WHERE "id" = ${pedidoId} AND "workspaceId" = ${ws}`
  await historico(db, ws, pedidoId, 'AVANCO', `${imp.nome} → ${prox.nome} (impresso no MAE)`, usuario)
  return 'impresso'
}

/** Resumo por resultado ("3 movidos · 1 já adiante"). */
export type Resumo = Partial<Record<ResultadoEtapa, number>>

/** Vários pedidos, um por vez (cada um na sua transação: um erro não desfaz os outros). `db` = teste com rollback. */
async function emMassa(ws: string, ids: string[], usuario: string, f: typeof iniciarEm, db?: Db): Promise<Resumo> {
  const out: Resumo = {}
  for (const id of ids.slice(0, 500)) {
    const r = db ? await f(db, ws, id, usuario) : await prisma.$transaction(tx => f(tx, ws, id, usuario))
    out[r] = (out[r] ?? 0) + 1
  }
  return out
}
export const iniciarImpressao = (ws: string, ids: string[], usuario: string, db?: Db) => emMassa(ws, ids, usuario, iniciarEm, db)
export const marcarImpresso = (ws: string, ids: string[], usuario: string, db?: Db) => emMassa(ws, ids, usuario, concluirImpressao, db)
