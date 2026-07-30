// Monitoramento semanal de taxas de canais SEM API oficial (Shopee, TikTok Shop).
// A rotina CONSULTA a fonte, detecta mudança e ALERTA o Master — NUNCA altera preço.
// (Mercado Livre tem API própria e é tratado por lib/mlTaxas.ts.)
import { prisma } from '@/lib/prisma'
import crypto from 'node:crypto'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// Fontes oficiais de tarifas por canal (páginas do Seller). O Master pode trocar a URL.
export const CANAIS_MONITORADOS: { canal: string; nome: string; url: string }[] = [
  { canal: 'shopee',     nome: 'Shopee',      url: 'https://seller.shopee.com.br/edu/article/6090' },
  { canal: 'tiktokshop', nome: 'TikTok Shop', url: 'https://seller-br.tiktok.com/university/essay?knowledge_id=10007707' },
]

let ok = false
export async function ensureCanaisMonitor(): Promise<void> {
  if (ok) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CanalMonitor" (
      "canal"             TEXT PRIMARY KEY,
      "nome"              TEXT,
      "urlFonte"          TEXT,
      "ultimaVerificacao" TIMESTAMPTZ,
      "hashConteudo"      TEXT,
      "ultimoStatus"      TEXT,
      "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CanalRevisao" (
      "id"           TEXT PRIMARY KEY,
      "canal"        TEXT NOT NULL,
      "tipo"         TEXT NOT NULL DEFAULT 'mudanca-fonte',
      "resumo"       TEXT NOT NULL,
      "detalhe"      JSONB,
      "status"       TEXT NOT NULL DEFAULT 'pendente',
      "detectadoEm"  TIMESTAMPTZ NOT NULL DEFAULT now(),
      "resolvidoEm"  TIMESTAMPTZ,
      "resolvidoPor" TEXT
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CanalRevisao_status_idx" ON "CanalRevisao" ("status")`)
  // Semeia os canais monitorados (não sobrescreve URL editada pelo Master)
  for (const c of CANAIS_MONITORADOS) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CanalMonitor" ("canal","nome","urlFonte") VALUES ($1,$2,$3) ON CONFLICT ("canal") DO NOTHING`,
      c.canal, c.nome, c.url,
    )
  }
  ok = true
}

// Baixa a página da fonte e devolve um hash estável do conteúdo textual relevante.
async function hashDaFonte(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'SOA-monitor/1.0 (+https://app.vps-gestao.com.br)' } })
    clearTimeout(t)
    if (!r.ok) return null
    const html = await r.text()
    // Normaliza: remove scripts/estilos/tags/espaços e mantém dígitos e '%' (onde a taxa mora).
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim()
    if (!texto) return null
    return crypto.createHash('sha256').update(texto).digest('hex')
  } catch {
    return null
  }
}

async function jaTemPendente(canal: string): Promise<boolean> {
  const r = await prisma.$queryRaw`SELECT 1 FROM "CanalRevisao" WHERE "canal" = ${canal} AND "status" = 'pendente' LIMIT 1` as any[]
  return r.length > 0
}

export interface ResultadoVerificacao {
  verificados: number
  alertas: number
  detalhes: { canal: string; status: string; alertou: boolean }[]
  dryRun: boolean
}

/**
 * Verifica cada canal monitorado. Detecta mudança comparando o hash da fonte com
 * o último salvo. Se mudou (e havia um hash anterior 'ok'), cria uma REVISÃO
 * pendente para o Master — sem tocar em CatalogoCanal nem em preço.
 *
 * dryRun: verifica e reporta, mas não grava hash/verificação nem alerta.
 * simular: força uma mudança detectada no(s) canal(is) — para validação.
 */
