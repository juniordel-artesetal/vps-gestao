import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cadastroAsaasLigado } from '@/lib/assinatura'
import { parceirasAtivo, resolverAtribuicao, registrarLeadAtribuicao, COOKIE_REF } from '@/lib/parceiras/atribuicao'
// Só id da lista canônica entra no banco: `Workspace.segmento` guarda o id, e um
// valor inventado viraria segmento órfão, invisível em filtros e relatórios.
import { ehSegmentoValido } from '@/lib/segmentos'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function gerarSlug(nome: string, id: string) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30) + '-' + id.slice(0, 4)
}

export async function POST(req: NextRequest) {
  try {
    // `segmento` é OPCIONAL e hoje o formulário não o envia — ele é capturado no
    // onboarding (/setup), que só acontece DEPOIS do acesso. Com o novo portão a
    // lead pode nunca chegar lá, então a rota já aceita o campo: basta a tela
    // passar a pedir, sem mexer aqui de novo.
    const { nome, email, senha, nomeNegocio, segmento, cupom } = await req.json()

    if (!nome || !email || !senha || !nomeNegocio) {
      return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter mínimo 6 caracteres' }, { status: 400 })
    }

    // Verifica se email já existe
    const existente = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE "email" = ${email} LIMIT 1
    ` as any[]

    if (existente.length > 0) {
      return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 400 })
    }

    const wsId = gerarId()
    const userId = gerarId()
    const themeId = gerarId()
    const slug = gerarSlug(nomeNegocio, wsId)
    const hash = await bcrypt.hash(senha, 10)

    // Cria workspace.
    //
    // Com a flag LIGADA, a conta nasce governada pelo Asaas: origem 'asaas' +
    // trial de 14 dias. É o único ponto do sistema que passa a gravar
    // assinaturaOrigem='asaas', e é o que faz a máquina de estados valer para ela
    // (lib/assinatura só age nessa origem).
    //
    // Com a flag DESLIGADA, o INSERT é byte-a-byte o de sempre — nenhuma conta
    // nova entra no regime novo, e a Hotmart segue intocada nos dois casos.
    if (cadastroAsaasLigado()) {
      // NOVO PORTÃO: o método de pagamento é a porta. A conta nasce SEM acesso e
      // SEM trial — os 14 dias começam quando o checkout for concluído
      // (CHECKOUT_PAID). Contar o trial aqui daria acesso de graça a quem
      // abandonar o pagamento.
      //
      // `ativo = true` de propósito: ela PRECISA conseguir logar para chegar à
      // tela de pagamento e gerar um link novo. Quem barra o acesso é a máquina
      // de estados (AGUARDANDO_PAGAMENTO), não o login.
      await prisma.$executeRaw`
        INSERT INTO "Workspace" ("id", "nome", "slug", "plano", "ativo",
                                 "assinaturaStatus", "assinaturaOrigem", "segmento")
        VALUES (${wsId}, ${nomeNegocio}, ${slug}, 'TRIAL', true,
                'AGUARDANDO_PAGAMENTO', 'asaas', ${ehSegmentoValido(segmento) ? segmento : null})
      `
    } else {
      await prisma.$executeRaw`
        INSERT INTO "Workspace" ("id", "nome", "slug", "plano", "ativo", "assinaturaStatus")
        VALUES (${wsId}, ${nomeNegocio}, ${slug}, 'TRIAL', true, 'TRIAL')
      `
    }

    // Cria usuário admin
    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "workspaceId", "nome", "email", "senha", "role", "ativo")
      VALUES (${userId}, ${wsId}, ${nome}, ${email}, ${hash}, 'ADMIN', true)
    `

    // Cria tema padrão laranja
    await prisma.$executeRaw`
      INSERT INTO "WorkspaceTheme" ("id", "workspaceId", "modo", "corPrimaria", "presetNome")
      VALUES (${themeId}, ${wsId}, 'light', '#f97316', 'laranja')
    `

    // ── Atribuição de indicação (atrás da flag PARCEIRAS_ATIVO) ───────────────
    // Cupom válido vence o link; cupom inválido cai no cookie sem bloquear. Se
    // resolveu, grava o Lead que amarra este workspace à parceira — o elo durável
    // que parceiroDoWorkspace lê no split. Nunca derruba o cadastro: falha aqui é
    // consequência, não pré-requisito.
    let cupomNaoEncontrado = false
    if (parceirasAtivo()) {
      try {
        const cookieRef = req.cookies.get(COOKIE_REF)?.value ?? null
        const atrib = await resolverAtribuicao(cupom, cookieRef)
        cupomNaoEncontrado = atrib.cupomNaoEncontrado
        if (atrib.parceiroId && atrib.via) {
          await registrarLeadAtribuicao({ workspaceId: wsId, parceiroId: atrib.parceiroId, via: atrib.via, nome, email })
          console.log(`[REGISTER] atribuição via=${atrib.via} parceiro=${atrib.parceiroId} ws=${wsId}`)
        }
      } catch (e) {
        console.error('[REGISTER] atribuição não gravada ws=' + wsId + ':', (e as Error)?.message)
      }
    }

    return NextResponse.json({
      ok: true,
      workspaceId: wsId,
      ...(cadastroAsaasLigado() ? { aguardandoPagamento: true } : {}),
      ...(cupomNaoEncontrado ? { cupomNaoEncontrado: true } : {}),
    })

  } catch (error) {
    console.error('Erro ao registrar:', error)
    return NextResponse.json({ error: 'Erro interno ao criar conta' }, { status: 500 })
  }
}