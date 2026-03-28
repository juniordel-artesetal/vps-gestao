import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const HOTMART_SECRET = process.env.HOTMART_WEBHOOK_SECRET || ''

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function calcularExpiracao(plano: string): Date {
  const agora = new Date()
  if (plano === 'ANUAL') {
    agora.setFullYear(agora.getFullYear() + 1)
  } else {
    agora.setMonth(agora.getMonth() + 1)
  }
  return agora
}

export async function POST(req: NextRequest) {
  try {
    // Valida token secreto do Hotmart
    const hottok = req.headers.get('x-hotmart-hottok')
    if (HOTMART_SECRET && hottok !== HOTMART_SECRET) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const body = await req.json()
    const evento = body?.event
    const dados = body?.data

    if (!evento || !dados) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const email = dados?.buyer?.email || dados?.subscriber?.email
    const hotmartSubId = dados?.subscription?.subscriber_code || dados?.purchase?.transaction
    const nomeProduto = dados?.product?.name || 'VPS Gestão'
    const plano = dados?.subscription?.plan?.name?.toUpperCase().includes('ANUAL') ? 'ANUAL' : 'MENSAL'

    if (!email) {
      return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })
    }

    // Busca workspace pelo email do comprador
    const workspaces = await prisma.$queryRaw`
      SELECT * FROM "Workspace" 
      WHERE "hotmartEmail" = ${email}
      LIMIT 1
    ` as any[]

    switch (evento) {

      // ✅ COMPRA APROVADA — ativa ou renova
      case 'PURCHASE_APPROVED':
      case 'PURCHASE_COMPLETE': {
        const expira = calcularExpiracao(plano)

        if (workspaces.length > 0) {
          // Workspace já existe — renova
          await prisma.$executeRaw`
            UPDATE "Workspace"
            SET 
              "assinaturaStatus" = 'ATIVA',
              "assinaturaExpira" = ${expira},
              "hotmartSubId"     = ${hotmartSubId},
              "updatedAt"        = NOW()
            WHERE "hotmartEmail" = ${email}
          `
        } else {
          // Workspace novo — cria automaticamente
          const wsId = gerarId()
          const userId = gerarId()
          const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + wsId.slice(0, 4)

          await prisma.$executeRaw`
            INSERT INTO "Workspace" 
              ("id", "nome", "slug", "plano", "ativo", "assinaturaStatus", "assinaturaExpira", "hotmartEmail", "hotmartSubId")
            VALUES 
              (${wsId}, ${nomeProduto}, ${slug}, ${plano}, true, 'ATIVA', ${expira}, ${email}, ${hotmartSubId})
          `

          // Cria usuário admin padrão (senha = primeiros 8 chars do email)
          const bcrypt = await import('bcryptjs')
          const senhaTemp = email.split('@')[0].slice(0, 8) + '!Vps1'
          const hash = await bcrypt.hash(senhaTemp, 10)

          await prisma.$executeRaw`
            INSERT INTO "User"
              ("id", "workspaceId", "nome", "email", "senha", "role", "ativo")
            VALUES
              (${userId}, ${wsId}, ${email.split('@')[0]}, ${email}, ${hash}, 'ADMIN', true)
          `

          // Cria tema padrão
          const themeId = gerarId()
          await prisma.$executeRaw`
            INSERT INTO "WorkspaceTheme"
              ("id", "workspaceId", "modo", "corPrimaria", "presetNome")
            VALUES
              (${themeId}, ${wsId}, 'light', '#f97316', 'laranja')
          `

          console.log(`✅ Novo workspace criado: ${wsId} para ${email}`)
          console.log(`🔑 Senha temporária: ${senhaTemp}`)
        }
        break
      }

      // ❌ CANCELAMENTO / CHARGEBACK / REEMBOLSO — bloqueia
      case 'PURCHASE_CANCELED':
      case 'SUBSCRIPTION_CANCELLATION':
      case 'PURCHASE_CHARGEBACK':
      case 'PURCHASE_REFUNDED': {
        await prisma.$executeRaw`
          UPDATE "Workspace"
          SET 
            "assinaturaStatus" = 'CANCELADA',
            "updatedAt"        = NOW()
          WHERE "hotmartEmail" = ${email}
        `
        break
      }

      // ⚠️ PROTESTO — mantém por enquanto mas registra
      case 'PURCHASE_PROTEST': {
        await prisma.$executeRaw`
          UPDATE "Workspace"
          SET 
            "assinaturaStatus" = 'PROTESTADA',
            "updatedAt"        = NOW()
          WHERE "hotmartEmail" = ${email}
        `
        break
      }

      default:
        console.log(`Evento não tratado: ${evento}`)
    }

    return NextResponse.json({ ok: true, evento })

  } catch (error) {
    console.error('Erro webhook Hotmart:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}