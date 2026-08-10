import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatarDataBR } from '@/lib/data'
import { normNome } from '@/lib/normNome'
import { sqlFinalizado, workspaceTemExpedicao } from '@/lib/statusPedido'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const workspaceId = session.user.workspaceId
    const hoje = new Date()
    const em7dias = new Date(hoje)
    em7dias.setDate(em7dias.getDate() + 7)
    const hojeFmt = hoje.toISOString().split('T')[0]
    const em7Fmt  = em7dias.toISOString().split('T')[0]

    const notificacoes: any[] = []

    // ── 1. Lançamentos financeiros vencidos ────────────────────
    try {
      const vencidos = await prisma.$queryRaw`
        SELECT l."id", l."descricao", l."valor", l."data", l."tipo"
        FROM "FinLancamento" l
        WHERE l."workspaceId" = ${workspaceId}
          AND l."status" != 'PAGO'
          AND l."data" < ${hojeFmt}::date
        ORDER BY l."data" ASC
        LIMIT 5
      ` as any[]
      for (const l of vencidos) {
        notificacoes.push({
          tipo: 'lancamento_vencido',
          urgencia: 'critica',
          titulo: `${l.tipo === 'DESPESA' ? 'Despesa' : 'Receita'} vencida`,
          descricao: `${l.descricao} — R$ ${Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          href: '/financeiro/lancamentos',
        })
      }
    } catch {}

    // ── 3. Pedidos atrasados ───────────────────────────────────
    // Atrasado = dataEnvio vencida e NÃO finalizado (entregue/cancelado). "Entregue" é ciente
    // de expedição: com expedição, PRONTO ainda conta como atraso (não saiu); sem expedição,
    // PRONTO é o estado final e NÃO alerta. Regra única em lib/statusPedido.
    try {
      const temExpedicao = await workspaceTemExpedicao(workspaceId)
      const atrasados = await prisma.$queryRaw`
        SELECT o."id", o."numero", o."destinatario", o."dataEnvio"
        FROM "Order" o
        WHERE o."workspaceId" = ${workspaceId}
          AND NOT ${sqlFinalizado(Prisma.sql`o."status"`, temExpedicao)}
          AND o."dataEnvio" IS NOT NULL
          AND o."dataEnvio" < ${hojeFmt}::date
        ORDER BY o."dataEnvio" ASC
        LIMIT 5
      ` as any[]
      for (const p of atrasados) {
        notificacoes.push({
          tipo: 'pedido_atrasado',
          urgencia: 'alta',
          titulo: `Pedido atrasado: ${p.destinatario}`,
          descricao: `#${p.numero} — envio previsto para ${formatarDataBR(p.dataEnvio)}`,
          href: `/dashboard/pedidos/${p.id}`,
        })
      }
    } catch {}

    // ── 4. Estoque de materiais zerado ou abaixo do mínimo ─────
    try {
      const estoqueBaixo = await prisma.$queryRaw`
        SELECT
          m."nome"          AS "materialNome",
          m."unidade",
          es."saldoAtual",
          es."estoqueMinimo"
        FROM "EstMaterialSaldo" es
        JOIN "PrecMaterial" m ON m."id" = es."materialId"
        WHERE es."workspaceId" = ${workspaceId}
          AND es."estoqueMinimo" IS NOT NULL
          AND es."saldoAtual" <= es."estoqueMinimo"
        ORDER BY es."saldoAtual" ASC
        LIMIT 5
      ` as any[]
      // "Onde comprar": casa os materiais baixos com produtos de parceiro (match único)
      let ofertasBaixo: Record<string, any> = {}
      try {
        if (estoqueBaixo.length) {
          const { ofertasPorNomes } = await import('@/lib/parceiros/distribuidores')
          ofertasBaixo = await ofertasPorNomes(estoqueBaixo.map((e: any) => e.materialNome))
        }
      } catch {}

      for (const e of estoqueBaixo) {
        const saldo  = Number(e.saldoAtual)
        const minimo = Number(e.estoqueMinimo)
        const zerado = saldo <= 0
        const oferta = ofertasBaixo[normNome(e.materialNome)] || null
        notificacoes.push({
          tipo:      zerado ? 'estoque_zerado' : 'estoque_baixo',
          urgencia:  zerado ? 'critica' : 'alta',
          titulo:    zerado ? `Estoque zerado: ${e.materialNome}` : `Estoque baixo: ${e.materialNome}`,
          descricao: oferta
            ? `${zerado ? 'Sem unidades.' : `Saldo: ${saldo.toLocaleString('pt-BR')} ${e.unidade || ''}`} · Compre em ${oferta.parceiroNome}`
            : (zerado
                ? `Sem unidades em estoque.`
                : `Saldo: ${saldo.toLocaleString('pt-BR')} ${e.unidade || ''} (mínimo: ${minimo.toLocaleString('pt-BR')})`),
          // Com oferta casada, o link leva ao "onde comprar" (com contagem de clique)
          href: oferta ? `/api/materiais/ofertas/clique?id=${oferta.produtoId}` : '/precificacao/estoque-materiais',
        })
      }
    } catch {}

    // ── 6. Notificações persistidas do usuário (ex.: menções) ──
    try {
      const userId = (session.user as any).id
      if (userId) {
        const pers = await prisma.$queryRaw`
          SELECT "titulo", "mensagem", "href", "tipo"
          FROM "Notificacao"
          WHERE "workspaceId" = ${workspaceId} AND "userId" = ${userId} AND "lida" = false
          ORDER BY "createdAt" DESC LIMIT 10
        ` as any[]
        for (const n of pers) {
          notificacoes.unshift({
            tipo: n.tipo || 'mencao',
            urgencia: 'alta',
            titulo: n.titulo,
            descricao: n.mensagem || '',
            href: n.href || '#',
          })
        }
      }
    } catch {}

    // ── 5. Tarefas com prazo próximo/vencido ──────────────────
    try {
      const tarefas = await prisma.$queryRaw`
        SELECT t."id", t."quadroId", t."titulo", TO_CHAR(t."prazo",'YYYY-MM-DD') AS "prazo"
        FROM "Tarefa" t
        WHERE t."workspaceId" = ${workspaceId}
          AND t."prazo" IS NOT NULL
          AND t."prazo" <= ${em7Fmt}::date
        ORDER BY t."prazo" ASC
        LIMIT 5
      ` as any[]
      for (const t of tarefas) {
        const venceu = t.prazo < hojeFmt
        notificacoes.push({
          tipo: venceu ? 'tarefa_vencida' : 'tarefa_prazo',
          urgencia: venceu ? 'critica' : 'alta',
          titulo: venceu ? `Tarefa atrasada: ${t.titulo}` : `Tarefa perto do prazo: ${t.titulo}`,
          descricao: `Prazo: ${formatarDataBR(t.prazo)}`,
          href: `/tarefas/quadros/${t.quadroId}`,
        })
      }
    } catch {}

    return NextResponse.json(serialize(notificacoes))
  } catch (error) {
    console.error('Erro notificacoes:', error)
    return NextResponse.json([])
  }
}
