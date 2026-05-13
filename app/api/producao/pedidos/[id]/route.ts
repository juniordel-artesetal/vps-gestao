import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

// Parse seguro de datas: "2026-04-29" → adiciona T12:00:00 para evitar bug de timezone
// Sem isso, new Date("2026-04-29") = UTC meia-noite = dia anterior no Brasil (UTC-3)
function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null
  // Se já tem horário (ISO completo), usa direto
  if (val.includes('T')) return new Date(val)
  // Só data: adiciona meio-dia para garantir o dia correto em qualquer timezone
  return new Date(val + 'T12:00:00.000Z')
}

// GET — busca pedido por ID
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    const rows = await prisma.$queryRaw`
      SELECT
        o."id",
        o."numero",
        o."destinatario",
        o."idCliente",
        o."canal",
        o."produto",
        o."quantidade"::int,
        o."valor",
        o."dataEntrada",
        o."dataEnvio",
        o."observacoes",
        o."prioridade",
        o."status",
        o."endereco",
        o."camposExtras",
        o."createdAt",
        o."updatedAt",
        s."nome"  AS "setor_atual_nome",
        s."id"    AS "setor_atual_id"
      FROM "Order" o
      LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
      LEFT JOIN "Setor" s ON s."id" = psa."setorId"
      WHERE o."id" = ${id}
        AND o."workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (rows.length === 0)
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    return NextResponse.json({ pedido: serialize(rows[0]) })
  } catch (error) {
    console.error('[GET pedido/id]', error)
    // Fallback: tenta sem a view PedidoSetorAtual
    try {
      const session = await getServerSession(authOptions)
      if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      const { id } = await params
      const workspaceId = session.user.workspaceId

      const rows = await prisma.$queryRaw`
        SELECT
          o."id", o."numero", o."destinatario", o."idCliente", o."canal",
          o."produto", o."quantidade"::int, o."valor", o."dataEntrada",
          o."dataEnvio", o."observacoes", o."prioridade", o."status",
          o."endereco", o."camposExtras", o."createdAt", o."updatedAt",
          NULL AS "setor_atual_nome", NULL AS "setor_atual_id"
        FROM "Order" o
        WHERE o."id" = ${id} AND o."workspaceId" = ${workspaceId}
        LIMIT 1
      ` as any[]

      if (rows.length === 0)
        return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

      return NextResponse.json({ pedido: serialize(rows[0]) })
    } catch (e2) {
      return NextResponse.json({ error: String(e2) }, { status: 500 })
    }
  }
}

// PUT — atualiza pedido (com auditoria das mudanças)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session)
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId
    const body = await req.json()

    // ── Lê estado atual ANTES do update (para diff de auditoria) ───────
    const antesRows = await prisma.$queryRaw`
      SELECT
        "numero", "destinatario", "idCliente", "canal", "produto",
        "quantidade", "quantidadeSku", "valor",
        TO_CHAR("dataEntrada", 'YYYY-MM-DD') AS "dataEntrada",
        TO_CHAR("dataEnvio", 'YYYY-MM-DD')   AS "dataEnvio",
        "observacoes", "prioridade", "status", "endereco",
        "camposExtras", "responsavelId"
      FROM "Order"
      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
      LIMIT 1
    ` as any[]

    if (antesRows.length === 0)
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

    const antes = antesRows[0]

    const {
      numero, destinatario, idCliente, canal, produto,
      quantidade, quantidadeSku, valor, dataEntrada, dataEnvio,
      observacoes, prioridade, status, endereco, camposExtras,
      responsavelId, dataEnvioMassa,
    } = body

    // Atualiza campos enviados
    if (numero      !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "numero"       = ${numero}             WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (destinatario !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "destinatario" = ${destinatario}       WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (idCliente   !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "idCliente"    = ${idCliente || null}  WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (canal       !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "canal"        = ${canal || null}      WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (produto     !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "produto"      = ${produto}            WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (quantidade  !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "quantidade"   = ${parseInt(quantidade) || 1} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (quantidadeSku !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "quantidadeSku" = ${quantidadeSku ? parseInt(String(quantidadeSku)) : null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (valor       !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "valor"        = ${valor ? parseFloat(valor) : null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (dataEntrada !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "dataEntrada"  = ${parseDate(dataEntrada)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (dataEnvio   !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "dataEnvio"    = ${parseDate(dataEnvio)}     WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (observacoes !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "observacoes"  = ${observacoes || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (prioridade  !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "prioridade"   = ${prioridade}          WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (status      !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "status"       = ${status}              WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (endereco    !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "endereco"     = ${endereco || null}    WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    if (responsavelId !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "responsavelId" = ${responsavelId || null} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    // ── SINCRONIZAR PedidoSetor quando status muda manualmente ───────────
    // Previne pedido "fantasma" no workflow (aparece na lista mas não na fila)
    if (status !== undefined && status !== antes.status) {
      try {
        const setoresPedido = await prisma.$queryRaw`
          SELECT ps.id, ps."setorId", ps.status, s.ordem, s.nome AS setor_nome
          FROM "PedidoSetor" ps
          JOIN "Setor" s ON s.id = ps."setorId"
          WHERE ps."pedidoId" = ${id}
            AND ps."workspaceId" = ${workspaceId}
          ORDER BY s.ordem ASC
        ` as any[]

        if (setoresPedido.length > 0) {
          const primeiroSetor = setoresPedido[0]

          // CASO 1: Reabriu pedido (ENVIADO/CONCLUIDO → EM_PRODUCAO/ABERTO)
          // Resetar todos para PENDENTE e ativar o primeiro setor
          if (['EM_PRODUCAO', 'ABERTO'].includes(status) &&
              ['ENVIADO', 'CONCLUIDO'].includes(antes.status)) {
            await prisma.$executeRaw`
              UPDATE "PedidoSetor"
              SET status = 'PENDENTE', "iniciadoEm" = NULL, "concluidoEm" = NULL, "updatedAt" = NOW()
              WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}
            `
            await prisma.$executeRaw`
              UPDATE "PedidoSetor"
              SET status = 'EM_ANDAMENTO', "iniciadoEm" = NOW(), "updatedAt" = NOW()
              WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}
                AND "setorId" = ${primeiroSetor.setorId}
            `
            // Atualiza PedidoSetorAtual (ponteiro do setor atual)
            try {
              await prisma.$executeRaw`
                DELETE FROM "PedidoSetorAtual"
                WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}
              `
              await prisma.$executeRaw`
                INSERT INTO "PedidoSetorAtual" ("pedidoId","workspaceId","setorId","updatedAt")
                VALUES (${id}, ${workspaceId}, ${primeiroSetor.setorId}, NOW())
              `
            } catch {}

            const histId = Math.random().toString(36).slice(2) + Date.now().toString(36)
            await prisma.$executeRaw`
              INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
              VALUES (${histId}, ${id}, ${workspaceId}, 'STATUS',
                ${`Pedido reaberto manualmente — fluxo resetado e reiniciado em "${primeiroSetor.setor_nome}"`},
                ${session.user.name || session.user.email || 'Usuário'})
            `
          }

          // CASO 2: Status virou ENVIADO (sem passar pelo workflow normal)
          // Marca todos os setores como CONCLUIDO
          else if (status === 'ENVIADO' && antes.status !== 'ENVIADO') {
            await prisma.$executeRaw`
              UPDATE "PedidoSetor"
              SET status = 'CONCLUIDO',
                  "iniciadoEm" = COALESCE("iniciadoEm", NOW()),
                  "concluidoEm" = COALESCE("concluidoEm", NOW()),
                  "updatedAt" = NOW()
              WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}
                AND status != 'CONCLUIDO'
            `
            try {
              await prisma.$executeRaw`
                DELETE FROM "PedidoSetorAtual"
                WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}
              `
            } catch {}
          }

          // CASO 3: Status virou CANCELADO
          // Para o fluxo onde estiver — mantém histórico mas não bloqueia filas
          else if (status === 'CANCELADO' && antes.status !== 'CANCELADO') {
            // Apenas registra — não modifica PedidoSetor (o filtro do workflow
            // já exclui Order.status='CANCELADO')
            try {
              await prisma.$executeRaw`
                DELETE FROM "PedidoSetorAtual"
                WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}
              `
            } catch {}
          }
        }
      } catch (eSync) {
        console.error('[PUT pedido sync PedidoSetor]', eSync)
      }
    }

    // dataEnvio via massa
    if (dataEnvioMassa !== undefined) await prisma.$executeRaw`UPDATE "Order" SET "dataEnvio" = ${parseDate(dataEnvioMassa)} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    // camposExtras: aceita objeto ou string JSON
    if (camposExtras !== undefined) {
      const extrasStr = camposExtras === null ? null
        : typeof camposExtras === 'string' ? camposExtras
        : JSON.stringify(camposExtras)
      await prisma.$executeRaw`UPDATE "Order" SET "camposExtras" = ${extrasStr} WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`
    }

    // Timestamp de atualização
    await prisma.$executeRaw`UPDATE "Order" SET "updatedAt" = NOW() WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}`

    // ── AUDITORIA: registra mudança em PedidoHistorico ─────────────────
    try {
      const fmt = (v: any) => {
        if (v === null || v === undefined || v === '') return '(vazio)'
        if (typeof v === 'number') return String(v)
        if (typeof v === 'object' && (v as any).toNumber) return String((v as any).toNumber())
        return String(v)
      }
      const labelCampo: Record<string, string> = {
        numero: 'Número', destinatario: 'Destinatário', idCliente: 'ID Cliente',
        canal: 'Canal', produto: 'Produto', quantidade: 'Quantidade', quantidadeSku: 'SKUs',
        valor: 'Valor', dataEntrada: 'Data de entrada', dataEnvio: 'Data de envio',
        observacoes: 'Observações', prioridade: 'Prioridade', status: 'Status',
        endereco: 'Endereço', responsavelId: 'Responsável',
      }
      const camposSimples: Array<[string, any, any]> = []
      const verificar = (nome: string, novo: any) => {
        if (novo === undefined) return
        const antesV = (antes as any)[nome]
        // Normaliza para comparação (null/'' equivalentes)
        const a = antesV === null || antesV === undefined ? '' : String(antesV)
        const n = novo === null || novo === undefined ? '' : String(novo)
        if (a !== n) camposSimples.push([nome, antesV, novo])
      }
      verificar('numero', numero)
      verificar('destinatario', destinatario)
      verificar('idCliente', idCliente)
      verificar('canal', canal)
      verificar('produto', produto)
      verificar('quantidade', quantidade)
      verificar('quantidadeSku', quantidadeSku)
      verificar('valor', valor)
      verificar('dataEntrada', dataEntrada)
      verificar('dataEnvio', dataEnvio || dataEnvioMassa)
      verificar('observacoes', observacoes)
      verificar('prioridade', prioridade)
      verificar('status', status)
      verificar('endereco', endereco)
      verificar('responsavelId', responsavelId)

      // camposExtras: comparar item a item (campos personalizados)
      const extrasAntesObj: Record<string, any> = (() => {
        try {
          const raw = (antes as any).camposExtras
          if (!raw) return {}
          return typeof raw === 'string' ? JSON.parse(raw) : raw
        } catch { return {} }
      })()
      let extrasNovoObj: Record<string, any> | null = null
      if (camposExtras !== undefined && camposExtras !== null) {
        extrasNovoObj = typeof camposExtras === 'string'
          ? (() => { try { return JSON.parse(camposExtras) } catch { return {} } })()
          : camposExtras
      }
      const extrasMudancas: Array<[string, any, any]> = []
      if (extrasNovoObj) {
        const todasChaves = new Set([...Object.keys(extrasAntesObj), ...Object.keys(extrasNovoObj)])
        // Pula chaves internas (começam com _ ex: _freelancers)
        for (const k of Array.from(todasChaves)) {
          if (k.startsWith('_')) continue
          const a = extrasAntesObj[k]
          const n = extrasNovoObj[k]
          const aS = a === null || a === undefined ? '' : String(a)
          const nS = n === null || n === undefined ? '' : String(n)
          if (aS !== nS) extrasMudancas.push([k, a, n])
        }
      }

      // Gera 1 registro por mudança
      const usuarioNome = session.user.name || session.user.email || 'Usuário'
      for (const [campo, antesV, novoV] of camposSimples) {
        const label = labelCampo[campo] || campo
        const desc = `${label} alterado de "${fmt(antesV)}" para "${fmt(novoV)}"`
        const histId = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${id}, ${workspaceId}, 'EDICAO', ${desc}, ${usuarioNome})
        `
      }
      for (const [nome, antesV, novoV] of extrasMudancas) {
        const desc = `${nome} alterado de "${fmt(antesV)}" para "${fmt(novoV)}"`
        const histId = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
          VALUES (${histId}, ${id}, ${workspaceId}, 'EDICAO', ${desc}, ${usuarioNome})
        `
      }
    } catch (e) { console.warn('Auditoria PUT pedido:', e) }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PUT pedido/id]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// DELETE — remove pedido (com cascade manual em tabelas relacionadas)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const workspaceId = session.user.workspaceId

    // Limpa relacionamentos antes de deletar o pedido
    try {
      await prisma.$executeRaw`DELETE FROM "PedidoSetorAtual" WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}`
    } catch {}
    try {
      await prisma.$executeRaw`DELETE FROM "PedidoSetor" WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}`
    } catch {}
    try {
      await prisma.$executeRaw`DELETE FROM "SetorCampoValor" WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}`
    } catch {}
    try {
      await prisma.$executeRaw`DELETE FROM "PedidoHistorico" WHERE "pedidoId" = ${id} AND "workspaceId" = ${workspaceId}`
    } catch {}

    await prisma.$executeRaw`
      DELETE FROM "Order" WHERE "id" = ${id} AND "workspaceId" = ${workspaceId}
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
