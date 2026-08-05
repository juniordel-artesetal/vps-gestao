// Master — cancela a assinatura da cliente na HOTMART (ação do produtor via API).
//
// Contexto: das 130 em migração, algumas foram cobradas pela regra ANTIGA (ex.:
// R$49,90 no Pix Automático). Depois de migrarem pro Asaas no valor certo, a
// assinatura Hotmart precisa MORRER pra não cobrar duas vezes.
//
// GET  ?email= → SÓ LEITURA: lista as assinaturas Hotmart da cliente (código/status).
// POST { email | subscriberCode } → cancela a(s) ativa(s) e marca hotmartCancelada.
//
// ⚠️ PIX AUTOMÁTICO: cancelar na Hotmart NÃO revoga o mandato de Pix Automático no
// banco da cliente — ela precisa cancelar a autorização no app do banco. O endpoint
// devolve esse aviso pra o Master repassar (ver /avisar-pix-automatico).
//
// Segurança: guarda master; credenciais Hotmart só em env (nunca no client/log);
// Prisma raw, sem SELECT *; escopo à cliente; idempotente (sem ativa → nada a fazer).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { assinaturasPorEmail, cancelarAssinatura, credenciaisConfiguradas } from '@/lib/hotmart'

export const dynamic = 'force-dynamic'

// Status Hotmart que ainda geram cobrança (canceláveis). INACTIVE/CANCELLED_* já morreram.
const CANCELAVEIS = new Set(['ACTIVE', 'DELAYED', 'OVERDUE', 'STARTED'])

const AVISO_PIX =
  'Cancelar a assinatura na Hotmart NÃO revoga o Pix Automático no banco da cliente. ' +
  'Oriente-a a cancelar a autorização de Pix Automático no app do banco para parar a cobrança.'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

// GET — leitura das assinaturas Hotmart da cliente (não cancela nada).
export async function GET(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Informe ?email=' }, { status: 400 })
  if (!credenciaisConfiguradas()) return NextResponse.json({ error: 'Credenciais Hotmart ausentes neste ambiente.' }, { status: 503 })
  try {
    const assinaturas = await assinaturasPorEmail(email)
    return NextResponse.json({
      email,
      assinaturas: assinaturas.map(a => ({ codigo: a.codigo, status: a.status, plano: a.planoNome, valor: a.valor })),
      canceláveis: assinaturas.filter(a => CANCELAVEIS.has(a.status || '')).map(a => a.codigo),
      avisoPixAutomatico: AVISO_PIX,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || 'Falha ao consultar a Hotmart.' }, { status: 502 })
  }
}

// POST — cancela a(s) assinatura(s) ativa(s) da cliente na Hotmart.
export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!credenciaisConfiguradas()) return NextResponse.json({ error: 'Credenciais Hotmart ausentes neste ambiente.', avisoPixAutomatico: AVISO_PIX }, { status: 503 })

  const b = await req.json().catch(() => ({}))
  const email = (b.email || '').trim().toLowerCase()
  const codigoDireto = (b.subscriberCode || '').trim()

  let codigos: string[] = []
  try {
    if (codigoDireto) {
      codigos = [codigoDireto]
    } else if (email) {
      const assinaturas = await assinaturasPorEmail(email)
      codigos = assinaturas.filter(a => CANCELAVEIS.has(a.status || '')).map(a => a.codigo)
      if (assinaturas.length === 0) {
        return NextResponse.json({ ok: true, email, cancelados: [], nota: 'Nenhuma assinatura Hotmart encontrada para esse e-mail.', avisoPixAutomatico: AVISO_PIX })
      }
      if (codigos.length === 0) {
        return NextResponse.json({ ok: true, email, cancelados: [], nota: 'Nenhuma assinatura ativa/em cobrança (já cancelada/inativa).', avisoPixAutomatico: AVISO_PIX })
      }
    } else {
      return NextResponse.json({ error: 'Informe email ou subscriberCode.' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || 'Falha ao consultar a Hotmart.', avisoPixAutomatico: AVISO_PIX }, { status: 502 })
  }

  const resultados: { codigo: string; ok: boolean; status?: number; erro?: string }[] = []
  for (const code of codigos) {
    const r = await cancelarAssinatura(code, { enviarEmailHotmart: false })
    resultados.push({ codigo: code, ok: r.ok, status: r.status, erro: r.ok ? undefined : r.erro })
    console.log(`[HOTMART-CANCEL] email=${email || '-'} code=${code} ok=${r.ok} status=${r.status ?? '-'}`)
  }

  const algumOk = resultados.some(r => r.ok)
  // Marca a campanha só se realmente cancelou algo (a fonte da verdade é a Hotmart).
  if (algumOk && email) {
    try {
      await prisma.$executeRaw`
        UPDATE "CampanhaMigracao" SET "hotmartCancelada" = true, "updatedAt" = NOW()
        WHERE lower("email") = ${email}
      `
    } catch { /* não bloquear o retorno por causa da marca */ }
  }

  return NextResponse.json({
    ok: algumOk,
    email: email || null,
    cancelados: resultados,
    manualSeFalhou: algumOk ? null : 'A API não cancelou. Cancele no painel Hotmart (Assinaturas → cliente → Cancelar).',
    avisoPixAutomatico: AVISO_PIX,
  })
}
