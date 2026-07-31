// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS FINANCEIRAS DA SOFIA — dados reais, SOMENTE LEITURA, escopadas por
// workspaceId. Mesma regra da Visão Geral do Financeiro (reconciliação):
//   realizado = status 'PAGO' com COALESCE("valorRealizado", valor);
//   a receber/pagar = status 'PENDENTE'.
// Nada de SELECT *. LGPD: só agregados da própria artesã. A Sofia INTERPRETA o
// número (1 frase), mas NUNCA promete resultado/faturamento.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'

const nowYM = () => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 } }

export interface ResumoFin {
  ano: number; mes: number
  receita: number; despesa: number; resultado: number; margem: number
  aReceber: number; aPagar: number; qtdPago: number; ticketMedio: number
  saldoCaixa: number
  mesAnterior: { receita: number; despesa: number; resultado: number; margem: number }
}

/** Resumo financeiro do mês (P&L realizado) + comparativo com o mês anterior + saldo de caixa. */
export async function resumoFinanceiro(workspaceId: string, ano?: number, mes?: number): Promise<ResumoFin> {
  const ym = nowYM(); ano = ano ?? ym.ano; mes = mes ?? ym.mes
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano

  const mesRows = await prisma.$queryRaw`
    SELECT tipo,
      COALESCE(SUM(CASE WHEN status='PAGO'     THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS realizado,
      COALESCE(SUM(CASE WHEN status='PENDENTE' THEN valor ELSE 0 END),0)::float AS pendente,
      COUNT(CASE WHEN tipo='RECEITA' AND status='PAGO' THEN 1 END)::int AS qtdpago
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND EXTRACT(YEAR FROM data)=${ano} AND EXTRACT(MONTH FROM data)=${mes}
    GROUP BY tipo
  ` as { tipo: string; realizado: number; pendente: number; qtdpago: number }[]

  const antRows = await prisma.$queryRaw`
    SELECT tipo, COALESCE(SUM(CASE WHEN status='PAGO' THEN COALESCE("valorRealizado",valor) ELSE 0 END),0)::float AS realizado
    FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND EXTRACT(YEAR FROM data)=${anoAnt} AND EXTRACT(MONTH FROM data)=${mesAnt}
    GROUP BY tipo
  ` as { tipo: string; realizado: number }[]

  // Saldo de caixa = líquido realizado acumulado (todos os tempos).
  const [caixa] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(CASE WHEN tipo='RECEITA' THEN COALESCE("valorRealizado",valor) ELSE -COALESCE("valorRealizado",valor) END),0)::float AS saldo
    FROM "FinLancamento" WHERE "workspaceId"=${workspaceId} AND status='PAGO'
  ` as { saldo: number }[]

  const rec = mesRows.find(r => r.tipo === 'RECEITA')
  const desp = mesRows.find(r => r.tipo === 'DESPESA')
  const receita = Number(rec?.realizado || 0)
  const despesa = Number(desp?.realizado || 0)
  const resultado = receita - despesa
  const margem = receita > 0 ? (resultado / receita) * 100 : 0
  const qtdPago = Number(rec?.qtdpago || 0)

  const recA = Number(antRows.find(r => r.tipo === 'RECEITA')?.realizado || 0)
  const despA = Number(antRows.find(r => r.tipo === 'DESPESA')?.realizado || 0)
  const resA = recA - despA

  return {
    ano, mes, receita, despesa, resultado, margem: +margem.toFixed(1),
    aReceber: Number(rec?.pendente || 0), aPagar: Number(desp?.pendente || 0),
    qtdPago, ticketMedio: qtdPago > 0 ? +(receita / qtdPago).toFixed(2) : 0,
    saldoCaixa: Number(caixa?.saldo || 0),
    mesAnterior: { receita: recA, despesa: despA, resultado: resA, margem: recA > 0 ? +((resA / recA) * 100).toFixed(1) : 0 },
  }
}

export interface DespesaCat { categoria: string; total: number; pct: number }
/** Maiores despesas do mês por categoria (realizado). */
export async function maioresDespesas(workspaceId: string, ano?: number, mes?: number): Promise<DespesaCat[]> {
  const ym = nowYM(); ano = ano ?? ym.ano; mes = mes ?? ym.mes
  const rows = await prisma.$queryRaw`
    SELECT COALESCE(c.nome,'Sem categoria') AS categoria, COALESCE(SUM(COALESCE(l."valorRealizado",l.valor)),0)::float AS total
    FROM "FinLancamento" l LEFT JOIN "FinCategoria" c ON c.id = l."categoriaId"
    WHERE l."workspaceId"=${workspaceId} AND l.tipo='DESPESA' AND l.status='PAGO'
      AND EXTRACT(YEAR FROM l.data)=${ano} AND EXTRACT(MONTH FROM l.data)=${mes}
    GROUP BY c.nome ORDER BY total DESC LIMIT 6
  ` as { categoria: string; total: number }[]
  const tot = rows.reduce((s, r) => s + Number(r.total), 0)
  return rows.map(r => ({ categoria: r.categoria, total: Number(r.total), pct: tot > 0 ? +((Number(r.total) / tot) * 100).toFixed(0) : 0 }))
}

export interface MetaMes { temMeta: boolean; metaReceita: number; realizado: number; pct: number; falta: number }
/** Meta de receita do mês vs realizado. */
export async function metaDoMes(workspaceId: string, ano?: number, mes?: number): Promise<MetaMes> {
  const ym = nowYM(); ano = ano ?? ym.ano; mes = mes ?? ym.mes
  const [m] = await prisma.$queryRaw`
    SELECT "metaReceita"::float AS meta FROM "FinMeta" WHERE "workspaceId"=${workspaceId} AND ano=${ano} AND mes=${mes} LIMIT 1
  ` as { meta: number }[]
  const [r] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(COALESCE("valorRealizado",valor)),0)::float AS realizado FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND tipo='RECEITA' AND status='PAGO'
      AND EXTRACT(YEAR FROM data)=${ano} AND EXTRACT(MONTH FROM data)=${mes}
  ` as { realizado: number }[]
  const metaReceita = Number(m?.meta || 0)
  const realizado = Number(r?.realizado || 0)
  return {
    temMeta: metaReceita > 0, metaReceita, realizado,
    pct: metaReceita > 0 ? +((realizado / metaReceita) * 100).toFixed(0) : 0,
    falta: Math.max(0, metaReceita - realizado),
  }
}

