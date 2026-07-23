// Auto-cadastro de parceira — PÚBLICO (sem sessão). Gate por PARCEIRAS_ATIVO.
//   GET  ?codigo=XXX  → { disponivel } (validação em tempo real)
//   POST { nome,email,senha,walletId,codigo } → cria Parceiro pendente
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { criarCandidatura, codigoDisponivel, codigoValido, normalizarCodigo } from '@/lib/parceiras/candidatura'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  const codigo = normalizarCodigo(new URL(req.url).searchParams.get('codigo') || '')
  if (!codigoValido(codigo)) return NextResponse.json({ valido: false, disponivel: false })
  return NextResponse.json({ valido: true, disponivel: await codigoDisponivel(codigo) })
}

export async function POST(req: NextRequest) {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })

  // Flood-cap básico (global, DB-backed — funciona em serverless): no máx. 5
  // candidaturas por minuto. Segura enxurrada sem depender de estado por instância.
  const [{ n }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "Parceiro" WHERE "createdAt" > NOW() - INTERVAL '1 minute'
  ` as { n: number }[]
  if (n >= 5) return NextResponse.json({ error: 'Muitas candidaturas agora. Tente em instantes.' }, { status: 429 })

  const b = await req.json().catch(() => ({}))
  const r = await criarCandidatura({ nome: b.nome, email: b.email, senha: b.senha, walletId: b.walletId, codigo: b.codigo })
  if (!r.ok) return NextResponse.json({ error: r.erro, campo: r.campo }, { status: 400 })
  return NextResponse.json({ ok: true })
}
