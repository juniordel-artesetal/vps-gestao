// Auto-cadastro de parceira — PÚBLICO (sem sessão). Gate por PARCEIRAS_ATIVO.
//   POST { nome, whatsapp, email, instagram } → cria Parceiro pendente (só contato)
//   e emite a SESSÃO DE ONBOARDING (cookie) para ela completar o cadastro em /parceira.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { criarCandidatura } from '@/lib/parceiras/candidatura'
import { cookieSessaoOnboarding } from '@/lib/parceiras/onboarding'
import { notificarNovaParceiraTelegram } from '@/lib/parceiras/notificacoes'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!parceirasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })

  // Flood-cap básico (global, DB-backed — funciona em serverless): no máx. 5
  // candidaturas por minuto. Segura enxurrada sem depender de estado por instância.
  const [{ n }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "Parceiro" WHERE "createdAt" > NOW() - INTERVAL '1 minute'
  ` as { n: number }[]
  if (n >= 5) return NextResponse.json({ error: 'Muitas candidaturas agora. Tente em instantes.' }, { status: 429 })

  const b = await req.json().catch(() => ({}))
  const r = await criarCandidatura({ nome: b.nome, whatsapp: b.whatsapp, email: b.email, instagram: b.instagram })
  if (!r.ok || !r.parceiroId) return NextResponse.json({ error: r.erro, campo: r.campo }, { status: 400 })

  // Avisa a equipe no Telegram — best-effort, nunca derruba a candidatura.
  await notificarNovaParceiraTelegram(r.parceiroId)

  // Emite a sessão de onboarding e devolve — o client redireciona para /parceira.
  const res = NextResponse.json({ ok: true })
  const c = await cookieSessaoOnboarding({ parceiroId: r.parceiroId, nome: b.nome, email: b.email })
  res.cookies.set(c.name, c.value, c.options)
  return res
}
