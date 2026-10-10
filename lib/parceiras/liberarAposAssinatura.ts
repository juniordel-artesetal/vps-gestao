// Parceria CONDICIONADA à assinatura (chamado Lavinia, VPS-20261001-UY3X): a artesã pede o link de indicação com
// a conta suspensa/inadimplente. A parceria nasce PENDENTE com a marca aprovadoPor='aguardando_assinatura' (o CHECK
// do status só aceita pendente/aprovada/recusada — sem DDL) e ativo=false — o link
// /r/<código> não funciona (parceiroPorSlug exige ativo) — e é liberada AQUI quando a assinatura do ateliê dela fica
// ATIVA (webhook do Asaas, pagamento confirmado). Idempotente: só age na pendente com a marca. Nunca lança.
import { prisma } from '@/lib/prisma'
import { enviarEmailParceira } from '@/lib/parceiras/emails'

export const PARCERIA_AGUARDANDO_ASSINATURA = 'aguardando_assinatura'

const primeiroNome = (n: string | null | undefined) => (String(n || '').trim().split(/\s+/)[0] || 'tudo bem')

export async function liberarParceriaAposAssinatura(workspaceId: string): Promise<number> {
  try {
    const liberadas = await prisma.$queryRaw`
      UPDATE "Parceiro" p
      SET "status" = 'aprovada', "ativo" = true, "aprovadoEm" = NOW(), "aprovadoPor" = 'auto: assinatura ativa'
      FROM "User" u
      WHERE u."id" = p."userId" AND u."workspaceId" = ${workspaceId}
        AND p."status" = 'pendente' AND p."aprovadoPor" = ${PARCERIA_AGUARDANDO_ASSINATURA} AND p."cupom" IS NOT NULL
      RETURNING p."id", p."nome", p."email", p."cupom"
    ` as { id: string; nome: string | null; email: string | null; cupom: string }[]
    for (const p of liberadas) {
      console.log(`[PARCEIRA] liberada após assinatura ativa id=${p.id} codigo=${p.cupom} ws=${workspaceId}`)
      if (!p.email) continue
      await enviarEmailParceira(p.email, '🎉 Seu link de indicação do SOA está liberado!', `Oi, ${primeiroNome(p.nome)}! 💛

Sua assinatura do SOA está ativa de novo — e, como combinado, o seu link de indicação já está liberado:

👉 usesoa.com.br/r/${p.cupom}
Seu cupom: ${p.cupom}

É só mandar o link pra sua amiga (ou pedir pra ela digitar o cupom no cadastro). A cada mensalidade que ela pagar, você ganha comissão: 30% no plano mensal e 40% no anual.

Pra acompanhar as indicações e cadastrar a sua conta Asaas (é por ela que a comissão cai direto pra você), entre no SOA com o seu login de sempre e abra "Gestão de Indicação" em Módulos — ou acesse usesoa.com.br/parceira.

As regras do programa estão em usesoa.com.br/parceiras/termos.

Qualquer dúvida, é só responder este e-mail.

Com carinho,
Equipe SOA`).catch(e => console.error('[PARCEIRA] e-mail de liberação:', (e as Error)?.message))
    }
    return liberadas.length
  } catch (e) {
    console.error('[PARCEIRA] liberarParceriaAposAssinatura:', (e as Error)?.message)
    return 0
  }
}
