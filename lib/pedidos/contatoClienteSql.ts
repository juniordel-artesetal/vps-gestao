// SELECT do contato do cliente no pedido — ver contatoCliente.ts (a ordem e o porquê).
import { Prisma } from '@prisma/client'

/** Colunas para um SELECT com o pedido como `o`: "contatoOrcamento", "contatoCadastro", "emailContato". */
export const SQL_CONTATO_CLIENTE = Prisma.sql`
  (SELECT NULLIF(q."clienteWhatsapp", '') FROM "Orcamento" q
    WHERE q."pedidoId" = o."id" AND q."workspaceId" = o."workspaceId" ORDER BY q."createdAt" DESC LIMIT 1) AS "contatoOrcamento",
  (SELECT NULLIF(c."telefone", '') FROM "Cliente" c
    WHERE c."id" = o."clienteId" AND c."workspaceId" = o."workspaceId") AS "contatoCadastro",
  COALESCE(
    (SELECT NULLIF(q."clienteEmail", '') FROM "Orcamento" q
      WHERE q."pedidoId" = o."id" AND q."workspaceId" = o."workspaceId" ORDER BY q."createdAt" DESC LIMIT 1),
    (SELECT NULLIF(c."email", '') FROM "Cliente" c WHERE c."id" = o."clienteId" AND c."workspaceId" = o."workspaceId")
  ) AS "emailContato"`
