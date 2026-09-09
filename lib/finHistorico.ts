// Histórico de alteração dos lançamentos (Fase 3) — quem/quando/o quê, igual ao PedidoHistorico.
// Serve para auditoria e para dar segurança ao "desfazer": nada é apagado, tudo fica registrado.
import { prisma } from '@/lib/prisma'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export type AcaoHistorico = 'CRIADO' | 'EDITADO' | 'PAGAMENTO' | 'ESTORNO' | 'EXCLUIDO' | 'STATUS'

let pronto = false
export async function ensureFinHistorico(): Promise<void> {
  if (pronto) return
  // Pré-check barato (SELECT no catálogo): com o schema já aplicado NÃO emite DDL. Sem isso,
  // cada cold-start serverless refazia ALTER/CREATE e podia enfileirar lock (incidente 25/08).
  const [ok] = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public."FinLancamentoHistorico"') IS NOT NULL AS ok
  `) as { ok: boolean }[]
  if (ok?.ok) { pronto = true; return }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FinLancamentoHistorico" (
      "id"           TEXT PRIMARY KEY,
      "lancamentoId" TEXT NOT NULL,
      "workspaceId"  TEXT NOT NULL,
      "acao"         TEXT NOT NULL,
      "descricao"    TEXT NOT NULL,
      "valorAntes"   NUMERIC,
      "valorDepois"  NUMERIC,
      "statusAntes"  TEXT,
      "statusDepois" TEXT,
      "usuarioNome"  TEXT,
      "usuarioId"    TEXT,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FinLancHist_ws_lanc_idx"
    ON "FinLancamentoHistorico" ("workspaceId","lancamentoId","createdAt" DESC)
  `)
  pronto = true
}

export interface EntradaHistorico {
  lancamentoId: string
  workspaceId: string
  acao: AcaoHistorico
  descricao: string
  valorAntes?: number | null
  valorDepois?: number | null
  statusAntes?: string | null
  statusDepois?: string | null
  usuarioNome?: string | null
  usuarioId?: string | null
}

/** Registra uma entrada. NUNCA derruba a operação principal — auditoria não pode virar bloqueio. */
export async function registrarHistorico(e: EntradaHistorico): Promise<void> {
  try {
    await ensureFinHistorico()
    await prisma.$executeRaw`
      INSERT INTO "FinLancamentoHistorico"
        ("id","lancamentoId","workspaceId","acao","descricao","valorAntes","valorDepois","statusAntes","statusDepois","usuarioNome","usuarioId","createdAt")
      VALUES (${gid()}, ${e.lancamentoId}, ${e.workspaceId}, ${e.acao}, ${e.descricao},
              ${e.valorAntes ?? null}, ${e.valorDepois ?? null},
              ${e.statusAntes ?? null}, ${e.statusDepois ?? null},
              ${e.usuarioNome ?? null}, ${e.usuarioId ?? null}, NOW())
    `
  } catch (err) {
    console.error('[finHistorico] falha ao registrar (operação segue):', String(err).slice(0, 200))
  }
}
