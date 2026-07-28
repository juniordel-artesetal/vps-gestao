// Status da migração da ARTESÃ logada — alimenta o pop-up guiado. Read-only, por
// e-mail da sessão. Só aparece para quem está na campanha (os 130) e não migrou.
// Gate: CAMPANHA_POPUP_ATIVO=on (fica off até a página /migrar existir).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ativo = String(process.env.CAMPANHA_POPUP_ATIVO || '').toLowerCase() === 'on'
  if (!ativo) return NextResponse.json({ ativo: false, naCampanha: false })
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ ativo: true, naCampanha: false })

  const [r] = await prisma.$queryRaw`
    SELECT "estado", "assinouAsaas", "hotmartCancelada", "primeiroNome"
    FROM "CampanhaMigracao" WHERE lower("email") = ${email} LIMIT 1
  ` as { estado: string; assinouAsaas: boolean; hotmartCancelada: boolean; primeiroNome: string | null }[]
  if (!r || r.estado === 'migrada' || r.estado === 'optout') {
    return NextResponse.json({ ativo: true, naCampanha: false, migrada: r?.estado === 'migrada' })
  }
  return NextResponse.json({
    ativo: true, naCampanha: true,
    primeiroNome: (r.primeiroNome || '').split(/\s+/)[0] || null,
    passo1Ok: r.hotmartCancelada === true, // cancelou na Hotmart
    passo2Ok: r.assinouAsaas === true,     // assinou no Asaas
    estado: r.estado,
  })
}
