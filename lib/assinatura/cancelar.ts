// Cancelamento de assinatura — assinante e Master usam o MESMO caminho.
//
// Duas implementações divergiriam: a do Master viraria "mais poderosa" e uma das
// duas deixaria de cancelar no Asaas, gerando cobrança em assinante que cancelou.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'

export interface ResultadoCancelamento {
  ok: boolean
  erro?: string
  /** Até quando ela mantém acesso (fim do ciclo já pago). */
  acessoAte: Date | null
  subscriptionId?: string
}

/**
 * Cancela a assinatura vigente de uma workspace.
 *
 * ⚠️ `DELETE /v3/subscriptions/{id}` REMOVE as cobranças pendentes e vencidas —
 * só as pagas ficam no histórico. Por isso o acesso é ancorado em
 * `assinaturaExpira` (o que ela já pagou), e não numa cobrança futura que deixa
 * de existir no instante do cancelamento.
 *
 * Se o Asaas falhar, NÃO marcamos como cancelada: melhor a artesã tentar de novo
 * do que ficar com a assinatura ativa lá, gerando cobrança, e cancelada aqui.
 */
export async function cancelarAssinatura(p: {
  workspaceId: string
  por: 'assinante' | 'master'
  motivo?: string | null
}): Promise<ResultadoCancelamento> {
  const [ass] = await prisma.$queryRaw`
    SELECT a."subscriptionId", a."status", w."assinaturaExpira", w."assinaturaStatus"
    FROM "AsaasAssinatura" a
    JOIN "Workspace" w ON w."id" = a."workspaceId"
    WHERE a."workspaceId" = ${p.workspaceId} AND a."status" <> 'CANCELADA'
    ORDER BY a."createdAt" DESC LIMIT 1
  ` as { subscriptionId: string; status: string; assinaturaExpira: Date | null; assinaturaStatus: string }[]

  // Sem assinatura no Asaas (teste grátis / nunca assinou). Não há nada a cancelar no
  // provedor — mas a artesã pode querer encerrar. Vale só para contas Asaas/trial;
  // Hotmart se cancela na Hotmart. Decisão: encerra o acesso na hora.
  if (!ass) {
    const [w] = await prisma.$queryRaw`
      SELECT "assinaturaStatus", "assinaturaOrigem" FROM "Workspace" WHERE "id" = ${p.workspaceId}
    ` as { assinaturaStatus: string; assinaturaOrigem: string | null }[]
    if (!w) return { ok: false, erro: 'Workspace não encontrada.', acessoAte: null }
    if (w.assinaturaStatus === 'CANCELADA') return { ok: true, acessoAte: null }   // idempotente
    if (w.assinaturaOrigem === 'hotmart')
      return { ok: false, erro: 'Sua assinatura é gerida pela Hotmart — o cancelamento é feito por lá.', acessoAte: null }
    // CANCELADA sem assinaturaExpira → avaliar() bloqueia o acesso imediatamente (ver index.ts).
    await prisma.$executeRaw`
      UPDATE "Workspace" SET "assinaturaStatus" = 'CANCELADA', "updatedAt" = NOW()
      WHERE "id" = ${p.workspaceId}
    `
    console.log(`[CANCELAR] trial/sem-sub ws=${p.workspaceId} por=${p.por}`)
    await notificarCancelamento(p.workspaceId, null)
    return { ok: true, acessoAte: null }
  }

  // 1) Cancela no Asaas PRIMEIRO. É a fonte da cobrança.
  const r = await chamarAsaas<{ deleted?: boolean; id?: string }>(
    `/subscriptions/${ass.subscriptionId}`, { metodo: 'DELETE' },
  )
  if (!r.ok) {
    console.error(`[CANCELAR] Asaas recusou ws=${p.workspaceId} sub=${ass.subscriptionId}: ${r.erro}`)
    return { ok: false, erro: r.erro || 'Não consegui cancelar no provedor. Tente de novo.', acessoAte: null }
  }

  // 2) Marca aqui, com o rastro de quem e quando.
  await prisma.$executeRaw`
    UPDATE "AsaasAssinatura"
    SET "status" = 'CANCELADA', "canceladaEm" = NOW(),
        "canceladaPor" = ${p.por}, "canceladaMotivo" = ${p.motivo?.slice(0, 300) ?? null},
        "updatedAt" = NOW()
    WHERE "subscriptionId" = ${ass.subscriptionId}
  `

  // 3) A workspace fica CANCELADA, mas `assinaturaExpira` é PRESERVADA — é ela
  //    que sustenta o acesso até o fim do ciclo pago (ver avaliar() em index.ts).
  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "assinaturaStatus" = 'CANCELADA', "updatedAt" = NOW()
    WHERE "id" = ${p.workspaceId} AND "assinaturaOrigem" = 'asaas'
  `

  // 4) Comissão pendente deixa de fazer sentido: não haverá mais pagamento.
  //    A já paga por split fica — aquele dinheiro realmente foi repassado.
  await prisma.$executeRaw`
    UPDATE "ParceiroComissao" SET "status" = 'cancelado'
    WHERE "workspaceId" = ${p.workspaceId} AND "status" = 'pendente'
  `.catch(() => {})

  console.log(`[CANCELAR] ok ws=${p.workspaceId} sub=${ass.subscriptionId} por=${p.por}`)
  await notificarCancelamento(p.workspaceId, ass.assinaturaExpira)
  return { ok: true, acessoAte: ass.assinaturaExpira, subscriptionId: ass.subscriptionId }
}

/** E-mail de confirmação do cancelamento (Resend). Best-effort — nunca derruba o cancelamento. */
async function notificarCancelamento(workspaceId: string, acessoAte: Date | null): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  try {
    const [w] = await prisma.$queryRaw`
      SELECT w."nome" AS "wsNome",
             (SELECT u."email" FROM "User" u WHERE u."workspaceId" = w."id" AND u."role" = 'ADMIN' LIMIT 1) AS "email"
      FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
    ` as { wsNome: string | null; email: string | null }[]
    const email = w?.email
    if (!email) return
    const ate = acessoAte ? new Date(acessoAte).toLocaleDateString('pt-BR') : null
    const linhaAcesso = ate
      ? `Você <strong>continua com acesso até ${ate}</strong> — esse período já estava pago. Depois disso, o acesso é encerrado e <strong>nenhuma nova cobrança</strong> será feita.`
      : `Seu acesso foi encerrado e <strong>nenhuma nova cobrança</strong> será feita.`
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#334155">
        <h2 style="color:#0f172a">Assinatura cancelada</h2>
        <p>Olá! Confirmamos o cancelamento da assinatura de <strong>${(w?.wsNome || 'sua conta').toString()}</strong> no SOA.</p>
        <p>${linhaAcesso}</p>
        <p><strong>Seus dados ficam salvos</strong> — se um dia quiser voltar, é só reativar pela tela de assinatura, do jeitinho que estava.</p>
        <p style="color:#64748b;font-size:13px">Se você não pediu esse cancelamento, fale com a gente respondendo este e-mail.</p>
        <p style="color:#94a3b8;font-size:12px">Com carinho, equipe SOA 🧡</p>
      </div>`
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SOA <suporte@vps-gestao.com.br>', to: [email], subject: 'Sua assinatura foi cancelada — SOA', html }),
    })
    if (!r.ok) console.error(`[CANCELAR] Resend ${r.status}`)
  } catch (e) { console.error('[CANCELAR] email:', (e as Error)?.message) }
}
