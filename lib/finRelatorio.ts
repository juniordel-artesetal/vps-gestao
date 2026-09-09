// Monta as LINHAS dos relatórios financeiros a partir dos MESMOS filtros das telas, para que o
// que é exportado seja exatamente o que está na tela. Usa a regra única de lib/finRealizado —
// parcial e pendente aparecem com o que já se moveu e com o que falta, lado a lado.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ondeRealizado, ondeAberto, valorRealizado, valorAberto } from '@/lib/finRealizado'

export type FonteRelatorio = 'previstos' | 'lancamentos'

export interface FiltroRelatorio {
  fonte: FonteRelatorio
  de?: string | null
  ate?: string | null
  tipo?: string | null          // RECEITA | DESPESA
  status?: string | null        // só para 'lancamentos'
  categoriaId?: string | null
  contaId?: string | null
  busca?: string | null
  vencidas?: boolean            // só para 'previstos'
}

export interface LinhaRelatorio {
  Data: string
  Tipo: string
  Descricao: string
  Categoria: string
  Conta: string
  Situacao: string
  Valor: number
  Realizado: number
  EmAberto: number
}

const SITUACAO: Record<string, string> = {
  PAGO: 'Pago / recebido',
  PARCIAL: 'Parcial (em aberto)',
  PENDENTE: 'Pendente (previsto)',
}

export async function linhasRelatorio(workspaceId: string, f: FiltroRelatorio): Promise<{ linhas: LinhaRelatorio[]; totais: { valor: number; realizado: number; emAberto: number } }> {
  const fDe = f.de ? Prisma.sql`AND l."data" >= ${f.de}::date` : Prisma.empty
  const fAte = f.ate ? Prisma.sql`AND l."data" <= ${f.ate}::date` : Prisma.empty
  const fTipo = f.tipo === 'RECEITA' || f.tipo === 'DESPESA' ? Prisma.sql`AND l."tipo" = ${f.tipo}` : Prisma.empty
  const fCat = f.categoriaId ? Prisma.sql`AND l."categoriaId" = ${f.categoriaId}` : Prisma.empty
  const fConta = f.contaId ? Prisma.sql`AND l."contaId" = ${f.contaId}` : Prisma.empty
  const fBusca = f.busca
    ? Prisma.sql`AND (l."descricao" ILIKE ${'%' + f.busca + '%'} OR l."referencia" ILIKE ${'%' + f.busca + '%'})`
    : Prisma.empty

  // 'previstos' = só o que está em aberto; 'lancamentos' = tudo (com filtro de status opcional).
  const fFonte = f.fonte === 'previstos'
    ? Prisma.sql`AND ${ondeAberto('l')} ${f.vencidas ? Prisma.sql`AND l."data" < CURRENT_DATE` : Prisma.empty}`
    : (f.status ? Prisma.sql`AND l."status" = ${f.status}` : Prisma.empty)

  const rows = await prisma.$queryRaw`
    SELECT TO_CHAR(l."data", 'DD/MM/YYYY') AS "Data",
           l."tipo" AS "tipoRaw",
           l."descricao" AS "Descricao",
           COALESCE(c."nome", 'Sem categoria') AS "Categoria",
           COALESCE(fc."nome", '—') AS "Conta",
           l."status" AS "statusRaw",
           l."valor"::float AS "Valor",
           (CASE WHEN ${ondeRealizado('l')} THEN ${valorRealizado('l')} ELSE 0 END)::float AS "Realizado",
           (CASE WHEN ${ondeAberto('l')} THEN ${valorAberto('l')} ELSE 0 END)::float AS "EmAberto"
    FROM "FinLancamento" l
    LEFT JOIN "FinCategoria" c ON c."id" = l."categoriaId"
    LEFT JOIN "FinConta" fc ON fc."id" = l."contaId"
    WHERE l."workspaceId" = ${workspaceId}
      ${fFonte} ${fDe} ${fAte} ${fTipo} ${fCat} ${fConta} ${fBusca}
    ORDER BY l."data" ASC, l."createdAt" ASC
    LIMIT 5000
  ` as any[]

  const linhas: LinhaRelatorio[] = rows.map(r => ({
    Data: r.Data,
    Tipo: r.tipoRaw === 'RECEITA' ? 'Entrada' : 'Saída',
    Descricao: r.Descricao || '',
    Categoria: r.Categoria,
    Conta: r.Conta,
    Situacao: SITUACAO[r.statusRaw] || r.statusRaw || '',
    Valor: Number(r.Valor) || 0,
    Realizado: Number(r.Realizado) || 0,
    EmAberto: Number(r.EmAberto) || 0,
  }))

  const totais = linhas.reduce(
    (a, l) => ({ valor: a.valor + l.Valor, realizado: a.realizado + l.Realizado, emAberto: a.emAberto + l.EmAberto }),
    { valor: 0, realizado: 0, emAberto: 0 },
  )
  const r2 = (n: number) => Math.round(n * 100) / 100
  return { linhas, totais: { valor: r2(totais.valor), realizado: r2(totais.realizado), emAberto: r2(totais.emAberto) } }
}

/** Lê os filtros da querystring (mesmos nomes que as telas usam). */
export function filtrosDaUrl(url: URL): FiltroRelatorio {
  const p = url.searchParams
  const fonte = p.get('fonte') === 'lancamentos' ? 'lancamentos' : 'previstos'
  return {
    fonte,
    de: p.get('de'), ate: p.get('ate'),
    tipo: p.get('tipo'), status: p.get('status'),
    categoriaId: p.get('categoriaId'), contaId: p.get('contaId'),
    busca: (p.get('busca') || '').trim() || null,
    vencidas: p.get('vencidas') === '1',
  }
}

/** Título humano do relatório, já com o recorte aplicado. */
export function tituloRelatorio(f: FiltroRelatorio): string {
  const base = f.fonte === 'previstos' ? 'A pagar e a receber' : 'Entradas e Saídas'
  const periodo = f.de || f.ate ? ` — ${f.de ? f.de.split('-').reverse().join('/') : 'início'} a ${f.ate ? f.ate.split('-').reverse().join('/') : 'hoje'}` : ''
  return base + periodo
}
