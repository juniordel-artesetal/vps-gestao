// Verifica o domínio próprio (clique manual ou polling da tela). ADMIN, workspace da sessão.
// A lógica de verificar+ativar+notificar vive em lib/lojaDominioVerificar (compartilhada com o cron).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verificarEAtivarDominio } from '@/lib/lojaDominioVerificar'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const r = await verificarEAtivarDominio(session.user.workspaceId)
    if (!r) return NextResponse.json({ error: 'Nenhum domínio cadastrado.' }, { status: 404 })
    return NextResponse.json(serialize(r))
  } catch (e: any) {
    if (e?.message === 'CONFIG_VERCEL_AUSENTE') return NextResponse.json({ error: 'Recurso não habilitado. Fale com o suporte.' }, { status: 503 })
    console.error('[LOJA-DOMINIO verificar]', e?.message)
    return NextResponse.json({ error: 'Não foi possível verificar agora. Tente em instantes.' }, { status: 502 })
  }
}
