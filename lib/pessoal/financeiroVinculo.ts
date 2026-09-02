// Vínculo de um lançamento → item PESSOAL (tarefa/agenda e/ou nota) do usuário que salva.
// A flag no lançamento cria/atualiza/remove um item pessoal AUTOMÁTICO e IDEMPOTENTE por
// (userId, origemTipo, origemId=lançamento.id). origemTipo='financeiro' = lançamento do ateliê;
// 'financeiro_pessoal' = lançamento do FINANCEIRO PESSOAL. Calendário e Tarefa são a MESMA
// PessoalTarefa: uma tarefa COM prazo já aparece na agenda — por isso 1 flag "agenda".
// Best-effort: NUNCA lança (não pode derrubar o salvamento do lançamento) — loga e segue.
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from './schema'
import { assinaturaAtiva } from './assinatura'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Instante do lembrete: (vencimento − N dias) às 09:00 de São Paulo (=12:00 UTC).
// dias: 0=no dia · 1=1 dia antes · 3=3 dias antes · null/undefined=sem lembrete.
function lembreteTimestamp(dataDate: string | null, dias: number | null | undefined): Date | null {
  if (!dataDate || dias == null) return null
  const d = new Date(dataDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - dias)
  return d
}

export async function sincronizarVinculoPessoal(p: {
  userId: string; lancamentoId: string
  descricao: string; valor: number; data: string | null; tipo: string
  agenda: boolean; nota: boolean; origemTipo?: string
  lembreteDias?: number | null   // undefined = não mexe no lembrete; null = sem lembrete
  pago?: boolean                 // undefined = não mexe no status; true = tarefa CONCLUIDA
}): Promise<void> {
  try {
    const ORIGEM = p.origemTipo || 'financeiro'
    // Sem o add-on Pessoal ativo → não cria nada (a flag nem deveria ter aparecido).
    if (!(await assinaturaAtiva(p.userId))) return
    await ensurePessoalTables()

    const titulo = `${String(p.descricao || '').trim()} — ${brl(p.valor)}`.slice(0, 200)
    const dataDate = p.data && /^\d{4}-\d{2}-\d{2}/.test(String(p.data)) ? String(p.data).slice(0, 10) : null
    const lembrete = lembreteTimestamp(dataDate, p.lembreteDias)
    const novoStatus = p.pago === undefined ? null : (p.pago ? 'CONCLUIDA' : 'PENDENTE')

    // ── TAREFA / AGENDA (PessoalTarefa com prazo = já aparece no calendário) ──
    const [t] = await prisma.$queryRaw`
      SELECT "id" FROM "PessoalTarefa"
      WHERE "userId" = ${p.userId} AND "origemTipo" = ${ORIGEM} AND "origemId" = ${p.lancamentoId} LIMIT 1
    ` as { id: string }[]
    if (p.agenda) {
      if (t) {
        await prisma.$executeRaw`UPDATE "PessoalTarefa" SET "titulo" = ${titulo}, "prazo" = ${dataDate}::date WHERE "id" = ${t.id}`
        // lembrete só quando o form envia a escolha; re-arma (lembreteEnviado=false) pra disparar de novo.
        if (p.lembreteDias !== undefined) await prisma.$executeRaw`UPDATE "PessoalTarefa" SET "lembrete" = ${lembrete}, "lembreteEnviado" = false WHERE "id" = ${t.id}`
        if (novoStatus) await prisma.$executeRaw`UPDATE "PessoalTarefa" SET "status" = ${novoStatus} WHERE "id" = ${t.id}`
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PessoalTarefa" ("id","userId","titulo","prazo","lembrete","lembreteEnviado","status","origemTipo","origemId")
          VALUES (${gid()}, ${p.userId}, ${titulo}, ${dataDate}::date, ${lembrete}, false, ${novoStatus || 'PENDENTE'}, ${ORIGEM}, ${p.lancamentoId})`
      }
    } else if (t) {
      await prisma.$executeRaw`DELETE FROM "PessoalTarefa" WHERE "id" = ${t.id}`
    }

    // ── NOTA ──
    const corpo = `${p.tipo === 'RECEITA' ? 'A receber' : 'A pagar'}: ${brl(p.valor)}${dataDate ? ` · vencimento ${dataDate}` : ''}`
    const [n] = await prisma.$queryRaw`
      SELECT "id" FROM "PessoalNota"
      WHERE "userId" = ${p.userId} AND "origemTipo" = ${ORIGEM} AND "origemId" = ${p.lancamentoId} LIMIT 1
    ` as { id: string }[]
    if (p.nota) {
      if (n) {
        await prisma.$executeRaw`UPDATE "PessoalNota" SET "titulo" = ${p.descricao}, "conteudo" = ${corpo}, "resumo" = ${corpo}, "updatedAt" = NOW() WHERE "id" = ${n.id}`
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PessoalNota" ("id","userId","titulo","conteudo","resumo","origemTipo","origemId")
          VALUES (${gid()}, ${p.userId}, ${p.descricao}, ${corpo}, ${corpo}, ${ORIGEM}, ${p.lancamentoId})`
      }
    } else if (n) {
      await prisma.$executeRaw`DELETE FROM "PessoalNota" WHERE "id" = ${n.id}`
    }
  } catch (e) {
    console.error('[pessoal-vinculo] sincronizar falhou (ignorado):', (e as Error)?.message)
  }
}

// Reflete o status do lançamento na tarefa vinculada: pagar → CONCLUIDA, reabrir → PENDENTE.
// Usado no "dar baixa" (patch de status), sem reeditar o resto. Best-effort.
export async function concluirVinculoPessoal(userId: string, lancamentoId: string, pago: boolean, origemTipo = 'financeiro'): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "PessoalTarefa" SET "status" = ${pago ? 'CONCLUIDA' : 'PENDENTE'}
      WHERE "userId" = ${userId} AND "origemTipo" = ${origemTipo} AND "origemId" = ${lancamentoId}
    `
  } catch (e) {
    console.error('[pessoal-vinculo] concluir falhou (ignorado):', (e as Error)?.message)
  }
}

// Remove os itens pessoais vinculados quando o lançamento é excluído.
export async function removerVinculoPessoal(userId: string, lancamentoId: string, origemTipo = 'financeiro'): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM "PessoalTarefa" WHERE "userId" = ${userId} AND "origemTipo" = ${origemTipo} AND "origemId" = ${lancamentoId}`
    await prisma.$executeRaw`DELETE FROM "PessoalNota"   WHERE "userId" = ${userId} AND "origemTipo" = ${origemTipo} AND "origemId" = ${lancamentoId}`
  } catch (e) {
    console.error('[pessoal-vinculo] remover falhou (ignorado):', (e as Error)?.message)
  }
}
