import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/errorLog'
import { orderByPedido } from '@/lib/ordenacaoPedidos'
import { sqlFinalizado, workspaceTemExpedicao } from '@/lib/statusPedido'
import { normNome, soDigitos } from '@/lib/normNome'

const VAZIO = '__VAZIO__'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function toDate(val: string | null | undefined) {
  if (!val) return null
  return new Date(val)
}

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    const result: any = {}
    for (const key of Object.keys(obj)) result[key] = serialize(obj[key])
    return result
  }
  return obj
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status      = searchParams.get('status')
    const prioridade  = searchParams.get('prioridade')
    const canal       = searchParams.get('canal')
    const setorId     = searchParams.get('setorId')
    const busca          = searchParams.get('busca')
    const atrasados      = searchParams.get('atrasados') === '1'
    const dataEntrada    = searchParams.get('dataEntrada') || null
    const dataEnvio      = searchParams.get('dataEnvio')   || null
    const responsavel    = searchParams.get('responsavel') || null
    const freelancer     = searchParams.get('freelancer')  || null
    const obs            = searchParams.get('obs')         || null
    const obsVazio       = searchParams.get('obsVazio')    === '1'
    const ordenacao      = searchParams.get('ordenacao')   || ''
    const onlyIds        = searchParams.get('onlyIds')     === '1'
    const filtrosWLRaw   = searchParams.get('filtrosWL')   || null
    const pagina      = parseInt(searchParams.get('pagina') || '1')
    const limite      = parseInt(searchParams.get('limite') || '20')
    const offset      = (pagina - 1) * limite
    const workspaceId = session.user.workspaceId
    const buscaLike   = busca ? `%${busca}%` : null

    // Regra de expedição do workspace (define "entregue" e "atrasado") — fonte única em lib/statusPedido
    const temExpedicao = await workspaceTemExpedicao(workspaceId)

    const statusClause = status ? Prisma.sql`AND o."status" = ${status}` : Prisma.empty

    // Atrasado = dataEnvio vencida e NÃO finalizado (entregue/cancelado, ciente de expedição).
    const atrasadosClause = Prisma.sql`AND (NOT ${atrasados} OR (
      o."dataEnvio" IS NOT NULL
      AND o."dataEnvio"::date < CURRENT_DATE
      AND NOT ${sqlFinalizado(Prisma.sql`o."status"`, temExpedicao)}
    ))`

    // ── Cláusulas com suporte a __VAZIO__ ───────────────────────────────
    const canalClause = canal === VAZIO
      ? Prisma.sql`AND (o."canal" IS NULL OR o."canal" = '')`
      : canal
        ? Prisma.sql`AND o."canal" = ${canal}`
        : Prisma.empty

    const setorClause = setorId === VAZIO
      ? Prisma.sql`AND psa."setorId" IS NULL`
      : setorId
        ? Prisma.sql`AND psa."setorId" = ${setorId}`
        : Prisma.empty

    // dataEntrada aceita dia exato (YYYY-MM-DD) OU o MÊS inteiro (YYYY-MM) — filtro "entraram no mês".
    // Independente do filtro de envio: pode usar um, o outro, ou os dois (interseção).
    const entClause = dataEntrada === VAZIO
      ? Prisma.sql`AND o."dataEntrada" IS NULL`
      : (dataEntrada && dataEntrada.length === 10)
        ? Prisma.sql`AND TO_CHAR(o."dataEntrada", 'YYYY-MM-DD') = ${dataEntrada}`
        : (dataEntrada && dataEntrada.length === 7)
          ? Prisma.sql`AND TO_CHAR(o."dataEntrada", 'YYYY-MM') = ${dataEntrada}`
          : Prisma.empty

    // dataEnvio aceita dia exato (YYYY-MM-DD) OU o MÊS inteiro (YYYY-MM) — filtro "enviados no mês".
    const envClause = dataEnvio === VAZIO
      ? Prisma.sql`AND o."dataEnvio" IS NULL`
      : (dataEnvio && dataEnvio.length === 10)
        ? Prisma.sql`AND TO_CHAR(o."dataEnvio", 'YYYY-MM-DD') = ${dataEnvio}`
        : (dataEnvio && dataEnvio.length === 7)
          ? Prisma.sql`AND TO_CHAR(o."dataEnvio", 'YYYY-MM') = ${dataEnvio}`
          : Prisma.empty

    // ── Responsável (salvo em camposExtras.responsavelId) ─────────────
    const respClause = responsavel === VAZIO
      ? Prisma.sql`AND (o."camposExtras"::jsonb->>'responsavelId' IS NULL OR o."camposExtras"::jsonb->>'responsavelId' = '')`
      : responsavel
        ? Prisma.sql`AND o."camposExtras"::jsonb->>'responsavelId' = ${responsavel}`
        : Prisma.empty

    // ── Freelancer (salvo em camposExtras._freelancers como objeto setorId→freelancerId) ─
    const frelClause = freelancer === VAZIO
      ? Prisma.sql`AND (o."camposExtras"::jsonb->'_freelancers' IS NULL OR o."camposExtras"::jsonb->'_freelancers' = '{}'::jsonb)`
      : freelancer
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM jsonb_each_text(COALESCE(o."camposExtras"::jsonb->'_freelancers', '{}'::jsonb))
            WHERE value = ${freelancer}
          )`
        : Prisma.empty

    // ── Observações (texto ou vazio) ──────────────────────────────────
    const obsClause = obsVazio
      ? Prisma.sql`AND (o."observacoes" IS NULL OR o."observacoes" = '')`
      : (obs && obs.trim())
        ? Prisma.sql`AND o."observacoes" ILIKE ${`%${obs}%`}`
        : Prisma.empty

    // ── Ocultar finalizados (ENVIADO/CANCELADO) — default da lista ────
    // O cliente só envia quando NÃO há filtro de status explícito (status ganha).
    const ocultarFinalizados = searchParams.get('ocultarFinalizados') === '1'
    const ocultarClause = ocultarFinalizados
      ? Prisma.sql`AND o."status" NOT IN ('ENVIADO','CANCELADO')`
      : Prisma.empty

    // ── Filtros de campos personalizados (WL) em camposExtras ─────────
    // filtrosWL = JSON { "Cor do laço": "Vermelho", "Tema": "__VAZIO__", ... }
    // Campos tipo lista/checkbox usam match EXATO (case-insensitive) — senão
    // "Não" traria também "Não sei". Texto/número/data seguem por "contém".
    let camposExatos = new Set<string>()
    if (filtrosWLRaw) {
      const defsExatos = await prisma.$queryRaw`
        SELECT DISTINCT "nome"
        FROM "SetorCampo"
        WHERE "workspaceId" = ${workspaceId}
          AND "ativo" = true
          AND "tipo" IN ('lista', 'checkbox')
      ` as { nome: string }[]
      camposExatos = new Set(defsExatos.map(d => d.nome))
    }
    let wlClauseArr: any[] = []
    if (filtrosWLRaw) {
      try {
        const filtrosWL = JSON.parse(filtrosWLRaw) as Record<string, string>
        for (const [nome, val] of Object.entries(filtrosWL)) {
          if (val === '' || val === null || val === undefined) continue
          if (val === VAZIO) {
            wlClauseArr.push(Prisma.sql`AND (
              o."camposExtras"::jsonb->>${nome} IS NULL
              OR o."camposExtras"::jsonb->>${nome} = ''
            )`)
          } else if (camposExatos.has(nome)) {
            // lista/checkbox: match exato, case-insensitive
            wlClauseArr.push(Prisma.sql`AND LOWER(o."camposExtras"::jsonb->>${nome}) = LOWER(${val})`)
          } else {
            // texto/número/data: busca case-insensitive (contém)
            const like = `%${val}%`
            wlClauseArr.push(Prisma.sql`AND o."camposExtras"::jsonb->>${nome} ILIKE ${like}`)
          }
        }
      } catch (e) {
        console.warn('filtrosWL inválido:', e)
      }
    }
    const wlClause = wlClauseArr.length > 0
      ? Prisma.join(wlClauseArr, ' ')
      : Prisma.empty

    // ── Ordenação ─────────────────────────────────────────────────────
    // Cláusula compartilhada (lib/ordenacaoPedidos) — mesmas opções do botão
    // "Ordenar". NULLS LAST garante que pedidos sem data fiquem no final em ASC.
    // Sem ordenação escolhida → default da lista (prioridade + mais recentes).
    const orderClause = orderByPedido(ordenacao) ?? Prisma.sql`
      ORDER BY
        CASE o."prioridade"
          WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2
          WHEN 'NORMAL'  THEN 3 WHEN 'BAIXA' THEN 4 ELSE 5
        END,
        o."createdAt" DESC
    `

    // ── onlyIds: retorna SÓ os IDs (todos do filtro, sem paginação) ───
    // Usado pelo "Selecionar todos" do front para marcar todos os pedidos
    // do filtro atual, mesmo os que estão em outras páginas.
    if (onlyIds) {
      const idsRows = await prisma.$queryRaw`
        SELECT o."id"
        FROM "Order" o
        LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
        WHERE o."workspaceId" = ${workspaceId}
          ${statusClause}
          AND (${prioridade}::text IS NULL OR o."prioridade" = ${prioridade})
          ${canalClause}
          ${setorClause}
          AND (${buscaLike}::text IS NULL
            OR o."numero"       ILIKE ${buscaLike}
            OR o."destinatario" ILIKE ${buscaLike}
            OR o."idCliente"    ILIKE ${buscaLike}
            OR o."produto"      ILIKE ${buscaLike}
            OR o."observacoes"  ILIKE ${buscaLike}
            OR o."endereco"     ILIKE ${buscaLike})
          ${atrasadosClause}
          ${entClause}
          ${envClause}
          ${respClause}
          ${frelClause}
          ${obsClause}
          ${wlClause}
        ${orderClause}
      ` as any[]
      return NextResponse.json(serialize({ ids: idsRows.map(r => r.id) }))
    }

    const pedidos = await prisma.$queryRaw`
      SELECT
        o."id", o."numero", o."destinatario", o."idCliente", o."clienteId", o."canal",
        o."produto", o."valor", o."prioridade", o."status",
        TO_CHAR(o."dataEntrada", 'YYYY-MM-DD') AS "dataEntrada",
        TO_CHAR(o."dataEnvio", 'YYYY-MM-DD')   AS "dataEnvio",
        o."observacoes", o."endereco",
        o."quantidade",
        COALESCE(o."quantidadeSku",
          array_length(string_to_array(o."produto", ' + '), 1)
        ) AS "quantidadeSku",
        o."camposExtras", o."createdAt", o."updatedAt",
        -- Nome do setor atual vem do JOIN por setorId (a coluna psa."setorNome" nunca é
        -- populada nos inserts → ficava sempre vazia). Usa o ponteiro psa."setorId".
        COALESCE(sca."nome", psa."setorNome") as setor_atual_nome, psa."setorId" as setor_atual_id,
        (SELECT COUNT(*) FROM "PedidoSetor" ps WHERE ps."pedidoId" = o."id") as total_itens,
        (SELECT COUNT(*) FROM "PedidoSetor" ps WHERE ps."pedidoId" = o."id" AND ps."status" = 'CONCLUIDO') as itens_concluidos
      FROM "Order" o
      LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
      LEFT JOIN "SetorConfig" sca ON sca."id" = psa."setorId"
      WHERE o."workspaceId" = ${workspaceId}
        ${statusClause}
        ${ocultarClause}
        AND (${prioridade}::text IS NULL OR o."prioridade" = ${prioridade})
        ${canalClause}
        ${setorClause}
        AND (${buscaLike}::text IS NULL
          OR o."numero"       ILIKE ${buscaLike}
          OR o."destinatario" ILIKE ${buscaLike}
          OR o."idCliente"    ILIKE ${buscaLike}
          OR o."produto"      ILIKE ${buscaLike}
          OR o."observacoes"  ILIKE ${buscaLike}
          OR o."endereco"     ILIKE ${buscaLike})
        ${atrasadosClause}
        ${entClause}
        ${envClause}
        ${respClause}
        ${frelClause}
        ${obsClause}
        ${wlClause}
      ${orderClause}
      LIMIT ${limite} OFFSET ${offset}
    ` as any[]

    const [contagem] = await prisma.$queryRaw`
      SELECT COUNT(*) as total, COALESCE(SUM(COALESCE(o."valor", o."valorTotal")),0)::float as "somaValor"
      FROM "Order" o
      LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
      WHERE o."workspaceId" = ${workspaceId}
        ${statusClause}
        ${ocultarClause}
        AND (${prioridade}::text IS NULL OR o."prioridade" = ${prioridade})
        ${canalClause}
        ${setorClause}
        ${atrasadosClause}
        ${entClause}
        ${envClause}
        ${respClause}
        ${frelClause}
        ${obsClause}
        ${wlClause}
    ` as any[]

    // Contagem dos finalizados que estão sendo ocultados (para o chip "N ocultos")
    let ocultos = 0
    if (ocultarFinalizados) {
      const [oc] = await prisma.$queryRaw`
        SELECT COUNT(*)::int as total
        FROM "Order" o
        LEFT JOIN "PedidoSetorAtual" psa ON psa."pedidoId" = o."id"
        WHERE o."workspaceId" = ${workspaceId}
          AND o."status" IN ('ENVIADO','CANCELADO')
          AND (${prioridade}::text IS NULL OR o."prioridade" = ${prioridade})
          ${canalClause}
          ${setorClause}
          ${entClause}
          ${envClause}
          ${respClause}
          ${frelClause}
          ${obsClause}
          ${wlClause}
      ` as any[]
      ocultos = Number(oc?.total || 0)
    }

    return NextResponse.json(serialize({
      pedidos,
      total: contagem.total,
      somaValor: Number(contagem.somaValor || 0),
      ocultos,
      pagina,
      limite,
    }))
  } catch (error: any) {
    console.error('Erro GET pedidos:', error)
    await logError({
      workspaceId: null,
      rota: '/api/producao/pedidos',
      metodo: 'GET',
      erro: error,
    })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let session: any = null
  let body: any = null
  try {
    session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    body = await req.json()
    const {
      numero, destinatario, idCliente, canal, produto,
      quantidade, quantidadeSku, valor, dataEntrada, dataEnvio,
      observacoes, prioridade, endereco, camposExtras,
      clienteId,
    } = body

    if (!destinatario || !produto) {
      return NextResponse.json({ error: 'Destinatário e produto são obrigatórios' }, { status: 400 })
    }
    // "ID do Pedido (número)": na venda direta/outros a artesã não tem ID de marketplace.
    // Se vier vazio, gera automático (mesmo formato PREFIXO-TIMESTAMP, único por workspace).
    const numeroFinal = (numero && String(numero).trim())
      ? String(numero).trim()
      : `${String(destinatario || '').replace(/[^A-Za-zÀ-ÿ]/g, '').substring(0, 3).toUpperCase() || 'PED'}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`

    const workspaceId      = session.user.workspaceId
    const id               = gerarId()
    const dataEntradaDate  = toDate(dataEntrada)
    const dataEnvioDate    = toDate(dataEnvio)
    const qtd              = parseInt(String(quantidade)) || 1
    const qtdSku           = quantidadeSku ? parseInt(String(quantidadeSku)) : null
    const valorNum         = valor ? parseFloat(String(valor)) : null
    const camposExtrasJson = camposExtras ? JSON.stringify(camposExtras) : null

    // ── Cliente: se NÃO veio um cliente selecionado mas há um nome digitado,
    // casa por nome (+telefone quando houver) ou cria — assim o pedido entra na
    // lista de clientes e no histórico dele (que derivam de "clienteId"). Mesmo
    // padrão da Loja Virtual (dedupe por nome normalizado). ──
    let clienteIdFinal: string | null = clienteId ?? null
    const nomeCli = String(destinatario || '').trim()
    if (!clienteIdFinal && nomeCli.length >= 2) {
      const telCli = body?.telefone ? String(body.telefone).trim() : null
      const telDig = telCli ? soDigitos(telCli) : ''
      const existentes = await prisma.$queryRaw`
        SELECT "id","nome","telefone" FROM "Cliente"
        WHERE "workspaceId" = ${workspaceId} AND "ativo" = true
      ` as { id: string; nome: string; telefone: string | null }[]
      const mesmoNome = existentes.filter(c => normNome(c.nome) === normNome(nomeCli))
      if (mesmoNome.length === 1) clienteIdFinal = mesmoNome[0].id
      else if (mesmoNome.length > 1 && telDig) {
        const porTel = mesmoNome.filter(c => soDigitos(c.telefone || '') === telDig)
        if (porTel.length === 1) clienteIdFinal = porTel[0].id
      }
      if (!clienteIdFinal) {
        clienteIdFinal = gerarId()
        await prisma.$executeRaw`
          INSERT INTO "Cliente"
            ("id","workspaceId","nome","telefone","origem","ativo","createdAt","updatedAt")
          VALUES (${clienteIdFinal}, ${workspaceId}, ${nomeCli}, ${telCli}, 'Pedido Manual', true, NOW(), NOW())
        `
      }
    }

    await prisma.$executeRaw`
      INSERT INTO "Order" (
        "id", "workspaceId", "numero", "destinatario", "idCliente",
        "canal", "produto", "quantidade", "quantidadeSku", "valor",
        "dataEntrada", "dataEnvio", "observacoes", "prioridade", "status",
        "endereco", "camposExtras", "clienteId"
      ) VALUES (
        ${id}, ${workspaceId}, ${numeroFinal}, ${destinatario}, ${idCliente ?? null},
        ${canal ?? null}, ${produto}, ${qtd}, ${qtdSku}, ${valorNum},
        ${dataEntradaDate}, ${dataEnvioDate}, ${observacoes ?? null},
        ${prioridade ?? 'NORMAL'}, 'ABERTO',
        ${endereco ?? null}, ${camposExtrasJson}, ${clienteIdFinal}
      )
    `

    try {
      const histId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
        VALUES (${histId}, ${id}, ${workspaceId}, 'CRIACAO', 'Pedido criado', ${session.user.name})
      `
    } catch (e) { console.warn('Histórico:', e) }

    // ── Lançamento PENDENTE automático — canais de pagamento manual ─────────
    // Cria previsão de receita pelo valor cheio. Sinais manuais e a expedição
    // abatem/convertem esse pendente. Marcado em observacoes com [saldo-auto].
    const CANAIS_PAGAMENTO_MANUAL = ['Direta', 'Instagram', 'WhatsApp', 'Outros']
    if (CANAIS_PAGAMENTO_MANUAL.includes(canal || '') && valorNum && valorNum > 0) {
      try {
        const lancId = gerarId()
        // Data: dataEnvio do pedido OU hoje + 30 dias (fallback)
        let dataPrev: string
        if (dataEnvioDate) {
          dataPrev = dataEnvioDate.toISOString().split('T')[0]
        } else {
          const d = new Date()
          d.setDate(d.getDate() + 30)
          dataPrev = d.toISOString().split('T')[0]
        }
        const descLan = `[saldo-auto] Pedido #${numeroFinal} — ${canal}`
        await prisma.$executeRaw`
          INSERT INTO "FinLancamento"
            ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status",
             "dataRealizada","valorRealizado","canal","referencia","observacoes","clienteId",
             "recorrenciaId","recorrencia","parcela","totalParcelas",
             "arquivo","arquivoNome","arquivoTipo")
          VALUES (
            ${lancId}, ${workspaceId}, 'RECEITA', NULL,
            ${descLan}, ${valorNum}, ${dataPrev}::date, 'PENDENTE',
            NULL, NULL, ${canal}, ${numeroFinal}, '[saldo-auto]', ${clienteIdFinal},
            NULL, NULL, NULL, NULL, NULL, NULL, NULL
          )
        `
      } catch (eLanc) {
        // Silencioso — não bloqueia a criação do pedido
        console.error('[POST pedido] Erro ao criar lançamento pendente:', eLanc)
      }
    }

    // Colunas explícitas (nunca SELECT * em "Order" — cached plan error do Neon após ADD COLUMN)
    const novos = await prisma.$queryRaw`
      SELECT "id", "workspaceId", "numero", "cliente", "canal", "status", "prioridade",
             "valorTotal", "observacoes", "dataEntrega", "createdAt", "updatedAt",
             "idCliente", "destinatario", "produto", "quantidade", "valor",
             "dataEntrada", "dataEnvio", "endereco", "camposExtras",
             "estoqueInsuficiente", "quantidadeSku", "fluxoModeloId", "responsavelId", "clienteId"
      FROM "Order" WHERE "id" = ${id}` as any[]

    // [Stars removido — feature desativada até 01/06/2026]

    return NextResponse.json(serialize({ pedido: novos[0] }))
  } catch (error: any) {
    console.error('Erro POST pedido:', error)
    if (error?.meta?.code === '23505' || error?.message?.includes('23505')) {
      return NextResponse.json({ error: 'Já existe um pedido com esse número. Use um número diferente.' }, { status: 409 })
    }
    await logError({
      workspaceId: session?.user?.workspaceId,
      userId: session?.user?.id,
      rota: '/api/producao/pedidos',
      metodo: 'POST',
      erro: error,
      payload: body,
    })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
