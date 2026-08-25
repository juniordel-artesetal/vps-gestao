// Cron diário de RECONCILIAÇÃO de trials — corrige a causa do "Ativo · TRIAL pra sempre":
// a régua de assinatura (/api/cron/assinaturas) só vê origem='asaas' e ignora Hotmart/null,
// então trial não-asaas nunca vence nem é promovido. Aqui rodamos as regras cruzando o
// pagamento real:
//   A (pagante Asaas confirmado OU compra Hotmart aprovada/completa) → promove TRIAL→ATIVA.
//   D1 (vencido, asaas, SEM pagamento) → bloqueia — SÓ com RECONCILIA_BLOQUEIA_D1='on'.
//   D2 (origem null/hotmart não verificável) → só lista p/ revisão manual (nunca auto-bloqueia).
//   B (cortesia/liberacaoManual), C (no prazo), E (teste) → não mexe.
// Idempotente e auditado (ReconciliacaoTrial). Chaves de provedor nunca aqui. RAW only.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { statusSoaPorEmail } from '@/lib/hotmart'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DIAS_TRIAL = 14, DIAS_CARENCIA = 7
const EMAIL_TESTE = /@teste\.|junior|natycosta|artesetal|@artese|naty@|@vps-gestao|@usesoa|@vps\.com|@t\.com/i
const SLUG_TESTE = new Set(['natielle-videos-67du'])
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

