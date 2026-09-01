// Resumo financeiro do ATELIÊ (mês corrente) para o dash do Módulo Pessoal.
// Lê FinLancamento por workspaceId — a MESMA regra do fluxo do Financeiro:
//   realizado = COALESCE(valorRealizado, valor) em status IN (PAGO, PARCIAL);
//   previsto  = SUM(valor) de todos os status do mês; falta = previsto − efetuado.
// Gate: guardPessoal (ADMIN + add-on Pessoal ATIVA). O dado é do ateliê (workspace),
// não da tabela pessoal — por isso o título deixa claro "do ateliê".
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal()
  if ('erro' in g) return g.erro
  const session = await getServerSession(authOptions)
  const workspaceId = session!.user.workspaceId
  const { searchParams } = new URL(req.url)
  const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
  const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))

  const [r] = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='RECEITA' THEN valor ELSE 0 END),0)::float AS "receitaPrevista",
      COALESCE(SUM(CASE WHEN tipo='RECEITA' AND status IN ('PAGO','PARCIAL') THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS "receitaEfetuada",
      COALESCE(SUM(CASE WHEN tipo='DESPESA' THEN valor ELSE 0 END),0)::float AS "despesaPrevista",
      COALESCE(SUM(CASE WHEN tipo='DESPESA' AND status IN ('PAGO','PARCIAL') THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS "despesaEfetuada",
      COUNT(*)::int AS "total"
    FROM "FinLancamento"
    WHERE "workspaceId" = ${workspaceId}
      AND EXTRACT(YEAR FROM data) = ${ano} AND EXTRACT(MONTH FROM data) = ${mes}
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
