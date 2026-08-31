// Cadastro PÚBLICO de influenciadora (sem login, sem portão de pagamento). Gateado por
// INFLUENCIADORAS_ATIVO. Cria workspace + user + parceira pendente, TRIAL 14d. RAW only.
import { NextRequest, NextResponse } from 'next/server'
import { influenciadorasAtivo, cadastrarInfluenciadora } from '@/lib/influenciadora'
import { ehSegmentoValido } from '@/lib/segmentos'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!influenciadorasAtivo()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })

  const b = await req.json().catch(() => ({}))
  // honeypot simples (bot preenche): responde ok sem criar nada.
  if (String(b?.website || '').trim()) return NextResponse.json({ ok: true })

  try {
    const r = await cadastrarInfluenciadora({
      nome: b?.nome, email: b?.email, senha: b?.senha, whatsapp: b?.telefone || b?.whatsapp,
      instagram: b?.instagram, nomeNegocio: b?.nomeNegocio, segmento: b?.segmento, conviteCampanha: b?.conviteCampanha,
      aceite: b?.aceite === true,
    }, ehSegmentoValido)
    if (!r.ok) return NextResponse.json({ error: r.erro, jaTemConta: !!r.jaTemConta }, { status: r.jaTemConta ? 409 : 400 })
    return NextResponse.json({ ok: true, workspaceId: r.workspaceId, cupom: r.cupom })
  } catch (e) {
    console.error('[INFLU cadastrar]', (e as Error)?.message)
    return NextResponse.json({ error: 'Erro ao criar conta. Tente de novo.' }, { status: 500 })
  }
}
