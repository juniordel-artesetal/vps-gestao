// ─────────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA DA VERDADE do STATUS DO PEDIDO (Order.status) e da regra de "entregue".
//
// ⚠️ NÃO confundir com outros domínios que também usam a palavra "CONCLUIDO":
//   - PedidoSetor.status  → status de um SETOR (PENDENTE/EM_ANDAMENTO/DEVOLVIDO/CONCLUIDO)
//   - SuporteFeedback.status → domínio de suporte
//   Esses NÃO são status de pedido e continuam usando 'CONCLUIDO' normalmente.
//
// Modelo canônico do PEDIDO:
//   ABERTO      → "Aguardando"
//   EM_PRODUCAO → "Fazendo agora"
//   PRONTO      → "Prontos"  (produção concluída; se há expedição, aguardando expedir;
//                             se NÃO há expedição, é o estado FINAL da artesã)
//   ENVIADO     → "Enviados" (expedição concluída)
//   CANCELADO   → cancelado
//
// 'CONCLUIDO' (como status de PEDIDO) foi RENOMEADO para 'PRONTO' e MIGRADO no banco
// (PASSO B). Não existe mais 'CONCLUIDO' como status de pedido — nem no código, nem nos dados.
// ─────────────────────────────────────────────────────────────────────────────
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type StatusPedido = 'ABERTO' | 'EM_PRODUCAO' | 'PRONTO' | 'ENVIADO' | 'CANCELADO'

// Rótulos/cards canônicos (UI).
export const STATUS_PEDIDO_LABEL: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_PRODUCAO: 'Em produção',
  PRONTO: 'Pronto',
  ENVIADO: 'Enviado',
  CANCELADO: 'Cancelado',
}

// ── Helper de EXPEDIÇÃO ───────────────────────────────────────────────────────
// Um setor é de EXPEDIÇÃO por marcação explícita (ehExpedicao). Fallback pelo nome
// "expedi" APENAS enquanto o workspace não marcou nenhum (compat até todos migrarem).
export function ehSetorExpedicao(
  setor: { ehExpedicao?: any; nome?: string | null } | null | undefined,
  temMarcada: boolean,
): boolean {
  if (!setor) return false
  if (setor.ehExpedicao === true) return true
  if (!temMarcada) return !!setor.nome?.toLowerCase().includes('expedi')
  return false
}

// O workspace tem uma etapa de EXPEDIÇÃO? Define a regra de "entregue". Usa a MESMA
// detecção do fluxo (ehSetorExpedicao): marcação explícita ehExpedicao OU, na ausência
// de qualquer marcação, um setor com "expedi" no nome (compat legado).
export async function workspaceTemExpedicao(workspaceId: string): Promise<boolean> {
  try {
    const [r] = await prisma.$queryRaw`
      SELECT EXISTS(
        SELECT 1 FROM "SetorConfig"
        WHERE "workspaceId" = ${workspaceId} AND "ativo" = true
          AND (
            "ehExpedicao" = true
            OR (
              "nome" ILIKE '%expedi%'
              AND NOT EXISTS (
                SELECT 1 FROM "SetorConfig" x
                WHERE x."workspaceId" = ${workspaceId} AND x."ativo" = true AND x."ehExpedicao" = true
              )
            )
          )
      ) AS tem
    ` as { tem: boolean }[]
    return !!r?.tem
  } catch {
    return false
  }
}

// ── ÚNICA definição de "ENTREGUE" no sistema ──────────────────────────────────
// COM expedição → entregue = ENVIADO (PRONTO ainda não saiu do ateliê).
// SEM expedição → entregue = PRONTO (é o estado final da artesã) ou ENVIADO.
export function ehEntregue(status: string, temExpedicao: boolean): boolean {
  if (temExpedicao) return status === 'ENVIADO'
  return status === 'ENVIADO' || status === 'PRONTO'
}

// ── Fragmentos SQL (raw) — usam o mesmo critério acima ─────────────────────────
// `col` é a coluna de status já qualificada, ex.: Prisma.sql`o."status"` ou Prisma.sql`status`.

// status é PRONTO
export function sqlEhPronto(col: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`${col} = 'PRONTO'`
}

// entregue conforme a regra de expedição do workspace
export function sqlEhEntregue(col: Prisma.Sql, temExpedicao: boolean): Prisma.Sql {
  return temExpedicao
    ? Prisma.sql`${col} = 'ENVIADO'`
    : Prisma.sql`(${col} = 'ENVIADO' OR ${col} = 'PRONTO')`
}

// "finalizado" p/ efeito de atraso: entregue OU cancelado (não conta como atrasado).
// Obs.: em workspace COM expedição, PRONTO NÃO é finalizado (ainda tem que expedir) —
// então pronto atrasado (dataEnvio vencida) É contado como atraso, coerente com o sino.
export function sqlFinalizado(col: Prisma.Sql, temExpedicao: boolean): Prisma.Sql {
  return Prisma.sql`(${sqlEhEntregue(col, temExpedicao)} OR ${col} = 'CANCELADO')`
}
