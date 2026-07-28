// Opt-out da campanha de migração — link PÚBLICO no rodapé de todo e-mail.
//   GET ?e={email}&t={token}   (token = HMAC do secret)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { tokenOptOutValido } from '@/lib/campanha/emails'

export const dynamic = 'force-dynamic'

function pagina(titulo: string, msg: string): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
    <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0f19;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px">
      <div style="max-width:420px;text-align:center"><div style="font-size:40px">💛</div>
        <h1 style="font-size:20px;margin:12px 0 8px">${titulo}</h1>
        <p style="color:#9ca3af;font-size:15px">${msg}</p></div>
    </body></html>`
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const email = (url.searchParams.get('e') || '').trim().toLowerCase()
  const token = (url.searchParams.get('t') || '').trim()
  if (!email || !token || !tokenOptOutValido(email, token)) {
    return pagina('Link inválido', 'Esse link de cancelamento não é válido. Se quiser parar de receber os avisos, responda o e-mail que a gente resolve.')
  }
  try {
    await prisma.$executeRaw`
      UPDATE "CampanhaMigracao" SET "estado" = 'optout', "optoutEm" = NOW(), "updatedAt" = NOW()
      WHERE lower("email") = ${email} AND "estado" NOT IN ('migrada')
    `
  } catch (e) { console.error('[CAMPANHA] optout:', (e as Error)?.message) }
  return pagina('Pronto, avisos cancelados', 'Você não vai mais receber os lembretes da migração. Seu acesso ao SOA continua normal. 💛')
}
