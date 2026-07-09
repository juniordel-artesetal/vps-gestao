import { Prisma } from '@prisma/client'

// ─────────────────────────────────────────────────────────────
// Ordenação compartilhada de pedidos (tabela "Order", alias "o")
//
// Fonte única da cláusula ORDER BY usada tanto na lista geral
// (/api/producao/pedidos) quanto na fila de cada setor
// (/api/producao/workflow). Espelha as opções do botão "Ordenar"
// (components/OrdenarPedidos.tsx).
//
// Retorna `null` para a ordenação padrão ('') ou valor desconhecido —
// nesse caso cada rota mantém o seu próprio ORDER BY default (que
// pode diferir: a lista ordena por prioridade + createdAt; o setor
// ordena por prioridade + iniciadoEm).
//
// Requer que a query use o alias "o" para a tabela "Order" (ambas as
// rotas já usam). NULLS LAST mantém pedidos sem data no fim em ASC.
// ─────────────────────────────────────────────────────────────
export function orderByPedido(ordenacao: string | null | undefined): Prisma.Sql | null {
  switch (ordenacao) {
    case 'data_entrada_asc':
      return Prisma.sql`ORDER BY o."dataEntrada" ASC NULLS LAST, o."createdAt" DESC`
    case 'data_entrada_desc':
      return Prisma.sql`ORDER BY o."dataEntrada" DESC NULLS LAST, o."createdAt" DESC`
    case 'data_envio_asc':
      return Prisma.sql`ORDER BY o."dataEnvio" ASC NULLS LAST, o."createdAt" DESC`
    case 'data_envio_desc':
      return Prisma.sql`ORDER BY o."dataEnvio" DESC NULLS LAST, o."createdAt" DESC`
    case 'valor_asc':
      return Prisma.sql`ORDER BY o."valor" ASC NULLS LAST, o."createdAt" DESC`
    case 'valor_desc':
      return Prisma.sql`ORDER BY o."valor" DESC NULLS LAST, o."createdAt" DESC`
    case 'canal_asc':
      return Prisma.sql`ORDER BY o."canal" ASC NULLS LAST, o."createdAt" DESC`
    case 'destinatario_asc':
      return Prisma.sql`ORDER BY o."destinatario" ASC NULLS LAST, o."createdAt" DESC`
    case 'destinatario_desc':
      return Prisma.sql`ORDER BY o."destinatario" DESC NULLS LAST, o."createdAt" DESC`
    case 'numero_asc':
      return Prisma.sql`ORDER BY o."numero" ASC NULLS LAST, o."createdAt" DESC`
    case 'numero_desc':
      return Prisma.sql`ORDER BY o."numero" DESC NULLS LAST, o."createdAt" DESC`
    default:
      return null
  }
}