let tabelaOk = false
async function ensureAudit() {
  if (tabelaOk) return
  const [pronto] = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."ReconciliacaoTrial"') IS NOT NULL AS ok`) as { ok: boolean }[]
  if (!pronto?.ok) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ReconciliacaoTrial" (
        "id" text PRIMARY KEY, "workspaceId" text NOT NULL, "email" text,
        "deStatus" text, "paraStatus" text, "origem" text, "sinal" text, "motivo" text,
        "criadoEm" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId","paraStatus")
      )`)
  }
  tabelaOk = true
}

export async function POST(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  const bloqueiaD1 = String(process.env.RECONCILIA_BLOQUEIA_D1 || '').toLowerCase() === 'on'
  await ensureAudit()

  const rows = await prisma.$queryRawUnsafe(`
    SELECT w.id, w.slug, w."assinaturaOrigem" origem, w."liberacaoManual" lib, w."trialAte",
           (CURRENT_DATE - w."createdAt"::date) AS "idadeDias",
           adm.email,
           (SELECT (COUNT(*)>0) FROM "AsaasCobranca" c WHERE c."workspaceId"=w.id AND c.status IN ('CONFIRMED','RECEIVED') AND c.sandbox=false) "asaasPago",
           (SELECT h."evento" FROM "HotmartEvent" h WHERE h."workspaceId"=w.id ORDER BY h."createdAt" DESC LIMIT 1) "hotUlt",
           (SELECT COUNT(*)::int FROM "HotmartEvent" h WHERE h."workspaceId"=w.id) "hotN"
    FROM "Workspace" w
    LEFT JOIN LATERAL (SELECT u.email FROM "User" u WHERE u."workspaceId"=w.id ORDER BY (u.role='ADMIN') DESC LIMIT 1) adm ON true
    WHERE w."assinaturaStatus"='TRIAL' AND w."ativo"=true
  `) as any[]

  const res = { dryRun, analisadas: rows.length, promovidos: [] as any[], bloqueados: [] as any[], revisaoManual: [] as any[] }

  for (const w of rows) {
    if (SLUG_TESTE.has(w.slug) || EMAIL_TESTE.test(w.email || '') || w.lib) continue

    // Sinal de pagamento
    let sinal: string | null = null
    if (w.asaasPago) sinal = 'asaas-pago'
    else if (w.hotN > 0 || w.origem === 'hotmart') {
      // Valida na API Hotmart pelo PRODUTO SOA. O heurístico "último evento = compra"
      // super-promovia quem cancelou depois (validação 25/08: ~46 de 106 tinham
      // cancelado). A API é a verdade; o webhook vira só fallback sem credenciais.
      const soa = await statusSoaPorEmail(w.email)
      if (soa === 'ATIVA' || soa === 'ATRASO') sinal = `hotmart-api:${soa}`
      else if (soa === 'SEM_CRED' && /APPROVED|COMPLETE/i.test(w.hotUlt || '')) sinal = `hotmart-webhook:${w.hotUlt}`
      // CANCELADA / SEM_ASSINATURA / ERRO → não promove (fica TRIAL)
    }

    // A → promover
    if (sinal) {
      if (!dryRun) {
        const n = await prisma.$executeRawUnsafe(
          `UPDATE "Workspace" SET "assinaturaStatus"='ATIVA', "updatedAt"=NOW()
           WHERE "id"=$1 AND "assinaturaStatus"='TRIAL' AND "ativo"=true AND "liberacaoManual"=false`, w.id)
        if (Number(n) > 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "ReconciliacaoTrial" ("id","workspaceId","email","deStatus","paraStatus","origem","sinal","motivo","criadoEm")
             VALUES ($1,$2,$3,'TRIAL','ATIVA',$4,$5,'pagante confirmado marcado TRIAL', NOW())
             ON CONFLICT ("workspaceId","paraStatus") DO NOTHING`, gid(), w.id, w.email, w.origem ?? 'null', sinal)
          res.promovidos.push({ workspaceId: w.id, email: w.email, sinal })
        }
      } else res.promovidos.push({ workspaceId: w.id, email: w.email, sinal, dryRun: true })
      continue
    }

    // Vencido? (trialAte + carência, ou createdAt + 14 + carência)
    const refDias = w.trialAte
      ? Math.floor((Date.now() - new Date(w.trialAte).getTime()) / 86400000)
      : (Number(w.idadeDias) - DIAS_TRIAL)
    const vencido = refDias > DIAS_CARENCIA
    if (!vencido) continue // C — no prazo

    if (w.origem === 'asaas') {
      // D1 — vencido, asaas, sem pagamento
      if (bloqueiaD1 && !dryRun) {
        const n = await prisma.$executeRawUnsafe(
          `UPDATE "Workspace" SET "assinaturaStatus"='CORTADA', "ativo"=false, "updatedAt"=NOW()
           WHERE "id"=$1 AND "assinaturaStatus"='TRIAL' AND "ativo"=true AND "liberacaoManual"=false AND "assinaturaOrigem"='asaas'`, w.id)
        if (Number(n) > 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "ReconciliacaoTrial" ("id","workspaceId","email","deStatus","paraStatus","origem","sinal","motivo","criadoEm")
             VALUES ($1,$2,$3,'TRIAL','CORTADA','asaas',NULL,'trial vencido sem pagamento', NOW())
             ON CONFLICT ("workspaceId","paraStatus") DO NOTHING`, gid(), w.id, w.email)
          res.bloqueados.push({ workspaceId: w.id, email: w.email })
        }
      } else res.bloqueados.push({ workspaceId: w.id, email: w.email, aplicado: false, motivo: bloqueiaD1 ? 'dryRun' : 'flag RECONCILIA_BLOQUEIA_D1 OFF' })
    } else {
      // D2 — origem null/hotmart não verificável → revisão manual (nunca auto-bloqueia)
      res.revisaoManual.push({ workspaceId: w.id, email: w.email, origem: w.origem ?? 'null', hotEventos: w.hotN })
    }
  }

  console.log(`[CRON-RECONCILIA] ${dryRun ? '(dryRun) ' : ''}analisadas=${res.analisadas} promovidos=${res.promovidos.length} bloqueados=${res.bloqueados.filter((b:any)=>b.aplicado!==false).length} revisao=${res.revisaoManual.length}`)
  return NextResponse.json(res)
}
