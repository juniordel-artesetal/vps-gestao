import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { decidir, diasAte, type LinhaRegua, type TipoAviso } from '@/lib/assinatura/regua'
import { PONTOS, montarEmail, PARCELADO_ATIVO } from '@/lib/assinatura/avisos'
import { marcacoesPendentes, type Variaveis } from '@/lib/assinatura/template'
import { DIAS_CARENCIA } from '@/lib/assinatura'
import { PLANOS, PARCELADO_12X, formatarBRL } from '@/lib/assinatura/planos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Job diário da assinatura: avisos da régua + corte depois da carência.
 *
 * Por que é job e não webhook: o Asaas manda PAYMENT_OVERDUE no DIA do
 * vencimento, não sete dias depois. Não existe evento "7 dias em atraso" —
 * alguém precisa olhar o relógio, e é aqui.
 *
 * `dryRun=1` roda tudo e reporta o que FARIA, sem mandar e-mail nem cortar.
 * É como se prova a régua sem torrar e-mail de ninguém.
 */
export async function POST(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  const hoje = new Date()

  // Só o que a régua pode tocar. O filtro por origem já exclui Hotmart e contas
  // antigas no BANCO — não confiamos apenas na guarda da função.
  const linhas = await prisma.$queryRaw`
    SELECT w."id" AS "workspaceId", w."assinaturaOrigem", w."assinaturaStatus",
           w."liberacaoManual", w."ativo", w."trialAte", w."assinaturaExpira",
           a."proximoVencimento", a."ciclo",
           EXISTS (
             SELECT 1 FROM "AsaasCobranca" c
             WHERE c."subscriptionId" = a."subscriptionId" AND c."status" = 'OVERDUE'
           ) AS "parcelaFalhou"
    FROM "Workspace" w
    LEFT JOIN LATERAL (
      SELECT "subscriptionId", "proximoVencimento", "ciclo"
      FROM "AsaasAssinatura" WHERE "workspaceId" = w."id"
      ORDER BY "createdAt" DESC LIMIT 1
    ) a ON true
    WHERE w."assinaturaOrigem" = 'asaas'
      AND w."liberacaoManual" = false
      AND w."assinaturaStatus" NOT IN ('CORTADA', 'CANCELADA')
  ` as LinhaRegua[]

  const resultado = {
    dryRun, analisadas: linhas.length,
    avisos: [] as { workspaceId: string; tipo: TipoAviso; enviado: boolean; motivo?: string }[],
    cortadas: [] as { workspaceId: string; motivo: string }[],
    erros: [] as string[],
  }

  for (const l of linhas) {
    const d = decidir(l, hoje)
    if (!d.avisos.length && !d.cortar) continue

    for (const tipo of d.avisos) {
      try {
        // IDEMPOTÊNCIA: o índice único em (workspaceId, tipo, dia) é a trava.
        // Se não voltou linha, este aviso já saiu hoje — não repete.
        const inserido = await prisma.$queryRaw`
          INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt")
          VALUES (${gerarId()}, ${l.workspaceId}, ${tipo}, CURRENT_DATE, NOW())
          ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING
          RETURNING "id"
        ` as { id: string }[]

        if (!inserido.length) {
          resultado.avisos.push({ workspaceId: l.workspaceId, tipo, enviado: false, motivo: 'já enviado hoje' })
          continue
        }

        if (dryRun) {
          // Desfaz a marca para o dry-run não "gastar" o aviso do dia.
          await prisma.$executeRaw`DELETE FROM "AssinaturaAviso" WHERE "id" = ${inserido[0].id}`
          resultado.avisos.push({ workspaceId: l.workspaceId, tipo, enviado: false, motivo: 'dryRun' })
          continue
        }

        await enviarAviso(l.workspaceId, tipo, l)
        await prisma.$executeRaw`
          UPDATE "AssinaturaAviso" SET "enviadoEm" = NOW() WHERE "id" = ${inserido[0].id}
        `
        resultado.avisos.push({ workspaceId: l.workspaceId, tipo, enviado: true })
      } catch (e) {
        const msg = (e as Error)?.message?.slice(0, 200) ?? 'erro'
        resultado.erros.push(`${l.workspaceId}/${tipo}: ${msg}`)
      }
    }

    if (d.cortar && !dryRun) {
      // Dupla checagem de liberacaoManual no próprio UPDATE: entre a leitura e
      // aqui, o Master pode ter protegido a conta. Cortar quem foi protegido no
      // meio do caminho seria o pior tipo de corte.
      const n = await prisma.$executeRaw`
        UPDATE "Workspace"
        SET "assinaturaStatus" = 'CORTADA', "ativo" = false, "updatedAt" = NOW()
        WHERE "id" = ${l.workspaceId}
          AND "liberacaoManual" = false
          AND "assinaturaOrigem" = 'asaas'
      `
      if (n > 0) resultado.cortadas.push({ workspaceId: l.workspaceId, motivo: d.motivo })
    } else if (d.cortar) {
      resultado.cortadas.push({ workspaceId: l.workspaceId, motivo: `[dryRun] ${d.motivo}` })
    }
  }

  console.log(`[CRON-ASSINATURAS] ${dryRun ? '(dryRun) ' : ''}analisadas=${resultado.analisadas} avisos=${resultado.avisos.filter(a => a.enviado).length} cortadas=${resultado.cortadas.length} erros=${resultado.erros.length}`)
  return NextResponse.json(serialize(resultado))
}

