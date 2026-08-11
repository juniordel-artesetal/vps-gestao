// Inserção em MASSA de lançamentos (várias receitas/despesas de uma vez).
// Prisma raw; escopo por workspaceId; valida cada linha; ignora vazias.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  const body = await req.json().catch(() => ({}))
  const tipo = body.tipo === 'DESPESA' ? 'DESPESA' : 'RECEITA'
  const itens: any[] = Array.isArray(body.itens) ? body.itens : []

  // Só linhas com descrição, valor > 0 e data válida entram.
  const validos = itens
    .map((it) => ({
      descricao: String(it?.descricao ?? '').trim(),
      valor: Number(it?.valor) || 0,
      data: typeof it?.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.data) ? it.data : null,
      categoriaId: it?.categoriaId ? String(it.categoriaId) : null,
      contaId: it?.contaId ? String(it.contaId) : null,
      status: it?.status === 'PAGO' ? 'PAGO' : 'PENDENTE',
    }))
    .filter((it) => it.descricao && it.valor > 0 && it.data)

  if (validos.length === 0)
    return NextResponse.json({ error: 'Preencha ao menos uma linha (descrição, valor e data).' }, { status: 400 })

  let inseridos = 0
  for (const it of validos) {
    const id = gid()
    await prisma.$executeRaw`
      INSERT INTO "FinLancamento"
        ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status","dataRealizada","valorRealizado","contaId","createdAt")
      VALUES
        (${id}, ${workspaceId}, ${tipo}, ${it.categoriaId}, ${it.descricao}, ${it.valor}, ${it.data}::date, ${it.status},
         ${it.status === 'PAGO' ? it.data : null}::date, ${it.status === 'PAGO' ? it.valor : null}, ${it.contaId}, NOW())
    `
    inseridos++
  }

  return NextResponse.json({ ok: true, inseridos, ignorados: itens.length - inseridos })
}
