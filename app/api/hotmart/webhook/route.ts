import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const EVENTOS_ATIVAR = [
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'SUBSCRIPTION_REACTIVATED',
]

const EVENTOS_BLOQUEAR = [
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_PROTEST',
  'SUBSCRIPTION_CANCELLATION',
]

// Gera senha padrão: primeiros 4 chars do email + @VPS + ano
function gerarSenhaPadrao(email: string): string {
  const prefixo = email.split('@')[0].slice(0, 4).toLowerCase()
  const ano     = new Date().getFullYear()
  return `${prefixo}@VPS${ano}`
}

// Gera slug único a partir do nome
function gerarSlug(nome: string): string {
  const base = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
  return `${base}-${Date.now().toString(36)}`
}

async function enviarEmailBoasVindas(
  email: string,
  nome: string,
  nomeNegocio: string,
  senha: string
) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VPS Gestão <suporte@vps-gestao.com.br>',
        to:   [email],
        subject: '🎉 Sua conta VPS Gestão está pronta!',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
            <div style="text-align:center;margin-bottom:32px">
              <div style="display:inline-block;background:#f97316;width:48px;height:48px;border-radius:12px;line-height:48px;font-size:24px;font-weight:bold;color:white">V</div>
              <h1 style="color:#f97316;margin:16px 0 4px;font-size:24px">VPS Gestão</h1>
              <p style="color:#94a3b8;margin:0;font-size:14px">Seu sistema está pronto!</p>
            </div>

            <h2 style="color:#f1f5f9;font-size:18px;margin-bottom:8px">Olá, ${nome}! 🎀</h2>
            <p style="color:#cbd5e1;font-size:14px;line-height:1.6">
              Sua conta no VPS Gestão foi criada com sucesso. Agora você pode organizar
              toda a produção, precificação e financeiro do <strong style="color:#f97316">${nomeNegocio}</strong> em um só lugar!
            </p>

            <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 12px;text-transform:uppercase;letter-spacing:.05em">Seus dados de acesso</p>
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="color:#94a3b8;font-size:13px;padding:4px 0">E-mail:</td>
                  <td style="color:#f1f5f9;font-size:13px;font-weight:600">${email}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;font-size:13px;padding:4px 0">Senha temporária:</td>
                  <td style="color:#f97316;font-size:16px;font-weight:700;font-family:monospace">${senha}</td>
                </tr>
              </table>
            </div>

            <p style="color:#fbbf24;font-size:13px;background:#451a03;border:1px solid #92400e;padding:12px;border-radius:8px">
              ⚠️ Por segurança, você será solicitada a trocar a senha no primeiro acesso.
            </p>

            <div style="text-align:center;margin:32px 0">
              <a href="https://vps-gestao.natycostapro.com.br/login"
                style="background:#f97316;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block">
                Acessar o VPS Gestão →
              </a>
            </div>

            <div style="border-top:1px solid #334155;padding-top:20px;margin-top:20px">
              <p style="color:#64748b;font-size:12px;margin:0 0 8px">Primeiros passos:</p>
              <ol style="color:#94a3b8;font-size:13px;line-height:2;margin:0;padding-left:20px">
                <li>Acesse o sistema com e-mail e senha acima</li>
                <li>Troque sua senha no primeiro acesso</li>
                <li>Configure os setores do seu ateliê</li>
                <li>Cadastre seus materiais e produtos</li>
                <li>Crie seu primeiro pedido!</li>
              </ol>
            </div>

            <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px">
              Dúvidas? Nossa IA de suporte está disponível 24h dentro do sistema.<br/>
              <a href="https://vps-gestao.natycostapro.com.br/suporte" style="color:#f97316">Central de Suporte</a>
            </p>
          </div>
        `,
      }),
    })
  } catch (err) {
    console.error('[HOTMART] Erro ao enviar e-mail de boas-vindas:', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Validar Hottok
    const hottok = req.headers.get('x-hotmart-hottok')
    if (!hottok || hottok !== process.env.HOTMART_SECRET) {
      console.warn('[HOTMART] Hottok inválido')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Ler payload
    const body       = await req.json()
    const evento     = body.event                        as string
    const email      = body.data?.buyer?.email           as string | undefined
    const nomeComprador = body.data?.buyer?.name         as string | undefined
    const transacao  = body.data?.purchase?.transaction  as string | undefined

    let workspaceId: string | null = null
    let erro: string | null = null
    let criouConta = false

    if (!email) {
      erro = 'Payload sem email do comprador'
    } else {

      // ── 3. Verificar se usuário já existe
      const users = await prisma.$queryRaw`
        SELECT u."workspaceId", u.id
        FROM "User" u
        WHERE LOWER(u."email") = LOWER(${email})
        LIMIT 1
      ` as { workspaceId: string; id: string }[]

      if (users.length > 0) {
        // Usuário já existe — só atualiza o workspace
        workspaceId = users[0].workspaceId

      } else if (EVENTOS_ATIVAR.includes(evento)) {
        // ── 4. CRIAR CONTA AUTOMATICAMENTE na compra ──
        const nome        = nomeComprador || email.split('@')[0]
        const nomeNegocio = `Ateliê de ${nome.split(' ')[0]}`
        const slug        = gerarSlug(nomeNegocio)
        const senha       = gerarSenhaPadrao(email)
        const senhaHash   = await bcrypt.hash(senha, 10)
        const wsId        = Math.random().toString(36).slice(2) + Date.now().toString(36)
        const userId      = Math.random().toString(36).slice(2) + Date.now().toString(36)

        // Criar Workspace
        await prisma.$executeRaw`
          INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","createdAt")
          VALUES (${wsId}, ${nomeNegocio}, ${slug}, 'PRO', true, NOW())
        `

        // Criar User ADMIN com flag de primeiro login
        await prisma.$executeRaw`
          INSERT INTO "User" ("id","nome","email","senha","role","workspaceId","ativo","primeiroLogin","createdAt")
          VALUES (${userId}, ${nome}, ${email.toLowerCase()}, ${senhaHash}, 'ADMIN', ${wsId}, true, true, NOW())
        `

        workspaceId = wsId
        criouConta  = true

        // Enviar e-mail de boas-vindas
        await enviarEmailBoasVindas(email, nome, nomeNegocio, senha)

        console.log(`[HOTMART] Conta criada automaticamente — workspace: ${wsId}, email: ${email}`)
      } else {
        erro = `Usuário não encontrado para o email: ${email}`
      }
    }

    // ── 5. Atualizar status do workspace (se já existe)
    if (workspaceId && !criouConta) {
      if (EVENTOS_ATIVAR.includes(evento)) {
        await prisma.$executeRaw`UPDATE "Workspace" SET "ativo" = true  WHERE "id" = ${workspaceId}`
        console.log(`[HOTMART] Workspace ${workspaceId} ATIVADO`)
      } else if (EVENTOS_BLOQUEAR.includes(evento)) {
        await prisma.$executeRaw`UPDATE "Workspace" SET "ativo" = false WHERE "id" = ${workspaceId}`
        console.log(`[HOTMART] Workspace ${workspaceId} BLOQUEADO`)
      }
    }

    // ── 6. Bloquear workspace existente em cancelamento
    if (workspaceId && criouConta === false && EVENTOS_BLOQUEAR.includes(evento)) {
      await prisma.$executeRaw`UPDATE "Workspace" SET "ativo" = false WHERE "id" = ${workspaceId}`
    }

    // ── 7. Registrar evento
    const logId      = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const processado = workspaceId !== null && erro === null

    await prisma.$executeRaw`
      INSERT INTO "HotmartEvent" (
        "id","evento","transacao","email",
        "workspaceId","payload","processado","erro","createdAt"
      ) VALUES (
        ${logId}, ${evento}, ${transacao ?? null}, ${email ?? null},
        ${workspaceId ?? null}, ${JSON.stringify(body)},
        ${processado}, ${erro ?? null}, NOW()
      )
    `

    return NextResponse.json({ ok: true, evento, workspaceId, processado, criouConta })

  } catch (err: any) {
    console.error('[HOTMART WEBHOOK] Erro interno:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 200 })
  }
}
