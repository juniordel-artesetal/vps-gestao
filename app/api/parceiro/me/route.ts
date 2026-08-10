import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { getParceiroSessao } from '@/lib/parceiros/auth'

export const dynamic = 'force-dynamic'

// GET — dados do portal do parceiro logado: perfil (cupom/link/regra), leads e comissões.
// ISOLAMENTO: só os dados do PRÓPRIO parceiro. Telefone/e-mail dos leads mascarados.
function mascararTel(t: string | null) {
  const d = String(t || '').replace(/\D/g, '')
  if (d.length < 6) return '—'
  return `(${d.slice(0, 2)}) •••••-${d.slice(-4)}`
}
function mascararEmail(e: string | null) {
  const s = String(e || '')
  if (!s.includes('@')) return '—'
  const [u, dom] = s.split('@')
  return `${u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•••'}@${dom}`
}

export async function GET() {
  try {
    const parceiroId = await getParceiroSessao()
    if (!parceiroId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [parceiro] = await prisma.$queryRaw`
      SELECT "id","tipo","nome","email","contato","ativo","cupom","linkSlug",
             "comissaoPercAnual"::float AS "comissaoPercAnual",
             "comissaoPercMensal"::float AS "comissaoPercMensal",
             "comissaoRecorrente","walletId"
      FROM "Parceiro" WHERE "id" = ${parceiroId} LIMIT 1
    ` as any[]
    if (!parceiro) return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 })

    const leads = await prisma.$queryRaw`
      SELECT "id","nome","email","telefone","tipoAtribuicao","status",
             TO_CHAR("createdAt",'YYYY-MM-DD') AS "createdAt"
      FROM "Lead" WHERE "parceiroId" = ${parceiroId}
      ORDER BY "createdAt" DESC LIMIT 500
    ` as any[]

    const comissoes = parceiro.tipo === 'influencer'
      ? await prisma.$queryRaw`
          SELECT "id","competencia","base"::float AS "base","percentual"::float AS "percentual",
                 "valor"::float AS "valor","status",
                 TO_CHAR("createdAt",'YYYY-MM-DD') AS "createdAt"
          FROM "ParceiroComissao" WHERE "parceiroId" = ${parceiroId}
          ORDER BY "createdAt" DESC LIMIT 500
        ` as any[]
      : []

    const totalPendente = comissoes.filter((c: any) => c.status === 'pendente').reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0)
    const totalPago = comissoes.filter((c: any) => c.status === 'pago').reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0)

    return NextResponse.json(serialize({
      parceiro: {
        tipo: parceiro.tipo, nome: parceiro.nome, cupom: parceiro.cupom, linkSlug: parceiro.linkSlug,
        comissaoPercAnual: parceiro.comissaoPercAnual, comissaoPercMensal: parceiro.comissaoPercMensal,
        comissaoRecorrente: parceiro.comissaoRecorrente, temWallet: !!parceiro.walletId,
      },
      leads: leads.map((l: any) => ({
        id: l.id, nome: l.nome, tipoAtribuicao: l.tipoAtribuicao, status: l.status, createdAt: l.createdAt,
        telefoneMascarado: mascararTel(l.telefone), emailMascarado: mascararEmail(l.email),
      })),
      comissoes, resumo: { totalPendente, totalPago, leads: leads.length },
    }))
  } catch (error) {
    console.error('[PARCEIRO] me:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