export async function verificarCanais(opts: { dryRun?: boolean; simular?: string | null } = {}): Promise<ResultadoVerificacao> {
  await ensureCanaisMonitor()
  const dryRun = !!opts.dryRun
  const simularAlvo = (opts.simular || '').toLowerCase()

  const monitores = await prisma.$queryRaw`
    SELECT "canal","nome","urlFonte","hashConteudo","ultimoStatus" FROM "CanalMonitor"
  ` as { canal: string; nome: string; urlFonte: string | null; hashConteudo: string | null; ultimoStatus: string | null }[]

  const detalhes: { canal: string; status: string; alertou: boolean }[] = []
  let alertas = 0

  for (const m of monitores) {
    const simulado = simularAlvo === 'all' || simularAlvo === m.canal
    const novoHash = m.urlFonte ? await hashDaFonte(m.urlFonte) : null
    const fetchOk = novoHash !== null

    // Mudança real: tínhamos um hash 'ok' anterior e ele diferiu agora.
    const mudouReal = fetchOk && !!m.hashConteudo && m.ultimoStatus === 'ok' && novoHash !== m.hashConteudo
    const deveAlertar = simulado || mudouReal

    let status = fetchOk ? (deveAlertar ? 'mudou' : 'ok') : 'erro'
    let alertou = false

    if (deveAlertar && !dryRun && !(await jaTemPendente(m.canal))) {
      const resumo = simulado
        ? `Mudança SIMULADA na taxa do ${m.nome} — revisar o catálogo.`
        : `A página oficial de tarifas do ${m.nome} mudou — pode haver alteração de taxa. Revisar.`
      await prisma.$executeRaw`
        INSERT INTO "CanalRevisao" ("id","canal","tipo","resumo","detalhe","status")
        VALUES (${gerarId()}, ${m.canal}, ${simulado ? 'simulado' : 'mudanca-fonte'}, ${resumo},
                ${JSON.stringify({ url: m.urlFonte, hashAnterior: m.hashConteudo, hashNovo: novoHash })}::jsonb, 'pendente')
      `
      alertou = true
      alertas++
    }

    // Atualiza estado do monitor (não em dryRun). Em erro de fetch, mantém o hash anterior.
    if (!dryRun) {
      await prisma.$executeRaw`
        UPDATE "CanalMonitor"
        SET "ultimaVerificacao" = NOW(),
            "ultimoStatus" = ${status},
            "hashConteudo" = ${fetchOk ? novoHash : m.hashConteudo}
        WHERE "canal" = ${m.canal}
      `
    }
    detalhes.push({ canal: m.canal, status, alertou })
  }

  return { verificados: monitores.length, alertas, detalhes, dryRun }
}

// ── Leitura para o Master ──────────────────────────────────────────────
export async function contarRevisoesPendentes(): Promise<number> {
  await ensureCanaisMonitor()
  const r = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "CanalRevisao" WHERE "status" = 'pendente'` as { n: number }[]
  return r[0]?.n ?? 0
}

export async function listarRevisoes(status = 'pendente') {
  await ensureCanaisMonitor()
  const rev = await prisma.$queryRaw`
    SELECT "id","canal","tipo","resumo","detalhe","status","detectadoEm","resolvidoEm","resolvidoPor"
    FROM "CanalRevisao" WHERE "status" = ${status} ORDER BY "detectadoEm" DESC
  ` as any[]
  const mon = await prisma.$queryRaw`
    SELECT "canal","nome","urlFonte","ultimaVerificacao","ultimoStatus" FROM "CanalMonitor" ORDER BY "canal"
  ` as any[]
  return { revisoes: rev, monitores: mon }
}

export async function resolverRevisao(id: string, por: string): Promise<boolean> {
  await ensureCanaisMonitor()
  const r = await prisma.$executeRaw`
    UPDATE "CanalRevisao" SET "status" = 'resolvido', "resolvidoEm" = NOW(), "resolvidoPor" = ${por.slice(0, 60)}
    WHERE "id" = ${id} AND "status" = 'pendente'
  `
  return Number(r) > 0
}
