// Lançamentos pessoais (versão completa): GET com filtros (período/tipo/categoria/conta/status)
// + POST com recorrência (MENSAL/PARCELAS), CONTA, MÉTODO e status. Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, parseNum, parseData } from '@/lib/pessoal/api'
import { normalizarImagemEntrada } from '@/lib/pessoal/imagem'
import { aplicarMovCaixinhaDoLancamento } from '@/lib/pessoal/caixinhaSync'
import { sincronizarVinculoPessoal } from '@/lib/pessoal/financeiroVinculo'

export const dynamic = 'force-dynamic'
const ORIGEM_PESSOAL = 'financeiro_pessoal'
const METODOS = ['PIX', 'CARTAO', 'DINHEIRO', 'BOLETO', 'TED']

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const sp = new URL(req.url).searchParams
  const tipo = ['RECEITA', 'DESPESA'].includes(sp.get('tipo') || '') ? sp.get('tipo') : null
  const status = ['PENDENTE', 'PAGO'].includes(sp.get('status') || '') ? sp.get('status') : null
  const mes = sp.get('mes') && !isNaN(Number(sp.get('mes'))) ? Number(sp.get('mes')) : null
  const ano = sp.get('ano') && !isNaN(Number(sp.get('ano'))) ? Number(sp.get('ano')) : null
  const de = parseData(sp.get('de')), ate = parseData(sp.get('ate'))
  const catId = sp.get('categoriaId') || null
  const contaId = sp.get('contaId') || null

  const cond: string[] = [`l."userId" = $1`]
  const p: any[] = [g.userId]
  if (tipo)   { p.push(tipo);   cond.push(`l."tipo" = $${p.length}`) }
  if (status) { p.push(status); cond.push(`l."status" = $${p.length}`) }
  if (mes)    { p.push(mes);    cond.push(`EXTRACT(MONTH FROM l."data") = $${p.length}`) }
  if (ano)    { p.push(ano);    cond.push(`EXTRACT(YEAR FROM l."data") = $${p.length}`) }
  if (de)     { p.push(de);     cond.push(`l."data" >= $${p.length}::date`) }
  if (ate)    { p.push(ate);    cond.push(`l."data" <= $${p.length}::date`) }
  if (catId)  { p.push(catId);  cond.push(`l."categoriaId" = $${p.length}`) }
  if (contaId === '__sem__') cond.push(`l."contaId" IS NULL`)
  else if (contaId) { p.push(contaId); cond.push(`l."contaId" = $${p.length}`) }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT l."id", l."tipo", l."categoriaId", l."contaId", l."descricao", l."valor"::float AS valor, l."data",
           l."metodo", l."referencia", l."observacoes", l."status", l."recorrenciaId", l."recorrencia",
           l."parcela", l."totalParcelas", l."caixinhaId", (l."comprovante" IS NOT NULL) AS "temComprovante",
           c."nome" AS "categoriaNome", c."cor" AS "categoriaCor", c."icone" AS "categoriaIcone",
           ct."nome" AS "contaNome", cx."nome" AS "caixinhaNome"
    FROM "PessoalLancamento" l
    LEFT JOIN "PessoalCategoria" c ON c."id" = l."categoriaId"
    LEFT JOIN "PessoalConta" ct ON ct."id" = l."contaId"
    LEFT JOIN "PessoalCaixinha" cx ON cx."id" = l."caixinhaId"
    WHERE ${cond.join(' AND ')}
    ORDER BY l."data" DESC, l."createdAt" DESC
  `, ...p)
  return NextResponse.json(serialize(rows))
}

function addMeses(dataISO: string, n: number): string {
  const d = new Date(dataISO + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10)
}

async function inserir(userId: string, r: {
  tipo: string; categoriaId: string | null; contaId: string | null; caixinhaId: string | null; metodo: string | null
  descricao: string; valor: number; data: string; referencia: string | null; observacoes: string | null; status: string
  comprovante: string | null
  recorrenciaId: string | null; recorrencia: string | null; parcela: number | null; totalParcelas: number | null
}) {
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalLancamento"
      ("id","userId","tipo","categoriaId","contaId","caixinhaId","descricao","valor","data","metodo","referencia","observacoes",
       "comprovante","origem","status","recorrenciaId","recorrencia","parcela","totalParcelas","createdAt")
    VALUES (${id}, ${userId}, ${r.tipo}, ${r.categoriaId}, ${r.contaId}, ${r.caixinhaId}, ${r.descricao}, ${r.valor}, ${r.data}::date,
            ${r.metodo}, ${r.referencia}, ${r.observacoes}, ${r.comprovante}, 'MANUAL', ${r.status}, ${r.recorrenciaId},
            ${r.recorrencia}, ${r.parcela}, ${r.totalParcelas}, NOW())
  `
  return id
}

