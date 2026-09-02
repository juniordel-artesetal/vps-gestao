// Um lançamento pessoal: GET / PUT (editar, incl. marcar PAGO) / DELETE (com recorrência). Escopo por userId.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, parseNum, parseData } from '@/lib/pessoal/api'
import { normalizarImagemEntrada } from '@/lib/pessoal/imagem'
import { reconciliarMovCaixinha, limparMovCaixinhaDoLancamento } from '@/lib/pessoal/caixinhaSync'
import { sincronizarVinculoPessoal, removerVinculoPessoal, concluirVinculoPessoal } from '@/lib/pessoal/financeiroVinculo'

export const dynamic = 'force-dynamic'
const ORIGEM_PESSOAL = 'financeiro_pessoal'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const [row] = await prisma.$queryRaw`
    SELECT "id","tipo","categoriaId","contaId","caixinhaId","descricao","valor"::float AS valor,"data","metodo","referencia",
           "observacoes","status","recorrenciaId","recorrencia","parcela","totalParcelas",
           ("comprovante" IS NOT NULL) AS "temComprovante"
    FROM "PessoalLancamento" WHERE "id" = ${id} AND "userId" = ${g.userId} LIMIT 1
  ` as any[]
  if (!row) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(serialize(row))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const b = await req.json().catch(() => ({}))

  // Patch leve: só alternar status (marcar pago/pendente).
  if (b?.descricao === undefined && b?.valor === undefined && b?.status !== undefined && b?.comprovante === undefined) {
    const st = b.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO'
    await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "status" = ${st} WHERE "id" = ${id} AND "userId" = ${g.userId}`
    // Dar baixa reflete na agenda: paga → tarefa CONCLUIDA; reabrir → PENDENTE.
    await concluirVinculoPessoal(g.userId, id, st === 'PAGO', ORIGEM_PESSOAL)
    return NextResponse.json({ ok: true })
  }

  // Patch de comprovante isolado (anexar/remover sem reeditar o resto).
  if (b?.descricao === undefined && b?.valor === undefined && b?.comprovante !== undefined) {
    let comp: string | null
    try { comp = (normalizarImagemEntrada(b.comprovante) ?? null) as string | null }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
    await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "comprovante" = ${comp} WHERE "id" = ${id} AND "userId" = ${g.userId}`
    return NextResponse.json({ ok: true })
  }

  const descricao = String(b?.descricao ?? '').trim()
  const valor = parseNum(b?.valor)
  const data = parseData(b?.data)
  if (!descricao || valor <= 0 || !data) return NextResponse.json({ error: 'Informe descrição, valor e data.' }, { status: 400 })

  const METODOS = ['PIX', 'CARTAO', 'DINHEIRO', 'BOLETO', 'TED']
  const metodo = METODOS.includes(String(b?.metodo || '').toUpperCase()) ? String(b.metodo).toUpperCase() : null
  const tipo = b?.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA'
  const caixinhaId = b?.caixinhaId || null
  const contaId = b?.contaId || null
  await prisma.$executeRaw`
    UPDATE "PessoalLancamento" SET
      "tipo" = ${tipo},
      "categoriaId" = ${b?.categoriaId || null}, "contaId" = ${contaId}, "caixinhaId" = ${caixinhaId}, "metodo" = ${metodo},
      "descricao" = ${descricao}, "valor" = ${valor}, "data" = ${data}::date,
      "referencia" = ${b?.referencia || null}, "observacoes" = ${b?.observacoes || null},
      "status" = ${b?.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO'}
    WHERE "id" = ${id} AND "userId" = ${g.userId}
  `
  // Reconcilia o movimento da caixinha conforme o estado novo (consistência ao editar).
  await reconciliarMovCaixinha(g.userId, id, { tipo, valor, caixinhaId, contaId, data, descricao })
  // Reflete a flag "levar para minha agenda" (só quando o form envia agenda/nota).
  if (b?.agenda !== undefined || b?.nota !== undefined) {
    const lembreteDias = (b?.lembreteDias === '' || b?.lembreteDias == null) ? null : Number(b.lembreteDias)
    await sincronizarVinculoPessoal({ userId: g.userId, lancamentoId: id, descricao, valor, data, tipo, agenda: !!b?.agenda, nota: !!b?.nota, origemTipo: ORIGEM_PESSOAL, lembreteDias, pago: (b?.status === 'PENDENTE' ? false : true) })
  }
  if (b?.comprovante !== undefined) {
    let comp: string | null
    try { comp = (normalizarImagemEntrada(b.comprovante) ?? null) as string | null }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
    await prisma.$executeRaw`UPDATE "PessoalLancamento" SET "comprovante" = ${comp} WHERE "id" = ${id} AND "userId" = ${g.userId}`
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const { id } = await params
  const sp = new URL(req.url).searchParams
  const futuros = sp.get('deletarFuturos') === 'true'
  const todos = sp.get('deletarTodos') === 'true'

  if (futuros || todos) {
    const [l] = await prisma.$queryRaw`SELECT "recorrenciaId","data" FROM "PessoalLancamento" WHERE "id" = ${id} AND "userId" = ${g.userId} LIMIT 1` as any[]
    if (l?.recorrenciaId) {
      // Reverte movimentos de caixinha de todas as parcelas afetadas antes de apagar.
      const alvos = todos
        ? await prisma.$queryRaw`SELECT "id" FROM "PessoalLancamento" WHERE "userId" = ${g.userId} AND "recorrenciaId" = ${l.recorrenciaId}` as { id: string }[]
        : await prisma.$queryRaw`SELECT "id" FROM "PessoalLancamento" WHERE "userId" = ${g.userId} AND "recorrenciaId" = ${l.recorrenciaId} AND "data" >= ${l.data} AND ("status" = 'PENDENTE' OR "id" = ${id})` as { id: string }[]
      for (const a of alvos) { await limparMovCaixinhaDoLancamento(g.userId, a.id); await removerVinculoPessoal(g.userId, a.id, ORIGEM_PESSOAL) }
      if (todos) await prisma.$executeRaw`DELETE FROM "PessoalLancamento" WHERE "userId" = ${g.userId} AND "recorrenciaId" = ${l.recorrenciaId}`
      else await prisma.$executeRaw`DELETE FROM "PessoalLancamento" WHERE "userId" = ${g.userId} AND "recorrenciaId" = ${l.recorrenciaId} AND "data" >= ${l.data} AND ("status" = 'PENDENTE' OR "id" = ${id})`
      return NextResponse.json({ ok: true })
    }
  }
  await limparMovCaixinhaDoLancamento(g.userId, id)
  await removerVinculoPessoal(g.userId, id, ORIGEM_PESSOAL)
  await prisma.$executeRaw`DELETE FROM "PessoalLancamento" WHERE "id" = ${id} AND "userId" = ${g.userId}`
  return NextResponse.json({ ok: true })
}
