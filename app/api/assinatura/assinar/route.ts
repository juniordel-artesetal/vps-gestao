import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  garantirCliente, criarAssinatura, montarSplitComissao, asaasOperacional,
  sincronizarCobrancasDaAssinatura,
} from '@/lib/pagamento/asaas'
import { getPlano, ehPlanoValido, percentualDoPlano } from '@/lib/assinatura/planos'
import { cpfValido, limparCpf, mascararCpf } from '@/lib/assinatura/cpf'
import { parceiroDoWorkspace } from '@/lib/assinatura/parceiro'
import { estadoDaAssinatura } from '@/lib/assinatura'

export const dynamic = 'force-dynamic'

/** Primeiro vencimento: fim do trial. Já vencido (ou sem trial) → amanhã. */
function primeiroVencimento(trialAte: Date | null): string {
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
  const alvo = trialAte && new Date(trialAte) > amanha ? new Date(trialAte) : amanha
  return alvo.toISOString().slice(0, 10)
}

// POST — a artesã vira assinante. body: { cpf, plano: 'mensal'|'anual' }
//
// 🔒 O CPF é exigido pelo Asaas para criar o cliente. Ele NÃO é gravado por nós e
//    NUNCA vai para log — se precisar aparecer, vai mascarado.
// 🔒 Cartão não passa por aqui: devolvemos o invoiceUrl, e quem coleta é a página
//    hospedada do Asaas.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const workspaceId = session.user.workspaceId
  const body = await req.json().catch(() => ({}))

  if (!ehPlanoValido(body.plano)) {
    return NextResponse.json({ error: 'Escolha um plano válido.' }, { status: 400 })
  }
  const plano = getPlano(body.plano)

  const cpf = limparCpf(body.cpf)
  if (!cpfValido(cpf)) {
    return NextResponse.json({ error: 'Confira o CPF — os números não conferem.' }, { status: 400 })
  }

  if (!await asaasOperacional()) {
    return NextResponse.json(
      { error: 'O pagamento está temporariamente indisponível. Tente em alguns minutos.' },
      { status: 503 },
    )
  }

  // Já tem assinatura viva? Não criar outra — cobraria duas vezes.
  const [ja] = await prisma.$queryRaw`
    SELECT "subscriptionId", "status" FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${workspaceId} AND "status" <> 'CANCELADA'
    ORDER BY "createdAt" DESC LIMIT 1
  ` as { subscriptionId: string; status: string }[]
  if (ja) {
    return NextResponse.json(
      { error: 'Você já tem uma assinatura ativa. Se precisar mudar de plano, fale com o suporte.', subscriptionId: ja.subscriptionId },
      { status: 409 },
    )
  }

  const [ws] = await prisma.$queryRaw`
    SELECT "nome", "trialAte" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { nome: string; trialAte: Date | null }[]
  if (!ws) return NextResponse.json({ error: 'Workspace não encontrada' }, { status: 404 })

  try {
    // 1) Cliente no Asaas (idempotente por workspace+ambiente).
    const cli = await garantirCliente(workspaceId, {
      name: ws.nome,
      cpfCnpj: cpf,
      email: session.user.email ?? undefined,
      externalReference: workspaceId,
    })
    if (!cli.ok || !cli.dados?.customerId) {
      console.error(`[ASSINAR] cliente falhou ws=${workspaceId} cpf=${mascararCpf(cpf)}: ${cli.erro}`)
      return NextResponse.json({ error: cli.erro || 'Não consegui criar seu cadastro de pagamento.' }, { status: 502 })
    }

    // 2) Split de comissão — regra: só com walletId o Asaas paga sozinho.
    //    Sem wallet não é erro; é payout manual depois (ver Etapa 4).
    const parceiro = await parceiroDoWorkspace(workspaceId)
    let split: { walletId: string; fixedValue?: number }[] = []
    let snapshot: { walletId: string | null; valor: number | null; perc: number | null } =
      { walletId: null, valor: null, perc: null }

    if (parceiro?.walletId) {
      const perc = percentualDoPlano(plano, parceiro)
      const valor = Math.round(plano.valor * (perc / 100) * 100) / 100
      const r = montarSplitComissao({
        walletId: parceiro.walletId,
        valorComissao: valor,
        valorCobranca: plano.valor,
        forma: 'CREDIT_CARD',
        descricao: `Comissão ${parceiro.nome} — plano ${plano.nome}`,
      })
      if (!r.ok) {
        // A guarda de estouro recusou. Melhor assinar SEM split do que emitir uma
        // cobrança que o Asaas travaria e cancelaria em 2 dias úteis.
        console.error(`[ASSINAR] split recusado ws=${workspaceId}: ${r.erro}`)
      } else {
        split = r.split
        if (r.split.length) snapshot = { walletId: parceiro.walletId, valor, perc }
      }
    }

    // 3) Assinatura. O cartão NÃO é cobrado agora: com nextDueDate futuro o Asaas
    //    apenas gera a cobrança, e a artesã paga na página dele.
    const dadosAssinatura = {
      workspaceId,
      customerId: cli.dados.customerId,
      valor: plano.valor,
      primeiroVencimento: primeiroVencimento(ws.trialAte),
      ciclo: plano.ciclo,
      forma: 'CREDIT_CARD' as const,
      descricao: `SOA — plano ${plano.nome}`,
      referencia: workspaceId,
      parceiroId: parceiro?.id ?? null,
    }

    let ass = await criarAssinatura({ ...dadosAssinatura, split })

    // A COMISSÃO NUNCA PODE IMPEDIR O PAGAMENTO. Se o Asaas recusar por causa do
    // split (carteira inválida, wallet do próprio dono, split maior que o líquido),
    // refazemos SEM split: a artesã assina, e a comissão vira acerto manual. O
    // contrário — travar a receita porque a wallet de um parceiro está errada —
    // seria muito pior, e a artesã não tem como resolver isso sozinha.
    if (!ass.ok && split.length) {
      console.error(`[ASSINAR] split recusado pelo Asaas ws=${workspaceId} parceiro=${parceiro?.id}: ${ass.erro} — refazendo sem split`)
      split = []
      snapshot = { walletId: null, valor: null, perc: null }
      ass = await criarAssinatura(dadosAssinatura)
    }

    if (!ass.ok || !ass.dados?.subscriptionId) {
      console.error(`[ASSINAR] assinatura falhou ws=${workspaceId}: ${ass.erro}`)
      return NextResponse.json({ error: ass.erro || 'Não consegui criar sua assinatura.' }, { status: 502 })
    }

    // 4) Snapshot do split: FOTO do momento. Se o Master editar o % depois, as
    //    cobranças futuras seguem repassando este valor — é o que o webhook
    //    (Etapa 4) precisa saber para registrar quanto realmente foi pago.
    await prisma.$executeRaw`
      UPDATE "AsaasAssinatura"
      SET "splitWalletId" = ${snapshot.walletId},
          "splitValor" = ${snapshot.valor},
          "splitPercentual" = ${snapshot.perc},
          "updatedAt" = NOW()
      WHERE "subscriptionId" = ${ass.dados.subscriptionId}
    `

    // 5) Marca a workspace como governada pelo Asaas. É o que faz a máquina de
    //    estados passar a valer para ela (lib/assinatura só age em origem 'asaas').
    await prisma.$executeRaw`
      UPDATE "Workspace"
      SET "assinaturaOrigem" = 'asaas', "updatedAt" = NOW()
      WHERE "id" = ${workspaceId}
    `

    // 6) invoiceUrl — o link onde ela cadastra o cartão. A cobrança nasce NO
    //    ASAAS, então buscamos na hora: esperar o webhook deixaria a artesã sem
    //    link justamente no clique em que ela decidiu pagar.
    const sync = await sincronizarCobrancasDaAssinatura(ass.dados.subscriptionId, workspaceId)
    const cob = sync.dados?.[0] ?? null
    if (!cob) console.warn(`[ASSINAR] sem cobrança ainda sub=${ass.dados.subscriptionId}: ${sync.erro ?? 'lista vazia'}`)

    console.log(`[ASSINAR] ok ws=${workspaceId} plano=${plano.id} sub=${ass.dados.subscriptionId} split=${split.length ? 'sim' : 'nao'}`)

    return NextResponse.json({
      ok: true,
      subscriptionId: ass.dados.subscriptionId,
      plano: plano.id,
      invoiceUrl: cob?.invoiceUrl ?? null,
      estado: await estadoDaAssinatura(workspaceId),
    })

  } catch (e) {
    // Nunca ecoa o CPF nem detalhe interno para a tela.
    console.error(`[ASSINAR] erro ws=${workspaceId}:`, (e as Error)?.message)
    return NextResponse.json({ error: 'Algo deu errado ao criar sua assinatura. Tente de novo.' }, { status: 500 })
  }
}
