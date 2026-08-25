// Guarda de DDL em runtime. Só emite `ALTER TABLE ... ADD COLUMN` quando a coluna
// REALMENTE falta — verificando o catálogo antes (SELECT = AccessShare, não conflita).
//
// Por que existe: os `ensure*Schema()` rodam a cada cold-start serverless (o guard em
// memória não sobrevive entre instâncias). Um `ADD COLUMN IF NOT EXISTS`, mesmo sendo
// no-op, pega ACCESS EXCLUSIVE na tabela. Na "Workspace" (lida em toda request: sessão,
// tema, layout), colidindo com uma leitura lenta, os ALTERs enfileiram e TRAVAM o app
// inteiro — foi a causa do incidente de lentidão em 25/08. Com esta guarda, o caminho
// comum (coluna já existe) é uma leitura barata e não toca em lock de escrita.
import { prisma } from '@/lib/prisma'

export async function garantirColuna(tabela: string, coluna: string, definicao: string): Promise<void> {
  const [tem] = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2
     ) AS ok`,
    tabela, coluna,
  ) as { ok: boolean }[]
  if (tem?.ok) return
  // Caminho raro: coluna ausente → aplica (o IF NOT EXISTS cobre corridas entre instâncias).
  await prisma.$executeRawUnsafe(`ALTER TABLE "${tabela}" ADD COLUMN IF NOT EXISTS "${coluna}" ${definicao}`)
}
