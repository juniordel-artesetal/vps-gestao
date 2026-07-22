import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { serialize } from '@/lib/serialize'
import { getConfigPublica, salvarCredenciais, desconectar } from '@/lib/pagamento/asaas'

export const dynamic = 'force-dynamic'

// Asaas é PLATAFORMA (assinaturas + payout de comissões) → gerido pelo MASTER,
// não por workspace. Por isso master_token e não getServerSession.
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — status da conexão. NUNCA devolve API key nem token de webhook em claro,
// só flags de presença (temApiKey / temWebhookToken).
export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  return NextResponse.json(serialize(await getConfigPublica()))
}

// PUT — salva credenciais e flags. body: { apiKey?, webhookToken?, sandbox?, ativo?, gerarWebhookToken? }
//
// `gerarWebhookToken: true` devolve o token gerado UMA ÚNICA VEZ, para o Júnior copiar
// e colar no painel do Asaas. Depois disso ele só existe criptografado no banco —
// nenhum GET posterior o expõe.
export async function PUT(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => ({}))

  const tokenGerado = b.gerarWebhookToken ? randomBytes(32).toString('base64url') : null

  await salvarCredenciais({
    apiKey: b.apiKey ? String(b.apiKey).trim() : undefined,
    webhookToken: tokenGerado ?? (b.webhookToken ? String(b.webhookToken).trim() : undefined),
    sandbox: b.sandbox === undefined ? undefined : b.sandbox !== false,
    ativo: b.ativo === undefined ? undefined : !!b.ativo,
    walletIdPlataforma: b.walletIdPlataforma ? String(b.walletIdPlataforma).trim() : undefined,
  })

  return NextResponse.json({
    ok: true,
    config: serialize(await getConfigPublica()),
    // única exposição do token — some depois desta resposta
    ...(tokenGerado ? { webhookToken: tokenGerado } : {}),
  })
}

// DELETE — desconecta e apaga as credenciais.
export async function DELETE() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await desconectar()
  return NextResponse.json({ ok: true, config: serialize(await getConfigPublica()) })
}