export interface DreResumo { receita: number; cmv: number; cmvPct: number; contribuicao: number; contribuicaoPct: number; despesaTotal: number; resultado: number; margem: number }
/** DRE simplificado: receita, CMV, margem de contribuição e resultado (mês, realizado). */
export async function dreResumo(workspaceId: string, ano?: number, mes?: number): Promise<DreResumo> {
  const ym = nowYM(); ano = ano ?? ym.ano; mes = mes ?? ym.mes
  const cats = await prisma.$queryRaw`
    SELECT COALESCE(c.nome,'Sem categoria') AS nome, c."grupoDRE" AS grupo,
           COALESCE(SUM(COALESCE(l."valorRealizado",l.valor)),0)::float AS total
    FROM "FinLancamento" l LEFT JOIN "FinCategoria" c ON c.id = l."categoriaId"
    WHERE l."workspaceId"=${workspaceId} AND l.tipo='DESPESA' AND l.status='PAGO'
      AND EXTRACT(YEAR FROM l.data)=${ano} AND EXTRACT(MONTH FROM l.data)=${mes}
    GROUP BY c.nome, c."grupoDRE"
  ` as { nome: string; grupo: string | null; total: number }[]
  const [rec] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(COALESCE("valorRealizado",valor)),0)::float AS receita FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND tipo='RECEITA' AND status='PAGO'
      AND EXTRACT(YEAR FROM data)=${ano} AND EXTRACT(MONTH FROM data)=${mes}
  ` as { receita: number }[]

  const palavrasCMV = ['material', 'mercadori', 'insumo', 'matéria', 'materia', 'produto', 'cmv', 'embalagem', 'custo prod']
  let cmv = 0, despesaTotal = 0
  const cmvPlano = cats.filter(c => c.grupo === 'cmv').reduce((s, c) => s + Number(c.total), 0)
  for (const c of cats) {
    const total = Number(c.total)
    despesaTotal += total
    if (cmvPlano === 0 && palavrasCMV.some(p => (c.nome || '').toLowerCase().includes(p))) cmv += total
  }
  if (cmvPlano > 0) cmv = cmvPlano
  const receita = Number(rec?.receita || 0)
  const contribuicao = receita - cmv
  const resultado = receita - despesaTotal
  return {
    receita, cmv, cmvPct: receita > 0 ? +((cmv / receita) * 100).toFixed(0) : 0,
    contribuicao, contribuicaoPct: receita > 0 ? +((contribuicao / receita) * 100).toFixed(0) : 0,
    despesaTotal, resultado, margem: receita > 0 ? +((resultado / receita) * 100).toFixed(1) : 0,
  }
}

export interface Conselho { texto: string; link?: string }
/** Conselhos proativos com base no DADO REAL da artesã. Nunca promete resultado; sugere, não pressiona. */
export async function gerarConselhos(workspaceId: string, ano?: number, mes?: number): Promise<Conselho[]> {
  const ym = nowYM(); ano = ano ?? ym.ano; mes = mes ?? ym.mes
  const [resumo, dre, meta, desps] = await Promise.all([
    resumoFinanceiro(workspaceId, ano, mes),
    dreResumo(workspaceId, ano, mes),
    metaDoMes(workspaceId, ano, mes),
    maioresDespesas(workspaceId, ano, mes),
  ])
  // Maior conta a pagar em aberto vencendo nos próximos 7 dias.
  const [maiorConta] = await prisma.$queryRaw`
    SELECT "descricao", "valor"::float AS valor, "data" FROM "FinLancamento"
    WHERE "workspaceId"=${workspaceId} AND tipo='DESPESA' AND status<>'PAGO'
      AND "data"::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    ORDER BY "valor" DESC LIMIT 1
  ` as { descricao: string; valor: number; data: any }[]

  const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const out: Conselho[] = []

  // 1. Margem caiu vs mês passado (só se havia base no mês anterior)
  if (resumo.mesAnterior.receita > 0 && resumo.receita > 0 && resumo.margem < resumo.mesAnterior.margem - 3) {
    out.push({ texto: `Sua margem caiu de ${resumo.mesAnterior.margem}% pra ${resumo.margem}% esse mês. Quer ver onde? Costuma ser custo de material ou taxa de canal.`, link: '/gestao/dre' })
  }
  // 2. CMV alto
  if (dre.receita > 0 && dre.cmvPct >= 45) {
    out.push({ texto: `Seu custo de material (CMV) está em ${dre.cmvPct}% do faturamento — tá pesado. Vale pesquisar preço e revisar a precificação.`, link: '/compras/visao' })
  }
  // 3. Caixa baixo vs contas a pagar em aberto
  if (resumo.saldoCaixa < resumo.aPagar && resumo.aPagar > 0) {
    out.push({ texto: `Seu caixa (${brl(resumo.saldoCaixa)}) está menor que o que você tem a pagar (${brl(resumo.aPagar)}). Olha o fluxo com carinho essa semana.`, link: '/financeiro/fluxo' })
  }
  // 4. Conta grande vencendo
  if (maiorConta && Number(maiorConta.valor) > 0) {
    out.push({ texto: `Tem uma conta de ${brl(Number(maiorConta.valor))} (${maiorConta.descricao}) vencendo nos próximos dias. Já separou?`, link: '/financeiro/lancamentos' })
  }
  // 5. Meta longe
  if (meta.temMeta && meta.pct < 70) {
    out.push({ texto: `Você está com ${meta.pct}% da meta do mês (faltam ${brl(meta.falta)}). Dá pra chegar — quer ver seus pedidos em aberto pra faturar?`, link: '/dashboard/pedidos' })
  }
  // 6. Resultado negativo
  if (resumo.receita > 0 && resumo.resultado < 0) {
    out.push({ texto: `Esse mês o resultado ficou negativo (${brl(resumo.resultado)}) — gastou mais do que entrou. Bora ver as maiores despesas${desps[0] ? ' (a maior é ' + desps[0].categoria + ')' : ''}?`, link: '/gestao/dre' })
  }
  return out.slice(0, 3)
}
