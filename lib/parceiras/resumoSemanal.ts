// Resumo semanal da parceira — 1 e-mail/semana por parceira aprovada.
//
// Agrega SÓ dados da própria parceira (cliques/cadastros/assinaturas dos últimos
// 7 dias + ganhos recebido/pendente acumulados). Nenhuma PII: os números são
// agregados; a copy nunca cita indicada. Idempotente por (parceira, competência
// ISO da semana) via ParceiroAviso — rodar o cron várias vezes na semana não
// repete o envio. Nunca lança por parceira: uma falha não derruba as demais.
import { prisma } from '@/lib/prisma'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'
import { enviarEmailParceira, emailResumoSemanal, emailResumoSemanalSemNovidades } from '@/lib/parceiras/emails'

const TIPO = 'RESUMO_SEMANAL'
const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Competência ISO da semana (ex.: "2026-W30") — chave de idempotência. */
export function competenciaSemana(base: Date): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
  const dia = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dia) // quinta-feira da semana ISO
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const semana = Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`
}

export interface ResultadoResumos { competencia: string; enviados: number; pulados: number; erros: number }

export async function enviarResumosSemanais(agora = new Date()): Promise<ResultadoResumos> {
  const competencia = competenciaSemana(agora)
  const out: ResultadoResumos = { competencia, enviados: 0, pulados: 0, erros: 0 }
  if (!parceirasAtivo()) return out

  const parceiras = await prisma.$queryRaw`
    SELECT "id", "nome", "email", "cupom" FROM "Parceiro"
    WHERE "status" = 'aprovada' AND "ativo" = true AND "email" IS NOT NULL
  ` as { id: string; nome: string | null; email: string; cupom: string | null }[]

  for (const p of parceiras) {
    try {
      // Trava de idempotência ANTES do envio: se não voltou linha, já saiu esta semana.
      const marcado = await prisma.$queryRaw`
        INSERT INTO "ParceiroAviso" ("id","parceiroId","tipo","competencia","createdAt")
        VALUES (${novoId()}, ${p.id}, ${TIPO}, ${competencia}, NOW())
        ON CONFLICT ("parceiroId","tipo","competencia") DO NOTHING
        RETURNING "id"
      ` as { id: string }[]
      if (!marcado.length) { out.pulados++; continue }
      const liberar = () => prisma.$executeRaw`DELETE FROM "ParceiroAviso" WHERE "id" = ${marcado[0].id} AND "enviadoEm" IS NULL`.catch(() => {})

      // Agregados da semana + ganhos acumulados. Sem PII.
      const [ag] = await prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*)::int FROM "ParceiroClique" WHERE "parceiroId" = ${p.id} AND "criadoEm" > NOW() - INTERVAL '7 days') AS cliques,
          (SELECT COUNT(*)::int FROM "Lead" WHERE "parceiroId" = ${p.id} AND "createdAt" > NOW() - INTERVAL '7 days') AS cadastros,
          (SELECT COUNT(*)::int FROM "AsaasAssinatura" a
             WHERE a."parceiroId" = ${p.id} AND a."createdAt" > NOW() - INTERVAL '7 days') AS assinaturas,
          (SELECT COALESCE(SUM("valor"),0)::float FROM "ParceiroComissao"
             WHERE "parceiroId" = ${p.id} AND "status" = 'pago_via_split') AS recebido,
          (SELECT COALESCE(SUM("base" * "percentual" / 100),0)::float FROM "ParceiroComissao"
             WHERE "parceiroId" = ${p.id} AND "status" = 'pendente') AS pendente
      ` as { cliques: number; cadastros: number; assinaturas: number; recebido: number; pendente: number }[]

      const semMovimento = (ag.cliques + ag.cadastros + ag.assinaturas) === 0
      const { assunto, corpo } = semMovimento
        ? emailResumoSemanalSemNovidades(p.nome, p.cupom || '')
        : emailResumoSemanal(p.nome, { cliques: ag.cliques, cadastros: ag.cadastros, assinaturas: ag.assinaturas, recebido: brl(ag.recebido), pendente: brl(ag.pendente) })

      const ok = await enviarEmailParceira(p.email, assunto, corpo)
      if (!ok) { await liberar(); out.erros++; continue }

      await prisma.$executeRaw`UPDATE "ParceiroAviso" SET "enviadoEm" = NOW() WHERE "id" = ${marcado[0].id}`
      out.enviados++
    } catch (e) {
      out.erros++
      console.error(`[PARCEIRA] resumo semanal falhou parceira=${p.id}:`, (e as Error)?.message)
    }
  }
  console.log(`[PARCEIRA] resumos ${competencia}: enviados=${out.enviados} pulados=${out.pulados} erros=${out.erros}`)
  return out
}
