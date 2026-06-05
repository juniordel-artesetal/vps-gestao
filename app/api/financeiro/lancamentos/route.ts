// app/api/financeiro/lancamentos/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const { searchParams } = new URL(req.url)
  const tipo      = searchParams.get('tipo')
  const status    = searchParams.get('status')
  const mes       = searchParams.get('mes')
  const ano       = searchParams.get('ano')
  const catId     = searchParams.get('categoriaId')
  const referencia = searchParams.get('referencia') || null

  const vTipo   = ['RECEITA','DESPESA'].includes(tipo   || '') ? tipo   : null
  const vStatus = ['PAGO','PENDENTE'].includes(status || '') ? status : null
  const vMes    = mes && !isNaN(Number(mes)) ? Number(mes) : null
  const vAno    = ano && !isNaN(Number(ano)) ? Number(ano) : null

  const conditions: string[] = [`l."workspaceId" = $1`]
  const params: (string | number)[] = [workspaceId]

  if (vTipo)   { params.push(vTipo);   conditions.push(`l.tipo = $${params.length}`) }
  if (vStatus) { params.push(vStatus); conditions.push(`l.status = $${params.length}`) }
  if (vMes)    { params.push(vMes);    conditions.push(`EXTRACT(MONTH FROM l.data) = $${params.length}`) }
  if (vAno)    { params.push(vAno);    conditions.push(`EXTRACT(YEAR  FROM l.data) = $${params.length}`) }
  if (catId)     { params.push(catId);     conditions.push(`l."categoriaId" = $${params.length}`) }
  if (referencia){ params.push(referencia); conditions.push(`l."referencia" = $${params.length}`) }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       l.*,
       l.valor::float           AS valor,
       l."valorRealizado"::float AS "valorRealizado",
       c.nome  AS "categoriaNome",
       c.cor   AS "categoriaCor",
       c.icone AS "categoriaIcone"
     FROM "FinLancamento" l
     LEFT JOIN "FinCategoria" c ON c.id = l."categoriaId"
     WHERE ${conditions.join(' AND ')}
     ORDER BY l.data DESC, l."createdAt" DESC`,
    ...params
  )

  return NextResponse.json(rows)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function insertLancamento(p: {
  id: string; tipo: string; catId: string | null; descricao: string
  valor: number; data: string; status: string
  drVal: string | null; vrVal: number | null
  canalVal: string | null; refVal: string | null; obsVal: string | null
  recorrenciaId: string | null; recorrencia: string | null
  parcela: number | null; totalParcelas: number | null
  workspaceId: string
  arquivo: string | null; arquivoNome: string | null; arquivoTipo: string | null
}) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FinLancamento"
      ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status",
       "dataRealizada","valorRealizado","canal","referencia","observacoes",
       "recorrenciaId","recorrencia","parcela","totalParcelas",
       "arquivo","arquivoNome","arquivoTipo")
    VALUES ($1,$17,$2,$3,$4,$5,$6::date,$7,$8::date,$9,$10,$11,$12,$13,$14,$15,$16,$18,$19,$20)`,
    p.id, p.tipo, p.catId, p.descricao,
    p.valor, p.data, p.status,
    p.drVal, p.vrVal, p.canalVal, p.refVal, p.obsVal,
    p.recorrenciaId, p.recorrencia, p.parcela, p.totalParcelas, p.workspaceId,
    p.arquivo, p.arquivoNome, p.arquivoTipo
  )
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const {
    tipo, categoriaId, descricao, valor, data,
    status = 'PENDENTE', dataRealizada, valorRealizado,
    canal, referencia, observacoes,
    recorrencia,   // 'MENSAL' | 'PARCELAS' | null
    totalParcelas, // número de parcelas (só para PARCELAS)
    arquivo, arquivoNome, arquivoTipo,
  } = await req.json()

  if (!tipo || !descricao || !valor || !data)
    return NextResponse.json({ error: 'Campos obrigatórios: tipo, descricao, valor, data' }, { status: 400 })

  const catId    = categoriaId  || null
  const canalVal = canal        || null
  const refVal   = referencia   || null
  const obsVal   = observacoes  || null
  // Mesma lógica para dataRealizada: se status=PAGO sem dataRealizada,
  // usa a data do lançamento (o pagamento foi feito naquele dia mesmo).
  const drVal    = dataRealizada != null && dataRealizada !== ''
                     ? dataRealizada
                     : (status === 'PAGO' ? data : null)
  // Bug fix Michelle: se status=PAGO e o client não enviou valorRealizado,
  // assume = valor (o lançamento foi feito como pago, então o realizado é o
  // valor todo). Isso é o esperado pelo modal "Registrar Pagamento" da ficha
  // do pedido, que envia status='PAGO' mas sem valorRealizado.
  const vrVal    = valorRealizado != null && valorRealizado !== ''
                     ? Number(valorRealizado)
                     : (status === 'PAGO' ? Number(valor) : null)
  const valorNum = Number(valor)

  // ── Sem recorrência — lançamento simples ──────────────────────────────────
  if (!recorrencia) {
    const id = newId()
    await insertLancamento({
      id, tipo, catId, descricao, valor: valorNum, data, status,
      drVal, vrVal, canalVal, refVal, obsVal,
      recorrenciaId: null, recorrencia: null, parcela: null, totalParcelas: null,
      workspaceId,
      arquivo: arquivo || null,
      arquivoNome: arquivoNome || null,
      arquivoTipo: arquivoTipo || null,
    })

    // ── Abate pendente [saldo-auto] vinculado ao mesmo pedido ──────────────
    // Quando entra um sinal/pagamento PAGO com referência ao pedido, reduz o
    // pendente automático para manter o fluxo de caixa coerente (sem duplicação).
    if (status === 'PAGO' && tipo === 'RECEITA' && refVal && valorNum > 0) {
      try {
        const pendentes = await prisma.$queryRaw`
          SELECT id, valor::float AS valor
          FROM "FinLancamento"
          WHERE "workspaceId" = ${workspaceId}
            AND "tipo" = 'RECEITA'
            AND "status" = 'PENDENTE'
            AND "referencia" = ${refVal}
            AND "descricao" LIKE '[saldo-auto]%'
          ORDER BY "createdAt" ASC
          LIMIT 1
        ` as { id: string; valor: number }[]
        if (pendentes.length > 0) {
          const pend     = pendentes[0]
          const novoSaldo = Number(pend.valor) - valorNum
          if (novoSaldo > 0.009) {
            // Ainda há saldo a receber → atualiza o pendente
            await prisma.$executeRaw`
              UPDATE "FinLancamento"
              SET "valor" = ${novoSaldo}
              WHERE "id" = ${pend.id}
            `
          } else {
            // Sinal cobriu ou excedeu → remove o pendente
            await prisma.$executeRaw`
              DELETE FROM "FinLancamento" WHERE "id" = ${pend.id}
            `
          }
        }
      } catch (eAbate) {
        // Silencioso — não reverte o pagamento; artesã pode ajustar manualmente
        console.error('[POST lancamentos] Erro ao abater pendente [saldo-auto]:', eAbate)
      }
    }

    // ── AUDITORIA: registra no histórico do pedido (se houver vínculo) ──────
    if (refVal && tipo === 'RECEITA') {
      try {
        const pedidos = await prisma.$queryRaw`
          SELECT "id" FROM "Order"
          WHERE "workspaceId" = ${workspaceId} AND "numero" = ${refVal}
          LIMIT 1
        ` as { id: string }[]
        if (pedidos.length > 0) {
          const pedidoIdReal = pedidos[0].id
          const usuarioNome  = session.user.name || session.user.email || 'Usuário'
          const valorFmt     = `R$ ${valorNum.toFixed(2).replace('.', ',')}`
          const desc = status === 'PAGO'
            ? `Pagamento registrado (${descricao}): ${valorFmt}`
            : `Pagamento previsto (${descricao}): ${valorFmt}`
          const histId = newId()
          await prisma.$executeRaw`
            INSERT INTO "PedidoHistorico" ("id","pedidoId","workspaceId","tipo","descricao","usuarioNome")
            VALUES (${histId}, ${pedidoIdReal}, ${workspaceId}, 'PAGAMENTO', ${desc}, ${usuarioNome})
          `
        }
      } catch (eHist) {
        console.warn('[POST lancamentos] Erro ao gravar histórico:', eHist)
      }
    }

    const [row] = await prisma.$queryRaw`
      SELECT l.*, l.valor::float, l."valorRealizado"::float,
             c.nome AS "categoriaNome", c.cor AS "categoriaCor", c.icone AS "categoriaIcone"
      FROM "FinLancamento" l LEFT JOIN "FinCategoria" c ON c.id=l."categoriaId"
      WHERE l.id=${id}
    ` as any[]

    // [Stars removido — feature desativada até 01/06/2026]

    return NextResponse.json(row, { status: 201 })
  }

  // ── Com recorrência — cria múltiplos lançamentos ──────────────────────────
  const recId = newId()
  const meses = recorrencia === 'PARCELAS' ? Number(totalParcelas || 1) : 24

  for (let i = 0; i < meses; i++) {
    await insertLancamento({
      id: newId(),
      tipo, catId,
      descricao: recorrencia === 'PARCELAS'
        ? `${descricao} (${i + 1}/${meses})`
        : descricao,
      valor: valorNum,
      data: addMonths(data, i),
      status: 'PENDENTE',
      drVal: null, vrVal: null,
      canalVal, refVal, obsVal,
      recorrenciaId: recId,
      recorrencia,
      parcela: i + 1,
      totalParcelas: recorrencia === 'PARCELAS' ? meses : null,
      workspaceId,
      arquivo: i === 0 ? (arquivo || null) : null,
      arquivoNome: i === 0 ? (arquivoNome || null) : null,
      arquivoTipo: i === 0 ? (arquivoTipo || null) : null,
    })
  }

  // [Stars removido — feature desativada até 01/06/2026]

  return NextResponse.json({ recorrenciaId: recId, total: meses, tipo: recorrencia }, { status: 201 })
}
