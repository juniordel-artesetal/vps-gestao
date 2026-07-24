// Onboarding da parceira — completar o cadastro na área dela. Escopo ESTRITO ao
// parceiroId da sessão (onboarding OU parceira aprovada). Gate por PARCEIRAS_ATIVO.
//   GET                → estado { nome, status, temSenha, temCodigo, temWallet, cupom, completo }
//   GET ?codigo=XXX    → { valido, disponivel }  (checagem em tempo real)
//   POST { senha?, codigo? } → grava senha (bcrypt) e/ou código (cupom=linkSlug)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { definirSenhaParceira, definirCodigoParceira, codigoDisponivel, codigoValido, normalizarCodigo } from '@/lib/parceiras/candidatura'

export const dynamic = 'force-dynamic'

async function parceiroDaSessao() {
  const session = await getServerSession(authOptions)
  const parceiroId = (session?.user as any)?.parceiroId
  if (!session || (session.user as any).role !== 'parceira' || !parceiroId) return null
  return parceiroId as string
}

export async function GET(req: NextRequest) {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  const parceiroId = await parceiroDaSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Checagem de disponibilidade de código (exclui a própria parceira).
  const codigoQ = new URL(req.url).searchParams.get('codigo')
  if (codigoQ !== null) {
    const codigo = normalizarCodigo(codigoQ)
    if (!codigoValido(codigo)) return NextResponse.json({ valido: false, disponivel: false })
    return NextResponse.json({ valido: true, disponivel: await codigoDisponivel(codigo, parceiroId) })
  }

  const [p] = await prisma.$queryRaw`
    SELECT "nome","status","cupom","linkSlug",
           ("senhaCripto" IS NOT NULL) AS "temSenha",
           ("walletId" IS NOT NULL AND "walletId" <> '') AS "temWallet"
    FROM "Parceiro" WHERE "id" = ${parceiroId} LIMIT 1
  ` as { nome: string | null; status: string; cupom: string | null; linkSlug: string | null; temSenha: boolean; temWallet: boolean }[]
  if (!p) return NextResponse.json({ error: 'Parceira não encontrada' }, { status: 404 })

  const temCodigo = !!p.cupom
  const completo = p.status === 'aprovada' && p.temSenha && temCodigo
  return NextResponse.json({
    nome: (p.nome || '').split(/\s+/)[0] || 'parceira',
    status: p.status, temSenha: p.temSenha, temCodigo, temWallet: p.temWallet,
    cupom: p.cupom, linkSlug: p.linkSlug, completo,
  })
}

export async function POST(req: NextRequest) {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  const parceiroId = await parceiroDaSessao()
  if (!parceiroId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  if (b.senha !== undefined) {
    const r = await definirSenhaParceira(parceiroId, b.senha)
    if (!r.ok) return NextResponse.json({ error: r.erro, campo: r.campo }, { status: 400 })
  }
  if (b.codigo !== undefined) {
    const r = await definirCodigoParceira(parceiroId, b.codigo)
    if (!r.ok) return NextResponse.json({ error: r.erro, campo: r.campo }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
