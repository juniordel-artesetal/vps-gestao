// Régua da campanha de migração: roda a VALIDAÇÃO (quem já migrou) + a CADÊNCIA de
// e-mails (só quem não migrou e não deu opt-out). Idempotente (1 e-mail/dia por
// pessoa). DRY-RUN por padrão: o ENVIO REAL só acontece com CAMPANHA_MIGRACAO_ATIVO=on
// E o link do Asaas (CAMPANHA_ASAAS_LINK) existindo — trava da dependência do épico
// de pagamento. Sem o link, nunca envia.
import { prisma } from '@/lib/prisma'
import { decidirCadencia } from '@/lib/campanha/cadencia'
import { verificarMigracao, estadoDerivado } from '@/lib/campanha/validacao'
import { montarEmailCampanha, enviarEmailCampanha, linkAsaas, type TipoEmailCampanha } from '@/lib/campanha/emails'

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export interface ResultadoCampanha {
  dryRun: boolean
  consideradas: number
  migradas: number
  expiradas: number
  enviados: number
  itens: { email: string; tipo: TipoEmailCampanha; dia: number }[]
  erros: number
}

export async function rodarCampanha(opts: { dryRun?: boolean; agora?: Date; pularValidacao?: boolean } = {}): Promise<ResultadoCampanha> {
  const agora = opts.agora ?? new Date()
  const podeEnviar = String(process.env.CAMPANHA_MIGRACAO_ATIVO || '').toLowerCase() === 'on' && !!linkAsaas()
  const dryRun = opts.dryRun ?? !podeEnviar
  const out: ResultadoCampanha = { dryRun, consideradas: 0, migradas: 0, expiradas: 0, enviados: 0, itens: [], erros: 0 }

  const rows = await prisma.$queryRaw`
    SELECT "email","primeiroNome","estado","dataInicio","qtdEmailsEnviados"
    FROM "CampanhaMigracao"
    WHERE "estado" NOT IN ('migrada','optout','expirada')
    ORDER BY "dataInicio" ASC
  ` as { email: string; primeiroNome: string | null; estado: string; dataInicio: Date; qtdEmailsEnviados: number }[]

  const diaHoje = agora.toISOString().slice(0, 10)

  for (const r of rows) {
    out.consideradas++

    // ── Cadência PRIMEIRO (barato, sem API) — decide se hoje é dia de enviar ──
    const cad = decidirCadencia(r.dataInicio, agora)
    if (cad.expira) {
      out.expiradas++
      await prisma.$executeRaw`UPDATE "CampanhaMigracao" SET "estado" = 'expirada', "updatedAt" = NOW() WHERE lower("email") = ${r.email.toLowerCase()}`
      continue
    }
    if (!cad.enviar) continue

    // ── Já recebeu o e-mail de HOJE? Pula ANTES da validação (a parte cara). ──
    // É isto que evita a "fome" da cauda: em re-execuções e no cron diário, quem já
    // foi hoje não dispara de novo as chamadas a Hotmart/Asaas — então a lista inteira
    // cabe no maxDuration e as últimas linhas nunca ficam sem processar.
    const [jaHoje] = await prisma.$queryRaw`
      SELECT 1 AS ok FROM "CampanhaMigracaoEnvio" WHERE "email" = ${r.email} AND "dia" = ${diaHoje}::date LIMIT 1
    ` as { ok: number }[]
    if (jaHoje) continue

    // ── VALIDAÇÃO (a inteligência) — só para quem vai enviar hoje. read-only nas APIs;
    //    nunca derruba a régua ──
    let estado = r.estado
    if (!opts.pularValidacao) {
      try {
        const v = await verificarMigracao(r.email)
        estado = estadoDerivado(v)
        await prisma.$executeRaw`
          UPDATE "CampanhaMigracao"
          SET "assinouAsaas" = ${v.assinouAsaas}, "hotmartCancelada" = ${v.hotmartCancelada === true},
              "estado" = ${estado},
              "migradaEm" = ${v.migrada ? agora : null},
              "updatedAt" = NOW()
          WHERE lower("email") = ${r.email.toLowerCase()} AND "estado" NOT IN ('migrada','optout','expirada')
        `
      } catch (e) { console.error('[CAMPANHA] validação', r.email, (e as Error)?.message) }
    }

    // ── Migrada: sai da régua e recebe a confirmação (1x) ──
    if (estado === 'migrada') {
      out.migradas++
      if (!dryRun) {
        const e = montarEmailCampanha('migrada', { email: r.email, primeiroNome: r.primeiroNome, envio: r.qtdEmailsEnviados })
        await enviarEmailCampanha(r.email, e.assunto, e.html)
      }
      continue
    }

    const tipo: TipoEmailCampanha = estado === 'assinou_asaas' ? 'falta_cancelar' : estado === 'cancelou_hotmart' ? 'falta_assinar' : 'fluxo'

    // Idempotência ATÔMICA (índice único email+dia): trava a corrida entre execuções
    // concorrentes; o SELECT acima é só a economia de validação, esta é a garantia.
    const marca = await prisma.$queryRaw`
      INSERT INTO "CampanhaMigracaoEnvio" ("id","email","tipo","dia") VALUES (${gerarId()}, ${r.email}, ${tipo}, ${diaHoje}::date)
      ON CONFLICT ("email","dia") DO NOTHING RETURNING "id"
    ` as { id: string }[]
    if (!marca.length) continue // corrida: outra execução já reservou hoje

    if (dryRun) {
      await prisma.$executeRaw`DELETE FROM "CampanhaMigracaoEnvio" WHERE "id" = ${marca[0].id}`
      out.itens.push({ email: r.email, tipo, dia: cad.dia })
      continue
    }

    const e = montarEmailCampanha(tipo, { email: r.email, primeiroNome: r.primeiroNome, envio: r.qtdEmailsEnviados })
    const ok = await enviarEmailCampanha(r.email, e.assunto, e.html)
    if (!ok) {
      await prisma.$executeRaw`DELETE FROM "CampanhaMigracaoEnvio" WHERE "id" = ${marca[0].id} AND "enviadoEm" IS NULL`
      out.erros++; continue
    }
    await prisma.$executeRaw`UPDATE "CampanhaMigracaoEnvio" SET "enviadoEm" = NOW() WHERE "id" = ${marca[0].id}`
    await prisma.$executeRaw`
      UPDATE "CampanhaMigracao" SET "ultimoEmailEm" = NOW(), "qtdEmailsEnviados" = "qtdEmailsEnviados" + 1, "updatedAt" = NOW()
      WHERE lower("email") = ${r.email.toLowerCase()}
    `
    out.enviados++
    out.itens.push({ email: r.email, tipo, dia: cad.dia })
  }

  console.log(`[CAMPANHA] ${dryRun ? '(dryRun) ' : ''}consideradas=${out.consideradas} migradas=${out.migradas} expiradas=${out.expiradas} enviados=${out.enviados} erros=${out.erros}`)
  return out
}
