import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

const resend = new Resend(process.env.RESEND_API_KEY)

// GET — lista usuárias do workspace (com setorIds quando OPERADORA)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId

    const usuarios = await prisma.$queryRaw`
      SELECT
        u."id",
        u."nome",
        u."email",
        u."role",
        u."ativo",
        u."primeiroLogin",
        u."createdAt",
        lh."createdAt" AS "ultimoLogin",
        COALESCE(
          (SELECT json_agg(us."setorId") FROM "UserSetor" us WHERE us."userId" = u."id"),
          '[]'::json
        ) AS "setorIds"
      FROM "User" u
      LEFT JOIN LATERAL (
        SELECT "createdAt" FROM "LoginHistory"
        WHERE "userId" = u."id" AND "sucesso" = true
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) lh ON true
      WHERE u."workspaceId" = ${workspaceId}
      ORDER BY u."createdAt" ASC
    ` as any[]

    return NextResponse.json(serialize(usuarios))
  } catch (err) {
    console.error('[GET /api/config/usuarios]', err)
    return NextResponse.json({ error: 'Erro ao buscar usuárias' }, { status: 500 })
  }
}

// POST — cria nova usuária + envia e-mail (aceita setorIds quando OPERADORA)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const { nome, email, role, senha, setorIds } = body

    if (!nome || !email || !role || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios: nome, email, role, senha' }, { status: 400 })
    }

    // Verificar se e-mail já existe
    const existe = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE "email" = ${email.toLowerCase().trim()} LIMIT 1
    ` as any[]

    if (existe.length > 0) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado no sistema' }, { status: 409 })
    }

    // Buscar nome do workspace (ateliê)
    const ws = await prisma.$queryRaw`
      SELECT "nome" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
    ` as any[]
    const nomeAtelie = ws[0]?.nome ?? 'Ateliê'

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10)
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)

    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "nome", "email", "senha", "role", "workspaceId", "ativo", "primeiroLogin")
      VALUES (
        ${id},
        ${nome.trim()},
        ${email.toLowerCase().trim()},
        ${senhaHash},
        ${role},
        ${workspaceId},
        true,
        true
      )
    `

    // Vincula setores (se OPERADORA e veio lista)
    if (role === 'OPERADOR' && Array.isArray(setorIds) && setorIds.length > 0) {
      for (const setorId of setorIds) {
        if (!setorId) continue
        const usId = Math.random().toString(36).slice(2) + Date.now().toString(36)
        try {
          await prisma.$executeRaw`
            INSERT INTO "UserSetor" ("id","userId","setorId","workspaceId")
            VALUES (${usId}, ${id}, ${setorId}, ${workspaceId})
            ON CONFLICT ("userId","setorId") DO NOTHING
          `
        } catch (e) { console.warn('UserSetor insert:', e) }
      }
    }

    // Enviar e-mail de boas-vindas
    try {
      const roleLabel: Record<string, string> = {
        ADMIN: 'Administradora',
        DELEGADOR: 'Delegadora',
        OPERADOR: 'Operadora',
      }
      const nivelLabel = roleLabel[role] ?? role

      await resend.emails.send({
        from: `SOA <${process.env.SUPORTE_EMAIL ?? 'suporte@vps-gestao.com.br'}>`,
        to: email.toLowerCase().trim(),
        subject: `Seu acesso ao ${nomeAtelie} — SOA`,
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🎉 Bem-vinda ao SOA!</h1>
            <p style="margin:8px 0 0;color:#fed7aa;font-size:14px;">${nomeAtelie}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;">Olá, <strong>${nome.trim()}</strong>! 👋</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
              Você foi convidada para acessar o sistema <strong>${nomeAtelie}</strong> no SOA com o perfil de <strong>${nivelLabel}</strong>.
              Aqui estão seus dados de acesso:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;color:#9a3412;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Seus dados de acesso</p>
                  <table width="100%">
                    <tr>
                      <td style="padding:6px 0;color:#6b7280;font-size:13px;width:80px;">E-mail:</td>
                      <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${email.toLowerCase().trim()}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#6b7280;font-size:13px;">Senha:</td>
                      <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;letter-spacing:1px;">${senha}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#6b7280;font-size:13px;">Perfil:</td>
                      <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${nivelLabel}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px;color:#6b7280;font-size:13px;line-height:1.5;">
              ⚠️ No primeiro acesso você será solicitada a <strong>criar uma nova senha</strong> pessoal. Guarde bem essa senha inicial pois ela será necessária para o primeiro login.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${process.env.NEXTAUTH_URL ?? 'https://www.usesoa.com.br'}/login"
                     style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">
                    Acessar o sistema →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5;">
              Dúvidas? Fale com a administradora do seu ateliê ou acesse nosso suporte em
              <a href="https://www.usesoa.com.br/suporte" style="color:#f97316;">www.usesoa.com.br/suporte</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">SOA — ERP para ateliês artesanais</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        `,
      })
    } catch (emailErr) {
      console.error('[EMAIL usuarios]', emailErr)
    }

    return NextResponse.json({ ok: true, id, message: 'Usuária criada e e-mail enviado' })
  } catch (err) {
    console.error('[POST /api/config/usuarios]', err)
    return NextResponse.json({ error: 'Erro ao criar usuária' }, { status: 500 })
  }
}
