// Lançamentos pessoais (espelho de FinLancamento): GET com filtros (período/tipo/categoria/
// canal/status) + POST com recorrência (MENSAL/PARCELAS) e status (PENDENTE/PAGO). Escopo por userId.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardPessoal, serialize, gid, parseNum, parseData } from '@/lib/pessoal/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await guardPessoal(); if ('erro' in g) return g.erro
  const sp = new URL(req.url).searchParams
  const tipo = ['RECEITA', 'DESPESA'].includes(sp.get('tipo') || '') ? sp.get('tipo') : null
  const status = ['PENDENTE', 'PAGO'].includes(sp.get('status') || '') ? sp.get('status') : null
  const mes = sp.get('mes') && !isNaN(Number(sp.get('mes'))) ? Number(sp.get('mes')) : null
  const ano = sp.get('ano') && !isNaN(Number(sp.get('ano'))) ? Number(sp.get('ano')) : null
  const de = parseData(sp.get('de')), ate = parseData(sp.get('ate'))
  const catId = sp.get('categoriaId') || null
  const canal = sp.get('canal') || null

  const cond: string[] = [`l."userId" = $1`]
  const p: any[] = [g.userId]
  if (tipo)   { p.push(tipo);   cond.push(`l."tipo" = $${p.length}`) }
  if (status) { p.push(status); cond.push(`l."status" = $${p.length}`) }
  if (mes)    { p.push(mes);    cond.push(`EXTRACT(MONTH FROM l."data") = $${p.length}`) }
  if (ano)    { p.push(ano);    cond.push(`EXTRACT(YEAR FROM l."data") = $${p.length}`) }
  if (de)     { p.push(de);     cond.push(`l."data" >= $${p.length}::date`) }
  if (ate)    { p.push(ate);    cond.push(`l."data" <= $${p.length}::date`) }
  if (catId)  { p.push(catId);  cond.push(`l."categoriaId" = $${p.length}`) }
  if (canal)  { p.push(canal);  cond.push(`l."canal" = $${p.length}`) }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT l."id", l."tipo", l."categoriaId", l."descricao", l."valor"::float AS valor, l."data",
           l."canal", l."referencia", l."observacoes", l."status", l."recorrenciaId", l."recorrencia",
           l."parcela", l."totalParcelas",
           c."nome" AS "categoriaNome", c."cor" AS "categoriaCor", c."icone" AS "categoriaIcone"
    FROM "PessoalLancamento" l
    LEFT JOIN "PessoalCategoria" c ON c."id" = l."categoriaId"
    WHERE ${cond.join(' AND ')}
    ORDER BY l."data" DESC, l."createdAt" DESC
  `, ...p)
  return NextResponse.json(serialize(rows))
}

function addMeses(dataISO: string, n: number): string {
  const d = new Date(dataISO + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10)
}

async function inserir(userId: string, r: {
  tipo: string; categoriaId: string | null; descricao: string; valor: number; data: string
  canal: string | null; referencia: string | null; observacoes: string | null; status: string
  recorrenciaId: string | null; recorrencia: string | null; parcela: number | null; totalParcelas: number | null
}) {
  const id = gid()
  await prisma.$executeRaw`
    INSERT INTO "PessoalLancamento"
      ("id","userId","tipo","categoriaId","descricao","valor","data","canal","referencia","observacoes",
       "origem","status","recorrenciaId","recorrencia","parcela","totalParcelas","createdAt")
    VALUES (${id}, ${userId}, ${r.tipo}, ${r.categoriaId}, ${r.descricao}, ${r.valor}, ${r.data}::date,
            ${r.canal}, ${r.referencia}, ${r.observacoes}, 'MANUAL', ${r.status}, ${r.recorrenciaId},
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

  const base = {
    tipo: b?.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA',
    categoriaId: b?.categoriaId || null, descricao, valor, data,
    canal: b?.canal || null, referencia: b?.referencia || null, observacoes: b?.observacoes || null,
    status: b?.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO',
  }
  const recorrencia = b?.recorrencia === 'MENSAL' || b?.recorrencia === 'PARCELAS' ? b.recorrencia : null

  if (!recorrencia) {
    const id = await inserir(g.userId, { ...base, recorrenciaId: null, recorrencia: null, parcela: null, totalParcelas: null })
    return NextResponse.json({ ok: true, id }, { status: 201 })
  }
  const recId = gid()
  const total = recorrencia === 'PARCELAS' ? Math.max(1, Math.min(60, Number(b?.totalParcelas || 1))) : 24
  for (let i = 0; i < total; i++) {
    await inserir(g.userId, {
      ...base,
      descricao: recorrencia === 'PARCELAS' ? `${descricao} (${i + 1}/${total})` : descricao,
      data: addMeses(data, i),
      status: i === 0 ? base.status : 'PENDENTE',
      recorrenciaId: recId, recorrencia, parcela: i + 1, totalParcelas: recorrencia === 'PARCELAS' ? total : null,
    })
  }
  return NextResponse.json({ ok: true, recorrenciaId: recId, total }, { status: 201 })
}
