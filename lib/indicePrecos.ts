import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
const brlNum = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

// Upsert do snapshot do dia (constrói histórico próprio). Só chamar com amostra suficiente.
export async function upsertSnapshot(qn: string, medio: number, menor: number, fontes: number) {
  const hoje = new Date().toISOString().split('T')[0]
  await prisma.$executeRaw`
    INSERT INTO "PrecoIndiceSnapshot" ("id","normNome","data","precoMedio","precoMenor","fontes")
    VALUES (${novoId()}, ${qn}, ${hoje}::date, ${medio}, ${menor}, ${fontes})
    ON CONFLICT ("normNome","data") DO UPDATE SET "precoMedio"=${medio}, "precoMenor"=${menor}, "fontes"=${fontes}
  `
}

// Avalia os alertas ativos de um normNome e cria Notificacao (idempotente por dia).
// Chamada tanto pela busca (oportunista) quanto pelo cron.
export async function avaliarAlertasParaNorm(qn: string): Promise<number> {
  const hoje = new Date().toISOString().split('T')[0]
  const snaps = await prisma.$queryRaw`
    SELECT TO_CHAR("data",'YYYY-MM-DD') AS "data", "precoMedio"::float AS "medio"
    FROM "PrecoIndiceSnapshot" WHERE "normNome"=${qn} ORDER BY "data" DESC LIMIT 2
  ` as { data: string; medio: number }[]
  if (snaps.length === 0) return 0
  const medioHoje = Number(snaps[0].medio)
  const medioAnterior = snaps[1] ? Number(snaps[1].medio) : null

  const alertas = await prisma.$queryRaw`
    SELECT "id","workspaceId","userId","termo","condicao","valorAlvo"::float AS "valorAlvo"
    FROM "PesquisaAlerta"
    WHERE "normNome"=${qn} AND "ativo"=true AND ("ultimaNotificacao" IS NULL OR "ultimaNotificacao" < ${hoje}::date)
  ` as any[]

  let disparados = 0
  for (const a of alertas) {
    let dispara = false, motivo = ''
    if (a.condicao === 'abaixo_de' && a.valorAlvo && medioHoje <= Number(a.valorAlvo)) {
      dispara = true; motivo = `O preço médio (${brlNum(medioHoje)}) chegou no seu alvo (${brlNum(Number(a.valorAlvo))}).`
    } else if (a.condicao === 'queda' && medioAnterior && medioHoje < medioAnterior * 0.97) {
      dispara = true; motivo = `O preço caiu para ${brlNum(medioHoje)} (estava ${brlNum(medioAnterior)}).`
    }
    if (!dispara) continue
    await prisma.$executeRaw`
      INSERT INTO "Notificacao" ("id","workspaceId","userId","tipo","titulo","mensagem","href","lida","createdAt")
      VALUES (${novoId()}, ${a.workspaceId}, ${a.userId}, 'preco', ${'Bom momento: ' + (a.termo || qn)}, ${motivo}, '/pesquisa-preco', false, NOW())
    `
    await prisma.$executeRaw`UPDATE "PesquisaAlerta" SET "ultimaNotificacao"=${hoje}::date WHERE "id"=${a.id}`
    disparados++
  }
  return disparados
}

// Semeia o histórico a partir das compras de fornecedor (datas reais), de forma
// ANÔNIMA/AGREGADA: só cria snapshot para (normNome, dia) com >= MIN_FONTES workspaces.
export async function seedHistoricoDeCompras(): Promise<number> {
  const compras = await prisma.$queryRaw`
    SELECT "descricao", "valor"::float AS "valor", TO_CHAR("data",'YYYY-MM-DD') AS "dia", "workspaceId"
    FROM "FornecedorCompra"
    WHERE "descricao" IS NOT NULL AND COALESCE("valor",0) > 0 AND "data" IS NOT NULL AND "data" >= CURRENT_DATE - 180
  ` as { descricao: string; valor: number; dia: string; workspaceId: string }[]

  // Agrupa por (normNome, dia)
  const grupos = new Map<string, { valores: number[]; ws: Set<string>; qn: string; dia: string }>()
  for (const c of compras) {
    const qn = normNome(c.descricao)
    if (!qn || qn.length < 2) continue
    const key = qn + '|' + c.dia
    const g = grupos.get(key) || { valores: [], ws: new Set<string>(), qn, dia: c.dia }
    g.valores.push(Number(c.valor)); g.ws.add(c.workspaceId)
    grupos.set(key, g)
  }
  let criados = 0
  for (const g of grupos.values()) {
    if (g.ws.size < MIN_FONTES) continue // anonimato + amostra mínima
    const medio = g.valores.reduce((a, b) => a + b, 0) / g.valores.length
    const menor = Math.min(...g.valores)
    await prisma.$executeRaw`
      INSERT INTO "PrecoIndiceSnapshot" ("id","normNome","data","precoMedio","precoMenor","fontes")
      VALUES (${novoId()}, ${g.qn}, ${g.dia}::date, ${medio}, ${menor}, ${g.ws.size})
      ON CONFLICT ("normNome","data") DO NOTHING
    `
    criados++
  }
  return criados
}

