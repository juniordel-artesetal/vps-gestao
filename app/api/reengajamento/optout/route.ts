// Opt-out dos e-mails de reengajamento — link PÚBLICO no rodapé de todo e-mail.
//   GET ?u={userId}&t={token}  (token = HMAC do secret; sem token válido, não faz nada)
// Idempotente (ON CONFLICT). Devolve uma página simples de confirmação.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tokenOptOutValido } from '@/lib/reengajamento'

export const dynamic = 'force-dynamic'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function pagina(titulo: string, msg: string): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
    <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0f19;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px">
      <div style="max-width:420px;text-align:center">
        <div style="font-size:40px">🧡</div>
        <h1 style="font-size:20px;margin:12px 0 8px">${titulo}</h1>
        <p style="color:#9ca3af;font-size:15px">${msg}</p>
        <a href="https://www.usesoa.com.br/dashboard" style="display:inline-block;margin-top:16px;color:#f97316">Voltar ao SOA</a>
      </div>
    </body></html>`
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const userId = (url.searchParams.get('u') || '').trim()
  const token = (url.searchParams.get('t') || '').trim()
  if (!userId || !token || !tokenOptOutValido(userId, token)) {
    return pagina('Link inválido', 'Esse link de cancelamento não é válido. Se você quer parar de receber os avisos, responda o e-mail que a gente resolve.')
  }
  try {
    await prisma.$executeRaw`
      INSERT INTO "ReengajamentoOptOut" ("userId","workspaceId","criadoEm")
      VALUES (${userId}, (SELECT "workspaceId" FROM "User" WHERE "id" = ${userId} LIMIT 1), NOW())
      ON CONFLICT ("userId") DO NOTHING
    `
  } catch (e) { console.error('[REENGAJAMENTO] optout:', (e as Error)?.message) }
  return pagina('Pronto, avisos cancelados', 'Você não vai mais receber os e-mails de lembrete da Sofia. Ela continua aqui no sistema sempre que você precisar. 🧡')
}
