// Master — Fase 2 do dunning: avisa (Resend, Equipe SOA) as clientes com mensalidade
// Asaas EM ATRASO (OVERDUE) sobre o não pagamento, com PRAZO de 2 DIAS pra regularizar
// e link pré-vinculado pra pagar. Tom acolhedor. Registra a data do alerta (alertaAtrasoEm)
// pra a Fase 3 (bloqueio) contar os 2 dias. Opt-out em todo e-mail; idempotente.
//
// GET  ?email= (opcional) → DRY-RUN: lista quem receberia (mascarado) + prévia do texto.
// POST → envia de verdade. Só quem tem OVERDUE, ativo=true e status fora de ATIVA/TRIAL/CANCELADA.
//
// Segurança: guarda master; Resend só em env; Prisma raw, sem SELECT *; escopo por workspace.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { garantirColuna } from '@/lib/ddlGuard'
import { tokenMigrar } from '@/lib/campanha/emails'
import { tokenOptOut } from '@/lib/reengajamento'
import { baseUrlDeHeaders } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

const REMETENTE = 'Equipe SOA <suporte@vps-gestao.com.br>'
const COOLDOWN_DIAS = 2 // não reenvia o alerta dentro da janela do prazo

let colOk = false
async function ensureColuna() {
  if (colOk) return
  await garantirColuna('Workspace', 'alertaAtrasoEm', 'timestamptz')
  colOk = true
}
async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

interface Alvo {
  workspaceId: string; nome: string; userId: string; nomePessoa: string | null; email: string
  valor: number; dias: number; alertadoEm: Date | null
}

// Clientes com cobrança Asaas OVERDUE, acessíveis (ativo) e não em dia/cancelada/trial.
async function listarAtrasadas(): Promise<Alvo[]> {
  await ensureColuna()
  return await prisma.$queryRaw`
    SELECT w."id" AS "workspaceId", w."nome",
           u."id" AS "userId", u."nome" AS "nomePessoa", lower(u."email") AS "email",
           MAX(cob."valor"::float) AS "valor",
           (CURRENT_DATE - MIN(cob."vencimento")::date)::int AS "dias",
           w."alertaAtrasoEm" AS "alertadoEm"
    FROM "AsaasCobranca" cob
    JOIN "AsaasAssinatura" a ON a."subscriptionId" = cob."subscriptionId"
    JOIN "Workspace" w ON w."id" = a."workspaceId"
    JOIN LATERAL (
      SELECT "id","nome","email" FROM "User"
      WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' AND "ativo" = true AND "email" IS NOT NULL
      ORDER BY "createdAt" ASC LIMIT 1
    ) u ON true
    WHERE cob."status" = 'OVERDUE'
      AND w."ativo" = true
      AND w."assinaturaStatus" NOT IN ('ATIVA','TRIAL','CANCELADA')
      AND NOT EXISTS (SELECT 1 FROM "ReengajamentoOptOut" o WHERE o."userId" = u."id")
    GROUP BY w."id", w."nome", u."id", u."nome", u."email", w."alertaAtrasoEm"
    ORDER BY "dias" DESC
  ` as Alvo[]
}

function montarEmail(base: string, a: Alvo): { assunto: string; html: string; texto: string } {
  const nome = a.nomePessoa ? String(a.nomePessoa).trim().split(/\s+/)[0] : ''
  const ola = nome ? `Oi, ${nome}!` : 'Oi!'
  const link = `${base}/assinatura?e=${encodeURIComponent(a.email)}&t=${tokenMigrar(a.email)}`
  const optout = `${base}/api/reengajamento/optout?u=${encodeURIComponent(a.userId)}&t=${tokenOptOut(a.userId)}`
  const valor = (a.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const assunto = 'Sua mensalidade do SOA está em aberto 💛'
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.55">
    <p style="font-size:16px">${ola} 💛</p>
    <p>Passando com todo carinho pra te avisar que a sua mensalidade do <b>SOA</b> (R$ ${valor}) está <b>em aberto</b>${a.dias > 0 ? ` há ${a.dias} dia${a.dias > 1 ? 's' : ''}` : ''}. Deve ter passado despercebido — acontece! 🙂</p>
    <p>Pra manter seu ateliê funcionando sem interrupção, é só <b>regularizar nos próximos 2 dias</b>. É rapidinho e seguro:</p>
    <p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Regularizar agora</a></p>
    <p style="color:#6b7280;font-size:14px">Fica tranquila: <b>seus dados estão todos guardados</b>. Se já pagou nas últimas horas, pode ignorar este e-mail. Qualquer dúvida, é só responder aqui que a gente te ajuda. 💛</p>
    <p style="margin-top:20px">Com carinho,<br><b>Equipe SOA</b></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:18px">Não quer mais estes avisos? <a href="${optout}" style="color:#9ca3af">Cancelar avisos</a> · suporte@vps-gestao.com.br</p>
  </div>`.trim()
  const texto = `${ola}\n\nSua mensalidade do SOA (R$ ${valor}) está em aberto${a.dias > 0 ? ` há ${a.dias} dia(s)` : ''}. Pra manter seu ateliê funcionando, regularize nos próximos 2 dias: ${link}\n\nSeus dados estão guardados. Se já pagou, ignore. Dúvidas? responda este e-mail.\nEquipe SOA`
  return { assunto, html, texto }
}

export async function GET(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const base = baseUrlDeHeaders(req.headers)
  const alvos = await listarAtrasadas()
  const mask = (e: string) => e.replace(/^(.).*(.@.*)$/, '$1***$2')
  const previa = alvos[0] ? montarEmail(base, alvos[0]) : null
  return NextResponse.json({
    previa: true,
    total: alvos.length,
    jaAlertados: alvos.filter(a => a.alertadoEm).length,
    lista: alvos.map(a => ({ nome: a.nome, email: mask(a.email), valor: a.valor, dias: a.dias, jaAlertado: !!a.alertadoEm })),
    exemploAssunto: previa?.assunto ?? null,
    exemploTexto: previa?.texto ?? null,
  })
}

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY ausente.' }, { status: 503 })
  const base = baseUrlDeHeaders(req.headers)
  const alvos = await listarAtrasadas()

  let enviados = 0, pulados = 0, falhas = 0
  const agora = Date.now()
  for (const a of alvos) {
    // Idempotência: não reenvia dentro da janela do prazo (2 dias).
    if (a.alertadoEm && agora - new Date(a.alertadoEm).getTime() < COOLDOWN_DIAS * 86400000) { pulados++; continue }
    const { assunto, html } = montarEmail(base, a)
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: REMETENTE, to: [a.email], subject: assunto, html }),
      })
      if (!r.ok) { falhas++; console.error(`[ALERTA-ATRASO] falha ws=${a.workspaceId}: Resend ${r.status}`); continue }
      await prisma.$executeRaw`UPDATE "Workspace" SET "alertaAtrasoEm" = NOW() WHERE "id" = ${a.workspaceId}`
      enviados++
      console.log(`[ALERTA-ATRASO] enviado ws=${a.workspaceId} dias=${a.dias}`)
    } catch (e) { falhas++; console.error(`[ALERTA-ATRASO] erro ws=${a.workspaceId}:`, (e as Error)?.message) }
  }
  return NextResponse.json({ ok: true, candidatas: alvos.length, enviados, pulados, falhas })
}
