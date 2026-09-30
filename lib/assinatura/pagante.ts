// TRAVA ANTI-CORTE-DE-PAGANTE EXTERNO — a última palavra antes de a régua cortar alguém.
//
// A régua só enxerga o Asaas. Quem paga pela HOTMART (assinante antiga, ou migração que não
// cancelou lá) NÃO é devedor, e cortar essa pessoa já aconteceu mais de uma vez (26/08 e 30/09).
// Por isso, antes de cada corte: se a conta tem QUALQUER sinal de Hotmart, pergunta à Hotmart AO
// VIVO (statusSoaPorEmail, só produto SOA). Regras:
//   ATIVA                      → pagante → NÃO corta.
//   ERRO / SEM_CRED (incerto)  → não deu para confirmar → NÃO corta (na dúvida, preserva o acesso).
//   ATRASO / CANCELADA / SEM_ASSINATURA → não paga lá → segue a decisão da régua.
// Sem sinal de Hotmart nenhum → nem chama a API.
import { prisma } from '@/lib/prisma'
import { statusSoaPorEmail } from '@/lib/hotmart'

export interface ConferenciaExterna { protege: boolean; motivo: string; hotmart: string | null }

export async function conferirPaganteExterno(workspaceId: string): Promise<ConferenciaExterna> {
  const [w] = await prisma.$queryRaw`
    SELECT w."hotmartEmail", w."hotmartSubId",
           ARRAY(SELECT lower(u."email") FROM "User" u WHERE u."workspaceId" = w."id" AND u."email" IS NOT NULL) AS emails,
           EXISTS (
             SELECT 1 FROM "HotmartEvent" h
             WHERE h."workspaceId" = w."id"
                OR lower(h."email") IN (SELECT lower(u2."email") FROM "User" u2 WHERE u2."workspaceId" = w."id")
           ) AS "temEvento"
    FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
  ` as { hotmartEmail: string | null; hotmartSubId: string | null; emails: string[]; temEvento: boolean }[]
  if (!w) return { protege: true, motivo: 'workspace não encontrada', hotmart: null }
  if (!w.temEvento && !w.hotmartEmail && !w.hotmartSubId) return { protege: false, motivo: 'sem sinal de Hotmart', hotmart: null }

  const emails = [...new Set([w.hotmartEmail?.toLowerCase(), ...(w.emails || [])].filter(Boolean) as string[])]
  let incerto = false
  for (const e of emails) {
    const st = await statusSoaPorEmail(e)
    if (st === 'ATIVA') return { protege: true, motivo: 'pagante Hotmart ATIVA', hotmart: st }
    if (st === 'ERRO' || st === 'SEM_CRED') incerto = true
  }
  if (incerto) return { protege: true, motivo: 'Hotmart não confirmou (erro/credencial) — na dúvida não corta', hotmart: 'INCERTO' }
  return { protege: false, motivo: 'Hotmart sem assinatura ativa', hotmart: 'NAO_ATIVA' }
}
