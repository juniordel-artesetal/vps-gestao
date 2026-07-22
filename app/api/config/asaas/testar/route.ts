import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serialize } from '@/lib/serialize'
import { testarConexao, getConfigPublica } from '@/lib/pagamento/asaas'

export const dynamic = 'force-dynamic'

async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// POST — valida a credencial contra o ambiente configurado (só LEITURA no Asaas:
// GET /wallets + GET /myAccount/commercialInfo; não cria nada).
// Roda mesmo com o módulo desligado — é o passo que permite ligá-lo com segurança.
export async function POST() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const r = await testarConexao()
    return NextResponse.json({
      ok: r.ok,
      erro: r.erro ?? null,
      dados: r.dados ?? null,
      config: serialize(await getConfigPublica()),
    })
  } catch (e) {
    console.error('[ASAAS-TESTAR]', (e as Error)?.message)
    return NextResponse.json({ ok: false, erro: 'Falha ao testar a conexão.' }, { status: 500 })
  }
}