// Índice de preços de mercado — AGREGADO e ANÔNIMO entre workspaces.
// ★NUNCA★ retorna linhas individuais nem identifica workspace/artesã.
// Só devolve estatísticas quando há amostra mínima de FONTES DISTINTAS.
export const MIN_FONTES = 4

export type IndiceResultado =
  | { suficiente: false; motivo: 'termo_curto' | 'amostra_insuficiente'; nFontes?: number }
  | {
      suficiente: true
      termo: string
      normNome: string
      menor: number
      medio: number
      faixaMin: number
      faixaMax: number
      nFontes: number
      nAmostras: number
      unidade: string | null
      confiabilidade: 'baixa' | 'media' | 'alta'
      ondeComprar: { fornecedor: string; precoMedio: number; nCompras: number }[]
    }

function percentil(ordenado: number[], p: number): number {
  if (ordenado.length === 0) return 0
  const idx = Math.min(ordenado.length - 1, Math.max(0, Math.floor((p / 100) * ordenado.length)))
  return ordenado[idx]
}
function maisComum(vals: (string | null)[]): string | null {
  const m = new Map<string, number>()
  for (const v of vals) { const s = (v || '').trim(); if (!s) continue; m.set(s, (m.get(s) || 0) + 1) }
  let melhor: string | null = null, max = 0
  for (const [k, n] of m) if (n > max) { max = n; melhor = k }
  return melhor
}

export async function calcularIndice(query: string): Promise<IndiceResultado> {
  const qn = normNome(query)
  if (!qn || qn.length < 2) return { suficiente: false, motivo: 'termo_curto' }

  // Termo SQL amplo (primeira palavra significativa) só para NARROW; o match fino é por normNome.
  const termoBusca = (query.trim().split(/\s+/).find(w => w.length >= 3) || query.trim())
  const like = `%${termoBusca}%`

  // Leitura AGREGADA de todos os workspaces (nunca retornada ao cliente).
  const rows = await prisma.$queryRaw`
    SELECT "nome", "precoUnidade"::float AS "preco", "unidade", "workspaceId", "fornecedor"
    FROM "PrecMaterial"
    WHERE "ativo" = true AND COALESCE("precoUnidade", 0) > 0 AND "nome" ILIKE ${like}
    LIMIT 4000
  ` as { nome: string; preco: number; unidade: string | null; workspaceId: string; fornecedor: string | null }[]

  const matched = rows.filter(r => {
    const n = normNome(r.nome)
    return n === qn || n.includes(qn) || qn.includes(n)
  })

  const precos = matched.map(r => Number(r.preco)).filter(v => v > 0).sort((a, b) => a - b)
  const fontes = new Set(matched.map(r => r.workspaceId))
  const nFontes = fontes.size

  if (nFontes < MIN_FONTES || precos.length < MIN_FONTES)
    return { suficiente: false, motivo: 'amostra_insuficiente', nFontes }

  const menor = precos[0]
  const medio = precos.reduce((a, b) => a + b, 0) / precos.length

  // Onde comprar (orgânico): por fornecedor, SÓ se aparecer em ≥ 2 workspaces (anonimato).
  const porForn = new Map<string, { precos: number[]; ws: Set<string> }>()
  for (const r of matched) {
    const f = String(r.fornecedor || '').trim()
    if (!f) continue
    const g = porForn.get(f) || { precos: [], ws: new Set<string>() }
    g.precos.push(Number(r.preco)); g.ws.add(r.workspaceId)
    porForn.set(f, g)
  }
  const ondeComprar = [...porForn.entries()]
    .filter(([, g]) => g.ws.size >= 2)
    .map(([f, g]) => ({ fornecedor: f, precoMedio: g.precos.reduce((a, b) => a + b, 0) / g.precos.length, nCompras: g.precos.length }))
    .sort((a, b) => a.precoMedio - b.precoMedio)
    .slice(0, 6)

  const confiabilidade = nFontes >= 25 ? 'alta' : nFontes >= 10 ? 'media' : 'baixa'

  return {
    suficiente: true,
    termo: query.trim(),
    normNome: qn,
    menor,
    medio,
    faixaMin: percentil(precos, 25),
    faixaMax: percentil(precos, 75),
    nFontes,
    nAmostras: precos.length,
    unidade: maisComum(matched.map(r => r.unidade)),
    confiabilidade,
    ondeComprar,
  }
}
