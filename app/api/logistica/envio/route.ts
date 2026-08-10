import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { comprarEtiqueta, fonteDoCanal, EnderecoLog } from '@/lib/logistica'
import { getConfigPublica, moduloPostagemAtivo } from '@/lib/logistica/config'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// GET — lista envios de um pedido (?orderId=). Nunca traz tokens.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })

    const rows = await prisma.$queryRaw`
      SELECT "id","orderId","fonte","provedor","transportadora","servico",
             "preco"::float AS "preco","prazoDias","provedorEnvioId","etiquetaUrl","rastreio","status",
             TO_CHAR("createdAt",'YYYY-MM-DD"T"HH24:MI:SSOF') AS "createdAt"
      FROM "Envio"
      WHERE "workspaceId" = ${workspaceId} AND "orderId" = ${orderId}
      ORDER BY "createdAt" DESC
    ` as any[]
    return NextResponse.json(serialize(rows))
  } catch (error) {
    console.error('[LOGISTICA] envio GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — cria o envio conforme a FONTE (canal). Transportadora: compra/gera etiqueta.
// Marketplace: registra pendente (etiqueta vem da Integração de Lojas — stub).
// body: { orderId, canal, servicoId?, destinatario{...}, pacote{...}, produtos[] }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId

    if (!await moduloPostagemAtivo(workspaceId))
      return NextResponse.json({ error: 'Módulo de Postagem desativado' }, { status: 403 })

    const b = await req.json().catch(() => ({}))
    const orderId = String(b.orderId || '').trim()
    if (!orderId) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })

    // Confere que o pedido é do workspace (isolamento)
    const [ord] = await prisma.$queryRaw`
      SELECT "id","canal" FROM "Order" WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId} LIMIT 1
    ` as any[]
    if (!ord) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const canal = b.canal ?? ord.canal
    const fonte = fonteDoCanal(canal)
    const id = gerarId()

    // ── MARKETPLACE: etiqueta é do canal (stub até a Integração de Lojas) ──
    if (fonte === 'marketplace') {
      await prisma.$executeRaw`
        INSERT INTO "Envio" ("id","workspaceId","orderId","fonte","provedor","status","createdAt","updatedAt")
        VALUES (${id}, ${workspaceId}, ${orderId}, 'marketplace', ${String(canal || '').toLowerCase() || null}, 'aguardando_integracao', NOW(), NOW())
      `
      return NextResponse.json({
        ok: true, id, fonte, pendente: true,
        mensagem: 'A etiqueta deste canal é emitida pelo próprio marketplace. Ela será puxada automaticamente quando a Integração de Lojas for ativada.',
      })
    }

    // ── TRANSPORTADORA: cotação já escolhida → compra + gera etiqueta ──
    const servicoId = String(b.servicoId || '').trim()
    if (!servicoId) return NextResponse.json({ error: 'Escolha um serviço de frete (cote antes)' }, { status: 400 })

    const cfg = await getConfigPublica(workspaceId)
    if (!cfg?.conectado) return NextResponse.json({ error: 'Conecte a conta de transportadora em Configurações → Postagem' }, { status: 400 })
    if (!cfg.cepOrigem) return NextResponse.json({ error: 'Configure o remetente (CEP de origem)' }, { status: 400 })

    const remetente: EnderecoLog = {
      cep: cfg.cepOrigem, nome: cfg.remetenteNome, documento: cfg.remetenteDoc,
      logradouro: cfg.logradouroOrigem, numero: cfg.numeroOrigem, bairro: cfg.bairroOrigem,
      cidade: cfg.cidadeOrigem, uf: cfg.ufOrigem,
    }
    const d = b.destinatario || {}
    const destinatario: EnderecoLog = {
      cep: String(d.cep || '').replace(/\D/g, ''),
      nome: d.nome || null, documento: d.documento || null,
      logradouro: d.logradouro || null, numero: d.numero || null, bairro: d.bairro || null,
      cidade: d.cidade || null, uf: d.uf || null,
    }
    if (destinatario.cep.length !== 8) return NextResponse.json({ error: 'CEP do destinatário inválido' }, { status: 400 })

    const pacote = {
      peso: Number(b.pacote?.peso) || 0.3,
      altura: Number(b.pacote?.altura) || undefined,
      largura: Number(b.pacote?.largura) || undefined,
      comprimento: Number(b.pacote?.comprimento) || undefined,
      valorSegurado: Number(b.pacote?.valor) || 0,
    }
    const produtos = Array.isArray(b.produtos) && b.produtos.length > 0
      ? b.produtos.map((x: any) => ({ nome: String(x.nome || 'Item'), quantidade: Number(x.quantidade) || 1, valorUnitario: Number(x.valorUnitario) || 0 }))
      : [{ nome: 'Pedido', quantidade: 1, valorUnitario: Number(b.pacote?.valor) || 0 }]

    const r = await comprarEtiqueta(workspaceId, { servicoId, remetente, destinatario, pacote, produtos })

    await prisma.$executeRaw`
      INSERT INTO "Envio" (
        "id","workspaceId","orderId","fonte","provedor","transportadora","servico","preco","prazoDias",
        "provedorEnvioId","etiquetaUrl","rastreio","status","createdAt","updatedAt"
      ) VALUES (
        ${id}, ${workspaceId}, ${orderId}, 'transportadora', 'melhorenvio',
        ${b.transportadora ?? null}, ${b.servico ?? null},
        ${b.preco != null ? Number(b.preco) : null}, ${b.prazoDias != null ? Number(b.prazoDias) : null},
        ${r.provedorEnvioId ?? null}, ${r.etiquetaUrl ?? null}, ${r.rastreio ?? null},
        ${r.ok ? (r.status || 'gerado') : 'erro'}, NOW(), NOW()
      )
    `
    if (!r.ok) return NextResponse.json({ ok: false, id, erro: r.erro }, { status: 400 })
    return NextResponse.json(serialize({ ok: true, id, provedorEnvioId: r.provedorEnvioId, etiquetaUrl: r.etiquetaUrl, rastreio: r.rastreio, status: r.status }))
  } catch (error) {
    console.error('[LOGISTICA] envio POST:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
