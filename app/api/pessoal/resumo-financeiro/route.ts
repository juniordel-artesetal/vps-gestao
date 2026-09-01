// Resumo do mês para o dash do MÓDULO PESSOAL — 100% do FINANCEIRO PESSOAL (nunca o ateliê).
// Lê PessoalLancamento por userId (escopo privado do add-on), mês corrente:
//   prevista = SUM(valor) de todos os status do mês; efetuada = status='PAGO'; falta = prevista − efetuada.
//   RESERVA/RESGATE (caixinhas) ficam de FORA (só entram no saldo de caixa, não no resultado).
// Gate: guardPessoal (ADMIN + add-on Pessoal ATIVA).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal()
  if ('erro' in g) return g.erro
  const u = g.userId
  const { searchParams } = new URL(req.url)
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))

  const [r] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN "tipo"='RECEITA' THEN "valor" ELSE 0 END),0)::float AS "receitaPrevista",
      COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS "receitaEfetuada",
      COALESCE(SUM(CASE WHEN "tipo"='DESPESA' THEN "valor" ELSE 0 END),0)::float AS "despesaPrevista",
      COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS "despesaEfetuada",
      COUNT(*) FILTER (WHERE "tipo" IN ('RECEITA','DESPESA'))::int AS "total"
    FROM "PessoalLancamento"
    WHERE "userId" = ${u}
      AND EXTRACT(YEAR FROM "data") = ${ano} AND EXTRACT(MONTH FROM "data") = ${mes}
  ` as any[]

  const num = (v: any) => Math.round((Number(v) || 0) * 100) / 100
  const rp = num(r?.receitaPrevista), re = num(r?.receitaEfetuada)
  const dp = num(r?.despesaPrevista), de = num(r?.despesaEfetuada)

  return NextResponse.json(serialize({
    ano, mes, total: Number(r?.total || 0),
    receita: { prevista: rp, efetuada: re, falta: Math.max(0, num(rp - re)) },
    despesa: { prevista: dp, efetuada: de, falta: Math.max(0, num(dp - de)) },
  }))
}
