import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serialize } from '@/lib/serialize'
import { cotar } from '@/lib/logistica'
import { getConfigPublica, moduloPostagemAtivo } from '@/lib/logistica/config'

export const dynamic = 'force-dynamic'

// POST — cotação de frete reutilizável (orçamento, pedido, expedição).
// body: { cepDestino, peso?, valor?, altura?, largura?, comprimento?, quantidade?, cepOrigem? }
// Origem: usa o cepOrigem do remetente configurado (ou o enviado). Nunca expõe token.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId

    if (!await moduloPostagemAtivo(workspaceId))
      return NextResponse.json({ error: 'Módulo de Postagem desativado' }, { status: 403 })

    const b = await req.json().catch(() => ({}))
    const cepDestino = String(b.cepDestino || '').replace(/\D/g, '')
    if (cepDestino.length !== 8) return NextResponse.json({ error: 'CEP de destino inválido' }, { status: 400 })

    const cfg = await getConfigPublica(workspaceId)
    const cepOrigem = String(b.cepOrigem || cfg?.cepOrigem || '').replace(/\D/g, '')
    if (cepOrigem.length !== 8) return NextResponse.json({ error: 'Configure o CEP de origem (remetente) em Configurações → Postagem' }, { status: 400 })
    if (!cfg?.conectado) return NextResponse.json({ error: 'Conecte a conta de transportadora (Melhor Envio) em Configurações → Postagem' }, { status: 400 })

    const pacote = {
      peso: Number(b.peso) || 0.3,
      altura: Number(b.altura) || undefined,
      largura: Number(b.largura) || undefined,
      comprimento: Number(b.comprimento) || undefined,
      valorSegurado: Number(b.valor) || 0,
      quantidade: Number(b.quantidade) || 1,
    }

    const r = await cotar(workspaceId, cepOrigem, cepDestino, [pacote])
    if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha na cotação' }, { status: 400 })

    // Só serviços sem erro, ordenados por preço
    const opcoes = r.opcoes.filter(o => !o.erro).sort((a, b2) => a.preco - b2.preco)
    return NextResponse.json(serialize({ opcoes }))
  } catch (error) {
    console.error('[LOGISTICA] cotar:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
