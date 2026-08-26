// Lógica única de "verificar + ativar + notificar" do domínio próprio da Loja.
// Usada pela rota /verificar (clique/polling) e pelo cron (auto-ativa mesmo com a aba fechada).
import { prisma } from '@/lib/prisma'
import { ensureLojaDominioSchema } from '@/lib/lojaDominio'
import { vercelVerify, vercelConfig, registrosDns } from '@/lib/vercelDomains'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export type ResultadoVerificacao = {
  ok: boolean
  ativo: boolean
  aviso: string | null
  dominio: any | null
  ativouAgora: boolean
}

// Verifica UM workspace. Retorna o estado atualizado. Se virou ATIVO agora (transição),
// cria a Notificação "seu domínio está no ar" (idempotente) para as ADMINs.
export async function verificarEAtivarDominio(workspaceId: string): Promise<ResultadoVerificacao | null> {
  await ensureLojaDominioSchema()

  const [row] = await prisma.$queryRaw`
    SELECT "dominio","status" FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as { dominio: string; status: string }[]
  if (!row) return null

  const v = await vercelVerify(row.dominio)
  const c = await vercelConfig(row.dominio)
  const ativo = v.verified && !c.misconfigured
  const eraAtivo = row.status === 'ATIVO'
  const novoStatus = ativo ? 'ATIVO' : 'VERIFICANDO'
  const registros = registrosDns(row.dominio, v.verification)

  await prisma.$executeRaw`
    UPDATE "LojaDominio"
    SET "status" = ${novoStatus},
        "instrucoesDns" = ${JSON.stringify(registros)}::jsonb,
        "verificadoEm" = ${ativo ? new Date() : null}
    WHERE "workspaceId" = ${workspaceId}
  `

  const ativouAgora = ativo && !eraAtivo
  if (ativouAgora) {
    try {
      const admins = await prisma.$queryRaw`
        SELECT "id" FROM "User" WHERE "workspaceId" = ${workspaceId} AND "role" = 'ADMIN' AND "ativo" = true
      ` as { id: string }[]
      const msg = `Seu domínio ${row.dominio} está no ar! 🎉 Sua loja já abre por ele, com cadeado de segurança.`
      for (const a of admins) {
        await prisma.$executeRaw`
          INSERT INTO "Notificacao" ("id","workspaceId","userId","tipo","titulo","mensagem","href","lida","createdAt")
          SELECT ${gid()}, ${workspaceId}, ${a.id}, 'dominio_ativo', 'Domínio no ar 🌐', ${msg}, '/config/loja', false, NOW()
          WHERE NOT EXISTS (SELECT 1 FROM "Notificacao" WHERE "workspaceId" = ${workspaceId} AND "userId" = ${a.id} AND "tipo" = 'dominio_ativo' AND "mensagem" = ${msg})
        `
      }
    } catch (e: any) { console.error('[LOJA-DOMINIO notificação]', e?.message) }
  }

  const [atual] = await prisma.$queryRaw`
    SELECT "id","workspaceId","dominio","status","instrucoesDns","verificadoEm","criadoEm"
    FROM "LojaDominio" WHERE "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]

  return {
    ok: true,
    ativo,
    ativouAgora,
    aviso: ativo ? null : (v.verified
      ? 'Encontramos o registro! O certificado de segurança está sendo emitido — pode levar alguns minutos.'
      : 'Ainda não encontramos o registro no seu domínio. O DNS pode levar de alguns minutos até algumas horas pra propagar — pode fechar esta tela, a gente te avisa quando ativar.'),
    dominio: atual || null,
  }
}
