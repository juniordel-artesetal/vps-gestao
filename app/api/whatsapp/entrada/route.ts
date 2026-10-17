// Mensagens que CHEGAM no número do SOA (o serviço companheiro repassa — ver servicos/whatsapp). Hoje só trata o
// OPT-OUT: "PARAR" (sair, stop…) grava em WhatsappOptOut e a pessoa não recebe mais nada por WhatsApp. O resto fica para
// a fase 2 (suporte em duas vias). Protegida pelo segredo do serviço (x-ws-secret = WHATSAPP_SERVICE_SECRET).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chaveTelefone, ehPedidoDeSaida } from '@/lib/whatsapp/mensagens'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const s = process.env.WHATSAPP_SERVICE_SECRET
  if (!s || req.headers.get('x-ws-secret') !== s) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { de?: string; texto?: string }
  if (!ehPedidoDeSaida(b.texto)) return NextResponse.json({ ok: true, acao: 'nenhuma' })
  const chave = chaveTelefone(b.de)
  if (!chave) return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
  try {
    // a conta dona do número (se achar) — só para referência; o opt-out vale pelo NÚMERO
    // mesma regra do chaveTelefone(): só dígitos; tira o 55 se tiver 12+ dígitos; tira zeros da frente; DDD + 8 últimos
    const [w] = await prisma.$queryRaw<{ id: string }[]>`
      WITH d AS (SELECT "id", regexp_replace(COALESCE("whatsapp",''), '[^0-9]', '', 'g') AS n FROM "Workspace" WHERE COALESCE("whatsapp",'') <> ''),
           e AS (SELECT "id", ltrim(CASE WHEN n LIKE '55%' AND length(n) >= 12 THEN substr(n, 3) ELSE n END, '0') AS n FROM d)
      SELECT "id" FROM e WHERE length(n) >= 10 AND left(n, 2) || right(n, 8) = ${chave} LIMIT 1`.catch(() => [])
    await prisma.$executeRaw`
      INSERT INTO "WhatsappOptOut" ("chave","workspaceId","origem","criadoEm") VALUES (${chave}, ${w?.id ?? null}, 'PARAR', NOW())
      ON CONFLICT ("chave") DO NOTHING`
    console.log('[WHATSAPP] opt-out registrado')
    return NextResponse.json({ ok: true, acao: 'optout', resposta: 'Pronto! Você não vai mais receber lembretes por aqui. Se mudar de ideia, é só falar com a gente. 💛' })
  } catch (e) {
    console.error('[WHATSAPP ENTRADA]', (e as Error).message)
    return NextResponse.json({ error: 'Erro ao registrar' }, { status: 500 })
  }
}
