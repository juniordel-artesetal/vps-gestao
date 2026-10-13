// Método MAE STANDALONE — cadastro de quem quer SÓ o MAE (sem o SOA). Cria a conta (Workspace + User ADMIN) já
// marcada como standalone (moduloMaePlano='standalone'): ela só enxerga o MAE (middleware + menu) e os pedidos dela
// vêm da planilha da Shopee / cadastro manual (Lote 7). A conta nasce SEM o MAE liberado — o acesso começa no
// checkout (trial de 7 dias com cartão validado). Fora da régua do SOA (assinaturaOrigem 'mae': o acesso é o do MAE).
// Só com a venda aberta (MAE_VENDA_ATIVO=on + preços).
import { recusa } from '@/lib/mae/servidor/acesso'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { vendaMaeAtiva } from '@/lib/mae/assinatura/precos'
import { emailBoasVindasMae } from '@/lib/mae/assinatura/emails'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const slugDe = (nome: string, id: string) => nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 30) + '-' + id.slice(0, 4)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  if (!vendaMaeAtiva()) return recusa('assinatura/cadastro', { error: 'O Método Mãe ainda não está à venda.' }, 400)
  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const nome = String(b.nome ?? '').trim().slice(0, 120), email = String(b.email ?? '').trim().toLowerCase().slice(0, 200)
  const senha = String(b.senha ?? ''), negocio = String(b.nomeNegocio ?? '').trim().slice(0, 120)
  if (!nome || !negocio || !EMAIL.test(email)) return recusa('assinatura/cadastro', { error: 'Preencha nome, e-mail e o nome do ateliê' }, 400)
  if (senha.length < 8) return recusa('assinatura/cadastro', { error: 'A senha precisa ter pelo menos 8 caracteres' }, 400)
  try {
    const [existe] = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE lower("email") = lower(${email}) LIMIT 1`
    if (existe) return recusa('assinatura/cadastro', { error: 'Este e-mail já tem conta — entre com ele e ative o Método Mãe pela sua conta.' }, 400)
    const wsId = gid(), userId = gid()
    const hash = await bcrypt.hash(senha, 10)
    await prisma.$transaction([
      // ativo = true (precisa logar para assinar); profileCompleto = true (sem o /setup do ERP); fora da régua do SOA
      prisma.$executeRaw`INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem","profileCompleto","moduloMae","moduloMaePlano")
        VALUES (${wsId}, ${negocio}, ${slugDe(negocio, wsId)}, 'MAE', true, 'MAE_STANDALONE', 'mae', true, false, 'standalone')`,
      prisma.$executeRaw`INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo") VALUES (${userId}, ${wsId}, ${nome}, ${email}, ${hash}, 'ADMIN', true)`,
      prisma.$executeRaw`INSERT INTO "WorkspaceTheme" ("id","workspaceId","modo","corPrimaria","presetNome") VALUES (${gid()}, ${wsId}, 'light', '#f97316', 'laranja')`,
    ])
    console.log(`[MAE CADASTRO] conta standalone ws=${wsId}`)
    await emailBoasVindasMae(nome, email)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE CADASTRO]', e)
    return NextResponse.json({ error: 'Erro ao criar a conta' }, { status: 500 })
  }
}
