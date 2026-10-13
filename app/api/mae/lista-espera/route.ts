// LISTA DE ESPERA do Método Mãe — público (landing), enquanto a venda não abre (MAE_VENDA_ATIVO off).
// Idempotente: o mesmo e-mail no mesmo plano não duplica (UNIQUE email+plano). Campo "site" = armadilha de robô.
import { recusa } from '@/lib/mae/servidor/acesso'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRetry } from '@/lib/dbRetry'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: Request) {
  let corpo: { email?: unknown; nome?: unknown; plano?: unknown; site?: unknown }
  try { corpo = await req.json() } catch { return recusa('lista-espera', { error: 'Dados inválidos' }, 400) }
  // robô preencheu o campo escondido: responde ok sem gravar
  if (corpo.site) return NextResponse.json({ ok: true })
  const email = String(corpo.email ?? '').trim().toLowerCase().slice(0, 200)
  const nome = String(corpo.nome ?? '').trim().slice(0, 120) || null
  const plano = corpo.plano === 'standalone' ? 'standalone' : 'addon'
  if (!EMAIL.test(email)) return recusa('lista-espera', { error: 'Confira o e-mail.' }, 400)
  try {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await withRetry(() => prisma.$executeRaw`
      INSERT INTO "MaeListaEspera" ("id", "email", "nome", "plano", "origem")
      VALUES (${id}, ${email}, ${nome}, ${plano}, 'landing')
      ON CONFLICT ("email", "plano") DO NOTHING`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE LISTA ESPERA]', e)
    return NextResponse.json({ error: 'Não consegui guardar agora. Tente de novo em instantes.' }, { status: 500 })
  }
}
