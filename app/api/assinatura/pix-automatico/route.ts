// Cria a autorização Pix Automático (recorrência via Pix sem cartão) para a assinatura do SOA.
// Valor do plano é definido no SERVIDOR (nunca vem do cliente). Retorna o QR/copia-e-cola do 1º pagamento.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANOS } from '@/lib/assinatura/planos'
import { criarAutorizacaoPixAuto } from '@/lib/pagamento/asaas/pixAutomatico'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId

  const b = await req.json().catch(() => ({}))
  const cpfCnpj = String(b?.cpfCnpj || '').replace(/\D/g, '')
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    return NextResponse.json({ error: 'Informe um CPF ou CNPJ válido' }, { status: 400 })
  }

  // Nome/e-mail para o cadastro do cliente no Asaas (da sessão/workspace).
  const nome = session.user.name || session.user.workspaceNome || 'Cliente SOA'
  const email = session.user.email || ''
  if (!email) return NextResponse.json({ error: 'Sua conta está sem e-mail — atualize antes de assinar' }, { status: 400 })

  // Pix Automático = recorrência MENSAL. Valor do servidor (não confiar no cliente).
  const valor = PLANOS.mensal.valor

  const r = await criarAutorizacaoPixAuto(workspaceId, { valor, nome, email, cpfCnpj, descricao: 'Assinatura SOA — plano mensal (Pix Automático)' })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Não foi possível iniciar o Pix Automático' }, { status: 502 })

  return NextResponse.json({
    ok: true,
    authorizationId: r.authorizationId,
    payload: r.payload,           // Pix copia-e-cola do 1º pagamento
    encodedImage: r.encodedImage, // QR Code (PNG base64)
    valor,
  })
}
