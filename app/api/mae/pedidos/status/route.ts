// Método MAE — STATUS dos pedidos depois de gerar (Lote 7, itens 119/120). "Gerar não é imprimir":
//  POST { ids, acao: 'iniciar_impressao' | 'impresso' | 'gerado' } → cada pedido vai para o seu destino (etapa de
//  Impressão do SOA ou status interno do MAE avulso). Nunca volta etapa e nunca conclui a Expedição.
//  GET → a etapa de Impressão do fluxo (null = o ateliê não tem; a tela oferece criar).
//  PUT → cria a etapa "Impressão" antes da Expedição (só ADMIN; a posição se muda em Configurações → Produção).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { contaMae, lerJson, recusa } from '@/lib/mae/servidor/acesso'
import { planoMae } from '@/lib/mae/servidor/plano'
import { aplicarStatus, type AcaoStatus } from '@/lib/mae/servidor/destinos'
import { etapaImpressaoDo, garantirEtapaImpressao } from '@/lib/producao/etapaImpressao'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await contaMae({ addon: 'massa' }); if (c instanceof NextResponse) return c
  try {
    const plano = await planoMae(c.workspaceId)
    return NextResponse.json({ plano, etapa: plano === 'soa' ? await etapaImpressaoDo(c.workspaceId) : null })
  } catch (e) {
    console.error('[MAE STATUS GET]', e)
    return NextResponse.json({ error: 'Erro ao ler a etapa de impressão' }, { status: 500 })
  }
}

export async function PUT() {
  const c = await contaMae({ addon: 'massa' }); if (c instanceof NextResponse) return c
  const session = await getServerSession(authOptions)
  if (session?.user.role !== 'ADMIN') return recusa('pedidos/status', { error: 'Só a administradora cria etapas do fluxo' }, 403)
  if ((await planoMae(c.workspaceId)) !== 'soa') return recusa('pedidos/status', { error: 'Sem produção do SOA neste plano' }, 400)
  try {
    return NextResponse.json(await garantirEtapaImpressao(c.workspaceId))
  } catch (e) {
    console.error('[MAE STATUS PUT]', e)
    return NextResponse.json({ error: 'Erro ao criar a etapa de impressão' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const c = await contaMae({ addon: 'massa' }); if (c instanceof NextResponse) return c
  let ids: string[], acao: AcaoStatus
  try {
    const b = await lerJson(req, 100_000) as { ids?: unknown; acao?: unknown }
    ids = (Array.isArray(b.ids) ? b.ids : []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80).slice(0, 500)
    acao = b.acao as AcaoStatus
    if (!ids.length || !['gerado', 'iniciar_impressao', 'impresso'].includes(acao)) return recusa('pedidos/status', { error: 'ids e acao obrigatórios' }, 400)
  } catch { return recusa('pedidos/status', { error: 'JSON inválido' }, 400) }
  try {
    const session = await getServerSession(authOptions)
    const resumo = await aplicarStatus(c.workspaceId, ids, acao, session?.user.name ?? 'MAE')
    return NextResponse.json({ ok: true, resumo })
  } catch (e) {
    console.error('[MAE STATUS POST]', e)
    return NextResponse.json({ error: 'Erro ao atualizar o status' }, { status: 500 })
  }
}