export async function POST(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const b = await req.json().catch(() => ({}))
  const descricao = String(b?.descricao ?? '').trim()
  const valor = parseNum(b?.valor)
  const data = parseData(b?.data)
  if (!descricao || valor <= 0 || !data) return NextResponse.json({ error: 'Informe descrição, valor e data.' }, { status: 400 })

  let comprovante: string | null = null
  try { comprovante = (normalizarImagemEntrada(b?.comprovante) ?? null) as string | null }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }

  const base = {
    tipo: b?.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA',
    categoriaId: b?.categoriaId || null, contaId: b?.contaId || null, caixinhaId: b?.caixinhaId || null,
    metodo: METODOS.includes(String(b?.metodo || '').toUpperCase()) ? String(b.metodo).toUpperCase() : null,
    descricao, valor, data, referencia: b?.referencia || null, observacoes: b?.observacoes || null,
    status: b?.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO', comprovante,
  }
  const recorrencia = b?.recorrencia === 'MENSAL' || b?.recorrencia === 'PARCELAS' ? b.recorrencia : null

  if (!recorrencia) {
    const id = await inserir(g.userId, { ...base, recorrenciaId: null, recorrencia: null, parcela: null, totalParcelas: null })
    // Envelope: aplica o movimento na caixinha (DESPESA→RETIRADA, RECEITA→DEPOSITO).
    await aplicarMovCaixinhaDoLancamento(g.userId, id, { tipo: base.tipo, valor, caixinhaId: base.caixinhaId, contaId: base.contaId, data, descricao })
    // Flag "levar para minha agenda": cria tarefa (com prazo + lembrete) e/ou nota pessoal vinculada.
    if (b?.agenda || b?.nota) {
      const lembreteDias = (b?.lembreteDias === '' || b?.lembreteDias == null) ? null : Number(b.lembreteDias)
      await sincronizarVinculoPessoal({ userId: g.userId, lancamentoId: id, descricao, valor, data, tipo: base.tipo, agenda: !!b.agenda, nota: !!b.nota, origemTipo: ORIGEM_PESSOAL, lembreteDias, pago: base.status === 'PAGO' })
    }
    return NextResponse.json({ ok: true, id }, { status: 201 })
  }
  const recId = gid()
  const total = recorrencia === 'PARCELAS' ? Math.max(1, Math.min(60, Number(b?.totalParcelas || 1))) : 24
  for (let i = 0; i < total; i++) {
    await inserir(g.userId, {
      ...base,
      caixinhaId: null, // envelope de caixinha não se aplica a recorrência/parcelamento
      descricao: recorrencia === 'PARCELAS' ? `${descricao} (${i + 1}/${total})` : descricao,
      data: addMeses(data, i),
      status: i === 0 ? base.status : 'PENDENTE',
      comprovante: i === 0 ? base.comprovante : null,
      recorrenciaId: recId, recorrencia, parcela: i + 1, totalParcelas: recorrencia === 'PARCELAS' ? total : null,
    })
  }
  return NextResponse.json({ ok: true, recorrenciaId: recId, total }, { status: 201 })
}
