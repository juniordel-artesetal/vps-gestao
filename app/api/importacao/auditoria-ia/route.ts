// app/api/importacao/auditoria-ia/route.ts
// A IA apenas REDIGE um resumo executivo a partir de ESTATÍSTICAS JÁ CALCULADAS.
// Nunca calcula, nunca inventa. ★Privacidade: whitelist server-side — só números
// agregados vão para a IA. NUNCA CPF, nome, telefone, endereço ou linhas cruas.★
// A importação nunca depende disso (fallback: retorna as estatísticas sem texto).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

const CAP_DIARIO = 150

function novoId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ★ Whitelist: constrói um objeto NOVO só com campos permitidos (agregados, sem PII).
// Qualquer campo intruso enviado pelo cliente é descartado aqui, no servidor.
function sanitizar(raw: any) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  const dia = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) ? v.slice(0, 10) : null
  return {
    linhas:            num(s.linhas),
    pedidos:           num(s.pedidos),
    multiItem:         num(s.multiItem),
    itens:             num(s.itens),
    produtosDistintos: num(s.produtosDistintos),
    bruto:             num(s.bruto),
    freteComprador:    num(s.freteComprador),
    descontos:         num(s.descontos),
    taxas:             num(s.taxas),
    pctTaxas:          num(s.pctTaxas),
    liquidoEstimado:   num(s.liquidoEstimado),
    ticketMedio:       num(s.ticketMedio),
    periodoInicio:     dia(s.periodoInicio),
    periodoFim:        dia(s.periodoFim),
    cancelamentos:     num(s.cancelamentos),
    itensDevolvidos:   num(s.itensDevolvidos),
    semCpf:            num(s.semCpf),
    novos:             num(s.novos),
    existentes:        num(s.existentes),
    liquidoNegativo:   num(s.liquidoNegativo),
    alertas: Array.isArray(s.alertas)
      ? s.alertas.filter((a: any) => typeof a === 'string').slice(0, 12).map((a: string) => a.slice(0, 240))
      : [],
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const stats = sanitizar(body?.estatisticas)   // ★ só o objeto saneado segue adiante

  const userId = session.user.id
  const workspaceId = session.user.workspaceId
  const hoje = new Date().toISOString().split('T')[0]

  // ── Cap diário (AiUsageLog compartilhado) ──────────────────────────────────
  let uso: any = null
  try {
    const rows = await prisma.$queryRaw`
      SELECT "calls"::int AS "calls" FROM "AiUsageLog"
      WHERE "userId" = ${userId} AND "data" = ${hoje}::date LIMIT 1
    ` as any[]
    uso = rows[0] || null
  } catch { /* tabela pode não existir — segue sem limite */ }

  const apiKey = process.env.ANTHROPIC_API_KEY_GESTAO
  const semIa = !apiKey || (uso && Number(uso.calls) >= CAP_DIARIO)

  // ── FALLBACK: sem IA / cap estourado → devolve só o relatório calculado ─────
  if (semIa) {
    return NextResponse.json(serialize({ resumo: null, estatisticas: stats, ia: false }))
  }

  const prompt = `Você resume a "saúde" de uma importação de pedidos da Shopee para uma artesã (dona do ateliê).
Recebe SÓ números já calculados — NÃO recalcule, NÃO invente, NÃO cite nomes/CPF/clientes (não há).
Escreva de 4 a 6 linhas, em português do Brasil, tom prático e direto (é ela lendo antes de confirmar).
Comece com uma frase de visão geral (volume e líquido estimado), depois destaque os ALERTAS mais importantes.
Sempre trate os valores como ESTIMADOS (a Shopee não informa o repasse real). Não use markdown.

NÚMEROS:
${JSON.stringify(stats)}

ALERTAS já detectados (use-os no texto):
${stats.alertas.length ? stats.alertas.map((a: string) => '- ' + a).join('\n') : '- (nenhum)'}`

  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 15000)
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
        }),
        signal: ctrl.signal,
      }
    ).finally(() => clearTimeout(timeout))

    if (!resp.ok) {
      console.error('[auditoria-ia] gemini status', resp.status)
      return NextResponse.json(serialize({ resumo: null, estatisticas: stats, ia: false }))
    }
    const data = await resp.json()
    const txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()

    // Contabiliza a chamada (só quando de fato chamou a IA)
    try {
      if (uso) {
        await prisma.$executeRaw`UPDATE "AiUsageLog" SET "calls" = "calls" + 1 WHERE "userId" = ${userId} AND "data" = ${hoje}::date`
      } else {
        await prisma.$executeRaw`INSERT INTO "AiUsageLog" ("id","userId","workspaceId","data","calls") VALUES (${novoId()}, ${userId}, ${workspaceId}, ${hoje}::date, 1)`
      }
    } catch { /* não bloqueia */ }

    return NextResponse.json(serialize({ resumo: txt || null, estatisticas: stats, ia: !!txt }))
  } catch (e) {
    console.error('[auditoria-ia]', e)
    return NextResponse.json(serialize({ resumo: null, estatisticas: stats, ia: false }))
  }
}
