import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import bcrypt from 'bcryptjs'
import { sugerirCupom, sugerirSlug } from '@/lib/parceiros'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
async function verificarMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — lista parceiros (com contadores de leads/comissão). senhaHash NUNCA sai.
export async function GET() {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const rows = await prisma.$queryRaw`
    SELECT p."id", p."tipo", p."nome", p."email", p."contato", p."ativo", p."cupom", p."linkSlug",
           p."comissaoPercAnual"::float AS "comissaoPercAnual", p."comissaoPercMensal"::float AS "comissaoPercMensal",
           p."comissaoRecorrente", p."walletId",
           TO_CHAR(p."createdAt",'YYYY-MM-DD') AS "createdAt",
           (SELECT COUNT(*)::int FROM "Lead" l WHERE l."parceiroId" = p."id") AS "totalLeads",
           (SELECT COUNT(*)::int FROM "Lead" l WHERE l."parceiroId" = p."id" AND l."status" = 'convertido') AS "convertidos",
           (SELECT COALESCE(SUM(c."valor"),0)::float FROM "ParceiroComissao" c WHERE c."parceiroId" = p."id" AND c."status" = 'pendente') AS "comissaoPendente",
           (SELECT (au."email" IS NOT NULL) FROM "ParceiroAuth" au WHERE au."parceiroId" = p."id") AS "temLogin"
    FROM "Parceiro" p ORDER BY p."ativo" DESC, p."createdAt" DESC
  ` as any[]
  return NextResponse.json(serialize(rows))
}

// POST — cria/edita parceiro. Opcional: define credenciais do portal (email/senha).
// body: { id?, tipo, nome, email, contato, ativo, cupom?, linkSlug?, comissaoPercAnual,
//         comissaoPercMensal, comissaoRecorrente, walletId?, loginEmail?, loginSenha? }
export async function POST(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const tipo = b.tipo === 'distribuidor' ? 'distribuidor' : 'influencer'
  const nome = String(b.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const cupom = b.cupom ? String(b.cupom).trim().toUpperCase() : (b.id ? null : sugerirCupom(nome))
  const linkSlug = b.linkSlug ? String(b.linkSlug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : (b.id ? null : sugerirSlug(nome))
  const percAnual = Number(b.comissaoPercAnual) || 0
  const percMensal = Number(b.comissaoPercMensal) || 0
  const recorrente = !!b.comissaoRecorrente
  const ativo = b.ativo !== false

  try {
    let id = b.id ? String(b.id) : null
    if (id) {
      await prisma.$executeRaw`
        UPDATE "Parceiro" SET
          "tipo" = ${tipo}, "nome" = ${nome}, "email" = ${b.email ?? null}, "contato" = ${b.contato ?? null},
          "ativo" = ${ativo},
          "cupom" = COALESCE(${cupom}, "cupom"), "linkSlug" = COALESCE(${linkSlug}, "linkSlug"),
          "comissaoPercAnual" = ${percAnual}, "comissaoPercMensal" = ${percMensal},
          "comissaoRecorrente" = ${recorrente}, "walletId" = ${b.walletId ?? null}
        WHERE "id" = ${id}
      `
    } else {
      id = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "Parceiro" ("id","tipo","nome","email","contato","ativo","cupom","linkSlug",
                                "comissaoPercAnual","comissaoPercMensal","comissaoRecorrente","walletId","createdAt")
        VALUES (${id}, ${tipo}, ${nome}, ${b.email ?? null}, ${b.contato ?? null}, ${ativo}, ${cupom}, ${linkSlug},
                ${percAnual}, ${percMensal}, ${recorrente}, ${b.walletId ?? null}, NOW())
      `
    }

    // Credenciais do portal (opcional): cria/atualiza ParceiroAuth
    if (b.loginEmail && b.loginSenha) {
      const loginEmail = String(b.loginEmail).trim().toLowerCase()
      const hash = await bcrypt.hash(String(b.loginSenha), 10)
      const [ex] = await prisma.$queryRaw`SELECT "id" FROM "ParceiroAuth" WHERE "parceiroId" = ${id} LIMIT 1` as any[]
      if (ex) {
        await prisma.$executeRaw`UPDATE "ParceiroAuth" SET "email" = ${loginEmail}, "senhaHash" = ${hash} WHERE "parceiroId" = ${id}`
      } else {
        await prisma.$executeRaw`
          INSERT INTO "ParceiroAuth" ("id","parceiroId","email","senhaHash","createdAt")
          VALUES (${gerarId()}, ${id}, ${loginEmail}, ${hash}, NOW())
        `
      }
    }

    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    if (String(e?.message || '').includes('Parceiro_cupom_idx')) return NextResponse.json({ error: 'Cupom já usado por outro parceiro' }, { status: 400 })
    if (String(e?.message || '').includes('Parceiro_slug_idx')) return NextResponse.json({ error: 'Link (slug) já usado' }, { status: 400 })
    if (String(e?.message || '').includes('ParceiroAuth_email')) return NextResponse.json({ error: 'E-mail de login já usado' }, { status: 400 })
    console.error('[MASTER] parceiros POST:', e)
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  }
}
