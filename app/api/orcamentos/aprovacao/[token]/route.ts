import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const r: any = {}
    for (const k of Object.keys(obj)) r[k] = serialize(obj[k])
    return r
  }
  return obj
}

// GET público — retorna dados do orçamento pelo token (com itens + foto/descrição do produto)
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const [orc] = await prisma.$queryRaw`
      SELECT
        o."id", o."numero", o."status", o."clienteNome", o."clienteEmail",
        o."clienteWhatsapp", o."canal", o."produto", o."quantidade",
        o."valor", COALESCE(o."frete", 0) AS "frete",
        COALESCE(o."descontoValor", 0) AS "descontoValor", COALESCE(o."descontoTipo", 'valor') AS "descontoTipo",
        o."observacoes",
        COALESCE(o."politicasEmpresa", w."politicasOrcamento") AS "politicasEmpresa",
        o."camposExtras",
        TO_CHAR(o."dataValidade",      'YYYY-MM-DD') AS "dataValidade",
        TO_CHAR(o."dataEnvioEstimada", 'YYYY-MM-DD') AS "dataEnvioEstimada",
        TO_CHAR(o."createdAt",         'YYYY-MM-DD') AS "createdAt",
        o."aprovadoEm",
        w."nome"         AS "workspaceNome",
        w."logo"         AS "workspaceLogo",
        w."corPrimaria"  AS "workspaceCor",
        w."whatsapp"     AS "workspaceWhatsapp",
        w."emailContato" AS "workspaceEmail",
        w."instagram"    AS "workspaceInstagram",
        w."cidade"       AS "workspaceCidade",
        w."estado"       AS "workspaceEstado"
      FROM "Orcamento" o
      JOIN "Workspace" w ON w."id" = o."workspaceId"
      WHERE o."tokenAprovacao" = ${token}
    ` as any[]

    if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 })

    // Itens + foto/descrição do PRODUTO (via variação → produto). LEFT JOIN: item manual/combo fica sem foto.
    const itens = await prisma.$queryRaw`
      SELECT
        oi."id", oi."produto", oi."quantidade", oi."valorUnitario",
        oi."isKit", oi."qtdKitPecas", oi."ordem", oi."variacaoId",
        COALESCE(oi."desconto", 0) AS "desconto", COALESCE(oi."descontoTipo", 'valor') AS "descontoTipo",
        pp."imagem"    AS "produtoImagem",
        pp."descricao" AS "produtoDescricao"
      FROM "OrcamentoItem" oi
      LEFT JOIN "PrecVariacao" pv ON pv."id" = oi."variacaoId"
      LEFT JOIN "PrecProduto"  pp ON pp."id" = pv."produtoId"
      WHERE oi."orcamentoId" = ${orc.id}
      ORDER BY oi."ordem" ASC
    ` as any[]

    return NextResponse.json(serialize({ ...orc, itens }))
  } catch (error) {
    console.error('GET aprovacao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST público — cliente aprova o orçamento
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const [orc] = await prisma.$queryRaw`
      SELECT
        o."id", o."numero", o."status", o."clienteNome", o."workspaceId",
        w."nome" AS "workspaceNome", w."emailContato" AS "workspaceEmail"
      FROM "Orcamento" o
      JOIN "Workspace" w ON w."id" = o."workspaceId"
      WHERE o."tokenAprovacao" = ${token}
    ` as any[]

    if (!orc) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    if (orc.status === 'APROVADO') return NextResponse.json({ error: 'Já aprovado', jaAprovado: true }, { status: 400 })
    if (orc.status === 'RECUSADO') return NextResponse.json({ error: 'Orçamento recusado' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const pedidoEspecial: string | null = body.pedidoEspecial || null

    const agora = new Date()

    await prisma.$executeRaw`
      UPDATE "Orcamento"
      SET "status" = 'APROVADO', "aprovadoEm" = ${agora}, "updatedAt" = NOW()
      WHERE "id" = ${orc.id}
    `

    const pedidoId   = gerarId()
    const numeroPed  = orc.clienteNome.substring(0, 3).toUpperCase() + '-' + Date.now().toString(36).toUpperCase()

    const [orcFull] = await prisma.$queryRaw`
      SELECT "canal","produto","quantidade","valor",COALESCE("frete",0) AS "frete","observacoes",
             "camposExtras","dataEnvioEstimada"
      FROM "Orcamento" WHERE "id" = ${orc.id}
    ` as any[]

    // Buscar itens
    const itensOrc = await prisma.$queryRaw`
      SELECT "produto","quantidade","valorUnitario","isKit","qtdKitPecas","ordem"
      FROM "OrcamentoItem"
      WHERE "orcamentoId" = ${orc.id}
      ORDER BY "ordem" ASC
    ` as any[]

    // Montar camposExtras com múltiplos produtos
    let camposExtrasPedido: any = {}
    try {
      const extras = orcFull.camposExtras ? JSON.parse(String(orcFull.camposExtras)) : {}
      const valores = extras.camposValores || {}
      if (Object.keys(valores).length > 0) camposExtrasPedido = { ...valores }
    } catch {}

    if (itensOrc.length > 0) {
      camposExtrasPedido.produtos = itensOrc.map((it: any) => ({
        nome: it.produto,
        quantidade: Number(it.quantidade) || 1,
        valorUnitario: it.valorUnitario ? Number(it.valorUnitario) : null,
        isKit: !!it.isKit,
        qtdKitPecas: Number(it.qtdKitPecas) || 0,
      }))
    }

    const camposExtrasStr = Object.keys(camposExtrasPedido).length > 0
      ? JSON.stringify(camposExtrasPedido) : null

    try {
      await prisma.$executeRaw`
        INSERT INTO "Order" (
          "id","workspaceId","numero","destinatario","idCliente",
          "canal","produto","quantidade","valor",
          "dataEntrada","dataEnvio","observacoes","prioridade","status",
          "endereco","camposExtras"
        ) VALUES (
          ${pedidoId},${orc.workspaceId},${numeroPed},${orc.clienteNome},${null},
          ${orcFull.canal ?? null},${orcFull.produto},${orcFull.quantidade},
          ${orcFull.valor ? parseFloat(String(orcFull.valor)) : null},
          ${agora},${orcFull.dataEnvioEstimada ? new Date(orcFull.dataEnvioEstimada) : null},
          ${[orcFull.observacoes, pedidoEspecial ? '🎀 Pedido especial: ' + pedidoEspecial : null].filter(Boolean).join(' | ') || null},
          'NORMAL','ABERTO',${null},${camposExtrasStr}
        )
      `
      await prisma.$executeRaw`
        UPDATE "Orcamento" SET "pedidoId" = ${pedidoId} WHERE "id" = ${orc.id}
      `
    } catch (e) { console.warn('Criar pedido:', e) }

    const emailDestino = orc.workspaceEmail || process.env.SUPORTE_EMAIL
    if (emailDestino) {
      try {
        await resend.emails.send({
          from: 'VPS Gestão <suporte@vps-gestao.com.br>',
          to: emailDestino,
          subject: `✅ Orçamento ${orc.numero} aprovado por ${orc.clienteNome}!`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#f97316;padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">✅ Orçamento Aprovado!</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#111;margin-bottom:8px;">Boa notícia! O orçamento foi aprovado pela cliente.</p>
      <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #f97316;">
        <p style="margin:0 0 8px;"><strong>Orçamento:</strong> ${orc.numero}</p>
        <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${orc.clienteNome}</p>
        <p style="margin:0 0 8px;"><strong>Aprovado em:</strong> ${agora.toLocaleString('pt-BR')}</p>
        ${pedidoEspecial ? `<p style="margin:8px 0 0;"><strong>🎀 Pedido especial:</strong> ${pedidoEspecial}</p>` : ''}
      </div>
      <p style="font-size:15px;color:#555;">
        Entre em contato com a cliente para alinhar os próximos passos e confirmar os detalhes da produção.
      </p>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #eee;text-align:center;">
        <p style="font-size:12px;color:#999;">VPS Gestão · suporte@vps-gestao.com.br</p>
      </div>
    </div>
  </div>
</body>
</html>`,
        })
      } catch (e) { console.warn('E-mail:', e) }
    }

    return NextResponse.json({ ok: true, pedidoId })
  } catch (error) {
    console.error('POST aprovacao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