/**
 * Alimenta as variáveis que a copy usa. Cada ponto declara as suas em
 * `PONTOS[tipo].variaveis`; aqui elas viram valor de verdade.
 *
 * Datas e dinheiro sempre formatados em pt-BR: a artesã lê "27/07/2026" e
 * "29,90", não "2026-07-27" e "29.9".
 */
async function montarVariaveis(workspaceId: string, l: LinhaRegua, comuns: Variaveis): Promise<Variaveis> {
  const dataBR = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''
  const num = (v: number) => v.toFixed(2).replace('.', ',')

  const diasTrial = diasAte(l.trialAte)
  const diasVenc = diasAte(l.assinaturaExpira)

  // Cobrança em aberto: valor, vencimento e o link de pagamento.
  const [cob] = await prisma.$queryRaw`
    SELECT c."valor"::float AS valor, c."vencimento", c."invoiceUrl", c."paymentId"
    FROM "AsaasCobranca" c
    JOIN "AsaasAssinatura" a ON a."subscriptionId" = c."subscriptionId"
    WHERE a."workspaceId" = ${workspaceId}
      AND c."status" NOT IN ('RECEIVED','CONFIRMED','REFUNDED','DELETED')
    ORDER BY c."vencimento" ASC NULLS LAST LIMIT 1
  ` as { valor: number; vencimento: Date | null; invoiceUrl: string | null; paymentId: string }[]

  // Valor da assinatura — necessário no aviso de renovação (D-7), quando a
  // cobrança do próximo ciclo AINDA NÃO EXISTE. Sem este fallback, o e-mail
  // anual sairia com "Valor: R$  à vista".
  const [ass] = await prisma.$queryRaw`
    SELECT "valor"::float AS valor FROM "AsaasAssinatura"
    WHERE "workspaceId" = ${workspaceId} ORDER BY "createdAt" DESC LIMIT 1
  ` as { valor: number }[]

  const valorVigente = cob?.valor ?? ass?.valor ?? null

  return {
    ...comuns,
    // Trial
    diasRestantes: diasTrial !== null && diasTrial > 0 ? diasTrial : 0,
    diasDeCarencia: DIAS_CARENCIA,
    diasAteCorte: diasTrial !== null
      ? Math.max(0, diasTrial + DIAS_CARENCIA)
      : diasVenc !== null ? Math.max(0, diasVenc + DIAS_CARENCIA) : 0,
    // Planos
    planoMensal: num(PLANOS.mensal.valor),
    planoAnual: num(PLANOS.anual.valor),
    planoParcelado: num(PARCELADO_12X.valorParcela),
    // Cobrança (ou o valor da assinatura, quando ainda não há cobrança emitida)
    valor: valorVigente !== null ? num(valorVigente) : '',
    vencimento: dataBR(cob?.vencimento),
    invoiceUrl: cob?.invoiceUrl ?? `${process.env.NEXTAUTH_URL ?? ''}/assinatura`,
    // Renovação anual
    proximoVencimento: dataBR(l.proximoVencimento),
    // Parcelado — só verdadeiro quando a Opção D estiver no ar
    ehParcelado: PARCELADO_ATIVO && l.ciclo === 'YEARLY',
    valorParcela: num(PARCELADO_12X.valorParcela),
    numeroParcela: 1,
    totalParcelas: PARCELADO_12X.parcelas,
  }
}

/**
 * Envio pelo Resend. Falha de e-mail não derruba o job nem impede o corte: o
 * aviso fica registrado com o erro, para reenvio manual.
 */
async function enviarAviso(workspaceId: string, tipo: TipoAviso, l: LinhaRegua) {
  const ponto = PONTOS[tipo]
  const [dest] = await prisma.$queryRaw`
    SELECT u."email", u."nome", w."nome" AS "workspaceNome"
    FROM "User" u JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE u."workspaceId" = ${workspaceId} AND u."role" = 'ADMIN' AND u."ativo" = true
    ORDER BY u."createdAt" ASC LIMIT 1
  ` as { email: string; nome: string; workspaceNome: string }[]
  if (!dest?.email) throw new Error('workspace sem usuária ADMIN ativa')

  const vars = await montarVariaveis(workspaceId, l, {
    nome: dest.nome, workspaceNome: dest.workspaceNome,
    linkAssinatura: `${process.env.NEXTAUTH_URL ?? ''}/assinatura`,
  })

  // Guarda: copy com variável que o código não alimenta vira buraco no e-mail.
  const { assunto, html, texto } = montarEmail(ponto, vars)
  const buracos = marcacoesPendentes(texto + assunto)
  if (buracos.length) throw new Error(`variáveis não preenchidas: ${buracos.join(', ')}`)

  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY ausente')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SOA <suporte@vps-gestao.com.br>', to: [dest.email], subject: assunto, html,
    }),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}`)
}
